#!/bin/bash
cd /tmp/claude-0/-home-user-EmiliIA/b3cbaaaa-db5a-53a1-ab46-f80dd3945e63/scratchpad/n8nrun
export N8N_PORT=5678 N8N_HOST=127.0.0.1 N8N_PROTOCOL=http N8N_SECURE_COOKIE=false N8N_USER_FOLDER=$PWD/data
export N8N_DIAGNOSTICS_ENABLED=false N8N_VERSION_NOTIFICATIONS_ENABLED=false N8N_TEMPLATES_ENABLED=false GENERIC_TIMEZONE=America/Sao_Paulo TZ=America/Sao_Paulo
export N8N_ENCRYPTION_KEY=<CHAVE-LOCAL-DE-TESTE-REMOVIDA> N8N_RUNNERS_ENABLED=true N8N_PERSONALIZATION_ENABLED=false N8N_HIRING_BANNER_ENABLED=false
export N8N_LISTEN_ADDRESS=127.0.0.1 N8N_WORKER_SERVER_ADDRESS=127.0.0.1
export WEBHOOK_URL=http://127.0.0.1:5678/ N8N_LOG_LEVEL=debug
export PATH=/tmp/claude-0/-home-user-EmiliIA/b3cbaaaa-db5a-53a1-ab46-f80dd3945e63/scratchpad/node24/bin:$PATH
exec node ./node_modules/n8n/bin/n8n start
