import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';

for(const shop of ['mb-dryfit','mb-for-her']){
 const dir='stores/'+shop+'/worker/';
 const page=readFileSync(dir+'page.html','utf8');
 const owner=readFileSync(dir+'owner-commerce.js','utf8');
 const staff=readFileSync(dir+'staff-workspace.js','utf8');
 const catalog=readFileSync(dir+'storefront.html','utf8');
 const customer=readFileSync(dir+'storefront-orders.js','utf8');
 const history=readFileSync(dir+'order-history.js','utf8');
 const helper=existsSync('scripts/mb-next-staff-editor.js')?'scripts/mb-next-staff-editor.js':'catalogos-atuais/scripts/mb-next-staff-editor.js';
 const editor=readFileSync(helper,'utf8');

 test(shop+': editor scans barcode and extra codes with leading zeros, shows available stock',()=>{
  const sandbox={};vm.createContext(sandbox);vm.runInContext(editor,sandbox);
  const rows=[{id:'a',name:'Camisa',barcode:'00012345',extra_code:'REF10002',stock:10,reserved_stock:4},{id:'b',name:'Bermuda',barcode:'00999888',stock:2}];
  assert.equal(sandbox.mbOrderProductByCode(rows,'00012345')?.id,'a');
  assert.equal(sandbox.mbOrderProductByCode(rows,'ref10002')?.id,'a');
  assert.equal(sandbox.mbOrderProductByCode(rows,'99999'),undefined);
  assert.equal(sandbox.mbOrderAvailableUnits(rows[0]),6);
  assert.equal(sandbox.mbOrderAvailableUnits({...rows[0],available_quantity:3}),3);
  assert.equal(sandbox.mbOrderAvailableUnits({...rows[0],stock:0}),0);
  assert.match(editor,/getUserMedia/);
  assert.match(editor,/BarcodeDetector/);
  assert.match(editor,/BrowserMultiFormatOneDReader/);
  assert.match(editor,/scanLocked/);
  assert.match(page,/mbOpenOrderItemEditor/);
  assert.match(page,/mbSaveOrderItems/);
 });
 test(shop+': staff queue has count, optional notification sound, and financial finalization',()=>{
  assert.match(owner,/if\(typeof staff!=='function'\|\|!staff\(\)/);
  assert.match(owner,/setInterval\(mbCheckOrders,12000\)/);
  assert.match(owner,/mbEnableSound\(!mbSoundEnabled\)/);
  assert.match(owner,/localStorage\.setItem\(mbOrderSoundKey\(\)/);
  assert.doesNotMatch(owner,/if\(typeof owner!=='function'\|\|!owner\(\)\|\|document\.hidden/);
  assert.match(staff,/mbMountOrderSoundPanel/);
  assert.match(staff,/Em andamento/);
  assert.match(staff,/Finalizados/);
  assert.match(staff,/Confirme o recebimento real/);
  assert.match(staff,/order-checkout/);
 });
 test(shop+': buyer receives finalizado and seller WhatsApp shipping note only when paid',()=>{
  assert.match(customer,/FINALIZADO/);
  assert.match(customer,/EM ANDAMENTO/);
  assert.match(customer,/o\.delivery_mode!=='pickup'&&o\.status==='done'/);
  assert.match(customer,/Conversar com meu vendedor/);
  assert.match(customer,/encodeURIComponent/);
  assert.match(history,/sale_batch_id\?'done':'received'/);
  assert.match(history,/delivery_status:order\.delivery_status/);
  assert.match(page,/data-copy-delivery/);
  assert.match(catalog,/mb-promotions-cards/);
  assert.match(catalog,/max-height:185px/);
  assert.match(catalog,/backdrop-filter:none!important/);
 });
 if(shop==='mb-for-her')test('MB For Her must not expose the masculine pickup address',()=>{
  assert.doesNotMatch(catalog,/Rua Monsenhor Andrade/i);
 });
}
