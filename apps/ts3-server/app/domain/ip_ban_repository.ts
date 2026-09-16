import type { IpBan } from '#domain/ip_ban'

export abstract class IpBanRepository {
  abstract isBanned(ip: string): Promise<boolean>
  abstract findLatestByIp(ip: string): Promise<IpBan | null>
  abstract listActive(): Promise<IpBan[]>
  abstract upsert(ban: IpBan): Promise<void>
  abstract removeByIp(ip: string): Promise<void>
  abstract reload(): Promise<void>
}
