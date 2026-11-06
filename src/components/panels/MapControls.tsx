import { useState } from 'react'
import { Building2, Info, Layers, Lightbulb, MessageSquareWarning, Moon, Store, Sun, TrainFront, X } from 'lucide-react'
import type { LayerKey } from '../map/SafetyMap'
import { cn } from '../ui'

const LAYERS: { key: LayerKey; label: string; icon: typeof Lightbulb; color: string }[] = [
  { key: 'lamps', label: 'Street lamps', icon: Lightbulb, color: 'bg-yellow-400' },
  { key: 'places', label: 'Open places', icon: Store, color: 'bg-teal-600' },
  { key: 'transit', label: 'Transit', icon: TrainFront, color: 'bg-blue-600' },
  { key: 'help', label: 'Police / Hospitals', icon: Building2, color: 'bg-brand-700' },
  { key: 'reports', label: 'Community reports', icon: MessageSquareWarning, color: 'bg-violet-500' },
]

const iconBtn =
  'glass grid h-10 w-10 cursor-pointer place-items-center text-zinc-700 transition-colors hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white'

interface Props {
  layers: Set<LayerKey>
  onToggle: (k: LayerKey) => void
  dark: boolean
  onDark: () => void
}

export default function MapControls({ layers, onToggle, dark, onDark }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button className={cn(iconBtn, open && 'text-brand-600 dark:text-brand-500')} onClick={() => setOpen((o) => !o)} aria-label="Map layers" aria-expanded={open}>
          {open ? <X size={18} /> : <Layers size={18} />}
        </button>
        <button className={iconBtn} onClick={onDark} aria-label={dark ? 'Light map' : 'Dark map'}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <a className={iconBtn} href="#/about" aria-label="About the data">
          <Info size={18} />
        </a>
      </div>
      {open && (
        <div className="glass w-56 p-2">
          <p className="px-2 pt-1 pb-2 text-[11px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Layers</p>
          {LAYERS.map(({ key, label, icon: Icon, color }) => {
            const on = layers.has(key)
            return (
              <button
                key={key}
                onClick={() => onToggle(key)}
                role="switch"
                aria-checked={on}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <span className={cn('grid h-7 w-7 place-items-center rounded-md text-white', on ? color : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400')}>
                  <Icon size={14} />
                </span>
                <span className="flex-1">{label}</span>
                <span className={cn('h-4 w-7 rounded-full p-0.5 transition-colors', on ? 'bg-brand-600' : 'bg-zinc-300 dark:bg-zinc-600')}>
                  <span className={cn('block h-3 w-3 rounded-full bg-white transition-transform duration-150', on && 'translate-x-3')} />
                </span>
              </button>
            )
          })}
          {layers.has('reports') && <p className="px-2 pt-2 text-[11px] text-violet-700 dark:text-violet-300">Simulated community reports: demo data</p>}
        </div>
      )}
    </div>
  )
}
