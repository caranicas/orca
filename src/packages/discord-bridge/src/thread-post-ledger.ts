import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

const ThreadPosts = z.object({
  /** The turn whose reply was last posted; a snapshot with a newer finished turn posts again. */
  postedTurnId: z.number().nullable(),
  /** The prompt whose card was last posted, so a re-sent snapshot doesn't repeat it. */
  postedPromptId: z.string().nullable()
})
type ThreadPosts = z.infer<typeof ThreadPosts>

const LedgerFile = z.record(z.string(), ThreadPosts)

const EMPTY: ThreadPosts = { postedTurnId: null, postedPromptId: null }

/** What the bridge already posted per thread; Orca owns the links themselves. */
export class ThreadPostLedger {
  private readonly path: string
  private readonly threads: Map<string, ThreadPosts>

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 })
    this.path = join(dataDir, 'thread-posts.json')
    this.threads = new Map(Object.entries(readLedger(this.path)))
  }

  get(threadId: string): ThreadPosts {
    return this.threads.get(threadId) ?? EMPTY
  }

  /** True when this turn's reply is new to the thread. */
  shouldPostTurn(threadId: string, turnId: number | null): boolean {
    const posted = this.get(threadId).postedTurnId
    return turnId === null || posted === null || turnId > posted
  }

  record(threadId: string, update: Partial<ThreadPosts>): void {
    this.threads.set(threadId, { ...this.get(threadId), ...update })
    this.flush()
  }

  forget(threadId: string): void {
    if (this.threads.delete(threadId)) {
      this.flush()
    }
  }

  private flush(): void {
    const temp = `${this.path}.tmp`
    writeFileSync(temp, JSON.stringify(Object.fromEntries(this.threads), null, 2), { mode: 0o600 })
    renameSync(temp, this.path)
  }
}

function readLedger(path: string): Record<string, ThreadPosts> {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return {}
  }
  // A damaged ledger only risks a repeated post, so start over rather than refuse to run.
  const parsed = LedgerFile.safeParse(safeJson(raw))
  return parsed.success ? parsed.data : {}
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
