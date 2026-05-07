# 📂 Bases (Arquivos) Necessárias — Terra Conttemporânea

**Atualizada em:** 2026-05-07

> Cada arquivo abaixo tem origem, formato esperado, configuração no sistema, e o que vai acontecer ao importar.

---

## 🟢 OBRIGATÓRIOS pra carga inicial

### 1. Arquivo "Bíblia" da Juliana

📄 **Nome do arquivo:** `30032026_Gestão Faturamento e Receita.xlsx`
🏠 **Origem:** Você (Juliana) — planilha-mestre que você mantém em Excel hoje
📐 **Tamanho:** ~2,6 MB
📋 **10 abas no total**, mas só 2 são importadas pelo sistema. Outras servem de referência.

**Abas usadas pelo sistema:**

| Aba | Cabeçalho na linha | Importação correspondente | Tabela destino |
|---|---|---|---|
| **Mov Financeiro** | Linha 3 | Histórico Mov Financeiro (arquivo Excel) | `movimentos` |
| **Saldo a Reconhecer** | Linha 2 | Histórico Saldo a Reconhecer (arquivo Excel) | `saldo_reconhecer` |

**Outras abas (NÃO importadas, só referência):**
- Controle Faturamento — modelo do Dashboard de Faturamento (rico)
- Receita 2025 / Custo 2025 / Receita 2026 / Custo 2026 — agregados anuais
- Saída de Estoque 2024 a jan26 — histórico (use o arquivo separado pra import)
- Lista — catálogos de Naturezas e Tipos
- Plano de Contas Atual_251125 — referência (sistema já tem 510 contas)

---

### 2. Dashboard de Orçamentos

📄 **Nome do arquivo:** `Dashboard de Orçamentos.xlsx`
🏠 **Origem:** Sistema interno da Terra (relatório gerado)
📐 **Tamanho:** ~25 KB · 598 linhas, 43 colunas
📋 **1 aba só:** "Custo 01012024-31122025"

**Estrutura (cabeçalho na linha 2):**

4 grupos de colunas:
- **A-S** — Informações gerais: Nº Orçamento, Cliente, Item, Família, Grupo, Qtds, Valores, NFs, Cód. Interno
- **T-V** — Serviços: número da OS (em andamento), número da OS (concluída), Status (Cruzada)
- **W-Y** — Lucro: previsto, realizado, saldo
- **Z-AP** — Custos: total previsto/realizado, materiais, horas, ST, outros (todos previsto vs realizado)

**Importação:** "Dashboard de Orçamentos"
**Tabelas destino:**
- `orcamento_items` (1 linha por item de orçamento)
- `os_custos_planejados` (1 linha por OS — previsto vs realizado em 4 dimensões)
- `ordens_servico` (UPSERT: OS, orçamento, item, família, grupo, status)

---

### 3. Relatório Orçamento Aprovado por Parceiro

📄 **Nome:** `Relatório orçamento aprovado por parceiro no mês.xls`
🏠 **Origem:** Aerolito (sistema externo)
📐 **Tamanho:** ~10 KB
📋 **1 aba** (varia por mês: "VENDAS MARÇO_GRV", etc.)

**Estrutura (cabeçalho na linha 1):**

| Coluna | Conteúdo |
|---|---|
| A | PARCEIROS |
| B | Cliente |
| C | Numero_do_Orcamento |
| D | Versao |
| E | dt_aprovacao |
| F | preco_com_ipi_subst_trib |

**Importação:** "Orçamentos"
**Comportamento especial:** sistema vai perguntar **tipo_faturamento padrão** (100, 0 ou X% parcial)
**Tabela destino:** `orcamentos`

---

### 4. Saída de Estoque Por Período

📄 **Nome:** `Saída de Estoque Por Período.xlsx`
🏠 **Origem:** Sistema interno
📐 **Tamanho:** ~2,3 MB · **25.801 linhas**, 16 colunas
📋 **1 aba:** "Saída de Estoque 2024 a jan26"

**Estrutura (cabeçalho na linha 1):**

| Coluna | Conteúdo |
|---|---|
| A | Código Saida |
| B | Código OS (formato `1015/002` — sistema separa OS+Item automaticamente) |
| C | Funcionario |
| D | Código Material |
| E | Descrição Material |
| F | Quantidade |
| G | Custo Unitário |
| H | Custo Total |
| I | Custo Fiscal do Material |
| J | N Plano de contas (ex: 44.01.001.002.004) |
| K | Plano de Contas (descritivo: 4CTPCC - MATERIAL CONSUMO) |
| L | Data Saída |
| M | DRE (CPV - Matéria Prima ou CPV - Direto) |
| N | Compet. (mês de referência) |
| O | OS |
| P | Item |

**Importação:** "Saída de Estoque (CPV-Matéria Prima)"
**Comportamento:**
- Linhas com DRE = "CPV - Matéria Prima" → vai pra `estoque_detalhes` + `estoque_resumo` + `os_evolucao_mensal` (custo MP por OS)
- Linhas com DRE = "CPV - Direto" → vai pra `custo_direto_competencia` (sem OS)
- Outras → ignoradas

**Tempo estimado:** 1-2 minutos pra parsear (arquivo grande)

---

### 5. A Pagar x A Receber

📄 **Nome:** `Relatório A Pagar x A Receber - Dt. Baixa.xlsx`
🏠 **Origem:** Sistema fiscal (geralmente exporta mensalmente)
📐 **Tamanho:** ~90 KB · 495 linhas, **22 colunas**
📋 **1 aba:** "Relatório A Pagar x A Receber -"

**Estrutura (cabeçalho na linha 1):**

22 colunas — as principais:
- COD_EMPRESA, **CONTAS A PAGAR/RECEBER** (PAGAR ou RECEBER), COD PN, **PARCEIRO DE NEGÓCIO**, CNPJ
- PREVISÃO (NÃO/SIM), **VALOR**, VALOR_CORRIGIDO, VALOR_PAGO, **VL PLANO CONTAS** (rateado)
- PAGO, DT_ABERTURA, **DT_PAGAMENTO** (= dt baixa), DT_VENCIMENTO
- **DOCUMENTO**, HISTORICO, TP_DOC
- COD_PLANO_CONTAS, **NUMERO_PLANO_CONTAS** (ex: 33.01.003.001.001), PLANO_CONTAS
- NUMEROCONTA, CONTACORRENTE

**Importação:** "A Pagar x A Receber (Dt. Baixa)"
**Comportamento especial:**
- Uma mesma transação pode aparecer em VÁRIAS linhas (uma por plano de contas — VL PLANO CONTAS rateia o VALOR total)
- **Regra automática de classificação:** se `tipo='RECEBER'` e `numero_plano_contas` for `33.01.003.001.001` ou `33.01.003.001.007`, marca natureza como **'Resultado Financeiro'** automaticamente
- Demais linhas RECEBER ficam pendentes (precisa classificar manualmente em **Lançamentos de Caixa** depois)
- Linhas PAGAR vão direto sem classificação

**Tabela destino:** `movimentos_caixa`

---

### 6. Notas Fiscais

📄 **Nome:** Não tenho amostra ainda (você gera via sistema fiscal)
🏠 **Origem:** Sistema fiscal/contábil
📋 **Estrutura esperada:**

| Coluna | Conteúdo |
|---|---|
| emissão | Data de emissão |
| numero_nf | Número da NF |
| razao_social | Cliente (razão social) |
| numero_orcamento | Número do orçamento (= "Ordem de") |
| valor_nf | Valor da NF |
| cfop | CFOP |
| mes_ref | Mês de referência |

**Importação:** "Notas Fiscais"
**Comportamento especial:**
- Após o "Pré-visualizar", abre **modal de revisão NF↔OS**
- Pra cada NF, sistema busca OSs do orçamento (via `ordens_servico`) e pré-marca todas
- Você revisa e confirma
- Grava em `notas_fiscais` + `nf_os` (vínculo N:N)

**Pré-requisito:** importar Dashboard de Orçamentos PRIMEIRO (pra `ordens_servico` ter os números das OSs)

---

## 🟡 OPCIONAIS (cadastrar via tela ou importar conforme tiver)

### 7. Contas Bancárias

📐 **Cadastra direto** via tela: Contabilidade Gerencial > Contas Bancárias
📋 **Campos:** nome, banco, tipo (corrente/poupança/aplicação), agência, conta, ordem, ativa

**Alternativa:** importar planilha pelo template "Contas Bancárias (cadastro)" — colunas: nome, banco, tipo, agência, conta, ordem, ativa

### 8. Saldos Mensais por Conta

📐 **Importa** ou **cadastra** mensalmente.
📋 **Colunas pra import:** conta (nome cadastrado), mes_ref (YYYY-MM), saldo_inicial, saldo_final_realizado, saldo_final_projetado, observacao

### 9. Compromissos Financeiros

📐 **Cadastra** via tela: Financeiro > Contas a Pagar
📋 **Campos:** vencimento, descricao, valor, tipo (folha/fornecedor/imposto/aluguel/outro), pago_em, observacao

### 10. Recebimentos Previstos

📐 **Importa** mensalmente
📋 **Colunas pra import:** orcamento, parcela, data_prevista, valor, recebido_em, observacao

### 11. Folha de Pagamento Mensal

📄 **Nome do template:** "Despesas Folha Mensal" (planilha que você ou RH gera mensalmente)
📐 **Importação especial:** template `despesas_folha_mensal` no dropdown
📋 **Comportamento:**
- Aba mensal (ex: "Outubro")
- Cruza nome → funcionário, atribui CC
- Cria linha em `folha_pagamento` (mes_ref derivado da data na linha 3)
- Povoa `folha_pagamento_rubricas` para cada coluna não-vazia (rubricas de salário, INSS, IR, etc.)

### 12. Folha de Ponto consolidada (PDF)

📄 **Nome:** Aguardando você gerar amostra
🏠 **Origem:** Sistema de ponto da Terra (gera 1 PDF único com todos os funcionários)
📋 **Status:** parser ainda **não implementado** (M19 Fase 3, em aguardo)
**Vai popular:** `frequencia_mensal` (faltas justificadas/injustificadas, atrasos)

---

## 🔵 Cadastros pontuais (sem planilha — direto via tela)

### Períodos de Bônus
**Tela:** Dep. Pessoal e RH > Bônus — Configuração > aba "Períodos"
**Cadastra:** Nome (ex: "2026-1"), Início, Fim, Status

### Metas da Empresa (Esfera Empresa do Bônus)
**Tela:** Dep. Pessoal e RH > Bônus — Configuração > aba "Empresa"
**Metas a cadastrar (semestralmente):**
- `faturamento` — valor R$ da meta semestral, peso 10%
- `margem_liquida` — meta % (ex: 0.10), peso 10%
- `caixa_positivo` — peso 5%
- `icc` — peso 5%

### Metas das Áreas (Esfera Área do Bônus)
**Tela:** Bônus — Configuração > aba "Áreas"
**Cadastra pra cada área do organograma:** descrição da meta, peso

### Apuração mensal das metas de área
**Tela:** Bônus — Configuração > aba "Áreas" > clicar na meta
**Marca:** se cada mês do semestre atingiu (atingiu = true/false)

### Medidas Disciplinares
**Tela:** Dep. Pessoal e RH > Medidas Disciplinares
**Quando:** sempre que ocorrer uma medida — sistema gradua automaticamente

### Avaliações de Desempenho
**Tela:** Dep. Pessoal e RH > Avaliação de Desempenho
**Quando:** semestralmente, ao final de cada ciclo

---

## 📊 Quadro-resumo: bases × telas

| Base | Telas que populam |
|---|---|
| Bíblia (Mov Financeiro) | Lançamentos, Despesas |
| Bíblia (Saldo a Reconhecer) | Saldo a Reconhecer |
| Dashboard de Orçamentos | Dashboard de Orçamentos, Dashboard Faturamento (rico), Custo por OS |
| Orçamento Aprovado | Vendas, Gestão de Faturamento, Dashboard Faturamento (rico) |
| Saída de Estoque | Custo por OS, Custo Direto Via OS, Dashboard Faturamento (Custo MP) |
| A Pagar x A Receber | Lançamentos de Caixa, Dashboard Faturamento (Adto/Recebimento) |
| Notas Fiscais | Notas Fiscais, Dashboard Faturamento (NF Emitida) |
| Folha de Pagamento | Folha, Custo Indireto |
| Saldos Mensais | Saldos Mensais, Fluxo de Caixa 12m |
| Compromissos | Contas a Pagar, Fluxo de Caixa 12m, ICC do Bônus |
| Cadastros via tela | Configurações + Bônus + RH |
