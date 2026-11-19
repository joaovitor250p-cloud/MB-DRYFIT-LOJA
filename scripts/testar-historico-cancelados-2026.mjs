import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
for(const store of ['mb-dryfit','mb-for-her']){
 const root='stores/'+store+'/worker/';
 const client=readFileSync(root+'storefront-orders.js','utf8');
 const history=readFileSync(root+'order-history.js','utf8');
 const staff=readFileSync(root+'staff-workspace.js','utf8');
 const retail=readFileSync(root+'retail-operations.js','utf8');
 assert.match(client,/data-customer-order-state="cancelled">Cancelados<\/button>/,store+': missing customer cancelled tab');
 assert.match(client,/section\('cancelled'\)/,store+': cancelled cards not rendered');
 assert.match(client,/o\.status==='cancelled'\?'CANCELADO'/,store+': cancelled details not labeled');
 assert.match(history,/status:order\.status==='cancelled'\?'cancelled'/,store+': receipt status missing');
 assert.match(history,/state==='cancelled'[\s\S]{0,80}o\.status='cancelled'/,store+': buyer cancellation query missing');
 assert.match(staff,/data-order-tab="cancelled"/,store+': staff cancelled history tab missing');
 assert.match(staff,/data-order-cancel/,store+': no cancellation option');
 assert.match(retail,/state==='cancelled'[\s\S]{0,80}o\.status='cancelled'/,store+': staff cancellation filter missing');
 assert.match(retail,/instr\(lower\(o\.short_code\)/,store+': short order code not searchable');
 console.log(store+': cancelled status, private customer history, staff history and short-code search OK');
}
