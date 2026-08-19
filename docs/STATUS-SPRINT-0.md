# Status da Sprint 0 — Fundamentos

> **Estado:** 15 de 15 histórias concluídas. Sprint **não publicada** — conforme
> `.agents/AGENTS.md`, a conclusão exige commit, deploy e URL de homologação.
> **Última atualização:** após a conclusão da história F0-15 (TypeScript incremental).
> **Ambiente:** Homologação (`HOMOLOGATION_MODE = true`, persistência em `localStorage`).

Este documento reflete o estado **real e verificado** do código. Todas as métricas foram medidas
diretamente no repositório; todas as validações funcionais foram executadas na aplicação em
execução, não inferidas por leitura de código.

---

## 1. Status das Histórias

### Concluídas (15)

| ID | História | Entregue |
|---|---|---|
| F0-03 | Corrigir navegação da aba Admin | Item de menu "Cadastros" — a tela existia mas era inalcançável |
| F0-01 | Fonte única de `getScoreConcept` | `src/scoreUtils.js`; eliminadas 3 cópias divergentes e 1 referência quebrada |
| F0-02 | Corrigir campo Plano de Ação | Leitura corrigida de `actionPlan` (inexistente) para `comments` |
| F0-04 | Estender modelo de dados do Critério | `numero`, `categoria`, `orientacao`, `tipoResposta`, `eliminatorio` + taxonomia oficial |
| F0-05 | Critérios oficiais CYF | 12 critérios de exemplo → **28 oficiais** (24 avaliativos + 4 eliminatórios) |
| F0-06 | Tipo de resposta Checklist Sim/Não | Itens 4 e 24, com sub-perguntas e nota fracionária |
| F0-07 | Tipo de resposta Faixa de Tempo | Item 5, com os 4 estados oficiais |
| F0-09 | Orientação do critério no wizard | Painel expansível por critério, com fallback quando ausente |
| F0-10 | Cálculo de nota ponderado | Passou a usar o peso de cada critério; peso 0 excluído do denominador |
| F0-08 | Critérios eliminatórios | Sinalização + zerada **somente após confirmação de Gestor/Admin** |
| F0-11 | Modularização do frontend | 19 componentes extraídos em 5 ondas — ver seção 3 |
| F0-12 | Camada de repositório | 17 repositórios + sessão; fonte de verdade única para as 18 coleções — ver seção 3-A |
| F0-13 | Roteamento real | 23 rotas com `react-router-dom`; `activeTab` eliminado; BUG-01 corrigido — ver seção 3-B |
| F0-14 | Guards de rota | `RouteGuard` como ponto único de acesso; rota `/login`; login bloqueado para BLOCKED e COLABORADOR — ver seção 3-C |
| F0-15 | TypeScript incremental | 36 arquivos migrados; `tsc --noEmit` como portão; contratos de `MonitoringForm` e `App` verificados — ver seção 3-D |

---

## 2. Status dos Bugs

| ID | Descrição | Severidade | Status |
|---|---|---|---|
| BUG-01 | Atalhos da Home do Monitor chamavam ids inexistentes | Média | **Corrigido** na F0-13 — eram **4** ocorrências, não 3: três `'monitorias'` (id correto `'monitorings'`) e uma `'my-profile'` (id correto `'profile'`), esta última não catalogada |
| BUG-02 | Contrato `onSave` incompatível entre `MonitoringForm` e `App.jsx` | **Crítica** | **Corrigido** |
| BUG-03 | Props `onReject`/`onRequestAdjustments` nunca conectadas | Média | **Corrigido** |

### BUG-02 — detalhe da correção

`MonitoringForm` chamava `onSave(data)` com **um** argumento; `App.jsx` esperava **dois**,
gerando `TypeError` que **bloqueava 100% do salvamento de monitorias**.

A correção não foi apenas ajustar a assinatura: `App.jsx` mantinha um **segundo motor de cálculo
de nota**, divergente do corrigido em F0-10, que ao remontar o array de scores **descartaria os
dados de checklist** (`subRespostas`) entregues em F0-06. `App.jsx` deixou de recalcular e passou
a apenas complementar (resolver monitor da alocação, aplicar regra de validação) e persistir.

Fluxo restabelecido e validado ponta a ponta: **criar → salvar → listar → abrir → aprovar →
reprovar → solicitar ajustes**.

> **Decisão de negócio registrada:** "Solicitar Ajustes" devolve a monitoria como `Rascunho`
> com o motivo preservado em `adjustmentReason`. Não foi criado status "Em Ajuste" nesta Sprint.

---

## 3. Resultado da F0-11

Extração executada em **5 ondas**, da menor para a maior superfície de acoplamento. Cada onda
validada com lint, build e teste funcional ao vivo antes de seguir.

| Onda | Escopo | Componentes | Linhas removidas |
|---|---|---|---|
| 1 | Piloto (acoplamento quase nulo) | 4 | −123 |
| 2 | Home ×3 + Login | 4 | −493 |
| 3 | Planning + Allocations | 2 | −271 |
| 4 | Admin + 4 modais (unidade única) | 5 | −722 |
| 5 | Dashboard + Shell | 4 | −434 |

**Regras seguidas:** paridade funcional 1:1, sem melhoria de UX, sem mudança de regra de negócio,
sem correção de débitos encontrados.

**Método:** extração programática com cópia literal das linhas e verificações de sanidade que
abortavam se qualquer limite não conferisse — evitando divergências por redigitação.

**Incidente na Onda 4:** o primeiro corte capturou 10 linhas a mais (fechamento do dispatcher e
do layout), gerando erro de parsing. Diagnosticado e corrigido na mesma onda; confirmado por
lint, build e pelos 6 fluxos de validação.

---

## 3-A. Andamento da F0-12 — Camada de Repositório

Executada em etapas, cada uma validada com lint, build e teste funcional antes da seguinte.

| Etapa | Escopo | Estado |
|---|---|---|
| 1 — Fundação | `storage.js`, `createRepository.js`, `sessionRepository.js`, `repositories/index.js` | **Concluída** |
| 2 — Piloto | `catalogEmpreendimentos`, `catalogCategorias` | **Concluída** |
| 3 — Coleções | 13 coleções em `load()`/`save()`; `allocationService`, `authorizationService`, `businessDays`, `UserAvatar` extraídos; Regras de Hooks corrigidas via `App` + `AppContent` | **Concluída** |
| 4 — Monitorias e sessão | `monitoringsRepository` (com as migrações), `sessionRepository` em uso real no login/logout | **Concluída** |
| 5 — Usuários | Fonte de verdade única para `users`: `getSystemUsers`/`saveSystemUsers` removidos, `UserManagement` passou a consumir estado do App.jsx por prop | **Concluída** |

### Estrutura da camada (`src/repositories/`, 172 linhas)

| Arquivo | Papel |
|---|---|
| `storage.js` | `KEYS` (18 chaves) + `read`/`write`/`remove` — **única** primitiva de `localStorage` da camada |
| `createRepository.js` | Factory única para coleções e singletons, com `loader` opcional no `load()` |
| `sessionRepository.js` | `load`/`save`/`clear`; grava `{ email, role }` e devolve o usuário completo |
| `index.js` | 15 coleções + 2 singletons de configuração + `migrateMonitorings` |

### O que a Etapa 4 preservou

As migrações silenciosas de monitorias saíram do inicializador de estado do `App.jsx` para
`migrateMonitorings` em `repositories/index.js`, transcritas **sem alteração de regra** e
conferidas linha a linha contra a versão anterior:

1. **Escala 0-10 → 0-100** — guarda `finalScore <= 10 && finalScore > 0`, multiplica `finalScore`
   e cada `scores[].score` por 10.
2. **Tipo "Fluxo" / "Fluxo / Processo" → "Processo"**.

O `loader` passou a rodar também sobre o seed, o que **não** muda o comportamento porque
`INITIAL_MONITORINGS` é uma lista vazia.

Login e logout continuam idênticos: `sessionRepository.save`/`clear` gravam e removem a mesma
chave `pm2_auth_session`, com o mesmo formato `{ email, role }` e o mesmo `logAuthEvent`.

### O que a Etapa 5 mudou (Opção A)

`users` tinha **dois donos**: o estado do `App.jsx` e `UserManagement.jsx`, que lia e gravava
`pm2_users` direto via `teamData.js`. As duas escritas competiam pela mesma chave.

- `getSystemUsers` / `saveSystemUsers` **removidos** de `teamData.js`;
- `UserManagement` passou a receber `users` e `onUsersChange` por prop — **primeira alteração
  de contrato num módulo legado**, como a seção 8 previa;
- `App.jsx` carrega por `usersRepository.load()` e grava por `usersRepository.save()`.

Três defeitos observáveis caíram como consequência direta, todos reproduzidos no código antigo
e reverificados no novo:

| Defeito | Antes | Depois |
|---|---|---|
| Perda silenciosa de dados | Bloquear um usuário e depois criar outro em Cadastros **revertia o bloqueio** (BLOCKED → ACTIVE) | Bloqueio sobrevive |
| Propagação | Alteração em Usuários só aparecia no Dashboard/Planejamento/Colaboradores após recarregar | Propaga na hora |
| Atualização de tela | Bloquear/desbloquear gravava mas **não redesenhava a lista** | Redesenha na hora |

**Deliberadamente fora do escopo (Opção A):** `handleLogin` e `sessionRepository` continuam
resolvendo contra `HOMOLOG_USERS` estático. Um usuário criado pela tela ainda não consegue
entrar, e `status: BLOCKED` não impede login. Tratar isso é mudança de regra de autenticação,
endereçada na F0-14.

### Riscos conhecidos, herdados e não corrigidos nesta etapa

| Risco | Severidade | Decisão |
|---|---|---|
| A migração 0-10 **não é idempotente**: olha o valor, não uma marca de versão. Nota legítima entre 1 e 10 na escala 0-100 é re-multiplicada | Alta | Preservado — corrigir exige versionar cada registro (mudança de regra) |
| `migrateMonitorings` **muta os objetos no lugar** em vez de copiar | Média | Preservado — herdado do inicializador original |
| `sessionRepository.load()` resolve a sessão contra `HOMOLOG_USERS` **estático**, não contra `usersRepository` | Média | É a fonte de verdade dupla de `users` — resolver na Etapa 5 |
| Um bump de `DATABASE_VERSION` apaga `pm2_monitorings` antes de qualquer migração rodar | Média | Comportamento pré-existente de `initializeDatabase` |

---

## 3-B. Resultado da F0-13 — Roteamento Real

A URL passou a ser a fonte da verdade da navegação. `activeTab` deixou de ser estado e virou um
valor derivado do path.

### Rotas — 23

Path idêntico ao id de aba anterior, sem tradução: `MENU_CONFIG` e `tabPermissionMap` seguem
usando o id como chave, que agora é também o segmento da URL.

| Grupo | Rotas |
|---|---|
| Redirecionamento | `/` → `/home` |
| Telas com implementação | `/home` `/dashboard` `/planning` `/monitorings` `/reports` `/allocations` `/admin` `/users` `/roles` `/audit-logs` `/profile` |
| Formulário de monitoria | `/monitorings/new` · `/monitorings/:id/edit` |
| Ainda não implementadas | `/demands` `/my-demands` `/surveys` `/integrations` `/settings` `/history` `/op-calendar` `/calendar` |
| Não encontrada | `*` → `NotFoundScreen` |

### O que mudou de comportamento — e o que não mudou

**Mudou, por decisão registrada (decisão D do plano):** `/monitorings/:id/edit` resolve a
monitoria pelo id da URL. Recarregar a página na tela de edição passou a reabrir a mesma
monitoria; antes o formulário era perdido e a aplicação voltava para a Home. Um id inexistente
resolve para `NotFoundScreen`.

**Não mudou:** `MENU_CONFIG`, `tabPermissionMap`, o breadcrumb (inclusive o fallback para
"Dashboard" nas rotas fora do menu), o destaque do menu por igualdade exata, a precedência
permissão → "não implementado" → tela, o Calendário inalcançável (débito 6), login e logout.

### Impacto estrutural

| | Antes | Depois |
|---|---|---|
| Dispatcher `IIFE` com cadeia de `activeTab === …` | 239 linhas | **0** — substituído por `<Routes>` |
| Estado `activeTab` | `useState` | derivado de `location.pathname` |
| Estado `editingMonitoring` | `useState` | derivado do parâmetro `:id` |
| Chamadas `setActiveTab` | 13 | 0 |

`AppShell` e `Sidebar` trocaram a prop `setActiveTab` por `onNavigate`; `Topbar` **não foi
alterado**. `MENU_CONFIG` subiu para o escopo do módulo, necessária ao componente `Screen`, que
concentra a precedência antes espalhada pelo dispatcher.

> `Screen` **não é um guard de rota** — é o mesmo teste de `tabPermissionMap` que já existia,
> transposto. Os guards são a F0-14.

### Infraestrutura

`vercel.json` com rewrite SPA. Sem ele, abrir `/monitorings` direto na barra de endereços
retornaria 404 do servidor — risco que não existia enquanto só havia a rota `/`.

---

## 3-C. Resultado da F0-14 — Guards de Rota

### Ponto único de decisão

`src/routes/RouteGuard.jsx` concentra toda a autorização de acesso. `src/routes/routeAccess.js`
passou a ser a fonte única da política, com `tabPermissionMap` (21 entradas) e uma função de
consistência que aponta permissões referenciadas mas inexistentes em `PERMISSIONS`.

**A mudança de regra mais importante é a inversão do padrão:** rota sem entrada declarada agora
é **negada**, não liberada. Era o oposto disso que produzia o vazamento abaixo.

### Buracos fechados

| Achado | Antes | Depois |
|---|---|---|
| Rotas do formulário sem permissão declarada | Qualquer papel autenticado alcançava `/monitorings/new` | `VIEW_MONITORING_FORM: ['ADMIN','GESTOR','MONITOR']` |
| **COLABORADOR autenticava** | Sessão criada, menu vazio, conteúdo vazio — e **acesso ao formulário de monitoria**, com todas as outras rotas negadas | Login recusado, com `LOGIN_DENIED` na auditoria |
| **`status: BLOCKED` não impedia login** | O botão "Bloquear" gravava, registrava auditoria, exibia "Bloqueado" — e o usuário entrava normalmente | Login recusado, com mensagem e auditoria próprias |
| Checagens de papel duplicadas no JSX | `planning`, `allocations` e `admin` repetiam inline o que o mapa já dizia | Removidas — 3 duplicações |
| Logout não redirecionava | URL permanecia na última rota | Vai para `/login` |
| Deep link sem sessão perdia o destino | Sempre caía em `/home` | Retorna à rota pretendida após autenticar |

### Nota sobre `status`: por que o repositório é lido no login

O bloqueio é gravado em `pm2_users` pela tela de Usuários e **nunca chega a `HOMOLOG_USERS`**,
que é um array estático. Checar `user.status` no array estático não barraria ninguém — a decisão
aprovada exigia ler o `status` do repositório.

Foi feito isso, **e somente isso**: a autenticação (e-mail e senha) continua contra
`HOMOLOG_USERS`. Unificar login e `usersRepository` segue fora de escopo, e por isso **um usuário
criado pela tela de Usuários continua sem conseguir entrar**.

### Limitações registradas

- **O guard é client-side.** Vale como usabilidade, não como segurança. A barreira real depende
  do backend (Fase 1).
- **Bloquear um usuário já logado não derruba a sessão dele.** A checagem ocorre no login; a
  sessão restaurada por `sessionRepository` não é revalidada.
- **O logo da Sidebar continua apontando para `/dashboard`**, o que leva o MONITOR a "Acesso
  Negado" ao clicar na própria marca. Mantido por decisão registrada; tratar como item de
  navegação/UX, não de permissão.

---

## 3-D. Resultado da F0-15 — TypeScript Incremental

### Cobertura

| | Arquivos | Linhas |
|---|---|---|
| `.ts` | 19 | 1.208 |
| `.tsx` | 17 | 3.617 |
| `.jsx` restantes | 15 | 2.407 |
| `.js` restantes | **0** | — |

Migrados **36 de 51** arquivos. Os 15 remanescentes são telas de leitura, deixadas fora por
decisão de escopo — continuam funcionando e não bloqueiam o portão de tipos.

### O portão novo

`tsc --noEmit` passou a ser obrigatório. **O Vite não faz type-check** — o rolldown apaga os
tipos sem verificá-los, então "build OK" nunca provou nada sobre tipos. Sem esse comando a
história inteira seria decorativa.

```
node node_modules/typescript/bin/tsc --noEmit
```

### O objetivo cumprido

O contrato `MonitoringForm` ↔ `App` está declarado e verificado:
`onSave: (monitoring: Monitoring) => void` de um lado,
`handleSaveFormMonitoring = (monitoringData: Monitoring)` do outro. **BUG-02 era exatamente a
divergência entre esses dois lados** — hoje o compilador recusa. O mesmo vale para BUG-03:
`onRequestAdjustments: (id: string, reason: string) => void` está declarado.

### O que o compilador encontrou sozinho

| # | Achado | Desfecho |
|---|---|---|
| 1 | `SIM_NAO` é usado pelos **4 critérios eliminatórios**, mas eu havia deixado fora da união `TipoResposta` | Tipo corrigido |
| 2 | `MonitoringHistory` lê `strengths`/`opportunities`; eu havia tipado `pontosFortes`/`oportunidades`, inventados a partir dos rótulos da UI | **Meu tipo estava errado, o código não** — corrigido contra a forma real |
| 3 | `migrateMonitorings` opera sobre dados que, por definição, **não satisfazem** `Monitoring` | Modelado como `LegacyMonitoring`, dando nome à fronteira |
| 4 | `prefer-const` (do preset typescript-eslint) apontou 2 variáveis nunca reatribuídas | Corrigidas |

### Fronteiras declaradas

Três asserções de tipo, todas deliberadas e comentadas no código:

1. `repositories/index.ts` — entrada da migração legada;
2. `MonitoringForm.tsx` — `canal`, `tipo` e `status` são texto livre durante a edição e uniões
   fechadas no domínio;
3. `App.tsx` — `currentUser!` nos handlers, que só existem sob a árvore autenticada.

### Ponte para os 15 arquivos não migrados

`App.tsx` não conseguia verificar as próprias chamadas: cada `prop = []` num `.jsx` faz o
compilador inferir `never[]`. Em vez de ampliar o escopo, **17 defaults receberam anotação
JSDoc** (`/** @type {import('...').User[]} */`). Os arquivos seguem `.jsx`, nenhuma linha de
lógica mudou, e o lado do chamador passou a ter contrato.

### Linha de base de lint: 12 → 8

Não é mérito. Onze dos doze problemas eram `'React' is defined but never used`, que
desaparecem com `jsx: "react-jsx"`. **A nova base é 8** (7 erros de ícones importados sem uso
+ 1 warning), e a cobertura permaneceu em 53 arquivos — o bloco `.ts/.tsx` da configuração do
ESLint existe justamente para que nada saia do lint ao migrar.

---

## 4. Componentes Extraídos (19)

### Layout (3)
| Componente | Linhas |
|---|---|
| `layout/AppShell.jsx` | 45 |
| `layout/Sidebar.jsx` | 55 |
| `layout/Topbar.jsx` | 45 |

### Features (13)
| Componente | Linhas | Props |
|---|---|---|
| `features/dashboard/DashboardScreen.jsx` | 391 | 20 |
| `features/admin/AdminScreen.jsx` | 389 | 18 |
| `features/home/HomeMonitor.jsx` | 200 | 6 |
| `features/allocations/AllocationsScreen.jsx` | 169 | 17 |
| `features/planning/PlanningScreen.jsx` | 169 | 13 |
| `features/admin/modals/CriterionModal.jsx` | 178 | 4 |
| `features/auth/LoginScreen.jsx` | 120 | 8 |
| `features/calendar/CalendarScreen.jsx` | 101 | 3 |
| `features/admin/modals/UserModal.jsx` | 95 | 5 |
| `features/admin/modals/CollaboratorModal.jsx` | 85 | 5 |
| `features/home/HomeGestor.jsx` | 80 | 3 |
| `features/admin/modals/AreaModal.jsx` | 76 | 5 |
| `features/home/HomeAdmin.jsx` | 66 | 1 |
| `features/reports/ReportsScreen.jsx` | 37 | 2 |

### Compartilhados (2)
| Componente | Linhas |
|---|---|
| `shared/components/NotImplementedScreen.jsx` | 11 |
| `shared/components/AccessDeniedScreen.jsx` | 11 |

### Outros artefatos criados na Sprint
| Arquivo | Origem |
|---|---|
| `src/scoreUtils.js` | F0-01 — fonte única do conceito de nota |
| `src/constants/criteria.js` | F0-04 — taxonomia oficial de critérios |

---

## 5. Métricas — Antes e Depois

### `App.jsx`

| Marco | Linhas | Variação acumulada |
|---|---|---|
| Início da Sprint 0 (commit `f93b412`) | 3.306 | — |
| Após F0-01 → F0-10 (início da F0-11) | 3.418 | **+112** |
| Após Onda 1 | 3.295 | −11 |
| Após Onda 2 | 2.802 | −504 |
| Após Onda 3 | 2.532 | −774 |
| Após Onda 4 | 1.811 | −1.495 |
| Após Onda 5 (fim da F0-11) | 1.377 | −1.929 (−58%) |
| Após F0-12 etapas 1-4 | 1.217 | −2.089 (−63%) |
| **Após F0-12 etapa 5 (estado atual)** | **1.215** | **−2.091 (−63%)** |

> O arquivo **cresceu 112 linhas** durante as histórias de negócio (F0-01 a F0-10): F0-04
> adicionou campos ao modal de critério, F0-08 adicionou a lógica de eliminatórios. Isso valida
> a decisão de sequenciamento — executar a modularização antes teria significado escrever esse
> volume duas vezes.
>
> Isolando a F0-11: **3.418 → 1.377 = −2.041 linhas (−60%)**.

### Projeto

| Métrica | Antes (commit `f93b412`) | Depois |
|---|---|---|
| Arquivos `.js`/`.jsx` em `src/` | 16 | **45** |
| Total de linhas em `src/` | 5.738 | 7.232 |
| Maior arquivo | `App.jsx` (3.306) | `App.tsx` (1.258) |
| Concentração no maior arquivo | 58% | **19%** |
| Problemas de lint | 61 | **8** (base redefinida na F0-15 — ver seção 3-D) |
| Chamadas a `localStorage` em `App.jsx` | 45 | **5** |
| Build | OK | OK |
| `tsc --noEmit` | não existia | **0 erros** |

> O total de linhas **cresceu** (+674) porque a extração adiciona assinaturas de props e imports
> por arquivo. O ganho não é volume de código, e sim distribuição: o maior arquivo saiu de
> **58% para 16%** do total da aplicação.

---

## 6. Débitos Técnicos Preservados

Mantidos deliberadamente, conforme as regras de cada história (paridade 1:1, sem correção de
débitos fora de escopo). Todos verificados em runtime, não apenas por leitura de código.

### Alta relevância

| # | Débito | Impacto |
|---|---|---|
| 1 | ~~**Fonte de verdade dupla para `users`**~~ — **resolvido** na Etapa 5 da F0-12 | Era perda silenciosa de dados; ver seção 3-A |
| 2 | ~~**Violação das Regras de Hooks**~~ — **resolvido** na Etapa 3 da F0-12, dividindo o componente em `App` (guarda de migração) + `AppContent` (hooks) | Eliminou 47 dos 59 erros de lint |
| 3 | ~~**BUG-01**~~ — **resolvido** na F0-13 | Ver seção 2 |

### Média relevância

| # | Débito |
|---|---|
| 4 | `monitorGoals` é gravado mas **nunca exibido** na tela de Planejamento |
| 5 | **Dois formatos de usuário coexistem no mesmo array.** `UserManagement` grava o registro completo (`login`, `password`, `status`, `provider`, `cargo`, `area`, `gestor`) e chama `logAuthEvent`; `UserModal` (Cadastros) grava apenas `id`/`name`/`email`/`role`/`team`/`active`, sem log. A Etapa 5 unificou o **dono** do dado, não o **formato** — unificar formato é mudança de regra, mantida fora de escopo por decisão registrada |
| 6 | Tela de **Calendário é inalcançável** — `'calendar'` segue na lista `UNIMPLEMENTED_TABS`, agora avaliada por `Screen`. A rota `/calendar` existe e o `CalendarScreen` continua ligado a ela, mas resolve para "não implementado". Preservado deliberadamente na F0-13 |
| 7 | ~~Efeito de persistência grava `pm2_collaborators` e `pm2_users` duas vezes cada~~ — **resolvido** na Etapa 3 da F0-12 (efeitos granulares por coleção) |
| 8 | Etapa 3 do wizard **transborda a largura** em viewport móvel (layout de 2 colunas sem breakpoint) |

### Baixa relevância

| # | Débito |
|---|---|
| 9 | 13 ícones importados com `eslint-disable` e nunca usados |
| 10 | `getCoveragePercentage` e `getInArrearsCount` definidos e nunca chamados |
| 11 | `showHolidayModal` e `newHoliday` — estado de um modal que nunca foi construído |
| 12 | Asteriscos Markdown literais (`**Monitorias**`) no texto do ReportsScreen |

---

## 7. Estado Atual da Arquitetura

### `App.tsx` — 1.258 linhas, sem dispatcher manual

| Categoria | Quantidade |
|---|---|
| Estados de **domínio** (persistidos) | 18 |
| Estados de **UI/efêmeros** | 26 (`activeTab` e `editingMonitoring` passaram a ser derivados da URL) |
| Handlers | 19 |
| Helpers compartilhados | 13 |
| Chamadas a `localStorage` | **5** — todas em `initializeDatabase` |

### Persistência — estado ao fim da F0-12

| Padrão | Onde | Escopo |
|---|---|---|
| **Repositório** — `useEffect` granular por coleção | `App.jsx` | 15 chaves, uma gravação por coleção alterada |
| **Repositório** — `save()` em handler | Catálogos, login/logout | `pm2_catalog_*`, `pm2_auth_session` |
| **Fora da camada** — acesso direto em módulo | `auth.js` | `pm2_auth_logs` — trilha de auditoria, fora do escopo da F0-12 |
| **Fora da camada** — varredura por prefixo | `initializeDatabase` | todas as chaves `pm2_*` |

Nenhum componente ou módulo lê ou grava uma chave `pm2_*` de domínio por fora do repositório.
A string literal `'pm2_users'` existe em um único lugar do projeto: `repositories/storage.js`.

### Grafo de dependências — sem ciclos

```
main.jsx → App.jsx
App.jsx  → 30 módulos (13 features, 3 layout, 2 shared, 7 modules, 5 dados/config)
layout/AppShell → Sidebar, Topbar
features/*      → mockData | constants/criteria | scoreUtils      (folhas)
modules/*       → auth | teamData | scoreUtils | SearchableSelect
mockData.js     → teamData.js
auth.js, teamData.js → constants/auth
```

**Anomalia (reduzida na Etapa 5):** `UserManagement` passou a receber `users` e `onUsersChange`
por prop, alinhando-se ao padrão dos 13 componentes extraídos na F0-11. Restam 3 módulos legados
buscando dados por conta própria: `RolesManagement` e `AuditLogs` (leem constantes e
`pm2_auth_logs`) e `MyProfile` (recebe `currentUser`).

---

## 8. Próximas Histórias

### F0-12 — Camada de Repositório — **concluída**
Isolar os 18 estados de domínio atrás de uma interface única, unificando os padrões de
persistência. É o passo que torna a troca de `localStorage` por API real (Fase 1) uma mudança de
implementação, e não de todas as telas. Andamento detalhado na seção 3-A.

Concluída em 5 etapas. A fonte de verdade dupla de `users` (débito 1) foi resolvida na Etapa 5.
Fica registrado para a F0-14: `handleLogin` e `sessionRepository` ainda resolvem contra
`HOMOLOG_USERS` estático — decisão deliberada (Opção A), para não alterar autenticação numa
história de refatoração de persistência.

### F0-13 — Roteamento Real — **concluída**
`activeTab` foi substituído por 23 rotas reais e BUG-01 corrigido nas 4 ocorrências. Detalhes na
seção 3-B.

### F0-14 — Guards de Rota — **concluída**
Todos os achados foram fechados, exceto o do logo da Sidebar, mantido por decisão registrada.
Detalhes na seção 3-C.

### F0-15 — TypeScript Incremental — **concluída**
Detalhes na seção 3-D.

**Débitos remanescentes ao fim da Sprint 0**, para a próxima Sprint:

| # | Débito | Origem |
|---|---|---|
| 1 | `handleLogin` autentica contra `HOMOLOG_USERS` estático — usuário criado pela tela não entra | F0-12 |
| 2 | `sessionRepository.load()` resolve a sessão contra o mesmo array estático | F0-12 |
| 3 | Sessão ativa não é revalidada: bloquear um usuário logado não o derruba | F0-14 |
| 4 | Logo da Sidebar leva o MONITOR a "Acesso Negado" | F0-13 |
| 5 | Dois formatos de usuário no mesmo array (`UserManagement` × `UserModal`) | F0-12 |
| 6 | Calendário inalcançável, apesar de implementado | F0-11 |
| 7 | `monitorGoals` gravado e nunca exibido | F0-11 |
| 8 | Etapa 3 do wizard transborda em viewport móvel | F0-11 |
| 9 | 7 permissões granulares declaradas e nunca usadas; `VIEW_MY_MONITORINGS` órfã | F0-14 |
| 10 | 11 erros de lint legados nos 4 arquivos de `modules/monitoring` e `SearchableSelect` | F0-11 |
| 11 | Ícones importados sem uso, helpers órfãos, estado de modal nunca construído | F0-11 |
| 12 | 15 arquivos ainda em `.jsx`, fora do type-check (telas de leitura) | F0-15 |

**Bloco de autenticação** — os débitos 1, 2 e 3 são a mesma questão vista de três ângulos e
foram deliberadamente mantidos fora das F0-12, F0-14 e F0-15. Merecem história própria:
unificar `handleLogin` e `sessionRepository` com `usersRepository`, e revalidar a sessão ativa.

---

## Fora do Escopo da Sprint 0

A Sprint 0 é de **fundamentos**. Não inclui backend, autenticação real, nem qualquer parte do
pipeline de IA (transcrição, diarização, avaliação assistida) — que constituem as Fases 1 e 2 do
roadmap do produto.
