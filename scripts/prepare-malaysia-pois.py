"""Prepare Malaysian Overture places from a downloaded GeoParquet snapshot.

Run with pyarrow and shapely installed in a separate data tools environment.
Usage: python scripts/prepare-malaysia-pois.py input.parquet output.json.gz RELEASE
The resulting rows use the same format as the existing regional search index.
"""
import collections
import gzip
import json
import math
import pathlib
import sys

import pyarrow.parquet as parquet
from shapely import from_wkb

source_path, output_path, release = sys.argv[1:]
rows = []
seen = set()
regions = collections.Counter()
excluded_licenses = 0
malaysian_records = 0
allowed_licenses = {'CDLA-Permissive-2.0', 'CC0-1.0'}
for batch in parquet.ParquetFile(source_path).iter_batches(
    batch_size=8192, columns=['names', 'geometry', 'addresses', 'sources']
):
    for place in batch.to_pylist():
        address = next((a for a in place['addresses'] or [] if a.get('country') == 'MY'), None)
        if not address:
            continue
        malaysian_records += 1
        sources = place['sources'] or []
        if not sources or any(s.get('license') not in allowed_licenses for s in sources):
            excluded_licenses += 1
            continue
        name = (place['names'] or {}).get('primary', '').strip()
        point = from_wkb(place['geometry'])
        if not name or point.is_empty or point.geom_type != 'Point':
            continue
        lon, lat = point.x, point.y
        if not all(map(math.isfinite, [lon, lat])) or not (99.5 <= lon <= 119.6 and .8 <= lat <= 7.6):
            continue
        key = (name.casefold(), round(lat, 6), round(lon, 6))
        if key in seen:
            continue
        seen.add(key)
        region = address.get('region') or ''
        rows.append([name, round(lat, 6), round(lon, 6), address.get('freeform') or '',
                     address.get('locality') or '', address.get('postcode') or '', region])
        regions[region or 'Unspecified'] += 1
rows.sort(key=lambda row: (row[0].casefold(), row[1], row[2]))
data = {
    'release': release, 'country': 'MY', 'coverage': 'Malaysia, including Sabah, Sarawak and Labuan',
    'bbox': [99.5, .8, 119.6, 7.6],
    'attribution': 'Overture Maps contributors; CDLA-Permissive-2.0 and CC0-1.0.', 'rows': rows
}
output = pathlib.Path(output_path)
with gzip.open(output, 'wt', encoding='utf-8') as handle:
    json.dump(data, handle, ensure_ascii=False, separators=(',', ':'))
print(json.dumps({'malaysian_records': malaysian_records, 'eligible_unique_records': len(rows),
                  'excluded_license_records': excluded_licenses, 'regions': dict(sorted(regions.items())),
                  'gzip_bytes': output.stat().st_size}, indent=2))
