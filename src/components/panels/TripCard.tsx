import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Check, CheckCircle2, Copy, Link2, Square, UserRound } from 'lucide-react'
import type { TripPhase } from '../../lib/useTrip'
import type { RouteAlt, RoutePair } from '../../lib/types'
import { Badge, Button } from '../ui'

const CONTACTS = ['Contact 1', 'Contact 2']
const FAKE_LINK = 'safestop.app/t/K7Q2-DSCE'

interface Props {
  pair: RoutePair
  alt: RouteAlt
  progress: number
  phase: TripPhase
  onOk: () => void
  onNotify: () => void
  onEnd: () => void
}

export default function TripCard({ pair, alt, progress, phase, onOk, onNotify, onEnd }: Props) {
  const [copied, setCopied] = useState(false)
  const alertRef = useRef<HTMLDivElement>(null)
  // on phones the sheet is short, so bring the stop alert into view
  useEffect(() => {
    if (phase === 'alert') setTimeout(() => alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
  }, [phase])
  const remainingMin = Math.max(0, Math.round((alt.durationS * (1 - progress)) / 60))
  const eta = new Date(Date.now() + alt.durationS * (1 - progress) * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            <span className="relative flex h-2 w-2">
              {phase !== 'arrived' && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {phase === 'arrived' ? 'Trip complete' : 'Sharing live trip'}
          </p>
          <p className="text-sm font-semibold">To {pair.dest.name}</p>
        </div>
        <Badge tone="synthetic">Simulated</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800/80">
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Arrive</p>
          <p className="text-lg font-bold tabular-nums">{phase === 'arrived' ? 'Now' : eta}</p>
        </div>
        <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800/80">
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Remaining</p>
          <p className="text-lg font-bold tabular-nums">{remainingMin} min</p>
        </div>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 p-2 pl-3 dark:border-zinc-700">
        <Link2 size={15} className="shrink-0 text-zinc-400" />
        <span className="flex-1 truncate font-mono text-[13px]">{FAKE_LINK}</span>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            navigator.clipboard?.writeText(`https://${FAKE_LINK}`).catch(() => {})
            setCopied(true)
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <div>
        <p className="mb-2 text-[12px] font-semibold">Trusted contacts</p>
        <ul className="space-y-1.5">
          {CONTACTS.map((c) => (
            <li key={c} className="flex items-center gap-3 text-sm">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100">
                <UserRound size={15} />
              </span>
              <span className="flex-1">{c}</span>
              <span className="text-[12px] text-emerald-700 dark:text-emerald-400">{phase === 'arrived' ? 'Told you arrived' : 'Watching'}</span>
            </li>
          ))}
        </ul>
      </div>

      <AnimatePresence>
        {phase === 'alert' && (
          <motion.div
            ref={alertRef}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="alertdialog"
            aria-label="Stopped for 3 minutes"
            className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
              <AlertTriangle size={16} /> Stopped for 3 min. Notify contacts?
            </p>
            <p className="mt-1 text-[12px] text-amber-800/80 dark:text-amber-200/70">Demo: time is sped up.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" onClick={onOk}>
                I'm OK
              </Button>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={onNotify}>
                Notify contacts
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === 'arrived' ? (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 size={16} /> Arrived. Contacts told you're there.
        </div>
      ) : null}

      <Button variant={phase === 'arrived' ? 'primary' : 'secondary'} onClick={onEnd}>
        {phase === 'arrived' ? (
          'Done'
        ) : (
          <>
            <Square size={14} /> End trip
          </>
        )}
      </Button>
    </div>
  )
}
