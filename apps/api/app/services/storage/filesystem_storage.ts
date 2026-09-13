import { createHash } from 'node:crypto'
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { createError } from '@adonisjs/core/exceptions'
import type { StoredObject, StoragePutOptions, StorageService } from './storage_service.js'

export const StorageNotFoundException = createError(
  'Storage object not found',
  'E_STORAGE_NOT_FOUND',
  404
)

export class FilesystemStorage implements StorageService {
  constructor(
    private root: string,
    private publicBaseUrl?: string
  ) {}

  private assertSafeKey(key: string) {
    if (!key || key.startsWith('/') || key.includes('\0')) {
      throw new Error(`Invalid storage key: ${key}`)
    }
    if (isAbsolute(key)) {
      throw new Error(`Storage key must be relative: ${key}`)
    }
    const parts = key.split(sep)
    if (parts.includes('..')) {
      throw new Error(`Storage key must not traverse directories: ${key}`)
    }
  }

  private absolutePath(key: string) {
    this.assertSafeKey(key)
    return resolve(join(this.root, key))
  }

  async put(key: string, data: Buffer, _options?: StoragePutOptions): Promise<StoredObject> {
    const target = this.absolutePath(key)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, data)

    return {
      key,
      size: data.length,
      sha256: createHash('sha256').update(data).digest('hex'),
    }
  }

  async get(key: string): Promise<Buffer> {
    const target = this.absolutePath(key)
    try {
      return await readFile(target)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new StorageNotFoundException(`Storage object not found: ${key}`)
      }
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    const target = this.absolutePath(key)
    try {
      await rm(target, { force: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return
      }
      throw error
    }
  }

  async exists(key: string): Promise<boolean> {
    const target = this.absolutePath(key)
    try {
      await access(target)
      return true
    } catch {
      return false
    }
  }

  resolvePath(key: string): string {
    return this.absolutePath(key)
  }

  publicUrl(key: string): string | undefined {
    if (!this.publicBaseUrl) {
      return undefined
    }
    return `${this.publicBaseUrl}/${key}`
  }
}
