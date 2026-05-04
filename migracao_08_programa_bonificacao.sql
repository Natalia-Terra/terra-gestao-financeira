-- =====================================================================
-- Migração 08 — Programa de Bonificação (Entrega 6)
-- Data: 2026-05-04
-- 9 tabelas: períodos, metas-empresa, metas-área (mensais), medidas
-- disciplinares, frequência mensal, avaliações, compromissos financeiros,
-- saldo de caixa.
-- =====================================================================

-- 1) Períodos do programa (semestres)
CREATE TABLE IF NOT EXISTS public.bonif_periodos (
  id          SERIAL PRIMARY KEY,
  nome        TEXT UNIQUE NOT NULL,
  inicio_em   DATE NOT NULL,
  fim_em      DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','encerrado')),
  criado_em   TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.bonif_periodos ENABLE ROW LEVEL SECURITY;

-- 2) Metas-empresa por período (4 chaves fixas)
CREATE TABLE IF NOT EXISTS public.bonif_metas_empresa (
  id          SERIAL PRIMARY KEY,
  periodo_id  INTEGER NOT NULL REFERENCES public.bonif_periodos(id) ON DELETE CASCADE,
  meta_chave  TEXT NOT NULL CHECK (meta_chave IN ('faturamento_bruto','margem_liquida','caixa_positivo','icc_6m')),
  valor_meta  NUMERIC NOT NULL,
  unidade     TEXT NOT NULL DEFAULT 'BRL' CHECK (unidade IN ('BRL','pct','bool')),
  peso_pct    NUMERIC NOT NULL,
  ativa       BOOLEAN NOT NULL DEFAULT true,
  criado_em   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (periodo_id, meta_chave)
);
ALTER TABLE public.bonif_metas_empresa ENABLE ROW LEVEL SECURITY;

-- 3) Metas-área por período
CREATE TABLE IF NOT EXISTS public.bonif_metas_area (
  id              SERIAL PRIMARY KEY,
  periodo_id      INTEGER NOT NULL REFERENCES public.bonif_periodos(id) ON DELETE CASCADE,
  organograma_id  INTEGER NOT NULL REFERENCES public.organograma(id) ON DELETE CASCADE,
  descricao       TEXT NOT NULL,
  indicador_descritivo TEXT,
  peso_pct        NUMERIC NOT NULL DEFAULT 30,
  criado_em       TIMESTAMPTZ DEFAULT now(),
  atualizado_em   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.bonif_metas_area ENABLE ROW LEVEL SECURITY;

-- 4) Apuração mensal das metas-área
CREATE TABLE IF NOT EXISTS public.bonif_meta_area_mes (
  id          SERIAL PRIMARY KEY,
  meta_id     INTEGER NOT NULL REFERENCES public.bonif_metas_area(id) ON DELETE CASCADE,
  mes_ref     TEXT NOT NULL,
  atingiu     BOOLEAN NOT NULL DEFAULT false,
  valor_indicador NUMERIC,
  observacoes TEXT,
  criado_em   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (meta_id, mes_ref)
);
ALTER TABLE public.bonif_meta_area_mes ENABLE ROW LEVEL SECURITY;

-- 5) Medidas disciplinares
CREATE TABLE IF NOT EXISTS public.medidas_disciplinares (
  id              SERIAL PRIMARY KEY,
  funcionario_id  INTEGER NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  data            DATE NOT NULL,
  tipo            TEXT,
  descricao       TEXT,
  criado_em       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.medidas_disciplinares ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS medidas_disc_func_idx ON public.medidas_disciplinares (funcionario_id);
CREATE INDEX IF NOT EXISTS medidas_disc_data_idx ON public.medidas_disciplinares (data);

-- 6) Frequência mensal
CREATE TABLE IF NOT EXISTS public.frequencia_mensal (
  id              SERIAL PRIMARY KEY,
  funcionario_id  INTEGER NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  mes_ref         TEXT NOT NULL,
  faltas_justificadas      INTEGER NOT NULL DEFAULT 0,
  faltas_nao_justificadas  INTEGER NOT NULL DEFAULT 0,
  atrasos_ate_30min        INTEGER NOT NULL DEFAULT 0,
  atrasos_acima_30min      INTEGER NOT NULL DEFAULT 0,
  observacoes     TEXT,
  criado_em       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (funcionario_id, mes_ref)
);
ALTER TABLE public.frequencia_mensal ENABLE ROW LEVEL SECURITY;

-- 7) Avaliação de desempenho semestral
CREATE TABLE IF NOT EXISTS public.avaliacao_desempenho (
  id              SERIAL PRIMARY KEY,
  funcionario_id  INTEGER NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  periodo_id      INTEGER NOT NULL REFERENCES public.bonif_periodos(id) ON DELETE CASCADE,
  nota            INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
  observacoes     TEXT,
  criado_em       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (funcionario_id, periodo_id)
);
ALTER TABLE public.avaliacao_desempenho ENABLE ROW LEVEL SECURITY;

-- 8) Compromissos financeiros futuros (para ICC)
CREATE TABLE IF NOT EXISTS public.compromissos_financeiros (
  id          SERIAL PRIMARY KEY,
  vencimento  DATE NOT NULL,
  descricao   TEXT NOT NULL,
  valor       NUMERIC NOT NULL,
  tipo        TEXT CHECK (tipo IN ('folha','fornecedor','imposto','aluguel','outro')),
  pago_em     DATE,
  criado_em   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.compromissos_financeiros ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS compromissos_venc_idx ON public.compromissos_financeiros (vencimento);

-- 9) Saldo de caixa fim de mês
CREATE TABLE IF NOT EXISTS public.caixa_saldo_mensal (
  mes_ref     TEXT PRIMARY KEY,
  saldo_final NUMERIC NOT NULL,
  observacoes TEXT,
  criado_em   TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.caixa_saldo_mensal ENABLE ROW LEVEL SECURITY;

-- Policies (autenticado lê; admin/operador edita)
DO $$
DECLARE t TEXT;
DECLARE tabelas TEXT[] := ARRAY['bonif_periodos','bonif_metas_empresa','bonif_metas_area','bonif_meta_area_mes','medidas_disciplinares','frequencia_mensal','avaliacao_desempenho','compromissos_financeiros','caixa_saldo_mensal'];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select_auth" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "%s_select_auth" ON public.%I FOR SELECT TO authenticated USING (true);', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_modify_admop" ON public.%I;', t, t);
    EXECUTE format($p$CREATE POLICY "%s_modify_admop" ON public.%I FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.perfis WHERE perfis.id = auth.uid() AND perfis.perfil IN ('admin','operador'))) WITH CHECK (EXISTS (SELECT 1 FROM public.perfis WHERE perfis.id = auth.uid() AND perfis.perfil IN ('admin','operador')));$p$, t, t);
  END LOOP;
END $$;

-- Seed — Período 2026-1 + 4 metas-empresa padrão
INSERT INTO public.bonif_periodos (nome, inicio_em, fim_em, status)
VALUES ('2026-1', '2026-01-01', '2026-06-30', 'ativo')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.bonif_metas_empresa (periodo_id, meta_chave, valor_meta, unidade, peso_pct)
SELECT p.id, m.chave, m.valor, m.unidade, m.peso
FROM public.bonif_periodos p
CROSS JOIN (VALUES
  ('faturamento_bruto', 7000000, 'BRL',  10),
  ('margem_liquida',         10, 'pct',  10),
  ('caixa_positivo',          1, 'bool',  5),
  ('icc_6m',                100, 'pct',   5)
) AS m(chave, valor, unidade, peso)
WHERE p.nome = '2026-1'
ON CONFLICT (periodo_id, meta_chave) DO NOTHING;
