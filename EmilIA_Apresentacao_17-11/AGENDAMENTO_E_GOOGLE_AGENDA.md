# Agendamento pela EmilIA (com aprovação humana) e Google Agenda — 17/11/2026

## Como funciona
1. A assistente pede no chat: "Agende uma sessão online para o Gustavo Gomes na quarta-feira 25/11/2026 às 10:00."
2. O agente consulta valor e tipo do paciente e propõe o agendamento (não grava nada).
3. Código confere data, horário (07h–21h, não domingo, não no passado), tipo e valor.
4. **Conferir conflito na agenda**: código procura sessão ativa no mesmo dia e horário. Se houver, responde "Não agendei: já existe sessão de …".
5. **Pedir aprovação do agendamento**: botões Aprovar / Negar.
6. Aprovar → **Gravar sessão agendada** (tabela de sessões, status "agendada", pagamento "Pendente", observação "Agendada pela EmilIA com aprovação humana em …") → **Google Agenda: criar evento** → resposta "Agendado: …".
7. Negar → "agendamento negado, nada foi gravado".

O caminho antigo (confirmação de teste P-000) continua igual.

## Testes reais (execuções 151–160)
| Teste | Resultado |
|---|---|
| Natália, 26/11 10:00, Aprovar | Gravado na tabela; resposta "Agendado…" |
| Tiago, 26/11 10:00 (já ocupado) | "Não agendei: já existe sessão de Natália…" |
| Gustavo, 25/11 10:00, Negar | "agendamento negado, nada foi gravado" |
| Gustavo, 25/11 10:00, Aprovar | Gravado na tabela |
| P-000, Negar (2×) | Botões e "ação negada" como antes |
| Consulta Leonardo e bloqueio de CPF | Funcionando |
As duas sessões de teste foram apagadas depois; a tabela voltou a 1.353 sessões (igual à planilha).

Observações honestas: o agente às vezes recusa antes dos botões quando vê divergência (ex.: pedir online para paciente presencial) e, num teste, citou a data errada de uma sessão existente (26/11 em vez de 25/11). Para a demo, peça no tipo habitual do paciente e num horário livre.

## Google Agenda — o que falta (só vocês podem fazer)
O nó **Google Agenda: criar evento** já está montado, mas **desligado** (não há conta Google conectada). Enquanto isso, a resposta diz "Google Agenda: aguardando conexão da conta do consultório".
1. n8n → **Credentials → Create credential → Google Calendar OAuth2 API → Sign in with Google** (prefira uma conta Gmail; contas da faculdade podem bloquear).
2. No workflow, abra **Google Agenda: criar evento**, selecione a credencial e a agenda (ou deixe "primary").
3. Clique com o botão direito no nó → **Activate** (ou atalho D) para ligá-lo.
4. **Publish**. A partir daí a resposta passa a dizer "… e no Google Agenda", e o evento aparece com título "Sessão — Nome (PAC-000)", 50 minutos.

## Boa pergunta para a demo
`Agende uma sessão online para o Gustavo Gomes na quarta-feira 25/11/2026 às 10:00.` → Aprovar → mostrar a linha nova na tabela de sessões.
Depois: `Agende uma sessão presencial para o Tiago Zanetti na quarta-feira 25/11/2026 às 10:00.` → "Não agendei: horário ocupado".

## Atualização 15h — horários livres do dia
Nova ferramenta só de leitura no agente: **consultar_agenda_do_dia** (filtra a tabela de sessões pela data).
Horário de atendimento informado ao agente: segunda a sábado, 08h–11h e 13h–20h (12h almoço).
Teste real (execução 188): "Quais horários estão disponíveis para consulta no dia 27/11?" → livres 08:00, 10:00, 13:00, 16:00 e 19:00 — igual à planilha.
Regressão depois da mudança (execuções 189–194): consultas da Giovana e do Leonardo, bloqueio de CPF e agendamento com Negar, todos corretos.

## Atualização 15h45 — horário ocupado → horário livre
O agente agora consulta a agenda do dia antes de propor qualquer agendamento. Testes reais (execuções 233–242):
- "Agende o Leonardo na sexta 27/11 às 9h." → "horário ocupado por Bruno Menezes Rangel (PAC-013)" + lista dos livres (ou a trava em código: "Não agendei: já existe sessão de…").
- "Então agende o Leonardo às 8h." → botões Aprovar/Negar (2 de 2). Sem repetir o nome ("Então agende às 8h") funcionou 1 de 2: na apresentação, repetir o nome.
