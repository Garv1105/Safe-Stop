import { GOOD_SCORE, LOW_SCORE, rgb, scoreColor } from '../../lib/scoring'

const stops = Array.from({ length: 12 }, (_, i) => rgb(scoreColor(10 + i * 7.5)))

export default function Legend({ compact }: { compact?: boolean }) {
  return (
    <div className="glass w-[220px] p-3">
      <p className="mb-2 text-[12px] font-semibold">Night-walk score</p>
      <div className="h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${stops.join(',')})` }} />
      <div className="mt-1.5 flex justify-between text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400">
        <span>0</span>
        <span>{LOW_SCORE}</span>
        <span>{GOOD_SCORE}</span>
        <span>100</span>
      </div>
      {!compact && (
        <ul className="mt-2 space-y-1 text-[11px] text-zinc-600 dark:text-zinc-300">
          <li>
            <b className="font-semibold">{GOOD_SCORE}+</b> Good
          </li>
          <li>
            <b className="font-semibold">
              {LOW_SCORE}–{GOOD_SCORE - 1}
            </b>{' '}
            Moderate
          </li>
          <li>
            <b className="font-semibold">&lt;{LOW_SCORE}</b> Low lighting &amp; activity
          </li>
        </ul>
      )}
      <p className="mt-2 border-t border-zinc-200 pt-2 text-[10.5px] leading-snug text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        OSM + police data. Community reports are simulated demo data.
      </p>
    </div>
  )
}
