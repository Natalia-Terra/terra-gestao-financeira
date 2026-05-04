-- =====================================================================
-- Migração 07 — Vínculo funcionários ↔ organograma (1:N)
-- Data: 2026-05-04
-- Adiciona FK funcionarios.organograma_id apontando para organograma.id.
-- Cada funcionário tem no máximo 1 posição; uma posição pode ter N funcionários.
--
-- Inclui também 07b/07c: remove a UNIQUE em funcionarios.cpf, pois a planilha
-- histórica tem readmissões legítimas (mesmo CPF, várias admissões/rescisões).
-- O CPF mantém um índice (não único) para acelerar buscas.
-- =====================================================================

ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS organograma_id INTEGER NULL
    REFERENCES public.organograma(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS funcionarios_organograma_idx
  ON public.funcionarios (organograma_id);

COMMENT ON COLUMN public.funcionarios.organograma_id IS
  'Posição do funcionário no organograma (1:N). NULL se ainda não vinculado.';

-- Remove a UNIQUE de cpf (era um índice único chamado func_cpf_uq).
DROP INDEX IF EXISTS public.func_cpf_uq;

-- Mantém um índice (não único) para velocidade de busca por CPF.
CREATE INDEX IF NOT EXISTS funcionarios_cpf_idx ON public.funcionarios (cpf);

-- A coluna organograma.profissional (texto livre) fica para retrocompatibilidade,
-- mas a fonte de verdade da relação passa a ser funcionarios.organograma_id.
