// Regional Overture snapshot. Compressed index and record shards stay on the server.
// No AI calls, database reads/writes, user coordinates, or query logging.
const poiDecoded=new Map(),poiPending=new Map();let poiDecodedBytes=0;
function poiTokens(value){return String(value).toLowerCase().replace(/æ/g,'ae').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').match(/[\p{L}\p{N}]+/gu)||[]}
function poiBucket(word){let h=0;for(const ch of word)h=(h*31+ch.codePointAt(0))&255;return String(h)}
async function poiUnpack(key,encoded){
 if(poiDecoded.has(key)){const value=poiDecoded.get(key);poiDecoded.delete(key);poiDecoded.set(key,value);return value.data}
 if(poiPending.has(key))return poiPending.get(key);
 const task=(async()=>{if(!encoded)return null;const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));const text=await new Response(stream).text();if(text.length>2000000)throw Error('POI shard exceeds bounds');const data=JSON.parse(text),size=text.length*2;
 while(poiDecoded.size&&(poiDecodedBytes+size>3000000||poiDecoded.size>=24)){const oldest=poiDecoded.keys().next().value;poiDecodedBytes-=poiDecoded.get(oldest).size;poiDecoded.delete(oldest)}
 if(size<=3000000){poiDecoded.set(key,{data,size});poiDecodedBytes+=size}return data})();
 poiPending.set(key,task);try{return await task}finally{poiPending.delete(key)}
}
export async function searchRegionalPlaces(query,data){
 if(!data||typeof query!=='string'||query.length<3||query.length>180)return [];
 const ignored=new Set(['sdn','bhd','sendirian','berhad','syarikat','malaysia']),tokens=[...new Set(poiTokens(query).filter(w=>w.length>=2&&!ignored.has(w)))];
 if(!tokens.length||tokens.length>12)return [];
 const namespace=data.release+':'+data.count,postings=[];
 for(const word of tokens){const b=poiBucket(word),shard=await poiUnpack(namespace+':i'+b,data.index[b]),ids=shard?.[word];if(!Array.isArray(ids)||!ids.length)return [];postings.push(ids)}
 postings.sort((a,b)=>a.length-b.length);
 // Broad queries fall back to the existing search rather than scanning the directory.
 if(postings[0].length>5000)return [];
 const contains=(a,n)=>{let l=0,h=a.length-1;while(l<=h){const m=(l+h)>>1;if(a[m]===n)return true;if(a[m]<n)l=m+1;else h=m-1}return false};
 const candidates=postings[0].filter(id=>postings.every(ids=>contains(ids,id))).slice(0,32),items=[];
 for(const id of candidates){const block=Math.floor(id/data.blockSize),rows=await poiUnpack(namespace+':r'+block,data.blocks[block]),r=rows?.[id%data.blockSize];if(!r||!Number.isFinite(r[1])||!Number.isFinite(r[2]))continue;const nameTokens=poiTokens(r[0]),score=tokens.filter(t=>nameTokens.includes(t)).length+(nameTokens.join(' ')===tokens.join(' ')?100:0),label=[r[0],...r.slice(3),'Malaysia'].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', ').slice(0,300);
 if(!items.some(p=>p.item[0].toLowerCase()===label.toLowerCase()&&Math.abs(p.item[1]-r[1])<.002&&Math.abs(p.item[2]-r[2])<.002))items.push({item:[label,r[1],r[2]],score});
 }
 return items.sort((a,b)=>b.score-a.score).slice(0,8).map(x=>x.item);
}
