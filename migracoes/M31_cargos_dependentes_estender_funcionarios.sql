-- M31: Onda A — Fundação RH
-- Aplicada em 2026-05-19 via MCP Supabase
-- (1) Tabela cargos com descritivo completo (modelo Terra)
-- (2) Tabela funcionarios_dependentes
-- (3) Extensão de funcionarios com campos faltantes vs mercado

CREATE TABLE IF NOT EXISTS cargos (
  id              SERIAL PRIMARY KEY,
  nome            TEXT NOT NULL,
  departamento    TEXT,
  superior_id     INTEGER REFERENCES cargos(id) ON DELETE SET NULL,
  missao          TEXT,
  responsabilidades TEXT,
  competencias    TEXT,
  consideracoes   TEXT,
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cargos_nome_uq ON cargos(LOWER(nome)) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_cargos_superior ON cargos(superior_id);
CREATE INDEX IF NOT EXISTS idx_cargos_dep ON cargos(departamento);
ALTER TABLE cargos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select cargos" ON cargos;
DROP POLICY IF EXISTS "modify cargos" ON cargos;
CREATE POLICY "select cargos" ON cargos FOR SELECT USING (true);
CREATE POLICY "modify cargos" ON cargos FOR ALL USING (auth_pode_modificar()) WITH CHECK (auth_pode_modificar());
DROP TRIGGER IF EXISTS trg_touch_cargos ON cargos;
CREATE TRIGGER trg_touch_cargos BEFORE UPDATE ON cargos FOR EACH ROW EXECUTE FUNCTION fn_touch_atualizado_em();
DROP TRIGGER IF EXISTS trg_aud_cargos ON cargos;
CREATE TRIGGER trg_aud_cargos AFTER INSERT OR UPDATE OR DELETE ON cargos FOR EACH ROW EXECUTE FUNCTION fn_auditar();
COMMENT ON TABLE cargos IS 'Descritivo de cargo no padrão Terra (Missão, Responsabilidades, Competências, Considerações). Subordinação por cargo: superior_id aponta pro cargo do superior imediato.';

CREATE TABLE IF NOT EXISTS funcionarios_dependentes (
  id              SERIAL PRIMARY KEY,
  funcionario_id  INTEGER NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  parentesco      TEXT,
  data_nascimento DATE,
  cpf             TEXT,
  dependente_ir   BOOLEAN NOT NULL DEFAULT FALSE,
  dependente_sf   BOOLEAN NOT NULL DEFAULT FALSE,
  observacoes     TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dep_func ON funcionarios_dependentes(funcionario_id);
ALTER TABLE funcionarios_dependentes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select funcionarios_dependentes" ON funcionarios_dependentes;
DROP POLICY IF EXISTS "modify funcionarios_dependentes" ON funcionarios_dependentes;
CREATE POLICY "select funcionarios_dependentes" ON funcionarios_dependentes FOR SELECT USING (true);
CREATE POLICY "modify funcionarios_dependentes" ON funcionarios_dependentes FOR ALL USING (auth_pode_modificar()) WITH CHECK (auth_pode_modificar());
DROP TRIGGER IF EXISTS trg_touch_dep ON funcionarios_dependentes;
CREATE TRIGGER trg_touch_dep BEFORE UPDATE ON funcionarios_dependentes FOR EACH ROW EXECUTE FUNCTION fn_touch_atualizado_em();
DROP TRIGGER IF EXISTS trg_aud_dep ON funcionarios_dependentes;
CREATE TRIGGER trg_aud_dep AFTER INSERT OR UPDATE OR DELETE ON funcionarios_dependentes FOR EACH ROW EXECUTE FUNCTION fn_auditar();
COMMENT ON TABLE funcionarios_dependentes IS 'Dependentes nominais. dependente_ir = abatimento IR; dependente_sf = salário-família INSS';

ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS cargo_id INTEGER REFERENCES cargos(id) ON DELETE SET NULL;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS matricula_fgts TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS escolaridade TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS estado_civil TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS nacionalidade TEXT DEFAULT 'Brasileira';
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS naturalidade TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS nome_mae TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS nome_pai TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS contato_emergencia_nome TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS contato_emergencia_parentesco TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS contato_emergencia_telefone TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS sexo TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS raca_cor TEXT;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS deficiencia TEXT;
CREATE INDEX IF NOT EXISTS idx_funcionarios_cargo_id ON funcionarios(cargo_id);
COMMENT ON COLUMN funcionarios.cargo_id IS 'FK para cargos. Campo legado "cargo" (text) preservado pra retrocompatibilidade.';
COMMENT ON COLUMN funcionarios.matricula_fgts IS 'Matrícula FGTS conforme GFD da Caixa (diferente do código interno)';
COMMENT ON COLUMN funcionarios.foto_url IS 'URL externa (rede da empresa) ou Supabase Storage. Opcional.';
