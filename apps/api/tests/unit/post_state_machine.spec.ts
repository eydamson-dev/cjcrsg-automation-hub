import { test } from '@japa/runner'
import {
  POST_STATUS_TRANSITIONS,
  allowedTransitions,
  assertTransition,
  canTransition,
  InvalidTransitionException,
} from '#domain/post_state_machine'

test.group('Post state machine', () => {
  const valid: Array<[string, string]> = [
    ['DRAFT', 'READY'],
    ['DRAFT', 'CANCELLED'],
    ['DRAFT', 'ARCHIVED'],
    ['READY', 'PROCESSING'],
    ['READY', 'CANCELLED'],
    ['READY', 'ARCHIVED'],
    ['PROCESSING', 'DESIGN_READY'],
    ['DESIGN_READY', 'APPROVED'],
    ['APPROVED', 'SCHEDULED'],
    ['SCHEDULED', 'PUBLISHING'],
    ['SCHEDULED', 'CANCELLED'],
    ['PUBLISHING', 'PUBLISHED'],
    ['PUBLISHING', 'FAILED'],
    ['FAILED', 'PUBLISHING'],
    ['FAILED', 'CANCELLED'],
  ]

  test('accepts every documented transition', ({ assert }) => {
    for (const [from, to] of valid) {
      assert.isTrue(canTransition(from as any, to as any), `${from} -> ${to}`)
      assert.doesNotThrow(
        () => assertTransition(from as any, to as any),
        `${from} -> ${to} should not throw`
      )
    }
  })

  test('rejects invalid transitions', ({ assert }) => {
    const invalid: Array<[string, string]> = [
      ['DRAFT', 'APPROVED'],
      ['DRAFT', 'PUBLISHED'],
      ['READY', 'DESIGN_READY'],
      ['PROCESSING', 'APPROVED'],
      ['DESIGN_READY', 'PUBLISHING'],
      ['APPROVED', 'FAILED'],
      ['SCHEDULED', 'DESIGN_READY'],
      ['PUBLISHING', 'SCHEDULED'],
      ['FAILED', 'APPROVED'],
      ['PUBLISHED', 'FAILED'],
      ['CANCELLED', 'DRAFT'],
      ['ARCHIVED', 'READY'],
    ]

    for (const [from, to] of invalid) {
      assert.isFalse(canTransition(from as any, to as any), `${from} -> ${to}`)
      try {
        assertTransition(from as any, to as any)
        assert.fail(`${from} -> ${to} should throw`)
      } catch (error) {
        assert.instanceOf(error, InvalidTransitionException, `${from} -> ${to} should throw`)
      }
    }
  })

  test('exposes terminal statuses with no outgoing transitions', ({ assert }) => {
    for (const status of ['PUBLISHED', 'CANCELLED', 'ARCHIVED']) {
      assert.deepEqual(allowedTransitions(status as any), [])
    }
  })

  test('defines a transition table for every status', ({ assert }) => {
    const statuses = Object.keys(POST_STATUS_TRANSITIONS)
    assert.deepEqual(statuses.sort(), [
      'APPROVED',
      'ARCHIVED',
      'CANCELLED',
      'DESIGN_READY',
      'DRAFT',
      'FAILED',
      'PROCESSING',
      'PUBLISHED',
      'PUBLISHING',
      'READY',
      'SCHEDULED',
    ])
  })
})
