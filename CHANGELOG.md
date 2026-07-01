# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
