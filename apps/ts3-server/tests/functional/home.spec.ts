import { test } from '@japa/runner'
import env from '#start/env'

const baseUrl = () => `http://${env.get('HOST')}:${env.get('PORT')}`

test.group('Public home dashboard', () => {
  test('serves TeamSpeak status without authentication', async ({ assert }) => {
    const home = await fetch(`${baseUrl()}/`, { redirect: 'manual' })
    assert.equal(home.status, 200)

    const html = await home.text()
    assert.include(html, 'Linux TeamSpeak service')
    assert.include(html, 'Voice server')
    assert.include(html, env.get('DOMAIN'))
    assert.isTrue(
      html.includes('is active') || html.includes('<strong>inactive</strong>'),
      'Home should show TeamSpeak active or inactive status'
    )
    assert.notInclude(html, 'Login logs')
    assert.notInclude(html, 'Unban IPs')
    assert.notInclude(html, 'signed in')
  })

  test('redirects unknown paths to home', async ({ assert }) => {
    const missing = await fetch(`${baseUrl()}/does-not-exist`, { redirect: 'manual' })
    assert.equal(missing.status, 302)
    assert.match(missing.headers.get('location') ?? '', /\/$/)
  })

  test('login routes are gone', async ({ assert }) => {
    const login = await fetch(`${baseUrl()}/login`, { redirect: 'manual' })
    assert.equal(login.status, 302)
    assert.match(login.headers.get('location') ?? '', /\/$/)
  })
})
