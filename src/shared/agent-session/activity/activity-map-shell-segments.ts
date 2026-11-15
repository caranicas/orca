// Adapted from lot-map 09f6b93, Copyright (c) 2026 Aleksei Volodin; MIT, see lot-map-LICENSE.txt.
import { slashes } from './activity-map-labels'
import { ASSIGNMENT, RUNNERS } from './activity-map-shell-vocabulary'
import type { ActivityMapClassificationOptions as Setup } from './activity-map-classification-options'
export const pastFlags = (words: string[], takes: { has(flag: string): boolean }): string[] => {
  let i = 0
  while (i < words.length && (words[i] ?? '').startsWith('-')) {
    i += takes.has(words[i] ?? '') ? 2 : 1
  }
  return words.slice(i)
}
export function segments(command: string, deep = false): string[][] {
  return command
    .split(deep ? /&&|\|\||;|\||\n|\$\(|`|\(|\)/ : /&&|\|\||;|\||\n/)
    .map((part) => part.match(/(?:[^\s"']|"[^"]*"?|'[^']*'?)+/g) ?? [])
    .map((words) => {
      let i = 0
      while (i < words.length && ASSIGNMENT.test(words[i] ?? '')) {
        i++
      }
      return words.slice(i)
    })
    .filter((words) => words.length > 0)
}

export const base = (word = ''): string => {
  const name = slashes(word.replace(/["']/g, '')).split('/').pop() ?? word
  return /\.(?:exe|cmd|bat)$/i.test(name)
    ? name.replace(/\.(?:exe|cmd|bat)$/i, '').toLowerCase()
    : name
}

const stem = (name: string): string => name.replace(/\.[a-z0-9]+$/i, '')

export const named = (name: string, command: string): boolean => {
  const s = stem(name)
  return s === command || (s.startsWith(command) && /^[-_.]/.test(s.slice(command.length)))
}

export function memoryLabel(words: string[], setup: Setup): string {
  const head = base(words[0])
  if (!setup.memoryCommands.includes(head)) {
    return stem(base(RUNNERS.has(head) && words[1] ? words[1] : words[0]))
  }
  const sub = words[1] ?? ''
  return setup.memorySubcommands.has(sub) ? sub : head
}
