# Próxima Sessão — Frentes prioritárias

**Atualizado em 2026-05-07 ao final da M18.**

A M18 (Plena Gestão de Faturamento) está aplicada — backend 100%, frontend ~80% (Dashboard rico de Gestão de Faturamento ficou pra Onda 3.3). Próximas frentes em ordem de prioridade:

## 1. Perfil "Master" + tela Reset (URGENTE)

Tema discutido logo no início da sessão de 2026-05-07 mas não implementado. **Antes da carga em massa de dados reais**, criar:

- **Migração SQL** (M19 ou M20):
  - 2 flags novas em `perfis_tipos`: `pode_limpar_base`, `pode_carga_inicial`
  - Tipo novo `master` com TODAS as flags em true
  - Promover `juliana@polimatagrc.com.br` e `financeiro@terraconttemporanea.com.br` pra `master`
  - 2 funções helper RLS: `auth_pode_limpar_base()`, `auth_pode_carga_inicial()`
  - Função `fn_reset_base_completo()`: esvazia tabelas de negócio mantendo plano_contas, cfop, perfis, perfis_tipos, centros_custo, classif_faturamento. Verifica internamente se quem chama é master
- **Frontend**:
  - Tela nova "Reset" em Configuração — botão vermelho "Reset completo do sistema" com confirmação dupla (digitar "RESET")
  - Esconder/desabilitar tela "Importar" pra perfis sem `pode_carga_inicial`
  - Esconder/desabilitar tela "Reset" pra perfis sem `pode_limpar_base`

## 2. M18 Onda 3.3 — Refac "Gestão de Faturamento"

Tela hoje continua usando `orcamentos.recebimento` etc. Refatorar pra Dashboard rico cruzando 5 fontes:

- `orcamentos` — venda, tipo_faturamento, pct_com_nf
- `movimentos_caixa` — adiantamento, recebimento, resultado_financeiro (filtrar por orcamento_vinculado + natureza)
- `notas_fiscais` + `nf_os` — NF emitida por OS do orçamento
- `estoque_detalhes` (DRE='CPV - Matéria Prima') — custo total por OS

Tabela com colunas: Data | Orçamento | Cliente | Tipo Faturamento | Venda | Adto | Recebimento | Resultado Financeiro | A Receber | Status Recebimento | NF Emitida | Venda S/NF | A Faturar | Status Faturamento | Saldo Adto | Custo total

Drill-downs em cada coluna numérica (já temos vários na M18 Onda 3).

## 3. Refac telas Notas Fiscais / Contas a Receber / Contas a Pagar

Mudar fonte de dados pra ler das tabelas novas:
- "Notas Fiscais" (Comercial) — ler de `notas_fiscais` (rica) com OSs vinculadas via `nf_os`
- "Contas a Receber" (Financeiro) — ler de `movimentos_caixa` filtrando RECEBER + agregar status
- "Contas a Pagar" (Financeiro) — ler de `movimentos_caixa` filtrando PAGAR + manter `compromissos_financeiros` pra futuros não baixados

## 4. M19 — Bônus Individual (cálculo profissional)

- Parser de PDF de Folha de Ponto **consolidado** (1 PDF único com todos funcionários) → `frequencia_mensal`
- Definir fontes/telas para `medidas_disciplinares` e `avaliacao_desempenho`
- Implementar lógica de cálculo profissional no Bônus Individual

## 5. Limpeza de qualidade (advisor)

- Adicionar `SET search_path = public` em fn_auditar, fn_touch_atualizado_em, get_perfil, set_atualizado_em
- Revogar EXECUTE de anon em auth_pode_admin, auth_pode_modificar (ou trocar pra SECURITY INVOKER se aceitar)
- Habilitar `auth_leaked_password_protection` no Supabase Auth

## 6. Atualizar AUDITORIA_TELAS.md / DADOS_TESTE.md / ROTEIRO_TESTE.md

Os 3 documentos foram gerados antes da M18 e estão desatualizados — refletir as 4 telas novas e os 4 templates de import novos.
