"""Extract mapped enforcement cameras from a Geofabrik PBF into web/speed-cameras.json (ODbL).
Run: python -m pip install osmium
python scripts/extract-speed-cameras.py /path/to/malaysia-singapore-brunei.osm.pbf
Only cameras that OpenStreetMap contributors have mapped appear. The count is printed, and the app shows it, so nobody assumes full coverage.
"""
import sys,json,re,osmium
from pathlib import Path
KIND={'maxspeed':'speed','red_light_camera':'redlight','traffic_signals':'redlight','average_speed':'average'}
def limit(raw):
 m=re.fullmatch(r'\s*(\d{1,3})\s*(km/h|mph)?\s*',raw or '')
 if not m:return None
 value=round(int(m.group(1))*(1.609344 if m.group(2)=='mph' else 1))
 return value if 10<=value<=130 else None
def bearing(raw):
 return int(raw)%360 if raw and re.fullmatch(r'\d{1,3}',raw) and int(raw)<=360 else None
class Cameras(osmium.SimpleHandler):
 def __init__(self):
  super().__init__();self.items=[]
 def node(self,n):
  t=n.tags;enforcement=t.get('enforcement')
  if t.get('highway')!='speed_camera' and enforcement not in KIND:return
  if not n.location.valid():return
  kind=KIND.get(enforcement,'speed')
  self.items.append({'id':n.id,'point':[round(n.location.lon,6),round(n.location.lat,6)],'kind':kind,'maxspeed':limit(t.get('maxspeed')),'direction':bearing(t.get('direction'))})
def main():
 source=Path(sys.argv[1]);reader=osmium.io.Reader(str(source));timestamp=reader.header().get('osmosis_replication_timestamp');reader.close()
 h=Cameras();h.apply_file(str(source))
 data={'source':'OpenStreetMap contributors / Geofabrik','sourceUrl':'https://download.geofabrik.de/asia/malaysia-singapore-brunei.html','license':'ODbL-1.0','dataThrough':timestamp,'region':'Malaysia, Singapore and Brunei','cameras':sorted(h.items,key=lambda c:c['id'])}
 out=Path('web/speed-cameras.json');out.write_text(json.dumps(data,separators=(',',':')))
 kinds={}
 for c in h.items:kinds[c['kind']]=kinds.get(c['kind'],0)+1
 print(json.dumps({'cameras':len(h.items),'byKind':kinds,'withLimit':sum(1 for c in h.items if c['maxspeed']),'withDirection':sum(1 for c in h.items if c['direction'] is not None),'bytes':out.stat().st_size,'dataThrough':timestamp}))
main()
