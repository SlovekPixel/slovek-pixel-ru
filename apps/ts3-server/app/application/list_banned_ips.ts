import { inject } from '@adonisjs/core'
import type { IpBan } from '#domain/ip_ban'
import { IpBanRepository } from '#domain/ip_ban_repository'

@inject()
export class ListBannedIps {
  constructor(private ipBans: IpBanRepository) {}

  async execute(): Promise<IpBan[]> {
    return this.ipBans.listActive()
  }
}
