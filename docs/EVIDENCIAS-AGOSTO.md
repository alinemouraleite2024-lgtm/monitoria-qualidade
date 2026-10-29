# Evidências das monitorias de agosto (AGO-004, 005, 007, 008) — proposta

29/10/2026. **Proposta: nada foi copiado, compartilhado ou importado.**

## Situação
- O portal **não guarda arquivos**. Cada monitoria tem:
  - **um** campo "Link do Atendimento";
  - a lista de anexos, só com nome, tipo e tamanho.
- O importador não traz link: ele é preenchido na tela de Evidências antes de salvar.
- MON-10007 a 10009 já têm link para o OneDrive corporativo da Aline
  (`mouraleite1-my.sharepoint.com`). O Erivan só abre o que for compartilhado com ele.

| Avaliação | Canal | Atendimento | Arquivos de evidência já existentes (OneDrive corporativo) |
|---|---|---|---|
| AGO-004 | WhatsApp | 21/08 09:31 | `MONITORIAS AGOSTO/ALLANIS/Nova pasta/AGO-004_Monitoria_Qualidade_Allanis_Maquea_Silva.docx` (sem áudio: atendimento por WhatsApp) |
| AGO-005 | WhatsApp | 21/08 16:50 | `…/Nova pasta/AGO-005_Monitoria_Qualidade_Allanis_Maquea_Silva.docx` (sem áudio) |
| AGO-007 | Telefone | 20/08 10:41 | `…/Nova pasta/AGO-007_…docx` e `AGO-007_…wav` (3 min 34 s, compatível com o CONECTA) |
| AGO-008 | Telefone | 21/08 08:47 | `…/Nova pasta/AGO-008_…docx` e `AGO-008_…wav` (8 min 58 s, compatível com o CONECTA) |

Os arquivos já estão no **OneDrive corporativo** (pasta `ARQUIVO/Área de Trabalho/MONITORIAS AGOSTO`),
mas misturados com material de trabalho e não compartilhados.

**WhatsApp (004 e 005):** se o Blip permitir exportar a conversa ou tirar um print, esse arquivo é
a evidência mais fiel. Sem ele, a evidência é o Word da avaliação.

## Alternativa proposta (só recursos que já existem: OneDrive corporativo, Microsoft 365)
1. **Criar a pasta** `Evidências MonitorIA` no OneDrive corporativo. Ela fica separada da pasta de
   backups e da pasta do projeto, que vai para o GitHub. Subpastas por competência e avaliação:
   `2026-08/AGO-004 … AGO-008`.
2. **Copiar** os arquivos da tabela para as subpastas. Copiar, **nunca mover**: os originais em
   `MONITORIAS AGOSTO` ficam intactos.
3. **Compartilhar a pasta `Evidências MonitorIA` uma vez só, com o Erivan:**
   - opção "Pessoas específicas", **só visualização**;
   - **nunca** "Qualquer pessoa com o link".
   - As subpastas e os arquivos herdam o acesso.
4. **Copiar o link de cada subpasta** (`AGO-004` …) e colar no campo "Link do Atendimento" na
   importação. São quatro links, um por monitoria, e a subpasta reúne áudio e Word.
5. **Conferir** que o Erivan abre o link. Um teste com ele basta.

Quem faz o quê:
- **Itens 1 e 2:** posso fazer no computador, com autorização, conferindo pelo código de
  verificação que cada cópia é idêntica ao original.
- **Itens 3 e 4:** compartilhamento é decisão sua. Você faz pelo OneDrive (botão direito →
  Compartilhar / Copiar link), ou eu faço no navegador do app com a sua sessão e autorização
  específica.

**Cuidados:**
- Os áudios e as conversas têm dados de clientes. A pasta fica restrita a você e ao Erivan.
- Os links não vão para documentos públicos.
- O portal guarda só o endereço do link, nunca o arquivo.

## O que mais falta para importar AGO-004, 005, 007 e 008
- Decidir as evidências (acima) e, se quiser, exportar as conversas do Blip.
- Script 16 instalado e portal publicado, ou ao menos conferir em cada importação que a
  colaboradora é a Allanis.
- Backup novo antes da importação.
- Uma por vez:
  1. ler o arquivo do lote (0 erros);
  2. colar no importador e conferir o código de verificação;
  3. preencher o link;
  4. concluir, com a sua autorização.
- Conferir depois de cada uma: fila e metas de agosto da Allanis (Telefone 5 → 7 com 007 e 008;
  WhatsApp 3 → 5 com 004 e 005), médias e auditoria.
- **AGO-009 fica fora:** é o mesmo atendimento da MON-10007, e o banco recusaria (MI410).

## Verificação de 29/10/2026 (só leitura; nada movido, copiado ou compartilhado)

### Biblioteca corporativa (SharePoint/Teams)
- O OneDrive deste computador está ligado ao Microsoft 365 da empresa (`mouraleite1-my.sharepoint.com`).
- **Nenhuma biblioteca de equipe do SharePoint está sincronizada.** As únicas pastas da empresa
  sincronizadas são do OneDrive da Raquel, compartilhadas com a Aline, e não servem de biblioteca
  de equipe.
- O **Microsoft Teams está instalado**. Toda equipe do Teams tem uma biblioteca do SharePoint
  (aba "Arquivos"). Saber se já existe uma equipe de Qualidade ou Relacionamento exige ver o Teams
  (Equipes) ou `https://mouraleite1.sharepoint.com` com o login da Aline: não é visível daqui.
- Preferência:
  1. **Biblioteca de uma equipe existente** (Qualidade/Relacionamento), pasta `Evidências MonitorIA`
     com acesso restrito. É da empresa e não depende de uma pessoa.
  2. Se não houver equipe adequada: o OneDrive corporativo da Aline, como proposto acima.
  3. Criar equipe nova no Teams costuma depender da TI: verificar antes de usar.

### Arquivos confirmados (pasta `MONITORIAS AGOSTO/ALLANIS/Nova pasta`)

| Avaliação | Arquivo | SHA-256 (início) | Conferência com o lote |
|---|---|---|---|
| AGO-004 (WhatsApp, 21/08 09:31) | `AGO-004_Monitoria_Qualidade_Allanis_Maquea_Silva.docx` (39 KB) | `8a788e2b24a3` | Word com 09h31–10h19, WhatsApp. **Sem conversa exportada** |
| AGO-005 (WhatsApp, 21/08 16:50) | `AGO-005_Monitoria_Qualidade_Allanis_Maquea_Silva.docx` (40 KB) | `f5ff998b5de9` | Word com 16h50–17h03, WhatsApp. **Sem conversa exportada** |
| AGO-007 (Telefone, 20/08 10:41) | `AGO-007_…docx` (40 KB) e `AGO-007_…wav` (3 346 KB, ~3 min 34 s) | `be3183ec0506` · `555cdf80e925` | Word 3 min 33 s, WAV 3 min 34 s, CONECTA 3 min 35 s |
| AGO-008 (Telefone, 21/08 08:47) | `AGO-008_…docx` (42 KB) e `AGO-008_…wav` (8 403 KB, ~8 min 58 s) | `fe3a319b6bf7` · `bd91492d0228` | Word 8 min 55 s, WAV 8 min 58 s, CONECTA 9 min 10 s |

**Não usar** os arquivos com numeração antiga na pasta `ALLANIS` (AGO-04, 05, 06 e 07, de 25/10).
São de outras avaliações já registradas:
- AGO-04 = ligação 11h57, 4 min 26 s → MON-10009;
- AGO-05 = WhatsApp 17h00 → MON-10010;
- AGO-06 = 13h09 → MON-10011/12;
- AGO-07 = 15h42 → MON-10013/14.

Os "Atendimento" desses dias são conversas de WhatsApp exportadas. Para AGO-004 e AGO-005 não há
equivalente: vale exportar do Blip, se possível.

### Estrutura sugerida (a criar só com autorização)
```
Evidências MonitorIA/                 ← biblioteca da equipe (preferência) ou OneDrive corporativo
  2026-08/
    AGO-004/  AGO-004_Monitoria_…docx  [+ conversa do Blip, se exportada]
    AGO-005/  AGO-005_Monitoria_…docx  [+ conversa do Blip, se exportada]
    AGO-007/  AGO-007_Monitoria_…docx  AGO-007_Monitoria_…wav
    AGO-008/  AGO-008_Monitoria_…docx  AGO-008_Monitoria_…wav
```
Uma subpasta por avaliação, um link por monitoria. Arquivos copiados e conferidos pelo SHA-256; os
originais ficam onde estão.
