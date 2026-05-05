# Pendências — Terra Conttemporânea

**Atualizado:** 2026-05-04 pós Entrega 13

## Pendências de DADOS (dependem de Juliana)

- 8 funcionários INATIVO sem `data_demissao` — ajustar caso a caso pela tela de Funcionários
- 264 orçamentos com `parceiro` NULL — falta importar planilha de parceiros
- 12 orçamentos com ruído Fixa+Solta — botão Resolver na tela Diagnóstico já existe
- Reimportar movimentos com coluna `conta` (pra ativar Custo Direto > Lançamento Direto e drill-down em Despesas)
- Frequência mensal, medidas disciplinares, avaliações de desempenho — destravam cálculo profissional do Bônus
- Metas das áreas no organograma para 2026-1 — cadastrar via RH > Bônus — Configuração
- Cadastrar contas bancárias (Itaú, BB, CEF, XP, +) via Fluxo de Caixa > Contas Bancárias
- Cadastrar saldos mensais por conta via Fluxo de Caixa > Saldos Mensais
- Cadastrar recebimentos previstos (parcelas) via tela própria ou import
- Cadastrar folha de pagamento mensal (manual ou via despesas_folha_mensal)
- Importar planilha 'Despesas Folha' completa pra refinar DRE/tipo_custo dos 15 CCs

## Pendências de DEV (não-urgentes)

- SMTP próprio no Supabase (hoje SMTP padrão tem limite ~30/dia, pode cair em spam)
- Logo da Terra — ajuste fino pendente (Juliana ainda não satisfeita visualmente)
- Estender `coletarConflitosCfop()` para outras fontes além de notas_fiscais — escopo a confirmar
- 4 telas de RH (Benefícios, Folha, Impostos): CRUD básico via modal já existe; importação automática de folha pode ser melhorada
- Atualizar Visão 12m com Folha "projetada" futura (hoje só lê folha já lançada)

## Já resolvido (histórico)

### Entregas 1-10 (resumo)
Setup inicial → orçamentos → vendas → consolidado → DRE → CFOP → Plano de Contas → CFOP toggle → RH funcionários (320 importados) → Programa de Bônus (3 esferas) → Bônus configurável → Auditoria automática → Caixa + Compromissos → Fluxo de Caixa real (5 tabelas novas).

### Entrega 11 — Reestruturação Custos + Modais (Migração 14)
- Pacote 1: tipo_custo (direto/indireto/despesa) em CC e plano_contas + tabela rateio_areas
- Pacote 2: sidebar virou Receita / Financeiro / Comercial / Custeio / Contabilidade Gerencial
- Pacote 3: tela CC ganhou DRE e tipo_custo editáveis
- Pacote 4: 'Receita por Faturamento' (NF emitida × Apropriação)
- Pacote 5: 4 telas funcionais Custeio
- Pacote 6: drill-down em 5 telas

### Auditoria pós-Entrega 11 (5 blocos)
- Bloco A: Migração 15 fechou audit + touch em orcamentos, centros_custo, plano_contas
- Bloco B: pré-povoamento dos 15 CCs e 182 contas íntegro
- Bloco C: 0 broken links no menu
- Bloco D: cascatas de invalidação adicionadas
- Bloco E: memória atualizada

### Migração 16 — `movimentos.plano_contas_id`
Parser de import aceita coluna `conta`/`cod_conta`/`plano_contas`; Custo Direto > Lançamento Direto agora filtra real por DRE; Despesas com toggle de fonte rc/mov + drill-down

### Entrega 12 — Usuários CRUD + Perfis dinâmicos (Migração 17)
- Tabela `perfis_tipos` + coluna `perfis.ativo` + funções helper `auth_pode_modificar/auth_pode_admin`
- 41 RLS policies refatoradas
- Edge Function `gerenciar-usuarios` (criar/desativar/reativar)
- UI completa em Configuração > Usuários e Tipos de Perfil
- 3 tipos pré-povoados (admin, operador, consulta)

### Pós-Entrega 12 — features que faltavam
- 3 templates de import novos (contas_bancarias, saldos_contas, recebimentos_previstos)
- Visão 12m expandida (Recebimentos + Outras entradas | Folha + Contas a pagar + Outras saídas)
- Folha de pagamento integrada na Visão 12m
- Drill-down em todas as células de detalhe da Visão 12m
- UI completa de Entradas Avulsas e Saídas Avulsas
- 2 sections órfãs no HTML removidas

### Entrega 13 — Revisão UX/UI completa (4 blocos)
- Bloco A: WCAG AA contrast, bordas mais visíveis, sistema de spacing, focus visível, body 14→15px, btn-ouro com hover/active refinados
- Bloco B: Login refeito split-screen
- Bloco C: metric-card com faixa ouro lateral, sidebar com hierarquia tipográfica, hover de linha com bg4 + barra ouro, tags pill
- Bloco D: topbar 100→104px, logo 44→52px

## Snapshot técnico

- Último commit GitHub: `0f177c1` (revisão UX/UI completa)
- Banco Supabase: 13 migrações registradas, 43 tabelas em public, 41 policies modify usando `auth_pode_modificar()`
- Edge Function `gerenciar-usuarios` ACTIVE
- 2 perfis ativos: Juliana (admin) e Natália (operador)
