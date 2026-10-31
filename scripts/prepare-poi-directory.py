"""Rebuild the optional regional Overture directory. Public anonymous data; no API keys.
Requires Python 3 and the free overturemaps package (pip install overturemaps).
Run: python3 scripts/prepare-poi-directory.py
Or reuse an already downloaded snapshot: ... --input /path/to/places.geojsonseq
"""
import argparse,pathlib,subprocess,sys,tempfile
base=pathlib.Path(__file__).resolve().parent.parent
args=argparse.ArgumentParser();args.add_argument('--input',type=pathlib.Path);options=args.parse_args()
with tempfile.TemporaryDirectory(prefix='lapan-poi-') as scratch:
    folder=pathlib.Path(scratch);raw=options.input or folder/'places.geojsonseq'
    if options.input is None:
        subprocess.run([sys.executable,'-c','from overturemaps.cli import cli; cli()','download','--bbox=100.70,2.55,102.00,3.85','-r','2026-10-21.0','--connect_timeout=30','--request_timeout=120','-f','geojsonseq','--type=place','-o',str(raw)],check=True)
    compact=folder/'places.json.gz'
    subprocess.run([sys.executable,str(base/'scripts/compact-poi.py'),str(raw),str(compact)],check=True)
    subprocess.run([sys.executable,str(base/'scripts/prepare-poi-index.py'),str(compact),str(base/'worker/poi-data.json')],check=True)
print('Regional directory prepared. Run npm run build. Review hosting memory, CPU and deployment-size limits before deployment.')
