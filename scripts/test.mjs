// Adapted from dandycrypto's public PR #15. Discover test files automatically.
import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),only=process.argv[2];
const files=(await readdir(new URL('../tests/',import.meta.url),{withFileTypes:true}))
 .filter(f=>f.isFile()&&/\.(cjs|mjs)$/.test(f.name)&&(!only||f.name.includes(only)))
 .map(f=>f.name).sort();
if(!files.length){console.error(only?'No test files match: '+only:'No test files found.');process.exit(1)}
const failed=[];
for(const file of files){
 const run=spawnSync(process.execPath,['tests/'+file],{cwd:root,stdio:'inherit'});
 if(run.error||run.signal||run.status!==0){failed.push(file);if(run.error||run.signal)console.error(file+': '+(run.error?.message||run.signal))}
}
console.log(`\n${files.length-failed.length} of ${files.length} test files passed`);
if(failed.length){console.error('Failed: '+failed.join(', '));process.exitCode=1}
