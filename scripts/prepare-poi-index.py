"""Compile license-filtered Overture Places into bounded server search shards.

Usage: python scripts/prepare-poi-index.py places.json.gz worker/poi-data.json
"""
import base64
import collections
import gzip
import json
import pathlib
import re
import sys
import unicodedata

BUCKET_COUNT = 2048
BLOCK_SIZE = 4096


def tokens(value):
    value = unicodedata.normalize('NFKD', str(value).lower().replace('æ', 'ae'))
    return re.findall(r'[^\W_]+', ''.join(c for c in value if not unicodedata.combining(c)), re.UNICODE)


def bucket(word):
    result = 0
    for char in word:
        result = (result * 31 + ord(char)) & (BUCKET_COUNT - 1)
    return str(result)


def pack(value):
    raw = json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()
    return base64.b64encode(gzip.compress(raw, mtime=0)).decode()


def pack_postings(shard):
    encoded = {}
    for word, ids in shard.items():
        differences = bytearray()
        previous = 0
        for row_id in ids:
            value = row_id - previous
            previous = row_id
            while value >= 128:
                differences.append((value & 127) | 128)
                value >>= 7
            differences.append(value)
        encoded[word] = base64.b64encode(differences).decode()
    return pack(encoded)


with gzip.open(sys.argv[1], 'rt', encoding='utf-8') as handle:
    source = json.load(handle)
rows = source['rows']
index = collections.defaultdict(dict)
for row_id, row in enumerate(rows):
    for word in set(tokens(' '.join([row[0], *row[3:]]))):
        if len(word) < 2:
            continue
        shard = index[bucket(word)]
        postings = shard.setdefault(word, [])
        postings.append(row_id)
blocks = {str(i // BLOCK_SIZE): pack(rows[i:i + BLOCK_SIZE]) for i in range(0, len(rows), BLOCK_SIZE)}
data = {
    'release': source['release'], 'count': len(rows), 'bbox': source['bbox'],
    'blockSize': BLOCK_SIZE, 'bucketCount': BUCKET_COUNT, 'postingEncoding': 'varint',
    'coverage': source.get('coverage', 'Regional directory: KL and surrounding Selangor areas'),
    'index': {key: pack_postings(shard) for key, shard in index.items()}, 'blocksFile': 'poi-blocks.json.gz'
}
output = pathlib.Path(sys.argv[2])
record_path = output.with_name(data['blocksFile'])
record_path.write_bytes(gzip.compress(json.dumps(blocks, separators=(',', ':')).encode(), mtime=0))
with output.open('w') as handle:
    json.dump(data, handle, separators=(',', ':'))
    handle.write('\n')
print(json.dumps({'records': len(rows), 'index_shards': len(index), 'record_blocks': len(blocks),
                  'packed_bytes': len(json.dumps(data, separators=(',', ':'))) + record_path.stat().st_size}))
