import env from '#start/env'
import { storage } from '../storage/index.js'
import type { CanvasProvider, FacebookProvider } from './provider_types.js'
import { FakeCanvaProvider } from './fake_canva_provider.js'
import { FakeFacebookProvider } from './fake_facebook_provider.js'

function attemptNumber(job: { attempts: number }): number {
  return job.attempts + 1
}

export function canvasProviderFor(job: { attempts: number }): CanvasProvider {
  return new FakeCanvaProvider(storage(), env.get('MOCK_DESIGN_FAIL_ON_ATTEMPT', 0), () =>
    attemptNumber(job)
  )
}

export function facebookProviderFor(job: { attempts: number }): FacebookProvider {
  return new FakeFacebookProvider(env.get('MOCK_FACEBOOK_FAIL_ON_ATTEMPT', 0), () =>
    attemptNumber(job)
  )
}
