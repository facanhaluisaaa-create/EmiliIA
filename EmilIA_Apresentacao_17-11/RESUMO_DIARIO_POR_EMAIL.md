# Resumo diário por e-mail — workflow "PF - G29 - EmilIA - Resumo diário por e-mail"

Separado do agente (o agente não foi tocado). Ativo no n8n desde 17/11/2026.

**Como funciona:** todo dia às 7h (horário de São Paulo) busca as sessões do dia na tabela EmilIA_M3_Sessoes e monta um e-mail no estilo da EmilIA: horário, paciente (nome e código), tipo, status e pagamento, mais canceladas/remarcadas/faltas à parte. Não envia nada a pacientes.

**Prévia para a apresentação (funciona agora):**
https://grupoemilia.app.n8n.cloud/webhook/emilia-g29-resumo-do-dia
Outro dia: acrescente `?data=2026-11-18`.
Conferido com a planilha: 17/11 = 6 sessões (Gustavo 13h, Beatriz 15h, Diego 16h, Tiago 18h, Sabrina 19h, Rafaela 20h); 18/11 = 4 sessões.

**Para enviar de verdade (falta só isto, feito por quem é dono do Gmail):**
1. n8n → Credentials → Create credential → **Gmail OAuth2 API** → Sign in with Google → Permitir.
2. No workflow, nó **Enviar e-mail (Gmail)**: escolher a credencial e trocar o destinatário (hoje está `DEFINA-O-EMAIL-DA-EQUIPE@exemplo.com`).
3. Ligar o nó (está desligado) e **Publish**.
O agendamento das 7h já roda todo dia; enquanto o nó de envio estiver desligado, o e-mail é montado mas não sai.

**Frase para a banca:** "Toda manhã a EmilIA monta a agenda do dia e manda para a equipe. Aqui está a prévia com a agenda de hoje; o envio só depende de conectar o e-mail do consultório."
