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
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': dark ? '#07080c' : '#eef0f3' } }],
})

const ROAD = /road|highway|transportation|bridge|tunnel|street|path/

// Dark mode: near-black base so the coloured streets carry the picture.
const DARK = { bg: '#07080c', land: '#0a0c11', water: '#0b1422', park: '#0a120f', building: '#12151c', road: '#232833' }

/**
 * Roads are drawn above the score hexes, so keep them thin and quiet (dark grey at night,
 * white by day) and give labels a halo. Safe to call repeatedly.
 */
export function polishStyle(map: MapLibreMap, dark: boolean) {
  for (const layer of map.getStyle()?.layers ?? []) {
    try {
      const src = 'source-layer' in layer ? String(layer['source-layer'] ?? '') : ''
      if (layer.type === 'line' && ROAD.test(layer.id)) {
        const casing = /casing|outline/.test(layer.id)
        map.setPaintProperty(layer.id, 'line-color', dark ? DARK.road : '#9ca3af')
        map.setPaintProperty(layer.id, 'line-opacity', casing ? 0 : dark ? 0.9 : 0.85)
      } else if (layer.type === 'symbol' && layer.layout?.['text-field'] !== undefined) {
        map.setPaintProperty(layer.id, 'text-color', dark ? '#b8bdc9' : '#27272a')
        map.setPaintProperty(layer.id, 'text-halo-color', dark ? 'rgba(5,6,10,0.95)' : 'rgba(255,255,255,0.95)')
        map.setPaintProperty(layer.id, 'text-halo-width', 1.4)
      } else if (dark && layer.type === 'background') {
        map.setPaintProperty(layer.id, 'background-color', DARK.bg)
      } else if (dark && layer.type === 'fill') {
        const c = /water/.test(src) ? DARK.water : /park/.test(src) ? DARK.park : /building/.test(src) ? DARK.building : DARK.land
        map.setPaintProperty(layer.id, 'fill-color', c)
        map.setPaintProperty(layer.id, 'fill-outline-color', c)
      } else if (dark && layer.type === 'fill-extrusion') {
        map.setPaintProperty(layer.id, 'fill-extrusion-color', DARK.building)
      }
    } catch {
      // a layer that doesn't support the property: leave it as the style author made it
    }
  }
}
