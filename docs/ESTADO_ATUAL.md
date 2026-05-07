# Estado Atual do Sistema — Terra Conttemporânea

**Atualizado em:** 2026-05-07 (noite, fim da sessão)
**Source-of-truth:** este arquivo + `HANDOFF_2026-05-07.md` no GitHub. Memória local do Claude é cache temporário.

## Produção

- **URL:** https://terra-gestao-financeira.vercel.app
- **Deploy:** Vercel (Hobby plan)
- **Backend:** Supabase projeto `Terra-Gestão-Financeira` (id: `zvvdpdldjmzuzieinxwa`)
- **Repo:** Natalia-Terra/terra-gestao-financeira (branch `main`)

## Banco

**Estado da base em 07/05 fim do dia: ZERADA via SQL** (TRUNCATE direto bypassando o check da função `fn_reset_base_completo` por causa do bug crítico — ver `HANDOFF_2026-05-07.md` Seção 4).

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

Estrutura SPA monolítica:
- `index.html` — shell + 53 sections
- `app.js` — IIFE única, ~10.500 linhas após pacote auth de 07/05
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
