# Checklist de credenciais e serviços

Marque cada item ao concluir. Nenhum segredo deve ser colado nos arquivos desta pasta; tudo fica na área **Credentials** do n8n.

## Serviços

- [ ] Conta no **n8n Cloud** com versão 1.112 ou superior (ideal: 2.x). Conferir em Settings → Version.
- [ ] Conta **OpenAI** com chave de API e acesso ao modelo `gpt-5.4-mini` (ou ao modelo "mini" mais recente, registrando a troca).
- [ ] Conta **Google** da psicóloga (ou de teste) com:
  - [ ] planilha **EmilIA** com as abas `Pacientes`, `Anotacoes`, `Auditoria` (CSVs em `dados-ficticios/`);
  - [ ] calendário para as consultas, com eventos fictícios "Consulta P-0xx";
  - [ ] Gmail habilitado para envio.
- [ ] **BrasilAPI** (https://brasilapi.com.br): pública, sem credencial.

## Credenciais no n8n (Credentials → Add credential)

| Credencial | Tipo no n8n | Onde é usada | Escopos mínimos |
|---|---|---|---|
| OpenAI | OpenAI API | Modelo GPT-5.4 mini, Modelo dos Guardrails | — |
| Google Sheets | Google Sheets OAuth2 API | consultar_pacientes, consultar_anotacoes, Registrar auditoria, Buscar anotações do paciente, Registrar na planilha | leitura e escrita de planilhas |
| Google Calendar | Google Calendar OAuth2 API | consultar_agenda, Verificar lembretes existentes, Criar lembrete no Google Calendar | leitura e criação de eventos |
| Gmail | Gmail OAuth2 | Enviar briefing por e-mail | envio de e-mail |

No n8n Cloud as credenciais Google usam o login OAuth do próprio n8n (botão "Sign in with Google"); não é preciso criar projeto no Google Cloud.

## Configurações dentro do workflow

- [ ] Nó **Configuração da EmilIA**: `email_psicologa` preenchido (use um e-mail seu nos testes).
- [ ] Nós Google Sheets: planilha e aba selecionadas (5 nós no total, entre principal e sub-workflow 02).
- [ ] Nós Google Calendar: calendário selecionado (3 nós).
- [ ] Nós de ferramenta `registrar_anotacao`, `criar_lembrete`, `enviar_briefing_email`: sub-workflow selecionado.
- [ ] Nó **EmilIA — Agente de back-office**: Max Iterations = 8, Enable Streaming = desligado, System Message presente (já vêm assim no JSON; só conferir).
- [ ] Nó **Chat Trigger**: Response Mode = Using Response Nodes.
- [ ] Workflow salvo. Para os testes pelo chat do editor, não precisa estar ativo.

## Dados

- [ ] Apenas dados fictícios. Pacientes identificados por códigos (P-014, P-022…). Nenhum nome, CPF, telefone ou e-mail real na planilha.
- [ ] O e-mail de destino do briefing é da própria psicóloga (ou seu, nos testes). A EmilIA nunca envia e-mail para pacientes.
