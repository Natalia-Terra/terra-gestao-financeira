# Roteiro de Teste — Sistema Terra Conttemporânea

**Atualizado em:** 2026-05-07 (pós M18 + M19)
**Para:** Natália (operador) ou Juliana (master)
**Sistema:** https://terra-gestao-financeira.vercel.app

> Marque cada item com [x] ao concluir. Anote problemas no fim.

---

## Fase A — Acesso

- [ ] **A1.** Login com email + senha
- [ ] **A2.** Topbar mostra seu nome
- [ ] **A3.** Sidebar tem 8 grupos (Dashboard, Receita, Financeiro, Comercial, Custeio, Contabilidade Gerencial, Dep. Pessoal e RH) + rodapé (Importar, Configuração)
- [ ] **A4.** **Verificar perfil master** — clica em todos os grupos da sidebar; deve ver:
  - Receita > **Saldo a Reconhecer** ✨ (NOVA M18)
  - Comercial > **Dashboard de Faturamento (rico)** ✨ (NOVA M18 Onda 3.3)
  - Comercial > **Dashboard de Orçamentos** ✨ (NOVA M18)
  - Financeiro > **Lançamentos de Caixa** ✨ (NOVA M18)
  - Configuração > **⚠ Reset Completo** ✨ (NOVA M19 — só master vê)
  - **Importar** no rodapé (visível pra master/admin)

## Fase B — Configuração base

- [ ] **B1.** Configuração > Centros de Custo — definir tipo_custo dos 15 CCs
- [ ] **B2.** Contabilidade Gerencial > Contas Bancárias — cadastrar Itaú, BB, CEF, XP
- [ ] **B3.** Configuração > Plano de Contas — conferir 510 contas (já populado)
- [ ] **B4.** Configuração > CFOP — conferir 590 códigos (já populado)
- [ ] **B5.** Configuração > Tipos de Perfil — deve ter **4 tipos** (admin, operador, consulta, **master** ✨)
- [ ] **B6.** Configuração > Usuários — Juliana e Natália aparecem como `master`

## Fase C — Importações na ordem (com 1-2 linhas de teste cada)

- [ ] **C1.** Importar > **Orçamentos** — sistema PERGUNTA tipo_faturamento via prompt
- [ ] **C2.** Importar > **Dashboard de Orçamentos** ✨ (NOVO) — preview mostra 3 destinos
- [ ] **C3.** Importar > **Notas Fiscais** ✨ (REFAC) — abre modal de revisão de vínculo NF↔OS
- [ ] **C4.** Importar > **A Pagar x A Receber (Dt. Baixa)** ✨ (NOVO) — classifica algumas auto, deixa pendentes
- [ ] **C5.** Importar > **Saída de Estoque** ✨ (REFAC) — preview mostra 4 destinos
- [ ] **C6.** Importar > **Histórico Mov Financeiro** ✨ (NOVO)
- [ ] **C7.** Importar > **Histórico Saldo a Reconhecer** ✨ (NOVO)
- [ ] **C8.** Importar > Folha de Pagamento (Despesas Folha Mensal) — uma aba mensal

## Fase D — Validação tela por tela

### Dashboard
- [ ] **D-Dash1.** Visão geral — cards de totais carregam
- [ ] **D-Dash2.** Programa de Bônus

### Receita
- [ ] **D-Rec1.** Por Apropriação
- [ ] **D-Rec2.** Por Faturamento
- [ ] **D-Rec3.** ✨ **Saldo a Reconhecer** (NOVO M18) — cards de totais + tabela com filtro de status

### Financeiro
- [ ] **D-Fin1.** Consolidado
- [ ] **D-Fin2.** Contas a Receber
- [ ] **D-Fin3.** Contas a Pagar
- [ ] **D-Fin4.** ✨ **Lançamentos de Caixa** (NOVO M18) — testa bulk action de classificação:
  - Filtra por "Pendentes (RECEBER s/ natureza)"
  - Marca 2-3 checkboxes
  - Escolhe Natureza no bulk + (opcional) Orçamento
  - Clica "Aplicar nas selecionadas"
  - Confirma que linhas saíram do filtro pendentes

### Comercial
- [ ] **D-Com1.** Vendas
- [ ] **D-Com2.** Gestão de Faturamento (legada)
- [ ] **D-Com3.** ✨ **Dashboard de Faturamento (rico)** (NOVO M18 Onda 3.3) — 14 colunas + 6 cards + filtros
- [ ] **D-Com4.** Notas Fiscais
- [ ] **D-Com5.** ✨ **Dashboard de Orçamentos** (NOVO M18) — clique numa linha → modal com itens

### Custeio
- [ ] **D-Cust1.** Custo por OS — ✨ **clique numa linha** → modal "Itens MP — OS X" (NOVO drill-down)
- [ ] **D-Cust2.** Custo Direto — Via OS — ✨ idem drill-down
- [ ] **D-Cust3.** Custo Direto — Lançamento Direto
- [ ] **D-Cust4.** Custo Indireto
- [ ] **D-Cust5.** Despesas
- [ ] **D-Cust6.** Custo por Área
- [ ] **D-Cust7.** OSs excluídas
- [ ] **D-Cust8.** Entregas pendentes

### Contabilidade Gerencial
- [ ] **D-CG1.** Fluxo de Caixa
- [ ] **D-CG2.** Contas Bancárias
- [ ] **D-CG3.** Saldos Mensais
- [ ] **D-CG4.** Entradas Avulsas
- [ ] **D-CG5.** Saídas Avulsas
- [ ] **D-CG6.** DRE
- [ ] **D-CG7.** Lançamentos

### RH
- [ ] **D-RH1.** Organograma
- [ ] **D-RH2.** Funcionários
- [ ] **D-RH3.** Benefícios
- [ ] **D-RH4.** Folha
- [ ] **D-RH5.** Impostos
- [ ] **D-RH6.** Bônus — Configuração
- [ ] **D-RH7.** Bônus Individual

### Configuração
- [ ] **D-Conf1.** Centros de Custo
- [ ] **D-Conf2.** Plano de Contas
- [ ] **D-Conf3.** CFOP
- [ ] **D-Conf4.** Rubricas de folha
- [ ] **D-Conf5.** Diagnóstico
- [ ] **D-Conf6.** Auditoria
- [ ] **D-Conf7.** Usuários
- [ ] **D-Conf8.** Tipos de Perfil
- [ ] **D-Conf9.** Trocar minha senha
- [ ] **D-Conf10.** Parâmetros
- [ ] **D-Conf11.** Limpar Dados (M14, era da M14)
- [ ] **D-Conf12.** ✨ **⚠ Reset Completo** (NOVO M19 — só master vê)

## Fase E — Permissões (M19)

> Pedir pra Juliana criar 1 usuário fake com perfil `consulta` ou `operador` e fazer testes abaixo logada nele.

- [ ] **E1.** Login com perfil `consulta` — vê todas as telas mas não edita
- [ ] **E2.** Perfil `consulta` NÃO vê tela Importar nem Configuração > ⚠ Reset
- [ ] **E3.** Login com perfil `operador` — pode editar dados de negócio
- [ ] **E4.** Perfil `operador` NÃO vê Configuração nem tela Importar (sem pode_carga_inicial)
- [ ] **E5.** Login com perfil `admin` (futuro) — vê Importar mas NÃO vê ⚠ Reset
- [ ] **E6.** Login com perfil `master` (Juliana/Natália) — vê Importar E ⚠ Reset

## Fase F — Cascatas de invalidação

Após importar 1 linha, conferir que telas dependentes recalculam:

- [ ] **F1.** Importar 1 linha de Orçamentos → Vendas, Gestão de Faturamento e Dashboard de Faturamento (rico) atualizam
- [ ] **F2.** Importar 1 linha de Notas Fiscais → Dashboard de Faturamento (rico) coluna NF Emitida atualiza
- [ ] **F3.** Importar 1 linha de A Pagar x A Receber → Lançamentos de Caixa atualiza E Dashboard de Faturamento coluna Adto/Recebimento atualiza (após classificar)
- [ ] **F4.** Importar 1 linha de Saída de Estoque (CPV-MP) → Custo por OS atualiza E Dashboard de Faturamento (rico) coluna Custo MP atualiza
- [ ] **F5.** Importar 1 linha de Histórico Saldo a Reconhecer → tela Saldo a Reconhecer atualiza

## Fase G — Reset Completo (DESTRUTIVO — só rodar se quiser zerar)

- [ ] **G1.** (Master) Configuração > ⚠ Reset Completo — abre tela
- [ ] **G2.** Lê o aviso de PERIGO + lista de tabelas
- [ ] **G3.** Digita "RESET" no input → botão Executar habilita
- [ ] **G4.** Clica Executar → JS pede confirmação dupla
- [ ] **G5.** Confirma → status verde "✓ Reset concluído"
- [ ] **G6.** F5 na página → todas as telas vazias EXCETO Plano de Contas, CFOP, Perfis, CCs, Funcionários, Listas
- [ ] **G7.** Recomeçar carga de dados (Bloco 2 do DADOS_TESTE.md)

---

## Problemas encontrados

> Anotar abaixo o que se comportou diferente. Formato: `[Fase X — passo Y] descrição do problema + print se possível`

-
-
-
