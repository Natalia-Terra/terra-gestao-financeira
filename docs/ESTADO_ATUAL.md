# Estado Atual do Sistema — Terra Conttemporânea

**Atualizado em:** 2026-05-13 (sessão de refator M1 + M5 backup)
**Source-of-truth:** este arquivo + `HANDOFF_2026-05-13.md` no GitHub. Memória local do Claude é cache temporário.

## Produção

- **URL:** https://terra-gestao-financeira.vercel.app
- **Deploy:** Vercel (Hobby plan)
- **Backend:** Supabase projeto `Terra-Gestão-Financeira` (id: `zvvdpdldjmzuzieinxwa`)
- **Repo:** Natalia-Terra/terra-gestao-financeira (branch `main`)

## Banco

**Estado da base:** zerada via SQL em 07/05 — pronta pra cargas iniciais. Bug do Reset Completo CORRIGIDO em 08/05 (commit `8084118` — delegate global + self-healing de overlays órfãos).

- Tabelas de movimento/dados de negócio: **0 registros** (esvaziadas explicitamente)
- Tabelas de cadastro **preservadas**: plano_contas (510 itens), cfop, perfis, perfis_tipos, centros_custo, funcionarios, organograma, rubricas, classif_faturamento, listas (naturezas/tipos), parametros_sistema

### Migrações registradas

15+ migrações registradas (M07-M26 aplicadas em 04-05/2026). Schemas das tabelas estáveis. 53 RLS policies usando `auth_pode_modificar()` e `auth_pode_admin()`.

### Tabelas novas das ondas recentes

- **M18 (Faturamento):** orcamento_items, os_custos_planejados, movimentos_caixa, custo_direto_competencia, lista_naturezas, lista_tipos_produto
- **M19 (RH avançado):** medidas_disciplinares (estendida), avaliacao_desempenho, frequencia_mensal
- **M22-M23 (Bônus):** 5 RPCs `fn_calcular_bonus_*`
- **M24 (Política Histórico):** colunas `vigente` + `import_id` em 18 tabelas; tabela `imports_historico`

## Frontend

Estrutura SPA (refatorada em 13/05 — antes era 1 arquivo de 12.922 linhas):
- `index.html` — shell + 53 sections
- `js/01..08.js` — lógica em 8 módulos por domínio (M1 refator, commit `cbdb9c7`)
- `styles.css` — design system Terra (paleta marrom/ouro, fonte Quattrocento)
- `redefinir-senha.html` — página standalone de reset (criada em 07/05)
- `config.js` — credenciais Supabase (NÃO commitar)

### Adicionados em 07/05 (sessão de auth)

- Link "Esqueci minha senha" abaixo do botão Entrar
- Modal "Esqueci minha senha" com input de email
- Página `/redefinir-senha.html` com identidade Terra
- Helper `mostrarMensagem(titulo, msg, tipo)` — modal Terra customizado que substitui `alert()` nativo
- Templates de email caprichados em `docs/email_templates/email_01_reset_password.html` e `email_02_invite_user.html`

### Identidade visual ajustada em 07/05

- Tabelas com separadores mais sutis: `--borda` 0.20→0.10, `--borda2` 0.40→0.22
- `.tabela td/th` com `border-right/left = 0` (zero linha vertical entre colunas)


### Adicionados em 13/05 (sessão M5 + M1)

- **M5 — Backup automatizado:** tela em Configuração > 💾 Backups. Botão "Gerar backup agora" devolve JSON com snapshot de 52 tabelas (via RPC `fn_gerar_dump_json`). Histórico paginado. Migration `m5_backup_bucket_e_historico` + `m5_fn_gerar_dump_json`.
- **M1 — Refator app.js:** divisão em 8 módulos sob `/js/`. Edits cirúrgicos ficaram MUITO mais baratos em token. Ordem dos scripts no index.html é fixa (overrides e duplicações dependem disso).

## Perfis ativos hoje

| Email | Nome | Perfil |
|---|---|---|
| juliana@polimatagrc.com.br | Juliana (Polimata) | **master** |
| financeiro@terraconttemporanea.com.br | Natália Silva | **admin** |

A Natália foi criada hoje via Supabase Dashboard. Sua entry em `perfis` foi inserida via SQL pra ela aparecer na tela. Senha temporária: `TerraTemp2026!` (passar via WhatsApp e ela troca em Configuração > Trocar minha senha).

## Tipos de perfil disponíveis

| Código | Nome | Pode admin | Pode modificar | Pode limpar base | Pode carga inicial |
|---|---|---|---|---|---|
| master | Acesso máximo | ✅ | ✅ | ✅ | ✅ |
| admin | Acesso total | ✅ | ✅ | ❌ | ✅ |
| operador | Operação dia-a-dia | ❌ | ✅ | ❌ | ❌ |
| consulta | Somente leitura | ❌ | ❌ | ❌ | ❌ |

## Funcionalidades-chave

- 17+ templates de importação
- 6 funções RPC do Bônus (4 esferas + cálculo total + apuração)
- Política de Histórico em 18 tabelas (re-imports não duplicam — marcam vigente=false)
- 5 perfis × 4 tipos de modal (CRUD, detalhe, mensagem, esqueci-senha)
- Auditoria automática (triggers `fn_auditar`) em todas as tabelas com colunas de negócio
- Mapa interativo de telas em `Terra Conttemporânea/AUDITORIA_TELAS.html` (52 telas, 43 tabelas)
