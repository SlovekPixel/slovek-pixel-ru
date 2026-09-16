import type { ApplicationService } from '@adonisjs/core/types'
import env from '#start/env'
import { IpBanRepository } from '#domain/ip_ban_repository'
import { LoginAttemptRepository } from '#domain/login_attempt_repository'
import { TeamSpeakGateway } from '#domain/teamspeak_gateway'
import { CachedIpBanRepository } from '#infrastructure/cache/cached_ip_ban_repository'
import { LucidIpBanRepository } from '#infrastructure/db/lucid_ip_ban_repository'
import { LucidLoginAttemptRepository } from '#infrastructure/db/lucid_login_attempt_repository'
import { ServerQueryTeamSpeakGateway } from '#infrastructure/teamspeak/server_query_teamspeak_gateway'

export default class AppProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(LoginAttemptRepository, () => {
      return new LucidLoginAttemptRepository()
    })
    this.app.container.singleton(IpBanRepository, () => {
      return new CachedIpBanRepository(new LucidIpBanRepository())
    })
    this.app.container.singleton(TeamSpeakGateway, () => {
      return new ServerQueryTeamSpeakGateway({
        host: env.get('TS3_QUERY_HOST'),
        port: env.get('TS3_QUERY_PORT'),
        username: env.get('TS3_QUERY_USER').trim(),
        // Strip CR from Windows-edited .env files (password=...\r)
        password: env.get('TS3_QUERY_PASSWORD').replace(/\r/g, '').trim(),
      })
    })
  }
}
