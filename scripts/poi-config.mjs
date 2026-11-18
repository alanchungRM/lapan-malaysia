// Deployment-specific POI hosting is supplied at build time, never hardcoded.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
export async function loadPoiBuild({directory=process.cwd(),env=process.env}={}){
 const json=async path=>{try{return JSON.parse(await readFile(resolve(directory,path),'utf8'))}catch(error){if(error.code==='ENOENT')return null;throw error}};
 const poiPagesManifest=await json('data/poi-pages-manifest.json');
 const configured=env.LAPAN_POI_PAGES_ORIGIN||(await json('data/poi-pages-origin.json'))?.origin;
 let regionalPoiData=await json('worker/poi-data.json');
 if(configured){
  const url=new URL(configured);
  if(url.protocol!=='https:'||!url.hostname.endsWith('.pages.dev')||url.pathname!=='/'||url.search||url.hash||url.username||url.password||url.port)throw Error('Expected a Cloudflare Pages HTTPS origin');
  const manifest=poiPagesManifest;
  if(!manifest||!Number.isSafeInteger(manifest.count)||manifest.count<=0||!Number.isSafeInteger(manifest.blockSize)||manifest.blockSize<=0||!Number.isSafeInteger(manifest.indexGroupSize)||manifest.indexGroupSize<=0||!Number.isSafeInteger(manifest.bucketCount)||manifest.bucketCount<=0||typeof manifest.release!=='string'||!/^[a-f0-9]{20}$/.test(manifest.dataset)||!Number.isSafeInteger(manifest.storedBytes)||manifest.storedBytes<=0)throw Error('Missing or invalid generated POI Pages manifest');
  if(regionalPoiData&&(manifest.count!==regionalPoiData.count||manifest.release!==regionalPoiData.release))throw Error('POI Pages manifest does not match source snapshot');
  return {regionalPoiData:{...manifest,externalBase:url.origin+'/'+manifest.dataset},poiIndexBytes:manifest.storedBytes,poiPagesManifest,poiPagesOrigin:url.origin};
 }
 if(!regionalPoiData){try{regionalPoiData=JSON.parse(gunzipSync(await readFile(resolve(directory,'worker/poi-data.json.gz'))).toString('utf8'))}catch(error){if(error.code!=='ENOENT')throw error;regionalPoiData={release:'unprepared',count:0,blockSize:256,index:{},blocks:{}}}}
 if(regionalPoiData.blocksFile)regionalPoiData.blocks=JSON.parse(gunzipSync(await readFile(resolve(directory,'worker',regionalPoiData.blocksFile))).toString('utf8'));
 return {regionalPoiData,poiIndexBytes:Buffer.byteLength(JSON.stringify(regionalPoiData),'utf8'),poiPagesManifest,poiPagesOrigin:null};
}
