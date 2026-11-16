import {test} from 'node:test';
import assert from 'node:assert/strict';
import {uploadPhoto,MAX_PHOTO_BYTES} from '../worker/photo-upload.js';

const JPEG=Uint8Array.from([255,216,255,224,0,16,74,70,73,70,0,0,1,2,3,4]);
const PNG=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
const WEBP=Uint8Array.from([82,73,70,70,24,0,0,0,87,69,66,80,0,0]);
function bucket(){const items=[];return {items,async put(key,data,options){items.push({key,bytes:new Uint8Array(data),options})}}}
function req(type,body,headers={}){return new Request('https://mb.test/api/upload',{method:'POST',headers:{'Content-Type':type,...headers},body});}

test('real JPEG/PNG/WebP are accepted, with matching original bytes and immutable keys',async()=>{
 for(const [mime,bytes] of [['image/jpeg',JPEG],['image/png',PNG],['image/webp',WEBP]]){
  const b=bucket(),response=await uploadPhoto(req(mime,bytes),b);
  assert.equal(response.status,200);
  const result=await response.json();
  assert.match(result.photo,/^\/api\/photos\/[a-f0-9-]{36}$/);
  assert.equal(b.items.length,1);
  assert.equal(b.items[0].key,'photos/'+result.photo.slice('/api/photos/'.length));
  assert.deepEqual(b.items[0].bytes,bytes);
  assert.equal(b.items[0].options.httpMetadata.contentType,mime);
 }
});
test('unsupported types, mismatched signatures and empty uploads never write to R2',async()=>{
 const b=bucket();
 for(const [mime,bytes] of [['image/svg+xml',JPEG],['image/jpeg',PNG],['image/png',JPEG],['image/webp',JPEG],['image/png',new Uint8Array(0)],['image/jpeg',new TextEncoder().encode('<script>alert(1)</script>')]]){
  const response=await uploadPhoto(req(mime,bytes),b);
  assert.equal(response.status,400);
 }
 assert.equal(b.items.length,0);
});
test('Content-Length and actual streaming body are bounded by 5 MB before uploading',async()=>{
 const b=bucket();
 const early=await uploadPhoto(req('image/jpeg',JPEG,{'Content-Length':String(MAX_PHOTO_BYTES+1)}),b);
 assert.equal(early.status,413);
 const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(MAX_PHOTO_BYTES+1));controller.close()}});
 const oversized=new Request('https://mb.test/api/upload',{method:'POST',headers:{'Content-Type':'image/jpeg'},duplex:'half',body:stream});
 assert.equal((await uploadPhoto(oversized,b)).status,413);
 assert.equal(b.items.length,0);
});
test('R2 failure returns a generic error and no successful photo URL',async()=>{
 const b={async put(){throw Error('secret bucket credentials')}};
 const response=await uploadPhoto(req('image/jpeg',JPEG),b);
 assert.equal(response.status,503);
 assert.doesNotMatch(JSON.stringify(await response.json()),/secret bucket credentials/);
});
