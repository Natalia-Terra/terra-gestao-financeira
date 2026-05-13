# Arquitetura — Sistema Terra Conttemporânea

## Stack

- **Frontend:** SPA monolítica vanilla JS (sem framework), arquivos `index.html` + `app.js` + `styles.css`. Supabase JS SDK v2 via CDN. SheetJS pra importação de Excel.
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Deploy:** Vercel (Hobby plan) com webhook GitHub → Vercel
- **Domínio:** terra-gestao-financeira.vercel.app

## Decisões arquiteturais importantes

1. **Arquivos separados, não Next.js** — Juliana decidiu manter o estilo monolítico do v11 (HTML/CSS/JS standalone) pela simplicidade de manutenção. SDK Supabase via CDN.

2. **RLS dinâmica via funções helper** (Migração 17) — em vez de hardcode `perfil IN ('admin','operador')`, todas as 41 policies de modify usam `auth_pode_modificar()` que checa `perfis_tipos.pode_modificar` dinamicamente.

3. **Soft delete em perfis** — usuários têm coluna `ativo` em vez de DELETE em cascata. Preserva histórico de auditoria.

4. **Edge Functions só pro que requer service_role** — `gerenciar-usuarios` usa Admin API do Supabase Auth (criar/deletar em auth.users). Restante usa SDK normal.

5. **Cache invalidation em cascata** — após import, várias variáveis `xCarregado` são setadas pra false pra forçar re-fetch das telas dependentes.

6. **Vercel deploy via empty commit** — descobrimos em sessão anterior que webhook às vezes engasga. Solução: empty commit pra reacordar.

## Estrutura de tabelas (resumo)

**Negócio core:**
- `orcamentos` (com tipo_manual, plano_contas_id potencial)
- `movimentos` (com plano_contas_id desde M16)
- `notas_fiscais`
- `ordens_servico`, `os_evolucao_mensal`, `os_excluidas`

**Receita/Custo:**
- `receitas_custos` (agregado mensal — fonte legacy)
- `entregas_vinc`, `nf_os`, `saldo_reconhecer`

**RH:**
- `funcionarios`, `organograma`, `centros_custo`, `rubricas`
- `folha_pagamento`, `folha_pagamento_rubricas`
- `beneficios`, `impostos_rh`
- `frequencia_mensal`, `medidas_disciplinares`, `avaliacao_desempenho` (vazias — destravam Bônus Individual)

**Bônus:**
- `bonif_periodos`, `bonif_metas_empresa`, `bonif_metas_area`, `bonif_meta_area_mes`, `bonif_metas_profissional`

**Fluxo de Caixa (M13):**
- `contas_bancarias`, `saldos_contas`, `recebimentos_previstos`, `entradas_outras`, `saidas_outras`
- `caixa_saldo_mensal`, `compromissos_financeiros`

**Custos (M14):**
- `centros_custo.tipo_custo`, `plano_contas.tipo_custo`
- `rateio_areas` (rateio % por organograma)

**Auth/Perfis (M17):**
- `perfis` (id, nome, perfil, senha_temporaria, ultimo_acesso, ativo)
- `perfis_tipos` (id, nome, descricao, pode_admin, pode_modificar, ativo, ordem)

**Auditoria:**
- `auditoria` (alimentada por triggers `fn_auditar` em ~30 tabelas)
- `importacoes` (histórico de imports via tela)

**Configuração:**
- `plano_contas`, `cfop`, `classif_faturamento`, `estoque_resumo`, `estoque_detalhes`

## Fluxo de autenticação

1. Usuário faz login via Supabase Auth (email + senha)
2. App busca `perfis` filtrando por `id = auth.uid()`
3. Se `perfis.ativo = false` → bloqueado (RLS não retorna nada)
4. Se `senha_temporaria = true` → fluxo obrigatório de troca de senha
5. JWT do user inclui o id; RLS usa `auth.uid()` em todas as policies
6. Função `auth_pode_modificar()` (SECURITY DEFINER) checa em uma única query: perfil → tipo → permissão

## Identidade visual

- **Paleta:** marrom (text2 #6B4C1E, text3 #8B6328) + ouro velho (ouro #B8860B, ouro-esc #8B6914)
- **Fundos:** F5EFE6 (areia), FDFAF6 (branco quente), EDE4D8 (sutil), E4D9C8 (mais firme)
- **Tipografia:** Quattrocento (serif, headings) + Quattrocento Sans (sans, body), Google Fonts
- **Estados:** success (#1A6B45), danger (#8B2020), warn (#7A4800), info (#1A4A7A)
- **Sistema de spacing:** --sp-1 (4px) a --sp-12 (48px) com escala 4
- **Transições:** --t-fast (120ms ease), --t-base (180ms ease)
- **Acessibilidade:** WCAG AA mínimo, focus visível com outline ouro + ring

## Repositório

```
terra-gestao-financeira/
├── index.html             ← SPA shell + 40+ sections
├── app.js                 ← lógica completa (~6500 linhas)
├── styles.css             ← design system
├── config.js              ← credenciais Supabase (NÃO commitar)
├── config.example.js      ← template de config
├── logo-terra.png/.jpg    ← assets
├── docs/                  ← este diretório (source-of-truth de docs)
│   ├── ESTADO_ATUAL.md
│   ├── PROXIMA_SESSAO.md
│   ├── PENDENCIAS.md
│   └── ARQUITETURA.md
├── migracao_*.sql         ← 13 arquivos de migração (registro histórico)
├── EDGE_FUNCTION_*.md     ← documentação das edge functions
└── README.md              ← entrada principal
```
