import type { StorageService } from '../storage/storage_service.js'
import type { CanvasGenerateInput, CanvasGenerateResult, CanvasProvider } from './provider_types.js'

const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

export class FakeCanvaProvider implements CanvasProvider {
  readonly name = 'mock-canva'

  constructor(
    private storage: StorageService,
    private failOnAttempt: number,
    private getAttempt: () => number
  ) {}

  async generateDesign(input: CanvasGenerateInput): Promise<CanvasGenerateResult> {
    if (this.failOnAttempt > 0 && this.getAttempt() < this.failOnAttempt) {
      throw new Error(`Mock Canva failed at attempt ${this.getAttempt()}`)
    }

    const key = `designs/${input.postId}/generated.png`
    const bytes = input.sourceBytes?.length ? input.sourceBytes : PLACEHOLDER_PNG
    const mimeType = input.sourceBytes?.length ? (input.sourceMimeType ?? 'image/png') : 'image/png'

    const stored = await this.storage.put(key, bytes, { contentType: mimeType })

    return {
      designId: `mock-canva-${input.postId}`,
      exportStorageKey: key,
      exportMimeType: mimeType,
      sizeBytes: stored.size,
      sha256: stored.sha256,
    }
  }
}
