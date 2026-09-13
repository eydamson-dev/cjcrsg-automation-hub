export const RETRY_BACKOFF_MS: readonly number[] = [60_000, 300_000, 1_800_000]
export const MAX_ATTEMPTS = 5

export function backoffDelayMs(failuresSoFar: number): number {
  if (failuresSoFar < 0) return 0
  if (failuresSoFar >= RETRY_BACKOFF_MS.length) return Infinity
  return RETRY_BACKOFF_MS[failuresSoFar]
}

export function isAutoRetryable(
  job: { attempts: number; maxAttempts: number; updatedAt: Date },
  now: Date
): boolean {
  const nextAttempt = job.attempts + 1
  if (nextAttempt > job.maxAttempts) return false
  const delay = backoffDelayMs(job.attempts)
  if (!Number.isFinite(delay)) return false
  return job.updatedAt.getTime() + delay <= now.getTime()
}
