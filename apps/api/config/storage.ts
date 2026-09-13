import env from '#start/env'

export const storageConfig = {
  driver: env.get('STORAGE_DRIVER', 'local'),
  root: env.get('STORAGE_ROOT', '/data/social-manager'),
}
