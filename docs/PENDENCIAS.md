# Pendências — Terra Conttemporânea

**Atualizado:** 2026-05-07 (noite, fim de sessão pós-pacote de auth)

## 🚨 BUGS CRÍTICOS

### Bug #1 — Reset Completo travado (CRÍTICO)

**Sintoma:** input "Digite RESET" e botão "Executar Reset Completo" não aceitam interação. Reproduzido em **Chrome+Edge** e em **2 usuários** (Juliana + Natália). NÃO é cache local.

**Hipótese de causa:** elemento `.modal-overlay` órfão no DOM sem o atributo `hidden`, criado por `mostrarMensagem()` (app.js linha ~822) ou `abrirModalDetalhe()` (linha 7805) e não removido por algum erro JS. Como `[hidden] !important` só se aplica quando o atributo existe, esse overlay invisível com `z-index: 50` cobre a app inteira e bloqueia cliques.

**Solução defensiva proposta:** self-healing no boot — `querySelectorAll('.modal-overlay:not([hidden])')` e remover órfãos sem flag `data-terra-vivo`. Ou, melhor: trocar a abordagem dos modais dinâmicos para SEMPRE incluir `hidden` como atributo padrão e SEMPRE remover ao fechar.

**Workaround atual:** base zerada via SQL pela Juliana. Não bloqueia testes do dia.

**Detalhamento completo:** ver `HANDOFF_2026-05-07.md` Seção 4.

### Bug #2 — Coluna "Email" da tela Usuários vazia

A tabela `auth.users` tem o email mas a Edge Function `gerenciar-usuarios` não retorna o mapeamento `id → email` quando lista. A variável `emailsByUserId` no `app.js` fica sempre vazia.

**Fix:** ajustar a Edge Function pra incluir o email no payload. Cosmético — não bloqueia operação.

## 📋 Pendências de configuração no Supabase (responsabilidade da Juliana)

### A) Configurar SMTP do Resend
**Por quê:** Supabase free está limitado a 4 emails/hora. Juliana já bateu nisso ao testar com a Natália. Resend (3.000 emails/mês grátis) elimina o limite. Passo a passo em `docs/CONFIGURACAO_AUTH.md`. Status: aguardando Juliana indicar em qual etapa parou.

### B) Colar templates Terra no Supabase
- Reset Password: `docs/email_templates/email_01_reset_password.html`
- Invite User: `docs/email_templates/email_02_invite_user.html`

Ambos prontos com identidade Terra (marrom/ouro, sem menção a Polímata, sem bloco "O que você vai encontrar").

## 📋 Pendências de DEV abertas

### M19 Fase 3 — Parser PDF Folha de Ponto (PRIORIDADE)

**Status:** input recebido. A Juliana enviou em 07/05 o arquivo `Fechamentos Ponto 04.2026.pdf` (formato Jasper/iText, 1 página por funcionário, com cabeçalho Terra + dados do colaborador + tabela diária + totalizadores).

**Decisões já registradas:**
- Periodicidade: livre, sob demanda
- Match por CPF (default sugerido)
- Funcionários sem ponto: importa o resto + LISTA DE EXCEÇÃO obrigatória
- Política de histórico: SEMPRE append + competência (sem sobrescrever)

**Falta:**
1. Confirmar com Juliana: cruzar por CPF ou nome?
2. Implementar parser (Node + `pdftotext -layout` + regex por seção)
3. Cruzar com `funcionarios`, gravar em `frequencia_mensal` com `vigente=true` + `import_id`
4. Adicionar template "Folha de Ponto PDF" no dropdown de Importar
5. Tela de revisão pós-import com lista de exceção

### M26 — Política de Histórico nas 8 tabelas restantes

10 tabelas já têm `vigente`/`import_id` (M24). Faltam 8 tabelas (mapeadas mas não aplicadas). Não é bloqueador.

### Refacs incrementais (baixa urgência)

- Substituir tela "Gestão de Faturamento" antiga pelo novo "Dashboard de Faturamento (rico)" — depende de validação visual
- Logo Terra no topo dos emails caprichados (hoje só tem texto)
- Botão "Resetar senha" direto na tela Usuários

### Qualidade restante

- `auth_leaked_password_protection` desabilitado (config Auth dashboard, requer plano Pro do Supabase) — Juliana já decidiu deixar desligado
- 5 warnings `0029 authenticated_security_definer` em auth_pode_*/fn_reset — INTRÍNSECOS da arquitetura M17/M19. Tradeoff aceito.

## 📋 Pendências de DADOS

A base está zerada — tudo é "carga inicial" agora:

- Importar Bíblia (`30032026_Gestão Faturamento e Receita.xlsx`) — 2 abas (Mov Financeiro + Saldo a Reconhecer)
- Importar Dashboard de Orçamentos (`Dashboard de Orçamentos.xlsx`)
- Importar Aerolito (`Relatório orçamento aprovado por parceiro no mês.xls`)
- Importar Saída de Estoque (`Saída de Estoque Por Período.xlsx`)
- Importar A Pagar x A Receber (`Relatório A Pagar x A Receber - Dt. Baixa.xlsx`)
- Importar Notas Fiscais (do sistema fiscal — Juliana ainda não tem amostra)
- Cadastrar Períodos do Bônus em `bonif_periodos` (ex: "2026-1")
- Cadastrar metas iniciais em `bonif_metas_empresa`, `bonif_metas_area`, `bonif_metas_profissional`
- Cadastrar contas bancárias em `contas_bancarias`
- Importar saldos mensais por conta
