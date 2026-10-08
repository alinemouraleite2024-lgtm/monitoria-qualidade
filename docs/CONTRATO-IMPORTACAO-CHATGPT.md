# Contrato de importação — `monitoria-chatgpt/1`

> **O que é:** o formato exato do bloco JSON que o agente de qualidade do ChatGPT entrega ao
> final de uma monitoria revisada, e que a monitora cola em **Nova Monitoria → Importar
> avaliação do ChatGPT**.
>
> **Estado:** em homologação, em branch isolada a partir da 0.24.1. Ainda **não publicado**.
>
> **Exemplo completo e válido:** [`exemplos/AGO-001.monitoria-chatgpt.json`](exemplos/AGO-001.monitoria-chatgpt.json)
> — a AGO-001, nota aprovada 78,57. **Dados de cliente e identificadores (nº de atendimento e de
> título) são fictícios**; o `crit-29` está corrigido para `"Não"`, como manda a régua para telefone.

## Princípios

1. **O MonitorIA decide, o JSON propõe.** A importação só preenche o formulário. Nada é gravado
   ao colar; a monitoria nasce quando a monitora percorre as cinco etapas e conclui, pelo
   salvamento de sempre, e segue para a validação da gestão.
2. **A nota é sempre do MonitorIA.** O agente não envia nota final. Se enviar, ela é ignorada.
3. **Critério é identificado pelo id oficial** (`crit-09`), nunca pela posição ou pela numeração
   visual. O nome é opcional e serve só para conferência.
4. **A régua é a cadastrada no sistema.** Critério inativo, inexistente ou fora do canal é
   recusado; valores, opções, sub-perguntas e regra de N/A são lidos do cadastro vigente.
5. **Tudo ou nada.** Qualquer erro bloqueia a importação inteira e nada é aplicado. Avisos não
   bloqueiam.

## Estrutura

```jsonc
{
  "schema": "monitoria-chatgpt/1",          // obrigatório, exatamente este texto
  "geradoEm": "2026-10-07T10:00:00-03:00",  // opcional, informativo
  "revisadoPor": "Aline Oliveira Verneck",  // opcional, exibido na prévia

  "atendimento": { ... },                   // obrigatório
  "criterios":   [ ... ],                   // obrigatório
  "relatorio":   { ... },                   // obrigatório
  "conferencia": { "notaEsperada": 78.57 }  // opcional
}
```

### `atendimento`

| Campo | Obrigatório | Formato | Regra |
|---|---|---|---|
| `colaboradorId` | um dos dois | texto, ex. `"usr-4"` | **Prevalece sobre o nome.** Precisa existir no cadastro |
| `colaborador` | um dos dois | nome completo | Sem id, precisa corresponder a exatamente um colaborador (acento e caixa não importam). **Com id e nome que não batem, a importação é bloqueada** |
| `monitora` (ou `monitoraId`) | sim | nome completo | Precisa ser a usuária logada — a monitoria é creditada a quem está na sessão |
| `competencia` | sim | `"AAAA-MM"` | Se diferir do mês do início do atendimento, gera aviso e é mantida |
| `dataAtendimento` | sim | `"AAAA-MM-DD"` | Precisa ser o dia do `inicioAtendimento` |
| `canal` | sim | `WhatsApp` · `Telefone` · `Teams` · `Presencial` · `E-mail` · `Chat` | `"Ligação"` é aceito como `Telefone` |
| `categoria` | sim | texto do catálogo | Precisa estar no catálogo. A importação **não cria** categoria. *Cessão de direitos* é `TRANSFERÊNCIA DE TITULARIDADE` |
| `tipo` | sim | `Regular` · `Direcionada` · `Processo` · `Calibração` | |
| `numeroAtendimento` | sim | **texto entre aspas** | Número sem aspas é recusado: perderia zeros à esquerda (`00123`) |
| `numeroTitulo` | sim | texto entre aspas | |
| `inicioAtendimento` | sim | `"AAAA-MM-DDTHH:MM"` ou `…:SS` | **Sem fuso horário** |
| `fimAtendimento` | sim | idem | Igual ou posterior ao início |
| `linkAtendimento` | não | URL | Vai para *Link do Atendimento* |

**Nunca enviar:** nota final, conceito, protocolo, código, status, duração. São do sistema — se
vierem, são ignorados com aviso.

### `criterios`

Uma entrada por critério ativo do canal — hoje, **28**. Todos são obrigatórios; o único que
pode faltar é o `crit-25` quando o `crit-29` for `"Sim"`.

| Campo | Obrigatório | Descrição |
|---|---|---|
| `criterionId` | sim | Id oficial — ver tabela abaixo |
| `criterioNome` | não | Nome do critério. Se divergir do cadastro, gera aviso; vale o id |
| `resposta` | sim, exceto checklist | Ver tabela |
| `subRespostas` | só checklist | Objeto com **todas** as sub-perguntas: `"SIM"` ou `"NÃO"` |
| `justificativa` | quando a resposta é abaixo de 2 | **Obrigatória** para `1`, `0`, `1.33`, `0.67` e checklist abaixo de 2 — inclusive eliminatório ocorrido (`0`). Opcional em N/A |
| `evidencia` | não | Trecho ou fato que sustenta a resposta. **É anexado ao final da justificativa** como `Evidência: …` |
| `confianca` | não | `ALTA` · `MEDIA` · `BAIXA`. Aparece na prévia; `BAIXA` exige confirmação individual |
| `revisaoHumana` | não | `true` exige confirmação individual na prévia |
| `sinalizacao` | não | Texto livre, exibido na prévia |

Justificativa e evidência em resposta máxima (`2`) ou em classificação **não são aplicadas** —
o formulário não tem campo para elas nesses casos —, e a prévia avisa.

#### Critérios ativos (régua vigente na 0.24.1)

| Id | Critério | Tipo | Peso | `resposta` aceita | N/A? |
|---|---|---|---|---|---|
| `crit-01` | Qual o motivo do contato? | Classificação | 0 | `Informação` · `Solicitação` · `Reclamação` · `Sugestão` | não |
| `crit-02` | Atendimento ativo ou receptivo? | Classificação | 0 | `Ativo` · `Receptivo` | não |
| `crit-29` | Cliente chegou autenticado? | Classificação | 0 | `Sim` · `Não` · `Não identificável` | não |
| `crit-04` | Cumprimentos / identificação | Checklist | 1 | `subRespostas`: `sub-04-1`, `sub-04-2`, `sub-04-3`, `sub-04-4` | não |
| `crit-05` | Rapidez para atender a ligação | Faixa de tempo | 1 | `2` · `1.33` · `0.67` · `0` | sim |
| `crit-06` | Demonstrou interesse e empatia com o pedido do cliente? | Escala | 2 | `2` · `1` · `0` | **não** |
| `crit-07` | Avisou que ia buscar informações antes de deixar o cliente em espera? | Escala | 1 | `2` · `1` · `0` | sim |
| `crit-08` | Ao retomar o contato agradeceu o tempo de espera? | Escala | 1 | `2` · `1` · `0` | sim |
| `crit-09` | Teve didática para explicar? | Escala | 1 | `2` · `1` · `0` | sim |
| `crit-10` | Fez argumentações pertinentes? | Escala | 1 | `2` · `1` · `0` | sim |
| `crit-11` | Lidando com objeções? | Escala | 1,5 | `2` · `1` · `0` | sim |
| `crit-12` | Comunicação clara e transparente? | Escala | 1,5 | `2` · `1` · `0` | **não** |
| `crit-13` | Gramática escrita e falada? | Escala | 1 | `2` · `1` · `0` | **não** |
| `crit-14` | Tom de voz Moura Leite? | Escala | 1 | `2` · `1` · `0` | **não** |
| `crit-15` | O agente demonstrou habilidades de negociação eficazes? | Escala | 1,5 | `2` · `1` · `0` | sim |
| `crit-16` | Forneceu informações precisas e relevantes para resolver o problema do cliente? | Escala | 2 | `2` · `1` · `0` | **não** |
| `crit-17` | Ofereceu uma solução que atendesse às necessidades do cliente? | Escala | 1,5 | `2` · `1` · `0` | **não** |
| `crit-18` | O agente evitou desinformação ou engano? | Escala | 2 | `2` · `1` · `0` | **não** |
| `crit-19` | Resolução no Primeiro Contato - FCR? | Escala | 1,5 | `2` · `1` · `0` | sim |
| `crit-20` | Demonstrou paciência e profissionalismo? | Escala | 1 | `2` · `1` · `0` | **não** |
| `crit-21` | Aplicou a técnicas de desescalada? | Escala | 1 | `2` · `1` · `0` | sim |
| `crit-22` | Verificou se o cliente entendeu as informações repassadas? | Escala | 1 | `2` · `1` · `0` | sim |
| `crit-23` | Construção de Relacionamento? | Escala | 1 | `2` · `1` · `0` | **não** |
| `crit-24` | Encerrou o contato corretamente? | Checklist | 1,5 | `subRespostas`: `sub-24-1`, `sub-24-2` | não |
| `crit-25` | Confirmação de dados de segurança insuficiente | Eliminatório | 0 | `2` não ocorreu · `0` ocorreu | só pelo portão do `crit-29` |
| `crit-26` | Faltou com respeito ao cliente | Eliminatório | 0 | `2` não ocorreu · `0` ocorreu | não |
| `crit-27` | Ligação derrubada ou atendimento encerrado sem atendimento do cliente? | Eliminatório | 0 | `2` não ocorreu · `0` ocorreu | não |
| `crit-28` | Promessa de produto/serviço inexistente | Eliminatório | 0 | `2` não ocorreu · `0` ocorreu | não |

O `crit-03` (canal) está **inativo** e é recusado se vier. O `crit-24` tem **duas**
sub-perguntas desde a 0.24.1 — um JSON com `sub-24-3` é recusado com a mensagem *"régua
antiga"*.

**Regras entre critérios.** Em **Telefone e Presencial**, `crit-29 = "Sim"` é recusado: esses
canais não têm pré-autenticação, e o "Sim" dispensaria o eliminatório 25 sem avaliação. No
WhatsApp, com `crit-29 = "Sim"`, o `crit-25` vira `N/A` automaticamente
(o canal autenticou o cliente). Com `crit-29 = "Sim"` **e** `crit-25 = 0`, a importação é
bloqueada por contradição — como já acontece na tela.

**Tolerâncias, todas com aviso:** `"2"` em texto vira `2`; `"1,33"` vira `1.33`; `"NÃO"`,
`"Não"` e `"NAO"` valem o mesmo; opções e categoria são comparadas sem acento e sem caixa; nos
eliminatórios, `"Não ocorreu"` e `"Sim, ocorreu"` também são aceitos.

### `relatorio`

Os seis blocos do *Padrão Relatório de Monitoria*. **As seis chaves são obrigatórias**; o
conteúdo pode ser `""`, exceto `contexto` e `conclusao`.

| Chave | Bloco no MonitorIA |
|---|---|
| `contexto` | Contexto do Atendimento |
| `pontosPositivos` | Pontos Positivos |
| `pontosAtencao` | Pontos de Atenção |
| `leituraTecnica` | Leitura Técnica |
| `errosIdentificados` | Erros Identificados |
| `conclusao` | Conclusão |

### `conferencia`

| Campo | Descrição |
|---|---|
| `notaEsperada` | A nota **aprovada pela monitora** na revisão, se ela a tiver (ex.: a `notaConferencia` da planilha). **O agente não calcula este número.** O MonitorIA recalcula a nota e, se a diferença passar de 0,01, **bloqueia** a importação — sinal de que o agente usou régua diferente |

## O que acontece ao colar

```
Colar → Validar → Prévia → Confirmações → Aplicar → Formulário preenchido → Revisão nas 5 etapas → Concluir
                    │                         │
                    └ erro? nada é aplicado    └ nada é gravado até "Concluir"
```

A prévia mostra os dados do atendimento, a nota calculada pelo MonitorIA, a lista de avisos e a
tabela de respostas com confiança e justificativa. O botão **Aplicar** só habilita depois de:

- **cada eliminatório** confirmado individualmente (um eliminatório marcado como ocorrido aparece
  em vermelho; ao salvar, a monitoria vai à gestão para confirmar o zeramento — a importação
  nunca zera nota);
- cada resposta com confiança `BAIXA` ou `revisaoHumana: true` confirmada;
- confirmação explícita, se o mesmo atendimento (nº do atendimento + nº do título) já tiver
  monitoria não cancelada — a existente **não é alterada**;
- confirmação explícita, se o formulário já tiver conteúdo, listando o que será substituído.

A importação só existe na **Nova Monitoria**. Não aparece na edição (não reescreve monitoria
cadastrada) nem no lançamento retroativo (que nasce validado e não passaria pela gestão).

---

## Instrução para o agente do ChatGPT

É o mesmo bloco que está no fim de [`PROMPT-IA-MONITORIA.md`](PROMPT-IA-MONITORIA.md). Copie o
que está entre as linhas `═══` e acrescente às instruções do agente, depois da etapa de revisão.

═══════════════════════════════════════════════════════════════════════════════

## Entrega para o MonitorIA — JSON `monitoria-chatgpt/1`

Esta etapa vem **depois** da revisão. Só gere o JSON quando a monitora disser que a monitoria
está **revisada e aprovada**. Antes disso, nunca.

Quando ela aprovar, responda com **um único bloco de código JSON** e nada mais dentro do bloco.
Ela vai colá-lo no MonitorIA, em *Nova Monitoria → Importar avaliação do ChatGPT*. O MonitorIA
recusa o bloco inteiro se qualquer regra abaixo for violada — siga à risca.

**O JSON reproduz a versão aprovada.** Se a monitora alterou uma resposta, uma justificativa ou
um bloco do relatório durante a revisão, o JSON leva a versão alterada, não a sua original.

### Regras

1. **Versão.** A primeira chave é sempre `"schema": "monitoria-chatgpt/1"`.
2. **Identificação dos critérios.** Use somente o `criterionId`: `crit-` + o número com dois
   dígitos (`crit-01`, `crit-09`, `crit-29`). Nunca a posição na lista. Inclua `criterioNome`
   para conferência. São **28**: `crit-01`, `crit-02` e `crit-04` a `crit-29`. O `crit-03` está
   inativo — não inclua.
3. **Respostas**, com números **sem aspas**:
   - escala: `2`, `1`, `0` ou `"N/A"`;
   - `crit-05` (faixa de tempo): `2`, `1.33`, `0.67`, `0` ou `"N/A"`;
   - classificações (`crit-01`, `crit-02`, `crit-29`): o texto exato de uma opção;
   - eliminatórios (`crit-25` a `crit-28`): `2` = não ocorreu · `0` = ocorreu.
4. **Checklists** (`crit-04` e `crit-24`): não envie `resposta`. Envie `subRespostas` com
   **todas** as sub-perguntas, `"SIM"` ou `"NÃO"`: `sub-04-1` a `sub-04-4`; `sub-24-1` e
   `sub-24-2` (o `crit-24` tem só duas).
5. **N/A** só onde a régua permite. **Nunca** em `crit-06`, `12`, `13`, `14`, `16`, `17`, `18`,
   `20`, `23`, nos checklists, nas classificações e nos eliminatórios.
6. **Autenticação — `crit-29` e `crit-25`:**
   - **Telefone e Presencial:** `crit-29` é sempre `"Não"`, e o `crit-25` é avaliado
     normalmente (`2` ou `0`).
   - **WhatsApp com `crit-29` = `"Sim"`:** o `crit-25` é `"N/A"` (dispensado pela autenticação
     do canal).
   - Nunca `crit-29` = `"Sim"` com `crit-25` = `0`.
7. **Justificativa** obrigatória em toda resposta abaixo de 2 — inclusive `1.33`, `0.67`,
   checklist com algum `"NÃO"` e eliminatório ocorrido (`0`). Opcional em N/A.
8. **Evidência**: o trecho ou o fato que sustenta a resposta vai em `evidencia`. **Nunca invente
   evidência.**
9. **Confiança**: em cada critério avaliado, `confianca` (`"ALTA"`, `"MEDIA"` ou `"BAIXA"`) e
   `revisaoHumana` (`true` ou `false`).
10. **Nota**: não informe nota final, conceito, protocolo, código nem status — o MonitorIA
    calcula. Só preencha `conferencia.notaEsperada` se a monitora informar a nota aprovada.
11. **Atendimento**:
    - `colaborador` com o nome completo (e `colaboradorId`, se a monitora informar);
    - `monitora` com o nome completo de quem revisou;
    - `competencia` `"AAAA-MM"` — o mês do **atendimento**;
    - `dataAtendimento` `"AAAA-MM-DD"` — o mesmo dia do início;
    - `inicioAtendimento` e `fimAtendimento` `"AAAA-MM-DDTHH:MM:SS"`, **sem fuso horário**;
    - `numeroAtendimento` e `numeroTitulo` **sempre entre aspas** (`"00123"`, nunca `00123`);
    - `canal`: `WhatsApp`, `Telefone`, `Teams`, `Presencial`, `E-mail` ou `Chat` (ligação é
      `Telefone`);
    - `tipo`: `Regular`, `Direcionada`, `Processo` ou `Calibração`;
    - `categoria`: exatamente como no catálogo oficial. Cessão de direitos é
      `TRANSFERÊNCIA DE TITULARIDADE`.
12. **Relatório**: as seis chaves sempre presentes — `contexto`, `pontosPositivos`,
    `pontosAtencao`, `leituraTecnica`, `errosIdentificados`, `conclusao`. Use `""` quando não
    houver conteúdo; `contexto` e `conclusao` nunca vazios.

### Modelo

```json
{
  "schema": "monitoria-chatgpt/1",
  "revisadoPor": "<nome da monitora>",
  "atendimento": {
    "colaborador": "<nome completo da colaboradora>",
    "monitora": "<nome completo da monitora>",
    "competencia": "AAAA-MM",
    "dataAtendimento": "AAAA-MM-DD",
    "canal": "Telefone",
    "categoria": "<categoria do catálogo>",
    "tipo": "Regular",
    "numeroAtendimento": "<nº entre aspas>",
    "numeroTitulo": "<nº entre aspas>",
    "inicioAtendimento": "AAAA-MM-DDTHH:MM:SS",
    "fimAtendimento": "AAAA-MM-DDTHH:MM:SS"
  },
  "criterios": [
    { "criterionId": "crit-01", "criterioNome": "Qual o motivo do contato?", "resposta": "Solicitação" },
    { "criterionId": "crit-02", "criterioNome": "Atendimento ativo ou receptivo?", "resposta": "Receptivo" },
    { "criterionId": "crit-29", "criterioNome": "Cliente chegou autenticado?", "resposta": "Não" },
    { "criterionId": "crit-04", "criterioNome": "Cumprimentos / identificação",
      "subRespostas": { "sub-04-1": "SIM", "sub-04-2": "SIM", "sub-04-3": "SIM", "sub-04-4": "SIM" },
      "confianca": "ALTA", "revisaoHumana": false },
    { "criterionId": "crit-09", "criterioNome": "Teve didática para explicar?", "resposta": 1,
      "justificativa": "<por que não foi 2>", "evidencia": "<trecho ou fato>",
      "confianca": "ALTA", "revisaoHumana": false },
    { "criterionId": "crit-11", "criterioNome": "Lidando com objeções?", "resposta": "N/A",
      "justificativa": "<por que não se aplica>", "confianca": "ALTA", "revisaoHumana": false },
    { "criterionId": "crit-25", "criterioNome": "Confirmação de dados de segurança insuficiente", "resposta": 2,
      "confianca": "ALTA", "revisaoHumana": false }
  ],
  "relatorio": {
    "contexto": "<texto aprovado>",
    "pontosPositivos": "<texto aprovado>",
    "pontosAtencao": "<texto aprovado>",
    "leituraTecnica": "<texto aprovado>",
    "errosIdentificados": "",
    "conclusao": "<texto aprovado>"
  }
}
```

O modelo mostra só alguns critérios para exemplificar cada tipo. **O JSON entregue tem os 28.**

### Antes de entregar o JSON, confira

- [ ] A monitora aprovou a revisão
- [ ] 28 critérios, identificados por `criterionId`, sem `crit-03`
- [ ] Checklists só com `subRespostas`; `crit-24` com duas sub-perguntas
- [ ] Toda resposta abaixo de 2 com justificativa
- [ ] Telefone ou presencial → `crit-29` = `"Não"` e `crit-25` avaliado
- [ ] Números de atendimento e título entre aspas; datas sem fuso
- [ ] Nenhuma nota final no JSON
- [ ] As seis chaves do relatório presentes

═══════════════════════════════════════════════════════════════════════════════

## Manutenção

- **Mudou a régua no Admin?** O importador acompanha sozinho — ele lê o cadastro. Quem precisa
  ser atualizado é a instrução do agente (a tabela acima e as regras 3, 5 e 6).
- **Mudou o formato?** Crie `monitoria-chatgpt/2`. Um JSON de versão desconhecida é recusado
  com mensagem clara, em vez de ser lido pela metade.
- Código: `src/domain/importacaoChatGPT.ts` (validação, pura) e
  `src/modules/monitoring/ImportarAvaliacaoModal.tsx` (tela). Testes:
  `node --import ./tests/registrar-ts.mjs --test tests/importacaoChatGPT.test.ts`.
