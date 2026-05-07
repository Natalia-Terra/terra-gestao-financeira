# SPEC — M18 Plena Gestão de Faturamento

**Data:** 2026-05-07
**Autor da spec:** Juliana (cliente) + Claude (consolidação)
**Base:** análise das 6 planilhas operacionais da Terra + schema atual do Supabase + auditoria de telas
**Destino:** `terra-gestao-financeira/docs/SPEC_FATURAMENTO.md` (mover após git pull)

> Este documento substitui as conversas dispersas. Antes de implementar, Juliana revisa e marca o que precisa ajustar.

---

## 1. Glossário

### Naturezas (das movimentações financeiras — sheet "Lista")
Adiantamento · Assistência Técnica · Entrega Futura · Entrega S/ NF · Nota Fiscal · Outras Receitas · Recebimento · Reembolso · Resultado Financeiro · Venda · Venda S/ NF

### Tipos de produto (sheet "Lista")
Mobília Fixa · Mobília Solta · Reembolso · Assistência Técnica · Outras Receitas

### Tipos de Faturamento (NOVO — coluna em `orcamentos`)
- `100_NF` — orçamento 100% com nota fiscal
- `0_NF` — orçamento 100% sem nota fiscal (entrega informal)
- `PARCIAL` — parte com NF, parte sem (acompanhado de `pct_com_nf` numeric 0–100)

### Grupos do Plano de Contas
Ativo · Passivo · Resultado · Receita · Despesa · Custo

### "Grupo 1 — Ativo Estoque" (filtro do custo no Dashboard)
Conceitualmente = **DRE = "CPV - Matéria Prima"** no relatório de Saída de Estoque (são as baixas de estoque vinculadas a OS específicas). As contas de origem no plano: `11.01.003.*` (1ACE - ESTOQUES e filhos: matéria-prima, consumo, em fabricação, acabado, em poder de terceiros). Mas no relatório aparecem as contrapartidas em `44.01.*` (CPV) — basta filtrar pelo DRE.

### "CPV - Direto" (vs CPV - Matéria Prima)
**CPV - Direto** = custo reconhecido na **competência da compra**, sem necessariamente ter OS vinculada. **NÃO** vai para `estoque_detalhes` nem `os_evolucao_mensal.custo_saida`. Vira custo "geral" mensal.

---

## 2. Os 5 relatórios — fonte → tabela → tela

### 2.1. Relatório "Orçamento Aprovado por Parceiro no Mês" (.xls, 6 colunas)

**Colunas:** PARCEIROS | Cliente | Numero_do_Orcamento | Versao | dt_aprovacao | preco_com_ipi_subst_trib

**Tabela destino:** `orcamentos` (mesma já usada)

**Mapeamento:**
| Coluna planilha | Coluna tabela | Observação |
|---|---|---|
| PARCEIROS | `parceiro` | Nome do parceiro/representante |
| Cliente | `nome` | Nome do cliente final |
| Numero_do_Orcamento | `orcamento` (texto) | Chave |
| Versao | `versao` | NOVA coluna (text) |
| dt_aprovacao | `data` | Data aprovação |
| preco_com_ipi_subst_trib | `venda` | Valor total |

**Regra adicional na importação:**
- Para CADA orçamento novo, **perguntar tipo de faturamento** (modal): `100_NF` / `0_NF` / `PARCIAL`. Se PARCIAL, pedir `pct_com_nf` (0–100).
- Salvar em `orcamentos.tipo_faturamento` e `orcamentos.pct_com_nf`.

**Telas que se beneficiam:** Vendas, Gestão de Faturamento, Dashboard, Visão Geral, Receita por Apropriação, Receita por Faturamento.

---

### 2.2. Relatório "Dashboard de Orçamentos" (.xlsx, 598 linhas, 43 colunas — RICO)

**Sheet:** `Custo 01012024-31122025`

**4 grupos de colunas:**

| Grupo | Colunas |
|---|---|
| Informações gerais (A-S) | Nº Orçamento, Cliente, Representante, Vl. Total Comissão, **Item, Família, Grupo**, Nº pedido, **Notas fiscais** (lista de NFs daquele item!), Qtde vendida/reservada/faturada/a faturar/disponível, Vl. unitário/total/a faturar/disponível, **Cód. Interno** |
| Serviços vinculados (T-V) | **Serviços em andamento** (= número da OS!), **Serviços concluídos** (= número da OS!), Cruzada (status: Concluído/Em andamento) |
| Valor do lucro (W-Y) | Lucro previsto, Lucro realizado, Saldo do lucro |
| Custos totais (Z-AP) | Total previsto/realizado/saldo + 4 sub-grupos: **Materiais** (previstos/realizados/saldo + comprados-não-entregues + reservado-não-utilizado), **Horas** (previstas/realizadas/saldo), **Serviços de terceiros** (ST previstos/realizados/saldo), **Outros** (previstos/realizados/saldo) |

**Tabelas destino:**

| Tabela | O que recebe |
|---|---|
| `ordens_servico` | 1 linha por (orcamento, item) — recebe Item, Família, Grupo, Cód. Interno, número da OS |
| `os_evolucao_mensal` | já existe — recebe % de evolução (já implementado) |
| **`orcamento_items`** (NOVA) | Detalha cada item do orçamento: orcamento, item, família, grupo, vl_unitario, vl_total, qtd_vendida/reservada/faturada/a_faturar, vl_a_faturar, lucro_previsto, lucro_realizado |
| **`os_custos_planejados`** (NOVA) | Por OS: total_previsto, total_realizado, materiais_previstos/realizados, horas_previstas/realizadas, st_previstos/realizados, outros_previstos/realizados |

**Decisão da Juliana:** "extinguir manual+externo, fazer no sistema". Então:
- Importação inicial pra trazer histórico (one-shot)
- A partir daí: **módulo nativo no sistema** — telas de cadastro/edição que substituem a planilha externa

**Tela nova — "Dashboard de Orçamentos" (em Comercial)**
- Lista todos os orçamentos com colunas resumo (Nº, Cliente, Total, Lucro, % faturado, Status)
- Drill-down por orçamento → mostra itens, OSs vinculadas, custos previstos vs realizados, NFs emitidas

---

### 2.3. Relatório "Emissão de Notas Fiscais" (já existe template, refatorar fluxo)

**Tabelas destino:** `notas_fiscais` (rica) + `nf_os` (vínculo N:N)

**Mapeamento `notas_fiscais` (já existe):**
emissao | numero_nf | razao_social | numero_orcamento | valor_nf | cfop | mes_ref

**Vínculo NF↔OS — fluxo HÍBRIDO de 2 passos:**

1. **Passo 1 — Parse:** sistema lê o arquivo, faz preview da NF
2. **Passo 2 — Revisão de vínculo:** para cada NF, sistema busca em `ordens_servico` quais OSs pertencem ao `numero_orcamento` daquela NF. **Pré-marca** as OSs sugeridas. Natália revisa, marca/desmarca, e confirma.
3. **Passo 3 — Grava:** insert em `notas_fiscais` + insert em `nf_os` para cada par confirmado

**Telas afetadas:**
- **"Notas Fiscais" (Comercial)** — refazer pra ler de `notas_fiscais` (não mais de `orcamentos.nota_fiscal`). Mostrar OSs vinculadas via `nf_os`
- **Drill-down NF** — ao clicar, modal com OSs vinculadas, valor da NF, valores de OS

---

### 2.4. Relatório "Saída de Estoque Por Período" (refatorar template existente)

**Colunas (ordem real):** Código Saida | Código OS (ex: `1015/002`) | Funcionario | Código Material | Descrição Material | Quantidade | Custo Unitário | Custo Total | Custo Fiscal do Material | **N Plano de contas** | **Plano de Contas** | Data Saída | DRE | Compet. | OS | Item

**Comportamento atual** (template `saida_estoque`): só agrega total por OS+mês em `os_evolucao_mensal.custo_saida`.

**Comportamento NOVO** (refatorar):

| Tabela | O que vai receber | Filtro |
|---|---|---|
| `estoque_detalhes` | TODAS as linhas (linha-a-linha completa, com material, qtd, custo unit, etc.) | DRE = "CPV - Matéria Prima" |
| `estoque_resumo` | Agregado por OS (n_itens, custo_total, primeira/última saída, lista de funcionários) | derivado de estoque_detalhes via trigger ou pós-processamento |
| `os_evolucao_mensal.custo_saida` | Continua sendo populado (compatibilidade) | DRE = "CPV - Matéria Prima" |

**O que fazer com linhas DRE = "CPV - Direto":**
- Ir para tabela nova **`custo_direto_competencia`** (mes_ref, valor, plano_contas_id, descrição) — sem OS
- Aparece no DRE e Custo Indireto, não em Custo por OS

**Telas afetadas:**
- **Drill-down "Custo por OS"** — ao clicar numa OS, modal com itens MP de `estoque_detalhes` (código material, descrição, qtd, custo unit, total, data, funcionário)
- **Custo Indireto** ou nova seção "Custo Direto na Competência" — recebe linhas CPV-Direto

---

### 2.5. Relatório "A Pagar x A Receber - Dt. Baixa" (NOVO IMPORT)

**Colunas (22):** COD_EMPRESA | CONTAS A PAGAR/RECEBER | COD PN | PARCEIRO DE NEGÓCIO | CNPJ | PREVISÃO | VALOR | VALOR_CORRIGIDO | VALOR_PAGO | **VL PLANO CONTAS** | PAGO | DT_ABERTURA | DT_PAGAMENTO | DT_VENCIMENTO | DOCUMENTO | HISTORICO | TP_DOC | COD_PLANO_CONTAS | NUMERO_PLANO_CONTAS | PLANO_CONTAS | NUMEROCONTA | CONTACORRENTE

**ATENÇÃO:** uma mesma transação pode aparecer em **VÁRIAS LINHAS** — uma por plano de contas. `VALOR` = total da transação; `VL PLANO CONTAS` = parte rateada daquela linha (quando soma todas as linhas com mesmo DOCUMENTO bate com VALOR).

**Tabela destino:** **`movimentos_caixa`** (NOVA — separada de `movimentos`)

| Coluna | Origem |
|---|---|
| `tipo` | CONTAS A PAGAR/RECEBER (PAGAR / RECEBER) |
| `parceiro` | PARCEIRO DE NEGÓCIO |
| `cnpj` | CNPJ |
| `valor_total` | VALOR |
| `valor_rateado` | VL PLANO CONTAS |
| `data_baixa` | DT_PAGAMENTO |
| `data_vencimento` | DT_VENCIMENTO |
| `documento` | DOCUMENTO |
| `historico` | HISTORICO |
| `tp_doc` | TP_DOC |
| `plano_contas_codigo` | NUMERO_PLANO_CONTAS |
| `plano_contas_descritivo` | PLANO_CONTAS |
| `conta_bancaria` | NUMEROCONTA + CONTACORRENTE |
| `pago` | PAGO (boolean) |
| `natureza` | (campo classificado depois pela Natália — null inicialmente) |
| `orcamento_vinculado` | (preenchido pela Natália na classificação) |
| `classificado_em` | timestamp da classificação |
| `classificado_por` | uid do user |

**Fluxo de importação em 2 passos:**

**Passo 1 — Parse e classificação automática**
Para cada linha onde `CONTAS A PAGAR/RECEBER = 'RECEBER'`:
- Se `NUMERO_PLANO_CONTAS` ∈ `['33.01.003.001.001', '33.01.003.001.007']` (a confirmar) → marca automaticamente `natureza = 'Resultado Financeiro'` (Rendimento)
- Caso contrário → entra na lista de "pendente de classificação"

Para linhas `PAGAR`: importa direto (não precisa classificar manualmente).

**Passo 2 — Tela de classificação manual**
Lista de linhas RECEBER pendentes. Para cada uma, Natália preenche:
- Natureza: dropdown (Recebimento / Adiantamento / Resultado Financeiro / Reembolso / outras)
- Orçamento vinculado: dropdown filtrado por nome do cliente (mostra só os orçamentos do PARCEIRO DE NEGÓCIO daquela linha)
- Confirma → grava na tabela

**Telas afetadas:**
- **"Contas a Receber"** (Financeiro) — refazer pra ler de `movimentos_caixa` filtrando RECEBER + status (recebido vs a receber). Mantém compatibilidade com `recebimentos_previstos` se houver dados antigos.
- **"Contas a Pagar"** (Financeiro) — refazer pra ler de `movimentos_caixa` filtrando PAGAR. A tabela `compromissos_financeiros` continua existindo pra compromissos futuros (não baixados ainda).
- **"Fluxo de Caixa Visão 12m"** — agora cruza com `movimentos_caixa` também (recebimentos efetivos + pagamentos efetivos)

---

## 3. Saldo a Reconhecer (calculado, não importado)

**View `vw_saldo_reconhecer`** (recalcula a cada consulta):

```
Para cada (orcamento, competência):
  valor_orcamento  = orcamentos.venda
  adiantamentos    = SUM(movimentos_caixa.valor_total)
                       WHERE tipo='RECEBER'
                       AND natureza='Adiantamento'
                       AND orcamento_vinculado=orcamento
                       AND mes_ref(data_baixa) <= competência
  nfs_emitidas     = SUM(notas_fiscais.valor_nf)
                       WHERE numero_orcamento=orcamento
                       AND mes_ref(emissao) <= competência
  valor_a_reconhecer = valor_orcamento - adiantamentos - nfs_emitidas
```

**Função `fn_snapshot_saldo_reconhecer(competencia DATE)`** — congela o estado atual da view na tabela `saldo_reconhecer` para fechamento mensal/auditoria contábil.

**Tela** — painel adicional dentro de "Receita por Faturamento" ou seção própria em Comercial. Tabela: orçamento | competência | venda | adiantamento | NFs emitidas | a reconhecer.

---

## 4. Dashboard de Gestão de Faturamento (tela nova)

**Localização:** Comercial > Gestão de Faturamento (refatorar tela atual)

**Colunas por orçamento (uma linha):**

| Coluna | Origem |
|---|---|
| Data | `orcamentos.data` |
| Orçamento | `orcamentos.orcamento` |
| Cliente | `orcamentos.nome` |
| Tipo Faturamento | `orcamentos.tipo_faturamento` (100_NF / 0_NF / PARCIAL X%) |
| Venda | `orcamentos.venda` |
| Adiantamento | SUM `movimentos_caixa` (RECEBER + Adiantamento + orcamento_vinculado) |
| Recebimento | SUM `movimentos_caixa` (RECEBER + Recebimento + orcamento_vinculado) |
| Resultado Financeiro | SUM `movimentos_caixa` (RECEBER + Resultado Financeiro + orcamento_vinculado) |
| A Receber | venda - adiantamento - recebimento - resultado_financeiro |
| Status Recebimento | derivado: "Liquidado" se A Receber = 0; "Em aberto" caso contrário |
| NF Emitida | SUM `notas_fiscais.valor_nf` WHERE numero_orcamento=orcamento |
| Venda S/ NF | venda * (1 - pct_com_nf/100) — computado a partir do tipo_faturamento |
| A Faturar | venda - venda_sem_nf - nf_emitida |
| Status Faturamento | "Liquidado" / "Em aberto" |
| Saldo Adto Em Aberto | adiantamento - nf_emitida |
| Custo total | SUM `estoque_detalhes.custo_total` (DRE='CPV-MP', vinculado às OSs do orçamento) |

**Drill-downs:**
- Clicar no orçamento → modal com itens (de `orcamento_items`)
- Clicar em Adiantamento/Recebimento → modal com lançamentos de `movimentos_caixa`
- Clicar em NF Emitida → modal com NFs de `notas_fiscais`
- Clicar em Custo total → modal com itens de `estoque_detalhes`

---

## 5. Migração SQL (Supabase) — M18

### 5.1. Alterações em tabelas existentes
```sql
-- orçamentos: adicionar tipo de faturamento e versão
ALTER TABLE orcamentos
  ADD COLUMN tipo_faturamento TEXT CHECK (tipo_faturamento IN ('100_NF','0_NF','PARCIAL')),
  ADD COLUMN pct_com_nf NUMERIC(5,2) CHECK (pct_com_nf >= 0 AND pct_com_nf <= 100),
  ADD COLUMN versao TEXT;
```

### 5.2. Tabelas novas

```sql
-- Itens de orçamento (do Dashboard de Orçamentos)
CREATE TABLE orcamento_items (
  id SERIAL PRIMARY KEY,
  orcamento TEXT NOT NULL,
  item TEXT,
  familia TEXT,
  grupo TEXT,
  cod_interno TEXT,
  qtd_vendida NUMERIC(12,5),
  qtd_reservada NUMERIC(12,5),
  qtd_faturada NUMERIC(12,5),
  qtd_a_faturar NUMERIC(12,5),
  vl_unitario NUMERIC(14,2),
  vl_total NUMERIC(14,2),
  vl_a_faturar NUMERIC(14,2),
  lucro_previsto NUMERIC(14,2),
  lucro_realizado NUMERIC(14,2),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Custos planejados por OS (4 dimensões: materiais, horas, terceiros, outros)
CREATE TABLE os_custos_planejados (
  id SERIAL PRIMARY KEY,
  os TEXT NOT NULL,
  total_previsto NUMERIC(14,2),
  total_realizado NUMERIC(14,2),
  materiais_previstos NUMERIC(14,2),
  materiais_realizados NUMERIC(14,2),
  comprados_nao_entregues NUMERIC(14,2),
  reservado_nao_utilizado NUMERIC(14,2),
  horas_previstas NUMERIC(14,2),
  horas_realizadas NUMERIC(14,2),
  st_previstos NUMERIC(14,2),
  st_realizados NUMERIC(14,2),
  outros_previstos NUMERIC(14,2),
  outros_realizados NUMERIC(14,2),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Movimentações financeiras (do A Pagar x A Receber)
CREATE TABLE movimentos_caixa (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('PAGAR','RECEBER')),
  parceiro TEXT,
  cnpj TEXT,
  valor_total NUMERIC(14,2),
  valor_rateado NUMERIC(14,2),
  data_baixa DATE,
  data_vencimento DATE,
  documento TEXT,
  historico TEXT,
  tp_doc TEXT,
  plano_contas_codigo TEXT,
  plano_contas_descritivo TEXT,
  conta_bancaria TEXT,
  pago BOOLEAN DEFAULT false,
  -- classificação manual:
  natureza TEXT,  -- referência aos valores da sheet "Lista" (Adiantamento, Recebimento, etc.)
  orcamento_vinculado TEXT,
  classificado_em TIMESTAMPTZ,
  classificado_por UUID REFERENCES auth.users(id),
  -- import:
  importacao_id INTEGER,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Custo direto na competência (CPV-Direto, sem OS)
CREATE TABLE custo_direto_competencia (
  id SERIAL PRIMARY KEY,
  mes_ref DATE NOT NULL,
  valor NUMERIC(14,2),
  plano_contas_codigo TEXT,
  plano_contas_descritivo TEXT,
  descricao TEXT,
  funcionario TEXT,
  importacao_id INTEGER,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Catálogos de validação (sheet "Lista" do Excel)
CREATE TABLE lista_naturezas (
  id SERIAL PRIMARY KEY,
  nome TEXT UNIQUE NOT NULL,
  ordem INTEGER,
  ativo BOOLEAN DEFAULT true
);
INSERT INTO lista_naturezas (nome, ordem) VALUES
  ('Adiantamento',1),('Assistência Técnica',2),('Entrega Futura',3),
  ('Entrega S/ NF',4),('Nota Fiscal',5),('Outras Receitas',6),
  ('Recebimento',7),('Reembolso',8),('Resultado Financeiro',9),
  ('Venda',10),('Venda S/ NF',11);

CREATE TABLE lista_tipos_produto (
  id SERIAL PRIMARY KEY,
  nome TEXT UNIQUE NOT NULL,
  ativo BOOLEAN DEFAULT true
);
INSERT INTO lista_tipos_produto (nome) VALUES
  ('Mobília Fixa'),('Mobília Solta'),('Reembolso'),
  ('Assistência Técnica'),('Outras Receitas');
```

### 5.3. View — Saldo a Reconhecer

```sql
CREATE OR REPLACE VIEW vw_saldo_reconhecer AS
SELECT
  o.orcamento,
  date_trunc('month', m.data_baixa)::date AS competencia,
  o.venda AS valor,
  COALESCE(SUM(CASE WHEN m.natureza = 'Adiantamento' THEN m.valor_total ELSE 0 END), 0) AS adiantamento,
  COALESCE(SUM(nf.valor_nf), 0) AS nf_emitidas,
  o.venda
    - COALESCE(SUM(CASE WHEN m.natureza = 'Adiantamento' THEN m.valor_total ELSE 0 END), 0)
    - COALESCE(SUM(nf.valor_nf), 0) AS valor_a_reconhecer
FROM orcamentos o
LEFT JOIN movimentos_caixa m
  ON m.orcamento_vinculado = o.orcamento
LEFT JOIN notas_fiscais nf
  ON nf.numero_orcamento = o.orcamento
GROUP BY o.orcamento, date_trunc('month', m.data_baixa), o.venda;
```

### 5.4. Função snapshot mensal

```sql
CREATE OR REPLACE FUNCTION fn_snapshot_saldo_reconhecer(p_competencia DATE)
RETURNS INTEGER AS $$
DECLARE n INTEGER;
BEGIN
  DELETE FROM saldo_reconhecer WHERE competencia = p_competencia;
  INSERT INTO saldo_reconhecer (orcamento, competencia, data, nota_fiscal, valor, adiantamento, nf_emitidas, valor_a_reconhecer)
  SELECT orcamento, competencia, p_competencia, NULL, valor, adiantamento, nf_emitidas, valor_a_reconhecer
  FROM vw_saldo_reconhecer
  WHERE competencia = p_competencia;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$ LANGUAGE plpgsql;
```

### 5.5. RLS policies
Todas as tabelas novas seguem o padrão da M17: SELECT livre para `auth.uid()` em perfis ativos; INSERT/UPDATE/DELETE só para quem `auth_pode_modificar()`.

---

## 6. Frontend — telas afetadas

| Tela | Mudança |
|---|---|
| **Importar (rodapé)** | Adicionar 2 templates novos (Dashboard de Orçamentos, A Pagar x A Receber). Refatorar 2 (Saída de Estoque com novo destino, Notas Fiscais com fluxo de vínculo) |
| **Vendas** | Mostrar coluna "Tipo Faturamento" e "Venda S/NF" |
| **Gestão de Faturamento** | Refatorar para o novo Dashboard (seção 4 deste SPEC) |
| **Notas Fiscais** | Refazer para ler de `notas_fiscais` (rica) + drill-down NF↔OS |
| **Dashboard de Orçamentos (NOVA)** | Tela com lista de orçamentos + drill-down de itens, OSs, custos previstos vs realizados |
| **Contas a Receber** | Refazer pra ler de `movimentos_caixa` (filtro RECEBER) |
| **Contas a Pagar** | Refazer pra ler de `movimentos_caixa` (filtro PAGAR) + manter `compromissos_financeiros` para futuros |
| **Saldo a Reconhecer (NOVA)** | Painel/tela em Receita por Faturamento usando `vw_saldo_reconhecer` |
| **Custo por OS / Custo Direto Via OS** | Drill-down: clicar numa OS abre modal com itens MP de `estoque_detalhes` |
| **Custo Indireto** ou nova "Custo Direto na Competência" | Recebe linhas de `custo_direto_competencia` (CPV - Direto) |

---

## 7. Plano de execução (ordem sugerida)

### Onda 1 — Backend completo
1. Migração 18 SQL (todas as tabelas + view + função + RLS + listas)
2. Validar com inserts manuais simples (smoke test)

### Onda 2 — Importações novas e refactors
3. Refac template "Saída de Estoque" para popular as 4 destinos (estoque_detalhes, estoque_resumo, os_evolucao_mensal, custo_direto_competencia)
4. Template novo "Dashboard de Orçamentos" → orcamento_items + os_custos_planejados + ordens_servico
5. Template novo "A Pagar x A Receber" com fluxo 2-passos + bulk action no modal de classificação
6. Refac template "Notas Fiscais" com fluxo 2-passos (parse + revisão de vínculo NF↔OS)
7. Refac template "Orçamentos" com pergunta de tipo_faturamento
8. Template novo "Histórico Mov Financeiro" (carrega aba do Excel da bíblia → tabela movimentos)
9. Template novo "Histórico Saldo a Reconhecer" (carrega aba do Excel da bíblia → tabela saldo_reconhecer)

### Onda 3 — Telas
8. Refac tela "Notas Fiscais" (Comercial)
9. Tela nova "Dashboard de Orçamentos" (Comercial)
10. Refac tela "Gestão de Faturamento" → novo Dashboard
11. Refac telas "Contas a Receber" e "Contas a Pagar"
12. Tela nova "Saldo a Reconhecer" (Receita > Por Faturamento)
13. Drill-down "Custo por OS" → modal de itens MP

### Onda 4 — Polimento
14. Auditoria pós-M18 (atualizar AUDITORIA_TELAS.md)
15. Atualizar DADOS_TESTE.md e ROTEIRO_TESTE.md com as novas importações
16. Documentar no GitHub (docs/)

---

## 8. Pendências resolvidas nesta spec

| # | Pergunta | Resposta |
|---|---|---|
| 1 | Tipo de faturamento — quando capturar? | Na importação do orçamento, modal por linha |
| 2 | "Movimentações base caixa" = ? | Relatório A Pagar x A Receber - Dt. Baixa |
| 3 | Grupo 2 do plano = ? | Era erro — é Grupo 1 (Ativo Estoque), conceitualmente = filtro DRE='CPV-Matéria Prima' |
| 4 | DRE filtro Saída Estoque | "CPV - Matéria Prima" → vai pra OS; "CPV - Direto" → vai pra custo_direto_competencia |
| 5 | Vínculo NF↔OS | Híbrido: sistema propõe (do Dashboard de Orçamentos), Natália confirma |
| 6 | Onde vão lançamentos do A Pagar x A Receber? | Tabela nova `movimentos_caixa` (separada de movimentos) |
| 7 | Adiantamento vincula a OS? | Não, só a orçamento |
| 8 | Dashboard de Orçamentos = planilha externa? | NÃO — vira módulo nativo (pode ter import inicial pra histórico) |
| 9 | Telas Contas a Receber/Pagar atuais | Refatorar pra usar movimentos_caixa |

---

## 9. Decisões finais (confirmadas pela Juliana em 2026-05-07)

1. **Contas isentas (Resultado Financeiro automático):** `33.01.003.001.001` e `33.01.003.001.007` ✅
2. **Histórico do Excel:** importar TUDO. Vão ser 2 templates novos pra trazer o histórico:
   - **`historico_mov_financeiro`** → tabela `movimentos` (que já existe — colunas batem: data, orcamento, nome, tipo, natureza, valor, nota_fiscal, os, item, custo, comentários)
   - **`historico_saldo_reconhecer`** → tabela `saldo_reconhecer` (que já existe — colunas: orcamento, comp., data, nota_fiscal, valor, adiantamento, nf_emitidas, valor_a_reconhecer)
3. **Orçamentos antigos:** `tipo_faturamento = '100_NF'` por padrão na M18 (UPDATE em massa no momento da migração) ✅
4. **Bulk action no modal de classificação:** SIM desde o início. Modal terá:
   - Lista de linhas pendentes com checkbox por linha + checkbox "selecionar todas"
   - Topo do modal: dropdowns "Natureza" + "Orçamento" + botão "Aplicar nas selecionadas"
   - Botão "Aplicar individual" continua disponível pra casos linha-a-linha

---

## 10. Estimativa de esforço

- Migração SQL: 2-3h (escrever + revisar + aplicar)
- Refactor de 2 templates de import + 5 templates novos (incluindo histórico): 8-10h
- Refactor + criação de 6-7 telas: 10-15h
- Testes com dados reais: 4-6h
- **Total estimado:** ~28-34h de trabalho contínuo

Por isso a recomendação de fazer em ondas (cada onda fechada e testada antes da próxima).

---

## 11. Fora do escopo desta M18 — registrado pra M19+

Itens que apareceram nas conversas mas pertencem a outras migrações futuras:

### M19 — Bônus Individual (cálculo profissional)
- **Fonte de Frequência Mensal:** Folha de Ponto em PDF (decisão da Juliana 2026-05-07: NÃO alimentar Excel intermediário; sistema processa o PDF direto). Sistema aceita upload de PDF, parseia com biblioteca (pdf.js no front ou Edge Function no Supabase), extrai do cabeçalho (CPF do funcionário, período) e da linha "Total" (Trabalhadas, Abono, Atraso, Extras, Faltas, Dias Faltosos) → popula `frequencia_mensal`.
- **Pendente verificar com Natália:** o sistema de ponto gera 1 PDF por funcionário ou 1 PDF consolidado? Define se a tela de upload aceita drag-and-drop múltiplo ou um arquivo só.
- **Excel `Indicadores RH - 2025.xlsx`** continua existindo (espelho histórico) mas NÃO é fonte de import. Fica como referência.
- Faltam definir: fontes de `medidas_disciplinares` e `avaliacao_desempenho`.
