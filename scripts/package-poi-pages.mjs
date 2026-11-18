// Export the public POI snapshot as immutable, small Cloudflare Pages assets.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const output=process.argv[2];
if(!output||!output.startsWith('/'))throw Error('Supply an absolute output directory');
const data=JSON.parse(await readFile('worker/poi-data.json','utf8'));
const blocks=data.blocks||JSON.parse(gunzipSync(await readFile('worker/'+data.blocksFile)));
const hash=createHash('sha256').update(JSON.stringify(data)).update(JSON.stringify(blocks)).digest('hex').slice(0,20);
const directory=output+'/'+hash;
await mkdir(directory+'/index',{recursive:true});await mkdir(directory+'/blocks',{recursive:true});
let storedBytes=0,fileCount=0,largestFileBytes=0;
async function asset(path,value){const text=JSON.stringify(value);const size=Buffer.byteLength(text);if(size>2000000)throw Error('POI asset exceeds runtime 2 MB bound; reduce indexGroupSize or blockSize');await writeFile(directory+'/'+path,text);storedBytes+=size;fileCount++;largestFileBytes=Math.max(largestFileBytes,size)}
const groups={};
for(const [key,value] of Object.entries(data.index))(groups[Math.floor(Number(key)/32)]??={})[key]=value;
for(const [key,value] of Object.entries(groups))await asset('index/'+key+'.json',value);
for(const [key,value] of Object.entries(blocks))await asset('blocks/'+key+'.json',{[key]:value});
const manifest={release:data.release,count:data.count,bbox:data.bbox,blockSize:data.blockSize,bucketCount:data.bucketCount,postingEncoding:data.postingEncoding,coverage:data.coverage,dataset:hash,indexGroupSize:32,storedBytes,fileCount,largestFileBytes};
await writeFile(directory+'/manifest.json',JSON.stringify(manifest));
await copyFile('data/POI_NOTICES.txt',output+'/place-data-notices.txt');
await writeFile(output+'/_headers','/'+hash+'/*\n  Cache-Control: public, max-age=31536000, immutable\n  X-Content-Type-Options: nosniff\n  Access-Control-Allow-Origin: *\n');
await writeFile(output+'/index.html','<!doctype html><html lang="en"><meta charset="utf-8"><title>Lapan Malaysia POI directory</title><h1>Lapan Malaysia POI directory</h1><p>Public Overture Maps place data for Malaysia.</p><a href="/place-data-notices.txt">Data attribution and licences</a></html>');
await writeFile('data/poi-pages-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({...manifest,totalFiles:fileCount+4,output}));
