# Implantação do script 17: Relatório Completo da Monitoria

Etapa 2, implementação local, 06/11/2026. **Nada foi executado no Supabase nem publicado.** Cada passo
abaixo depende de autorização específica da Aline.

## O que muda
| Camada | Mudança | Arquivos |
|---|---|---|
| Etapa 4 | Seção "Relatório Completo da Monitoria", acima dos seis campos, opcional | `RelatorioCompletoEtapa.tsx`, `EditorRelatorioCompleto.tsx` (sob demanda), `MonitoringForm.tsx` |
| Detalhes | Relatório formatado, Copiar relatório, seis campos recolhidos | `RelatorioCompletoVisualizacao.tsx` (sob demanda), `MonitoringHistory.tsx` |
| Regras | Limite de 200 KB, aviso de CPF, telefone e e-mail, limpeza do HTML | `domain/relatorioCompleto.ts`, `relatorioHtml.ts` |
| Banco | Coluna opcional, conferência na gravação, `api.salvar_monitoria` | `17_relatorio_completo.sql`, reversão `17r_reverter_relatorio_completo.sql`, `conferencia-17.sql` |
| Conferências | Impressão de monitorias desconsidera o campo; relatório tem impressão própria | `backup-completo.sql`, `backup/restauracao.mjs` |

O relatório não entra em `app.calcular_nota` nem em `app.conferir_respostas`. O JSON `monitoria-chatgpt/1` não muda.

## Ordem de implantação (cada passo com autorização)
1. Conferir o estado atual por leitura e o código da monitoria citada como AGO-021.
2. Backup com o `backup-completo.sql` atual, conferido; guardar em Backups MonitorIA.
3. `conferencia-17.sql` antes.
4. Script 17, com o texto conferido pelo código de verificação. Ele **vem antes do portal**: o portal novo com o banco antigo perderia o relatório em silêncio; o portal atual com o banco novo continua funcionando.
5. `conferencia-17.sql` depois: mesmas impressões e notas, fila e agosto iguais, auditoria sem registro novo, 0 quebras.
6. Commit e publicação só no Preview de `feat/banco-e1`, sem merge em `main`.
7. Teste no Preview com relatório fictício: Ctrl+V real do Word, rascunho, envio, detalhes, cópia, conta do gestor. A monitoria de teste fica para sempre no banco; combinar antes como encerrá-la.

## Reversão
- Portal: republicar o commit anterior **antes** de reverter o banco.
- Banco: `17r`. Ele recusa se houver relatório gravado, porque retirar a coluna apagaria o conteúdo. Nesse caso, decisão à parte, com backup.

## Testes
- `supabase/testes/testes-17-relatorio-completo.mjs`: instalação, monitorias históricas, salvar e recuperar, nota, travamento, permissões, 21 conteúdos maliciosos, limite, backup, reversão.
- `supabase/testes/testes-17-dados-reais.mjs <projeto> <backup>`: ensaio sobre a cópia do backup, em memória, sem mostrar conteúdo.
- `tests/relatorioCompleto.test.ts`: limite, aviso de dados pessoais, caminho até o banco.
- Na tela, no modo local sem banco: colagem com HTML capturado do Word real, edição, desfazer, alerta, limite, JSON depois da colagem, rascunho, envio, detalhes, cópia, largura de celular.
