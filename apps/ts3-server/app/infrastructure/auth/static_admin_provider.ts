import { symbols } from '@adonisjs/auth'
import type { SessionGuardUser, SessionUserProviderContract } from '@adonisjs/auth/types/session'
import { ADMIN_IDENTITY, type AdminIdentity } from '#domain/admin_credentials'

export class StaticAdminUserProvider implements SessionUserProviderContract<AdminIdentity> {
  declare [symbols.PROVIDER_REAL_USER]: AdminIdentity

  async createUserForGuard(user: AdminIdentity): Promise<SessionGuardUser<AdminIdentity>> {
    return {
      getId() {
        return user.id
      },
      getOriginal() {
        return user
      },
    }
  }

  async findById(identifier: string | number | BigInt) {
    if (String(identifier) !== String(ADMIN_IDENTITY.id)) {
      return null
    }

    return this.createUserForGuard(ADMIN_IDENTITY)
  }
}
