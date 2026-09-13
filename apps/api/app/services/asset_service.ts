import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { Exception } from '@adonisjs/core/exceptions'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import { prisma } from '#db/prisma'
import { storage } from './storage/index.js'
import { writeAuditLog, AuditAction } from './audit_service.js'
import { StorageNotFoundException } from './storage/filesystem_storage.js'
import type { AuthenticatedUser } from '../types/auth.js'
import type { StorageProvider } from '../../generated/prisma/client.js'

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
}

const MAX_SIZE_BYTES = 20 * 1024 * 1024

export function serializeAsset(asset: {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
  sha256: string | null
  createdAt: Date
}) {
  return {
    id: asset.id,
    filename: asset.filename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    width: asset.width,
    height: asset.height,
    sha256: asset.sha256,
    createdAt: asset.createdAt,
  }
}

export class AssetService {
  async upload(file: MultipartFile, actor: { user: AuthenticatedUser; ip: string }) {
    if (!file.isValid) {
      throw new Exception('Invalid file upload', { status: 422, code: 'E_INVALID_FILE' })
    }

    const mimeType = file.type && file.subtype ? `${file.type}/${file.subtype}` : undefined
    const ext = mimeType ? ALLOWED_MIME_TYPES[mimeType] : undefined
    if (!ext) {
      throw new Exception('Unsupported file type', {
        status: 415,
        code: 'E_UNSUPPORTED_MEDIA_TYPE',
      })
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new Exception('File exceeds the 20MB limit', {
        status: 413,
        code: 'E_PAYLOAD_TOO_LARGE',
      })
    }

    const now = new Date()
    const yyyy = now.getUTCFullYear()
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
    const key = `uploads/original/${yyyy}/${mm}/${randomUUID()}${ext}`

    const buffer = await readFile(file.tmpPath!)

    const stored = await storage().put(key, buffer, { contentType: mimeType })

    const asset = await prisma.asset.create({
      data: {
        filename: file.clientName ?? `asset${ext}`,
        mimeType: mimeType ?? 'application/octet-stream',
        sizeBytes: stored.size,
        storageProvider: 'local' as StorageProvider,
        storageKey: stored.key,
        width: null,
        height: null,
        sha256: stored.sha256,
        createdBy: actor.user.id,
      },
    })

    await writeAuditLog({
      userId: actor.user.id,
      action: AuditAction.ASSET_UPLOADED,
      entityType: 'asset',
      entityId: asset.id,
      metadata: { filename: asset.filename, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes },
      ipAddress: actor.ip,
    })

    return serializeAsset(asset)
  }

  async list(params: { limit: number; offset: number; mimeType?: string }) {
    const [items, total] = await Promise.all([
      prisma.asset.findMany({
        where: params.mimeType ? { mimeType: params.mimeType } : undefined,
        orderBy: { createdAt: 'desc' },
        take: params.limit,
        skip: params.offset,
      }),
      prisma.asset.count({ where: params.mimeType ? { mimeType: params.mimeType } : undefined }),
    ])

    return { items: items.map(serializeAsset), total, limit: params.limit, offset: params.offset }
  }

  async detail(id: string, options?: { includeKey?: boolean }) {
    const asset = await prisma.asset.findUnique({ where: { id } })
    if (!asset) {
      throw new Exception('Asset not found', { status: 404, code: 'E_ASSET_NOT_FOUND' })
    }
    if (options?.includeKey) {
      return { ...serializeAsset(asset), storageKey: asset.storageKey }
    }
    return serializeAsset(asset)
  }

  async content(id: string) {
    const asset = await prisma.asset.findUnique({ where: { id } })
    if (!asset) {
      throw new Exception('Asset not found', { status: 404, code: 'E_ASSET_NOT_FOUND' })
    }

    let buffer: Buffer
    try {
      buffer = await storage().get(asset.storageKey)
    } catch (error) {
      if (error instanceof StorageNotFoundException) {
        throw new Exception('Asset content not found', { status: 404, code: 'E_ASSET_NOT_FOUND' })
      }
      throw error
    }

    return { buffer, asset: serializeAsset(asset) }
  }

  async delete(id: string, actor: { user: AuthenticatedUser; ip: string }) {
    const asset = await prisma.asset.findUnique({ where: { id } })
    if (!asset) {
      throw new Exception('Asset not found', { status: 404, code: 'E_ASSET_NOT_FOUND' })
    }

    const references = await prisma.postAsset.count({ where: { assetId: id } })
    if (references > 0) {
      throw new Exception(`Asset is still attached to ${references} post(s). Unlink it first.`, {
        status: 409,
        code: 'E_ASSET_IN_USE',
      })
    }

    await storage().delete(asset.storageKey)
    await prisma.asset.delete({ where: { id } })

    await writeAuditLog({
      userId: actor.user.id,
      action: AuditAction.ASSET_DELETED,
      entityType: 'asset',
      entityId: id,
      ipAddress: actor.ip,
    })
  }
}

export const assetService = new AssetService()
