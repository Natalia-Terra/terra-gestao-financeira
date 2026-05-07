# Changelog — Sessão 2026-05-07

Sessão dedicada a fechar **M18 Plena Gestão de Faturamento** + **M19 Perfil Master** + reforços de qualidade e configuração.

## Sumário

| Categoria | Volume |
|---|---|
| Migrações SQL aplicadas | 5 (M18, M18b, M19, M19b, M19c) |
| Commits frontend | 14 |
| Linhas de código novas em app.js | ~3.500 |
| Telas novas | 4 (Saldo a Reconhecer, Dashboard de Orçamentos, Dashboard de Faturamento (rico), Lançamentos de Caixa) |
| Tela utilitária nova | 1 (⚠ Reset Completo, master only) |
| Templates de import novos | 4 (Dashboard de Orçamentos, A Pagar x A Receber, 2 históricos da bíblia) |
| Templates de import refatorados | 2 (Saída de Estoque, Notas Fiscais) |
| Drill-downs novos | 2 (Custo por OS → itens MP, NF→OSs no fluxo de import) |
| Telas refatoradas com fallback | 2 (Notas Fiscais, Contas a Receber) |
| Toques no PC da Juliana | 0 (tudo via API GitHub e MCP Supabase) |

## Migrações SQL

### M18 — Plena Gestão de Faturamento
- 6 tabelas novas: `orcamento_items`, `os_custos_planejados`, `movimentos_caixa`, `custo_direto_competencia`, `lista_naturezas`, `lista_tipos_produto`
- 3 colunas novas em `orcamentos`: `tipo_faturamento`, `pct_com_nf`, `versao`
- View `vw_saldo_reconhecer` (cálculo em tempo real)
- Função `fn_snapshot_saldo_reconhecer(date)` (snapshot mensal)
- 12 RLS policies (modify via auth_pode_modificar)
- 6 triggers de auditoria + 3 de touch
- UPDATE em massa: 264 orçamentos antigos marcados como `tipo_faturamento='100_NF'`
- Catálogos seed: 11 naturezas + 5 tipos de produto

### M18b — Patch de qualidade
- VIEW vw_saldo_reconhecer com `security_invoker = true`
- Função fn_snapshot_saldo_reconhecer com `SET search_path = public`

### M19 — Perfil Master
- 2 colunas novas em `perfis_tipos`: `pode_limpar_base`, `pode_carga_inicial`
- Tipo `master` criado (todas as flags em true)
- Juliana e Natália promovidas pra master
- Funções helper `auth_pode_limpar_base()`, `auth_pode_carga_inicial()`
- Função `fn_reset_base_completo()` com check interno
- Removida CHECK constraint legacy de `perfis.perfil`
- Admin agora também tem `pode_carga_inicial=true` (operador NÃO)

### M19b — Limpeza search_path
- Recriadas com `SET search_path = public`: fn_auditar, fn_touch_atualizado_em, get_perfil, set_atualizado_em
- fn_auditar revogada de external (só usada por triggers)
- REVOKE EXECUTE de anon nas auth_pode_admin/auth_pode_modificar

### M19c — Revoke de PUBLIC
- REVOKE EXECUTE de PUBLIC e GRANT TO authenticated nas auth_pode_*/fn_reset_base_completo
- Silenciou warnings 0028 (anon) do advisor

## Commits frontend (em ordem)

| # | Commit | Mensagem |
|---|---|---|
| 1 | `3320ff459b` | feat(import): M18 Onda 2A — refac saida_estoque (4 destinos) + 2 templates de histórico + refac orcamentos |
| 2 | `b2c36de4c5` | chore(import): renomear "bíblia" → "arquivo" nos textos visíveis |
| 3 | `a94e9b62c2` | feat(import): M18 Onda 2B — template "Dashboard de Orçamentos" |
| 4 | `9099f102f2` | feat(import): M18 Onda 2C-1 — pergunta tipo_faturamento na importação de orçamentos |
| 5 | `aed904cd28` | feat(import): M18 Onda 2C-2 — refac NFs com vínculo NF↔OS (modal de revisão) |
| 6 | `49289d7536` | feat(import): M18 Onda 2C-3 — template "A Pagar x A Receber" |
| 7 | `d0440c5f77` | feat(ui): M18 Onda 3.1 — 2 telas novas + drill-down |
| 8 | `d3b6c75f3e` | feat(ui): M18 Onda 3.2 — Lançamentos de Caixa + drill-down Custo por OS |
| 9 | `37b77b95b0` | docs: atualizar ESTADO_ATUAL/PENDENCIAS/PROXIMA_SESSAO pós M18 |
| 10 | `be8a7e3c87` | feat(auth): M19 — Perfil Master + tela Reset |
| 11 | `faf91c88fa` | feat(ui): M18 Onda 3.3 — Dashboard de Faturamento (rico) |
| 12 | `c5609dfff6` | docs: PENDENCIAS.md e PROXIMA_SESSAO.md atualizados pós M19 + Onda 3.3 |
| 13 | `485b0333b7` | docs: salva docs operacionais e SQL na nuvem |
| 14 | `a1159b99c4` | feat(ui): refac incremental telas Notas Fiscais e Contas a Receber com fallback |

## Configurações de Auth reforçadas (Supabase Dashboard)

- Minimum password length: 6 → **8**
- Password requirements: empty → **Lowercase, uppercase letters, digits and symbols**
- Secure email change: ✅ ativo
- Secure password change: ⚪ → **✅ ativo**
- Require current password when updating: ⚪ → **✅ ativo**
- Leaked password protection: ⚪ (só Pro plan, advisor warning aceito)

## Decisões importantes registradas

1. **Folha de Ponto pra M19** será via PDF consolidado (1 PDF único com todos os funcionários) — Juliana confirmou
2. **Refacs incrementais** com fallback — Notas Fiscais e Contas a Receber automaticamente migram pra fonte rica conforme imports forem feitos
3. **Tela "Gestão de Faturamento" antiga preservada** em paralelo com novo "Dashboard de Faturamento (rico)" pra validação visual
4. **Contas a Pagar (caixa_compromissos) NÃO refatorada** — `compromissos_financeiros` é conceito diferente (futuros) de `movimentos_caixa` PAGAR (efetivos). As 2 telas coexistem por design

## Arquivos novos no repo

```
docs/
  AUDITORIA_TELAS.md       — auditoria atualizada pós M18+M19
  CHECKLIST_TESTE_FINAL.md — roteiro operacional pra testes
  CHANGELOG_2026-05-07.md  — este arquivo
  DADOS_TESTE.md           — checklist de carga inicial
  ROTEIRO_TESTE.md         — roteiro 7 fases (A-G)
  SPEC_FATURAMENTO.md      — spec consolidado da M18
  ESTADO_ATUAL.md          — atualizado
  PENDENCIAS.md            — atualizado
  PROXIMA_SESSAO.md        — atualizado
  ARQUITETURA.md           — pré-existente

migracoes/
  M18_plena_gestao_faturamento.sql  — registro histórico
  M19_perfil_master.sql              — registro histórico
```

## Estatísticas de qualidade

**Antes da sessão:** N/A (não havia advisor check sistemático)
**Depois da sessão:**
- 0 ERROR
- 6 WARN (5 esperados arquiteturalmente + 1 que exige Supabase Pro)

## Como retomar

Próxima sessão começa com lista de bugs encontrados nos testes + decisões pra M19 Bônus Individual.

Token GitHub usado nesta sessão (a revogar pela Juliana após testes): `cowork-terra-temp` em https://github.com/settings/personal-access-tokens
