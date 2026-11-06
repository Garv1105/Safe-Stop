"""Generate SYNTHETIC community reports (demo data, not real reports).

Reports are correlated with real features so the demo looks plausible:
low lighting -> more poor_lighting, low activity late/night -> more deserted,
well lit + busy -> more felt_safe. Then applies the capped report adjustment dR
to cells.json. Same dR rule as src/lib/scoring.ts (keep them in sync).
"""
import numpy as np

from common import BANDS, OUT, read_json, write_json

SEED = 42
N_REPORTS = 420
CATEGORIES = ["poor_lighting", "deserted", "felt_safe", "harassment_reported", "broken_footpath"]
DR_WEIGHTS = {"felt_safe": 2, "poor_lighting": -2, "deserted": -2, "harassment_reported": -3, "broken_footpath": -1}
DR_CAP = 10
BAND_SHARE = [0.45, 0.35, 0.20]  # fewer people out (and reporting) later at night


def delta_r(counts):
    """Capped score adjustment from one band's report counts."""
    raw = sum(DR_WEIGHTS[k] * v for k, v in counts.items())
    return max(-DR_CAP, min(DR_CAP, raw))


def main():
    rng = np.random.default_rng(SEED)
    cells = read_json(OUT / "cells.json")

    # busier cells get somewhat more reports, but every cell can get some
    busy = np.array([c["parts"]["A"]["evening"] + c["parts"]["T"] for c in cells])
    cell_p = (0.6 + busy) / (0.6 + busy).sum()

    reports = []
    for i in range(N_REPORTS):
        ci = rng.choice(len(cells), p=cell_p)
        cell = cells[ci]
        band = BANDS[rng.choice(3, p=BAND_SHARE)]
        L, A = cell["parts"]["L"], cell["parts"]["A"][band]
        lateness = 0.4 if band == "evening" else 1.0
        w = np.array([
            0.15 + 0.6 * (1 - L),               # poor_lighting
            0.05 + 0.6 * (1 - A) * lateness,    # deserted
            0.10 + 0.7 * (L + A) / 2,           # felt_safe
            0.02,                                # harassment_reported (kept rare, no details)
            0.12,                                # broken_footpath
        ])
        w *= rng.lognormal(0, 0.35, size=len(w))  # noise so it doesn't look mechanical
        cat = CATEGORIES[rng.choice(len(w), p=w / w.sum())]
        days = int(min(90, rng.exponential(25)) + 1)
        reports.append({"id": f"r{i + 1:04d}", "h3": cell["h3"], "category": cat, "timeBand": band, "daysAgo": days})

    by_cell = {}
    for r in reports:
        band_counts = by_cell.setdefault(r["h3"], {b: {} for b in BANDS})[r["timeBand"]]
        band_counts[r["category"]] = band_counts.get(r["category"], 0) + 1

    for c in cells:
        counts = by_cell.get(c["h3"], {b: {} for b in BANDS})
        c["reportCounts"] = counts
        c["dR"] = {b: delta_r(counts[b]) for b in BANDS}
        c["score"] = {b: round(max(0, min(100, c["base"][b] + c["dR"][b])), 1) for b in BANDS}

    write_json(OUT / "reports.json", {"synthetic": True, "note": "Simulated community reports for demo only. Not real reports.", "seed": SEED, "reports": reports})
    write_json(OUT / "cells.json", cells)
    from collections import Counter
    print(Counter(r["category"] for r in reports))


if __name__ == "__main__":
    main()
