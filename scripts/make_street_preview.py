"""Cut the real OSM street network around the DSCE -> Konanakunte routes for the landing page drawing.

Reads scripts/input/roads.json and public/data/routes.json, writes public/data/streets_preview.json.
"""
from common import INPUT, OUT, read_json, write_json

MAJOR = {"trunk", "primary", "secondary", "tertiary", "trunk_link", "primary_link", "secondary_link", "tertiary_link"}
MINOR = {"residential", "unclassified", "living_street", "service", "pedestrian"}


def main():
    pair = next(p for p in read_json(OUT / "routes.json")["pairs"] if p["id"] == "dsce-konanakunte")
    pts = [c for a in pair["alternatives"] for c in a["coords"]]
    w, e = min(p[0] for p in pts) - 0.012, max(p[0] for p in pts) + 0.012
    s, n = min(p[1] for p in pts) - 0.005, max(p[1] for p in pts) + 0.005

    ways = []
    for r in read_json(INPUT / "roads.json"):
        if not any(w <= x <= e and s <= y <= n for x, y in r["coords"]):
            continue
        kind = 0 if r.get("hw") in MAJOR else 1 if r.get("hw") in MINOR else 2  # 2 = footpaths, steps
        ways.append({"k": kind, "c": [[round(x, 5), round(y, 5)] for x, y in r["coords"]]})

    write_json(OUT / "streets_preview.json", {"source": "OpenStreetMap contributors (ODbL)", "bbox": [w, s, e, n], "ways": ways})
    print(f"{len(ways)} ways")


if __name__ == "__main__":
    main()
