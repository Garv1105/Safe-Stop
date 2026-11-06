import type { ReactNode } from 'react'
import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { ArrowLeft, Building2, Flag, Lightbulb, Store, X } from 'lucide-react'
import { BAND_INFO, CATEGORY_LABEL, DR_CAP, rgb, scoreColor, scoreLabel } from '../../lib/scoring'
import type { Band, Cell, ReportCategory } from '../../lib/types'
import { Badge, Button } from '../ui'

interface Props {
  cell: Cell | undefined
  band: Band
  dark: boolean
  onClose: () => void
  onBack?: () => void
  onReport: () => void
}

export default function CellPanel({ cell, band, dark, onClose, onBack, onReport }: Props) {
  if (!cell)
    return (
      <div className="p-5 text-sm text-zinc-500">
        This block is outside the pilot area.{' '}
        <button className="cursor-pointer text-brand-600 underline" onClick={onClose}>
          Close
        </button>
      </div>
    )

  const score = cell.score[band]
  const bars = [
    { name: 'Lighting', value: cell.parts.L },
    { name: 'Activity', value: cell.parts.A[band] },
    { name: 'Transit', value: cell.parts.T },
    { name: 'Help nearby', value: cell.parts.H },
  ].map((b) => ({ ...b, value: Math.round(b.value * 100) }))
  const counts = cell.reportCounts[band] ?? {}
  const totalReports = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)
  const dR = cell.dR[band]

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1">
          {onBack && (
            <button onClick={onBack} className="-ml-1 grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Back to routes">
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Why this score</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {BAND_INFO[band].label} · {BAND_INFO[band].hours}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-2xl font-bold text-zinc-950 tabular-nums" style={{ background: rgb(scoreColor(score)) }}>
          {Math.round(score)}
        </div>
        <div>
          <p className="text-lg leading-tight font-semibold">{scoreLabel(score)}</p>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
            Base {Math.round(cell.base[band])}
            {dR !== 0 && ` ${dR > 0 ? '+' : '−'} ${Math.abs(dR)} from reports`} · out of 100
          </p>
        </div>
      </div>

      <ul className="space-y-1.5">
        {cell.reasons[band].map((r) => (
          <li key={r} className="flex gap-2 text-sm">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
            {r}
          </li>
        ))}
      </ul>

      <div>
        <p className="mb-1 text-[12px] font-semibold">Score parts (0–100, relative to the pilot area)</p>
        <div className="h-[132px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bars} layout="vertical" margin={{ left: 0, right: 32, top: 4, bottom: 4 }} barCategoryGap={6}>
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis type="category" dataKey="name" width={92} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: dark ? '#a1a1aa' : '#52525b' }} />
              <Bar dataKey="value" fill="#6366f1" minPointSize={2} radius={[0, 4, 4, 0]} background={{ fill: dark ? '#27272a' : '#f4f4f5', radius: 4 }} isAnimationActive={false}>
                <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: dark ? '#e4e4e7' : '#18181b', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Weights: lighting 35%, activity 25%, help 25%, transit 15%.</p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Fact icon={<Lightbulb size={14} />} value={cell.facts.lamps} label="lamps mapped" />
        <Fact icon={<Store size={14} />} value={cell.facts.open[band]} label="places open" />
        <Fact icon={<Building2 size={14} />} value={`${cell.facts.policeKm.toFixed(1)} km`} label="to police" />
      </div>
      <p className="-mt-2 truncate text-[11px] text-zinc-500 dark:text-zinc-400" title={cell.facts.policeName}>
        Nearest police: {cell.facts.policeName}
      </p>

      <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-500/20 dark:bg-violet-500/5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[12px] font-semibold">Community reports · {BAND_INFO[band].label.toLowerCase()}</p>
          <Badge tone="synthetic">Simulated data</Badge>
        </div>
        {totalReports === 0 ? (
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">No reports for this block at this hour.</p>
        ) : (
          <ul className="space-y-1 text-[13px]">
            {(Object.entries(counts) as [ReportCategory, number][]).map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span>{CATEGORY_LABEL[k]}</span>
                <span className="font-medium tabular-nums">{v}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">Reports shift the score by at most ±{DR_CAP} points.</p>
      </div>

      <Button variant="secondary" onClick={onReport}>
        <Flag size={15} /> Report about this block
      </Button>
    </div>
  )
}

function Fact({ icon, value, label }: { icon: ReactNode; value: string | number; label: string }) {
  return (
    <div className="rounded-lg bg-zinc-100 px-2 py-2 dark:bg-zinc-800/80">
      <div className="flex items-center justify-center gap-1 text-[15px] font-semibold tabular-nums">
        <span className="text-zinc-400">{icon}</span>
        {value}
      </div>
      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</div>
    </div>
  )
}
