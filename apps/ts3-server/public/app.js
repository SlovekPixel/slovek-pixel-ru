// Same as STATUS_TTL_MS in src/server.ts
const POLL_MS = 10_000
const TEXT_FIELDS = [
  'voiceHost',
  'serverName',
  'uptimeLabel',
  'licenseLabel',
  'clientsLabel',
  'channelsLabel',
  'pingLabel',
  'packetLossLabel',
]

const root = document.querySelector('[data-status-root]')
const field = (name) => root.querySelector(`[data-field="${name}"]`)

function el(tag, className, text) {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = text
  return node
}

function render(data) {
  root.classList.toggle('is-active', data.isActive)
  root.classList.toggle('is-inactive', !data.isActive)
  field('activeLabel').textContent = data.isActive ? 'is active' : 'inactive'
  field('version').textContent = data.version ? `(${data.version})` : ''
  for (const name of TEXT_FIELDS) field(name).textContent = data[name]

  const clients = data.onlineClients
  const list = field('onlineClients')
  if (!clients?.length) {
    list.replaceChildren(el('li', 'online-empty', clients ? 'No one connected' : '—'))
    return
  }
  list.replaceChildren(
    ...clients.map((client) => {
      const item = document.createElement('li')
      item.append(
        el('span', 'online-nick', client.nickname),
        el('span', 'online-channel', client.channelName)
      )
      return item
    })
  )
}

async function poll() {
  if (document.hidden) return
  try {
    const response = await fetch('/api/status', { headers: { Accept: 'application/json' } })
    if (response.ok) render(await response.json())
  } catch {
    // keep the last rendered snapshot
  }
}

poll()
setInterval(poll, POLL_MS)
document.addEventListener('visibilitychange', poll)
