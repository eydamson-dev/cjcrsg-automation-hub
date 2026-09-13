import encryption from '@adonisjs/core/services/encryption'

export function encryptToken(value: string): string {
  return encryption.encrypt(value)
}

export function decryptToken(value: string | null): string | null {
  if (!value) return null
  try {
    return encryption.decrypt(value)
  } catch {
    return null
  }
}

export function maskToken(value: string): string {
  if (value.length <= 8) {
    return '***'
  }
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}
