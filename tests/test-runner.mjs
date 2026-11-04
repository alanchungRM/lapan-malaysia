import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=await mkdtemp(join(tmpdir(),'lapan-test-runner-'));
try{
 await mkdir(join(root,'scripts'));await mkdir(join(root,'tests'));
 const runner=join(root,'scripts/test.mjs');await copyFile(new URL('../scripts/test.mjs',import.meta.url),runner);
 const run=(...args)=>spawnSync(process.execPath,[runner,...args],{cwd:tmpdir(),encoding:'utf8'});
 assert.equal(run().status,1,'empty suite must fail');
 await writeFile(join(root,'tests/b.mjs'),"console.log('SECOND_TEST')");
 await writeFile(join(root,'tests/a.cjs'),"console.log('FIRST_TEST')");
 await writeFile(join(root,'tests/ignored.txt'),"throw Error('not a test')");
 let result=run();assert.equal(result.status,0);assert.match(result.stdout,/2 of 2/);assert.ok(result.stdout.indexOf('FIRST_TEST')<result.stdout.indexOf('SECOND_TEST'));
 result=run('b.mjs');assert.equal(result.status,0);assert.match(result.stdout,/1 of 1/);assert.ok(!result.stdout.includes('FIRST_TEST'));
 assert.equal(run('no-matching-test').status,1,'typos in a filter must fail');
 await writeFile(join(root,'tests/b.mjs'),"process.exitCode=1");
 result=run();assert.equal(result.status,1);assert.match(result.stderr,/Failed: b.mjs/);
 console.log('PASS: test discovery, deterministic order, filtering, failed-test exit, zero-match failure and execution outside project directory');
}finally{await rm(root,{recursive:true,force:true})}
