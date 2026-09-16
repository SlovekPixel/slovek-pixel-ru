import type { OnlineClient, TeamSpeakStatus } from '#domain/teamspeak_gateway'

const LICENSE_TYPES: Record<string, string> = {
  '0': 'No license',
  '1': 'Non-profit license',
  '2': 'Authorized license',
  '3': 'Hosting license',
}

/**
 * Escapes a value for the TeamSpeak 3 ServerQuery protocol.
 * @see https://community.teamspeak.com/t/serverquery-manual
 */
export function escapeServerQueryValue(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('/', '\\/')
    .replaceAll(' ', '\\s')
    .replaceAll('|', '\\p')
    .replaceAll('\b', '\\b')
    .replaceAll('\f', '\\f')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('\t', '\\t')
    .replaceAll('\v', '\\v')
}

export function unescapeServerQueryValue(value: string): string {
  return value
    .replaceAll('\\\\', '\\')
    .replaceAll('\\/', '/')
    .replaceAll('\\s', ' ')
    .replaceAll('\\p', '|')
    .replaceAll('\\b', '\b')
    .replaceAll('\\f', '\f')
    .replaceAll('\\n', '\n')
    .replaceAll('\\r', '\r')
    .replaceAll('\\t', '\t')
    .replaceAll('\\v', '\v')
}

export function parseErrorId(chunk: string): number | null {
  const match = chunk.match(/error id=(\d+)/)
  if (!match) {
    return null
  }
  return Number(match[1])
}

export function payloadBeforeError(chunk: string): string {
  const index = chunk.search(/(?:^|\n|\r)error id=/)
  if (index === -1) {
    return chunk.trim()
  }
  return chunk.slice(0, index).trim()
}

export function parseVersion(chunk: string): string | undefined {
  const match = chunk.match(/(?:^|\s)version=([^\s]+)/)
  if (!match) {
    return undefined
  }
  return unescapeServerQueryValue(match[1])
}

function parsePairs(item: string): Record<string, string> {
  const pairs: Record<string, string> = {}
  for (const token of item.split(/\s+/)) {
    const eq = token.indexOf('=')
    if (eq <= 0) {
      continue
    }
    pairs[token.slice(0, eq)] = unescapeServerQueryValue(token.slice(eq + 1))
  }
  return pairs
}

export function parseServerQueryPairs(chunk: string): Record<string, string> {
  const payload = payloadBeforeError(chunk)
  if (!payload) {
    return {}
  }
  return parsePairs(payload.split('|')[0] ?? payload)
}

export function parseServerQueryList(chunk: string): Record<string, string>[] {
  const payload = payloadBeforeError(chunk)
  if (!payload) {
    return []
  }
  return payload.split('|').map((item) => parsePairs(item))
}

function packetLossPercent(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === '') {
    return undefined
  }
  const value = Number(raw)
  if (!Number.isFinite(value)) {
    return undefined
  }
  return value <= 1 ? value * 100 : value
}

function licenseLabel(
  licensePairs: Record<string, string>,
  licenseOk: boolean,
  maxClients: number | undefined
): string | undefined {
  if (licenseOk && licensePairs.type !== undefined) {
    return LICENSE_TYPES[licensePairs.type] ?? 'Licensed'
  }
  if (maxClients !== undefined && maxClients <= 32) {
    return 'No license'
  }
  return undefined
}

export type QueryStatusPayload = {
  version?: string
  serverinfoMessage?: string
  licenseinfoMessage?: string
  licenseinfoErrorId?: number
  channellistMessage?: string
  clientlistMessage?: string
}

export function buildTeamSpeakStatus(payload: QueryStatusPayload): TeamSpeakStatus {
  const info = payload.serverinfoMessage ? parseServerQueryPairs(payload.serverinfoMessage) : {}

  if (!payload.serverinfoMessage) {
    return { isActive: true, version: payload.version }
  }

  const totalOnline = Number(info.virtualserver_clientsonline)
  const queryOnline = Number(info.virtualserver_queryclientsonline ?? 0)
  const voiceOnline = Number.isFinite(totalOnline)
    ? Math.max(0, totalOnline - (Number.isFinite(queryOnline) ? queryOnline : 0))
    : undefined
  const maxClients = Number(info.virtualserver_maxclients)
  const channels = Number(info.virtualserver_channelsonline)
  const uptimeSeconds = Number(info.virtualserver_uptime)
  const pingRaw = Number(info.virtualserver_total_ping)

  const channelNames = new Map<string, string>()
  if (payload.channellistMessage !== undefined) {
    for (const channel of parseServerQueryList(payload.channellistMessage)) {
      if (channel.cid) {
        channelNames.set(channel.cid, channel.channel_name ?? '')
      }
    }
  }

  let onlineClients: OnlineClient[] | undefined
  if (payload.clientlistMessage !== undefined) {
    onlineClients = parseServerQueryList(payload.clientlistMessage)
      .filter((client) => client.client_type !== '1')
      .map((client) => ({
        nickname: client.client_nickname ?? '',
        channelName: channelNames.get(client.cid ?? '') ?? '',
      }))
      .filter((client) => client.nickname)
  }

  const licenseOk = payload.licenseinfoErrorId === undefined || payload.licenseinfoErrorId === 0
  const licensePairs = payload.licenseinfoMessage
    ? parseServerQueryPairs(payload.licenseinfoMessage)
    : {}

  return {
    isActive: true,
    version: payload.version,
    serverName: info.virtualserver_name,
    uptimeSeconds: Number.isFinite(uptimeSeconds) ? uptimeSeconds : undefined,
    licenseLabel: licenseLabel(
      licensePairs,
      licenseOk,
      Number.isFinite(maxClients) ? maxClients : undefined
    ),
    clientsOnline: voiceOnline,
    clientsMax: Number.isFinite(maxClients) ? maxClients : undefined,
    channels: Number.isFinite(channels) ? channels : undefined,
    pingMs: voiceOnline && voiceOnline > 0 && Number.isFinite(pingRaw) ? pingRaw : undefined,
    packetLossPct: packetLossPercent(info.virtualserver_total_packetloss_total),
    onlineClients,
  }
}
