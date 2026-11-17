import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
for(const store of ['mb-dryfit','mb-for-her']){
  const base='stores/'+store+'/worker/';
  const api=readFileSync(base+'api.js','utf8');
  const editor=readFileSync(base+'appearance-editor.js','utf8');
  for(const token of [
    "if(cache){const hit=await cache.match(cacheKey);if(hit)return hit}",
    "await cache.put(cacheKey,response.clone()).catch(()=>{})",
    "'Cache-Control':'public,max-age=604800,immutable'",
    "'image/webp':1048576",
    "'video/mp4':5*1048576",
    "if(!owner)return json({error:'Apenas o dono pode enviar mídias.'},403)"
  ])assert.ok(api.includes(token),store+': missing '+token);
  for(const token of ["createImageBitmap(selected)","canvas.toBlob(resolve,'image/webp',0.76)","upload=webp","1400/Math.max(bitmap.width,bitmap.height)"])assert.ok(editor.includes(token),store+': missing '+token);
  const match=editor.match(/if\(\/(\^image\\\/\(jpeg\|png\|webp\)\$)\/\.test\(selected\.type\)\)/);
  assert.ok(match,store+': regex MIME de conversão inválida');
  console.log(store+': assertions R2 compression and cache passed');
}
