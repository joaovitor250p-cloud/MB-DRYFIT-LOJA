"""Prepare the reviewed correction; executing it is a separate scoped runtime operation."""
import json,collections,unicodedata,re
from pathlib import Path

def norm(v):
 return re.sub(r'\s+',' ',unicodedata.normalize('NFKD',str(v)).encode('ascii','ignore').decode().upper()).strip()
def identity(p):return '|'.join(norm(p[k]) for k in ('category','brand','name'))
live=json.loads(Path('work/regroup-live-before.json').read_text())
data=json.loads(Path('data/nex-import.json').read_text())
source={p['id']:p for p in data['rows']}
byname=collections.defaultdict(list)
for p in live:
 if p['id'] in source:byname[identity(p)].append(p)
corrections=[];identities={};updates={}
for key,rows in sorted(byname.items()):
 models=collections.Counter(p['model_id'] for p in rows)
 target=sorted(models,key=lambda mid:(-models[mid],-sum(bool(source[p['id']]['original_category']) for p in rows if p['model_id']==mid),mid))[0]
 identities[key]=target
 if len(models)==1:continue
 assert len({(norm(p['color']),norm(p['size'])) for p in rows})==len(rows),key
 colors=collections.defaultdict(collections.Counter)
 for p in rows:
  if p['photo']:colors[p['color']][p['photo']]+=1
 selected={c:sorted(counts,key=lambda v:(-counts[v],v))[0] for c,counts in colors.items()}
 members=[]
 for p in sorted(rows,key=lambda p:p['id']):
  photo=selected.get(p['color'],p['photo'])
  member={k:p[k] for k in ('id','name','category','brand','color','size','model_id','photo')}
  member['new_photo']=photo;members.append(member)
  updates[p['id']]={'model_id':target,'photo_key':photo.split('/')[-1] if photo else None}
 corrections.append({'id':'nex-regroup-v1-'+target,'name':rows[0]['name'],'target':target,'models':sorted(models),'members':members})
for p in data['rows']:
 p['model_key']=identity(p);p['model_id']=identities[identity(p)]
 if p['id'] in updates:p.update(updates[p['id']])
s=data['summary'];s['models']=len(set(p['model_id'] for p in data['rows']));s['colors']=len(set((p['model_id'],p['color']) for p in data['rows']));s['rows_with_photo']=sum(bool(p['photo_key']) for p in data['rows']);s['missing_photo_rows']=len(data['rows'])-s['rows_with_photo'];s['photos']=len(set(p['photo_key'] for p in data['rows'] if p['photo_key']))
Path('data/nex-import.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
Path('data/nex-model-identities.json').write_text(json.dumps(identities,ensure_ascii=False,indent=2)+'\n')
Path('data/nex-regroup.json').write_text(json.dumps({'id':'nex-model-regroup-v1','groups':corrections},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'groups':len(corrections),'reviewed_variations':sum(len(g['members']) for g in corrections),'model_changes':sum(p['model_id']!=g['target'] for g in corrections for p in g['members']),'photo_changes':sum(p['photo']!=p['new_photo'] for g in corrections for p in g['members']),'summary':s}))
