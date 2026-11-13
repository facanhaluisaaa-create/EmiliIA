# Como reconstruir a EmilIA do zero (M6)

Tempo estimado: 20 minutos. Nenhuma credencial está nos arquivos.

## Arquivos necessários (nesta pasta e no repositório)

1. `EmilIA_M6_Backup_Workflow_PF-G29-EmilIA-M5.json` — workflow completo exportado do n8n (21 nós, conexões, System Message embutida).
2. `EmilIA_M6_System_Message_configurada.txt` — System Message (já está dentro do JSON; serve para conferência ou para colar).
3. `EmilIA_M3_Base_Ficticia.xlsx` (em `EmilIA_Liga_Agentes_M3/`) — dados fictícios das abas Sessoes e Valores.

## Passo a passo

1. **Data tables** (n8n → Overview → Data tables → Create): crie `EmilIA_M3_Sessoes` (colunas string: id_sessao, codigo_paciente, data_sessao, status, observacao_admin), `EmilIA_M3_Valores` (codigo_paciente string, valor_sessao_brl number, condicao_registrada string, revisao_humana string) e `EmilIA_M5_Confirmacoes_Teste` (identificador, codigo_paciente, decisao, data_hora, todas string). Preencha as duas primeiras com as linhas da planilha fictícia (6 e 3 linhas); a terceira começa vazia.
2. **Credencial do modelo**: no n8n Cloud em teste, a credencial "Gateway credits" aparece automaticamente ao abrir um nó OpenAI. Fora do teste, crie uma credencial OpenAI API (Credentials → Add credential) com a chave do grupo.
3. **Importar o workflow**: Create Workflow → ⋯ → Import from File → `EmilIA_M6_Backup_Workflow_PF-G29-EmilIA-M5.json`. Renomeie se precisar (`PF - G29 - EmilIA - M5`).
4. **Selecionar recursos**: nos nós `consultar_sessoes`, `consultar_valores` e `registrar_confirmacao_teste (gravação)`, escolha as Data tables criadas no passo 1 (From list). Nos nós `OpenAI Chat Model` e `Modelo dos Guardrails`, selecione a credencial; mantenha o modelo gpt-5.4-mini (ou o "mini" disponível) e *Use Responses API* desligado.
5. **Publicar**: clique em Publish (ou ative o workflow). O Chat Trigger mostra a URL pública (`…/webhook/emilia-g29-m5-chat/chat`). Se a instância for outra, a URL muda de host; o caminho continua o mesmo.
6. **Testar**: abra a URL em uma janela anônima e rode os oito testes de `EmilIA_M5_Entrega/EmilIA_M5_Matriz_Testes.md` (T03 com duas mensagens na mesma sessão; T08 clicando em Negar).

## Erros comuns

- "Gateway credits don't currently support this operation": desligue *Use Responses API* no nó do modelo ou use um modelo da lista do gateway (gpt-5.4-mini).
- Triângulo vermelho em um nó: credencial ou Data table não selecionada.
- Chat sem resposta: o Chat Trigger precisa estar em Response Mode = Using Response Nodes, porque todas as respostas saem de nós Chat.
- Workflow não ativa pela API: use o botão Publish do editor (equivale a `POST /rest/workflows/:id/activate`).
