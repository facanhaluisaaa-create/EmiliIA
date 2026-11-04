import json, sys
sys.path.insert(0, '.')
import api
api.cj.load(ignore_discard=True)
ids = json.load(open('ids.json'))
D = '/home/user/EmiliIA/EmilIA_Semana09_n8n/'
main = json.load(open(D + '01-workflow-EmilIA-S09-agente-backoffice.json'))
for n in main['nodes']:
    if n['type'].endswith('toolWorkflow'):
        n['parameters']['workflowId']['value'] = ids.get(n['parameters']['workflowId']['cachedResultName'], '')
wid = ids['EmilIA S09 — Agente de back-office com guardrails']
wf = api.call('GET', f'/rest/workflows/{wid}')['data']
r = api.call('PATCH', f'/rest/workflows/{wid}', {'versionId': wf['versionId'], 'nodes': main['nodes'], 'connections': main['connections'], 'pinData': {}})
print('reimport:', r.get('_error', 'ok'))
