import { Fragment } from 'react'
import { Footprints, Play, ShieldCheck, Timer, X } from 'lucide-react'
import { BAND_INFO, LOW_SCORE, rgb, routeStats, scoreColor } from '../../lib/scoring'
import type { Band, Cell, RouteAlt, RoutePair } from '../../lib/types'
import { Badge, Button, cn } from '../ui'

type Kind = 'Shortest' | 'Safest' | 'Balanced' | 'Shortest & safest'

export function rankRoutes(pair: RoutePair, cells: Map<string, Cell>, band: Band) {
  const rows = pair.alternatives.map((alt) => ({ alt, stats: routeStats(alt, cells, band) }))
  const shortest = rows.reduce((a, b) => (b.alt.distanceM < a.alt.distanceM ? b : a))
  const safest = rows.reduce((a, b) => (b.stats.mean > a.stats.mean || (b.stats.mean === a.stats.mean && b.stats.lowShare < a.stats.lowShare) ? b : a))
  const kind = (r: (typeof rows)[number]): Kind =>
    r === shortest && r === safest ? 'Shortest & safest' : r === shortest ? 'Shortest' : r === safest ? 'Safest' : 'Balanced'
  const order: Record<Kind, number> = { 'Shortest & safest': 0, Shortest: 0, Balanced: 1, Safest: 2 }
  return rows.map((r) => ({ ...r, kind: kind(r), shortest })).sort((a, b) => order[a.kind] - order[b.kind])
}

const km = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`)

interface Props {
  pair: RoutePair
  cells: Map<string, Cell>
  band: Band
  selected: string | null
  onSelect: (id: string) => void
  onStartTrip: (alt: RouteAlt) => void
  onClose: () => void
}

export default function RoutePanel({ pair, cells, band, selected, onSelect, onStartTrip, onClose }: Props) {
  const rows = rankRoutes(pair, cells, band)
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Walking routes · {BAND_INFO[band].label}</p>
          <p className="text-sm font-semibold">{pair.label}</p>
        </div>
        <button onClick={onClose} className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close routes">
          <X size={16} />
        </button>
      </div>

      {rows.map(({ alt, stats, kind, shortest }) => {
        const active = alt.id === selected
        const extraM = alt.distanceM - shortest.alt.distanceM
        const gain = stats.mean - shortest.stats.mean
        return (
          <Fragment key={alt.id}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => onSelect(alt.id)}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(alt.id)}
            className={cn(
              'cursor-pointer rounded-xl border p-3 transition-all duration-200 ease-out',
              active
                ? 'border-brand-500 bg-brand-50/70 ring-1 ring-brand-500 dark:bg-brand-500/10'
                : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600',
            )}
          >
            <div className="flex items-center justify-between">
              <Badge tone={kind.includes('Safest') || kind.includes('safest') ? 'real' : kind === 'Shortest' ? 'brand' : 'neutral'}>
                {kind.toLowerCase().includes('safest') && <ShieldCheck size={12} />}
                {kind}
              </Badge>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: rgb(scoreColor(stats.mean)) }} />
                <span className="text-lg font-bold tabular-nums">{stats.mean}</span>
                <span className="text-[11px] text-zinc-500">avg safety</span>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-4 text-sm text-zinc-700 dark:text-zinc-300">
              <span className="flex items-center gap-1">
                <Footprints size={14} className="text-zinc-400" />
                {km(alt.distanceM)}
              </span>
              <span className="flex items-center gap-1">
                <Timer size={14} className="text-zinc-400" />
                {Math.round(alt.durationS / 60)} min
              </span>
              <span className="text-[12px] text-zinc-500 dark:text-zinc-400">{Math.round(stats.lowShare * 100)}% via low-score blocks</span>
            </div>
            {kind !== 'Shortest' && kind !== 'Shortest & safest' && (
              <p className="mt-1.5 text-[12px] font-medium text-emerald-700 dark:text-emerald-400">
                +{km(extraM)} for {gain >= 0 ? '+' : ''}
                {gain} safety points
              </p>
            )}
          </div>
          {active && (
            <Button size="sm" className="-mt-1 w-full" onClick={() => onStartTrip(alt)}>
              <Play size={14} /> Start trip &amp; share
            </Button>
          )}
          </Fragment>
        )
      })}
      <p className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span className="h-1 w-5 rounded-full bg-orange-600" /> Orange: blocks scoring under {LOW_SCORE} at this hour
      </p>
    </div>
  )
}
