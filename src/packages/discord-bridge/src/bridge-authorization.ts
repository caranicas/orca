import type { BridgeConfig } from './bridge-config'

/** Channel visibility never grants control: every action needs the configured guild and an allowlisted user. */
export function isAuthorized(
  config: Pick<BridgeConfig, 'guildId' | 'allowedUserIds'>,
  actor: { guildId: string | null; userId: string }
): boolean {
  return actor.guildId === config.guildId && config.allowedUserIds.has(actor.userId)
}
