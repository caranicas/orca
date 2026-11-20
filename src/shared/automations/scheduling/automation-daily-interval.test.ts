import { expect, it } from 'vitest'
import {
  latestAutomationOccurrenceAtOrBefore,
  nextAutomationOccurrenceAfter
} from './automation-schedule-occurrences'
import { isValidAutomationSchedule, tryParseAutomationRrule } from './automation-schedule-parsing'

it('keeps a three-day cadence across month boundaries', () => {
  const rule = 'FREQ=DAILY;INTERVAL=3;BYHOUR=9;BYMINUTE=0'
  const start = Date.parse('2026-01-30T09:00:00')
  expect(nextAutomationOccurrenceAfter(rule, start, start)).toBe(Date.parse('2026-02-02T09:00:00'))
  expect(nextAutomationOccurrenceAfter(rule, start, Date.parse('2026-02-02T09:00:00'))).toBe(
    Date.parse('2026-02-05T09:00:00')
  )
})

it('finds the last scheduled day for missed-run catchup', () => {
  expect(
    latestAutomationOccurrenceAtOrBefore(
      'FREQ=DAILY;INTERVAL=3;BYHOUR=9;BYMINUTE=0',
      Date.parse('2026-01-30T09:00:00'),
      Date.parse('2026-02-04T12:00:00')
    )
  ).toBe(Date.parse('2026-02-02T09:00:00'))
})

it('keeps interval days on the automation clock across daylight saving time', () => {
  const rule = 'FREQ=DAILY;INTERVAL=3;BYHOUR=9;BYMINUTE=0'
  const start = Date.parse('2026-03-06T14:00:00Z')
  expect(nextAutomationOccurrenceAfter(rule, start, start, 'America/New_York')).toBe(
    Date.parse('2026-03-09T13:00:00Z')
  )
  expect(
    latestAutomationOccurrenceAtOrBefore(
      rule,
      start,
      Date.parse('2026-03-11T20:00:00Z'),
      'America/New_York'
    )
  ).toBe(Date.parse('2026-03-09T13:00:00Z'))
})

it('preserves interval recurrences as custom input when editing', () => {
  expect(tryParseAutomationRrule('FREQ=DAILY;INTERVAL=3;BYHOUR=9;BYMINUTE=0')).toBeNull()
})

it.each(['0', '-1', '1.5', '367'])('rejects invalid recurrence interval %s', (interval) => {
  expect(isValidAutomationSchedule(`FREQ=DAILY;INTERVAL=${interval};BYHOUR=9;BYMINUTE=0`)).toBe(
    false
  )
})
