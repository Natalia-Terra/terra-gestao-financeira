# Dados de Entrada para Teste / Carga Inicial — Terra Conttemporânea

**Atualizado em:** 2026-05-07 (pós M18 + M19)
**Para:** Natália (operador) + Juliana (master) — checklist do que precisa ter em mãos pra alimentar o sistema com dados reais

> Use este checklist para preparar os dados antes da carga inicial. A ordem é importante (alguns imports dependem de outros).

---

## Bloco 0 — Acesso e setup

- [ ] **Credenciais** — Juliana e Natália já são `master` (configurado na M19, sessão de 2026-05-07). Ambas têm acesso a TUDO incluindo Reset Completo
- [ ] **Lista de contas bancárias** — Itaú, BB, CEF, XP e outras: nome, agência, conta, tipo (corrente/poupança/investimento)
- [ ] **Definição de tipo_custo dos 15 CCs** — `direto` / `indireto` / `despesa` (cadastrar em Configuração > Centros de Custo)
- [ ] **Decisão sobre 8 funcionários INATIVO sem `data_demissao`** — data exata ou marcar ATIVO se foi engano

## Bloco 1 — Reset (opcional — só se quiser começar limpa)

- [ ] **Configuração > ⚠ Reset Completo** — digita "RESET", confirma. Apaga tudo de negócio mantendo plano de contas, perfis, CCs, funcionários, organograma, listas

## Bloco 2 — Imports na ordem (a M18 destravou 4 novos)

### Estruturais (já populados — só conferir)
1. Plano de Contas (já populado — Configuração > Plano de Contas)
2. CFOP (já populado — Configuração > CFOP)
3. Funcionários (planilha "Despesas Folha Mensal" da v11) — Importar > Despesas Folha Mensal

### Comercial (NOVOS templates da M18)
4. **Orçamentos** — Importar > Orçamentos
   - Aceita planilha do Aerolito ("Orçamento Aprovado por Parceiro no Mês")
   - Sistema vai PERGUNTAR tipo_faturamento padrão (100, 0 ou X% se parcial)
5. **Dashboard de Orçamentos** — Importar > Dashboard de Orçamentos (NOVO)
   - Popula 3 destinos: orcamento_items + os_custos_planejados + ordens_servico
   - Habilita drill-downs e Dashboard de Faturamento (rico)
6. **Notas Fiscais** — Importar > Notas Fiscais
   - Sistema abre modal de revisão NF↔OS antes de gravar (cruza com ordens_servico)
   - Você marca/desmarca OSs sugeridas

### Financeiro (NOVO template da M18)
7. **A Pagar x A Receber (Dt. Baixa)** — Importar > A Pagar x A Receber (NOVO)
   - Linhas com plano 33.01.003.001.001 e 33.01.003.001.007 são classificadas automaticamente como Resultado Financeiro
   - Demais linhas RECEBER ficam pendentes de classificação manual em **Lançamentos de Caixa** (com bulk action)

### Custeio (refac da M18)
8. **Saída de Estoque** — Importar > Saída de Estoque (REFACTORED — agora popula 4 destinos)
   - CPV-Matéria Prima → estoque_detalhes + estoque_resumo + os_evolucao_mensal
   - CPV-Direto → custo_direto_competencia
9. **Receitas e Custos** (legacy v11) — Importar > Receitas e Custos
10. **Evolução %** — Importar > Evolução % (Planilha de Produção)

### Folha
11. **Folha de Pagamento mensal** — Importar > Despesas Folha Mensal

### Caixa
12. **Saldos Mensais por conta** — Importar > Saldos Mensais por Conta
13. **Compromissos Financeiros** — Importar > Compromissos Financeiros
14. **Recebimentos Previstos** — Importar > Recebimentos Previstos
15. **Contas Bancárias (cadastro)** — Importar > Contas Bancárias

### Históricos da bíblia (NOVOS templates da M18)
16. **Histórico Mov Financeiro** — Importar > Histórico Mov Financeiro (NOVO)
   - Aba "Mov Financeiro" do arquivo "30032026_Gestão Faturamento e Receita.xlsx"
17. **Histórico Saldo a Reconhecer** — Importar > Histórico Saldo a Reconhecer (NOVO)
   - Aba "Saldo a Reconhecer" do mesmo arquivo

## Bloco 3 — Pós-carga: classificar pendentes

- [ ] **Lançamentos de Caixa** (Financeiro) — classificar manualmente os RECEBER pendentes:
   - Selecionar várias linhas com checkbox
   - Escolher Natureza no dropdown bulk + (opcional) Orçamento
   - Clicar "Aplicar nas selecionadas"

## Bloco 4 — Dados que destravam Bônus Individual (M19 — pendente)

- [ ] **Frequência mensal** — vai ser via PDF consolidado (1 PDF com todos funcionários — parser PDF na M19)
- [ ] **Medidas disciplinares** — fonte/tela a definir
- [ ] **Avaliações de desempenho** — fonte/tela a definir
- [ ] **Metas das áreas para 2026-1** — definidas no organograma, cadastrar via RH > Bônus — Configuração

## Bloco 5 — Pendências legacy

- [ ] **264 orçamentos com `parceiro` NULL** — resolvido pela importação de Orçamentos (template aceita coluna PARCEIROS do Aerolito)
- [ ] **12 orçamentos com ruído Fixa+Solta** — botão Resolver na tela Configuração > Diagnóstico

---

## Onde validar após cada import

| Importou | Vai aparecer em |
|---|---|
| Orçamentos | Dashboard, Vendas, Gestão de Faturamento, Dashboard de Faturamento (rico) |
| Dashboard de Orçamentos | Dashboard de Orçamentos (Comercial), Dashboard de Faturamento (rico) — coluna Custo MP |
| Notas Fiscais | Comercial > Notas Fiscais, Dashboard de Faturamento (rico) — coluna NF Emitida |
| A Pagar x A Receber | Lançamentos de Caixa (Financeiro), Dashboard de Faturamento (rico) — colunas Adto/Recebimento |
| Saída de Estoque | Custo por OS (drill-down em itens MP), Custo Direto Via OS, Dashboard de Faturamento (rico) — coluna Custo MP |
| Histórico Mov Financeiro | Movimentos (Contabilidade Gerencial > Lançamentos), Despesas |
| Histórico Saldo a Reconhecer | Receita > Saldo a Reconhecer (também recalculado em tempo real pela view) |
