import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

function screen(role='owner',store='dryfit',storage=new Map()){
 const {document}=parseHTML('<html><body><main id="view"></main></body></html>');
 const calls=[],navigations=[];
 const ctx={
  document,me:{id:'owner-1',email:'dono@example.test'},owner:()=>role==='owner',
  $:s=>document.querySelector(s),
  esc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  localStorage:{
   getItem(key){return storage.has(key)?storage.get(key):null},
   setItem(key,value){storage.set(key,String(value))}
  },
  api:async(path,method='GET',body)=>{
   calls.push({path,method,body});
   if(path==='retail/settings')return {minimum_stock:6,photos_enabled:false};
   if(path==='retail/stock-alerts'&&method==='POST')return {ok:true};
   throw Error('Unexpected API '+path);
  },
  workspaceGo:id=>navigations.push(id)
 };
 vm.createContext(ctx);
 const code=readFileSync('worker/staff-sales.js','utf8');
 vm.runInContext(code,ctx);
 // Real source declares the current store internally, no string substitution needed.
 return {ctx,document,calls,navigations,storage};
}
async function paint(s){await s.ctx.renderVendorAccess();return s.document.querySelector('#view')}
test('configurações reais exibem funções sem downloads ou backups falsos',async()=>{
 const s=screen();
 const view=await paint(s);
 assert.match(view.textContent,/Configurações/);
 assert.match(view.textContent,/MB Dryfit/);
 assert.ok(view.querySelector('#ownerSettingsBarcodeMode'));
 assert.ok(view.querySelector('#ownerSettingsStockMinimum'));
 assert.equal(view.querySelector('#ownerSettingsStockMinimum').value,'6');
 assert.equal(view.querySelector('#ownerSettingsStockMinimum').disabled,false);
 assert.equal(view.querySelector('#ownerSettingsStockSave').disabled,false);
 assert.match(view.querySelector('#ownerSettingsBackupStatus').textContent,/preparação/);
 assert.equal(view.querySelectorAll('button[data-backup-download],a[download]').length,0);
 assert.ok(s.calls.some(c=>c.path==='retail/settings'&&c.method==='GET'));
 view.querySelector('[data-owner-settings-go="labels"]').onclick();
 assert.deepEqual(s.navigations,['labels']);
});
test('código manual persiste por conta e loja neste dispositivo sem mudar códigos existentes',async()=>{
 const store=new Map(),s=screen('owner','dryfit',store);
 const view=await paint(s),select=view.querySelector('#ownerSettingsBarcodeMode');
 assert.equal(s.ctx.ownerBarcodePreference(),'auto');
 select.value='manual';select.onchange({target:select});
 assert.equal(s.ctx.ownerBarcodePreference(),'manual');
 const another=screen('owner','dryfit',store);
 assert.equal(another.ctx.ownerBarcodePreference(),'manual');
 another.ctx.me.id='other-owner';
 assert.equal(another.ctx.ownerBarcodePreference(),'auto');
 assert.equal(store.size,1);
 assert.match(view.querySelector('#ownerSettingsBarcodeStatus').textContent,/salva neste aparelho/);
});
test('somente dono acessa preferências e mínimo é salvo pela API protegida',async()=>{
 const denied=screen('seller');
 await paint(denied);
 assert.equal(denied.document.querySelector('#view').innerHTML,'');
 assert.equal(denied.calls.length,0);
 const s=screen(),view=await paint(s),minimum=view.querySelector('#ownerSettingsStockMinimum');
 minimum.value='9';
 await view.querySelector('#ownerSettingsStockForm').onsubmit({preventDefault(){}});
 assert.ok(s.calls.some(c=>c.path==='retail/stock-alerts'&&c.method==='POST'&&c.body.minimum===9));
 assert.match(view.querySelector('#ownerSettingsStockStatus').textContent,/salvo/);
 minimum.value='-1';
 await view.querySelector('#ownerSettingsStockForm').onsubmit({preventDefault(){}});
 assert.equal(s.calls.filter(c=>c.method==='POST').length,1);
});
