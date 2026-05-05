# Próxima Sessão — 3 frentes prioritárias

**Combinado em 2026-05-04 ao final da Entrega 13 (revisão UX/UI).**

## 1. Avaliar limpeza da base para carga em massa

Garantir que dados de início não estão poluídos antes de Juliana popular o sistema com dados reais em volume.

**Roteiro:**
- Listar contagens por tabela (órfãos, NULL crítico, duplicatas, ruído)
- **Tabelas-chave a auditar:**
  - `orcamentos` — 264 sem parceiro (esperado), 264 sem tipo_manual (esperado), nenhum com data NULL?
  - `movimentos` — todos com plano_contas_id NULL hoje (esperado, back-fill via importação)
  - `funcionarios` — 8 INATIVO sem data_demissao (Juliana decide caso a caso)
  - `centros_custo` — 15 com tipo_custo correto?
  - `plano_contas` — 41 direto + 15 indireto + 126 despesa + 328 NULL (receita/ativo/passivo) ✓
  - `perfis` — 2 ativos (Juliana admin, Natália operador)
  - `perfis_tipos` — 3 tipos (admin, operador, consulta) ✓
  - Tabelas Fluxo de Caixa todas vazias (esperado): `contas_bancarias`, `saldos_contas`, `recebimentos_previstos`, `entradas_outras`, `saidas_outras`, `caixa_saldo_mensal`, `compromissos_financeiros`
  - `folha_pagamento` vazia (esperado)
  - `os_evolucao_mensal` (importado da v11 — conferir consistência)
  - `receitas_custos` (importado da v11 — conferir consistência)
- **Dados legacy a olhar:** tabela `auditoria` (volume), `cfop` (590 códigos), `plano_contas` (510 contas)
- **Identificar lixo de testes:** dados fake que precisam apagar antes da carga real

## 2. Listar documentações necessárias para teste inicial

**Tipos de doc esperados (a serem produzidos como arquivos no `docs/`):**

- `MANUAL_USUARIO.md` — como acessar (URL produção + login + senha temporária + fluxo de redefinição)
- `ROTEIRO_CARGA.md` — ordem de importação dos templates (Plano de Contas → Funcionários → Orçamentos → Movimentos → Folha → Saldos)
- `CATALOGO_IMPORTACOES.md` — 13 templates aceitos com colunas obrigatórias, dicas e exemplos
- `GUIA_CLASSIFICACAO.md` — como decidir tipo_custo (direto/indireto/despesa) por CC e por conta do plano
- `MANUAL_BONIFICACAO.md` — como cadastrar metas (Empresa, Áreas, Profissional) + escala configurável
- `PERMISSOES_RLS.md` — quem pode o quê (admin / operador / consulta)
- `TROUBLESHOOTING.md` — o que fazer se import falhar, cache não invalidar, RLS bloquear

## 3. Roteiro de teste passo a passo

### A. Setup inicial
1. Login com email + senha
2. Trocar senha temporária se for primeira vez
3. Cadastrar/conferir contas bancárias (Itaú, BB, CEF, XP)
4. Definir tipo_custo dos 15 CCs em Configuração > Centros de Custo
5. Cadastrar tipos de perfil customizados se quiser

### B. Importações na ordem correta
1. Plano de Contas (já populado, conferir)
2. CFOP (já populado)
3. Funcionários (`despesas_folha_mensal` pra atribuir CC)
4. Orçamentos (com coluna parceiro)
5. Movimentos (com coluna `conta` pra classificar plano_contas_id)
6. Notas Fiscais
7. Receitas e Custos
8. Evolução % (Planilha de Produção)
9. Saída de Estoque (CPV-Matéria Prima)
10. Folha de Pagamento (mês a mês via Despesas Folha)
11. Saldos Mensais por conta
12. Compromissos Financeiros
13. Recebimentos Previstos (parcelas)
14. Contas Bancárias (cadastro)

### C. Validação por tela (em ordem de menu)
Percorrer todas as ~40 telas conferindo:
- Dashboard > Visão Geral, Programa de Bônus
- Receita > Por Apropriação, Por Faturamento
- Financeiro > Consolidado, Contas a Receber, Contas a Pagar
- Comercial > Vendas, Gestão de Faturamento, Notas Fiscais
- Custeio > 8 sub-telas
- Contabilidade Gerencial > 7 sub-telas
- Dep. Pessoal e RH > 7 sub-telas
- Configuração > 11 sub-telas
- Importar (rodapé): testar 1 linha de cada um dos 13 templates

### D. Modais de drill-down
- Vendas/Gestão Faturamento: clicar linha → modal orçamento
- Notas Fiscais: clicar → modal NF
- Lançamentos: clicar → modal movimento
- Despesas: clicar → modal (rc agregado ou mov drill-down)
- Bônus Individual: clicar → tela detalhe 5 cards
- Visão 12 meses: clicar célula → modal por tipo

### E. Permissões
- Login com perfil 'consulta' → testar que vê tudo mas não consegue editar
- Login com perfil 'operador' → testar que pode editar dados mas NÃO acessa Configuração nem cria/desativa usuários
- Edge Function `gerenciar-usuarios`: criar usuário fake, confirmar email chega, login, desativar, reativar

### F. Cascatas de invalidação
- Importar 1 linha de receitas_custos → conferir que Bônus atualiza
- Importar 1 linha de folha → conferir que Custo Indireto/Área + Bônus atualizam
- Importar 1 linha de compromissos → conferir que Visão 12m + Bônus ICC atualizam
- Importar 1 linha de saldo → conferir que Visão 12m + Bônus Caixa Positivo atualizam

## Frentes paralelas em aberto (não urgentes)

- SMTP próprio no Supabase (hoje usa padrão, ~30 emails/dia)
- Logo da Terra ainda incomoda Juliana — ajuste fino pendente
- Estender `coletarConflitosCfop()` (escopo a definir)
- 4 telas RH (Benefícios, Folha, Impostos): importação automática de folha pode ser melhorada
