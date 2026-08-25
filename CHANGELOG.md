# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
