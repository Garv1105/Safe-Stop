import { useEffect, useRef, useState } from 'react'
import type { RouteAlt } from './types'

export type TripPhase = 'walking' | 'stopped' | 'alert' | 'arrived'

const DEMO_SECONDS = 32 // whole route plays back in ~32 s
const STOP_AT = 0.45 // scripted pause point (share of route)
const STOP_SECONDS = 2.5 // shown to the audience as "3 min"

/** Simulated trip: moves a walker along the route with one scripted stop. */
export function useTrip(alt: RouteAlt | null) {
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<TripPhase>('walking')
  const stopped = useRef(false)
  const progressRef = useRef(0)

  // reset whenever a new trip starts
  useEffect(() => {
    stopped.current = false
    progressRef.current = 0
    setProgress(0)
    setPhase('walking')
  }, [alt])

  useEffect(() => {
    if (!alt || phase !== 'walking') return
    let raf = 0
    let last = performance.now()
    let p = progressRef.current
    const tick = (now: number) => {
      // rAF timestamps can be slightly earlier than `last`, so never step backwards
      p = Math.min(1, p + Math.max(0, now - last) / 1000 / DEMO_SECONDS)
      last = now
      let next: TripPhase = 'walking'
      if (!stopped.current && p >= STOP_AT) {
        stopped.current = true
        p = STOP_AT
        next = 'stopped'
      } else if (p >= 1) next = 'arrived'
      progressRef.current = p
      setProgress(p)
      if (next === 'walking') raf = requestAnimationFrame(tick)
      else setPhase(next)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [alt, phase])

  useEffect(() => {
    if (phase !== 'stopped') return
    const t = setTimeout(() => setPhase('alert'), STOP_SECONDS * 1000)
    return () => clearTimeout(t)
  }, [phase])

  const position = alt ? pointAt(alt, progress) : null
  return { progress, phase, position, resume: () => setPhase('walking') }
}

function pointAt(alt: RouteAlt, t: number): [number, number] {
  const s = alt.samples
  const f = Math.max(0, Math.min(1, t)) * (s.length - 1)
  const i = Math.max(0, Math.min(s.length - 2, Math.floor(f)))
  const k = f - i
  return [s[i][0] + (s[i + 1][0] - s[i][0]) * k, s[i][1] + (s[i + 1][1] - s[i][1]) * k]
}
