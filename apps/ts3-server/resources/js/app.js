const POLL_MS = 10_000
const EM_DASH = '—'

function text(root, field, value) {
  const node = root.querySelector(`[data-field="${field}"]`)
  if (node) {
    node.textContent = value
  }
}

function renderOnline(list, clients) {
  list.replaceChildren()

  if (clients === null) {
    const empty = document.createElement('li')
    empty.className = 'online-empty'
    empty.textContent = EM_DASH
    list.append(empty)
    return
  }

  if (!clients.length) {
    const empty = document.createElement('li')
    empty.className = 'online-empty'
    empty.textContent = 'No one connected'
    list.append(empty)
    return
  }

  for (const client of clients) {
    const item = document.createElement('li')
    const nick = document.createElement('span')
    nick.className = 'online-nick'
    nick.textContent = client.nickname
    const channel = document.createElement('span')
    channel.className = 'online-channel'
    channel.textContent = client.channelName
    item.append(nick, channel)
    list.append(item)
  }
}

function applyStatus(root, data) {
  root.classList.toggle('is-active', Boolean(data.isActive))
  root.classList.toggle('is-inactive', !data.isActive)

  const activeLabel = root.querySelector('[data-field="activeLabel"]')
  if (activeLabel) {
    activeLabel.textContent = data.isActive ? 'is active' : 'inactive'
  }

  const version = root.querySelector('[data-field="version"]')
  if (version) {
    version.textContent = data.version ? `(${data.version})` : ''
    version.classList.toggle('is-empty', !data.version)
  }

  text(root, 'voiceHost', data.voiceHost)
  text(root, 'serverName', data.serverName)
  text(root, 'uptimeLabel', data.uptimeLabel)
  text(root, 'licenseLabel', data.licenseLabel)
  text(root, 'clientsLabel', data.clientsLabel)
  text(root, 'channelsLabel', data.channelsLabel)
  text(root, 'pingLabel', data.pingLabel)
  text(root, 'packetLossLabel', data.packetLossLabel)

  const online = root.querySelector('[data-field="onlineClients"]')
  if (online) {
    renderOnline(online, data.onlineClients)
  }
}

async function pollStatus(root) {
  if (document.hidden) {
    return
  }

  try {
    const response = await fetch('/api/status', {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      return
    }
    applyStatus(root, await response.json())
  } catch {
    // Keep the last rendered snapshot if the poll fails.
  }
}

const root = document.querySelector('[data-status-root]')
if (root) {
  window.setInterval(() => {
    pollStatus(root)
  }, POLL_MS)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      pollStatus(root)
    }
  })
}
