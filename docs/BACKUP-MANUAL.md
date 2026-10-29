# Backup manual do banco compartilhado — passo a passo

> Para quem administra o portal, sem precisar de conhecimento técnico. Leva cerca de 5 minutos.
> O plano gratuito do Supabase **não faz backup**: esta cópia é a única fora do Supabase.

## Quando fazer

- **Toda sexta-feira**, no fim do dia.
- **Antes** de qualquer script, correção no banco ou publicação no portal.

## Passo a passo

1. Entre no Supabase e abra o projeto **monitoria-homologacao** → **SQL Editor** → **+** (nova consulta).
2. Abra o arquivo `supabase/sql/backup-completo.sql` (no Bloco de Notas), copie **tudo** e cole no editor.
   A consulta **só lê**: não altera nada no banco.
3. Clique em **Run**. Aparece **uma linha** com duas colunas: `resumo` e `backup`.
   - Confira que o resultado é **novo**: o `resumo` começa com "MonitorIA backup" e a **data e hora de agora**.
4. **Anote o `resumo`** na planilha de controle (data, monitorias, eventos, auditoria). Confira:
   - `quebras 0` e `tabelas fora: nenhuma`. **Se aparecer outra coisa, pare e avise.**
5. Clique em **Export → Download CSV** (é o único download que o SQL Editor oferece; o "Copy as
   JSON" só copia, e copiar 2 MB de dados pessoais para a área de transferência não é recomendado).
   O navegador salva em **Downloads** com o nome `Supabase Snippet ….csv`.
   (No navegador do app Claude, o arquivo pode ficar alguns segundos com nome temporário `<código>.tmp`: o conteúdo
   é o mesmo; basta renomear. Depois de copiado e conferido, a cópia em Downloads vai para a Lixeira.)
6. Renomeie para `monitoria-backup-AAAA-MM-DD.csv` (ex.: `monitoria-backup-2026-10-31.csv`) e mova
   para a pasta restrita do OneDrive (abaixo). **Não abra no Excel** — ele pode alterar o arquivo ao salvar.
7. **Conferência do arquivo:** peça ao Claude para rodar, no seu computador,
   `node supabase/backup/restauracao.mjs conferir <arquivo>`. A resposta deve ser **COMPLETO**. Isso
   prova que o arquivo baixado não foi cortado. Nada é enviado para fora do computador.

## Onde guardar (acesso restrito)

- Pasta `Backups MonitorIA`, na raiz do **OneDrive corporativo** (OneDrive - MOURA LEITE…) — **não**
  dentro de uma pasta compartilhada com a equipe, nem dentro da pasta do projeto (que vai para o GitHub).
- No OneDrive, clique com o botão direito na pasta → **Gerenciar acesso**: deve aparecer **só você**.
  **Nunca** gere link de compartilhamento para essa pasta nem para os arquivos.
- Guarde as **8 últimas** cópias semanais e **uma por mês**. Apague as demais (o OneDrive mantém
  versões anteriores por um tempo, o que dá uma segunda proteção).
- O arquivo contém **dados pessoais** (nomes, e-mails, monitorias e a auditoria). Trate-o como
  documento confidencial: não envie por e-mail nem por aplicativo de mensagens.

## Registro de backups

| Data | Arquivo | Monitorias | Eventos | Auditoria | Conferência |
|---|---|---|---|---|---|
| 28/10/2026 | `monitoria-backup-2026-10-28.csv` (SHA-256 `d15a2557…`) | 19 | 22 | 904, 0 quebras | COMPLETO; impressões iguais ao banco |
| 29/10/2026 17:08 UTC | `monitoria-backup-2026-10-29.csv` (SHA-256 `5e07de4b…`) | 19 | 22 | 907, 0 quebras | COMPLETO; impressões iguais ao banco e à Etapa A; idêntico ao de 28/10 exceto +3 acessos. Antes do script 15 |
| 29/10/2026 17:47 UTC | `monitoria-backup-2026-10-29-antes-15b.csv` (SHA-256 `7fd69485…`) | 23 (19 reais + 4 fictícias TESTE15) | 22 | 1028, 0 quebras | COMPLETO; reais, respostas, evidências, histórico, colaboradoras reais, documentos e auditoria 1–907 idênticos ao de 29/10 14h08. Antes do 15b |
| 29/10/2026 18:20 UTC | `monitoria-backup-2026-10-29-antes-16.csv` (SHA-256 `90aed43f…`) | 23 (19 reais: 8 Pendentes, 5 Canceladas por duplicidade, 3 Validadas, 2 Rascunhos, 1 Reprovada; 4 fictícias Canceladas) · 644 respostas · 36 evidências · 6 colaboradoras (fictícia inativa) | 31 | 1050, 0 quebras | COMPLETO; em relação ao antes-15b só mudaram as 9 canceladas (15b e 15c) e a fictícia (11b); respostas, evidências, documentos, colaboradoras reais e auditoria 1–1028 idênticos. Antes do 16 |

## Se precisar restaurar

Não tente sozinha. A restauração é feita pelo Claude, com sua autorização, a partir do arquivo:
ele gera o SQL (`restauracao.mjs gerar`), que confere tudo e **desfaz a operação inteira** se algo
não bater. Antes de restaurar no mesmo projeto, faz-se um backup do estado atual.

## O que o backup NÃO recupera

| Item | Por quê | Como se recupera |
|---|---|---|
| **Senhas** | Ficam no sistema de login do Supabase, fora das tabelas | Cada pessoa redefine a senha; o perfil se religa sozinho pelo e-mail |
| **Autenticadores (MFA) do ADMIN** | Idem | O ADMIN cadastra de novo (`supabase/MFA-ADMIN.md`) |
| **Áudios e documentos das monitorias** | O portal guarda só nome, tipo e tamanho do arquivo | Continuam onde estão hoje (SharePoint/OneDrive das monitoras) — o link fica no backup |
| **Configurações do Supabase e da Vercel** | Ficam nos painéis, não no banco | Refeitas à mão (chaves, variáveis do Preview, link de compartilhamento) |
| **O que foi feito depois do último backup** | O backup é uma fotografia | Por isso a rotina semanal e o backup antes de cada mudança |
