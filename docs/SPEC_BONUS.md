# SPEC do Bônus

**Fonte:** Simulação Bônus.xlsx (2026-05-07)
**Implementação:** M22 (fn_calcular_bonus_profissional)

## 3 Esferas (100%)
- Profissional 40%
- Área 30%
- Empresa 30%

## ESFERA PROFISSIONAL (40%) — IMPLEMENTADA

### Conduta (12,5%) — binário
- 0 medidas disciplinares no período → 12,5%
- 1+ medidas → 0%

### Avaliação (15%)
- Nota 1: 0% | Nota 2: 0%
- Nota 3: 15% (atende) | Nota 4: 16,5% (1.1x)
- Nota 5: 19,5% (1.3x)

### Faltas Justificadas (6,25%)
- 0-3 no semestre: 6,25% | 4+: 0%

### Atrasos (6,25%) — escala decrescente
- 0-12: 6,25% | 13: 5% | 14: 3,75%
- 15: 2,5% | 16: 1,25% | 17+: 0%

### Faltas Injustificadas — penalidade
- 1+ no semestre: -12,5% (deduz)
- 0: 0%

## ESFERA ÁREA (30%) — pendente
6/6 meses=30% | 5/6=25% | 4/6=20% | 3/6=15% | 2/6=10% | 1/6=5%

## ESFERA EMPRESA (30%) — pendente
- Faturamento Bruto (10%): >=100%=10% | 90-99%=8% | 80-89%=5% | <80%=0%
- Margem Líquida (10%): atingiu meta em quantos meses, mesma escala da Área
- Caixa+ICC (10%): 5% caixa positivo + 5% ICC >=6m

## Pool financeiro
- Pool = X% do LL (ex: 10%)
- Multiplicador margem: 12%=1.2x | 11%=1.1x | 10%=1.0 | 9%=0.5 | 8%=0.3 | <8%=0
- Por pessoa = (Pool * mult) / N elegíveis
- Bônus = valor_base * pct_total_atingido

## API
fn_calcular_bonus_profissional(funcionario_id, p_inicio, p_fim) -> JSONB

Testada em 2026-05-07. Retorna esfera Profissional + breakdown por componente.
