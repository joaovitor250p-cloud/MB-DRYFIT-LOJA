import json,re,unicodedata,uuid,hashlib,collections,sys
from pathlib import Path
import xlrd
sheet=xlrd.open_workbook(sys.argv[1]).sheet_by_index(0)
columns=sheet.row_values(0)
source=[dict(zip(columns,sheet.row_values(i))) for i in range(1,sheet.nrows) if str(sheet.cell_value(i,columns.index('Nome'))).strip()]
web=json.loads(Path(sys.argv[2]).read_text())
def text(v):return str(int(v)) if isinstance(v,float) and v.is_integer() else str(v).strip()
def norm(v):return re.sub(r'\s+',' ',unicodedata.normalize('NFKD',text(v).upper()).encode('ascii','ignore').decode()).strip()
colors={
 'PRETA':'Preto','PRETO':'Preto','BRANCA':'Branco','BRANCO':'Branco','CHUMBO':'Chumbo','MARINHO':'Azul marinho','CINZA':'Cinza','VERDE':'Verde','MILITAR':'Verde militar','BEGE':'Bege','VERMELHA':'Vermelho','VERMELHO':'Vermelho','AZUL':'Azul','LARANJA':'Laranja','PETROLEO':'Petróleo','NEON':'Neon','AMARELO':'Amarelo','AMARELA':'Amarelo','MARROM':'Marrom','CAQUI':'Caqui','OFF':'Off-white','ROYAL':'Azul royal','PINK':'Pink','LILAS':'Lilás','ROXO':'Roxo','ROSA':'Rosa','PRETA/AZUL':'Preto / Azul',
 'VERDE AGUA':'Verde água','AZUL ACIZENTADO':'Azul acinzentado','AZUL ACINZENTADO':'Azul acinzentado','AZUL ESC':'Azul escuro','AZUL BB':'Azul bebê','AZUL PETR':'Azul petróleo','AZUL PETRO':'Azul petróleo','AZUL PETROLEO':'Azul petróleo','AZUL ROYAL':'Azul royal','VERDE MILITAR':'Verde militar','AZUL MARINHO':'Azul marinho'}
def parse(name,category):
 n=norm(name);m=re.search(r'\s+(P|M|G|GG|EG|EGG)$',n);size=m.group(1) if m else 'Único';base=n[:m.start()] if m else n;color=None
 for suffix in sorted(colors,key=len,reverse=True):
  if base.endswith(' '+suffix):color=colors[suffix];base=base[:-len(suffix)].strip();break
 warnings=[]
 if not color:color='Não informado';warnings.append('Cor não identificada no cadastro original.')
 special=n.startswith(('SEM CODIGO','PROMOCAO')) or n=='TESTE'
 if special:warnings.append('Cadastro genérico do Nex; revisar antes de vender ou publicar.')
 if base.startswith(('BERM ','BERMUDA ','BEMUDA ')):model=re.sub(r'^(BERM|BERMUDA|BEMUDA)\s+','BERMUDA ',base);kind='Bermuda'
 elif base.startswith(('CAM ','CAMISETA ','CAMISA ','REGATA ')):model=re.sub(r'^(CAM|CAMISETA|CAMISA)\s+','CAMISA ',base);kind='Camisa'
 elif base.startswith('CONJ'):model=base;kind='Conjunto'
 elif base.startswith(('CALCA ','CALCAS ')):model=base;kind='Calça'
 elif base.startswith('JAQ'):model=base;kind='Jaqueta'
 elif base.startswith('MEIA'):model=base;kind='Meias'
 else:model=base;kind='Acessório'
 brand=next((b for pattern,b in [(r'\bADIDAS\b','Adidas'),(r'\bNIKE\b','Nike'),(r'\bJORDAN\b','Jordan'),(r'\bPUMA\b','Puma'),(r'\bON\b','On')] if re.search(pattern,n)),'')
 key=norm(kind)+'|'+norm(brand)+'|'+model
 return {'model_name':model,'size':size,'color':color,'category':kind,'brand':brand,'model_key':key,'warnings':warnings,'special':special}
by_code={text(r.get('ProductCode','')):r for r in web};by_gtin=collections.defaultdict(list);by_name=collections.defaultdict(list)
for r in web:
 if r.get('BarCode'):by_gtin[text(r['BarCode'])].append(r)
 by_name[norm(r.get('ProductName',''))].append(r)
web_colors=collections.defaultdict(collections.Counter);photo_sources={};web_matches={}
for r in web:
 p=parse(r.get('ProductName',''),r.get('Category',''))
 for photo in r.get('Photos',[]):
  url=photo.get('url','');match=re.fullmatch(r'https://storage\.googleapis\.com/nexapp-flutter\.appspot\.com/production/products/([a-fA-F0-9]{32})',url)
  if match:asset='nex-'+match.group(1).lower();photo_sources[asset]=url;web_colors[(p['model_key'],p['color'])][asset]+=1
identities_path=Path('data/nex-model-identities.json')
identities=json.loads(identities_path.read_text()) if identities_path.exists() else {}
rows=[]
for index,r in enumerate(source):
 p=parse(r['Nome'],r['Categoria']);code=text(r['Código']);gtin=text(r['EAN / GTIN']);found=by_code.get(code)
 if not found and gtin and len(by_gtin[gtin])==1:found=by_gtin[gtin][0]
 if not found and len(by_name[norm(r['Nome'])])==1:found=by_name[norm(r['Nome'])][0]
 direct=[]
 if found:
  for photo in found.get('Photos',[]):
   m=re.search(r'/products/([a-fA-F0-9]{32})$',photo.get('url',''))
   if m:direct.append('nex-'+m.group(1).lower())
 stock=int(r['Estoque Atual'] or 0);reserved=int(r['Pedidos'] or 0);available=int(r['Disponível'] or 0)
 assert stock-reserved==available,(code,stock,reserved,available)
 warnings=p['warnings'][:]
 if r['Estoque Atual']=='':warnings.append('Estoque vazio na planilha; disponível informado como zero.')
 if stock<0:warnings.append('Estoque negativo na planilha do Nex: '+str(stock)+'.')
 rows.append({**p,'source_code':code,'source_gtin':gtin,'barcode':gtin or code,'id':'nex-'+str(uuid.uuid5(uuid.NAMESPACE_URL,'mbdryfit/nex/product/'+code)), 'model_id':identities.get(p['model_key']) or 'nex-'+str(uuid.uuid5(uuid.NAMESPACE_URL,'mbdryfit/nex/model/'+p['model_key'])),'name':p['model_name'],'original_name':text(r['Nome']),'original_category':text(r['Categoria']),'extra_code':text(r['Código Extra']),'price':round(float(r['Preço'] or 0)*100),'stock':stock,'reserved_stock':reserved,'source_available':available,'direct_photos':direct,'warnings':warnings,'active':not p['special'],'source_row':index+2})
# Same color shares exactly one image across all sizes; never borrow an image from another color.
group_colors=collections.defaultdict(collections.Counter)
for r in rows:
 for image in r['direct_photos']:group_colors[(r['model_key'],r['color'])][image]+=1
for r in rows:
 key=(r['model_key'],r['color']);candidates=group_colors[key] or web_colors[key]
 r['photo_key']=candidates.most_common(1)[0][0] if candidates else None
 if not r['photo_key']:r['warnings'].append('Foto desta cor não encontrada no catálogo de origem.')
 if len(candidates)>1:r['warnings'].append('Mais de uma foto no Nex para esta cor; adotada a mais recorrente entre os tamanhos.')
 r.pop('direct_photos');r.pop('model_name');r.pop('special');r['published']=False
# Preserve separate legacy records when canonical names collide; do not invent quantities or discard barcodes.
variants=collections.defaultdict(list)
for r in rows:variants[(r['name'],r['color'],r['size'])].append(r)
collisions=[v for v in variants.values() if len(v)>1]
for duplicate in collisions:
 for r in duplicate:r['warnings'].append('Possível cadastro duplicado para mesma cor/tamanho; conferir referência.');r['name']+=' · cadastro '+r['source_code'];r['model_id']='nex-'+str(uuid.uuid5(uuid.NAMESPACE_URL,'mbdryfit/nex/conflict/'+r['source_code']));r['active']=False
assets=[{'key':key,'url':photo_sources[key]} for key in sorted({r['photo_key'] for r in rows if r['photo_key']})]
summary={'rows':len(rows),'models':len({r['model_id'] for r in rows}),'colors':len({(r['model_id'],r['color']) for r in rows}),'rows_with_photo':sum(bool(r['photo_key']) for r in rows),'photos':len(assets),'negative_stock_rows':sum(r['stock']<0 for r in rows),'missing_photo_rows':sum(not r['photo_key'] for r in rows),'reserved_rows':sum(r['reserved_stock']>0 for r in rows),'canonical_collisions':len(collisions),'gtin_aliases':sum(bool(r['source_gtin']) and r['source_gtin']!=r['source_code'] for r in rows),'total_stock':sum(r['stock'] for r in rows),'total_reserved':sum(r['reserved_stock'] for r in rows)}
manifest={'id':'nex-export-20261109-'+hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest()[:16],'source':'Exportar.xls / meucomercio.com.br/mbdryfit','rows':rows,'assets':assets,'summary':summary}
Path('data/nex-import.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n')
Path('work/nex-preparation-review.json').write_text(json.dumps({'summary':summary,'collisions':collisions,'missing_photos':[r for r in rows if not r['photo_key']],'unknown_colors':[r for r in rows if r['color']=='Não informado']},ensure_ascii=False,indent=2))
print(json.dumps(summary,ensure_ascii=False));print('missing photo examples',[(r['original_name'],r['source_code']) for r in rows if not r['photo_key']][:15]);print('unknown colors',[(r['original_name'],r['color']) for r in rows if r['color']=='Não informado']);print('collisions',[[r['original_name'] for r in c] for c in collisions])
