export type Band = 'evening' | 'late' | 'night'
export type ByBand<T> = Record<Band, T>

export type ReportCategory = 'poor_lighting' | 'deserted' | 'felt_safe' | 'harassment_reported' | 'broken_footpath'
export type ReportCounts = Partial<Record<ReportCategory, number>>

export interface Cell {
  h3: string
  base: ByBand<number>
  score: ByBand<number>
  dR: ByBand<number>
  parts: { L: number; A: ByBand<number>; T: number; H: number }
  reasons: ByBand<string[]>
  facts: {
    lamps: number
    open: ByBand<number>
    bus: number
    metro: number
    policeKm: number
    policeName: string
    hospitalKm: number
    hospitalName: string
  }
  reportCounts: ByBand<ReportCounts>
}

export interface RouteStats {
  mean: number
  min: number
  lowShare: number
}

export interface RouteAlt {
  id: string
  distanceM: number
  durationS: number
  coords: [number, number][]
  /** [lng, lat, h3] every ~20 m along the route */
  samples: [number, number, string][]
}

export interface Place {
  name: string
  lat: number
  lng: number
}

export interface RoutePair {
  id: string
  label: string
  origin: Place
  dest: Place
  alternatives: RouteAlt[]
}

export interface PointFeature<P> {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: P
}
export interface FC<P> {
  type: 'FeatureCollection'
  features: PointFeature<P>[]
}

export type PlaceProps = { cat: string; name: string; close: number; hoursSource: 'osm' | 'default' }
export type TransitProps = { kind: 'bus' | 'metro'; name: string }
export type HelpProps = { kind: string; name: string }

export interface Report {
  id: string
  h3: string
  category: ReportCategory
  timeBand: Band
  daysAgo: number
}

/** A street piece inside one H3 cell. k: 0 main road, 1 residential/service, 2 footpath */
export interface StreetPiece {
  k: 0 | 1 | 2
  h: string
  c: [number, number][]
}

export interface AppData {
  cells: Cell[]
  routes: { pairs: RoutePair[]; lowScore: number }
  reports: { synthetic: true; reports: Report[] }
  lamps: FC<Record<string, never>>
  places: FC<PlaceProps>
  transit: FC<TransitProps>
  help: FC<HelpProps>
  streets: { source: string; ways: StreetPiece[] }
}
