# Visão de Produto

> Documento de **direção**, não de escopo. Nada aqui está implementado.
> Registrado em 21/08/2026 (versão 0.9.0). Segundo eixo acrescentado em 07/09/2026.

O produto passou a ter **dois eixos de crescimento**, registrados em momentos diferentes e
independentes entre si:

| Eixo | O que muda | Seção |
|---|---|---|
| **Cliente** | O atendimento deixa de ser o topo do modelo; monitoria, CSAT e NPS convergem para o histórico de um cliente | abaixo |
| **Desenvolvimento** | A monitoria deixa de terminar na nota e passa a alimentar o desenvolvimento de quem atende | no fim |

Os dois se encontram no atendimento: é o mesmo registro que liga a monitoria ao cliente e ao
atendente. Nenhum dos dois está implementado, e nenhum bloqueia o outro.

---

# Eixo 1 — Cliente como entidade central

## Hoje: o eixo é o colaborador

Toda a plataforma pendura em `colaboradorId`. Uma monitoria registra quem foi avaliado, por
quem, em que canal, com que nota. O empreendimento e a categoria do atendimento são atributos
soltos, e o `protocolo` — até esta versão — era gravado e nunca lido.

A consequência prática é que **não existe cliente no modelo de dados**. Não há como responder
"quais atendimentos este cliente teve" nem "quais monitorias correspondem a esta reclamação".

## A virada de entendimento: NPS é processo, não indicador

O NPS foi reclassificado. Para a área de Qualidade ele não é um número de acompanhamento: é um
**gatilho operacional** com fluxo próprio.

```
Cliente responde NPS
        ↓
Qualidade recebe o caso
        ↓
Análise do histórico
        ↓
Análise das monitorias
        ↓
Nova monitoria, quando necessário
        ↓
Contato com o cliente
        ↓
Registro da tratativa
        ↓
Acompanhamento até conclusão
```

Três consequências diretas:

1. **NPS é item de primeiro nível do menu**, e não um sub-item de "Pesquisas" — item que
   deixou de existir.
2. **NPS aparece para a Monitora**, porque é ela quem executa o fluxo. Não é tela de consulta.
3. **CSAT e NPS não são gêmeos.** O CSAT é indicador de um atendimento; o NPS é fila de
   trabalho sobre uma relação. Estão lado a lado no menu por serem pilares, não por terem a
   mesma forma.

## Futuro: o eixo passa a ser o cliente

```
Cliente
 ├── Atendimentos          (chave: nº do atendimento · nº do título · canal · data)
 │    ├── Monitoria        → avaliação interna do atendimento
 │    ├── CSAT             → percepção do cliente sobre aquele atendimento
 │    └── NPS              → percepção do cliente sobre a relação
 ├── Tratativas            → casos abertos a partir de NPS, CSAT ou monitoria
 └── Histórico             → linha do tempo unificada
```

Monitorias, CSAT, NPS e Tratativas devem convergir para **uma visão única do histórico do
cliente**. O colaborador não desaparece: deixa de ser a raiz e passa a ser atributo do
atendimento.

## O que já foi preparado (versão 0.9.0)

**O `protocolo` virou campo obrigatório e pesquisável.** Era, então, a única chave disponível
para ligar uma monitoria ao atendimento e, por consequência, ao cliente.

A decisão de torná-lo obrigatório **também na edição** foi deliberada: monitorias registradas
antes desta versão ganham a chave quando forem abertas, em vez de deixar a base com dois
padrões. O objetivo é construir o histórico corretamente desde agora — a chave que não for
capturada no registro não se recupera depois.

> **Superado em 0.14.0 e 0.15.0 — ver abaixo.** O papel de chave externa passou para
> `numeroAtendimento` e `numeroTitulo`, e o `protocolo` deixou de ser digitado.

## Como as chaves ficaram (0.14.0 e 0.15.0)

A **0.14.0** trouxe os identificadores que a operação de fato usa, e com isso o `protocolo`
deixou de carregar sozinho a ligação com o atendimento:

- `numeroAtendimento` — identifica o atendimento no sistema de origem.
- `numeroTitulo` — identifica o **título do contrato**, e é por isso a chave mais próxima do
  cliente que o modelo já tem. É o gancho concreto para a virada descrita neste documento: a
  entidade Cliente, quando existir, pendura por aqui.
- `protocolo` — desde a **0.15.0** é **gerado pelo sistema** (`MON-2026-0001`), no primeiro
  salvamento e nunca reescrito. Deixou de apontar para fora: passou a nomear a monitoria.

O `id` continua sendo a chave técnica — usada em rotas e no `relatedId` das demandas — e desde
a 0.15.0 é gerado por sequência verificada contra a base, não por sorteio.

Protocolos digitados antes da 0.15.0 permanecem como estão, em formato livre. Não foram
migrados: eram registros de teste, e reescrevê-los inventaria dado que ninguém informou.

Na mesma linha, o modelo de demandas (`INITIAL_DEMANDS`, `demandsRepository`) foi
**preservado** mesmo com "Central de Demandas" e "Minhas Demandas" fora do menu. Ele já tem
exatamente a forma de uma tratativa — `type`, `assignedTo`, `priority`, `deadline`, `status`,
`origin` e `relatedId`, este último apontando de volta para o objeto que originou o caso. É a
fundação do fluxo de NPS; descartá-lo seria reconstruí-lo depois com outro nome.

Pelo mesmo motivo, o bloco "Demandas Prioritárias" da Home da Monitora foi **desligado e não
apagado**: é o slot da futura fila de casos de NPS aguardando tratativa.

## O que NÃO está em escopo

Cliente como entidade · qualquer backend · telas reais de CSAT e NPS · modelo de tratativa ·
hub completo de Administração · Fase 1.

O NPS operacional de verdade depende de backend: a persistência atual é `localStorage`, onde
cada navegador é uma base isolada.

---

# Eixo 2 — Desenvolvimento dos atendentes

> Registrado em 07/09/2026. **Direção, não escopo.** O documento conceitual do módulo será
> escrito depois que a operação real da monitoria estiver rodando — por decisão explícita: um
> módulo de desenvolvimento desenhado antes de existir histórico de notas seria desenhado no
> vazio.

## A mudança

O MonitorIA nasceu para **avaliar atendimentos**. A monitoria termina numa nota, num relatório
e numa conversa de feedback que acontece fora do sistema.

A direção agora é que ele também seja a plataforma onde o atendente **se desenvolve** — o que
significa que a monitoria deixa de ser o fim do processo e passa a ser a matéria-prima dele.

## O que a direção prevê

- **Histórico de notas por colaborador** — a série ao longo das competências, não só o registro
  de cada monitoria isolada.
- **Acompanhamento de evolução** — por bloco e por critério, com leitura de tendência.
- **Focos de desenvolvimento** — critérios ou blocos que a gestão elege para acompanhar em um
  período, sem alterar peso, régua, nota ou metodologia. Existem para medir progresso, e por
  isso ficam **fora do formulário de avaliação**: uma monitora que sabe qual é o foco antes de
  avaliar deixa de produzir o dado que mede aquele foco.
- **Feedbacks recorrentes** — o registro do que foi conversado, e a continuidade entre uma
  conversa e a seguinte. Hoje `strengths` e `opportunities` guardam texto por monitoria, sem
  fio entre elas.
- **Visualização para o atendente** — a colaboradora avaliada passa a ver a própria evolução.
  É a mudança mais significativa de público: até aqui o sistema tem três perfis e nenhum deles
  é a pessoa avaliada.
- **Substituição do PDI**, hoje conduzido fora do MonitorIA.

## Uma consequência de modelo, registrada desde já

Hoje `Collaborator` é **objeto de avaliação**, não usuário: quem é avaliado não acessa a
plataforma (`perfis: []`). "Visualização para os atendentes" muda isso — a colaboradora passa a
ser também alguém que entra, com um perfil próprio e escopo restrito aos próprios dados.

Isso não é um ajuste de tela: mexe em `User` × `Collaborator`, na matriz de permissões e no
escopo de leitura. É a decisão estruturante do eixo, e é o que o documento conceitual terá de
resolver primeiro.

## O que vem antes — prioridade declarada em 07/09/2026

Nenhuma linha do eixo 2 é escrita antes de a operação real acontecer:

1. Operação real da monitoria
2. Cadastro dos gestores
3. Configuração das áreas
4. Uso do fluxo completo, ponta a ponta

O motivo é direto: acompanhamento de evolução sem histórico de notas reais é gráfico de dado
inventado, e este projeto já removeu esse tipo de tela mais de uma vez.
