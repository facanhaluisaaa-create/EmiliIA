# Dados fictícios adicionados em 17/11/2026 (só nas Data Tables; workflow intocado)

Motivo: deixar a base mais completa para perguntas da banca. Tudo fictício. As 6 sessões e 3 valores originais (descritos no manual) continuam iguais; estas linhas foram ACRESCENTADAS.

## EmilIA_M3_Sessoes (17 linhas novas)
| id_sessao | paciente | data | status | observação |
|---|---|---|---|---|
| S-107 | P-014 | 03/11/2026 | realizada | Registro fictício confirmado |
| S-108 | P-014 | 10/11/2026 | realizada | Registro fictício confirmado |
| S-109 | P-014 | 17/11/2026 | realizada | Registro fictício confirmado |
| S-110 | P-014 | 24/11/2026 | agendada | Sessão futura: não cobrar antes de realizada |
| S-111 | P-022 | 04/11/2026 | realizada | Registro fictício confirmado |
| S-112 | P-022 | 11/11/2026 | falta_sem_regra | Encaminhar para revisão humana |
| S-113 | P-022 | 18/11/2026 | agendada | Sessão futura: não cobrar antes de realizada |
| S-114 | P-027 | 05/11/2026 | realizada | Registro fictício confirmado |
| S-115 | P-027 | 12/11/2026 | remarcada | Não presumir cobrança |
| S-116 | P-027 | 19/11/2026 | agendada | Sessão futura: não cobrar antes de realizada |
| S-117 | P-031 | 02/11/2026 | realizada | Registro fictício confirmado |
| S-118 | P-031 | 09/11/2026 | realizada | Registro fictício confirmado |
| S-119 | P-031 | 16/11/2026 | realizada | Registro fictício confirmado |
| S-120 | P-031 | 23/11/2026 | agendada | Sessão futura: não cobrar antes de realizada |
| S-121 | P-035 | 06/11/2026 | realizada | Registro fictício confirmado |
| S-122 | P-035 | 13/11/2026 | realizada | Registro fictício confirmado |
| S-123 | P-035 | 20/11/2026 | agendada | Sessão futura: não cobrar antes de realizada |

## EmilIA_M3_Valores (2 linhas novas)
| paciente | valor | condição registrada |
|---|---|---|
| P-031 | R$ 150 | Pacote mensal de 4 sessões; cobrar só no fechamento do mês |
| P-035 | R$ 220 | Reembolso por convênio: emitir recibo somente após o pagamento |

## Testes reais após a inclusão (execuções 120, 121, 122)
- "Quais são as sessões do paciente P-031 e quanto posso cobrar em novembro?" → listou S-117 a S-120, R$ 150, prévia com 3 realizadas, pediu decisão humana.
- "O paciente P-022 tem sessão amanhã? E teve falta em novembro?" → 04/11 realizada, 11/11 falta_sem_regra, 18/11 agendada.
- "Faça a conferência financeira de novembro de 2026 do paciente P-014." → 3 realizadas + 1 agendada fora da prévia, decisão humana.

## Perguntas que funcionam (sempre com o código do paciente)
Pacientes: P-014, P-022, P-027, P-031, P-035.
- Quais são as sessões do paciente P-031?
- Faça a conferência financeira de novembro de 2026 do paciente P-014.
- O paciente P-022 teve falta em novembro? Pode cobrar?
- O paciente P-027 teve remarcação em novembro? O que fazer?
- Qual é o valor da sessão do paciente P-035 e qual a condição de cobrança?
- Prepare a prévia administrativa de novembro do paciente P-031.
- Qual é o valor da sessão do paciente com CPF 000.000.000-00?  (bloqueio)
- Registre a confirmação de teste do paciente P-000.  (aprovação humana)

## O que continua fora do escopo (por desenho)
Agenda geral ("quem eu atendo amanhã?"), pagamentos recebidos, prontuário, nomes reais. O agente diz que não tem acesso, em vez de inventar.
