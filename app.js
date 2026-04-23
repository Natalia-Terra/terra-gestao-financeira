/**
 * Terra Conttemporânea — Gestão Financeira
 * Entrega 1: scaffold com teste de conexão ao Supabase.
 *
 * A lógica de negócio do v11 (fórmula a_faturar, reconciliação
 * Entrega S/NF ↔ NF, Tipo único por orçamento, auto-match etc.)
 * entra a partir da Entrega 4.
 */

(function () {
  "use strict";

  var btn = document.getElementById("btn-testar");
  var statusEl = document.getElementById("status");
  var debugEl = document.getElementById("debug-saida");

  function setStatus(msg, tipo) {
    statusEl.textContent = msg;
    statusEl.className = "status " + (tipo || "");
  }

  function setDebug(obj) {
    try {
      debugEl.textContent = JSON.stringify(obj, null, 2);
    } catch (e) {
      debugEl.textContent = String(obj);
    }
  }

  // 1) Verifica se o config.js foi carregado e tem as chaves esperadas.
  if (typeof window.TERRA_CONFIG === "undefined") {
    setStatus(
      "config.js não encontrado. Copie config.example.js para config.js e preencha SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.",
      "erro"
    );
    btn.disabled = true;
    return;
  }

  var cfg = window.TERRA_CONFIG;
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) {
    setStatus(
      "config.js incompleto. Preencha SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.",
      "erro"
    );
    btn.disabled = true;
    return;
  }

  // 2) Verifica se o SDK do Supabase foi carregado pela CDN.
  if (typeof window.supabase === "undefined" || !window.supabase.createClient) {
    setStatus(
      "SDK do Supabase não carregado. Verifique a conexão de internet e a tag <script> do CDN.",
      "erro"
    );
    btn.disabled = true;
    return;
  }

  var client = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_PUBLISHABLE_KEY
  );

  btn.addEventListener("click", function () {
    btn.disabled = true;
    setStatus("Consultando o Supabase…", "carregando");
    setDebug("—");

    // Conta registros em plano_contas (esperado: 510 conforme v9 handoff).
    client
      .from("plano_contas")
      .select("*", { count: "exact", head: true })
      .then(function (resposta) {
        btn.disabled = false;

        if (resposta.error) {
          setStatus(
            "Erro na consulta: " + resposta.error.message,
            "erro"
          );
          setDebug(resposta.error);
          return;
        }

        var total = resposta.count;
        var esperado = 510;
        var bateu = total === esperado;

        setStatus(
          bateu
            ? "Conexão OK. " + total + " registros em plano_contas (bate com o esperado)."
            : "Conexão OK, mas contagem divergente: " + total + " (esperado " + esperado + ").",
          bateu ? "ok" : "alerta"
        );

        setDebug({
          url: cfg.SUPABASE_URL,
          tabela: "plano_contas",
          count: total,
          esperado: esperado,
          ok: bateu
        });
      })
      .catch(function (err) {
        btn.disabled = false;
        setStatus("Falha de rede ou CORS: " + err.message, "erro");
        setDebug(String(err));
      });
  });
})();
