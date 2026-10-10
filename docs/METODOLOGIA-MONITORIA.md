# Metodologia de Monitoria — Base Única

> **RÉGUA 2.0 — vigente para avaliações registradas a partir de 12/10/2026.** Calibração
> aprovada em 10/10/2026 (§9, "Decisões de calibração"): princípio de cumprimento, regra de
> não duplicidade, evidência insuficiente e justificativa obrigatória no `N/A` (§2); âncoras
> revisadas dos critérios 4 (sub-pergunta 4), 6, 9, 12, 13, 16, 19, 22 e 23, e fronteiras
> 5 × 7 e 16 × 18 (§4); relatório com oportunidades e não conformidades separadas (§7).
> **Pesos, escala 2 / 1 / 0 e eliminatórios não mudaram.** Avaliações registradas antes de
> 12/10/2026 seguem a régua 1 e não são reavaliadas.

> **Fatia 3A.0. RÉGUA VALIDADA em 25/08/2026** — 32 itens revisados, 32 aprovados, nenhum
> ajuste; as 7 decisões da pauta estão encerradas (§9). Este documento deixa de ser proposta e
> passa a ser **a régua oficial**: é dele que sai o cadastro no sistema e o corpo da instrução
> do `instructionBuilder` (3A.1).
>
> Escrito em 24/08/2026. **Revisado em 25/08/2026 para o estado da 0.17.0** — quatro versões
> publicadas no intervalo mexeram no que a régua descreve. As marcas de revisão estão em §2
> (quarta forma de resposta), §4 (critério 3 inativo e opções cadastradas), §7 (o protocolo
> mudou de natureza) e no Estado da fatia, ao final.
>
> Produção atual: **0.17.0**, commit `fa5a5e0`.

## Sumário

1. [Para que serve este documento](#1-para-que-serve-este-documento)
2. [Como a nota é calculada](#2-como-a-nota-é-calculada)
3. [Estrutura da avaliação](#3-estrutura-da-avaliação)
4. [Régua critério a critério](#4-régua-critério-a-critério)
5. [Eliminatórios](#5-eliminatórios)
6. [Regras por tipo de atendimento](#6-regras-por-tipo-de-atendimento)
7. [Estrutura do relatório](#7-estrutura-do-relatório)
8. [Regras de escrita](#8-regras-de-escrita)
9. [Divergências e decisões pendentes](#9-divergências-e-decisões-pendentes)

---

## 1. Para que serve este documento

Uma única régua, quatro consumidores:

| Consumidor | O que consome |
|---|---|
| **MonitorIA** (cadastro de critérios) | `orientacao` e `ancoras` de cada critério, via Admin |
| **`instructionBuilder`** (3A.1) | tudo — é o corpo da instrução gerada |
| **Assistente / Copilot** (3A.2–3A.3) | a régua, para sugerir nota e justificativa com evidência |
| **Treinamento de monitoras** | seções 4 a 8, como material de calibração |

### Fontes

| Fonte | Papel |
|---|---|
| `CYF© Quality Management System` (PDF) | **Validação da estrutura.** Define os 28 critérios, os 7 blocos e quais são eliminatórios. Não é lido em execução — já está cadastrado em `INITIAL_CRITERIA`. |
| `Padrão Relatório de Monitoria` (DOCX) | **Régua e narrativa.** Traz a orientação detalhada de cada critério e a estrutura dos blocos do relatório. |
| `ORIENTAÇÕES TIPOS DE ATENDIMENTO/` | **Processo.** Regras de sequência específicas de cada tipo de atendimento. Hoje só existe *ANTECIPAÇÃO PAGAMENTOS*. |

### O que este documento **não** decide

Nota final, aprovação, zeramento e envio continuam sendo do sistema e das pessoas. A régua
descreve como julgar um critério; não substitui julgamento.

---

## 2. Como a nota é calculada

Registrado aqui para que a régua nunca contradiga o código
([`MonitoringForm.tsx:228`](../src/modules/monitoring/MonitoringForm.tsx)).

```
nota (%) = Σ (valor × peso) ÷ Σ (2 × peso) × 100
```

- **Cada critério vale de 0 a 2.** O 2 é o teto; não existe nota acima do esperado.
- **Peso 0 não entra na conta.** Vale para os 3 critérios de classificação (1–3) e para os
  4 eliminatórios (25–28). Eles são respondidos, contam na barra de progresso, mas não
  movem a nota.
- **`N/A` sai do denominador.** Marcar `N/A` não penaliza nem premia — apenas retira o
  critério do cálculo. Por isso `N/A` precisa ser justificado, com o motivo da não
  aplicabilidade (régua 2.0 — ver "Justificativa no N/A", abaixo).
- **Eliminatório não zera automaticamente.** Marcar "Sim, ocorreu" sinaliza a monitoria como
  `eliminatoryPending`. Quem zera é Gestor ou Admin, por confirmação explícita (F0-08).

**Conceitos da nota** ([`scoreUtils.ts`](../src/scoreUtils.ts)): ≥95 Excelente · ≥85 Muito Bom ·
≥75 Bom · ≥50 Atenção · <50 Crítico.

### Escala de resposta

O CYF documenta uma escala de 4 níveis (Ótimo / Bom / Regular / Ruim). O sistema implementa
**3 níveis**. A régua abaixo usa a do sistema:

| Valor | Rótulo na tela | Significado na régua |
|---|---|---|
| **2** | Excelente | Executou de forma completa e no momento certo, e a conduta produziu efeito |
| **1** | Parcial | Executou incompleto, fora do momento, ou sem confirmar o resultado |
| **0** | Não realizou | Não executou, ou executou de forma que prejudicou o atendimento |
| **N/A** | Não se aplica | O atendimento não ofereceu situação em que o critério pudesse ocorrer |

**Exceção 1 — `FAIXA_TEMPO`** (critério 5): valores fixos `2 / 1,33 / 0,67 / 0`.

**Exceção 2 — `CHECKLIST_SIM_NAO`** (critérios 4 e 24): o valor é proporcional às
sub-perguntas respondidas com SIM — `(SIM ÷ total) × 2`. O critério 4 tem 4 sub-perguntas
(0 · 0,5 · 1 · 1,5 · 2); o 24 tem 2 (0 · 1 · 2). **Nestes dois, a âncora é por
sub-pergunta**, não por nível.

**Exceção 3 — `MULTIPLA_ESCOLHA`** *(a partir da 0.16.0)*: **não tem nota.** Os critérios de
classificação guardam o **texto da opção escolhida** — "Reclamação", "Receptivo" — e não um
número. Não pontuam, não pedem justificativa e não entram no denominador.

Até a 0.15.0 eles caíam na escala pontuável e apareciam como 2 / 1 / 0 / N/A, como se o motivo
do contato fosse desempenho. Por isso a régua deles, no Bloco 1, é uma **régua de classificação**
— quando usar cada opção — e não âncoras de nível.

> **O campo `score` carrega quatro coisas**, então: número (critérios pontuáveis), `'N/A'`,
> `''` (não respondido) e texto (classificação). Quem for escrever regra sobre ele precisa
> comparar de forma estrita — `''` e texto se comportam como zero em coerção numérica, e zero
> tem significado próprio nos eliminatórios.

### Cumprido, parcialmente cumprido e não cumprido *(régua 2.0)*

A monitoria serve ao desenvolvimento profissional: reconhece o que foi cumprido, desconta o que
de fato faltou e registra o que pode melhorar. **Uma oportunidade de melhoria não gera desconto
quando o requisito foi cumprido.** Isso não flexibiliza requisito obrigatório nem autoriza nota
alta sem evidência.

Toda resposta abaixo de 2 responde a uma pergunta: **qual parte da âncora não foi cumprida, e
onde isso aparece no atendimento?**

| Situação | O que é | Nota |
|---|---|---|
| **A — Requisito cumprido** | O comportamento esperado aconteceu | Integral. Se havia como fazer melhor, a sugestão vai para o relatório, em "Oportunidades sem desconto" (§7) |
| **B — Parcialmente cumprido** | Uma parte identificável do comportamento obrigatório faltou ou ficou incompleta | Conforme a âncora |
| **C — Não cumprido** | O comportamento esperado não aconteceu, sendo aplicável | Conforme a âncora |

Justificativa que não aponta o requisito faltante é sinal de A. Expressões como *"poderia ser
mais…"*, *"havia oportunidade de…"* ou *"seria melhor se…"*, sozinhas, descrevem melhoria — não
descumprimento.

### Uma causa raiz, um desconto *(régua 2.0)*

1. Identificar o comportamento que faltou, com o trecho ou o momento do atendimento.
2. Descontar no critério que tem esse comportamento como objeto principal (o "O que mede" de
   cada critério, §4).
3. Outro critério só desconta com **evidência própria**: outro comportamento, outro momento ou
   outro efeito no cliente, que descumpra um requisito que só ele tem. Se a única evidência for
   o mesmo trecho, o segundo critério registra orientação, não desconto.

**Exceção:** clareza (12) e veracidade (18) são requisitos distintos por definição — meia-verdade
desconta nos dois (ver "Não confundir com o 18", critério 12).

| Situação | Desconto | Desconto separado só quando… |
|---|---|---|
| Não recapitulou ao final | crit-22 | o 9 tem evidência própria (ex.: etapas explicadas fora de ordem) |
| Informou prazo errado | crit-18 | também faltou outro dado de que o cliente precisava (16) |
| Pediu "um momento" logo ao atender | crit-5 | houve outra espera, mais tarde, sem aviso (7) |
| Gíria na saudação | sub-pergunta 2 do crit-4 | a informalidade se repetiu ao longo do atendimento (14) |
| Omitiu a taxa e não checou o entendimento | crit-12 **e** crit-22 | — são dois comportamentos, em dois momentos |

### Evidência insuficiente *(régua 2.0)*

Quando a evidência não permite confirmar nem o cumprimento nem o descumprimento, o critério vai
para **revisão humana**: não se atribui nota máxima por falta de prova, nem nota baixa por
cautela. A monitora decide com a gravação ou a conversa.

No fluxo com o assistente, as revisões humanas são **resolvidas antes de gerar o JSON** de
importação: o JSON leva a versão aprovada pela monitora. Se ainda assim um critério chegar com
`revisaoHumana: true`, o MonitorIA exige a confirmação individual dele antes de aplicar.

> **Limitação conhecida (0.25.0).** A confirmação individual na importação é uma marcação: ela
> impede aplicar sem um clique em cada item, mas não comprova a revisão. Depois de aplicada, a
> monitoria não guarda quais critérios estavam em revisão, e numa resposta de nota máxima o
> motivo da revisão nem chega ao formulário. **Medida de segurança até a evolução técnica:**
> (1) só marcar a confirmação depois de conferir o trecho na gravação ou na conversa; (2) o
> assistente não entrega o JSON com revisão humana pendente; (3) a evolução técnica prevê o
> critério chegar **sem resposta** ao formulário quando a evidência for insuficiente, e o
> registro da revisão na própria monitoria.

### Justificativa no `N/A` *(régua 2.0)*

Todo `N/A` leva justificativa com o **motivo da não aplicabilidade** — por que o atendimento não
ofereceu a situação que o critério avalia (ex.: *"Não houve espera durante a ligação"*). A
exceção é o `N/A` aplicado automaticamente pelo sistema (critério 25 com o 29 em "Sim"), cujo
motivo o próprio sistema registra na tela.

> **Pendência técnica.** O formulário e o importador ainda aceitam `N/A` sem justificativa. A
> regra vale desde já como orientação de preenchimento e é exigida do assistente, mas **não
> bloqueia** a conclusão da monitoria até a evolução técnica.

---

## 3. Estrutura da avaliação

| # | Bloco | Critérios | Peso somado | Papel |
|---|---|---|---|---|
| 1 | FORMAS DO CONTATO | 1–2 e 29 · o 3 está inativo | 0 | Classificação |
| 2 | ABERTURA | 4–5 | 2,0 | Como o atendimento começa |
| 3 | COMUNICAÇÃO | 6–14 | 11,0 | Como o atendente conduz |
| 4 | CONHECIMENTO DO PRODUTO/SERVIÇO | 15–17 | 5,0 | O que o atendente sabe |
| 5 | PRECISÃO DAS INFORMAÇÕES | 18–21 | 5,5 | Se o que foi dito se sustenta |
| 6 | ENCERRAMENTO | 22–24 | 3,5 | Como o atendimento fecha |
| 7 | MANDOU MAL | 25–28 | 0 | Eliminatórios |
| | **Total ponderável** | **21 critérios** | **27,0** | |

O peso 2,0 aparece em três critérios apenas — **6** (empatia), **16** (informação precisa) e
**18** (ausência de desinformação). São o centro de gravidade da nota: juntos valem 22% do
total. Um atendimento pode ser cordial e ainda assim tirar nota baixa se falhar nesses três.

---

## 4. Régua critério a critério

Cada critério traz: **o que mede**, a **orientação completa** (extraída do documento oficial),
as **âncoras**, **quando marcar N/A** e a **evidência observável** — o que precisa estar na
conversa para sustentar a nota.

> As âncoras nasceram como proposta desta fatia — nenhuma delas está no documento original: o
> CYF dá os níveis e o `Padrão Relatório` dá as boas práticas, mas ninguém tinha escrito o corte
> entre 2 e 1. Era a lacuna que a 3A.0 veio fechar. **Validadas em 25/08/2026**, item a item.

---

### Bloco 1 — FORMAS DO CONTATO

Critérios de **classificação**. Peso 0: não movem a nota. Existem para segmentar relatórios e
para dar contexto ao restante da avaliação — um contato de Reclamação lê-se diferente de um de
Informação.

> **Estado na 0.16.0.** As opções dos três estão **cadastradas no sistema** (campo
> `Criterion.opcoes`), e a tela as apresenta como botões de escolha única — sem escala e sem
> justificativa. O **critério 3 está inativo**: não aparece mais no formulário. O que se valida
> aqui, portanto, é a **régua de classificação** — quando usar cada opção — e não âncoras.

#### 1. Qual o motivo do contato?
`crit-01` · MULTIPLA_ESCOLHA · peso 0

**O que mede.** O motivo que originou o contato.

**Opções.** Informação · Solicitação · Reclamação · Sugestão

**Régua de classificação.**
- **Informação** — o cliente quer saber algo; nada precisa ser feito depois.
- **Solicitação** — o cliente pede uma ação (2ª via, cálculo, envio, alteração cadastral).
- **Reclamação** — há insatisfação declarada com atendimento, produto ou cobrança anterior.
- **Sugestão** — o cliente propõe melhoria, sem pedido nem queixa.

**Regra de desempate.** Quando o contato começa como Informação e vira pedido, classificar
pelo **desfecho**, não pela abertura. Quando há insatisfação declarada em qualquer ponto,
Reclamação prevalece sobre Solicitação.

---

#### 2. Atendimento ativo ou receptivo?
`crit-02` · MULTIPLA_ESCOLHA · peso 0

**O que mede.** Quem originou o contato.

**Régua.** **Ativo** — a empresa iniciou. **Receptivo** — o cliente iniciou.

**Cuidado.** Retorno de um contato anterior do cliente é **ativo** (a empresa discou), ainda
que a origem da demanda seja do cliente. O que se classifica é quem iniciou *este* contato.

---

#### 3. Atendimento realizado por qual canal?
`crit-03` · MULTIPLA_ESCOLHA · peso 0 · **inativo desde a 0.16.0**

> **Não aparece mais no formulário.** O Canal é campo obrigatório da etapa 1, e é ele que decide
> quais critérios entram na etapa 3 — perguntá-lo de novo dentro da lista que ele mesmo filtrou
> era redundância. O dado continua sendo capturado, em `Monitoring.canal`. O critério segue
> cadastrado, com as opções, e reativá-lo é uma decisão de uma tela só, no Admin.

**O que mede.** O canal do atendimento.

**Régua.** Registrar o canal em que o atendimento **efetivamente ocorreu**. Se começou no
WhatsApp e migrou para ligação, classificar pelo canal onde a demanda foi resolvida, e
descrever a migração no Contexto.

**Consequência.** Este campo governa quais critérios são aplicáveis (§4, coluna "canais") e
qual script de encerramento é exigido no critério 24.

---

#### 29. Cliente chegou autenticado?
`crit-29` · MULTIPLA_ESCOLHA · peso 0 · **⏳ aprovado, ainda não existe no sistema**

> **Aprovado em 25/08/2026.** Nasceu de um achado da revisão: o critério 25 acionava eliminatório
> em atendimento correto, porque a régua não tinha onde saber que a autenticação já havia
> ocorrido antes da interação humana.

**O que mede.** Se o canal identificou o cliente **antes** de a atendente assumir a conversa.
É classificação, não desempenho: não pontua e não pede justificativa.

**Fonte da regra.** O documento `APOIO ATENDIMENTOS` (Blip) define dois roteiros de abertura —
`AUTENTICADO`, que cumprimenta pelo nome, e `SEM AUTENTICAÇÃO`, que pede o nome. O que separa os
dois é o contato vir do número cadastrado: número diferente dispara a bateria de confirmação
(idade, telefone, e-mail, data de nascimento, RG, cônjuge).

**Régua de classificação.**

| | |
|---|---|
| **Sim** | A abertura cumprimenta pelo nome do cliente, sem pedir identificação e sem mencionar número divergente |
| **Não** | A abertura pede o nome, **ou** o roteiro de confirmação por número divergente foi acionado. **Também é a resposta em canais sem pré-autenticação** — telefone e presencial não têm esse passo |
| **Não identificável** | A conversa não permite determinar: começa no meio, a saudação parece manual, ou o registro está incompleto |

**Evidência.** As primeiras mensagens da conversa — o mesmo trecho que já sustenta o critério 4.

**Consequência.** Governa o critério 25: com **Sim**, o eliminatório de confirmação de dados
fica N/A.

**Limite conhecido.** Se a atendente cumprimentar pelo nome **manualmente**, sem o canal ter
autenticado, a saudação deixa de ser prova. A conversa sozinha não fecha esse caso — só um
marcador vindo do Blip resolveria. Por isso existe **Não identificável**, e por isso ela mantém
a exigência: na dúvida, o lado conservador.

---

### Bloco 2 — ABERTURA

#### 4. Cumprimentos / identificação
`crit-04` · CHECKLIST_SIM_NAO · peso 1,0 · **4 sub-perguntas**

**O que mede.** Se a abertura do atendimento cumpriu o padrão: saudação, identificação,
postura e disposição para ouvir.

**Orientação completa.**
- **Cumprimento e identificação** — abrir com saudação adequada ("Bom dia", "Boa tarde"),
  apresentar-se pelo nome e perguntar em que pode ajudar.
- **Adequação e profissionalismo** — linguagem formal e apropriada. Estão vedados tratamentos
  como "meu bem", "amor", "querido". Tom calmo e amigável.
- **Postura cortês** — respeito e educação durante toda a interação; paciência, sem
  interromper o cliente.
- **Escuta ativa e empatia** — demonstrar interesse genuíno, validar as preocupações do
  cliente e oferecer soluções práticas.

**Âncoras — por sub-pergunta (SIM / NÃO):**

| Sub-pergunta | SIM quando | NÃO quando |
|---|---|---|
| Realizou o cumprimento e identificação? | Há saudação **e** o atendente diz o próprio nome | Falta a saudação ou falta o nome |
| Cumprimentou de forma adequada e profissional? | Linguagem formal, sem gíria nem tratamento íntimo | Usou gíria, apelido ou tratamento íntimo |
| Demonstrou postura profissional e cortês? | Manteve respeito e não interrompeu | Interrompeu, respondeu com aspereza ou ironia |
| Reagiu ao que o cliente disse na abertura? *(régua 2.0; antes: "Apresentou escuta ativa, empatia e profissionalismo?")* | Na abertura, reagiu ao que o cliente disse antes de seguir o roteiro | Seguiu o roteiro ignorando o que o cliente disse na abertura |

**Sub-pergunta 4 — só a abertura** *(régua 2.0)*. A empatia ao longo do atendimento é avaliada
no critério 6; avaliá-la também aqui descontaria duas vezes a mesma conduta.

**N/A.** Não se aplica — a abertura existe em todo atendimento. Em contato ativo, a
identificação é ainda mais exigível.

**Evidência.** As primeiras mensagens ou os primeiros segundos da ligação.

---

#### 5. Rapidez para atender a ligação
`crit-05` · FAIXA_TEMPO · peso 1,0

**O que mede.** O tempo entre o cliente buscar contato e ser efetivamente atendido.

**Orientação completa.** Atendimento rápido é essencial, mas sem comprometer a qualidade.
A regra operacional é ficar disponível para os WhatsApps e atender o telefone em até três
toques. Fatores que derrubam este critério: falta de preparo prévio, mexer no celular durante
o expediente, conversas paralelas, contatos pessoais sem toque diferenciado.

**Âncoras — fixas pelo widget:**

| Valor | Faixa | Leitura |
|---|---|---|
| **2** | menos de 5 min | Padrão ouro |
| **1,33** | 5 a 15 min | Aceitável, com espaço para melhoria |
| **0,67** | acima de 15 min | Há obstáculo de processo a eliminar |
| **0** | pediu um momento no início | Falta de prontidão — o cliente esperou depois de já ter sido atendido |

**Leitura por canal.**
- **Telefone** — tempo até atender a chamada.
- **WhatsApp** — tempo entre a primeira mensagem do cliente e a primeira resposta **útil** do
  atendente. Mensagem automática ou "um momento" não conta como resposta: cai no nível 0,
  que é exatamente o que a orientação descreve.

**N/A.** Contato ativo — quem ligou foi a empresa.

**Fronteira com o 7** *(régua 2.0)*. Pedido de espera logo ao atender desconta só aqui
(nível 0). O critério 7 avalia as esperas posteriores.

**Evidência.** Carimbo de hora da primeira mensagem do cliente e da primeira resposta; ou o
campo de tempo registrado na monitoria.

---

### Bloco 3 — COMUNICAÇÃO

#### 6. Demonstrou interesse e empatia com o pedido do cliente?
`crit-06` · ESCALA_4 · **peso 2,0**

**O que mede.** Se o atendente tratou o pedido como o problema de alguém, e não como um
chamado a despachar.

**Orientação completa.**
- Fazer perguntas pertinentes para entender melhor a demanda.
- Demonstrar curiosidade genuína ("Gostaria de saber mais sobre isso").
- Reconhecer os sentimentos do cliente ("Eu entendo como isso pode ser frustrante").
- Usar tom calmo e acolhedor.

**Âncoras.**

| | |
|---|---|
| **2** | A resposta mostra que o pedido foi compreendido **e** reconhece a situação do cliente de forma contextual. Quando a demanda já estava clara, a própria resposta adequada demonstra a compreensão; quando não estava, o atendente buscou entender antes de responder. |
| **1** | Respondeu sem buscar entender o que não estava claro, e a resposta não corresponde inteiramente ao pedido; ou reconheceu a situação com fórmula pronta, sem conexão com o que o cliente disse. |
| **0** | Ignorou o conteúdo emocional ou factual do pedido; respondeu outra coisa; tratou o cliente como interrupção. |

**N/A.** Nunca. Todo contato tem um pedido.

**Evidência.** A primeira resposta do atendente depois de o cliente expor a demanda.

**Nota de calibração** *(régua 2.0)*. Não se exige pergunta, confirmação explícita ou frase de
empatia pronta quando a demanda já está clara. O que se avalia é escuta e reconhecimento
contextual: a resposta conversa com o que **este** cliente disse. Fórmula de empatia sem relação
com o caso não é 2; ausência de frase pronta não é 1 quando a resposta mostra escuta.

---

#### 7. Avisou que ia buscar informações antes de deixar o cliente em espera?
`crit-07` · ESCALA_4 · peso 1,0

**O que mede.** Se a espera foi anunciada antes de acontecer.

**Orientação completa.** Antes de se ausentar, explicar claramente que precisa de um momento
para obter a informação. Frase-modelo: *"Vou verificar essa informação para você, por favor
aguarde um momento."* Isso mantém o cliente informado, evita frustração e reforça a percepção
de profissionalismo.

**Âncoras.**

| | |
|---|---|
| **2** | Avisou **antes** de sair, e disse o que ia fazer ("vou verificar no sistema"). |
| **1** | Avisou de forma genérica ("um momento") sem dizer o motivo; ou avisou depois de já ter sumido. |
| **0** | Sumiu sem avisar. |

**N/A.** Não houve espera. **No telefone** *(régua 2.0)*, considera-se espera o silêncio ou a
música de espera acima de **60 segundos** — parâmetro inicial, revisável com o uso; pedido de
espera logo ao atender é avaliado no critério 5. **No WhatsApp**, considera-se espera um intervalo relevante entre
a última mensagem do cliente e a resposta seguinte, dentro de uma conversa em andamento.

**Evidência.** A mensagem imediatamente anterior ao intervalo.

---

#### 8. Ao retomar o contato agradeceu o tempo de espera?
`crit-08` · ESCALA_4 · peso 1,0

**O que mede.** Se o retorno da espera reconheceu o tempo do cliente.

**Orientação completa.** Ao retornar, agradecer: *"Obrigado por aguardar"*, *"Agradeço sua
paciência"*. Demonstra respeito e consideração.

**Âncoras.**

| | |
|---|---|
| **2** | Agradeceu ao retomar, antes de entregar a informação. |
| **1** | Retomou com a informação e agradeceu depois, ou de forma protocolar desconectada da espera real. |
| **0** | Retomou direto, sem qualquer reconhecimento. |

**N/A.** Não houve espera — mesma leitura do critério 7. **Os critérios 7 e 8 andam juntos**:
se um é N/A, o outro também é.

**Evidência.** A primeira mensagem do atendente após o intervalo.

---

#### 9. Teve didática para explicar?
`crit-09` · ESCALA_4 · peso 1,0

**O que mede.** Se o cliente foi capaz de entender a explicação, e não se o atendente falou
corretamente.

**Orientação completa.**
- **Simplicidade** — linguagem clara e acessível, sem jargão nem termo técnico complexo.
- **Estruturação** — a explicação tem introdução (contexto), corpo (passo a passo) e conclusão
  (resumo e próximo passo).
- **Exemplificação** — usar exemplo prático quando o ponto for complexo. Ex.: *"você clica em
  Abrir, digita o CPF sem pontos e sem traço, apenas números, depois clica em ok…"*
- **Feedback contínuo** — checar durante a explicação: *"Isso faz sentido até agora?"*,
  *"Posso explicar de outra forma?"*
- **Empatia e paciência** — acolher a dúvida sem pressa.
- **Revisão e resumo** — fechar recapitulando: *"Então, para recapitular, você precisa…"*

**Âncoras.**

| | |
|---|---|
| **2** | Explicou as etapas necessárias em ordem lógica e linguagem simples, e o cliente entendeu sem precisar repetir a pergunta. Checagem durante a explicação conta a favor. |
| **1** | Explicação correta, mas desorganizada (etapas fora de ordem, bloco único) ou com jargão não explicado; ou o cliente precisou perguntar de novo o mesmo ponto. |
| **0** | Explicação confusa, incompleta ou que deixou o cliente perguntando a mesma coisa de novo. |

**N/A.** Atendimento sem nada a explicar (ex.: só confirmar recebimento).

**Evidência.** O trecho da explicação. Sinal forte de nota 1 ou 0: o cliente repete a pergunta.

**Não confundir com o 22.** O 9 avalia a explicação; o 22 avalia a checagem final antes de
encerrar. A checagem *durante* a explicação pertence ao 9. **A falta de resumo final não
desconta aqui** — é objeto do 22 *(régua 2.0)*.

---

#### 10. Fez argumentações pertinentes?
`crit-10` · ESCALA_4 · peso 1,0

**O que mede.** Se a resposta atacou o problema apresentado.

**Orientação completa.**
- **Base em fatos** — argumentar com informação precisa e verificável.
- **Relevância** — manter o foco no problema do cliente, evitando informação desnecessária.

**Âncoras.**

| | |
|---|---|
| **2** | Argumentos apoiados em dado concreto (valor, data, cláusula, regra) e ligados ao pedido. |
| **1** | Argumentos genéricos ou corretos porém dispersos, com informação que o cliente não pediu. |
| **0** | Argumentou fora do ponto, ou apresentou argumento sem sustentação. |

**N/A.** Não houve necessidade de argumentar (pedido direto e atendido).

---

#### 11. Lidando com objeções
`crit-11` · ESCALA_4 · peso 1,5

**O que mede.** A condução quando o cliente discorda, resiste ou contesta.

**Orientação completa.**
- **Escuta ativa** — ouvir a objeção inteira, sem interromper.
- **Empatia** — acolher o sentimento ("Eu entendo que isso é frustrante").
- **Resposta com informação** — responder com fato: política, termo do acordo, cláusula.
- **Perguntas de sondagem** — *"Pode me explicar mais sobre sua preocupação com essa taxa?"*
- **Oferta de solução** — propor saída dentro da política, com flexibilidade quando possível.
- **Manter a calma** — tom profissional mesmo diante de irritação.
- **Resumir e validar** — fechar a objeção confirmando o acordo com o cliente.
- **Acompanhamento** — se não resolveu na hora, garantir o seguimento e informar o cliente.

**Âncoras.**

| | |
|---|---|
| **2** | Ouviu, acolheu, respondeu com fato e confirmou com o cliente que a objeção foi resolvida. |
| **1** | Respondeu a objeção com informação correta, mas sem acolher ou sem confirmar; ou resolveu no atrito. |
| **0** | Ignorou a objeção, repetiu a mesma resposta sem reformular, ou entrou em confronto. |

**N/A.** Não houve objeção. **Marcar N/A aqui é comum e legítimo** — não forçar nota.

**Não confundir com o 21.** O 11 é discordância; o 21 é tensão emocional. Podem coexistir.

---

#### 12. Comunicação clara e transparente
`crit-12` · ESCALA_4 · peso 1,5

**O que mede.** Se o cliente saiu sabendo o que é verdade, inclusive o que é desfavorável.

**Orientação completa.**
- **Linguagem clara e simples** — sem jargão nem termo técnico complicado.
- **Estrutura** — problema → soluções possíveis → próximos passos.
- **Transparência** — ser honesto sobre o que pode e o que não pode ser feito. *Não mentir e
  não dar resposta sem conhecimento total do assunto apenas para ser ágil* — a consequência
  dessa conduta é desgaste com o cliente. Informar limitações e procedimentos desde o início.
- **Checagem** — *"Isso faz sentido para você?"*, *"Posso esclarecer algo mais?"*
- **Atualizações regulares** — informar progresso, mudança ou atraso imediatamente.

**Âncoras.**

| | |
|---|---|
| **2** | Disse o que pode e o que não pode ser feito, incluindo a condição desfavorável relevante (prazo, custo, limitação), e deixou claro o próximo passo do cliente, em linguagem simples. |
| **1** | Omitiu ou suavizou informação desfavorável relevante; **ou** não informou o próximo passo que o cliente precisava dar. |
| **0** | Deixou ambiguidade que gera nova ligação, ou deu resposta sem base para encerrar rápido. |

**N/A.** Nunca.

**Não confundir com o 18.** O 12 é *clareza e completude*; o 18 é *veracidade*. Meia-verdade
dita com clareza é 12 baixo e 18 baixo; verdade dita de forma confusa é 12 baixo e 18 alto.

**Não desconta aqui** *(régua 2.0)*: a síntese final (é do 22) e a ordem da explicação (é do 9).

---

#### 13. Gramática escrita e falada
`crit-13` · ESCALA_4 · peso 1,0

**O que mede.** Correção da língua portuguesa na escrita e na fala.

**Orientação completa.** A gramática correta transmite imagem profissional, gera credibilidade
e evita mal-entendidos. O oposto reflete na imagem da empresa e faz o cliente duvidar da
informação recebida.

**Âncoras.**

| | |
|---|---|
| **2** | Sem erro que comprometa a correção ou a imagem da comunicação. Na fala, a informalidade natural — contrações como "tá" e "pra", hesitações, retomadas — não é erro. |
| **1** | Erro concreto que não compromete o entendimento: desvio de concordância, regência, digitação ou acento; ou vício de linguagem que, pela repetição ou pela natureza, chama atenção na conversa. |
| **0** | Erros que comprometem o entendimento ou a credibilidade da informação, pela frequência ou pela gravidade; escrita sem pontuação; abreviação de mensagem pessoal ("vc", "blz", "pq") em canal institucional. |

**Leitura por canal.** No **WhatsApp** avalia-se o texto escrito; no **telefone**, a fala —
concordância, vício de linguagem, clareza de dicção.

**Como decidir** *(régua 2.0)*. Não há número mínimo de ocorrências. A decisão pesa quatro
fatores:

- **Recorrência** — desvio isolado ou padrão que se repete;
- **Natureza** — informalidade própria da fala ou erro gramatical de fato;
- **Impacto** — atrapalhou o entendimento ou afetou a credibilidade da informação;
- **Evidência** — o trecho do erro ou do vício. **Sem trecho citado, não há desconto.**

**N/A.** Nunca.

---

#### 14. Tom de voz Moura Leite
`crit-14` · ESCALA_4 · peso 1,0

> ⚠️ A orientação deste critério no `Padrão Relatório` está errada: repete o texto do
> critério 13. A régua abaixo é **proposta nova** e precisa de validação (§9, divergência 1).

**O que mede.** Aderência à identidade de comunicação da Moura Leite — não a simpatia
individual do atendente.

> **Definição validada em 25/08/2026.** O tom Moura Leite é: **cordial e acolhedor ·
> profissional · respeitoso · sem excesso de intimidade · sem burocratizar o atendimento · sem
> transferir responsabilidades para outras áreas · consistente do início ao fim.**
>
> Esta é a definição da própria área, e substitui a interpretação que este documento propunha —
> a orientação original do `Padrão Relatório` era texto copiado do critério 13.

**Orientação.** O tom Moura Leite é **profissional, cordial e acolhedor**. Na prática:
- Trata o cliente pelo nome, com formalidade respeitosa — nunca por apelido ou tratamento
  íntimo.
- É acolhedor sem ser íntimo, e formal sem ser burocrático.
- Não terceiriza culpa ("o sistema não deixa", "isso é o financeiro") — fala como empresa.
- Não usa ironia, sarcasmo nem impaciência, mesmo com razão.
- Mantém o mesmo tom do começo ao fim, inclusive quando o cliente muda o dele.

**Âncoras.**

| | |
|---|---|
| **2** | Tom consistente e alinhado do início ao fim; o cliente é tratado como cliente da empresa, não da pessoa. |
| **1** | Tom adequado mas oscilante — cai em informalidade, burocratês ou distanciamento em alguns trechos. |
| **0** | Tom que destoa da marca: seco, irônico, íntimo demais, ou que empurra a responsabilidade para outra área. |

**N/A.** Nunca.

**Não confundir com o 4.** O 4 avalia a abertura; o 14 avalia o atendimento inteiro.

---

### Bloco 4 — CONHECIMENTO DO PRODUTO/SERVIÇO

#### 15. O agente demonstrou habilidades de negociação eficazes?
`crit-15` · ESCALA_4 · peso 1,5

**O que mede.** A condução quando há valor, prazo ou condição a acordar.

**Orientação completa.**
- **Clareza e transparência** — explicar os valores cobrados e a composição de forma acessível,
  seja contrato, IPTU ou registro de lote. Ex.: *"Este valor referente ao IPTU é composto
  por…"*.
- **Escuta ativa e empatia** — ouvir a dificuldade sem interromper: *"Entendo sua situação…"*,
  *"Compreendo que isso pode ser um desafio…"*.
- **Flexibilidade e solução de conflitos** — oferecer opções (parcelamento, prazo estendido) e
  buscar meio-termo: *"Podemos dividir esse valor em três parcelas…"*.

**Âncoras.**

| | |
|---|---|
| **2** | Explicou a composição do valor, ouviu a limitação do cliente e ofereceu opção viável dentro da política. |
| **1** | Informou o valor e a condição corretamente, mas sem explorar alternativa nem investigar a situação do cliente. |
| **0** | Apenas informou o valor e encerrou; ou ofereceu condição fora da política. |

**N/A.** Atendimento sem negociação — informação, 2ª via simples, atualização cadastral.
**Este é o critério com N/A mais frequente**; forçar nota aqui distorce a média.

---

#### 16. Forneceu informações precisas e relevantes para resolver o problema do cliente?
`crit-16` · ESCALA_4 · **peso 2,0**

**O que mede.** Se a informação entregue era certa e era a que resolvia.

**Orientação completa.**
1. **Compreensão completa** — entender o problema antes de responder. *"Pode me explicar um
   pouco mais sobre o problema?"*, *"Há algum detalhe específico que devo saber?"*
2. **Informação precisa** — apoiada em dado verificável. Na dúvida, verificar antes: *"Vou
   conferir essa informação para garantir que está correta."*
3. **Relevância** — focar na questão apresentada, sem desviar para outras áreas do serviço.
   Se a pergunta é sobre uma cobrança específica, tratar daquela cobrança.

**Âncoras.**

| | |
|---|---|
| **2** | Entendeu o pedido, entregou informação correta e completa, e só o que era necessário. |
| **1** | Informação correta, mas faltou um **dado identificável** de que o cliente precisaria (nomear qual), ou houve excesso que confundiu. |
| **0** | Não respondeu ao que foi perguntado, ou faltou o essencial para o cliente seguir. |

**N/A.** Nunca — sempre há informação em jogo.

**Evidência.** O dado entregue, textual: valor, data, prazo, procedimento.

**Fronteira com o 18** *(régua 2.0)*. Informação errada ou desatualizada desconta no 18. O 16 só
desconta junto se, além do erro, faltou dado de que o cliente precisava. A organização da
explicação não desconta aqui (é do 9).

---

#### 17. Ofereceu uma solução que atendesse às necessidades do cliente?
`crit-17` · ESCALA_4 · peso 1,5

**O que mede.** Se o desfecho responde ao pedido **inicial**.

**Orientação completa.** A solução final deve responder diretamente ao que o cliente pediu no
começo, evitando resposta genérica ou automática.

**Âncoras.**

| | |
|---|---|
| **2** | O desfecho corresponde ao pedido inicial e o cliente confirmou que atendia. |
| **1** | Ofereceu solução parcial, ou solução correta que o cliente não confirmou aceitar. |
| **0** | Encerrou sem solução, ou entregou algo diferente do que foi pedido. |

**N/A.** Nunca.

**Teste prático.** Comparar a **primeira** mensagem do cliente com a **última** do atendente.
Se não conversam, a nota não é 2.

**Não confundir com o 19.** O 17 é *a solução foi a certa?*; o 19 é *foi resolvida agora?*

---

### Bloco 5 — PRECISÃO DAS INFORMAÇÕES

#### 18. O agente evitou desinformação ou engano?
`crit-18` · ESCALA_4 · **peso 2,0**

**O que mede.** Ausência de informação falsa, inventada ou prometida sem base.

**Orientação completa.** Desinformação leva a mal-entendido, insatisfação e perda de confiança,
e gera consequência negativa para a empresa e para o cliente. Sempre verificar a precisão antes
de repassar; na dúvida, consultar fonte confiável, colega ou supervisor.

> **Nunca se comprometa com informação que não tenha plena certeza ou que não dependa do seu
> escopo de trabalho.**

**Âncoras.**

| | |
|---|---|
| **2** | Tudo o que foi afirmado se sustenta. Onde não sabia, disse que ia verificar. |
| **1** | Afirmou com segurança algo que deveria ter confirmado antes, mesmo que por sorte estivesse certo. |
| **0** | Passou informação incorreta, ou afirmou o que não podia garantir. |

**N/A.** Nunca.

**Fronteira com o eliminatório 28.** Informação errada por engano é **18 = 0**. Promessa de
produto, condição ou serviço que **não existe** é **eliminatório 28** — e aciona `28`, não
apenas nota baixa no 18.

**Fronteira com o 16** *(régua 2.0)*. O erro de informação é avaliado aqui; o 16 só desconta junto
se, além do erro, faltou dado de que o cliente precisava.

---

#### 19. Resolução no Primeiro Contato — FCR
`crit-19` · ESCALA_4 · peso 1,5

**O que mede.** Se **a demanda apresentada pelo cliente** foi resolvida neste contato, sem
retorno, transferência ou novo contato *(régua 2.0)*. A conclusão de um processo que tem etapas
posteriores não é o objeto deste critério.

**Orientação completa.** FCR é resolver na primeira vez, sem follow-up e sem transferência.
Depende de: preparação adequada (conhecer produtos, serviços e políticas, com acesso rápido à
informação); escuta ativa; proatividade na busca da solução, inclusive consultando colegas
quando necessário; e confirmação com o cliente de que todas as dúvidas foram resolvidas antes
de encerrar.

**Primeiro, identificar a demanda** *(régua 2.0)*:

| Situação | Leitura |
|---|---|
| **Orientação concluída** — o cliente quer saber como fazer ou como funciona | **2** quando a orientação entregue permite ao cliente dar o próximo passo sem novo contato, ainda que o processo siga depois. Se faltou parte da orientação, 1 ou 0 |
| **Solicitação que a própria atendente executa** — 2ª via, atualização cadastral, envio | **2** se executada neste contato; **1** se prometida para depois |
| **Solicitação registrada para outra área** — análise, cálculo, aprovação | O registro correto **não é resolução**. Se a resolução dependia, por natureza, da outra área e o registro foi correto: **N/A**, com o motivo |
| **Encaminhamento evitável** — estava no escopo da atendente, ou a informação estava disponível | **1** se a demanda foi resolvida no retorno; **0** se o cliente ficou dependendo de novo contato |
| **Encaminhamento incorreto ou incompleto** — área errada, dado faltando | **0** |

Encaminhar nunca equivale, por si só, a resolver. Informar o cliente sobre o próximo passo é
avaliado no critério 12, não aqui.

**Âncoras.**

| | |
|---|---|
| **2** | A demanda foi resolvida neste contato, sem transferência nem retorno: a orientação foi completa ou a solicitação foi executada. Etapas posteriores do processo não impedem o 2 quando a demanda era a orientação. |
| **1** | Resolvida, mas não no primeiro contato: transferência, consulta demorada, retorno prometido, ou encaminhamento que a própria atendente poderia ter evitado. |
| **0** | Não resolvida: o cliente vai precisar de novo contato pelo mesmo motivo; ou o encaminhamento foi incorreto ou incompleto. |

**N/A.** A resolução dependia, por natureza, de outra área, e a demanda foi registrada e
encaminhada corretamente (ex.: protocolo aberto que depende de área externa). Registrar o motivo.

---

#### 20. Demonstrou paciência e profissionalismo?
`crit-20` · ESCALA_4 · peso 1,0

**O que mede.** Postura sob pressão.

**Orientação completa.**
- **Paciência** — manter calma e serenidade mesmo com cliente frustrado ou impaciente. Respirar
  antes de responder em situação difícil; ouvir sem interromper; acolher ("Entendo que isso
  deve ser frustrante").
- **Profissionalismo** — atitude respeitosa e eficiente independentemente de fatores externos
  ou questões pessoais. Deixar problemas pessoais de lado, manter tom cortês em todas as
  interações e focar na resolução.

**Âncoras.**

| | |
|---|---|
| **2** | Manteve postura e ritmo mesmo quando o atendimento ficou difícil. |
| **1** | Manteve o profissionalismo, mas deixou transparecer pressa, cansaço ou desinteresse em algum trecho. |
| **0** | Perdeu a paciência, respondeu com aspereza, ou deixou questão pessoal invadir o atendimento. |

**N/A.** Nunca.

**Não confundir com o 21.** O 20 mede a **postura do atendente**; o 21 mede a **técnica
aplicada** para reduzir a tensão do cliente. Atendimento tranquilo tem 20 avaliado e 21 N/A.

---

#### 21. Aplicou técnicas de desescalada?
`crit-21` · ESCALA_4 · peso 1,0

**O que mede.** Uso deliberado de técnica para reduzir a temperatura da conversa.

**Orientação completa.**
- **Manter a calma** — tom sereno mesmo com o cliente exaltado. *"Entendo sua frustração, e
  estou aqui para ajudar."*
- **Empatia** — validar o sentimento. *"Eu posso imaginar como isso deve ser frustrante."*
- **Escuta ativa** — não interromper; sinalizar que está ouvindo.
- **Perguntas acalmantes** — *"O que podemos fazer para resolver isso juntos?"*
- **Soluções claras** — *"Vamos fazer o seguinte: eu verifico e retorno com uma solução."*
- **Evitar linguagem confrontadora** — em vez de *"Você está errado"*, dizer *"Vamos revisar
  isso juntos para encontrar o que deu errado."*

**Âncoras.**

| | |
|---|---|
| **2** | Aplicou técnica identificável e a tensão baixou — o cliente muda de tom depois. |
| **1** | Tentou acalmar, mas de forma genérica ou tardia; a tensão permaneceu. |
| **0** | Não tentou, ou escalou (respondeu na mesma temperatura, confrontou, culpou o cliente). |

**N/A.** **Não houve tensão no atendimento.** É a marcação esperada na maioria dos casos — a
própria orientação do critério diz que ele só é aplicável quando houver tensão.

---

### Bloco 6 — ENCERRAMENTO

#### 22. Verificou se o cliente entendeu as informações repassadas?
`crit-22` · ESCALA_4 · peso 1,0

**O que mede.** A checagem de entendimento **antes de encerrar**.

**Orientação completa.** Ao encerrar, assegurar que o cliente entendeu tudo, para evitar
confusão, insatisfação e novo contato. Como fazer:
- Resumir os pontos principais e as soluções: *"Para recapitular, discutimos [detalhes] e
  decidimos [solução]."*
- Perguntar se há dúvida: *"Isso faz sentido para você?"*, *"Há mais alguma coisa que eu possa
  esclarecer?"*
- Pedir que o cliente repita os pontos-chave ou os próximos passos.
- Confirmar satisfação: *"Você está satisfeito com a solução proposta?"*

**Âncoras.**

| | |
|---|---|
| **2** | Antes de encerrar, resumiu o essencial — o que foi informado e o próximo passo — **e** obteve a confirmação do cliente. Em atendimento com uma única informação ou orientação simples, confirmar diretamente o ponto principal também vale ("ficou claro que o próximo passo é X?"). |
| **1** | Só perguntou "tem mais alguma dúvida?", sem resumir nem confirmar o ponto principal; ou resumiu e encerrou sem esperar resposta. |
| **0** | Encerrou sem qualquer verificação. |

**N/A.** Atendimento sem informação a reter (ex.: só confirmação de recebimento).

**É o lugar da recapitulação** *(régua 2.0)*: a falta dela desconta aqui, uma vez. Perguntar
"mais alguma dúvida?" cumpre a sub-pergunta 1 do critério 24 (encerramento), mas não basta como
verificação de entendimento.

---

#### 23. Construção de relacionamento
`crit-23` · ESCALA_4 · peso 1,0

**O que mede.** O atendimento como parte de uma relação, não como transação isolada.
**Avalia o atendimento inteiro**, do cumprimento ao encerramento.

**Orientação completa.** Cumprimentar e identificar-se; escuta ativa; empatia e simpatia;
soluções personalizadas em vez de resposta automática; clareza e transparência; follow-up
quando não resolvido de imediato; oferecer valor adicional quando possível; agradecer e
reconhecer o cliente; pedir feedback sobre o atendimento; manter consistência de padrão.
O objetivo declarado é construir confiança e fidelização, evitando reclamação pública.

**Âncoras.**

| | |
|---|---|
| **2** | A condução partiu da situação deste cliente: retoma o que ele disse, adapta a orientação ao caso dele e reconhece o momento que ele vive, encerrando de forma que ele saiba que pode voltar. Não exige frase pronta nem combinação fixa de comportamentos — usar o nome é um sinal, não um requisito. |
| **1** | Correto e cordial, mas impessoal: a condução serviria a qualquer cliente, sem sinal de que considerou o caso dele. Indicar onde a condução foi genérica. |
| **0** | Transacional ou frio; o cliente foi tratado como chamado. |

**N/A.** Nunca.

**Nota de calibração.** Este critério é o mais fácil de inflar. Cordialidade isolada não é 2 —
o 2 exige personalização visível. *(Régua 2.0)* Frase de relacionamento sem condução
personalizada não é 2; ausência de frase pronta não é 1 quando a condução foi personalizada.

---

#### 24. Encerrou o contato corretamente?
`crit-24` · CHECKLIST_SIM_NAO · peso 1,5 · **2 sub-perguntas**

**O que mede.** Se o fechamento cumpriu o padrão institucional, incluindo o script obrigatório
do canal.

**Orientação completa.** Terminar de forma cordial, agradecendo o tempo do cliente e a
oportunidade de ajudar.

**Script obrigatório — WhatsApp:**

> Fico feliz em ter conseguido te auxiliar 😊
>
> Se surgir qualquer nova necessidade, é só nos chamar.
>
> Seguimos à disposição!

**Script obrigatório — telefone ou presencial:**

> Olá [nome do cliente], aqui é a [nome do atendente], tudo bem? Acabamos de conversar por
> [telefone / presencialmente], ficamos felizes em poder te atender! Precisando de mais alguma
> informação, fique à vontade para entrar em contato novamente por este canal.

**Âncoras — por sub-pergunta (SIM / NÃO):**

| Sub-pergunta | SIM quando | NÃO quando |
|---|---|---|
| Perguntou se o cliente possui mais alguma dúvida? | Perguntou **e** aguardou resposta | Não perguntou, ou perguntou e encerrou sem esperar |
| Despediu-se de forma correta? | Enviou o script do canal, com sentido preservado | Despedida improvisada, ou script de outro canal |

**Alteração de 07/10/2026 — a terceira sub-pergunta saiu.** *"Realizou incentivo à pesquisa de
satisfação?"* foi retirada porque a operação descontinuou o procedimento: manter a pergunta
penalizava o atendente por não executar uma ação que deixou de fazer parte do processo. O peso
do critério permanece 1,5 e a soma da régua permanece 27,0 — o que muda é que o critério passa
a valer 0, 1 ou 2, sem os intermediários de 0,67 e 1,33.

Monitorias validadas antes desta data **não foram recalculadas**: a nota é gravada no registro,
não recalculada na leitura. Reabrir e salvar uma delas, porém, recalcula o critério sobre as
duas sub-perguntas vigentes — por isso monitoria já validada não deve ser reaberta.

**Sobre "sentido preservado".** O script é padrão de conteúdo, não de decoreba. A própria
orientação de tipo de atendimento afirma que a monitoria **não mede frase exata nem texto
decorado**. Variação que mantenha os três elementos — satisfação em ter ajudado, convite a
novo contato, disponibilidade — conta como SIM.

**N/A.** Atendimento interrompido pelo cliente antes do fechamento. Nesse caso, verificar se
cabe o eliminatório 27.

---

## 5. Eliminatórios

Os quatro critérios do bloco **MANDOU MAL** têm peso 0 e resposta SIM/NÃO. Marcar "Sim,
ocorreu" **não zera a nota no ato**: sinaliza a monitoria como `eliminatoryPending`, e a
decisão de zerar é de Gestor ou Admin (F0-08).

> **Regra para o assistente (3A.2+):** eliminatório é **sinalizado com evidência**, nunca
> marcado. A marcação é da monitora; a confirmação é da gestão.

### 25. Confirmação de dados de segurança insuficiente
`crit-25` · SIM_NAO · eliminatório

**O que mede.** Se houve confirmação de identidade antes de repassar informação sensível.

**Orientação completa (LGPD nº 13.709/2018).**
- **Termo de autorização de terceiros** — o cliente pode autorizar que informações e boletos
  sejam repassados a terceiro, mediante solicitação consentida. A revogação também é por
  solicitação, e cancela o envio no Sienge.
- **Consultar a autorização** — antes de compartilhar, verificar no Extrato V do Sienge ou no
  CRM se o terceiro está autorizado.
- **Base legal** — quando não houver autorização, explicar que a informação não pode ser
  prestada por força da LGPD.
- **Registro** — registrar a tentativa de contato no contrato, com nome e telefone de quem
  solicitou.
- **Transparência** — contatar o cliente pelo telefone do Sienge, informar a tentativa e o
  bloqueio, e orientar sobre o Termo de Autorização de Terceiros se ele quiser autorizar.
- **Confirmação positiva** — usar perguntas de segurança que só o titular saberia: CPF,
  e-mail, data de nascimento, nome da mãe, telefone antigo, valor da parcela, data da compra,
  endereço.
- **Confirmação ativa** — ligar para o telefone cadastrado quando houver dúvida.
- **Verificação de documento** — último recurso: selfie com documento de identidade.

**Aciona quando.** Informação sensível (valores, saldo, parcelas, dados contratuais, boleto)
foi repassada **sem** confirmação positiva de identidade, ou a pessoa não é o titular e não
consta autorização.

**Não aciona quando.** O atendimento é receptivo pelo número cadastrado **e** houve confirmação
de ao menos um dado de segurança; ou nenhuma informação sensível foi repassada.

**Evidência exigida.** O trecho onde a informação sensível foi entregue, mais a ausência (ou
insuficiência) de confirmação anterior a ele.

> ### ⏳ Ajuste aprovado, ainda não aplicado — autenticação prévia
>
> **Aprovado em 25/08/2026, na revisão da régua.** A regra acima assume que a confirmação de
> identidade sempre acontece no atendimento humano. No processo real do Blip, **o cliente pode
> chegar já autenticado**: o roteiro de abertura tem duas versões, e a versão AUTENTICADO
> cumprimenta pelo nome porque o canal já sabe quem é. Exigir nova confirmação nesse caso
> penalizaria um atendimento correto.
>
> **Passa a valer, quando implementado:**
>
> | Critério 29 (novo) | Efeito no 25 |
> |---|---|
> | **Sim** — cliente chegou autenticado | **N/A.** A autenticação do canal substitui a confirmação no atendimento humano |
> | **Não** | regra atual, sem mudança |
> | **Não identificável** | regra atual — na dúvida, a confirmação era exigível |
>
> Depende do critério 29, descrito no Bloco 1. Enquanto ele não existir, **vale a regra atual**.

---

### 26. Faltou com respeito ao cliente
`crit-26` · SIM_NAO · eliminatório

**O que mede.** Tratamento rude, deselegante ou não profissional.

**Orientação completa.** Tratar mal um cliente gera insatisfação e perda de negócio; o cliente
insatisfeito compartilha a experiência, e comentário negativo em rede social ou site de
avaliação afasta novos clientes. Aumenta reclamações formais e afeta o ambiente de trabalho.

**Aciona quando.** Houve ofensa, ironia, deboche, grosseria, elevação de voz contra o cliente,
ou interrupção sistemática com desqualificação do que ele diz.

**Não aciona quando.** O atendente foi seco, apressado ou pouco empático — isso é nota baixa
nos critérios 14, 20 e 23, **não** eliminatório. A fronteira é o desrespeito, não a frieza.

**Evidência exigida.** A frase, transcrita.

---

### 27. Ligação derrubada ou atendimento encerrado sem atendimento do cliente
`crit-27` · SIM_NAO · eliminatório

> ⚠️ A orientação deste critério no `Padrão Relatório` está errada: repete o texto do
> critério 28. A régua abaixo era proposta nova — **validada em 25/08/2026**.

**O que mede.** Contato interrompido ou finalizado sem que o cliente tenha sido efetivamente
atendido. **O corte é pelo desfecho do atendimento**, não pela causa da interrupção.

**Aciona quando.**
- O cliente ficou **sem resposta**.
- O atendimento foi **abandonado**.
- Houve **encerramento sem resolução e sem retorno**.
- Houve **queda sem tentativa de contato posterior**.

**Não aciona quando.**
- O cliente **encerrou por conta própria após ser atendido**.
- Houve **tentativa comprovada de retorno**.
- A **interrupção não prejudicou a conclusão** do atendimento.

**Evidência exigida.** O ponto de interrupção e a ausência de retorno posterior.

**Vale igual para telefone e WhatsApp** — a régua é do desfecho, e o desfecho independe do canal.

---

### 28. Promessa de produto/serviço inexistente
`crit-28` · SIM_NAO · eliminatório

**O que mede.** Promessa de produto, condição ou serviço que a empresa não pratica.

**Orientação completa.** Avalia as promessas feitas ao colaborador. Condutas que levam a esta
falha: falta de atenção, desconhecimento dos produtos disponíveis, conversas paralelas com
colegas e uso do celular durante o expediente.

> **Não diga ao cliente coisas que não possa cumprir. Mantenha-se atualizado pela Info.**

**Aciona quando.** Foi prometido desconto, prazo, isenção, condição de parcelamento ou serviço
que não existe ou não está no escopo do atendente.

**Não aciona quando.** A informação estava errada mas o produto existe — isso é **18 = 0**.

**Evidência exigida.** A promessa, transcrita.

---

## 6. Regras por tipo de atendimento

Os 28 critérios avaliam **como** o atendente conduz. Eles não avaliam se o **processo** foi
cumprido na ordem certa — e é aí que mora a falha grave real. Esta seção existe para cobrir
isso, e é indexada por `categoriaAtendimento`, não por canal.

### Modelo de registro

Cada tipo de atendimento se descreve com quatro campos:

| Campo | O que é |
|---|---|
| `etapasObrigatorias` | Sequência que precisa acontecer, na ordem |
| `informacoesObrigatorias` | O que precisa constar em cada etapa |
| `falhasGraves` | Omissões que caracterizam erro de processo |
| `naoMede` | O que explicitamente **não** é avaliado — evita cobrança de decoreba |

### 6.1 ANTECIPAÇÃO PAGAMENTOS

*Fonte: `📌 ORIENTAÇÕES PARA AVALIAÇÃO – ANTECIPAÇÃO DE PARCELAS.docx`*

**Etapas obrigatórias, nesta ordem:**

1. **Identificação da solicitação** — identificar corretamente o que o cliente quer antecipar:
   próxima parcela, última parcela ou uma quantidade de parcelas.
   - Se o cliente já informou claramente ("quero antecipar as últimas 2"), **não perguntar de
     novo**.
   - Se não especificou, confirmar **antes** de calcular.
   - ❌ Falha: calcular algo diferente do que foi solicitado.

2. **Apresentação do cálculo — antes do boleto.** Etapa obrigatória. O cálculo deve conter:
   - Quantidade de parcelas, ou indicação clara de que é a última
   - Datas de vencimento
   - Valor total
   - Unidade (lote)
   - Empreendimento + cidade
   - Data de validade
   - Informação de que os valores são atualizados mensalmente

3. **Confirmação antes da emissão** — solicitar autorização para gerar o boleto e **aguardar a
   resposta** do cliente.

4. **Envio do boleto** — informar que está enviando, informar a senha e, havendo mais de um
   boleto, identificar a quais parcelas se referem.
   - **Não é necessário repetir lote e empreendimento** nesta etapa: o cliente já validou essas
     informações no cálculo. A comunicação pode ser mais simples e objetiva.

   Estrutura esperada, 1 boleto:
   > Obrigada por ter aguardado.
   > Segue boleto.
   > A senha é o número do CPF ou CNPJ sem pontos e sem traços.

   Estrutura esperada, mais de 1 boleto:
   > Obrigada por ter aguardado.
   > Seguem os boletos referentes às parcelas de setembro e novembro.
   > A senha é o número do CPF ou CNPJ sem pontos e sem traços.

**Falhas graves:**

| Falha | Reflexo na avaliação |
|---|---|
| Emitir boleto sem apresentar cálculo | Erro de processo · impacta 12, 16 e 17 |
| Não informar a validade do cálculo | Erro de processo · impacta 12 e 16 |
| Não informar que os valores são atualizados mensalmente | Erro de processo · impacta 12 e 18 |
| Não pedir autorização antes de emitir | Erro de processo · impacta 17 |
| Não informar a senha do boleto | Erro de processo · impacta 9 e 16 |
| Calcular diferente do solicitado | Erro de processo · impacta 16 e 17 |

**O que a monitoria mede neste tipo:** clareza · sequência correta do processo · segurança da
informação · cumprimento da estrutura.

**O que a monitoria NÃO mede:** texto decorado · frase exata · modelo fechado.

### 6.2 Demais tipos — fila de escrita

**Ordem definida em 25/08/2026**, por volume de atendimentos, risco operacional, impacto na
experiência do cliente e complexidade do processo:

| # | Tipo de atendimento | | # | Tipo de atendimento |
|---|---|---|---|---|
| 1 | BOLETOS | | 6 | CONTRATO |
| 2 | NEGOCIAÇÃO DE DÍVIDA | | 7 | FINANCIAMENTO |
| 3 | MANIFESTAÇÃO CLIENTE | | 8 | IPTU |
| 4 | TRANSFERÊNCIA DE TITULARIDADE | | 9 | PREFEITURA |
| 5 | TRANSFERÊNCIA DE LOTE | | 10 | JURÍDICO |

*ANTECIPAÇÃO PAGAMENTOS* (§6.1) permanece como **modelo de referência** para a construção das
próximas — é a única escrita, e a estrutura dela é o gabarito.

As 27 categorias do catálogo não precisam todas de orientação: só têm sentido onde existe
**sequência de processo a cumprir**. Categorias que são só assunto — `RECADO`, `UNIDADE` — se
resolvem com os 28 critérios gerais.

### 6.3 Transferência de titularidade × transferência de lote

Definido em 07/10/2026, porque os dois nomes se confundem e o catálogo é só uma lista de
rótulos — nada no sistema os distinguia.

| Categoria | Quando usar |
|---|---|
| **TRANSFERÊNCIA DE TITULARIDADE** | Muda **quem** detém os direitos do contrato; o lote permanece o mesmo. É aqui que entra a **cessão de direitos** |
| **TRANSFERÊNCIA DE LOTE** | Muda **qual** lote, permanecendo o mesmo titular |

**Cessão de direitos classifica-se como TRANSFERÊNCIA DE TITULARIDADE** e nunca como
transferência de lote. "CESSÃO DE DIREITOS" não é categoria do catálogo: é o instrumento
jurídico pelo qual a titularidade muda.

---

## 7. Estrutura do relatório

Sete blocos, na ordem do `Padrão Relatório de Monitoria`. A coluna "campo" indica onde cada um
vive — ou viveria — no modelo `Monitoring`.

**Título:** `Monitoria de Atendimento – [Ligação | WhatsApp] – [motivo do atendimento]`

| # | Bloco | Campo | Existe? |
|---|---|---|---|
| 1 | 🔎 Identificação | `date`, `colaboradorId`, `canal`, `numeroAtendimento`, `protocolo`, `numeroTitulo`, `inicioAtendimento`, `fimAtendimento`, `duracaoMinutos` | sim, menos `cliente` |
| 2 | 🧩 Contexto do Atendimento | `contexto` | **não** |
| 3 | ✅ Pontos Positivos | `strengths` | sim |
| 4 | ⚠️ Pontos de Atenção | `opportunities` | sim |
| 5 | 🧠 Leitura Técnica | `leituraTecnica` | **não** |
| 6 | 🔴 Erros Identificados | `errosIdentificados` | **não** |
| 7 | 🧾 Conclusão | `conclusao` | **não** |

`comments` permanece como observação livre da monitora e **não** é bloco do relatório.

### 1. Identificação

Atendente · Cliente · Canal · Título · Data · Início · Encerramento · Tempo total.

**Resolvido na 0.14.0.** O bloco passou a existir em tela, no detalhe da monitoria. `Título`
virou `numeroTitulo`, e `Início` / `Encerramento` / `Tempo total` são agora
`inicioAtendimento`, `fimAtendimento` e `duracaoMinutos` — este último calculado, nunca
digitado.

**O protocolo mudou de natureza na 0.15.0.** Era referência ao atendimento no sistema de origem;
passou a ser **gerado pelo sistema** (`MON-2026-0001`), no primeiro salvamento e nunca reescrito.
Não é mais digitado, e não é mais o elo com o atendimento — quem faz esse papel são
`numeroAtendimento` e `numeroTitulo`. Para a régua isso muda uma coisa só: **o protocolo deixou
de ser algo que a monitora informa**, e portanto não é objeto de avaliação nem de conferência.

**Lacuna remanescente:** o sistema ainda não tem `cliente`. Os três identificadores são as
chaves disponíveis, e o `numeroTitulo` é a mais próxima do cliente, por ser do contrato — ver
[VISAO-PRODUTO.md](VISAO-PRODUTO.md).

### 2. Contexto do Atendimento

Descrição **técnica e cronológica** de como o atendimento ocorreu: início, condução, eventuais
transferências, retorno ao cliente e encerramento.

- É narrativa factual, **sem juízo de valor**. Avaliação é dos blocos 3 a 6.
- Deve permitir que quem não leu a conversa entenda o que aconteceu.
- Extensão de referência: 1 parágrafo, 4 a 8 linhas.

### 3. Pontos Positivos

Pontos fortes objetivos: postura, técnica, clareza, resolução, cordialidade.

- Lista, um item por linha.
- Cada item ancorado em algo que **aconteceu** — não em ausência de erro.
- Vazio é resposta legítima. Não inventar elogio para equilibrar.

### 4. Pontos de Atenção

Oportunidades de melhoria e ajustes de processo, comunicação ou condução.

*(Régua 2.0)* Duas partes, com título, nesta ordem:

- **Oportunidades sem desconto** — sugestões para um comportamento que foi cumprido. Cada item
  indica o critério e que não descontou.
- **Não conformidades com impacto na nota** — critério, nota, o que faltou da âncora e a
  evidência.

Nas duas partes:

- Lista, um item por linha.
- Cada item aponta **o que fazer diferente**, não só o que faltou.
- Distinguir de Erros Identificados: aqui está o que pode melhorar; lá, o que falhou.

O formulário guarda as duas partes no mesmo campo (`opportunities`), separadas pelos títulos.

### 5. Leitura Técnica

Análise técnica do atendimento: investigação, domínio do processo, responsabilidade, gestão de
expectativa, segurança na comunicação.

- É o bloco onde a monitora **interpreta**: o que os critérios, somados, revelam sobre a
  condução.
- Deve conectar critérios, não repeti-los. Se lê como lista de notas, está errado.
- Extensão de referência: 1 a 2 parágrafos.
- *(Régua 2.0)* Fecha com a **orientação prática**: o que a colaboradora pode fazer nos próximos
  atendimentos, em ações concretas.

### 6. Erros Identificados

**Preencher somente quando houver** erro técnico, falha de processo, falha grave ou risco de
experiência.

- É aqui que entram as `falhasGraves` do tipo de atendimento (§6).
- Bloco ausente quando não há erro — não escrever "nenhum erro identificado" como praxe.

### 7. Conclusão

Conclusão final, destacando nível do atendimento, impacto na experiência e direcionamento de
melhoria quando necessário.

- *(Régua 2.0)* Reconhece os acertos antes de indicar a prioridade de desenvolvimento.
- Fecha com direcionamento acionável quando houver o que corrigir.
- Não repete a nota: a nota é do sistema e aparece no formulário.
- Extensão de referência: 1 parágrafo.

---

## 8. Regras de escrita

Valem para a monitora e, a partir da 3A.2, para o assistente.

1. **Toda afirmação avaliativa se apoia em evidência.** Justificativa sem trecho da conversa
   que a sustente não é justificativa — é opinião. Vale especialmente para
   `lowScoreReason`, hoje obrigatório sempre que a nota for menor que 2. *(Régua 2.0)* A
   justificativa de nota abaixo de 2 tem **três partes**: o que faltou, qual trecho da âncora
   não foi cumprido e onde isso aparece (horário aproximado na ligação, ou a mensagem no
   WhatsApp). No `N/A`, a justificativa diz o motivo da não aplicabilidade (§2).
2. **Descrever conduta, não pessoa.** "Não informou a validade do cálculo", não "foi
   desatenta".
3. **Uma justificativa, um critério.** Não usar a mesma frase em critérios diferentes; se
   serve para dois, provavelmente está genérica demais. *(Régua 2.0)* Se a mesma evidência
   parece justificar dois descontos, aplicar a regra "uma causa raiz, um desconto" (§2).
4. **Não inflar nem compensar.** Nota alta em um bloco não justifica nota baixa em outro, e
   vice-versa. Cada critério é independente.
5. **`N/A` é resposta legítima e frequente** nos critérios 7, 8, 11, 15 e 21. Forçar nota onde
   não houve situação distorce a média mais do que a nota "errada".
6. **Escrever para quem vai receber o feedback.** O relatório é lido pela atendente avaliada;
   o texto precisa ser utilizável por ela, não apenas correto.
7. **Script é padrão de conteúdo, não de decoreba.** Regra explícita da orientação de tipo de
   atendimento — vale para os critérios 4, 24 e para todos os blocos do §6.

---

## 9. Divergências e decisões pendentes

### Divergências entre as fontes

**1. Duas orientações erradas por cópia no `Padrão Relatório`.**
A orientação do critério **14** (Tom de voz Moura Leite) é literalmente o texto do critério 13
(Gramática). A orientação do critério **27** (Ligação derrubada) é literalmente o texto do 28
(Promessa inexistente). Escrevi régua nova para os dois; **ambas precisam da sua validação**,
porque não derivam de fonte oficial.

**2. Escala de 4 níveis no CYF, 3 no sistema.**
O PDF documenta Ótimo / Bom / Regular / Ruim; o formulário implementa 2 / 1 / 0. Esta
metodologia adota a do sistema. Se a escala de 4 for a oficial, é mudança de código e de base
de comparação histórica — não de documento.

**3. O critério 24 tinha 3 sub-perguntas no PDF e 2 no `Padrão Relatório`. — RESOLVIDA.**
O `Padrão Relatório` omitia *"Realizou incentivo à pesquisa de satisfação?"*, e até 07/10/2026
o sistema seguia o PDF, com 3. A operação informou que o procedimento foi descontinuado e a
sub-pergunta foi retirada da régua. **O sistema passa a ter 2**, coincidindo com o `Padrão
Relatório`. A divergência deixou de existir.

**4. O `Padrão Relatório` traz a orientação de LGPD duas vezes** — solta ao final do bloco
ENCERRAMENTO e de novo no critério 25. Tratada uma vez só, no 25.

### Decisões — encerradas em 25/08/2026

**A régua foi validada integralmente:** 32 itens revisados, 32 aprovados, nenhum ajuste. As
âncoras dos critérios ponderáveis estão validadas item a item — é a decisão 1, respondida pelas
aprovações individuais.

| # | Decisão | Resultado |
|---|---|---|
| 1 | Âncoras 2/1/0 dos critérios ponderáveis | ✅ **Aprovadas** sem ajuste |
| 2 | Régua nova dos critérios 14 e 27 | ✅ **Aprovadas.** A definição do Tom Moura Leite veio da área e está no critério 14; o corte do 27 é **pelo desfecho**, não pela causa |
| 3 | Ordem de escrita das orientações por tipo | ✅ **Definida** — 10 tipos, §6.2 |
| 4 | Exigir justificativa no `N/A`? | ✅ **Não.** Mantido como está — **substituída em 10/10/2026**: a régua 2.0 exige a justificativa (ver "Decisões de calibração") |
| 5 | Os 4 campos narrativos do relatório | ✅ **Criar junto com as âncoras**, como opcionais |
| 6 | Diferenciar `channels` por critério? | ⏸️ **Adiada** — revisão com base em uso real |
| 7 | `REGISTRO (I)` existe ou consolida? | ⏸️ **Adiada** — sem definição operacional ainda |

**Decisão 4 — por que o `N/A` segue sem justificativa obrigatória.** `N/A` é resposta legítima
da metodologia, não erro; os critérios 7, 8, 11, 15 e 21 o recebem com frequência; exigir texto
aumentaria o tempo de preenchimento sem ganho proporcional; e a evidência da aplicação do
critério já é registrada na análise. *Se um dia houver necessidade de auditoria mais fina, a
justificativa no `N/A` pode ser **opcional** — nunca obrigatória.*

> **Substituída em 10/10/2026.** A calibração da régua 2.0 decidiu exigir justificativa no `N/A`,
> com o motivo da não aplicabilidade. O registro acima fica como histórico da decisão de 25/08.

**Decisão 5 — por que os campos narrativos entram agora.** São parte da estrutura oficial do
relatório, serão usados pelo assistente da 3A.3, e criá-los junto com `ancoras` evita alterar o
modelo de monitoria duas vezes. Entram **opcionais**, para não invalidar monitoria existente.

**Decisão 6 — por que a diferenciação por canal foi adiada.** A metodologia ainda está em
implantação e não há volume de monitorias que sustente a distinção. Restringir critérios agora
esconderia situações ainda não mapeadas. Os quatro canais seguem com a mesma régua, respeitando
os `N/A` já previstos em cada critério. **Revisar depois, com evidência real.**

**Decisão 7 — por que `REGISTRO (I)` continua fora.** Não há definição operacional que o
distinga de `REGISTRO`. Fica fora do catálogo até a análise de atendimentos reais dizer se são
processos distintos, o mesmo processo, ou se um substitui o outro. Não impacta a régua nem a
3A.1.

### Decisões de calibração — 10/10/2026 (régua 2.0)

Calibração feita a partir da auditoria da AGO-001 (monitoria de teste, fora dos indicadores).
Referência técnica: artefatos *Calibração da Régua MonitorIA* e *Régua MonitorIA 2.0*.
**Vigência: avaliações registradas a partir de 12/10/2026.** As anteriores seguem a régua 1, e
o texto dela fica preservado no histórico do repositório (tag `v0.25.0`).

| # | Decisão | Resultado |
|---|---|---|
| D1 | Princípio A / B / C e justificativa em três partes | ✅ Aprovada (§2, §8) |
| D2 | Uma causa raiz, um desconto, com a exceção 12 × 18 | ✅ Aprovada (§2) |
| D3 | Evidência insuficiente → revisão humana, nunca nota automática | ✅ Aprovada (§2), com limitação técnica registrada |
| D4 | Espera no telefone: 60 s | ✅ Aprovada como parâmetro inicial (critério 7) |
| D5 | Fronteira 16 × 18: erro de informação desconta no 18 | ✅ Aprovada (critérios 16 e 18) |
| D6 | Fronteira 5 × 7: espera logo ao atender desconta no 5 | ✅ Aprovada (critérios 5 e 7) |
| D7 | Pontos de Atenção em duas partes | ✅ Aprovada (§7) |
| D8 | Vigência a partir de 12/10/2026, sem reavaliar o passado | ✅ Aprovada |
| D9 | Critério 6: a compreensão pode ser demonstrada pela própria resposta | ✅ Aprovada com ajuste — sem exigir pergunta ou confirmação quando a demanda já está clara |
| D10 | Critério 9: checagem final sai da âncora 2 | ✅ Aprovada |
| D11 | Critério 12: próximo passo não informado é nível 1 | ✅ Aprovada |
| D12 | Critério 13: sem limite numérico; recorrência, natureza, impacto e evidência | ✅ Aprovada com ajuste |
| D13 | Critério 16: dado faltante nomeado | ✅ Aprovada |
| D14 | Critério 19: demanda × processo; encaminhamento não é resolução | ✅ Aprovada com ajuste |
| D15 | Critério 22: resumo + confirmação; forma curta em atendimento simples | ✅ Aprovada |
| D16 | Critério 23: personalização contextual, sem frase pronta | ✅ Aprovada com ajuste |
| D17 | Critério 4, sub-pergunta 4: só a abertura | ✅ Aprovada |
| — | Justificativa obrigatória no `N/A` | ✅ Aprovada (§2) — substitui a decisão 4 de 25/08 |

**O que não mudou:** pesos, escala 2 / 1 / 0, eliminatórios e a confirmação deles pela gestão,
regras de `N/A` dos demais critérios, fórmula da nota.

### Pendências técnicas da régua 2.0 — planejadas para a evolução do sistema

A régua vale desde a vigência; estes itens tornam o sistema capaz de aplicá-la sozinho. Nenhum
deles altera nota já registrada.

| Item | O quê | Até lá |
|---|---|---|
| **T1** | N/A no critério 24 (o formulário não oferece N/A em checklist) | Não escolher para monitoria regular atendimento interrompido pelo cliente |
| **T2** | Importador exigir `evidencia` em nota abaixo de 2 | O assistente é instruído a sempre enviar |
| **T3** | Formulário e importador exigirem justificativa no `N/A` | Regra de preenchimento; não bloqueia a conclusão |
| **T4** | Critério com evidência insuficiente chegar **sem resposta** ao formulário, e a revisão ficar registrada na monitoria | Medida de segurança do §2, "Evidência insuficiente" |
| **T5** | Exibir as âncoras na etapa 3 do formulário | A monitora aplica as âncoras por este documento |
| **T6** | Registrar a versão da régua em cada monitoria nova | A data de registro separa régua 1 e régua 2.0 |
| **T7** | Âncoras novas no cadastro de critérios, por troca pontual com cópia de segurança | As âncoras não entram no cálculo; nenhuma nota muda |
| **T8** | MON-2026-0001 revista pela régua 1, com o peso corrigido do critério 6 | Devolução já decidida, a executar |

### Pendências da régua — aprovadas, aguardando implementação

| Item | O quê | Onde |
|---|---|---|
| **P1** | **Criar o critério 29** — `Cliente chegou autenticado?`, classificação de peso 0 no Bloco 1 | §4, Bloco 1 |
| **P2** | **Condicionar o critério 25 ao 29** — autenticado ⇒ N/A; não autenticado ou não identificável ⇒ regra atual | §5, critério 25 |

As duas entram juntas: o portão do 25 não funciona sem o 29, e o 29 sem o portão é informação
sem consequência. **Entram na mesma leva do cadastro das âncoras**, para não percorrer os
critérios duas vezes.

**Questão menor, em aberto:** o critério novo é `crit-29` por ordem de criação, mas aparece no
Bloco 1, entre os de número 1 e 2. A numeração do CYF é histórica, não de exibição — se isso
incomodar na tela, o número mostrado pode ser outro. Não bloqueia nada.

---

## Estado desta fatia

Este documento **não altera código nem dados**. É o insumo de validação da 3A.0.

### O que as versões 0.14.0 a 0.17.0 mudaram aqui

| Versão | Efeito na régua |
|---|---|
| **0.14.0** | Resolveu a decisão 5 (início/encerramento) e alinhou o nome `ANTECIPAÇÃO PAGAMENTOS` |
| **0.15.0** | O protocolo virou identidade gerada — deixou de ser algo que a monitora informa |
| **0.16.0** | Critério 3 inativo; `MULTIPLA_ESCOLHA` virou a quarta forma de resposta |
| **0.17.0** | Não tocou a régua, mas apagou e recriou `pm2_criteria` |

**A 0.16.0 removeu a maior incerteza técnica da fatia.** O campo `opcoes` foi o primeiro campo
novo de `Criterion` a alcançar uma base já gravada, por loader com marcador de versão, e o teste
confirmou que **as edições feitas no Admin sobrevivem à migração**. Era exatamente a dúvida que
pairava sobre `ancoras`: como levar um campo novo para uma base que já contém trabalho de
cadastro. O caminho está provado.

**A 0.17.0 fechou uma janela.** `pm2_criteria` foi apagado com o `DATABASE_VERSION`. Nada se
perdeu porque o cadastro não tinha começado — mas **do primeiro critério salvo em diante esse
dado é insubstituível**, e o backup de [BACKUP-RESTAURACAO.md](BACKUP-RESTAURACAO.md) volta a ser
obrigatório antes de qualquer publicação que mexa em modelo ou migração.

### O que falta

1. ~~Validar a régua~~ — ✅ **concluído em 25/08/2026**, 32 de 32.
2. ~~Aplicar os ajustes~~ — ✅ **nenhum ajuste**; as decisões da pauta estão transcritas neste
   documento.
3. **Criar `Criterion.ancoras`** e os **4 campos narrativos** em `Monitoring`, opcionais.
4. **Ampliar o cadastro de critérios no Admin** — hoje ele edita `orientacao`, mas não tem campo
   para `ancoras`, `opcoes` nem `subPerguntas`. **Sem essa tela, metade da régua só entra por
   código**, e a 3A.0 deixa de ser cadastro para virar deploy.
5. **Criar o critério 29 e o portão do 25** (P1 e P2, abaixo) — mesma leva, para não percorrer
   os critérios duas vezes.
6. **Cadastrar a régua validada** numa passagem só.
7. **Criar a entidade `OrientacaoAtendimento`** e registrar *ANTECIPAÇÃO PAGAMENTOS*, seguida da
   fila de §6.2.

Os passos 3 a 6 são uma versão só. O 7 é trabalho de conteúdo e corre em paralelo.

**A partir do primeiro critério cadastrado, `pm2_criteria` passa a ser o dado mais caro da
base** — e não existe cópia. O procedimento de [BACKUP-RESTAURACAO.md](BACKUP-RESTAURACAO.md)
vale antes de cada publicação daqui em diante.

Só depois disso a 3A.1 (`instructionBuilder`) tem o que ler.
