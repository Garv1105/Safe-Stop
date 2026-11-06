import { useEffect, useMemo, useRef, useState } from 'react'
import { Map, useControl, type MapRef } from 'react-map-gl/maplibre'
import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox'
import { H3HexagonLayer } from '@deck.gl/geo-layers'
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import type { Layer, PickingInfo } from '@deck.gl/core'
import { cellToLatLng } from 'h3-js'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { polishStyle, styleChain } from '../../lib/mapStyle'
import { BAND_INFO, lowSegments, scoreColor, scoreLabel } from '../../lib/scoring'
import type { AppData, Band, Cell, RoutePair, StreetPiece } from '../../lib/types'

export type LayerKey = 'streets' | 'hexes' | 'lamps' | 'places' | 'transit' | 'help' | 'reports'

export const INITIAL_VIEW = { longitude: 77.5655, latitude: 12.9035, zoom: 13.4 }

function DeckOverlay(props: MapboxOverlayProps) {
  const overlay = useControl(() => new MapboxOverlay(props))
  overlay.setProps(props)
  return null
}

// stable pseudo-random jitter so report dots don't stack on the cell centre
const jitter = (id: string, k: number) => {
  let h = k * 7919
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0
  return ((h % 1000) / 1000) * 0.0012
}

interface Props {
  data: AppData
  cells: Cell[]
  cellMap: globalThis.Map<string, Cell>
  band: Band
  dark: boolean
  layers: Set<LayerKey>
  selectedCell: string | null
  onSelectCell: (h3: string | null) => void
  pair: RoutePair | null
  selectedAlt: string | null
  onSelectAlt: (id: string) => void
  walker: [number, number] | null
  onCenterChange: (lngLat: [number, number]) => void
  fitPadding: { top: number; bottom: number; left: number; right: number }
}

export default function SafetyMap(p: Props) {
  const mapRef = useRef<MapRef>(null)
  const darkRef = useRef(p.dark)
  darkRef.current = p.dark
  // index into styleChain: steps down when a style can't be downloaded
  const [styleLevel, setStyleLevel] = useState(0)
  const chain = styleChain(p.dark)
  const lastLevel = chain.length - 1
  const stepDown = () => setStyleLevel((l) => Math.min(l + 1, lastLevel))
  const [loaded, setLoaded] = useState(false)
  // Hexes sit under the base map's roads; coloured streets sit above the roads but under labels.
  const [beforeId, setBeforeId] = useState<string | undefined>()
  const [labelId, setLabelId] = useState<string | undefined>()

  const polished = useRef('')
  const onStyleData = (e: { target: MapLibreMap }) => {
    const style = e.target.getStyle()
    const layers = style?.layers ?? []
    // Recolour as soon as the style arrives (not on 'load', which waits for every tile). Once per style.
    const key = `${style?.name}|${layers.length}|${darkRef.current}`
    if (layers.length && polished.current !== key) {
      polished.current = key
      polishStyle(e.target, darkRef.current)
    }
    const label = layers.find((l) => l.type === 'symbol')?.id
    const road = layers.find((l) => l.type === 'line' && /road|highway|transportation|bridge|tunnel/.test(l.id))
    setBeforeId(road?.id ?? label)
    setLabelId(label)
  }

  // Fall back to a plain background only if the style itself never arrives (offline),
  // not just because tiles are slow.
  useEffect(() => {
    if (loaded || styleLevel === lastLevel) return
    const t = setTimeout(() => {
      if (!mapRef.current?.getMap().getStyle()?.layers?.length) stepDown()
    }, 15000)
    return () => clearTimeout(t)
  }, [loaded, styleLevel, lastLevel]) // eslint-disable-line react-hooks/exhaustive-deps

  // Zoom to the chosen route.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !p.pair) return
    const pts = p.pair.alternatives.flatMap((a) => a.coords)
    const lngs = pts.map((c) => c[0])
    const lats = pts.map((c) => c[1])
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: p.fitPadding, duration: 800 },
    )
  }, [p.pair, loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  const reportPoints = useMemo(
    () =>
      p.data.reports.reports.map((r) => {
        const [lat, lng] = cellToLatLng(r.h3)
        return { ...r, pos: [lng + jitter(r.id, 1) - 0.0006, lat + jitter(r.id, 2) - 0.0006] as [number, number] }
      }),
    [p.data.reports],
  )

  const layers = useMemo(() => {
    const { band, cellMap } = p
    // `beforeId` works at runtime in interleaved mode but isn't in deck's layer prop types
    const under = { beforeId } as object
    const openPlaces = p.data.places.features.filter((f) => f.properties.close >= BAND_INFO[band].openUntil)
    const showStreets = p.layers.has('streets')
    const out: Layer[] = []
    if (p.layers.has('hexes')) {
      // No outlines: blocks blend into one soft surface. Lighter wash when streets carry the colour.
      const alpha = showStreets ? (p.dark ? 0.04 : 0.14) : p.dark ? 0.2 : 0.45
      out.push(
        new H3HexagonLayer<Cell>({
          id: 'hexes',
          data: p.cells,
          getHexagon: (d) => d.h3,
          getFillColor: (d) => [...scoreColor(d.score[band]), 255],
          stroked: false,
          extruded: false,
          opacity: p.pair ? alpha * 0.6 : alpha,
          ...under,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 60],
          updateTriggers: { getFillColor: band },
          transitions: { getFillColor: { duration: 600 } },
        }),
      )
    }
    if (showStreets) {
      const above = { beforeId: labelId } as object
      const color = (d: StreetPiece, a: number) => {
        const s = cellMap.get(d.h)?.score[band]
        return (s === undefined ? [120, 120, 130, a] : [...scoreColor(s), a]) as [number, number, number, number]
      }
      // widths in metres so streets stay fine when zoomed out and get bolder when zoomed in
      const width = (d: StreetPiece) => [20, 8, 4][d.k]
      const dim = p.pair ? 0.45 : 1
      const shared = { data: p.data.streets.ways, getPath: (d: StreetPiece) => d.c, widthUnits: 'meters' as const, widthMaxPixels: 8, capRounded: true, jointRounded: true, ...above }
      // soft glow under main roads at night
      if (p.dark)
        out.push(
          new PathLayer<StreetPiece>({
            ...shared,
            id: 'streets-glow',
            data: p.data.streets.ways.filter((d) => d.k === 0),
            getColor: (d) => color(d, Math.round(12 * dim)),
            getWidth: 90,
            widthMinPixels: 4,
            widthMaxPixels: 26,
            updateTriggers: { getColor: [band, cellMap, dim] },
            transitions: { getColor: { duration: 600 } },
          }),
        )
      out.push(
        new PathLayer<StreetPiece>({
          ...shared,
          id: 'streets',
          getColor: (d) => color(d, Math.round((p.dark ? (d.k === 2 ? 55 : 95) : d.k === 2 ? 150 : 215) * dim)),
          getWidth: width,
          widthMinPixels: 0.8,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 120],
          updateTriggers: { getColor: [band, cellMap, dim] },
          transitions: { getColor: { duration: 600 } },
        }),
      )
    }
    if (p.selectedCell) {
      out.push(
        new H3HexagonLayer({
          id: 'hex-selected',
          data: [p.selectedCell],
          getHexagon: (d: string) => d,
          filled: false,
          stroked: true,
          extruded: false,
          getLineColor: p.dark ? [255, 255, 255, 230] : [30, 27, 75, 255],
          lineWidthMinPixels: 2.5,
          ...({ beforeId: labelId } as object),
        }),
      )
    }
    const dot = <D,>(id: string, data: D[], color: number[], radius: number, getPos: (d: D) => [number, number], extra = {}) =>
      new ScatterplotLayer<D>({
        id,
        data,
        getPosition: getPos,
        getFillColor: color as [number, number, number, number],
        getRadius: radius,
        radiusUnits: 'pixels',
        stroked: true,
        getLineColor: [255, 255, 255, 220],
        lineWidthMinPixels: 1,
        pickable: true,
        ...extra,
      })
    const geo = (d: { geometry: { coordinates: [number, number] } }) => d.geometry.coordinates
    if (p.layers.has('lamps')) out.push(dot('lamps', p.data.lamps.features, [250, 204, 21, 255], 3, geo))
    if (p.layers.has('places')) out.push(dot('places', openPlaces, [13, 148, 136, 230], 3.5, geo, { updateTriggers: { getPosition: band } }))
    if (p.layers.has('transit'))
      out.push(dot('transit', p.data.transit.features, [37, 99, 235, 255], 4, geo, { getRadius: (d: { properties: { kind: string } }) => (d.properties.kind === 'metro' ? 8 : 4) }))
    if (p.layers.has('help'))
      out.push(
        dot('help', p.data.help.features, [79, 70, 229, 255], 6, geo, {
          getFillColor: (d: { properties: { kind: string } }) => (d.properties.kind === 'Hospital' ? [219, 39, 119, 255] : [67, 56, 202, 255]),
        }),
      )
    if (p.layers.has('reports')) out.push(dot('reports', reportPoints, [139, 92, 246, 220], 3.5, (d: { pos: [number, number] }) => d.pos))

    if (p.pair) {
      const others = p.pair.alternatives.filter((a) => a.id !== p.selectedAlt)
      const sel = p.pair.alternatives.find((a) => a.id === p.selectedAlt)
      out.push(
        new PathLayer({
          id: 'routes-muted',
          data: others,
          getPath: (a: { coords: [number, number][] }) => a.coords,
          getColor: p.dark ? [161, 161, 170, 200] : [113, 113, 122, 200],
          getWidth: 5,
          widthUnits: 'pixels',
          capRounded: true,
          jointRounded: true,
          pickable: true,
        }),
      )
      if (sel) {
        out.push(
          new PathLayer({
            id: 'route-casing',
            data: [sel],
            getPath: (a: { coords: [number, number][] }) => a.coords,
            getColor: p.dark ? [7, 8, 12, 255] : [255, 255, 255, 255],
            getWidth: 11,
            widthUnits: 'pixels',
            capRounded: true,
            jointRounded: true,
          }),
          new PathLayer({
            id: 'route-selected',
            data: [sel],
            getPath: (a: { coords: [number, number][] }) => a.coords,
            getColor: [79, 70, 229, 255],
            getWidth: 7,
            widthUnits: 'pixels',
            capRounded: true,
            jointRounded: true,
          }),
          new PathLayer({
            id: 'route-low',
            data: lowSegments(sel, cellMap, band),
            getPath: (d: [number, number][]) => d,
            getColor: [234, 88, 12, 255],
            getWidth: 4,
            widthUnits: 'pixels',
            capRounded: true,
          }),
        )
      }
      out.push(
        new ScatterplotLayer({
          id: 'endpoints',
          data: [
            { pos: [p.pair.origin.lng, p.pair.origin.lat], end: false },
            { pos: [p.pair.dest.lng, p.pair.dest.lat], end: true },
          ],
          getPosition: (d: { pos: [number, number] }) => d.pos,
          getFillColor: (d: { end: boolean }) => (d.end ? [30, 27, 75, 255] : [255, 255, 255, 255]),
          getLineColor: [30, 27, 75, 255],
          getRadius: 7,
          radiusUnits: 'pixels',
          stroked: true,
          lineWidthMinPixels: 3,
        }),
      )
    }
    if (p.walker) {
      out.push(
        new ScatterplotLayer({
          id: 'walker',
          data: [p.walker, p.walker],
          getPosition: (d: [number, number]) => d,
          getFillColor: (_: unknown, { index }: { index: number }) => (index === 0 ? [79, 70, 229, 60] : [79, 70, 229, 255]),
          getRadius: (_: unknown, { index }: { index: number }) => (index === 0 ? 20 : 8),
          radiusUnits: 'pixels',
          stroked: true,
          getLineColor: (_: unknown, { index }: { index: number }) => (index === 0 ? [0, 0, 0, 0] : [255, 255, 255, 255]),
          lineWidthMinPixels: 3,
        }),
      )
    }
    return out
  }, [p, reportPoints, beforeId, labelId])

  const getTooltip = ({ object, layer }: PickingInfo) => {
    if (!object || !layer) return null
    const style = { className: 'deck-tooltip', style: { borderRadius: '8px', fontSize: '12px', padding: '6px 10px', fontFamily: 'Inter, system-ui, sans-serif' } }
    if (layer.id === 'hexes' || layer.id === 'streets') {
      const cell = layer.id === 'hexes' ? (object as Cell) : p.cellMap.get((object as StreetPiece).h)
      if (!cell) return null
      const s = cell.score[p.band]
      return { ...style, html: `<b>${Math.round(s)}</b> · ${scoreLabel(s)}<br/><span style="opacity:.7">Tap for details</span>` }
    }
    const props = (object as { properties?: { name?: string; kind?: string; cat?: string } }).properties
    if (props?.name) return { ...style, text: `${props.name}${props.kind ? ` · ${props.kind}` : props.cat ? ` · ${props.cat.replace('_', ' ')}` : ''}` }
    if (layer.id === 'reports') return { ...style, text: 'Simulated report (demo data)' }
    return null
  }

  const onClick = (info: PickingInfo) => {
    if (info.layer?.id === 'hexes' && info.object) p.onSelectCell((info.object as Cell).h3)
    else if (info.layer?.id === 'streets' && info.object) p.onSelectCell((info.object as StreetPiece).h)
    else if (info.layer?.id === 'routes-muted' && info.object) p.onSelectAlt((info.object as { id: string }).id)
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={INITIAL_VIEW}
      mapStyle={chain[Math.min(styleLevel, lastLevel)]}
      canvasContextAttributes={{ antialias: true }}
      onLoad={(e) => {
        setLoaded(true)
        if (import.meta.env.DEV) Object.assign(window, { __map: e.target }) // used by the demo test script only
      }}
      onError={(e) => !e.target.getStyle()?.layers?.length && stepDown()}
      onStyleData={onStyleData}
      onMoveEnd={(e) => p.onCenterChange([e.viewState.longitude, e.viewState.latitude])}
      minZoom={11}
      maxZoom={18}
      attributionControl={{ compact: true }}
      style={{ position: 'absolute', inset: 0, zIndex: 0 }} // own stacking context so UI panels sit above the deck canvas
    >
      <DeckOverlay interleaved layers={layers} getTooltip={getTooltip} onClick={onClick} />
    </Map>
  )
}
