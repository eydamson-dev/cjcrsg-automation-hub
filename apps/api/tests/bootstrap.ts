import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import dotenv from 'dotenv'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import testUtils from '@adonisjs/core/services/test_utils'

function loadTestEnv() {
  const testPath = join(app.makePath(), '.env.test')
  const raw = readFileSync(testPath, 'utf8')
  const parsed = dotenv.parse(raw)
  for (const [key, value] of Object.entries(parsed)) {
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

function migrate() {
  execSync('pnpm exec prisma migrate deploy', {
    cwd: app.makePath(),
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' },
  })
}

export const plugins: Config['plugins'] = [assert(), pluginAdonisJS(app), apiClient()]

export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [
    () => {
      loadTestEnv()
      migrate()
    },
  ],
  teardown: [],
}

export const configureSuite: Config['configureSuite'] = (suite) => {
  if (['browser', 'functional', 'e2e'].includes(suite.name)) {
    return suite.setup(() => testUtils.httpServer().start())
  }
}
