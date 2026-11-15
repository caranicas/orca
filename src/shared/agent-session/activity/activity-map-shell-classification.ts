// Adapted from lot-map 09f6b93, Copyright (c) 2026 Aleksei Volodin; MIT, see lot-map-LICENSE.txt.
import {
  FILE_WORDS,
  NEUTRAL_WORDS,
  NET_WORDS,
  NET_SUBCOMMANDS,
  PY_MODULES,
  WRAPPERS,
  ASSIGNMENT,
  GIT_TAKES,
  DOCKER_TAKES,
  RUNNERS,
  PS_FILE_WORDS,
  PS_NEUTRAL_WORDS,
  PS_NET_WORDS
} from './activity-map-shell-vocabulary'
import { segments, base, pastFlags, memoryLabel, named } from './activity-map-shell-segments'
import { isMemoryPath } from './activity-map-labels'
import type {
  ActivityMapClassificationOptions as Setup,
  ActivityMapClassified as Classified
} from './activity-map-classification-options'
export function classifyShell(
  command: string,
  description: string,
  setup: Setup,
  powershell = false
): Classified {
  const name = (word?: string): string => (powershell ? base(word).toLowerCase() : base(word))
  const own = (words: string[]): string[] => {
    if (!powershell) {
      return words
    }
    let i = 0
    if (/^\$[\w:]+$/.test(words[0] ?? '') && words[1] === '=') {
      i = 2
      if (/^(?:["'$\d]|\[|@\(|@\{)/.test(words[i] ?? '')) {
        return []
      }
    }
    if (words[i] === '&' || words[i] === '.') {
      i++
    }
    return words.slice(i)
  }
  const unwrapped = (words: string[]): string[] => {
    let rest = words
    for (let depth = 0; depth < 6; depth++) {
      const wrapper = WRAPPERS[name(rest[0])]
      if (wrapper === undefined) {
        break
      }
      if (wrapper.asks?.some((flag) => rest[1] === flag) === true) {
        break
      }
      rest = pastFlags(rest.slice(1), new Set(wrapper.takes ?? []))
      let i = 0
      while (i < rest.length && ASSIGNMENT.test(rest[i] ?? '')) {
        i++
      }
      rest = rest.slice(i + (wrapper.skip ?? 0))
    }
    return rest
  }

  const commands = (words: string[]): string[][] => {
    const outer = unwrapped(words)
    const all = [outer]
    if (name(outer[0]) === 'find') {
      outer.forEach((word, i) => {
        if (!/^-(?:exec|execdir|ok|okdir)$/.test(word)) {
          return
        }
        const tail = outer.slice(i + 1)
        const end = tail.findIndex((w) => w === ';' || w === '\\;' || w === '\\' || w === '+')
        all.push(unwrapped(end === -1 ? tail : tail.slice(0, end)))
      })
    }
    return all.filter((c) => c.length > 0)
  }

  const isNet = (words: string[]): boolean => {
    let head = name(words[0])
    let rest = words.slice(1)
    if (NET_WORDS.has(head) || (powershell && PS_NET_WORDS.has(head))) {
      return true
    }
    if (/^(?:python[\d.]*|py)$/.test(head) && rest[0] === '-m' && PY_MODULES.has(rest[1] ?? '')) {
      ;[head, rest] = [rest[1] ?? '', rest.slice(2)]
    }
    if (head === 'uv' && rest[0] === 'pip') {
      ;[head, rest] = ['pip', rest.slice(1)]
    }
    if (head === 'git') {
      rest = pastFlags(rest, GIT_TAKES)
    }
    if (head === 'docker') {
      rest = pastFlags(rest, DOCKER_TAKES)
      if (rest[0] === 'compose') {
        ;[head, rest] = ['docker compose', pastFlags(rest.slice(1), DOCKER_TAKES)]
      }
    }
    if (head === 'npx') {
      return rest.some((w) => w === '-y' || w === '--yes')
    }
    const subs = NET_SUBCOMMANDS[head]
    return (
      subs !== undefined &&
      (subs.has(rest[0] ?? '') || subs.has(`${rest[0] ?? ''} ${rest[1] ?? ''}`))
    )
  }
  const lines = segments(command)
    .map(own)
    .filter((words) => words.length > 0)
  const label = description.trim() || base(lines[0]?.[0] ?? 'shell')
  for (const words of lines.flatMap(commands)) {
    const head = name(words[0])
    const script = RUNNERS.has(head) && words[1] ? base(words[1]) : ''
    if (setup.memoryCommands.some((c) => named(head, c) || named(script, c))) {
      return { station: 'memory', label: memoryLabel(words, setup) }
    }
  }
  if (segments(command, true).map(own).flatMap(commands).some(isNet)) {
    return { station: 'network', label }
  }
  const isNeutral = (head: string): boolean =>
    NEUTRAL_WORDS.has(head) || (powershell && PS_NEUTRAL_WORDS.has(head))
  const isFile = (head: string): boolean =>
    FILE_WORDS.has(head) || (powershell && PS_FILE_WORDS.has(head))
  const real = lines.flatMap(commands).filter((words) => !isNeutral(name(words[0])))
  if (real.length > 0 && real.every((words) => isFile(name(words[0])))) {
    return { station: isMemoryPath(command, setup) ? 'memory' : 'files', label }
  }
  return { station: 'shell', label }
}
