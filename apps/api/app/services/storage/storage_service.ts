export interface StoredObject {
  key: string
  size: number
  sha256: string
}

export interface StoragePutOptions {
  contentType?: string
}

export interface StorageService {
  put(key: string, data: Buffer, options?: StoragePutOptions): Promise<StoredObject>
  get(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  resolvePath(key: string): string
}
