// Prepare one new release. Rebuilds and deployment retries must use npm run build.
import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('../package.json',import.meta.url),pkg=JSON.parse(await readFile(file,'utf8'));
if(!/^\d+\.\d+\.\d+$/.test(pkg.version))throw Error('Expected a major.minor.patch version');
const [major,minor,patch]=pkg.version.split('.').map(Number);pkg.version=[major,minor,patch+1].join('.');
await writeFile(file,JSON.stringify(pkg,null,2)+'\n');console.log('Preparing Lapan release '+pkg.version);
await import('./build.mjs');
