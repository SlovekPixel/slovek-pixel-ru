import type { ApplicationService } from '@adonisjs/core/types'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import { TeamSpeakGateway, TS3_QUERY_PORT } from '#domain/teamspeak_gateway'
import { ServerQueryTeamSpeakGateway } from '#infrastructure/teamspeak/server_query_teamspeak_gateway'

export default class AppProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(TeamSpeakGateway, () => {
      return new ServerQueryTeamSpeakGateway({
        host: env.get('TS3_QUERY_HOST'),
        port: TS3_QUERY_PORT,
        username: env.get('TS3_QUERY_USER').trim(),
        // Strip CR from Windows-edited .env files (password=...\r)
        password: env.get('TS3_PASSWORD').replace(/\r/g, '').trim(),
      })
    })
  }

  async start() {
    // Only when serving HTTP (skip ace commands / tests)
    if (this.app.getEnvironment() !== 'web') {
      return
    }

    try {
      const gateway = await this.app.container.make(TeamSpeakGateway)
      await gateway.ensureVoicePassword()
      logger.info('TeamSpeak voice password ensured')
    } catch (error) {
      logger.warn(
        { err: error },
        'Could not set TeamSpeak voice password (server may still be starting)'
      )
    }
  }
}
