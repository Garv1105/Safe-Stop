import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { rankRoutes } from '../../components/panels/RoutePanel'
import { rgb, scoreColor } from '../../lib/scoring'
import type { AppData } from '../../lib/types'
import { pathFrom, projectHexes } from './geometry'
import { Reveal } from './effects'

const km = (m: number) => (m / 1000).toFixed(1) + ' km'

type Streets = { ways: { k: 0 | 1 | 2; c: [number, number][] }[] }
// stroke per road class: main roads, local streets, footpaths
const STREET_STYLE = [
  { opacity: 0.55, width: 2.4 },
  { opacity: 0.26, width: 1.1 },
  { opacity: 0.12, width: 0.7 },
]

/** Real OSM streets around the demo route (precomputed by scripts/make_street_preview.py). */
function useStreets() {
  const [streets, setStreets] = useState<Streets | null>(null)
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/streets_preview.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setStreets, () => {})
  }, [])
  return streets
}

/** Shortest vs safest on the real DSCE → Konanakunte Cross routes, drawn as you scroll. */
export default function RouteStory({ data }: { data: AppData | null }) {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.75', 'center 0.45'] })
  const shortLen = useTransform(scrollYProgress, [0, 0.55], [0, 1])
  const safeLen = useTransform(scrollYProgress, [0.35, 1], [0, 1])
  const streets = useStreets()

  const story = useMemo(() => {
    if (!data) return null
    const pair = data.routes.pairs.find((p) => p.id === 'dsce-konanakunte') ?? data.routes.pairs[0]
    const cells = new Map(data.cells.map((c) => [c.h3, c]))
    const rows = rankRoutes(pair, cells, 'night')
    const shortest = rows.find((r) => r.kind.startsWith('Shortest'))!
    const safest = rows.find((r) => r.kind === 'Safest') ?? shortest
    // fit the drawing to the routes with a margin
    const pts = pair.alternatives.flatMap((a) => a.coords)
    const pad = 0.003
    const [x0, x1] = [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))]
    const [y0, y1] = [Math.min(...pts.map((p) => p[1])) - pad, Math.max(...pts.map((p) => p[1])) + pad]
    // widen east-west so the panel is close to square instead of a tall strip
    const half = Math.max((x1 - x0) / 2 + pad, ((y1 - y0) * 0.85) / 2 / Math.cos((12.9 * Math.PI) / 180))
    const mid = (x0 + x1) / 2
    const bounds: [number, number, number, number] = [mid - half, y0, mid + half, y1]
    const geo = projectHexes(data.cells, 640, bounds)
    return { pair, shortest, safest, geo, bounds, dShort: pathFrom(shortest.alt.coords, geo.project), dSafe: pathFrom(safest.alt.coords, geo.project) }
  }, [data])

  // one combined path per road class keeps the DOM small (3 nodes instead of ~3,000)
  const streetPaths = useMemo(() => {
    if (!streets || !story) return null
    const [w, s, e, n] = story.bounds
    const out = ['', '', '']
    for (const way of streets.ways) {
      if (!way.c.some(([x, y]) => x >= w && x <= e && y >= s && y <= n)) continue
      out[way.k] += pathFrom(way.c, story.geo.project)
    }
    return out
  }, [streets, story])

  return (
    <section ref={ref} className="relative mx-auto max-w-6xl px-5 py-32 md:px-6">
      <Reveal>
        <h2 className="max-w-3xl font-display text-[clamp(2.4rem,5.5vw,4.5rem)] leading-[1.02] font-bold tracking-[-0.028em] text-paper">
          The shortest walk isn't always the one you want at 1 am.
        </h2>
        <p className="mt-5 max-w-xl text-lg text-moon/80">
          From the DSCE gate to Konanakunte Cross metro, a slightly longer route stays on better-lit, busier streets for more of the way.
        </p>
      </Reveal>

      <div className="mt-14 grid items-center gap-8 lg:grid-cols-[1fr_1.2fr_1fr]">
        {story && (
          <Reveal x={-60} className="order-2 lg:order-1">
            <RouteCard
              tone="moon"
              title="Shortest"
              distance={km(story.shortest.alt.distanceM)}
              minutes={Math.round(story.shortest.alt.durationS / 60)}
              low={story.shortest.stats.lowShare}
              score={story.shortest.stats.mean}
            />
          </Reveal>
        )}

        {/* no frame: the drawing fades into the page at its edges */}
        <div
          className="relative order-1 lg:order-2"
          style={{
            maskImage: 'radial-gradient(ellipse 62% 64% at 50% 50%, #000 45%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 62% 64% at 50% 50%, #000 45%, transparent 100%)',
          }}
        >
          {story ? (
            <svg
              viewBox={`0 0 ${story.geo.width} ${story.geo.height}`}
              className="w-full"
              shapeRendering="geometricPrecision"
              role="img"
              aria-label="Shortest and safest routes from DSCE to Konanakunte Cross metro"
            >
              <defs>
                <filter id="route-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="5" />
                </filter>
              </defs>
              {/* night scores as a soft tint under the streets */}
              {story.geo.shapes.map((s) => (
                <path key={s.cell.h3} d={s.d} fill={rgb(scoreColor(s.cell.score.night))} fillOpacity={0.22} stroke="#070a1a" strokeOpacity={0.6} strokeWidth={1} />
              ))}
              {streetPaths?.map((d, k) => (
                <path key={k} d={d} fill="none" stroke="#c7ceff" strokeOpacity={STREET_STYLE[k].opacity} strokeWidth={STREET_STYLE[k].width} strokeLinecap="round" strokeLinejoin="round" />
              ))}
              <motion.path d={story.dShort} fill="none" stroke="#e3e7ff" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" style={{ pathLength: shortLen }} />
              <motion.path d={story.dSafe} fill="none" stroke="#ffb547" strokeWidth={12} strokeOpacity={0.7} filter="url(#route-glow)" strokeLinecap="round" strokeLinejoin="round" style={{ pathLength: safeLen }} />
              <motion.path d={story.dSafe} fill="none" stroke="#ffc46b" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" style={{ pathLength: safeLen }} />
              {[story.pair.origin, story.pair.dest].map((p, k) => {
                const [x, y] = story.geo.project(p.lng, p.lat)
                return (
                  <g key={p.name}>
                    <circle cx={x} cy={y} r={10} fill={k ? '#ffb547' : '#f2f3ff'} stroke="#070a1a" strokeWidth={3.5} />
                    <text x={x + 16} y={y + 6} fill="#f2f3ff" fontSize={17} fontWeight={600} fontFamily="Inter, sans-serif" paintOrder="stroke" stroke="#070a1a" strokeWidth={4}>
                      {k ? 'Konanakunte Cross' : 'DSCE'}
                    </text>
                  </g>
                )
              })}
            </svg>
          ) : (
            <div className="aspect-[4/5] w-full animate-pulse rounded-3xl bg-white/5" />
          )}
        </div>

        {story && (
          <Reveal x={60} className="order-3">
            <RouteCard
              tone="sodium"
              title="Safest"
              distance={km(story.safest.alt.distanceM)}
              minutes={Math.round(story.safest.alt.durationS / 60)}
              low={story.safest.stats.lowShare}
              score={story.safest.stats.mean}
              extra={`${story.safest.alt.distanceM - story.shortest.alt.distanceM} m longer, ${story.safest.stats.mean - story.shortest.stats.mean} points safer`}
            />
          </Reveal>
        )}
      </div>
    </section>
  )
}

function RouteCard(p: { tone: 'moon' | 'sodium'; title: string; distance: string; minutes: number; low: number; score: number; extra?: string }) {
  const accent = p.tone === 'sodium' ? '#ffb547' : '#c7ceff'
  return (
    <div className="glass-night rounded-3xl p-6" style={{ borderColor: p.tone === 'sodium' ? 'rgb(255 181 71 / 0.35)' : undefined }}>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-display text-xl font-semibold text-paper">
          <span className="h-1.5 w-6 rounded-full" style={{ background: accent }} />
          {p.title}
        </p>
        <span className="font-display text-3xl font-bold tabular-nums" style={{ color: accent }}>
          {p.score}
        </span>
      </div>
      <p className="mt-1 text-right text-xs text-moon/60">average night score</p>
      <dl className="mt-5 grid grid-cols-2 gap-y-3 text-sm">
        <dt className="text-moon/60">Distance</dt>
        <dd className="text-right font-medium text-paper">{p.distance}</dd>
        <dt className="text-moon/60">Walking time</dt>
        <dd className="text-right font-medium text-paper">{p.minutes} min</dd>
        <dt className="text-moon/60">Through low-score blocks</dt>
        <dd className="text-right font-medium text-paper">{Math.round(p.low * 100)}%</dd>
      </dl>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{ background: accent }}
          initial={{ width: 0 }}
          whileInView={{ width: `${Math.round(p.low * 100)}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
        />
      </div>
      {p.extra && <p className="mt-4 text-sm font-medium text-go">{p.extra}</p>}
    </div>
  )
}
