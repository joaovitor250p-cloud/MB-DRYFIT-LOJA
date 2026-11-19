/* Staff order adjustments and owner variation promotions (both stores). */
function mbMoneyInput(cents){return (Math.max(0,cents||0)/100).toFixed(2)}
function mbOrderAdjustmentDialog(title){
 const old=document.querySelector('#mbOrderAdjustmentModal');if(old){if(old.open)old.close();old.remove()}
 const d=document.createElement('dialog');d.id='mbOrderAdjustmentModal';d.className='mb-adjustment-modal';
 d.innerHTML='<div class="modal-head"><h2>'+title+'</h2><button type="button" aria-label="Fechar">✕</button></div><div id="mbAdjustmentContent"></div>';
 document.body.append(d);d.querySelector('[aria-label="Fechar"]').onclick=()=>d.close();d.showModal();return d
}
function setupMBStaffOrderActions(d,o,agents){
 if(!o)return;
 // Addresses are private order details for staff; never shown in the public catalog.
 if(o.delivery_mode!=='pickup'){
  let address=null;try{address=JSON.parse(o.delivery_notes||'{}').shipping_address}catch{}
  if(address){
   const pane=document.createElement('section');pane.className='mb-order-shipping-address';
   const fields=[address.street+', '+address.number,address.complement,address.district,address.city+' - '+address.state,address.postcode].filter(Boolean);
   pane.innerHTML='<h3>Endereço de entrega</h3><p>'+fields.map(esc).join(' · ')+'</p>';
   pane.insertAdjacentHTML('beforeend','<button type="button" class="secondary" data-copy-delivery>Copiar endereço completo</button>');
   pane.querySelector('[data-copy-delivery]').onclick=async()=>{try{await navigator.clipboard.writeText(fields.join(' · '));toast('Endereço copiado.')}catch{toast('Não foi possível copiar automaticamente.')}};
   d.append(pane);
  }
 }
 if(o.sale_batch_id||['cancelled','completed','paid'].includes(o.status))return;
 const controls=document.createElement('section');controls.className='mb-order-adjustment-controls';
 controls.innerHTML='<h3>Atendimento deste pedido</h3><p class="sub">É possível trocar o responsável e editar peças enquanto o pedido não foi pago.</p><div class="actions"><button type="button" class="secondary" id="mbTransferOrder">Alterar vendedor</button><button type="button" class="secondary" id="mbEditOrderItems">Adicionar / remover peças</button></div>';
 d.append(controls);
 controls.querySelector('#mbTransferOrder').onclick=()=>{
  const modal=mbOrderAdjustmentDialog('Transferir vendedor do pedido');
  const content=modal.querySelector('#mbAdjustmentContent');
  content.innerHTML='<p>Responsável atual: <strong>'+esc(o.agent_name||'Não definido')+'</strong></p><form id="mbTransferForm"><label>Novo vendedor<select name="agent_id" required><option value="">Selecione</option>'+agents.filter(a=>a.active&&a.id!==o.agent_id).map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+'</option>').join('')+'</select></label><label>Motivo da mudança (obrigatório)<textarea name="reason" required minlength="8" maxlength="250" placeholder="Ex.: Dedé faltou; Ramon assumiu a separação."></textarea></label><p role="alert" id="mbTransferError"></p><button class="primary">Transferir e registrar histórico</button></form>';
  content.querySelector('#mbTransferForm').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('button');b.disabled=true;try{const data=await api('mb-order/'+o.id+'/transfer','PUT',{agent_id:f.elements.agent_id.value,reason:f.elements.reason.value.trim()});o.agent_id=data.agent_id;o.agent_name=data.agent_name;modal.close();d.close();toast('Pedido transferido para '+data.agent_name+'. A venda ficará com esse vendedor.');renderOnlineOrders()}catch(error){content.querySelector('#mbTransferError').textContent=error.message}finally{b.disabled=false}};
 };
 controls.querySelector('#mbEditOrderItems').onclick=()=>mbOpenOrderItemEditor(o,d);

}
async function renderMBPromotions(){
 const root=document.querySelector('#view');
 root.innerHTML='<div class="heading"><div><span class="eyebrow">MB / PROMOÇÕES</span><h2>Promoções por cor e tamanho</h2><p class="sub">O preço normal permanece cadastrado. Apenas as variações selecionadas entram em promoção.</p></div></div><section class="panel" id="mbPromoPanel"><div id="mbPromoLoaded">Carregando promoções...</div></section>';
 let state;try{state=await api('mb-promotions')}catch(e){root.querySelector('#mbPromoLoaded').textContent=e.message;return}
 const all=products.filter(p=>p.active!==false&&p.archived_at==null&&p.price>1);
 const grouped=new Map();
 all.forEach(p=>{const key=p.model_id||p.name;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(p)});
 const options=[...grouped].map(([id,items])=>'<option value="'+esc(id)+'">'+esc(items[0].name)+' · '+items.length+' variações</option>').join('');
 let draft={...state.variants};
 const host=root.querySelector('#mbPromoLoaded');
 host.innerHTML='<label>Modelo<select id="mbPromoModel">'+options+'</select></label><div class="mb-promo-colors" id="mbPromoVariations"></div><label>Preço promocional (R$)<input type="number" id="mbPromoPrice" min="0.01" step="0.01" placeholder="29,90"></label><div class="mb-promo-schedule"><label>Começa (opcional)<input id="mbPromoStart" type="datetime-local"></label><label>Termina (opcional)<input id="mbPromoEnd" type="datetime-local"></label></div><div class="actions"><button class="secondary" id="mbAddPromotion">Aplicar às cores e tamanhos marcados</button><button class="primary" id="mbSavePromotions">Salvar promoções</button></div><p role="alert" id="mbPromoError"></p><label class="mb-catalog-soldout-toggle"><input type="checkbox" id="mbHideSoldOut"> Esconder esgotados do catálogo (desligado por padrão)</label><div id="mbPromoActive"></div>';
 host.querySelector('#mbHideSoldOut').checked=state.hide_sold_out===true;
 const model=host.querySelector('#mbPromoModel'),variations=host.querySelector('#mbPromoVariations');
 function drawVariations(){const available=grouped.get(model.value)||[];variations.innerHTML='<p>Marque somente as variações que terão desconto:</p><div class="mb-promo-variants">'+available.map(p=>'<label><input type="checkbox" data-mb-variant="'+esc(p.id)+'"><span>'+esc(p.color)+' / '+esc(p.size)+'</span><small>Normal: '+money(p.price)+'</small></label>').join('')+'</div>'}
 function drawActive(){const rows=Object.entries(draft);host.querySelector('#mbPromoActive').innerHTML='<h3>Variações com promoção</h3>'+(rows.length?rows.map(([id,p])=>{const item=all.find(x=>x.id===id);return '<div class="mb-promo-active-row" data-promo-id="'+esc(id)+'"><div><b>'+esc(item?.name||'Variação')+'</b><small>'+esc(item?.color||'')+' / '+esc(item?.size||'')+' · Normal '+money(item?.price||0)+'</small></div><strong>'+money(p.price)+'</strong><button type="button" data-remove>Remover</button></div>'}).join(''):'<p class="sub">Nenhuma promoção configurada.</p>');host.querySelectorAll('[data-promo-id]').forEach(el=>el.querySelector('[data-remove]').onclick=()=>{delete draft[el.dataset.promoId];drawActive()})}
 model.onchange=drawVariations;
 host.querySelector('#mbAddPromotion').onclick=()=>{const ids=[...variations.querySelectorAll('[data-mb-variant]:checked')].map(e=>e.dataset.mbVariant);const raw=host.querySelector('#mbPromoPrice').value,price=Math.round(Number(raw)*100),start=host.querySelector('#mbPromoStart').value,end=host.querySelector('#mbPromoEnd').value;if(!ids.length||!Number.isSafeInteger(price)||price<1){host.querySelector('#mbPromoError').textContent='Escolha cor, tamanho e preço válido.';return}if(ids.some(id=>price>=(all.find(p=>p.id===id)?.price||0))){host.querySelector('#mbPromoError').textContent='O valor da promoção precisa ser menor que o preço normal.';return}for(const id of ids)draft[id]={price,enabled:true,starts_at:start?new Date(start).toISOString():null,ends_at:end?new Date(end).toISOString():null};host.querySelector('#mbPromoError').textContent='';drawActive()};
 host.querySelector('#mbSavePromotions').onclick=async()=>{const b=host.querySelector('#mbSavePromotions');b.disabled=true;try{const result=await api('mb-promotions','PUT',{revision:state.revision,hide_sold_out:host.querySelector('#mbHideSoldOut').checked,variants:Object.entries(draft).map(([id,p])=>({id,...p}))});state.revision=result.revision;toast('Promoções salvas. Os preços são recalculados no servidor.') }catch(e){host.querySelector('#mbPromoError').textContent=e.message}finally{b.disabled=false}};
 drawVariations();drawActive();
}
