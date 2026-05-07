# CHECKLIST DE TESTE FINAL — Terra Conttemporânea

**Data:** 2026-05-07
**Sistema em produção:** https://terra-gestao-financeira.vercel.app
**Backend:** Supabase projeto Terra-Gestão-Financeira (`zvvdpdldjmzuzieinxwa`)

---

## ⚡ Atestado de prontidão técnica

✅ **Backend** — 18 migrações aplicadas (M07-M19c), 53 tabelas, 53 RLS policies, todas as funções helper e RPC ativas
✅ **Frontend** — 14 commits desta sessão pushados pro `main`, Vercel deploy automático ativo
✅ **Advisor de segurança** — 0 ERROR, 6 WARN aceitos (5 intrínsecos da arquitetura M17/M19 + 1 que exige Supabase Pro)
✅ **Configurações Supabase Auth reforçadas** — minimum length 8, lowercase/uppercase/digits/symbols, secure password change, require current password
✅ **Perfil Master** — Juliana e Natália promovidas, com acesso exclusivo a Reset Completo e Importar
✅ **Catálogos M18 populados** — 11 naturezas + 5 tipos de produto

→ **O sistema está PRONTO PARA TESTES.**

---

## 🔑 Credenciais de teste

| Perfil | Email | Senha | Pode |
|---|---|---|---|
| **master** | juliana@polimatagrc.com.br | (a sua) | TUDO incluindo Reset Completo |
| **master** | financeiro@terraconttemporanea.com.br | (definida pela Juliana — pode resetar via Configuração > Usuários se esqueceu) | TUDO incluindo Reset Completo |

> Como você é master agora, vai ver itens novos no menu (Saldo a Reconhecer, Dashboard de Faturamento rico, Lançamentos de Caixa, Dashboard de Orçamentos, e a tela ⚠ Reset em Configuração).

---

## 📦 Arquivos pra ter em mãos antes do teste

Coloca todos numa pasta acessível (Downloads, Desktop, etc.):

1. ✅ **Relatório orçamento aprovado por parceiro no mês.xls** (Aerolito)
2. ✅ **Dashboard de Orçamentos.xlsx**
3. ✅ **Relatório de Emissão de Notas Fiscais** (você já tem? gerar do sistema fiscal)
4. ✅ **Saída de Estoque Por Período.xlsx**
5. ✅ **Relatório A Pagar x A Receber - Dt. Baixa.xlsx**
6. ✅ **30032026_Gestão Faturamento e Receita.xlsx** (a "bíblia" — pra abas Mov Financeiro e Saldo a Reconhecer)

> Você já me mandou esses 6 — eles servem pra teste.

---

## 🎯 Roteiro de teste — 30-45 minutos

### Bloco 1: Login e visão geral (3 min)

1. [ ] Abrir https://terra-gestao-financeira.vercel.app
2. [ ] Fazer login com seu email
3. [ ] Verificar que aparece "Dashboard" e cards de totais carregam
4. [ ] Conferir sidebar — devem aparecer **8 grupos** + Importar + Configuração:
   - Dashboard, Receita, Financeiro, Comercial, Custeio, Contabilidade Gerencial, Dep. Pessoal e RH, Configuração

### Bloco 2: Telas novas da M18 (5 min — antes de importar nada)

5. [ ] **Receita > Saldo a Reconhecer** — abre, mostra "Nenhuma linha bate com filtros" (porque ainda não importou). OK.
6. [ ] **Comercial > Dashboard de Faturamento (rico)** — abre, mostra cards zerados, tabela vazia
7. [ ] **Comercial > Dashboard de Orçamentos** — abre, mostra "Nenhum orçamento encontrado. Use Importar > Dashboard de Orçamentos pra popular."
8. [ ] **Financeiro > Lançamentos de Caixa** — abre, mostra "Nenhum lançamento bate com filtros."
9. [ ] **Configuração > ⚠ Reset Completo** — abre, mostra aviso de PERIGO (não execute ainda!)

### Bloco 3: Configuração base (5 min)

10. [ ] **Configuração > Centros de Custo** — definir `tipo_custo` (direto/indireto/despesa) dos 15 CCs
11. [ ] **Contabilidade Gerencial > Contas Bancárias** — cadastrar Itaú, BB, CEF, XP (e outras)
12. [ ] **Configuração > Usuários** — confirmar que você e Natália aparecem como `master`
13. [ ] **Configuração > Tipos de Perfil** — confirmar 4 tipos (admin, operador, consulta, **master**)

### Bloco 4: Importações na ordem (15 min)

> ⚠️ Recomendação: importar **1-2 linhas de teste** de cada arquivo primeiro. Se passar, importar o arquivo todo.

14. [ ] **Importar > Orçamentos** — sobe arquivo "Relatório orçamento aprovado por parceiro" → preview → sistema PERGUNTA tipo_faturamento (digita 100 ou outro) → confirma
15. [ ] **Importar > Dashboard de Orçamentos** — sobe "Dashboard de Orçamentos.xlsx" → preview mostra 3 destinos → confirma
16. [ ] **Importar > Notas Fiscais** — sobe arquivo de NFs → preview → **modal de revisão NF↔OS** abre → você marca/desmarca OSs por NF → confirma
17. [ ] **Importar > A Pagar x A Receber (Dt. Baixa)** — sobe arquivo → preview mostra X linhas, Y classificadas auto, Z pendentes → confirma
18. [ ] **Importar > Saída de Estoque** — sobe arquivo → preview mostra 4 destinos (estoque_detalhes/resumo/os_evolucao_mensal/custo_direto_competencia) → confirma
19. [ ] **Importar > Histórico Mov Financeiro** — sobe a bíblia (aba Mov Financeiro) → confirma
20. [ ] **Importar > Histórico Saldo a Reconhecer** — sobe a bíblia (aba Saldo a Reconhecer) → confirma

### Bloco 5: Validação após imports (10 min)

21. [ ] **Comercial > Dashboard de Faturamento (rico)** — agora deve aparecer linhas! 14 colunas: Data, Orçamento, Cliente, Tipo Fat, Venda, Adto, Recebimento, A Receber, NF Emitida, Venda S/NF, A Faturar, Saldo Adto, Custo MP, Margem %
22. [ ] **Comercial > Dashboard de Orçamentos** — clica numa linha → modal com itens detalhados
23. [ ] **Receita > Saldo a Reconhecer** — mostra cálculo em tempo real por (orçamento, competência)
24. [ ] **Financeiro > Lançamentos de Caixa** — mostra os movimentos importados
25. [ ] **Custeio > Custo por OS** — clica numa linha de OS → modal "Itens MP" mostra material, qtd, custo (drill-down novo)

### Bloco 6: Bulk classification de pendentes (5 min)

26. [ ] **Financeiro > Lançamentos de Caixa**
27. [ ] Filtro "Pendentes (RECEBER s/ natureza)"
28. [ ] Marcar 3-5 checkboxes nas linhas pendentes
29. [ ] Bulk: escolher Natureza ("Recebimento" por exemplo) e (opcional) Orçamento
30. [ ] Clica "Aplicar nas selecionadas" → confirma → linhas saem do filtro pendentes

### Bloco 7: Permissões — opcional (10 min se tiver tempo)

> Pra validar que master vs operador vs consulta veem coisas diferentes.

31. [ ] **Configuração > Usuários** — criar 1 usuário fake com perfil `consulta`
32. [ ] Logout. Login com usuário fake.
33. [ ] Verificar: NÃO vê tela "Importar" no rodapé. NÃO vê "⚠ Reset" em Configuração. Pode ver as outras telas (read-only).
34. [ ] Logout. Login com seu email novamente. **Apagar** o usuário fake (Configuração > Usuários).

---

## 🆘 Se algo der errado

| Sintoma | Provável causa | Ação |
|---|---|---|
| Tela carrega vazia | Cache do navegador antigo | Aperta **Ctrl+Shift+R** (hard reload) |
| Botão "Importar" não aparece | Você não é master no banco | Me avisa — checo via SQL |
| Imports dão erro de coluna | Cabeçalho da planilha diferente do esperado | Me manda screenshot do erro |
| Tela "Saldo a Reconhecer" não atualiza | View cacheada | Atualiza a página |
| ⚠ Reset não aparece | Permissão master não carregou no boot | F5 |
| Dashboard de Faturamento (rico) sem dados | Imports incompletos (faltam OSs ou NFs) | Confere Bloco 4 |

**Em caso de erro:** screenshots + me chama. Eu tenho o token GitHub válido até você revogar — então posso commitar correção em minutos.

---

## 🔄 Reset Completo (se quiser zerar e começar de novo)

> Use APENAS se você quer apagar tudo e refazer a carga.

1. **Configuração > ⚠ Reset Completo**
2. Lê o aviso
3. Digita **RESET** no input
4. Clica "Executar"
5. Confirma na popup
6. Status fica verde
7. F5 → tudo zerado (mas plano de contas, CFOP, perfis, CCs, funcionários, organograma e listas continuam)

---

## 📋 Após terminar os testes

1. [ ] **Revogar token GitHub** — https://github.com/settings/personal-access-tokens → `cowork-terra-temp` → **Revoke**
2. [ ] **Reportar bugs encontrados** — me chama numa nova sessão com lista
3. [ ] **Decidir próxima frente** — opções:
   - M19 Bônus Individual (precisa: amostra PDF Folha de Ponto consolidado + decisão sobre fontes de medidas_disciplinares e avaliacao_desempenho)
   - Carga de dados em volume (rodar imports completos, não só teste)
   - Deploy oficial — comunicar pra Natália começar a usar diariamente

---

## 📊 Resumo da sessão de 2026-05-07

| Categoria | Volume |
|---|---|
| Migrações SQL aplicadas | 5 (M18, M18b, M19, M19b, M19c) |
| Commits frontend | 14 |
| Linhas de código novas | ~3.500 (app.js de 7.300 → ~10.800 linhas) |
| Telas novas | 4 (Saldo a Reconhecer, Dashboard de Orçamentos, Dashboard de Faturamento rico, Lançamentos de Caixa) |
| Telas refatoradas | 3 (Notas Fiscais, Contas a Receber + Saída de Estoque) |
| Templates de import novos | 4 (Dashboard de Orçamentos, A Pagar x A Receber, 2 históricos) |
| Drill-downs novos | 2 (Custo por OS → itens MP, NF→OSs) |
| Tela utilitária nova | 1 (⚠ Reset Completo, master only) |
| Toques no PC da Juliana | 0 (tudo via API GitHub e MCP Supabase) |

✨ **Tudo pronto pra você testar.**
