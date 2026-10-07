# Evolução do MonitorIA

> **Documento executivo.** A história do projeto, as decisões que o moldaram e o estado em que
> ele se encontra.
>
> **Data de referência:** 15/09/2026.
> **Em produção:** versão **0.24.0** — commit `568320c`, tag `v0.24.0`.
> **Em branch, aguardando validação:** versão **0.25.0** — commit `dbc5188`. **Não publicada.**
>
> **Fontes:** `CHANGELOG.md`, tags do repositório, documentos de `docs/` e o código da `main`.
> Onde este documento afirma que algo funciona, isso foi conferido no código — não na memória
> de quem construiu. Onde algo foi decidido e não implementado, está dito.

---

# 1. Visão Geral do Projeto

## O objetivo original

O MonitorIA nasceu como **ferramenta de registro da monitoria de qualidade** da área de
Relacionamento da Moura Leite Loteamentos. O primeiro commit é de **26/06/2026**; a versão
0.1.0, de 01/07/2026.

A proposta inicial era modesta e precisa: tirar a monitoria do preenchimento manual no CYF e
levá-la para uma plataforma própria, com formulário guiado, cálculo de nota e validação da
gestão. No documento de operação de agosto isso ficou registrado com clareza — *a mudança é de
ferramenta de registro, não de método de avaliação*.

## O contexto da operação

| | |
|---|---|
| **Área** | Relacionamento — atendimento a clientes de loteamentos |
| **Canais** | WhatsApp, Ligação, Teams, Presencial, E-mail e Chat |
| **Quem é avaliado** | cinco colaboradoras da carteira de Relacionamento |
| **Quem avalia** | a Monitora da Qualidade |
| **Quem valida** | a gestora da área |
| **Tipos de atendimento** | 27 categorias — Boletos, Negociação de Dívida, Antecipação de Pagamentos, entre outras |
| **Calendário** | por competência: a monitoria de agosto é realizada em setembro |

## Os problemas que motivaram a plataforma

O que existia antes não era a ausência de método — era um método espalhado em lugares que não
conversavam entre si:

- **A régua vivia em documentos.** Um PDF do CYF com a estrutura dos critérios e um `Padrão
  Relatório de Monitoria` em Word com as orientações. Os dois divergiam: o PDF documentava uma
  escala de quatro níveis, a prática usava três, e as orientações de dois critérios eram cópias
  erradas de outros.
- **Não havia controle de validação** no preenchimento manual. A aprovação da gestora foi
  mantida ligada desde o primeiro dia justamente por ser *o controle que o CYF não oferece*.
- **A monitoria não se ligava a nada.** Não havia como responder "quais monitorias
  correspondem a este atendimento" ou "a este cliente".
- **A meta de monitorias era um número a acompanhar de cabeça**, sem uma agenda que dissesse
  quem ainda precisava ser monitorada.

## A evolução da visão

A visão mudou três vezes, e cada mudança foi registrada antes de virar código.

**Julho — ferramenta de registro.** Formulário em cinco etapas, critérios, nota, aprovação.

**21/08/2026 — plataforma de qualidade** (versão 0.9.0). O NPS foi reclassificado: deixou de
ser indicador e passou a ser **processo operacional** — o cliente responde, a Qualidade recebe o
caso, analisa histórico e monitorias, refaz monitoria quando necessário, contata o cliente,
registra a tratativa e acompanha. Junto veio a direção de longo prazo de ter **o cliente como
entidade central**: monitorias, CSAT, NPS e tratativas convergindo para o histórico de uma
pessoa, e não de um atendente.

**07/09/2026 — plataforma de desenvolvimento.** Este é o momento em que o MonitorIA deixa de
ser apenas uma ferramenta de monitoria e passa a caminhar para um **Portal de Qualidade e
Desenvolvimento**. A decisão, registrada em `docs/VISAO-PRODUTO.md`, é que a monitoria deixa de
terminar na nota e passa a ser **matéria-prima do desenvolvimento de quem atende**: histórico de
notas por colaboradora, acompanhamento de evolução, focos de desenvolvimento, feedbacks
recorrentes, visualização para o próprio atendente e substituição do PDI hoje conduzido fora da
plataforma.

Duas condições acompanharam essa decisão, e são elas que explicam a ordem das versões seguintes:

1. **Nada do eixo de desenvolvimento é construído antes da operação real rodar.**
   Acompanhamento de evolução sem histórico de notas reais é gráfico de dado inventado — e este
   projeto já removeu esse tipo de tela mais de uma vez.
2. **A mudança de público é estrutural.** Hoje a colaboradora avaliada é *objeto* de avaliação
   e não acessa o sistema. Dar-lhe visão da própria evolução mexe no modelo de usuários, nas
   permissões e no escopo de leitura. É a primeira decisão que o documento conceitual do módulo
   terá de resolver.

A virada de visão só foi possível porque a versão 0.18.0, dez dias antes, havia transformado a
monitoria de uma lista de notas num **relatório em seis blocos** — que é o documento que uma
colaboradora pode ler.

---

# 2. Linha do Tempo das Versões

## Antes da 0.18.0 — a fundação

As versões anteriores construíram o que as seguintes usam. Resumo, para que a linha do tempo
tenha começo:

| Versão | Data | O que estabeleceu |
|---|---|---|
| 0.1 a 0.7 | 01/07 a 13/07 | Redesenho visual, autenticação, perfis, formulário em cinco etapas, escala 0/1/2/N/A, catálogos editáveis |
| **0.8.0** | **19/08** | **Sprint 0 — fundamentos.** 15 histórias em 37 dias. Os 28 critérios oficiais do CYF, cálculo ponderado, eliminatório com confirmação humana, camada de repositório, rotas reais, controle de acesso e TypeScript. Corrigiu o **salvamento de monitorias, que estava 100% bloqueado** |
| 0.8.1 | 20/08 | Véspera do piloto. A tela inicial exibia seis blocos de dados que não vinham de lugar nenhum — afirmava "Nota Média 0,00% · Crítico" numa base vazia. Foram removidos |
| 0.9.0 | 21/08 | Navegação pelos pilares da Qualidade; NPS como processo; o cliente como direção |
| 0.10.0 | 22/08 | **O sistema estava preso em junho de 2026 por seis caminhos independentes.** Metas eram gravadas sempre em junho; relatórios exportavam só junho. Nascem os módulos de domínio |
| 0.11.0 | 22/08 | Metas por canal — excedente num canal não cobre déficit em outro |
| 0.12.0 | 22/08 | Monitorias vira **agenda de trabalho**; a consulta e o histórico vão para Relatórios |
| 0.13.0 | 22/08 | A meta vira vagas: uma meta de 5 são cinco vagas, preenchidas ou abertas |
| 0.14.0 | 25/08 | Identificadores do atendimento (nº do atendimento, nº do título), 27 categorias, duração calculada |
| 0.15.0 | 25/08 | Protocolo gerado pelo sistema. Corrigiu um defeito grave: o código interno era sorteado e **podia gravar uma monitoria por cima de outra**, com mais de 20% de chance de colisão em 200 registros |
| 0.16.0 | 25/08 | Classificação deixa de parecer nota; eliminatório deixa de ser acusado sem que ninguém o marque |
| 0.17.0 | 25/08 | **Estrutura por perfil, não por pessoa.** A saída da supervisora revelou que a estrutura da área estava presa a ela nos dados |

## 0.18.0 — A régua validada entra no sistema

**Data:** 25/08/2026 · commit `37b345a` *(a tag aponta um commit de 31/08)*

**Objetivo.** Transformar a metodologia, validada em 25/08 com 32 itens revisados e 32 aprovados
sem ajuste, de documento em **dado**.

**Problemas resolvidos**
- A régua existia só em prosa. A orientação gravada no sistema era um resumo de uma linha, muito
  abaixo do documento oficial.
- **O critério 25 acionava eliminatório em atendimento correto.** No WhatsApp o cliente já chega
  autenticado pelo fluxo automático, a atendente corretamente não pede CPF — e o sistema acusava
  "confirmação de dados de segurança insuficiente".
- Criar um critério pela Administração descartava opções, sub-perguntas e âncoras.
- A metodologia dizia "24 critérios ponderáveis". São 21.

**Principais entregas**
- **Âncoras por nível** em cada critério — o que caracteriza 2, 1 e 0.
- **Regra de N/A por critério** — quando o critério não se aplica.
- **Régua por sub-pergunta** nos checklists.
- **Critério 29 — "Cliente chegou autenticado?"**, e a primeira dependência entre critérios do
  sistema: com o 29 em "Sim", o 25 vira N/A automaticamente e a tela mostra o motivo.
- **Relatório em seis blocos**: Contexto, Pontos Positivos, Pontos de Atenção, Leitura Técnica,
  Erros Identificados e Conclusão.
- Editores completos de régua na Administração.

| Perfil | Impacto |
|---|---|
| **ADMIN** | Passa a manter a régua pela tela — âncoras, opções, sub-perguntas e regras de N/A — sem depender de publicação |
| **GESTOR** | Lê a monitoria como relatório estruturado; deixa de receber falsos eliminatórios do critério 25 para confirmar |
| **MONITOR** | Avalia com a âncora de cada nível à vista; escreve o relatório na ordem em que a colaboradora vai lê-lo |

> **Decisão operacional:** a partir daqui a régua vive no navegador e não tem cópia. O backup
> manual passou a ser obrigatório antes de cada publicação.

## 0.19.0 — Navegação por perfil

**Data:** 01/09/2026 · commit `eac56fb`

**Objetivo.** O sistema ficou funcionalmente completo antes de ficar navegável. Esta versão não
adiciona capacidade: tira do caminho o que não era trabalho de ninguém.

**Problemas resolvidos**
- **Três telas iniciais com números fixos no código**, que nada ensinavam além do que a tela de
  trabalho já mostrava.
- **Um histórico de auditoria fabricado** — dois eventos inventados a cada abertura de monitoria.
- Um sino de notificações com alerta permanente e nenhuma notificação.
- Oito rotas duplicadas ou sem tela, e nove permissões que só elas usavam.

**Principais entregas**
- Fim das telas iniciais: cada perfil entra direto onde trabalha.
- **Remoção de todo dado simulado da interface.**
- Menu em três grupos: **Operação** (o que se faz hoje), **Gestão** (o que se ajusta no mês),
  **Configuração** (o que se mexe raramente).
- Rótulos por papel: a mesma tela é "Validação" para a gestão e "Monitorias" para quem monitora.

| Perfil | Impacto |
|---|---|
| **ADMIN** | Administração dividida em três destinos com endereço próprio — Critérios, Usuários e Acessos, Sistema |
| **GESTOR** | Entra direto na fila de validação; menu de 6 itens |
| **MONITOR** | Entra direto na carteira; menu de 3 itens, com "Meu Histórico" |

## 0.20.0 — Perfis múltiplos e perfil ativo

**Data:** 04/09/2026 · commit `010149a`

**Objetivo.** O sistema tinha um papel por pessoa. Quem administrava e também monitorava só
cabia nisso por meio de uma regra — e a regra fazia *todo* administrador contar como monitor.
A versão troca a regra por dado.

**Problemas resolvidos**
- **Usuários criados pela Administração não conseguiam entrar.** O login autenticava contra uma
  lista fixa no código; o cadastro gravava em outro lugar. Isso impedia, na prática, cadastrar
  qualquer gestor ou monitor novo.
- **Os seletores de monitora em Metas e em Equipe estavam vazios** — havia quatro respostas
  diferentes no sistema para "quem é monitor", e duas devolviam lista vazia.
- Quem administrava e monitorava via, na tela de trabalho, a fila de validação *de si mesma*.
- O status inicial da monitoria dependia de quem clicava em salvar, e não do fluxo.

**Principais entregas**
- **Perfis múltiplos por pessoa** e **perfil ativo por sessão**, com troca de contexto na barra
  lateral registrada em auditoria.
- **Permissão estrita pelo perfil ativo** — quem acumula perfis alterna, não soma.
- **Ninguém valida a própria monitoria**, quaisquer que sejam seus perfis. É regra de
  imparcialidade, não de hierarquia.

| Perfil | Impacto |
|---|---|
| **ADMIN** | Cadastra pessoas com mais de um perfil. No contexto de administração deixa de ver Monitorias, Metas e Equipe; mantém Painel e Relatórios, de onde sai o cancelamento de monitoria |
| **GESTOR** | **Gestores cadastrados passam a conseguir entrar** — é o que destrava a operação com gestores reais. O botão "Nova Monitoria" sai do perfil: gestor valida, não avalia |
| **MONITOR** | Quem também administra passa a ver a própria carteira |

## 0.21.0 — Usabilidade da Administração

**Data:** 07/09/2026 · commit `74e638f`

**Objetivo.** A Administração "parecia sistema antigo" por um motivo literal: as abas usavam
classes de estilo que não existiam. Eram botões nativos do navegador, com borda em relevo.

**Problemas resolvidos**
- Barra de abas com **318 px de altura** antes do conteúdo.
- Três entradas do menu levando ao mesmo painel de oito abas.
- A grade de critérios exibia uma coluna **"Nota Mínima Esperada" que nunca participou de
  cálculo nenhum**.
- **A tela de Perfis afirmava coisas falsas**: listava onze permissões que já não existiam e
  omitia quatro reais.
- Os logs exibiam um **IP gerado aleatoriamente**, rotulado "simulado".
- **O campo Peso não aceitava 0** — oito dos 29 critérios da régua não podiam ser cadastrados
  pela própria tela.

**Principais entregas**
- Abas estilizadas: de 318 px para **39 px**.
- Cada seção mostra só as suas abas.
- Grade de critérios refeita por bloco, com **Tipo, Peso e Régua**; peso 0 aparece como "não
  pontua".
- Tela de Perfis reescrita em linguagem de negócio, derivada da mesma fonte que controla o
  acesso — o que a tela mostra é, por construção, o que o sistema faz.

| Perfil | Impacto |
|---|---|
| **ADMIN** | Principal beneficiário: administração legível e fiel ao sistema |
| **GESTOR** | Sem impacto direto |
| **MONITOR** | Sem impacto direto; os rótulos da escala passam a coincidir com os do formulário |

## 0.22.0 — Competência explícita e lançamento retroativo

**Data:** 07/09/2026 · commit `bdb000f`

**Objetivo.** A operação trabalha por competência, mas o eixo do sistema era um campo rotulado
apenas "Data". Quem avaliava em setembro um atendimento de agosto precisava adivinhar qual data
o campo queria — e a escolha errada movia a monitoria de mês em silêncio.

**Problemas resolvidos**
- Competência deduzida de um campo ambíguo.
- Metas e Painel respondiam sempre sobre o mês corrente: **era impossível cadastrar a meta de um
  mês passado**, e portanto reconstruir o histórico desde janeiro.
- Chegar a janeiro em Relatórios custava oito cliques.

**Principais entregas**
- **Competência como campo próprio** na monitoria, com padrão igual ao mês do atendimento.
- **Seletor de competência** em Metas, Painel e Relatórios.
- **Meta retroativa.**
- **Lançamento retroativo** para GESTOR e ADMIN: mesmo formulário, mesma régua, nasce validado e
  recebe o selo "Retroativa" para nunca ser confundido com uma monitoria que passou por
  validação real.

| Perfil | Impacto |
|---|---|
| **ADMIN** | Pode lançar o histórico retroativo |
| **GESTOR** | Cadastra metas de meses passados, lê o Painel por competência e lança retroativo |
| **MONITOR** | Declara a competência explicitamente, sem adivinhação |

## 0.22.1 — Fila de validação e competência do Painel

**Data:** 10/09/2026 · commit `cc49111`

**Objetivo.** Corrigir os dois defeitos revelados pela **primeira monitoria real da operação**.

**Problemas resolvidos**
- **A primeira monitoria real não chegou à gestora.** O atendimento era de 28/08, avaliado em
  setembro: competência agosto. A fila de validação mostrava só a competência corrente — então a
  monitoria não apareceu em setembro, e não apareceria nunca, porque agosto não volta a ser o mês
  corrente. Numa operação que avalia o mês anterior, competência passada é a regra.
- **O Painel mostrava números de setembro sob um cabeçalho que dizia agosto.**
- O ritmo diário de um mês encerrado aparecia como "0 por dia" — que parece meta batida.

**Principais entregas**
- A fila de validação passa a listar **tudo o que está pendente, de qualquer competência**, com a
  competência escrita em cada linha.
- Os indicadores do Painel passam a obedecer à competência selecionada.
- Mês encerrado mostra "—" e a nota "Competência encerrada".

| Perfil | Impacto |
|---|---|
| **ADMIN** | Painel coerente com a competência escolhida |
| **GESTOR** | Principal beneficiário: nada pendente fica invisível |
| **MONITOR** | Monitoria de mês anterior chega à validação |

## 0.23.0 — Plano de metas com vigência

**Data:** 11/09/2026 · commit `51f8943`

**Objetivo.** A meta era cadastrada mês a mês: cinco colaboradoras por doze competências são
**sessenta cadastros por ano** para dizer sempre a mesma coisa — e o mês esquecido ficava sem
denominador.

**Problemas resolvidos**
- Recadastro mensal da mesma meta.
- Competência sem meta por esquecimento.

**Principais entregas**
- **Plano de metas com vigência**, herdado automaticamente por toda competência coberta.
- **Exceção por competência**, sem migração: as metas já gravadas passaram a ser lidas como
  exceções.
- **"Sem meta neste mês"** para férias e afastamentos — que não é meta zero.
- **"Entra em"** para quem começa no meio da vigência.
- **Edição que não reescreve o passado** e **recusa de vigências sobrepostas**.
- Selos **Do plano**, **Ajustada · plano X** e **Sem meta neste mês**.

A validação encontrou e corrigiu três defeitos antes da publicação: a recusa de vigência
fechava o editor e descartava o plano digitado; "Sem meta" estava escondido atrás de um ícone
de lixeira; e a competência aparecia em formato técnico ("2026-01").

| Perfil | Impacto |
|---|---|
| **ADMIN** | Sem impacto direto nesta versão |
| **GESTOR** | Dono do plano nesta versão: cadastra uma vez por ano e trata só as exceções |
| **MONITOR** | A agenda passa a ter meta em todo mês coberto |

## 0.24.0 — Agenda operacional

**Data:** 11/09/2026 · commit `568320c` · **versão em produção**

**Objetivo.** Transformar o plano anual em **agenda real de execução**. O plano sabia que havia
35 monitorias a fazer; a tela não dizia quais.

**Problemas resolvidos**
- **Agenda vazia com o plano cadastrado.** A tela mostrava "0 de 35" e, logo abaixo, "Nenhuma
  colaboradora vinculada à sua carteira". O alvo vinha das metas; a lista vinha das alocações de
  carteira. Eram duas respostas para "de quem eu sou monitora" na mesma tela.
- **A agenda montava o mês errado.** Em setembro, montava a agenda de setembro — que só seria
  trabalhada em outubro.
- A tela estava presa ao mês corrente, sem acesso a atrasos, reavaliações e auditorias.
- **O ritmo da equipe media dias úteis dentro do mês auditado**: a gestora via "1 dia útil
  restante, precisa de 35 por dia" em pleno setembro.

**Principais entregas**
- **A agenda passa a ser a união do plano com as alocações.** Cadastrar o plano basta.
- **Competência auditada separada do mês de trabalho**, com **defasagem configurável**, padrão
  de 1 mês.
- Cabeçalho que diz as duas coisas: *"Monitorias · Agosto de 2026 — Competência de agosto,
  monitorada em setembro."*
- Seletor de competência na tela de Monitorias.
- O formulário já nasce na competência da agenda.

| Perfil | Impacto |
|---|---|
| **ADMIN** | Controla a defasagem em Sistema → Fluxo |
| **GESTOR** | Ritmo e risco da equipe medidos sobre o mês certo |
| **MONITOR** | Principal beneficiária: a tela responde "quem eu preciso monitorar agora" |

## 0.25.0 — Plano do ADMIN, ajustes da gestão

**Data:** 11/09/2026 · commit `dbc5188` · **em branch — não publicada, aguardando validação**

**Objetivo.** Separar dois atos de natureza diferente que dividiam a mesma tela e o mesmo botão:
**quem declara o padrão do ano não é quem reage ao mês.**

**Problemas resolvidos**
- Plano anual e ajuste do mês com o mesmo dono.
- **O ajuste absoluto perdia a intenção.** Se a gestora gravava "8" e o plano mudava de 10 para
  12, o "8" virava um número sem origem.
- Nenhuma tela listava planos; o plano encerrado por sucessão ficava invisível.

**Principais entregas**
- **Plano de Metas na Administração**, com permissão exclusiva do ADMIN.
- **Lista de planos** com status Vigente, Encerrado e Futuro.
- **"Efeito na competência"**: o ADMIN lê o que a gestão fez com o plano, com autor e data.
- **Ajuste gravado como diferença** (`+3`, `−2`), com botões − e + por escopo, piso de 1 e
  "Sem meta" como único caminho para zerar.
- Registro de **quem ajustou e quando**.

A lógica de resolução foi verificada em 14 casos diretos antes da validação de tela.

| Perfil | Impacto |
|---|---|
| **ADMIN** | Passa a ser o dono do plano anual e o leitor do seu efeito |
| **GESTOR** | Deixa de editar o plano; ajusta a competência em passos |
| **MONITOR** | Sem mudança de tela; a agenda reflete plano e ajustes |

> **Consequência a registrar:** quem acumula ADMIN e MONITOR sem o perfil GESTOR passa a criar o
> plano, mas **deixa de poder ajustar competências**.

---

# 3. Evolução da Metodologia

## A metodologia inicial

Em julho (0.4.0) a monitoria tinha **12 critérios de exemplo**, em quatro categorias —
Comunicação, Atendimento, Processo e Encerramento —, respondidos em 0, 1, 2 ou N/A.

Na Sprint 0 (0.8.0, 19/08) entraram os **28 critérios oficiais do CYF**, os tipos de resposta
Checklist e Faixa de Tempo, o **cálculo ponderado por peso** e o **eliminatório com confirmação
humana**. O conceito de nota, que tinha **três implementações divergentes** no código, passou a
ter uma só.

## A transformação da régua em dado

Este foi o movimento metodológico mais importante do projeto, em três passos:

1. **Validação (25/08).** A metodologia foi consolidada num documento único — a partir do PDF do
   CYF, do `Padrão Relatório` e das orientações por tipo de atendimento — e revisada item a item:
   **32 itens, 32 aprovados, nenhum ajuste**, sete decisões encerradas.
2. **Dado (0.18.0).** A régua deixou de ser texto de apoio e passou a ser estrutura: âncoras por
   nível, regra de N/A, régua por sub-pergunta.
3. **Manutenção (0.18.0 e 0.21.0).** A Administração ganhou editores para todos os campos, e a
   grade passou a mostrar o que se administra — tipo, peso e régua.

**Por que isso importa:** um critério que existe só em prosa precisa ser *interpretado* a cada
monitoria, por pessoas diferentes, de formas diferentes. Uma âncora escrita é uma decisão tomada
uma vez. É também a única base possível para uma IA avaliar sem inventar critério.

## Os critérios hoje

**29 cadastrados, 28 ativos, em 7 blocos.** O critério 3 ("por qual canal?") está inativo desde
a 0.16.0: o canal já é informado na abertura da monitoria e é ele que filtra os critérios
aplicáveis — perguntá-lo de novo era redundância.

| Bloco | Critérios | Peso somado | Peso na nota | Papel |
|---|---|---|---|---|
| Formas do Contato | 1, 2 e 29 | 0 | — | Classificação |
| Abertura | 4–5 | 2,0 | 7,4% | Como o atendimento começa |
| **Comunicação** | 6–14 | **11,0** | **40,7%** | Como o atendente conduz |
| Conhecimento do Produto | 15–17 | 5,0 | 18,5% | O que o atendente sabe |
| Precisão das Informações | 18–21 | 5,5 | 20,4% | Se o que foi dito se sustenta |
| Encerramento | 22–24 | 3,5 | 13,0% | Como o atendimento fecha |
| Mandou Mal | 25–28 | 0 | — | Eliminatórios |
| **Total** | **21 ponderáveis** | **27,0** | **100%** | |

*Percentuais calculados quando todos os critérios se aplicam. Com N/A, o denominador encolhe e os
pesos relativos mudam.*

## Os tipos de resposta

| Tipo | Critérios ativos | Como se responde |
|---|---|---|
| Escala | 18 | `2` Excelente · `1` Parcial · `0` Não realizou · `N/A` |
| Checklist | 2 (4 e 24) | Sub-perguntas SIM/NÃO; nota = (SIM ÷ total) × 2 |
| Faixa de tempo | 1 (5) | `2` · `1,33` · `0,67` · `0` |
| Classificação | 3 (1, 2 e 29) | Texto da opção — não é nota |
| Eliminatório | 4 (25 a 28) | Não ocorreu · Sim, ocorreu |

## Os pesos

| Peso | Critérios | Valor de cada um na nota |
|---|---|---|
| 2,0 | 3 — empatia (6), informação precisa (16), ausência de desinformação (18) | 7,41% |
| 1,5 | 6 | 5,56% |
| 1,0 | 12 | 3,70% |
| 0 | 7 — classificações e eliminatórios | não pontua |

Os três critérios de peso 2 valem juntos **22% da nota**. São o centro de gravidade da régua: um
atendimento pode ser cordial e ainda tirar nota baixa se falhar neles.

> **Decidido e não implementado:** exibir, na Administração, o peso acompanhado do percentual
> que ele representa na nota.

## As âncoras

| Valor | Rótulo | O que caracteriza |
|---|---|---|
| 2 | Excelente | Executou de forma completa, no momento certo, e a conduta produziu efeito |
| 1 | Parcial | Executou incompleto, fora do momento, ou sem confirmar o resultado |
| 0 | Não realizou | Não executou, ou executou de forma que prejudicou o atendimento |

Cada critério tem o seu texto para cada nível. A escolha da nota deve ser rastreável a uma
âncora — não uma impressão para a qual depois se procura justificativa.

*A escala do CYF documentava quatro níveis (Ótimo, Bom, Regular, Ruim). A metodologia adotou os
três do sistema. Voltar a quatro seria mudança de código e de base de comparação histórica.*

## N/A

- **Sai dos dois lados da conta.** Não penaliza nem premia: o critério deixa de existir para
  aquele atendimento.
- **Cada critério tem sua regra.** O 5 (rapidez) é N/A quando o contato é ativo; o 6 (empatia)
  nunca é N/A, porque todo contato tem um pedido.
- **N/A à toa infla a nota**, porque aumenta o peso relativo dos demais. N/A é "não se aplica",
  nunca "não consegui verificar".
- **Não exige justificativa** (decisão de 25/08). O campo aparece, mas não bloqueia.

## Eliminatórios

Quatro: **25** confirmação de dados de segurança insuficiente · **26** faltou com respeito ao
cliente · **27** atendimento encerrado sem atendimento do cliente · **28** promessa de produto ou
serviço inexistente.

A proteção foi construída em camadas, porque o erro aqui é o de maior consequência:

| Quando | Proteção |
|---|---|
| 0.8.0 | Marcar "Sim, ocorreu" **não zera a nota** — sinaliza a monitoria. Só a confirmação de gestor ou administrador zera |
| 0.12.0 | Na fila, monitoria com eliminatório não oferece "Validar", só "Analisar" — zerar não sai de um clique de rotina |
| 0.16.0 | Eliminatório só é sinalizado **por marcação explícita** — um defeito fazia rascunhos reabertos acusarem eliminatórios que ninguém marcou |
| 0.18.0 | Critério 29: cliente autenticado pelo canal torna o 25 N/A automaticamente |

## Competência

Desde a 0.22.0 a monitoria declara a competência em campo próprio — por padrão, o mês do
atendimento. A metodologia ganhou com isso um eixo temporal inequívoco, que é o que torna
possível comparar competências e, adiante, acompanhar evolução. Detalhes na seção 7.

## O cálculo da nota

```
nota (%) = Σ (resposta × peso) ÷ Σ (2 × peso) × 100
```

somando apenas os critérios com peso maior que zero e resposta diferente de N/A.

**Leitura prática, com todos os critérios aplicáveis:** o denominador é 54 pontos. Um critério de
peso 2 avaliado como Parcial custa 3,7 pontos percentuais; avaliado como "Não realizou", 7,4.

| Nota | Conceito |
|---|---|
| ≥ 95 | Excelente |
| ≥ 85 | Muito Bom |
| ≥ 75 | Bom |
| ≥ 50 | Atenção |
| < 50 | Crítico |

A nota é sempre calculada pelo sistema. Ninguém a digita.

## Justificativas

**Obrigatória para toda resposta abaixo do máximo**, inclusive os valores fracionários. O
formulário não avança sem ela. Não é exigida para nota máxima, para N/A e para classificações —
esta última exceção foi corrigida na 0.16.0, quando classificar um contato como "Reclamação"
passou a exigir, por engano, uma justificativa.

## Evidências

A monitoria registra evidência em três lugares:

- **Link do atendimento**, na etapa de Evidências.
- **Citações dentro das justificativas** e dos blocos narrativos.
- **Arquivos anexos** — com uma limitação importante: o sistema **registra nome, tipo e tamanho
  do arquivo, mas não armazena o arquivo**. A gravação do atendimento não fica guardada na
  plataforma; o link é o vínculo real.

## O relatório

| Bloco | Função |
|---|---|
| Identificação | Protocolo gerado, nº do atendimento, nº do título, canal, categoria, janela, duração e competência |
| Contexto do Atendimento | Narrativa factual e cronológica, sem juízo de valor |
| Pontos Positivos | Ancorados no que aconteceu — "não cometeu erros" não é ponto positivo |
| Pontos de Atenção | O que fazer diferente, não só o que faltou |
| Leitura Técnica | O que o conjunto das respostas revela — conecta critérios, não os repete |
| Erros Identificados | Só quando houver erro técnico, falha de processo ou risco; nasce recolhido |
| Conclusão | Nível do atendimento, impacto e direcionamento — não repete a nota |

Separadamente, **Observações internas** guardam anotações da monitora que não fazem parte do
relatório.

## Monitoria assistida por IA

A metodologia foi escrita para ser executável também por uma IA — mas a assistência, hoje, é um
processo **externo ao sistema**. O que existe, o que falta e os cuidados estão na seção 8.

---

# 4. Evolução dos Perfis

## O modelo antigo

Da 0.2.0 à 0.19.0: **um papel por pessoa** — Administrador, Gestor, Monitor e Colaborador.

## As limitações

O modelo falhou de quatro formas, e nenhuma delas era óbvia:

- **A estrutura estava presa a pessoas.** Na saída da supervisora (0.17.0) descobriu-se que ela
  era, nos dados, gestora da área *e* monitora de quatro das cinco carteiras. Sair sem
  reatribuir deixaria quatro colaboradoras fora de meta, em silêncio. O modelo de permissões
  estava correto; o acoplamento morava nos dados semeados.
- **Acumular papéis exigia exceção no código** — e a exceção fazia todo administrador contar
  como monitor.
- **Quem administrava e monitorava via a validação de si mesma** em vez da própria carteira.
- **Gestores cadastrados não conseguiam entrar**, porque o login olhava uma lista fixa.

Dois defeitos de segurança foram fechados no caminho: o perfil Colaborador autenticava sem ter
acesso a nada (0.8.0) e o status "Inativo" não impedia o login (0.17.0).

## Perfis múltiplos

A partir da 0.20.0:

- **Uma pessoa tem uma lista de perfis.** Quem não acessa o portal tem lista vazia.
- **O perfil ativo pertence à sessão, não ao cadastro.** A escolha de contexto de uma pessoa não
  muda como as outras a enxergam.
- **Troca de contexto na barra lateral**, registrada em auditoria.
- **Perfil inicial por precedência** — Monitor, depois Gestor, depois Admin: o trabalho diário
  primeiro.
- **Permissão estrita pelo perfil ativo.** Quem acumula alterna; não vê a união.
- **Ninguém valida a própria monitoria.**

## Responsabilidades de cada perfil

| | ADMIN | GESTOR | MONITOR |
|---|---|---|---|
| **Papel** | Estrutura e governança | Validação e gestão da equipe | Execução da monitoria |
| **Menu** | Critérios · Usuários e Acessos · Sistema · Painel · Relatórios | Validação · Relatórios · Painel da Equipe · Equipe e Carteiras · Metas | Monitorias · Meu Histórico |
| Régua de avaliação | ✅ mantém | — | lê no formulário |
| Usuários, perfis e áreas | ✅ | — | — |
| Defasagem de competência | ✅ | — | — |
| Plano de metas anual | ✅ *na 0.25.0* | ✅ *até a 0.24.0* | — |
| Ajustes da competência | — | ✅ | — |
| Carteiras | — | ✅ | — |
| Realizar monitoria | — | — | ✅ |
| Validar, devolver, reprovar | — | ✅ exceto as próprias | — |
| Confirmar eliminatório | — | ✅ | — |
| Lançamento retroativo | ✅ | ✅ | — |
| Cancelar monitoria | ✅ | — | — |
| Escopo | toda a operação | as áreas em que é gestor | a própria carteira |

**O colaborador avaliado não é usuário.** Mudar isso é a decisão estruturante do eixo de
desenvolvimento.

---

# 5. Fluxo Atual do Sistema

```
Plano de Metas  →  Agenda da Monitora  →  Monitoria  →  Validação  →  Relatórios  →  Histórico
```

## Plano de Metas

**Quem:** GESTOR em produção · ADMIN a partir da 0.25.0.

O plano declara uma vez, com vigência, quantas monitorias cada colaboradora deve receber por mês.
Cada competência coberta herda as metas; a gestão trata só o que foge do padrão. O sistema
resolve a meta efetiva de cada mês a partir do plano e das exceções.

## Agenda da Monitora

**Quem:** MONITOR.

Ao abrir Monitorias, a agenda mostra a **competência auditada** — o mês de trabalho menos a
defasagem. Em setembro, agosto. Ela responde, nesta ordem:

- **quanto falta** — meta da carteira, entregues, validadas, dias úteis restantes do mês de
  trabalho e ritmo necessário por dia;
- **quem falta monitorar**, por urgência: quem não tem nenhuma monitoria primeiro, depois a
  maior lacuna, depois quem está há mais tempo sem avaliação;
- **o que precisa da sua ação** — devolvidas pela gestora e rascunhos;
- **o que aguarda a gestora.**

Cada colaboradora abre em **vagas**: uma meta de 10 são dez vagas, preenchidas ou abertas. O
botão **Monitorar** abre o formulário com colaboradora, canal e competência já preenchidos.

A lista vem da **união do plano com as alocações de carteira**. A seleção de competência permite
voltar a meses anteriores para atrasos e reavaliações.

## Monitoria

**Quem:** MONITOR. *(Lançamento retroativo: GESTOR e ADMIN.)*

| Etapa | O que acontece |
|---|---|
| 1 · Informações gerais | Nº do atendimento e do título, canal, categoria, início e fim, competência |
| 2 · Evidências | Link do atendimento e anexos |
| 3 · Avaliação | Critérios filtrados pelo canal, âncoras à vista, justificativa obrigatória abaixo do máximo, critério 29 antes do 25 |
| 4 · Observações | Os seis blocos do relatório e as observações internas |
| 5 · Conclusão | Resumo, desempenho por bloco e nota calculada |

No primeiro salvamento o sistema gera o protocolo (`MON-2026-0001`). Havendo gestor na área, a
monitoria vai para validação. **Ela conta para a meta no envio**, não na aprovação — o trabalho
feito aparece no progresso sem esperar a gestora.

## Validação

**Quem:** GESTOR.

A fila lista **tudo o que está pendente, de qualquer competência**, das mais antigas para as
mais recentes, com a competência em cada linha. Para cada monitoria:

- **Validar** — a monitoria fica validada.
- **Solicitar ajustes** — volta como rascunho, com o motivo, e aparece na agenda da monitora em
  "Precisa da sua ação".
- **Reprovar** — não conta para a meta e reabre a vaga.
- **Confirmar eliminatório** — só aqui a nota é zerada.

Na mesma tela, a gestão acompanha o **ritmo da equipe** e o **risco do mês**: quem tem meta e
nenhuma monitoria, e quem não está em plano nem em carteira. O escopo é limitado às áreas em que
a pessoa é gestora.

## Relatórios

**Quem:** ADMIN, GESTOR e MONITOR — este último como "Meu Histórico".

Relatórios reúne a consulta: seleção de competência, tabela, busca pelos identificadores do
atendimento, filtros e exportação em **CSV** e **PDF**. **A tela e os arquivos exportados usam
exatamente o mesmo conjunto de registros.** Monitorias retroativas levam selo próprio. O
cancelamento de monitoria é exclusivo do ADMIN.

## Histórico

**Quem:** todos, por competência.

Hoje o histórico é o **registro das monitorias por competência**, consultado em Relatórios. Não
existe ainda leitura de evolução por colaboradora ao longo do tempo — é o primeiro item do eixo
de desenvolvimento, e depende de haver histórico real acumulado.

---

# 6. Gestão de Metas

## O plano de metas

O plano declara o padrão do ano: uma linha por colaboradora, com a monitora responsável, o
escopo e o volume mensal.

**O plano da operação para 2026:**

| Colaboradora | Monitora | Escopo | Por mês |
|---|---|---|---|
| Nathalia | Aline | Meta geral | 10 |
| Allanis | Aline | Meta geral | 10 |
| Ana Carla | Aline | Meta geral | 5 |
| Aline | Aline | Meta geral | 5 |
| Susana | Aline | Meta geral | 5 |
| | | **Total** | **35** |

O **escopo** pode ser geral (qualquer canal atende) ou por canal (por exemplo, 5 de WhatsApp e 5
de Ligação). Os dois não coexistem para a mesma colaboradora, e **excedente num canal não cobre
déficit em outro**.

## Vigência

Todo plano tem início e fim em competências — por exemplo, janeiro a dezembro de 2026. Cada mês
dentro da vigência herda as metas sem cadastro nenhum. **Duas vigências não podem se sobrepor**:
com dois planos cobrindo agosto, a meta herdada dependeria da ordem da lista. A recusa acontece
na hora, e o editor permanece aberto para que as datas sejam corrigidas.

## Ajustes e deltas

O ajuste é a decisão sobre **um mês**, sem tocar o plano.

**Até a 0.24.0, em produção:** a gestão informa um valor absoluto para a competência, e a linha
passa a exibir "Ajustada · plano X".

**A partir da 0.25.0:** o ajuste passa a ser gravado como **diferença em relação ao plano**, com
botões − e +:

| Plano | Ajuste gravado | Meta efetiva | Se o plano mudar para 12 |
|---|---|---|---|
| 10 | +2 | 12 | 14 |
| 10 | −3 | 7 | 9 |

**Por que delta.** Com o plano pertencendo ao ADMIN e o ajuste à gestão, um valor absoluto perde
a intenção na primeira vez que o plano muda. "−3" continua significando "três a menos do que o
plano manda"; "7" vira um número sem origem.

Regras do delta:
- vale **por escopo** — "+1 no WhatsApp" não mexe na Ligação;
- **nunca leva a meta a zero** — o botão − para em 1;
- ajuste que volta a zero é apagado, e a linha volta a "Do plano";
- **registra quem ajustou e quando**.

## Sem meta neste mês

Para férias, afastamentos e situações especiais. Pede um motivo, tira a colaboradora do cálculo
daquele mês **em todos os canais**, e é desfeito com "Voltar ao plano".

**Não é meta zero.** Zero somaria ao total e afirmaria que a pessoa tem uma meta. "Sem meta"
afirma que ela está fora do mês — e é o único caminho para zerar.

## Entra em

Para quem começa no meio da vigência. Uma linha com "Entra em: novembro" não existe nas
competências anteriores. Evita criar um plano novo a cada chegada.

## Sucessão de planos

**Editar um plano em curso não reescreve o passado.** O sistema encerra o plano atual na
competência anterior e abre um novo a partir da competência corrente:

| | Vigência | Nathalia |
|---|---|---|
| Plano original, encerrado | janeiro a agosto | 10 |
| Plano sucessor | setembro a dezembro | 12 |

Sem isso, mudar a meta em dezembro reavaliaria agosto contra um alvo que não valia quando o
trabalho foi feito. Plano cuja vigência ainda não começou é editado no lugar.

## Plano × ajuste operacional

| | Plano | Ajuste |
|---|---|---|
| **Pergunta** | Qual é o padrão do ano? | O que muda neste mês? |
| **Dono** | ADMIN *(0.25.0)* | GESTOR |
| **Alcance** | Toda a vigência | Uma competência |
| **Forma** | Volume por colaboradora e escopo | Diferença, ou "sem meta" |
| **Onde** | Configuração → Plano de Metas | Gestão → Metas |
| **Selo** | Do plano | Ajustada · plano X · Sem meta neste mês |

**Precedência na resolução de cada mês:** "Sem meta" vence tudo para aquela colaboradora; ajuste
modifica o escopo correspondente do plano; meta absoluta — usada quando nenhum plano cobre o mês
— substitui a pessoa inteira; sem nenhuma exceção, vale o plano.

---

# 7. Competência Operacional

## Os dois meses

| | Competência auditada | Mês de trabalho |
|---|---|---|
| **O que é** | O mês **dos atendimentos** avaliados | O mês **em que** a monitoria é feita |
| **Exemplo** | Agosto de 2026 | Setembro de 2026 |
| **Governa** | Meta, agenda, cobertura, pendências, relatórios | Dias úteis restantes e ritmo diário |

## A defasagem

A distância entre os dois é um **parâmetro de sistema**, em Administração → Sistema → Fluxo,
com padrão de **1 mês**. A tela mostra o efeito ao lado: *"Trabalhando em Setembro de 2026, a
agenda abre na competência de Agosto de 2026."*

É parâmetro, e não regra fixa no código, porque descreve o calendário de uma operação — e pode
mudar.

## Por que agosto é monitorado em setembro

É a regra da operação: a monitoria avalia os atendimentos do mês anterior.

| Mês de trabalho | Competência auditada |
|---|---|
| Setembro/2026 | Agosto/2026 |
| Outubro/2026 | Setembro/2026 |
| Novembro/2026 | Outubro/2026 |

Na prática, isso significa que **competência passada é a regra, não a exceção**. Esse
entendimento, que parece simples, foi a origem dos dois defeitos mais sérios da operação real:

- **0.22.1** — a fila de validação filtrava a competência corrente, e a primeira monitoria real
  nunca chegaria à gestora.
- **0.24.0** — medir o ritmo pela competência auditada dava "1 dia útil restante" em setembro.

A lição registrada: **os dois meses precisam de nomes próprios**, no código e na tela.

## Impactos nos relatórios e indicadores

| Onde | Comportamento |
|---|---|
| Agenda da monitora | Abre na competência auditada; ritmo pelo mês de trabalho |
| Ritmo e risco da equipe | Competência auditada; dias úteis do mês de trabalho |
| Fila de validação | **Sem recorte**: pendente é pendente em qualquer mês |
| Formulário | Nasce na competência da agenda; o início do atendimento pode corrigi-la |
| Painel, Metas e Relatórios | Seletor livre, mas **abrem no mês corrente** |
| CSV e PDF | Levam a competência |
| Lançamento retroativo | Registra competências passadas já validadas, com selo |

> **Ponto de atenção:** em setembro a agenda abre em agosto e o Painel abre em setembro. Não é
> erro — cada tela responde sobre o mês escolhido —, mas o padrão de abertura diverge.

---

# 8. IA e Automação

## Como a IA auxilia a monitoria hoje

**Não há IA integrada ao MonitorIA.** O sistema não chama nenhum modelo de linguagem.

A assistência existe como **processo externo e disciplinado**:

1. a monitora cola a transcrição do atendimento no Copilot, com o prompt operacional
   (`docs/PROMPT-IA-MONITORIA.md`);
2. a IA devolve uma proposta de monitoria no padrão da plataforma;
3. a monitora revisa, altera o que discordar e registra no formulário;
4. o sistema calcula a nota e segue o fluxo normal de validação.

O prompt carrega a régua embutida — 28 critérios, pesos e regras de N/A. A base conceitual está
em `docs/MANUAL-IA-MONITORIA.md`.

**A automação que existe dentro do sistema não é IA**, e é determinística: cálculo da nota,
protocolo, duração do atendimento, N/A automático do critério 25, competência padrão, herança de
metas, ordenação da agenda e resolução do perfil inicial.

## O que mudou no padrão de saída

Até a 0.17.0 uma monitoria era **uma lista de notas com um comentário no fim**. O padrão atual
exige um **documento de avaliação** em quatro partes que se sustentam:

| Parte | Exigência |
|---|---|
| Respostas | Uma por critério ativo, rastreável a uma âncora |
| Justificativas | Toda resposta abaixo do máximo |
| Evidências | Trechos que sustentam o que foi afirmado |
| Blocos narrativos | Os seis blocos do relatório |

Uma saída só com notas é recusada.

## Justificativas obrigatórias

Duas a quatro linhas, em terceira pessoa, sobre o atendimento e não sobre a pessoa, com três
elementos: **o que aconteceu**, **por que corresponde àquela âncora**, e **onde está no
atendimento**. "Foi seco" não é justificativa; *"respondeu apenas 'não temos', sem alternativa
nem explicação"* é.

## Evidências

Evidência é o que permite alguém discordar com base no mesmo material: trecho citado com o
falante identificado, referência de posição, ou descrição factual de uma ausência. **Regra dura:
nunca inventar um trecho.** Se a evidência não existe, a IA deve dizer que não existe.

Quando a evidência não permite decidir, **o N/A é proibido** — ele inflaria a nota. A instrução é
escolher o valor que a evidência sustenta e declarar a limitação.

## Contexto

A iniciativa de IA seguiu deliberadamente uma ordem, aprovada em 24/08: **a régua vem antes da
IA.** Um gerador de instruções só é tão bom quanto a orientação que lê — e a orientação que
existia era um resumo de uma linha.

| Etapa | Estado |
|---|---|
| **3A.0** — validar a régua e transformá-la em dado | ✅ concluída (0.18.0) |
| Manual e prompt operacional | ✅ escritos em setembro |
| **3A.1** — gerador de instruções a partir da régua cadastrada | ⏳ não iniciada |
| **3A.2** — execução com chave protegida no servidor | ⏳ não iniciada |
| **3A.3** — sugestões na tela, com aceite critério a critério | ⏳ não iniciada |

Cinco invariantes foram acordadas para qualquer integração: **a IA nunca grava a nota final,
nunca valida eliminatório, nunca envia monitoria, gera sugestão e não decisão — e a nota continua
sendo calculada pelo sistema.**

## Pontos positivos

- **A régua virou dado antes de a IA existir.** A integração futura lê decisões escritas, não
  interpreta prosa.
- **O padrão de saída é auditável.** Justificativa com evidência permite conferir e discordar.
- **Os erros mais caros foram antecipados nas instruções**: N/A por dúvida, trecho inventado,
  eliminatório por suspeita, nota final informada pela IA.
- **A decisão continua humana**, por desenho e não por boa vontade.
- O prompt funciona hoje, sem esperar infraestrutura.

## Pontos de atenção

- **Nada fica registrado sobre o que veio da IA.** A proposta é transcrita à mão; o sistema não
  sabe que parte foi sugerida e que parte foi alterada.
- **O prompt não lê o sistema.** A régua está copiada dentro dele: se um critério mudar na
  plataforma, o prompt fica desatualizado em silêncio. Ele está alinhado à versão 0.22.0.
- **Dados de clientes em ferramenta externa.** Transcrições podem conter nome, CPF e dados
  contratuais. A política de uso precisa ser confirmada com a área responsável pela proteção de
  dados antes de o processo escalar.
- **A calibração da régua ainda não aconteceu.** A decisão registrada é tratar as primeiras
  monitorias reais como calibração antes da 3A.1 — porque a 3A.1 congela a régua dentro do gerador.
- **A integração depende de servidor.** A etapa 3A.2 exige guardar a chave de acesso fora do
  navegador — e o sistema ainda não tem backend.

## Leitura técnica

A iniciativa está na ordem certa e no ponto certo. A régua como dado, o manual e o prompt formam
uma fundação que a maioria das iniciativas de IA em qualidade não tem: elas começam pelo modelo e
descobrem depois que não há critério escrito para ele seguir.

O limite atual não é de método, é de **infraestrutura e governança**. Enquanto a assistência for
copiar e colar, ela depende da disciplina de quem usa, não deixa rastro e diverge da régua quando
a régua muda. As três pendências — rastreabilidade, régua lida do sistema e chave protegida —
têm a mesma raiz: a ausência de um servidor.

## Conclusão

A IA já é útil como assistente externo, desde que tratada como proposta sujeita a revisão. O
valor de produto virá da integração com **aceite critério a critério dentro do formulário**, que
torna o uso rastreável e mantém a régua como única fonte. Essa integração deve vir **depois** da
calibração com monitorias reais e **depois** da decisão de backend — nessa ordem.

---

# 9. O que Está em Produção Hoje

**Versão 0.24.0** · commit `568320c` · https://monitoria-qualidade.vercel.app

## Acesso e perfis
- Login com cadastro real; bloqueio e inativação impedem novo acesso.
- Perfis múltiplos por pessoa, perfil ativo por sessão e troca de contexto auditada.
- Permissão estrita pelo perfil ativo; menus por papel.
- Escopo do gestor limitado às suas áreas.
- Auditoria de acessos.

## Metodologia e régua
- 29 critérios em 7 blocos — 28 ativos, 21 ponderáveis, soma de pesos 27,0.
- Âncoras, regras de N/A, régua por sub-pergunta e opções de classificação, todas editáveis na
  Administração.
- Critério 29 e N/A automático do critério 25.
- Grade de critérios por bloco, com tipo, peso e régua.

## Monitoria
- Formulário em cinco etapas.
- Identificadores do atendimento, 27 categorias criáveis no próprio formulário, duração
  calculada.
- Competência explícita.
- Protocolo e código gerados pelo sistema, sem risco de sobrescrita.
- Justificativa obrigatória abaixo do máximo.
- Relatório em seis blocos e observações internas.
- Nota ponderada e conceito calculados pelo sistema.
- Rascunho, devolução com motivo e correção.
- Lançamento retroativo com selo.

## Metas e agenda
- Plano de metas com vigência, exceções, "Sem meta neste mês", "Entra em", sucessão e recusa de
  sobreposição.
- Metas gerais ou por canal.
- Agenda da monitora pela competência auditada, com defasagem configurável.
- Agenda formada por plano e carteira; vagas por colaboradora; ordenação por urgência.
- Seleção de competência na agenda.
- Carteiras de monitoria com vigência e histórico.

## Validação e gestão
- Fila de validação de todas as competências.
- Validar, solicitar ajustes, reprovar e confirmar eliminatório.
- Ninguém valida a própria monitoria.
- Ritmo da equipe e risco do mês.
- Painel por competência.

## Relatórios
- Consulta por competência, busca pelos identificadores, filtros.
- Exportação CSV e PDF com os mesmos registros da tela.
- Cancelamento de monitoria restrito ao ADMIN.

## Administração
- Critérios, Usuários e Acessos (Usuários · Perfis · Logs), Sistema (Áreas · Colaboradores ·
  Fluxo · Marca).
- Regra de validação gerencial com alerta de monitorias sem gestor.
- Defasagem de competência.
- Identidade visual.

---

# 10. Pendências Conhecidas

## Limitações atuais

| Limitação | Impacto |
|---|---|
| **Os dados ficam no navegador.** Cada navegador é uma base isolada; não há servidor nem cópia automática | 🔴 Limpar os dados do navegador apaga tudo. A operação precisa de estação única e backup manual |
| **Anexos não guardam o arquivo** — só nome, tipo e tamanho | 🟠 O link do atendimento é a única evidência real armazenada |
| **Plano de metas sem área** — um plano cobre o sistema inteiro | 🟠 Quando uma segunda área tiver gestor, o plano dela será recusado por sobreposição |
| **Sessão aberta não verifica bloqueio nem inativação** — só o login verifica | 🟠 Usuário bloqueado com sessão salva continua acessando |
| Protocolo sequencial por navegador | 🟡 Em mais de uma máquina, protocolos podem repetir |
| CSAT e NPS existem como rota, sem tela | 🟡 Direção registrada, fora do menu |

## Melhorias identificadas

- **Validar e publicar a 0.25.0.**
- Alinhar a abertura de Painel, Metas e Relatórios à competência auditada.
- **O gráfico "Evolução Mensal" do Painel é um desenho fixo**, não um dado — resquício do que a
  0.19.0 removeu das demais telas.
- A tela de login ainda exibe "v2.0.0" e "Ambiente de Homologação".
- Editar uma linha do plano sem precisar removê-la e recriá-la.
- Exibir o peso com o percentual que ele representa na nota *(decidido, não implementado)*.
- Registrar a data de envio da monitoria — hoje "na fila há N dias" conta a partir do
  atendimento.
- Orientações por tipo de atendimento: só "Antecipação de Pagamentos" está escrita; outros nove
  tipos aguardam.
- Diferenciação de critérios por canal e a categoria `REGISTRO (I)` — adiadas até haver uso real.
- Versão imprimível da metodologia — leiaute aprovado, cinco definições em aberto.
- Volume do lançamento histórico desde janeiro — não informado.
- Confirmar, na base de produção, que a monitora está vinculada à área da gestora.

## Débitos técnicos registrados

- **Nenhum teste automatizado no repositório.** As verificações foram manuais e pontuais.
- Dois erros de lint antigos no formulário de monitoria.
- Telas ainda em `.jsx`, fora da verificação de tipos.
- Tela de calendário implementada e sem rota.
- Pacote principal acima de 500 kB, sem divisão de código.
- Tipo `ESCALA_4` com nome herdado de uma escala de quatro níveis que não existe mais.
- **Documentação desatualizada:**
  - `OPERACAO.md`, declarado "fonte oficial", descreve o estado da versão 0.8.1;
  - `METODOLOGIA-MONITORIA.md` diz num trecho que N/A precisa ser justificado, e noutro, com a
    decisão de 25/08, que não;
  - o prompt de IA está alinhado à 0.22.0.

---

# 11. Próximos Passos

## Curto prazo — consolidar a operação real

| Frente | Ação |
|---|---|
| **Publicação** | Validar e publicar a 0.25.0 |
| **Operação real** | Cadastrar gestores e áreas, conferir vínculos, rodar o fluxo completo |
| **Calibração** | Tratar as primeiras monitorias reais como calibração da régua |
| **Lançamento do histórico** | Definir o volume desde janeiro; acima de cerca de 100 monitorias, avaliar importação por planilha |
| **Segurança operacional** | Rotina de backup; revalidar a sessão aberta contra bloqueio |
| **Honestidade de tela** | Retirar o gráfico fixo do Painel e o rótulo de homologação do login |
| **Documentação** | Atualizar `OPERACAO.md`, a contradição sobre N/A e o prompt de IA |

## Médio prazo — preparar o desenvolvimento

| Frente | Ação |
|---|---|
| **Plano por área** | Antes de a segunda área ter gestor |
| **Acompanhamento de evolução** | Histórico de notas por colaboradora, por bloco e por critério, a partir do histórico real |
| **Foco de desenvolvimento** | Critérios ou blocos eleitos pela gestão para acompanhar num período. Já decidido: por bloco ou critério, definido por GESTOR e ADMIN, **fora do formulário de avaliação**, sem alterar nota, peso ou régua |
| **Documento conceitual** | Do módulo de Desenvolvimento, começando por colaborador × usuário |
| **Orientações por tipo** | Cadastrar os tipos de atendimento pendentes |
| **Qualidade de engenharia** | Testes automatizados na lógica de metas, competência e nota |
| **IA — 3A.1** | Gerador de instruções a partir da régua cadastrada |

## Longo prazo — Portal de Qualidade e Desenvolvimento

| Frente | Ação |
|---|---|
| **Backend** | Persistência centralizada. **É pré-requisito das frentes abaixo** |
| **IA integrada — 3A.2 e 3A.3** | Sugestões no formulário com aceite critério a critério e rastro do que foi sugerido |
| **Portal do colaborador** | Perfil próprio para a colaboradora avaliada ver a própria evolução |
| **Feedbacks recorrentes** | Continuidade entre uma conversa de feedback e a seguinte |
| **Substituição do PDI** | Plano de desenvolvimento dentro da plataforma |
| **Análises por IA** | Leituras agregadas de tendência por colaboradora, bloco e canal |
| **Eixo Cliente** | CSAT, NPS como processo e tratativas no histórico do cliente |

**Por que o backend separa médio de longo prazo.** Com os dados no navegador, a colaboradora não
tem como ver a própria evolução de outra máquina, a IA não tem onde guardar a chave com
segurança e a gestora não enxerga o que a monitora registrou em outro computador. Todo o eixo de
desenvolvimento pressupõe dados compartilhados.

---

# 12. Resumo Executivo

## A situação antes do projeto

A monitoria de qualidade da área de Relacionamento era registrada manualmente no CYF. A régua
existia em dois documentos que divergiam entre si — um previa quatro níveis de nota, a prática
usava três, e duas orientações eram cópias erradas de outras. Não havia controle de validação
no registro, nem vínculo entre a monitoria e o atendimento avaliado, nem uma agenda que dissesse
quem ainda precisava ser monitorada no mês.

## A situação atual

Em menos de três meses — do primeiro commit, em 26/06, à versão 0.24.0, em 11/09 — o MonitorIA
passou por 32 versões e está em produção com o ciclo completo:

**plano anual de metas → agenda da monitora → monitoria com régua validada → validação → relatórios.**

- A régua é **dado estruturado**: 28 critérios ativos com âncoras, regras de N/A e pesos,
  mantidos pela Administração.
- A nota é **calculada pelo sistema**, com eliminatório sob dupla checagem humana.
- O relatório tem **seis blocos**, escritos para a colaboradora ler.
- As metas são **declaradas uma vez por ano**, e a agenda diz a cada dia quem monitorar.
- A operação por competência é **explícita e configurável**.
- Perfis múltiplos com **imparcialidade garantida**: ninguém valida a própria monitoria.
- A primeira monitoria real foi registrada em setembro; o plano de 2026 está cadastrado.

A versão 0.25.0, que passa o plano anual ao ADMIN e transforma os ajustes da gestão em deltas
rastreáveis, aguarda validação.

## Os ganhos obtidos

**Uma ressalva antes da lista:** a operação real acabou de começar, e ainda não há volume para
medir ganho de produtividade ou de tempo. Os ganhos abaixo são **estruturais**.

| Ganho | No início | Agora |
|---|---|---|
| Régua única | Dois documentos divergentes | Um cadastro, validado 32 de 32 |
| Consistência da nota | Três cálculos diferentes no código | Um cálculo, feito pelo sistema |
| Proteção contra eliminatório indevido | Nenhuma | Sinalização, confirmação humana e dependência entre critérios |
| Imparcialidade | Não havia regra | Ninguém valida a própria monitoria |
| Cadastro de metas | 60 lançamentos por ano | 1 plano por ano, mais exceções |
| Agenda | Número a acompanhar | Lista de quem monitorar, por urgência |
| Rastreabilidade | Monitoria sem vínculo | Protocolo, nº do atendimento, nº do título, competência |
| Confiança na tela | Indicadores e logs inventados | Dado simulado removido sistematicamente |

**Defeitos silenciosos encontrados e corrigidos antes de causarem dano** — cada um deles
passaria despercebido em uso: o salvamento de monitorias estava 100% bloqueado; um código
sorteado podia gravar uma monitoria por cima de outra; as metas eram gravadas sempre em junho;
os relatórios exportavam só junho; rascunhos acusavam eliminatórios que ninguém marcou;
gestores cadastrados não conseguiam entrar; e a primeira monitoria real não teria chegado à
validação.

## Os riscos

| Risco | Nível | Mitigação atual |
|---|---|---|
| **Dados no navegador**: perda total ao limpar o navegador, base isolada por máquina, sem cópia automática | 🔴 Alto | Estação única e backup manual |
| **Operação ainda sem volume** para calibrar a régua e validar o desenho com uso real | 🟠 Médio | Calibração prevista antes da IA integrada |
| **Concentração de conhecimento e decisão** numa única pessoa, que acumula administração, monitoria e as decisões de produto | 🟠 Médio | Documentação extensa em `docs/` e no changelog |
| **Dados de clientes na IA externa** | 🟠 Médio | Nenhuma formal — política a confirmar |
| **Plano sem área** ao entrar uma segunda área | 🟡 Baixo agora | Resolver antes do cadastro |
| **Sem testes automatizados** na lógica de metas e competência | 🟡 Baixo agora | Verificação manual a cada versão |

## Os próximos investimentos recomendados

1. **Persistência centralizada (backend).** É o investimento que destrava todo o resto: acesso de
   várias pessoas à mesma base, IA integrada com segurança, portal do colaborador. Remove também
   o maior risco do projeto hoje.
2. **Consolidação da operação real.** Publicar a 0.25.0, lançar o histórico desde janeiro e
   calibrar a régua com monitorias reais. Custo baixo, e é o que dá significado a qualquer
   análise posterior.
3. **Acompanhamento de evolução e foco de desenvolvimento.** O primeiro passo concreto do Portal
   de Desenvolvimento, possível assim que houver histórico real.
4. **IA integrada ao formulário**, com aceite critério a critério, depois do backend e da
   calibração.
5. **Portal do colaborador e substituição do PDI**, fechando a transformação de ferramenta de
   monitoria em plataforma de desenvolvimento.
