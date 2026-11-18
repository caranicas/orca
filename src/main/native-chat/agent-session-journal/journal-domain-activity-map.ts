import type Database from '../../sqlite/sync-database'
import { activityMapJournalSummary } from '../../../shared/agent-session/activity/activity-map-journal-summary'
import type { ActivityMapProviderOptions } from '../../../shared/agent-session/activity/activity-map-provider-options'
import type { JournalDomainHistoryHead } from './journal-domain-history-page'
import { readJournalDomainClientItems } from './journal-domain-item-presentation'

export function readJournalDomainActivityMap(
  db: Database.Database,
  head: JournalDomainHistoryHead,
  options: ActivityMapProviderOptions | undefined
) {
  if (!options) {
    return undefined
  }
  const ids = db
    .prepare(`SELECT item_id FROM journal_items WHERE session_id=? AND epoch=? AND hidden=0
      ORDER BY sequence,sequence_index,ordinal`)
    .all(head.sessionId, head.epoch)
    .map((row) => String(row.item_id))
  return activityMapJournalSummary(readJournalDomainClientItems(db, head, ids), options)
}
