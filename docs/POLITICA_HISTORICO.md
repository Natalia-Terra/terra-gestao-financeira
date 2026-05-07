# Política de Histórico — "Nunca Sobrescrever, Sempre Registrar Competência"

**Decisão:** Juliana 2026-05-07
**Aplicada na M24 (estrutura) — refac dos imports vira M25+**

## Princípio

> Toda movimentação tem competência registrada e o sistema mantém base histórica completa. Re-importar dados de uma competência **NÃO sobrescreve** os anteriores — cria nova versão e marca a anterior como `vigente=false`.

## Por quê

- Auditoria contábil: ver evolução das informações sem perder histórico
- Reconciliação: comparar versões diferentes do mesmo período
- Compliance: dados financeiros nunca devem ser apagados sem rastro

## Como funciona

### Coluna `vigente BOOLEAN DEFAULT true` em tabelas com competência

Toda tabela com `mes_ref` (ou equivalente) ganha:
- `vigente BOOLEAN DEFAULT true`
- `import_id INTEGER REFERENCES imports_historico(id)`

Quando você re-importa um período:
1. Sistema cria nova entrada em `imports_historico` (rastreia o quê, quando, por quem)
2. Insere os novos registros com `vigente=true` e `import_id` apontando pra essa entrada
3. Atualiza registros antigos do mesmo período com `vigente=false`
4. Cálculos do sistema (relatórios, bônus, etc.) só consideram `vigente=true`

### Tabela `imports_historico`

Campos:
- `id` PK
- `tipo_import` (ex: 'frequencia_mensal', 'saida_estoque', 'a_pagar_a_receber')
- `nome_arquivo` (rastreio)
- `competencia_referencia` (ex: '2026-04')
- `qtd_registros` (qtd inserida nessa rodada)
- `qtd_excecoes` (qtd que não pôde ser processada)
- `excecoes_json` (lista detalhada das exceções: ex: funcionário X sem ponto)
- `observacoes`
- `criado_por` UUID (quem disparou)
- `criado_em` TIMESTAMPTZ

## Estado atual da implementação

### M24 (aplicada)
✅ Tabela `imports_historico` criada
✅ Colunas `vigente` + `import_id` em 10 tabelas:
   - frequencia_mensal, os_evolucao_mensal, caixa_saldo_mensal, saldos_contas
   - os_custos_planejados, ordens_servico
   - estoque_detalhes, estoque_resumo, custo_direto_competencia
   - movimentos_caixa
✅ `fn_calcular_bonus_profissional` filtrando `vigente=true` em frequencia_mensal

### M25+ (pendente)
- Refatorar funções de cálculo restantes para filtrar `vigente=true`
- Atualizar parsers de import existentes pra:
  1. Criar entrada em imports_historico
  2. Inserir novos registros com import_id + vigente=true
  3. Marcar registros anteriores do mesmo período como vigente=false
- Adicionar tela "Histórico de Imports" pra rastreabilidade

### Imports existentes que precisam refac (M25+)
- Saída de Estoque → 4 tabelas (estoque_detalhes, estoque_resumo, os_evolucao_mensal, custo_direto_competencia)
- Dashboard de Orçamentos → 3 tabelas (orcamento_items, os_custos_planejados, ordens_servico)
- A Pagar x A Receber → movimentos_caixa
- Caixa Saldo Mensal, Saldos Contas, Compromissos Financeiros, Recebimentos Previstos
- Histórico Mov Financeiro, Histórico Saldo a Reconhecer

### Imports novos (a criar)
- Folha de Ponto PDF → frequencia_mensal (já vai nascer com a política aplicada)

## Tabelas que NÃO precisam dessa política

Tabelas de "estado atual" (não-temporais) ou cadastro:
- funcionarios, organograma, perfis, perfis_tipos
- centros_custo, plano_contas, cfop, classif_faturamento
- bonif_periodos, bonif_metas_empresa, bonif_metas_area, bonif_metas_profissional, bonif_meta_area_mes
- contas_bancarias, beneficios, impostos_rh
- medidas_disciplinares, avaliacao_desempenho (cadastros pontuais — mas têm `criado_em` pra histórico)
- Auditoria automática via `fn_auditar` cobre essas tabelas

## Tabelas com competência (regem-se pela política M24)

Já preparadas (M24): frequencia_mensal, os_evolucao_mensal, caixa_saldo_mensal, saldos_contas, os_custos_planejados, ordens_servico, estoque_detalhes, estoque_resumo, custo_direto_competencia, movimentos_caixa.

Pendentes de avaliação: orcamento_items, recebimentos_previstos, compromissos_financeiros, entradas_outras, saidas_outras, folha_pagamento, folha_pagamento_rubricas, receitas_custos, notas_fiscais, nf_os, saldo_reconhecer, movimentos.
