# Implantação do script 16 — colaboradora inativa não recebe monitoria nova

Proposta de 29/10/2026. **Nada daqui foi executado.** Cada etapa depende de autorização
específica da Aline.

## O problema
No encerramento dos testes do 15, a colaboradora fictícia foi desativada (11b) e continuou na
lista "Colaborador" da Nova Monitoria. Duas causas:
- o formulário listava todas as colaboradoras, sem filtrar as inativas;
- `api.salvar_monitoria` só confere se a colaboradora existe.

## A correção, em dois níveis

| Nível | O que muda | Arquivos |
|---|---|---|
| Portal | **Nova Monitoria:** só colaboradoras ativas. **Monitoria antiga:** a inativa já vinculada continua na lista, marcada "(inativa)". **Ao gravar:** o portal avisa e não envia se a gravação criar vínculo novo com inativa. **Importador:** colaboradora inativa vira **erro** (antes era aviso). | `src/domain/colaboradoraAtiva.ts` (novo), `MonitoringForm.tsx`, `importacaoChatGPT.ts` |
| Banco | Script 16: gatilho que, **pelo portal** (sessão autenticada), recusa com MI422 monitoria nova para colaboradora inativa e troca de colaboradora para inativa num rascunho | `supabase/sql/16_colaboradora_inativa.sql`, reversão `16r_reverter_colaboradora_inativa.sql` |

O gatilho fica fora da `api.salvar_monitoria`, sem recopiar a função. O formulário e a importação
gravam pela mesma função, então os dois ficam cobertos. A reversão do 15 (15r) também não é
afetada.

## Impacto nos outros fluxos (testado em `testes-16-colaboradora-inativa.mjs`)

| Fluxo | Colaboradora ficou inativa depois | Teste |
|---|---|---|
| Monitoria nova (rascunho ou envio direto), inclusive por importação | **Recusada** (MI422) | G.2 |
| Trocar a colaboradora de um rascunho para uma inativa | **Recusada** (MI422) | G.3 |
| Editar o rascunho antigo dela (mesma colaboradora) | Normal | G.4 |
| Enviar o rascunho antigo dela | Normal | G.5 |
| Validar, reprovar e devolver (gestor) | Normal | G.6 |
| Reenviar depois de devolvida; cancelar (ADMIN) | Normal | G.7 |
| Consultar no portal (relatórios, histórico) | Normal; aparece como inativa | G.8 |
| Regra de duplicidade do 15 | Continua | G.9 |
| Operação direto no banco (restauração de backup, migração, scripts do SQL Editor) | **Não bloqueada**, para que o histórico de quem saiu possa ser restaurado | G.10 |
| Reativada pelo ADMIN | Volta a receber monitoria nova | G.11 |
| Auditoria | Íntegra; a instalação não grava nada | G.1, G.12 |
| 16r e reinstalação | Reverte sem alterar monitorias; reinstala | G.13–G.15 |

**Decisão a confirmar:** o rascunho iniciado antes da inativação pode ser **enviado** (G.5).
Ele já existia e a avaliação foi feita quando a colaboradora estava ativa. Se preferir bloquear
também o envio, é uma linha no gatilho.

**Importação de monitorias antigas de quem já saiu:** fica bloqueada pelo portal. O caminho é
o ADMIN reativar a colaboradora durante a importação e desativar depois, com registro na
auditoria. Uma restauração de backup não é afetada.

## Testes
- Unitários: `tests/colaboradoraAtiva.test.ts` (filtro, rótulo, vínculo novo, importador).
  Total de 112 aprovados.
- Banco: `supabase/testes/testes-16-colaboradora-inativa.mjs`, 16 de 16.
- Portal local sem banco (29/10): a Nova Monitoria não lista a inativa; o rascunho antigo mostra
  "Allanis Maquea Silva (inativa)" e é salvo. O teste foi feito só no armazenamento local, já
  restaurado.

## Plano de implantação (cada passo com autorização)
1. Backup (`backup-completo.sql` → Backups MonitorIA), conferido.
2. Conferência antes, só leitura: monitorias, colaboradoras, fila, agosto, auditoria e objetos
   do 16 (nenhum).
3. Script 16, com o texto conferido pelo código de verificação. A instalação não grava em
   tabela nenhuma.
4. Conferência depois: tudo igual, gatilho ativo, versão 16, auditoria igual.
5. Commit e push só em `feat/banco-e1`, e Preview publicado. A ordem é indiferente: o portal
   novo funciona sem o 16 e o portal antigo funciona com ele.
6. Validação no Preview, com a conta de monitora:
   - a Nova Monitoria não lista "TESTE HOMOLOGAÇÃO — FICTÍCIO";
   - um importador com a fictícia é recusado;
   - os relatórios mostram as monitorias canceladas dela.
   - Não se cria nenhuma monitoria.
7. **Reversão**, se algo falhar: `16r` (autorização própria). Para o portal, republicar o
   commit anterior.

## Situação — 29/10/2026 (~15h22)
- **Backup antes do 16:** `monitoria-backup-2026-10-29-antes-16.csv` (18:20 UTC, SHA-256 `90aed43f…`), COMPLETO:
  - 23 monitorias: 19 reais (8 Pendentes, 5 Canceladas por duplicidade, 3 Validadas, 2 Rascunhos, 1 Reprovada) e 4 fictícias Canceladas;
  - 644 respostas, 36 evidências, 31 eventos, 6 colaboradoras (fictícia inativa);
  - auditoria 1050, 0 quebras.
  - Em relação ao antes-15b, só mudaram as 9 canceladas e a fictícia.
- **Pré-requisitos (só leitura, 15:22):**
  - 15 instalado e 16 ausente; nenhum objeto do 16 existe; `auth.uid()` disponível;
  - gatilhos atuais: a_protecao, b_duplicidade, controle, sem_exclusao, sem_truncate, y_eventos, z_auditoria (o 16 entra como `b_colaborador_ativo`, antes do b_duplicidade);
  - única inativa: a fictícia, com 4 monitorias, todas Canceladas, e nenhum rascunho ou pendente de inativa;
  - monitorias `f83a08fa…`, colaboradoras `275a11bc…`, documentos `fc26ee29…`, eventos 31 `c4ba1c6a…`, fila 8, agosto 5/3/3, auditoria 1050 (= backup).
- **O 16 não altera dados:** só cria função, gatilho e comentário, e registra a versão '16' em `app.versoes_esquema`, que não é auditada. No ensaio G.1, monitorias, colaboradoras e auditoria ficaram idênticas. Gatilho só age em gravações futuras pelo portal.

### Script 16 EXECUTADO (29/10/2026, ~15h28 Brasília, autorizado)
- **Antes:**
  - backup `antes-16` reconferido (`90aed43f…`, COMPLETO);
  - estado igual ao da conferência anterior: 23 monitorias `f83a08fa…`, colaboradoras `275a11bc…`, documentos `fc26ee29…`, eventos 31 `c4ba1c6a…`, fila 8, agosto 5/3/3, auditoria 1050 (= backup), 0 quebras;
  - respostas `4a553c88…`, evidências `54ae3edd…`, situação e versão de cada uma das 23 registradas.
- **Execução:** texto no editor = arquivo (SHA-256 `3bebe32f…`). "Success".
- **Depois:**
  - versão 16 registrada;
  - gatilho `monitorias_b_colaborador_ativo` ativo; função com segurança definer, sem execução direta pelo portal;
  - todos os gatilhos anteriores continuam: a_protecao, b_duplicidade (15), controle, sem_exclusao, sem_truncate, y_eventos (14), z_auditoria;
  - monitorias, colaboradoras, documentos, histórico, respostas, evidências e situação/versão das 23: **idênticos**;
  - fila 8, agosto 5/3/3;
  - auditoria 1050, nenhum registro novo, 0 quebras.
- **Efeito imediato:** o portal publicado ainda é o anterior e mostra a colaboradora fictícia na lista; uma tentativa de gravar para ela agora é recusada pelo banco (MI422). Falta publicar o portal novo (filtro da lista e importador) — autorização própria.
