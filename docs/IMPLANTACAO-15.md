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
- **Etapa D — publicação:** commits `a5f03b1` (proteção) e `e9ac393` (.gitignore de backups) em `feat/banco-e1`; main intocada. Preview acessado pelo endereço fixo da branch (`monitoria-qualida-git-4a8f74-…`) com o link de compartilhamento da Vercel de 25/10; pacote `index-CNQHoP8u.js` com o código novo, apontando só para `ydevdhtozdbwnzoyvtnz`.
- **Divergência na Etapa D (29/10, antes de qualquer gravação):** a colaboradora fictícia não existia — o 11a nunca tinha sido aplicado (falha do plano). Testes interrompidos.
- **Script 11a executado (autorizado, 29/10 ~14h35):** texto conferido (SHA-256 `1f20afaf…`), Success. Incluída só `col-teste-homolog-1` "TESTE HOMOLOGAÇÃO — FICTÍCIO" (ativa, area-1, ficticio=true, ordem 5), 0 alocações, 0 metas. Colaboradoras reais iguais (`74b87d6f…`), metas/documentos iguais, 19 monitorias/respostas/eventos iguais, fila 13, contagens de agosto iguais. Auditoria +1 (seq 909, INSERT colaboradores, responsável declarado adm-aline-oliveira, elo e hash conferidos, 0 quebras).
- Próximas: V1–V8 (aguardando ok após o relatório do 11a) e Etapa E (15b) aguardando autorização.

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
| V1 | MON-10020 (TESTE15-V1, 09:00) | Aprovado — rascunho gravado, com chave de criação | — |
| V2 | — | Aprovado — formulário recusou ("Este atendimento já tem um rascunho seu: MON-2026-0020…"); nada gravado | — |
| V3 | — | Aprovado — pergunta de possível duplicidade; "Não" → nada gravado | — |
| V4 | MON-10021 (TESTE15-V4, 09:06) | Aprovado — mesma pergunta; "Sim" → gravado | — |
| V5 | MON-10022 (TESTE15-V5, 14:00) | Aprovado — 3 cliques, botões "Salvando…" desativados, 1 registro | — |
| V6 | MON-10023 (TESTE15-V6-B, 16:00) | Aprovado — duas abas a 26 ms; B gravou, A recusada pelo BANCO (MI410, mensagem com a regra) | — |
| V7 | (MON-10008, só leitura) | Aprovado — detalhes abriram, Pendente v1, nada alterado | — |
| V8 | — | Aprovado — 19 reais idênticas (`b4a72442…`), versões iguais, fila 13, agosto 6/5/5, outubro nenhuma, metas iguais, auditoria 1027 e 0 quebras | — |

Execução: 29/10/2026 14:38–14:41 (Brasília), Preview (`index-CNQHoP8u.js`), conta de monitora da Aline. Alertas e perguntas do portal foram capturados por script na aba (o texto exibido é o mesmo; as respostas Sim/Não foram dadas pelo script). Comentário "TESTE 15…" não preenchido: a etapa Observações não abre sem passar pelas anteriores — a identificação é pelo nº do atendimento `TESTE15-V…` e pelo título `TESTE15`.

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

## Etapa E — preparação (29/10/2026, só leitura; NADA executado)

Conferência das 14:45 (Brasília): nada mudou desde o V8 (reais `b4a72442…`, versões iguais, fila 13,
agosto 6/5/5, metas `925829b0…`, auditoria 1028 = +1 acesso, 0 quebras, `duplicata_de` vazio).

| Par | Original (preservar) | Cópia (cancelar) | Atendimento | Mesmo atendimento | Cabeçalho | Respostas | Evidências | Histórico |
|---|---|---|---|---|---|---|---|---|
| 1 | MON-10007 Pendente v1 | MON-10008 Pendente v1 | Allanis · Telefone · 25/08 16:28 | sim | igual | 28 = 28 | 3 = 3, idênticas | ENVIO / ENVIO |
| 2 | MON-10011 Pendente v1 | MON-10012 Pendente v1 | Allanis · WhatsApp · 26/08 13:09 | sim | igual | 28 = 28 | 2 = 2, idênticas | ENVIO / ENVIO |
| 3 | MON-10013 Pendente v1 | MON-10014 Pendente v1 | Allanis · WhatsApp · 25/08 15:42 | sim | igual | 28 = 28 | 2 = 2, idênticas | ENVIO / ENVIO |
| 4 | MON-10016 Pendente v1 | MON-10017 Pendente v1 | Susana · WhatsApp · 24/08 15:15 | sim | igual | 28 = 28 | 2 = 2, idênticas | ENVIO / ENVIO |
| 5 | MON-10018 Pendente v1 | MON-10019 Pendente v1 | Susana · WhatsApp · 10/08 16:32 | sim | igual | 28 = 28 | 2 = 2, idênticas | ENVIO / ENVIO |

Original = a primeira criada (1–2 s antes). Esperado depois do 15b: fila 13 → 8; agosto 6/5/5 → 5/3/3;
cada cópia Cancelada v2 com motivo padrão, `duplicata_de` = original e evento CANCELAMENTO pelo
adm-aline-oliveira; auditoria +10 (5 UPDATE monitorias + 5 INSERT monitoria_eventos), 0 quebras.

## Encerramento dos testes (plano; aguardando autorização)
1. Cancelar MON-10020 a 10023 (cancelamento comum, motivo "Registro fictício da validação do script 15 (V…) — 29/10/2026"), nunca apagar.
2. Conferir: 4 Canceladas, evento CANCELAMENTO, reais intactas, auditoria íntegra.
3. Desativar `col-teste-homolog-1` (ativo = false), só depois do item 1; monitorias e histórico continuam consultáveis.

### Preparação concluída (29/10/2026, ~14h52) — nada executado no Supabase além de leituras
- **Backup antes do 15b:** `monitoria-backup-2026-10-29-antes-15b.csv` (17:47 UTC, SHA-256 `7fd69485…`), COMPLETO: 23 monitorias (19 reais + 4 fictícias), 644 respostas (532 reais + 112 das fictícias), 36 evidências, 22 eventos, auditoria 1028 e 0 quebras. Reais, respostas, evidências, histórico, colaboradoras reais, documentos e auditoria 1–907 idênticos ao backup de 14h08.
- **Conferência final dos pares (14:51):** os 5 pares Pendentes v1, mesmo atendimento, respostas iguais, cópias sem cancelamento; reais `b4a72442…`; fila 13; agosto 6/5/5; auditoria 1028 (igual ao backup, nada depois).
- **Encerramento dos testes — scripts preparados e ensaiados SÓ no local** (`testes-15c-encerramento.mjs`, 17/17), separados do 15b:
  - `15c_cancelar_ficticias_teste15.sql`: cancela só MON-10020..10023 (confere cada uma: Rascunho, fictícia, TESTE15, nº do teste, monitora usr-1); exatamente 4, nenhuma outra muda, roda uma vez. Ensaio: evento CANCELAMENTO pelo ADMIN em cada uma, auditoria +8 com o ADMIN declarado, indicadores iguais.
  - `11b_desativar_colaboradora_teste.sql`: só depois do 15c (recusa se houver monitoria dela não cancelada); desativa sem apagar; nenhuma outra colaboradora ou monitoria muda; auditoria +1; roda uma vez. Ensaio: as 4 continuam consultáveis no portal; apagar a colaboradora é impedido pelo banco.

### Etapa E — 15b EXECUTADO (29/10/2026, ~15h04 Brasília, autorizado)
- **Antes (só leitura, 15:03):** projeto monitoria-homologacao; 5 cópias Pendente v1, sem cancelamento, conteúdo = original nos 5 pares; originais `96181872…`; demais 18 monitorias `e07713cb…`; respostas 644 `4a553c88…`; evidências 36 `54ae3edd…`; histórico 22 `b5291b43…`; fila 13; agosto 6/5/5; fictícias `6e5f14b8…`; auditoria 1028 (= backup antes-15b), 0 quebras. conferencia-15: 5 grupos em dobro, 0 canceladas.
- **Execução:** texto no editor = arquivo (SHA-256 `da7ae326…`, igual ao commit `a5f03b1`). "Success".
- **Depois:**
  - cópias MON-10008/10012/10014/10017/10019: Cancelada v2, `duplicata_de` = MON-10007/10011/10013/10016/10018, cancelado_por adm-aline-oliveira, motivo "Duplicidade: cópia de MON-2026-00xx, criada em dobro (25/10/2026 hh:mm:ss).";
  - originais: mesmas linhas (`96181872…`), Pendente v1; demais 18 monitorias idênticas (`e07713cb…`), inclusive as 4 fictícias (`6e5f14b8…`);
  - respostas e evidências idênticas; histórico anterior (22 eventos) idêntico; +5 eventos CANCELAMENTO pelo ADMIN com o motivo;
  - fila 13 → **8**; agosto 6/5/5 → **5/3/3**; no portal (Relatórios, agosto): 18 monitorias, 5 canceladas, **11 na média** (eram 16), média geral 95,08% → 93,41% (as cópias eram de 100% e pesavam em dobro);
  - auditoria 1028 → 1038: 5 UPDATE monitorias + 5 INSERT monitoria_eventos, todos com responsável declarado adm-aline-oliveira; 0 quebras;
  - conferencia-15: 5 canceladas, 0 grupos em dobro, item 11 com os 5 pares, respostas/evidências com a mesma impressão.
- Pendente (autorização separada): encerramento dos testes (15c → 11b).

### Encerramento dos testes — 15c e 11b EXECUTADOS (29/10/2026, ~15h08 Brasília, autorizado)
- **15c** (texto `dabccd8c…`): antes, as 4 em Rascunho v1, fictícia, TESTE15, nº de cada teste, monitora usr-1; nenhuma outra monitoria da fictícia. Depois: MON-10020..10023 Cancelada v2 pelo adm-aline-oliveira, motivos "Registro fictício da validação do script 15 (V1/V4/V5/V6) — 29/10/2026. Encerramento dos testes."; +4 eventos CANCELAMENTO; auditoria +8 (ADMIN declarado), 0 quebras; 19 reais idênticas (`5233f495…`), respostas/evidências idênticas, histórico anterior (27) idêntico, fila 8, agosto 5/3/3, metas e colaboradoras reais iguais.
- **11b** (texto `d913aeb2…`): pré-requisitos OK (ativa, todas as monitorias dela Canceladas, sem carteira nem meta). Depois: `col-teste-homolog-1` ativo = false (v2), registro mantido; nenhuma monitoria nem outra colaboradora mudou; auditoria +1 (colaboradores UPDATE, ADMIN declarado), total 1048, 0 quebras; versão '11b' registrada.
- **Portal (Preview, só leitura):** Relatórios de setembro mostram as 4 fictícias Canceladas, consultáveis, fora da média.
- **DIVERGÊNCIA (de expectativa, não de dados):** a colaboradora inativa CONTINUA na lista "Colaborador" da Nova Monitoria — o formulário lista todas as colaboradoras sem filtrar `active` (`MonitoringForm.tsx`, `collaborators.map`), comportamento anterior ao 15; e `api.salvar_monitoria` só confere se a colaboradora existe. Nada corrigido; aguardando decisão.
