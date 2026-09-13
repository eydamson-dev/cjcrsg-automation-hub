export interface TemplateSource {
  id: string
  type: string
  canvaTemplateId: string | null
}

export interface CanvasGenerateInput {
  postId: string
  template: TemplateSource
  sourceBytes?: Buffer
  sourceMimeType?: string
}

export interface CanvasGenerateResult {
  designId: string
  exportStorageKey: string
  exportMimeType: string
  sizeBytes: number
  sha256: string
}

export interface CanvasProvider {
  readonly name: string
  generateDesign(input: CanvasGenerateInput): Promise<CanvasGenerateResult>
}

export interface FacebookPublishInput {
  postId: string
  caption?: string | null
  mediaStorageKey?: string
  accessToken: string
  pageExternalId: string
}

export interface FacebookPublishResult {
  externalPostId: string
  externalUrl: string
}

export interface FacebookProvider {
  readonly name: string
  publish(input: FacebookPublishInput): Promise<FacebookPublishResult>
}
