-- M20: Medidas Disciplinares (POL_001) — Estensão da tabela existente
-- Aplicada em 2026-05-07 via MCP Supabase

-- Renomear "tipo" → "tipo_medida"
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='medidas_disciplinares' AND column_name='tipo')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='medidas_disciplinares' AND column_name='tipo_medida') THEN
    EXECUTE 'ALTER TABLE medidas_disciplinares RENAME COLUMN tipo TO tipo_medida';
  END IF;
END $$;

-- Renomear "descricao" → "descricao_infracao"
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='medidas_disciplinares' AND column_name='descricao')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='medidas_disciplinares' AND column_name='descricao_infracao') THEN
    EXECUTE 'ALTER TABLE medidas_disciplinares RENAME COLUMN descricao TO descricao_infracao';
  END IF;
END $$;

-- Colunas novas
ALTER TABLE medidas_disciplinares ADD COLUMN IF NOT EXISTS gravidade_infracao TEXT;
ALTER TABLE medidas_disciplinares ADD COLUMN IF NOT EXISTS dias_suspensao INTEGER;
ALTER TABLE medidas_disciplinares ADD COLUMN IF NOT EXISTS data_inicio_suspensao DATE;
ALTER TABLE medidas_disciplinares ADD COLUMN IF NOT EXISTS data_fim_suspensao DATE;
ALTER TABLE medidas_disciplinares ADD COLUMN IF NOT EXISTS gestor_responsavel TEXT;
ALTER TABLE medidas_disciplinares ADD COLUMN IF NOT EXISTS ciencia_data TIMESTAMPTZ;
ALTER TABLE medidas_disciplinares ADD COLUMN IF NOT EXISTS ciencia_observacao TEXT;
ALTER TABLE medidas_disciplinares ADD COLUMN IF NOT EXISTS status_medida TEXT NOT NULL DEFAULT 'aplicada';
ALTER TABLE medidas_disciplinares ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE medidas_disciplinares ADD COLUMN IF NOT EXISTS aplicado_por UUID;
ALTER TABLE medidas_disciplinares ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='med_disc_aplicado_por_fk') THEN
    ALTER TABLE medidas_disciplinares
      ADD CONSTRAINT med_disc_aplicado_por_fk FOREIGN KEY (aplicado_por) REFERENCES auth.users(id);
  END IF;
END $$;

-- CHECKs
ALTER TABLE medidas_disciplinares DROP CONSTRAINT IF EXISTS med_disc_tipo_chk;
ALTER TABLE medidas_disciplinares DROP CONSTRAINT IF EXISTS med_disc_gravidade_chk;
ALTER TABLE medidas_disciplinares DROP CONSTRAINT IF EXISTS med_disc_status_chk;
ALTER TABLE medidas_disciplinares DROP CONSTRAINT IF EXISTS med_disc_dias_chk;

ALTER TABLE medidas_disciplinares ADD CONSTRAINT med_disc_tipo_chk CHECK (tipo_medida IN ('Advertência Verbal','Advertência Escrita','Suspensão','Demissão por Justa Causa'));
ALTER TABLE medidas_disciplinares ADD CONSTRAINT med_disc_gravidade_chk CHECK (gravidade_infracao IN ('Leve','Moderada','Grave','Muito Grave'));
ALTER TABLE medidas_disciplinares ADD CONSTRAINT med_disc_status_chk CHECK (status_medida IN ('aplicada','cancelada','contestada'));
ALTER TABLE medidas_disciplinares ADD CONSTRAINT med_disc_dias_chk CHECK (dias_suspensao IS NULL OR (dias_suspensao BETWEEN 1 AND 30));

CREATE INDEX IF NOT EXISTS idx_med_disc_funcionario ON medidas_disciplinares(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_med_disc_data ON medidas_disciplinares(data DESC);
CREATE INDEX IF NOT EXISTS idx_med_disc_status ON medidas_disciplinares(status_medida);

-- RLS
ALTER TABLE medidas_disciplinares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select medidas_disciplinares" ON medidas_disciplinares;
DROP POLICY IF EXISTS "modify medidas_disciplinares" ON medidas_disciplinares;
CREATE POLICY "select medidas_disciplinares" ON medidas_disciplinares FOR SELECT USING (true);
CREATE POLICY "modify medidas_disciplinares" ON medidas_disciplinares FOR ALL USING (auth_pode_modificar()) WITH CHECK (auth_pode_modificar());

-- Triggers
DROP TRIGGER IF EXISTS trg_touch_med_disc ON medidas_disciplinares;
CREATE TRIGGER trg_touch_med_disc BEFORE UPDATE ON medidas_disciplinares FOR EACH ROW EXECUTE FUNCTION fn_touch_atualizado_em();

DROP TRIGGER IF EXISTS trg_aud_med_disc ON medidas_disciplinares;
CREATE TRIGGER trg_aud_med_disc AFTER INSERT OR UPDATE OR DELETE ON medidas_disciplinares FOR EACH ROW EXECUTE FUNCTION fn_auditar();
