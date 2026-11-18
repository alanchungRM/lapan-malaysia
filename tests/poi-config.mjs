import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {loadPoiBuild} from '../scripts/poi-config.mjs';
const directory=await mkdtemp(join(tmpdir(),'lapan-poi-config-'));
try{
 await mkdir(join(directory,'data'));await mkdir(join(directory,'worker'));
 let built=await loadPoiBuild({directory,env:{}});assert.equal(built.regionalPoiData.count,0);assert.equal(built.poiPagesOrigin,null);
 const manifest={release:'fixture',count:1,blockSize:256,indexGroupSize:32,bucketCount:256,dataset:'a'.repeat(20),storedBytes:100,fileCount:2,largestFileBytes:50};
 const env={LAPAN_POI_PAGES_ORIGIN:'https://poi-fixture.pages.dev'};
 await assert.rejects(()=>loadPoiBuild({directory,env}),/manifest/);
 await writeFile(join(directory,'data/poi-pages-manifest.json'),JSON.stringify(manifest));
 built=await loadPoiBuild({directory,env});assert.equal(built.regionalPoiData.externalBase,env.LAPAN_POI_PAGES_ORIGIN+'/'+manifest.dataset);assert.equal(built.poiIndexBytes,100);assert.ok(!built.regionalPoiData.blocks,'external build needs no bundled source data');
 for(const origin of ['http://poi-fixture.pages.dev','https://other.example','https://poi-fixture.pages.dev/path','https://user:password@poi-fixture.pages.dev','https://poi-fixture.pages.dev/?x=1'])await assert.rejects(()=>loadPoiBuild({directory,env:{LAPAN_POI_PAGES_ORIGIN:origin}}),/origin/);
 await writeFile(join(directory,'data/poi-pages-origin.json'),JSON.stringify({origin:env.LAPAN_POI_PAGES_ORIGIN}));assert.equal((await loadPoiBuild({directory,env:{}})).poiPagesOrigin,env.LAPAN_POI_PAGES_ORIGIN);
 await writeFile(join(directory,'worker/poi-data.json'),JSON.stringify({release:'fixture',count:2,index:{},blocks:{}}));await assert.rejects(()=>loadPoiBuild({directory,env}),/match source/);
 await rm(join(directory,'data/poi-pages-origin.json'));built=await loadPoiBuild({directory,env:{}});assert.equal(built.regionalPoiData.count,2);assert.equal(built.poiPagesOrigin,null);
}finally{await rm(directory,{recursive:true,force:true})}
console.log('PASS: independent POI configuration, metadata-only external build, unconfigured fallback, origin validation and snapshot mismatch protection');
