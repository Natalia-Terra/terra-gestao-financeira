# Estado Atual do Sistema — Terra Conttemporânea

**Atualizado em:** 2026-05-04 (pós Entrega 13 / revisão UX/UI)
**Source-of-truth:** este arquivo no GitHub. Memória local do Claude é cache temporário.

## Produção

- **URL:** https://terra-gestao-financeira.vercel.app
- **Deploy:** Vercel (Hobby plan, conta financeiro@terraconttemporanea.com.br)
- **Backend:** Supabase projeto `Terra-Gestão-Financeira` (id: `zvvdpdldjmzuzieinxwa`)
- **Repo:** Natalia-Terra/terra-gestao-financeira (branch `main`)

## Banco

- 13 migrações registradas (10 numeradas + extras: 07b, 07c). Última = `migracao_17_perfis_tipos_dinamico`
- 43 tabelas em schema `public`
- 41 RLS policies de modify usando função helper `auth_pode_modificar()` (refatoradas na M17)
- 3 tipos de perfil em `perfis_tipos`: admin, operador, consulta
- Edge Function `gerenciar-usuarios` ACTIVE (criar/desativar/reativar)
- Auditoria automática (triggers `fn_auditar`) cobrindo todas as tabelas com colunas de negócio
- Trigger touch `atualizado_em` em todas as tabelas com essa coluna

## Frontend

Estrutura SPA monolítica:
- `index.html` — shell + 40+ sections (uma por tela)
- `app.js` — IIFE única com toda a lógica (~6500 linhas)
- `styles.css` — design system com variáveis (paleta marrom/ouro Terra, fonte Quattrocento)
- `config.js` — credenciais Supabase (não commitar — usa config.example.js)

Sidebar organizada em 8 grupos:
1. Dashboard (Visão geral, Programa de Bônus)
2. Receita (Por Apropriação, Por Faturamento)
3. Financeiro (Consolidado, Contas a Receber, Contas a Pagar)
4. Comercial (Vendas, Gestão de Faturamento, Notas Fiscais)
5. Custeio (Custo por OS, Custo Direto Via OS, Custo Direto Lançamento, Custo Indireto, Despesas, Custo por Área, OSs excluídas, Entregas pendentes)
6. Contabilidade Gerencial (Fluxo de Caixa 12m, Contas Bancárias, Saldos Mensais, Entradas Avulsas, Saídas Avulsas, DRE, Lançamentos)
7. Dep. Pessoal e RH (Organograma, Funcionários, Benefícios, Folha, Impostos, Bônus Configuração, Bônus Individual)
8. Rodapé: Importar (13 templates) + Configuração (10+ telas)

## Perfis ativos

- `juliana@polimatagrc.com.br` — admin
- `financeiro@terraconttemporanea.com.br` (Natália) — operador

## Funcionalidades-chave

- Filtros multi-coluna em todas as telas listáveis
- Modais de drill-down: Vendas, Gestão Faturamento, NFs, Lançamentos, Despesas (toggle rc/mov), Bônus Individual, Visão 12m
- Soft delete de usuários (coluna `ativo` em `perfis`)
- Email de redefinição via SMTP padrão Supabase (limite ~30/dia — trocar quando crescer)
- 13 templates de importação com pré-visualização e cache invalidation em cascata
- Resolução automática `cod_conta → plano_contas_id` em movimentos importados
- Resolução automática `nome_conta → conta_id` em saldos importados
- Auditoria estendida via tela Configuração > Auditoria (filtros por tabela/usuário/período)
