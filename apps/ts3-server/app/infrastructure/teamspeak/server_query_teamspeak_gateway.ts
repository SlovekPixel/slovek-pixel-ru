import net from 'node:net'
import type { TeamSpeakGateway, TeamSpeakStatus } from '#domain/teamspeak_gateway'

export type ServerQueryClientOptions = {
  host: string
  port: number
  username: string
  password: string
  timeoutMs?: number
  cacheTtlMs?: number
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

function unescapeServerQueryValue(value: string): string {
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

function parseErrorId(chunk: string): number | null {
  const match = chunk.match(/error id=(\d+)/)
  if (!match) {
    return null
  }
  return Number(match[1])
}

function parseVersion(chunk: string): string | undefined {
  const match = chunk.match(/(?:^|\s)version=([^\s]+)/)
  if (!match) {
    return undefined
  }
  return unescapeServerQueryValue(match[1])
}

type QueryStep =
  | 'welcome'
  | 'version'
  | 'login'
  | 'use'
  | 'serveredit'
  | 'done'

/**
 * Lightweight TeamSpeak 3 ServerQuery client (raw TCP on port 10011).
 */
export class ServerQueryTeamSpeakGateway implements TeamSpeakGateway {
  private cached: { expiresAt: number; status: TeamSpeakStatus } | null = null
  private readonly timeoutMs: number
  private readonly cacheTtlMs: number

  constructor(private readonly options: ServerQueryClientOptions) {
    this.timeoutMs = options.timeoutMs ?? 3000
    this.cacheTtlMs = options.cacheTtlMs ?? 15_000
  }

  async getStatus(): Promise<TeamSpeakStatus> {
    const now = Date.now()
    if (this.cached && this.cached.expiresAt > now) {
      return this.cached.status
    }

    const status = await this.probe()
    const ttl = status.isActive ? this.cacheTtlMs : Math.min(2_000, this.cacheTtlMs)
    this.cached = { expiresAt: now + ttl, status }
    return status
  }

  /** Clears the in-memory status cache (tests / forced refresh). */
  clearCache() {
    this.cached = null
  }

  async ensureVoicePassword(): Promise<void> {
    await this.runSession({
      afterLogin: [
        { step: 'use', command: 'use sid=1' },
        {
          step: 'serveredit',
          command: `serveredit virtualserver_password=${escapeServerQueryValue(this.options.password)}`,
        },
      ],
      requireLogin: true,
    })
  }

  private async probe(): Promise<TeamSpeakStatus> {
    try {
      return await this.runSession({ afterLogin: [], requireLogin: false })
    } catch {
      return { isActive: false }
    }
  }

  private runSession(config: {
    afterLogin: Array<{ step: QueryStep; command: string }>
    requireLogin: boolean
  }): Promise<TeamSpeakStatus> {
    const { host, port, username, password } = this.options

    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port })
      let buffer = ''
      let settled = false
      let step: QueryStep = 'welcome'
      let version: string | undefined
      let afterLoginIndex = 0

      const finish = (error?: Error, status?: TeamSpeakStatus) => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timer)
        socket.removeAllListeners()
        socket.destroy()
        if (error) {
          reject(error)
          return
        }
        resolve(status ?? { isActive: false })
      }

      const timer = setTimeout(() => {
        finish(new Error('TeamSpeak ServerQuery timeout'))
      }, this.timeoutMs)

      const send = (command: string) => {
        socket.write(`${command}\n`)
      }

      const quitAndFinish = (status: TeamSpeakStatus) => {
        step = 'done'
        send('quit')
        finish(undefined, status)
      }

      const advanceAfterLogin = () => {
        if (afterLoginIndex >= config.afterLogin.length) {
          quitAndFinish({ isActive: true, version })
          return
        }
        const next = config.afterLogin[afterLoginIndex++]
        step = next.step
        send(next.command)
      }

      socket.setEncoding('utf8')

      socket.on('error', (error) => finish(error))
      socket.on('close', () => {
        if (!settled) {
          finish(new Error('TeamSpeak ServerQuery connection closed'))
        }
      })

      socket.on('data', (chunk: string) => {
        buffer += chunk

        while (true) {
          if (step === 'welcome') {
            if (!/TS3[\s\S]*Welcome/i.test(buffer)) {
              return
            }
            step = 'version'
            buffer = ''
            send('version')
            return
          }

          const errorId = parseErrorId(buffer)
          if (errorId === null) {
            return
          }

          const message = buffer
          buffer = ''

          if (step === 'version') {
            if (errorId !== 0) {
              finish(undefined, { isActive: false })
              return
            }
            version = parseVersion(message)
            step = 'login'
            send(
              `login client_login_name=${escapeServerQueryValue(username)} client_login_password=${escapeServerQueryValue(password)}`
            )
            return
          }

          if (step === 'login') {
            if (errorId !== 0) {
              if (config.requireLogin) {
                finish(new Error(`TeamSpeak ServerQuery login failed (error id=${errorId})`))
                return
              }
              // Liveness already proven by version; wrong credentials do not fail status.
              quitAndFinish({ isActive: true, version })
              return
            }
            advanceAfterLogin()
            return
          }

          if (step === 'use' || step === 'serveredit') {
            if (errorId !== 0) {
              finish(new Error(`TeamSpeak ServerQuery ${step} failed (error id=${errorId})`))
              return
            }
            advanceAfterLogin()
            return
          }

          finish(undefined, { isActive: false })
          return
        }
      })
    })
  }
}
