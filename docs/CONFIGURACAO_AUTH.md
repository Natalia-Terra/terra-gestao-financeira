# Configuração de Autenticação — Sistema Terra Conttemporânea

**Atualizado em:** 2026-05-07

Este guia tem 3 partes:

1. [Configurar SMTP próprio (Resend)](#1-configurar-smtp-próprio-resend) — elimina o rate limit de 4 emails/hora
2. [Colar templates de email caprichados](#2-colar-templates-de-email) — substitui os defaults em inglês pelos da Terra
3. [Atualizar URLs de redirecionamento](#3-atualizar-urls-de-redirecionamento) — garante que os links dos emails apontem pra produção

---

## 1. Configurar SMTP próprio (Resend)

**Por que:** o Supabase free tem limite de **4 emails por hora** no servidor SMTP gratuito. Pra um sistema de produção, isso quebra rapidinho. O Resend dá **3.000 emails/mês grátis** e é o mais simples de configurar.

### 1.1 Criar conta no Resend

1. Acesse https://resend.com
2. **Sign up** com o email `juliana@polimatagrc.com.br` (ou outro de sua preferência)
3. Confirme o email recebido

### 1.2 Adicionar e verificar o domínio

> **Sugestão:** use o domínio `polimatagrc.com.br` (que você já tem) — assim os emails saem como `noreply@polimatagrc.com.br`. Alternativa: usar o domínio da Terra se ela tiver um.

1. No Resend, vai em **Domains** > **Add Domain**
2. Digita: `polimatagrc.com.br` (ou o domínio escolhido)
3. O Resend vai mostrar **3 registros DNS** pra adicionar (TXT, MX, DKIM):
   - 1 SPF (TXT)
   - 1 DKIM (TXT)
   - 1 DMARC (TXT, opcional mas recomendado)
4. Adiciona esses registros no painel do seu provedor de DNS (Registro.br, Cloudflare, GoDaddy, etc.)
5. Clica em **Verify DNS** no Resend — pode levar de 1 minuto a 1 hora pra propagar

### 1.3 Gerar API Key no Resend

1. No Resend, vai em **API Keys** > **Create API Key**
2. Nome: `Supabase Terra`
3. Permission: **Sending access** (suficiente)
4. Copia a chave (começa com `re_...`) — ela só aparece uma vez

### 1.4 Configurar SMTP no Supabase

1. https://supabase.com/dashboard > projeto **Terra-Gestão-Financeira**
2. **Project Settings** (engrenagem no menu lateral) > **Authentication** > aba **SMTP Settings**
3. Toggle **Enable Custom SMTP** (ON)
4. Preenche:

| Campo | Valor |
|---|---|
| **Sender email** | `noreply@polimatagrc.com.br` (ou o domínio que verificou) |
| **Sender name** | `Sistema Terra Conttemporânea` |
| **Host** | `smtp.resend.com` |
| **Port number** | `465` |
| **Username** | `resend` |
| **Password** | a API key copiada no passo 1.3 (começa com `re_`) |
| **Minimum interval** | `0` (sem rate limit) |

5. Clica em **Save**

Pronto — emails do Supabase passam a sair pelo Resend, sem rate limit.

---

## 2. Colar templates de email

Substituir os templates default (em inglês) pelos da Terra (português, identidade visual marrom/ouro).

### 2.1 Localizar a aba de templates

1. Supabase > projeto Terra-Gestão-Financeira
2. **Authentication** (menu lateral) > aba **Email Templates**
3. Vai aparecer uma lista com os tipos:
   - Confirm signup
   - Invite user
   - **Reset Password** ← obrigatório
   - **Magic Link**
   - Change Email Address
   - **Reauthentication**

### 2.2 Reset Password (link "Esqueci minha senha")

1. Clica em **Reset Password**
2. Em **Subject heading**, cola: `Terra Conttemporânea — Redefinir sua senha`
3. Em **Message body**, **apaga tudo** e cola o conteúdo do arquivo:
   ```
   docs/email_templates/email_01_reset_password.html
   ```
4. Clica em **Save changes**

### 2.3 Invite User (novo usuário)

1. Clica em **Invite user**
2. Em **Subject heading**, cola: `Bem-vindo(a) ao Sistema Terra Conttemporânea`
3. Em **Message body**, **apaga tudo** e cola o conteúdo do arquivo:
   ```
   docs/email_templates/email_02_invite_user.html
   ```
4. Clica em **Save changes**

### 2.4 (Opcional) Confirm Signup, Magic Link, etc.

Pros outros tipos de email, se quiser usar template caprichado também:
- **Confirm signup**: usa o mesmo do Invite User (adapta a saudação)
- **Magic Link**: usa um derivado do Reset Password ("Faça login com este link mágico")
- **Change Email**: deriva do Reset

> Por enquanto, esses 2 (Reset + Invite) cobrem 95% dos casos. Os outros podem ficar com o default em inglês até a gente ter caso de uso real.

---

## 3. Atualizar URLs de redirecionamento

Já feito em 07/05/2026, mas conferir:

1. Supabase > **Authentication** > **URL Configuration**
2. **Site URL**: `https://terra-gestao-financeira.vercel.app`
3. **Redirect URLs**: precisa ter
   - `https://terra-gestao-financeira.vercel.app`
   - `https://terra-gestao-financeira.vercel.app/**`
   - `https://terra-gestao-financeira.vercel.app/redefinir-senha.html`

---

## 4. Como testar

### Teste 1 — Reset de senha
1. Abre https://terra-gestao-financeira.vercel.app
2. Clica em **"Esqueci minha senha"** abaixo do botão Entrar
3. Digita um email cadastrado
4. Confere a caixa de entrada — o email deve chegar com identidade Terra
5. Clica no botão **Redefinir minha senha**
6. Cai na página `/redefinir-senha.html` com identidade Terra
7. Define nova senha → redireciona pro login

### Teste 2 — Convidar novo usuário
1. Loga como master no sistema
2. Vai em **Configuração > Usuários**
3. Clica em **+ Novo usuário**, preenche email e tipo de perfil
4. Salva — Supabase dispara email de convite com o template caprichado
5. O usuário recebe, clica no botão, define a senha
6. Loga normalmente

---

## 5. Troubleshooting

### Email não chega
1. Confere SPAM
2. Confere se o domínio do Resend está verificado (Domains > status "Verified")
3. Confere logs no Resend (Logs > vê se o email saiu)
4. Confere logs do Supabase (Authentication > Logs)

### Link no email aponta pra `localhost`
- Site URL não foi salva. Reabre **URL Configuration** e confere.

### "email rate limit exceeded"
- O SMTP do Resend não está configurado ou a API key tá errada. Volta na seção 1.4.

### Template não aplicou
- Confere se clicou em **Save changes** após colar
- Sai e volta na página pra confirmar que ficou salvo

---

**Polímata GRC para Terra Conttemporânea** · Sistema desenvolvido em parceria
