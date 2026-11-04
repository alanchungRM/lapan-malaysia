"""Extract a compact ODbL road speed-limit dataset from a Geofabrik PBF.
Run: python -m pip install osmium
python scripts/extract-speed-limits.py /path/to/malaysia-singapore-brunei.osm.pbf
Only ways with a plain numeric maxspeed are kept. Coverage per road class is printed so gaps stay visible.
"""
from pathlib import Path
import sys,json,math,re,osmium,importlib.util
from shapely.geometry import LineString
from shapely.prepared import prep
spec=importlib.util.spec_from_file_location("prayer_bounds",Path(__file__).with_name("extract-prayer-places.py"));bounds=importlib.util.module_from_spec(spec);spec.loader.exec_module(bounds)
MALAYSIA=prep(bounds.malaysia_boundary())
from pathlib import Path
# Local roads are excluded. Fewer than 3% of them carry a mapped limit, so a sign there would flicker on and off.
CLASSES={'motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link'}
SCALE=100000
TOLERANCE_M=3.0
def limit(raw):
 m=re.fullmatch(r'\s*(\d{1,3})\s*(km/h|mph)?\s*',raw or '')
 if not m:return None
 value=round(int(m.group(1))*(1.609344 if m.group(2)=='mph' else 1))
 return value if 10<=value<=130 else None
def meters(a,b):
 return math.hypot((b[0]-a[0])*111320*math.cos(math.radians((a[1]+b[1])/2)),(b[1]-a[1])*111320)
def simplify(points):
 if len(points)<3:return points
 a,b=points[0],points[-1];best,at=0,0
 for i in range(1,len(points)-1):
  p=points[i];dx,dy=meters(a,b),0
  # Perpendicular distance in metres using a local planar approximation.
  cos=math.cos(math.radians(p[1]));ax,ay=(b[0]-a[0])*111320*cos,(b[1]-a[1])*111320;px,py=(p[0]-a[0])*111320*cos,(p[1]-a[1])*111320
  d=math.hypot(px,py) if not (ax or ay) else abs(ax*py-ay*px)/math.hypot(ax,ay)
  if d>best:best,at=d,i
 if best<=TOLERANCE_M:return [a,b]
 return simplify(points[:at+1])[:-1]+simplify(points[at:])
class Limits(osmium.SimpleHandler):
 def __init__(self):
  super().__init__();self.ways=[];self.total={};self.mapped={}
 def way(self,w):
  kind=w.tags.get('highway')
  if kind not in CLASSES:return
  try:pts=[(n.lon,n.lat) for n in w.nodes if n.location.valid()]
  except osmium.InvalidLocationError:return
  if len(pts)<2 or len(pts)!=len(w.nodes):return
  length=sum(meters(pts[i-1],pts[i]) for i in range(1,len(pts)))
  self.total[kind]=self.total.get(kind,0)+length
  value=limit(w.tags.get('maxspeed'))
  if value is None or any(k in w.tags for k in ['maxspeed:conditional','maxspeed:forward','maxspeed:backward']):return
  if not MALAYSIA.covers(LineString(pts)):return
  self.mapped[kind]=self.mapped.get(kind,0)+length
  pts=simplify(pts);q=[(round(x*SCALE),round(y*SCALE)) for x,y in pts]
  row=[value,q[0][0],q[0][1]]
  for i in range(1,len(q)):row+=[q[i][0]-q[i-1][0],q[i][1]-q[i-1][1]]
  if len(q)>1:self.ways.append(row)
def main():
 source=Path(sys.argv[1]);reader=osmium.io.Reader(str(source));timestamp=reader.header().get('osmosis_replication_timestamp');reader.close()
 h=Limits();h.apply_file(str(source),locations=True)
 data={'source':'OpenStreetMap contributors / Geofabrik','sourceUrl':'https://download.geofabrik.de/asia/malaysia-singapore-brunei.html','license':'ODbL-1.0','dataThrough':timestamp,'region':'Malaysia (approximate boundary filter)' ,'scale':SCALE,'ways':sorted(h.ways,key=lambda r:(r[1],r[2]))}
 out=Path('web/speed-limits.json');out.write_text(json.dumps(data,separators=(',',':')))
 coverage={k:{'km':round(h.total[k]/1000),'mappedPct':round(100*h.mapped.get(k,0)/h.total[k],1)} for k in sorted(h.total)}
 print(json.dumps({'ways':len(h.ways),'bytes':out.stat().st_size,'dataThrough':timestamp,'coverage':coverage},indent=1))
main()
