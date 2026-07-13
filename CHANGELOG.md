# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
