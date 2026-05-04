-- Migração 16 — Liga movimentos ao plano de contas
-- Destrava: Custo Direto > Lançamento Direto (filtro real por DRE/tipo_custo)
-- Movimentos antigos ficam com plano_contas_id NULL — back-fill via importação.

ALTER TABLE public.movimentos
  ADD COLUMN IF NOT EXISTS plano_contas_id BIGINT
    REFERENCES public.plano_contas(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.movimentos.plano_contas_id IS
  'Conta contábil do lançamento. Permite filtros por classificação DRE e tipo_custo. NULL = não classificado.';

CREATE INDEX IF NOT EXISTS idx_movimentos_plano_contas
  ON public.movimentos (plano_contas_id)
  WHERE plano_contas_id IS NOT NULL;

-- Aplicado via Supabase MCP em 2026-05-04 às 23:35.
