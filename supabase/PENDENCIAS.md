# Pendências do banco compartilhado

Itens que precisam ser resolvidos **antes da publicação definitiva** (Produção) do portal
compartilhado. Bloqueio visual na tela não conta como solução.

## P1 — Reprovação direta de monitoria migrada sem régua (aberta em 14/10/2026)

**Classe:** segurança / regra de negócio.

**Situação:** a regra M1 (script 08, revisão de 12/10) impede **validar** e **confirmar
zeramento** de uma monitoria migrada cuja nota nunca foi calculada pelo banco
(`origem = 'migracao'` e `regua_versao_id` nulo): `api.validar_monitoria` e
`api.confirmar_zeramento` recusam com MI403. A **`api.reprovar_monitoria` não tem essa
barreira** — a API aceita reprovar a MON-10001 diretamente, e a reprovação é final.

**Prova:** teste de integração local (PGlite, scripts 00–09), sondagem numa transação desfeita:
`api.reprovar_monitoria('MON-10001', …)` como o gestor da área → `Reprovada`. Nenhum dado real
foi tocado.

**Decisão já tomada (Aline, 14/10/2026):** nas migradas sem régua o gestor só **devolve**;
Validar, Reprovar e Confirmar Zerada ficam fora da tela, com a orientação
"Monitoria migrada: é necessário devolver para revisão e reenvio antes da decisão final."
Isso está no frontend (`exigeReenvio` em `src/domain/validacaoService.ts`), mas qualquer
chamada direta à API com o login do gestor ainda reprova.

**Resolução proposta (precisa de autorização própria):** script SQL novo que acrescenta em
`api.reprovar_monitoria` a mesma barreira M1 de `api.validar_monitoria` (MI403, mesma mensagem),
com testes locais completos antes de aplicar na homologação. Não altera dados históricos.

**Até resolver:** não publicar em Produção.

**Andamento (14/10/2026):** correção PREPARADA e testada só no banco local —
`supabase/sql/10_p1_reprovar_m1.sql` (SHA-256 `8cc9de3bc2d0355073bcd5be691fd54aa8cb357c39e1e46b8bfba3e06259ca9c`).
Testes locais: script 10 19/19, compartilhado 28/28 (inclui P1 fechada e reprovação normal após
reenvio), 09 49/49, padrões 10/10, exportação 23/23, decisões reais 8/8, ensaio real 8/8, R5 29/29.

**Aplicada na homologação em 14/10/2026** (autorizada pela Aline; executada por ela no SQL Editor
do `monitoria-homologacao`). Conferência posterior, só leitura — 6/6 conforme o esperado:
versão `10` registrada (1); barreira M1 presente em `api.reprovar_monitoria` (true); `anon` não
executa (false); `authenticated` executa (true); MON-10001 preservada (Pendente · v1 · sem régua);
auditoria preservada (257 registros, última sequência 257).

**Situação: FECHADA na homologação (estruturalmente verificada).** Não foi feita tentativa real
de reprovação contra o banco de homologação (passo opcional 4, não autorizado); a recusa pela API
está provada nos testes locais (T.7–T.10 de `testes-10`). Ao publicar em outro ambiente, o
script 10 precisa ser aplicado lá também.
