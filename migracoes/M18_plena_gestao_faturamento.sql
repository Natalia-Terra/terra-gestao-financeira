-- ============================================================================
-- MIGRAÇÃO 18 — Plena Gestão de Faturamento
-- ============================================================================
-- Spec: SPEC_FATURAMENTO.md (revisado em 2026-05-07)
-- Aplicar em: projeto Terra-Gestão-Financeira (zvvdpdldjmzuzieinxwa)
-- Estratégia: idempotente (IF NOT EXISTS) — pode rodar 2x sem quebrar
--
-- Ordem das mudanças:
--   1) ALTERs em orcamentos (tipo_faturamento, pct_com_nf, versao)
--   2) Tabelas novas:
--        - orcamento_items
--        - os_custos_planejados
--        - movimentos_caixa
--        - custo_direto_competencia
--        - lista_naturezas (catálogo + seed)
--        - lista_tipos_produto (catálogo + seed)
--   3) View vw_saldo_reconhecer
--   4) Função fn_snapshot_saldo_reconhecer(date)
--   5) UPDATE em massa: orçamentos antigos → tipo_faturamento='100_NF'
--   6) RLS policies (padrão M17: auth_pode_modificar)
--   7) Triggers de auditoria (fn_auditar) e touch (atualizado_em)
-- ============================================================================


-- ============================================================================
-- 1) ALTERs em orcamentos
-- ============================================================================

ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS tipo_faturamento TEXT
    CHECK (tipo_faturamento IN ('100_NF','0_NF','PARCIAL'));

ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS pct_com_nf NUMERIC(5,2)
    CHECK (pct_com_nf >= 0 AND pct_com_nf <= 100);

ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS versao TEXT;

COMMENT ON COLUMN orcamentos.tipo_faturamento IS
  '100_NF = totalmente com nota fiscal; 0_NF = sem nota fiscal; PARCIAL = parte com NF (vide pct_com_nf)';
COMMENT ON COLUMN orcamentos.pct_com_nf IS
  'Percentual com nota fiscal (0-100). Só faz sentido quando tipo_faturamento=PARCIAL';
COMMENT ON COLUMN orcamentos.versao IS
  'Versão do orçamento conforme planilha "Orçamento Aprovado por Parceiro" (ex: A, B, C)';


-- ============================================================================
-- 2) Tabelas novas
-- ============================================================================

-- 2.1) orcamento_items — itens detalhados de cada orçamento (do Dashboard de Orçamentos)
CREATE TABLE IF NOT EXISTS orcamento_items (
  id                     SERIAL PRIMARY KEY,
  orcamento              TEXT NOT NULL,
  item                   TEXT,
  familia                TEXT,
  grupo                  TEXT,
  cod_interno            TEXT,
  qtd_vendida            NUMERIC(12,5),
  qtd_reservada          NUMERIC(12,5),
  qtd_faturada           NUMERIC(12,5),
  qtd_a_faturar          NUMERIC(12,5),
  qtd_disponivel         NUMERIC(12,5),
  vl_unitario            NUMERIC(14,2),
  vl_total               NUMERIC(14,2),
  vl_a_faturar           NUMERIC(14,2),
  vl_disponivel_faturar  NUMERIC(14,2),
  representante          TEXT,
  vl_total_comissao      NUMERIC(14,2),
  num_pedido             TEXT,
  notas_fiscais          TEXT,    -- lista de NFs (ex: "2491,2495") como string
  lucro_previsto         NUMERIC(14,2),
  lucro_realizado        NUMERIC(14,2),
  saldo_lucro            NUMERIC(14,2),
  importacao_id          INTEGER,
  criado_em              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orcamento_items_orcamento ON orcamento_items(orcamento);
CREATE INDEX IF NOT EXISTS idx_orcamento_items_cod_interno ON orcamento_items(cod_interno);


-- 2.2) os_custos_planejados — previsto vs realizado por OS (4 dimensões)
CREATE TABLE IF NOT EXISTS os_custos_planejados (
  id                          SERIAL PRIMARY KEY,
  os                          TEXT NOT NULL UNIQUE,
  total_previsto              NUMERIC(14,2),
  total_realizado             NUMERIC(14,2),
  saldo_total                 NUMERIC(14,2),
  servicos_para_realizado     TEXT,
  -- Materiais
  materiais_previstos         NUMERIC(14,2),
  materiais_realizados        NUMERIC(14,2),
  saldo_materiais             NUMERIC(14,2),
  comprados_nao_entregues     NUMERIC(14,2),
  reservado_nao_utilizado     NUMERIC(14,2),
  -- Horas
  horas_previstas             NUMERIC(14,2),
  horas_realizadas            NUMERIC(14,2),
  saldo_horas                 NUMERIC(14,2),
  -- Serviços de terceiros
  st_previstos                NUMERIC(14,2),
  st_realizados               NUMERIC(14,2),
  saldo_st                    NUMERIC(14,2),
  -- Outros
  outros_previstos            NUMERIC(14,2),
  outros_realizados           NUMERIC(14,2),
  saldo_outros                NUMERIC(14,2),
  importacao_id               INTEGER,
  criado_em                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 2.3) movimentos_caixa — Importação do A Pagar x A Receber (com classificação manual)
CREATE TABLE IF NOT EXISTS movimentos_caixa (
  id                       SERIAL PRIMARY KEY,
  -- Identificação
  tipo                     TEXT NOT NULL CHECK (tipo IN ('PAGAR','RECEBER')),
  cod_pn                   TEXT,
  parceiro                 TEXT,
  cnpj                     TEXT,
  -- Valores
  valor_total              NUMERIC(14,2),
  valor_corrigido          NUMERIC(14,2),
  valor_pago               NUMERIC(14,2),
  valor_rateado            NUMERIC(14,2),  -- VL PLANO CONTAS (parcial deste plano)
  -- Datas
  previsao                 TEXT,           -- coluna PREVISÃO do relatório (NÃO/SIM)
  pago                     BOOLEAN DEFAULT false,
  data_abertura            DATE,
  data_pagamento           DATE,           -- DT_BAIXA
  data_vencimento          DATE,
  -- Documento
  documento                TEXT,
  historico                TEXT,
  tp_doc                   TEXT,
  -- Plano de contas
  cod_plano_contas         TEXT,
  numero_plano_contas      TEXT,           -- ex: "44.01.001.002.004"
  plano_contas_descritivo  TEXT,
  -- Conta bancária
  numero_conta             TEXT,
  conta_corrente           TEXT,
  -- Classificação manual (preenchido após import)
  natureza                 TEXT,           -- referência a lista_naturezas.nome
  orcamento_vinculado      TEXT,           -- referência a orcamentos.orcamento
  classificado_em          TIMESTAMPTZ,
  classificado_por         UUID REFERENCES auth.users(id),
  -- Importação
  importacao_id            INTEGER,
  criado_em                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movimentos_caixa_tipo ON movimentos_caixa(tipo);
CREATE INDEX IF NOT EXISTS idx_movimentos_caixa_data_pagamento ON movimentos_caixa(data_pagamento);
CREATE INDEX IF NOT EXISTS idx_movimentos_caixa_orcamento ON movimentos_caixa(orcamento_vinculado);
CREATE INDEX IF NOT EXISTS idx_movimentos_caixa_natureza ON movimentos_caixa(natureza);
CREATE INDEX IF NOT EXISTS idx_movimentos_caixa_documento ON movimentos_caixa(documento);
CREATE INDEX IF NOT EXISTS idx_movimentos_caixa_pendentes
  ON movimentos_caixa(tipo, natureza)
  WHERE tipo = 'RECEBER' AND natureza IS NULL;


-- 2.4) custo_direto_competencia — CPV-Direto (sem OS, por competência)
CREATE TABLE IF NOT EXISTS custo_direto_competencia (
  id                       SERIAL PRIMARY KEY,
  mes_ref                  DATE NOT NULL,
  data_saida               DATE,
  valor                    NUMERIC(14,2) NOT NULL DEFAULT 0,
  numero_plano_contas      TEXT,
  plano_contas_descritivo  TEXT,
  descricao_material       TEXT,
  codigo_material          TEXT,
  funcionario              TEXT,
  importacao_id            INTEGER,
  criado_em                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custo_direto_mes_ref ON custo_direto_competencia(mes_ref);


-- 2.5) lista_naturezas — catálogo (sheet "Lista" do Excel)
CREATE TABLE IF NOT EXISTS lista_naturezas (
  id     SERIAL PRIMARY KEY,
  nome   TEXT UNIQUE NOT NULL,
  ordem  INTEGER,
  ativo  BOOLEAN DEFAULT true
);

INSERT INTO lista_naturezas (nome, ordem) VALUES
  ('Adiantamento',         1),
  ('Assistência Técnica',  2),
  ('Entrega Futura',       3),
  ('Entrega S/ NF',        4),
  ('Nota Fiscal',          5),
  ('Outras Receitas',      6),
  ('Recebimento',          7),
  ('Reembolso',            8),
  ('Resultado Financeiro', 9),
  ('Venda',                10),
  ('Venda S/ NF',          11)
ON CONFLICT (nome) DO NOTHING;


-- 2.6) lista_tipos_produto — catálogo
CREATE TABLE IF NOT EXISTS lista_tipos_produto (
  id     SERIAL PRIMARY KEY,
  nome   TEXT UNIQUE NOT NULL,
  ativo  BOOLEAN DEFAULT true
);

INSERT INTO lista_tipos_produto (nome) VALUES
  ('Mobília Fixa'),
  ('Mobília Solta'),
  ('Reembolso'),
  ('Assistência Técnica'),
  ('Outras Receitas')
ON CONFLICT (nome) DO NOTHING;


-- ============================================================================
-- 3) View vw_saldo_reconhecer
-- ============================================================================
-- Recalcula em tempo real: para cada (orçamento, competência),
-- valor_a_reconhecer = venda - sum(adiantamentos) - sum(NFs emitidas)

CREATE OR REPLACE VIEW vw_saldo_reconhecer AS
WITH adiantamentos AS (
  SELECT
    orcamento_vinculado AS orcamento,
    DATE_TRUNC('month', data_pagamento)::date AS competencia,
    SUM(valor_total) AS total
  FROM movimentos_caixa
  WHERE tipo = 'RECEBER'
    AND natureza = 'Adiantamento'
    AND orcamento_vinculado IS NOT NULL
  GROUP BY orcamento_vinculado, DATE_TRUNC('month', data_pagamento)
),
nfs AS (
  SELECT
    numero_orcamento AS orcamento,
    DATE_TRUNC('month', emissao)::date AS competencia,
    SUM(valor_nf) AS total
  FROM notas_fiscais
  WHERE numero_orcamento IS NOT NULL
  GROUP BY numero_orcamento, DATE_TRUNC('month', emissao)
)
SELECT
  o.orcamento,
  COALESCE(a.competencia, n.competencia) AS competencia,
  o.venda AS valor_orcamento,
  COALESCE(a.total, 0) AS adiantamento,
  COALESCE(n.total, 0) AS nf_emitidas,
  o.venda - COALESCE(a.total, 0) - COALESCE(n.total, 0) AS valor_a_reconhecer
FROM orcamentos o
LEFT JOIN adiantamentos a ON a.orcamento = o.orcamento
LEFT JOIN nfs n
       ON n.orcamento = o.orcamento
      AND (a.competencia IS NULL OR n.competencia = a.competencia)
WHERE o.orcamento IS NOT NULL;

COMMENT ON VIEW vw_saldo_reconhecer IS
  'Saldo a reconhecer recalculado em tempo real. Para snapshot mensal use fn_snapshot_saldo_reconhecer(competencia).';


-- ============================================================================
-- 4) Função snapshot mensal
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_snapshot_saldo_reconhecer(p_competencia DATE)
RETURNS INTEGER AS $$
DECLARE
  n INTEGER;
BEGIN
  -- Apaga snapshot anterior dessa competência
  DELETE FROM saldo_reconhecer WHERE competencia = p_competencia;

  -- Insere snapshot atual
  INSERT INTO saldo_reconhecer
    (orcamento, competencia, data, nota_fiscal, valor, adiantamento, nf_emitidas, valor_a_reconhecer)
  SELECT
    orcamento,
    competencia,
    p_competencia,
    NULL,
    valor_orcamento,
    adiantamento,
    nf_emitidas,
    valor_a_reconhecer
  FROM vw_saldo_reconhecer
  WHERE competencia = p_competencia;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$
LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_snapshot_saldo_reconhecer(DATE) IS
  'Congela o saldo a reconhecer numa competência específica. Use para fechamento mensal/auditoria contábil.';


-- ============================================================================
-- 5) UPDATE em massa: orçamentos antigos → tipo_faturamento='100_NF'
-- ============================================================================

UPDATE orcamentos
SET tipo_faturamento = '100_NF',
    pct_com_nf = 100
WHERE tipo_faturamento IS NULL;


-- ============================================================================
-- 6) RLS — habilitar e criar policies (padrão M17: auth_pode_modificar)
-- ============================================================================

-- 6.1) orcamento_items
ALTER TABLE orcamento_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select orcamento_items" ON orcamento_items;
DROP POLICY IF EXISTS "modify orcamento_items" ON orcamento_items;
CREATE POLICY "select orcamento_items" ON orcamento_items
  FOR SELECT USING (true);
CREATE POLICY "modify orcamento_items" ON orcamento_items
  FOR ALL USING (auth_pode_modificar()) WITH CHECK (auth_pode_modificar());

-- 6.2) os_custos_planejados
ALTER TABLE os_custos_planejados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select os_custos_planejados" ON os_custos_planejados;
DROP POLICY IF EXISTS "modify os_custos_planejados" ON os_custos_planejados;
CREATE POLICY "select os_custos_planejados" ON os_custos_planejados
  FOR SELECT USING (true);
CREATE POLICY "modify os_custos_planejados" ON os_custos_planejados
  FOR ALL USING (auth_pode_modificar()) WITH CHECK (auth_pode_modificar());

-- 6.3) movimentos_caixa
ALTER TABLE movimentos_caixa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select movimentos_caixa" ON movimentos_caixa;
DROP POLICY IF EXISTS "modify movimentos_caixa" ON movimentos_caixa;
CREATE POLICY "select movimentos_caixa" ON movimentos_caixa
  FOR SELECT USING (true);
CREATE POLICY "modify movimentos_caixa" ON movimentos_caixa
  FOR ALL USING (auth_pode_modificar()) WITH CHECK (auth_pode_modificar());

-- 6.4) custo_direto_competencia
ALTER TABLE custo_direto_competencia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select custo_direto_competencia" ON custo_direto_competencia;
DROP POLICY IF EXISTS "modify custo_direto_competencia" ON custo_direto_competencia;
CREATE POLICY "select custo_direto_competencia" ON custo_direto_competencia
  FOR SELECT USING (true);
CREATE POLICY "modify custo_direto_competencia" ON custo_direto_competencia
  FOR ALL USING (auth_pode_modificar()) WITH CHECK (auth_pode_modificar());

-- 6.5) lista_naturezas
ALTER TABLE lista_naturezas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select lista_naturezas" ON lista_naturezas;
DROP POLICY IF EXISTS "modify lista_naturezas" ON lista_naturezas;
CREATE POLICY "select lista_naturezas" ON lista_naturezas
  FOR SELECT USING (true);
CREATE POLICY "modify lista_naturezas" ON lista_naturezas
  FOR ALL USING (auth_pode_modificar()) WITH CHECK (auth_pode_modificar());

-- 6.6) lista_tipos_produto
ALTER TABLE lista_tipos_produto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select lista_tipos_produto" ON lista_tipos_produto;
DROP POLICY IF EXISTS "modify lista_tipos_produto" ON lista_tipos_produto;
CREATE POLICY "select lista_tipos_produto" ON lista_tipos_produto
  FOR SELECT USING (true);
CREATE POLICY "modify lista_tipos_produto" ON lista_tipos_produto
  FOR ALL USING (auth_pode_modificar()) WITH CHECK (auth_pode_modificar());


-- ============================================================================
-- 7) Triggers de auditoria e touch
-- ============================================================================

-- Trigger touch (atualiza atualizado_em em UPDATE)
DROP TRIGGER IF EXISTS trg_touch_orcamento_items ON orcamento_items;
CREATE TRIGGER trg_touch_orcamento_items
  BEFORE UPDATE ON orcamento_items
  FOR EACH ROW EXECUTE FUNCTION fn_touch_atualizado_em();

DROP TRIGGER IF EXISTS trg_touch_os_custos_planejados ON os_custos_planejados;
CREATE TRIGGER trg_touch_os_custos_planejados
  BEFORE UPDATE ON os_custos_planejados
  FOR EACH ROW EXECUTE FUNCTION fn_touch_atualizado_em();

DROP TRIGGER IF EXISTS trg_touch_movimentos_caixa ON movimentos_caixa;
CREATE TRIGGER trg_touch_movimentos_caixa
  BEFORE UPDATE ON movimentos_caixa
  FOR EACH ROW EXECUTE FUNCTION fn_touch_atualizado_em();

-- Trigger auditoria
DROP TRIGGER IF EXISTS trg_aud_orcamento_items ON orcamento_items;
CREATE TRIGGER trg_aud_orcamento_items
  AFTER INSERT OR UPDATE OR DELETE ON orcamento_items
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();

DROP TRIGGER IF EXISTS trg_aud_os_custos_planejados ON os_custos_planejados;
CREATE TRIGGER trg_aud_os_custos_planejados
  AFTER INSERT OR UPDATE OR DELETE ON os_custos_planejados
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();

DROP TRIGGER IF EXISTS trg_aud_movimentos_caixa ON movimentos_caixa;
CREATE TRIGGER trg_aud_movimentos_caixa
  AFTER INSERT OR UPDATE OR DELETE ON movimentos_caixa
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();

DROP TRIGGER IF EXISTS trg_aud_custo_direto_competencia ON custo_direto_competencia;
CREATE TRIGGER trg_aud_custo_direto_competencia
  AFTER INSERT OR UPDATE OR DELETE ON custo_direto_competencia
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();

DROP TRIGGER IF EXISTS trg_aud_lista_naturezas ON lista_naturezas;
CREATE TRIGGER trg_aud_lista_naturezas
  AFTER INSERT OR UPDATE OR DELETE ON lista_naturezas
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();

DROP TRIGGER IF EXISTS trg_aud_lista_tipos_produto ON lista_tipos_produto;
CREATE TRIGGER trg_aud_lista_tipos_produto
  AFTER INSERT OR UPDATE OR DELETE ON lista_tipos_produto
  FOR EACH ROW EXECUTE FUNCTION fn_auditar();


-- ============================================================================
-- VALIDAÇÃO PÓS-MIGRAÇÃO (rodar separadamente para confirmar)
-- ============================================================================
/*
-- Confere se as colunas novas em orçamentos existem
SELECT column_name FROM information_schema.columns
WHERE table_name = 'orcamentos'
  AND column_name IN ('tipo_faturamento','pct_com_nf','versao');

-- Confere se as 6 tabelas novas existem
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('orcamento_items','os_custos_planejados','movimentos_caixa',
                    'custo_direto_competencia','lista_naturezas','lista_tipos_produto');

-- Confere quantos orçamentos foram default-marcados como 100_NF
SELECT tipo_faturamento, COUNT(*) FROM orcamentos GROUP BY tipo_faturamento;

-- Confere catálogos seed
SELECT * FROM lista_naturezas ORDER BY ordem;
SELECT * FROM lista_tipos_produto ORDER BY id;

-- Testa view (deve retornar linhas se houver orçamentos)
SELECT * FROM vw_saldo_reconhecer LIMIT 5;
*/
