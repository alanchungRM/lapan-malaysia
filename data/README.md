# Traffic-light locations

`web/signals.json` is a derived OpenStreetMap database distributed under the Open Database License (ODbL) 1.0: https://opendatacommons.org/licenses/odbl/1-0/

© OpenStreetMap contributors. Attribution and license: https://www.openstreetmap.org/copyright

Source: Geofabrik Malaysia, Singapore and Brunei extract, data through 2026-10-23T20:20:51Z.
https://download.geofabrik.de/asia/malaysia-singapore-brunei.html

Only `highway=traffic_signals` node coordinates are included. The extraction script rounds coordinates to six decimal places and removes duplicate coordinates. This dataset contains mapped locations; it contains no live signal phase, countdown or congestion data. Mapping coverage is incomplete. Both nearby regional border areas and Malaysia are included in the source extract.

To refresh, download the latest regional `.osm.pbf`, install the Python `osmium` package, and run `python scripts/extract-signals.py /path/to/extract.osm.pbf` from the project root. Review and publish the updated JSON and timestamp. No automatic refresh is configured.
