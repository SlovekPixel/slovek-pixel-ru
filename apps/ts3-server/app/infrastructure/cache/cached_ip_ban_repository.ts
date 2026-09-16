import { type IpBan } from '#domain/ip_ban'
import { IpBanRepository } from '#domain/ip_ban_repository'
import { type LucidIpBanRepository } from '#infrastructure/db/lucid_ip_ban_repository'

export class CachedIpBanRepository extends IpBanRepository {
  private bansByIp = new Map<string, IpBan>()
  private loaded = false

  constructor(private inner: LucidIpBanRepository) {
    super()
  }

  async isBanned(ip: string): Promise<boolean> {
    await this.ensureLoaded()
    const ban = this.bansByIp.get(ip)
    if (!ban) {
      return false
    }

    if (!ban.isActive()) {
      this.bansByIp.delete(ip)
      await this.inner.removeByIp(ip)
      return false
    }

    return true
  }

  async findLatestByIp(ip: string): Promise<IpBan | null> {
    return this.inner.findLatestByIp(ip)
  }

  async listActive(): Promise<IpBan[]> {
    await this.ensureLoaded()
    const active: IpBan[] = []

    for (const [ip, ban] of this.bansByIp) {
      if (ban.isActive()) {
        active.push(ban)
      } else {
        this.bansByIp.delete(ip)
        await this.inner.removeByIp(ip)
      }
    }

    return active.sort((left, right) => left.ip.localeCompare(right.ip))
  }

  async upsert(ban: IpBan): Promise<void> {
    await this.inner.upsert(ban)
    this.bansByIp.set(ban.ip, ban)
    this.loaded = true
  }

  async removeByIp(ip: string): Promise<void> {
    await this.inner.removeByIp(ip)
    this.bansByIp.delete(ip)
  }

  async reload(): Promise<void> {
    await this.inner.reload()
    const active = await this.inner.listActive()
    this.bansByIp = new Map(active.map((ban) => [ban.ip, ban]))
    this.loaded = true
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      await this.reload()
    }
  }
}
