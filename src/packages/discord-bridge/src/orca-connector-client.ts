import type { PendingPrompt } from '../../../shared/agent-pending-prompt'
import type { RuntimeTerminalListResult } from '../../../shared/runtime-terminal-contracts'
import { RuntimeClient } from '../../../cli/runtime-client'

export type ConnectorDelivery =
  | { outcome: 'accepted'; reopened?: true }
  | { outcome: 'refused'; reason: string }
  | { outcome: 'unknown'; reason: string }

type ConversationRef = {
  conversation: { source: string; externalId: string }
  paneKey: string
}

export type ConversationSnapshot = {
  kind: 'snapshot'
  conversations: (ConversationRef & {
    working: boolean
    lastAssistantMessage?: string
    prompt: PendingPrompt | null
    turnId: number | null
  })[]
}

export type ConversationEvent =
  | (ConversationRef & { kind: 'linked' })
  | (ConversationRef & { kind: 'prompt'; prompt: PendingPrompt })
  | (ConversationRef & { kind: 'turn-started'; at: number })
  | (ConversationRef & {
      kind: 'turn-ended'
      turnId: number | null
      stopReason: string | null
      lastAssistantMessage?: string
    })

export type AgentPane = {
  paneKey: string
  agent: string
  title: string
  branch: string
  worktreePath: string
}

const SOURCE = 'discord'
// Connector agents only; the host refuses others anyway.
const LINKABLE_AGENTS = new Set(['claude', 'codex'])

/** Discord's thread id is the connector conversation id, so no name ever routes a message. */
export class OrcaConnectorClient {
  private readonly client: RuntimeClient

  constructor(userDataPath: string | undefined) {
    // Local socket only: pairing codes and environments from the shell must not redirect the bridge.
    this.client = new RuntimeClient(userDataPath, 60_000, null, null)
  }

  async link(threadId: string, paneKey: string): Promise<ConnectorDelivery> {
    return this.result('connector.link', {
      source: SOURCE,
      externalId: threadId,
      paneKey
    })
  }

  async unlink(threadId: string): Promise<ConnectorDelivery> {
    return this.result('connector.unlink', {
      source: SOURCE,
      externalId: threadId
    })
  }

  /** The Discord message id is the delivery id, so a redelivered message never types twice. */
  async send(threadId: string, messageId: string, text: string): Promise<ConnectorDelivery> {
    return this.result('connector.send', {
      source: SOURCE,
      externalId: threadId,
      deliveryId: messageId,
      text
    })
  }

  async pendingPrompt(threadId: string): Promise<PendingPrompt | null> {
    const { prompt } = await this.result<{ prompt: PendingPrompt | null }>(
      'connector.pendingPrompt',
      { source: SOURCE, externalId: threadId }
    )
    return prompt
  }

  async answer(threadId: string, promptId: string, optionId: string): Promise<ConnectorDelivery> {
    return this.result('connector.answer', {
      source: SOURCE,
      externalId: threadId,
      promptId,
      optionId
    })
  }

  /** Holds the call open for the window; the host ends it early when connectors turn off. */
  async watch(forMs: number): Promise<{
    snapshot: ConversationSnapshot | null
    events: ConversationEvent[]
  }> {
    return this.result('connector.watch', { forMs }, forMs + 15_000)
  }

  /** Connectors have no settings toggle yet; the setting persists in Orca's profile. */
  async enableConnectors(): Promise<void> {
    await this.result('settings.update', { experimentalConnectors: true })
  }

  async agentPanes(): Promise<AgentPane[]> {
    const { terminals } = await this.result<RuntimeTerminalListResult>('terminal.list', {
      includeVisualLayouts: false
    })
    return terminals.flatMap((terminal) => {
      const agent = terminal.agentIdentity
      if (!agent || !LINKABLE_AGENTS.has(agent) || terminal.orphaned) {
        return []
      }
      return [
        {
          paneKey: `${terminal.tabId}:${terminal.leafId}`,
          agent,
          title: terminal.paneTitle ?? terminal.title ?? agent,
          branch: terminal.branch,
          worktreePath: terminal.worktreePath
        }
      ]
    })
  }

  private async result<T>(method: string, params: unknown, timeoutMs?: number): Promise<T> {
    const response = await this.client.call<T>(
      method,
      params,
      timeoutMs === undefined ? undefined : { timeoutMs }
    )
    return response.result
  }
}
