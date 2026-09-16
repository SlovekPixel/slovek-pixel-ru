import { inject } from '@adonisjs/core'
import { LOGIN_ATTEMPT_RETENTION_MS } from '#domain/admin_credentials'
import type { LoginAttempt } from '#domain/login_attempt'
import { LoginAttemptRepository } from '#domain/login_attempt_repository'

@inject()
export class ListLoginAttempts {
  constructor(private loginAttempts: LoginAttemptRepository) {}

  async execute(): Promise<LoginAttempt[]> {
    await this.loginAttempts.deleteOlderThan(new Date(Date.now() - LOGIN_ATTEMPT_RETENTION_MS))
    return this.loginAttempts.listRecent()
  }
}
