# Próxima Sessão

**Atualizado em:** 2026-05-25 (após pacote de Correções 25/05 — Cargos+Organograma+Funcionários+Alerta ASO)
**Source-of-truth principal:** `docs/HANDOFF_2026-05-25.md`

## ⚡ Primeira coisa a fazer: testar o pacote 25/05

Seguir `docs/CHECKLIST_TESTE_25-05.md` na URL https://terra-gestao-financeira.vercel.app (commit `dd9f7f8`). Cobre 5 tópicos + regressões.

**Setup prévio:**
1. Editar um funcionário e setar **Cargo = "Analista de RH Generalista"** (id=2) — libera o botão Oficializar do organograma.
2. Ctrl+F5 pra garantir JS/CSS novos.

## Pendências em aberto após a sessão 25/05

### Curto prazo (próxima sessão)

1. **Tópicos 4+ do documento de correções** — a Juliana enviou só os 3 primeiros (Organograma, Cargos, Funcionários). Quando vier o restante (`Correções Sistema_Terra.docx` parte 2), continuar daqui.

2. **Envio real do email do Alerta ASO** — o cron está gerando os alertas todos os dias às 8h, mas o envio em si depende de provedor (Resend / SendGrid / SMTP customizado). Decidir provedor com a Juliana, configurar a API key, criar edge function `alerta-aso-enviar` que lê `alertas_aso WHERE email_enviado=false` e despacha.

3. **Vincular alguém ao cargo Analista de RH Generalista** (cargo id=2 existe vazio). Sem isso, só perfil master vê o botão Oficializar.

### Médio prazo (backlog)

4. **Validação visual da Quattrocento universal** — aplicada via `!important` em CSS, mas pode ter componente bem específico (Chart.js, datepickers nativos) que ainda escapa. Reportar conforme aparecer durante uso.

5. **DRE, Auditoria, ícones da sidebar** — pendências antigas que continuam abertas (`docs/PENDENCIAS.md`).

## Como retomar

1. Clone novo: `git clone https://github.com/Natalia-Terra/terra-gestao-financeira`.
2. PAT do GitHub não persiste entre sandboxes — solicitar à Juliana no início da próxima sessão.
3. Supabase project_id: `zvvdpdldjmzuzieinxwa` (Terra-Gestão-Financeira).
4. Deploy automático via push na `main` (Vercel é conta externa, validação via hash do conteúdo servido).
