# Implantação do script 15 — proteção contra duplicidade

Plano preparado em 29/10/2026. **Nada daqui foi executado.** Cada etapa depende de autorização
específica da Aline, dada separadamente.

Banco: `monitoria-homologacao` (ydevdhtozdbwnzoyvtnz). Produção (`main`) não é tocada.

## Duas instalações separadas

| | Script 15 — proteção | Script 15b — cancelamento das 5 cópias |
|---|---|---|
| O que faz | Cria a regra que impede nova duplicidade (chave de criação, gatilho MI410, função de cancelamento por duplicidade) | Cancela MON-10008, 10012, 10014, 10017 e 10019, apontando a original de cada uma |
| Muda monitorias existentes? | **Não.** Conteúdo e situação das 19 ficam iguais; as duas colunas novas ficam vazias | Sim, só as 5 cópias: situação Cancelada, motivo padrão, referência à original, evento no histórico |
| Muda indicadores? | Não | Sim: fila 13 → 8, metas e médias passam a contar cada atendimento uma vez |
| Pode ser desfeito? | Sim, pelo `15r_reverter_duplicidade.sql` | Não por script (cancelamento é definitivo no portal); exige decisão à parte |
| Pré-requisito | Script 14 | Script 15 instalado e validado no Preview |

O 15b é recusado se o 15 não estiver instalado. O 15r é recusado depois do 15b.

## Etapas

Antes de cada script: SQL Editor aberto no projeto `monitoria-homologacao`, conferido pelo nome
no topo da tela.

### Etapa 0 — situação atual (só leitura)
Rodar `supabase/sql/conferencia-15.sql`. Esperado:
- scripts até o 14, sem o 15;
- 19 monitorias: 13 Pendente, 3 Validada, 2 Rascunho, 1 Reprovada;
- 0 canceladas;
- 5 grupos de mesmo atendimento em dobro (os pares);
- auditoria com 0 quebras;
- item 10 vazio (nenhum objeto do 15).

Se algo diferir do backup de 28/10 (por exemplo, monitoria validada ou criada depois), avaliar
antes de seguir.

### Situação — 29/10/2026
- **Etapa 0 (A) concluída:** banco igual ao backup de 28/10 (mesmas impressões; só +3 acessos).
- **Etapa 1 (B) concluída:** `monitoria-backup-2026-10-29.csv` (17:08 UTC, SHA-256 `5e07de4b…`), COMPLETO, 19 monitorias, 532 respostas, 36 evidências, 22 eventos, auditoria 907 com 0 quebras.
- **Etapas 2–4 (C) concluídas — script 15 instalado em 29/10/2026 (~14h30, Brasília):** texto conferido no editor (SHA-256 `0310aba8…`, igual ao arquivo), execução "Success", conferencia-15 ANTES × DEPOIS com itens 2–9 idênticos (19 monitorias 13 Pendente/3 Validada/2 Rascunho/1 Reprovada; impressões `b4a72442…`, `7c59bd8e…`, `516881b3…`, eventos 22 `b5291b43…`; auditoria 768 sem acessos, 0 quebras; 0 canceladas; 5 pares), item 10 com os 5 objetos, item 11 nenhuma. Indicadores iguais (fila 13; contam ago/26 6/5/5; metas 7 `925829b0…`; documentos e configurações iguais; versões das 19 iguais); colunas novas vazias; auditoria total 907 antes e depois (a instalação não gravou nada).
- Próximas: Etapa D (portal no Preview + V1–V8) e Etapa E (15b) aguardando autorização.

### Etapa 1 — backup novo
`backup-completo.sql` → Download CSV → `Backups MonitorIA/monitoria-backup-AAAA-MM-DD.csv`,
conferido pelo `restauracao.mjs` (0 problemas) e registrado em `BACKUP-MANUAL.md`.

### Etapa 2 — conferência ANTES
Rodar `conferencia-15.sql` e guardar o resultado (itens 1 a 11).

### Etapa 3 — script 15
Rodar `15_duplicidade_criacao.sql` (uma transação só; conferência interna no fim).

### Etapa 4 — conferência DEPOIS
Rodar `conferencia-15.sql`. Critério de aprovação:
- itens **2 a 9 idênticos** à Etapa 2;
- item 1 com o 15;
- item 10 com os 5 objetos;
- item 11 "nenhuma".

### Etapa 5 — validação no Preview (ver abaixo)
Exige publicar o portal novo no Preview (commit e push em `feat/banco-e1`), com autorização
própria.

### Etapa 6 — script 15b (só depois da Etapa 5 aprovada)
1. Conferência antes.
2. `15b_cancelar_duplicatas_homologacao.sql`.
3. Conferência depois. Esperado:
   - 5 canceladas;
   - item 9 "0 · nenhum";
   - item 11 com os 5 pares;
   - itens 4 e 5 iguais;
   - auditoria com 0 quebras.

## Reversão (se alguma verificação falhar)

| Situação | O que fazer |
|---|---|
| O SQL Editor mostra erro durante o 15 | O 15 roda numa transação: um erro desfaz tudo. Mesmo assim, **o erro na tela não prova a reversão**: rodar `conferencia-15.sql` e confirmar o item 10 vazio e o item 1 sem o 15. Se estiver tudo como antes, nada a reverter. |
| O 15 instalou, mas a conferência DEPOIS difere nos itens 2–9 | Parar. Não usar o portal para gravar. Rodar `15r_reverter_duplicidade.sql` (autorização própria) e conferir de novo. Se os itens não voltarem, comparar com o backup da Etapa 1 antes de qualquer outra ação. |
| A proteção atrapalha o uso no Preview (bloqueio indevido) | `15r_reverter_duplicidade.sql`. O portal novo continua funcionando sem o 15 (ensaio R.8), então o Preview não precisa ser revertido junto. |
| O portal novo apresenta problema no Preview | Republicar a versão anterior do Preview. O banco com o 15 funciona com o portal anterior. |
| Problema depois do 15b | O 15r é recusado. Os cancelamentos ficam registrados e auditados. Tratar em decisão à parte, com o backup da Etapa 1. |

O `15r`:
- remove o gatilho, as funções e as colunas do 15;
- devolve a `api.salvar_monitoria` ao texto exato do script 08;
- retira a versão 15;
- não altera nenhuma monitoria, resposta, evidência, evento do histórico ou auditoria.

Ensaio: `supabase/testes/testes-15-reversao.mjs`.

## Validação no Preview, antes de qualquer cancelamento

Tudo com a **colaboradora de teste da homologação** (`col-teste-homolog-1`, script 11a), canal
Telefone. Tudo fica em **Rascunho**: não entra na fila do Erivan, nas metas nem nas médias.
Comentário: "TESTE 15 — validação da duplicidade".

| # | Ação | Resultado esperado |
|---|---|---|
| V1 | Criar rascunho: atendimento hoje 09:00–09:05, nº T-1 | Grava |
| V2 | Novo rascunho, mesmo dia, **09:00**, nº "t1" (outro preenchimento) | Recusado com a mensagem "Este atendimento já tem um rascunho seu: MON-…"; nada gravado |
| V3 | Novo rascunho, 09:06, outro nº | Pergunta de possível duplicidade. Responder **Não**: nada gravado |
| V4 | Repetir V3 e responder **Sim** | Grava (atendimento diferente) |
| V5 | Novo rascunho, 14:00, clicando **duas vezes seguidas** em Salvar | Botão mostra "Salvando…", um único registro |
| V6 | Duas abas do portal, mesmo atendimento 16:00, salvar nas duas quase juntas | Uma grava, a outra recebe a recusa (ver limitação) |
| V7 | Abrir uma monitoria antiga duplicada (ex.: MON-10008) e apenas visualizar | Abre normalmente; nada muda (o gatilho não age em quem não muda de atendimento) |
| V8 | Conferência só leitura depois | Itens 3–6 das 19 monitorias anteriores sem mudança, exceto pelas novas de teste; 0 quebras |

### Identificação e tratamento dos registros fictícios

**Identificação (todos os campos ao mesmo tempo):**

| Campo | Valor |
|---|---|
| Colaboradora | `col-teste-homolog-1` — "TESTE HOMOLOGAÇÃO — FICTÍCIO" (script 11a; nenhuma meta) |
| Nº do atendimento | `TESTE15-V1`, `TESTE15-V2`… (o número do teste) |
| Nº do título | `TESTE15` |
| Comentário | `TESTE 15 — validação da duplicidade — registro fictício — V<n> — <data>` |
| Situação | Somente **Rascunho**: nunca enviar. Fora da fila, das metas e das médias. |
| Evidências | Nenhuma: sem áudio, sem anexo, sem dado de cliente |

**Durante:** cada MON-… criada é anotada na tabela de registro abaixo, com o teste e o resultado.

**Depois da validação (autorização própria):**
- Cada registro fictício é **cancelado, não apagado**, pela função de cancelamento que já existe:
  ADMIN com MFA, motivo `Registro fictício da validação do script 15 (V<n>) — <data>`.
- O cancelamento deixa a monitoria visível com situação Cancelada, guarda o histórico (evento de
  cancelamento com responsável e motivo) e mantém a cadeia da auditoria. Nada some.
- Fica de fora o cancelamento por duplicidade (`duplicata_de`), reservado às cópias reais.

**Conferência só leitura** que localiza todos os fictícios:

```sql
select id, status, numero_atendimento, comentarios
  from public.monitorias
 where colaborador_id = 'col-teste-homolog-1' and numero_titulo = 'TESTE15'
 order by id;
```

**Registro:**

| Teste | MON | Resultado | Cancelada em |
|---|---|---|---|
| | | | |

Aprovada a validação, a Etapa 6 pode ser autorizada.

## Limitação registrada — concorrência

O ensaio local usa PGlite, que tem uma conexão só. A máquina não tem PostgreSQL, Docker nem
WSL, e a Aline decidiu não instalar (29/10/2026).

**Provado:**
- o índice único da chave de criação recusa a mesma requisição repetida (D.8);
- o clique duplo é bloqueado na tela (V5).

**Não provado com duas conexões reais:**
- a trava de transação (`pg_advisory_xact_lock`) que enfileira dois pedidos *diferentes* do
  mesmo atendimento.

Ela segue o comportamento documentado do PostgreSQL (READ COMMITTED: o segundo pedido espera o
primeiro e só então confere). A V6 é a verificação controlada possível na homologação: não é
uma prova de simultaneidade exata.
