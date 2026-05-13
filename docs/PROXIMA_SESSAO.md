# Próxima Sessão

**Atualizado em:** 2026-05-13 (após M5 backup + M1 refator)
**Source-of-truth principal:** `docs/HANDOFF_2026-05-13.md` (este arquivo é só o resumo das ações imediatas).

## ⚡ Primeira coisa a fazer: smoke test do refator M1

O `app.js` foi dividido em 8 arquivos hoje (commit `cbdb9c7`). Antes de avançar com qualquer feature nova, validar que nada quebrou:

1. **Login** funciona? (deve abrir o shell normalmente)
2. **Navegação** entre seções funciona? Sidebar abre todas as telas?
3. **Botão "+ Novo"** em cada tabela abre o modal correto?
4. **Importar XLSX** funciona em pelo menos 1 template?
5. **Reset Completo** abre o modal de confirmação? (não precisa executar)
6. **Backup automatizado** (Configuração > 💾 Backups) gera e baixa o JSON?

Se tudo OK → seguir com features.
Se algo quebrar → `git revert cbdb9c7` desfaz tudo num push, investigar offline.

## 🔧 Itens em aberto (prioridade alta)

### 1. SMTP Resend em produção
Depende de Juliana fazer config 5min no Supabase Studio. Passo a passo em `docs/CONFIGURACAO_AUTH.md`.

### 2. Bug #2 — Coluna Email vazia na tela Usuários
Cosmético. Edge Function `gerenciar-usuarios` precisa retornar `id → email`. Já houve tentativa de fix com permission denied — talvez reattempt agora.

### 3. M19 Fase 3 — Parser PDF Folha de Ponto
Input recebido (`Fechamentos Ponto 04.2026.pdf`). Decisões registradas. Falta confirmar match por CPF e implementar parser.

## 🟡 Backlog (média prioridade)

- pg_cron para backup automático diário (M5 fase 2)
- Refator-de-refator: agrupar funções por domínio puro com namespacing (M1 hoje preservou ordem original, não fez agrupamento ideal)
- Logo Terra nos emails (hoje só texto)
- Botão "Resetar senha" direto na tela Usuários

## ⏸️ Fora de escopo (decisão 08/05)

- ❌ Integração Conta Azul / Bling / outros hubs fiscais
- ❌ Open Banking (Pluggy/Belvo)
- ❌ Funil de vendas / CRM
- ❌ Gestão de produção / PCP
- ⏸️ Frente 5 — Alçada multi-nível (futuro breve)
