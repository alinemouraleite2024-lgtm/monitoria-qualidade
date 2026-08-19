# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] — Sprint 0 (Fundamentos) — **aguardando publicação**

> Desenvolvimento concluído: 15 de 15 histórias. A versão só passa a "publicada" quando o
> deploy estiver no ar e a URL de homologação disponível para validação, conforme
> `.agents/AGENTS.md`. Até lá, esta seção fica sem data.
>
> `package.json` foi corrigido de `0.3.0` para `0.8.0` — havia parado de acompanhar o
> CHANGELOG desde a 0.4.0.
>
> Relatório da Sprint em [`docs/RELATORIO-SPRINT-0.md`](docs/RELATORIO-SPRINT-0.md);
> estado detalhado em [`docs/STATUS-SPRINT-0.md`](docs/STATUS-SPRINT-0.md).

### Added
- **Critérios oficiais CYF**: os 12 critérios de exemplo foram substituídos pelos **28 oficiais**
  (24 avaliativos + 4 eliminatórios), com número, categoria, orientação, tipo de resposta e peso.
- **Novos tipos de resposta**: Checklist Sim/Não (itens 4 e 24, com sub-perguntas e nota
  fracionária) e Faixa de Tempo (item 5).
- **Orientação do critério no wizard**: painel expansível por critério, com o texto oficial da
  rubrica, para padronizar o julgamento do monitor.
- **Critérios eliminatórios**: sinalização durante a avaliação e zerada da monitoria **somente
  após confirmação explícita de um Gestor ou Administrador**.
- **Tela de Cadastros acessível**: a área administrativa (Áreas, Colaboradores, Critérios,
  Configurações, Usuários) existia no código mas era inalcançável pela navegação.
- Fluxo de aprovação completo: além de Aprovar, os caminhos **Reprovar** e **Solicitar Ajustes**
  passaram a funcionar. "Solicitar Ajustes" devolve a monitoria como `Rascunho`, preservando o
  motivo informado pelo gestor.

### Changed
- **TypeScript incremental (F0-15)**: o projeto passou a ter contratos verificados pelo
  compilador. **36 dos 51 arquivos** migrados, incluindo o formulário de monitoria e o
  componente raiz — os dois lados do contrato que originou o defeito crítico de salvamento
  desta Sprint. Nenhum arquivo `.js` restante. `tsc --noEmit` passou a ser verificação
  obrigatória, ao lado de build e lint: o empacotador apaga os tipos sem conferi-los, de modo
  que o build sozinho nunca provou nada sobre eles.
- **Guards de rota (F0-14)**: o controle de acesso passou a ter um ponto único de decisão
  (`RouteGuard`) e uma política declarada em um só arquivo. Rota sem permissão declarada passou a
  ser **negada** em vez de liberada. O login ganhou endereço próprio (`/login`), o logout passou a
  redirecionar, e quem acessa um endereço protegido sem sessão volta para ele depois de
  autenticar. Removidas 3 checagens de papel duplicadas no JSX.
- **Roteamento real (F0-13)**: a navegação deixou de ser um estado interno (`activeTab`) e passou
  a ser a URL. **23 rotas** com `react-router-dom`, endereços compartilháveis, botões de voltar e
  avançar do navegador funcionando, e recarregamento preservando a tela. O formulário de edição
  ganhou endereço próprio (`/monitorings/:id/edit`) e passou a resolver a monitoria pelo id —
  recarregar a página durante a edição não perde mais o formulário. Endereços inválidos passaram
  a exibir uma tela de "página não encontrada" em vez de uma área de conteúdo em branco.
  O dispatcher manual de 239 linhas foi eliminado. Menu, breadcrumb, permissões e telas
  permanecem idênticos.
- **Cálculo de nota agora é ponderado**: passou a considerar o peso de cada critério; itens de
  peso 0 (classificação e eliminatórios) foram excluídos do denominador.
- **Camada de repositório (F0-12)**: a persistência deixou de ser `localStorage`
  espalhado pelo `App.jsx` e passou por `src/repositories`. Um único efeito que reescrevia 15
  chaves a cada mudança virou **14 efeitos granulares**, um por coleção. As migrações silenciosas
  de monitorias (escala 0-10 → 0-100 e tipo "Fluxo" → "Processo") saíram do inicializador de
  estado para `migrateMonitorings`, transcritas sem alteração de regra. Login e logout passaram a
  usar `sessionRepository`, gravando a mesma chave no mesmo formato. Regras dos Hooks do React
  restabelecidas com a divisão em `App` (guarda de migração) + `AppContent`. Regras de vigência
  de alocação e de autorização por papel extraídas para `src/domain`.
  Na etapa final, `users` deixou de ter dois donos: `getSystemUsers`/`saveSystemUsers` foram
  removidos e `UserManagement` passou a consumir o estado do `App.jsx` por prop.
  `App.jsx`: **1.377 → 1.215 linhas**; chamadas a `localStorage`: **45 → 5**, todas restritas à
  rotina de versionamento do banco local; problemas de lint: **60 → 12**.
  Sem mudança de UX; autenticação intocada.
- **Modularização do frontend (F0-11)**: `App.jsx` reduzido de **3.418 para 1.377 linhas
  (−60% na história; −58% em relação ao início da Sprint)**, com **19 componentes** extraídos em
  5 ondas incrementais, cada uma validada com lint, build e teste funcional. Paridade 1:1
  preservada — sem mudança de UX ou de regra de negócio.
- **Fonte única do conceito de nota** (`src/scoreUtils.js`), substituindo 3 implementações
  divergentes espalhadas pelo código.
- `DATABASE_VERSION` atualizado para 10, forçando a migração do conjunto de critérios.

### Fixed
- **Formulário de monitoria acessível a quem não deveria (crítico)**: as rotas de criação e
  edição não tinham permissão declarada e ficavam abertas a qualquer usuário autenticado — um
  colaborador barrado em todas as outras telas alcançava o formulário completo.
- **Usuário bloqueado continuava entrando**: bloquear uma conta gravava o status, registrava
  auditoria e exibia "Bloqueado" na tela, mas não impedia o login. O acesso passou a ser
  recusado, com registro em auditoria.
- **Perfil COLABORADOR autenticava sem ter acesso a nada**: entrava na plataforma e recebia um
  ambiente sem menu e sem conteúdo. O login passou a ser recusado.
- **Atalhos da Home do Monitor não navegavam (BUG-01)**: quatro botões — "Nova Monitoria",
  "Pesquisar", "Ver todas" e "Meu Perfil" — apontavam para destinos inexistentes e deixavam a
  área de conteúdo em branco, sem erro visível. Corrigidos na F0-13.
- **Perda silenciosa de alterações de usuário (crítico)**: a tela de Usuários gravava
  `pm2_users` por fora do estado da aplicação. Bloquear um usuário e em seguida cadastrar outro
  em Cadastros **revertia o bloqueio**. Alterações feitas em Usuários também só apareciam nas
  demais telas após recarregar a página, e bloquear/desbloquear não atualizava a própria lista.
- **Salvamento de monitorias restabelecido (crítico)**: incompatibilidade de contrato entre
  `MonitoringForm` e `App.jsx` impedia salvar qualquer monitoria. A correção também eliminou um
  segundo motor de cálculo de nota que descartava silenciosamente as respostas de checklist.
- Erro de execução ao abrir o detalhe de uma monitoria (função de conceito de nota não definida).
- Campo "Plano de Ação" no detalhe da monitoria exibia sempre "Não preenchido", por ler um campo
  inexistente.
- Botões "Reprovar" e "Solicitar Ajustes" não funcionavam por props nunca conectadas.
- Painel de detalhe não refletia a ação do gestor sem reabrir a tela.

## [0.7.0] - 2026-07-13

### Added & Changed
- **Cadastro Inteligente de Master Data**:
  - Refatoração dos campos Empreendimento e Categoria para não mais dependerem de listas estáticas no código base.
  - Upgrade no componente `SearchableSelect` habilitando a criação de novas opções diretamente pelo monitor no momento da inserção.
  - Algoritmo de Deduplicação visual que ignora acentuação, espaços extras e sensibilidade de caixa ao validar se um cadastro já existe, reduzindo dados lixo.
  - Implementada persistência `on-the-fly` vinculada ao `localStorage` na camada mais alta da aplicação (`App.jsx`), simulando com perfeição uma futura integração de banco de dados por API sem quebrar as regras de negócio de monitorias e garantindo o provisionamento para os demais usuários da sessão.

## [0.6.1] - 2026-07-13

### Added & Changed
- **Padronização dos Tipos de Monitoria**:
  - Atualização do campo "Tipo de Monitoria" para as 4 opções oficiais: Regular, Direcionada, Processo e Calibração.
  - Implementado Tooltip nativo interativo contendo os conceitos de cada tipo, guiando o monitor durante o preenchimento.
  - Criado mecanismo de migração silenciosa (on-the-fly) em `App.jsx` para converter as monitorias antigas marcadas como "Fluxo" ou "Fluxo / Processo" para a nova nomenclatura oficial ("Processo"), assegurando 100% de compatibilidade sem perda de banco de dados ou histórico.

## [0.6.0] - 2026-07-13

### Added
- **Refatoração UI/UX: Página de Nova Monitoria**:
  - Removido o modelo antigo de modal lateral (Slide-Over) para a criação/edição de monitorias.
  - Implementada uma rota/página dedicada (`activeTab: monitoring-new` / `monitoring-edit`) de largura total (Full Page).
  - Adicionado Layout CRM: Header superior fixo (Sticky) com Breadcrumb/Ações e Rodapé Inferior Fixo com as ações do formulário.
  - Melhorada a ergonomia de uso removendo o scroll interno (duplo scroll).

## [0.5.1] - 2026-07-13

### Added
- **Refatoração UI/UX: Componente SearchableSelect**:
  - Implementado novo componente autoral de *Autocomplete* (SearchableSelect) para facilitar buscas em listas grandes.
  - Refatoração dos campos "Empreendimento" e "Categoria" no formulário de monitoria para utilizar o novo componente de busca.
  - Nova camada arquitetural: Arquivo mestre `catalogData.js` para armazenar listas e domínios independentes do mock de validação.

## [0.5.0] - 2026-07-13

### Added
- **Refatoração UI/UX: Módulo de Monitoria (Formulário)**:
  - Etapa 1 reformulada para usar listas oficiais (Empreendimentos e Categorias) e validação visual de campos obrigatórios.
  - Etapa 2 ("Evidências") totalmente remodelada com layout em formato de cartões, indicador de progresso e botões de ação para os anexos.
  - Etapa 3 ("Avaliação") aprimorada com *Accordions* retráteis para as categorias, barra lateral flutuante (sticky) para acompanhamento do progresso e notas, e botões coloridos intuitivos.
  - Etapa 4 ("Observações") redesenhada com cartões visuais (Pontos Fortes, Oportunidades e Plano de Desenvolvimento).
  - Etapa 5 ("Conclusão") transformada em um Resumo Executivo completo, exibindo o desempenho por categoria através de gráficos de barras horizontais e fluxo de confirmação seguro.

## [0.4.0] - 2026-07-06

### Added
- **Formulário Oficial de Monitoria (Sprint 2)**: Reescrita completa do componente de formulário para um Wizard interativo de 5 etapas.
- Novas Categorias de Avaliação: COMUNICAÇÃO, ATENDIMENTO, PROCESSO e ENCERRAMENTO.
- Nova lógica de cálculo de pontuação (0, 1, 2, N/A).
- Novos campos no formulário: Empreendimento, Categoria do Atendimento e Protocolo.
- Adicionado sistema de "Auto-Save" como rascunho para prevenção de perda de dados.
- Adicionado suporte a exportação do formulário de monitoria em PDF via impressão.

### Changed
- `DATABASE_VERSION` atualizado para 9 (Forçando limpeza de mock local obsoleto).
- Limpeza dos dados de monitoria mock (`INITIAL_MONITORINGS`) para suportar a nova matriz de critérios limpa.

## [0.3.2] - 2026-07-06
### Added
- **Feature:** Implementação de controle de versão permanente e mecanismo de migração para o banco de dados local (`localStorage`).
- Inclusão da constante global `DATABASE_VERSION` no `config.js` e da função `initializeDatabase` para limpar estados estagnados automaticamente após deployments.

## [0.3.1] - 2026-07-03

### Fixed
- **Hotfix:** Refatoração estrutural para eliminação definitiva de Dependência Circular (Circular Dependency) entre `auth.js` e `teamData.js`.
- Criação de `src/constants/auth.js` como Single Source of Truth para roles e permissões.
- Diagnóstico minucioso para resolução do erro do HMR do Vite que gerava `TypeError: Cannot read properties of undefined (reading 'find')`.

## [0.3.0] - 2026-07-02

### Added
- **Sprint 3: MVP Operacional | Módulo de Monitorias**
- Módulo Central de Monitorias (Listagem e Filtros) isolado em um novo componente `MonitoringList`.
- Wizard Multietapas de Criação de Monitoria transformado no componente isolado `MonitoringForm`.
- Histórico detalhado e fluxo de aprovação de monitorias no componente `MonitoringHistory`.
- Refatoração de `App.jsx` para suportar os novos componentes modularizados e simplificar a gestão de estado.

## [0.2.2] - 2026-07-01

### Fixed
- **Hotfix:** Correção do bloqueio de deploy na Vercel (adequação de identidade Git do autor do commit).
- **Added:** Adicionado componente `ErrorBoundary` em `main.jsx` para interceptar e exibir erros de React no ambiente de produção, evitando telas brancas silenciosas.

## [0.2.1] - 2026-07-01

### Fixed
- **Hotfix:** Correção de erro fatal de execução (ReferenceError) que causava tela branca na Vercel (importação faltante da constante `INITIAL_AGENDA` no componente principal).

## [0.2.0] - 2026-07-01

### Added
- **Sprint 2: Gestão de Usuários, Perfis e Segurança**
- Módulo de Administração com submenus protegidos.
- Tela de Cadastro e Gestão de Usuários (CRUD, Bloqueio/Desbloqueio).
- Controle de Permissões granular por Perfil (Administrador, Gestor, Monitor).
- Tela de Logs de Acesso e Auditoria.
- Nova tela Meu Perfil com alteração de senha.
- Preparação arquitetural para White Label (Provedores de Autenticação Modulares).


## [0.1.0] - 2026-07-01

### Added
- Sprint UX/UI 1: Redesign Completo.
- Autenticação.
