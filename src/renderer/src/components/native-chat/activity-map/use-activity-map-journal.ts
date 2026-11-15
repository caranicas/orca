import { useEffect, useMemo, useState } from 'react'
import type { RuntimeClientTarget } from '../../../../../shared/runtime-client-target'
import type { AgentSessionHistoryResult } from '../../../../../shared/agent-session/agent-session-wire'
import type { AgentJournalRenderItem } from '../../../../../shared/agent-session/journal/agent-session-journal-types'
import type { ActivityMapJournalSummary } from '../../../../../shared/agent-session/activity/activity-map-journal-summary'
import { callStructuredAgentSession } from '@/runtime/native-chat/requests/structured-agent-session-call'
import { useActivityMapProviderOptions } from './use-activity-map-preferences'
import { activityMapProviderClassification } from '../../../../../shared/agent-session/activity/activity-map-provider-options'
import { projectAgentActivityMap } from '../../../../../shared/agent-session/activity/agent-activity-map'

export function useActivityMapJournal({
  target,
  sessionId,
  epoch,
  items,
  enabled
}: {
  target: RuntimeClientTarget
  sessionId: string
  epoch: string | null
  items: readonly AgentJournalRenderItem[]
  enabled: boolean
}) {
  const options = useActivityMapProviderOptions()
  const revision = useMemo(
    () =>
      JSON.stringify(projectAgentActivityMap(items, activityMapProviderClassification(options))),
    [items, options]
  )
  const source = JSON.stringify([target, sessionId, epoch, options])
  const [report, setReport] = useState<{ source: string; value: ActivityMapJournalSummary }>()
  const environmentId = target.kind === 'environment' ? target.environmentId : null
  useEffect(() => {
    if (!enabled) {
      return
    }
    let disposed = false
    const owner: RuntimeClientTarget =
      environmentId === null ? { kind: 'local' } : { kind: 'environment', environmentId }
    void callStructuredAgentSession<AgentSessionHistoryResult>(owner, 'agentSession.history', {
      sessionId,
      direction: 'tail',
      limit: 1,
      activityMapOptions: options
    }).then(
      (result) => {
        if (!disposed && result.page.epoch === epoch && result.page.activityMap) {
          setReport({ source, value: result.page.activityMap })
        }
      },
      () => {}
    )
    return () => {
      disposed = true
    }
  }, [environmentId, sessionId, epoch, options, source, enabled, revision])
  return report?.source === source ? report.value : undefined
}
