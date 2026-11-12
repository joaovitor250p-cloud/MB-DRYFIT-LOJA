import {mkdtemp,mkdir,copyFile,readdir,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const output=resolve(process.argv[2]||'/tmp/mb-for-her-release.tar');
const stage=await mkdtemp(join(tmpdir(),'mb-release-'));
try{
 for(const dir of ['.openai','dist/server','drizzle','migrations'])await mkdir(join(stage,dir),{recursive:true});
 await copyFile('.openai/hosting.json',join(stage,'.openai/hosting.json'));
 await copyFile('dist/server/index.js',join(stage,'dist/server/index.js'));
 for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const dir of ['drizzle','migrations'])await copyFile(join('drizzle',file),join(stage,dir,file));
 execFileSync('tar',['--sort=name','-cf',output,'-C',stage,'.openai/hosting.json','dist/server/index.js','drizzle','migrations']);
 console.log(output);
}finally{await rm(stage,{recursive:true,force:true})}
