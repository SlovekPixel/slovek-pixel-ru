import net from 'node:net'
import type { TeamSpeakGateway, TeamSpeakStatus } from '#domain/teamspeak_gateway'
import {
  buildTeamSpeakStatus,
  escapeServerQueryValue,
  parseErrorId,
  parseVersion,
  type QueryStatusPayload,
} from '#infrastructure/teamspeak/server_query_protocol'

export type ServerQueryClientOptions = {
  host: string
  port: number
  username: string
  password: string
  timeoutMs?: number
  cacheTtlMs?: number
}

export { escapeServerQueryValue }

type SessionCommand = {
  step: string
  command: string
  optional?: boolean
}

const STATUS_AFTER_LOGIN: SessionCommand[] = [
  { step: 'use', command: 'use sid=1' },
  { step: 'serverinfo', command: 'serverinfo' },
  { step: 'licenseinfo', command: 'licenseinfo', optional: true },
  { step: 'channellist', command: 'channellist', optional: true },
  { step: 'clientlist', command: 'clientlist', optional: true },
]

/**
 * Lightweight TeamSpeak 3 ServerQuery client (raw TCP on port 10011).
 */
export class ServerQueryTeamSpeakGateway implements TeamSpeakGateway {
  private cached: { expiresAt: number; status: TeamSpeakStatus } | null = null
  private inFlight: Promise<TeamSpeakStatus> | null = null
  private readonly timeoutMs: number
  private readonly cacheTtlMs: number

  constructor(private readonly options: ServerQueryClientOptions) {
    this.timeoutMs = options.timeoutMs ?? 5000
    this.cacheTtlMs = options.cacheTtlMs ?? 30_000
  }

  async getStatus(): Promise<TeamSpeakStatus> {
    const now = Date.now()
    if (this.cached && this.cached.expiresAt > now) {
      return this.cached.status
    }

    if (!this.inFlight) {
      this.inFlight = this.refreshStatus().finally(() => {
        this.inFlight = null
      })
    }

    return this.inFlight
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

  private async refreshStatus(): Promise<TeamSpeakStatus> {
    const status = await this.probe()
    this.cached = { expiresAt: Date.now() + this.cacheTtlMs, status }
    return status
  }

  private async probe(): Promise<TeamSpeakStatus> {
    try {
      return await this.runSession({
        afterLogin: STATUS_AFTER_LOGIN,
        requireLogin: false,
      })
    } catch {
      return { isActive: false }
    }
  }

  private runSession(config: {
    afterLogin: SessionCommand[]
    requireLogin: boolean
  }): Promise<TeamSpeakStatus> {
    const { host, port, username, password } = this.options

    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port })
      let buffer = ''
      let settled = false
      let step = 'welcome'
      let version: string | undefined
      let afterLoginIndex = 0
      let currentCommand: SessionCommand | null = null
      const payload: QueryStatusPayload = {}

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

      const finishFromPayload = () => {
        payload.version = version
        quitAndFinish(buildTeamSpeakStatus(payload))
      }

      const advanceAfterLogin = () => {
        if (afterLoginIndex >= config.afterLogin.length) {
          finishFromPayload()
          return
        }
        const next = config.afterLogin[afterLoginIndex++]
        currentCommand = next
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

          if (currentCommand && step === currentCommand.step) {
            if (errorId !== 0) {
              if (currentCommand.optional) {
                if (step === 'licenseinfo') {
                  payload.licenseinfoErrorId = errorId
                }
                advanceAfterLogin()
                return
              }
              if (config.requireLogin) {
                finish(new Error(`TeamSpeak ServerQuery ${step} failed (error id=${errorId})`))
                return
              }
              finishFromPayload()
              return
            }

            if (step === 'serverinfo') {
              payload.serverinfoMessage = message
            } else if (step === 'licenseinfo') {
              payload.licenseinfoMessage = message
              payload.licenseinfoErrorId = 0
            } else if (step === 'channellist') {
              payload.channellistMessage = message
            } else if (step === 'clientlist') {
              payload.clientlistMessage = message
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
