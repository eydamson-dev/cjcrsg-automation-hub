import env from '#start/env'
import app from '@adonisjs/core/services/app'

export interface SessionConfig {
  name: string
  lifetimeDays: number
  cookie: {
    path: string
    httpOnly: boolean
    sameSite: 'lax' | 'strict' | 'none'
    secure: boolean
  }
}

const sessionConfig: SessionConfig = {
  name: env.get('SESSION_COOKIE_NAME', 'sm_session'),
  lifetimeDays: env.get('SESSION_LIFETIME', 30),

  cookie: {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: app.inProduction,
  },
}

export default sessionConfig
