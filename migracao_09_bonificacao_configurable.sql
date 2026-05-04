-- =====================================================================
-- Migração 09 — Bonificação configurável (Entrega 7)
-- Data: 2026-05-04
-- Adiciona escala_json (JSONB) em metas-empresa e metas-área. Cria
-- tabela bonif_metas_profissional. Popula escalas iniciais do PPT.
-- =====================================================================

ALTER TABLE public.bonif_metas_empresa
  ADD COLUMN IF NOT EXISTS escala_json JSONB,
  ADD COLUMN IF NOT EXISTS descricao TEXT;

ALTER TABLE public.bonif_metas_area
  ADD COLUMN IF NOT EXISTS escala_json JSONB;

CREATE TABLE IF NOT EXISTS public.bonif_metas_profissional (
  id          SERIAL PRIMARY KEY,
  periodo_id  INTEGER NOT NULL REFERENCES public.bonif_periodos(id) ON DELETE CASCADE,
  meta_chave  TEXT NOT NULL CHECK (meta_chave IN ('conduta','faltas_just','atrasos','performance','penalidade')),
  descricao   TEXT,
  peso_pct    NUMERIC NOT NULL,
  unidade     TEXT NOT NULL DEFAULT 'bool' CHECK (unidade IN ('bool','faltas_qtd','atrasos_qtd','nota_1a5','penalidade')),
  escala_json JSONB,
  ativa       BOOLEAN NOT NULL DEFAULT true,
  criado_em   TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE (periodo_id, meta_chave)
);
ALTER TABLE public.bonif_metas_profissional ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bonif_metas_profissional_select_auth" ON public.bonif_metas_profissional;
CREATE POLICY "bonif_metas_profissional_select_auth" ON public.bonif_metas_profissional
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "bonif_metas_profissional_modify_admop" ON public.bonif_metas_profissional;
CREATE POLICY "bonif_metas_profissional_modify_admop" ON public.bonif_metas_profissional
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.perfis WHERE perfis.id = auth.uid() AND perfis.perfil IN ('admin','operador')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfis WHERE perfis.id = auth.uid() AND perfis.perfil IN ('admin','operador')));

-- Popular escalas atuais do PPT no período 2026-1
UPDATE public.bonif_metas_empresa
SET descricao = 'Faturamento bruto acumulado no semestre',
    escala_json = '{"tipo":"min","unidade":"pct_meta","faixas":[
      {"limite":100,"peso_pct":10,"label":"100% da meta"},
      {"limite":90,"peso_pct":8,"label":"90% da meta"},
      {"limite":80,"peso_pct":5,"label":"80% da meta"},
      {"limite":0,"peso_pct":0,"label":"abaixo de 80%"}
    ]}'::jsonb
WHERE meta_chave = 'faturamento_bruto'
  AND periodo_id = (SELECT id FROM public.bonif_periodos WHERE nome = '2026-1');

UPDATE public.bonif_metas_empresa
SET descricao = 'Margem líquida acumulada do semestre',
    escala_json = '{"tipo":"min","unidade":"pct_meta","faixas":[
      {"limite":100,"peso_pct":10,"label":"100% da meta (ML 10%)"},
      {"limite":90,"peso_pct":8,"label":"90% da meta (ML 9%)"},
      {"limite":80,"peso_pct":5,"label":"80% da meta (ML 8%)"},
      {"limite":0,"peso_pct":0,"label":"abaixo de 80% da meta"}
    ]}'::jsonb
WHERE meta_chave = 'margem_liquida'
  AND periodo_id = (SELECT id FROM public.bonif_periodos WHERE nome = '2026-1');

UPDATE public.bonif_metas_empresa
SET descricao = 'Caixa positivo no fechamento de todos os meses',
    escala_json = '{"tipo":"min","unidade":"bool","faixas":[
      {"limite":1,"peso_pct":5,"label":"positivo todos os meses"},
      {"limite":0,"peso_pct":0,"label":"algum mês negativo"}
    ]}'::jsonb
WHERE meta_chave = 'caixa_positivo'
  AND periodo_id = (SELECT id FROM public.bonif_periodos WHERE nome = '2026-1');

UPDATE public.bonif_metas_empresa
SET descricao = 'Índice de Cobertura de Caixa ≥ 100% (6 meses)',
    escala_json = '{"tipo":"min","unidade":"pct","faixas":[
      {"limite":100,"peso_pct":5,"label":"ICC ≥ 100%"},
      {"limite":0,"peso_pct":0,"label":"ICC < 100%"}
    ]}'::jsonb
WHERE meta_chave = 'icc_6m'
  AND periodo_id = (SELECT id FROM public.bonif_periodos WHERE nome = '2026-1');

INSERT INTO public.bonif_metas_profissional (periodo_id, meta_chave, descricao, peso_pct, unidade, escala_json)
SELECT p.id, m.chave, m.descricao, m.peso, m.unidade, m.escala::jsonb
FROM public.bonif_periodos p
CROSS JOIN (VALUES
  ('conduta',
   'Aderência ao Código de Conduta — sem medidas disciplinares no semestre',
   12.5, 'bool',
   '{"tipo":"max","unidade":"medidas_qtd","faixas":[
     {"limite":0,"peso_pct":12.5,"label":"sem medidas disciplinares"},
     {"limite":null,"peso_pct":0,"label":"recebeu medida disciplinar"}
   ]}'),
  ('faltas_just',
   'Faltas justificadas no semestre — limite 3',
   6.25, 'faltas_qtd',
   '{"tipo":"max","unidade":"faltas_qtd","faixas":[
     {"limite":3,"peso_pct":6.25,"label":"≤ 3 faltas justificadas"},
     {"limite":null,"peso_pct":0,"label":"acima do limite"}
   ]}'),
  ('atrasos',
   'Atrasos de até 30 min — máx 2 por mês (12 no semestre)',
   6.25, 'atrasos_qtd',
   '{"tipo":"max","unidade":"atrasos_qtd","faixas":[
     {"limite":12,"peso_pct":6.25,"label":"até 12 atrasos"},
     {"limite":13,"peso_pct":5.00,"label":"13 atrasos"},
     {"limite":14,"peso_pct":3.75,"label":"14 atrasos"},
     {"limite":15,"peso_pct":2.50,"label":"15 atrasos"},
     {"limite":16,"peso_pct":1.25,"label":"16 atrasos"},
     {"limite":null,"peso_pct":0,"label":"17 ou mais atrasos"}
   ]}'),
  ('performance',
   'Avaliação de Desempenho semestral (nota 1 a 5)',
   15, 'nota_1a5',
   '{"tipo":"min","unidade":"nota","faixas":[
     {"limite":5,"peso_pct":20,"label":"5 — sempre supera"},
     {"limite":4,"peso_pct":17,"label":"4 — frequentemente supera"},
     {"limite":3,"peso_pct":15,"label":"3 — dentro do esperado"},
     {"limite":0,"peso_pct":0,"label":"≤ 2 — abaixo"}
   ]}'),
  ('penalidade',
   'Faltas/atrasos sem justificativa — penaliza -12,5%',
   -12.5, 'penalidade',
   '{"tipo":"max","unidade":"sem_just_qtd","faixas":[
     {"limite":0,"peso_pct":0,"label":"nenhuma falta/atraso sem justificativa"},
     {"limite":null,"peso_pct":-12.5,"label":"alguma falta/atraso sem justificativa"}
   ]}')
) AS m(chave, descricao, peso, unidade, escala)
WHERE p.nome = '2026-1'
ON CONFLICT (periodo_id, meta_chave) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  peso_pct = EXCLUDED.peso_pct,
  unidade = EXCLUDED.unidade,
  escala_json = EXCLUDED.escala_json,
  atualizado_em = now();
