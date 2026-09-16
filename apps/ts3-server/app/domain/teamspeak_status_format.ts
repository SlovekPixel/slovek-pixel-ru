import type { TeamSpeakStatus } from '#domain/teamspeak_gateway'

const EM_DASH = '—'

export function formatUptime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  return `${hours} hours ${minutes} minutes ${rest} seconds`
}

export type TeamSpeakStatusDto = {
  isActive: boolean
  version: string | null
  voiceHost: string
  serverName: string
  uptimeLabel: string
  licenseLabel: string
  clientsLabel: string
  channelsLabel: string
  pingLabel: string
  packetLossLabel: string
  onlineClients: { nickname: string; channelName: string }[] | null
}

export function toStatusDto(status: TeamSpeakStatus, voiceHost: string): TeamSpeakStatusDto {
  return {
    isActive: status.isActive,
    version: status.version ?? null,
    voiceHost,
    serverName: status.serverName ?? EM_DASH,
    uptimeLabel: status.uptimeSeconds !== undefined ? formatUptime(status.uptimeSeconds) : EM_DASH,
    licenseLabel: status.licenseLabel ?? EM_DASH,
    clientsLabel:
      status.clientsOnline !== undefined && status.clientsMax !== undefined
        ? `${status.clientsOnline} / ${status.clientsMax}`
        : EM_DASH,
    channelsLabel: status.channels !== undefined ? String(status.channels) : EM_DASH,
    pingLabel: status.pingMs !== undefined ? `${Math.round(status.pingMs)} ms` : EM_DASH,
    packetLossLabel:
      status.packetLossPct !== undefined ? `${status.packetLossPct.toFixed(2)}%` : EM_DASH,
    onlineClients: status.onlineClients ?? null,
  }
}
