"""Build worker/toll-rates.json (Class 1 car fares for 33 Malaysian highways) from the Lapan toll dataset export.
Run: python3 scripts/build-toll-rates.py /path/to/lapan-toll-data
Reads tolls.db (highways, plazas, rates, meta). Only Class 1 is kept because the app prices a car.
Closed systems (a ticket is taken at entry) keep every published entry-to-exit pair with different plazas; open systems keep one flat fare per plaza.
Confidence per highway is the weakest of its rows: official-api > official-page > official-image/official-form > secondary.
"""
import sys,json,sqlite3,re
from pathlib import Path
ORDER=['official-api','official-page','official-form','official-image','secondary']
def main():
 root=Path(sys.argv[1]);con=sqlite3.connect(str(root/'tolls.db'));con.row_factory=sqlite3.Row
 built=con.execute("SELECT value FROM meta WHERE key='built_at'").fetchone()[0]
 out=[]
 for h in con.execute("SELECT id,name,operator,system FROM highways ORDER BY CAST(id AS TEXT)"):
  plazas=con.execute("SELECT name,lat,lon FROM plazas WHERE highway_id=? ORDER BY name",(h['id'],)).fetchall()
  index={p['name']:i for i,p in enumerate(plazas)}
  rates=[];worst=0
  for r in con.execute("SELECT entry,exit,rate_rm,confidence FROM rates WHERE highway_id=? AND vehicle_class=1",(h['id'],)):
   if r['entry'] not in index or r['exit'] not in index:continue
   if h['system']=='closed' and r['entry']==r['exit']:continue
   if h['system']=='open' and r['entry']!=r['exit']:continue
   rate=round(float(r['rate_rm']),2)
   if not 0<rate<=200:continue
   rates.append([index[r['entry']],index[r['exit']],rate]);worst=max(worst,ORDER.index(r['confidence']) if r['confidence'] in ORDER else len(ORDER)-1)
  if not rates:continue
  short=(re.findall(r'\(([^)]+)\)',h['name']) or [h['name']])[-1]
  out.append({'id':h['id'],'name':h['name'],'short':short,'operator':h['operator'],'system':h['system'],'confidence':ORDER[worst],
   'plazas':[[p['name'],round(p['lon'],6) if p['lon'] is not None else None,round(p['lat'],6) if p['lat'] is not None else None] for p in plazas],
   'rates':sorted(rates)})
 data={'builtAt':built[:10],'class':1,'source':'Lapan toll dataset: LLM calculator, PLUS API and operator pages (see SOURCES.md in that dataset)','highways':out}
 dest=Path('worker/toll-rates.json');dest.write_text(json.dumps(data,separators=(',',':'),ensure_ascii=False))
 n=sum(len(h['rates']) for h in out);withc=sum(1 for h in out for p in h['plazas'] if p[1] is not None);allp=sum(len(h['plazas']) for h in out)
 print(json.dumps({'highways':len(out),'rates':n,'plazas':allp,'plazasWithCoordinates':withc,'bytes':dest.stat().st_size,'builtAt':data['builtAt']}))
main()
