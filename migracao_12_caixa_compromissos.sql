-- Migração 12 — Saldo de Caixa Mensal e Compromissos Financeiros (Entrega 9)
-- (As tabelas já existiam de uma migração anterior. Esta migração completa
-- triggers, observação e atualizado_em em compromissos_financeiros.)

ALTER TABLE public.compromissos_financeiros
  ADD COLUMN IF NOT EXISTS observacao TEXT,
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.fn_touch_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.atualizado_em := NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_touch_caixa_saldo ON public.caixa_saldo_mensal;
CREATE TRIGGER trg_touch_caixa_saldo BEFORE UPDATE ON public.caixa_saldo_mensal
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_atualizado_em();

DROP TRIGGER IF EXISTS trg_touch_compromissos ON public.compromissos_financeiros;
CREATE TRIGGER trg_touch_compromissos BEFORE UPDATE ON public.compromissos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_atualizado_em();

DROP TRIGGER IF EXISTS trg_audit_caixa_saldo ON public.caixa_saldo_mensal;
CREATE TRIGGER trg_audit_caixa_saldo
  AFTER INSERT OR UPDATE OR DELETE ON public.caixa_saldo_mensal
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();

DROP TRIGGER IF EXISTS trg_audit_compromissos ON public.compromissos_financeiros;
CREATE TRIGGER trg_audit_compromissos
  AFTER INSERT OR UPDATE OR DELETE ON public.compromissos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();

CREATE INDEX IF NOT EXISTS idx_caixa_saldo_mes ON public.caixa_saldo_mensal (mes_ref DESC);
CREATE INDEX IF NOT EXISTS idx_compromissos_venc ON public.compromissos_financeiros (vencimento);
CREATE INDEX IF NOT EXISTS idx_compromissos_tipo ON public.compromissos_financeiros (tipo);
CREATE INDEX IF NOT EXISTS idx_compromissos_pendentes
  ON public.compromissos_financeiros (vencimento) WHERE pago_em IS NULL;
