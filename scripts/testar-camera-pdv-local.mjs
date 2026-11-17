import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';

for(const store of ['mb-dryfit','mb-for-her']){
 const path='stores/'+store+'/worker/';
 const camera=readFileSync(path+'camera.js','utf8');
 const page=readFileSync(path+'page.html','utf8');
 const orders=readFileSync(path+'staff-workspace.js','utf8');
 assert.match(camera,/cameraScanButton/);
 assert.match(camera,/pointerdown/);
 assert.match(camera,/pointerup/);
 assert.match(camera,/cameraSingleArmed/);
 assert.match(camera,/getVideoTracks/);
 assert.match(camera,/torch:next/);
 assert.match(page,/mbPersistSaleDraft/);
 assert.match(page,/mbRestoreSaleDraft/);
 assert.match(page,/mb-pos-venda-local-v1:/);
 assert.match(orders,/typeof owner==='function'&&owner\(\)/);
 for(const file of ['camera.js','staff-workspace.js']){
  const result=spawnSync('node',['--check',path+file],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
 }
 // Existing camera integration tests must continue passing.
 const cameraTests=spawnSync('node',['--test','tests/camera.test.mjs'],{cwd:'stores/'+store,encoding:'utf8',timeout:30000});
 assert.equal(cameraTests.status,0,cameraTests.stderr+'\n'+cameraTests.stdout);

 // The real barcode callback must ignore labels when released, accept held
 // reads, and accept only one barcode from a single tap.
 const nodes=new Map();
 for(const id of ['#cameraMessage','#cameraModal','#cameraVideo','#retryCamera','#cameraDevice','#cameraScanButton','#cameraTorch'])
  nodes.set(id,{open:true,textContent:'',disabled:false,innerHTML:'',srcObject:null,setAttribute(){}});
 const $=id=>nodes.get(id);
 const ctx={$,
  navigator:{mediaDevices:{getUserMedia(){}}},
  window:{isSecureContext:true,addEventListener(){}},
  document:{addEventListener(){}},esc:s=>s,console};
 let callback,accepted=0;
 vm.createContext(ctx);vm.runInContext(camera,ctx);
 ctx.queueCameraCode=async()=>{accepted++};
 ctx.ZXingBrowser={BrowserMultiFormatOneDReader:class{
  async decodeFromVideoDevice(_device,_video,cb){callback=cb;return {stop(){}}}
 },BrowserCodeReader:{async listVideoInputDevices(){return []}}};
 await ctx.startCameraDevice();
 callback({getText:()=> '001'});assert.equal(accepted,0,'Released scanner cannot add items');
 vm.runInContext('cameraScanningHeld=true',ctx);
 callback({getText:()=> '001'});assert.equal(accepted,1,'Holding accepts scan');
 await new Promise(setImmediate);
 vm.runInContext('cameraScanningHeld=false',ctx);
 callback({getText:()=> '002'});assert.equal(accepted,1,'Release stops scan');
 vm.runInContext('cameraSingleArmed=true',ctx);
 callback({getText:()=> '003'});assert.equal(accepted,2,'Tap accepts one scan');
 await new Promise(setImmediate);
 callback({getText:()=> '004'});assert.equal(accepted,2,'Tap must not automatically continue');
 ctx.stopCamera();

 // Draft persists only per browser, store and user, with quantities restored.
 const start=page.indexOf('/* Venda local do navegador:');
 const end=page.indexOf('function renderSellerPOS(){',start);
 assert.ok(start>=0&&end>start,'Local draft implementation injected');
 const storeData=new Map();
 const storage={
  getItem:key=>storeData.get(key)??null,
  setItem:(key,value)=>storeData.set(key,value),
  removeItem:key=>storeData.delete(key)
 };
 const localCtx={localStorage:storage,crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},
  me:{id:'seller-device-A'},currentStaffStore:'dryfit',products:[{barcode:'CODE',stock:6,available_stock:6,active:true}],
  saleCart:new Map(),saleRequestId:'22222222-2222-4222-8222-222222222222',
  saleOrderId:null,saleOrderDiscount:0,salePayment:'pix',saleChannel:'physical',
  saleDiscountPercent:5,saleAgentId:'seller'};
 vm.createContext(localCtx);vm.runInContext(page.slice(start,end),localCtx);
 localCtx.saleCart.set('CODE',{product:localCtx.products[0],quantity:3});
 vm.runInContext('mbDraftRestoredKey=mbDraftKey();mbPersistSaleDraft()',localCtx);
 assert.equal(storeData.size,1);
 assert.match([...storeData.keys()][0],/dryfit:seller-device-A/);
 localCtx.saleCart.clear();vm.runInContext('mbDraftRestoredKey=null;mbRestoreSaleDraft()',localCtx);
 assert.equal(localCtx.saleCart.get('CODE').quantity,3);
 assert.equal(localCtx.salePayment,'pix');
 localCtx.currentStaffStore='her';vm.runInContext('mbRestoreSaleDraft()',localCtx);
 assert.equal(localCtx.saleCart.size,0,'Other store cannot inherit draft');
 localCtx.currentStaffStore='dryfit';vm.runInContext('mbRestoreSaleDraft()',localCtx);
 assert.equal(localCtx.saleCart.get('CODE').quantity,3,'Returning to same store restores draft');
 localCtx.me={id:'other-seller'};vm.runInContext('mbRestoreSaleDraft()',localCtx);
 assert.equal(localCtx.saleCart.size,0,'Other seller cannot inherit draft');
 console.log('PASS '+store+': press/release, single tap, flash, local restore and previous camera tests');
}
