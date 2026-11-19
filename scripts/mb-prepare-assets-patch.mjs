/* Patch the *frozen* cloudflare-prepare builder, not main.
 * Never deploy a Worker with detached files but without the ASSETS binding. */
import {readFile,writeFile} from 'node:fs/promises';
const file='scripts/cloudflare-prepare.mjs';
let s=await readFile(file,'utf8');
function replace(before,after){
 const n=s.split(before).length-1;
 if(n!==1)throw Error('Frozen Cloudflare packaging changed: '+before.slice(0,90));
 s=s.replace(before,after);
}
replace("import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';",
 "import {readFile,writeFile,mkdir,copyFile,readdir,cp} from 'node:fs/promises';");
replace("await mkdir(resolve(dest,'migrations'),{recursive:true});await writeFile(resolve(dest,'worker.js'),worker);",
 "await mkdir(resolve(dest,'migrations'),{recursive:true});await writeFile(resolve(dest,'worker.js'),worker);await cp(resolve(source,'dist/mb-public'),resolve(dest,'public'),{recursive:true});");
replace("main:'worker.js',compatibility_date:'2026-11-01',workers_dev:true,",
 "main:'worker.js',compatibility_date:'2026-11-01',workers_dev:true,assets:{directory:'./public',binding:'ASSETS',run_worker_first:true},");
await writeFile(file,s,'utf8');
console.log('Frozen Cloudflare packager now enforces static ASSETS and private Nex guard.');
