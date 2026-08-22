# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.0] - 2026-08-22 — Dados operacionais destravados (Fatia 2A)

> Cinco correções estruturais que preparam a futura fila operacional de Monitorias. Nenhuma
> tela nova: o que muda é a **verdade dos números**.
>
> O sistema estava preso em **junho de 2026** por seis caminhos independentes, e três regras de
> negócio não existiam como regra — existiam como expressões copiadas inline em treze pontos do
> código. Esta versão dá um dono a cada uma delas.

### Added
- **Quatro módulos de domínio**, funções puras, testáveis sem montar React:
  `period.ts` (que mês é este e o que cai dentro dele), `monitoringRules.ts` (o que conta, o que
  conta à parte, o que não conta), `goalService.ts` (qual a meta e quanto já foi feito) e
  `getCarteira`/`getSemVinculo` em `allocationService.ts` (de quem é esta colaboradora).
- **Coluna "Validadas"** no quadro de metas do Planejamento: o que foi entregue e o que já
  passou pela gestora deixaram de ser o mesmo número.
- **Seletor de competência em Relatórios**, com as setas nomeando o mês de destino.

### Changed
- **Feito conta no envio.** A regra considerava concluída apenas a monitoria `Validada` ou
  `Concluída`. Como a monitoria da monitora nasce `Pendente`, o trabalho feito não aparecia no
  progresso até alguém validar — o contador exibiria zero depois de um mês inteiro de trabalho.
  E `Concluída` nunca é gravada por caminho nenhum: metade da condição era letra morta.
- **Meta por colaboradora virou a única fonte da verdade.** O alvo era
  `Math.max(metaGlobalDoMonitor, somaDasMetasPorColaboradora)` — duas metas concorrentes
  resolvidas escolhendo a maior, sem que nada na tela dissesse qual venceu.
- **"Quem falta monitorar" passou a respeitar a carteira vigente.** Antes varria todas as
  colaboradoras cadastradas, inclusive quem não tem vínculo com ninguém e por isso jamais
  poderia ser monitorada por quem estivesse olhando a lista.
- **Sem meta no período, o sistema diz que não há meta** em vez de exibir um número. O
  Dashboard preenchia a ausência com `|| 5`, inventando meta 5 onde não havia nenhuma.
- Exportações nomeiam a competência: `monitorias_2026-08.csv`, e o PDF traz a competência no
  cabeçalho.

### Fixed
- **Metas eram gravadas sempre em junho.** Os dois handlers fixavam `month: 5`: definir uma meta
  em agosto gravava a meta de junho, em silêncio. O passo em que a gestora define quanto
  precisa ser monitorado era, na prática, impossível de executar.
- **Relatórios exportava apenas junho, sempre.** O período estava fixo em 01/06–30/06 num estado
  cujo setter estava comentado no código. Em agosto, os dois botões devolviam um arquivo vazio,
  sem mensagem. Era a mais silenciosa das cinco travas.
- **Home do monitor comparava só o mês, sem o ano** — agosto de 2025 contaria junto com agosto
  de 2026, erro invisível no primeiro ano de uso.
- **Formulário de alocação pré-preenchia 05/06/2026** como início e 12/06/2026 como fim, e
  encerrar um vínculo gravava 05/06/2026 no `endDate` e no log de auditoria — no fluxo que o
  roteiro de operação manda usar em Menu → Equipe.
- **Quadro de metas exibia metas de outro mês** sob o rótulo do mês corrente. Enquanto o título
  também dizia "Junho/2026" fixo, o erro passava despercebido.

### Removed
- **Formulário "Meta Global (Volume Mensal)"** do Planejamento, junto com seu handler e estado.
  Pedir um número que o sistema não usa é pior do que não pedir nada. Os registros já gravados
  em `pm2_mgoals` permanecem intocados.
- Três props do Dashboard que deixaram de ser necessárias com a regra de carteira centralizada.

### Notas de operação
- **Agosto aparece sem meta até a Raquel cadastrá-las.** Não é regressão: a semente só tem
  junho, e a versão anterior exibia os números de junho como se fossem do mês corrente. São
  quatro cadastros em Planejamento.
- Nenhuma mudança de formato de dado. `DATABASE_VERSION` permanece em 10 — bumpá-la apagaria
  todas as chaves `pm2_`, incluindo as monitorias reais do piloto.

## [0.9.0] - 2026-08-21 — Navegação da plataforma de qualidade

> Reorganização do menu em torno dos três pilares da Qualidade e primeira preparação de dados
> para a visão de Cliente como entidade central, registrada em
> [`docs/VISAO-PRODUTO.md`](docs/VISAO-PRODUTO.md).
>
> A mudança de entendimento por trás desta versão: **NPS não é indicador, é processo
> operacional** — o cliente responde, a Qualidade recebe o caso, analisa histórico e
> monitorias, refaz monitoria quando necessário, contata o cliente, registra a tratativa e
> acompanha até a conclusão. Por isso NPS é item de primeiro nível e aparece também para a
> Monitora, que é quem executa o fluxo.

### Added
- **CSAT e NPS no primeiro nível do menu**, nos três perfis, com rotas `/csat` e `/nps`.
  Entram como placeholder — estão no menu por decisão de produto, não por já existirem. Novas
  permissões `VIEW_CSAT` e `VIEW_NPS`, ambas para ADMIN, GESTOR e MONITOR.
- **Placeholder com texto próprio por módulo**: `NotImplementedScreen` passou a aceitar
  `description`. O do NPS descreve a fila de casos e a tratativa; o do CSAT, o acompanhamento
  de satisfação. Placeholder mudo convida à pergunta "por que isso está aqui?".
- **"Meu Perfil" para GESTOR e ADMIN.** A permissão e a rota já existiam desde a Sprint 0;
  faltava a entrada no menu — os dois perfis só chegavam à tela digitando a URL.
- **Administração absorveu Contas e Acessos, Perfis e Permissões e Logs de Acesso** como
  sub-abas. As três telas perderam o item de primeiro nível e nenhuma podia ficar acessível
  apenas por URL.
- **`docs/VISAO-PRODUTO.md`**: o eixo hoje é o colaborador; a visão é o cliente. Monitorias,
  CSAT, NPS e Tratativas devem convergir para uma visão única do histórico do cliente.

### Changed
- **Protocolo obrigatório e pesquisável.** O campo era gravado e nunca lido — não aparecia na
  listagem, não era filtro, não entrava na busca, não ia para relatório. Passou a ser exigido
  na Etapa 1, a constar no resumo da Etapa 4 e a ser aceito na busca da listagem, junto com
  código e colaborador. É a única chave que liga uma monitoria ao atendimento e, por
  consequência, ao cliente.
  A regra vale **também na edição**, de propósito: monitoria registrada antes desta versão
  ganha a chave ao ser aberta, em vez de deixar a base com dois padrões.
- **Rótulos:** `Home` → **Início**, `Minhas Monitorias` → **Monitorias**, `Colaboradores` →
  **Equipe**, `Cadastros` → **Administração**.
- **Menus por perfil:** MONITOR 7 → 6 itens, GESTOR 9 → 9, ADMIN 15 → 10. Os três passaram a
  ser encaixados um no outro (MONITOR ⊂ GESTOR ⊂ ADMIN): nenhum papel vê item que o papel
  acima não veja.
  Dashboard Executivo e Planejamento **permanecem** em GESTOR e ADMIN — a operação assistida
  vai até 28/08 e a Gestora depende dos dois. Revisão depois dessa data.

### Fixed
- **Logo da sidebar levava a `/dashboard`**, rota que a Monitora não acessa: clicar na marca
  devolvia "Acesso Negado". Passou a levar a `/home`.
- **Breadcrumb exibia "Dashboard" em toda rota fora do menu** — inclusive em
  `/monitorings/new`, onde o texto era simplesmente falso. O literal virou "MonitorIA".
- **Campo de protocolo deixava de ser controlado ao editar monitoria antiga.** `initialData`
  era espalhado sem o `|| ''` que os campos vizinhos têm, então um registro gravado antes de o
  campo existir trazia `undefined` para o estado e o React acusava
  "changing a controlled input to be uncontrolled". Com a regra que passou a exigir o protocolo
  na edição, esse virou o caminho mais percorrido.

### Removed
- **Item "Pesquisas"** dos três menus, com a rota `/surveys`. CSAT e NPS não são duas variações
  de pesquisa: um é indicador e o outro é processo com fila e tratativa.
- **"Minhas Demandas"** (MONITOR) e **"Central de Demandas"** (GESTOR, ADMIN) do menu, e a rota
  `/my-demands`. As telas nunca existiram — eram placeholder. O **modelo de dados foi
  preservado**: `INITIAL_DEMANDS` e `demandsRepository` já têm exatamente a forma de uma
  tratativa (`type`, `assignedTo`, `priority`, `deadline`, `status`, `origin`, `relatedId`) e
  são a fundação do fluxo de NPS.
- **"Calendário"** (MONITOR) e a rota `/calendar`. O `CalendarScreen` continua no repositório: o
  débito 6 da Sprint 0 deixa de ser "implementado e inalcançável" e passa a "implementado e sem
  rota". **"Calendário Operacional"** (GESTOR) saiu do menu; a rota `/op-calendar` segue como
  placeholder.
- **`INITIAL_SURVEYS`** do mock: código morto — nenhum repositório o carregava — e, pior,
  modelava cada resposta como nota sobre o **colaborador** (`collaboratorId`), que é justamente
  o entendimento abandonado. A resposta é do cliente.
- Itens administrativos de primeiro nível **Usuários**, **Perfis e Permissões**, **Logs de
  Acesso**, **Configurações**, **Integrações** e **Histórico de Versões**. Os três primeiros
  viraram sub-abas de Administração; os três últimos eram placeholder e seguem roteáveis.

### Notas de operação
- `docs/OPERACAO.md` atualizado: o passo de vínculo de carteira dizia "Menu → Colaboradores" e
  passou a dizer "Menu → Equipe".
- A partir desta versão **nenhuma monitoria pode ser salva sem protocolo**. Combinar o padrão
  do número antes de retomar os registros.

## [0.8.1] - 2026-08-20 — Ajustes pré-piloto

> Dois ajustes publicados na véspera da entrada em operação, ambos sem alteração de
> autenticação, sessão, rotas, permissões ou regra de negócio.
> Contexto operacional em [`docs/OPERACAO.md`](docs/OPERACAO.md).

### Changed
- **Tela de login com a identidade da Moura Leite** (`7d389b1`): fundo verde institucional com
  a mesma textura do Portal de Simulações, faixa laranja no topo do card, árvore do logo em SVG
  no lugar do quadrado com as letras "ML", e a marca **MonitorIA** passando a aparecer em
  destaque — antes o nome do produto não constava na tela. Campos e botão ampliados para 48 px,
  com estados de foco visíveis. A linha "Simulação Comercial: 05 de Junho, 2026" foi substituída
  por "Acesso restrito a colaboradores Moura Leite": num sistema que entra em uso real, anunciar
  "simulação" na primeira tela contradizia o próprio uso.
- **Home da monitora sem indicadores inventados** (`3756071`): a tela exibia seis blocos de
  dados que não vinham de lugar nenhum. Numa base zerada — o estado do primeiro dia — ela
  afirmava "Nota Média 0,00% · Crítico" ao lado de "Produtividade 95% · Dentro do SLA",
  acusando desempenho crítico antes do primeiro registro e garantindo uma produtividade que
  ninguém calculava. Foram removidos o card de produtividade, o gráfico "Meu Desempenho" (array
  fixo e meses fixos), os três avisos de equipe escritos à mão, e a agenda, que lia a semente de
  junho e exibia todo compromisso às 21:00. Com a agenda saíram 13 botões "Iniciar" sem ação, e
  com a tabela, um botão "Visualizar" também sem ação.
  Resultado: **1.728 → 691 px de altura, 9 → 5 blocos, 18 → 5 botões, 14 → 0 botões sem ação.**
  Nenhum dado inventado foi substituído por outro.

### Fixed
- **Fila de pendências da Home nunca exibia nada** (`3756071`): duas divergências de contrato no
  mesmo card. O filtro consultava `d.assigneeId` quando o campo do registro é `assignedTo`, de
  modo que a contagem era sempre zero e a tela dizia "Tudo limpo por aqui" mesmo havendo
  demandas em aberto. O prazo lia `d.dueDate` quando o campo é `deadline`, o que exibiria
  "Invalid Date" assim que a contagem voltasse a funcionar. Com os dois nomes acertados, a Home
  passou a mostrar duas demandas reais da monitora, uma delas crítica.
  É a mesma classe de defeito do BUG-02 — dois lados discordando sobre o nome de um campo.
- **Nota média com base vazia acusava "Crítico"**: passou a exibir "—  Sem dados neste mês".
- **"Nova Monitoria" não abria o formulário**: levava à listagem; agora abre `/monitorings/new`.

---

## [0.8.0] - 2026-08-19 — Sprint 0 (Fundamentos)

> **Publicada.** 15 de 15 histórias. Homologação em
> https://monitoria-qualidade.vercel.app · commit `94386d9`.
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
