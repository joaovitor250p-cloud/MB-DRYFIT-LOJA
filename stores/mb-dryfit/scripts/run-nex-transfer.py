"""Run the scoped, resumable Nex transfer. Reads its temporary key from hidden stdin."""
import sys,json,time
from urllib.request import Request,urlopen
from urllib.error import HTTPError
key=sys.stdin.readline().strip()
url='https://atelier-loja-mw96xrv3.savoryaccordion3.chatgpt.site/api/nex-transfer'
def call(action):
 req=Request(url,data=json.dumps({'action':action}).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+key,'User-Agent':'Mozilla/5.0 MB-Dryfit-Import/1.0'},method='POST')
 for attempt in range(3):
  try:return json.load(urlopen(req,timeout=50))
  except HTTPError as e:
   if e.code in [429,502,503,504] and attempt<2:time.sleep(1);continue
   print('Transfer failed:',e.code,e.read().decode()[:350],flush=True);sys.exit(1)
  except Exception as e:
   if attempt==2:print('Transfer interrupted:',type(e).__name__,flush=True);sys.exit(1)
   time.sleep(1)
status=call('status')
for step in range(500):
 if status.get('complete'):break
 action=status['next_action']
 if action=='products' and status.get('retryable_photos',0):action='retry_photos'
 if action=='done':break
 status=call(action)
 if action in ['photos','retry_photos'] and status['photos_done']==0 and status['photos_failed']>=6:
  print('Image transfer paused: '+json.dumps(status.get('photo_errors',[]),ensure_ascii=False),flush=True);sys.exit(3)
 if step%5==0 or status.get('complete'):print(json.dumps({k:status[k] for k in ['products_done','products_total','photos_done','photos_failed','photos_total','next_action','complete']}),flush=True)
print('FINAL '+json.dumps(status,ensure_ascii=False),flush=True)
if not status.get('complete'):sys.exit(2)
