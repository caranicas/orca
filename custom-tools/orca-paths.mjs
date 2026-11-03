import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'

export const helperDir = import.meta.dirname
export const checkout = dirname(helperDir)
const common = execFileSync('git', ['-C', checkout, 'rev-parse', '--git-common-dir'], {
  encoding: 'utf8'
}).trim()
export const repo = dirname(resolve(checkout, common))
export const tools = join(dirname(repo), '.orca-local')
export const originalProfile = join(homedir(), 'Library/Application Support/orca')
