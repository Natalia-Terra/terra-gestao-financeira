# Pendências — Terra Conttemporânea

**Atualizado:** 2026-05-07 (final da sessão — M18 + M19 + limpeza qualidade aplicados)

## Pendências de DEV abertas

### Refacs incrementais (baixa urgência — telas atuais funcionam)
- **Refac tela "Notas Fiscais"** (Comercial) pra ler de `notas_fiscais` (rica) com OSs vinculadas via `nf_os` — hoje continua lendo de `movimentos` natureza='Nota Fiscal'
- **Refac telas "Contas a Receber" / "Contas a Pagar"** (Financeiro) pra ler de `movimentos_caixa` — hoje continuam lendo de `movimentos` / `compromissos_financeiros`
- **Avaliar substituir** a tela antiga "Gestão de Faturamento" pelo novo "Dashboard de Faturamento (rico)" depois de validação

### M19 — Bônus Individual (não iniciado)
- Parser de PDF de Folha de Ponto **consolidado** (1 PDF único) → `frequencia_mensal`
- Definir fontes/telas para `medidas_disciplinares` e `avaliacao_desempenho`
- Implementar cálculo profissional do bônus (hoje só usa metas)
- Possivelmente revisar Programa de Bonificação 30/30/40 conforme `bonificacao_estrutura_proposta.md`

### Qualidade restante
- `auth_leaked_password_protection` desabilitado (config Supabase Auth dashboard, não SQL — Juliana habilita manualmente)
- 5 warnings de `0029 authenticated_security_definer` em auth_pode_*/fn_reset — INTRÍNSECOS da arquitetura M17. Tradeoff aceito: as funções precisam ser SECURITY DEFINER pra ler perfis_tipos sem expor a tabela. Não corrigir.

### Não-urgentes (longa data)
- SMTP próprio no Supabase (hoje SMTP padrão tem limite ~30/dia)
- Logo da Terra — ajuste fino visual pendente
- Estender `coletarConflitosCfop()` para outras fontes além de notas_fiscais
- 4 telas de RH (Benefícios, Folha, Impostos): CRUD básico já existe; importação automática pode ser melhorada
- Atualizar Visão 12m com Folha "projetada" futura (hoje só lê folha já lançada)

## Pendências de DADOS (dependem de Juliana/Natália)

- **264 orçamentos com `parceiro` NULL** — usar template "Orçamentos" refatorado (aceita planilha "Orçamento Aprovado por Parceiro")
- **8 funcionários INATIVO sem `data_demissao`** — ajustar caso a caso pela tela de Funcionários
- **12 orçamentos com ruído Fixa+Solta** — botão Resolver na tela Diagnóstico
- **Frequência mensal, medidas disciplinares, avaliações de desempenho** — destravam cálculo profissional do Bônus (M19)
- **Metas das áreas no organograma para 2026-1** — cadastrar via RH > Bônus — Configuração
- **Importar histórico do arquivo Excel "30032026_Gestão Faturamento e Receita.xlsx"** via novos templates históricos (Mov Financeiro + Saldo a Reconhecer)
- **Importar Dashboard de Orçamentos.xlsx** pra popular orcamento_items + os_custos_planejados + ordens_servico
- **Importar Saída de Estoque Por Período.xlsx** com novo parser refatorado (4 destinos)
- **Importar A Pagar x A Receber - Dt. Baixa.xlsx** pra popular movimentos_caixa (e classificar pendentes na tela Lançamentos de Caixa)

## Já resolvido — sessão de 2026-05-07 ✅

### Migrações SQL aplicadas
- **M18** — Plena Gestão de Faturamento: 6 tabelas novas + 3 colunas em orcamentos + view + função snapshot + 12 RLS policies + 6 triggers de auditoria + 3 de touch + UPDATE em massa pra default 100_NF
- **M18b** — SECURITY INVOKER na view + search_path fixo
- **M19** — Perfil Master: 2 flags em perfis_tipos + tipo "master" + Juliana/Natália promovidas + 2 funções helper + fn_reset_base_completo() com check
- **M19b** — Limpeza qualidade: search_path fixo em fn_auditar/fn_touch_atualizado_em/get_perfil/set_atualizado_em + revoke fn_auditar de external
- **M19c** — Revoke EXECUTE de PUBLIC nas auth_pode_*/fn_reset (silenciou warnings 0028 anon)

### 11 commits frontend (todos via API REST GitHub, ZERO toque no PC da Juliana)

| # | Commit | O que faz |
|---|---|---|
| 1 | 3320ff459b | M18 2A — refac saida_estoque (4 destinos) + 2 históricos + refac orcamentos |
| 2 | b2c36de4c5 | rename "bíblia" → "arquivo" |
| 3 | a94e9b62c2 | M18 2B — template Dashboard de Orçamentos (3 destinos) |
| 4 | 9099f102f2 | M18 2C-1 — prompt tipo_faturamento na importação de orçamentos |
| 5 | aed904cd28 | M18 2C-2 — NFs com modal de revisão de vínculo NF↔OS |
| 6 | 49289d7536 | M18 2C-3 — template "A Pagar x A Receber" com classificação automática |
| 7 | d0440c5f77 | M18 3.1 — telas novas Saldo a Reconhecer + Dashboard de Orçamentos + abrirDetalheItensMP |
| 8 | d3b6c75f3e | M18 3.2 — tela Lançamentos de Caixa com bulk action + drill-down Custo por OS |
| 9 | 37b77b95b0 | docs/ atualizados pós M18 |
| 10 | be8a7e3c87 | M19 — Perfil Master + tela Reset (cfg_reset) com confirmação dupla + restrição da tela Importar |
| 11 | faf91c88fa | M18 Onda 3.3 — Dashboard de Faturamento (rico) cruzando 5 fontes |

## Snapshot técnico

- Último commit GitHub: `faf91c88fa` (Onda 3.3)
- Banco Supabase: 18 migrações registradas (M07-M19c), ~50 tabelas, 53 RLS policies modify
- Edge Function `gerenciar-usuarios` ACTIVE
- 2 perfis ativos como `master`: Juliana e Natália

## Estatísticas da sessão

- 5 migrações SQL aplicadas
- 11 commits frontend
- ~3.500 linhas de código adicionadas no app.js (de ~7.300 para ~10.800 linhas)
- 17 → 6 warnings do advisor (5 esperados + 1 config Auth)
- Zero toque no PC da Juliana
