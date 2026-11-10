# EmilIA — Missão 4: Regras e Proteções (G29)

Liga dos Agentes · Agentes de IA para Negócios · Escola de Negócios Saint Paul · Prof. Marcos Sanchez
Grupo G29 · Agente EmilIA · Workflow `PF - G29 - EmilIA - M4` · Integrantes: Luísa Façanha, Maria Luiza Morelli, Lígia Silva e Matheus Barbosa

## Estado anterior e o que mudou

A M4 foi criada como cópia independente do workflow funcional da M3 (`PF - G28 - EmilIA - M3`, preservado sem alterações). Base reaproveitada: Chat Trigger, AI Agent da EmilIA, OpenAI Chat Model (gpt-5.4-mini, credencial de créditos de teste do n8n Cloud), Simple Memory (janela 10) e as ferramentas de leitura `consultar_sessoes` e `consultar_valores` (Data tables com dados fictícios, operação Get). O site e as missões anteriores não foram alterados.

Acrescentado na M4:
1. **Regra crítica fora do modelo**: nó `Regra crítica (Code)` + nó `Bloqueado? (IF)` antes de tudo. Detecta sequência no formato de CPF e pedidos explícitos de prontuário, diagnóstico, laudo ou conteúdo de sessão. No bloqueio, responde com texto fixo (nó `Resposta de bloqueio (fixa)`), não repassa o dado, não chama Guardrails, agente, memória nem ferramentas. No caminho permitido preserva `chatInput`, `sessionId` e `action`.
2. **Guardrails** (`Guardrails de entrada`, Check Text for Violations): `keywords` (lista programada) + `jailbreak` (classificação por modelo, limiar 0,7), com `Modelo dos Guardrails`. Pass → AI Agent; Fail → `Resposta Guardrails (fixa)`, sem ferramentas.
3. **System Message atualizada**: contradições da M3 corrigidas (há ferramentas de leitura; fontes = conversa + ferramentas; consultas reais podem ser afirmadas; nenhuma autorização libera ações que o agente não executa) e Bloco 3 com as nove regras pedidas.
4. Agente passa a ler o texto da mensagem e a chave de sessão a partir do nó `Regra crítica (Code)` (o nó Guardrails não repassa os campos da conversa).

## Os cinco itens do enunciado

- **A. Mapa regra × modelo**: `EmilIA_M4_Mapa_Regra_x_Modelo.md` (sete decisões, com responsável, nó do n8n e verificação).
- **B. Regra crítica fora do modelo**: configuração nos prints 02a–02d; teste real nos prints 03a–03c e execução 28.
- **C. Tabela Permitido / Proibido / Exige decisão humana**: `EmilIA_M4_Tabela_Permissoes.md`; Bloco Regras atualizado em `EmilIA_M4_System_Message.txt` e prints 06a–06b.
- **D. Guardrails**: configuração nos prints 04a–04c; tentativa bloqueada pela saída Fail nos prints 05a–05c e execução 29 (keywords e jailbreak 0,99).
- **E. Aprovação humana**: não há ferramenta de escrita externa nesta versão; justificativa sustentada pela arquitetura em `EmilIA_M4_Justificativa_Aprovacao_Humana.md`.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `EmilIA_M4_Workflow_n8n.json` | Workflow importável (gerado). |
| `EmilIA_M4_Workflow_n8n_exportado.json` | Workflow exportado da instância após os testes, sem credenciais. |
| `EmilIA_M4_System_Message.txt` | System Message efetivamente usada (4 blocos; Bloco 3 com 9 regras). |
| `EmilIA_M4_Mapa_Regra_x_Modelo.md` | Tabela 1. |
| `EmilIA_M4_Tabela_Permissoes.md` | Tabela 2. |
| `EmilIA_M4_Justificativa_Aprovacao_Humana.md` | Item E. |
| `EmilIA_M4_Registro_Testes.md` / `.json` | Testes com mensagem, esperado, observado, nós, execução e status. |
| `EmilIA_M4_Execucoes_n8n.json` | Execuções 28–31 exportadas (nós executados e saídas). |
| `prints/` | Capturas reais numeradas 01–11. |
| `PF - G29 - M4.pdf` | PDF da entrega. |

## Como reproduzir

1. Importe `EmilIA_M4_Workflow_n8n.json` (⋯ → Import from File). As Data tables `EmilIA_M3_Sessoes` e `EmilIA_M3_Valores` precisam existir na instância (já existem na do grupo); em outra instância, crie-as com as colunas da planilha fictícia e selecione-as nos dois nós de ferramenta.
2. Selecione a credencial OpenAI nos nós `OpenAI Chat Model` e `Modelo dos Guardrails`.
3. Open chat → envie, na ordem, as quatro mensagens de `EmilIA_M4_Registro_Testes.md` (Reset entre a segunda e a terceira).

## Limitações registradas

- A regra programada cobre padrões específicos (formato de CPF e lista de termos clínicos), não todos os dados sensíveis.
- O `jailbreak` do Guardrails é classificação por modelo (probabilística); o `keywords` é determinístico.
- O n8n registra a mensagem original na saída do Chat Trigger mesmo no caminho bloqueado; a resposta e a saída do Code não a reproduzem.
- Sem ferramenta de escrita, o item E é atendido por justificativa, não por demonstração de aprovação.
