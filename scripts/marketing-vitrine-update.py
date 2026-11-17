from pathlib import Path
import re

def put(source,old,new,path,expected=1):
    count=source.count(old)
    if count!=expected:
        raise SystemExit(f'Atualização incompatível em {path}: {old[:70]} ({count} ocorrências, esperado {expected})')
    return source.replace(old,new,expected)

for store in ('mb-dryfit','mb-for-her'):
    root=Path('stores')/store/'worker'
    # The existing D1 storefront_settings row holds small, separate per-store marketing configuration.
    appearance=root/'appearance.js'
    a=appearance.read_text()
    a=put(a,' return out;\n}',"""
 // Optional marketing properties, preserved when the owner republishes the media-only editor.
 const ids=input.marketing_new_ids??[];
 if(!Array.isArray(ids)||ids.length>500||ids.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(id)))
    throw Error('Lista de novidades inválida.');
 out.marketing_new_ids=[...new Set(ids)];
 const notice=input.marketing_notice??{};
 if(!notice||typeof notice!=='object'||Array.isArray(notice))throw Error('Comunicado inválido.');
 const image=String(notice.image_url||'').trim();
 const imageAllowed=!image||/^\\/catalogo\\/media\\/[0-9a-f-]{36}$/i.test(image)||/^https:\\/\\/[^\\s]+$/i.test(image);
 if(!imageAllowed||image.length>2000)throw Error('Use uma imagem HTTPS válida.');
 out.marketing_notice={
  title:String(notice.title||'').slice(0,85).trim(),
  text:String(notice.text||'').slice(0,700).trim(),
  image_url:image,
  enabled:notice.enabled===true
 };
 if(out.marketing_notice.enabled&&!out.marketing_notice.text)throw Error('Escreva o comunicado antes de publicar.');
 return out;
}""",str(appearance))
    appearance.write_text(a)

    # Public GET returns only published marketing; owner PUT requires authenticated owner role.
    api=root/'api.js'
    code=api.read_text()
    public_anchor="if(u.pathname==='/api/shop/appearance')return handleAppearance(req,env,null);"
    public_route="""if(u.pathname==='/api/shop/marketing'){
 if(req.method!=='GET')return json({error:'Método não permitido'},405);
 const row=await env.DB.prepare("SELECT published FROM storefront_settings WHERE id='appearance'").first();
 const data=row?.published?JSON.parse(row.published):{};
 const notice=data.marketing_notice||{};
 return json({new_ids:Array.isArray(data.marketing_new_ids)?data.marketing_new_ids:[],
   notice:{title:String(notice.title||''),text:String(notice.text||''),image_url:String(notice.image_url||''),enabled:notice.enabled===true}});
}
"""
    code=put(code,public_anchor,public_route+public_anchor,str(api))
    admin_anchor="if(u.pathname.startsWith('/api/shop-admin/'))"
    route="""if(u.pathname==='/api/owner-marketing'){
 if(!owner)return json({error:'Acesso restrito ao dono.'},403);
 if(req.method==='GET'){
   const row=await env.DB.prepare("SELECT published,revision FROM storefront_settings WHERE id='appearance'").first();
   if(!row)return json({error:'Configuração indisponível.'},503);
   const p=JSON.parse(row.published);
   return json({new_ids:Array.isArray(p.marketing_new_ids)?p.marketing_new_ids:[],notice:p.marketing_notice||{enabled:false},revision:row.revision});
 }
 if(req.method!=='PUT')return json({error:'Método inválido.'},405);
 if(req.headers.get('Origin')!==u.origin)return json({error:'Origem não autorizada.'},403);
 const input=await req.json();
 const row=await env.DB.prepare("SELECT published,draft,revision FROM storefront_settings WHERE id='appearance'").first();
 if(!row)return json({error:'Configuração indisponível.'},503);
 const published=JSON.parse(row.published),draft=JSON.parse(row.draft);
 let nextIds=Array.isArray(published.marketing_new_ids)?published.marketing_new_ids:[];
 let nextNotice=published.marketing_notice||{enabled:false};
 if(input.action==='novelty'){
  if(!Array.isArray(input.ids)||input.ids.length>100||input.ids.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(id)))return json({error:'IDs de produto inválidos.'},400);
  const value=new Set(nextIds);
  for(const id of input.ids){if(input.enabled===true)value.add(id);else value.delete(id)}
  nextIds=[...value];if(nextIds.length>500)return json({error:'Limite de novidades alcançado.'},400);
 }else if(input.action==='notice'){
  const n=input.notice||{};
  const title=String(n.title||'').trim(),text=String(n.text||'').trim(),image=String(n.image_url||'').trim();
  if(title.length>85||text.length>700||n.enabled===true&&!text||image.length>2000||
     image&&!/^https:\\/\\//i.test(image)&&!/^\\/catalogo\\/media\\/[0-9a-f-]{36}$/i.test(image))
    return json({error:'Confira o texto e a imagem HTTPS do comunicado.'},400);
  nextNotice={title,text,image_url:image,enabled:n.enabled===true};
 }else return json({error:'Ação inválida.'},400);
 for(const obj of [published,draft]){obj.marketing_new_ids=nextIds;obj.marketing_notice=nextNotice}
 const update=await env.DB.prepare("UPDATE storefront_settings SET published=?,draft=?,revision=revision+1,updated_at=?,updated_by=? WHERE id='appearance' AND revision=?")
   .bind(JSON.stringify(published),JSON.stringify(draft),new Date().toISOString(),member.id,row.revision).run();
 if(update.meta.changes!==1)return json({error:'Outra alteração foi salva. Tente novamente.'},409);
 return json({ok:true,new_ids:nextIds,notice:nextNotice});
}
"""
    code=put(code,admin_anchor,route+admin_anchor,str(api))
    api.write_text(code)

    # Make the studio media-only without deleting previous owner settings or drafts.
    editor=root/'appearance-editor.js'
    e=editor.read_text()
    setup_anchor="  const form=$('#appearanceForm'),frame=$('#appearanceLivePreview');"
    media_only="""
  // Preserve legacy controls as hidden values, but make the editing workspace media-only.
  const simplifiedStyle=document.createElement('style');
  simplifiedStyle.textContent='#appearanceEditor [data-editor-section]:not([data-editor-section="banner"]),#appearanceEditor [data-editor-panel]:not([data-editor-panel="banner"]){display:none!important}'+
  '#appearanceEditor [data-editor-panel="banner"] label:not(:has([name^="banner_slide_"])) {display:none!important}'+
  '#appearanceEditor .editor-tool-nav{min-width:0!important}';
  document.getElementById('appearanceEditor').append(simplifiedStyle);
  const heading=document.querySelector('#appearanceEditor [data-editor-section="banner"]');
  if(heading)heading.textContent='Imagens e vídeos';
  queueMicrotask(()=>heading?.click());
"""
    e=put(e,setup_anchor,setup_anchor+"\n"+media_only,str(editor))
    e=e.replace('<h2>Personalizar catálogo</h2>','<h2>Imagens da vitrine</h2>',1)
    e=e.replace('Edite com liberdade. Publique só depois de conferir.','Escolha até cinco imagens ou vídeos. Salve e publique quando estiver satisfeito.',1)
    editor.write_text(e)

    # Existing photo principal / photo per color controls remain, with clearer labels.
    page=root/'page.html'
    h=page.read_text()
    h=h.replace('A primeira impressão do seu produto.','Escolher imagem principal do modelo',1)
    h=h.replace('Foto desta cor<input type="file"','Imagem desta cor<input type="file"',1)
    h=h.replace('Opcional agora. Você pode etiquetar sem foto e publicar depois.','A imagem principal aparece no catálogo. Cada cor pode ter sua própria foto; sem ela, usa a principal.',1)
    checkbox='<label class="mb-new-model-toggle" style="display:flex;align-items:center;gap:10px;margin:14px 0"><input type="checkbox" id="modelIsNew" style="width:auto"> <strong>Marcar este modelo como novidade</strong></label>'
    anchor='<label style="display:flex;align-items:center;margin-top:14px"><input type="checkbox" id="labelsAfterCreate"'
    h=put(h,anchor,checkbox+anchor,str(page))
    # The selection is loaded per model from the authenticated owner endpoint.
    h=put(h,"dialog.showModal();dialog.scrollTop=0;",
      """$('#modelForm').onsubmit=saveModel;dialog.showModal();
 fetch('/api/owner-marketing',{credentials:'same-origin'}).then(r=>r.ok?r.json():null).then(marketing=>{
   const control=$('#modelIsNew');
   if(control&&marketing){control.checked=variants.some(v=>(marketing.new_ids||[]).includes(v.id));}
 }).catch(()=>{});
}""",str(page))
    h=put(h,"const result=await api(modelEditingId?'product-models/'+modelEditingId:'product-models',modelEditingId?'PATCH':'POST',data);",
      """const result=await api('product-models','POST',data);
 try{
  const ids=[...new Set([...(result.variants||[]),...products.filter(v=>modelEditingId&&v.model_id===modelEditingId)].map(v=>v.id).filter(Boolean))];
  if(ids.length){
   const marketing=await fetch('/api/owner-marketing',{method:'PUT',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({action:'novelty',ids,enabled:!!$('#modelIsNew')?.checked})});
   if(!marketing.ok)toast('Modelo salvo. Não foi possível atualizar o destaque de novidade.');
  }
 }catch{toast('Modelo salvo. Confira a marcação de novidade.')}
 """,str(page))
    page.write_text(h)

    # Show the published notification card and sort only the public product groups.
    storefront=root/'storefront.html'
    html=storefront.read_text()
    helper="""let mbMarketingNewIds=new Set();
function mbSortNewGroups(list){
 return list.slice().sort((a,b)=>Number(b.variants.some(v=>mbMarketingNewIds.has(v.id)))-Number(a.variants.some(v=>mbMarketingNewIds.has(v.id))));
}
"""
    html=put(html,"function groups(){",helper+"function groups(){",str(storefront))
    html=put(html,"function render(){const all=groups(),visible=all.filter(isStoreGroupVisible)",
      "function render(){const all=mbSortNewGroups(groups()),visible=all.filter(isStoreGroupVisible)",str(storefront))
    html=put(html,"cards.forEach((g,i)=>drawCard(g,cardNodes[i]));",
      """cards.forEach((g,i)=>{
 drawCard(g,cardNodes[i]);
 if(g.variants.some(p=>mbMarketingNewIds.has(p.id))){
  const target=cardNodes[i]?.querySelector('.photo')||cardNodes[i];
  const tag=document.createElement('span');tag.className='mb-new-product-label';tag.textContent='NOVIDADE';target?.append(tag);
 }
});""",str(storefront))
    publicScript="""
<script>
(()=> {
 let initialized=false;
 const escNotice=value=>String(value||'');
 function drawNotice(notice){
   document.getElementById('mbStoreNotice')?.remove();
   if(!notice?.enabled||!notice.text)return;
   const item=document.createElement('aside');item.id='mbStoreNotice';item.className='mb-store-notice';
   const content=document.createElement('div');content.className='mb-notice-content';
   if(notice.image_url){
     const picture=document.createElement('img');picture.src=notice.image_url;picture.alt='Imagem do comunicado';picture.loading='lazy';
     content.append(picture);
   }
   const text=document.createElement('div');if(notice.title){const title=document.createElement('strong');title.textContent=escNotice(notice.title);text.append(title)}
   const body=document.createElement('p');body.textContent=escNotice(notice.text);text.append(body);content.append(text);
   const button=document.createElement('button');button.type='button';button.setAttribute('aria-label','Fechar comunicado');button.textContent='×';
   button.onclick=()=>item.remove();
   item.append(content,button);
   const point=document.getElementById('colecao');
   if(point)point.before(item);
 }
 async function syncMarketing(){
  try{
   const result=await fetch('/api/shop/marketing',{cache:'no-store'});if(!result.ok)return;
   const data=await result.json(),ids=Array.isArray(data.new_ids)?data.new_ids:[];
   const next=new Set(ids);
   const changed=!initialized||next.size!==mbMarketingNewIds.size||ids.some(id=>!mbMarketingNewIds.has(id));
   mbMarketingNewIds=next;initialized=true;
   if(changed&&typeof render==='function')render();
   drawNotice(data.notice);
  }catch{}
 }
 syncMarketing();
 setInterval(()=>{if(!document.hidden)syncMarketing()},60000);
})();
</script>
"""
    html=put(html,'</body></html>',publicScript+'</body></html>',str(storefront))
    css="""
.mb-new-product-label{position:absolute;left:12px;top:12px;z-index:2;background:#ff732b;color:white;font:800 10px Arial,sans-serif;letter-spacing:.05em;padding:7px 10px;border-radius:7px}
.mb-store-notice{position:relative;max-width:1270px;margin:18px auto;padding:12px 50px 12px 15px;background:#fff7f2;border:1px solid #f2d3c4;border-radius:15px;color:#29232a}
.mb-notice-content{display:flex;gap:15px;align-items:center}
.mb-notice-content img{width:100px;max-height:100px;object-fit:cover;border-radius:9px}
.mb-notice-content strong{display:block;font-size:17px;margin-bottom:5px}
.mb-notice-content p{margin:0;font-size:13px;line-height:1.5;white-space:pre-wrap}
.mb-store-notice>button{position:absolute;right:10px;top:9px;border:0;background:transparent;font-size:24px;cursor:pointer}
@media(max-width:700px){.mb-store-notice{margin:10px 12px;padding-right:36px}.mb-notice-content img{width:75px}}
"""
    html=put(html,'</style></head>',css+'</style></head>',str(storefront))
    storefront.write_text(html)
    print('Novidades e comunicados configurados em',store)
