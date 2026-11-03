import { REPO_COLORS } from './repo-badge-color'

export const WORKSPACE_COLORS = [...REPO_COLORS, '#1d4ed8'] as const

export const WORKSPACE_COLOR_NAMES = [
  'Gray',
  'Red',
  'Orange',
  'Yellow',
  'Green',
  'Teal',
  'Purple',
  'Pink',
  'Deep blue'
] as const
