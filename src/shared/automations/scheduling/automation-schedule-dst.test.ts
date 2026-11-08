import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  latestAutomationOccurrenceAtOrBefore,
  nextAutomationOccurrenceAfter
} from './automation-schedule-occurrences'

afterEach(() => vi.unstubAllEnvs())

// Why: on Windows, unsetting a stubbed TZ doesn't restore the OS zone, so it would leak into later tests.
describe.skipIf(process.platform === 'win32')('automation calendar days across DST', () => {
  it('keeps the local hour when a three-day interval crosses spring-forward', () => {
    vi.stubEnv('TZ', 'America/New_York')
    const start = Date.parse('2026-03-07T09:00:00-05:00')
    expect(
      nextAutomationOccurrenceAfter('FREQ=DAILY;INTERVAL=3;BYHOUR=9;BYMINUTE=0', start, start)
    ).toBe(Date.parse('2026-03-10T09:00:00-04:00'))
  })
  it.each([
    {
      timezone: 'America/New_York',
      now: '2026-03-09T00:30:00-04:00',
      expected: '2026-03-08T23:30:00-04:00'
    },
    {
      timezone: 'Australia/Lord_Howe',
      now: '2026-10-05T00:15:00+11:00',
      expected: '2026-10-04T23:30:00+11:00'
    }
  ])(
    'finds the previous calendar day after spring-forward in $timezone',
    ({ timezone, now, expected }) => {
      vi.stubEnv('TZ', timezone)
      // Precondition: the stub took and the offset changed in the preceding two days.
      expect(new Date(now).getTimezoneOffset()).not.toBe(
        new Date(Date.parse(now) - 2 * 24 * 60 * 60 * 1000).getTimezoneOffset()
      )
      for (const rrule of [
        'FREQ=DAILY;BYHOUR=23;BYMINUTE=30',
        'FREQ=WEEKLY;BYDAY=SU;BYHOUR=23;BYMINUTE=30'
      ]) {
        expect(
          latestAutomationOccurrenceAtOrBefore(
            rrule,
            Date.parse('2026-01-01T00:00:00Z'),
            Date.parse(now)
          )
        ).toBe(Date.parse(expected))
      }
    }
  )
})
