import { test } from '@japa/runner'
import {
  canonicalBody,
  signInternal,
  stableStringify,
  verifyInternalSignature,
} from '#services/hmac'

test.group('HMAC signing', () => {
  const secret = 'unit-secret'

  test('produces a stable canonical body regardless of key order', ({ assert }) => {
    const a = canonicalBody({ b: 1, a: { y: 2, x: 1 }, c: ['x', 'y'] })
    const b = canonicalBody({ c: ['x', 'y'], a: { x: 1, y: 2 }, b: 1 })
    assert.equal(a, b)
  })

  test('signs and verifies a request', ({ assert }) => {
    const signature = signInternal({
      secret,
      method: 'POST',
      pathname: '/api/v1/internal/jobs/publish',
      timestamp: '1700000000',
      requestId: 'req-1',
      body: { jobId: 'abc' },
    })
    assert.isTrue(
      verifyInternalSignature({
        secret,
        signature,
        method: 'POST',
        pathname: '/api/v1/internal/jobs/publish',
        timestamp: '1700000000',
        requestId: 'req-1',
        body: { jobId: 'abc' },
      })
    )
  })

  test('rejects a modified body', ({ assert }) => {
    const signature = signInternal({
      secret,
      method: 'POST',
      pathname: '/api/v1/internal/jobs/publish',
      timestamp: '1700000000',
      requestId: 'req-1',
      body: { jobId: 'abc' },
    })
    assert.isFalse(
      verifyInternalSignature({
        secret,
        signature,
        method: 'POST',
        pathname: '/api/v1/internal/jobs/publish',
        timestamp: '1700000000',
        requestId: 'req-1',
        body: { jobId: 'other' },
      })
    )
  })

  test('rejects when the pathname differs', ({ assert }) => {
    const signature = signInternal({
      secret,
      method: 'POST',
      pathname: '/api/v1/internal/jobs/publish',
      timestamp: '1700000000',
      requestId: 'req-1',
      body: { jobId: 'abc' },
    })
    assert.isFalse(
      verifyInternalSignature({
        secret,
        signature,
        method: 'POST',
        pathname: '/api/v1/internal/jobs/design',
        timestamp: '1700000000',
        requestId: 'req-1',
        body: { jobId: 'abc' },
      })
    )
  })

  test('an empty body canonicalizes to an empty string', ({ assert }) => {
    assert.equal(stableStringify(null), 'null')
    assert.equal(canonicalBody({}), '')
  })
})
