"""Shared constants and helpers for the SafeStop data scripts."""
import json
import math
import sys

sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to cp1252
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / "scripts" / "input"
OUT = ROOT / "public" / "data"

# DSCE main gate, Kumaraswamy Layout (confirmed by the team)
CENTER_LAT, CENTER_LNG = 12.908, 77.566
RADIUS_KM = 3.0
H3_RES = 9
BANDS = ["evening", "late", "night"]

# bounding box (south, west, north, east) with a little padding around the circle
_pad_km = RADIUS_KM + 0.4
_dlat = _pad_km / 111.0
_dlng = _pad_km / (111.0 * math.cos(math.radians(CENTER_LAT)))
BBOX = (CENTER_LAT - _dlat, CENTER_LNG - _dlng, CENTER_LAT + _dlat, CENTER_LNG + _dlng)

USER_AGENT = "SafeStop-prototype/0.1 (student demo project)"


def haversine_km(lat1, lng1, lat2, lng2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def write_json(path: Path, data, compact=True):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        if compact:
            json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
        else:
            json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"  wrote {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)")


def read_json(path: Path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def point_feature(lng, lat, props):
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(lng, 6), round(lat, 6)]}, "properties": props}


def feature_collection(features, **meta):
    return {"type": "FeatureCollection", **meta, "features": features}
