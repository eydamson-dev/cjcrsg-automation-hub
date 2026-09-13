import { Exception } from '@adonisjs/core/exceptions'

export function parseDate(value: string | undefined, field: string): Date {
  if (value === undefined) {
    throw new Exception(`Missing ${field}`, { status: 422, code: 'E_VALIDATION_ERROR' })
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Exception(`Invalid ${field}`, { status: 422, code: 'E_VALIDATION_ERROR' })
  }
  return date
}

export function optionalDate(value: string | undefined): Date | undefined {
  if (value === undefined) return undefined
  return parseDate(value, 'scheduledAt')
}
