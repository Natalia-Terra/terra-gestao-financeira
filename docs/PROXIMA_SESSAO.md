# Próxima Sessão — após teste de 2026-05-07

**Atualizado em 2026-05-07 ao final da sessão (M18 + M19 + Onda 3.3 + refacs incrementais).**

O sistema está integralmente pronto pra testes. Próximos passos partem do que a Juliana achar nos testes e das decisões de produto que faltam.

## Estado atual do sistema

- ✅ M18 Plena Gestão de Faturamento — backend + frontend completos
- ✅ M19 Perfil Master + tela Reset Completo
- ✅ Refacs incrementais (Notas Fiscais e Contas a Receber com fallback automático)
- ✅ Limpeza qualidade SQL (search_path em 4 funções, revoke de PUBLIC nas auth_pode_*)
- ✅ Configurações Auth reforçadas (min length 8, lowercase/uppercase/digits/symbols, secure password change, require current password)
- ✅ Docs operacionais na nuvem (docs/CHECKLIST_TESTE_FINAL.md, docs/AUDITORIA_TELAS.md, docs/DADOS_TESTE.md, docs/ROTEIRO_TESTE.md, docs/SPEC_FATURAMENTO.md)
- ✅ Migrações SQL históricas em migracoes/ (M18 e M19)

## Frentes pendentes (em ordem sugerida)

### 1. Pós-teste — correções (se houver)

Após o teste de hoje, qualquer bug encontrado vira primeira prioridade. Juliana traz a lista, eu corrijo via commits diretos.

### 2. Carga de dados em volume

Após testes OK, rodar os imports na ordem completa (não só amostra). Pode envolver:
- Reset Completo se quiser começar limpo
- Importar todos os 6 arquivos da bíblia + Aerolito + sistema fiscal
- Resolver as pendências de DADOS:
  - 264 orçamentos com parceiro NULL
  - 8 funcionários INATIVO sem data_demissao
  - 12 orçamentos com ruído Fixa+Solta
  - Cadastrar metas das áreas para 2026-1

### 3. M19 — Bônus Individual (próxima migração maior)

**Não iniciado. Depende de Juliana:**

- **Amostra do PDF Folha de Ponto consolidado** (1 PDF único com todos os funcionários — Juliana confirmou em 2026-05-07 que sistema gera assim)
- **Decisão sobre fontes** de `medidas_disciplinares` e `avaliacao_desempenho`:
  - Tela nativa de cadastro?
  - Import de planilha? Qual planilha?
- **Implementação:**
  - Parser de PDF (provavelmente pdf.js no front + lógica de regex pra extrair Nome+CPF+totais agregados por funcionário)
  - Telas/CRUD pra medidas e avaliações (se não importadas)
  - Lógica de cálculo profissional do bônus integrando frequencia + disciplinares + avaliações + metas
  - Possivelmente revisão do Programa de Bonificação 30/30/40 conforme `bonificacao_estrutura_proposta.md`

### 4. Refacs adicionais (baixa urgência)

- Avaliar substituir tela "Gestão de Faturamento" antiga pelo novo "Dashboard de Faturamento (rico)"
- Refac tela "Contas a Pagar" pra alinhar com `movimentos_caixa` (hoje usa `compromissos_financeiros`, conceitualmente são coisas diferentes mas merece convergência)

### 5. Operacional contínuo

- SMTP próprio no Supabase (se volume de emails crescer além de ~30/dia)
- Logo da Terra (ajuste fino visual ainda pendente)
- Habilitar Leaked Password Protection (requer upgrade pra plano Pro do Supabase)

## Decisões de produto que precisam acontecer antes da M19

1. Onde a Natália gera o PDF de Folha de Ponto consolidado? (sistema de ponto qual?)
2. As 3 fontes de Bônus Individual (frequência, disciplinares, avaliações) — todas via planilha/PDF? Ou tela nativa?
3. O Programa de Bonificação 30/30/40 da `bonificacao_estrutura_proposta.md` ainda vale ou foi revisto?

## Como retomar

Próxima sessão: traz lista de bugs/observações dos testes + decisões de produto pra M19.
Eu retomo direto sem preâmbulo, posso usar o token (se ainda válido) ou pedir um novo.
