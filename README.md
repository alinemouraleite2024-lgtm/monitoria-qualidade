# Monitoria

Projeto de monitoria desenvolvido com React e Vite.

## Estrutura do Projeto

A documentação principal do projeto pode ser encontrada na pasta `/docs`.
O contexto oficial — estado, modelo de operação e decisões — está em
[`docs/OPERACAO.md`](docs/OPERACAO.md).

**Em produção:** https://monitoria-qualidade.vercel.app

- `/docs`: Documentação geral, guias e arquitetura.
- `/src`: Código-fonte da aplicação.
- `CHANGELOG.md`: Histórico de alterações seguindo o padrão Keep a Changelog.

## Scripts

- `npm run dev`: Inicia o servidor de desenvolvimento.
- `npm run build`: Gera o build de produção.
- `npm run lint`: Executa a verificação de linting.
- `npm run typecheck`: Verifica os tipos com o TypeScript. **Obrigatório**: o empacotador
  apaga os tipos sem conferi-los, então `build` sozinho não valida tipagem.
- `npm run validate`: lint + typecheck + build.

> **Nota de ambiente:** em caminhos que contenham `&` (como o do OneDrive desta instalação),
> `npm run` falha porque o script é executado via `cmd`. Rode as ferramentas direto:
> `node node_modules/eslint/bin/eslint.js .`, `node node_modules/typescript/bin/tsc --noEmit`,
> `node node_modules/vite/bin/vite.js build`.

## Versionamento

Este projeto adota o [Semantic Versioning (SemVer)](https://semver.org/).
O fluxo de trabalho inclui:
1. Desenvolvimento (Sprint)
2. Commit das alterações
3. Push para o repositório
4. Deploy automático (Vercel)
5. Validação no ambiente de homologação
