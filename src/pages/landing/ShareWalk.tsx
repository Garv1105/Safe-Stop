import { useMemo } from 'react'
import { AlertTriangle, UserRound } from 'lucide-react'
import type { AppData } from '../../lib/types'
import { pathFrom, projectHexes } from './geometry'
import { Reveal } from './effects'

const W = 240
const H = 300

/** Phone mockup: a walker moves along the safest route, pauses, and the stop check pops up (CSS loop). */
export default function ShareWalk({ data }: { data: AppData | null }) {
  const scene = useMemo(() => {
    if (!data) return null
    const pair = data.routes.pairs.find((p) => p.id === 'dsce-konanakunte') ?? data.routes.pairs[0]
    const alt = pair.alternatives.reduce((a, b) => (b.distanceM > a.distanceM ? b : a))
    const lngs = alt.coords.map((c) => c[0])
    const lats = alt.coords.map((c) => c[1])
    const padX = (Math.max(...lngs) - Math.min(...lngs)) * 0.6 + 0.002
    const padY = (Math.max(...lats) - Math.min(...lats)) * 0.08 + 0.001
    const bounds: [number, number, number, number] = [Math.min(...lngs) - padX, Math.min(...lats) - padY, Math.max(...lngs) + padX, Math.max(...lats) + padY]
    // fit inside W x H: if too tall at full width, shrink and centre horizontally
    let geo = projectHexes(data.cells, W, bounds)
    let dx = 0
    if (geo.height > H) {
      geo = projectHexes(data.cells, (W * H) / geo.height, bounds)
      dx = (W - geo.width) / 2
    }
    const project = (lng: number, lat: number): [number, number] => {
      const [x, y] = geo.project(lng, lat)
      return [x + dx, y]
    }
    return { geo, dx, d: pathFrom(alt.coords, project) }
  }, [data])

  return (
    <section className="relative mx-auto grid max-w-6xl items-center gap-16 px-5 py-32 md:grid-cols-2 md:px-6">
      <Reveal>
        <h2 className="font-display text-[clamp(2.4rem,5.5vw,4.5rem)] leading-[1.02] font-bold tracking-[-0.028em] text-paper">Someone knows you're on your way.</h2>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-moon/80">
          Start a trip and share a live link with people you trust. If you stop for a few minutes, SafeStop checks in with you before telling anyone.
        </p>
        <ul className="mt-8 space-y-3 text-[15px] text-moon/85">
          <li className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sodium" />
            Sharing starts only when you press start, and ends when you arrive.
          </li>
          <li className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sodium" />
            No account needed to see scores or routes.
          </li>
        </ul>
        <p className="mt-6 text-sm text-moon/50">In this prototype, trip sharing is simulated.</p>
      </Reveal>

      <Reveal x={60} className="justify-self-center">
        <div className="relative">
          <div aria-hidden className="absolute -inset-10 rounded-full bg-sodium/15 blur-3xl" />
          <div className="glass-night relative w-[290px] rounded-[2.75rem] p-3">
            <div className="overflow-hidden rounded-[2.2rem] bg-night/80">
              <div className="flex items-center justify-between px-5 pt-4 pb-3 text-xs text-moon/70">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-go" /> Sharing live
                </span>
                <span>To Konanakunte Cross</span>
              </div>
              <div className="relative mx-auto" style={{ width: W, height: H }}>
                {scene && (
                  <>
                    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0" aria-hidden>
                      <g transform={`translate(${scene.dx} 0)`}>
                        {scene.geo.shapes.map((s) => (
                          <path key={s.cell.h3} d={s.d} fill="#c7ceff" fillOpacity={0.05} stroke="#c7ceff" strokeOpacity={0.12} />
                        ))}
                      </g>
                      <path d={scene.d} fill="none" stroke="#ffb547" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span
                      className="walker absolute top-0 left-0 h-4 w-4 rounded-full border-[3px] border-white bg-brand-500 shadow-[0_0_0_8px_rgb(99_102_241/0.3)]"
                      style={{ offsetPath: `path('${scene.d}')`, offsetRotate: '0deg' }}
                    />
                  </>
                )}
                <div className="stop-alert absolute inset-x-3 bottom-3 rounded-2xl border border-amber-300/40 bg-amber-400/15 p-3 backdrop-blur-md">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-amber-100">
                    <AlertTriangle size={14} /> Stopped for 3 min. All OK?
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs font-medium">
                    <span className="rounded-lg bg-white/10 py-1.5 text-paper">I'm OK</span>
                    <span className="rounded-lg bg-amber-500 py-1.5 text-night">Tell contacts</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 border-t border-white/10 px-5 py-4">
                {['Contact 1', 'Contact 2'].map((c) => (
                  <span key={c} className="flex items-center gap-1.5 text-xs text-moon/80">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10">
                      <UserRound size={12} />
                    </span>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
