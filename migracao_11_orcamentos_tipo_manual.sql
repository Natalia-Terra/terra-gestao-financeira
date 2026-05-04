-- Migração 11 — Resolver ruído Fixa+Solta com decisão manual.
-- Quando o orçamento tem movimentos classificados em mais de um Tipo,
-- Juliana usa a tela Diagnóstico para gravar uma decisão final.
-- NULL = deriva automaticamente pelos movimentos (comportamento atual).
-- 'Mobília Fixa' / 'Mobília Solta' / 'Misto' = decisão manual.

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS tipo_manual TEXT
    CHECK (tipo_manual IN ('Mobília Fixa','Mobília Solta','Misto'));

COMMENT ON COLUMN public.orcamentos.tipo_manual IS
  'Decisão manual de Tipo quando há ruído de classificação nos movimentos. NULL = derivar automaticamente.';

CREATE INDEX IF NOT EXISTS idx_orcamentos_tipo_manual
  ON public.orcamentos (tipo_manual)
  WHERE tipo_manual IS NOT NULL;
