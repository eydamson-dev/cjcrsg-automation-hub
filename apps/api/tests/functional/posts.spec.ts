import { test } from '@japa/runner'
import { prisma } from '#db/prisma'
import { cleanDb } from '../helpers/db.js'
import { loginAsEditor } from '../helpers/auth.js'

const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
const yesterday = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

function versePayload(overrides: Record<string, unknown> = {}) {
  return {
    type: 'BIBLE_VERSE',
    translation: 'KJV',
    book: 'John',
    chapter: 3,
    verseStart: 16,
    verseEnd: 16,
    verseText: 'For God so loved the world...',
    caption: 'God is love.',
    ...overrides,
  }
}

function imagePayload(overrides: Record<string, unknown> = {}) {
  return {
    type: 'IMAGE',
    caption: 'A photo post',
    ...overrides,
  }
}

async function createFailedPublication(postId: string, errorMessage?: string) {
  const account = await prisma.socialAccount.create({
    data: { provider: 'FACEBOOK', accessTokenEncrypted: 'x'.repeat(64) },
  })
  const page = await prisma.socialPage.create({
    data: { socialAccountId: account.id, provider: 'FACEBOOK', externalPageId: 'page-1' },
  })
  return prisma.postPublication.create({
    data: {
      postId,
      socialPageId: page.id,
      status: 'FAILED',
      ...(errorMessage ? { errorMessage } : {}),
    },
  })
}

test.group('Posts', (group) => {
  group.each.setup(async () => {
    await cleanDb()
  })

  test('creates a BIBLE_VERSE post as a draft', async ({ client, assert }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')

    const res = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())

    res.assertStatus(201)
    assert.equal(res.body().id.length, 36)
    assert.equal(res.body().type, 'BIBLE_VERSE')
    assert.equal(res.body().status, 'DRAFT')
    assert.equal(res.body().bibleVerse.book, 'John')
    assert.equal(res.body().bibleVerse.verseStart, 16)
    assert.equal(res.body().caption, 'God is love.')
    assert.isUndefined(res.body().bibleVerse.postId)
  })

  test('creates a post through the /posts/bible-verse alias', async ({ client, assert }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')

    const res = await client
      .post('/api/v1/posts/bible-verse')
      .plainCookie('sm_session', cookie)
      .json(versePayload())

    res.assertStatus(201)
    assert.equal(res.body().type, 'BIBLE_VERSE')
  })

  test('rejects a BIBLE_VERSE post missing verse fields', async ({ client }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')

    const res = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload({ book: undefined, chapter: undefined }))

    res.assertStatus(422)
  })

  test('rejects an IMAGE post without a source asset', async ({ client }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')

    const res = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(imagePayload())

    res.assertStatus(422)
  })

  test('lists posts with filters and pagination', async ({ client, assert }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')

    await client.post('/api/v1/posts').plainCookie('sm_session', cookie).json(versePayload())
    await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload({ book: 'Romans', caption: 'Grace' }))

    const all = await client.get('/api/v1/posts').plainCookie('sm_session', cookie)
    all.assertStatus(200)
    assert.equal(all.body().total, 2)
    assert.lengthOf(all.body().items, 2)

    const filtered = await client
      .get('/api/v1/posts')
      .qs({ type: 'IMAGE' })
      .plainCookie('sm_session', cookie)
    assert.equal(filtered.body().total, 0)

    const searched = await client
      .get('/api/v1/posts')
      .qs({ q: 'Romans' })
      .plainCookie('sm_session', cookie)
    assert.equal(searched.body().total, 1)
  })

  test('shows a post with type-specific details', async ({ client, assert }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')

    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())
    const id = created.body().id

    const res = await client.get(`/api/v1/posts/${id}`).plainCookie('sm_session', cookie)
    res.assertStatus(200)
    assert.equal(res.body().bibleVerse.translation, 'KJV')
    assert.isArray(res.body().assets)
  })

  test('updates caption and verse fields while in DRAFT', async ({ client, assert }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())
    const id = created.body().id

    const res = await client
      .patch(`/api/v1/posts/${id}`)
      .plainCookie('sm_session', cookie)
      .json({ caption: 'Updated.', verseText: 'Updated verse text.' })

    res.assertStatus(200)
    assert.equal(res.body().caption, 'Updated.')
    assert.equal(res.body().bibleVerse.verseText, 'Updated verse text.')
  })

  test('rejects editing a post that is not editable', async ({ client }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())
    const id = created.body().id

    await prisma.post.update({ where: { id }, data: { status: 'APPROVED' } })

    const res = await client
      .patch(`/api/v1/posts/${id}`)
      .plainCookie('sm_session', cookie)
      .json({ caption: 'Nope' })

    res.assertStatus(409)
  })

  test('rejects an invalid transition with 409', async ({ client, assert }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())
    const id = created.body().id

    const res = await client.post(`/api/v1/posts/${id}/approve`).plainCookie('sm_session', cookie)
    res.assertStatus(409)
    assert.equal(res.body().code, 'E_INVALID_TRANSITION')
  })

  test('design stub moves READY to DESIGN_READY and records the template', async ({
    client,
    assert,
  }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())
    const id = created.body().id

    const template = await prisma.canvaTemplate.create({
      data: { name: 'Verse card', type: 'BIBLE_VERSE' },
    })

    await prisma.post.update({ where: { id }, data: { status: 'READY' } })

    const res = await client
      .post(`/api/v1/posts/${id}/design`)
      .plainCookie('sm_session', cookie)
      .json({ templateId: template.id })

    res.assertStatus(200)
    assert.equal(res.body().status, 'DESIGN_READY')
    assert.equal(res.body().templateId, template.id)
  })

  test('design rejects a template of the wrong type', async ({ client }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())
    const id = created.body().id

    const template = await prisma.canvaTemplate.create({
      data: { name: 'Photo frame', type: 'IMAGE' },
    })

    await prisma.post.update({ where: { id }, data: { status: 'READY' } })

    const res = await client
      .post(`/api/v1/posts/${id}/design`)
      .plainCookie('sm_session', cookie)
      .json({ templateId: template.id })

    res.assertStatus(422)
  })

  test('approve requires DESIGN_READY', async ({ client, assert }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())
    const id = created.body().id

    await prisma.post.update({ where: { id }, data: { status: 'DESIGN_READY' } })

    const res = await client.post(`/api/v1/posts/${id}/approve`).plainCookie('sm_session', cookie)
    res.assertStatus(200)
    assert.equal(res.body().status, 'APPROVED')
  })

  test('schedule sets a future scheduledAt', async ({ client, assert }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())
    const id = created.body().id

    await prisma.post.update({ where: { id }, data: { status: 'APPROVED' } })

    const res = await client
      .post(`/api/v1/posts/${id}/schedule`)
      .plainCookie('sm_session', cookie)
      .json({ scheduledAt: tomorrow() })

    res.assertStatus(200)
    assert.equal(res.body().status, 'SCHEDULED')
  })

  test('schedule rejects a past scheduledAt', async ({ client }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())
    const id = created.body().id

    await prisma.post.update({ where: { id }, data: { status: 'APPROVED' } })

    const res = await client
      .post(`/api/v1/posts/${id}/schedule`)
      .plainCookie('sm_session', cookie)
      .json({ scheduledAt: yesterday() })

    res.assertStatus(422)
  })

  test('publish queues a publication and a job', async ({ client, assert }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())
    const id = created.body().id

    await prisma.post.update({
      where: { id },
      data: { status: 'SCHEDULED', scheduledAt: new Date() },
    })

    const account = await prisma.socialAccount.create({
      data: { provider: 'FACEBOOK', accountName: 'Main', accessTokenEncrypted: 'x'.repeat(64) },
    })
    const page = await prisma.socialPage.create({
      data: {
        socialAccountId: account.id,
        provider: 'FACEBOOK',
        externalPageId: 'page-1',
        name: 'Church',
      },
    })

    const res = await client
      .post(`/api/v1/posts/${id}/publish`)
      .plainCookie('sm_session', cookie)
      .json({ socialPageId: page.id })

    res.assertStatus(200)
    assert.equal(res.body().status, 'PUBLISHING')
    assert.lengthOf(res.body().publications, 1)
    assert.equal(res.body().publications[0].status, 'PENDING')
    assert.equal(res.body().publications[0].socialPageId, page.id)
    assert.lengthOf(res.body().jobs, 1)
    assert.equal(res.body().jobs[0].jobType, 'PUBLISH_FACEBOOK')
    assert.equal(res.body().jobs[0].status, 'PENDING')
  })

  test('publish requires an active social page', async ({ client }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())
    const id = created.body().id

    await prisma.post.update({ where: { id }, data: { status: 'SCHEDULED' } })

    const res = await client
      .post(`/api/v1/posts/${id}/publish`)
      .plainCookie('sm_session', cookie)
      .json({ socialPageId: '00000000-0000-4000-8000-000000000000' })

    res.assertStatus(422)
  })

  test('retry a failed publication resets to PUBLISHING with a new job', async ({
    client,
    assert,
  }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())
    const id = created.body().id

    await prisma.post.update({ where: { id }, data: { status: 'FAILED' } })
    await createFailedPublication(id, 'boom')
    const publication = await prisma.postPublication.findFirstOrThrow({ where: { postId: id } })
    await prisma.publishingJob.create({
      data: {
        postId: id,
        publicationId: publication.id,
        jobType: 'PUBLISH_FACEBOOK',
        status: 'FAILED',
        attempts: 1,
      },
    })

    const res = await client.post(`/api/v1/posts/${id}/retry`).plainCookie('sm_session', cookie)
    res.assertStatus(200)
    assert.equal(res.body().status, 'PUBLISHING')
    assert.equal(res.body().publications[0].status, 'PENDING')
    assert.equal(res.body().jobs[0].attempts, 2)
    assert.equal(res.body().jobs[0].status, 'PENDING')
  })

  test('retry with nothing failed returns 409', async ({ client }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())
    const id = created.body().id

    await prisma.post.update({ where: { id }, data: { status: 'FAILED' } })

    const res = await client.post(`/api/v1/posts/${id}/retry`).plainCookie('sm_session', cookie)
    res.assertStatus(409)
  })

  test('retry blocks when the attempt limit is reached', async ({ client }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())
    const id = created.body().id

    await prisma.post.update({ where: { id }, data: { status: 'FAILED' } })
    await createFailedPublication(id)
    const publication = await prisma.postPublication.findFirstOrThrow({ where: { postId: id } })
    await prisma.publishingJob.create({
      data: {
        postId: id,
        publicationId: publication.id,
        jobType: 'PUBLISH_FACEBOOK',
        status: 'FAILED',
        attempts: 5,
        maxAttempts: 5,
      },
    })

    const res = await client.post(`/api/v1/posts/${id}/retry`).plainCookie('sm_session', cookie)
    res.assertStatus(409)
  })

  test('cancel moves DRAFT to CANCELLED', async ({ client, assert }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())
    const id = created.body().id

    const res = await client.post(`/api/v1/posts/${id}/cancel`).plainCookie('sm_session', cookie)
    res.assertStatus(200)
    assert.equal(res.body().status, 'CANCELLED')
  })

  test('duplicate creates a fresh draft copy', async ({ client, assert }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload({ title: 'John 3:16' }))
    const id = created.body().id

    const res = await client.post(`/api/v1/posts/${id}/duplicate`).plainCookie('sm_session', cookie)
    res.assertStatus(201)
    assert.equal(res.body().status, 'DRAFT')
    assert.equal(res.body().title, 'John 3:16 (copy)')
    assert.notEqual(res.body().id, id)
    assert.equal(res.body().bibleVerse.book, 'John')
  })

  test('delete removes a draft', async ({ client, assert }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())
    const id = created.body().id

    const res = await client.delete(`/api/v1/posts/${id}`).plainCookie('sm_session', cookie)
    res.assertStatus(204)

    const missing = await prisma.post.findUnique({ where: { id } })
    assert.isNull(missing)
  })

  test('delete rejects a published post', async ({ client }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())
    const id = created.body().id

    await prisma.post.update({ where: { id }, data: { status: 'PUBLISHED' } })

    const res = await client.delete(`/api/v1/posts/${id}`).plainCookie('sm_session', cookie)
    res.assertStatus(409)
  })

  test('unauthenticated requests are rejected', async ({ client }) => {
    const res = await client.get('/api/v1/posts')
    res.assertStatus(401)
  })
})
