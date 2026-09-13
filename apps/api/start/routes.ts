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

    router
      .group(() => {
        router.get('/posts', '#controllers/posts_controller.index')
        router.post('/posts', '#controllers/posts_controller.store')
        router.post('/posts/bible-verse', '#controllers/posts_controller.bibleVerse')

        router.get('/posts/:id', '#controllers/posts_controller.show')
        router.patch('/posts/:id', '#controllers/posts_controller.update')
        router.delete('/posts/:id', '#controllers/posts_controller.destroy')
        router.post('/posts/:id/design', '#controllers/posts_controller.design')
        router.post('/posts/:id/approve', '#controllers/posts_controller.approve')
        router.post('/posts/:id/schedule', '#controllers/posts_controller.schedule')
        router.post('/posts/:id/cancel', '#controllers/posts_controller.cancel')
        router.post('/posts/:id/publish', '#controllers/posts_controller.publish')
        router.post('/posts/:id/retry', '#controllers/posts_controller.retry')
        router.post('/posts/:id/duplicate', '#controllers/posts_controller.duplicate')

        router.get('/assets', '#controllers/assets_controller.index')
        router.post('/assets', '#controllers/assets_controller.store')
        router.get('/assets/:id', '#controllers/assets_controller.show')
        router.get('/assets/:id/content', '#controllers/assets_controller.content')
        router.delete('/assets/:id', '#controllers/assets_controller.destroy')
      })
      .use([middleware.auth(), middleware.editor()])

    router
      .group(() => {
        router.get('/canva/templates', '#controllers/templates_controller.index')
        router.post('/canva/templates', '#controllers/templates_controller.store')
        router.patch('/canva/templates/:id', '#controllers/templates_controller.update')
        router.delete('/canva/templates/:id', '#controllers/templates_controller.destroy')

        router.get('/social/accounts', '#controllers/social_accounts_controller.accounts')
        router.post(
          '/social/facebook/connect',
          '#controllers/social_accounts_controller.connectFacebook'
        )
        router.get('/social/pages', '#controllers/social_accounts_controller.pages')
      })
      .use([middleware.auth(), middleware.admin()])

    router.get('/', () => {
      return { version: 'v1' }
    })
  })
  .prefix('/api/v1')
