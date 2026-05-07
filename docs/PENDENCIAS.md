# Pendências — Terra Conttemporânea

**Atualizado:** 2026-05-07 (pós M19 Fase 1 — Medidas Disciplinares)

## ✅ Concluído nesta sessão

- M18 Plena Gestão de Faturamento (backend + frontend completos)
- M19 Perfil Master + tela Reset
- M19 Fase 1 — Medidas Disciplinares (POL_001)
- Limpeza de qualidade SQL
- Refacs incrementais com fallback (NFs, Recebimentos)

## Pendências de DEV abertas

### M19 — em andamento (Bônus Individual)

- ✅ Fase 1 — Medidas Disciplinares (POL_001) — pronto
- ⏳ **Fase 2 — Avaliação de Desempenho** — implementação em curso
- ⏳ **Fase 3 — Frequência Mensal (parser PDF Folha de Ponto)** — depende de Juliana mandar amostra do PDF consolidado real
- ⏳ **Fase 4 — Cálculo profissional do Bônus** — integrar Conduta (POL_001) + Frequência + Avaliação + Performance + Penalidades

### Decisões pendentes pra finalizar M19

- Regra exata de pontuação da **Conduta** no Bônus (sugestão registrada: sem medidas=12,5% pleno, cada Verbal=-25% do peso, Escrita=-50%, Suspensão zera, Demissão zera todo profissional)
- Critérios e pesos da **Avaliação de Desempenho** (sugestão padrão: 5 dimensões — técnico, qualidade, comprometimento, equipe, iniciativa, todas 1-5, peso igual por padrão)
- Formato consolidado do **PDF Folha de Ponto** — Juliana vai mandar amostra real

### Refacs incrementais (baixa urgência)

- Tela "Notas Fiscais" — refac já feita com FALLBACK (lê de `notas_fiscais` rica se houver dados, senão fallback pra `movimentos`). Sem ação extra necessária
- Tela "Contas a Receber" — idem (fallback pra movimentos_caixa)
- Tela "Contas a Pagar" — não refatorada (compromissos_financeiros tem propósito distinto). Tela "Lançamentos de Caixa" cobre o caso movimentos_caixa
- Substituir tela "Gestão de Faturamento" antiga pelo novo "Dashboard de Faturamento (rico)" — depende de validação visual

### Qualidade restante

- `auth_leaked_password_protection` desabilitado (config Auth dashboard, requer plano Pro do Supabase)
- 5 warnings `0029 authenticated_security_definer` em auth_pode_*/fn_reset — INTRÍNSECOS da arquitetura M17/M19. Tradeoff aceito.

### Não-urgentes (longa data)

- SMTP próprio no Supabase
- Logo da Terra (ajuste fino visual)
- Estender `coletarConflitosCfop()` para outras fontes
- 4 telas de RH (Benefícios, Folha, Impostos): importação automática refinada
- Visão 12m com Folha "projetada" futura

## Pendências de DADOS

- 264 orçamentos com `parceiro` NULL — usar template Orçamentos refatorado
- 8 funcionários INATIVO sem `data_demissao` — caso a caso
- 12 orçamentos com ruído Fixa+Solta — botão Resolver na tela Diagnóstico
- Frequência mensal — depende do parser PDF (M19 Fase 3)
- Avaliações de desempenho — depende da tela de cadastro (M19 Fase 2)
- Metas das áreas para 2026-1 — cadastrar via RH > Bônus — Configuração
- Importar histórico do Excel "30032026_Gestão Faturamento e Receita.xlsx"
- Importar Dashboard de Orçamentos.xlsx
- Importar Saída de Estoque Por Período.xlsx
- Importar A Pagar x A Receber - Dt. Baixa.xlsx
