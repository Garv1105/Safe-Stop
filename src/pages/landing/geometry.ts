import { useEffect, useState } from 'react'
import { cellToBoundary, cellToLatLng } from 'h3-js'
import { loadData } from '../../lib/data'
import { BANDS } from '../../lib/scoring'
import type { AppData, Cell } from '../../lib/types'

export function useLandingData() {
  const [data, setData] = useState<AppData | null>(null)
  useEffect(() => {
    loadData().then(setData, () => {})
  }, [])
  return data
}

const K = Math.cos((12.9 * Math.PI) / 180) // equirectangular x-scale at Bengaluru's latitude

export interface HexShape {
  cell: Cell
  d: string
  cx: number
  cy: number
}

/** Projects H3 cells (and any lng/lat) into an SVG box fitted to `bounds` (or to all cells). */
export function projectHexes(cells: Cell[], width: number, bounds?: [number, number, number, number]) {
  const boundaries = cells.map((c) => cellToBoundary(c.h3))
  let [minX, minY, maxX, maxY] = bounds ?? [Infinity, Infinity, -Infinity, -Infinity]
  if (!bounds)
    for (const ring of boundaries)
      for (const [lat, lng] of ring) {
        minX = Math.min(minX, lng)
        maxX = Math.max(maxX, lng)
        minY = Math.min(minY, lat)
        maxY = Math.max(maxY, lat)
      }
  const scale = width / ((maxX - minX) * K)
  const height = (maxY - minY) * scale
  const project = (lng: number, lat: number): [number, number] => [(lng - minX) * K * scale, (maxY - lat) * scale]
  const shapes: HexShape[] = cells.map((cell, i) => {
    const pts = boundaries[i].map(([lat, lng]) => project(lng, lat))
    const [clat, clng] = cellToLatLng(cell.h3)
    const [cx, cy] = project(clng, clat)
    return { cell, cx, cy, d: 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z' }
  })
  return { shapes, project, width, height }
}

/** Score at a continuous time t in [0, 2]: 0 = evening, 1 = late, 2 = night. */
export function scoreAt(cell: Cell, t: number) {
  const i = Math.min(1, Math.floor(t))
  const f = t - i
  return cell.score[BANDS[i]] * (1 - f) + cell.score[BANDS[i + 1]] * f
}

export const pathFrom = (coords: [number, number][], project: (lng: number, lat: number) => [number, number]) =>
  'M' + coords.map(([lng, lat]) => project(lng, lat).map((v) => v.toFixed(1)).join(',')).join('L')
