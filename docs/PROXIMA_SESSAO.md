# Próxima Sessão — Frentes prioritárias

**Atualizado em 2026-05-07 ao final da sessão (M18 + M19 + limpeza qualidade).**

A M18 está fechada (Plena Gestão de Faturamento) e o Perfil Master + tela Reset estão prontos. Restam 4 frentes:

## 1. Refacs incrementais (baixa urgência)

As telas atuais funcionam. Refatorar quando você quiser substituir as fontes antigas pelas novas:

- **Tela "Notas Fiscais"** — ler de `notas_fiscais` rica (com OSs via `nf_os`) ao invés de `movimentos` natureza='Nota Fiscal'
- **Tela "Contas a Receber"** — ler de `movimentos_caixa` (filtro RECEBER + classificação)
- **Tela "Contas a Pagar"** — ler de `movimentos_caixa` (filtro PAGAR) + manter `compromissos_financeiros` pra futuros
- **Substituir a tela antiga "Gestão de Faturamento"** pelo novo "Dashboard de Faturamento (rico)" — depois de validação visual com a Juliana

## 2. M19 — Bônus Individual (cálculo profissional)

- **Parser de PDF de Folha de Ponto consolidado** (1 PDF único com todos os funcionários — Juliana confirmou em 2026-05-07) → `frequencia_mensal`
- Definir fontes para `medidas_disciplinares` e `avaliacao_desempenho` (talvez tela de cadastro nativo)
- Implementar lógica de cálculo profissional no Bônus Individual (hoje só usa metas)

## 3. Carga inicial de dados

Antes de o sistema ir pra operação, carregar os dados reais:

- **Reset completo da base** (você como master clica em Configuração > ⚠ Reset Completo) — opcional, se quiser começar limpa
- **Importar Excel "30032026_Gestão Faturamento e Receita.xlsx"** via novos templates históricos
- **Importar Dashboard de Orçamentos.xlsx**
- **Importar Saída de Estoque Por Período.xlsx**
- **Importar A Pagar x A Receber - Dt. Baixa.xlsx** + classificar pendentes na tela Lançamentos de Caixa
- Resolver pendências de DADOS listadas em PENDENCIAS.md (264 orçamentos sem parceiro etc)

## 4. Atualizar AUDITORIA_TELAS.md / DADOS_TESTE.md / ROTEIRO_TESTE.md

Os 3 documentos que estão na pasta local da Juliana (não no repo) foram gerados antes da M18 e estão desatualizados — refletir as 7 telas novas e os 4 templates de import novos. Pode ser feito numa sessão de polimento.

## Próximo evento crítico (sugestão)

Sessão de **carga inicial + validação** — você roda os 4 imports na ordem certa, eu acompanho ajustando o que precisar. Reset opcional no início se quiser começar do zero.
