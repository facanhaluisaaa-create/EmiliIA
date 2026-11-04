# EmilIA — Semana 9: agente de IA com guardrails no n8n

Pasta de entrega do artefato técnico da Semana 9 (disciplina Agentes de IA para Negócios, Saint Paul, prof. Marcos Sanchez). Projeto EmilIA (antes Cris.IA): assistente administrativa para psicólogos autônomos sem secretária.

## Arquivos

| Arquivo | O que é |
|---|---|
| `01-workflow-EmilIA-S09-agente-backoffice.json` | Workflow principal, importável no n8n (36 nós): Chat Trigger, pré-checagem determinística, Guardrails, agente com 7 ferramentas, revalidação em código, aprovação humana no chat, execução determinística, auditoria e resposta. |
| `02-subworkflow-validar-registrar-anotacao.json` | Sub-workflow da ferramenta `registrar_anotacao`: valida código/texto, filtra conteúdo clínico, impede duplicidade (24 h) e grava na planilha. |
| `03-subworkflow-validar-acao-lembrete-briefing.json` | Sub-workflow das ferramentas `criar_lembrete` e `enviar_briefing_email`: valida data/hora explícitas, campos obrigatórios e conteúdo; apenas propõe, nunca executa. |
| `04-system-message.md` | System Message completa e numerada (Camada 2). |
| `05-ferramentas.md` | Descrição das sete ferramentas, parâmetros e o fluxo de aprovação. |
| `06-instrucoes-importacao-n8n-cloud.md` | Passo a passo de importação e configuração. |
| `07-checklist-credenciais.md` | Credenciais e serviços a conectar. |
| `08-matriz-de-testes.md` | Os oito testes obrigatórios com mensagens prontas e resultados esperados. |
| `dados-ficticios/` | CSVs para as abas Pacientes, Anotacoes e Auditoria (apenas dados fictícios, pacientes por código). |

## As cinco camadas, onde estão

1. **Guardrails de entrada**: nó *Pré-checagem determinística* (Code: limiar de 1500 caracteres, CPF, listas de manipulação, clínico, ação proibida, fora de escopo; mensagens de bloqueio por categoria) + nó *Guardrails de entrada (IA)* (Jailbreak 0,7, Topical Alignment 0,7, PII, palavras-chave). Conteúdo bloqueado vai direto para *Responder no chat*; não toca no agente, nas ferramentas nem na memória.
2. **System Message**: 7 seções numeradas com proibições, regras de silêncio, uso de ferramentas, dados obrigatórios e o protocolo de aprovação.
3. **Regras determinísticas**: Code e IF no principal (*Analisar resposta do agente*, *Já existe lembrete igual?*) e nos dois sub-workflows (código P-000, texto obrigatório, data/hora explícitas e futuras, deduplicação de anotação, filtro clínico).
4. **Aprovação humana**: nó *Pedir aprovação no chat* (Chat → Send and Wait, tipo Approval, botões Aprovar/Negar, mostra a ferramenta e os dados). O agente não tem acesso ao Gmail nem à criação no Calendar; só os nós determinísticos depois da aprovação executam. Negar ou não responder em 30 min cancela.
5. **Limites**: Max Iterations 8, streaming desligado, uma ferramenta por vez (System Message 4.1), saídas de erro tratadas em Calendar/Gmail, auditoria na planilha e execuções salvas.

## Como os cinco problemas da Semana 8 foram corrigidos

| Problema | Correção |
|---|---|
| E-mail enviado sem aprovação | O agente só propõe; o Gmail executa apenas após o botão Aprovar. |
| Lembrete com data e hora inventadas | Sub-workflow 03 exige data e hora explícitas, futuras e válidas; o principal revalida; a mensagem de aprovação mostra a data antes de criar. |
| Anotação duplicada após falha | Chave de deduplicação (código + texto) e janela de 24 h no sub-workflow 02. |
| Conteúdo clínico na memória e nos logs | Bloqueio antes do agente (Camada 1); filtro clínico também nas anotações e nas propostas; auditoria grava categoria e motivo, não o texto clínico. |
| Informações financeiras inconsistentes | `consultar_pacientes` é a fonte única (coluna `pendencia_financeira`); a System Message manda relatar divergências sem concluir. |

## O que está pronto e o que depende da sua instância

**Pronto nesta pasta:** os três JSONs importáveis, a lógica dos nós Code testada fora do n8n (27 casos, todos passando), a System Message, as descrições das ferramentas, as instruções, o checklist e a matriz de testes.

**Depende do acesso ao n8n Cloud (não foi possível executar daqui):** importar os arquivos, selecionar credenciais, planilha, calendário e sub-workflows nos nós, e rodar os oito testes. Os JSONs foram gerados a partir das definições oficiais dos nós (pacotes `n8n-nodes-base 2.15.1` e `@n8n/n8n-nodes-langchain 2.46.4`), mas a importação em si e as execuções só podem ser comprovadas na sua instância. Nenhum print, execução ou resultado foi simulado.

## Primeiro passo

Siga `06-instrucoes-importacao-n8n-cloud.md`, seção 1: importe primeiro os dois sub-workflows, depois o principal.
