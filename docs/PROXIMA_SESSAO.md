# Próxima Sessão

**Atualizado em 2026-05-07 noite — pós M24 (Política de Histórico).**

## Estado consolidado

✅ M18 — Plena Gestão de Faturamento
✅ M19 Master + Reset
✅ M19 Fase 1 — Medidas Disciplinares
✅ M19 Fase 2 — Avaliação de Desempenho
✅ M19 Fase 4 — Cálculo do Bônus completo (4 RPCs)
✅ M24 — Política de Histórico (estrutura aplicada)

## Bloqueios externos (depende de Juliana)

1. **PDF Folha de Ponto consolidado** — destrava M19 Fase 3 + parser. Decisões já registradas:
   - Periodicidade: livre, sob demanda
   - Match por CPF
   - Funcionários sem ponto: importa o resto + LISTA DE EXCEÇÃO obrigatória
   - Política de histórico: SEMPRE append + competência (sem sobrescrever)

2. **Cadastrar metas iniciais** — em bonif_metas_empresa (faturamento, margem, caixa) e bonif_metas_area
3. **Importar dados reais** — 4 imports da M18

## Frentes técnicas pra próximas sessões

### M25 — Refac dos imports existentes pra Política de Histórico

Atualmente 10 tabelas têm colunas `vigente`/`import_id` (M24) MAS os imports continuam usando UPSERT. Refatorar pra:
- Cada import → entrada em `imports_historico`
- Novos registros: vigente=true + import_id
- Registros do mesmo período: vigente=false
- Funções de cálculo: filtrar vigente=true

Imports a refatorar:
- Saída de Estoque, Dashboard de Orçamentos, A Pagar x A Receber
- Caixa Saldo Mensal, Saldos Contas, Compromissos, Recebimentos Previstos
- Histórico Mov Financeiro, Histórico Saldo a Reconhecer

### M26 — Tela "Histórico de Imports"

Lista entries de `imports_historico` com filtros (tipo, competência, período).
Drill-down: ver registros vigentes vs não-vigentes daquele import.
Permite "reverter" um import (marca os registros dele como vigente=false e re-marca o anterior como vigente=true).

### M19 Fase 3 — Parser PDF Folha de Ponto

Quando Juliana mandar amostra real:
1. Cria entrada em `imports_historico`
2. Parser separa por seção (Nome+CPF)
3. Extrai totais agregados
4. Lista de exceção: funcionários ATIVOS que NÃO apareceram no PDF
5. Insere em `frequencia_mensal` com vigente=true + import_id
6. Marca registros anteriores do mesmo (funcionario, mes_ref) como vigente=false

### Outras frentes (sem urgência)

- Tela "Bônus Individual" consolidada (lista todos com cálculo)
- Tela de Configuração de Metas (Meta TC e Meta Área)
- Refac "Gestão de Faturamento" → Dashboard rico
- SMTP próprio, logo Terra

## Estatísticas finais 2026-05-07

- 11 migrações SQL (M18, M18b, M19, M19b, M19c, M20, M21, M22, M22b, M23, M24)
- 22+ commits frontend
- ~5.500 linhas novas em app.js
- 0 ERROR no advisor; 5 WARN arquiteturais aceitos
- 0 toques no PC da Juliana
- M19 quase fechado (Fase 3 aguarda PDF)
- Política arquitetural "nunca sobrescrever" estabelecida e infraestrutura pronta
