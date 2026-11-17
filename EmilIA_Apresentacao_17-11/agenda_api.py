import json,sys,uuid
sys.path.insert(0,'.')
import capi
PID='EnwiQAIzYmdU9ZAw'; ids=json.load(open('dt_ids.json')); S=ids['Sessoes']; V=ids['Valores']
DEF=r"""const q = $input.first().json.query || {};
const hoje = $now.setZone('America/Sao_Paulo').toFormat('yyyy-MM-dd');
const data = /^\d{4}-\d{2}-\d{2}$/.test(String(q.data || '')) ? String(q.data) : hoje;
return [{ json: { data } }];"""
OUT=r"""// Agenda do dia em JSON para a interface. Só campos administrativos fictícios.
const data = $('Definir o dia').first().json.data;
const sessoes = $input.all().map(i => i.json).filter(r => r && r.id_sessao)
  .map(r => ({ id_sessao: r.id_sessao, horario: r.horario, codigo_paciente: r.codigo_paciente, nome_paciente: r.nome_paciente, tipo_atendimento: r.tipo_atendimento, status: r.status, valor_sessao_brl: r.valor_sessao_brl, status_pagamento: r.status_pagamento, observacao_admin: r.observacao_admin }))
  .sort((a, b) => String(a.horario).localeCompare(String(b.horario)));
return [{ json: { fonte: 'n8n · tabela EmilIA_M3_Sessoes', data, gerado_em: $now.setZone('America/Sao_Paulo').toISO(), total: sessoes.length, sessoes } }];"""
nodes=[
 {'id':'ad-hook','name':'GET agenda do dia','type':'n8n-nodes-base.webhook','typeVersion':2.1,'position':[0,0],'webhookId':str(uuid.uuid4()),'parameters':{'httpMethod':'GET','path':'emilia-g29-agenda-do-dia','responseMode':'responseNode','options':{'allowedOrigins':'*'}}},
 {'id':'ad-data','name':'Definir o dia','type':'n8n-nodes-base.code','typeVersion':2,'position':[240,0],'parameters':{'jsCode':DEF}},
 {'id':'ad-get','name':'Buscar sessões do dia','type':'n8n-nodes-base.dataTable','typeVersion':1.1,'position':[480,0],'alwaysOutputData':True,
  'parameters':{'operation':'get','dataTableId':{'__rl':True,'mode':'list','value':S,'cachedResultName':'EmilIA_M3_Sessoes'},'matchType':'allConditions','filters':{'conditions':[{'keyName':'data_sessao','condition':'eq','keyValue':'={{ $json.data }}'}]},'returnAll':True}},
 {'id':'ad-out','name':'Montar JSON','type':'n8n-nodes-base.code','typeVersion':2,'position':[720,0],'parameters':{'jsCode':OUT}},
 {'id':'ad-resp','name':'Responder JSON','type':'n8n-nodes-base.respondToWebhook','typeVersion':1.1,'position':[960,0],'parameters':{'respondWith':'json','responseBody':'={{ JSON.stringify($json) }}','options':{}}},
 {'id':'ad-nota','name':'Nota','type':'n8n-nodes-base.stickyNote','typeVersion':1,'position':[0,-260],'parameters':{'width':700,'height':180,'content':'## PF - G29 - EmilIA - Agenda do dia (API)\nUsado pela interface emilIA (aba Agenda do dia). GET /webhook/emilia-g29-agenda-do-dia?data=AAAA-MM-DD devolve as sessões do dia da tabela EmilIA_M3_Sessoes, só com campos administrativos. Somente leitura.'}}]
conn={'GET agenda do dia':{'main':[[{'node':'Definir o dia','type':'main','index':0}]]},'Definir o dia':{'main':[[{'node':'Buscar sessões do dia','type':'main','index':0}]]},'Buscar sessões do dia':{'main':[[{'node':'Montar JSON','type':'main','index':0}]]},'Montar JSON':{'main':[[{'node':'Responder JSON','type':'main','index':0}]]}}
wf=capi.call('POST','/rest/workflows',{'name':'PF - G29 - EmilIA - Agenda do dia (API)','nodes':nodes,'connections':conn,'projectId':PID,'settings':{'executionOrder':'v1','saveDataSuccessExecution':'all','saveDataErrorExecution':'all','timezone':'America/Sao_Paulo'}})
w=wf.get('data',wf); print('workflow', w.get('id'), wf.get('_error'))
a=capi.call('POST',f"/rest/workflows/{w['id']}/activate",{'versionId':w.get('versionId')}); print('ativo:', a.get('_error') or (a.get('data') or {}).get('active'))
json.dump({'id':w['id']},open('wfid_agenda_api.json','w'))
