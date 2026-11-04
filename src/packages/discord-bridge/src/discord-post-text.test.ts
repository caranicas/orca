import { describe, expect, it } from 'vitest'
import { chunkMessage } from './discord-post-text'

describe('chunkMessage', () => {
  it('keeps every chunk within the limit and loses no text', () => {
    const text = Array.from({ length: 300 }, (_, i) => `line ${i} of the agent reply`).join('\n')
    const chunks = chunkMessage(text, 500)
    expect(chunks.every((chunk) => chunk.length <= 500)).toBe(true)
    expect(chunks.join('\n')).toBe(text)
  })

  it('hard-splits a single line longer than the limit', () => {
    expect(chunkMessage('x'.repeat(1200), 500).map((chunk) => chunk.length)).toEqual([
      500, 500, 200
    ])
  })
})
