import { useEffect, useState } from 'react'
import type { AppData } from './types'

const FILES = ['cells', 'routes', 'reports', 'lamps', 'places', 'transit', 'help'] as const
const URLS: Record<(typeof FILES)[number], string> = {
  cells: 'cells.json',
  routes: 'routes.json',
  reports: 'reports.json',
  lamps: 'lamps.geojson',
  places: 'places.geojson',
  transit: 'transit.geojson',
  help: 'help.geojson',
}

let cache: Promise<AppData> | null = null

async function getJson(file: string) {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${file}`)
  if (!res.ok) throw new Error(`Could not load ${file} (${res.status})`)
  return res.json()
}

export function loadData(): Promise<AppData> {
  cache ??= Promise.all(FILES.map((f) => getJson(URLS[f]))).then(
    (vals) => Object.fromEntries(FILES.map((f, i) => [f, vals[i]])) as unknown as AppData,
  )
  cache.catch(() => (cache = null)) // allow retry after a failure
  return cache
}

export function useAppData() {
  const [state, setState] = useState<{ data?: AppData; error?: string }>({})
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    loadData()
      .then((data) => live && setState({ data }))
      .catch((e: Error) => live && setState({ error: e.message }))
    return () => {
      live = false
    }
  }, [attempt])
  return { ...state, retry: () => (setState({}), setAttempt((a) => a + 1)) }
}
