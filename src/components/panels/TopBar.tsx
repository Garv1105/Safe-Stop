import { ArrowUpDown, Circle, MapPin, Moon, Navigation, Sunset, MoonStar } from 'lucide-react'
import { BAND_INFO, BANDS } from '../../lib/scoring'
import type { Band, RoutePair } from '../../lib/types'
import { cn } from '../ui'

const BAND_ICON = { evening: Sunset, late: Moon, night: MoonStar }

export function BandControl({ band, onChange }: { band: Band; onChange: (b: Band) => void }) {
  return (
    <div role="radiogroup" aria-label="Time of night" className="grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800/80">
      {BANDS.map((b) => {
        const Icon = BAND_ICON[b]
        const active = b === band
        return (
          <button
            key={b}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(b)}
            className={cn(
              'flex cursor-pointer flex-col items-center rounded-md px-2 py-1.5 transition-all duration-200 ease-out',
              active ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
            )}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-semibold">
              <Icon size={14} />
              {BAND_INFO[b].label}
            </span>
            <span className="text-[11px] opacity-70">{BAND_INFO[b].hours}</span>
          </button>
        )
      })}
    </div>
  )
}

interface Props {
  pairs: RoutePair[]
  pairId: string
  onPairChange: (id: string) => void
  routesShown: boolean
  onShowRoutes: () => void
  band: Band
  onBand: (b: Band) => void
}

export default function TopBar(p: Props) {
  const pair = p.pairs.find((x) => x.id === p.pairId)!
  return (
    <div className="glass w-full p-3 sm:w-[380px]">
      <div className="mb-3 flex items-center justify-between">
        <a href="#/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <img src="/favicon.svg" alt="" className="h-6 w-6" />
          SafeStop
        </a>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Pilot · Kumaraswamy Layout</span>
      </div>

      <div className="flex items-stretch gap-2">
        <div className="flex flex-col items-center justify-center gap-1 py-2 text-zinc-400">
          <Circle size={10} strokeWidth={3} />
          <span className="h-4 w-px bg-zinc-300 dark:bg-zinc-600" />
          <MapPin size={12} className="text-brand-600 dark:text-brand-500" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="truncate rounded-md bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-800" title="Origin fixed for the demo">
            {pair.origin.name}
          </div>
          <label className="sr-only" htmlFor="dest">
            Destination
          </label>
          <select
            id="dest"
            value={p.pairId}
            onChange={(e) => p.onPairChange(e.target.value)}
            className="w-full cursor-pointer truncate rounded-md bg-zinc-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-800"
          >
            {p.pairs.map((x) => (
              <option key={x.id} value={x.id}>
                {x.dest.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col justify-between">
          <span className="grid h-9 w-9 place-items-center text-zinc-300 dark:text-zinc-600" aria-hidden>
            <ArrowUpDown size={16} />
          </span>
          <button
            onClick={p.onShowRoutes}
            aria-label="Show walking routes"
            className={cn(
              'grid h-9 w-9 cursor-pointer place-items-center rounded-lg transition-colors',
              p.routesShown ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100' : 'bg-brand-600 text-white hover:bg-brand-700',
            )}
          >
            <Navigation size={16} />
          </button>
        </div>
      </div>

      <div className="mt-3">
        <BandControl band={p.band} onChange={p.onBand} />
      </div>
    </div>
  )
}
