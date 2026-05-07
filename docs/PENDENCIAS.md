# Pendências — Terra Conttemporânea

**Atualizado:** 2026-05-07 pós M18 aplicada

## Pendências de DEV abertas (priorizadas)

### Crítica — surgiu no escopo da sessão e ficou pra próxima
- **Perfil "Master"** (você + Natália) com flags exclusivos pra limpar base e fazer carga inicial. Hoje não existe — qualquer admin pode tudo. Precisa: migração (2 flags em perfis_tipos + tipo "master" + funções helper) + frontend (tela "Reset" só pra master + restrições nos botões Importar pra carga inicial)
- **M18 Onda 3.3 — Refac Gestão de Faturamento** como Dashboard rico cruzando 5 fontes (orcamentos + notas_fiscais + nf_os + estoque_detalhes + ordens_servico). Mostra por orçamento: Tipo Faturamento, Adto, Recebimento, NF Emitida, Venda S/NF, A Faturar, Saldo Adto, Custo total + drill-downs por coluna
- **Refac das telas Notas Fiscais / Contas a Receber / Contas a Pagar** para ler das tabelas novas (notas_fiscais rica via nf_os, movimentos_caixa). Hoje continuam lendo das fontes antigas (movimentos com natureza filtrada / compromissos_financeiros)

### M19 — Bônus Individual (não iniciado)
- Parser de PDF de Folha de Ponto **consolidado** (decisão Juliana 2026-05-07: 1 PDF único com todos funcionários) → tabela `frequencia_mensal`
- Definir fontes de `medidas_disciplinares` e `avaliacao_desempenho`
- Implementar cálculo profissional do bônus (hoje só usa metas)
- Possivelmente revisar Programa de Bonificação 30/30/40 conforme `bonificacao_estrutura_proposta.md`

### Qualidade (advisor warnings do Supabase)
- 5 funções com `search_path mutable` (fn_auditar, fn_touch_atualizado_em, get_perfil, set_atualizado_em, fn_snapshot_saldo_reconhecer já corrigida na M18b)
- 3 funções `SECURITY DEFINER` callable por anon role (auth_pode_admin, auth_pode_modificar, fn_auditar)
- `auth_leaked_password_protection` desabilitado (config Supabase Auth)

### Não-urgentes (longa data)
- SMTP próprio no Supabase (hoje SMTP padrão tem limite ~30/dia)
- Logo da Terra — ajuste fino visual pendente
- Estender `coletarConflitosCfop()` para outras fontes além de notas_fiscais
- 4 telas de RH (Benefícios, Folha, Impostos): CRUD básico já existe; importação automática pode ser melhorada
- Atualizar Visão 12m com Folha "projetada" futura (hoje só lê folha já lançada)

## Pendências de DADOS (dependem de Juliana)

- **264 orçamentos com `parceiro` NULL** — agora resolvível com o template "Orçamentos" refatorado (aceita planilha "Orçamento Aprovado por Parceiro" do Aerolito com coluna PARCEIROS)
- **8 funcionários INATIVO sem `data_demissao`** — ajustar caso a caso pela tela de Funcionários
- **12 orçamentos com ruído Fixa+Solta** — botão Resolver na tela Diagnóstico
- **Frequência mensal, medidas disciplinares, avaliações de desempenho** — destravam cálculo profissional do Bônus (M19)
- **Metas das áreas no organograma para 2026-1** — cadastrar via RH > Bônus — Configuração
- Cadastrar contas bancárias (se ainda não fez) via Fluxo de Caixa > Contas Bancárias
- Cadastrar saldos mensais por conta via Fluxo de Caixa > Saldos Mensais
- Importar histórico do arquivo Excel "30032026_Gestão Faturamento e Receita.xlsx" via novos templates históricos

## Já resolvido (histórico)

### Entregas 1-13 (resumo até 2026-05-04)
Setup → orçamentos → vendas → consolidado → DRE → CFOP → Plano de Contas → CFOP toggle → RH funcionários → Programa de Bônus → Auditoria → Caixa + Compromissos → Fluxo de Caixa → Reestruturação Custos + Modais (M14) → Audit gaps (M15) → movimentos.plano_contas_id (M16) → Usuários CRUD + Perfis dinâmicos (M17) → Revisão UX/UI completa.

### M18 — Plena Gestão de Faturamento (2026-05-07) ✅

**Backend (Supabase):**
- M18 SQL: 6 tabelas novas + 3 colunas em orcamentos + view + função snapshot + 12 RLS policies + 6 triggers de auditoria + 3 de touch + UPDATE em massa pra default 100_NF em 264 orçamentos antigos
- M18b SQL: SECURITY INVOKER na view + search_path fixo na função

**Frontend (8 commits direto no GitHub via API REST com PAT temporário, ZERO toque no PC da Juliana):**
- 2A `3320ff459b`: refac saída_estoque (4 destinos) + 2 templates de histórico + refac orcamentos
- 2A.fix `b2c36de4c5`: rename "bíblia" → "arquivo"
- 2B `a94e9b62c2`: template Dashboard de Orçamentos (3 destinos)
- 2C-1 `9099f102f2`: prompt de tipo_faturamento na importação de orçamentos
- 2C-2 `aed904cd28`: refac NFs com modal de revisão de vínculo NF↔OS
- 2C-3 `49289d7536`: template "A Pagar x A Receber" com classificação automática
- 3.1 `d0440c5f77`: telas novas Saldo a Reconhecer + Dashboard de Orçamentos + função abrirDetalheItensMP
- 3.2 `d3b6c75f3e`: tela Lançamentos de Caixa com bulk action + drill-down Custo por OS

## Snapshot técnico

- Último commit GitHub (frontend): `d3b6c75f3e` (Onda 3.2)
- Banco Supabase: 15 migrações, 49 tabelas, 53 policies modify
- Edge Function `gerenciar-usuarios` ACTIVE
- 2 perfis ativos: Juliana (admin) e Natália (operador) — pendente promoção pra "master" em sessão futura
