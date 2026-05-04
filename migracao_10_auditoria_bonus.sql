-- =====================================================================
-- Migração 10 — Auditoria nas tabelas das Entregas 6 e 7
-- Data: 2026-05-04
-- Reusa a função fn_auditar() criada na migração 03.
-- =====================================================================

DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY[
    'bonif_periodos',
    'bonif_metas_empresa',
    'bonif_metas_area',
    'bonif_meta_area_mes',
    'bonif_metas_profissional',
    'medidas_disciplinares',
    'frequencia_mensal',
    'avaliacao_desempenho',
    'compromissos_financeiros',
    'caixa_saldo_mensal'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%s ON public.%I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER audit_%s AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_auditar();',
      t, t
    );
  END LOOP;
END $$;
