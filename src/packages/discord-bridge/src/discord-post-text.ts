import type { MessageCreateOptions } from 'discord.js'
import type { PendingPrompt } from '../../../shared/agent-pending-prompt'
import { RuntimeClientError } from '../../../cli/runtime-client'
import type { ConnectorDelivery } from './orca-connector-client'

/** Discord rejects messages over 2000 characters. */
const MAX_MESSAGE_CHARS = 2000
const MAX_BUTTON_LABEL_CHARS = 80

// Agent text must never ping anyone.
export const NO_MENTIONS = { parse: [] } satisfies MessageCreateOptions['allowedMentions']

/** Split on line breaks where possible so code blocks and paragraphs stay readable. */
export function chunkMessage(text: string, limit = MAX_MESSAGE_CHARS): string[] {
  const chunks: string[] = []
  let rest = text.trim()
  while (rest.length > limit) {
    const newline = rest.lastIndexOf('\n', limit)
    const cut = newline > limit / 2 ? newline : limit
    chunks.push(rest.slice(0, cut))
    rest = rest.slice(cut).replace(/^\n/, '')
  }
  if (rest.length > 0) {
    chunks.push(rest)
  }
  return chunks
}

export function buttonLabel(label: string): string {
  return label.length > MAX_BUTTON_LABEL_CHARS
    ? `${label.slice(0, MAX_BUTTON_LABEL_CHARS - 1)}…`
    : label
}

const REFUSALS = new Map<string, string>([
  ['connectors_disabled', 'Connectors are off in Orca. Run the bridge with --enable-connectors.'],
  ['agent_not_reachable', 'Couldn’t reach the agent in Orca.'],
  ['unsupported_agent', 'Only Claude Code and Codex terminal agents can be driven from Discord.'],
  ['delivery_backlog_full', 'Orca is busy. Send again in a moment.'],
  ['agent_asleep_in_window', 'The agent is asleep. Wake it in Orca, then send again.'],
  ['no_session_to_reopen', 'The earlier session in Orca is gone.'],
  ['reopen_refused', 'Orca couldn’t reopen the earlier session.'],
  ['prompt_not_pending', 'Already answered or moved on.'],
  ['prompt_unsupported', 'Answer this one in Orca.'],
  ['option_not_offered', 'That option isn’t offered any more. Answer in Orca.'],
  ['conversation_cancelled', 'Stopped before it reached the agent.'],
  ['conversation_linked_elsewhere', 'This thread already drives another Orca session.'],
  ['pane_already_linked', 'That session is already linked to another thread.']
])

export function refusalText(reason: string): string {
  return REFUSALS.get(reason) ?? `Orca couldn’t take this (${reason}).`
}

export function deliveryText(delivery: ConnectorDelivery): string {
  if (delivery.outcome === 'refused') {
    return refusalText(delivery.reason)
  }
  return delivery.outcome === 'unknown'
    ? 'This may not have reached the agent. Check Orca.'
    : 'Sent.'
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function isNotLinked(error: unknown): boolean {
  return describeError(error).includes('external_conversation_not_found')
}

export function orcaErrorText(error: unknown): string {
  if (error instanceof RuntimeClientError && error.code === 'runtime_unavailable') {
    return 'Orca isn’t running on this machine.'
  }
  const message = describeError(error)
  return message.includes('connectors_disabled')
    ? refusalText('connectors_disabled')
    : `Orca couldn’t do that: ${message}`
}

export function promptCardText(prompt: PendingPrompt): string {
  switch (prompt.kind) {
    case 'approval':
      return [`**${prompt.tool}** wants approval`, prompt.summary].filter(Boolean).join('\n')
    case 'question':
      return [prompt.header && `**${prompt.header}**`, prompt.question].filter(Boolean).join('\n')
    case 'unsupported':
      return 'The agent is waiting for an answer that only Orca can give. Open Orca to respond.'
  }
}

export function turnEndedText(stopReason: string | null, reply: string | undefined): string {
  switch (stopReason) {
    case 'failure':
      return reply ? `⚠️ The turn failed.\n${reply}` : '⚠️ The turn failed. Check Orca for details.'
    case 'interruption':
      return '⚠️ The agent stopped unexpectedly. Check Orca.'
    case 'cancellation':
      return '⏹️ The turn was stopped.'
    default:
      return reply ?? '✅ Done.'
  }
}
