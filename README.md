# SafeStop · presentation prototype

Night-time walking scores for every street block within 3 km of DSCE, Bengaluru. Frontend only. Data is precomputed into `public/data/` (see `public/data/README.md`).

## Run (PowerShell)

```powershell
npm install
npm run dev                          # http://localhost:5173
npm run build; npm run preview       # check the production build before presenting
```

## Rebuild the data (optional, needs internet)

```powershell
py -m pip install requests h3 shapely numpy pandas
py scripts/fetch_real.py             # add --cached to reuse scripts/input/osm_raw.json
py scripts/build_scores.py
py scripts/make_synthetic_reports.py
py scripts/fetch_routes.py
py scripts/make_street_preview.py
```

## Nicer base map (optional)

Uses OpenFreeMap (no key) by default. For MapTiler, get a free key at maptiler.com and create `.env.local`:

```
VITE_MAPTILER_KEY=your_key_here
VITE_MAPTILER_STYLE=streets-v4       # optional; e.g. dataviz-v4. Dark mode adds "-dark".
```

Restart `npm run dev` after adding it. If the key is restricted to certain origins, allow `localhost` (and your deploy domain). If MapTiler fails, the map falls back to OpenFreeMap, then to a plain offline background.

Police KML files go in `scripts/input/` (already downloaded from data.opencity.in).

## Demo flow

1. Landing → **Open the map**
2. Switch **Evening → Night**: blocks change as shops close
3. Click a red/orange block → **Why this score**
4. Press the blue arrow next to *Konanakunte Cross Metro* → compare **Shortest** vs **Safest**, select Safest
5. **Report** → pick a category → **Submit anonymously** → toast shows the score change
6. **Back** → **Start trip & share** → walker moves → "Stopped for 3 min" alert
7. **i** button (top right) → About page: data sources and formula

Base map tiles need internet. If they fail to load within 8 s the map falls back to a plain background; hexes, routes and panels still work.
