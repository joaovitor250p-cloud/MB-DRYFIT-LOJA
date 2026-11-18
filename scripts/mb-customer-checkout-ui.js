/* Customer checkout: addresses only when shipping, pickup address only MB Dryfit.
 * The IBGE directory limits cities to the selected state; CEP lookup is
 * optional assistance and never silently replaces customer-entered details.
 */
const MB_PICKUP_ADDRESS='Rua Monsenhor Andrade, 811, Loja L1390, 1º andar, Brás, São Paulo - SP, Brasil';
const mbCheckoutGeography={states:[],cities:[],loadedState:''};
function mbPickupChooser(){
 let d=document.getElementById('mbPickupChooser');
 if(!d){d=document.createElement('dialog');d.id='mbPickupChooser';d.className='mb-pickup-map-dialog';document.body.append(d)}
 const q=encodeURIComponent(MB_PICKUP_ADDRESS);
 d.innerHTML='<h3>Como deseja chegar?</h3><p>'+MB_PICKUP_ADDRESS+'</p><div class="mb-map-links"><a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query='+q+'">Google Maps ↗</a><a target="_blank" rel="noopener" href="https://waze.com/ul?q='+q+'&navigate=yes">Waze ↗</a></div><button type="button" id="mbCloseMapChooser">Fechar</button>';
 d.querySelector('#mbCloseMapChooser').onclick=()=>d.close();
 d.querySelectorAll('a').forEach(a=>a.onclick=()=>d.close());
 if(!d.open)d.showModal();
}
function mbShippingAddressFrom(form){
 const mode=form.querySelector('[name="delivery_mode"]:checked')?.value;
 if(!mode)return null;
 if(mode==='pickup')return null;
 const values={};
 for(const field of ['state','city','district','postcode','street','number','complement']){
  values[field]=String(form.querySelector('[name="shipping_'+field+'"]')?.value||'').trim()
 }
 for(const k of ['state','city','district','postcode','street','number']){
  if(!values[k])throw Error('Informe o endereço completo de entrega: '+k+'.')
 }
 if(!/^\d{5}-?\d{3}$/.test(values.postcode))throw Error('Digite um CEP válido com 8 números.');
 if(mbCheckoutGeography.states.length&&!mbCheckoutGeography.states.some(x=>x.nome===values.state))throw Error('Escolha um estado da lista.');
 if(mbCheckoutGeography.loadedState===values.state&&mbCheckoutGeography.cities.length&&!mbCheckoutGeography.cities.some(x=>x.nome===values.city))throw Error('Escolha uma cidade do estado selecionado.');
 return values;
}
function mbCheckoutDeliveryChanged(form){
 const mode=form.querySelector('[name="delivery_mode"]:checked')?.value;
 const picker=form.querySelector('#mbCheckoutShippingFields'),pickup=form.querySelector('#mbCheckoutPickup');
 if(picker){picker.hidden=!mode||mode==='pickup';picker.querySelectorAll('[data-shipping-required]').forEach(x=>x.required=!!mode&&mode!=='pickup')}
 if(pickup)pickup.hidden=mode!=='pickup';
}
async function mbLoadStates(form){
 try{
  const response=await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
  if(!response.ok)throw Error();
  const data=await response.json();mbCheckoutGeography.states=data;
  const list=form.querySelector('#mbStateOptions');if(list)list.innerHTML=data.map(x=>'<option value="'+String(x.nome).replaceAll('"','&quot;')+'"></option>').join('');
 }catch{const status=form.querySelector('#mbRegionStatus');if(status)status.textContent='Não foi possível carregar as sugestões. Informe estado e cidade manualmente.'}
}
async function mbLoadCities(form){
 const state=form.querySelector('[name="shipping_state"]')?.value||'';
 const selected=mbCheckoutGeography.states.find(x=>x.nome.toLocaleLowerCase('pt-BR')===state.trim().toLocaleLowerCase('pt-BR'));
 const city=form.querySelector('[name="shipping_city"]'),list=form.querySelector('#mbCityOptions');
 if(city)city.value='';if(list)list.innerHTML='';
 mbCheckoutGeography.cities=[];mbCheckoutGeography.loadedState='';
 if(!selected)return;
 try{
  const res=await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados/'+selected.sigla+'/municipios');
  if(!res.ok)throw Error();
  const cities=await res.json();mbCheckoutGeography.cities=cities;mbCheckoutGeography.loadedState=selected.nome;
  if(list)list.innerHTML=cities.map(x=>'<option value="'+String(x.nome).replaceAll('"','&quot;')+'"></option>').join('');
 }catch{const status=form.querySelector('#mbRegionStatus');if(status)status.textContent='Falha ao carregar municípios. Informe a cidade manualmente.'}
}
async function mbLookupCEP(form){
 const cep=form.querySelector('[name="shipping_postcode"]')?.value.replace(/\D/g,'')||'';
 if(cep.length!==8)return;
 try{
  const res=await fetch('https://viacep.com.br/ws/'+cep+'/json/');
  if(!res.ok)throw Error();
  const data=await res.json();if(data.erro)return;
  const byState=mbCheckoutGeography.states.find(s=>s.sigla===data.uf);
  const state=form.querySelector('[name="shipping_state"]');
  if(byState&&state)state.value=byState.nome;
  await mbLoadCities(form);
  for(const [field,value] of [['city',data.localidade],['street',data.logradouro],['district',data.bairro]]){
   const input=form.querySelector('[name="shipping_'+field+'"]');if(input&&value&&!input.value)input.value=value
  }
 }catch{} // CEP assistance is optional; manual entry remains possible
}
function setupMBCheckoutExtra(form){
 const holder=form.querySelector('#mbDeliveryExtras');if(!holder)return;
 const isHer=typeof location!=='undefined'&&location.hostname.startsWith('forher.');
 holder.innerHTML='<div id="mbCheckoutPickup" hidden class="mb-checkout-address">'+
 (isHer?'<p>Retirada: confirme o local com seu vendedor.</p>':'<button type="button" id="mbPickupAddressButton">📍 '+MB_PICKUP_ADDRESS+' · Abrir rota</button>')+
 '</div><fieldset id="mbCheckoutShippingFields" hidden class="order-choice-fieldset"><legend>Endereço para envio</legend><div class="mb-address-grid">'+
 '<label>Estado *<input name="shipping_state" list="mbStateOptions" autocomplete="address-level1" data-shipping-required placeholder="Digite o estado"><datalist id="mbStateOptions"></datalist></label>'+
 '<label>Cidade *<input name="shipping_city" list="mbCityOptions" autocomplete="address-level2" data-shipping-required placeholder="Digite a cidade"><datalist id="mbCityOptions"></datalist></label>'+
 '<label>CEP *<input name="shipping_postcode" inputmode="numeric" autocomplete="postal-code" maxlength="9" data-shipping-required placeholder="00000-000"></label>'+
 '<label>Bairro *<input name="shipping_district" data-shipping-required placeholder="Bairro"></label>'+
 '<label class="wide">Rua ou avenida *<input name="shipping_street" autocomplete="address-line1" data-shipping-required placeholder="Nome da rua"></label>'+
 '<label>Número *<input name="shipping_number" data-shipping-required placeholder="Número"></label>'+
 '<label>Complemento<input name="shipping_complement" autocomplete="address-line2" placeholder="Bloco, sala, apartamento..."></label>'+
 '</div><p class="account-privacy" id="mbRegionStatus">Selecione o estado para ver somente cidades dele. Consulte o endereço antes de confirmar.</p></fieldset>';
 if(!isHer)holder.querySelector('#mbPickupAddressButton').onclick=mbPickupChooser;
 const state=form.querySelector('[name="shipping_state"]');if(state)state.addEventListener('change',()=>mbLoadCities(form));
 const postcode=form.querySelector('[name="shipping_postcode"]');if(postcode)postcode.addEventListener('change',()=>mbLookupCEP(form));
 form.querySelectorAll('[name="delivery_mode"]').forEach(input=>input.addEventListener('change',()=>mbCheckoutDeliveryChanged(form)));
 mbLoadStates(form);mbCheckoutDeliveryChanged(form);
}
