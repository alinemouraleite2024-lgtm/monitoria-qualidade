# Visão de Produto — Cliente como entidade central

> Documento de **direção**, não de escopo. Nada aqui está implementado.
> Registrado em 21/08/2026, junto com a reorganização da navegação (versão 0.9.0).

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
 ├── Atendimentos          (chave: protocolo · empreendimento · canal · data)
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

**O `protocolo` virou campo obrigatório e pesquisável.** É a única chave hoje disponível para
ligar uma monitoria ao atendimento e, por consequência, ao cliente.

A decisão de torná-lo obrigatório **também na edição** foi deliberada: monitorias registradas
antes desta versão ganham a chave quando forem abertas, em vez de deixar a base com dois
padrões. O objetivo é construir o histórico corretamente desde agora — a chave que não for
capturada no registro não se recupera depois.

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
