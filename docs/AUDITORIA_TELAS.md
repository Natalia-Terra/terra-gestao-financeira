# Auditoria de Telas e Fontes de Dados — Terra Conttemporânea

**Atualizada em:** 2026-05-07 (pós M18 + M19)
**Repo analisado:** `Natalia-Terra/terra-gestao-financeira` branch `main`

---

## Resumo executivo

**Sistema saudável.** Após M18 (Plena Gestão de Faturamento) e M19 (Perfil Master), o sistema tem:

- **53 tabelas** no schema `public` (43 originais + 6 da M18 + 4 catálogos/listas)
- **53 telas** acessíveis pela sidebar (46 originais + 7 novas: 4 da M18 Onda 3 + 3 utilitárias da M19)
- **17 templates de importação** (13 originais + 4 da M18)
- **18 migrações SQL** registradas (M07-M19c)
- **6 advisor warnings** (5 esperados arquiteturalmente + 1 config Auth dashboard)

---

## Tabelas novas da M18 (Plena Gestão de Faturamento)

| Tabela | Propósito | Telas que consomem |
|---|---|---|
| `orcamento_items` | 1 linha por item de orçamento | Dashboard de Orçamentos, Dashboard de Faturamento |
| `os_custos_planejados` | Previsto vs realizado por OS (4 dimensões) | Dashboard de Orçamentos |
| `movimentos_caixa` | Lançamentos do A Pagar x A Receber | Lançamentos de Caixa, Dashboard de Faturamento |
| `custo_direto_competencia` | CPV-Direto (sem OS, por competência) | (telas de Custeio futuras) |
| `lista_naturezas` | Catálogo de 11 naturezas | Modal de classificação manual + dropdowns |
| `lista_tipos_produto` | Catálogo de 5 tipos de produto | (futuro — dropdowns) |

## Colunas novas em `orcamentos`

- `tipo_faturamento` — `100_NF` / `0_NF` / `PARCIAL`
- `pct_com_nf` — % com NF (só usado se PARCIAL)
- `versao` — versão do orçamento (do Aerolito)

## View e função M18

- `vw_saldo_reconhecer` (SECURITY INVOKER) — cálculo em tempo real de venda - adto - NF
- `fn_snapshot_saldo_reconhecer(date)` — congela snapshot na tabela `saldo_reconhecer`

## Telas novas (após M18 Onda 3)

| Tela | Localização no menu | Fonte de dados |
|---|---|---|
| Saldo a Reconhecer | Receita > Saldo a Reconhecer | `vw_saldo_reconhecer` |
| Dashboard de Orçamentos | Comercial > Dashboard de Orçamentos | `orcamento_items` |
| Dashboard de Faturamento (rico) | Comercial > Dashboard de Faturamento (rico) | 5 fontes cruzadas |
| Lançamentos de Caixa | Financeiro > Lançamentos de Caixa | `movimentos_caixa` (com bulk action) |
| Reset Completo | Configuração > ⚠ Reset (só master) | RPC `fn_reset_base_completo` |

## Drill-downs novos

- **Custo por OS** / **Custo Direto Via OS** → modal "Itens MP — OS X" mostrando linhas de `estoque_detalhes` (data, material, qtd, custo unit/total, funcionário)
- **Notas Fiscais** (no fluxo de import) → modal de revisão de vínculo NF↔OS
- **Dashboard de Orçamentos** → modal com itens detalhados (item, família, grupo, qtds, valores, NFs vinculadas)

## Mapa atualizado: Tabela → Telas alimentadas

### Comercial / Receita
- `orcamentos`: dashboard, vendas, faturamento, gestão_faturamento, dashboard_faturamento (rico), notas, recebimentos, despesas, saldo_reconhecer (via view), apr_faturamento
- `orcamento_items`: dashboard_orcamentos_view, dashboard_faturamento (rico)
- `os_custos_planejados`: dashboard_orcamentos_view (drill-down)
- `notas_fiscais`: dashboard_faturamento (rico) (tela "Notas Fiscais" do menu ainda lê de movimentos — refac pendente)
- `nf_os`: importação de NFs (modal de revisão), dashboard_faturamento (rico)
- `ordens_servico`: dashboard_orcamentos_view, dashboard_faturamento (rico), apr_dashboard
- `estoque_detalhes`: drill-down "Itens MP por OS" + dashboard_faturamento (rico)
- `estoque_resumo`: (sem tela CRUD direto — agregado por estoque_detalhes)
- `custo_direto_competencia`: (sem tela ainda — popula via import Saída de Estoque com DRE='CPV - Direto')

### Financeiro
- `movimentos_caixa`: tela "Lançamentos de Caixa" (com bulk action de classificação manual)
- (telas "Contas a Receber" e "Contas a Pagar" ainda lêem de `movimentos`/`compromissos_financeiros` — refac pendente)

### Auth / Configuração
- `perfis_tipos`: cfg_usuarios, cfg_perfis_tipos, cfg_reset (controla visibilidade)
- Função `auth_pode_limpar_base()`: controla visibilidade da tela `cfg_reset`
- Função `auth_pode_carga_inicial()`: controla visibilidade da tela `importacoes`

## Matriz de permissões (após M19)

| Tipo | pode_admin | pode_modificar | pode_carga_inicial | pode_limpar_base |
|---|:---:|:---:|:---:|:---:|
| **master** | ✓ | ✓ | ✓ | ✓ |
| **admin** | ✓ | ✓ | ✓ | ✗ |
| **operador** | ✗ | ✓ | ✗ | ✗ |
| **consulta** | ✗ | ✗ | ✗ | ✗ |

Juliana e Natália = `master`. Único perfil com poder de Reset Completo da base.

## Pendências de refac (telas que ainda lêem das fontes antigas)

| Tela | Fonte atual | Fonte ideal (depois do refac) |
|---|---|---|
| Notas Fiscais (Comercial) | `movimentos` natureza='Nota Fiscal' | `notas_fiscais` rica + `nf_os` |
| Contas a Receber (Financeiro) | `movimentos` natureza='Recebimento' | `movimentos_caixa` filtro RECEBER |
| Contas a Pagar (Financeiro) | `compromissos_financeiros` | `movimentos_caixa` filtro PAGAR |
| Gestão de Faturamento (Comercial) | `orcamentos` clássico | substituir pelo Dashboard de Faturamento (rico) |

Essas refacs são **incrementais e baixa urgência** — telas atuais funcionam. Avaliar caso a caso.
