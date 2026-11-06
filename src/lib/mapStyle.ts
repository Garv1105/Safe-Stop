import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'

/**
 * Base map styles. With a free MapTiler key in `.env.local` (VITE_MAPTILER_KEY=...) we use
 * MapTiler (style set by VITE_MAPTILER_STYLE, default streets-v4). Otherwise OpenFreeMap (no key).
 */
const KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined

// e.g. streets-v4 or dataviz-v4; the dark map uses the matching "-dark" style
const MT_STYLE = (import.meta.env.VITE_MAPTILER_STYLE as string | undefined) ?? 'streets-v4'
const maptiler = (dark: boolean) => `https://api.maptiler.com/maps/${MT_STYLE}${dark ? '-dark' : ''}/style.json?key=${KEY}`
const openfreemap = (dark: boolean) => `https://tiles.openfreemap.org/styles/${dark ? 'dark' : 'positron'}`

/** Styles to try in order. A bad key or an outage moves the map to the next one instead of going blank. */
export const styleChain = (dark: boolean) => [...(KEY ? [maptiler(dark)] : []), openfreemap(dark), fallbackStyle(dark)]

// Used only if the style can't be downloaded at all: hexes and routes still render on a plain background.
export const fallbackStyle = (dark: boolean): StyleSpecification => ({
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': dark ? '#111318' : '#eef0f3' } }],
})

const ROAD = /road|highway|transportation|bridge|tunnel|street|path/

/**
 * Roads are drawn above the score hexes, so make them thin and translucent and
 * give labels a halo. Safe to call repeatedly.
 */
export function polishStyle(map: MapLibreMap, dark: boolean) {
  for (const layer of map.getStyle()?.layers ?? []) {
    try {
      if (layer.type === 'line' && ROAD.test(layer.id)) {
        const casing = /casing|outline/.test(layer.id)
        map.setPaintProperty(layer.id, 'line-color', dark ? '#d6dbff' : '#ffffff')
        map.setPaintProperty(layer.id, 'line-opacity', casing ? 0 : dark ? 0.3 : 0.85)
      } else if (layer.type === 'symbol' && layer.layout?.['text-field'] !== undefined) {
        map.setPaintProperty(layer.id, 'text-color', dark ? '#e8eaff' : '#27272a')
        map.setPaintProperty(layer.id, 'text-halo-color', dark ? 'rgba(8,10,24,0.9)' : 'rgba(255,255,255,0.95)')
        map.setPaintProperty(layer.id, 'text-halo-width', 1.4)
      }
    } catch {
      // a layer that doesn't support the property: leave it as the style author made it
    }
  }
}
