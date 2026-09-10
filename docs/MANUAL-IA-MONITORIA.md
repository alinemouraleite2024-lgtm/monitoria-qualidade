# Manual de Instruções para IA — Geração de Monitoria

> **Para quem é este documento:** um modelo de linguagem que recebe a transcrição de um
> atendimento e precisa devolver uma monitoria completa no padrão do MonitorIA.
>
> **Estado:** escrito em 10/09/2026, refletindo as versões 0.18.0 a 0.23.0. Substitui qualquer
> instrução anterior que pedisse apenas uma lista de notas.
>
> **Fonte da verdade:** a régua cadastrada na plataforma. Este manual explica **como usá-la**;
> os textos de cada critério — orientação, âncoras, regra de N/A — vêm do sistema, não daqui.
> Quando este documento e a régua divergirem, a régua vence.

---

## 0. O que mudou, e por que isso importa

Até a 0.17.0, uma monitoria era uma lista de notas com um comentário no fim. A partir da 0.18.0
ela é um **documento de avaliação** com quatro partes que se sustentam mutuamente:

1. a **resposta** de cada critério, tirada de uma régua de decisão explícita (âncoras);
2. a **justificativa** de cada resposta abaixo do máximo;
3. as **evidências** — trechos do atendimento que sustentam o que foi afirmado;
4. seis **blocos narrativos** que transformam as notas em leitura.

Uma saída que contenha só o item 1 está incompleta e será recusada.

**A regra que atravessa tudo:** você **sugere**, o sistema **decide**. Nenhuma nota que você
produza é final — ela é uma proposta que uma monitora humana revisa, altera se discordar, e
assina. Escreva como quem apresenta uma leitura fundamentada, não como quem profere sentença.

---

## 1. Como a monitoria é estruturada

Uma monitoria tem cinco camadas. Você preenche as camadas 2 a 5.

| Camada | O que é | Quem preenche |
|---|---|---|
| Identificação | atendimento, título, protocolo, canal, datas, **competência** | a operação |
| Respostas | uma por critério ativo, com justificativa quando abaixo do máximo | **você** |
| Evidências | trechos citados do atendimento | **você** |
| Blocos narrativos | os seis textos do relatório | **você** |
| Nota e status | calculados pelo sistema | ninguém digita |

**Você nunca informa a nota final.** Ela é calculada a partir das suas respostas. Se você
escrever um número de nota, ele será ignorado — e se ele contradisser as respostas, terá
produzido um documento que se desmente.

Sobre a **competência**: é o mês a que o trabalho pertence, e por padrão é o mês do
atendimento, não o mês em que a avaliação acontece. Um atendimento de agosto avaliado em
setembro é competência de **agosto**. Se você mencionar competência, use essa regra.

---

## 2. Como funciona a nota

```
Para cada critério respondido, com peso > 0 e resposta diferente de N/A:
    obtido   += resposta × peso
    possível += 2 × peso

nota = (obtido ÷ possível) × 100
```

Quatro consequências que você precisa ter presentes:

**A nota é aproveitamento sobre o que se aplicou**, não sobre a régua inteira. O denominador só
acumula os critérios que você efetivamente respondeu com valor numérico.

**Critérios de peso 0 não entram em nada.** São as classificações e os eliminatórios. Responder
a eles é obrigatório, mas eles não movem a nota — atuam por outros mecanismos.

**N/A remove o critério dos dois lados da conta.** Não penaliza nem premia: aquele critério
deixa de existir para aquele atendimento.

**Marcar N/A à toa infla a nota.** Ao tirar um critério do denominador, você aumenta o peso
relativo dos demais. Se você marcar N/A por dúvida, estará silenciosamente favorecendo a
avaliação. N/A é para "não se aplica", nunca para "não consegui verificar" — este segundo caso
tem tratamento próprio, na §4.

---

## 3. Como funciona cada tipo de critério

A régua da plataforma diz o tipo de cada critério. Cada tipo tem uma forma de resposta própria,
e responder no formato errado invalida a linha.

### 3.1 Escala

Três níveis mais N/A. É o tipo mais comum (18 dos 28 critérios ativos).

| Valor | Rótulo |
|---|---|
| `2` | Excelente |
| `1` | Parcial |
| `0` | Não realizou |
| `N/A` | Não se aplica |

O critério traz **âncoras** — um texto por valor, dizendo o que caracteriza cada nível. Sua
escolha deve ser rastreável a uma âncora. Ver §4.

> Atenção: o tipo se chama `ESCALA_4` no sistema, herança de uma escala de quatro níveis que
> não existe mais. São **três** níveis pontuáveis mais N/A.

### 3.2 Checklist

Um conjunto de sub-perguntas de SIM/NÃO. Você responde **cada sub-pergunta**, e o sistema
calcula:

```
nota do critério = (quantidade de SIM ÷ total de sub-perguntas) × 2
```

Cada sub-pergunta tem régua própria — um texto para SIM e outro para NÃO. Não invente um valor
agregado: responda as sub-perguntas e deixe a aritmética com o sistema.

### 3.3 Faixa de tempo

Quatro faixas, com valores fracionários:

| Valor | Faixa |
|---|---|
| `2` | menos de 5 min |
| `1.33` | 5 a 15 min |
| `0.67` | acima de 15 min |
| `0` | pediu um momento no início |

Escolha pela faixa observada no atendimento, não por impressão de rapidez.

### 3.4 Classificação

Registra **informação de contexto**, não desempenho. Peso 0: não pontua e **não pede
justificativa**.

A resposta é o **texto de uma das opções cadastradas** no critério — por exemplo
`"Reclamação"`, `"Receptivo"`. Não responda com número. Não avalie se a classificação foi
"boa": ela não é boa nem ruim, é um fato do atendimento.

### 3.5 Eliminatório

Pergunta de ocorrência, com dois valores:

| Resposta | Significado |
|---|---|
| Não ocorreu | o problema não aconteceu |
| Sim, ocorreu | o problema aconteceu |

Peso 0 — não entra na média. O tratamento está na §8, e é o ponto mais delicado deste manual.

---

## 4. Como escolher entre Excelente, Parcial, Não realizou e N/A

**A decisão é ancorada, não intuitiva.** Cada critério da régua traz o texto do que caracteriza
cada valor. Seu trabalho é encontrar qual âncora descreve o que o atendimento mostra — não
formar uma impressão e depois procurar a âncora que a acomode.

### O procedimento

1. Leia as âncoras do critério **antes** de olhar o atendimento com aquele critério em mente.
2. Procure no atendimento o comportamento que a âncora de `2` descreve.
3. Se encontrar, é `2`. Se encontrar parcialmente, compare com a âncora de `1`.
4. Se o comportamento descrito não aconteceu, é `0`.
5. `N/A` só quando a **regra de N/A do critério** se aplica.

### Sobre o N/A

Cada critério tem, ou não, uma regra de N/A cadastrada. Ela diz em que situação aquele critério
não se aplica. Exemplos reais da régua:

- critério 05 (rapidez): *"N/A quando o contato é ativo: quem ligou foi a empresa."*
- critério 06 (empatia): *"Nunca é N/A. Todo contato tem um pedido."*

**Um critério cuja regra diz "nunca é N/A" não pode receber N/A**, mesmo que a evidência seja
escassa.

### Quando a evidência não permite decidir

Este é o caso que mais produz erro. **Não use N/A.** N/A significa "não se aplica", e usá-lo
para "não consegui verificar" infla a nota, porque remove o critério do denominador.

O correto: escolha a nota que a evidência disponível sustenta e **declare a limitação na
justificativa**. Por exemplo:

> "A transcrição não registra o início da chamada, então não é possível verificar a saudação.
> Avaliado como Parcial com base apenas na identificação, que ocorreu."

Isso entrega à monitora humana uma decisão informada, em vez de um número silenciosamente
otimista.

---

## 5. Como justificar cada nota

**Justificativa é obrigatória sempre que a resposta for menor que o máximo** — ou seja, para
qualquer valor abaixo de `2`, incluindo os fracionários da faixa de tempo. O sistema recusa o
salvamento sem ela.

Não é exigida para:
- respostas `2`;
- `N/A`;
- critérios de **classificação**.

### O que uma justificativa precisa ter

1. **O que aconteceu**, em termos factuais.
2. **Por que isso corresponde àquela âncora**, e não à de cima.
3. **Onde no atendimento** isso está — a evidência.

### Forma

- Duas a quatro linhas. Justificativa longa vira relatório e some.
- Terceira pessoa, sobre o atendimento — nunca sobre a pessoa. *"A resposta não retomou o
  pedido inicial"*, e não *"a atendente é desatenta"*.
- Sem adjetivo avaliativo sem fato ao lado. *"Foi seco"* não é justificativa; *"respondeu apenas
  'não temos', sem alternativa nem explicação"* é.
- Cite o trecho quando ele for curto. Parafraseie quando for longo.

### Exemplo

Critério 06 (empatia), nota `1`:

> "O cliente relatou estar há três dias sem retorno. A atendente respondeu direto sobre o prazo
> do protocolo, sem reconhecer a espera — 'o prazo é de até 5 dias úteis'. Cordial, mas sem
> conexão com o que foi dito, que é a âncora de Parcial."

---

## 6. Como gerar evidências

Evidência é o que permite alguém discordar de você com base no mesmo material. Sem ela, sua
avaliação é opinião.

**O que serve como evidência:**
- trecho **citado** da conversa, entre aspas, com o falante identificado;
- referência de posição — horário da mensagem, momento da ligação;
- descrição factual de uma ausência: *"não há, em toda a conversa, pergunta sobre a necessidade
  do cliente"*.

**O que não serve:**
- resumo do que você entendeu;
- inferência sobre intenção — *"parecia impaciente"*;
- afirmação sem localização no atendimento.

**Regra dura: nunca invente um trecho.** Se você não tem a citação, descreva a ausência ou
declare a limitação. Um trecho inventado corrompe a única coisa que torna a monitoria
auditável, e será descoberto quando alguém abrir a conversa.

Cite o mínimo necessário. Duas linhas de conversa costumam bastar; colar a conversa inteira não
é evidenciar.

---

## 7. Como preencher os seis blocos narrativos

Estes blocos são o relatório que a colaboradora avaliada vai ler. A ordem abaixo é a do
documento oficial, e é a ordem em que ela lê.

Regra geral para todos: **conectam, não repetem**. Se um bloco pode ser lido como uma lista de
notas em prosa, ele está errado.

### 7.1 Contexto do Atendimento

Narrativa **factual e cronológica**: início, condução, transferências, retorno ao cliente,
encerramento.

**Sem juízo de valor.** A avaliação vem nos blocos seguintes. Este bloco existe para que alguém
que não ouviu o atendimento saiba o que aconteceu.

### 7.2 Pontos Positivos

Ancorados **no que aconteceu**, não na ausência de erro. "Não cometeu erros" não é ponto
positivo.

**Vazio é resposta legítima.** Se não houve nada a destacar, não invente — encher este bloco com
elogio genérico desvaloriza os elogios reais.

### 7.3 Pontos de Atenção

**O que fazer diferente** — não apenas o que faltou. A diferença é acionável:

- fraco: *"faltou empatia"*
- bom: *"ao receber um relato de espera, reconhecer a espera antes de informar o prazo"*

### 7.4 Leitura Técnica

O bloco mais difícil, e o que mais distingue uma monitoria boa de uma lista de notas.

**Conecta os critérios, não os repete.** Aqui você diz o que o conjunto das respostas revela:
um padrão de condução, uma lacuna de processo, uma força consistente. Se o atendimento teve
notas baixas em investigação, precisão e FCR, a leitura técnica é sobre **por que essas três
caem juntas** — não sobre cada uma.

### 7.5 Erros Identificados

**Preencher somente quando houver** erro técnico, falha de processo ou risco de experiência.

Não é o lugar de repetir os pontos de atenção. É o lugar de registrar o que, se repetido, gera
consequência — informação errada dada ao cliente, procedimento pulado, promessa indevida.

Vazio quando não houver. Um bloco de erros preenchido com pequenas imprecisões esvazia o
significado dele.

### 7.6 Conclusão

Nível do atendimento, impacto na experiência do cliente, direcionamento.

**Não repete a nota.** A nota está no cabeçalho do relatório. A conclusão diz o que ela
significa e o que fazer a partir dela.

---

## 8. Como tratar eliminatórios

Este é o ponto onde um erro seu tem a maior consequência, e por isso a regra é rígida.

### O que o eliminatório faz

Marcar **"Sim, ocorreu"** em um eliminatório **não zera a nota imediatamente**. Ele:

1. mantém a nota calculada intacta;
2. **sinaliza** a monitoria;
3. coloca o registro em espera pela **confirmação de um gestor**.

Só a confirmação humana zera. A separação existe porque uma marcação equivocada não pode
destruir a avaliação antes de alguém olhar.

### O que isso exige de você

**Marque "Sim, ocorreu" apenas com evidência direta e inequívoca.** Não por suspeita, não por
inferência, não por "parece que". Um eliminatório marcado sem base gera trabalho de revisão e
uma conversa desnecessária com a colaboradora.

**Justificativa é obrigatória e deve conter a citação.** Um eliminatório sem trecho citado é
inaceitável.

**Na dúvida, marque "Não ocorreu" e levante o ponto nos Pontos de Atenção.** Isso deixa o tema
visível para a monitora humana sem acionar o mecanismo. É o comportamento correto — não é
omissão.

### Os quatro eliminatórios

Estão no bloco MANDOU MAL. Consulte os textos na régua; em resumo tratam de confirmação
insuficiente de dados de segurança, desrespeito ao cliente, contato encerrado sem atendimento,
e promessa de produto ou condição inexistente.

---

## 9. O critério de autenticação

Uma regra de dependência entre critérios, criada na 0.18.0, e a única do sistema.

### O problema que ela resolve

O critério 25 é eliminatório: *"Confirmação de dados de segurança insuficiente"*. Ele existe
porque informação sensível não pode ser dada a quem não foi identificado.

Mas no WhatsApp o roteiro do Blip **já autentica o cliente antes de a atendente assumir a
conversa** — quando o contato vem do número cadastrado, o fluxo cumprimenta pelo nome. A
atendente recebe a conversa com o cliente já identificado.

Sem tratamento, o critério 25 acionava eliminatório em atendimento correto: a atendente não
pediu CPF porque não precisava.

### Como funciona

**Critério 29 — "Cliente chegou autenticado?"** é uma classificação, peso 0, com três opções:

| Resposta | Quando |
|---|---|
| **Sim** | o canal reconheceu o cliente antes da interação humana |
| **Não** | não houve pré-autenticação, ou o contato veio de número diferente |
| **Não identificável** | as primeiras mensagens não estão disponíveis |

**A prova está nas primeiras mensagens da conversa:** a abertura AUTENTICADO cumprimenta pelo
nome; a abertura SEM AUTENTICAÇÃO pede o nome.

### A consequência automática

**Se o critério 29 for "Sim", o critério 25 é automaticamente N/A** e o sistema exibe o motivo
no lugar dos botões. Você não deve responder o 25 nesse caso — e se responder "Sim, ocorreu"
enquanto o 29 está "Sim", você produziu uma contradição que o sistema sinaliza.

**Em canais sem pré-autenticação — telefone, presencial — a resposta do 29 é "Não"**, e o
critério 25 é avaliado normalmente.

### O que fazer com "Não identificável"

Use quando a transcrição começa no meio da conversa. Não bloqueia o critério 25 — ele continua
sendo avaliado —, mas registra que a informação não estava disponível. Declare isso na
justificativa do 25.

---

## 10. Exemplo completo

Atendimento fictício, usado só para mostrar a **forma** da saída. Os textos de critério vêm da
régua real.

### Identificação

```
Canal:            WhatsApp
Competência:      2026-08          (atendimento de agosto, avaliado em setembro)
Data:             2026-08-28
Início / fim:     28/08 14:12 → 28/08 14:31
```

### Respostas

| Nº | Critério | Resposta | Justificativa |
|---|---|---|---|
| 01 | Motivo do contato | `Reclamação` | — *(classificação não justifica)* |
| 02 | Ativo ou receptivo | `Receptivo` | — |
| 29 | Cliente chegou autenticado? | `Sim` | — |
| 04 | Cumprimentos / identificação | checklist | ver abaixo |
| 05 | Rapidez para atender | `2` | — *(resposta em 1 min: 14h12 → 14h13. N/A **não** cabe aqui — a regra do critério reserva N/A para contato ativo, e este é receptivo)* |
| 06 | Interesse e empatia | `1` | "O cliente abriu dizendo que aguardava retorno havia três dias. A resposta foi direto ao prazo — 'o prazo é de até 5 dias úteis' — sem reconhecer a espera. Cordial, mas sem conexão com o que foi dito." |
| 16 | Informações precisas | `2` | — |
| 18 | Evitou desinformação | `2` | — |
| 24 | Encerrou corretamente | checklist | ver abaixo |
| 25 | Confirmação de dados | `N/A` *(automático)* | Cliente chegou autenticado pelo canal — critério 29 = Sim. |
| 26 | Faltou com respeito | `Não ocorreu` | — |
| 27 | Contato encerrado sem atendimento | `Não ocorreu` | — |
| 28 | Promessa inexistente | `Não ocorreu` | — |

*(As demais linhas seguem o mesmo formato. A régua completa tem 28 critérios ativos.)*

**Checklist do critério 24:**

| Sub-pergunta | Resposta |
|---|---|
| Perguntou se o cliente possui mais alguma dúvida? | SIM |
| Despediu-se de forma correta? | SIM |
| Realizou incentivo à pesquisa de satisfação? | NÃO |

→ o sistema calcula `(2 ÷ 3) × 2 = 1.33`. Justificativa obrigatória, por estar abaixo do máximo:
"Encerrou com o script do canal e checou dúvidas, mas não convidou à pesquisa de satisfação."

### Evidências

```
14:12  Cliente: "Boa tarde, abri um chamado na segunda e até agora ninguém me retornou."
14:13  Atendente: "Boa tarde! O prazo para retorno é de até 5 dias úteis."
14:29  Atendente: "Fico feliz em ter conseguido te auxiliar. Se surgir qualquer nova
       necessidade, é só nos chamar. Seguimos à disposição!"
```

Ausência registrada: em nenhum momento da conversa há convite à pesquisa de satisfação.

### Blocos narrativos

**Contexto do Atendimento**
> Cliente iniciou o contato pelo WhatsApp às 14h12, já autenticado pelo canal, relatando
> ausência de retorno sobre um chamado aberto na segunda-feira. A atendente informou o prazo
> vigente, consultou o andamento e confirmou que o chamado seguia em análise. Ofereceu registrar
> a urgência, o cliente aceitou, e o atendimento foi encerrado às 14h31 com o script do canal.

**Pontos Positivos**
> Consultou o andamento real do chamado em vez de repetir o prazo padrão, e ofereceu registrar
> a urgência sem que o cliente pedisse. As informações passadas conferem com o que o sistema
> mostrava.

**Pontos de Atenção**
> Ao receber um relato de espera, reconhecer a espera antes de informar o prazo — uma frase
> como "entendo, três dias sem retorno é bastante tempo" muda a recepção do que vem depois.
> Incluir o convite à pesquisa de satisfação no encerramento, que faz parte do script.

**Leitura Técnica**
> O atendimento é tecnicamente sólido e emocionalmente raso, e as duas coisas aparecem juntas:
> a atendente domina o processo — consultou, confirmou, ofereceu ação — mas conduz a conversa
> como consulta de sistema, não como resposta a alguém que reclamou. A precisão das informações
> sustenta a nota; o que a limita é a abertura, onde o reconhecimento da queixa daria à mesma
> informação um efeito diferente.

**Erros Identificados**
> *(vazio — não houve erro técnico, falha de processo nem risco de experiência)*

**Conclusão**
> Atendimento resolutivo, com informação correta e encaminhamento adequado. O ponto a
> desenvolver é a abertura em contatos de reclamação: reconhecer o relato antes de informar o
> procedimento. Recomenda-se acompanhar esse comportamento nas próximas monitorias do canal
> WhatsApp.

---

## Checklist antes de entregar

- [ ] Todos os critérios ativos foram respondidos
- [ ] Nenhum N/A usado por falta de evidência — só por regra do critério
- [ ] Toda resposta abaixo do máximo tem justificativa
- [ ] Nenhuma justificativa afirma algo sem evidência no atendimento
- [ ] Nenhum trecho citado foi inventado
- [ ] Eliminatórios marcados apenas com evidência direta, e com citação
- [ ] Critério 29 respondido, e o 25 coerente com ele
- [ ] Os seis blocos narrativos preenchidos — ou vazios, quando vazio é legítimo
- [ ] A Leitura Técnica conecta critérios, não os lista
- [ ] Nenhuma nota final informada — o sistema calcula

---

## O que este manual não cobre

**Os textos de cada critério.** Orientação, âncoras e regra de N/A são cadastrados na plataforma
e mudam sem que este documento mude. Trabalhe sempre com a régua vigente ao lado.

**As orientações por tipo de atendimento** (§6.2 da metodologia). Estão previstas e ainda não
foram cadastradas; quando existirem, acrescentam contexto por tipo de contato — negociação,
segunda via, reclamação — que este manual não substitui.

**A decisão final.** Ela é humana, sempre. Sua saída é uma proposta fundamentada, e o valor dela
está em ser fácil de conferir e de discordar — não em estar certa.
