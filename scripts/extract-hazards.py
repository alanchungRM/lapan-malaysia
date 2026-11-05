"""Extract road hazards from a Geofabrik PBF into web/hazards.json (ODbL).
Run: python -m pip install osmium
python scripts/extract-hazards.py /path/to/malaysia-singapore-brunei.osm.pbf
Only what OpenStreetMap contributors have mapped appears. Stored as [lon, lat] lists per kind. Kinds: toll (toll booths and gantries), rail (level crossings), bump (speed bumps, humps, tables and cushions on a road).
Points that are not on a drivable road are dropped, so a bump drawn on a footpath never triggers an alert. Sharp curves are not stored; the app finds them in the route itself.
"""
import sys,json
import osmium
from pathlib import Path
ROADS={'motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','unclassified','residential','living_street','service'}
BUMPS={'bump','hump','table','cushion','rumble_strip','chicane'}
class Roads(osmium.SimpleHandler):
 """First pass: node ids that belong to a drivable road, so hazards can be matched to a road."""
 def __init__(self):
  super().__init__();self.nodes=set()
 def way(self,w):
  if w.tags.get('highway') in ROADS and w.tags.get('access') not in ('no','private'):
   for n in w.nodes:self.nodes.add(n.ref)
class Hazards(osmium.SimpleHandler):
 def __init__(self,road_nodes):
  super().__init__();self.items=[];self.road=road_nodes
 def node(self,n):
  t=n.tags
  if not n.location.valid():return
  kind=None
  if t.get('barrier')=='toll_booth' or t.get('highway')=='toll_gantry':kind='toll'
  elif t.get('railway')=='level_crossing':kind='rail'
  elif t.get('traffic_calming') in BUMPS and t.get('traffic_calming')!='rumble_strip':kind='bump'
  if not kind:return
  if kind in ('rail','bump') and n.id not in self.road:return
  self.items.append((n.id,kind,round(n.location.lon,5),round(n.location.lat,5)))
def main():
 source=Path(sys.argv[1]);reader=osmium.io.Reader(str(source));timestamp=reader.header().get('osmosis_replication_timestamp');reader.close()
 roads=Roads();roads.apply_file(str(source),locations=False)
 h=Hazards(roads.nodes);h.apply_file(str(source))
 seen={};[seen.setdefault(i[0],i) for i in h.items]
 groups={'toll':[],'rail':[],'bump':[]}
 for _,kind,lon,lat in sorted(seen.values()):groups[kind].append([lon,lat])
 data={'source':'OpenStreetMap contributors / Geofabrik','sourceUrl':'https://download.geofabrik.de/asia/malaysia-singapore-brunei.html','license':'ODbL-1.0','dataThrough':timestamp,'region':'Malaysia, Singapore and Brunei','toll':groups['toll'],'rail':groups['rail'],'bump':groups['bump']}
 out=Path('web/hazards.json');out.write_text(json.dumps(data,separators=(',',':')))
 print(json.dumps({'byKind':{k:len(v) for k,v in groups.items()},'bytes':out.stat().st_size,'dataThrough':timestamp}))
main()

