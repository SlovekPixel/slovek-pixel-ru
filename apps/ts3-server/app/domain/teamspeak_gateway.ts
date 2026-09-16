export type TeamSpeakStatus = {
  isActive: boolean
  version?: string
}

export abstract class TeamSpeakGateway {
  abstract getStatus(): Promise<TeamSpeakStatus>
}
