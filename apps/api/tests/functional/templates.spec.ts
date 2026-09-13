import { test } from '@japa/runner'
import { prisma } from '#db/prisma'
import { cleanDb } from '../helpers/db.js'
import { loginAsAdmin, loginAsEditor } from '../helpers/auth.js'

test.group('Templates', (group) => {
  group.each.setup(async () => {
    await cleanDb()
  })

  test('EDITOR cannot create templates', async ({ client }) => {
    const cookie = await loginAsEditor(client, 'editor@example.com')

    const res = await client
      .post('/api/v1/canva/templates')
      .plainCookie('sm_session', cookie)
      .json({ name: 'Verse', type: 'BIBLE_VERSE' })

    res.assertStatus(403)
  })

  test('ADMIN creates, lists, updates, and deletes a template', async ({ client, assert }) => {
    const cookie = await loginAsAdmin(client, 'admin@example.com')

    const created = await client
      .post('/api/v1/canva/templates')
      .plainCookie('sm_session', cookie)
      .json({ name: 'Verse card', type: 'BIBLE_VERSE', canvaTemplateId: 'tpl-1' })

    created.assertStatus(201)
    assert.equal(created.body().name, 'Verse card')
    assert.equal(created.body().type, 'BIBLE_VERSE')
    assert.equal(created.body().active, true)

    const list = await client.get('/api/v1/canva/templates').plainCookie('sm_session', cookie)
    list.assertStatus(200)
    assert.lengthOf(list.body().items, 1)

    const filtered = await client
      .get('/api/v1/canva/templates')
      .qs({ type: 'IMAGE' })
      .plainCookie('sm_session', cookie)
    assert.lengthOf(filtered.body().items, 0)

    const updated = await client
      .patch(`/api/v1/canva/templates/${created.body().id}`)
      .plainCookie('sm_session', cookie)
      .json({ name: 'Renamed', active: false })
    updated.assertStatus(200)
    assert.equal(updated.body().name, 'Renamed')
    assert.equal(updated.body().active, false)

    const deleted = await client
      .delete(`/api/v1/canva/templates/${created.body().id}`)
      .plainCookie('sm_session', cookie)
    deleted.assertStatus(204)
  })

  test('blocks deleting a template that is in use', async ({ client }) => {
    const cookie = await loginAsAdmin(client, 'admin@example.com')

    const template = await prisma.canvaTemplate.create({
      data: { name: 'Verse card', type: 'BIBLE_VERSE' },
    })
    await prisma.post.create({
      data: { type: 'BIBLE_VERSE', status: 'DRAFT', templateId: template.id },
    })

    const res = await client
      .delete(`/api/v1/canva/templates/${template.id}`)
      .plainCookie('sm_session', cookie)
    res.assertStatus(409)
  })
})
