// A régua validada — âncoras, quando marcar N/A e critérios das sub-perguntas.
//
// Fatia 3A.0. Este arquivo é a régua de `docs/METODOLOGIA-MONITORIA.md` em forma de dado,
// validada integralmente em 25/08/2026: 32 itens revisados, 32 aprovados, nenhum ajuste.
//
// Por que existe separado de `INITIAL_CRITERIA`: os mesmos textos precisam alimentar duas
// coisas — o seed de uma base nova e a migração de uma base já gravada. Duplicá-los seria
// garantir que um dia divergissem.
//
// A partir daqui a governança da régua é da operação: o Admin edita estes campos, e a migração
// só preenche o que estiver ausente. Nada aqui sobrescreve cadastro feito na tela.

export interface ReguaSubPergunta {
  id: string;
  criterioSim: string;
  criterioNao: string;
}

export interface ReguaCriterio {
  /**
   * Indexada pela resposta como ela é gravada em `MonitoringScore.score`:
   * '2' | '1' | '0' para escala; '2' | '1.33' | '0.67' | '0' para faixa de tempo; o texto da
   * opção para classificação. Checklist não usa — a régua dele é por sub-pergunta.
   */
  ancoras?: Record<string, string>;
  /** Quando marcar N/A. Só existe onde N/A é resposta possível. */
  quandoNA?: string;
  /** Só os critérios de decisão; o texto da pergunta vive no próprio `Criterion`. */
  subPerguntas?: ReguaSubPergunta[];
  /**
   * Presente apenas onde a orientação do `Padrão Relatório` estava errada por cópia — os
   * critérios 14 e 27 repetiam o texto do 13 e do 28. Ver §9 da metodologia.
   */
  orientacao?: string;
}

export const REGUA_VALIDADA: Record<string, ReguaCriterio> = {
  'crit-02': {
    ancoras: {
      'Ativo': 'A empresa iniciou o contato. Retorno de um contato anterior do cliente também é ativo: a empresa discou',
      'Receptivo': 'O cliente iniciou o contato',
    },
  },
  'crit-25': {
    ancoras: {
      '0': 'Aciona: informação sensível — valores, saldo, parcelas, dados contratuais, boleto — foi repassada sem confirmação positiva de identidade; ou a pessoa não é o titular e não consta autorização de terceiro no Extrato V do Sienge ou no CRM',
      '2': 'Não aciona: atendimento receptivo pelo número cadastrado e com confirmação de ao menos um dado de segurança; nenhuma informação sensível repassada; ou o cliente chegou autenticado (critério 29 = Sim), caso em que este critério fica N/A',
    },
  },
  'crit-26': {
    ancoras: {
      '0': 'Aciona: ofensa, ironia, deboche ou grosseria; elevação de voz contra o cliente; interrupção sistemática com desqualificação do que ele diz',
      '2': 'Não aciona: atendente seco, apressado ou pouco empático — isso é nota baixa nos critérios 14, 20 e 23, não eliminatório. A fronteira é o desrespeito, não a frieza',
    },
  },
  'crit-27': {
    orientacao: 'Contato interrompido ou finalizado sem que o cliente tenha sido efetivamente atendido. O corte é pelo desfecho do atendimento, não pela causa da interrupção. Vale igual para telefone e WhatsApp.',
    ancoras: {
      '0': 'Aciona: o cliente ficou sem resposta; o atendimento foi abandonado; houve encerramento sem resolução e sem retorno; houve queda sem tentativa de contato posterior',
      '2': 'Não aciona: o cliente encerrou por conta própria após ser atendido; houve tentativa comprovada de retorno; a interrupção não prejudicou a conclusão do atendimento',
    },
  },
  'crit-28': {
    ancoras: {
      '0': 'Aciona: foi prometido desconto, prazo, isenção, condição de parcelamento ou serviço que não existe, ou algo fora do escopo do atendente',
      '2': 'Não aciona: a informação estava errada mas o produto existe — isso é o critério 18 com nota 0',
    },
  },
  'crit-01': {
    ancoras: {
      'Informação': 'O cliente quer saber algo; nada precisa ser feito depois',
      'Solicitação': 'O cliente pede uma ação — 2ª via, cálculo, envio, alteração cadastral',
      'Reclamação': 'Há insatisfação declarada com atendimento, produto ou cobrança anterior',
      'Sugestão': 'O cliente propõe melhoria, sem pedido nem queixa',
    },
  },
  'crit-29': {
    ancoras: {
      'Sim': 'A abertura cumprimenta pelo nome do cliente, sem pedir identificação e sem mencionar número divergente',
      'Não': 'A abertura pede o nome, ou o roteiro de número divergente foi acionado. Também é a resposta em canais sem pré-autenticação — telefone e presencial não têm esse passo',
      'Não identificável': 'A conversa não permite determinar: começa no meio, a saudação parece manual, ou o registro está incompleto',
    },
  },
  'crit-04': {
    subPerguntas: [
      { id: 'sub-04-1',
        criterioSim: 'Há saudação e o atendente diz o próprio nome',
        criterioNao: 'Falta a saudação ou falta o nome' },
      { id: 'sub-04-2',
        criterioSim: 'Linguagem formal, sem gíria nem tratamento íntimo',
        criterioNao: 'Usou gíria, apelido ou tratamento íntimo' },
      { id: 'sub-04-3',
        criterioSim: 'Manteve respeito e não interrompeu',
        criterioNao: 'Interrompeu, respondeu com aspereza ou ironia' },
      { id: 'sub-04-4',
        criterioSim: 'Reagiu ao que o cliente disse antes de responder',
        criterioNao: 'Respondeu por script, ignorando o que foi dito' },
    ],
    quandoNA: 'Nunca é N/A. A abertura existe em todo atendimento — e em contato ativo a identificação é ainda mais exigível.',
  },
  'crit-05': {
    ancoras: {
      '2': 'menos de 5 min — padrão ouro',
      '1.33': '5 a 15 min — aceitável, com espaço para melhoria',
      '0.67': 'acima de 15 min — há obstáculo de processo a eliminar',
      '0': 'pediu um momento no início — falta de prontidão',
    },
    quandoNA: 'N/A quando o contato é ativo: quem ligou foi a empresa.',
  },
  'crit-06': {
    ancoras: {
      '2': 'Perguntou para entender antes de responder e reconheceu explicitamente a situação do cliente. A resposta seguinte mostra que ele escutou.',
      '1': 'Foi cordial, mas respondeu direto ao pedido sem investigar; ou reconheceu a situação com fórmula pronta, sem conexão com o que o cliente disse.',
      '0': 'Ignorou o conteúdo emocional ou factual do pedido; respondeu outra coisa; tratou o cliente como interrupção.',
    },
    quandoNA: 'Nunca é N/A. Todo contato tem um pedido.',
  },
  'crit-07': {
    ancoras: {
      '2': 'Avisou antes de sair, e disse o que ia fazer — “vou verificar no sistema”.',
      '1': 'Avisou de forma genérica — “um momento” — sem dizer o motivo; ou avisou depois de já ter sumido.',
      '0': 'Sumiu sem avisar.',
    },
    quandoNA: 'N/A quando não houve espera. No WhatsApp, considera-se espera um intervalo relevante entre a última mensagem do cliente e a resposta seguinte, dentro de uma conversa em andamento.',
  },
  'crit-08': {
    ancoras: {
      '2': 'Agradeceu ao retomar, antes de entregar a informação.',
      '1': 'Retomou com a informação e agradeceu depois, ou de forma protocolar desconectada da espera real.',
      '0': 'Retomou direto, sem qualquer reconhecimento.',
    },
    quandoNA: 'N/A quando não houve espera — mesma leitura do critério 7.',
  },
  'crit-09': {
    ancoras: {
      '2': 'Explicação em passos, em linguagem simples, e houve checagem de entendimento durante ou ao final.',
      '1': 'Explicação correta mas em bloco único, com jargão, ou sem nenhuma checagem. O cliente entendeu apesar da explicação, não por causa dela.',
      '0': 'Explicação confusa, incompleta ou que deixou o cliente perguntando a mesma coisa de novo.',
    },
    quandoNA: 'N/A quando não havia nada a explicar — só confirmar recebimento, por exemplo.',
  },
  'crit-10': {
    ancoras: {
      '2': 'Argumentos apoiados em dado concreto — valor, data, cláusula, regra — e ligados ao pedido.',
      '1': 'Argumentos genéricos, ou corretos porém dispersos, com informação que o cliente não pediu.',
      '0': 'Argumentou fora do ponto, ou apresentou argumento sem sustentação.',
    },
    quandoNA: 'N/A quando não houve necessidade de argumentar — pedido direto e atendido.',
  },
  'crit-11': {
    ancoras: {
      '2': 'Ouviu, acolheu, respondeu com fato e confirmou com o cliente que a objeção foi resolvida.',
      '1': 'Respondeu a objeção com informação correta, mas sem acolher ou sem confirmar; ou resolveu no atrito.',
      '0': 'Ignorou a objeção, repetiu a mesma resposta sem reformular, ou entrou em confronto.',
    },
    quandoNA: 'N/A quando não houve objeção. Marcar N/A aqui é comum e legítimo — não forçar nota.',
  },
  'crit-12': {
    ancoras: {
      '2': 'Disse o que podia e o que não podia ser feito, com os próximos passos explícitos, em linguagem simples.',
      '1': 'Foi claro no que era favorável, mas contornou ou omitiu a parte desfavorável — prazo, limitação, condição.',
      '0': 'Deixou ambiguidade que gera nova ligação, ou deu resposta sem base para encerrar rápido.',
    },
    quandoNA: 'Nunca é N/A.',
  },
  'crit-13': {
    ancoras: {
      '2': 'Sem erro relevante. Pontuação e concordância adequadas ao canal.',
      '1': 'Erros pontuais que não comprometem o entendimento — digitação, acento, concordância isolada.',
      '0': 'Erros frequentes ou que comprometem o entendimento; escrita sem pontuação; abreviação de mensagem pessoal — “vc”, “blz”, “pq” — em canal institucional.',
    },
    quandoNA: 'Nunca é N/A.',
  },
  'crit-14': {
    orientacao: 'O tom Moura Leite é cordial e acolhedor, profissional e respeitoso: trata o cliente pelo nome com formalidade, sem excesso de intimidade e sem burocratizar o atendimento; não terceiriza responsabilidade para outras áreas; não usa ironia nem impaciência; e mantém o mesmo tom do início ao fim, inclusive quando o cliente muda o dele. Definição validada pela área em 25/08/2026.',
    ancoras: {
      '2': 'Tom consistente e alinhado do início ao fim; o cliente é tratado como cliente da empresa, não da pessoa.',
      '1': 'Tom adequado mas oscilante — cai em informalidade, burocratês ou distanciamento em alguns trechos.',
      '0': 'Tom que destoa da marca: seco, irônico, íntimo demais, ou que empurra a responsabilidade para outra área.',
    },
    quandoNA: 'Nunca é N/A. Não confundir com o 4: o 4 avalia a abertura; o 14 avalia o atendimento inteiro.',
  },
  'crit-15': {
    ancoras: {
      '2': 'Explicou a composição do valor, ouviu a limitação do cliente e ofereceu opção viável dentro da política.',
      '1': 'Informou o valor e a condição corretamente, mas sem explorar alternativa nem investigar a situação do cliente.',
      '0': 'Apenas informou o valor e encerrou; ou ofereceu condição fora da política.',
    },
    quandoNA: 'N/A quando não houve negociação — informação, 2ª via simples, atualização cadastral.',
  },
  'crit-16': {
    ancoras: {
      '2': 'Entendeu o pedido, entregou informação correta e completa, e só o que era necessário.',
      '1': 'Informação correta mas incompleta — faltou dado que o cliente precisaria — ou correta com excesso que confundiu.',
      '0': 'Informação errada, desatualizada, ou que não respondia ao que foi perguntado.',
    },
    quandoNA: 'Nunca é N/A. Sempre há informação em jogo.',
  },
  'crit-17': {
    ancoras: {
      '2': 'O desfecho corresponde ao pedido inicial e o cliente confirmou que atendia.',
      '1': 'Ofereceu solução parcial, ou solução correta que o cliente não confirmou aceitar.',
      '0': 'Encerrou sem solução, ou entregou algo diferente do que foi pedido.',
    },
    quandoNA: 'Nunca é N/A.',
  },
  'crit-18': {
    ancoras: {
      '2': 'Tudo o que foi afirmado se sustenta. Onde não sabia, disse que ia verificar.',
      '1': 'Afirmou com segurança algo que deveria ter confirmado antes, mesmo que por sorte estivesse certo.',
      '0': 'Passou informação incorreta, ou afirmou o que não podia garantir.',
    },
    quandoNA: 'Nunca é N/A.',
  },
  'crit-19': {
    ancoras: {
      '2': 'Resolvido neste contato, sem transferência e sem promessa de retorno.',
      '1': 'Resolvido, mas com transferência, consulta demorada ou retorno em segundo momento — resolvido, porém não no primeiro contato.',
      '0': 'Não resolvido; ficou dependendo de nova ação do cliente.',
    },
    quandoNA: 'N/A quando o contato, por natureza, não se encerra em si — protocolo que depende de área externa e foi corretamente encaminhado. Registrar o motivo.',
  },
  'crit-20': {
    ancoras: {
      '2': 'Manteve postura e ritmo mesmo quando o atendimento ficou difícil.',
      '1': 'Manteve o profissionalismo, mas deixou transparecer pressa, cansaço ou desinteresse em algum trecho.',
      '0': 'Perdeu a paciência, respondeu com aspereza, ou deixou questão pessoal invadir o atendimento.',
    },
    quandoNA: 'Nunca é N/A.',
  },
  'crit-21': {
    ancoras: {
      '2': 'Aplicou técnica identificável e a tensão baixou — o cliente muda de tom depois.',
      '1': 'Tentou acalmar, mas de forma genérica ou tardia; a tensão permaneceu.',
      '0': 'Não tentou, ou escalou — respondeu na mesma temperatura, confrontou, culpou o cliente.',
    },
    quandoNA: 'N/A quando não houve tensão. É a marcação esperada na maioria dos casos: a própria orientação diz que o critério só é aplicável quando houver tensão.',
  },
  'crit-22': {
    ancoras: {
      '2': 'Resumiu os pontos e obteve confirmação do cliente.',
      '1': 'Perguntou “tem mais alguma dúvida?” sem resumir; ou resumiu e encerrou sem esperar resposta.',
      '0': 'Encerrou sem qualquer verificação.',
    },
    quandoNA: 'N/A quando não havia informação a reter — só confirmação de recebimento.',
  },
  'crit-23': {
    ancoras: {
      '2': 'O atendimento é personalizado do início ao fim: usa o nome, retoma o contexto, agradece e deixa a porta aberta.',
      '1': 'Correto e cordial, mas impessoal — qualquer cliente receberia exatamente as mesmas frases.',
      '0': 'Transacional ou frio; o cliente foi tratado como chamado.',
    },
    quandoNA: 'Nunca é N/A.',
  },
  'crit-24': {
    subPerguntas: [
      { id: 'sub-24-1',
        criterioSim: 'Perguntou e aguardou resposta',
        criterioNao: 'Não perguntou, ou perguntou e encerrou sem esperar' },
      { id: 'sub-24-2',
        criterioSim: 'Enviou o script do canal, com sentido preservado',
        criterioNao: 'Despedida improvisada, ou script de outro canal' },
      // sub-24-3 (incentivo à pesquisa de satisfação) retirada em 07/10/2026 — procedimento
      // descontinuado pela operação. Ver docs/METODOLOGIA-MONITORIA.md §4, critério 24.
    ],
    quandoNA: 'N/A quando o atendimento foi interrompido pelo cliente antes do fechamento. Nesse caso, verificar se cabe o eliminatório 27.',
  },

};
