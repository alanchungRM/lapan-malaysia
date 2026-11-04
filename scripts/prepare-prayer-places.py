"""Import a Malaysia-only Overpass JSON extract; refresh explicitly, never per visitor.
Query: [out:json][timeout:60];area["ISO3166-1"="MY"][admin_level=2]->.my;nwr(area.my)[amenity=place_of_worship][religion=muslim];out center tags;
Usage: python3 scripts/prepare-prayer-places.py /path/to/overpass.json
"""
import json,sys
from pathlib import Path
raw=json.loads(Path(sys.argv[1]).read_text());places=[]
if raw.get('remark'):raise ValueError('Incomplete Overpass response: '+raw['remark'])
if raw.get('_bboxExtract'):raise ValueError('Use a Malaysia-only extract, not a bounding box across neighbouring countries')
for e in raw['elements']:
 t=e.get('tags',{});c=e.get('center',e);lat=c.get('lat');lon=c.get('lon')
 if t.get('amenity')!='place_of_worship' or t.get('religion')!='muslim':continue
 if t.get('access') in ('private','no'):continue
 if not isinstance(lat,(int,float)) or not isinstance(lon,(int,float)) or not (.8<=lat<=7.6 and 99<=lon<=120):continue
 name=t.get('name') or t.get('name:en') or t.get('name:ms') or 'Masjid / Surau'
 places.append({'id':str(e['type'])+'/'+str(e['id']),'name':name[:180],'lat':lat,'lon':lon,'address':', '.join(filter(None,[t.get('addr:street'),t.get('addr:city')]))[:200],'access':t.get('access','')[:60],'openingHours':t.get('opening_hours','')[:160]})
if not places:raise ValueError('No valid prayer places; refusing to replace dataset')
d={'source':'OpenStreetMap contributors','licence':'ODbL-1.0','dataAsOf':raw.get('osm3s',{}).get('timestamp_osm_base'),'places':sorted(places,key=lambda p:p['id'])}
overrides=Path('data/prayer-place-overrides.json')
for correction in json.loads(overrides.read_text()) if overrides.exists() else []:
 for place in d['places']:
  if place['id']==correction['id'] and abs(place['lat']-correction['expectedPoint'][0])<.0001 and abs(place['lon']-correction['expectedPoint'][1])<.0001:
   place.update({k:correction[k] for k in ['name','address','aliases','nameSource','listingSource']})
Path('data/prayer-places-my.json').write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n');print(len(places),'prayer places')
