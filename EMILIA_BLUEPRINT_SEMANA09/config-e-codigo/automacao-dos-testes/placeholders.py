import json, sys
sys.path.insert(0, '.')
import api
api.cj.load(ignore_discard=True)
ids = json.load(open('ids.json'))
def patch(wf_id):
    wf = api.call('GET', f'/rest/workflows/{wf_id}')['data']
    changed = []
    for n in wf['nodes']:
        p = n['parameters']
        if n['type'] in ('n8n-nodes-base.googleSheets',):
            p['documentId'] = {'__rl': True, 'mode': 'id', 'value': 'ID_DA_PLANILHA_EMILIA_SUBSTITUIR'}
            p['sheetName'] = {'__rl': True, 'mode': 'name', 'value': p['sheetName'].get('cachedResultName', 'Auditoria')}
            changed.append(n['name'])
        if n['type'] in ('n8n-nodes-base.googleCalendar',):
            p['calendar'] = {'__rl': True, 'mode': 'id', 'value': 'calendario-emiliia-ficticio@group.calendar.google.com'}
            changed.append(n['name'])
    r = api.call('PATCH', f'/rest/workflows/{wf_id}', {'versionId': wf['versionId'], 'nodes': wf['nodes'], 'connections': wf['connections']})
    print(wf['name'], '->', r.get('_error', 'ok'), changed)
patch(ids['EmilIA S09 — Agente de back-office com guardrails'])
patch(ids['EmilIA S09 — Sub: validar e registrar anotação'])
