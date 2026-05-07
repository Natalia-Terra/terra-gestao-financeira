# Próxima Sessão (2026-05-07 noite)

## Estado
- M18 + M19 (Master + Reset) + Fases 1, 2 completas
- M22 fn_calcular_bonus_profissional aplicada e testada
- M19 Fase 4 parcial: esfera Profissional pronta no banco

## Pendente
1. Integrar fn_calcular_bonus_profissional na tela "Bônus Individual"
2. fn_calcular_bonus_area + fn_calcular_bonus_empresa + fn_calcular_pool_bonus
3. Parser PDF Folha de Ponto (M19 Fase 3) — depende de Juliana mandar amostra
4. Drill-down em Funcionários (Medidas + Avaliações daquele funcionário)
5. Tela de configuração Meta TC e Meta Área
6. Cargas iniciais de dados (4 imports da Juliana)

## Decisões 2026-05-07
- Conduta = binária (0 medida = pleno; 1+ = zero)
- Avaliação 1-2 = 0%; 3=15%; 4=16,5%; 5=19,5%
- Faltas Just até 3 = pleno; 4+ = 0
- Atrasos 12 = pleno; escala 13-17
- Falta Injust = -12,5%
- Pool = X% LL × multiplicador de margem
