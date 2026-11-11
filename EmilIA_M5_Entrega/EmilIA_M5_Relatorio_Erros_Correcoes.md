# Relatório de erros, ajustes e correções — M5

| # | Momento | O que aconteceu | Causa | Ajuste | Resultado |
|---|---|---|---|---|---|
| 1 | Publicação | `PATCH /rest/workflows/:id` com `active: true` devolveu `active: false` (sem erro). | Na versão 2.46 do n8n Cloud a ativação é feita por endpoint próprio (`POST /rest/workflows/:id/activate`), equivalente ao botão **Publish** do editor. | Ativado pelo endpoint correto. | Workflow ativo; URL do chat respondeu HTTP 200. |
| 2 | Primeira mensagem no canal (execução 32, 18:36) | Mensagem de verificação enviada antes da bateria oficial para descobrir os seletores do widget. | Procedimento de preparação. | Registrada como fora da matriz. | Não contaminou os testes (cada teste em sessão nova). |
| 3 | Widget | Após a resposta, o indicador "digitando" permaneceu alguns segundos na tela. | No modo Response Nodes o widget só encerra o indicador quando a execução termina. | Espera adicional antes do print. | Prints sem o indicador. |
| 4 | Herança da M4 | Na M4 as respostas fixas usavam nós Set (modo Last Node). O chat hospedado com aprovação exige modo Response Nodes. | Mudança de modo de resposta. | Respostas fixas convertidas em nós Chat (send); todos os caminhos terminam em um nó Chat. | Todos os oito caminhos responderam no canal. |

Nenhum teste reprovou; não houve correção de código entre execuções. Para o desafio B5 (erro reproduzido e corrigido), o item 1 é o único erro real reproduzível (ativação pela API) e está documentado com a correção.
