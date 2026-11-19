import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./mb-gestao-home-2026.js',import.meta.url),'utf8');
const ctx={console,Date,Intl,Math,esc:value=>String(value??'').replace(/[&<>"]/g,'')};
vm.createContext(ctx);vm.runInContext(source,ctx);
test('seven-day chart: daily bars, currency grid, average and marked today',()=>{
 const data={period:'7',date:'2026-11-19',start:'2026-11-13',end:'2026-11-20',total:30000,
  points:[{bucket:'2026-11-18',amount:20000},{bucket:'2026-11-19',amount:10000}]};
 const svg=ctx.mbHomeSalesChart(data);
 assert.equal((svg.match(/data-chart-value=/g)||[]).length,7);
 assert.match(svg,/Média R\$/);
 assert.match(svg,/is-today/);
 assert.match(svg,/R\$.*200/);
});
test('thirty-day chart renders 30 bins and supports empty days',()=>{
 const data={period:'30',date:'2026-11-19',start:'2026-10-21',end:'2026-11-20',total:800,points:[{bucket:'2026-11-18',amount:800}]};
 const svg=ctx.mbHomeSalesChart(data);
 assert.equal((svg.match(/data-chart-value=/g)||[]).length,30);
 assert.match(svg,/Média/);
});
test('twelve-month chart uses monthly bins and labels',()=>{
 const data={period:'12',date:'2026-11-19',start:'2025-12-01',end:'2026-11-20',total:5000,points:[{bucket:'2026-02',amount:5000}]};
 const svg=ctx.mbHomeSalesChart(data);
 assert.equal((svg.match(/data-chart-value=/g)||[]).length,12);
 assert.match(svg,/fev/i);
});
test('no sales has honest empty state without made-up bars',()=>{
 const output=ctx.mbHomeSalesChart({period:'7',date:'2026-11-19',start:'2026-11-13',end:'2026-11-20',total:0,points:[]});
 assert.match(output,/Nenhuma venda/);
 assert.doesNotMatch(output,/<rect/);
});
