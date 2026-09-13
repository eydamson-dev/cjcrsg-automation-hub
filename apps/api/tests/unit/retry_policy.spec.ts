import { test } from '@japa/runner'
import { backoffDelayMs, isAutoRetryable, MAX_ATTEMPTS } from '#domain/retry_policy'

test.group('Retry policy', () => {
  test('backoff scales by the number of failures', ({ assert }) => {
    assert.equal(backoffDelayMs(0), 60_000)
    assert.equal(backoffDelayMs(1), 300_000)
    assert.equal(backoffDelayMs(2), 1_800_000)
    assert.equal(backoffDelayMs(3), Infinity)
    assert.equal(backoffDelayMs(99), Infinity)
  })

  test('auto-retry requires the backoff window to have elapsed', ({ assert }) => {
    const now = new Date('2026-09-13T00:00:00Z')
    const failedAt = new Date(now.getTime() - 60_000)

    assert.isFalse(isAutoRetryable({ attempts: 0, maxAttempts: MAX_ATTEMPTS, updatedAt: now }, now))
    assert.isTrue(
      isAutoRetryable({ attempts: 0, maxAttempts: MAX_ATTEMPTS, updatedAt: failedAt }, now)
    )
  })

  test('never auto-retries after the attempt limit', ({ assert }) => {
    const now = new Date('2026-09-13T00:00:00Z')
    const old = new Date(now.getTime() - 60_000)
    assert.isFalse(
      isAutoRetryable({ attempts: MAX_ATTEMPTS, maxAttempts: MAX_ATTEMPTS, updatedAt: old }, now)
    )
  })

  test('stops auto-retrying once the delay becomes manual', ({ assert }) => {
    const now = new Date('2026-09-13T00:00:00Z')
    const veryOld = new Date(now.getTime() - 1000 * 60 * 60 * 24)
    for (const attempts of [3, 4, 5]) {
      assert.isFalse(
        isAutoRetryable({ attempts, maxAttempts: MAX_ATTEMPTS, updatedAt: veryOld }, now),
        `attempts=${attempts} should be manual`
      )
    }
  })
})
