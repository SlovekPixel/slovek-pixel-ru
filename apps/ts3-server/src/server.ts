import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import { ensureVoicePassword, readStatus, type QueryConfig, type Status } from './teamspeak.ts'

function env(name: string, fallback?: string): string {
  // strip CR from .env files edited on Windows
  const value = process.env[name]?.replace(/\r/g, '').trim() || fallback
  if (value === undefined) throw new Error(`Set ${name} in .env`)
  return value
}

const HOST = env('HOST', '0.0.0.0')
const PORT = Number(env('PORT', '3333'))
const DOMAIN = env('DOMAIN', 'ts3.slovekpixel.ru')
const query: QueryConfig = {
  host: env('TS3_QUERY_HOST', '127.0.0.1'),
  port: 10011,
  username: env('TS3_QUERY_USER', 'serveradmin'),
  password: env('TS3_PASSWORD'),
}

/** Same as POLL_MS in public/app.js: at most one ServerQuery session per interval for all viewers. */
const STATUS_TTL_MS = 10_000

let cache: { at: number; status: Promise<Status> } | undefined
function getStatus() {
  if (!cache || Date.now() - cache.at >= STATUS_TTL_MS) {
    cache = { at: Date.now(), status: readStatus(query, DOMAIN) }
  }
  return cache.status
}

const PUBLIC_DIR = new URL('../public/', import.meta.url)
const files = new Map<string, { type: string; body: Buffer }>()
for (const [path, file, type] of [
  ['/', 'index.html', 'text/html'],
  ['/app.css', 'app.css', 'text/css'],
  ['/app.js', 'app.js', 'text/javascript'],
]) {
  files.set(path, {
    type: `${type}; charset=utf-8`,
    body: await readFile(new URL(file, PUBLIC_DIR)),
  })
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end()
    return
  }

  const path = new URL(req.url ?? '/', 'http://localhost').pathname

  if (path === '/api/status') {
    const body = JSON.stringify(await getStatus())
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(body)
    return
  }

  const file = files.get(path)
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found')
    return
  }
  res.writeHead(200, { 'Content-Type': file.type, 'Cache-Control': 'no-cache' }).end(file.body)
})

server.listen(PORT, HOST, () => console.log(`Listening on http://${HOST}:${PORT}`))

// PID 1 in Docker ignores signals without explicit handlers
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(0))

// TeamSpeak may still be booting when this container starts, so retry for about a minute.
for (let attempt = 1; ; attempt++) {
  try {
    await ensureVoicePassword(query)
    console.log('TeamSpeak voice password ensured')
    break
  } catch (error) {
    if (attempt === 12) {
      console.warn(`Could not set TeamSpeak voice password: ${(error as Error).message}`)
      break
    }
    await sleep(5000)
  }
}
