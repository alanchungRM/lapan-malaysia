"""Extract a compact ODbL traffic-signal location dataset from a Geofabrik PBF.
Run: python -m pip install osmium
python scripts/extract-signals.py /path/to/malaysia-singapore-brunei.osm.pbf
"""
import sys,json,osmium
from pathlib import Path
source=Path(sys.argv[1]);reader=osmium.io.Reader(str(source));header=reader.header();timestamp=header.get('osmosis_replication_timestamp');reader.close()
class Signals(osmium.SimpleHandler):
 def __init__(self):
  super().__init__();self.points=[]
 def node(self,n):
  if n.tags.get('highway')=='traffic_signals' and n.location.valid():self.points.append([round(n.location.lon,6),round(n.location.lat,6)])
s=Signals();s.apply_file(str(source));points=sorted(set(tuple(p) for p in s.points));data={'source':'OpenStreetMap contributors / Geofabrik','sourceUrl':'https://download.geofabrik.de/asia/malaysia-singapore-brunei.html','license':'ODbL-1.0','dataThrough':timestamp,'region':'Malaysia, Singapore and Brunei','points':points};Path('web/signals.json').write_text(json.dumps(data,separators=(',',':')));print(json.dumps({'count':len(points),'dataThrough':timestamp,'bytes':Path('web/signals.json').stat().st_size}))
