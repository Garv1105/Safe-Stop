import type { Band, Cell, ReportCategory, ReportCounts, RouteAlt } from './types'

export const BANDS: Band[] = ['evening', 'late', 'night']

export const BAND_INFO: Record<Band, { label: string; hours: string; openUntil: number }> = {
  evening: { label: 'Evening', hours: '7–9 pm', openUntil: 20.5 },
  late: { label: 'Late', hours: '9 pm–12 am', openUntil: 23 },
  night: { label: 'Night', hours: '12–5 am', openUntil: 26 },
}

export const WEIGHTS = { L: 0.35, A: 0.25, T: 0.15, H: 0.25 }
export const LOW_SCORE = 35
export const GOOD_SCORE = 55

/** Same rule as scripts/make_synthetic_reports.py: weighted counts, capped at ±10. */
export const DR_WEIGHTS: Record<ReportCategory, number> = {
  felt_safe: 2,
  poor_lighting: -2,
  deserted: -2,
  harassment_reported: -3,
  broken_footpath: -1,
}
export const DR_CAP = 10

export const CATEGORY_LABEL: Record<ReportCategory, string> = {
  poor_lighting: 'Poor lighting',
  deserted: 'Deserted',
  felt_safe: 'Felt safe',
  harassment_reported: 'Harassment reported',
  broken_footpath: 'Broken footpath',
}

export function deltaR(counts: ReportCounts): number {
  let raw = 0
  for (const [k, v] of Object.entries(counts)) raw += DR_WEIGHTS[k as ReportCategory] * (v ?? 0)
  return Math.max(-DR_CAP, Math.min(DR_CAP, raw))
}

const clamp100 = (v: number) => Math.round(Math.max(0, Math.min(100, v)) * 10) / 10

/** Returns a new cell with one more report in `band`, and its score recomputed. */
export function addReport(cell: Cell, band: Band, cat: ReportCategory): Cell {
  const counts = { ...cell.reportCounts[band], [cat]: (cell.reportCounts[band][cat] ?? 0) + 1 }
  const dR = deltaR(counts)
  return {
    ...cell,
    reportCounts: { ...cell.reportCounts, [band]: counts },
    dR: { ...cell.dR, [band]: dR },
    score: { ...cell.score, [band]: clamp100(cell.base[band] + dR) },
  }
}

export function scoreLabel(s: number): string {
  if (s >= GOOD_SCORE) return 'Good'
  if (s >= LOW_SCORE) return 'Moderate'
  return 'Low lighting & activity'
}

// green -> amber -> warm coral (no pure red)
const STOPS: [number, [number, number, number]][] = [
  [15, [214, 92, 74]],
  [35, [238, 146, 58]],
  [48, [242, 196, 72]],
  [62, [132, 196, 96]],
  [85, [26, 152, 108]],
]

export function scoreColor(s: number): [number, number, number] {
  if (s <= STOPS[0][0]) return STOPS[0][1]
  for (let i = 1; i < STOPS.length; i++) {
    const [s1, c1] = STOPS[i]
    if (s <= s1) {
      const [s0, c0] = STOPS[i - 1]
      const t = (s - s0) / (s1 - s0)
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * t)) as [number, number, number]
    }
  }
  return STOPS[STOPS.length - 1][1]
}

export const rgb = (c: number[]) => `rgb(${c[0]} ${c[1]} ${c[2]})`

/** Route safety computed live from current cell scores (so new reports move it). */
export function routeStats(alt: RouteAlt, cells: Map<string, Cell>, band: Band) {
  const scores = alt.samples.map((s) => cells.get(s[2])?.score[band]).filter((v): v is number => v !== undefined)
  if (!scores.length) return { mean: 0, min: 0, lowShare: 0 }
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  return {
    mean: Math.round(mean),
    min: Math.round(Math.min(...scores)),
    lowShare: scores.filter((v) => v < LOW_SCORE).length / scores.length,
  }
}

/** Runs of consecutive route samples that pass through low-score cells. */
export function lowSegments(alt: RouteAlt, cells: Map<string, Cell>, band: Band): [number, number][][] {
  const runs: [number, number][][] = []
  let cur: [number, number][] = []
  for (const [lng, lat, h] of alt.samples) {
    const s = cells.get(h)?.score[band]
    if (s !== undefined && s < LOW_SCORE) cur.push([lng, lat])
    else {
      if (cur.length > 1) runs.push(cur)
      cur = []
    }
  }
  if (cur.length > 1) runs.push(cur)
  return runs
}
