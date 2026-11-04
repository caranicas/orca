import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'

export type BridgeConfig = {
  botToken: string
  guildId: string
  allowedUserIds: ReadonlySet<string>
  /** Orca's userData dir, where the running app publishes orca-runtime.json. */
  orcaUserDataPath: string | undefined
  /** Bridge-owned state (thread watermarks); never inside Orca's profile. */
  dataDir: string
}

const snowflake = z.string().regex(/^\d{17,20}$/, 'must be a Discord id')

const BridgeEnv = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1, 'is required'),
  DISCORD_GUILD_ID: snowflake,
  DISCORD_ALLOWED_USER_IDS: z
    .string()
    .min(1, 'must list at least one Discord user id')
    .transform((raw) =>
      raw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    )
    .pipe(z.array(snowflake).min(1)),
  ORCA_USER_DATA_PATH: z.string().min(1).optional(),
  ORCA_DISCORD_DATA_DIR: z.string().min(1).optional()
})

export function defaultDataDir(): string {
  return join(homedir(), '.orca', 'discord-bridge')
}

/** Loads `<dataDir>/bridge.env` when present; real environment variables win. */
export function loadBridgeConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  const dataDir = env.ORCA_DISCORD_DATA_DIR ?? defaultDataDir()
  const envFile = join(dataDir, 'bridge.env')
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile)
  }
  const parsed = BridgeEnv.safeParse(env)
  if (!parsed.success) {
    // Name the variable, never echo its value.
    const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`)
    throw new Error(`Discord bridge config (${envFile}): ${problems.join('; ')}`)
  }
  const config = parsed.data
  return {
    botToken: config.DISCORD_BOT_TOKEN,
    guildId: config.DISCORD_GUILD_ID,
    allowedUserIds: new Set(config.DISCORD_ALLOWED_USER_IDS),
    orcaUserDataPath: config.ORCA_USER_DATA_PATH,
    dataDir
  }
}
