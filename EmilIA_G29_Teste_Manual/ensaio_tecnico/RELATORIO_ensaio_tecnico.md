# Ensaio técnico do manual v2.1 — 16/11/2026

**O que é:** uma montagem de conferência feita por quem construiu o agente original (o assistente de programação do grupo), seguindo o manual v2.1 na ordem dos blocos A a H, para achar erros antes do teste do colega. **Não substitui o teste de reprodução da Seção 8**, que deve ser feito por uma pessoa que não montou o agente.

**Como foi feito:** workflow novo `PF - G29 - ensaio técnico do manual` (id dcjWErfajGtuCws6) na instância do grupo, criado vazio e preenchido nó a nó com os mesmos nomes, campos e textos do manual, inclusive os estados temporários (prompt e memória em "Connected Chat Trigger Node" até o passo 16; modo de resposta padrão até o passo 9). Tabela de gravação própria `EmilIA_Ensaio_Confirmacoes` (vazia). Tabelas de leitura reutilizadas. O agente original `PF - G29 - EmilIA - M5` não foi tocado (conferido: continua publicado e respondendo). A cópia foi despublicada ao final para não deixar um segundo canal público.

| Bloco / teste | Resultado real | Execução |
|---|---|---|
| A (gatilho) | Nó criado sem Options; mensagem aparece no chat do editor. | — |
| B (agente + modelo, sem System Message) | "Olá! Eu sou o ChatGPT…" — resposta genérica, como o manual prevê. | manual |
| C (System Message) | Apresentou-se como EmilIA, citou sessões, valores, prévia; disse que não cobra, não envia, não trata conteúdo clínico. | manual |
| D (ferramentas) | S-101 — 05/10/2026 e S-102 — 12/10/2026; consultar_sessoes no Logs. | manual |
| E (memória, mesma sessão) | R$ 180,00 para P-014 sem pedir o código. | manual |
| F (habilidade) | S-103 realizada, S-104 remarcada, R$ 160,00, decisão humana. | manual |
| G1 (passo 9: Response Nodes + Chat com `{{ $json.output }}`) | Resposta entregue pelo nó Responder no chat. **Este era o único passo ainda não verificado; funcionou.** | manual |
| G2 (CPF fictício) | Resposta fixa; Logs: Chat Trigger → Regra crítica → Bloqueado? → Responder bloqueio. | manual |
| G3 (manipulação) + D e E repetidos | Resposta fixa do Fail; depois S-101/S-102 e R$ 180,00 com as expressões novas (memória continua funcionando). | manual |
| G4 (aprovação negada, chat do editor) | Pedido com Ação/Paciente/Identificador e botões; Negar → "Entendido, ação negada…"; caminho Aprovado? → Responder: negado; nó de gravação não executou; tabela com 0 linhas. | 59 |
| H (publicar; URL própria da cópia) | HTTP 200; consulta respondida pelo canal; execução em modo webhook. | 58 |
| Teste final 3 pelo canal da cópia | Negar → "Entendido, ação negada…"; tabela com 0 linhas. | 60 |

**Erros do manual encontrados no ensaio:** nenhum nos passos, nomes de campos ou textos. Observações:
1. Execução 57 ficou em "waiting": foi uma falha da ferramenta de automação ao clicar em Negar (o clique não foi aplicado), não do manual; repetida com sucesso (59). Para uma pessoa, basta clicar no botão. Se um pedido de aprovação ficar sem resposta, ele expira em 30 min como negado.
2. No passo 9 a observação "não testado nesta ordem exata" pode ser removida do manual: foi testado agora.

Prints nesta pasta (`ensaio_*.png`) e registros em `registro_ensaio.json` e `registro_ensaio_canal.json`.
