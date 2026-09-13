/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  DATABASE_URL: Env.schema.string(),

  SESSION_COOKIE_NAME: Env.schema.string(),
  SESSION_LIFETIME: Env.schema.number(),

  STORAGE_DRIVER: Env.schema.enum(['local' as const]),
  STORAGE_ROOT: Env.schema.string(),

  SEED_ADMIN_EMAIL: Env.schema.string.optional(),
  SEED_ADMIN_PASSWORD: Env.schema.string.optional(),
})
