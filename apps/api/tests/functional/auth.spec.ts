import { test } from '@japa/runner'
import { prisma } from '#db/prisma'
import { cleanDb } from '../helpers/db.js'
import { hashPassword } from '#utils/password'

test.group('Auth', (group) => {
  group.each.setup(async () => {
    await cleanDb()
  })

  test('logs in, returns the user, and /me works with the session cookie', async ({
    client,
    assert,
  }) => {
    await prisma.user.create({
      data: {
        name: 'Admin',
        email: 'admin@example.com',
        passwordHash: await hashPassword('password-123'),
        role: 'ADMIN',
      },
    })

    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: 'admin@example.com', password: 'password-123' })

    login.assertStatus(200)
    assert.equal(login.body().user.email, 'admin@example.com')
    assert.equal(login.body().user.role, 'ADMIN')
    assert.isUndefined(login.body().user.passwordHash)

    const cookie = login.cookie('sm_session')
    assert.isDefined(cookie)
    assert.isNotEmpty(cookie!.value)

    const me = await client.get('/api/v1/auth/me').plainCookie('sm_session', cookie!.value)
    me.assertStatus(200)
    assert.equal(me.body().user.email, 'admin@example.com')
    assert.equal(me.body().user.role, 'ADMIN')
  })

  test('rejects an invalid password', async ({ client }) => {
    await prisma.user.create({
      data: {
        name: 'Admin',
        email: 'admin@example.com',
        passwordHash: await hashPassword('password-123'),
        role: 'ADMIN',
      },
    })

    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: 'admin@example.com', password: 'wrong-password' })

    login.assertStatus(401)
    login.assertBodyContains({ message: 'Invalid credentials' })
  })

  test('rejects an unknown email', async ({ client }) => {
    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: 'nobody@example.com', password: 'password-123' })

    login.assertStatus(401)
  })

  test('rejects a sign-in for an inactive user', async ({ client }) => {
    await prisma.user.create({
      data: {
        name: 'Disabled',
        email: 'disabled@example.com',
        passwordHash: await hashPassword('password-123'),
        role: 'EDITOR',
        isActive: false,
      },
    })

    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: 'disabled@example.com', password: 'password-123' })

    login.assertStatus(401)
  })

  test('rejects /me without a session cookie', async ({ client }) => {
    const me = await client.get('/api/v1/auth/me')
    me.assertStatus(401)
  })

  test('logout invalidates the session', async ({ client }) => {
    await prisma.user.create({
      data: {
        name: 'Admin',
        email: 'admin@example.com',
        passwordHash: await hashPassword('password-123'),
        role: 'ADMIN',
      },
    })

    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: 'admin@example.com', password: 'password-123' })
    const cookie = login.cookie('sm_session')!.value

    const logout = await client.post('/api/v1/auth/logout').plainCookie('sm_session', cookie)
    logout.assertStatus(204)

    const me = await client.get('/api/v1/auth/me').plainCookie('sm_session', cookie)
    me.assertStatus(401)
  })

  test('refresh rotates the session token', async ({ client, assert }) => {
    await prisma.user.create({
      data: {
        name: 'Admin',
        email: 'admin@example.com',
        passwordHash: await hashPassword('password-123'),
        role: 'ADMIN',
      },
    })

    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: 'admin@example.com', password: 'password-123' })
    const oldCookie = login.cookie('sm_session')!.value

    const refresh = await client.post('/api/v1/auth/refresh').plainCookie('sm_session', oldCookie)
    refresh.assertStatus(200)
    const newCookie = refresh.cookie('sm_session')
    assert.isDefined(newCookie)
    assert.notEqual(newCookie!.value, oldCookie)

    const oldIsDead = await client.get('/api/v1/auth/me').plainCookie('sm_session', oldCookie)
    oldIsDead.assertStatus(401)

    const newWorks = await client.get('/api/v1/auth/me').plainCookie('sm_session', newCookie!.value)
    newWorks.assertStatus(200)
    assert.equal(newWorks.body().user.email, 'admin@example.com')
  })

  test('persists audit logs for login and logout', async ({ client, assert }) => {
    await prisma.user.create({
      data: {
        name: 'Admin',
        email: 'admin@example.com',
        passwordHash: await hashPassword('password-123'),
        role: 'ADMIN',
      },
    })

    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: 'admin@example.com', password: 'password-123' })
    login.assertStatus(200)
    const cookie = login.cookie('sm_session')!.value

    await client.post('/api/v1/auth/logout').plainCookie('sm_session', cookie)

    const actions = await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } })
    assert.deepEqual(
      actions.map((entry) => entry.action),
      ['USER_LOGIN', 'USER_LOGOUT']
    )

    const userId = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@example.com' } })
    assert.equal(actions[0]!.userId, userId.id)
  })
})
