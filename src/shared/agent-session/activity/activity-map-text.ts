// Adapted from lot-map 09f6b93; MIT, see lot-map-LICENSE.txt.
import type { ActivityMapStation } from './agent-activity-map'
import { en } from './locales/en'
import { ru } from './locales/ru'
import { es } from './locales/es'
import { fr } from './locales/fr'
import { de } from './locales/de'
import { it } from './locales/it'
import { pt } from './locales/pt'
export type Strings = {
  title: string
  command: string
  opened: string
  cannotOpen: (reason: string) => string
  /** The pane's buttons in an editor, where the pane cannot be made taller. */
  zoomOut: string
  zoomIn: string
  hideMap: string
  showMap: string
  stations: Record<ActivityMapStation, string>
  newMessage: string
  answerReady: string
  turnAborted: string
  step: (n: number) => string
  subagent: string
  compacting: string
  addedContext: (when: string) => string
  addedMemory: (when: string) => string
  toMessage: string
  atStart: string
  records: (n: number, shown: string) => string
  stopped: (tool: string) => string
  askedPermission: (tool: string) => string
  checkBefore: (tool: string) => string
  running: string
  nothingYet: string
  noCounts: string
  idle: string
  context: string
  andMore: (n: number) => string
  webSearch: string
  artifact: string
  workflow: string
  skill: string
  loadingTools: string
  questionForYou: string
  fileForYou: string
  ms: (n: number) => string
  seconds: (s: string) => string
  minutes: (m: number, s: number) => string
}

const TABLES = new Map<string, Strings>([
  ['en', en],
  ['ru', ru],
  ['es', es],
  ['fr', fr],
  ['de', de],
  ['it', it],
  ['pt', pt]
])
export const activityMapText = (language: string): Strings =>
  TABLES.get(language.split('-')[0]) ?? en
