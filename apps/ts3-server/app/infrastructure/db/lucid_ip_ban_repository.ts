import { DateTime } from 'luxon'
import { IpBan } from '#domain/ip_ban'
import { IpBanRepository } from '#domain/ip_ban_repository'
import IpBanModel from '#infrastructure/db/ip_ban_model'

export class LucidIpBanRepository extends IpBanRepository {
  async isBanned(ip: string): Promise<boolean> {
    const row = await IpBanModel.query()
      .where('ip', ip)
      .where('expiresAt', '>', DateTime.now().toSQL()!)
      .first()

    return Boolean(row)
  }

  async findLatestByIp(ip: string): Promise<IpBan | null> {
    const row = await IpBanModel.query().where('ip', ip).orderBy('expiresAt', 'desc').first()
    return row ? this.toDomain(row) : null
  }

  async upsert(ban: IpBan): Promise<void> {
    const existing = await IpBanModel.findBy('ip', ban.ip)
    const expiresAt = DateTime.fromJSDate(ban.expiresAt)
    const createdAt = DateTime.fromJSDate(ban.createdAt)

    if (existing) {
      existing.expiresAt = expiresAt
      existing.createdAt = createdAt
      await existing.save()
      return
    }

    await IpBanModel.create({
      ip: ban.ip,
      expiresAt,
      createdAt,
    })
  }

  async removeByIp(ip: string): Promise<void> {
    await IpBanModel.query().where('ip', ip).delete()
  }

  async reload(): Promise<void> {
    await IpBanModel.query().where('expiresAt', '<=', DateTime.now().toSQL()!).delete()
  }

  async listActive(): Promise<IpBan[]> {
    const rows = await IpBanModel.query().where('expiresAt', '>', DateTime.now().toSQL()!)
    return rows.map((row) => this.toDomain(row))
  }

  private toDomain(row: IpBanModel): IpBan {
    return new IpBan(row.ip, row.expiresAt.toJSDate(), row.createdAt.toJSDate(), row.id)
  }
}
