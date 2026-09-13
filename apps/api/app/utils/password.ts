import { hash, verify } from '@node-rs/argon2'

const ARGON2_ID = 2

const options = {
  algorithm: ARGON2_ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, options)
}

export function verifyPassword(hashed: string, password: string): Promise<boolean> {
  return verify(hashed, password, options)
}
