import { loadBridgeConfig } from './bridge-config'
import { ConversationEventRelay } from './conversation-event-relay'
import { DiscordBridgeBot } from './discord-bridge-bot'
import { OrcaConnectorClient } from './orca-connector-client'
import { ThreadPostLedger } from './thread-post-ledger'

// One JSON line per event; tokens and message text are never logged.
function log(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...fields }))
}

async function main(): Promise<void> {
  const config = loadBridgeConfig()
  const orca = new OrcaConnectorClient(config.orcaUserDataPath)
  if (process.argv.includes('--enable-connectors')) {
    await orca.enableConnectors()
    log('orca_connectors_enabled')
    return
  }
  const ledger = new ThreadPostLedger(config.dataDir)
  const bot = new DiscordBridgeBot(config, orca, ledger, log)
  const relay = new ConversationEventRelay(orca, bot, ledger, log)

  const shutdown = (): void => {
    log('bridge_stopping')
    relay.stop()
    void bot.stop().finally(() => process.exit(0))
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)

  await bot.start()
  await relay.run()
}

main().catch((error: unknown) => {
  log('bridge_failed', {
    error: error instanceof Error ? error.message : String(error)
  })
  process.exit(1)
})
