import { useMemo, useRef, useState } from 'react'
import { motion, useMotionValueEvent, useScroll, useTransform } from 'framer-motion'
import { BANDS, LOW_SCORE, rgb, scoreColor } from '../../lib/scoring'
import type { AppData } from '../../lib/types'
import { projectHexes, scoreAt } from './geometry'

const STEPS = [
  { time: '7 pm', title: 'Evening', body: 'Shops, darshinis and bakeries are open. Most blocks near the main roads score well.' },
  { time: '10 pm', title: 'Late', body: 'Shops pull their shutters down. Restaurants, pharmacies and fuel stations keep some streets busy.' },
  { time: '1 am', title: 'Night', body: 'Only 24-hour places are left. Lighting and distance to help matter most now.' },
]

/** Pinned section: scrolling moves the clock from 7 pm to 2 am and every block re-scores live. */
export default function NightScroll({ data }: { data: AppData | null }) {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const [t, setT] = useState(0) // 0 = evening, 1 = late, 2 = night
  useMotionValueEvent(scrollYProgress, 'change', (p) => setT(Math.round(Math.min(1, Math.max(0, (p - 0.08) / 0.84)) * 2 * 40) / 40))

  const geo = useMemo(() => (data ? projectHexes(data.cells, 600) : null), [data])
  const totals = useMemo(() => {
    if (!data) return null
    const open = BANDS.map((b) => data.cells.reduce((n, c) => n + c.facts.open[b], 0))
    return { open }
  }, [data])

  // dusk starts as a deep royal blue and sinks to near-black by 2 am
  const sky = useTransform(scrollYProgress, [0, 0.5, 1], ['#0f1a5c', '#0a0f3a', '#04050d'])
  const dusk = useTransform(scrollYProgress, [0, 0.6], [1, 0])
  const stars = useTransform(scrollYProgress, [0.2, 0.9], [0, 1])
  const minutes = 19 * 60 + (t / 2) * 7 * 60 // 7 pm .. 2 am
  const hh = Math.floor(minutes / 60) % 24
  const clock = `${((hh + 11) % 12) + 1}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`
  const ampm = hh >= 12 ? 'pm' : 'am'
  const i = Math.min(1, Math.floor(t))
  const f = t - i
  const openNow = totals ? Math.round(totals.open[i] * (1 - f) + totals.open[i + 1] * f) : 0
  const lowNow = data ? data.cells.filter((c) => scoreAt(c, t) < LOW_SCORE).length : 0
  const step = t < 0.5 ? 0 : t < 1.5 ? 1 : 2

  return (
    <section ref={ref} id="how" className="relative h-[380vh]">
      <motion.div className="sticky top-0 flex h-[100svh] items-center overflow-hidden" style={{ backgroundColor: sky }}>
        {/* soft royal-blue glow along the horizon that fades as night deepens */}
        <motion.div
          aria-hidden
          className="absolute inset-0"
          style={{
            opacity: dusk,
            background: 'linear-gradient(180deg, rgb(10 16 64 / 0.6) 0%, transparent 45%), radial-gradient(ellipse 90% 60% at 50% 105%, rgb(52 84 214 / 0.45), transparent 70%)',
          }}
        />
        <motion.div aria-hidden className="absolute inset-0" style={{ opacity: stars }}>
          {Array.from({ length: 60 }, (_, k) => (
            <span
              key={k}
              className="absolute h-[2px] w-[2px] rounded-full bg-white"
              style={{ left: `${(k * 37.7) % 100}%`, top: `${(k * 53.3) % 60}%`, opacity: 0.25 + ((k * 7) % 10) / 14 }}
            />
          ))}
        </motion.div>

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-4 px-5 pt-16 md:grid-cols-[1fr_1.1fr] md:gap-8 md:pt-0 md:px-6">
          <div>
            <p className="font-display text-[clamp(3.2rem,11vw,9rem)] leading-none font-bold tracking-[-0.05em] text-paper tabular-nums">
              {clock}
              <span className="ml-2 text-[0.35em] font-semibold tracking-normal text-moon/60">{ampm}</span>
            </p>

            {/* the three bands are a real sequence, so a timeline is honest here */}
            <ol className="mt-4 space-y-3 border-l md:mt-8 md:space-y-5 border-white/10 pl-6">
              {STEPS.map((s, k) => (
                <li key={s.title} className="relative">
                  <span
                    className="absolute top-1.5 -left-[31px] h-3 w-3 rounded-full border-2 transition-colors duration-300"
                    style={{ borderColor: k <= step ? '#ffb547' : 'rgb(255 255 255 / 0.2)', background: k === step ? '#ffb547' : '#070a1a' }}
                  />
                  <p className={`font-display text-xl font-semibold transition-colors duration-300 ${k === step ? 'text-paper' : 'text-moon/40'}`}>
                    {s.title} <span className="text-sm font-normal text-moon/50">from {s.time}</span>
                  </p>
                  <motion.p
                    className="max-w-md overflow-hidden text-[15px] leading-relaxed text-moon/80"
                    animate={{ height: k === step ? 'auto' : 0, opacity: k === step ? 1 : 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                  >
                    {s.body}
                  </motion.p>
                </li>
              ))}
            </ol>

            <div className="mt-4 grid max-w-md grid-cols-2 gap-3 md:mt-8">
              <div className="glass-night rounded-2xl p-3 md:p-4">
                <p className="font-display text-2xl font-bold text-paper tabular-nums md:text-3xl">{openNow.toLocaleString('en-IN')}</p>
                <p className="text-sm text-moon/70">places still open</p>
              </div>
              <div className="glass-night rounded-2xl p-3 md:p-4">
                <p className="font-display text-2xl font-bold text-paper tabular-nums md:text-3xl">{lowNow}</p>
                <p className="text-sm text-moon/70">blocks with low lighting &amp; activity</p>
              </div>
            </div>
          </div>

          <div className="relative order-first mx-auto w-[min(78vw,34svh)] md:order-none md:w-full">
            <div aria-hidden className="absolute inset-[10%] rounded-full bg-sodium/10 blur-3xl" style={{ opacity: 1 - t / 2.4 }} />
            {geo ? (
              <svg viewBox={`-10 -10 ${geo.width + 20} ${geo.height + 20}`} className="relative w-full" role="img" aria-label="Block scores changing through the night">
                {geo.shapes.map((s) => (
                  <path key={s.cell.h3} d={s.d} fill={rgb(scoreColor(scoreAt(s.cell, t)))} stroke="#070a1a" strokeWidth={1.5} />
                ))}
              </svg>
            ) : (
              <div className="aspect-square w-full animate-pulse rounded-full bg-white/5" />
            )}
          </div>
        </div>
      </motion.div>
    </section>
  )
}
