# Script 21 — situação "Em reavaliação"

> Situação: Portal publicado no Preview em 13/11/2026 (`ec7da93`). **Script revisado em 16/11/2026,
> testado só no ambiente local.** Nada foi executado no Supabase. Cada passo abaixo depende de
> autorização específica da gestão da qualidade.

## Decisões da gestão da qualidade (11/11/2026)

1. Quando o supervisor devolve para ajustes, a monitoria fica **"Em reavaliação"**, e não Rascunho.
2. Ela continua **realizada e entregue**: ocupa a vaga da meta. A **nota fica fora da média** até o reenvio.
3. As devolvidas existentes são convertidas, preservando dados, notas, evidências, histórico e auditoria.
4. O cancelamento continua exclusivo do Administrador com MFA.

## Revisão de 16/11/2026

O backup `monitoria-backup-2026-11-16-antes-21.csv` (17:26 UTC) mostrou que MON-10028, MON-10030,
MON-10031 e MON-10034 **já foram corrigidas e reenviadas**: estão Pendentes, com histórico ENVIO →
DEVOLUCAO → REENVIO, e não são tocadas. A conversão ficou **só para a MON-10001** (agosto/2026), a
única ainda devolvida.

As conferências do script deixaram de ter o número 5 fixo. Agora acompanham a lista aprovada:
- registros novos na auditoria = tamanho da lista;
- as monitorias em "Em reavaliação" = exatamente a lista.

## O que muda

| Onde | Mudança |
|---|---|
| Banco (`21_em_reavaliacao.sql`) | Situação nova permitida. `api.devolver_monitoria` grava "Em reavaliação". `api.salvar_monitoria` deixa a própria monitora editar e reenviar. Gatilho do histórico: devolução vira DEVOLUCAO; a troca Rascunho ↔ Em reavaliação (conversão/reversão) não grava evento. Conversão da MON-10001. |
| Portal (já no Preview) | Conta como feita (vaga própria "Em reavaliação"), fora da média; "Precisa da sua ação" da monitora com o motivo; formulário com "Salvar ajustes" e "Reenviar para validação"; bloco "Em reavaliação" para o supervisor, fora da fila; filtro e cor nas listas; textos dos relatórios e do PDF. |
| Não muda | Privacidade (18), área privada (19), fila de validação, validar, reprovar, cancelar, notas, critérios, pesos, réguas, importador JSON e exportações. |

## Testes (local, 16/11/2026)

- Portal: 167 testes de unidade.
- Banco: `testes-21-reavaliacao.mjs`, 36/36, com dados fictícios. Cobre a recusa do script real fora do
  cenário aprovado, a conversão, a devolução, os ajustes, o reenvio, o cancelamento pelo Administrador e a reversão.
  A reversão inclui uma monitoria devolvida **depois** do 21, com ajustes salvos e ainda em reavaliação:
  - ela volta a Rascunho com o motivo e os ajustes preservados, sem evento novo;
  - o portal publicado continua tratando-a como devolvida;
  - a monitora ainda corrige e reenvia (ENVIO → DEVOLUCAO → REENVIO).
- Ensaio sobre a cópia do backup de 16/11 (`testes-21-dados-reais.mjs`), **16/16**, com o arquivo do 21 sem alteração:
  - muda só a MON-10001; as quatro reenviadas continuam Pendentes;
  - não há devolução duplicada;
  - a auditoria ganha 1 registro e a cadeia fica íntegra;
  - o conjunto de privadas é o mesmo;
  - a fila do supervisor fica igual (23 com o início em 2026-10, inclusive as quatro reenviadas), e a MON-10001 não entra nela;
  - feitas da monitora em agosto vão de 13 para 14; outubro fica igual (27);
  - as médias de agosto (91,15%) e outubro (92,01%) não mudam;
  - em agosto, a MON-10001 passa a ocupar uma vaga (11 → 12), sem repetição;
  - o 21r desfaz tudo.
- Com o backup antigo, de 11/11, que tinha 5 devolvidas, o script revisado **recusa** sem gravar nada.
- Todas as suítes do banco (`rodar-todos.mjs`) aprovadas.

## Ordem de implantação (cada passo com autorização)

1. ~~Portal no Preview~~ (13/11/2026).
2. ~~Backup novo e ensaio~~ (16/11/2026).
3. **Backup no momento da execução**, COMPLETO, comparado com o de 16/11.
4. **Conferência do estado real, só leitura, imediatamente antes de executar.** O processo é interrompido em qualquer divergência:
   - elegíveis ≠ MON-10001;
   - outro rascunho com motivo de devolução;
   - auditoria com quebra;
   - versão 21 já instalada;
   - as quatro reenviadas fora de Pendente.
5. Execução do `21_em_reavaliacao.sql` no Supabase de homologação, conferindo o código de verificação no editor. O próprio script repete as conferências do passo 4 e desfaz tudo se algo não bater.
6. Conferência posterior, só leitura, e conferência nos dois perfis.

**Reversão:** `21r_reverter_reavaliacao.sql`. Não é preciso republicar o Portal: a versão publicada desde
13/11/2026 entende as duas formas ("Em reavaliação" e Rascunho com motivo). Isso foi comprovado no Preview com o banco ainda sem o 21 e nos testes. O 21r:
- volta toda monitoria "Em reavaliação" (a convertida e as devolvidas depois do 21) a Rascunho com o motivo, sem evento novo;
- devolve as funções e a lista de situações exatamente como eram.

**Reenvio e competência inicial:** reenviada, a monitoria volta a Pendente e segue a regra do supervisor.
A MON-10001, de agosto, fica fora da fila e continua em Relatórios, como as demais pendências de agosto.

**Observação para backups futuros:** os ensaios que restauram backup precisam instalar o 21 quando o
backup tiver a versão 21, como já fazem com 18 e 19.
