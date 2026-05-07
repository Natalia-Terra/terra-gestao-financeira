-- M19: Perfil "Master" + função fn_reset_base_completo
-- Aplicada em 2026-05-07 via MCP Supabase (não roda localmente — registro histórico).

-- 0) Remover CHECK constraint legacy de perfis.perfil
ALTER TABLE perfis DROP CONSTRAINT IF EXISTS perfis_perfil_check;

-- 1) Adicionar 2 flags em perfis_tipos
ALTER TABLE perfis_tipos ADD COLUMN IF NOT EXISTS pode_limpar_base BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE perfis_tipos ADD COLUMN IF NOT EXISTS pode_carga_inicial BOOLEAN NOT NULL DEFAULT false;

-- 2) Criar tipo "master"
INSERT INTO perfis_tipos (nome, descricao, pode_admin, pode_modificar, pode_limpar_base, pode_carga_inicial, ativo, ordem)
VALUES (
  'master',
  'Acesso máximo. Únicos perfis que podem fazer reset completo da base e carga inicial em massa.',
  true, true, true, true, true,
  COALESCE((SELECT MAX(ordem) FROM perfis_tipos), 0) + 1
)
ON CONFLICT (nome) DO UPDATE SET
  pode_admin = EXCLUDED.pode_admin,
  pode_modificar = EXCLUDED.pode_modificar,
  pode_limpar_base = EXCLUDED.pode_limpar_base,
  pode_carga_inicial = EXCLUDED.pode_carga_inicial,
  descricao = EXCLUDED.descricao;

-- 2b) Admin recebe pode_carga_inicial (operador NÃO)
UPDATE perfis_tipos SET pode_carga_inicial = true WHERE nome = 'admin' AND pode_carga_inicial = false;

-- 3) Promover Juliana e Natália pra master
UPDATE perfis SET perfil = 'master'
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email IN ('juliana@polimatagrc.com.br', 'financeiro@terraconttemporanea.com.br')
)
AND perfil <> 'master';

-- 4) Funções helper RLS
CREATE OR REPLACE FUNCTION auth_pode_limpar_base()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfis p
    JOIN perfis_tipos t ON t.nome = p.perfil AND t.ativo = true
    WHERE p.id = auth.uid() AND p.ativo = true AND t.pode_limpar_base = true
  );
$$;

CREATE OR REPLACE FUNCTION auth_pode_carga_inicial()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfis p
    JOIN perfis_tipos t ON t.nome = p.perfil AND t.ativo = true
    WHERE p.id = auth.uid() AND p.ativo = true AND t.pode_carga_inicial = true
  );
$$;

REVOKE EXECUTE ON FUNCTION auth_pode_limpar_base() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION auth_pode_carga_inicial() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION auth_pode_limpar_base() TO authenticated;
GRANT EXECUTE ON FUNCTION auth_pode_carga_inicial() TO authenticated;

-- 5) Função fn_reset_base_completo()
CREATE OR REPLACE FUNCTION fn_reset_base_completo()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE result JSONB := '{}'::jsonb;
BEGIN
  IF NOT auth_pode_limpar_base() THEN
    RAISE EXCEPTION 'Acesso negado. Apenas perfis com pode_limpar_base=true podem chamar fn_reset_base_completo().';
  END IF;

  TRUNCATE TABLE
    nf_os, notas_fiscais, saldo_reconhecer,
    movimentos, movimentos_caixa, custo_direto_competencia,
    estoque_detalhes, estoque_resumo, os_evolucao_mensal,
    os_excluidas, ordens_servico, orcamento_items, os_custos_planejados,
    receitas_custos, entregas_vinc,
    folha_pagamento_rubricas, folha_pagamento, impostos_rh, beneficios,
    bonif_meta_area_mes, bonif_metas_area, bonif_metas_empresa,
    bonif_metas_profissional, bonif_periodos,
    contas_bancarias, saldos_contas, recebimentos_previstos,
    entradas_outras, saidas_outras, caixa_saldo_mensal,
    compromissos_financeiros, auditoria, importacoes
  RESTART IDENTITY CASCADE;

  DELETE FROM orcamentos;

  result := jsonb_build_object(
    'status', 'ok',
    'mensagem', 'Base resetada.',
    'executado_por', auth.uid(),
    'executado_em', NOW()
  );
  RETURN result;
END $$;

REVOKE EXECUTE ON FUNCTION fn_reset_base_completo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_reset_base_completo() TO authenticated;

-- M19b: limpeza de qualidade — adicionar SET search_path em funções legadas
-- (recriação de fn_auditar, fn_touch_atualizado_em, get_perfil, set_atualizado_em)
-- (revogar EXECUTE de PUBLIC nas auth_pode_*)
-- Detalhes em docs/ESTADO_ATUAL.md
