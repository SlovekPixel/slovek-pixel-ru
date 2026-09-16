import { inject } from '@adonisjs/core'
import { TeamSpeakGateway, type TeamSpeakStatus } from '#domain/teamspeak_gateway'

@inject()
export class GetTeamSpeakStatus {
  constructor(private teamspeak: TeamSpeakGateway) {}

  async execute(): Promise<TeamSpeakStatus> {
    try {
      return await this.teamspeak.getStatus()
    } catch {
      return { isActive: false }
    }
  }
}
