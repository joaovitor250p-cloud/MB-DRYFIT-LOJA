/* A seller can view contacts already present in online orders, never owner settings. */
async function mbV3SellerClients(){
 const view=document.getElementById('view');
 view.innerHTML='<section class="mb-home-panel"><h2>Clientes</h2>'+
  '<p class="sub">Contatos dos pedidos online desta loja. Para alterações de cadastro, solicite ao dono.</p>'+
  '<label>Buscar cliente <input type="search" class="search" id="mbV3ClientSearch" placeholder="Nome ou WhatsApp"></label>'+
  '<div id="mbV3ClientList" role="status">Carregando clientes…</div></section>';
 try{
  const data=await api('flexible-clients');
  if(page!=='clients')return;
  const rows=data.items||[],host=document.getElementById('mbV3ClientList');
  const draw=()=>{
   const q=document.getElementById('mbV3ClientSearch').value.toLowerCase().trim();
   const filtered=rows.filter(p=>[p.name,p.whatsapp].some(v=>String(v||'').toLowerCase().includes(q))).slice(0,100);
   host.innerHTML=filtered.length?filtered.map(p=>{
    const phone=String(p.whatsapp||'').replace(/\D/g,'');
    return '<div class="mb-v3-client"><div><b>'+esc(p.name)+'</b><small>'+esc(p.whatsapp)+' · Último pedido '+new Date(p.last_order).toLocaleDateString('pt-BR')+'</small></div>'+
     (phone.length>=12&&phone.length<=13?'<a class="secondary" target="_blank" rel="noopener" href="https://wa.me/'+phone+'?text='+encodeURIComponent('Olá, '+p.name+'! Aqui é da '+mbV3Store()+'. Como podemos ajudar?')+'">WhatsApp</a>':'')+'</div>';
   }).join(''):'<p class="sub">Nenhum cliente encontrado.</p>';
  };
  document.getElementById('mbV3ClientSearch').oninput=draw;draw();
 }catch(e){if(page==='clients')document.getElementById('mbV3ClientList').textContent=e.message}
}
