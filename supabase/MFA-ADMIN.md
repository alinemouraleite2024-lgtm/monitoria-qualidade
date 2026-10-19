# MFA da conta ADMIN (pendência P2)

Segundo fator **TOTP** (app autenticador: Microsoft Authenticator, Google Authenticator etc.),
do próprio Supabase Auth. Vale para o **ambiente compartilhado** do MonitorIA.

## Quem protege o quê

| Camada | O que faz | Pode ser contornada pela tela? |
|---|---|---|
| **Banco** (07) | `app.sou_admin()` e `app.usuario_liberado()` só liberam a conta ADMIN numa sessão **aal2**, lida do token **assinado pelo Supabase Auth** (`auth.jwt() ->> 'aal'`). Sem aal2: **zero linhas** em todas as tabelas e funções `api` recusadas. | **Não.** Provado por chamadas diretas (`supabase/testes/testes-12-mfa.mjs`, M.12–M.15). |
| **Banco** (12) | `api.estado_do_meu_acesso()` diz à tela a etapa da **própria** sessão: `liberado`, `cadastrar_mfa`, `verificar_mfa`, `sem_perfil`, `inativo`. Não libera dado nenhum. | Não importa: ela só orienta a tela. |
| **Portal** | Depois da senha, consulta a etapa e mostra a tela de cadastro ou de código; nada do portal aparece antes. Confere de novo a cada renovação do token. | É conveniência; a proteção é o banco. |

MONITOR e GESTOR **sem fator** (Aline e Erivan) recebem sempre `liberado`: o login não muda.

## Primeiro acesso do ADMIN

1. Entra com e-mail e senha → sessão **aal1** → o portal mostra **"Verificação em duas etapas"**.
2. **Gerar QR code** → lê no app autenticador (ou digita a chave mostrada).
3. Digita o código de 6 números → o fator fica **verificado** e a sessão passa a **aal2** → o portal abre.
4. **No mesmo dia:** *Meu Perfil › Segurança e Senha › Cadastrar outro autenticador* (segundo
   aparelho). O Supabase **não tem códigos de recuperação**; dois autenticadores são a reserva.

Nos acessos seguintes: senha → código do app → portal.

O QR code e a chave aparecem **uma vez**, só na memória da tela: não vão para o navegador
(localStorage), para o banco do MonitorIA nem para log.

## Recuperação de acesso

> A remoção de fator **não** existe no portal, de propósito: é um ato de recuperação, feito por
> quem administra o projeto Supabase, **com registro em ata**. A tabela `auth.mfa_factors` é do
> Supabase Auth e **não entra na auditoria do MonitorIA** — por isso a ata é obrigatória.

**Perdeu UM autenticador e ainda tem o outro**
1. Entra com o autenticador que sobrou.
2. *Meu Perfil* → cadastra um novo autenticador (volta a ter dois).
3. Quem administra o projeto Supabase remove o fator perdido (painel: *Authentication › Users ›*
   usuário › fatores de MFA; ou, no SQL Editor, `delete from auth.mfa_factors where id = '<id>'`),
   e registra em ata: data, fator removido, motivo, quem pediu, quem executou.

**Perdeu TODOS os autenticadores (conta trancada)**
1. **Duas pessoas**: a pessoa da conta ADMIN pede; a confirmação de identidade é feita por outra
   pessoa da gestão (presencial ou por canal já conhecido) — nunca só por e-mail ou mensagem.
2. Quem administra o projeto Supabase remove **todos** os fatores dessa conta e **encerra as
   sessões abertas** dela (painel, ou `delete from auth.sessions where user_id = '<uid>'`).
3. A pessoa entra com a senha → o portal pede **cadastrar_mfa** → cadastra **dois** autenticadores.
4. Ata com: data/hora, pedido, quem confirmou a identidade, quem executou, fatores removidos.
5. Conferência só leitura: o perfil ADMIN continua o mesmo, ativo, ligado ao mesmo login.

**Suspeita de roubo do aparelho ou da senha**: mesmos passos 2–4 e **troca da senha** antes de
cadastrar os novos fatores.

## Riscos

| Risco | Efeito | Mitigação |
|---|---|---|
| Perder todos os autenticadores | conta ADMIN trancada (nada de cancelar, publicar régua) | dois autenticadores desde o 1º dia; procedimento acima, ensaiado na homologação |
| Quem administra o **projeto Supabase** tem mais poder que o ADMIN do portal (SQL Editor) | a proteção do MonitorIA pressupõe que essa conta é segura | **MFA também nas contas do Supabase, da Vercel e do GitHub**, com os códigos de recuperação delas guardados offline |
| Mesma pessoa = ADMIN do portal + dona do projeto Supabase | perder os dois acessos ao mesmo tempo | códigos de recuperação do Supabase guardados fora do celular; segunda pessoa com acesso ao projeto (a decidir) |
| Sessão roubada (token no navegador) | quem tem o token age como a pessoa até ele expirar | sem código de terceiros no portal; sair ao terminar; avaliar política de segurança de conteúdo (CSP) |
| Código TOTP repassado em tempo real (golpe de *phishing*) | risco residual de todo TOTP | só digitar o código no endereço conhecido do portal |

## Validade do token: reduzir é necessário?

**Não, por enquanto.** Manter o padrão do Supabase (1 hora).

- **O que reduzir resolveria:** depois de **remover** um fator, um token aal2 que já existia
  continua valendo até expirar. Com 1 h, a janela é de até 1 h.
- **Por que não vale a pena agora:**
  - perder o perfil ADMIN ou ficar inativo é **imediato** (o banco relê o perfil a cada chamada);
    só o *nível aal2* fica no token;
  - quem rouba a sessão leva também o *refresh token* — encurtar o token de acesso não impede o
    roubo; o que impede é **encerrar as sessões** (passo 2 da recuperação), que já faz parte do
    procedimento;
  - a configuração vale para **todos** os usuários do projeto: mais renovações automáticas, mais
    chamadas ao Supabase Auth, e mais chance de falha de renovação em rede instável — para a Aline e
    o Erivan, sem ganho de segurança para eles.
- **Quando rever:** se houver mais de um ADMIN, se o portal passar a ter dados mais sensíveis, ou
  se o encerramento de sessões no procedimento de recuperação não puder ser feito na hora.

## Antes de criar a conta ADMIN real

1. **E-mail da conta ADMIN** decidido (conta individual, separada do `usr-1`; sem endereço fictício).
2. **Script 12 aplicado** na homologação e **Preview publicado com o portal novo** (senão o ADMIN
   entra e vê só "login não liberado", porque o portal antigo não tem a tela de MFA).
3. **Exceção de implantação (R5) fecha** no instante em que o primeiro ADMIN existe:
   - toda gravação direta por SQL passa a exigir `set local app.responsavel = '<id do ADMIN ativo>'`;
   - o **11a**, como está, passa a ser **recusado** (declara "Nome <e-mail>"). Opções: aplicá-lo
     **antes** de criar o ADMIN, ou ajustá-lo para declarar o id do ADMIN (e testar de novo);
   - qualquer correção por SQL depois disso depende de o ADMIN existir e estar **ativo**.
4. MFA ativado nas contas do Supabase, da Vercel e do GitHub de quem administra o projeto.
5. Roteiro de testes manuais na homologação (abaixo) combinado.

## Testes manuais na homologação (depois da autorização)

- Cadastro do 1º fator; código errado recusado; código de 30 s antes recusado.
- Cadastro do 2º fator em *Meu Perfil*.
- Sair e entrar: senha → código → portal. Fechar o navegador e voltar: pede o código de novo se a
  sessão for aal1.
- Sessão aberta por mais de 1 h: renovação automática mantém o acesso (aal2).
- Chamada direta à API com o token **aal1** do ADMIN: zero linhas / recusada.
- Aline e Erivan: entram como hoje, sem tela nova.
- Ensaio do procedimento de **aparelho perdido** com um fator de teste (com ata).
