import type { NativeChatSessionTransport } from './native-chat-session-transport'

let subscriptionCounter = 0

export function nextNativeChatTranscriptSubscriptionId(): string {
  subscriptionCounter += 1
  return `native-chat-${subscriptionCounter}-${Date.now()}`
}

/** Normalizes desktop's synchronous teardown and the paired web bridge's deferred teardown. */
export function openNativeChatTranscriptStream(
  transport: NativeChatSessionTransport,
  args: Parameters<NativeChatSessionTransport['subscribe']>[0],
  onFrame: Parameters<NativeChatSessionTransport['subscribe']>[1]
): () => void {
  const teardown = transport.subscribe(args, onFrame) as unknown
  if (typeof teardown === 'function') {
    return teardown as () => void
  }
  if (!teardown || typeof (teardown as { then?: unknown }).then !== 'function') {
    return () => undefined
  }
  const deferredTeardown = (teardown as Promise<unknown>).catch(() => undefined)
  return () => {
    void deferredTeardown.then((resolvedTeardown) => {
      if (typeof resolvedTeardown === 'function') {
        ;(resolvedTeardown as () => void)()
      }
    })
  }
}
