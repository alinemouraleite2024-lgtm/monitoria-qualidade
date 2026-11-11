# Script 21 — situação "Em reavaliação"

> Situação: **preparado e testado só no ambiente local** (11/11/2026). Nada foi executado no Supabase,
> nada foi publicado. Cada passo abaixo depende de autorização específica da gestão da qualidade.

## Decisões da gestão da qualidade (11/11/2026)

1. Quando o supervisor devolve para ajustes, a monitoria fica **"Em reavaliação"**, e não Rascunho.
2. Ela continua **realizada e entregue**: ocupa a vaga da meta. A **nota fica fora da média** até o reenvio.
3. As cinco devolvidas existentes são convertidas: **MON-10001, MON-10028, MON-10030, MON-10031 e MON-10034**.
   A conversão preserva dados, notas, evidências, histórico e auditoria.
4. O cancelamento continua exclusivo do Administrador com MFA.

## O que muda

| Onde | Mudança |
|---|---|
| Banco (`21_em_reavaliacao.sql`) | Situação nova permitida. `api.devolver_monitoria` grava "Em reavaliação". `api.salvar_monitoria` deixa a própria monitora editar e reenviar. Gatilho do histórico: devolução vira DEVOLUCAO; a troca Rascunho ↔ Em reavaliação (conversão/reversão) não grava evento. Conversão das cinco. |
| Portal | Conta como feita (vaga própria "Em reavaliação"), fora da média; "Precisa da sua ação" da monitora com o motivo; formulário com "Salvar ajustes" e "Reenviar para validação"; bloco "Em reavaliação" para o supervisor, fora da fila; filtro e cor nas listas; textos dos relatórios e do PDF. |
| Não muda | Privacidade (18), área privada (19), fila de validação, validar, reprovar, cancelar, notas, critérios, pesos, réguas, importador JSON e exportações (o CSV e o PDF já mostram a situação). |

## Testes (local)

- Portal: 162 testes de unidade (11 novos em `tests/emReavaliacao.test.ts`, inclusive a competência inicial do supervisor no reenvio).
- Banco: `testes-21-reavaliacao.mjs`, 32/32, com dados fictícios. Inclui a recusa do script real fora da homologação,
  a conversão, devolução, ajustes, reenvio, cancelamento pelo Administrador e a reversão.
- Ensaio sobre a cópia do backup `monitoria-backup-2026-11-11-antes-20.csv` (`testes-21-dados-reais.mjs`), 16/16, com o script 20 aplicado como na homologação,
  com o arquivo do 21 sem alteração:
  - mudam só as cinco;
  - não há devolução duplicada;
  - a auditoria ganha 5 registros e a cadeia fica íntegra;
  - o conjunto de privadas é o mesmo;
  - a configuração do supervisor (início em 2026-10) é preservada e a fila dele continua MON-10029, MON-10036 e MON-10037;
  - em agosto, único mês com metas por colaboradora, a MON-10001 passa a ocupar uma vaga (11 → 12), sem repetição;
  - a monitora passa de 7 para 11 feitas em outubro;
  - a média de outubro fica igual (93,87%);
  - o 21r desfaz tudo.
- Todas as suítes do banco (`rodar-todos.mjs`) aprovadas.

## Ordem de implantação (cada passo com autorização)

1. Commit e publicação **do portal** no Preview (ele entende as duas formas, antes e depois do 21).
2. Backup novo da homologação e novo ensaio com ele (`testes-21-dados-reais.mjs`).
3. Execução do `21_em_reavaliacao.sql` no Supabase de homologação. O script recusa sozinho se as devolvidas não forem exatamente as cinco.
4. Conferência nos dois perfis.

**Reversão:** `21r_reverter_reavaliacao.sql`. Antes, é preciso republicar o portal anterior. O 21r volta toda monitoria "Em reavaliação" a Rascunho com motivo, sem evento novo.

**Reenvio e competência inicial:** reenviada, a monitoria volta a Pendente e segue a regra do supervisor. As de outubro em diante entram na fila do supervisor. A MON-10001, de agosto, fica fora da fila e continua em Relatórios, como as demais pendências de agosto.

**Observação para backups futuros:** os ensaios que restauram backup precisam instalar o 21 quando o backup tiver a versão 21, como já fazem com 18 e 19.
