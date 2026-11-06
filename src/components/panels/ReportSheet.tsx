import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CircleSlash, Construction, LampDesk, ShieldAlert, Smile, X } from 'lucide-react'
import { CATEGORY_LABEL } from '../../lib/scoring'
import type { Band, ReportCategory } from '../../lib/types'
import { BandControl } from './TopBar'
import { Badge, Button, cn } from '../ui'

const CHIPS: { key: ReportCategory; icon: typeof Smile }[] = [
  { key: 'poor_lighting', icon: LampDesk },
  { key: 'deserted', icon: CircleSlash },
  { key: 'broken_footpath', icon: Construction },
  { key: 'harassment_reported', icon: ShieldAlert },
  { key: 'felt_safe', icon: Smile },
]

interface Props {
  open: boolean
  band: Band
  targetLabel: string
  onClose: () => void
  onSubmit: (cat: ReportCategory, band: Band) => void
}

export default function ReportSheet({ open, band, targetLabel, onClose, onSubmit }: Props) {
  const [cat, setCat] = useState<ReportCategory | null>(null)
  const [when, setWhen] = useState<Band>(band)
  const [lastBand, setLastBand] = useState(band)
  if (band !== lastBand) {
    // keep the time band auto-filled from the map's current band
    setLastBand(band)
    setWhen(band)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-zinc-950/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Report about this area"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-lg rounded-t-2xl border border-zinc-200 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold">What did you notice?</h2>
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400">{targetLabel}</p>
              </div>
              <button onClick={onClose} className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {CHIPS.map(({ key, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setCat(key)}
                  aria-pressed={cat === key}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors duration-150',
                    cat === key
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800',
                  )}
                >
                  <Icon size={15} />
                  {CATEGORY_LABEL[key]}
                </button>
              ))}
            </div>

            <p className="mt-5 mb-2 text-[12px] font-semibold">When</p>
            <BandControl band={when} onChange={setWhen} />

            <Button
              size="lg"
              className="mt-5 w-full"
              disabled={!cat}
              onClick={() => {
                if (!cat) return
                onSubmit(cat, when)
                setCat(null)
              }}
            >
              Submit anonymously
            </Button>
            <p className="mt-3 flex items-center justify-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              <Badge tone="synthetic">Demo</Badge> Stays on this device. Nothing is sent anywhere.
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
