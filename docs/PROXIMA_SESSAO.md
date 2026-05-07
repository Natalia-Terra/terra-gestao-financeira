# Próxima Sessão

**Atualizado em:** 2026-05-07 (noite, encerramento da sessão de auth)
**Source-of-truth principal:** `docs/HANDOFF_2026-05-07.md` (este arquivo é só o resumo das ações imediatas).

## ⚡ 3 ações imediatas pra começar

### 1. Confirmar estado da base
A base foi zerada via SQL no fim da sessão de 07/05. Pergunte à Juliana se ela já começou a importar dados entre as sessões. Se sim, atualize `ESTADO_ATUAL.md`.

### 2. ATACAR o BUG CRÍTICO #1 — Reset Completo travado
**Prioridade absoluta.** Sintoma reproduzido em 2 navegadores e 2 usuários — input "Digite RESET" e botão "Executar Reset Completo" não respondem.

**Investigação inicial:**
- Pedir pra Juliana abrir DevTools (F12) > Elements > Ctrl+F `class="modal-overlay"` e listar TODOS os elementos com essa classe + estado (hidden? display?)
- Hipótese: modal-overlay órfão sem `hidden`, criado por `mostrarMensagem()` (app.js linha ~822) ou `abrirModalDetalhe()` (linha 7805) e não removido por algum erro JS

**Solução defensiva sugerida (~30 min + push):**
```javascript
// No boot do app, após auth bem-sucedida:
function limparOverlaysOrfaos() {
  document.querySelectorAll('.modal-overlay:not([hidden])').forEach(function (m) {
    if (!m.dataset.terraVivo) m.parentNode && m.parentNode.removeChild(m);
  });
}
// Chamar no boot e a cada navegação entre páginas
```

E nas funções `mostrarMensagem`, `abrirModalDetalhe`, `abrirModal` etc, adicionar `div.dataset.terraVivo = "1"` ao criar e `delete div.dataset.terraVivo` ao fechar (ou incluir no fechar() o `removeAttribute`).

### 3. Retomar setup do Resend
Juliana pediu ajuda mas não passou em qual etapa parou. Comece perguntando:
- Já criou conta em resend.com?
- Adicionou domínio (qual? polimatagrc.com.br?) e os registros DNS?
- Gerou API Key?

Passo a passo completo em `docs/CONFIGURACAO_AUTH.md`.

## 📋 Frentes técnicas em aberto

### CRÍTICO
- Bug #1 — Reset Completo (acima)

### IMPORTANTE
- **M19 Fase 3** — Parser PDF Folha de Ponto. Input recebido (`Fechamentos Ponto 04.2026.pdf`). Decisões já confirmadas. Falta confirmar match por CPF e implementar.
- Edge Function `gerenciar-usuarios` retornar emails (coluna "Email" da tela vazia hoje).

### NICE-TO-HAVE
- M26 — Política Histórico nas 8 tabelas restantes
- Logo Terra nos emails (hoje só texto)
- Botão "Resetar senha" direto na tela Usuários

## 📋 Bloqueios externos (depende de Juliana)

- **Configurar SMTP no Resend** (Seção 7 do handoff)
- **Colar templates de email** caprichados no Supabase (Auth > Email Templates)
- **Cadastrar metas iniciais** quando começar carga: bonif_metas_empresa, bonif_metas_area
- **Importar dados reais** (6 arquivos obrigatórios + 6 opcionais — lista em `BASES_NECESSARIAS.md`)

## 📋 Como o handoff acontece

A Juliana encerrou esta sessão pedindo formalização. Os documentos canônicos da sessão de 07/05 são:

| Arquivo | Onde |
|---|---|
| **HANDOFF_2026-05-07.md** | `docs/HANDOFF_2026-05-07.md` no GitHub (texto) |
| **HANDOFF_2026-05-07.docx** | Pasta Terra Conttemporânea (Word caprichado, 9 seções) |
| **ESTADO_ATUAL.md** | `docs/ESTADO_ATUAL.md` (foto técnica do sistema) |
| **PENDENCIAS.md** | `docs/PENDENCIAS.md` (lista priorizada) |
| **PROXIMA_SESSAO.md** | este arquivo (resumo executivo) |

Ler nesta ordem na próxima sessão: `PROXIMA_SESSAO.md` → `HANDOFF_2026-05-07.md` → `ESTADO_ATUAL.md` (se precisar de detalhe técnico).
