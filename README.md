# Terra Conttemporânea — Gestão Financeira

Sistema de gestão de faturamento e receita da marcenaria Terra Conttemporânea.
Adaptação em nuvem do antigo HTML standalone `gestao_faturamento_1504_v11.html`,
agora dividido em arquivos versionados no GitHub, com banco e autenticação no
Supabase e deploy no Vercel.

> **Estado atual:** Entrega 1 — scaffold inicial. Só prova que o tripé
> GitHub → Vercel → Supabase está funcionando. As telas do sistema
> (login, dashboard, orçamentos, NFs, recebimentos etc.) entram nas
> Entregas 2 a 6 conforme o plano do documento de continuidade v9.

## Arquitetura

- **Frontend**: HTML + CSS + JavaScript puro (sem framework), servido como
  site estático pelo Vercel.
- **Banco + Auth**: Supabase (Postgres + Row Level Security + Supabase Auth).
- **SDK**: `@supabase/supabase-js` v2, carregado via CDN jsDelivr.

O frontend conversa direto com o Supabase — não há backend intermediário.

## Estrutura de arquivos

```
terra-gestao-financeira/
├── index.html          # shell da aplicação
├── app.js              # lógica (hoje: só teste de conexão)
├── styles.css          # identidade visual (paleta marrom + Quattrocento)
├── config.example.js   # template de configuração (commitado)
├── config.js           # configuração real (NÃO commitado — está no .gitignore)
├── .gitignore
└── README.md
```

## Rodando localmente

1. Clone ou baixe o repositório.
2. Copie `config.example.js` para `config.js` na mesma pasta.
3. Edite `config.js` e preencha:
   - `SUPABASE_URL` → URL do projeto Supabase
     (Settings → API → Project URL)
   - `SUPABASE_PUBLISHABLE_KEY` → Publishable key `sb_publishable_…`
     (Settings → API → Publishable key)
4. Abra `index.html` no navegador (duplo clique ou arraste para a aba).
5. Clique em **Testar conexão com o Supabase**.
   - Esperado: *"Conexão OK. 510 registros em plano_contas"*.
   - Se der erro de CORS, suba um servidor local simples:
     ```
     python -m http.server 5500
     ```
     e abra `http://localhost:5500`.

> A **publishable key** é desenhada para ficar pública no frontend — a
> proteção dos dados vem das políticas de RLS no Postgres. A **secret
> key** (`sb_secret_…`) nunca deve entrar neste repositório.

## Deploy no Vercel (Entrega 6)

Resumo do que virá mais à frente:

1. No Team Vercel **Terra Conttemp…**, clique em *Add New → Project* e importe
   o repositório `terra-conttemporanea/terra-gestao-financeira`.
2. Framework preset: **Other** (site estático).
3. Em *Environment Variables*, adicione:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
4. Na Entrega 6, o scaffold ganha um pequeno passo de build que injeta essas
   envs em tempo de deploy, substituindo o `config.js`.

## Plano de entregas (Fase 2)

| # | Entrega                                    | Estado            |
|---|--------------------------------------------|-------------------|
| 1 | Scaffold + teste de conexão                | **Atual**         |
| 2 | Login com Supabase Auth                    | A iniciar         |
| 3 | Dashboard e layout geral (sidebar/topbar)  | A iniciar         |
| 4 | Módulos financeiros (orçamentos, NFs, etc) | A iniciar         |
| 5 | Módulos de configuração (plano, CFOP, etc) | A iniciar         |
| 6 | Deploy no Vercel e cutover                 | A iniciar         |

O plano completo está em `estado_sistema_terra_v9_handoff.docx` (workspace Cowork).

## Convenções

- Identidade visual: tons de marrom + ouro, tipografia Quattrocento.
- Paleta e tokens CSS preservados do v11 (ver `styles.css`).
- Comentários e mensagens de UI em português do Brasil.
