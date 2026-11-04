# As sete ferramentas da EmilIA (Semana 9)

Todas as ferramentas estão no JSON do workflow principal, conectadas ao nó **EmilIA — Agente de back-office** pela entrada *Tool*. As descrições abaixo são as que o agente lê para decidir quando usar cada uma (já preenchidas no JSON).

| # | Ferramenta | Nó do n8n | O que faz | Parâmetros (preenchidos pelo agente com `$fromAI`) | Executa ação? |
|---|---|---|---|---|---|
| 1 | `consultar_pacientes` | Google Sheets Tool (aba **Pacientes**) | Lista a situação administrativa e financeira de todos os pacientes por código P-000. É a **fonte única** para pendência financeira (coluna `pendencia_financeira`), o que corrige a inconsistência financeira da Semana 8. | nenhum (lê a aba inteira) | Não (leitura) |
| 2 | `consultar_agenda` | Google Calendar Tool (Get Many) | Lista as consultas entre um início e um fim. | `inicio`, `fim` em ISO 8601 com fuso `-03:00` | Não (leitura) |
| 3 | `verificar_feriado` | HTTP Request Tool → BrasilAPI | Lista os feriados nacionais do ano. | `ano` (4 dígitos) | Não (leitura) |
| 4 | `consultar_anotacoes` | Google Sheets Tool (aba **Anotacoes**, filtro por código) | Lista as anotações administrativas de um paciente. | `codigo_paciente` (P-000) | Não (leitura) |
| 5 | `registrar_anotacao` | Call n8n Workflow Tool → sub-workflow 02 | Valida e registra UMA anotação administrativa. Recusa código inválido, conteúdo clínico e **duplicatas nas últimas 24 h** (corrige a anotação duplicada da Semana 8). | `codigo_paciente`, `texto`; `sessao` vem do workflow | Sim, com regra determinística e deduplicação |
| 6 | `criar_lembrete` | Call n8n Workflow Tool → sub-workflow 03 | **Só valida e propõe.** Exige data e hora explícitas (corrige o lembrete com data inventada da Semana 8). A criação no Google Calendar acontece no workflow principal, **depois da aprovação humana**. | `data`, `hora`, `titulo`; opcionais `codigo_paciente`, `descricao` | Não. Quem cria é o nó "Criar lembrete no Google Calendar", após aprovação |
| 7 | `enviar_briefing_email` | Call n8n Workflow Tool → sub-workflow 03 | **Só valida e propõe.** O envio pelo Gmail acontece no workflow principal, **depois da aprovação humana** (corrige o e-mail sem aprovação da Semana 8). O destinatário é fixo: o e-mail da psicóloga configurado no nó "Configuração da EmilIA". | `codigo_paciente`, `assunto`, `corpo` | Não. Quem envia é o nó "Enviar briefing por e-mail", após aprovação |

## Como a aprovação funciona (resumo técnico)

1. O agente chama `criar_lembrete` ou `enviar_briefing_email`.
2. O sub-workflow 03 valida os campos com regras em código. Se faltar algo, devolve `informacao_faltante` e o agente pergunta à psicóloga. Se estiver tudo certo, devolve `proposta_validada` com um bloco `<<ACAO_PENDENTE>>{…}<<FIM_ACAO>>`.
3. O agente reproduz o bloco no fim da resposta (regra 6 da System Message).
4. O nó **Analisar resposta do agente** (Code) extrai o bloco, **revalida tudo de novo** sem confiar no modelo, e remove o bloco do texto visível.
5. O nó **Pedir aprovação no chat** mostra a ferramenta e todos os dados, com os botões **Aprovar** e **Negar** (tempo limite de 30 minutos; sem resposta = negado).
6. Só o botão Aprovar leva aos nós do Google Calendar ou do Gmail. Negar leva a "Preparar negado" e nada é executado.
7. Antes de criar o lembrete, o workflow consulta o calendário na mesma janela e recusa títulos repetidos.
8. Falhas no Calendar ou no Gmail saem pela saída de erro e viram a resposta "a execução falhou; nada foi criado ou enviado".
9. Todo caminho registra uma linha na aba **Auditoria** e termina em **Responder no chat**.

## Estrutura das abas da planilha (ver `dados-ficticios/`)

- **Pacientes**: `codigo_paciente, status, modalidade, dia_semana, horario, valor_sessao, pendencia_financeira, ultimo_pagamento, faltas_30d, consultas_30d, observacao_administrativa`
- **Anotacoes**: `id, data_hora, codigo_paciente, texto, chave_dedup, origem, sessao`
- **Auditoria**: `data_hora, sessao, evento, categoria, detalhe, resposta`
