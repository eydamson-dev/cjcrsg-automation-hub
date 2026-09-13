import { test } from '@japa/runner'
import { prisma } from '#db/prisma'
import { cleanDb } from '../helpers/db.js'
import { loginAsEditor } from '../helpers/auth.js'
import { signedGet, signedPost } from '../helpers/internal.js'
import { encryptToken } from '#services/token_crypto'

const PAST = () => new Date(Date.now() - 60 * 60 * 1000).toISOString()
const FUTURE = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

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

async function createTemplate(type: 'BIBLE_VERSE' | 'IMAGE' = 'BIBLE_VERSE') {
  return prisma.canvaTemplate.create({ data: { name: `${type} card`, type } })
}

async function createPage(withToken = true) {
  return prisma.socialAccount.create({
    data: {
      provider: 'FACEBOOK',
      accountName: 'Main',
      ...(withToken ? { accessTokenEncrypted: encryptToken('page-token') } : {}),
      pages: {
        create: [{ provider: 'FACEBOOK', externalPageId: 'page-1', name: 'Church' }],
      },
    },
    include: { pages: true },
  })
}

async function designThroughApi(client: any, cookie: string, postId: string, templateId: string) {
  const res = await client
    .post(`/api/v1/posts/${postId}/design`)
    .plainCookie('sm_session', cookie)
    .json({ templateId })
  res.assertStatus(200)
  return res
}

test.group('Internal API', (group) => {
  group.each.setup(async () => {
    await cleanDb()
  })

  test('rejects unsigned requests', async ({ client }) => {
    const res = await signedGet(client, '/api/v1/internal/jobs/next', { signature: 'garbage' })
    res.assertStatus(401)
  })

  test('rejects a stale timestamp', async ({ client }) => {
    const res = await signedGet(client, '/api/v1/internal/jobs/next', {
      timestamp: String(Math.floor(Date.now() / 1000) - 3600),
    })
    res.assertStatus(401)
  })

  test('claims 204 when there are no pending or due jobs', async ({ client }) => {
    const res = await signedGet(client, '/api/v1/internal/jobs/next').qs({
      jobType: 'PUBLISH_FACEBOOK',
    })
    res.assertStatus(204)
  })

  test('full flow: design job, publish job, published post, idempotent reruns', async ({
    client,
    assert,
  }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())
    const postId = created.body().id
    const template = await createTemplate()
    const account = await createPage(true)
    const page = account.pages[0]!

    await prisma.post.update({ where: { id: postId }, data: { status: 'READY' } })
    await designThroughApi(client, cookie, postId, template.id)

    const designJob = await prisma.publishingJob.findFirstOrThrow({
      where: { postId, jobType: 'GENERATE_DESIGN' },
    })

    const designRes = await signedPost(client, '/api/v1/internal/jobs/design', {
      jobId: designJob.id,
    })
    designRes.assertStatus(200)
    assert.equal(designRes.body().ok, true)
    assert.equal(designRes.body().post.status, 'DESIGN_READY')
    assert.isTrue(
      designRes.body().post.assets.some((a: { role: string }) => a.role === 'GENERATED_IMAGE')
    )

    const againRes = await signedPost(client, '/api/v1/internal/jobs/design', {
      jobId: designJob.id,
    })
    assert.equal(againRes.body().ok, true)

    const approved = await client
      .post(`/api/v1/posts/${postId}/approve`)
      .plainCookie('sm_session', cookie)
    approved.assertStatus(200)
    const scheduled = await client
      .post(`/api/v1/posts/${postId}/schedule`)
      .plainCookie('sm_session', cookie)
      .json({ scheduledAt: FUTURE() })
    scheduled.assertStatus(200)
    const published = await client
      .post(`/api/v1/posts/${postId}/publish`)
      .plainCookie('sm_session', cookie)
      .json({ socialPageId: page.id })
    published.assertStatus(200)
    assert.equal(published.body().status, 'PUBLISHING')

    const publishJob = await prisma.publishingJob.findFirstOrThrow({
      where: { postId, jobType: 'PUBLISH_FACEBOOK' },
    })

    const publishRes = await signedPost(client, '/api/v1/internal/jobs/publish', {
      jobId: publishJob.id,
    })
    publishRes.assertStatus(200)
    assert.equal(publishRes.body().ok, true)
    assert.equal(publishRes.body().post.status, 'PUBLISHED')

    const pub = await prisma.postPublication.findFirstOrThrow({ where: { postId } })
    assert.equal(pub.status, 'PUBLISHED')
    assert.equal(pub.externalPostId, `mock-fb-${postId}`)
    assert.isNotNull(pub.publishedAt)

    const postRow = await prisma.post.findUniqueOrThrow({ where: { id: postId } })
    assert.isNotNull(postRow.publishedAt)

    const idempotent = await signedPost(client, '/api/v1/internal/jobs/publish', {
      jobId: publishJob.id,
    })
    idempotent.assertStatus(200)

    const count = await prisma.postPublication.count({
      where: { externalPostId: `mock-fb-${postId}` },
    })
    assert.equal(count, 1)
  })

  test('claim marks the job RUNNING and returns payload', async ({ client, assert }) => {
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', await loginAsEditor(client, 'editor@example.com'))
      .json(versePayload())
    const postId = created.body().id
    const account = await createPage(true)
    const page = account.pages[0]!

    await prisma.post.update({ where: { id: postId }, data: { status: 'SCHEDULED' } })
    const publication = await prisma.postPublication.create({
      data: { postId, socialPageId: page.id, status: 'PENDING' },
    })
    await prisma.publishingJob.create({
      data: {
        postId,
        publicationId: publication.id,
        jobType: 'PUBLISH_FACEBOOK',
        status: 'PENDING',
      },
    })

    const res = await signedGet(client, '/api/v1/internal/jobs/next').qs({
      jobType: 'PUBLISH_FACEBOOK',
    })
    res.assertStatus(200)
    const jobId = res.body().job.id
    assert.equal(res.body().job.jobType, 'PUBLISH_FACEBOOK')
    assert.equal(res.body().job.post.status, 'SCHEDULED')
    assert.equal(res.body().job.page.externalPageId, 'page-1')

    const row = await prisma.publishingJob.findUniqueOrThrow({ where: { id: jobId } })
    assert.equal(row.status, 'RUNNING')
    assert.isNotNull(row.startedAt)
  })

  test('scheduler lists due posts and enqueue publishes them', async ({ client, assert }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const due = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload({ caption: 'due' }))
    const notDue = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload({ caption: 'later' }))
    await createPage(true)

    await prisma.post.update({
      where: { id: due.body().id },
      data: { status: 'SCHEDULED', scheduledAt: new Date(PAST()) },
    })
    await prisma.post.update({
      where: { id: notDue.body().id },
      data: { status: 'SCHEDULED', scheduledAt: new Date(FUTURE()) },
    })

    const list = await signedGet(client, '/api/v1/internal/scheduler/due')
    list.assertStatus(200)
    assert.deepEqual(
      list.body().items.map((p: { id: string }) => p.id),
      [due.body().id]
    )

    const enqueued = await signedPost(client, '/api/v1/internal/scheduler/enqueue', {
      postId: due.body().id,
    })
    enqueued.assertStatus(200)
    const row = await prisma.post.findUniqueOrThrow({ where: { id: due.body().id } })
    assert.equal(row.status, 'PUBLISHING')

    const claim = await signedGet(client, '/api/v1/internal/jobs/next').qs({
      jobType: 'PUBLISH_FACEBOOK',
    })
    claim.assertStatus(200)
    const pubRes = await signedPost(client, '/api/v1/internal/jobs/publish', {
      jobId: claim.body().job.id,
    })
    assert.equal(pubRes.body().ok, true)
    assert.equal(pubRes.body().post.status, 'PUBLISHED')
  })

  test('result marks job and publication failed, dashboard retry publishes without duplicate', async ({
    client,
    assert,
  }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())
    const postId = created.body().id
    const account = await createPage(true)
    const page = account.pages[0]!

    await prisma.post.update({ where: { id: postId }, data: { status: 'SCHEDULED' } })
    const pubRes = await client
      .post(`/api/v1/posts/${postId}/publish`)
      .plainCookie('sm_session', cookie)
      .json({ socialPageId: page.id })
    pubRes.assertStatus(200)

    const job = await prisma.publishingJob.findFirstOrThrow({
      where: { postId, jobType: 'PUBLISH_FACEBOOK' },
    })
    await signedGet(client, '/api/v1/internal/jobs/next').qs({ jobType: 'PUBLISH_FACEBOOK' })

    const failed = await signedPost(client, '/api/v1/internal/jobs/result', {
      jobId: job.id,
      code: 'E_TEST_ERROR',
      message: 'boom',
    })
    failed.assertStatus(200)
    assert.equal(failed.body().ok, true)

    const afterFail = await prisma.post.findUniqueOrThrow({ where: { id: postId } })
    assert.equal(afterFail.status, 'FAILED')
    const failedPub = await prisma.postPublication.findFirstOrThrow({ where: { postId } })
    assert.equal(failedPub.status, 'FAILED')

    const retried = await client
      .post(`/api/v1/posts/${postId}/retry`)
      .plainCookie('sm_session', cookie)
    retried.assertStatus(200)
    assert.equal(retried.body().status, 'PUBLISHING')

    const claim = await signedGet(client, '/api/v1/internal/jobs/next').qs({
      jobType: 'PUBLISH_FACEBOOK',
    })
    claim.assertStatus(200)
    const ok = await signedPost(client, '/api/v1/internal/jobs/publish', {
      jobId: claim.body().job.id,
    })
    assert.equal(ok.body().ok, true)

    const count = await prisma.postPublication.count({
      where: { externalPostId: `mock-fb-${postId}` },
    })
    assert.equal(count, 1)
    const publishedPost = await prisma.post.findUniqueOrThrow({ where: { id: postId } })
    assert.equal(publishedPost.status, 'PUBLISHED')
  })

  test('auto-retry re-enqueues a failed job once its backoff elapses', async ({
    client,
    assert,
  }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())
    const postId = created.body().id
    const account = await createPage(true)
    const page = account.pages[0]!

    await prisma.post.update({ where: { id: postId }, data: { status: 'SCHEDULED' } })
    const firstPub = await client
      .post(`/api/v1/posts/${postId}/publish`)
      .plainCookie('sm_session', cookie)
      .json({ socialPageId: page.id })
    firstPub.assertStatus(200)

    const job = await prisma.publishingJob.findFirstOrThrow({
      where: { postId, jobType: 'PUBLISH_FACEBOOK' },
    })
    await signedGet(client, '/api/v1/internal/jobs/next').qs({ jobType: 'PUBLISH_FACEBOOK' })
    await signedPost(client, '/api/v1/internal/jobs/result', {
      jobId: job.id,
      code: 'E_TEST',
      message: 'fail',
    })

    const notDue = await signedGet(client, '/api/v1/internal/jobs/next').qs({
      jobType: 'PUBLISH_FACEBOOK',
    })
    notDue.assertStatus(204)

    await prisma.publishingJob.update({
      where: { id: job.id },
      data: { updatedAt: new Date(Date.now() - 90_000) },
    })

    const claimed = await signedGet(client, '/api/v1/internal/jobs/next').qs({
      jobType: 'PUBLISH_FACEBOOK',
    })
    claimed.assertStatus(200)
    assert.equal(claimed.body().job.attempts, 1)

    const ok = await signedPost(client, '/api/v1/internal/jobs/publish', {
      jobId: claimed.body().job.id,
    })
    assert.equal(ok.body().ok, true)

    const count = await prisma.postPublication.count({
      where: { externalPostId: `mock-fb-${postId}` },
    })
    assert.equal(count, 1)
  })

  test('publish fails cleanly when the page has no access token', async ({ client, assert }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const created = await client
      .post('/api/v1/posts')
      .plainCookie('sm_session', cookie)
      .json(versePayload())
    const postId = created.body().id
    const account = await createPage(false)
    const page = account.pages[0]!

    await prisma.post.update({ where: { id: postId }, data: { status: 'SCHEDULED' } })
    const firstPub = await client
      .post(`/api/v1/posts/${postId}/publish`)
      .plainCookie('sm_session', cookie)
      .json({ socialPageId: page.id })
    firstPub.assertStatus(200)

    const job = await prisma.publishingJob.findFirstOrThrow({
      where: { postId, jobType: 'PUBLISH_FACEBOOK' },
    })
    await signedGet(client, '/api/v1/internal/jobs/next').qs({ jobType: 'PUBLISH_FACEBOOK' })

    const res = await signedPost(client, '/api/v1/internal/jobs/publish', { jobId: job.id })
    res.assertStatus(200)
    assert.equal(res.body().ok, false)
    assert.equal(res.body().error.code, 'E_MISSING_TOKEN')

    const row = await prisma.post.findUniqueOrThrow({ where: { id: postId } })
    assert.equal(row.status, 'FAILED')
  })
})
