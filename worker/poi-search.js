// Malaysian Overture snapshot. Compressed index and record shards stay on the server.
// No AI calls, database reads/writes, user coordinates, or query logging.
const poiDecoded=new Map(),poiPending=new Map();let poiDecodedBytes=0;
function poiTokens(value){return String(value).toLowerCase().replace(/æ/g,'ae').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').match(/[\p{L}\p{N}]+/gu)||[]}
function poiBucket(word,count=256){let h=0;for(const ch of word)h=(h*31+ch.codePointAt(0))&(count-1);return String(h)}
// External fetches contain only immutable shard identifiers, never search text or GPS.
const poiRemoteGroups=new Map(),poiRemotePending=new Map();let poiRemoteBytes=0;
async function poiShard(data,kind,id){
 if(!data.externalBase)return data[kind]?.[id];
 const group=kind==='index'?Math.floor(Number(id)/data.indexGroupSize):id;
 const url=data.externalBase+'/'+kind+'/'+group+'.json';
 let entry=poiRemoteGroups.get(url);
 if(!entry){
  let pending=poiRemotePending.get(url);
  if(!pending){
   pending=(async()=>{
    const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(6000)});
    if(!response.ok)throw Error('POI storage unavailable');
    const reader=response.body.getReader(),chunks=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000)throw Error('POI asset exceeds bounds');chunks.push(value)}}finally{await reader.cancel()}
    const text=await new Blob(chunks).text(),value=JSON.parse(text);
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid POI asset');
    while(poiRemoteGroups.size&&(poiRemoteBytes+size>6000000||poiRemoteGroups.size>=16)){
     const oldest=poiRemoteGroups.keys().next().value;poiRemoteBytes-=poiRemoteGroups.get(oldest).size;poiRemoteGroups.delete(oldest);
    }
    const result={value,size};poiRemoteGroups.set(url,result);poiRemoteBytes+=size;return result;
   })();poiRemotePending.set(url,pending);
  }
  try{entry=await pending}finally{if(poiRemotePending.get(url)===pending)poiRemotePending.delete(url)}
 }
 const encoded=entry.value[id];if(typeof encoded!=='string')throw Error('Missing POI shard');return encoded;
}
async function poiUnpack(key,encoded,varint=false){
 if(poiDecoded.has(key)){const value=poiDecoded.get(key);poiDecoded.delete(key);poiDecoded.set(key,value);return value.data}
 if(poiPending.has(key))return poiPending.get(key);
 const task=(async()=>{if(!encoded)return null;const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));const text=await new Response(stream).text();if(text.length>2000000)throw Error('POI shard exceeds bounds');const data=JSON.parse(text);let size=text.length*2;
 // Decode row-id differences once per index shard, before caching it.
 if(varint){
  for(const word of Object.keys(data)){
   const packed=atob(data[word]),ids=[];let value=0,shift=0,previous=0;
   for(let i=0;i<packed.length;i++){
    const byte=packed.charCodeAt(i);value+=(byte&127)*2**shift;
    if(byte&128){shift+=7;continue}
    previous+=value;ids.push(previous);value=0;shift=0;
   }
   data[word]=ids;size+=ids.length*8;
  }
 }

 while(poiDecoded.size&&(poiDecodedBytes+size>3000000||poiDecoded.size>=24)){const oldest=poiDecoded.keys().next().value;poiDecodedBytes-=poiDecoded.get(oldest).size;poiDecoded.delete(oldest)}
 if(size<=3000000){poiDecoded.set(key,{data,size});poiDecodedBytes+=size}return data})();
 poiPending.set(key,task);try{return await task}finally{poiPending.delete(key)}
}
export async function searchRegionalPlaces(query,data){
 if(!data||typeof query!=='string'||query.length<3||query.length>180)return [];
 const ignored=new Set(['sdn','bhd','sendirian','berhad','syarikat','malaysia']),tokens=[...new Set(poiTokens(query).filter(w=>w.length>=2&&!ignored.has(w)))];
 if(!tokens.length||tokens.length>12)return [];
 const namespace=(data.externalBase||'bundled')+':'+data.release+':'+data.count+':'+(data.bucketCount||256)+':'+(data.postingEncoding||'plain'),postings=[];
 for(const word of tokens){const b=poiBucket(word,data.bucketCount||256),shard=await poiUnpack(namespace+':i'+b,await poiShard(data,'index',b),data.postingEncoding==='varint'),ids=shard?.[word];if(!Array.isArray(ids)||!ids.length)return [];postings.push(ids)}
 postings.sort((a,b)=>a.length-b.length);
 // Bound the combined matches, rather than rejecting individually common words.
 // Merge sorted row ids without fetching records; retain the existing broad-query
 // and record-fetch limits, plus a fixed comparison budget for unusually large joins.
 if(!postings.length)return [];
 let matches=postings[0],budget=1000000;
 for(let i=1;i<postings.length;i++){
  const ids=postings[i],intersection=[];let a=0,b=0;
  while(a<matches.length&&b<ids.length){
   if(--budget<0)return [];
   if(matches[a]===ids[b]){intersection.push(matches[a]);a++;b++;if(i===postings.length-1&&intersection.length>5000)return []}
   else if(matches[a]<ids[b])a++;else b++;
  }
  matches=intersection;if(!matches.length)return [];
 }
 if(matches.length>5000)return [];
 const candidates=matches.slice(0,32),items=[];
 for(const id of candidates){const block=Math.floor(id/data.blockSize),rows=await poiUnpack(namespace+':r'+block,await poiShard(data,'blocks',block)),r=rows?.[id%data.blockSize];if(!r||!Number.isFinite(r[1])||!Number.isFinite(r[2]))continue;const nameTokens=poiTokens(r[0]),score=tokens.filter(t=>nameTokens.includes(t)).length+(nameTokens.join(' ')===tokens.join(' ')?100:0),label=[r[0],...r.slice(3),'Malaysia'].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', ').slice(0,300);
 if(!items.some(p=>p.item[0].toLowerCase()===label.toLowerCase()&&Math.abs(p.item[1]-r[1])<.002&&Math.abs(p.item[2]-r[2])<.002))items.push({item:[label,r[1],r[2]],score});
 }
 return items.sort((a,b)=>b.score-a.score).slice(0,8).map(x=>x.item);
}
