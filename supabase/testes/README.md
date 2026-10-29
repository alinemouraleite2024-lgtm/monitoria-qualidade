# Testes de integração do banco compartilhado

Rodam os scripts de `supabase/sql` (00 a 10) num **Postgres local** (PGlite, dentro do Node),
com as mesmas regras RLS, funções do schema `api` e auditoria do Supabase. **Nada sai do
computador e nada toca o Supabase.** O portal (raiz do projeto) não depende desta pasta: ela tem
o próprio `package.json`, e a Vercel não instala nada daqui.

## Como rodar

```
cd supabase/testes
npm install
node rodar-todos.mjs              # relógio de hoje
node rodar-todos.mjs --dias 80    # relógio deslocado: prova que nenhum teste depende da data
```

> No computador da Aline, o `&` do caminho do OneDrive quebra `npm run`; por isso o comando é
> `node rodar-todos.mjs` direto.

## Suítes

| Arquivo | O que cobre | Precisa de arquivo local? |
|---|---|---|
| `testes-e1.mjs` | scripts 00–08: estrutura, RLS, auditoria, funções `api`, régua, nota pelo banco | sim — backup de 08/10 (`MONITORIA_BACKUP` ou `../backup/` ao lado do projeto), para os casos E3/E4b |
| `testes-r5.mjs` | implantação sem ADMIN (R5) e o 06 antes/depois | não |
| `testes-padroes.mjs` | permissões automáticas do Supabase não reabrem nada | não |
| `testes-09.mjs` | gerador e scripts 09a/09b com exportação **sintética** | não |
| `testes-10.mjs` | script 10 (P1): reprovar respeita a M1; fluxo normal após reenvio | sim — `migracao/saida/` (09b real) |
| `testes-exportacao.mjs` | exportação do navegador → conferência → sanitização → 09b | não |
| `testes-decisoes-reais.mjs` | as decisões reais de `migracao/decisoes.json` com exportação sintética | sim — `migracao/decisoes.json` e `migracao/reguas/` |
| `ensaio-real.mjs` | ensaio da migração real (09b exato) + conferência + logins simulados | sim — `migracao/saida/` |
| `testes-compartilhado.mjs` | o código do portal (`src/shared/compartilhado`) contra o banco, inclusive M1 na tela | não |
| `testes-13-metas.mjs` | script 13 (monitora nas metas de agosto) e o portal gravando metas e planos (só GESTOR, versão, remoção lógica) | sim — `migracao/saida/` (09b real) |
| `testes-14-historico.mjs` | script 14 (histórico de calibração): eventos gravados junto com a mudança, considerações, observação idempotente, leitura por perfil, consulta e gravação da reconstituição, restauração | sim — `migracao/saida/` (09b real) |
| `testes-15-duplicidade.mjs` | script 15 (duplicidade na criação): pares antigos preservados e operáveis, mesma requisição não cria duas, mesmo atendimento digitado de outro jeito recusado (MI410), atendimentos diferentes livres, cancelamento comum e por duplicidade (fila, metas, médias, histórico, auditoria), backup com as colunas novas | sim — `migracao/saida/` (09b real) |
| `testes-15-implantacao.mjs` | ensaio da implantação do 15 e do 15b numa réplica fictícia da homologação (mesma numeração e situação): `conferencia-15.sql` igual antes e depois, nenhum cancelamento automático, 15b cancela exatamente as 5 cópias, históricos preservados, fila/metas/médias corrigidas | sim — `migracao/saida/` (09b real) |
| `testes-15-reversao.mjs` | ensaio da reversão do 15 (`sql/15r_reverter_duplicidade.sql`) na mesma réplica: banco volta ao 14 (mesma `api.salvar_monitoria` do 08), nenhuma monitoria muda (nem as criadas com o 15), o portal novo continua gravando, o 15 pode ser reinstalado, e o 15r é recusado depois do 15b | sim — `migracao/saida/` (09b real) |
| `testes-15c-encerramento.mjs` | encerramento dos testes do 15 numa réplica com os 4 rascunhos fictícios: `15c` cancela só as 4 (histórico, auditoria com o ADMIN, indicadores iguais), `11b` desativa a colaboradora fictícia sem apagar nem alterar monitorias; travas de ordem e de repetição | sim — `migracao/saida/` (09b real) |
| `testes-16-colaboradora-inativa.mjs` | script 16: colaboradora inativa não recebe monitoria nova pelo portal (rascunho, envio, troca de colaboradora → MI422); monitorias antigas dela seguem (editar, enviar, validar, reprovar, devolver, cancelar, consultar); manutenção direto no banco não é bloqueada; reativação; 16r | sim — `migracao/saida/` (09b real) |
| `testes-backup.mjs` | backup manual (`sql/backup-completo.sql`) e restauração (`backup/restauracao.mjs`): só leitura, arquivo completo e à prova de corte, restauração em banco novo e no mesmo banco com a cadeia da auditoria preservada, sistema funcionando depois | não — dados 100% sintéticos |

Os arquivos locais são **git-ignorados** de propósito (dados reais da migração). Sem eles, a
suíte aparece como **PULADA**, nunca como aprovada.

## Dados

- **Nenhuma senha, token ou chave real.** Senhas que aparecem nos testes são sintéticas e existem
  justamente para provar que o banco as recusa ou retira.
- Pessoas e e-mails das fixtures são **sintéticos** (`@exemplo.test`). As únicas identidades
  reais são as já aprovadas para o ambiente compartilhado — `aline.oliveira@` e `erivan.sousa@`,
  as mesmas de `sql/conferencia-09.sql` —, usadas pelas suítes que conferem as decisões reais.
- `fixtures/reguas/`: retratos da régua (v0.24.0, v0.25.0 e a do código, `HEAD`). Se a régua do
  código mudar, `HEAD.json` precisa ser regerado (`migracao/extrair-regua.mjs`).
- `fixtures/casos-ouro.json`: casos de nota calculados pelo portal, para provar a paridade com o
  cálculo do banco.
- `fixtures/06_auditoria.versao-aplicada.sql`: a versão do 06 aplicada antes da revisão R5, usada
  para testar a atualização.

## Datas

Os testes que dependem do dia usam o relógio do **próprio banco** (`app.hoje()`, fuso de São
Paulo). `relogio-deslocado.mjs` desloca o relógio do processo para provar isso.
