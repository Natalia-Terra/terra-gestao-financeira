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

    // Conta registros em plano_contas.
    //
    // Três cenários possíveis nesta fase do projeto:
    //   • count === 510  → usuário autenticado; RLS libera leitura. Tripé 100% OK.
    //   • count === 0    → anônimo; RLS bloqueia leitura, como deveria.
    //                      Esperado até a Entrega 2 (login) existir. Também é OK.
    //   • count !== 0 e !== 510 → divergência real, merece investigação.
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
        var cenario;
        var msg;
        var classe;

        if (total === esperado) {
          cenario = "autenticado";
          msg = "Conexão OK. " + total + " registros em plano_contas — usuário autenticado, RLS liberando leitura. Tripé validado de ponta a ponta.";
          classe = "ok";
        } else if (total === 0) {
          cenario = "anonimo_rls";
          msg = "Conexão OK. RLS ativa bloqueando leitura anônima (comportamento esperado). Os 510 registros aparecerão após o login da Entrega 2.";
          classe = "ok";
        } else {
          cenario = "divergencia";
          msg = "Conexão OK, mas contagem divergente: " + total + " (esperado 0 anônimo ou 510 autenticado).";
          classe = "alerta";
        }

        setStatus(msg, classe);
        setDebug({
          url: cfg.SUPABASE_URL,
          tabela: "plano_contas",
          count: total,
          esperado_autenticado: esperado,
          cenario: cenario
        });
      })
      .catch(function (err) {
        btn.disabled = false;
        setStatus("Falha de rede ou CORS: " + err.message, "erro");
        setDebug(String(err));
      });
  });
})();
