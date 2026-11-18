import type { HookListenerState } from '../../../listener-state'
import { setClaudeMainAgentTurnState } from './claude-main-agent-turn-state'
/** SessionStart sources that begin a new Claude session in the pane; Claude 2.1.214+ reports a
 *  `--fork-session` start as `fork` where it used to say `resume`. Compaction and children are absent. */
export const CLAUDE_NEW_SESSION_START_SOURCES: ReadonlySet<unknown> = new Set([
  'startup',
  'resume',
  'fork',
  'clear'
])

export function resetClaudeSessionStart(
  state: HookListenerState,
  paneKey: string,
  model: string | undefined
): void {
  state.claudeSubagentRosterByPaneKey.delete(paneKey)
  state.claudeRunningNonAgentTaskPaneKeys.delete(paneKey)
  state.claudeActiveSessionCronPaneKeys.delete(paneKey)
  state.claudeLaunchedBackgroundTasksByPaneKey.delete(paneKey)
  setClaudeMainAgentTurnState(state, paneKey, { state: 'done', stateStartedAt: Date.now(), model })
}
