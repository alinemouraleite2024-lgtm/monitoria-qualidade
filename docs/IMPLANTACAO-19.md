# Implantação do script 19: concluir e guardar; enviar para validação

Fase 2. **Script 19 aplicado na homologação em 10/11/2026, com autorização da Aline**, depois do backup
`monitoria-backup-2026-11-10-antes-19.csv` e do ensaio sobre ele (16 de 16). Conferência: mudaram só a versão e a
função de envio; auditoria em 1490, sem quebras e sem registro novo; nenhuma monitoria guardada. Portal publicado só
no Preview. O teste de envio real aguarda a escolha e a autorização da Aline.

## Regras aprovadas
- Guardada continua Rascunho no banco, com marca própria. Aparece como "Aguardando liberação" e fica privada pela regra do script 18.
- Concluir fixa nota e régua. Salvar uma alteração invalida a conclusão: volta a Rascunho, com todo o preenchimento, sem nota fixada.
- Competência futura só na área privada, até 12 meses à frente. Enviar, só a partir do primeiro dia da competência.
- Prazo: dia 15 do mês seguinte, em dias corridos. Só alerta.
- Lote de até 100, tudo ou nada. Só a monitora responsável envia. Repetir o envio não gera novo envio.

## O que muda
| Camada | Mudança |
|---|---|
| Banco | `aguardando_liberacao`, `concluida_em`, regra de coerência, gatilho, `api.salvar_monitoria`, `api.liberar_monitorias` |
| Conferências | `backup-completo.sql`, `backup/restauracao.mjs`, `conferencia-19.sql` desconsideram as colunas novas na impressão de monitorias |
| Portal | Etapa 5 com "Concluir e guardar"; rota `/privada`; rótulo, datas, nota e alertas; só no modo compartilhado |

A nota no intervalo: guardada mostra a nota fixada; depois de editada, a nota oficial deixa de existir e listas e detalhes mostram "—" ou "Nota ainda não fixada". O número do formulário é só prévia.

Correção incluída: abrir uma monitoria já gravada não reescreve mais a competência pelo mês do atendimento.

## Ordem de implantação (cada passo com autorização)
1. Intervalo da Aline, sem formulários abertos. Login no Supabase; confirmar `monitoria-homologacao`.
2. Backup conferido e guardado em Backups MonitorIA. Ensaio do 19 sobre esta cópia.
3. `conferencia-19.sql` antes.
4. Script 19, com o texto conferido pelo código de verificação. **Vem antes do portal.**
5. `conferencia-19.sql` depois: mudam só os itens 1 e 16.
6. Commit e publicação só no Preview de `feat/banco-e1` (leva junto o commit da Fase 1), sem merge em `main`.
7. Teste com uma monitoria verdadeira escolhida antes: concluir e guardar, conferir a invisibilidade no perfil de supervisor, enviar, conferir que apareceu. Conferência final.

## Reversão
- Portal: republicar o commit anterior; ele funciona com o banco novo.
- Banco: `19r`. Recusa se houver monitoria guardada ou com data de conclusão, porque apagaria essa informação. Nesse caso, decisão à parte, com backup.

## Testes
- `supabase/testes/testes-19-concluir-liberar.mjs`: instalação, guardar, edição, competência futura, envio individual e em lote, repetição, permissões, privacidade, régua e reversão.
- `supabase/testes/testes-19-dados-reais.mjs <projeto> <backup>`: ensaio sobre a cópia do backup, em memória, sem mostrar conteúdo.
- `tests/areaPrivada.test.ts`: prazo, competência, separação, conferência do lote e envio ao banco.
