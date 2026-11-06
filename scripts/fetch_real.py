"""Fetch real OpenStreetMap data (and police KML) for the pilot area.

Outputs (public/data/): lamps.geojson, places.geojson, transit.geojson, help.geojson
Cache (scripts/input/): osm_raw.json, roads.json

If Overpass is unreachable, this prints the query: run it at https://overpass-turbo.eu,
export the raw JSON and save it as scripts/input/osm_raw.json, then re-run this script.
"""
import re
import sys
import xml.etree.ElementTree as ET
from datetime import date

import requests

from common import BBOX, CENTER_LAT, CENTER_LNG, INPUT, OUT, USER_AGENT, feature_collection, haversine_km, point_feature, read_json, write_json

S, W, N, E = BBOX
B = f"({S:.5f},{W:.5f},{N:.5f},{E:.5f})"
WALKABLE = "primary|secondary|tertiary|residential|unclassified|living_street|service|footway|pedestrian|path|steps|trunk|primary_link|secondary_link|tertiary_link|trunk_link"
AMENITIES = "restaurant|cafe|fast_food|pharmacy|atm|fuel|hospital|clinic|police"

QUERY = f"""[out:json][timeout:120];
(way["highway"~"^({WALKABLE})$"]{B};);
out tags geom;
(
  node["highway"="street_lamp"]{B};
  nwr["amenity"~"^({AMENITIES})$"]{B};
  nwr["shop"]{B};
  node["highway"="bus_stop"]{B};
  nwr["railway"="station"]{B};
  nwr["public_transport"="station"]{B};
);
out center tags;"""

# Default closing hour when opening_hours is missing (hours after midnight go past 24)
DEFAULT_CLOSE = {
    "restaurant": 23.0, "cafe": 22.0, "fast_food": 23.5, "pharmacy": 22.0,
    "atm": 48.0, "fuel": 48.0, "hospital": 48.0, "clinic": 21.0, "police": 48.0, "shop": 21.5,
}
ALWAYS_OPEN = 48.0  # sentinel: open 24 hours


def parse_close_hour(oh: str | None):
    """Latest closing hour from an OSM opening_hours string, or None if unparseable.

    ponytail: ignores weekday rules and takes the latest close of any day; a full
    opening_hours parser would be the upgrade if accuracy matters.
    """
    if not oh:
        return None
    if "24/7" in oh or "00:00-24:00" in oh:
        return ALWAYS_OPEN
    best = None
    for o_h, o_m, c_h, c_m in re.findall(r"(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})", oh):
        open_t, close_t = int(o_h) + int(o_m) / 60, int(c_h) + int(c_m) / 60
        if close_t <= open_t:  # closes after midnight
            close_t += 24
        best = close_t if best is None else max(best, close_t)
    return best


def fetch_osm():
    cache = INPUT / "osm_raw.json"
    if "--cached" in sys.argv and cache.exists():
        print("Using cached scripts/input/osm_raw.json")
        return read_json(cache)
    print("Querying Overpass API ...")
    for url in ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"]:
        try:
            r = requests.post(url, data={"data": QUERY}, headers={"User-Agent": USER_AGENT}, timeout=180)
            r.raise_for_status()
            data = r.json()
            write_json(cache, data)
            return data
        except Exception as ex:  # network or server error: try next mirror
            print(f"  {url} failed: {ex}")
    if cache.exists():
        print("Overpass unreachable; using cached scripts/input/osm_raw.json")
        return read_json(cache)
    print("\nCould not reach Overpass. Run this query at https://overpass-turbo.eu, export raw JSON\n"
          "and save it as scripts/input/osm_raw.json, then re-run:\n")
    print(QUERY)
    sys.exit(1)


def latlng(el):
    if "lat" in el:
        return el["lat"], el["lon"]
    if "center" in el:
        return el["center"]["lat"], el["center"]["lon"]
    return None


def parse_police_kml():
    """Police stations + outposts from the OpenCity KML files, if present."""
    out = []
    for fname, kind in [("police_stations.kml", "Police station"), ("police_outposts.kml", "Police outpost")]:
        path = INPUT / fname
        if not path.exists():
            continue
        ns = {"k": "http://www.opengis.net/kml/2.2"}
        for pm in ET.parse(path).getroot().iterfind(".//k:Placemark", ns):
            coords = pm.find(".//k:coordinates", ns)
            if coords is None or not coords.text:
                continue
            lng, lat = map(float, coords.text.strip().split(",")[:2])
            name = next((sd.text for sd in pm.iterfind(".//k:SimpleData", ns) if sd.get("name", "").endswith("Name") and sd.text), kind)
            out.append((lat, lng, name.strip(), kind))
    return out


def main():
    raw = fetch_osm()
    lamps, places, transit, helps, roads = [], [], [], [], []

    for el in raw["elements"]:
        t = el.get("tags", {})
        if el["type"] == "way" and "geometry" in el and "highway" in t and t["highway"] != "bus_stop":
            roads.append({"lit": t.get("lit"), "hw": t["highway"], "coords": [[g["lon"], g["lat"]] for g in el["geometry"]]})
            continue
        ll = latlng(el)
        if not ll:
            continue
        lat, lng = ll
        name = t.get("name", "")
        if t.get("highway") == "street_lamp":
            lamps.append(point_feature(lng, lat, {}))
        elif t.get("highway") == "bus_stop":
            transit.append(point_feature(lng, lat, {"kind": "bus", "name": name or "Bus stop"}))
        elif t.get("railway") == "station" or t.get("public_transport") == "station":
            if t.get("station") == "subway" or "metro" in name.lower() or t.get("subway") == "yes" or t.get("railway") == "station":
                transit.append(point_feature(lng, lat, {"kind": "metro", "name": name or "Metro station"}))
        elif t.get("amenity") == "hospital":
            helps.append(point_feature(lng, lat, {"kind": "Hospital", "name": name or "Hospital"}))
        elif t.get("amenity") == "police":
            helps.append(point_feature(lng, lat, {"kind": "Police (OSM)", "name": name or "Police"}))
        elif t.get("amenity") or t.get("shop"):
            cat = t["amenity"] if t.get("amenity") in DEFAULT_CLOSE else "shop"
            parsed = parse_close_hour(t.get("opening_hours"))
            places.append(point_feature(lng, lat, {
                "cat": cat,
                "name": name,
                "close": parsed if parsed is not None else DEFAULT_CLOSE[cat],
                "hoursSource": "osm" if parsed is not None else "default",
            }))

    # Prefer the official police KML; fall back to OSM police if the KML is absent.
    kml = parse_police_kml()
    if kml:
        helps = [h for h in helps if h["properties"]["kind"] == "Hospital"]
        for lat, lng, name, kind in kml:
            if haversine_km(CENTER_LAT, CENTER_LNG, lat, lng) <= 8:  # nearest station may sit outside the pilot circle
                helps.append(point_feature(lng, lat, {"kind": kind, "name": name}))
        print(f"Police from OpenCity KML: {sum(1 for h in helps if 'Police' in h['properties']['kind'])}")
    else:
        print("No police KML in scripts/input/, using OSM amenity=police")

    meta = {"source": "OpenStreetMap contributors (ODbL) via Overpass API", "downloaded": date.today().isoformat()}
    write_json(OUT / "lamps.geojson", feature_collection(lamps, **meta))
    write_json(OUT / "places.geojson", feature_collection(places, **meta))
    write_json(OUT / "transit.geojson", feature_collection(transit, **meta))
    write_json(OUT / "help.geojson", feature_collection(helps, **meta, policeSource="OpenCity Bengaluru Urban police station + outpost KML" if kml else "OSM"))
    write_json(INPUT / "roads.json", roads)
    print(f"lamps={len(lamps)} places={len(places)} transit={len(transit)} help={len(helps)} roads={len(roads)}")


if __name__ == "__main__":
    main()
