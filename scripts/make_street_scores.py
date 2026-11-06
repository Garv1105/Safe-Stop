"""Split every OSM street in the pilot area into pieces, one per H3 cell, so the app can colour
streets by their cell's score.

Reads scripts/input/roads.json and public/data/cells.json, writes public/data/streets.json:
  {"source": ..., "ways": [{"k": 0|1|2, "h": "<h3 cell>", "c": [[lng, lat], ...]}]}
k: 0 = main road, 1 = residential/service, 2 = footpath/steps.
"""
import h3

from common import H3_RES, INPUT, OUT, read_json, write_json

MAJOR = {"trunk", "primary", "secondary", "tertiary", "trunk_link", "primary_link", "secondary_link", "tertiary_link"}
MINOR = {"residential", "unclassified", "living_street", "service", "pedestrian"}


def split_by_cell(coords):
    """Runs of consecutive segments whose midpoint falls in the same cell."""
    runs = []
    for a, b in zip(coords, coords[1:]):
        cell = h3.latlng_to_cell((a[1] + b[1]) / 2, (a[0] + b[0]) / 2, H3_RES)
        if runs and runs[-1][0] == cell:
            runs[-1][1].append(b)
        else:
            runs.append((cell, [a, b]))
    return runs


def main():
    cells = {c["h3"] for c in read_json(OUT / "cells.json")}
    ways = []
    for r in read_json(INPUT / "roads.json"):
        kind = 0 if r.get("hw") in MAJOR else 1 if r.get("hw") in MINOR else 2
        for cell, pts in split_by_cell(r["coords"]):
            if cell in cells:
                ways.append({"k": kind, "h": cell, "c": [[round(x, 5), round(y, 5)] for x, y in pts]})
    write_json(OUT / "streets.json", {"source": "OpenStreetMap contributors (ODbL)", "ways": ways})
    print(f"{len(ways)} street pieces")


def _check():
    # a straight line crossing cells splits into pieces that share their end points
    line = [[77.560 + i * 0.001, 12.908] for i in range(10)]
    runs = split_by_cell(line)
    assert len(runs) > 1
    assert sum(len(p) - 1 for _, p in runs) == len(line) - 1
    assert all(runs[i][1][-1] == runs[i + 1][1][0] for i in range(len(runs) - 1))


if __name__ == "__main__":
    _check()
    main()
