/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

router.get('/', () => {
  return { hello: 'world' }
})

router.get('/health', () => {
  return { status: 'ok' }
})

router
  .group(() => {
    router
      .group(() => {
        router.post('/login', '#controllers/auth_controller.login')
        router
          .group(() => {
            router.post('/logout', '#controllers/auth_controller.logout')
            router.post('/refresh', '#controllers/auth_controller.refresh')
            router.get('/me', '#controllers/auth_controller.me')
          })
          .use(middleware.auth())
      })
      .prefix('/auth')

    router.get('/', () => {
      return { version: 'v1' }
    })
  })
  .prefix('/api/v1')
