import net from 'node:net'

export type QueryConfig = {
  host: string
  port: number
  username: string
  password: string
}

/** JSON returned by /api/status and rendered by public/app.js. */
export type Status = {
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

type Pairs = Record<string, string>
type Reply = { ok: boolean; body: string }
type Send = (command: string) => Promise<Reply>

const TIMEOUT_MS = 5000
const DASH = '—'
const LICENSE_TYPES: Pairs = {
  '0': 'No license',
  '1': 'Non-profit license',
  '2': 'Authorized license',
  '3': 'Hosting license',
}

// --- ServerQuery protocol -------------------------------------------------

const ESCAPE: Pairs = {
  '\\': '\\\\',
  '/': '\\/',
  ' ': '\\s',
  '|': '\\p',
  '\b': '\\b',
  '\f': '\\f',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '\v': '\\v',
}
const UNESCAPE: Pairs = Object.fromEntries(
  Object.entries(ESCAPE).map(([raw, esc]) => [esc[1], raw])
)

const escape = (value: string) => value.replace(/[\\/ |\b\f\n\r\t\v]/g, (char) => ESCAPE[char])
const unescape = (value: string) =>
  value.replace(/\\(.)/g, (_, char: string) => UNESCAPE[char] ?? char)

function parseItem(item: string): Pairs {
  const pairs: Pairs = {}
  for (const token of item.trim().split(/\s+/)) {
    const eq = token.indexOf('=')
    if (eq > 0) pairs[token.slice(0, eq)] = unescape(token.slice(eq + 1))
  }
  return pairs
}

const parseList = (body: string) => (body ? body.split('|').map(parseItem) : [])

const loginCommand = ({ username, password }: QueryConfig) =>
  `login client_login_name=${escape(username)} client_login_password=${escape(password)}`

/** Opens a raw ServerQuery session (TCP 10011), runs `run`, always closes the socket. */
async function withQuery<T>(config: QueryConfig, run: (send: Send) => Promise<T>): Promise<T> {
  const socket = net.createConnection({ host: config.host, port: config.port })
  const timer = setTimeout(() => socket.destroy(new Error('ServerQuery timeout')), TIMEOUT_MS)
  let buffer = ''
  let failure: Error | undefined
  let wake = () => {}

  socket.setEncoding('utf8')
  socket.on('data', (chunk: string) => {
    buffer += chunk
    wake()
  })
  socket.on('error', (error) => {
    failure = error
    wake()
  })
  socket.on('close', () => {
    failure ??= new Error('ServerQuery connection closed')
    wake()
  })

  async function readUntil(end: RegExp) {
    for (;;) {
      const match = end.exec(buffer)
      if (match) {
        const body = buffer.slice(0, match.index).trim()
        buffer = buffer.slice(match.index + match[0].length)
        return { body, match }
      }
      if (failure) throw failure
      await new Promise<void>((resolve) => {
        wake = resolve
      })
    }
  }

  const send: Send = async (command) => {
    socket.write(`${command}\n`)
    const { body, match } = await readUntil(/error id=(\d+)[^\n]*\n/)
    return { ok: match[1] === '0', body }
  }

  try {
    await readUntil(/Welcome[^\n]*\n/i)
    return await run(send)
  } finally {
    clearTimeout(timer)
    socket.destroy()
  }
}

// --- Status ---------------------------------------------------------------

type Snapshot = {
  version?: string
  info?: Pairs
  license?: Pairs
  channels?: Pairs[]
  clients?: Pairs[]
}

/** null = server unreachable. Wrong credentials still count as "active" (version answered). */
function takeSnapshot(config: QueryConfig): Promise<Snapshot | null> {
  return withQuery(config, async (send) => {
    const version = await send('version')
    if (!version.ok) return null

    const snapshot: Snapshot = { version: parseItem(version.body).version }
    if (!(await send(loginCommand(config))).ok || !(await send('use sid=1')).ok) return snapshot

    const info = await send('serverinfo')
    if (!info.ok) return snapshot
    snapshot.info = parseItem(info.body)

    const license = await send('licenseinfo')
    if (license.ok) snapshot.license = parseItem(license.body)
    const channels = await send('channellist')
    if (channels.ok) snapshot.channels = parseList(channels.body)
    const clients = await send('clientlist')
    if (clients.ok) snapshot.clients = parseList(clients.body)

    return snapshot
  })
}

function formatUptime(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours} hours ${minutes} minutes ${seconds % 60} seconds`
}

function toStatus(snapshot: Snapshot | null, voiceHost: string): Status {
  const info = snapshot?.info ?? {}
  const num = (key: string) => {
    const value = Number(info[key])
    return Number.isFinite(value) ? value : undefined
  }

  const maxClients = num('virtualserver_maxclients')
  const total = num('virtualserver_clientsonline')
  // clientsonline includes ServerQuery sessions (including ours)
  const online =
    total === undefined
      ? undefined
      : Math.max(0, total - (num('virtualserver_queryclientsonline') ?? 0))
  const uptime = num('virtualserver_uptime')
  const channels = num('virtualserver_channelsonline')
  const ping = num('virtualserver_total_ping')
  const loss = num('virtualserver_total_packetloss_total')

  const licenseType = snapshot?.license?.type
  const license =
    licenseType !== undefined
      ? (LICENSE_TYPES[licenseType] ?? 'Licensed')
      : maxClients !== undefined && maxClients <= 32
        ? 'No license'
        : undefined

  const channelNames = new Map(snapshot?.channels?.map((c) => [c.cid, c.channel_name ?? '']))
  const onlineClients =
    snapshot?.clients
      ?.filter((c) => c.client_type !== '1' && c.client_nickname)
      .map((c) => ({ nickname: c.client_nickname, channelName: channelNames.get(c.cid) ?? '' })) ??
    null

  return {
    isActive: snapshot !== null,
    version: snapshot?.version ?? null,
    voiceHost,
    serverName: info.virtualserver_name ?? DASH,
    uptimeLabel: uptime === undefined ? DASH : formatUptime(uptime),
    licenseLabel: license ?? DASH,
    clientsLabel:
      online !== undefined && maxClients !== undefined ? `${online} / ${maxClients}` : DASH,
    channelsLabel: channels === undefined ? DASH : String(channels),
    pingLabel: online && ping !== undefined ? `${Math.round(ping)} ms` : DASH,
    packetLossLabel: loss === undefined ? DASH : `${(loss <= 1 ? loss * 100 : loss).toFixed(2)}%`,
    onlineClients,
  }
}

export async function readStatus(config: QueryConfig, voiceHost: string): Promise<Status> {
  const snapshot = await takeSnapshot(config).catch(() => null)
  return toStatus(snapshot, voiceHost)
}

/** Makes the voice server require TS3_PASSWORD to join. */
export function ensureVoicePassword(config: QueryConfig): Promise<void> {
  return withQuery(config, async (send) => {
    const commands = [
      loginCommand(config),
      'use sid=1',
      `serveredit virtualserver_password=${escape(config.password)}`,
    ]
    for (const command of commands) {
      if (!(await send(command)).ok) {
        throw new Error(`ServerQuery "${command.split(' ')[0]}" failed`)
      }
    }
  })
}
