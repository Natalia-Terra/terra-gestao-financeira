# Changelog — Sessão 2026-05-07

Sessão dedicada a fechar **M18 Plena Gestão de Faturamento** + **M19 Perfil Master** + **M19 Fase 1 Medidas Disciplinares (POL_001)** + reforços de qualidade.

## Sumário

| Categoria | Volume |
|---|---|
| Migrações SQL aplicadas | 6 (M18, M18b, M19, M19b, M19c, M20) |
| Commits frontend | 16 |
| Linhas de código novas em app.js | ~4.000 |
| Telas novas | 5 (Saldo a Reconhecer, Dashboard Orçamentos, Dashboard Faturamento rico, Lançamentos Caixa, Medidas Disciplinares) |
| Telas utilitárias novas | 1 (⚠ Reset Completo, master only) |
| Templates de import novos | 4 |
| Templates refatorados | 2 |
| Drill-downs novos | 2 |
| Toques no PC da Juliana | 0 (tudo via API GitHub e MCP Supabase) |

## Migrações SQL

### M18 — Plena Gestão de Faturamento
6 tabelas + 3 colunas em orcamentos + view + função snapshot + 12 RLS policies + triggers.

### M18b — Patch
SECURITY INVOKER na view + search_path fixo na função.

### M19 — Perfil Master
2 flags em perfis_tipos + tipo "master" + Juliana e Natália promovidas + 2 funções helper + fn_reset_base_completo() com check.

### M19b — Limpeza search_path
SET search_path em fn_auditar/fn_touch/get_perfil/set_atualizado_em.

### M19c — Revoke PUBLIC
Revoke de PUBLIC nas auth_pode_*/fn_reset, GRANT só pra authenticated.

### M20 — Medidas Disciplinares (POL_001)
Estendeu tabela existente (era simples, agora 17 colunas). CHECK constraints, FKs, RLS, triggers.

## 16 commits frontend

| # | Commit | Descrição |
|---|---|---|
| 1 | `3320ff459b` | M18 2A — refac saida_estoque + 2 históricos + refac orcamentos |
| 2 | `b2c36de4c5` | rename "bíblia" → "arquivo" |
| 3 | `a94e9b62c2` | M18 2B — Dashboard de Orçamentos (import) |
| 4 | `9099f102f2` | M18 2C-1 — prompt tipo_faturamento |
| 5 | `aed904cd28` | M18 2C-2 — NFs com modal NF↔OS |
| 6 | `49289d7536` | M18 2C-3 — A Pagar x A Receber |
| 7 | `d0440c5f77` | M18 3.1 — Saldo a Reconhecer + Dashboard Orçamentos (telas) |
| 8 | `d3b6c75f3e` | M18 3.2 — Lançamentos de Caixa + drill-down |
| 9 | `37b77b95b0` | docs/ atualizados pós M18 |
| 10 | `be8a7e3c87` | M19 — Perfil Master + tela Reset |
| 11 | `faf91c88fa` | M18 3.3 — Dashboard Faturamento (rico) |
| 12 | `c5609dfff6` | docs/ pós M19 + 3.3 |
| 13 | `485b0333b7` | docs+SQL salvos na nuvem |
| 14 | `a1159b99c4` | refac telas com fallback |
| 15 | `94d425010f` | pacote final pra teste |
| 16 | `fc832262d5` | M19 Fase 1 — Medidas Disciplinares (POL_001) |

## Configurações Auth reforçadas

- Min password length: 6 → **8**
- Password requirements: empty → **Lowercase, uppercase letters, digits and symbols**
- Secure password change: ✅
- Require current password when updating: ✅
- Leaked password protection: indisponível (só Pro plan)

## Decisões registradas

1. Folha de Ponto pra M19 Fase 3 = PDF consolidado (1 PDF com todos)
2. Reincidência das Medidas Disciplinares = ANO CIVIL (jan-dez)
3. Cadastro de Medidas: master + admin + profissional de RH (via pode_modificar)
4. Demissão por Justa Causa: pergunta na hora se marca funcionário como INATIVO
5. Refacs telas: estratégia conservadora com fallback (não quebra nada)
6. Tela antiga "Gestão de Faturamento" preservada em paralelo com Dashboard rico

## Estatísticas

**Advisor de segurança final:** 0 ERROR, 6 WARN (5 arquiteturais + 1 só Pro).

## Como retomar

Próxima sessão: M19 Fase 2 (Avaliação de Desempenho) — em curso.
