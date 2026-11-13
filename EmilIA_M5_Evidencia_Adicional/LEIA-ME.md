# EmilIA — M5 — Evidência adicional de aprovação humana (G29)

Capturas reais feitas em 13/11/2026 na instância n8n do grupo (workflow `PF - G29 - EmilIA - M5`), sem criar dados, sem repetir gravações e sem alterar o workflow.

| Arquivo | O que mostra |
|---|---|
| `M5_T08B_Tabela_Aprovada.png` | Data Table `EmilIA_M5_Confirmacoes_Teste` carregada: 1 linha (id 1) com identificador DEMO-TESTE-2026-10, codigo_paciente P-014, decisao aprovado, data_hora 2026-11-11 16:11:42, createdAt 2026-11-11T19:11:42Z. Essa linha foi criada pelo T08B (execução 42, aprovação concedida). "Total 1". |
| `M5_T08_Logs_Negacao.png` | Execução 41 (T08, 11/11 19:02:10) aberta na aba Executions: canvas com o caminho percorrido. |
| `M5_T08_Logs_Negacao_a_pedido_aprovacao_output.png` | Nó "Pedir aprovação no chat" na execução 41: entrada com a ação (registrar_confirmacao_teste, P-014, DEMO-TESTE-2026-10) e saída `approved: false`, `respondedAt: 2026-11-11T19:05:11.946Z` (clique em Negar). |
| `M5_T08_Logs_Negacao_b_if_aprovado_false.png` | Nó "Aprovado?" na execução 41: condição `$json.data.approved is true` não atendida; saída pela **False Branch (1 item)**, True Branch vazia. |
| `M5_T08_Logs_Negacao_c_responder_negado.png` | Nó "Responder: negado" executado na execução 41 com a mensagem "Entendido, ação negada. Nenhuma linha foi gravada…". |
| `M5_T08_Logs_Negacao_d_no_gravacao_nao_executado.png` | Nó "registrar_confirmacao_teste (gravação)" na execução 41: "No fields - node executed, but no items were sent on this branch" na entrada e "No output data" na saída, ou seja, o nó de gravação não recebeu item nem gravou nada. |
| `M5_T08_Execucao_41_registro_exportado.json` | Registro da execução 41 exportado pela API do n8n em 11/11/2026: lista dos 13 nós executados (sem o nó de gravação) e saídas, inclusive `approved: false`. |

## Evidência de tabela vazia após o T08

**Indisponível como imagem.** Não foi feita captura de tela da Data Table entre o T08 (negado, 19:05) e o T08B (aprovado, 19:11). O que existe é a verificação feita pela API do n8n logo após o T08 e antes do T08B, registrada no log da sessão de trabalho de 11/11/2026, com este resultado textual:

```
LINHAS NA TABELA DE TESTE APÓS NEGAR: 0 []
```

e, após o T08B:

```
LINHAS APÓS APROVAR: 1 [{"identificador": "DEMO-TESTE-2026-10", "codigo_paciente": "P-014", "decisao": "aprovado", "data_hora": "2026-11-11 16:11:42", "id": 1, "createdAt": "2026-11-11T19:11:42.316Z", ...}]
```

A captura atual da tabela (com 1 linha) **não** deve ser apresentada como "tabela vazia". A prova de que a negativa não gravou nada é a própria execução 41: o nó de gravação não executou (prints a–d e JSON), e a única linha existente tem `createdAt` 19:11:42Z, seis minutos depois da negativa (19:05:11Z) e dentro da janela do T08B.
