"""Apply only the server's fixed, reviewed manifest; read its temporary secret from hidden stdin."""
import json,sys,urllib.request,urllib.error
secret=sys.stdin.readline().strip()
url='https://atelier-loja-mw96xrv3.savoryaccordion3.chatgpt.site/api/nex-model-regroup'
def call(action):
 req=urllib.request.Request(url,data=json.dumps({'action':action}).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+secret,'User-Agent':'Mozilla/5.0 MB-Dryfit-Import/1.0'},method='POST')
 try:
  with urllib.request.urlopen(req,timeout=45) as response:return json.load(response)
 except urllib.error.HTTPError as error:
  print(json.dumps({'status':error.code,'error':error.read().decode()[:500]},ensure_ascii=False));sys.exit(1)
state=call('status');print(json.dumps(state),flush=True)
while not state['complete']:
 state=call('regroup');print(json.dumps(state,ensure_ascii=False),flush=True)
print(json.dumps(call('status')),flush=True)
