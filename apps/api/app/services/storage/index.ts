import { storageConfig } from '#config/storage'
import { FilesystemStorage } from './filesystem_storage.js'
import type { StorageService } from './storage_service.js'

let instance: StorageService | undefined

export function storage(): StorageService {
  if (!instance) {
    if (storageConfig.driver === 'local') {
      instance = new FilesystemStorage(storageConfig.root)
    } else {
      throw new Error(`Unsupported storage driver: ${storageConfig.driver}`)
    }
  }
  return instance
}
