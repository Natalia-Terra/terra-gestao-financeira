# Terra Conttemporânea — Sistema de Gestão

Sistema de gestão integrada (financeiro, contabilidade gerencial, RH, bonificação) construído em vanilla JS + Supabase + Vercel.

**Produção:** https://terra-gestao-financeira.vercel.app

## Documentação

Toda a documentação técnica e operacional está em [`docs/`](./docs):

- [`ESTADO_ATUAL.md`](./docs/ESTADO_ATUAL.md) — snapshot do sistema, banco, frontend, perfis ativos
- [`PROXIMA_SESSAO.md`](./docs/PROXIMA_SESSAO.md) — 3 frentes prioritárias (limpeza base + documentação + roteiro de teste)
- [`PENDENCIAS.md`](./docs/PENDENCIAS.md) — pendências de dados e dev + histórico de entregas
- [`ARQUITETURA.md`](./docs/ARQUITETURA.md) — stack, decisões arquiteturais, estrutura de tabelas

> **Source-of-truth:** este repositório no GitHub. Memória local do Claude (AppData) é apenas cache temporário e pode ser perdida ao trocar de máquina.

## Stack

- **Frontend:** Vanilla JS (sem framework), Supabase JS SDK v2 via CDN, SheetJS para imports
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Deploy:** Vercel (Hobby plan)

## Setup local

1. Clonar: `git clone https://github.com/Natalia-Terra/terra-gestao-financeira.git`
2. Copiar `config.example.js` → `config.js` e preencher com credenciais Supabase
3. Servir os arquivos com qualquer servidor estático (ex: `python -m http.server 8000`)
4. Abrir http://localhost:8000

## Migrações de banco

13 migrações no diretório raiz (`migracao_*.sql`), aplicadas via Supabase MCP. Última: `migracao_17_perfis_tipos_dinamico.sql`.

## Edge Functions

- `gerenciar-usuarios` — criar/desativar/reativar usuários (Admin API via service_role). Doc em [`EDGE_FUNCTION_gerenciar_usuarios.md`](./EDGE_FUNCTION_gerenciar_usuarios.md).
