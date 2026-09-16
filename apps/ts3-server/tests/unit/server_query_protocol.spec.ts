import { test } from '@japa/runner'
import { formatUptime, toStatusDto } from '#domain/teamspeak_status_format'
import {
  buildTeamSpeakStatus,
  parseServerQueryList,
  parseServerQueryPairs,
} from '#infrastructure/teamspeak/server_query_protocol'

test.group('formatUptime', () => {
  test('matches TeamSpeak-style duration', ({ assert }) => {
    assert.equal(formatUptime(0), '0 hours 0 minutes 0 seconds')
    assert.equal(formatUptime(1093), '0 hours 18 minutes 13 seconds')
    assert.equal(formatUptime(3661), '1 hours 1 minutes 1 seconds')
  })
})

test.group('server query protocol', () => {
  test('parses escaped key/value pairs and lists', ({ assert }) => {
    const pairs = parseServerQueryPairs(
      'virtualserver_name=TeamSpeak\\s]I[\\sServer virtualserver_uptime=12\n\rerror id=0 msg=ok\n\r'
    )
    assert.equal(pairs.virtualserver_name, 'TeamSpeak ]I[ Server')
    assert.equal(pairs.virtualserver_uptime, '12')
    assert.isUndefined(pairs.msg)

    const list = parseServerQueryList(
      'cid=1 channel_name=Default\\sChannel|cid=2 channel_name=Lobby\n\rerror id=0 msg=ok\n\r'
    )
    assert.deepEqual(list, [
      { cid: '1', channel_name: 'Default Channel' },
      { cid: '2', channel_name: 'Lobby' },
    ])
  })

  test('omits query clients and secret fields from status', ({ assert }) => {
    const status = buildTeamSpeakStatus({
      version: '3.13.8',
      serverinfoMessage: [
        'virtualserver_name=Demo',
        'virtualserver_uptime=10',
        'virtualserver_clientsonline=2',
        'virtualserver_queryclientsonline=1',
        'virtualserver_maxclients=32',
        'virtualserver_channelsonline=1',
        'virtualserver_total_ping=10',
        'virtualserver_total_packetloss_total=0',
        'virtualserver_password=hidden',
      ].join(' '),
      licenseinfoMessage: 'sid=0 type=0',
      licenseinfoErrorId: 0,
      channellistMessage: 'cid=1 channel_name=Lobby',
      clientlistMessage:
        'clid=1 cid=1 client_nickname=Bob client_type=0|clid=2 cid=1 client_nickname=serveradmin client_type=1 connection_client_ip=10.0.0.1',
    })

    assert.equal(status.clientsOnline, 1)
    assert.deepEqual(status.onlineClients, [{ nickname: 'Bob', channelName: 'Lobby' }])
    assert.equal(status.pingMs, 10)
    assert.notInclude(JSON.stringify(status), 'hidden')
    assert.notInclude(JSON.stringify(status), '10.0.0.1')
  })

  test('hides ping when no voice clients are connected', ({ assert }) => {
    const status = buildTeamSpeakStatus({
      version: '3.13.8',
      serverinfoMessage:
        'virtualserver_clientsonline=1 virtualserver_queryclientsonline=1 virtualserver_maxclients=32 virtualserver_total_ping=0',
    })
    assert.equal(status.clientsOnline, 0)
    assert.isUndefined(status.pingMs)
  })
})

test.group('toStatusDto', () => {
  test('formats labels for the dashboard', ({ assert }) => {
    const dto = toStatusDto(
      {
        isActive: true,
        version: '3.13.8',
        serverName: 'Demo',
        uptimeSeconds: 1093,
        licenseLabel: 'No license',
        clientsOnline: 1,
        clientsMax: 32,
        channels: 2,
        pingMs: 32.4,
        packetLossPct: 1.25,
        onlineClients: [{ nickname: 'Alice', channelName: 'Lobby' }],
      },
      'ts.example.test'
    )

    assert.equal(dto.uptimeLabel, '0 hours 18 minutes 13 seconds')
    assert.equal(dto.clientsLabel, '1 / 32')
    assert.equal(dto.pingLabel, '32 ms')
    assert.equal(dto.packetLossLabel, '1.25%')
    assert.equal(dto.voiceHost, 'ts.example.test')
  })
})
