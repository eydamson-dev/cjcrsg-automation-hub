import type {
  FacebookProvider,
  FacebookPublishInput,
  FacebookPublishResult,
} from './provider_types.js'

export class FakeFacebookProvider implements FacebookProvider {
  readonly name = 'mock-facebook'

  constructor(
    private failOnAttempt: number,
    private getAttempt: () => number
  ) {}

  async publish(input: FacebookPublishInput): Promise<FacebookPublishResult> {
    if (this.failOnAttempt > 0 && this.getAttempt() < this.failOnAttempt) {
      throw new Error(`Mock Facebook failed at attempt ${this.getAttempt()}`)
    }

    const externalPostId = `mock-fb-${input.postId}`
    return {
      externalPostId,
      externalUrl: `https://example.com/facebook/mock/${externalPostId}`,
    }
  }
}
