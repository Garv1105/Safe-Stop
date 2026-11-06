"""Score every H3 res-9 cell in the pilot area for each night-time band.

S = 100 * (0.35 L + 0.25 A_t + 0.15 T + 0.25 H)   (report adjustment dR is added later
by make_synthetic_reports.py). Writes public/data/cells.json.
"""
import math

import h3
import numpy as np

from common import BANDS, CENTER_LAT, CENTER_LNG, H3_RES, INPUT, OUT, RADIUS_KM, haversine_km, read_json, write_json

WEIGHTS = {"L": 0.35, "A": 0.25, "T": 0.15, "H": 0.25}
MAJOR_ROADS = {"trunk", "primary", "secondary", "tertiary", "trunk_link", "primary_link", "secondary_link", "tertiary_link"}
# A place counts as "open" in a band if it closes at or after this hour (24+ = after midnight)
OPEN_UNTIL = {"evening": 20.5, "late": 23.0, "night": 26.0}
BAND_PHRASE = {"evening": "open until 9 pm", "late": "open after 11 pm", "night": "open after 2 am"}


def pilot_cells():
    ring = []
    for i in range(64):
        a = 2 * math.pi * i / 64
        dlat = RADIUS_KM / 111.0 * math.sin(a)
        dlng = RADIUS_KM / (111.0 * math.cos(math.radians(CENTER_LAT))) * math.cos(a)
        ring.append((CENTER_LAT + dlat, CENTER_LNG + dlng))
    return sorted(h3.polygon_to_cells(h3.LatLngPoly(ring), H3_RES))


def p95_scale(values):
    """Scale to 0-1 against the 95th percentile so a few extreme cells don't flatten the rest."""
    arr = np.asarray(values, dtype=float)
    top = np.percentile(arr, 95) or arr.max() or 1.0
    return np.clip(arr / top, 0, 1)


def neighbour_sum(counts, cell, ring_weight=0.5):
    return counts.get(cell, 0) + ring_weight * sum(counts.get(n, 0) for n in h3.grid_ring(cell, 1))


def count_points(features, pred=lambda p: True):
    out = {}
    for f in features:
        if pred(f["properties"]):
            lng, lat = f["geometry"]["coordinates"]
            c = h3.latlng_to_cell(lat, lng, H3_RES)
            out[c] = out.get(c, 0) + 1
    return out


def road_lengths(roads):
    """Per cell: total, major-road and lit=yes/no road length (km), by sampling segments."""
    total, major, lit_yes, lit_no = {}, {}, {}, {}
    for r in roads:
        pts = r["coords"]
        for (lng1, lat1), (lng2, lat2) in zip(pts, pts[1:]):
            seg = haversine_km(lat1, lng1, lat2, lng2)
            steps = max(1, int(seg / 0.025))  # sample every ~25 m
            for k in range(steps):
                t = (k + 0.5) / steps
                c = h3.latlng_to_cell(lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t, H3_RES)
                piece = seg / steps
                total[c] = total.get(c, 0) + piece
                if r.get("hw") in MAJOR_ROADS:
                    major[c] = major.get(c, 0) + piece
                if r["lit"] == "yes":
                    lit_yes[c] = lit_yes.get(c, 0) + piece
                elif r["lit"] == "no":
                    lit_no[c] = lit_no.get(c, 0) + piece
    return total, major, lit_yes, lit_no


def nearest(cell_ll, points):
    best = (float("inf"), "")
    for lat, lng, name in points:
        d = haversine_km(cell_ll[0], cell_ll[1], lat, lng)
        if d < best[0]:
            best = (d, name)
    return best


def fmt_km(d):
    return f"{int(round(d * 1000, -1))} m" if d < 1 else f"{d:.1f} km"


def main():
    cells = pilot_cells()
    print(f"{len(cells)} H3 cells at res {H3_RES}")

    lamps = read_json(OUT / "lamps.geojson")["features"]
    places = read_json(OUT / "places.geojson")["features"]
    transit = read_json(OUT / "transit.geojson")["features"]
    helps = read_json(OUT / "help.geojson")["features"]
    roads = read_json(INPUT / "roads.json")

    # --- Lighting --------------------------------------------------------------
    lamp_counts = count_points(lamps)
    total, major, lit_yes, lit_no = road_lengths(roads)
    lamp_raw = [neighbour_sum(lamp_counts, c, 0.25) for c in cells]
    lamp_n = p95_scale(lamp_raw)
    L_raw = []
    for i, c in enumerate(cells):
        major_share = major.get(c, 0) / total[c] if total.get(c) else 0.0
        # lamps are under-mapped in OSM, so main-road share acts as a lighting prior
        val = 0.55 * lamp_n[i] + 0.45 * min(1.0, major_share * 2)
        known = lit_yes.get(c, 0) + lit_no.get(c, 0)
        if known > 0:  # missing lit tag = unknown, so only blend when tagged
            val = 0.5 * val + 0.5 * (lit_yes.get(c, 0) / known)
        L_raw.append(val)
    L = p95_scale(L_raw)

    # --- Activity per band (shared scale, so night is genuinely lower than evening) ---
    act_counts = {b: count_points(places, lambda p, b=b: p["close"] >= OPEN_UNTIL[b]) for b in BANDS}
    A_raw = {b: [neighbour_sum(act_counts[b], c) for c in cells] for b in BANDS}
    a_top = np.percentile(A_raw["evening"], 95) or 1.0
    A = {b: np.clip(np.asarray(A_raw[b]) / a_top, 0, 1) for b in BANDS}

    # --- Transit ----------------------------------------------------------------
    bus = count_points(transit, lambda p: p["kind"] == "bus")
    metro = count_points(transit, lambda p: p["kind"] == "metro")
    T = p95_scale([neighbour_sum(bus, c) + 4 * neighbour_sum(metro, c) for c in cells])

    # --- Help: inverse distance to nearest police and hospital ------------------
    police = [(f["geometry"]["coordinates"][1], f["geometry"]["coordinates"][0], f["properties"]["name"]) for f in helps if "Police" in f["properties"]["kind"]]
    hosp = [(f["geometry"]["coordinates"][1], f["geometry"]["coordinates"][0], f["properties"]["name"]) for f in helps if f["properties"]["kind"] == "Hospital"]
    H_raw, dist = [], []
    for c in cells:
        ll = h3.cell_to_latlng(c)
        dp, dh = nearest(ll, police), nearest(ll, hosp)
        dist.append((dp, dh))
        H_raw.append(0.6 / (1 + 2 * dp[0]) + 0.4 / (1 + 2 * dh[0]))
    H = np.asarray(H_raw) / max(H_raw)

    out = []
    for i, c in enumerate(cells):
        base = {b: round(100 * (WEIGHTS["L"] * L[i] + WEIGHTS["A"] * A[b][i] + WEIGHTS["T"] * T[i] + WEIGHTS["H"] * H[i]), 1) for b in BANDS}
        (dp, pname), (dh, hname) = dist[i]
        n_lamps = lamp_counts.get(c, 0)
        is_main = total.get(c) and major.get(c, 0) / total[c] > 0.3
        n_bus = bus.get(c, 0) + sum(bus.get(n, 0) for n in h3.grid_ring(c, 1))
        n_metro = metro.get(c, 0) + sum(metro.get(n, 0) for n in h3.grid_ring(c, 1))

        if n_lamps >= 3:
            light = f"{n_lamps} street lamps mapped"
        elif is_main:
            light = "On a main road (usually lit)"
        else:
            light = "Few street lamps mapped"
        help_line = f"Police station {fmt_km(dp)} away" if dp <= dh else f"Hospital {fmt_km(dh)} away"
        transit_line = "Metro station close by" if n_metro else (f"{n_bus} bus stop{'s' if n_bus != 1 else ''} nearby" if n_bus else "No bus stops close by")

        reasons = {}
        for b in BANDS:
            n_open = act_counts[b].get(c, 0)
            act = f"{n_open} place{'s' if n_open != 1 else ''} {BAND_PHRASE[b]}" if n_open else f"Few places {BAND_PHRASE[b]}"
            # lead with the weakest part so the panel explains low scores first
            parts = sorted([(L[i], light), (A[b][i], act), (H[i], help_line), (T[i] + 0.2, transit_line)])
            reasons[b] = [p[1] for p in parts[:3]]

        out.append({
            "h3": c,
            "base": base,
            "score": dict(base),
            "parts": {"L": round(float(L[i]), 3), "A": {b: round(float(A[b][i]), 3) for b in BANDS}, "T": round(float(T[i]), 3), "H": round(float(H[i]), 3)},
            "reasons": reasons,
            "facts": {"lamps": n_lamps, "open": {b: act_counts[b].get(c, 0) for b in BANDS}, "bus": n_bus, "metro": n_metro,
                      "policeKm": round(dp, 2), "policeName": pname, "hospitalKm": round(dh, 2), "hospitalName": hname},
            "reportCounts": {},
            "dR": {b: 0 for b in BANDS},
        })

    write_json(OUT / "cells.json", out)
    for b in BANDS:
        s = np.array([o["base"][b] for o in out])
        print(f"  {b:8s} min {s.min():5.1f}  p25 {np.percentile(s, 25):5.1f}  median {np.median(s):5.1f}  p75 {np.percentile(s, 75):5.1f}  max {s.max():5.1f}")


if __name__ == "__main__":
    main()
