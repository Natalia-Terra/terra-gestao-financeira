# Pendências — Terra Conttemporânea

**Atualizado:** 2026-05-13 (sessão M5 + M1)
## ✅ Concluído em 13/05

- **M5 — Backup automatizado** (commit `3207732`) — tela + RPC `fn_gerar_dump_json` + histórico
- **M1 — Refator app.js em 8 módulos** (commits `cbdb9c7` → revertido `c43f76b` → v2 `c4e11e8`) — `/js/01..08.js`, ordem fixa, IIFE removida. **Bug do boot na v1 corrigido na v2** (returns top-level → flag `_terraBootOK`).
- **M5 fase 2 — Backup automático diário** (migration `m5_fase2_pg_cron_backup_diario`) — pg_cron rodando às 03h Brasília via `fn_gerar_dump_automatico()`

## 🚨 BUGS CRÍTICOS

### ~~Bug #1 — Reset Completo travado~~ ✅ RESOLVIDO

Corrigido em 08/05 (commit `8084118`). Solução: função `limparOverlaysOrfaos()` chamada no boot + a cada `showPage()` + handler ESC global que remove `.modal-overlay:not([hidden])` sem `data-terra-vivo`. Também: delegate global pros botões "+ Novo" pra resistir a falha de listener.


### Bug #2 — Coluna "Email" da tela Usuários vazia

A tabela `auth.users` tem o email mas a Edge Function `gerenciar-usuarios` não retorna o mapeamento `id → email` quando lista. A variável `emailsByUserId` (em `js/03-imports-rh.js`) fica sempre vazia.

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
