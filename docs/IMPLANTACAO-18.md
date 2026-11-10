# Implantação do script 18: privacidade das monitorias nunca enviadas

Fase 1, 10/11/2026. **Script 18 aplicado na homologação com autorização da Aline**, depois do backup
`monitoria-backup-2026-11-10-antes-18.csv`. Conferência: mudaram só a versão e a regra de leitura; auditoria
em 1483, sem quebras. Privadas na aplicação: MON-10002, MON-10020 a 10023 e MON-10026. Teste com o perfil
real concluído e fase encerrada (ver "Encerramento"). Nada foi publicado no portal.

## A regra
É privada a monitoria que nunca foi disponibilizada para validação: em Rascunho ou Cancelada, sem data de
envio e sem envio registrado no portal antigo. O perfil de supervisor não a alcança por tabela, função ou
mensagem de erro. O que já foi enviado alguma vez continua visível, inclusive se devolvido.

## O que muda
| Peça | Mudança |
|---|---|
| `app.monitoria_privada` | A regra, num lugar só |
| Regra de leitura `monitorias_ler` | O ramo do supervisor exclui as privadas; respostas, evidências e histórico seguem sozinhos |
| `app.monitoria_para_gestor`, `api.registrar_observacao` | Privada responde igual a código inexistente |

O portal não muda. Nenhuma linha é gravada: sem versão nova e sem registro na auditoria.

## Ordem de implantação (cada passo com autorização)
1. Login da Aline no Supabase; confirmar o projeto `monitoria-homologacao`.
2. Backup com `backup-completo.sql`, conferido e guardado em Backups MonitorIA.
3. `conferencia-18.sql` antes. Conferir a lista do item 3 e o item 14 igual a 0. Conferir os itens 16 e 17 iguais a 0.
4. Script 18, com o texto conferido pelo código de verificação.
5. `conferencia-18.sql` depois: mudam só os itens 1 e 15; a auditoria só cresce por registros de acesso.
6. Teste com a conta do próprio Erivan, no computador dele: MON-10026 ausente na fila, no histórico, nos relatórios de outubro, nos painéis, no CSV, no PDF e pelo link direto; MON-10024 e MON-10025 presentes.
7. Commit dos scripts e testes só com autorização. Não há publicação de portal nesta fase.

## Encerramento da Fase 1 (10/11/2026)
Encerramento aprovado pela Aline na homologação. O commit `60fae9b` não foi enviado ao GitHub.

**Testes e resultados**
| Teste | Resultado |
|---|---|
| Testes automáticos por perfil (monitora, outra monitora, supervisor, supervisor de fora da equipe, Administrador com e sem MFA, sem login) | 69 de 69 |
| Ensaio sobre cópia do backup de 09/11 (27 monitorias) | 18 de 18 |
| Ensaio sobre cópia do backup de 10/11, antes de aplicar (36 monitorias) | 18 de 18 |
| Bateria completa do banco, com relógio de hoje e +80 dias | 22 suítes, sem falhas |
| Testes do portal | 124 de 124 |
| Conferência antes e depois da aplicação | Mudaram só a versão e a regra de leitura |
| Teste com a conta real do Erivan, autenticada pela Aline com a autorização dele | Aprovado |

**Monitorias na aplicação (36):** 30 visíveis ao supervisor (20 em agosto, 10 em outubro) e 6 privadas: MON-10002, MON-10020, MON-10021, MON-10022, MON-10023 e MON-10026.

**Teste com o perfil real:** identidade "Erivan Sousa · Gestor". Fila com 12 pendentes, igual ao banco. Relatórios, CSV, PDF, Painel da Equipe, Metas e Equipe e Carteiras sem nenhuma privada. MON-10024 (90,48%) e MON-10025 (67,02%) visíveis, com histórico, evidências e relatório. Os 5 rascunhos que ele vê são monitorias já enviadas e devolvidas. Link direto: "Acesso Negado", igual para privada, código inexistente e monitoria visível.

**Preservação:** monitorias, relatórios, respostas, evidências, histórico, notas e fila idênticos antes e depois da aplicação e do teste. A aplicação não gerou registro na auditoria. Durante o teste a auditoria passou de 1483 para 1490 registros, nenhum em tabelas de monitoria e todos compatíveis com logins e saídas. Sem quebras na cadeia. Backup: `monitoria-backup-2026-11-10-antes-18.csv` (SHA-256 `e973b5ab…`).

**Limitações**
- As recusas de validar, devolver, reprovar e observar sobre uma privada foram comprovadas só nos testes locais, para não arriscar ação real com a conta do supervisor.
- A busca não trouxe resultado para as privadas, mas não houve controle que provasse que ela localiza monitorias.
- O link direto de edição é negado ao supervisor para qualquer código, então não distingue monitorias.
- CSV e PDF foram capturados na própria página, sem gerar arquivo.
- Os itens 14 a 17 da conferência não foram relidos após o teste; estavam corretos na leitura feita antes dele.
- A proteção vale para o Portal e o banco, não para pastas do OneDrive compartilhadas com o supervisor. Saltos na numeração continuam perceptíveis. A leitura pelo Administrador não é registrada.

**Erro 400:** apareceu uma vez no console durante o teste com a conta do supervisor. A causa não foi identificada. Todas as telas carregaram normalmente.

**Produção:** inalterada, no pacote `index-B38yRO1l.js`, e a `main` no GitHub sem mudança. Nenhuma versão do portal foi publicada nesta fase.

**Pendência:** os acessos à conta do Erivan em 03/11 e 05/11 aguardam a confirmação da Aline sobre a autorização usada naquelas datas.

## Reversão
`18r_reverter_privacidade.sql`. Sem condição de recusa por dados: não há conteúdo a perder. Efeito: o supervisor volta a enxergar os rascunhos da equipe.

## Testes
- `supabase/testes/testes-18-privacidade.mjs`: monitora, outra monitora, supervisor, supervisor de fora da equipe, Administrador com e sem MFA e sem login, em tabelas, funções e mensagens; transições; guarda; reversão.
- `supabase/testes/testes-18-dados-reais.mjs <projeto> <backup>`: ensaio sobre a cópia do backup, em memória, sem mostrar conteúdo.
