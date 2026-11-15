import { parseClaudeStatusLineBody } from '../../shared/claude-statusline-rate-limits'
import { asRecord, extractString } from '../ai-vault/session-scanner-values'
import { claudeTokenUsage } from './claude-context-usage'
import { contextTokensFromUsage } from '../../shared/agent-session/agent-session-context-usage'
import type { StructuredAgentContextUsage } from '../../shared/agent-session/structured-agent-session-context-usage'

export type ClaudeStatuslineContext = {
  paneKey: string
  sessionId: string
  model: string
  contextUsage: StructuredAgentContextUsage | null
  observedAt: number
}

const latest = new Map<string, ClaudeStatuslineContext>()
const listeners = new Set<(report: ClaudeStatuslineContext) => void>()

export function readClaudeStatuslineContext(body: unknown): ClaudeStatuslineContext | null {
  const fields = asRecord(body)
  const paneKey = extractString(fields?.paneKey)
  if (!paneKey || typeof fields?.payload !== 'string') {
    return null
  }
  let payload: Record<string, unknown> | null
  try {
    payload = asRecord(JSON.parse(fields.payload))
  } catch {
    return null
  }
  const sessionId = extractString(payload?.session_id)
  const model = extractString(asRecord(payload?.model)?.id)
  const context = asRecord(payload?.context_window)
  if (!sessionId || !model || !context) {
    return null
  }
  const usage = claudeTokenUsage(context.current_usage)
  const window = context.context_window_size
  const percentage = context.used_percentage
  const reportedPercentage = typeof percentage === 'number' && Number.isFinite(percentage)
  const used = usage ? contextTokensFromUsage(usage) : null
  return {
    paneKey,
    sessionId,
    model,
    observedAt: Date.now(),
    contextUsage:
      used !== null && typeof window === 'number' && Number.isFinite(window) && window > 0
        ? {
            usedTokens: used,
            windowTokens: window,
            percentage: reportedPercentage ? percentage : Math.round((used / window) * 100),
            estimated: !reportedPercentage,
            categories: []
          }
        : null
  }
}

export function receiveClaudeStatuslineContext(body: unknown): void {
  const report = readClaudeStatuslineContext(body)
  if (!report) {
    return
  }
  latest.delete(report.paneKey)
  latest.set(report.paneKey, report)
  if (latest.size > 256) {
    latest.delete(latest.keys().next().value!)
  }
  for (const listener of listeners) {
    try {
      listener(report)
    } catch {
      // An observer must not interrupt status-line delivery.
    }
  }
}

export function subscribeClaudeStatuslineContext(
  paneKey: string | undefined,
  sessionId: string,
  listener: (report: ClaudeStatuslineContext) => void
): () => void {
  const scoped = (report: ClaudeStatuslineContext) => {
    if (report.sessionId === sessionId && report.paneKey === paneKey) {
      listener(report)
    }
  }
  listeners.add(scoped)
  const report = paneKey ? latest.get(paneKey) : undefined
  if (report && Date.now() - report.observedAt < 30 * 60_000) {
    scoped(report)
  }
  return () => {
    listeners.delete(scoped)
  }
}

export function receiveClaudeStatusline(body: unknown) {
  receiveClaudeStatuslineContext(body)
  return parseClaudeStatusLineBody(body)
}
