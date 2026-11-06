"""Fetch walking route alternatives for the demo pairs and score them.

Uses the FOSSGIS OSRM foot server (routing.openstreetmap.de/routed-foot). The public
router.project-osrm.org demo only serves the car profile, so it is not used.
Safest/balanced options come from a local safety-weighted Dijkstra on the OSM road graph
(scripts/input/roads.json). One OSRM request per pair. Writes public/data/routes.json.
"""
import heapq
import time

import h3
import numpy as np
import requests

from common import BANDS, H3_RES, INPUT, OUT, USER_AGENT, haversine_km, read_json, write_json

OSRM = "https://routing.openstreetmap.de/routed-foot/route/v1/driving/"
DSCE = {"name": "DSCE main gate", "lat": 12.908, "lng": 77.566}
PAIRS = [
    {"id": "dsce-konanakunte", "label": "DSCE → Konanakunte Cross Metro", "origin": DSCE,
     "dest": {"name": "Konanakunte Cross Metro", "lat": 12.88897, "lng": 77.56267}},
    {"id": "dsce-yelachenahalli", "label": "DSCE → Yelachenahalli Metro", "origin": DSCE,
     "dest": {"name": "Yelachenahalli Metro", "lat": 12.89605, "lng": 77.57012}},
    {"id": "dsce-banashankari", "label": "DSCE → Banashankari Metro & bus stand", "origin": DSCE,
     "dest": {"name": "Banashankari Metro", "lat": 12.91522, "lng": 77.57360}},
]
SAMPLE_M = 20
LOW_SCORE = 35
WALK_MPS = 1.25  # ~4.5 km/h, matches the OSRM foot profile


def osrm(points, alternatives):
    coords = ";".join(f"{p[1]:.6f},{p[0]:.6f}" for p in points)
    url = f"{OSRM}{coords}?overview=full&geometries=geojson&alternatives={'3' if alternatives else 'false'}"
    r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=60)
    r.raise_for_status()
    time.sleep(1.0)  # be gentle with the free server
    return r.json().get("routes", [])


def sample(coords):
    """Points every ~20 m along the line, with the H3 cell of each."""
    out = []
    for (lng1, lat1), (lng2, lat2) in zip(coords, coords[1:]):
        seg = haversine_km(lat1, lng1, lat2, lng2) * 1000
        n = max(1, int(seg / SAMPLE_M))
        for k in range(n):
            t = k / n
            lat, lng = lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t
            out.append([round(lng, 6), round(lat, 6), h3.latlng_to_cell(lat, lng, H3_RES)])
    lng, lat = coords[-1]
    out.append([round(lng, 6), round(lat, 6), h3.latlng_to_cell(lat, lng, H3_RES)])
    return out


def retraces(coords):
    """True if the route walks back along the same road (a dead-end detour to a via point)."""
    edges = set()
    for a, b in zip(coords, coords[1:]):
        a, b = (round(a[0], 5), round(a[1], 5)), (round(b[0], 5), round(b[1], 5))
        if (b, a) in edges:
            return True
        edges.add((a, b))
    return False


def stats(samples, score):
    out = {}
    for b in BANDS:
        s = [score[c][b] for _, _, c in samples if c in score]
        out[b] = {"mean": round(float(np.mean(s)), 1), "min": round(float(min(s)), 1), "lowShare": round(sum(v < LOW_SCORE for v in s) / len(s), 2)} if s else None
    return out


def build_graph(roads):
    """Walkable road graph from OSM ways: node = rounded coordinate, edge = segment length (m)."""
    g = {}
    for r in roads:
        pts = [(round(x, 7), round(y, 7)) for x, y in r["coords"]]
        for a, b in zip(pts, pts[1:]):
            m = haversine_km(a[1], a[0], b[1], b[0]) * 1000
            cell = h3.latlng_to_cell((a[1] + b[1]) / 2, (a[0] + b[0]) / 2, H3_RES)
            g.setdefault(a, []).append((b, m, cell))
            g.setdefault(b, []).append((a, m, cell))
    return g


def nearest_node(g, lat, lng):
    return min(g, key=lambda n: (n[0] - lng) ** 2 + (n[1] - lat) ** 2)


def safety_route(g, score, o, d, k):
    """Dijkstra where each metre through a low-score block costs more: len * (1 + k * (1 - s/100)^2).

    ponytail: weights use the late+night score only; per-band routing is the upgrade.
    """
    src, dst = nearest_node(g, o["lat"], o["lng"]), nearest_node(g, d["lat"], d["lng"])
    dist, prev, pq = {src: 0.0}, {}, [(0.0, src)]
    while pq:
        cost, n = heapq.heappop(pq)
        if n == dst:
            break
        if cost > dist[n]:
            continue
        for nb, m, cell in g[n]:
            s = (score[cell]["late"] + score[cell]["night"]) / 2 if cell in score else 30
            c = cost + m * (1 + k * (1 - s / 100) ** 2)
            if c < dist.get(nb, float("inf")):
                dist[nb], prev[nb] = c, n
                heapq.heappush(pq, (c, nb))
    if dst not in prev:
        return None
    path = [dst]
    while path[-1] != src:
        path.append(prev[path[-1]])
    coords = [[x, y] for x, y in reversed(path)]
    meters = sum(haversine_km(a[1], a[0], b[1], b[0]) * 1000 for a, b in zip(coords, coords[1:]))
    return {"distance": meters, "duration": meters / WALK_MPS, "geometry": {"coordinates": coords}}


def main():
    cells = read_json(OUT / "cells.json")
    score = {c["h3"]: c["score"] for c in cells}
    graph = build_graph(read_json(INPUT / "roads.json"))
    result = {"source": "OSRM foot profile (routing.openstreetmap.de) + safety-weighted shortest paths on the OSM road graph", "lowScore": LOW_SCORE, "pairs": []}

    for pair in PAIRS:
        o, d = pair["origin"], pair["dest"]
        print(f"{pair['label']}")
        cands = []
        try:
            cands += osrm([(o["lat"], o["lng"]), (d["lat"], d["lng"])], True)
        except Exception as ex:
            print(f"  OSRM failed ({ex}); using the local road graph only")
        # k=0 gives a local shortest path (offline fallback); higher k trades distance for safety
        for k in (0, 1.5, 3, 8):
            r = safety_route(graph, score, o, d, k)
            if r:
                cands.append(r)
        if not cands:
            print("  no routes; skipping pair")
            continue

        alts = []
        for r in cands:
            coords = r["geometry"]["coordinates"]
            if any(abs(r["distance"] - a["distanceM"]) < 25 for a in alts):  # same route twice
                continue
            if retraces(coords):  # via point caused an out-and-back spur
                continue
            smp = sample(coords)
            alts.append({"distanceM": round(r["distance"]), "durationS": round(r["duration"]),
                         "coords": [[round(x, 6), round(y, 6)] for x, y in coords], "samples": smp, "stats": stats(smp, score)})
        alts = [a for a in alts if a["stats"]["night"]]
        shortest = min(alts, key=lambda a: a["distanceM"])
        # drop silly detours (> 1.6x shortest)
        alts = [a for a in alts if a["distanceM"] <= shortest["distanceM"] * 1.6]

        keep = [shortest]
        for b in BANDS:
            best = max(alts, key=lambda a: a["stats"][b]["mean"])
            if best not in keep:
                keep.append(best)
        # a balanced option: best safety gain per extra metre among the rest
        rest = [a for a in alts if a not in keep]
        if rest and len(keep) < 3:
            keep.append(max(rest, key=lambda a: a["stats"]["night"]["mean"] - 0.01 * (a["distanceM"] - shortest["distanceM"])))
        for i, a in enumerate(keep):
            a["id"] = f"{pair['id']}-{i}"
            print(f"  {a['id']}: {a['distanceM']} m, night mean {a['stats']['night']['mean']}, min {a['stats']['night']['min']}")
        result["pairs"].append({**pair, "alternatives": keep})

    write_json(OUT / "routes.json", result)


if __name__ == "__main__":
    main()
