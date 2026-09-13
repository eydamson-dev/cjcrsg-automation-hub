import type { ApiClient } from '@japa/api-client'
import { prisma } from '#db/prisma'
import { hashPassword } from '#utils/password'

export const EDITOR_PASSWORD = 'password-123'
export const ADMIN_PASSWORD = 'password-123'

export async function createUser(
  email: string,
  role: 'ADMIN' | 'EDITOR' = 'EDITOR',
  password: string = EDITOR_PASSWORD
) {
  return prisma.user.create({
    data: {
      name: email.split('@')[0]!,
      email,
      passwordHash: await hashPassword(password),
      role,
    },
  })
}

export async function login(client: ApiClient, email: string, password: string = EDITOR_PASSWORD) {
  const res = await client.post('/api/v1/auth/login').json({ email, password })
  res.assertStatus(200)
  const cookie = res.cookie('sm_session')
  if (!cookie) {
    throw new Error('login response did not set a session cookie')
  }
  return cookie.value
}

export async function loginAsEditor(client: ApiClient, email: string) {
  await createUser(email, 'EDITOR')
  return login(client, email)
}

export async function loginAsAdmin(client: ApiClient, email: string) {
  await createUser(email, 'ADMIN', ADMIN_PASSWORD)
  return login(client, email, ADMIN_PASSWORD)
}
