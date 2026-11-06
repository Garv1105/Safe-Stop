import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Lightbulb } from 'lucide-react'
import { rgb, scoreColor, scoreLabel } from '../../lib/scoring'
import type { AppData, Cell } from '../../lib/types'
import { projectHexes } from './geometry'

const LINES = ['Walk home', 'by the light,', 'not by guesswork.']
const ease = [0.22, 1, 0.36, 1] as const

export default function Hero({ data }: { data: AppData | null }) {
  const root = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const [hover, setHover] = useState<Cell | null>(null)
  const geo = useMemo(() => (data ? projectHexes(data.cells, 1000) : null), [data])
  const centre = geo && { x: geo.width / 2, y: geo.height / 2 }

  // The lamp: follows the pointer; drifts on its own until the visitor moves (and on touch screens).
  useEffect(() => {
    const el = root.current
    if (!el) return
    let manual = false
    let raf = 0
    let frame = 0
    const place = (x: number, y: number) => {
      el.style.setProperty('--lx', `${x}px`)
      el.style.setProperty('--ly', `${y}px`)
    }
    const pick = (x: number, y: number) => {
      const r = el.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + x, r.top + y) as SVGElement | null
      const i = hit?.dataset?.i
      if (i !== undefined && geo) setHover(geo.shapes[Number(i)].cell)
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      manual = true
      const r = el.getBoundingClientRect()
      place(e.clientX - r.left, e.clientY - r.top)
    }
    const drift = (t: number) => {
      if (!manual) {
        const w = el.clientWidth
        const h = el.clientHeight
        const x = w * (0.62 + 0.22 * Math.sin(t / 2900))
        const y = h * (0.52 + 0.24 * Math.sin(t / 2100 + 1))
        place(x, y)
        if (frame++ % 12 === 0) pick(x, y)
      }
      raf = requestAnimationFrame(drift)
    }
    place(el.clientWidth * 0.68, el.clientHeight * 0.5)
    if (!reduce) raf = requestAnimationFrame(drift)
    el.addEventListener('pointermove', onMove)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointermove', onMove)
    }
  }, [geo, reduce])

  const shown = hover ?? geo?.shapes.reduce((a, b) => (Math.hypot(b.cx - centre!.x, b.cy - centre!.y) < Math.hypot(a.cx - centre!.x, a.cy - centre!.y) ? b : a)).cell

  return (
    <section
      ref={root}
      className="relative isolate flex min-h-[100svh] items-end overflow-hidden pt-28 pb-16 md:items-center md:pt-24 md:pb-0"
      style={{ ['--lx' as string]: '68%', ['--ly' as string]: '50%' }}
    >
      {/* the city, dim: every block switches on in a ripple out from DSCE */}
      {geo && (
        <svg
          className="absolute inset-0 -z-20 h-full w-full"
          viewBox={`0 0 ${geo.width} ${geo.height}`}
          preserveAspectRatio="xMidYMid slice"
          onPointerOver={(e) => {
            const i = (e.target as SVGElement).dataset.i
            if (i !== undefined) setHover(geo.shapes[Number(i)].cell)
          }}
          aria-hidden
        >
          {geo.shapes.map((s, i) => (
            <path
              key={s.cell.h3}
              data-i={i}
              d={s.d}
              className="lamp-on"
              style={{ animationDelay: `${300 + Math.hypot(s.cx - centre!.x, s.cy - centre!.y) * 2.2}ms` }}
              fill={rgb(scoreColor(s.cell.score.evening))}
              fillOpacity={0.16}
              stroke="#070a1a"
              strokeWidth={2}
            />
          ))}
        </svg>
      )}

      {/* the same city at full colour, visible only inside the lamp's pool of light */}
      {geo && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            maskImage: 'radial-gradient(circle 240px at var(--lx) var(--ly), #000 0%, rgb(0 0 0 / 0.6) 45%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(circle 240px at var(--lx) var(--ly), #000 0%, rgb(0 0 0 / 0.6) 45%, transparent 100%)',
          }}
        >
          <svg className="h-full w-full" viewBox={`0 0 ${geo.width} ${geo.height}`} preserveAspectRatio="xMidYMid slice">
            {geo.shapes.map((s) => (
              <path
                key={s.cell.h3}
                d={s.d}
                fill={rgb(scoreColor(s.cell.score.evening))}
                fillOpacity={hover?.h3 === s.cell.h3 ? 1 : 0.85}
                stroke={hover?.h3 === s.cell.h3 ? '#fff' : '#070a1a'}
                strokeWidth={hover?.h3 === s.cell.h3 ? 3 : 2}
              />
            ))}
          </svg>
        </div>
      )}
      {/* warm light pool + vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 mix-blend-screen"
        style={{ background: 'radial-gradient(circle 320px at var(--lx) var(--ly), rgb(255 181 71 / 0.22), transparent 70%)' }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_30%,#070a1a_85%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-night to-transparent" />

      <div className="pointer-events-none mx-auto grid w-full max-w-6xl gap-10 px-5 md:grid-cols-[1.35fr_1fr] md:items-end md:px-6">
        <div>
          <h1 className="font-display text-[clamp(3rem,9vw,7.25rem)] leading-[0.9] font-bold tracking-[-0.03em]">
            {LINES.map((line, i) => (
              <span key={line} className="block overflow-hidden pb-[0.08em]">
                <motion.span
                  className="block bg-clip-text text-transparent"
                  style={{
                    backgroundImage: 'radial-gradient(520px circle at var(--lx) var(--ly), #fff1cf, #c7ceff 42%, #7d86c9 85%)',
                    backgroundAttachment: 'fixed',
                  }}
                  initial={{ y: '105%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 1, ease, delay: 0.15 + i * 0.12 }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p
            className="mt-7 max-w-[34rem] text-lg leading-relaxed text-moon/85"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.65 }}
          >
            SafeStop scores every street block around DSCE for night walking: lamps, shops still open, buses nearby and how far help is. Then it finds the route with more of all four.
          </motion.p>
          <motion.div
            className="pointer-events-auto mt-9 flex flex-wrap gap-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.8 }}
          >
            <a
              href="#/map"
              className="group relative inline-flex h-13 items-center gap-2 overflow-hidden rounded-2xl bg-sodium px-7 text-[15px] font-semibold text-night shadow-[0_0_40px_-6px_#ffb547] transition-shadow hover:shadow-[0_0_60px_-4px_#ffb547]"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative">Open the map</span>
            </a>
            {/* a button, not a #link: the app uses the URL hash for page routing */}
            <button
              onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}
              className="glass-night inline-flex h-13 cursor-pointer items-center rounded-2xl px-7 text-[15px] font-medium text-paper transition-colors hover:bg-white/10"
            >
              See how it works
            </button>
          </motion.div>
          <motion.p
            className="mt-6 flex items-center gap-2 text-sm text-moon/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.8 }}
          >
            <Lightbulb size={15} className="text-sodium" />
            <span className="hidden md:inline">Move your cursor across the map. It lights the blocks like a street lamp.</span>
            <span className="md:hidden">The light shows real scores for blocks around DSCE.</span>
          </motion.p>
        </div>

        {/* live readout of the block under the lamp */}
        <motion.div
          className="glass-night pointer-events-auto w-full max-w-sm justify-self-end rounded-3xl p-5"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, ease, delay: 1 }}
          aria-live="polite"
        >
          <p className="text-sm text-moon/70">Block under the light, evening</p>
          {shown ? (
            <>
              <div className="mt-3 flex items-center gap-4">
                <motion.span
                  key={shown.h3}
                  initial={{ scale: 0.85, opacity: 0.4 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  className="grid h-16 w-16 place-items-center rounded-2xl font-display text-3xl font-bold text-night tabular-nums"
                  style={{ background: rgb(scoreColor(shown.score.evening)), boxShadow: `0 0 30px -4px ${rgb(scoreColor(shown.score.evening))}` }}
                >
                  {Math.round(shown.score.evening)}
                </motion.span>
                <div>
                  <p className="font-display text-xl font-semibold text-paper">{scoreLabel(shown.score.evening)}</p>
                  <p className="text-sm text-moon/70">
                    Drops to {Math.round(shown.score.night)} after midnight
                  </p>
                </div>
              </div>
              <ul className="mt-4 space-y-1.5 text-sm text-moon/90">
                {shown.reasons.evening.slice(0, 2).map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sodium" />
                    {r}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="mt-3 h-28 animate-pulse rounded-2xl bg-white/5" />
          )}
        </motion.div>
      </div>
    </section>
  )
}
