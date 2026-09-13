import { test } from '@japa/runner'
import { prisma } from '#db/prisma'
import { cleanDb } from '../helpers/db.js'
import { loginAsAdmin, loginAsEditor } from '../helpers/auth.js'
import { decryptToken, encryptToken } from '#services/token_crypto'

test.group('Social accounts', (group) => {
  group.each.setup(async () => {
    await cleanDb()
  })

  test('EDITOR cannot connect a Facebook account', async ({ client }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')

    const res = await client
      .post('/api/v1/social/facebook/connect')
      .plainCookie('sm_session', cookie)
      .json({ accountName: 'Main', accessToken: 'EAAGmzb9xN2cBAerTSjc9f6dGcw' })

    res.assertStatus(403)
  })

  test('ADMIN connects a Facebook account with encrypted tokens and pages', async ({
    client,
    assert,
  }) => {
    const cookie = await loginAsAdmin(client, 'admin@example.com')

    const res = await client
      .post('/api/v1/social/facebook/connect')
      .plainCookie('sm_session', cookie)
      .json({
        accountName: 'Main account',
        accessToken: 'EAAGmzb9xN2cBAerTSjc9f6dGcw1234567890',
        refreshToken: 'RFRESHTOKENabcdef1234567890',
        pages: [{ externalPageId: 'page-1', name: 'Church Page' }, { externalPageId: 'page-2' }],
      })

    res.assertStatus(201)
    assert.equal(res.body().accountName, 'Main account')
    assert.equal(res.body().hasAccessToken, true)
    assert.equal(res.body().pageCount, 2)
    assert.isUndefined(res.body().accessTokenEncrypted)
    assert.isUndefined(res.body().refreshTokenEncrypted)

    const account = await prisma.socialAccount.findUniqueOrThrow({ where: { id: res.body().id } })
    assert.notEqual(account.accessTokenEncrypted, 'EAAGmzb9xN2cBAerTSjc9f6dGcw1234567890')
    assert.equal(
      decryptToken(account.accessTokenEncrypted),
      'EAAGmzb9xN2cBAerTSjc9f6dGcw1234567890'
    )
    assert.equal(decryptToken(account.refreshTokenEncrypted), 'RFRESHTOKENabcdef1234567890')
  })

  test('lists accounts without leaking raw tokens', async ({ client, assert }) => {
    const cookie = await loginAsAdmin(client, 'admin@example.com')

    await prisma.socialAccount.create({
      data: {
        provider: 'FACEBOOK',
        accountName: 'Main',
        accessTokenEncrypted: encryptToken('SECRET-TOKEN-1234567890'),
      },
    })

    const res = await client.get('/api/v1/social/accounts').plainCookie('sm_session', cookie)
    res.assertStatus(200)
    assert.lengthOf(res.body().items, 1)
    assert.equal(res.body().items[0].hasAccessToken, true)
    assert.isUndefined(res.body().items[0].accessTokenEncrypted)
    assert.isUndefined(res.body().items[0].refreshTokenEncrypted)
  })

  test('lists pages under an account', async ({ client, assert }) => {
    const cookie = await loginAsAdmin(client, 'admin@example.com')

    const account = await prisma.socialAccount.create({
      data: { provider: 'FACEBOOK', accountName: 'Main', accessTokenEncrypted: 'x'.repeat(64) },
    })
    await prisma.socialPage.create({
      data: {
        socialAccountId: account.id,
        provider: 'FACEBOOK',
        externalPageId: 'p1',
        name: 'Alpha',
      },
    })

    const res = await client.get('/api/v1/social/pages').plainCookie('sm_session', cookie)
    res.assertStatus(200)
    assert.lengthOf(res.body().items, 1)
    assert.equal(res.body().items[0].externalPageId, 'p1')
  })
})
