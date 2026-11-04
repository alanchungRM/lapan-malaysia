"""Extract OSM Muslim places of worship from a regional Geofabrik PBF.
Usage: python scripts/extract-prayer-places.py /path/to/malaysia-singapore-brunei.osm.pbf
Requires: osmium, shapely. Reuses the app's ODbL Malaysia boundary polygons.
No network requests or visitor data. Run explicitly when refreshing the snapshot.
"""
import json,sys,math
from pathlib import Path
import osmium
from shapely.geometry import shape,Point,MultiPolygon
from shapely.ops import unary_union
from shapely.prepared import prep

def malaysia_boundary(path=Path('data/malaysia-boundary.json')):
 regions=json.loads(path.read_text())['regions']
 return unary_union([MultiPolygon([(rings[0],rings[1:]) for rings in polygons]) for polygons in regions.values()])

def selected(tags):
 return tags.get('amenity')=='place_of_worship' and tags.get('religion')=='muslim' and tags.get('access') not in ('private','no')

def record(kind,ident,tags,lat,lon):
 return {'id':f'{kind}/{ident}','name':(tags.get('name') or tags.get('name:ms') or tags.get('name:en') or 'Masjid / Surau')[:180], 'lat':round(lat,6),'lon':round(lon,6),'address':', '.join(filter(None,[tags.get('addr:housenumber'),tags.get('addr:street'),tags.get('addr:city')]))[:200],'access':tags.get('access','')[:60],'openingHours':tags.get('opening_hours','')[:160]}

class PrayerPlaces(osmium.SimpleHandler):
 def __init__(self,boundary):
  super().__init__();self.boundary=prep(boundary);self.places={};self.rejected=0;self.invalid=0;self.factory=osmium.geom.GeoJSONFactory()
 def keep(self,kind,ident,tags,lat,lon):
  if not math.isfinite(lat) or not math.isfinite(lon) or tags.get('addr:country','MY').upper() not in ('MY','MYS','MALAYSIA') or not self.boundary.covers(Point(lon,lat)):
   self.rejected+=1;return
  self.places[f'{kind}/{ident}']=record(kind,ident,tags,lat,lon)
 def node(self,n):
  if selected(n.tags) and n.location.valid():self.keep('node',n.id,n.tags,n.location.lat,n.location.lon)
 def way(self,w):
  if not selected(w.tags):return
  try:
   geom=shape(json.loads(self.factory.create_linestring(w)));point=geom.interpolate(.5,normalized=True)
   # Closed building outlines use an internal point instead of a point on their wall.
   if geom.is_ring:
    from shapely.geometry import Polygon
    point=Polygon(geom).representative_point()
   self.keep('way',w.id,w.tags,point.y,point.x)
  except (RuntimeError,ValueError):self.invalid+=1
 def area(self,a):
  if a.from_way() or not selected(a.tags):return
  try:
   point=shape(json.loads(self.factory.create_multipolygon(a))).representative_point();self.keep('relation',a.orig_id(),a.tags,point.y,point.x)
  except (RuntimeError,ValueError):self.invalid+=1

def main():
 source=Path(sys.argv[1]);reader=osmium.io.Reader(str(source));timestamp=reader.header().get('osmosis_replication_timestamp');reader.close()
 if not timestamp:raise ValueError('OSM source timestamp missing')
 boundary=malaysia_boundary();handler=PrayerPlaces(boundary);handler.apply_file(str(source),locations=True,idx='flex_mem');places=sorted(handler.places.values(),key=lambda p:p['id'])
 if not places:raise ValueError('No prayer places; refusing to overwrite snapshot')
 data={'source':'OpenStreetMap contributors / Geofabrik','sourceUrl':'https://download.geofabrik.de/asia/malaysia-singapore-brunei.html','licence':'ODbL-1.0','dataAsOf':timestamp,'coverage':'Malaysia: Peninsular Malaysia, Sabah, Sarawak and Labuan','selection':'amenity=place_of_worship + religion=muslim; access=private/no excluded','boundary':'App Malaysia state polygons: geoBoundaries gbOpen MYS ADM1 2017 (OSM-derived), rounded and grouped; boundary approximation may omit border/island places','places':places}
 overrides=Path('data/prayer-place-overrides.json')
 for correction in json.loads(overrides.read_text()) if overrides.exists() else []:
  for place in data['places']:
   if place['id']==correction['id'] and abs(place['lat']-correction['expectedPoint'][0])<.0001 and abs(place['lon']-correction['expectedPoint'][1])<.0001:
    place.update({k:correction[k] for k in ['name','address','aliases','nameSource','listingSource']})
 Path('data/prayer-places-my.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n');print(json.dumps({'count':len(places),'outsideMalaysiaRejected':handler.rejected,'invalidGeometrySkipped':handler.invalid,'dataAsOf':timestamp,'bytes':Path('data/prayer-places-my.json').stat().st_size}))
if __name__=='__main__':main()
