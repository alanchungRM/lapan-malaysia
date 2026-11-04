# Traffic-light locations

`web/signals.json` is a derived OpenStreetMap database distributed under the Open Database License (ODbL) 1.0: https://opendatacommons.org/licenses/odbl/1-0/

© OpenStreetMap contributors. Attribution and license: https://www.openstreetmap.org/copyright

Source: Geofabrik Malaysia, Singapore and Brunei extract, data through 2026-10-23T20:20:51Z.
https://download.geofabrik.de/asia/malaysia-singapore-brunei.html

Only `highway=traffic_signals` node coordinates are included. The extraction script rounds coordinates to six decimal places and removes duplicate coordinates. This dataset contains mapped locations; it contains no live signal phase, countdown or congestion data. Mapping coverage is incomplete. Both nearby regional border areas and Malaysia are included in the source extract.

To refresh, download the latest regional `.osm.pbf`, install the Python `osmium` package, and run `python scripts/extract-signals.py /path/to/extract.osm.pbf` from the project root. Review and publish the updated JSON and timestamp. No automatic refresh is configured.

## Traffic-aware ETA

Set the server-only `TOMTOM_API_KEY` secret to enable TomTom route reassessment. The browser sends selected remaining route geometry to the same-origin `/api/traffic-eta` endpoint; the backend sends supporting points to TomTom with current traffic enabled. No key is sent to browsers. Requests are throttled, cached for two minutes, and validated against the selected route. Provider errors or route mismatch preserve the baseline road estimate. These application throttles are not a hard monthly billing cap; control allowance and billing in the TomTom account. Real-time congestion map tiles are not enabled by this integration.

## Malaysia OSM prayer places

`prayer-places-my.json` is an ODbL-1.0 derived database of Malaysia Muslim places of worship. See PRAYER_NOTICES.txt for source, timestamp, licence and geographic limitations. Rebuild explicitly with `python scripts/extract-prayer-places.py /path/to/malaysia-singapore-brunei.osm.pbf` after installing `osmium` and `shapely`. No automatic refresh or per-visitor upstream query runs. The current dataset replaces the earlier Overture name-based trial. The reusable ODbL boundary polygons are in `data/malaysia-boundary.json`, so the extraction script works independently of private analytics code.

Only `amenity=place_of_worship` + `religion=muslim` entries qualify; `access=private/no` entries and points outside the app's Malaysia polygons are excluded. Nodes and mapped way/relation geometries are supported. The existing state polygons come from geoBoundaries gbOpen MYS ADM1 2017, OSM-derived, rounded/grouped: some border or island places may be omitted. This is a geographic and OSM-tag filter, not name matching. Entrances, opening hours and facilities are not independently verified.

The separate Overpass JSON importer remains available for future reviewed imports. Review attribution and geographic filtering before changing datasets. The derived database is downloadable at `/prayer-places.json`; source/licence notice is served at `/prayer-data-notices`.

## Staging speed-limit trial (PR #17 / #23)

Adapted from @dandycrypto's contributions. `web/speed-limits.json` is a Malaysia-filtered ODbL derived dataset generated from the Geofabrik regional extract with `python scripts/extract-speed-limits.py /path/to/extract.osm.pbf` (requires osmium and shapely). Only mapped numeric limits on motorway/trunk/primary/secondary/tertiary roads and their links are included. Conditional, directional and unmapped limits are omitted; local-road coverage is deliberately absent. Never interpret the display as authoritative. Obey posted signs. The selected 3/5/10 km/h margin changes warning sensitivity only, not the legal limit.

Data loads only when navigation begins or the user enables the feature. Route matching and warning calculations run on the device, with no new external/paid requests or journey storage. Downloaded derived data includes source/licence metadata. Approximate Malaysia boundaries may omit some border/island segments. No automated data refresh is configured.

## Staging bundled cameras (PR #24)

`web/speed-cameras.json` contains 83 OSM-mapped camera nodes (61 speed, 22 red-light) from the 2026-11-03T21:24:23Z Geofabrik regional extract, filtered to the same approximate Malaysia boundary as prayer places. This is sparse mapped coverage, not a complete enforcement database; mobile cameras are not included. © OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright. Rebuild explicitly using `python scripts/extract-speed-cameras.py /path/to/extract.osm.pbf` (osmium and shapely required). The derived database is served as `/speed-cameras.json`; the legacy `/api/cameras` endpoint serves the same data without the unsupported cache API or external lookups. No automatic refresh is configured. Adapted from @dandycrypto PR #24.
