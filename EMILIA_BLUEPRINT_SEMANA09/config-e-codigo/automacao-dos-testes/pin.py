import json, sys
sys.path.insert(0, '/tmp/claude-0/-home-user-EmiliIA/b3cbaaaa-db5a-53a1-ab46-f80dd3945e63/scratchpad/n8nrun')
import api
api.cj.load(ignore_discard=True) if __import__('os').path.exists('cookies.jar') else api.login()
def set_pin(wf_id, pins):
    wf = api.call('GET', f'/rest/workflows/{wf_id}')['data']
    r = api.call('PATCH', f'/rest/workflows/{wf_id}', {'versionId': wf['versionId'], 'pinData': pins})
    return r.get('_error') or 'ok'
if __name__ == '__main__':
    ids = json.load(open('ids.json'))
    mode = sys.argv[1]
    main = ids['EmilIA S09 — Agente de back-office com guardrails']
    subB = ids['EmilIA S09 — Sub: validar ação (lembrete ou briefing)']
    guard = [{'json': {'guardrailsInput': 'PINADO: saída do nó Guardrails fixada para testes sem chave OpenAI', 'checks': [{'name': 'jailbreak', 'triggered': False, 'confidenceScore': 0.0}]}}]
    import datetime
    futuro = (datetime.date.today() + datetime.timedelta(days=3)).isoformat()
    if mode == 'none':
        print(set_pin(main, {}))
    elif mode == 'passado':
        out = 'Vou propor o lembrete. <<ACAO_PENDENTE>>{"ferramenta":"criar_lembrete","codigo_paciente":"P-014","data":"2020-01-01","hora":"10:00","titulo":"Confirmar horário com P-014"}<<FIM_ACAO>>'
        print(set_pin(main, {'Guardrails de entrada (IA)': guard, 'EmilIA — Agente de back-office': [{'json': {'output': out}}]}))
    elif mode == 'valido':
        out = 'Entendido. Vou propor um lembrete para ' + futuro.split('-')[2] + '/' + futuro.split('-')[1] + '/' + futuro.split('-')[0] + ' às 09:30. Ele só será criado depois da sua aprovação. <<ACAO_PENDENTE>>{"ferramenta":"criar_lembrete","codigo_paciente":"P-014","data":"' + futuro + '","hora":"09:30","titulo":"Confirmar horário com P-014","descricao":"Confirmar manutenção do horário de segunda-feira"}<<FIM_ACAO>>'
        print(set_pin(main, {'Guardrails de entrada (IA)': guard, 'EmilIA — Agente de back-office': [{'json': {'output': out}}]}))
    elif mode == 'subB-faltante':
        print(set_pin(subB, {'Quando chamado pela EmilIA': [{'json': {'ferramenta': 'criar_lembrete', 'codigo_paciente': 'P-014', 'data': '', 'hora': '', 'titulo': 'Ligar para confirmar', 'descricao': '', 'assunto': '', 'corpo': ''}}]}))
    elif mode == 'subB-valido':
        print(set_pin(subB, {'Quando chamado pela EmilIA': [{'json': {'ferramenta': 'criar_lembrete', 'codigo_paciente': 'p14', 'data': '/'.join(reversed(futuro.split('-'))), 'hora': '9h30', 'titulo': 'Confirmar horário com P-014', 'descricao': '', 'assunto': '', 'corpo': ''}}]}))
