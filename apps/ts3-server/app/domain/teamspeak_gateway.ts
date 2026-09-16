export type TeamSpeakStatus = {
  isActive: boolean
  version?: string
}

/** Fixed ServerQuery port (not configurable via env). */
export const TS3_QUERY_PORT = 10011

export abstract class TeamSpeakGateway {
  abstract getStatus(): Promise<TeamSpeakStatus>

  /** Ensures the voice server requires the configured password when clients connect. */
  abstract ensureVoicePassword(): Promise<void>
}
