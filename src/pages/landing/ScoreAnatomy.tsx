import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Building2, Lightbulb, MessageSquare, Store, TrainFront } from 'lucide-react'
import type { AppData } from '../../lib/types'
import { Reveal, SpotlightCard } from './effects'
import { projectHexes } from './geometry'

const n = (v: number | undefined) => (v === undefined ? '…' : v.toLocaleString('en-IN'))

/** What goes into a score. Card size follows each part's weight. */
export default function ScoreAnatomy({ data }: { data: AppData | null }) {
  const count = (pred: (k: string) => boolean) => data?.help.features.filter((f) => pred(f.properties.kind)).length
  const parts = [
    {
      key: 'L',
      name: 'Lighting',
      weight: 35,
      icon: Lightbulb,
      body: 'Street lamps mapped in and around the block, and how much of it sits on a main road. A missing lamp record counts as unknown, not dark.',
      fact: `${n(data?.lamps.features.length)} street lamps mapped`,
      span: 'md:col-span-2 md:row-span-2',
    },
    {
      key: 'A',
      name: 'Activity',
      weight: 25,
      icon: Store,
      body: 'Places likely open at that hour, from opening times or typical hours for each kind of place.',
      fact: `${n(data?.places.features.length)} shops and eateries`,
      span: 'md:col-span-2',
    },
    {
      key: 'H',
      name: 'Help nearby',
      weight: 25,
      icon: Building2,
      body: 'Distance to the nearest police station, outpost or hospital.',
      fact: `${n(count((k) => k.startsWith('Police')))} police, ${n(count((k) => k === 'Hospital'))} hospitals`,
      span: '',
    },
    {
      key: 'T',
      name: 'Transit',
      weight: 15,
      icon: TrainFront,
      body: 'Bus stops and metro stations close by.',
      fact: `${n(data?.transit.features.length)} stops and stations`,
      span: '',
    },
  ]

  return (
    <section className="relative mx-auto max-w-6xl px-5 py-32 md:px-6">
      <Reveal>
        <h2 className="max-w-3xl font-display text-[clamp(2.4rem,5.5vw,4.5rem)] leading-[1.02] font-bold tracking-[-0.028em] text-paper">
          Four things you'd notice on the street, added up.
        </h2>
        <p className="mt-5 max-w-xl text-lg text-moon/80">Each block gets a score out of 100 for each part of the night. No guesswork, no labels, just what's there and what's missing.</p>
      </Reveal>

      <div className="mt-14 grid gap-4 md:auto-rows-[minmax(190px,auto)] md:grid-cols-4">
        {parts.map((p, i) => (
          <Reveal key={p.key} delay={i * 0.08} className={p.span}>
            <SpotlightCard className="h-full p-7">
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-sodium/15 text-sodium">
                    <p.icon size={20} />
                  </span>
                  <span className="font-display text-5xl font-bold tracking-tight text-paper tabular-nums md:text-6xl">
                    {p.weight}
                    <span className="text-2xl text-moon/50">%</span>
                  </span>
                </div>
                <h3 className="mt-6 font-display text-2xl font-semibold text-paper">{p.name}</h3>
                <p className="mt-2 max-w-md text-[15px] leading-relaxed text-moon/75">{p.body}</p>
                {p.key === 'L' && <LampMap data={data} />}
                <div className="mt-auto pt-6">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-sodium to-[#ffd892]"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(p.weight / 35) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.2 + i * 0.08 }}
                    />
                  </div>
                  <p className="mt-3 text-sm text-moon/60">{p.fact}</p>
                </div>
              </div>
            </SpotlightCard>
          </Reveal>
        ))}
        <Reveal delay={0.3} className="md:col-span-4">
          <SpotlightCard className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-400/15 text-violet-300">
                <MessageSquare size={20} />
              </span>
              <p className="flex-1 text-[15px] text-moon/80">
                <span className="font-semibold text-paper">Community reports</span> nudge a block's score by at most 10 points either way. In this prototype the reports are{' '}
                <span className="rounded-full bg-violet-400/15 px-2 py-0.5 text-sm font-medium text-violet-300">simulated demo data</span>.
              </p>
            </div>
          </SpotlightCard>
        </Reveal>
      </div>
    </section>
  )
}

/** Every mapped street lamp in the pilot area, as glowing dots that light up as you scroll in. */
function LampMap({ data }: { data: AppData | null }) {
  const geo = useMemo(() => (data ? projectHexes(data.cells, 420) : null), [data])
  if (!geo || !data) return null
  const lamps = data.lamps.features.map((f) => geo.project(f.geometry.coordinates[0], f.geometry.coordinates[1]))
  return (
    <svg viewBox={`-10 -10 ${geo.width + 20} ${geo.height + 20}`} className="mx-auto mt-6 w-full max-w-[320px]" role="img" aria-label="Street lamps mapped in the pilot area">
      {geo.shapes.map((s) => (
        <path key={s.cell.h3} d={s.d} fill="none" stroke="#c7ceff" strokeOpacity={0.08} />
      ))}
      {lamps.map(([x, y], i) => (
        <motion.circle
          key={i}
          cx={x}
          cy={y}
          r={2.6}
          fill="#ffb547"
          style={{ filter: 'drop-shadow(0 0 4px #ffb547)' }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.3 + (i % 40) * 0.025 }}
        />
      ))}
    </svg>
  )
}
