// Prepare one new release. Rebuilds and deployment retries must use npm run build.
import {validateChangelog,renderChangelogMarkdown} from './changelog.mjs';
import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('../package.json',import.meta.url),pkg=JSON.parse(await readFile(file,'utf8'));
if(!/^\d+\.\d+\.\d+$/.test(pkg.version))throw Error('Expected a major.minor.patch version');
const [major,minor,patch]=pkg.version.split('.').map(Number);const nextVersion=[major,minor,patch+1].join('.');
const notes=validateChangelog(JSON.parse(await readFile(new URL('../web/changelog.json',import.meta.url),'utf8')));if(notes[0].version!==nextVersion)throw Error('Add reviewed public release notes for '+nextVersion+' to web/changelog.json before releasing');
await writeFile(new URL('../CHANGELOG.md',import.meta.url),renderChangelogMarkdown(notes));
pkg.version=nextVersion;
await writeFile(file,JSON.stringify(pkg,null,2)+'\n');console.log('Preparing Lapan release '+pkg.version);
await import('./build.mjs');
