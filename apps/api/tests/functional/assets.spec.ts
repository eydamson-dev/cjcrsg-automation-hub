import { test } from '@japa/runner'
import { createReadStream, type ReadStream } from 'node:fs'
import { mkdir, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { prisma } from '#db/prisma'
import { storageConfig } from '#config/storage'
import { cleanDb } from '../helpers/db.js'
import { loginAsEditor } from '../helpers/auth.js'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64'
)

const uploadDir = 'tmp/test-uploads'
const pngPath = join(uploadDir, 'photo.png')
const textPath = join(uploadDir, 'notes.txt')

async function ensureUploads() {
  await mkdir(uploadDir, { recursive: true })
  await writeFile(pngPath, PNG)
  await writeFile(textPath, Buffer.from('hello'))
}

function pngStream(): ReadStream {
  return createReadStream(pngPath)
}

function textStream(): ReadStream {
  return createReadStream(textPath)
}

test.group('Assets', (group) => {
  group.each.setup(async () => {
    await ensureUploads()
    await cleanDb()
  })

  test('uploads a file and stores its blob', async ({ client, assert }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')

    const res = await client
      .post('/api/v1/assets')
      .plainCookie('sm_session', cookie)
      .file('file', pngStream(), { filename: 'photo.png' })

    res.assertStatus(201)
    assert.equal(res.body().mimeType, 'image/png')
    assert.equal(res.body().filename, 'photo.png')
    assert.equal(res.body().sizeBytes, PNG.length)
    assert.isNotNull(res.body().sha256)
    assert.isUndefined(res.body().storageKey)

    const row = await prisma.asset.findUniqueOrThrow({ where: { id: res.body().id } })
    await access(join(storageConfig.root, row.storageKey))
  })

  test('streams stored content back with the right descriptors', async ({ client, assert }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')

    const upload = await client
      .post('/api/v1/assets')
      .plainCookie('sm_session', cookie)
      .file('file', pngStream(), { filename: 'photo.png' })

    const res = await client
      .get(`/api/v1/assets/${upload.body().id}/content`)
      .plainCookie('sm_session', cookie)
    res.assertStatus(200)
    assert.equal(res.headers()['content-type'], 'image/png')
    assert.equal(res.headers()['content-length'], String(PNG.length))
  })

  test('lists assets with total', async ({ client, assert }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')

    await client
      .post('/api/v1/assets')
      .plainCookie('sm_session', cookie)
      .file('file', pngStream(), { filename: 'a.png' })
    await client
      .post('/api/v1/assets')
      .plainCookie('sm_session', cookie)
      .file('file', pngStream(), { filename: 'b.png' })

    const res = await client.get('/api/v1/assets').plainCookie('sm_session', cookie)
    res.assertStatus(200)
    assert.equal(res.body().total, 2)
    assert.lengthOf(res.body().items, 2)
  })

  test('rejects an unsupported file type', async ({ client }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')

    const res = await client
      .post('/api/v1/assets')
      .plainCookie('sm_session', cookie)
      .file('file', textStream(), { filename: 'notes.txt' })

    res.assertStatus(415)
  })

  test('blocks deleting an asset that is in use', async ({ client }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const upload = await client
      .post('/api/v1/assets')
      .plainCookie('sm_session', cookie)
      .file('file', pngStream(), { filename: 'photo.png' })
    const assetId = upload.body().id

    await prisma.post.create({
      data: {
        type: 'IMAGE',
        status: 'DRAFT',
        postAssets: { create: { assetId, role: 'SOURCE_IMAGE', sortOrder: 0 } },
      },
    })

    const res = await client.delete(`/api/v1/assets/${assetId}`).plainCookie('sm_session', cookie)
    res.assertStatus(409)
  })

  test('deletes an unreferenced asset', async ({ client, assert }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')
    const upload = await client
      .post('/api/v1/assets')
      .plainCookie('sm_session', cookie)
      .file('file', pngStream(), { filename: 'photo.png' })

    const res = await client
      .delete(`/api/v1/assets/${upload.body().id}`)
      .plainCookie('sm_session', cookie)
    res.assertStatus(204)

    const missing = await prisma.asset.findUnique({ where: { id: upload.body().id } })
    assert.isNull(missing)
  })
})
