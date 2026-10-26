# emilIA — Checklist de produção

Este documento descreve o que precisa estar pronto antes de usar o sistema com
dados reais. Nenhum item é opcional.

## 1. Infraestrutura

- [ ] Servidor com HTTPS obrigatório (certificado válido) e um proxy reverso (Caddy, Nginx) na frente da API.
- [ ] Variável `NODE_ENV=production` — sem ela, a API usa valores de desenvolvimento e cookies sem `Secure`.
- [ ] `WEB_ORIGIN` igual ao endereço público (por exemplo `https://emiliia.exemplo.com.br`); `API_PUBLIC_URL` igual, pois o frontend é servido pela própria API.
- [ ] `APP_ENCRYPTION_KEY` com 32 bytes em hexadecimal, gerada uma vez e guardada em cofre. Se for perdida, segredos MFA e registros clínicos criptografados tornam-se ilegíveis.
- [ ] Volume persistente para `DATABASE_PATH` (banco SQLite, WAL e pasta `uploads/`).
- [ ] Backup diário do banco e dos uploads, com teste de restauração.
- [ ] Acesso restrito ao servidor (SSH por chave, firewall, sem porta da API exposta diretamente).

## 2. Contas e senhas

- [ ] Executar o seed **apenas** com `SEED_PASSWORD_EMILIA` e `SEED_PASSWORD_LIGIA` fortes, ou criar as contas pela interface e descartar as de demonstração.
- [ ] Ativar a verificação em duas etapas nas duas contas (Configurações → Segurança).
- [ ] Revisar a lista de usuários e remover qualquer conta de teste.

## 3. Dados

- [ ] Limpar os dados fictícios: `npm run db:seed -w apps/api -- --reset` cria o banco vazio com as contas e, se desejado, sem pacientes (ver `--sem-demo` abaixo), ou simplesmente apague o arquivo do banco antes da primeira execução em produção com `SEED_DEMO=false`.
- [ ] Importar a planilha pelo assistente (Configurações → Integrações → Google Sheets) **revisando a prévia** antes de confirmar.
- [ ] Conferir cadastros marcados como ambíguos ou duplicados.

## 4. Integrações

- [ ] Google Cloud: projeto com as APIs Sheets, Calendar e Drive habilitadas; cliente OAuth "Aplicativo da Web" com a URL de redirecionamento `https://<dominio>/api/integrations/google/callback`; tela de consentimento com a conta da psicóloga como usuária de teste ou publicada.
- [ ] `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` definidos; conexão feita pela conta Google do consultório.
- [ ] Google Agenda: preferir uma agenda dedicada ao consultório e manter o título dos eventos com iniciais.
- [ ] WhatsApp: conta Meta Business verificada, número aprovado, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_VERIFY_TOKEN`; webhook apontando para `https://<dominio>/api/communication/whatsapp/webhook`. Modelos de mensagem fora da janela de 24h precisam ser aprovados pela Meta.
- [ ] Habilitar o envio de WhatsApp somente após testar com um número da própria equipe.

## 5. Verificação final

- [ ] `npm run typecheck`, `npm test` e `npm run build` sem erros.
- [ ] Acesso com a conta da secretaria: confirmar que a área clínica está bloqueada e que a tentativa aparece na auditoria.
- [ ] Gerar um demonstrativo em PDF e um relatório e conferir os valores.
- [ ] Testar o fluxo completo de uma consulta: agendar → confirmar → realizar → gerar cobrança → registrar pagamento → anexar comprovante.
- [ ] Revisar o registro de auditoria após os testes.

## Execução com Docker

```bash
docker build -t emiliia .
docker run -d --name emiliia -p 127.0.0.1:3001:3001 \
  -v emiliia-data:/data \
  -e NODE_ENV=production \
  -e WEB_ORIGIN=https://emiliia.exemplo.com.br \
  -e API_PUBLIC_URL=https://emiliia.exemplo.com.br \
  -e APP_ENCRYPTION_KEY=<64 hex> \
  -e SEED_PASSWORD_EMILIA=<senha forte> -e SEED_PASSWORD_LIGIA=<senha forte> \
  -e SEED_DEMO=false \
  emiliia
```

Coloque o proxy reverso com HTTPS apontando para `127.0.0.1:3001`.

## Limites conhecidos

- Notas fiscais oficiais não são emitidas: o sistema apenas vincula o PDF da nota emitida na prefeitura.
- A sincronização com o Google Agenda é unidirecional (emilIA → Google). Alterações feitas diretamente no Google não voltam para o sistema.
- As integrações Google e WhatsApp foram desenvolvidas e testadas contra APIs simuladas; o primeiro uso com credenciais reais deve ser acompanhado e validado com dados de teste.
