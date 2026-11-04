# Link do agente EmilIA (Semana 9)

## O agente não está publicado em uma URL pública

O agente é um workflow do n8n. Ele **não pode ser hospedado publicamente a partir deste ambiente**: a instância n8n usada para os testes roda apenas em `127.0.0.1:5678` dentro de um contêiner temporário, sem acesso externo, e a equipe não disponibilizou acesso ao n8n do grupo. Nenhuma URL foi inventada.

## Onde está o agente (link real, verificado)

Repositório do projeto (GitHub):

- https://github.com/facanhaluisaaa-create/EmiliIA
- Pasta do agente: https://github.com/facanhaluisaaa-create/EmiliIA/tree/main/EmilIA_Semana09_n8n
- Pasta desta entrega (evidências): https://github.com/facanhaluisaaa-create/EmiliIA/tree/main/EMILIA_BLUEPRINT_SEMANA09

Observação: se o repositório estiver privado, o link só abre para quem tiver acesso. Nesse caso, entregue o ZIP desta pasta.

## Como executar o agente no n8n (Cloud ou local)

1. Abra o n8n (versão 1.112 ou superior; os testes foram feitos na 2.46.4).
2. Importe, nesta ordem, os arquivos da pasta `config-e-codigo/` (ou `EmilIA_Semana09_n8n/` no repositório): `02-subworkflow-…json`, `03-subworkflow-…json`, `01-workflow-…json` (menu ⋯ → Import from File).
3. Selecione as credenciais (OpenAI, Google Sheets, Google Calendar, Gmail), a planilha, o calendário e os dois sub-workflows nos nós indicados em `EmilIA_Semana09_n8n/06-instrucoes-importacao-n8n-cloud.md`.
4. Clique em **Open chat** no workflow principal e use as mensagens de `registros-testes/matriz-resultados-8-testes.md`.

## Links do site EmilIA (não são o agente n8n)

Esses links mostram o sistema web EmilIA já apresentado em semanas anteriores. Eles **não** executam o agente n8n:

- Demonstração do site (artefato): https://claude.ai/artifact/PTzVt4a5StsTYdA2SnMoCo
