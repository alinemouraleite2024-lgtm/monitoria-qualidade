# Relatório Final — Sprint 0 (Fundamentos)

> **Status: PUBLICADA em 19/08/2026.** Todos os requisitos da Regra de Conclusão de Sprint de
> [`.agents/AGENTS.md`](../.agents/AGENTS.md) foram cumpridos: código implementado, changelog
> atualizado, commit realizado, deploy concluído, URL no ar e checklist de homologação
> disponível.

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **Versão** | 0.8.0 |
| **Data da publicação** | **19/08/2026** |
| **Link de homologação** | **https://monitoria-qualidade.vercel.app** |
| **Ambiente** | Homologação (`HOMOLOGATION_MODE = true`, persistência em `localStorage`) |
| **Hash do commit publicado** | **`94386d938289b70bba705a0f7da47db76e3ececd`** (`94386d9`), em `main` |
| **Artefato publicado** | `index-_khVWhmX.js` — hash idêntico ao build validado localmente |
| **Commit base** | `f93b412` — *feat(monitoria): master data e cadastro inteligente de categorias* (2026-07-13) |
| **Tempo da Sprint** | 2026-07-13 → 2026-08-19 (**37 dias**) |
| **Próxima Sprint** | Nenhuma aberta — o foco passou a ser operação, ver seção 7 |

### Critérios de encerramento — todos cumpridos

Regra de Conclusão de Sprint de [`.agents/AGENTS.md`](../.agents/AGENTS.md):

| # | Critério | |
|---|---|---|
| 1 | Código implementado | ✅ 15 de 15 histórias |
| 2 | Changelog atualizado | ✅ versão 0.8.0 |
| 3 | Commit realizado | ✅ `94386d9` |
| 4 | Deploy concluído | ✅ 19/08/2026 |
| 5 | URL funcionando | ✅ https://monitoria-qualidade.vercel.app |
| 6 | Checklist de homologação | ✅ seção 4 deste documento |

### Publicações posteriores ao encerramento

Não abriram Sprint nova e não introduziram funcionalidade. Detalhe na seção 9 de
[`STATUS-SPRINT-0.md`](STATUS-SPRINT-0.md).

| Data | Hash | Natureza |
|---|---|---|
| 19/08 | `7d389b1` | Identidade visual do login |
| 20/08 | `3756071` | Home simplificada, sem indicadores inventados |

Versão em produção após esses ajustes: **0.8.1**

---

## 2. Resumo das funcionalidades implementadas

**15 histórias concluídas.** Detalhamento completo em [`STATUS-SPRINT-0.md`](STATUS-SPRINT-0.md).

### Regra de negócio e avaliação (F0-01, F0-02, F0-04 a F0-10)

- Os 12 critérios de exemplo foram substituídos pelos **28 oficiais CYF** (24 avaliativos + 4
  eliminatórios), com número, categoria, orientação, tipo de resposta e peso.
- Dois tipos de resposta novos: **Checklist Sim/Não** (com sub-perguntas e nota fracionária) e
  **Faixa de Tempo**.
- **Cálculo de nota ponderado**: passou a considerar o peso de cada critério; itens de peso 0
  (classificação e eliminatórios) saíram do denominador.
- **Critérios eliminatórios**: sinalizados durante a avaliação, mas a nota só é zerada após
  confirmação explícita de um Gestor ou Administrador.
- **Orientação do critério no wizard**, para padronizar o julgamento do monitor.
- Fonte única do conceito de nota, eliminando 3 implementações divergentes.

### Fluxo operacional

- **Salvamento de monitorias restabelecido** — estava 100% bloqueado por incompatibilidade de
  contrato (BUG-02).
- Fluxo de aprovação completo: **Aprovar, Reprovar e Solicitar Ajustes** passaram a funcionar.
- Tela de **Cadastros** tornada acessível: existia no código e era inalcançável.

### Arquitetura (F0-11 a F0-15)

- **Modularização**: 19 componentes extraídos do `App.jsx` em 5 ondas.
- **Camada de repositório**: fonte de verdade única para as 18 coleções de domínio.
- **Roteamento real**: 23 rotas com endereços compartilháveis, histórico do navegador e
  recarregamento preservando a tela.
- **Guards de rota**: ponto único de decisão de acesso; rota de login própria.
- **TypeScript incremental**: 36 dos 51 arquivos migrados, com `tsc --noEmit` como verificação
  obrigatória.

### Correções de segurança e integridade de dados

- **Formulário de monitoria acessível a quem não deveria** — as rotas de criação e edição não
  tinham permissão declarada.
- **Usuário bloqueado continuava entrando** — o bloqueio gravava e não impedia o login.
- **Perfil COLABORADOR autenticava** sem ter acesso a nada.
- **Perda silenciosa de alterações de usuário** — a tela de Usuários gravava por fora do estado
  da aplicação e as duas escritas competiam.

---

## 3. Métricas

### Código

| Métrica | Antes (`f93b412`) | Depois | Variação |
|---|---|---|---|
| Arquivos em `src/` | 16 | **51** | +219% |
| Linhas em `src/` | 5.738 | **7.232** | +26% |
| Maior arquivo | `App.jsx` (3.306) | `App.tsx` (1.258) | **−62%** |
| Concentração no maior arquivo | 58% | **17%** | −41 p.p. |
| Chamadas a `localStorage` no arquivo raiz | 45 | **5** | −89% |
| Violações das Regras de Hooks | 47 | **0** | — |
| Problemas de lint | 61 | **8** | −87% |
| Arquivos sob type-check | 0 | **36** | — |

> O total de linhas **cresceu** e isso é esperado: distribuir código em 51 arquivos adiciona
> assinaturas de props e imports, e a tipagem adiciona interfaces. O ganho não é volume — é
> distribuição e contratos verificados.

### Qualidade

| Verificação | Resultado |
|---|---|
| `npm run build` | **OK** — 452,92 kB (gzip 121,30 kB) |
| `npm run lint` | **8 problemas** — 7 erros de ícones importados sem uso + 1 warning, todos débitos legados |
| `npm run typecheck` | **0 erros** |

> **Linha de base de lint redefinida na F0-15.** Onze dos doze problemas anteriores eram
> `'React' is defined but never used`, que desaparecem com `jsx: "react-jsx"` — não foram
> corrigidos, mudaram de contexto. A base comparável a partir de agora é **8**.

### Validação funcional

Executada na aplicação em execução, não inferida por leitura de código.

| Cobertura | Resultado |
|---|---|
| Matriz de permissões | **21 rotas × 4 perfis**, sem divergência do esperado |
| Varredura de navegação | **31 destinos** nos 3 perfis operacionais |
| Fluxo de monitoria | criar → salvar → listar → abrir → aprovar |
| Migrações de dados legados | 5 casos, incluindo monitoria zerada e nota já em escala nova |
| Sessão | login, logout, reload, deep link com retorno à rota pretendida |
| Acesso negado | usuário BLOCKED e perfil COLABORADOR |
| Erros de console | **0** em toda a bateria |

---

## 4. Checklist para homologação

Roteiro para validação manual no ambiente publicado.

### Acesso e sessão
- [ ] Entrar como **Administrador** (`admin@mouraleite.com.br`)
- [ ] Entrar como **Gestor** (`raquel@mouraleite.com.br`)
- [ ] Entrar como **Monitor** (`aline@mouraleite.com.br`)
- [ ] Credencial errada exibe "E-mail ou senha inválidos."
- [ ] Colar uma URL interna sem estar logado leva ao login **e retorna à tela pedida** após entrar
- [ ] Recarregar a página numa tela interna mantém a sessão e a tela
- [ ] Voltar e avançar do navegador funcionam
- [ ] Endereço inexistente exibe "Página não encontrada"
- [ ] Sair leva à tela de login

### Permissões
- [ ] Monitor **não** acessa Dashboard, Planejamento, Colaboradores nem telas administrativas
- [ ] Gestor **não** acessa Usuários, Perfis, Logs nem Cadastros
- [ ] Bloquear um usuário em **Usuários** e confirmar que ele **não** consegue mais entrar
- [ ] Desbloquear e confirmar que volta a entrar

### Monitoria — fluxo principal
- [ ] Criar monitoria como Monitor, preenchendo as 5 etapas
- [ ] Confirmar que o avanço é **bloqueado** com critério não avaliado
- [ ] Confirmar que nota abaixo da máxima **exige justificativa**
- [ ] Conferir a nota final e o desempenho por categoria no resumo
- [ ] Salvar e confirmar que aparece na listagem
- [ ] Abrir o detalhe e conferir os dados
- [ ] Como Gestor: **Aprovar**, e conferir a mudança de status na hora
- [ ] Como Gestor: **Reprovar** em outra monitoria
- [ ] Como Gestor: **Solicitar Ajustes** e conferir que volta como Rascunho com o motivo
- [ ] Editar uma monitoria e **recarregar a página** — o formulário deve reabrir a mesma

### Critérios
- [ ] Conferir os **28 critérios** oficiais em Cadastros → Critérios
- [ ] Conferir o critério de **checklist** (item 4) com as sub-perguntas
- [ ] Conferir o critério de **faixa de tempo** (item 5)
- [ ] Marcar um **eliminatório** e confirmar que a nota **não** zera sozinha
- [ ] Confirmar a zerada como Gestor e conferir que a nota vai a 0

### Cadastros
- [ ] Criar e editar um usuário em **Usuários**
- [ ] Criar uma área e um colaborador em **Cadastros**
- [ ] Confirmar que a alteração aparece **imediatamente** nas demais telas, sem recarregar

---

## 5. Pendências conhecidas

### Bloqueando a conclusão da Sprint

Nenhuma. Commit, merge em `main`, push, deploy e URL concluídos em 19/08/2026.

### Homologação executada em produção — 19/08/2026

| Verificação | Resultado |
|---|---|
| `/monitorings` colado direto na barra de endereços | **200** — sem 404, redireciona para `/login` |
| Atualizar a página numa rota interna | **mantém sessão e tela** |
| Rota inexistente | tela "Página não encontrada" do app, **não** o 404 da Vercel |
| Login ADMIN, GESTORA e MONITORA | os três entram; menus com 15, 9 e 7 itens |
| Retorno à rota pretendida após o login | confirmado |
| `/home` `/monitorings` `/monitorings/new` `/users` `/admin` | todas carregam |
| Monitora barrada em `/users` | Acesso Negado, como esperado |
| Erros de console | **nenhum** — o único 404 do log de rede é anterior ao deploy |

> **O risco 6 desta Sprint foi eliminado em produção.** Antes do deploy, `/monitorings`
> retornava `404: NOT_FOUND` da Vercel; depois, retorna `200`. O rewrite do `vercel.json`
> está ativo e comprovado.

### Débitos técnicos remanescentes

Lista completa e detalhada na seção 8 de [`STATUS-SPRINT-0.md`](STATUS-SPRINT-0.md).

| # | Débito | Relevância |
|---|---|---|
| 1 | `handleLogin` autentica contra array estático — **usuário criado pela tela não consegue entrar** | Alta |
| 2 | `sessionRepository` resolve a sessão contra o mesmo array estático | Alta |
| 3 | Sessão ativa não é revalidada: bloquear um usuário logado não o derruba | Alta |
| 4 | Logo da Sidebar leva o Monitor a "Acesso Negado" | Média |
| 5 | Dois formatos de usuário coexistem no mesmo array | Média |
| 6 | Tela de Calendário inalcançável, apesar de implementada | Média |
| 7 | `monitorGoals` é gravado e nunca exibido | Média |
| 8 | Etapa 3 do wizard transborda em viewport móvel | Média |
| 9 | 7 permissões granulares declaradas e nunca usadas | Baixa |
| 10 | 7 erros de lint legados (ícones importados sem uso) | Baixa |
| 11 | Helpers órfãos e estado de modal nunca construído | Baixa |
| 12 | 15 arquivos ainda em `.jsx`, fora do type-check | Baixa |

> **Débitos 1, 2 e 3 são a mesma questão vista de três ângulos.** Foram mantidos deliberadamente
> fora das F0-12, F0-14 e F0-15 para não misturar refatoração de persistência e roteamento com
> mudança de autenticação. Merecem história própria.

---

## 6. Riscos conhecidos

| # | Risco | Severidade | Situação |
|---|---|---|---|
| 1 | **Migração de nota 0-10 → 0-100 não é idempotente.** A condição olha o valor, não uma marca de versão: uma monitoria legitimamente avaliada com nota entre 1 e 10 na escala nova é re-multiplicada a cada carregamento | **Alta** | Preservado por paridade. Não há dado assim hoje. Corrigir exige versionar cada registro |
| 2 | **Toda autorização é client-side.** Os guards valem como usabilidade, não como segurança | **Alta** | Limitação estrutural da Fase 0; o reforço real depende do backend |
| 3 | **Persistência em `localStorage`.** Limpar o navegador apaga todos os dados; não há backup nem sincronização entre máquinas | **Alta** | Inerente ao ambiente de homologação |
| 4 | **Um bump de `DATABASE_VERSION` apaga todas as chaves `pm2_*`** antes de qualquer migração rodar | Média | Comportamento pré-existente de `initializeDatabase` |
| 5 | **Senhas em texto claro** no código-fonte da base de usuários de homologação | Média | Ambiente de homologação; inaceitável em produção |
| 6 | **Deploy sem `vercel.json` quebraria os deep links.** O arquivo foi criado nesta Sprint; sem ele, abrir uma rota interna direto retorna 404 do servidor | Média | Mitigado — validar no primeiro deploy |
| 7 | **`tsc --noEmit` não roda no build.** O empacotador apaga os tipos sem conferi-los | Média | Mitigado por `npm run validate`; **precisa entrar no CI** |

---

## 7. O que vem depois

**Nenhuma Sprint foi aberta.** A decisão tomada em 19/08 foi interromper o desenvolvimento e
colocar o sistema em uso real — o contexto operacional está em [`OPERACAO.md`](OPERACAO.md).

Quando o desenvolvimento for retomado, três candidatos naturais, em ordem de urgência técnica:

1. **Autenticação real** — fecha os débitos 1, 2 e 3, hoje o único bloco de alta relevância
   ainda aberto. É também pré-requisito para qualquer uso além de homologação.
2. **Backend e API** — transforma os riscos 2 e 3 em problemas resolvidos em vez de mitigados.
   A camada de repositório da F0-12 existe justamente para tornar isso uma troca de
   implementação, não de todas as telas.
3. **Fase 1 do produto** — pipeline de IA (transcrição, diarização, avaliação assistida),
   explicitamente fora do escopo da Sprint 0.

A quarta candidata surgiu depois do encerramento: a **reformulação da Home** como bancada de
trabalho. Depende da observação dos pilotos e não foi aprovada.
