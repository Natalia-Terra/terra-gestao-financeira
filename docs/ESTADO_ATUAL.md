# Estado Atual do Sistema — Terra Conttemporânea

**Atualizado em:** 2026-05-07 (pós M18 aplicada)
**Source-of-truth:** este arquivo no GitHub. Memória local do Claude é cache temporário.

## Produção

- **URL:** https://terra-gestao-financeira.vercel.app
- **Deploy:** Vercel (Hobby plan, conta financeiro@terraconttemporanea.com.br)
- **Backend:** Supabase projeto `Terra-Gestão-Financeira` (id: `zvvdpdldjmzuzieinxwa`)
- **Repo:** Natalia-Terra/terra-gestao-financeira (branch `main`)

## Banco

- **15 migrações registradas** (M07-M17 anteriores + M18 + M18b aplicadas em 2026-05-07)
- **49 tabelas** em schema `public` (43 antigas + 6 novas da M18)
- **53 RLS policies** de modify usando `auth_pode_modificar()`
- 3 tipos de perfil em `perfis_tipos`: admin, operador, consulta
- **Catálogos M18:** `lista_naturezas` (11 naturezas) e `lista_tipos_produto` (5 tipos) populados
- Edge Function `gerenciar-usuarios` ACTIVE
- Auditoria automática (triggers `fn_auditar`) cobrindo todas as tabelas com colunas de negócio
- Trigger touch `atualizado_em` em todas as tabelas com essa coluna

### Tabelas novas da M18 (Plena Gestão de Faturamento)

| Tabela | Propósito |
|---|---|
| `orcamento_items` | 1 linha por item de orçamento (do Dashboard de Orçamentos) |
| `os_custos_planejados` | Previsto vs realizado por OS em 4 dimensões (materiais, horas, ST, outros) |
| `movimentos_caixa` | Lançamentos do "A Pagar x A Receber - Dt. Baixa" com classificação manual |
| `custo_direto_competencia` | CPV-Direto da Saída de Estoque (sem OS, por competência) |
| `lista_naturezas` | Catálogo (11): Adiantamento, Recebimento, NF, Venda, etc. |
| `lista_tipos_produto` | Catálogo (5): Mobília Fixa/Solta, Reembolso, etc. |

### Colunas novas em `orcamentos`

- `tipo_faturamento` TEXT CHECK (100_NF / 0_NF / PARCIAL)
- `pct_com_nf` NUMERIC(5,2) — só faz sentido quando PARCIAL
- `versao` TEXT — versão do orçamento da planilha Aerolito
- **264 orçamentos pré-existentes marcados como `tipo_faturamento='100_NF'` por padrão**

### View e função M18

- `vw_saldo_reconhecer` (SECURITY INVOKER): cálculo em tempo real de saldo a reconhecer por (orçamento, competência)
- `fn_snapshot_saldo_reconhecer(competencia DATE)`: congela snapshot na tabela `saldo_reconhecer` para fechamento mensal

## Frontend

Estrutura SPA monolítica (mantida):
- `index.html` — shell + 49 sections (uma por tela; +3 sections novas da M18)
- `app.js` — IIFE única com toda a lógica (~7.700+ linhas após M18)
- `styles.css` — design system (paleta marrom/ouro Terra, fonte Quattrocento)
- `config.js` — credenciais Supabase (NÃO commitar — usa config.example.js)

### Novidades de UI da M18

**Importações (rodapé) — 4 templates novos / refatorados:**
- "Histórico Mov Financeiro (arquivo Excel)" → tabela `movimentos`
- "Histórico Saldo a Reconhecer (arquivo Excel)" → tabela `saldo_reconhecer`
- "Dashboard de Orçamentos" → 3 destinos (orcamento_items + os_custos_planejados + ordens_servico)
- "A Pagar x A Receber (Dt. Baixa)" → movimentos_caixa (com classificação automática)
- Refac "Saída de Estoque" → 4 destinos (estoque_detalhes + estoque_resumo + os_evolucao_mensal + custo_direto_competencia)
- Refac "Notas Fiscais" → modal de revisão de vínculo NF↔OS antes de gravar
- Refac "Orçamentos" → prompt de tipo_faturamento + aceita planilha Aerolito

**Telas novas:**
- "Saldo a Reconhecer" (Receita > Saldo a Reconhecer): tabela com filtro por status, cards de totais
- "Dashboard de Orçamentos" (Comercial > Dashboard de Orçamentos): lista agregada + drill-down por orçamento
- "Lançamentos de Caixa" (Financeiro > Lançamentos de Caixa): movimentos_caixa com bulk action de classificação manual

**Drill-downs novos:**
- Custo por OS / Custo Direto Via OS → modal com itens MP de `estoque_detalhes`

Sidebar continua organizada em 8 grupos (Dashboard, Receita, Financeiro, Comercial, Custeio, Contabilidade Gerencial, Dep. Pessoal e RH, Configuração + rodapé Importar).

## Perfis ativos

- `juliana@polimatagrc.com.br` — admin
- `financeiro@terraconttemporanea.com.br` (Natália) — operador

## Funcionalidades-chave

- Filtros multi-coluna em todas as telas listáveis
- Modais de drill-down: Vendas, Gestão Faturamento, NFs, Lançamentos, Despesas, Bônus Individual, Visão 12m, Itens MP por OS
- Soft delete de usuários (coluna `ativo` em `perfis`)
- 17 templates de importação (era 13 + 4 da M18)
- Catálogos M18 prontos pra dropdown nas UIs
