"""Build a local-only, minimal Overture Places coverage pilot. No production writes.
Usage: python scripts/compact-poi.py input.geojsonseq output.json.gz
Input: overturemaps download --bbox=100.70,2.55,102.00,3.85 -r 2026-10-21.0
       --connect_timeout=30 --request_timeout=120 -f geojsonseq --type=place -o input.geojsonseq
Install overturemaps in a separate tools environment, not the application dependencies.
"""
import collections,gzip,json,pathlib,sys
rows=[];seen=set();counts=collections.Counter();excluded=0;total=0
for line in open(sys.argv[1],encoding='utf-8'):
    f=json.loads(line);total+=1;p=f.get('properties',{});a=(p.get('addresses') or [{}])[0]
    name=(p.get('names') or {}).get('primary','').strip();c=f.get('geometry',{}).get('coordinates',[])
    sources=p.get('sources') or []
    if not sources or any(s.get('license') not in ('CDLA-Permissive-2.0','CC0-1.0') for s in sources):
        excluded+=1;continue
    if not name or a.get('country')!='MY' or len(c)!=2:continue
    lon,lat=c
    if not (100.70<=lon<=102.00 and 2.55<=lat<=3.85):continue
    key=(name.casefold(),round(lat,6),round(lon,6))
    if key in seen:continue
    seen.add(key)
    # No emails, phones, socials, photos, visitor data or private credentials.
    rows.append([name,round(lat,6),round(lon,6),a.get('freeform') or '',a.get('locality') or '',a.get('postcode') or ''])
    counts.update({s.get('dataset','unknown') for s in sources})
rows.sort(key=lambda r:(r[0].casefold(),r[1],r[2]))
data={'release':'2026-10-21.0','bbox':[100.70,2.55,102.00,3.85],'attribution':'Overture Maps contributors; CDLA-Permissive-2.0 and CC0-1.0. Restricted to these licenses for this trial.','rows':rows}
raw=json.dumps(data,ensure_ascii=False,separators=(',',':')).encode()
output=pathlib.Path(sys.argv[2]);output.write_bytes(gzip.compress(raw,mtime=0))
report={'raw_records':total,'eligible_unique_records':len(rows),'excluded_license_records':excluded,'compact_bytes':len(raw),'gzip_bytes':output.stat().st_size,'source_record_counts':dict(counts),'scope':'Bounding-box pilot around KL/Selangor, not a complete administrative-state extract','deployed':False,'production_cost_changes':False}
output.with_name('measurements.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
