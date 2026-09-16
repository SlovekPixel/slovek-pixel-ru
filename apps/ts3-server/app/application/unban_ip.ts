import { inject } from '@adonisjs/core'
import { IpBanRepository } from '#domain/ip_ban_repository'
import { LoginAttemptRepository } from '#domain/login_attempt_repository'

@inject()
export class UnbanIp {
  constructor(
    private ipBans: IpBanRepository,
    private loginAttempts: LoginAttemptRepository
  ) {}

  async execute(ip: string): Promise<void> {
    await this.ipBans.removeByIp(ip)
    await this.loginAttempts.deleteFailedByIp(ip)
  }
}
