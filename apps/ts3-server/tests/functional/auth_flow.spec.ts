import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import env from '#start/env'
import { IpBan } from '#domain/ip_ban'
import { IpBanRepository } from '#domain/ip_ban_repository'
import IpBanModel from '#infrastructure/db/ip_ban_model'
import LoginLog from '#infrastructure/db/login_log'

const baseUrl = () => `http://${env.get('HOST')}:${env.get('PORT')}`

function cookieHeader(jar: Map<string, string>) {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
}

function storeCookies(response: Response, jar: Map<string, string>) {
  const cookies = response.headers.getSetCookie?.() ?? []
  for (const cookie of cookies) {
    const [pair] = cookie.split(';')
    const separator = pair.indexOf('=')
    if (separator === -1) {
      continue
    }
    jar.set(pair.slice(0, separator), pair.slice(separator + 1))
  }
}

function csrfToken(html: string) {
  const match =
    html.match(/name=["']_csrf["']\s+value=["']([^"']+)["']/) ??
    html.match(/value=["']([^"']+)["']\s+name=["']_csrf["']/)
  if (!match) {
    throw new Error('CSRF token not found in login page')
  }
  return match[1]
}

async function postForm(path: string, jar: Map<string, string>, fields: Record<string, string>) {
  return request(
    path,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
    },
    jar
  )
}

async function csrfFrom(path: string, jar: Map<string, string>) {
  const page = await request(path, { method: 'GET' }, jar)
  return csrfToken(await page.text())
}

async function rowCount(query: PromiseLike<unknown[]>) {
  const rows = await query
  return rows.length
}

async function loginAsAdmin(jar: Map<string, string>) {
  const token = await csrfFrom('/login', jar)
  return postForm('/login', jar, {
    _csrf: token,
    username: 'admin',
    password: 'admin',
  })
}

async function request(
  path: string,
  init: RequestInit,
  jar: Map<string, string>
): Promise<Response> {
  const headers = new Headers(init.headers)
  if (jar.size > 0) {
    headers.set('cookie', cookieHeader(jar))
  }

  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers,
    redirect: 'manual',
  })
  storeCookies(response, jar)
  return response
}

test.group('Auth flow', (group) => {
  group.each.setup(async () => {
    await LoginLog.query().delete()
    await IpBanModel.query().delete()
    const ipBans = await app.container.make(IpBanRepository)
    await ipBans.reload()
  })

  test('redirects guests from home and logs to login', async ({ assert }) => {
    const home = await fetch(`${baseUrl()}/`, { redirect: 'manual' })
    assert.equal(home.status, 302)
    assert.include(home.headers.get('location') ?? '', '/login')

    const logs = await fetch(`${baseUrl()}/login/logging`, { redirect: 'manual' })
    assert.equal(logs.status, 302)
    assert.include(logs.headers.get('location') ?? '', '/login')

    const unban = await fetch(`${baseUrl()}/login/unban`, { redirect: 'manual' })
    assert.equal(unban.status, 302)
    assert.include(unban.headers.get('location') ?? '', '/login')

    const missing = await fetch(`${baseUrl()}/does-not-exist`, { redirect: 'manual' })
    assert.equal(missing.status, 302)
    assert.match(missing.headers.get('location') ?? '', /\/$/)
  })

  test('rejects invalid credentials, accepts admin, and records usernames', async ({ assert }) => {
    const jar = new Map<string, string>()
    const loginPage = await request('/login', { method: 'GET' }, jar)
    assert.equal(loginPage.status, 200)
    const html = await loginPage.text()
    assert.include(html, 'name="username"')
    const token = csrfToken(html)

    const failed = await request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          _csrf: token,
          username: 'intruder',
          password: 'wrong',
        }).toString(),
      },
      jar
    )
    assert.equal(failed.status, 302)
    assert.include(failed.headers.get('location') ?? '', '/login')

    const failedLog = await LoginLog.query().where('username', 'intruder').first()
    assert.exists(failedLog)
    assert.equal(failedLog!.username, 'intruder')

    const freshLogin = await request('/login', { method: 'GET' }, jar)
    const nextToken = csrfToken(await freshLogin.text())

    const success = await request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          _csrf: nextToken,
          username: 'admin',
          password: 'admin',
        }).toString(),
      },
      jar
    )
    assert.equal(success.status, 302)
    assert.match(success.headers.get('location') ?? '', /\/$/)

    const home = await request('/', { method: 'GET' }, jar)
    assert.equal(home.status, 200)
    const homeHtml = await home.text()
    assert.include(homeHtml, 'admin')
    assert.include(homeHtml, 'Linux TeamSpeak service')
    assert.include(homeHtml, 'Voice server')
    assert.isTrue(
      homeHtml.includes('is active') || homeHtml.includes('<strong>inactive</strong>'),
      'Home should show TeamSpeak active or inactive status'
    )

    const logs = await request('/login/logging', { method: 'GET' }, jar)
    assert.equal(logs.status, 200)
    const logsHtml = await logs.text()
    assert.notInclude(logsHtml, 'intruder')
    assert.include(logsHtml, 'admin')
    assert.notInclude(logsHtml, 'wrong')
    assert.include(logsHtml, 'Successful')
    assert.include(logsHtml, 'log-success')

    await LoginLog.create({
      username: 'viewer',
      ip: '203.0.113.10',
      success: false,
    })
    const logsWithFail = await request('/login/logging', { method: 'GET' }, jar)
    const logsWithFailHtml = await logsWithFail.text()
    assert.include(logsWithFailHtml, 'Failed')
    assert.include(logsWithFailHtml, 'log-failed')
    assert.include(logsWithFailHtml, 'Successful')
    await LoginLog.query().where('username', 'viewer').delete()

    const failedLogs = await LoginLog.query().where('success', false)
    const bans = await IpBanModel.query()
    assert.equal(failedLogs.length, 0)
    assert.equal(bans.length, 0)

    const logout = await request(
      '/logout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ _csrf: csrfToken(logsHtml) }).toString(),
      },
      jar
    )
    assert.equal(logout.status, 302)
    assert.include(logout.headers.get('location') ?? '', '/login')

    const homeAfterLogout = await request('/', { method: 'GET' }, jar)
    assert.equal(homeAfterLogout.status, 302)
    assert.include(homeAfterLogout.headers.get('location') ?? '', '/login')
  })

  test('blocks an IP after three failed passwords without revealing the duration', async ({
    assert,
  }) => {
    const jar = new Map<string, string>()

    const postFailedLogin = async () => {
      const loginPage = await request('/login', { method: 'GET' }, jar)
      const token = csrfToken(await loginPage.text())
      return request(
        '/login',
        {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            _csrf: token,
            username: 'admin',
            password: 'wrong',
          }).toString(),
        },
        jar
      )
    }

    const first = await postFailedLogin()
    assert.equal(first.status, 302)
    const second = await postFailedLogin()
    assert.equal(second.status, 302)

    const third = await postFailedLogin()
    assert.equal(third.status, 403)
    const blockedHtml = await third.text()
    assert.include(blockedHtml, 'Access blocked')
    assert.notInclude(blockedHtml.toLowerCase(), '24 hours')
    assert.notInclude(blockedHtml.toLowerCase(), 'hour')

    const home = await request('/', { method: 'GET' }, jar)
    assert.equal(home.status, 403)
    const homeHtml = await home.text()
    assert.include(homeHtml, 'Access blocked')
    assert.notInclude(homeHtml.toLowerCase(), '24 hours')

    assert.equal(await rowCount(LoginLog.query().where('success', false)), 3)
    assert.equal(await rowCount(IpBanModel.query()), 1)
  })

  test('clears failed login rows after two failures and one success', async ({ assert }) => {
    const jar = new Map<string, string>()

    const failOnce = async () => {
      const token = await csrfFrom('/login', jar)
      return postForm('/login', jar, {
        _csrf: token,
        username: 'admin',
        password: 'wrong',
      })
    }

    const firstFail = await failOnce()
    const secondFail = await failOnce()
    assert.equal(firstFail.status, 302)
    assert.equal(secondFail.status, 302)
    assert.equal(await rowCount(LoginLog.query().where('success', false)), 2)
    assert.equal(await rowCount(IpBanModel.query()), 0)

    const success = await loginAsAdmin(jar)
    assert.equal(success.status, 302)
    assert.match(success.headers.get('location') ?? '', /\/$/)

    assert.equal(await rowCount(LoginLog.query().where('success', false)), 0)
    assert.equal(await rowCount(IpBanModel.query()), 0)
    assert.equal(await rowCount(LoginLog.query().where('success', true)), 1)
  })

  test('lets an authenticated user unban an IP and deletes sqlite rows', async ({ assert }) => {
    const jar = new Map<string, string>()
    const bannedIp = '203.0.113.10'

    const login = await loginAsAdmin(jar)
    assert.equal(login.status, 302)

    const ipBans = await app.container.make(IpBanRepository)
    await ipBans.upsert(new IpBan(bannedIp, new Date(Date.now() + 86_400_000), new Date()))
    await LoginLog.create({
      username: 'attacker',
      ip: bannedIp,
      success: false,
    })

    const page = await request('/login/unban', { method: 'GET' }, jar)
    assert.equal(page.status, 200)
    const html = await page.text()
    assert.include(html, bannedIp)
    assert.include(html, 'Unban this IP?')
    assert.include(html, 'name="ip"')

    const unban = await postForm('/login/unban', jar, {
      _csrf: csrfToken(html),
      ip: bannedIp,
    })
    assert.equal(unban.status, 302)
    assert.include(unban.headers.get('location') ?? '', '/login/unban')

    const after = await request('/login/unban', { method: 'GET' }, jar)
    assert.equal(after.status, 200)
    const afterHtml = await after.text()
    assert.notInclude(afterHtml, bannedIp)
    assert.include(afterHtml, 'No banned IP addresses.')
    assert.include(afterHtml, 'IP unbanned')

    assert.equal(await rowCount(IpBanModel.query().where('ip', bannedIp)), 0)
    assert.equal(await rowCount(LoginLog.query().where('ip', bannedIp)), 0)
  })
})
