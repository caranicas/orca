import { expect, it } from 'vitest'
import { DEFAULT_ACTIVITY_MAP_PROVIDER_OPTIONS } from '../../../shared/agent-session/activity/activity-map-provider-options'
import { messageFixture, target } from './journal-sql-message.test-fixture'
import { readJournalDomainHistoryPage } from './journal-domain-history-page'

it('includes off-page tool activity only when the reader requests the activity map', () => {
  const { db, seedItem } = messageFixture()
  try {
    seedItem({
      itemId: 'read',
      revision: 1,
      sequence: 1,
      observedAt: 1000,
      body: { kind: 'tool-call', name: 'Read', input: { file_path: '/src/app.ts' }, state: 'completed' }
    })
    seedItem({
      itemId: 'answer',
      revision: 1,
      sequence: 2,
      observedAt: 2000,
      body: { kind: 'message', role: 'assistant', blocks: [{ type: 'text', text: 'Done' }] }
    })
    const request = { sessionId: target.sessionId, direction: 'tail' as const, limit: 1 }
    const result = readJournalDomainHistoryPage(db, {
      ...request,
      activityMapOptions: DEFAULT_ACTIVITY_MAP_PROVIDER_OPTIONS
    })
    expect(result.page.items.map((item) => item.itemId)).toEqual(['answer'])
    expect(result.page.activityMap?.statistics.counts).toEqual({ files: 1 })
    expect(result.page.activityMap?.events).toMatchObject([
      { station: 'files', state: 'completed', label: 'src/app.ts' }
    ])
    expect(readJournalDomainHistoryPage(db, request).page.activityMap).toBeUndefined()
  } finally {
    db.close()
  }
})
