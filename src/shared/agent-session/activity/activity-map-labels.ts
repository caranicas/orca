// Adapted from lot-map 09f6b93, Copyright (c) 2026 Aleksei Volodin; MIT, see lot-map-LICENSE.txt.
import type { ActivityMapClassificationOptions as Setup } from './activity-map-classification-options'
export const slashes = (path: string): string => path.replace(/\\/g, '/')

export const lastTwo = (path: string): string =>
  slashes(path).split('/').filter(Boolean).slice(-2).join('/')

const HOST = /^(?:[\p{L}\p{N}.-]+|\[[0-9a-f:.]+\])(?::\d+)?$/iu

export function hostOf(url: string): string {
  const [, scheme = '', rest = ''] = /^(?:([a-z][a-z0-9+.-]*):\/\/)?(.*)$/is.exec(url) ?? []
  const end = rest.search(/[/?#]/)
  const first = end < 0 ? rest : rest.slice(0, end)
  const beyond = end < 0 ? '' : rest.slice(end)
  let host = first.split('@').pop() ?? ''
  if (
    !first.startsWith('[') &&
    !first.includes('@') &&
    first.includes(':') &&
    beyond.includes('@')
  ) {
    host = /:\d+$/.test(first)
      ? ''
      : (rest.slice(rest.lastIndexOf('@') + 1).split(/[/?#]/)[0] ?? '')
  }
  return HOST.test(host) ? host.slice(0, 40) : scheme
}

export function clean(label: string, max = 120): string {
  const text = label
    .replace(/[\p{Cc}\p{Cf}]+/gu, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export const isMemoryPath = (path: string, setup: Setup): boolean => {
  const p = slashes(path)
  return (
    /\/\.claude\/projects\/[^/]+\/memory\//.test(p) ||
    setup.memoryPaths.some((part) => p.includes(slashes(part)))
  )
}
export const str = (v: unknown): string => (typeof v === 'string' ? v : '')

export function shortModel(model: string): string {
  const match = /claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(model)
  return match ? `${match[1]} ${match[2]}${match[3] ? `.${match[3]}` : ''}` : model
}
