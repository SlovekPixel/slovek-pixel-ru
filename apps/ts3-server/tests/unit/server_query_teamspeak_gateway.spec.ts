import net from 'node:net'
import { test } from '@japa/runner'
import {
  escapeServerQueryValue,
  ServerQueryTeamSpeakGateway,
} from '#infrastructure/teamspeak/server_query_teamspeak_gateway'

const SERVERINFO = [
  'virtualserver_name=TeamSpeak\\s]I[\\sServer',
  'virtualserver_uptime=1093',
  'virtualserver_clientsonline=2',
  'virtualserver_queryclientsonline=1',
  'virtualserver_maxclients=32',
  'virtualserver_channelsonline=2',
  'virtualserver_total_ping=32.5000',
  'virtualserver_total_packetloss_total=0.0125',
  'virtualserver_password=secret-pass',
].join(' ')

const CHANNELLIST = 'cid=1 channel_name=Default\\sChannel|cid=2 channel_name=Lobby'
const CLIENTLIST =
  'clid=1 cid=1 client_nickname=Alice client_type=0|clid=2 cid=1 client_nickname=serveradmin client_type=1 client_unique_identifier=abc connection_client_ip=1.2.3.4'

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
    licenseOk?: boolean
    onCommand?: (command: string) => void
  } = {}
) {
  const versionOk = options.versionOk ?? true
  const loginOk = options.loginOk ?? true
  const licenseOk = options.licenseOk ?? true
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
      if (command === 'serverinfo') {
        socket.write(`${SERVERINFO}\n\rerror id=0 msg=ok\n\r`)
        continue
      }
      if (command === 'licenseinfo') {
        if (licenseOk) {
          socket.write('sid=0 type=0\n\rerror id=0 msg=ok\n\r')
        } else {
          socket.write('error id=1282 msg=database\\sempty\n\r')
        }
        continue
      }
      if (command === 'channellist') {
        socket.write(`${CHANNELLIST}\n\rerror id=0 msg=ok\n\r`)
        continue
      }
      if (command === 'clientlist') {
        socket.write(`${CLIENTLIST}\n\rerror id=0 msg=ok\n\r`)
        continue
      }
      if (command === 'quit') {
        socket.end()
      }
    }
  })
}

function gatewayFor(port: number, cacheTtlMs = 0) {
  return new ServerQueryTeamSpeakGateway({
    host: '127.0.0.1',
    port,
    username: 'serveradmin',
    password: 'secret',
    timeoutMs: 1000,
    cacheTtlMs,
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
      const status = await gatewayFor(port).getStatus()
      assert.isTrue(status.isActive)
      assert.equal(status.version, '3.13.8')
    } finally {
      await closeServer(server)
    }
  })

  test('reads dashboard metrics and strips secrets', async ({ assert }) => {
    const commands: string[] = []
    const { server, port } = await startMockServer((socket) => {
      attachQueryProtocol(socket, { onCommand: (command) => commands.push(command) })
    })

    try {
      const status = await gatewayFor(port).getStatus()
      assert.isTrue(status.isActive)
      assert.equal(status.serverName, 'TeamSpeak ]I[ Server')
      assert.equal(status.uptimeSeconds, 1093)
      assert.equal(status.licenseLabel, 'No license')
      assert.equal(status.clientsOnline, 1)
      assert.equal(status.clientsMax, 32)
      assert.equal(status.channels, 2)
      assert.equal(status.pingMs, 32.5)
      assert.equal(status.packetLossPct, 1.25)
      assert.deepEqual(status.onlineClients, [
        { nickname: 'Alice', channelName: 'Default Channel' },
      ])
      assert.include(commands, 'serverinfo')
      assert.include(commands, 'clientlist')
      assert.notInclude(JSON.stringify(status), 'secret-pass')
      assert.notInclude(JSON.stringify(status), '1.2.3.4')
      assert.notInclude(JSON.stringify(status), 'abc')
    } finally {
      await closeServer(server)
    }
  })

  test('falls back to unlicensed when licenseinfo fails', async ({ assert }) => {
    const { server, port } = await startMockServer((socket) => {
      attachQueryProtocol(socket, { licenseOk: false })
    })

    try {
      const status = await gatewayFor(port).getStatus()
      assert.equal(status.licenseLabel, 'No license')
      assert.equal(status.serverName, 'TeamSpeak ]I[ Server')
    } finally {
      await closeServer(server)
    }
  })

  test('reports active even when login credentials are wrong', async ({ assert }) => {
    const commands: string[] = []
    const { server, port } = await startMockServer((socket) => {
      attachQueryProtocol(socket, {
        versionOk: true,
        loginOk: false,
        onCommand: (command) => commands.push(command),
      })
    })

    try {
      const status = await gatewayFor(port).getStatus()
      assert.isTrue(status.isActive)
      assert.equal(status.version, '3.13.8')
      assert.isUndefined(status.serverName)
      assert.notInclude(commands, 'serverinfo')
    } finally {
      await closeServer(server)
    }
  })

  test('reports inactive when version fails', async ({ assert }) => {
    const { server, port } = await startMockServer((socket) => {
      attachQueryProtocol(socket, { versionOk: false })
    })

    try {
      const status = await gatewayFor(port).getStatus()
      assert.isFalse(status.isActive)
    } finally {
      await closeServer(server)
    }
  })

  test('reports inactive when nothing is listening', async ({ assert }) => {
    const gateway = gatewayFor(1)
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
      const gateway = gatewayFor(port, 30_000)
      const first = await gateway.getStatus()
      const second = await gateway.getStatus()

      assert.isTrue(first.isActive)
      assert.isTrue(second.isActive)
      assert.equal(connections, 1)
    } finally {
      await closeServer(server)
    }
  })

  test('coalesces in-flight probes into one ServerQuery session', async ({ assert }) => {
    let connections = 0
    const { server, port } = await startMockServer((socket) => {
      connections += 1
      attachQueryProtocol(socket)
    })

    try {
      const gateway = gatewayFor(port, 30_000)
      const [first, second] = await Promise.all([gateway.getStatus(), gateway.getStatus()])

      assert.isTrue(first.isActive)
      assert.isTrue(second.isActive)
      assert.equal(first.serverName, second.serverName)
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
