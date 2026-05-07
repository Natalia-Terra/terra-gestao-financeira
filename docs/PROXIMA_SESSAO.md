# Próxima Sessão

**Atualizado em 2026-05-07 (final — M19 quase fechado).**

## Estado consolidado

✅ **M18 — Plena Gestão de Faturamento** (backend + frontend)
✅ **M19 Master + Reset** (perfil master, tela Reset Completo)
✅ **M19 Fase 1 — Medidas Disciplinares** (POL_001, graduação automática por ano civil)
✅ **M19 Fase 2 — Avaliação de Desempenho** (5 dimensões, escala 1-5)
✅ **M19 Fase 4 — Cálculo do Bônus completo** (4 RPCs, 3 esferas + pool + R$ estimado)
⏳ **M19 Fase 3 — Parser PDF Folha de Ponto** (bloqueada: aguarda amostra real)

## Único bloqueio externo

**Folha de Ponto consolidada (PDF)** — Juliana confirmou que sistema gera 1 PDF único com todos os funcionários. Falta mandar amostra real pra eu desenhar o parser. Sem isso, frequencia_mensal fica vazio e os componentes Faltas/Atrasos do bônus retornam 0% com flag `frequencia_disponivel: false` (UI já mostra "aguardando dados").

## Frentes que valem a pena na próxima sessão

### A) Tela "Bônus Individual" — visão consolidada (não só drill-down)

Hoje o cálculo é acessível via Funcionários > drill-down > "Calcular Bônus". Ideal: tela própria que lista TODOS funcionários com seu % atingido + valor estimado + filtro por organograma. Talvez gerando ranking.

### B) Cadastro guiado de Metas (M19 Fase 5)

A simulação tem sheets "Meta TC" e "Meta Área" detalhadas. Tela de Configuração que reproduz isso: define metas anuais, periodicidade, % do LL distribuído, escalas customizadas.

### C) Cargas iniciais de dados

Dependem de Juliana decidir começar:
- 4 imports da M18 (Dashboard de Orçamentos, A Pagar x A Receber, Saída de Estoque, Históricos da bíblia)
- Cadastro de meta Faturamento, Margem, Caixa em bonif_metas_empresa
- Cadastro de metas por área no organograma
- Frequência mensal (quando PDF for parseado)

### D) Refacs incrementais

- Substituir tela "Gestão de Faturamento" antiga pelo Dashboard rico (após validação)
- Refac "Contas a Pagar" pra cruzar movimentos_caixa PAGAR
- Configuração: tela pra ajustar pesos/escalas do bônus (hoje hardcoded nas funções SQL)

### E) Operacional

- Habilitar Leaked Password Protection (Pro plan)
- SMTP próprio
- Logo Terra (visual fino)

## Como retomar

Próxima sessão começa idealmente com:
1. Lista de bugs encontrados nos testes da Juliana
2. Amostra do PDF Folha de Ponto (pra Fase 3)
3. Decisão sobre ordem das frentes (A → B → C → D → E)

## Estatísticas finais da sessão 2026-05-07

- 10 migrações SQL: M18, M18b, M19, M19b, M19c, M20, M21, M22, M22b, M23
- 21 commits frontend
- ~5.000 linhas de código novas em app.js
- 6 telas novas + 4 templates de import + 4 funções RPC de bônus + drill-downs
- 0 toques no PC da Juliana (tudo via API GitHub e MCP Supabase)
- 0 ERRORs no advisor de segurança
