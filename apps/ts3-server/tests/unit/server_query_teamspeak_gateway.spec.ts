import net from 'node:net'
import { test } from '@japa/runner'
import {
  escapeServerQueryValue,
  ServerQueryTeamSpeakGateway,
} from '#infrastructure/teamspeak/server_query_teamspeak_gateway'

function startMockServer(handler: (socket: net.Socket) => void) {
  return new Promise<{ server: net.Server; port: number }>((resolve, reject) => {
    const server = net.createServer(handler)
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to bind mock ServerQuery port'))
        return
      }
      resolve({ server, port: address.port })
    })
  })
}

function closeServer(server: net.Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

function attachQueryProtocol(
  socket: net.Socket,
  options: {
    versionOk?: boolean
    loginOk?: boolean
    onCommand?: (command: string) => void
  } = {}
) {
  const versionOk = options.versionOk ?? true
  const loginOk = options.loginOk ?? true
  socket.setEncoding('utf8')
  socket.write('TS3\n\rWelcome to the TeamSpeak 3 ServerQuery interface\n\r')

  let buffer = ''
  socket.on('data', (chunk) => {
    buffer += chunk
    const lines = buffer.split(/\n/)
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const command = line.trim()
      if (!command) {
        continue
      }
      options.onCommand?.(command)

      if (command === 'version') {
        if (versionOk) {
          socket.write('version=3.13.8 platform=Linux\n\rerror id=0 msg=ok\n\r')
        } else {
          socket.write('error id=256 msg=command\\snot\\sfound\n\r')
        }
        continue
      }
      if (command.startsWith('login ')) {
        if (loginOk) {
          socket.write('error id=0 msg=ok\n\r')
        } else {
          socket.write('error id=520 msg=invalid\\sloginname\\sor\\spassword\n\r')
        }
        continue
      }
      if (command.startsWith('use ') || command.startsWith('serveredit ')) {
        socket.write('error id=0 msg=ok\n\r')
        continue
      }
      if (command === 'quit') {
        socket.end()
      }
    }
  })
}

test.group('escapeServerQueryValue', () => {
  test('escapes reserved ServerQuery characters', ({ assert }) => {
    assert.equal(escapeServerQueryValue('a b/c|d\\e'), 'a\\sb\\/c\\pd\\\\e')
  })
})

test.group('ServerQueryTeamSpeakGateway', () => {
  test('reports active when version succeeds', async ({ assert }) => {
    const { server, port } = await startMockServer((socket) => {
      attachQueryProtocol(socket, { versionOk: true, loginOk: true })
    })

    try {
      const gateway = new ServerQueryTeamSpeakGateway({
        host: '127.0.0.1',
        port,
        username: 'serveradmin',
        password: 'secret',
        timeoutMs: 1000,
        cacheTtlMs: 0,
      })

      const status = await gateway.getStatus()
      assert.isTrue(status.isActive)
      assert.equal(status.version, '3.13.8')
    } finally {
      await closeServer(server)
    }
  })

  test('reports active even when login credentials are wrong', async ({ assert }) => {
    const { server, port } = await startMockServer((socket) => {
      attachQueryProtocol(socket, { versionOk: true, loginOk: false })
    })

    try {
      const gateway = new ServerQueryTeamSpeakGateway({
        host: '127.0.0.1',
        port,
        username: 'serveradmin',
        password: 'wrong',
        timeoutMs: 1000,
        cacheTtlMs: 0,
      })

      const status = await gateway.getStatus()
      assert.isTrue(status.isActive)
      assert.equal(status.version, '3.13.8')
    } finally {
      await closeServer(server)
    }
  })

  test('reports inactive when version fails', async ({ assert }) => {
    const { server, port } = await startMockServer((socket) => {
      attachQueryProtocol(socket, { versionOk: false })
    })

    try {
      const gateway = new ServerQueryTeamSpeakGateway({
        host: '127.0.0.1',
        port,
        username: 'serveradmin',
        password: 'secret',
        timeoutMs: 1000,
        cacheTtlMs: 0,
      })

      const status = await gateway.getStatus()
      assert.isFalse(status.isActive)
    } finally {
      await closeServer(server)
    }
  })

  test('reports inactive when nothing is listening', async ({ assert }) => {
    const gateway = new ServerQueryTeamSpeakGateway({
      host: '127.0.0.1',
      port: 1,
      username: 'serveradmin',
      password: 'secret',
      timeoutMs: 500,
      cacheTtlMs: 0,
    })

    const status = await gateway.getStatus()
    assert.isFalse(status.isActive)
  })

  test('caches successful status for the configured TTL', async ({ assert }) => {
    let connections = 0
    const { server, port } = await startMockServer((socket) => {
      connections += 1
      attachQueryProtocol(socket)
    })

    try {
      const gateway = new ServerQueryTeamSpeakGateway({
        host: '127.0.0.1',
        port,
        username: 'serveradmin',
        password: 'secret',
        timeoutMs: 1000,
        cacheTtlMs: 15_000,
      })

      const first = await gateway.getStatus()
      const second = await gateway.getStatus()

      assert.isTrue(first.isActive)
      assert.isTrue(second.isActive)
      assert.equal(connections, 1)
    } finally {
      await closeServer(server)
    }
  })

  test('sets virtualserver_password via ServerQuery', async ({ assert }) => {
    const commands: string[] = []
    const password = '1122'
    const { server, port } = await startMockServer((socket) => {
      attachQueryProtocol(socket, {
        onCommand: (command) => commands.push(command),
      })
    })

    try {
      const gateway = new ServerQueryTeamSpeakGateway({
        host: '127.0.0.1',
        port,
        username: 'serveradmin',
        password,
        timeoutMs: 1000,
        cacheTtlMs: 0,
      })

      await gateway.ensureVoicePassword()
      assert.include(commands, 'use sid=1')
      assert.include(
        commands,
        `serveredit virtualserver_password=${escapeServerQueryValue(password)}`
      )
    } finally {
      await closeServer(server)
    }
  })
})
