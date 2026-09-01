# Documentação do Projeto

Esta pasta contém a documentação técnica, manuais e guias do projeto.

> **Onde começar:** [`OPERACAO.md`](OPERACAO.md). É a fonte oficial do contexto do projeto
> e responde onde o sistema está, como se opera e o que foi decidido.

## Documentos

| Documento | Responde |
|---|---|
| [`OPERACAO.md`](OPERACAO.md) | **Contexto oficial.** Estado atual, modelo de operação, regras diárias, travas conhecidas, pendências, estratégia dos pilotos e decisões de produto |
| [`BACKUP-RESTAURACAO.md`](BACKUP-RESTAURACAO.md) | **Procedimento obrigatório antes de qualquer publicação que mexa em modelo, catálogo ou migração.** Como exportar e restaurar a base — a persistência é `localStorage`, então não existe cópia em servidor |
| [`METODOLOGIA-MONITORIA.md`](METODOLOGIA-MONITORIA.md) | **Régua oficial de avaliação (Fatia 3A.0).** Os 28 critérios com orientação completa, âncoras 2/1/0, eliminatórios, regras por tipo de atendimento e estrutura do relatório. Base única do MonitorIA, do `instructionBuilder`, do assistente e do treinamento. **Aguardando validação** |
| [`VISAO-PRODUTO.md`](VISAO-PRODUTO.md) | Direção de produto: o cliente como entidade central e o NPS como processo operacional. Nada implementado |
| [`RELATORIO-SPRINT-0.md`](RELATORIO-SPRINT-0.md) | Relatório final da Sprint 0: versão, entregas, métricas, checklist de homologação, pendências e riscos. **Publicada em 19/08/2026** |
| [`STATUS-SPRINT-0.md`](STATUS-SPRINT-0.md) | Estado técnico do código: histórias, bugs, componentes, métricas, débitos e arquitetura. Inclui as publicações posteriores ao fechamento |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Histórico de versões |

## Estado em 01/09/2026

| | |
|---|---|
| Sistema | em produção — https://monitoria-qualidade.vercel.app |
| Versão em produção | 0.18.0 · commit `37b345a` · tag `v0.18.0` |
| Em branch | **0.19.0** — navegação por perfil, aguardando validação |
| Frente aberta | **3A — Assistente de Avaliação** |
| Fatia em curso | 3A.0 concluída (régua validada 32/32 e em produção) |
| Próximo marco | cadastro das orientações por tipo de atendimento, depois 3A.1 |

## Estrutura planejada
- Arquitetura
- Fluxos de Negócio
- Guias de Deploy
