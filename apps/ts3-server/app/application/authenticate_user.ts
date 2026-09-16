import { inject } from '@adonisjs/core'
import {
  ADMIN_IDENTITY,
  LOGIN_ATTEMPT_RETENTION_MS,
  matchesAdminCredentials,
  type AdminIdentity,
} from '#domain/admin_credentials'
import { failedLoginWindowStart, ipBanExpiresAt, shouldBanIp, IpBan } from '#domain/ip_ban'
import { LoginAttempt } from '#domain/login_attempt'
import { IpBanRepository } from '#domain/ip_ban_repository'
import { LoginAttemptRepository } from '#domain/login_attempt_repository'

export type AuthenticateUserInput = {
  username: string
  password: string
  ip: string | null
}

export type AuthenticateUserResult =
  { ok: true; user: AdminIdentity } | { ok: false; blocked: boolean }

@inject()
export class AuthenticateUser {
  constructor(
    private loginAttempts: LoginAttemptRepository,
    private ipBans: IpBanRepository
  ) {}

  async execute(input: AuthenticateUserInput): Promise<AuthenticateUserResult> {
    const success = matchesAdminCredentials(input.username, input.password)
    const now = new Date()

    await this.loginAttempts.add(new LoginAttempt(input.username, input.ip, now, success))
    await this.loginAttempts.deleteOlderThan(new Date(now.getTime() - LOGIN_ATTEMPT_RETENTION_MS))

    if (success) {
      if (input.ip) {
        await this.loginAttempts.deleteFailedByIp(input.ip)
        await this.ipBans.removeByIp(input.ip)
      }
      return { ok: true, user: ADMIN_IDENTITY }
    }

    if (!input.ip) {
      return { ok: false, blocked: false }
    }

    const latestBan = await this.ipBans.findLatestByIp(input.ip)
    const failedCount = await this.loginAttempts.countFailedSince(
      input.ip,
      failedLoginWindowStart(latestBan, now)
    )

    if (!shouldBanIp(failedCount)) {
      return { ok: false, blocked: false }
    }

    await this.ipBans.upsert(new IpBan(input.ip, ipBanExpiresAt(now), now, latestBan?.id))
    return { ok: false, blocked: true }
  }
}
