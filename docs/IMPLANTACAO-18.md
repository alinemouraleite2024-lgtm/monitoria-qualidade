# Implantação do script 18: privacidade das monitorias nunca enviadas

Fase 1, 10/11/2026. **Script 18 aplicado na homologação com autorização da Aline**, depois do backup
`monitoria-backup-2026-11-10-antes-18.csv`. Conferência: mudaram só a versão e a regra de leitura; auditoria
em 1483, sem quebras. Privadas na aplicação: MON-10002, MON-10020 a 10023 e MON-10026. Falta o teste com a
conta do próprio Erivan (passo 6). Nada foi publicado no portal.

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

## Reversão
`18r_reverter_privacidade.sql`. Sem condição de recusa por dados: não há conteúdo a perder. Efeito: o supervisor volta a enxergar os rascunhos da equipe.

## Testes
- `supabase/testes/testes-18-privacidade.mjs`: monitora, outra monitora, supervisor, supervisor de fora da equipe, Administrador com e sem MFA e sem login, em tabelas, funções e mensagens; transições; guarda; reversão.
- `supabase/testes/testes-18-dados-reais.mjs <projeto> <backup>`: ensaio sobre a cópia do backup, em memória, sem mostrar conteúdo.
