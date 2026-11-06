import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Flag, MousePointerClick, RefreshCw } from 'lucide-react'
import { latLngToCell } from 'h3-js'
import SafetyMap, { INITIAL_VIEW, type LayerKey } from '../components/map/SafetyMap'
import CellPanel from '../components/panels/CellPanel'
import Legend from '../components/panels/Legend'
import MapControls from '../components/panels/MapControls'
import ReportSheet from '../components/panels/ReportSheet'
import RoutePanel from '../components/panels/RoutePanel'
import TopBar from '../components/panels/TopBar'
import TripCard from '../components/panels/TripCard'
import { Button, Spinner, Toast, type ToastMsg } from '../components/ui'
import { useAppData } from '../lib/data'
import { addReport, BAND_INFO, CATEGORY_LABEL } from '../lib/scoring'
import type { AppData, Band, Cell, ReportCategory, RouteAlt } from '../lib/types'
import { useTrip } from '../lib/useTrip'

function useIsMobile() {
  const q = '(max-width: 639px)'
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return m
}

export default function Explorer() {
  const { data, error, retry } = useAppData()
  if (error)
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <p className="font-semibold">Couldn't load the map data</p>
          <p className="mt-1 text-sm text-zinc-500">{error}</p>
          <Button className="mt-4" onClick={retry}>
            <RefreshCw size={15} /> Try again
          </Button>
        </div>
      </div>
    )
  if (!data)
    return (
      <div className="grid h-full place-items-center bg-zinc-950">
        <Spinner label="Loading street scores…" />
      </div>
    )
  return <ExplorerView data={data} />
}

function ExplorerView({ data }: { data: AppData }) {
  const mobile = useIsMobile()
  const [dark, setDark] = useState(true)
  const [band, setBand] = useState<Band>('evening')
  const [cells, setCells] = useState<Cell[]>(data.cells)
  const cellMap = useMemo(() => new Map(cells.map((c) => [c.h3, c])), [cells])
  const [layers, setLayers] = useState<Set<LayerKey>>(new Set(['streets', 'hexes']))
  const [selectedCell, setSelectedCell] = useState<string | null>(null)
  const [pairId, setPairId] = useState(data.routes.pairs[0].id)
  const [routesShown, setRoutesShown] = useState(false)
  const [selectedAlt, setSelectedAlt] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [tripAlt, setTripAlt] = useState<RouteAlt | null>(null)
  const [toast, setToast] = useState<ToastMsg>(null)
  const [center, setCenter] = useState<[number, number]>([INITIAL_VIEW.longitude, INITIAL_VIEW.latitude])
  const trip = useTrip(tripAlt)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    return () => document.documentElement.classList.remove('dark')
  }, [dark])

  const pair = data.routes.pairs.find((p) => p.id === pairId)!
  const say = (text: ReactNode) => setToast({ id: Date.now(), text })
  const clearToast = useCallback(() => setToast(null), [])

  const showRoutes = (id = pairId) => {
    const p = data.routes.pairs.find((x) => x.id === id)!
    setPairId(id)
    setRoutesShown(true)
    setSelectedCell(null)
    setTripAlt(null)
    // start on the shortest so the presenter can compare and pick the safest
    setSelectedAlt(p.alternatives.reduce((a, b) => (b.distanceM < a.distanceM ? b : a)).id)
  }

  // Report target: selected block, else the block at the map centre.
  const reportCell = selectedCell ?? latLngToCell(center[1], center[0], 9)
  const submitReport = (cat: ReportCategory, when: Band) => {
    const cell = cellMap.get(reportCell)
    setReportOpen(false)
    if (!cell) {
      say('That spot is outside the pilot area. Move the map over the coloured blocks.')
      return
    }
    const updated = addReport(cell, when, cat)
    setCells((cs) => cs.map((c) => (c.h3 === cell.h3 ? updated : c)))
    setSelectedCell(cell.h3)
    const before = Math.round(cell.score[when])
    const after = Math.round(updated.score[when])
    say(
      <span>
        <b>Report added</b> ({CATEGORY_LABEL[cat].toLowerCase()}, {BAND_INFO[when].label.toLowerCase()}).{' '}
        {before === after ? `Score stays ${after} (report effect is capped at ±10).` : `Block score ${before} → ${after}.`}
        <span className="opacity-60"> Simulated, not sent.</span>
      </span>,
    )
  }

  const panel = tripAlt ? (
    <TripCard
      pair={pair}
      alt={tripAlt}
      progress={trip.progress}
      phase={trip.phase}
      onOk={trip.resume}
      onNotify={() => {
        say('Contact 1 and Contact 2 notified (simulated).')
        trip.resume()
      }}
      onEnd={() => setTripAlt(null)}
    />
  ) : selectedCell ? (
    <CellPanel
      cell={cellMap.get(selectedCell)}
      band={band}
      dark={dark}
      onClose={() => setSelectedCell(null)}
      onBack={routesShown ? () => setSelectedCell(null) : undefined}
      onReport={() => setReportOpen(true)}
    />
  ) : routesShown ? (
    <RoutePanel
      pair={pair}
      cells={cellMap}
      band={band}
      selected={selectedAlt}
      onSelect={setSelectedAlt}
      onStartTrip={(alt) => {
        setTripAlt(alt)
        say('Trip started. Live link ready to share (simulated).')
      }}
      onClose={() => {
        setRoutesShown(false)
        setSelectedAlt(null)
      }}
    />
  ) : null

  const fitPadding = mobile ? { top: 230, bottom: Math.round(window.innerHeight * 0.5), left: 30, right: 30 } : { top: 60, bottom: 60, left: 420, right: 440 }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <SafetyMap
        data={data}
        cells={cells}
        cellMap={cellMap}
        band={band}
        dark={dark}
        layers={layers}
        selectedCell={selectedCell}
        onSelectCell={setSelectedCell}
        pair={routesShown ? pair : null}
        selectedAlt={selectedAlt}
        onSelectAlt={setSelectedAlt}
        walker={tripAlt ? trip.position : null}
        onCenterChange={setCenter}
        fitPadding={fitPadding}
      />

      {/* top-left: search + time */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="pointer-events-auto w-full sm:w-auto">
          <TopBar
            pairs={data.routes.pairs}
            pairId={pairId}
            onPairChange={(id) => (routesShown ? showRoutes(id) : setPairId(id))}
            routesShown={routesShown}
            onShowRoutes={() => showRoutes()}
            band={band}
            onBand={setBand}
          />
        </div>
        {!mobile && (
          <div className="pointer-events-auto relative z-10">
            <MapControls layers={layers} onToggle={(k) => setLayers(toggle(layers, k))} dark={dark} onDark={() => setDark((d) => !d)} />
          </div>
        )}
      </div>

      {mobile && (
        <div className="absolute top-[268px] right-3 z-10">
          <MapControls layers={layers} onToggle={(k) => setLayers(toggle(layers, k))} dark={dark} onDark={() => setDark((d) => !d)} />
        </div>
      )}

      {/* right panel (desktop) / bottom sheet (mobile) */}
      <AnimatePresence mode="wait">
        {panel ? (
          <motion.aside
            key={tripAlt ? 'trip' : selectedCell ? 'cell' : 'routes'}
            initial={mobile ? { y: 40, opacity: 0 } : { x: 16, opacity: 0 }}
            animate={{ x: 0, y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="glass absolute inset-x-0 bottom-0 z-20 max-h-[50vh] overflow-y-auto rounded-b-none pb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:top-[72px] sm:right-4 sm:bottom-auto sm:max-h-[calc(100%-88px)] sm:w-[380px] sm:rounded-b-xl"
          >
            {panel}
          </motion.aside>
        ) : (
          !mobile && (
            <motion.div
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="glass absolute top-[72px] right-4 flex w-[260px] items-center gap-3 p-3 text-[13px] text-zinc-600 dark:text-zinc-300"
            >
              <MousePointerClick size={18} className="shrink-0 text-brand-500" />
              Click any block to see why it scored that way.
            </motion.div>
          )
        )}
      </AnimatePresence>

      {/* bottom-left legend */}
      {(!mobile || !panel) && (
        <div className="absolute bottom-6 left-3 sm:left-4">
          <Legend compact={mobile} />
        </div>
      )}

      {/* report button */}
      {!tripAlt && (!mobile || !panel) && (
        <div className="absolute right-3 bottom-6 sm:right-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2">
          <Button size="lg" className="rounded-full shadow-lg" onClick={() => setReportOpen(true)}>
            <Flag size={16} /> Report
          </Button>
        </div>
      )}

      <ReportSheet
        open={reportOpen}
        band={band}
        targetLabel={
          selectedCell ? `About the selected block (score ${Math.round(cellMap.get(selectedCell)?.score[band] ?? 0)})` : 'About the block at the centre of the map'
        }
        onClose={() => setReportOpen(false)}
        onSubmit={submitReport}
      />
      <Toast toast={toast} onDone={clearToast} />
    </div>
  )
}

function toggle<T>(set: Set<T>, k: T) {
  const next = new Set(set)
  if (next.has(k)) next.delete(k)
  else next.add(k)
  return next
}
