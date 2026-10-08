# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.25.0] - a publicar — Importar avaliação do ChatGPT

> Homologada na prévia da Vercel em 08/10/2026, a partir da 0.24.1 (`feat/importar-chatgpt`).
> Não inclui nada do plano do ADMIN e dos ajustes da gestão, que estavam em branch como 0.25.0 e
> passam a ser a **0.26.0**.
>
> **Não altera dado gravado:** nenhuma migração, nenhum seed, `DATABASE_VERSION` segue 11.
>
> A monitoria continua sendo feita no ChatGPT, com o agente de qualidade. O que faltava era o
> caminho de volta: hoje a avaliação aprovada é redigitada critério a critério no MonitorIA.

### Added

- **Importar avaliação do ChatGPT**, na etapa 1 da Nova Monitoria. A monitora cola o JSON do
  agente (`monitoria-chatgpt/1`), vê uma prévia e aplica ao formulário. **Nada é gravado ao
  colar**: o registro nasce pelo salvamento de sempre e segue para a validação da gestão.
- Validação contra a régua cadastrada: critério inexistente, inativo ou fora do canal; opções;
  sub-perguntas (o `sub-24-3` da régua antiga é recusado com mensagem própria); N/A onde a
  metodologia proíbe; justificativa abaixo da máxima; contradição 29 × 25; colaborador com id e
  nome divergentes; monitora diferente da usuária logada; categoria fora do catálogo; datas
  incoerentes; `crit-29 = "Sim"` em telefone ou presencial, que não têm pré-autenticação e
  dispensariam o eliminatório 25 sem avaliação. Qualquer erro bloqueia a importação inteira.
- A nota é recalculada pelo MonitorIA. Se o JSON trouxer `conferencia.notaEsperada` e ela
  divergir, a importação é bloqueada.
- Confirmação individual obrigatória de cada eliminatório e de cada resposta com confiança
  `BAIXA` ou revisão pedida pelo agente; confirmação explícita para atendimento já monitorado e
  para substituir conteúdo já preenchido.
- `docs/CONTRATO-IMPORTACAO-CHATGPT.md`, com o formato e a instrução pronta para o agente. O
  mesmo bloco entrou no fim de `docs/PROMPT-IA-MONITORIA.md` (seção "Entrega para o MonitorIA").
- Depois de importar, trocar o canal é sinalizado: a faixa da importação diz de que canal a
  avaliação veio, quais critérios importados deixaram de se aplicar (guardados, não apagados —
  voltam se o canal voltar), quais passaram a exigir resposta e se o `crit-29` ficou incoerente
  com o canal.
- **Primeiros testes automatizados do projeto** (`tests/`, 48 casos), com o Node puro e sem
  dependência nova.

### Fixed

- Trocar o canal depois de importar não apaga mais as respostas. O efeito que reinicializa os
  scores ao mudar de canal passou a saber para qual conjunto de critérios eles já foram
  montados. Sem importação, o comportamento é o de antes.
- **Eliminatório 25 podia ser concluído sem avaliação** (defeito da 0.18.0, vale para toda
  monitoria). Com o `crit-29` em "Sim", o portão grava N/A no `crit-25`; ao voltar o 29 para
  "Não", o N/A ficava gravado, a tela não mostrava opção marcada e a etapa 3 deixava avançar.
  Agora, quando o portão deixa de valer, o N/A que ele gravou é limpo e o critério volta a
  exigir resposta. Monitoria reaberta não é tocada.

### Limitações conhecidas

- A proibição de N/A é lida do texto de `quandoNA` ("Nunca é N/A…"). O correto seria um campo
  estruturado no critério.
- Evidência e confiança não são guardadas como dado próprio: a evidência vai para o fim da
  justificativa e a confiança aparece só na prévia.
- A régua admite N/A no `crit-24` (atendimento interrompido pelo cliente), mas o formulário não
  oferece N/A em checklist — divergência anterior a esta versão. A importação segue o
  formulário e recusa N/A em checklist, porque a tela não teria como exibir nem editar o valor.

## [0.24.1] - 2026-10-07 — A pesquisa de satisfação sai do crit-24

> A operação descontinuou o incentivo à pesquisa de satisfação. Manter a sub-pergunta
> penalizava o atendente por não executar uma ação que deixou de existir — no primeiro piloto
> de agosto, 2,4 pontos percentuais.

### Changed

- **O crit-24 passa a ter duas sub-perguntas.** Saiu *"Realizou incentivo à pesquisa de
  satisfação?"*. O peso segue 1,5 e a soma da régua segue 27,0; o critério passa a valer 0, 1
  ou 2, sem os intermediários de 0,67 e 1,33.
- **Definição registrada: TRANSFERÊNCIA DE TITULARIDADE × TRANSFERÊNCIA DE LOTE.** A primeira é
  mudança de **quem** detém os direitos do contrato, com o lote inalterado — é onde entra a
  **cessão de direitos**. A segunda é mudança de **qual** lote, com o mesmo titular. O catálogo
  era uma lista de rótulos sem definição, e a escolha dependia de interpretação pelo nome.
- O prompt operacional da IA foi atualizado. Sem isso ele continuaria avaliando a pesquisa:
  a régua está embutida nele e ele não lê o sistema.

### Migration

- `pm2_criteria_sub24_version` 0 → 1. **Marcador próprio, e não um incremento de
  `criteriaVersion`** — este é o ponto da versão. Incrementar `criteriaVersion` reprocessaria o
  bloco inteiro das 0.16.0 e 0.18.0, que força `active` nos critérios de classificação e
  sobrescreve a `orientacao` dos critérios 14 e 27. Numa base onde a operação já administra a
  régua pela tela, isso apagaria edição feita por ela.
- A migração localiza o `crit-24`, confirma a presença de `sub-24-3`, remove **apenas** essa
  sub-pergunta e preserva todo o resto do critério. Se a sub-pergunta já não existir, nada é
  alterado.
- **Grava uma cópia do critério antes de alterá-lo**, em `pm2_criteria_sub24_backup`, com a
  data. `pm2_criteria` é o dado mais caro da base e não tem cópia automática.
- **Monitorias não são tocadas.** Nenhuma nota é recalculada: `finalScore` é gravado no
  registro, não derivado na leitura. As respostas gravadas mantêm `sub-24-3` dentro de
  `subRespostas` como chave órfã, que o formulário ignora por ler apenas as sub-perguntas
  cadastradas.

### Notas de operação

- **Reabrir e salvar uma monitoria validada recalcula o crit-24** sobre as duas sub-perguntas
  vigentes, e a nota dela muda. A régua não é versionada por monitoria — monitoria já validada
  não deve ser reaberta.
- Verificado em quatro cenários: base com a sub-pergunta presente e com customizações (um
  critério reativado e uma orientação editada) — a sub-pergunta sai e as duas customizações
  sobrevivem; segunda carga sem efeito; base sem a sub-pergunta, sem alteração e sem
  sobrescrever o backup; e nenhuma monitoria tocada.

## [0.24.0] - 2026-09-11 — Agenda operacional

> O plano anual passou a dizer quantas monitorias existem, mas a tela não dizia quais. E a
> agenda montava o mês corrente numa operação que avalia o mês anterior — em setembro, a
> agenda de setembro, que só seria trabalhada em outubro.

### Fixed

- **A agenda vinha vazia com o plano cadastrado.** A tela somava 35 no alvo e não listava
  ninguém: o alvo vinha das metas e a lista vinha de `getCarteira`, que só conhece alocação.
  Duas respostas para "de quem eu sou monitora" na mesma tela, e nada dizendo qual dos dois
  cadastros faltava.

  `getFilaDaCarteira` passa a listar a **união** — quem tem vínculo vigente **mais** quem tem
  meta resolvida para aquela monitora naquela competência. A linha do plano já diz monitora,
  colaboradora e volume: é uma declaração de carteira com meta junto, e entra na agenda por
  direito próprio. Cadastrar o plano passa a bastar.

  As alocações ficam. Elas carregam vigência e resolvem substituição em férias, que o plano não
  sabe responder, e continuam sendo a porta de quem é monitorada sem meta declarada.

- **O ritmo da equipe era medido dentro do mês auditado.** Com a defasagem, `getRitmoDaEquipe`
  calculava os dias úteis sobre agosto: a gestora via "1 dia útil restante · precisa de 35 por
  dia" em pleno setembro. Passa a receber os dois períodos.

- **"Sem Carteira"** avisava que a colaboradora "não entra em meta nenhuma". Com a união isso
  deixou de valer para quem tem linha no plano; o alerta passa a exigir as duas ausências.

- **"1 dias úteis restantes"** no Painel da gestora.

### Added

- **`settings.defasagemCompetencia`** — quantos meses a monitoria fica atrás do atendimento que
  audita. Padrão **1**, campo em Administração → Sistema → Fluxo, com a frase do efeito ao lado
  ("Trabalhando em Setembro de 2026, a agenda abre na competência de Agosto de 2026"). É
  parâmetro, e não constante, porque descreve o calendário de uma operação e não uma regra do
  sistema.

- **Seletor de competência na tela de Monitorias**, revertendo a decisão da 0.22.0 de que ela
  responde só sobre o mês corrente. Atraso, reavaliação e auditoria retroativa são rotina, e
  mandá-las para Relatórios era mandar a monitora para a única tela sem o botão de monitorar.

### Changed

- **Dois períodos com nomes próprios.** `competência` é o mês auditado — eixo de meta, fila,
  cobertura e pendências. `mês de trabalho` é o corrente — único eixo de dias úteis e ritmo.
  Confundi-los é o erro que esta tela já cometeu duas vezes, e agora na direção oposta: medir o
  ritmo pelo mês auditado daria zero dia restante justamente quando há trabalho a fazer.
- **Cabeçalho:** "Monitorias · Agosto de 2026", com "Competência de agosto, monitorada em
  setembro." no subtítulo. Fora da competência padrão, o subtítulo diz em que mês você está.
- **A carteira é resolvida por uma data dentro da competência**, e não por hoje. Uma alocação
  encerrada em julho não pode sumir da agenda de julho porque hoje é setembro.
- **O formulário nasce na competência da agenda.** Antes abria no mês corrente e só voltava a
  agosto depois de preenchido o início do atendimento.
- **O vazio da agenda** nomeia as duas portas de entrada, em vez de descrever o estado.

### Migração

- **Nenhuma.** `defasagemCompetencia` é preenchido com 1 na leitura para bases anteriores —
  aditivo, idempotente, sem marcador de versão e sem apagar nada. 1 é o que a operação já
  praticava à mão.

## [0.23.0] - 2026-09-11 — Plano de metas com vigência

> A meta era cadastrada mês a mês. Cinco colaboradoras × doze competências são sessenta
> cadastros por ano para dizer sempre a mesma coisa — e a competência esquecida ficava sem
> denominador, o que faz o progresso daquele mês simplesmente não existir.

### Added

- **`PlanoMetas`** — metas recorrentes com vigência (`'YYYY-MM'` a `'YYYY-MM'`). O plano declara
  o padrão uma vez; cada competência coberta herda as metas sem ninguém cadastrar nada.
- **`domain/planoMetasService.ts`** — a resolução. Existe exceção para a colaboradora naquele
  mês? usa a exceção. Não existe? usa o plano. A sobreposição é **por colaboradora**, não por
  linha: uma exceção geral precisa substituir todas as linhas dela, senão coexistiriam meta
  geral e meta por canal — o estado que `assertMetasConsistentes` proíbe desde a 2A.6.3.
- **Chips de origem** na tela de Metas: `Do plano`, `Ajustada · plano 5` (com o valor previsto
  ao lado do ajuste) e `Sem meta neste mês`. É o que o gestor lê primeiro para saber se aquele
  mês foi tocado.
- **"Sem meta neste mês"** — férias, afastamento ou situação especial. A linha continua visível
  com o motivo no lugar do escopo, e fora do total: uma decisão que some da tela não pode ser
  revista. Não é `targetQty: 0` — zero somaria ao total e faria `hasGoal` verdadeiro,
  transformando "está de férias" em "tem meta zero".
- **Campo `entraEm`** por linha do plano: quem entra na operação no meio da vigência aparece a
  partir da competência de entrada, em vez de virar uma exceção repetida todo mês.
- **Editor do plano**, com aviso explícito de a partir de qual competência a alteração vale.

### Changed

- **`ColaboradorGoal` passou a ser a exceção**, sem mudar de forma. Era o registro de meta de um
  mês; segue sendo exatamente isso — o que mudou foi o papel dele no modelo.
- **A tela de Metas recebe as metas já resolvidas** e deixou de filtrar por ano/mês. Com isso
  deixou de precisar conhecer a forma do registro gravado.
- **As ações por linha seguem a origem**: uma linha herdada não tem "remover", porque não é um
  registro gravado — é o plano sendo lido. O que existe é *Ajustar*, *Sem meta neste mês* e,
  para o que já foi ajustado, *Voltar ao plano*.

### Security

- **Editar um plano em curso não reescreve o passado.** A edição encerra o plano corrente na
  competência anterior e abre um sucessor da competência atual em diante. Sem isso, mudar a meta
  em dezembro reavaliaria agosto, setembro e outubro contra um alvo que não valia quando o
  trabalho foi feito — e o cumprimento histórico mudaria sem que ninguém soubesse por quê.
- **Vigências sobrepostas são recusadas.** Com dois planos cobrindo o mesmo mês, a meta herdada
  dependeria de qual viesse primeiro no array. `assertPlanosConsistentes` é a rede, no padrão de
  `assertMetasConsistentes` e `assertRouteAccessIsConsistent`.

### Migration

- **Nenhuma.** As metas já gravadas continuam sendo linhas por (ano, mês) e passam a ser lidas
  como exceções. Sem plano cadastrado, a resolução devolve exatamente as exceções — comportamento
  idêntico ao anterior. Nem marcador de versão foi preciso.

### Corrigido na validação

> Três defeitos encontrados exercitando a tela com o plano real da operação, antes da publicação.

- **Vigência recusada fechava o editor e jogava fora o plano digitado.** A recusa por colisão
  acontece exatamente quando a gestora precisa da tela aberta para corrigir a data — e o modal
  fechava mesmo assim, obrigando a remontar as cinco linhas. `handleSalvarPlano` passa a devolver
  se gravou, e o editor fecha só quando gravou.
- **"Sem meta neste mês" estava atrás de um ícone de lixeira** com o título "Remover a meta desta
  competência". Quem procura como registrar férias não procura por uma lixeira, e quem clicava
  nela esperando apagar recebia um prompt perguntando o motivo do afastamento. Nas linhas herdadas
  o botão passa a se chamar **"Sem meta"**; a lixeira fica só onde de fato apaga algo — a remoção
  de um ajuste.
- **Competência crua na interface.** A faixa do plano dizia "vigência 2026-01 a 2026-12" e o aviso
  de sucessão, "as competências até 2026-08". Passam a usar `competenciaLabel`, como o resto do
  sistema desde a 0.22.0.

### Notas

- Painel, Relatórios, fila e `goalService` **não tiveram uma linha alterada**: recebem a lista
  resolvida, que tem a forma que já consumiam. Nenhum deles sabe que herança existe.
- A resolução acontece três vezes no App, uma por período — a carteira da monitora responde sobre
  o mês corrente enquanto Painel e Metas respondem sobre o que o gestor escolheu.
- O seed de planos é vazio: um plano descreve a operação de uma empresa, não a estrutura do
  sistema. Gravá-lo no código faria toda base nova nascer com metas que não são dela.

## [0.22.1] - 2026-09-10 — Fila de validação e competência do Painel

> Dois defeitos encontrados na primeira monitoria real da operação. Ambos nasceram na 0.22.0,
> e ambos vêm do mesmo engano: tratar a competência como se fosse sempre o mês corrente.

### Fixed

- **A fila de validação não mostrava monitorias de competências anteriores.** Ela filtrava pela
  competência corrente e a tela sempre passava o mês atual — então a MON-10001, um atendimento
  de 28/08 avaliado em setembro, ficou `Pendente` e **não apareceu em fila nenhuma**: nem em
  setembro, porque a competência era agosto, nem depois, porque agosto não volta a ser o mês
  corrente.

  O erro foi tratar a fila como recorte de período. Ela não é: é a lista do que está parado
  esperando alguém, e trabalho parado não deixa de existir porque o calendário virou — ainda
  mais nesta operação, que avalia o mês anterior, onde competência passada é a **regra**.

  A fila passa a listar todas as pendentes, de qualquer competência, e **cada linha mostra a
  sua** — a competência sai do filtro, não da tela. A carteira da monitora continua no mês
  corrente, que é o recorte certo para "o que preciso fazer agora".

- **O Painel mostrava números de setembro sob um cabeçalho que dizia agosto.** O seletor de
  competência da 0.22.0 movia o subtítulo e a meta por colaboradora, mas não os KPIs:
  `getMonitorStats` e `getUnmonitoredCollaborators` estavam fixos no mês corrente. Ambos passam
  a receber o período, e o Painel passa o seu.

- **O ritmo diário em competência encerrada exibia `0/dia`.** Não existem dias úteis restantes
  num mês fechado; a resposta certa é a ausência, não um zero que parece meta batida. Passa a
  mostrar `—` com a nota "Competência encerrada".

### Changed

- O título da tela no perfil GESTOR passou de "Monitorias · [mês]" para **"Validação"**, e o
  subtítulo de "O que precisa da sua validação neste mês" para "Tudo o que está aguardando a
  sua validação, de qualquer competência". O rótulo antigo prometia um recorte mensal que
  deixou de existir.
- `businessDaysRemaining` deixou de ser um valor único no App. Cada tela calcula o seu, a partir
  da competência que exibe — era esse valor compartilhado que fazia o Painel em agosto medir o
  ritmo de setembro.

## [0.22.0] - 2026-09-07 — Competência explícita e lançamento retroativo

> A operação trabalha por competência: monitorias de agosto são realizadas em setembro. O
> sistema já recortava tudo por mês, mas o eixo era `date` — um campo rotulado apenas "Data".
> Quem avaliava em setembro um atendimento de agosto precisava adivinhar qual das duas datas o
> campo queria, e a escolha errada movia a monitoria de competência em silêncio.

### Added

- **`Monitoring.competencia`** — o mês a que o trabalho pertence, `'YYYY-MM'`, declarado em campo
  próprio. Passa a ser o eixo de metas, fila e relatórios. String, e não `{year, month}`: é
  comparável direto, ordenável, e não atravessa fuso — `periodOf` precisa de tratamento especial
  para não devolver julho no dia 1º de agosto, e a competência não tem esse problema.
- **Campo Competência no formulário**, ao lado da data do atendimento. O padrão segue o **mês do
  atendimento** — atendimento de agosto conta em agosto, mesmo avaliado em setembro — e para de
  seguir assim que alguém o edita: ajustar o horário do atendimento não pode reescrever uma
  competência definida de propósito.
- **Seletor de competência em Metas, Painel e Relatórios.** Metas e Painel respondiam sempre
  sobre o mês corrente; Relatórios navegava só com setas, e chegar a janeiro a partir de setembro
  custava oito cliques. Agora há setas para o passo curto e campo de mês para o salto longo.
- **Cadastro de meta retroativa**, consequência direta do seletor em Metas. Sem meta na
  competência, o progresso daquele mês não tem denominador — é o que a reconstrução do histórico
  desde janeiro exige.
- **Lançamento retroativo** (`/monitorings/retroativa`), com permissão própria `LANCAR_RETROATIVO`
  para GESTOR e ADMIN. Mesmo formulário e mesma régua: todos os critérios continuam obrigatórios
  e a nota é calculada igual. O que muda é o status final e a marca de origem.
- **Coluna Competência no CSV.** O PDF já trazia a competência no cabeçalho.

### Changed

- **`date` deixou de decidir a competência** e passou a ser, apenas, a data do atendimento —
  rotulada assim na tela e na listagem.
- **Onze pontos de decisão** trocaram `isInPeriod(m.date, período)` por `naCompetencia(...)`:
  seis em `queueService`, dois em `goalService`, um em `App`, o filtro de Relatórios e a listagem.
  O de Relatórios simplificou bastante — o intervalo de datas com duas conversões para `Date` e
  comparação em UTC existia só para responder "esta monitoria é deste mês?", que agora o próprio
  registro responde.
- **A fila de Monitorias continua no mês corrente, de propósito.** Ela responde "o que eu preciso
  fazer agora"; navegar por competências ali transformaria a tela de trabalho em tela de consulta,
  que é o papel de Relatórios.

### Removed

- **O aviso de "mês divergente"** no formulário. Ele existia porque um único campo carregava duas
  informações; com dois campos nomeados, não há divergência a avisar.

### Security

- **Monitoria retroativa nasce `Validada` e recebe o selo "Retroativa"** na listagem e no detalhe.
  Nascer validada não é atalho de aprovação: a fila de validação é recortada pela competência
  corrente, então uma monitoria de janeiro registrada como `Pendente` não apareceria em fila
  nenhuma e ficaria aguardando validação para sempre. O selo garante que ela nunca seja
  confundida com uma que passou por validação real.

### Migration

- `pm2_monitorings_competencia_version` 0 → 1: `competencia = date.slice(0, 7)`. **Preserva
  exatamente o comportamento atual** — a competência já era o mês de `date`, deduzido a cada
  leitura, e nenhuma monitoria muda de mês. Marcador próprio, **nunca `DATABASE_VERSION`**.
- As metas não precisaram de migração: `year` e `month` já existiam no modelo desde a 2A.1.

## [0.21.0] - 2026-09-07 — Usabilidade da Administração

> A Administração "parecia sistema antigo" por um motivo literal: as classes `tab-row` e
> `tab-btn` eram usadas desde sempre e **não existiam em nenhum arquivo de estilo**. As abas
> eram botões nativos do navegador, com `border: outset 2px` — a borda 3D do Windows 95 —,
> fonte Arial 13px e 318px de altura empilhados antes de o conteúdo começar.

### Changed

- **As abas ganharam estilo** e a barra passou de 318px para 39px, com a fonte do produto.
- **Cada seção do menu mostra só as suas abas.** Até a 0.20.0 as três entradas — Critérios,
  Usuários e Acessos, Sistema — caíam no mesmo painel de oito abas: eram três portas para a
  mesma sala, e o agrupamento do menu não simplificava nada. Agora: **Critérios** é tela única
  (uma aba sozinha não oferece escolha, só ocupa altura), **Usuários e Acessos** tem três
  (Usuários · Perfis · Logs) e **Sistema** tem quatro (Áreas · Colaboradores · Fluxo · Marca).
- **"Marca" saiu de dentro de "Configurações do Fluxo"** e virou aba própria. Identidade visual
  e regra de validação não têm relação; juntas, obrigavam a percorrer o workflow para trocar
  uma cor.
- **A grade de Critérios foi refeita** para a metodologia atual. Saíram três colunas: a
  *Descrição* (truncada com reticências, ilegível — o texto segue no modal e no formulário,
  onde é lido), a *Nota Mínima Esperada* e a *Categoria*, que repetia o mesmo texto em até nove
  linhas seguidas e virou cabeçalho de grupo. Entraram **Tipo**, **Peso** e **Régua** — o que
  se administra desde a 3A.0. Os critérios passam a aparecer agrupados por bloco, na ordem da
  metodologia.
- **Canais viraram um resumo.** Os 29 critérios valem para os mesmos 6 canais: a coluna
  desenhava 174 selos idênticos para dizer "todos" 29 vezes. Agora só a exceção tem detalhe.
- **Peso 0 aparece como "não pontua"**, que é o que ele significa — critério de classificação,
  fora do denominador da nota — em vez de um número que sugeria um critério sem valor.
- **A tela de Perfis foi reescrita em linguagem de negócio.** Era uma lista de nomes técnicos
  em monospace (`VIEW_DASHBOARD`) que mandava "solicitar à equipe técnica a atualização do
  arquivo `auth.js`". Virou uma tabela perfil × acesso, derivada de `PERMISSIONS` — a mesma
  fonte que o RouteGuard consulta, de modo que o que a tela mostra é, por construção, o que o
  sistema faz.
- Nomenclaturas corrigidas: "Monitor Responsável" → **Monitores** (a área tem vários desde a
  0.16.0), "Gestor Responsável" → **Gestor**, "Workflow e Validações" → **Regras de Validação**,
  "White Label Brand Config" → **Identidade Visual**, e o rótulo da escala, que prometia
  *"Ótimo / Bom / Regular / Ruim"* enquanto o formulário mostra **Excelente / Parcial / Não
  realizou** — quatro níveis que não existem em lugar nenhum.

### Removed

- **`Criterion.minExpectedScore`**, do modelo, do seed, do formulário e dos registros gravados.
  Era um número na escala 0-10, aposentada pela 0.14.0, e **nunca participou de cálculo algum**:
  não entrava na nota, na régua, na validação nem na instrução do assistente. Nos 29 critérios
  assumia apenas dois valores (0 e 2), e o padrão de um critério novo era 7,5 — herança de uma
  escala que não existe. Ficava na tela sugerindo uma regra que o sistema não aplicava.
- **A aba "Usuários do Portal"**, que duplicava "Contas e Acessos" em pior estado: não editava,
  não bloqueava, e sua listagem mostrava **todo mundo como "Ativo"**, com o valor fixo no
  código, independentemente do status real. Sobrou uma tela só.
- **A coluna "IP (Simulado)" dos Logs** e a geração do valor. O endereço vinha de
  `Math.random()`: um IP inventado numa trilha de auditoria é pior que nenhum, porque dá
  aparência de rastreabilidade a algo que não rastreia.
- **O botão "Filtros Avançados" dos Logs**, que não tinha nenhum `onClick` no arquivo.

### Fixed

- **A tela de Perfis exibia onze permissões que não existem mais** — removidas na 0.19.0 —
  cada uma com ✗ vermelho, indistinguível de uma permissão negada. Ao mesmo tempo, quatro
  permissões reais não estavam em grupo nenhum e não apareciam. A tela afirmava, com confiança,
  coisas falsas sobre o sistema.
- **O campo Peso impedia o valor 0** (`min="0.1"`), que é justamente o que marca critério de
  classificação. Oito dos 29 critérios da régua não poderiam ser cadastrados pela própria tela.
- Um critério novo nascia com apenas dois canais (`Chat`, `WhatsApp`) enquanto toda a régua usa
  os seis; passa a nascer com todos.

### Migration

- `pm2_criteria_version` 3 → 4, removendo `minExpectedScore` dos critérios já gravados. Marcador
  próprio, **nunca `DATABASE_VERSION`**.

## [0.20.0] - 2026-09-04 — Perfis múltiplos e perfil ativo

> O sistema tinha um papel por pessoa. Quem administrava e monitorava só cabia nisso por meio
> de uma regra — `getMonitors()` incluía ADMIN — que resolvia o caso de uma pessoa e fazia
> *todo* administrador contar como monitor. Esta versão troca a regra por dado.

### Added

- **`User.perfis: Role[]`** — perfis concedidos, no plural. Uma pessoa pode administrar e
  monitorar sem precisar de duas contas. Substitui `role`, que é removido do modelo; `AnyRole`
  e o papel `COLABORADOR` somem junto: quem não acessa o portal tem `perfis: []`, e a lista
  vazia registra a ausência de acesso melhor do que um valor especial registrava.
- **`AuthSession.perfilAtivo`** — o perfil sob o qual a pessoa está trabalhando agora. Fica na
  sessão, não no usuário: guardá-lo no cadastro faria a escolha de contexto de uma pessoa mudar
  como todas as outras a enxergam nas listas. É revalidado a cada carregamento — um perfil
  revogado pelo Admin não continua ativo.
- **Troca de contexto na barra lateral**, só para quem tem mais de um perfil. Ao trocar, o
  sistema navega para a entrada daquele perfil: permanecer na rota atual terminaria em "acesso
  negado", que é o oposto do que a troca serve para fazer. O evento vai para o log de auditoria
  como `SWITCH_PROFILE` — com perfis acumulados, saber *quem* agiu deixou de bastar.
- **`domain/perfis.ts`** — precedência **MONITOR > GESTOR > ADMIN** para o perfil inicial (o
  trabalho diário primeiro), e a revalidação do perfil lembrado.
- **`domain/validacaoService.ts`** — concentra quem valida o quê e quando uma monitoria precisa
  de validação. Substitui `authorizationService.ts`, removido.
- **Cadastro de perfis múltiplos**, nos dois formulários de usuário, por caixas de seleção.

### Changed

- **Permissão estrita pelo perfil ativo.** `hasPermission` passou a receber o contexto atual, e
  a matriz foi refeita para que isso tenha efeito: até aqui o ADMIN aparecia em quase toda
  linha, e "estrito" não o restringiria em nada. Cada perfil recebe o que pertence ao seu
  contexto, e quem acumula alterna em vez de ver a união. Vale também para quem digita a URL
  na mão. **Relatórios e Painel permanecem com o ADMIN** — governança precisa de leitura, e é
  de dentro de Relatórios que sai o cancelamento de monitoria, permissão exclusiva dele.
- **O menu acompanha a matriz.** ADMIN: Critérios, Usuários e Acessos, Sistema, Painel,
  Relatórios. GESTOR: Validação, Relatórios, Painel da Equipe, Equipe e Carteiras, Metas.
  MONITOR: Monitorias, Meu Histórico. Um item que a permissão nega é um caminho para "acesso
  negado" — pior que a ausência do item.
- **O status inicial da monitoria passou a depender do fluxo, não de quem salva.** Havendo
  gestor para a área, vai para validação; não havendo, decide `requireGestorValidation`. Antes,
  o mesmo trabalho nascia `Pendente` ou `Validada` conforme o papel de quem clicasse em salvar.
- **A fila de monitorias segue o perfil ativo.** Quem administrava e monitorava caía sempre na
  fila de validação e nunca via a própria carteira — via a fila de validação de si mesma.
- **O botão "Nova Monitoria" saiu do perfil GESTOR**, alinhando a tela à decisão da 0.17.0 de
  que gestor valida e não avalia.

### Fixed

- **Usuários criados pela Administração não conseguiam entrar.** O login autenticava contra
  `HOMOLOG_USERS`, um array estático no código, enquanto o cadastro gravava em `pm2_users`. O
  usuário existia na lista e não existia para a autenticação. Login e sessão passam a resolver
  contra o repositório. Junto, o cadastro rápido passou a pedir senha — sem ela, a conta criada
  também não entrava.
- **Os seletores de monitora em Metas e Equipe e Carteiras estavam vazios**, o que tornava
  impossível vincular carteira ou definir meta por aquelas telas. Havia **quatro** respostas
  diferentes no sistema para "quem é monitor", e duas devolviam lista vazia. Todas passam a ser
  `perfis.includes('MONITOR')`. O defeito desaparece como consequência do modelo.

### Security

- **Ninguém valida a própria monitoria** — nem aprovar, nem devolver, nem confirmar
  eliminatório —, quaisquer que sejam seus perfis. A regra é de imparcialidade, não de
  hierarquia: acumular perfis não pode virar caminho para autoaprovação. A fila de validação
  exclui as próprias monitorias, e no painel de detalhe o motivo ocupa o lugar dos botões.

### Migration

- `pm2_users_perfis_version` — marcador próprio, **nunca `DATABASE_VERSION`**: converter um
  campo não pode apagar a configuração inteira. `role` vira `perfis`, e a conta que acumulava
  administração e monitoria recebe os dois perfis, preservando a carteira de quem já operava.

### Known issues

- Com `requireGestorValidation` ligado e nenhum gestor vinculado à área, as monitorias nascem
  pendentes sem ninguém que possa liberá-las. É a regra desenhada, e é deliberado que doa de
  forma visível: o formulário avisa antes de salvar e a Administração conta quantas estão
  paradas. Vincular um gestor à área resolve.

## [0.19.0] - 2026-09-01 — Navegação por perfil

> O sistema ficou funcionalmente completo antes de ficar navegável. Esta versão não adiciona
> capacidade: tira do caminho o que não era trabalho de ninguém.

### Removed

- **A tela de Início, nos três perfis.** Nenhuma das três dava informação que a tela de trabalho
  não desse melhor, e duas montavam cartões com números fixos no código. Todo perfil passa a
  entrar em `/monitorings`, que já se bifurca por papel — fila de validação para quem valida,
  carteira para quem monitora. `/home` continua resolvendo, agora como redirecionamento: quem
  tinha o endereço salvo recebe a tela de trabalho, não um erro.
- **Todo dado simulado da interface**, que era o motivo real de a Home existir:
  - os cartões de números fixos das Homes de gestão e de monitoria;
  - o **Histórico (Logs)** do painel de monitoria — dois eventos fabricados a cada abertura
    ("Monitoria criada", "Status alterado para X") carimbados com a data do registro, que não é
    a hora em que os eventos ocorreram. Uma trilha de auditoria inventada é pior que trilha
    nenhuma: ela responde com confiança a uma pergunta que o sistema ainda não sabe responder;
  - o sino de notificações do topo, com bolinha vermelha permanente e nenhuma notificação atrás.
- **CSAT e NPS saem do menu.** Mantêm rota, permissão e o texto que explica cada um — o rumo
  segue registrado. O menu é ferramenta de trabalho diário, não vitrine de roadmap.
- **Rotas `/users`, `/roles` e `/audit-logs`**, que duplicavam por URL abas já existentes dentro
  da Administração, e as rotas `/settings`, `/history`, `/op-calendar`, `/demands` e
  `/integrations`, que nunca tiveram tela. Junto foram as nove permissões que só elas usavam.

### Changed

- **O menu passa a ter três grupos**: **Operação** (o que se faz hoje), **Gestão** (o que se
  ajusta no mês) e **Configuração** (o que se mexe raramente). Numa lista plana, validar uma
  monitoria competia visualmente com cadastrar uma meta.
- **Cada perfil vê o seu menu**: ADMIN 9 itens, GESTOR 6, MONITOR 3. Os rótulos acompanham o
  papel — para a gestão, `monitorings` é "Validação"; para quem monitora, `reports` é "Meu
  Histórico".
- **A Administração deixa de ser uma rota só com a seção guardada em estado.** São três destinos
  no menu — Critérios de Avaliação, Usuários e Acessos, Sistema — em `/admin/criterios`,
  `/admin/acessos` e `/admin/sistema`. O endereço passa a dizer onde você está, e os Critérios,
  que a 3A.0 tornou cadastro frequente, saem de dentro de um submenu.

### Fixed

- **`/admin/<seção inexistente>` abria a Administração** em vez da tela de "página não
  encontrada", porque a rota caía num valor padrão. Um erro de digitação passava por tela
  legítima.
- **A tela de "página não encontrada" oferecia "Voltar para a Home"** — para uma Home que esta
  versão remove. Agora leva a Monitorias.

## [0.18.0] - 2026-08-25 — A régua validada entra no sistema

> A metodologia da 3A.0 deixou de ser documento e virou dado. É o que a 3A.1 vai ler.

### Added

- **`Criterion.ancoras`** — a régua de decisão, indexada pela resposta como ela é gravada:
  `'2' | '1' | '0'` na escala, `'2' | '1.33' | '0.67' | '0'` na faixa de tempo, o texto da opção
  na classificação. É o que separa *orientação* (prosa para quem lê) de *critério de decisão*, e
  é dela que o `instructionBuilder` monta a instrução sem interpretar texto livre.
- **`Criterion.quandoNA`** — decidir entre "1" e "N/A" é a escolha mais mecânica depois da nota,
  e é decisão que o assistente da 3A.2 vai tomar. Em prosa, obrigaria o agente a interpretar.
- **`SubPergunta.criterioSim` / `criterioNao`** — a régua dos checklists é por sub-pergunta; o
  valor agregado `(SIM ÷ total) × 2` não tem significado próprio.
- **`constants/regua.ts`** — a régua validada como dado. Alimenta o seed **e** a migração: os
  mesmos textos em dois lugares acabariam divergindo.
- **Critério 29 — `Cliente chegou autenticado?`** (Sim · Não · Não identificável), classificação
  de peso 0. Nasceu de um achado da validação: o critério 25 acionava eliminatório em atendimento
  correto, porque nada registrava que a autenticação já ocorrera antes da interação humana.
- **`domain/criterionGating.ts`** — primeira dependência entre critérios do sistema. Com o 29 em
  "Sim", o 25 vira N/A e o controle mostra o motivo no lugar dos botões.
- **Quatro campos narrativos em `Monitoring`**: `contexto`, `leituraTecnica`,
  `errosIdentificados` e `conclusao`, todos opcionais. Com `strengths` e `opportunities`,
  completam os seis blocos do `Padrão Relatório de Monitoria`.

### Changed

- **Etapa 4 do formulário reorganizada na ordem do relatório** — Contexto, Pontos Positivos,
  Pontos de Atenção, Leitura Técnica, Erros Identificados, Conclusão. *Erros Identificados* nasce
  recolhido: a régua manda preencher só quando houver, e um campo vazio em destaque convida a
  inventar conteúdo. `comments` sai dos blocos e vira **Observações internas** — é anotação da
  monitora, não conteúdo do relatório.
- **Detalhe da monitoria** mostra os seis blocos. Bloco vazio é dito, não escondido: registro
  anterior a esta versão não tem os campos novos, e omiti-los faria o relatório parecer completo.
- **Cadastro de critérios no Admin** ganhou editores para âncoras, opções com régua de
  classificação, sub-perguntas com SIM/NÃO, e "quando marcar N/A" — todos condicionais ao tipo de
  resposta. Sem isso, metade da régua só entraria por deploy.

### Fixed

- **Criar um critério pelo Admin perdia campos.** O caminho de criação montava o objeto listando
  campo a campo e descartava `opcoes`, `subPerguntas`, `ancoras` e `quandoNA` — um critério de
  classificação nascia sem opções, e a tela de monitoria não tinha o que mostrar. Os dois
  caminhos passaram a partir do estado inteiro.
- **A metodologia dizia "24 critérios ponderáveis". São 21** — 28 menos os 3 de classificação
  menos os 4 eliminatórios. Erro de contagem no documento; a soma dos pesos (27,0) sempre esteve
  correta, e nenhuma âncora, peso ou regra muda.

### Notas de operação

- **A régua validada vem semeada.** Foram 32 itens aprovados sem ajuste — redigitá-los no Admin
  seria retrabalho. A tela existe para a operação **manter** a régua daqui em diante, e a
  migração **só preenche o que estiver ausente**: nada aqui sobrescreve cadastro feito na tela.
- **Exceção declarada:** a `orientacao` dos critérios 14 e 27 é sobrescrita, porque o texto no
  `Padrão Relatório` era cópia errada do 13 e do 28. Corrigir valor sabidamente errado não é o
  mesmo que apagar cadastro.
- **Monitoria anterior a esta versão passa a ter um critério não respondido** — o 29 é ativo.
  Reabri-la exige respondê-lo antes de salvar.
- **A partir daqui `pm2_criteria` carrega a régua inteira e não tem cópia.** O backup de
  `docs/BACKUP-RESTAURACAO.md` passa a ser obrigatório antes de cada publicação.

## [0.17.0] - 2026-08-25 — Estrutura por perfil, não por pessoa

> A supervisora saiu da equipe. O que o desligamento revelou é que a estrutura não era dela —
> era ela: no dado, a mesma pessoa era gestora da área **e** monitora de quatro das cinco
> carteiras. Esta versão desfaz esse acoplamento.

### Removed

- **Todos os dados semeados que descreviam pessoas.** `INITIAL_ALLOCATIONS`,
  `INITIAL_ALLOCATION_HISTORY`, `INITIAL_MONITOR_GOALS`, `INITIAL_COLABORADOR_GOALS`,
  `INITIAL_HOLIDAYS`, `INITIAL_DEMANDS`, `INITIAL_ANNOUNCEMENTS` e `INITIAL_AGENDA` nascem
  vazios. Eram 40 registros de vínculos, metas, contestações, avisos e uma semana de agenda —
  todos apontando para um usuário que deixou de existir. Base vazia é um sistema pedindo
  configuração; base semeada com nomes é um sistema afirmando algo falso.
- Ids fixos de usuário no estado inicial de três formulários do Admin.
- Bloco de "Próximas Aprovações (Mock)" da Home do Gestor: JSX fixo, com nomes de pessoas reais
  e botões que não faziam nada. Um gestor novo via trabalho que não existe.

### Changed

- **`Area.monitorId` → `monitorIds: string[]`.** O singular limitava a área a um monitor, e o
  filtro do Dashboard chegava a colapsar a equipe inteira numa pessoa. O modal da área virou
  seleção múltipla.
- **`getMonitors()` deixou de incluir o GESTOR.** Ele valida e acompanha; não avalia. Estava na
  lista porque a mesma pessoa ocupava os dois papéis — a lista imitava a pessoa, não o papel. O
  **ADMIN** entra, porque acumula administração e operação numa conta só.
- **Escopo por gestor.** Novo `domain/scopeService.ts`: cada gestor enxerga apenas os monitores
  das áreas em que é o responsável; ADMIN vê tudo. Vale na fila de validação, no ritmo da
  equipe, no risco do mês e no dashboard. A fila de validação era global no período — com uma
  gestora só isso era simplificação, com várias é vazamento.
- Atalhos de login por perfil, não por nome.
- `DATABASE_VERSION: 10 → 11`.

### Fixed

- **"Inativo" não impedia o login.** Só `BLOCKED` era verificado, então desligar alguém pelo
  Admin não tirava o acesso dessa pessoa.

### Notas de operação

- **A base é apagada e recriada** na primeira abertura após esta versão. É deliberado, e é o
  motivo de a limpeza ser agora: não há monitoria operacional nem cadastro da 3A.0 a preservar.
  Depois que as orientações e âncoras entrarem em `pm2_criteria`, `DATABASE_VERSION` volta a ser
  proibida — ver `docs/BACKUP-RESTAURACAO.md`.
- **O sistema sobe sem carteiras, sem metas e sem área configurada.** É o estado correto: o
  Admin cadastra gestores e monitores, compõe a área e distribui as carteiras.
- O modelo de permissões **não mudou** — já era RBAC (`Record<Permission, Role[]>`), sem
  nenhum id de usuário. Não havia nenhuma regra do tipo "se usuário = fulano" no código; o
  acoplamento estava todo nos dados.

## [0.16.0] - 2026-08-25 — FORMAS DO CONTATO volta a ser classificação

> O motivo do contato aparecia como 2 / 1 / 0 / N-A, como se fosse nota. Não era: os três itens
> do bloco são classificadores de peso 0.

### Fixed

- **`MULTIPLA_ESCOLHA` ganhou renderização própria.** O formulário decide o widget em cascata —
  eliminatório, depois checklist, depois um fallback — e a classificação caía no fallback, que é
  a escala pontuável. O motivo do contato passa a listar **Informação · Solicitação · Reclamação
  · Sugestão**, e o ativo/receptivo, **Ativo · Receptivo**.
- **Justificativa deixou de ser exigida em classificação.** O campo aparecia sempre que a
  resposta não fosse "2" — então classificar um contato como Reclamação obrigava a monitora a
  escrever uma justificativa para avançar.
- **Rascunho reaberto acusava eliminatório que ninguém marcou.** O salvamento gravava
  `score || 0`, então critério não respondido virava `0` — e `0`, num eliminatório, significa
  "Sim, ocorreu". Ao reabrir o rascunho o formulário lia esse zero como marcação da monitora, e
  o salvamento seguinte ligava `eliminatoryPending`: a monitoria passava a acusar, por exemplo,
  "Faltou com respeito ao cliente", e ia para a gestora confirmar o zeramento. Salvar rascunho
  antes de responder os eliminatórios é uso normal, então o caminho era alcançável.

  Corrigido em quatro pontos, porque o zero entrava por mais de uma porta: a gravação passa a
  usar `?? ''` e preserva "não respondido"; a tela de detalhe compara `score === 0` em vez de
  `Number(score) === 0`, já que `Number('')` também é zero; a migração legada de 0-10 para 0-100
  só transforma valores que são números; e o detalhe passa a exibir "não respondido" em vez de
  uma célula vazia. **Eliminatório agora só é sinalizado por marcação explícita.**

### Added

- `Criterion.opcoes?: string[]` — antes as opções só existiam em prosa, dentro do texto de
  `orientacao`, e não havia de onde a tela lê-las. É essa ausência que causava o defeito acima.
- Loader `migrateCriterios`, com marcador `pm2_criteria_version`, para alcançar os critérios já
  gravados no navegador. **Só toca os três de classificação, e só em `opcoes` e `active`** —
  orientação, peso, canais e qualquer edição feita pelo Admin ficam intactas, porque é ali que o
  cadastro da 3A.0 vai morar.

### Changed

- **Critério 3 (canal) fica inativo.** O Canal já é campo obrigatório da etapa 1 — e é ele que
  decide quais critérios aparecem na etapa 3, via `channels.includes(canal)`. Perguntá-lo de
  novo dentro da lista que ele mesmo filtrou era redundância. O critério permanece cadastrado,
  com as opções: reativá-lo é uma decisão de uma tela só, no Admin.
- `MonitoringScore.score` passa a aceitar texto, para guardar a opção escolhida. Não afeta a
  nota: os três classificadores têm peso 0 e a aritmética do cálculo está toda dentro de
  `if (weight > 0)`.
- A exigência de justificativa em `validateStep3` ganhou guarda explícita por tipo. Sem ela a
  expressão ainda funcionaria — `'Reclamação' < 2` é falso — mas por comparação com `NaN`, não
  por regra.

### Notas de operação

- **Monitorias já gravadas não foram alteradas.** As que têm 2/1/0 nesses três critérios
  continuam exatamente como estão; a correção vale daqui para frente. O mesmo para rascunhos
  gravados antes desta versão com `0` em eliminatório não respondido: o valor permanece, e
  reabri-los ainda mostrará o eliminatório como marcado. São registros de teste, e reescrevê-los
  seria inventar a resposta que a monitora não deu.
- Um critério `MULTIPLA_ESCOLHA` criado pelo Admin nasce sem opções, porque a tela de critérios
  ainda não tem campo para elas. Nesse caso o formulário diz o que houve e aponta a saída
  possível — desativar o critério — em vez de mostrar um controle vazio.

## [0.15.0] - 2026-08-25 — Protocolo gerado e identificadores sem sorteio

> A monitora informa o que ela sabe — atendimento e título. O que identifica a monitoria, o
> sistema gera.

### Added

- `domain/identificadores.ts` — `gerarProtocolo` e `gerarIdMonitoria`. Ambos derivam do maior
  valor já existente e **conferem contra a base** antes de devolver.
- **Protocolo gerado**, no formato `MON-2026-0001`. Sequência por ano, tirada do ano da
  monitoria (`date`) e não do momento da geração: uma monitoria de 2025 avaliada em 2026 entra
  na sequência de 2025.

### Changed

- **O Nº do Protocolo deixou de ser digitado.** Sai da lista de obrigatórios e vira campo
  derivado, exibido como *"Gerado automaticamente ao salvar"* enquanto não existe. Obrigatórios
  na criação passam a ser apenas **Nº do Atendimento** e **Nº do Título**.
- Gerado **no primeiro salvamento**, inclusive de rascunho, e **nunca reescrito** depois —
  rascunho abandonado não queima número, e reabrir uma monitoria não troca seu protocolo.
- O protocolo passa a aparecer no alerta de confirmação, acima do código interno: é ele o número
  que a operação usa para se referir à monitoria.

### Fixed

- **O código interno da monitoria podia sobrescrever um registro existente.** Ele era
  `MON-${Math.random()*90000+10000}`, sem verificação de unicidade, e o salvamento decide entre
  criar e atualizar comparando o id com os existentes — então um sorteio repetido fazia uma
  monitoria nova ser gravada **por cima** de outra, sem erro e sem aviso. Com 90.000 valores, a
  chance de ao menos uma colisão passava de 20% em 200 registros e de 50% em 350. Agora o id é
  sucessor do maior existente, com laço de verificação contra a base.

### Notas de operação

- **Protocolos anteriores permanecem como estão.** Os registros gravados até aqui têm protocolo
  digitado à mão, em formato livre; eles continuam legíveis e pesquisáveis, e não entram na
  sequência nova. Não foram migrados por serem registros de teste — reescrevê-los inventaria
  dado que ninguém informou.
- O `protocolo` mudou de significado: era referência ao atendimento no sistema de origem, virou
  identidade da monitoria. Quem faz a ligação com o atendimento agora são `numeroAtendimento` e
  `numeroTitulo`, desde a 0.14.0. `docs/VISAO-PRODUTO.md` foi atualizado.
- A sequência é por navegador, como todo o resto da persistência. Se a operação passar a
  registrar em mais de uma máquina, duas monitorias podem receber o mesmo protocolo — a mesma
  limitação que já vale para a base inteira.

## [0.14.0] - 2026-08-25 — Identificadores do atendimento e duração calculada

> Três mudanças na tela de Nova Monitoria, todas sobre **o que identifica um atendimento** e
> **quanto tempo ele durou**. Nenhuma delas reescreve registro antigo.

### Added

- **Três identificadores do atendimento**, obrigatórios: `numeroAtendimento`, `protocolo` (que
  já existia) e `numeroTitulo`. São chaves distintas na operação, e os três entram na busca do
  Histórico (`historyFilter`) e da Fila (`queueService`).
- **Janela do atendimento**: `inicioAtendimento` e `fimAtendimento` como `datetime-local`, com
  `duracaoMinutos` derivado e **não editável**. Data completa, e não só hora, porque atendimento
  de WhatsApp atravessa o dia.
- `domain/duracao.ts` — `calcularDuracao`, `formatarDuracao` e `exibirDuracao`, fonte única do
  cálculo e da apresentação. Duração zero é válida ("menos de 1 minuto"): um atendimento pode
  durar menos de um minuto, e tratá-lo como erro obrigaria a monitora a mentir no registro.
- **Bloco "Identificação do Atendimento"** na tela de detalhe — os três números, a janela, a
  duração, a categoria e o tipo. Corresponde ao bloco `🔎 Identificação` do Padrão Relatório de
  Monitoria, que até aqui não existia em tela nenhuma.
- **Aviso de competência divergente** no formulário: quando o atendimento é de um mês diferente
  da Data da monitoria, a tela avisa. Não corrige — `date` continua sendo o eixo de competência
  de metas, fila e relatórios, e derivá-lo do atendimento moveria monitorias entre competências
  e reescreveria metas já batidas.
- O CSV de Relatórios passou a levar os três identificadores, a categoria, início, encerramento
  e duração. Até aqui exportava a monitoria sem nenhuma chave que a ligasse ao atendimento.

### Changed

- **Catálogo de categorias: 6 → 27**, adotando o vocabulário da operação. `Renegociação` passa a
  `NEGOCIAÇÃO DE DÍVIDA`; `2ª Via de Boleto` passa a `BOLETOS`. `Dúvida`, `Solicitação`,
  `Reclamação` e `Elogio` deixam de ser categoria: são **motivo do contato**, que o critério 1 da
  monitoria já classifica — manter os dois eixos no mesmo campo era duplicação.
- A migração é um `loader` no `catalogCategoriasRepository`, com marcador próprio
  (`pm2_catalog_categorias_version`). Escreve exatamente duas chaves e **não toca
  `DATABASE_VERSION`**, que apagaria monitorias, metas, vínculos e critérios junto. Preserva
  categoria criada à mão pela operação.

### Removed

- **Campo Empreendimento** sai da tela de Nova Monitoria. O valor gravado em monitorias
  anteriores é preservado, e o repositório continua existindo, dormente.

### Notas de operação

- **`EMPREENDIMENTO` continua existindo — como categoria de atendimento.** Não confundir com o
  campo Empreendimento, que saiu nesta versão. O campo dizia de qual loteamento era o cliente; a
  categoria diz que o assunto do atendimento foi o empreendimento. São coisas diferentes.
- **Monitoria anterior à 0.14.0 abre normalmente**, com a categoria antiga preservada mesmo fora
  do catálogo novo e o tempo legado exibido como estava. Ao **salvar**, os campos novos passam a
  ser exigidos — sem exceção e sem validação condicional. A alternativa (opcionais para registro
  antigo) foi descartada: só havia registros de teste a proteger, e o ramo seria bifurcação
  permanente na parte mais sensível do formulário.
- `REGISTRO (I)` ficou **fora** da lista até a operação definir o que o distingue de `REGISTRO`.
  Incluir depois é adição pura; remover uma categoria já usada deixaria valor órfão. Enquanto
  isso, o formulário permite criar categoria na hora e a migração a preserva.

## [0.13.0] - 2026-08-22 — A meta vira agenda

> A fila mostrava o contador. Agora mostra **o que compõe o contador**.
>
> Mudança de modelo mental: uma meta de 5 não é um número que sobe — são **cinco vagas**, cada
> uma preenchida ou aberta. É a diferença entre um contador de metas e uma agenda de trabalho.

### Added
- **Linha expansível por colaboradora.** Ao abrir, a agenda do mês daquela pessoa: a meta como
  vagas numeradas, cada vaga preenchida mostrando código, data e estado, e cada vaga aberta com
  seu próprio botão **Monitorar**.
- **Um bloco por canal** para quem tem meta por canal. Nathalia e Allanis veem WhatsApp e
  Ligação separados, cada um com suas cinco vagas. Quem tem meta geral vê um bloco só, com o
  canal informado em cada vaga preenchida — ali o canal é informação, não critério.
- **O botão da vaga leva o canal do bloco.** Clicar na vaga 1 do bloco Ligação abre o
  formulário já com a colaboradora e o canal certos — e, como os critérios são filtrados por
  canal, com o checklist certo.
- **Excedente aparece** quando alguém entrega além do alvo: não ocupa uma sexta vaga numa meta
  de cinco, mas também não some da tela.

### Changed
- **Devolvida, rascunho e reprovada não ocupam vaga.** Aparecem logo abaixo do bloco,
  explicando por que a vaga está aberta. A monitoria reprovada diz literalmente *"não conta, a
  vaga segue aberta"* — a regra de que reprovação reabre a lacuna deixou de ser só cálculo e
  passou a ser texto na tela.
- **Monitorias em validação são visíveis na agenda**, na vaga que ocupam, marcadas como *Em
  validação*. Contam para a meta (feito conta no envio) e continuam distinguíveis do que já foi
  validado.

### Notas
- O vocabulário permanece **Validada** e **Em validação**. O sistema já exibe *Validada* em
  todos os badges; um terceiro termo para o mesmo estado faria a mesma monitoria ler diferente
  na fila e em Relatórios.
- `DATABASE_VERSION` permanece em 10. Nenhuma mudança de formato de dado.

## [0.12.0] - 2026-08-22 — Fila operacional de Monitorias (Fatia 2B)

> Monitorias deixou de ser uma central de busca e virou a **agenda de trabalho do mês**.
> Relatórios virou a consulta e o histórico. A pergunta da tela mudou de "quais monitorias
> existem" para **"o que eu preciso fazer agora"**.
>
> Nenhuma capacidade foi perdida na mudança: o que saiu de Monitorias chegou em Relatórios.

### Added
- **Fila da Monitora.** Ao abrir Monitorias, a tela mostra a meta do mês, o progresso, quem
  falta monitorar e **de qual canal**, o que voltou para correção e o que aguarda validação.
  Sem filtros: a ordem das linhas já é a resposta — quem tem zero primeiro, depois a maior
  lacuna, depois quem está há mais tempo sem avaliação.
- **O botão nomeia o canal.** Com meta por canal, a unidade de trabalho é o par
  (colaboradora, canal): Allanis com WhatsApp 1/5 e Ligação 4/5 recebe **"Monitorar
  WhatsApp"**. Clicar abre o formulário já com a colaboradora e o canal preenchidos — e como
  os critérios são filtrados por canal, o checklist certo já vem junto.
- **Fila da Gestora**, na mesma rota. Fila de validação ordenada por antiguidade, com
  **Validar na própria linha**; ritmo da equipe pelo ritmo necessário, não pela lacuna
  absoluta; e risco do mês separando "tem meta e nenhuma monitoria" de "não tem carteira".
  Administradora vê a mesma fila.
- **Monitoria com critério eliminatório sinalizado não oferece "Validar"**, só *Analisar*:
  zerar a nota é decisão da gestora e não pode sair de um clique de rotina numa fila.
- **Busca por protocolo na fila**, discreta. O protocolo é a chave que liga a monitoria ao
  atendimento — e adiante ao CSAT e ao NPS. Ela restringe as listas de registros, nunca a
  lista de quem falta monitorar.
- Dois módulos de domínio: `queueService`, que compõe os quatro serviços da 2A sem regra
  própria, e `historyFilter`, o predicado único do histórico.

### Changed
- **A Central de Monitorias mudou de endereço.** A tabela de oito colunas, a busca, os cinco
  filtros e as ações agora vivem em **Relatórios**, que passou a se chamar *Relatórios e
  Histórico de Qualidade*. O componente não foi reescrito — reescrever custaria os detalhes já
  corretos: os badges de Zerada e Eliminatório Pendente, o conceito abaixo da nota, o N/A para
  rascunho.
- **Um conjunto único de registros alimenta a tabela, o CSV e o PDF.** O que aparece na tela é
  exatamente o que será exportado, com os filtros aplicados.
- Relatórios distingue duas ausências que pareciam uma: competência sem registro esconde a
  tabela; filtro que não achou nada **não** esconde — sem os controles, o usuário não consegue
  desfazer o próprio filtro.

### Fixed
- **Bug de fuso horário publicado na 0.10.0.** `new Date('2026-08-01')` é interpretado como
  meia-noite UTC, que em Brasília é 31 de julho às 21h. `periodOf('2026-08-01')` devolvia
  **julho**, e os dias úteis restantes zeravam **no dia 1º de cada mês** — o que faria o ritmo
  diário dividir a meta inteira por 1. As monitorias escapavam por acaso, gravadas com
  `T12:00:00Z`; as datas puras, não.
- **A ação de excluir aparecia para os três papéis**, mas `DELETE_MONITORING` é `['ADMIN']`.
  O botão nunca foi barrado. Ao migrar para Relatórios, ganhou o gate que já deveria ter.

### Notas
- A fila responde **sempre sobre o mês corrente**, sem seletor. Consultar meses anteriores é
  papel de Relatórios.
- **Melhoria futura registrada:** o registro não guarda a data de *envio*, só a do
  atendimento, então "na fila há N dias" conta a partir do atendimento. Um campo
  `submittedAt` opcional resolve, sem migração. Marcado no código como `referenciaExata`.
- `DATABASE_VERSION` permanece em 10. Nenhuma mudança de formato de dado.

## [0.11.0] - 2026-08-22 — Metas por canal (Fatia 2A.6)

> Algumas colaboradoras precisam de meta por canal — 5 de WhatsApp e 5 de Ligação —, e outras
> de uma meta geral que qualquer canal atende. Esta versão traz o modelo, a aritmética correta
> e a tela para cadastrar as duas formas.
>
> A consequência menos óbvia é aritmética: **excedente num canal não cobre déficit em outro**.
> Meta 5+5 com 6 de WhatsApp e 0 de Ligação não é 6/10 — é cobertura 5, faltam 5.

### Added
- **Escopo de meta.** `ColaboradorGoal` ganhou `canal?`: ausente significa meta geral, presente
  significa meta daquele canal. O campo é opcional de propósito — todo registro anterior é, por
  definição, uma meta geral. Sem migração, sem reescrita de dado.
- **Seletor de escopo no Planejamento**, com "Meta geral (qualquer canal atende)" ou
  "Somente <canal>".
- **Exclusão de meta**, que não existia: o formulário só criava e atualizava. Sem ela, trocar
  uma colaboradora de meta geral para meta por canal era impossível pela tela — ela ficaria com
  as duas, exatamente o estado que a regra proíbe.
- **Quadro de metas agrupado por colaboradora**, com a forma da meta e o total na linha da
  pessoa e um escopo por linha abaixo.
- `assertMetasConsistentes`, ligado à tela: estado proibido que entre por outro caminho passa a
  ser exibido em vez de calculado em silêncio.

### Changed
- **"Ligação" passa a ser o único termo visível.** A operação fala ligação; o dado continua
  gravando `Telefone`, e migrar todas as monitorias já registradas seria risco sem retorno. O
  canal era renderizado em **nove pontos**, cada um com seu próprio texto — formulário, filtro,
  tabela, detalhe, Home, Dashboard, modal de critérios, CSV e PDF. Trocar só o formulário
  deixaria a tela dizendo "Ligação" e o relatório enviado por e-mail dizendo "Telefone". Agora
  há um vocabulário único em `constants/canais.ts`, e as exportações também dizem Ligação.
- **`completed` virou dois números.** `entregues` é o que a pessoa fez, sem teto; `cobertura` é
  quanto disso fecha meta, com teto por escopo. `remaining` passou a ser a soma dos déficits por
  escopo, nunca `target − entregues`. Os dois existem juntos para que trabalho acima da quota
  continue visível em vez de sumir da tela.
- **`MetaColaboradora`** é uma união discriminada — `nenhuma | geral | por-canal` — na qual
  "geral + por canal" é irrepresentável: a exclusividade deixou de depender de disciplina e
  passou a depender do compilador.
- `constants/criteria.ts` deixou de manter sua própria lista de canais. Efeito cosmético: a
  ordem dos canais no modal de critérios mudou.

### Fixed
- **Salvar a meta de um canal sobrescrevia a de outro.** A busca por meta existente ignorava o
  escopo, comparando apenas monitor, colaboradora e período — cadastrar 5 de WhatsApp e 5 de
  Ligação era impossível, porque a segunda apagava a primeira.
- **Meta geral e meta por canal podiam coexistir**, sem resposta definida para qual prevalece.
  Agora há bloqueio na tela, com explicação do caminho, e recusa no handler para o caso de o
  envio ser forçado por outro caminho.
- O Dashboard exibia "5 (6 validadas)" — mais validadas do que realizadas —, porque as
  validadas contavam sem teto e a cobertura tem teto.

### Notas de operação
- **As metas de agosto devem ser cadastradas no formato definitivo:** Nathalia e Allanis com
  5 de WhatsApp e 5 de Ligação cada; Susana e Ana Carla com meta geral de 5. Total da
  carteira: **30**.
- `DATABASE_VERSION` permanece em 10. Metas já gravadas continuam válidas como metas gerais.

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
