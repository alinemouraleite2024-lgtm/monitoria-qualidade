# Operação do MonitorIA

> **Fonte oficial do contexto operacional do projeto.** Este documento existe para que o
> estado das decisões não dependa de conversa. Quando algo aqui divergir da memória de
> alguém, este documento vence — e quem discordar atualiza aqui.
>
> **Última atualização:** 20/08/2026, véspera dos pilotos.

---

## 1. Estado atual

| | |
|---|---|
| **Sistema** | em produção |
| **URL oficial** | https://monitoria-qualidade.vercel.app |
| **Versão** | 0.8.1 |
| **Último commit publicado** | `3756071` |
| **Pilotos** | pendentes — 20 e 21/08 |
| **Sprint aberta** | nenhuma |
| **Funcionalidade nova aprovada** | nenhuma |

A Sprint 0 está encerrada e publicada. O foco deixou de ser desenvolvimento e passou a ser
**colocar o sistema em uso real**. O preenchimento da monitoria continua manual, exatamente como
já era feito no CYF — a mudança é de ferramenta de registro, não de método de avaliação.

### Acessos

```
Aline (Monitora)     aline@mouraleite.com.br     ·  Monitor@123
Raquel (Gestora)     raquel@mouraleite.com.br    ·  Gestor@123
Administradora       admin@mouraleite.com.br     ·  Admin@123
```

Senhas de homologação. Trocar antes de qualquer uso fora da equipe.

---

## 2. Modelo de operação — A, estação única

**Aprovado em 19/08/2026.**

Toda monitoria é registrada em **uma única máquina** — a da Aline. A Raquel aprova nessa mesma
máquina, sentada ao lado ou por compartilhamento de tela.

### Por que existe essa restrição

A persistência é em `localStorage`: **cada navegador é uma base isolada**. Não há servidor de
dados. Se a Raquel abrir a URL no computador dela, vai entrar normalmente e ver uma base
**vazia** — nenhuma monitoria da Aline aparece lá.

Isso não é falha, não é perda de dado e não é problema de acesso. É como o sistema guarda as
informações nesta fase, e é o que define o modelo de operação.

### Validação da gestora — **ativa**

Monitoria preenchida pela Aline nasce `Pendente` e espera aprovação da Raquel.
Preenchida pela Raquel ou pela Administradora, nasce `Validada` direto.

Mantida ligada por decisão: é o controle que o preenchimento manual no CYF não oferece, e no
Modelo A a Raquel tem acesso à mesma máquina.

---

## 3. Regras operacionais

| # | Regra | Por quê |
|---|---|---|
| 1 | Sempre a mesma máquina, o mesmo navegador, o mesmo perfil | Outra máquina enxerga uma base vazia |
| 2 | Nunca limpar dados de navegação nessa máquina | Apaga todas as monitorias |
| 3 | Nunca usar janela anônima | Some tudo ao fechar |
| 4 | **Exportar a planilha ao fim de cada dia** | É a única cópia de segurança que existe |
| 5 | Anexo de arquivo **não guarda a gravação** — usar o campo `Link do Atendimento` | O anexo registra só o nome do arquivo |
| 6 | **Avisar e exportar antes de qualquer publicação nova** | Uma publicação pode zerar a base local |

> A regra 6 passou a valer **a partir do primeiro registro real**. Até 20/08 a base estava
> vazia e as publicações eram seguras sem cerimônia.

### Telas que não devem ser usadas para acompanhar em agosto

**Dashboard Executivo** e **Planejamento** estão fixos em junho/2026 no código. Monitoria de
agosto é registrada normalmente, mas aparece como zero nesses dois painéis. O acompanhamento
se faz pela lista **Monitorias** e pela tela inicial da monitora, que usam o mês corrente.

---

## 4. Travas conhecidas que afetam a operação

| # | Trava | Impacto |
|---|---|---|
| 1 | **O vínculo de carteira decide a quem a monitoria é creditada** — não quem preencheu. Falha em silêncio | 🔴 alto |
| 2 | Anexo de arquivo não armazena o arquivo | 🟠 médio |
| 3 | Dashboard e Planejamento fixos em junho/2026 | 🟠 médio |
| 4 | Usuário criado pela tela **não consegue entrar** — o login resolve contra a base estática | 🟠 médio |
| 5 | `status: BLOCKED` impede novo login, mas **não derruba sessão já aberta** | 🟡 baixo |
| 6 | Migração de nota 0-10 → 0-100 não é idempotente | 🟡 baixo, sem dado exposto hoje |

A trava 1 é a mais perigosa porque não emite erro. A verificação é sempre a mesma: **depois de
salvar, a coluna Monitor precisa mostrar quem preencheu.**

---

## 5. Pendências operacionais

Nenhuma delas é de desenvolvimento. Todas dependem da operação.

| # | Pendência | Bloqueia o piloto? |
|---|---|---|
| 1 | **Corrigir os vínculos de carteira** | 🔴 **sim** |
| 2 | Confirmar a lista real de empreendimentos | não, mas precisa estar decidida |
| 3 | Confirmar a lista real de categorias | não, mas precisa estar decidida |
| 4 | Confirmar quais colaboradoras são monitoradas | não |
| 5 | Definir a estação e salvar o favorito | não |

### Vínculos — situação e alvo

| Colaborador | Vínculo em 20/08 | Deve ficar |
|---|---|---|
| Nathalia Perger Oyan | Raquel | **Aline** |
| Allanis Maquea Silva | Raquel | **Aline** |
| Susana Nascimento | Raquel | **Aline** |
| Aline Oliveira Verneck | Raquel | **sem vínculo** |
| Ana Carla | Aline | Aline |

Em **Menu → Colaboradores**: `Adicionar Vínculo` apontando para a Aline (criar um vínculo novo
encerra o anterior sozinho) e `Terminar` na linha da Aline.

Restrição da tela: o campo `Monitor Responsável` só lista perfis MONITOR — hoje **apenas a
Aline** aparece. A Raquel é GESTORA e não pode ser escolhida como monitora de um vínculo novo.

### Listas — rascunho a confirmar

Extraído dos arquivos de apoio da equipe, **não é cadastro oficial**:

| Cidade | Empreendimento |
|---|---|
| Boituva | Reserva dos Ipês |
| Botucatu | Parque Cidade |
| Botucatu | Reserva Central Parque |
| Avaré | Central Parque |
| Cerqueira César | Novo Horizonte |
| Taguaí | Jardim dos Ipês |
| Piraju | Alto da Bela Vista |

**Categorias (menor confiança):** Escritura · 2ª Via de Boleto · Extrato e Saldo Devedor ·
Reajuste · Desconto e Negociação · Cessão de Direitos · Distrato · Permuta · Inventário e
Partilha · Andamento de Obra · Dúvida · Reclamação

Empreendimentos e categorias **não têm tela de cadastro**: são criados dentro do formulário de
monitoria, digitando o valor e usando a opção de criar. Ficam salvos para as próximas.

---

## 6. Estratégia dos pilotos — 20 e 21/08

**Enquadramento: início controlado da operação real, não homologação.** O que for registrado
nesses dois dias **fica**. O CYF segue em paralelo como conferência.

### Quinta, 20/08 — execução

Aline e Raquel juntas, na mesma máquina. Três casos escolhidos por perfil:

| Caso | Perfil | O que prova |
|---|---|---|
| 1 | Nota alta, sem ressalva | O caminho normal e o cálculo |
| 2 | Nota média, com critério abaixo do máximo | Justificativa obrigatória e o peso |
| 3 | Critério eliminatório acionado | Que a nota **não** zera sozinha |

Ciclo completo em cada caso, sem acumular: Aline preenche, Raquel entra e decide na hora.
Testar também `Reprovar` e `Solicitar Ajustes` ao menos uma vez.

### Sexta, 21/08 — observação

A Raquel **não intervém**. De 3 a 5 casos do fluxo normal.

**A sexta é a coleta, não a quinta.** Na quinta a Aline é conduzida e o comportamento não é
espontâneo.

#### O que registrar

**Os três primeiros cliques depois do login**, por sessão:

```
Sessão 1 · 08h12 · Home → Monitorias → Nova Monitoria
Sessão 2 · 10h40 · (foi direto em Minhas Monitorias) → Nova
```

**A frase literal da Aline antes de cada monitoria**, sem interpretar:

- *"Vou monitorar a Susana"* → ela trabalha por **colaborador**
- *"Vou avaliar este atendimento"* → ela trabalha por **atendimento**

### Comparação com o CYF — ao fim de cada dia

| Caso | Colaborador | Nota CYF | Nota MonitorIA | Dif. | Trava |
|---|---|---|---|---|---|
| | | | | | |

Divergência de nota **não é falha do sistema**: conferir peso e nota mínima esperada em
Cadastros → Critérios de Avaliação, e resolver antes do dia seguinte.

### Depois dos pilotos

Operação assistida de **24 a 28/08**: volume normal no MonitorIA, CYF em paralelo, comparação
ao fim de cada dia, exportação diária. O corte — parar de registrar no CYF — só se discute
depois dessa semana fechar limpa.

---

## 7. Decisões de produto

### A Home atual é temporária

A Home simplificada publicada em `3756071` foi aprovada **para os pilotos**, não como desenho
final. Ela resolveu um problema de honestidade — a tela exibia seis blocos de dados
inventados — mas não resolveu o problema de propósito.

### Diagnóstico registrado

**A Home não tem trabalho próprio.** O menu já navega e o Dashboard Executivo já reporta;
sobrou uma tela de métricas de fechamento numa posição de abertura. Os indicadores que ela
mostra respondem perguntas feitas uma vez por mês, numa tela aberta todo dia.

### Hipótese em aberto — bancada de trabalho

A Home deveria ser a **fila da monitora**, não o painel dela: o que voltou para ajuste, o que
ficou pela metade, quem ainda não foi monitorado no mês, e a próxima ação a um clique. É o
padrão de Linear, Zendesk, Pipefy, Monday e ClickUp — em nenhum deles a tela de abertura do
operador é composta de indicadores.

**Nenhuma implementação dessa Home foi aprovada.** A decisão depende de uma pergunta que só o
uso real responde: **a Aline trabalha por colaborador ou por atendimento?** Se ela escolhe a
pessoa primeiro, o bloco central é a carteira. Se escolhe o atendimento, é outra coisa.

É barato responder depois dos pilotos e caro errar agora.

### Duas dependências da Home futura

- **Meta não é computável hoje** — metas são gravadas com ano e mês fixos em junho/2026, então
  não existe meta de agosto. Um bloco de ritmo mostraria contagem sem denominador.
- **"Devolvida" não se distingue de "rascunho" no dado** — uma devolução vira
  `status: 'Rascunho'` com `adjustmentReason` preenchido. Dá para separar pelo campo, mas é
  convenção frágil.

---

## 8. Histórico de publicações

| Data | Hash | O que foi |
|---|---|---|
| 19/08/2026 | `94386d9` | Sprint 0 — fundamentos, 15 histórias |
| 19/08/2026 | `7d389b1` | Identidade visual da tela de login |
| 20/08/2026 | `3756071` | Home simplificada, sem indicadores inventados |

Detalhe de cada uma em [`CHANGELOG.md`](../CHANGELOG.md) e
[`RELATORIO-SPRINT-0.md`](RELATORIO-SPRINT-0.md).

---

## 9. O que está fora de escopo agora

- Nova Sprint
- Nova funcionalidade
- Reformulação da Home
- Backend, banco de dados, autenticação real
- Fase 1 do produto (transcrição, diarização, avaliação assistida)

Os débitos técnicos remanescentes estão catalogados na seção 8 de
[`STATUS-SPRINT-0.md`](STATUS-SPRINT-0.md) e permanecem registrados como estão.
