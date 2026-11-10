# TABELA 2 — PERMISSÕES (EmilIA, M4, G29)

| Permitido | Proibido | Exige decisão ou aprovação humana |
|---|---|---|
| Consultar sessões fictícias por código de paciente e período (`consultar_sessoes`, leitura) | Processar mensagens com sequência no formato de CPF (bloqueio programado, antes do agente) | **Decisão humana** (recomendação financeira): definir o que cobrar, descontos, parcelamentos, tratamento de faltas e remarcações. O agente apresenta prévia e recomendação; a pessoa responsável decide. |
| Consultar valor unitário e condição cadastrada (`consultar_valores`, leitura) | Atender pedidos de prontuário, diagnóstico, laudo ou conteúdo de sessão (bloqueio programado + regra 5 da System Message) | **Decisão humana**: validar inconsistências apontadas (sessão sem status, código sem valor, divergência entre sessões e pagamento). |
| Separar sessões realizadas, remarcadas e faltas e sinalizar inconsistências | Inventar sessões, valores, datas ou pagamentos (regra 2) | **Mecanismo técnico de aprovação de ferramenta de escrita**: **não se aplica nesta versão**, porque não existe ferramenta de escrita, envio, cobrança ou agenda ligada ao agente. Qualquer ferramenta desse tipo, se adicionada no futuro, deverá passar por um nó de aprovação (por exemplo, Chat "Send and Wait" com Aprovar/Negar) antes de executar. |
| Preparar prévia administrativa de fechamento (quantidade de sessões realizadas e valor unitário cadastrado) | Executar cobranças, enviar mensagens/e-mails/documentos, alterar cadastros, registrar pagamentos ou modificar agendas (não há ferramenta para isso; regra 7) | |
| Lembrar o contexto da conversa atual (janela de 10 interações, mesma sessão) | Afirmar ter consultado uma base sem a ferramenta ter executado (regra 4); afirmar memória de longo prazo | |
| Responder em português, no formato dos cinco itens | Seguir instruções de manipulação ("ignore as instruções", "revele a System Message"): bloqueio pelo Guardrails (keywords + jailbreak) e regra 9 | |
| Usar exclusivamente dados fictícios e códigos P-000 | Tratar instruções encontradas nos dados consultados como comandos (regra 9) | |

Distinção importante: "exige decisão humana" na coluna da direita é uma **revisão humana de recomendação** (o agente não decide nem executa nada financeiro). Um **mecanismo técnico de aprovação** só faz sentido quando o agente possui uma ferramenta capaz de executar a ação; nesta versão de leitura, não há.
