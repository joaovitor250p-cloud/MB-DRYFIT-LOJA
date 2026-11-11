import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import {parseHTML} from 'linkedom';
test('settings are cleared without fetching access data or changing stored credentials',async()=>{
 const {document}=parseHTML('<html><body><main id="view"></main></body></html>');let calls=0;const ctx={document,$:s=>document.querySelector(s),owner:()=>true,api:async()=>{calls++}};vm.createContext(ctx);vm.runInContext(readFileSync('worker/staff-sales.js','utf8'),ctx);await ctx.renderVendorAccess();const view=document.querySelector('#view');assert.equal(view.textContent,'Configurações');assert.equal(view.querySelectorAll('input,select,button,a,form').length,0);assert.equal(calls,0);
});
