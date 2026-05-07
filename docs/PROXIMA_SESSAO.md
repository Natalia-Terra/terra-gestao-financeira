# Próxima Sessão

**Atualizado em 2026-05-07 ao final da sessão (M18 + M19 Fase 1).**

## Estado do sistema

- ✅ M18 Plena Gestão de Faturamento — backend + frontend
- ✅ M19 Perfil Master + tela Reset
- ✅ M19 Fase 1 — Medidas Disciplinares (POL_001)
- ⏳ M19 Fase 2 — Avaliação de Desempenho (próxima a implementar)
- ⏳ M19 Fase 3 — Folha de Ponto (parser PDF — depende de amostra real)
- ⏳ M19 Fase 4 — Cálculo profissional do Bônus

## Frentes prioritárias

### 1. M19 Fase 2 — Avaliação de Desempenho

Critérios sugeridos (padrão de mercado, customizável depois):
- 5 dimensões com nota 1-5: Conhecimento técnico, Qualidade do trabalho, Comprometimento, Trabalho em equipe, Iniciativa
- Peso igual por default (cada dimensão = 20%)
- Nota geral = média ponderada
- Tela: cadastro de avaliação por funcionário/ciclo + listagem + drill-down

### 2. M19 Fase 3 — Folha de Ponto (depende de Juliana)

- Aguardando: amostra real do PDF consolidado (não a do Davi sozinho que ela mandou antes)
- Implementar: parser que lê todas as seções do PDF, extrai por funcionário (Nome+CPF) os totais agregados (trabalhadas, faltas, atrasos, extras), popula `frequencia_mensal`

### 3. M19 Fase 4 — Cálculo profissional do Bônus

- Função no banco que calcula a esfera Profissional (40%) baseada em:
  - Conduta (12,5%) — POL_001 + medidas_disciplinares
  - Faltas justificadas (6,25%) — frequencia_mensal
  - Atrasos (6,25%) — frequencia_mensal
  - Performance (15%) — avaliacao_desempenho
  - Penalidade -12,5% por faltas/atrasos não justificados
- Tela "Bônus Individual" passa a mostrar cálculo real (hoje só mostra metas)

### 4. Cargas iniciais de dados (Juliana precisa)

- Importar planilhas (Dashboard de Orçamentos, A Pagar x A Receber, Saída de Estoque, Histórico Mov Financeiro/Saldo a Reconhecer)
- Resolver pendências: 264 orçamentos sem parceiro, 8 INATIVO sem data_demissao, 12 Fixa+Solta

### 5. Refacs e qualidade (baixa prioridade)

- Substituir tela "Gestão de Faturamento" antiga pelo Dashboard rico após validação
- Habilitar Leaked Password Protection (Pro plan)
- SMTP próprio Supabase
- Logo Terra (ajuste visual)

## Como retomar

Próxima sessão: continua direto com M19 Fase 2 (Avaliação de Desempenho) ou aguarda Juliana mandar amostra de PDF Folha de Ponto pra Fase 3.
