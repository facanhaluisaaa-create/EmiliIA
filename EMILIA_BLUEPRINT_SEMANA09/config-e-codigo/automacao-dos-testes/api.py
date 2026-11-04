import json, urllib.request, http.cookiejar, sys, copy
BASE='http://127.0.0.1:5678'
cj=http.cookiejar.MozillaCookieJar('cookies.jar')
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
def call(method, path, body=None):
    req=urllib.request.Request(BASE+path, data=json.dumps(body).encode() if body is not None else None, method=method, headers={'content-type':'application/json'})
    try:
        with opener.open(req, timeout=120) as r: return json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        return {'_error': e.code, 'body': e.read().decode()[:400]}
def login():
    r=call('POST','/rest/owner/setup',{"email":"teste@emiliia.local","firstName":"Equipe","lastName":"EmilIA","password":"<SENHA-LOCAL-DE-TESTE-REMOVIDA>"})
    if '_error' in r: r=call('POST','/rest/login',{"emailOrLdapLoginId":"teste@emiliia.local","password":"<SENHA-LOCAL-DE-TESTE-REMOVIDA>"})
    cj.save(ignore_discard=True); return r
if __name__=='__main__':
    print('login:', str(login())[:120])
    D='/home/user/EmiliIA/EmilIA_Semana09_n8n/'
    ids={}
    for f in ['02-subworkflow-validar-registrar-anotacao.json','03-subworkflow-validar-acao-lembrete-briefing.json']:
        wf=json.load(open(D+f))
        r=call('POST','/rest/workflows',{'name':wf['name'],'nodes':wf['nodes'],'connections':wf['connections'],'settings':wf['settings'],'active':False})
        d=r.get('data',r); ids[wf['name']]=d.get('id'); print(f, '->', d.get('id'), d.get('_error',''))
    main=json.load(open(D+'01-workflow-EmilIA-S09-agente-backoffice.json'))
    for n in main['nodes']:
        if n['type'].endswith('toolWorkflow'):
            name=n['parameters']['workflowId']['cachedResultName']; n['parameters']['workflowId']['value']=ids.get(name,'')
    r=call('POST','/rest/workflows',{'name':main['name'],'nodes':main['nodes'],'connections':main['connections'],'settings':main['settings'],'active':False})
    d=r.get('data',r); print('main ->', d.get('id'), d.get('_error',''), str(d.get('body',''))[:300]); ids[main['name']]=d.get('id')
    json.dump(ids, open('ids.json','w'), indent=1)
