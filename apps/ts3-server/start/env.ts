/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| Loads from the monorepo root (not apps/ts3-server).
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../../..', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  // Public hostname (same domain for site HTTPS and TeamSpeak voice)
  DOMAIN: Env.schema.string(),

  // TeamSpeak 3 ServerQuery (port 10011 is fixed in code)
  TS3_QUERY_HOST: Env.schema.string({ format: 'host' }),
  TS3_QUERY_USER: Env.schema.string(),
  TS3_PASSWORD: Env.schema.string(),
})
