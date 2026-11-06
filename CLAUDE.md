# CLAUDE.md — SafeStop Demo Prototype (presentation build)

Read this whole file before writing code. This is a **one-night presentation prototype**, not the final product. Priorities, in order:
1. It must look like a polished, professional product (Google Maps / Citymapper / Linear quality).
2. The demo flow in §7 must work smoothly every time, offline-capable after build.
3. Real data where it is cheap to get; clearly labelled synthetic data for community reports.

If something will take more than ~30 minutes and isn't in the demo flow, skip it and tell the user.

---

## 1. What SafeStop is (one paragraph for context)

SafeStop scores every street block in Bengaluru for night-time safety using public data (street lighting, places open late, transit stops, distance to police/hospitals) plus anonymous community reports, and suggests the safest walking route, not just the shortest. The full product will have a Python data pipeline, PostGIS and a FastAPI backend. **This prototype has none of that**: data is precomputed into static JSON/GeoJSON files and the app is frontend-only.

## 2. Hard scope rules

- **Pilot area only:** ~3 km radius around Dayananda Sagar College of Engineering (DSCE), Kumaraswamy Layout, Bengaluru. Ask the user to confirm the exact campus coordinates before fetching data (approx. 12.908 N, 77.566 E — verify).
- **No backend server.** All data lives in `public/data/` as static files produced by scripts in `scripts/`.
- **No login, no real location sharing, no real report submission.** Trip sharing and reporting are simulated in the UI (local state only).
- **Every synthetic value must be labelled** in the UI ("Simulated community reports — demo data") and in `public/data/README.md`.
- Never label an area "dangerous" or "unsafe" in UI copy. Say what is missing: "Low lighting", "Few places open", "Far from help".

## 3. Tech stack

| Part | Choice |
|---|---|
| App | React + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn/ui components |
| Map | MapLibre GL JS (via `react-map-gl/maplibre`) |
| Hexagons and routes | deck.gl (`H3HexagonLayer`, `PathLayer`, `ScatterplotLayer`) + `h3-js` |
| Base map style | A free dark and light vector style (e.g. OpenFreeMap or MapTiler free key; ask user if a key is needed). Must have a fallback style if the network is slow. |
| Icons / motion | lucide-react, framer-motion (subtle only) |
| Charts | Recharts (for the "why this score" breakdown and the about/validation page) |
| Data scripts | Python 3 (`requests`, `h3`, `shapely`, `numpy`, `pandas`) |

Ask before adding any other dependency.

## 4. Data plan

All scripts write to `public/data/`. Run them once; commit the outputs so the demo works without internet (except map tiles).

### 4.1 Real data (`scripts/fetch_real.py`)
Fetch for the pilot bounding box via the **Overpass API** (OpenStreetMap):
- `highway=street_lamp` nodes
- roads (`highway=*` walkable types) with `lit=yes/no` if tagged
- places: `amenity` in (restaurant, cafe, fast_food, pharmacy, atm, fuel, hospital, clinic, police), `shop=*`; keep `opening_hours` when present
- bus stops (`highway=bus_stop`), metro stations (`railway=station` + `station=subway` or `public_transport=station`)

Police stations: the user may also download the **OpenCity "Bengaluru Urban Police Station Locations" KML** (data.opencity.in/dataset/police-station-locations) into `scripts/input/`; parse it if present, else use OSM `amenity=police`.

If the dev environment can't reach Overpass, print the exact query so the user can run it at overpass-turbo.eu and save the JSON into `scripts/input/`.

### 4.2 Scoring (`scripts/build_scores.py`)
- H3 resolution **9** cells covering the pilot area.
- Per cell, compute parts scaled 0–1 within the pilot area:
  - **L Lighting:** street lamps per cell + share of `lit=yes` road length (missing tag = unknown, not dark)
  - **A Activity (per time band):** count of places likely open; use `opening_hours` if parseable, else default hours per category (e.g. pharmacy till 22:00, restaurant till 23:00, fuel/ATM/hospital 24h, shops till 21:30)
  - **T Transit:** bus stops + metro stations in cell and its ring-1 neighbours
  - **H Help:** inverse straight-line distance to nearest police station/outpost and hospital
- Time bands: `evening` (19–21), `late` (21–24), `night` (00–05).
- Score: `S = 100 * (0.35 L + 0.25 A_t + 0.15 T + 0.25 H) + ΔR`, with ΔR from reports capped at ±10.
- Output `cells.json`: `[{h3, score:{evening,late,night}, parts:{L,A:{...},T,H}, reasons:[...], reportCounts:{...}}]`. `reasons` = 2–3 plain-English strings, e.g. "Few street lamps mapped", "4 places open until 11 pm", "Police station 0.6 km away".

### 4.3 Synthetic community reports (`scripts/make_synthetic_reports.py`)
- Fixed random seed (42). ~300–500 reports over the pilot area.
- Categories: `poor_lighting`, `deserted`, `felt_safe`, `harassment_reported` (keep this rare and generic; no descriptions of incidents), `broken_footpath`.
- **Correlate with real features:** low-L cells get more `poor_lighting`; low-A cells at `late`/`night` get more `deserted`; high-L+A cells get more `felt_safe`. Add noise so it doesn't look mechanical.
- Each report: `{id, h3, category, timeBand, daysAgo}` — no free text, no fake names.
- Write `reports.json` and add `"synthetic": true` at the top level.

### 4.4 Demo routes (`scripts/fetch_routes.py`)
- 2–3 fixed origin→destination pairs the user chooses (e.g. DSCE gate → nearest metro station; DSCE → a nearby PG area; DSCE → bus stop). Ask the user for these.
- Get walking alternatives from the public OSRM demo server (`router.project-osrm.org/route/v1/foot/...&alternatives=true&overview=full&geometries=geojson`) — use lightly, a few requests only. If unreachable, fall back to OSMnx locally.
- For each alternative: length, duration, mean and minimum cell score per time band along the path, list of low-score segments.
- Write `routes.json`. The app labels the shortest and the safest per time band.

### 4.5 `public/data/README.md`
List every file, its source, download date, and which parts are synthetic.

## 5. Screens (all must look finished)

1. **Landing / hero** — product name, one-line promise ("Walk home by the light, not by guesswork"), a live-looking hero map preview, three feature cards, "Open the map" CTA. Clean, lots of whitespace.
2. **Map explorer (main screen)**
   - Full-screen map, H3 hexagon heatmap (smooth green → amber → red-ish scale; avoid pure red; 60–70% opacity; hover highlight).
   - Floating top search bar (Google Maps style) with origin/destination fields prefilled from demo pairs.
   - **Time slider / segmented control:** Evening · Late · Night — hexes animate between bands.
   - Layer toggles: Street lamps · Open places · Transit · Police/Hospitals · Community reports.
   - Legend card bottom-left. Dark/light map toggle.
3. **Cell detail panel ("Why this score")** — on hex click: big score, label (Good / Moderate / Low lighting & activity), Recharts horizontal bars for L, A, T, H, report counts by category with a "Simulated data" badge, 2–3 reasons.
4. **Route planner** — two or three route cards (Shortest / Safest / Balanced) showing distance, time, average safety, "+180 m for +22 safety points"; selected route drawn thick on the map, others muted; low-score segments marked.
5. **Report sheet** — bottom sheet with category chips, time band auto-filled, "Submit anonymously"; on submit, toast + the cell's report count and score update locally (show ΔR effect, capped).
6. **Share trip (simulated)** — start trip → card with share link (fake), ETA, trusted contacts (placeholder names like "Contact 1"), animated walker dot moving along the route; a "Stopped for 3 min — notify contacts?" alert after a scripted pause.
7. **About & data page** — data sources table (real vs synthetic clearly marked), scoring formula, privacy principles, roadmap to full product.

Mobile-responsive: the demo may be shown on a phone. Test at 390×844 and 1440×900.

## 6. Design direction

- References: Google Maps (floating cards, search bar), Citymapper (route cards), Apple Maps (bottom sheets), Linear/Vercel (typography, spacing, restraint).
- Font: Inter (or Geist). Base 14–16 px. Tight, consistent 8 px spacing grid.
- One brand accent (deep indigo or teal) + a safety scale. Neutral greys. Rounded-xl cards, soft shadows, backdrop-blur on floating panels.
- Motion: 150–250 ms ease-out; no bouncing.
- Accessible contrast; never rely on colour alone (scores also shown as numbers/labels).
- Empty, loading and error states for every panel.

## 7. Demo flow that must work flawlessly

1. Landing → "Open the map".
2. Heatmap at Evening → switch to Night; hexes visibly change as shops close.
3. Click a low-scoring hex → "Why this score" panel.
4. Pick demo route DSCE → metro: Shortest vs Safest cards; select Safest.
5. Submit a simulated report → toast, score nudges.
6. Start shared trip → walker animates → stop alert appears.
7. About page → data sources (real vs synthetic) and formula.

## 8. Build order (time-boxed)

1. (30 min) Scaffold Vite + TS + Tailwind + shadcn; layout shell; map renders with base style.
2. (60 min) Data scripts 4.1–4.4 → JSON in `public/data/`. If Overpass/OSRM fail, generate a clearly-marked fallback and tell the user.
3. (60 min) Map explorer: hex layer, time bands, legend, layer toggles.
4. (45 min) Cell detail panel + route planner.
5. (45 min) Report sheet + simulated trip sharing.
6. (30 min) Landing + About pages.
7. (30 min) Polish pass: spacing, typography, responsive, loading states; run the demo flow 3×.

After each step: summarise what works, then continue unless the user says otherwise.

## 9. Folder structure

```
safestop-prototype/
├── CLAUDE.md
├── scripts/            # Python data scripts + input/
├── public/data/        # cells.json, routes.json, reports.json, places.geojson, lamps.geojson, README.md
└── src/
    ├── components/     # map/, panels/, ui/ (shadcn)
    ├── pages/          # Landing, Explorer, About
    ├── lib/            # scoring helpers, colour scale, data loaders
    └── styles/
```

## 10. Commands

```bash
npm create vite@latest safestop-prototype -- --template react-ts
npm install
npm run dev
python scripts/fetch_real.py && python scripts/build_scores.py && python scripts/make_synthetic_reports.py && python scripts/fetch_routes.py
npm run build && npm run preview   # check the production build before presenting
```
The user is on Windows + VS Code: give PowerShell equivalents where commands differ.

## 11. Rules

- Do not invent statistics or accuracy numbers anywhere in the UI.
- Synthetic data is always labelled. Real data shows its source on the About page.
- Keep components small and readable; the team must be able to explain the code in a viva.
- Before declaring done: `npm run build` passes with no type errors, and the §7 flow works.
