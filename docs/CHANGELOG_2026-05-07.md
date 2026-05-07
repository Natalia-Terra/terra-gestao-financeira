# Changelog Final — Sessão 2026-05-07

Sessão dedicada a fechar M18 + M19 + Política de Histórico + cálculo do Bônus.

## Sumário

| Categoria | Volume |
|---|---|
| Migrações SQL aplicadas | 13 (M18, M18b, M19, M19b, M19c, M20, M21, M22, M22b, M23, M24, M25, M26) |
| Commits frontend | 26 |
| Linhas de código novas em app.js | ~6.000 |
| Telas novas | 6 |
| Funções RPC de bônus | 5 |
| Drill-downs novos | 3 |
| Imports refatorados | 12 |
| 0 ERROR no advisor | ✓ |
| 0 toques no PC da Juliana | ✓ |

## Principais entregas

### M18 — Plena Gestão de Faturamento
- 6 tabelas novas (orcamento_items, os_custos_planejados, movimentos_caixa, custo_direto_competencia, lista_naturezas, lista_tipos_produto)
- 3 colunas novas em orcamentos (tipo_faturamento, pct_com_nf, versao)
- View vw_saldo_reconhecer + função fn_snapshot_saldo_reconhecer
- 4 templates de import novos: Dashboard de Orçamentos, A Pagar x A Receber, Histórico Mov Financeiro, Histórico Saldo a Reconhecer
- 2 templates refatorados: Saída de Estoque (4 destinos), Notas Fiscais (modal NF↔OS)
- 4 telas novas: Saldo a Reconhecer, Dashboard de Orçamentos, Dashboard de Faturamento (rico), Lançamentos de Caixa

### M19 — Master + Bônus Individual
- Tipo "master" + flags (pode_limpar_base, pode_carga_inicial)
- Função fn_reset_base_completo() com check de permissão
- Tela "⚠ Reset Completo" em Configuração (só master vê)
- Tabela medidas_disciplinares estendida + tela Medidas Disciplinares com graduação automática POL_001
- Tabela avaliacao_desempenho estendida + tela Avaliação de Desempenho (5 dimensões)
- 4 funções RPC de cálculo do Bônus:
  - fn_calcular_bonus_profissional (40%): Conduta + Avaliação + Faltas + Atrasos − Penalidade
  - fn_calcular_bonus_area (30%): meses atingidos / 6
  - fn_calcular_bonus_empresa (30%): Faturamento + Margem + Caixa + ICC
  - fn_calcular_pool_bonus: Pool × multiplicador da margem
  - fn_calcular_bonus_total: agrega + valor estimado em R$
- Drill-down em RH > Funcionários: histórico de Medidas + Avaliações + botão "Calcular Bônus do semestre"

### M24-M26 — Política "Nunca Sobrescrever, Sempre Competência"
- Tabela imports_historico (rastreio de cada importação)
- Colunas vigente + import_id em 20 tabelas com dados temporais
- Helper aplicarPoliticaHistorico() que centraliza a lógica
- 12 imports refatorados pra usar a política — re-importar mesmo período NÃO duplica

### Limpeza Auth e Qualidade
- Min password length: 6 → 8
- Password requirements: lowercase + uppercase + digits + symbols
- Secure password change: ON
- Require current password when updating: ON
- search_path fixo em fn_auditar/fn_touch/get_perfil/set_atualizado_em
- REVOKE de PUBLIC nas auth_pode_*/fn_reset
- Resultado: 0 ERROR, 6 WARN aceitos arquiteturalmente + 1 só Pro plan

## Commits frontend (em ordem)

1. 3320ff459b — M18 2A
2. b2c36de4c5 — rename bíblia
3. a94e9b62c2 — M18 2B
4. 9099f102f2 — M18 2C-1
5. aed904cd28 — M18 2C-2
6. 49289d7536 — M18 2C-3
7. d0440c5f77 — M18 3.1
8. d3b6c75f3e — M18 3.2
9. 37b77b95b0 — docs M18
10. be8a7e3c87 — M19 Master
11. faf91c88fa — M18 3.3 Dashboard rico
12. c5609dfff6 — docs M19
13. 485b0333b7 — docs+SQL nuvem
14. a1159b99c4 — refacs telas com fallback
15. 94d425010f — pacote final teste
16. fc832262d5 — Medidas Disciplinares
17. b662f73a77 — Avaliação Desempenho
18. 14b3cf835a — SPEC_BONUS + M22
19. 02070fd138 — M23 Bônus completo + drill-down
20. acb2c9f63f — docs M23
21. 1b4ec95eed — M24 Política Histórico
22. 76d1988805 — M25 Refac imports
23. 59004f396a — M26 Política em todas
24. (pendente) — roteiro go-live

## Como retomar

A próxima sessão começa com:
1. Bugs encontrados nos testes (se houver)
2. Amostra real do PDF Folha de Ponto consolidado (M19 Fase 3)
3. Decisões pra tela "Bônus Individual" consolidada (lista todos com ranking)

## Token GitHub

Usado nesta sessão: `cowork-terra-temp` em https://github.com/settings/personal-access-tokens
**REVOGAR após terminar testes.**
