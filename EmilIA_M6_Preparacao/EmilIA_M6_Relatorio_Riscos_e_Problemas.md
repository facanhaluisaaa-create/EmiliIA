# Relatório de riscos e eventuais problemas — apresentação de 17/11/2026

| Risco | Situação em 13/11 | Impacto | Mitigação recomendada |
|---|---|---|---|
| Fim do trial do n8n Cloud | Expira em 19/11/2026 17:04 UTC (+3 dias de carência). | Se expirasse antes de 17/11, o canal público sairia do ar. Não é o caso. | Não alterar o plano antes da apresentação; conferir no dia 16/11 que o banner ainda mostra dias restantes. |
| Créditos de teste do modelo (Gateway credits) | US$ 1,90 restantes; consumo observado de poucos centavos por conversa. | Se acabarem, o agente responde "Error in workflow". | Evitar testes em massa antes do dia; se faltar, criar credencial OpenAI API própria e selecioná-la nos nós "OpenAI Chat Model" e "Modelo dos Guardrails" (passo descrito nas instruções de reconstrução). |
| Atualização automática do n8n Cloud | Passou de 2.46.6 para 2.47.6 entre 11/11 e 13/11 sem quebrar o agente. | Uma nova atualização antes de 17/11 poderia mudar algum nó. | Refazer o Teste A pelo canal na manhã de 17/11; se falhar, reimportar o backup JSON desta pasta. |
| Memória por sessão no chat público | O widget guarda a sessão no navegador. | Em outro navegador ou aba anônima, a EmilIA não "lembra" conversas anteriores. | Na demonstração de memória, enviar as duas mensagens na mesma janela, sem recarregar. |
| Tempo de espera da aprovação | O pedido de aprovação espera até 30 minutos. | Se ninguém clicar, a execução segue como "negado" ao expirar. | Clicar em Aprovar/Negar logo após o pedido aparecer. |
| Gravação de teste acumulada | A tabela de teste tem 1 linha (T08B). | Cada aprovação na demonstração adiciona uma linha fictícia. | Preferir demonstrar "Negar"; se demonstrar "Aprovar", apagar a linha depois na Data table (ou deixar, pois é fictícia). |
| Dados pessoais no canal público | Canal sem login. | Alguém poderia digitar dados reais. | A regra crítica bloqueia formato de CPF e pedidos clínicos; o subtítulo avisa para não enviar dados pessoais; usar só códigos P-0xx na demonstração. |

Problemas encontrados em 13/11: nenhum. Nenhuma correção foi necessária, portanto não houve nova rodada dos oito testes da M5.
