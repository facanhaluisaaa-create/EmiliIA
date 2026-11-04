import json,sys
sys.path.insert(0,'.')
from api import call, login
login()
ids=json.load(open('ids.json')); inv={v:k for k,v in ids.items()}
OUT='/home/user/EmiliIA/EMILIA_BLUEPRINT_SEMANA09/registros-testes/execucoes-n8n/'
summary=[]
def unflatten(arr):
    if not isinstance(arr,list): return arr
    def resolve(v,depth=0):
        if depth>80: return v
        if isinstance(v,str) and v.isdigit(): return resolve(arr[int(v)],depth+1)
        if isinstance(v,list): return [resolve(x,depth+1) for x in v]
        if isinstance(v,dict): return {k:resolve(x,depth+1) for k,x in v.items()}
        return v
    return resolve(arr[0])
for i in range(1,36):
    r=call('GET',f'/rest/executions/{i}')
    d=r.get('data',r)
    if '_error' in d: print(i,'ERR',d); continue
    data=d.get('data')
    if isinstance(data,str):
        try: data=json.loads(data)
        except Exception: pass
    ud=unflatten(data)
    rd=(ud or {}).get('resultData',{}) if isinstance(ud,dict) else {}
    runData=rd.get('runData',{}) or {}
    err=rd.get('error')
    nodes=[]
    for name,runs in runData.items():
        for run in runs:
            o={'no':name,'status':run.get('executionStatus'),'inicio':run.get('startTime'),'ms':run.get('executionTime')}
            if run.get('error'): o['erro']=str((run['error'] or {}).get('message') if isinstance(run['error'],dict) else run['error'])[:300]
            main=(run.get('data') or {}).get('main') or []
            outs=[]
            for branch in main:
                outs.append([ (it.get('json') if isinstance(it,dict) else it) for it in (branch or [])][:3])
            o['saidas']=outs
            nodes.append(o)
    nodes.sort(key=lambda x:(x['inicio'] or 0))
    rec={'id':d['id'],'workflow':inv.get(d['workflowId'],d['workflowId']),'modo':d['mode'],'status':d['status'],'inicio':d['startedAt'],'fim':d['stoppedAt'],
         'erro_global': (str(err.get('message'))[:400] if isinstance(err,dict) else err), 'sequencia_de_nos':[n['no'] for n in nodes],'nos':nodes}
    open(OUT+f'execucao-{i:02d}.json','w').write(json.dumps(rec,ensure_ascii=False,indent=1))
    summary.append({k:rec[k] for k in ['id','workflow','status','inicio','erro_global','sequencia_de_nos']})
    print(i,rec['status'],rec['workflow'][:28],'|',(rec['erro_global'] or '')[:110],'|',' > '.join(rec['sequencia_de_nos'])[:260])
json.dump(summary,open(OUT+'_resumo.json','w'),ensure_ascii=False,indent=1)
