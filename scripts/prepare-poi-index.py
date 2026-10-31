"""Compile a downloaded, license-filtered Overture regional trial into bounded search shards.
Usage: python scripts/prepare-poi-index.py private/poi-trial/places.json.gz worker/poi-data.json
No network calls, paid services, visitor data or database writes.
"""
import base64,gzip,json,re,sys,unicodedata,collections

def tokens(value):
    value=unicodedata.normalize('NFKD',str(value).lower().replace('æ','ae'))
    return re.findall(r'[^\W_]+',''.join(c for c in value if not unicodedata.combining(c)),re.UNICODE)
def bucket(word):
    h=0
    for ch in word:h=(h*31+ord(ch))&255
    return str(h)
def pack(value):
    b=json.dumps(value,ensure_ascii=False,separators=(',',':')).encode()
    return base64.b64encode(gzip.compress(b,mtime=0)).decode()
source=json.loads(gzip.decompress(open(sys.argv[1],'rb').read()));rows=source['rows'];index=collections.defaultdict(lambda:collections.defaultdict(list))
for i,r in enumerate(rows):
    for word in set(tokens(' '.join([r[0],*r[3:]]))):
        if len(word)>=2:index[bucket(word)][word].append(i)
blocks={str(i//256):pack(rows[i:i+256]) for i in range(0,len(rows),256)}
data={'release':source['release'],'count':len(rows),'bbox':source['bbox'],'blockSize':256,'index':{k:pack(v) for k,v in index.items()},'blocks':blocks}
open(sys.argv[2],'w').write(json.dumps(data,separators=(',',':'))+'\n')
print(json.dumps({'records':len(rows),'index_shards':len(index),'record_blocks':len(blocks),'packed_bytes':len(json.dumps(data,separators=(',',':')))}))
