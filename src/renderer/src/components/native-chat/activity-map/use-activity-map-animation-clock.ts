import { useLayoutEffect, useRef } from 'react'

export function useActivityMapAnimationClock(now: number, live: boolean) {
  const diagram = useRef<SVGSVGElement>(null)
  const sample = useRef<{ now: number; receivedAt: number; live: boolean } | null>(null)
  useLayoutEffect(() => {
    if (now <= 0 || typeof KeyframeEffect === 'undefined') {
      return
    }
    const receivedAt = performance.now()
    if (!sample.current || sample.current.now !== now || sample.current.live !== live) {
      sample.current = { now, receivedAt, live }
    }
    const hostNow = sample.current.now + (live ? receivedAt - sample.current.receivedAt : 0)
    for (const animation of diagram.current?.getAnimations?.({ subtree: true }) ?? []) {
      const effect = animation.effect
      if (!(effect instanceof KeyframeEffect) || !(effect.target instanceof SVGElement)) {
        continue
      }
      const started = effect.target.dataset.activityStartedAt
      if (started === undefined || !Number.isFinite(Number(started))) {
        continue
      }
      animation.currentTime = Math.max(0, hostNow - Number(started))
    }
  })
  return diagram
}
