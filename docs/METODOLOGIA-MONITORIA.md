# Metodologia de Monitoria — Base Única

> **Fatia 3A.0.** Formalização da régua de avaliação. Nenhuma linha de código depende deste
> documento ainda: ele existe para ser **validado primeiro** e só então virar cadastro no
> sistema e insumo do `instructionBuilder` (3A.1).
>
> Registrado em 24/08/2026. Produção atual: versão 0.13.0, commit `a8467c9`.

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
  critério do cálculo. Por isso `N/A` precisa ser justificado (ver §9, decisão 4).
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
(0 · 0,5 · 1 · 1,5 · 2); o 24 tem 3 (0 · 0,67 · 1,33 · 2). **Nestes dois, a âncora é por
sub-pergunta**, não por nível.

---

## 3. Estrutura da avaliação

| # | Bloco | Critérios | Peso somado | Papel |
|---|---|---|---|---|
| 1 | FORMAS DO CONTATO | 1–3 | 0 | Classificação |
| 2 | ABERTURA | 4–5 | 2,0 | Como o atendimento começa |
| 3 | COMUNICAÇÃO | 6–14 | 11,0 | Como o atendente conduz |
| 4 | CONHECIMENTO DO PRODUTO/SERVIÇO | 15–17 | 5,0 | O que o atendente sabe |
| 5 | PRECISÃO DAS INFORMAÇÕES | 18–21 | 5,5 | Se o que foi dito se sustenta |
| 6 | ENCERRAMENTO | 22–24 | 3,5 | Como o atendimento fecha |
| 7 | MANDOU MAL | 25–28 | 0 | Eliminatórios |
| | **Total ponderável** | **24 critérios** | **27,0** | |

O peso 2,0 aparece em três critérios apenas — **6** (empatia), **16** (informação precisa) e
**18** (ausência de desinformação). São o centro de gravidade da nota: juntos valem 22% do
total. Um atendimento pode ser cordial e ainda assim tirar nota baixa se falhar nesses três.

---

## 4. Régua critério a critério

Cada critério traz: **o que mede**, a **orientação completa** (extraída do documento oficial),
as **âncoras**, **quando marcar N/A** e a **evidência observável** — o que precisa estar na
conversa para sustentar a nota.

> As âncoras são **proposta desta fatia**. Nenhuma delas está no documento original: o CYF dá
> os níveis e o `Padrão Relatório` dá as boas práticas, mas ninguém escreveu o corte entre 2 e
> 1. É exatamente essa a lacuna que a 3A.0 fecha — e é o que precisa da sua validação.

---

### Bloco 1 — FORMAS DO CONTATO

Critérios de **classificação**. Peso 0: não movem a nota. Existem para segmentar relatórios e
para dar contexto ao restante da avaliação — um contato de Reclamação lê-se diferente de um de
Informação.

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
`crit-03` · MULTIPLA_ESCOLHA · peso 0

**O que mede.** O canal do atendimento.

**Régua.** Registrar o canal em que o atendimento **efetivamente ocorreu**. Se começou no
WhatsApp e migrou para ligação, classificar pelo canal onde a demanda foi resolvida, e
descrever a migração no Contexto.

**Consequência.** Este campo governa quais critérios são aplicáveis (§4, coluna "canais") e
qual script de encerramento é exigido no critério 24.

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
| Apresentou escuta ativa, empatia e profissionalismo? | Reagiu ao que o cliente disse antes de responder | Respondeu por script, ignorando o que foi dito |

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
| **2** | Perguntou para entender antes de responder **e** reconheceu explicitamente a situação do cliente. A resposta seguinte mostra que ele escutou. |
| **1** | Foi cordial, mas respondeu direto ao pedido sem investigar; ou reconheceu a situação com fórmula pronta, sem conexão com o que o cliente disse. |
| **0** | Ignorou o conteúdo emocional ou factual do pedido; respondeu outra coisa; tratou o cliente como interrupção. |

**N/A.** Nunca. Todo contato tem um pedido.

**Evidência.** A primeira resposta do atendente depois de o cliente expor a demanda.

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

**N/A.** Não houve espera. **No WhatsApp**, considera-se espera um intervalo relevante entre
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
| **2** | Explicação em passos, em linguagem simples, **e** houve checagem de entendimento durante ou ao final. |
| **1** | Explicação correta mas em bloco único, com jargão, ou sem nenhuma checagem. O cliente entendeu apesar da explicação, não por causa dela. |
| **0** | Explicação confusa, incompleta ou que deixou o cliente perguntando a mesma coisa de novo. |

**N/A.** Atendimento sem nada a explicar (ex.: só confirmar recebimento).

**Evidência.** O trecho da explicação. Sinal forte de nota 1 ou 0: o cliente repete a pergunta.

**Não confundir com o 22.** O 9 avalia a explicação; o 22 avalia a checagem final antes de
encerrar. A checagem *durante* a explicação pertence ao 9.

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
| **2** | Disse o que podia e o que não podia ser feito, com os próximos passos explícitos, em linguagem simples. |
| **1** | Foi claro no que era favorável, mas contornou ou omitiu a parte desfavorável (prazo, limitação, condição). |
| **0** | Deixou ambiguidade que gera nova ligação, ou deu resposta sem base para encerrar rápido. |

**N/A.** Nunca.

**Não confundir com o 18.** O 12 é *clareza e completude*; o 18 é *veracidade*. Meia-verdade
dita com clareza é 12 baixo e 18 baixo; verdade dita de forma confusa é 12 baixo e 18 alto.

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
| **2** | Sem erro relevante. Pontuação e concordância adequadas ao canal. |
| **1** | Erros pontuais que não comprometem o entendimento (digitação, acento, concordância isolada). |
| **0** | Erros frequentes ou que comprometem o entendimento; escrita sem pontuação; abreviação de mensagem pessoal ("vc", "blz", "pq") em canal institucional. |

**Leitura por canal.** No **WhatsApp** avalia-se o texto escrito; no **telefone**, a fala —
concordância, vício de linguagem, clareza de dicção.

**N/A.** Nunca.

---

#### 14. Tom de voz Moura Leite
`crit-14` · ESCALA_4 · peso 1,0

> ⚠️ A orientação deste critério no `Padrão Relatório` está errada: repete o texto do
> critério 13. A régua abaixo é **proposta nova** e precisa de validação (§9, divergência 1).

**O que mede.** Aderência à identidade de comunicação da Moura Leite — não a simpatia
individual do atendente.

**Orientação proposta.** O tom Moura Leite é **profissional, cordial e acolhedor**. Na
prática:
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
| **1** | Informação correta mas incompleta (faltou dado que o cliente precisaria), ou correta com excesso que confundiu. |
| **0** | Informação errada, desatualizada, ou que não respondia ao que foi perguntado. |

**N/A.** Nunca — sempre há informação em jogo.

**Evidência.** O dado entregue, textual: valor, data, prazo, procedimento.

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

---

#### 19. Resolução no Primeiro Contato — FCR
`crit-19` · ESCALA_4 · peso 1,5

**O que mede.** Se a questão foi resolvida neste contato, sem necessidade de retorno ou
transferência.

**Orientação completa.** FCR é resolver na primeira vez, sem follow-up e sem transferência.
Depende de: preparação adequada (conhecer produtos, serviços e políticas, com acesso rápido à
informação); escuta ativa; proatividade na busca da solução, inclusive consultando colegas
quando necessário; e confirmação com o cliente de que todas as dúvidas foram resolvidas antes
de encerrar.

**Âncoras.**

| | |
|---|---|
| **2** | Resolvido neste contato, sem transferência e sem promessa de retorno. |
| **1** | Resolvido, mas com transferência, consulta demorada ou retorno em segundo momento — resolvido, porém não *no primeiro contato*. |
| **0** | Não resolvido; ficou dependendo de nova ação do cliente. |

**N/A.** Contato que, por natureza, não se encerra em si (ex.: protocolo aberto que depende de
área externa e foi corretamente encaminhado). Registrar o motivo.

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
| **2** | Resumiu os pontos **e** obteve confirmação do cliente. |
| **1** | Perguntou "tem mais alguma dúvida?" sem resumir; ou resumiu e encerrou sem esperar resposta. |
| **0** | Encerrou sem qualquer verificação. |

**N/A.** Atendimento sem informação a reter (ex.: só confirmação de recebimento).

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
| **2** | O atendimento é personalizado do início ao fim: usa o nome, retoma o contexto, agradece e deixa a porta aberta. |
| **1** | Correto e cordial, mas impessoal — qualquer cliente receberia exatamente as mesmas frases. |
| **0** | Transacional ou frio; o cliente foi tratado como chamado. |

**N/A.** Nunca.

**Nota de calibração.** Este critério é o mais fácil de inflar. Cordialidade isolada não é 2 —
o 2 exige personalização visível.

---

#### 24. Encerrou o contato corretamente?
`crit-24` · CHECKLIST_SIM_NAO · peso 1,5 · **3 sub-perguntas**

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
| Realizou incentivo à pesquisa de satisfação? | Convidou explicitamente a responder a pesquisa | Não mencionou |

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
> critério 28. A régua abaixo é **proposta nova** (§9, divergência 1).

**O que mede.** Contato interrompido ou finalizado sem que o cliente tenha sido efetivamente
atendido.

**Aciona quando.**
- **Telefone** — a ligação caiu por ação ou desatenção do atendente e não houve retorno; ou o
  atendente encerrou antes de resolver.
- **WhatsApp** — a conversa foi abandonada com o cliente aguardando resposta, sem desfecho e
  sem retorno.

**Não aciona quando.** A queda foi do lado do cliente **e** houve tentativa registrada de
retorno; ou o cliente encerrou por conta própria após ser atendido.

**Evidência exigida.** O ponto de interrupção e a ausência de retorno posterior.

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

### 6.2 Demais tipos — a preencher

`OFFICIAL_CATEGORIAS` traz hoje: Dúvida · Reclamação · Solicitação · Elogio · 2ª Via de Boleto ·
Renegociação. **Nenhum tem orientação documentada** — e *ANTECIPAÇÃO PAGAMENTOS*, que tem,
**não está na lista de categorias do sistema**.

Duas providências ficam pendentes de decisão sua (§9, decisão 3): incluir Antecipação de
Parcelas nas categorias oficiais, e definir a ordem de escrita das orientações restantes.
Sugestão de prioridade, por volume e por risco: **2ª Via de Boleto → Renegociação →
Reclamação**.

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

- Lista, um item por linha.
- Cada item aponta **o que fazer diferente**, não só o que faltou.
- Distinguir de Erros Identificados: aqui está o que pode melhorar; lá, o que falhou.

### 5. Leitura Técnica

Análise técnica do atendimento: investigação, domínio do processo, responsabilidade, gestão de
expectativa, segurança na comunicação.

- É o bloco onde a monitora **interpreta**: o que os critérios, somados, revelam sobre a
  condução.
- Deve conectar critérios, não repeti-los. Se lê como lista de notas, está errado.
- Extensão de referência: 1 a 2 parágrafos.

### 6. Erros Identificados

**Preencher somente quando houver** erro técnico, falha de processo, falha grave ou risco de
experiência.

- É aqui que entram as `falhasGraves` do tipo de atendimento (§6).
- Bloco ausente quando não há erro — não escrever "nenhum erro identificado" como praxe.

### 7. Conclusão

Conclusão final, destacando nível do atendimento, impacto na experiência e direcionamento de
melhoria quando necessário.

- Fecha com direcionamento acionável quando houver o que corrigir.
- Não repete a nota: a nota é do sistema e aparece no formulário.
- Extensão de referência: 1 parágrafo.

---

## 8. Regras de escrita

Valem para a monitora e, a partir da 3A.2, para o assistente.

1. **Toda afirmação avaliativa se apoia em evidência.** Justificativa sem trecho da conversa
   que a sustente não é justificativa — é opinião. Vale especialmente para
   `lowScoreReason`, hoje obrigatório sempre que a nota for menor que 2.
2. **Descrever conduta, não pessoa.** "Não informou a validade do cálculo", não "foi
   desatenta".
3. **Uma justificativa, um critério.** Não usar a mesma frase em critérios diferentes; se
   serve para dois, provavelmente está genérica demais.
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

**3. O critério 24 tem 3 sub-perguntas no PDF e 2 no `Padrão Relatório`.**
O `Padrão Relatório` omite *"Realizou incentivo à pesquisa de satisfação?"*. O sistema segue o
PDF, com 3. Mantido: o PDF é a fonte estrutural.

**4. O `Padrão Relatório` traz a orientação de LGPD duas vezes** — solta ao final do bloco
ENCERRAMENTO e de novo no critério 25. Tratada uma vez só, no 25.

### Decisões pendentes

| # | Decisão | Impacto |
|---|---|---|
| 1 | Validar as âncoras 2/1/0 dos 24 critérios ponderáveis | Bloqueia 3A.1 — a instrução se monta a partir delas |
| 2 | Validar a régua nova dos critérios 14 e 27 | Bloqueia o cadastro desses dois |
| 3 | ~~Incluir *ANTECIPAÇÃO PAGAMENTOS* em `OFFICIAL_CATEGORIAS`~~ — **feito na 0.14.0.** Resta definir a ordem de escrita das demais orientações | Bloqueia §6.2 |
| 4 | Exigir justificativa também no `N/A`? Hoje o formulário não pede | Mudança em `validateStep3` |
| 5 | ~~Criar `inicio` / `encerramento` no modelo~~ — **resolvida na 0.14.0**, com data e hora completas e duração calculada | — |
| 6 | Diferenciar `channels` por critério? Hoje os 28 se aplicam aos 6 canais | Muda quais critérios entram na instrução por canal |

---

## Estado desta fatia

Este documento **não altera código nem dados**. É o insumo de validação da 3A.0. Depois de
validado, a 3A.0 se completa em três movimentos, nesta ordem:

1. Cadastrar as orientações completas nos 28 critérios, via Admin.
2. Criar o campo `ancoras` em `Criterion` e preenchê-lo.
3. Criar a entidade `OrientacaoAtendimento` e registrar *ANTECIPAÇÃO PAGAMENTOS*.

Só então a 3A.1 (`instructionBuilder`) tem o que ler.
