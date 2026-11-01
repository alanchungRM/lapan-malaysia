// Runs every tests/*.cjs and tests/*.mjs file in name order, so adding a test never needs an edit to package.json.
import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const only=process.argv[2];
const files=(await readdir('tests')).filter(f=>/\.(cjs|mjs)$/.test(f)&&(!only||f.includes(only))).sort();
const failed=[];
for(const file of files){
 const run=spawnSync(process.execPath,['--no-warnings','tests/'+file],{stdio:'inherit'});
 if(run.status!==0)failed.push(file);
}
console.log(`\n${files.length-failed.length} of ${files.length} test files passed`);
if(failed.length){console.error('Failed: '+failed.join(', '));process.exit(1)}
