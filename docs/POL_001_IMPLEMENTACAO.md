# POL_001 — Implementação no Sistema

**Documento de referência:** "3. POL_001_v1 - Política de Medidas Disciplinares_v1.docx" (versão 001, aprovada em 06/02/2025)
**Implementado em:** 2026-05-07 (M20 SQL + commit fc832262d5)

## Mapeamento Política → Sistema

### Tipos de Medida (POL_001 Item 3)
- Advertência Verbal → `tipo_medida='Advertência Verbal'`
- Advertência Escrita → `tipo_medida='Advertência Escrita'`
- Suspensão (1-30 dias) → `tipo_medida='Suspensão'` + `dias_suspensao` (CHECK 1-30) + `data_inicio_suspensao` + `data_fim_suspensao`
- Demissão por Justa Causa → `tipo_medida='Demissão por Justa Causa'` + opção de marcar funcionário como INATIVO

### Graduação Automática (POL_001 Item 4)

Implementada na função JS `sugerirTipoMedida(funcionarioId, gravidade)` que conta ocorrências do funcionário no **ano civil atual** (jan-dez) por gravidade e aplica:

| Gravidade da nova ocorrência | Histórico no ano | Sugestão |
|---|---|---|
| Leve | 1ª | Advertência Verbal |
| Leve | 2ª | Advertência Escrita |
| Leve | 3ª+ | Suspensão |
| Moderada | 1ª | Advertência Escrita |
| Moderada | 2ª+ | Suspensão |
| Grave | 1ª | Suspensão |
| Grave | 2ª+ | Demissão por Justa Causa |
| Muito Grave | qualquer | Demissão por Justa Causa |

Sistema mostra a sugestão no modal e permite override manual com botão "Aplicar".

### Registro (POL_001 Item 5)

Toda medida registra obrigatoriamente: funcionário, data, gravidade, tipo, descrição da infração.
Opcionais: gestor responsável, data/hora da ciência do colaborador, observação da ciência, observações gerais.

### Status

- `aplicada` (default)
- `cancelada` (substitui DELETE — soft delete preservando histórico)
- `contestada` (em revisão pelo Comitê de Gestão e Cultura — POL_001 Item 6)

### Análise (POL_001 Item 6)

Tela de listagem com filtros (gravidade, tipo, ano) + cards de totais permite ao Comitê analisar tendências.
Drill-down clicável em cada medida abre modal de edição/visualização.

## Quem pode cadastrar

Conforme decisão da Juliana em 2026-05-07: **master, admin e (futuramente) profissional de RH**.
Implementado via RLS: qualquer perfil com `pode_modificar=true` pode cadastrar/editar.
Operadores e perfil Consulta: podem apenas visualizar.

## Integração com Bônus Individual (M19 Fase 4)

Pendente. Sugestão registrada: medidas afetam a métrica **Conduta (12,5%)** da Esfera Profissional do Bônus, com pontuação a ser definida (esquema sugerido em docs/PROXIMA_SESSAO.md).
