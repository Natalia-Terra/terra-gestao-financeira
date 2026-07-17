/* =============================================================
   Terra Conttemporânea — Customização de UI (foco Faturamento)
   Adição NÃO destrutiva:
   - Esconde módulos ainda não usados (ficam atrás de um botão)
   - Botão "Funcionalidades em desenvolvimento" (liga/desliga)
   - Botão "Orientador de importação" (guia de-para embutido)
   Tudo encapsulado e à prova de falha (try/catch): se algo der
   errado aqui, o resto do sistema continua funcionando.
   ============================================================= */
(function () {
  "use strict";

  // Páginas que ficam VISÍVEIS agora (foco: gestão de faturamento)
  var ALLOW = {
    // Dashboard
    "dashboard": 1,
    // Receita
    "apr_dashboard": 1, "apr_faturamento": 1, "saldo_reconhecer": 1,
    // Comercial (núcleo do faturamento)
    "vendas": 1, "faturamento": 1, "dashboard_faturamento": 1,
    "notas": 1, "dashboard_orcamentos_view": 1,
    // Custeio
    "margem_os": 1, "custos_os": 1, "entregas": 1,
    // Rodapé
    "importacoes": 1, "configuracao": 1
  };

  var LS_KEY = "terra_show_dev";

  function injectCSS() {
    if (document.getElementById("terra-cust-css")) return;
    var css =
      "body:not(.terra-show-dev) .terra-dev-hide{display:none !important;}" +
      ".terra-devtoggle,.terra-guide-btn{display:flex;align-items:center;gap:8px;width:100%;" +
        "background:none;border:0;cursor:pointer;color:#8B6328;font:inherit;padding:8px 10px;" +
        "border-radius:8px;text-align:left;}" +
      ".terra-devtoggle:hover,.terra-guide-btn:hover{background:#EDE4D8;}" +
      ".terra-devtoggle.on{color:#1A6B45;font-weight:600;}" +
      ".terra-guide-btn{color:#6B4C1E;font-weight:600;}" +
      ".terra-badge-dev{display:inline-block;font-size:10px;line-height:1;padding:2px 5px;margin-left:6px;" +
        "border-radius:6px;background:#EDE4D8;color:#8B6914;vertical-align:middle;}" +
      ".terra-modal-ov{position:fixed;inset:0;background:rgba(43,33,25,.45);z-index:99999;" +
        "display:flex;align-items:center;justify-content:center;padding:24px;}" +
      ".terra-modal{background:#FDFAF6;max-width:860px;width:100%;max-height:86vh;overflow:auto;" +
        "border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.35);border:1px solid #E4D9C8;}" +
      ".terra-modal-h{position:sticky;top:0;background:#6B4C1E;color:#fff;padding:16px 22px;" +
        "display:flex;justify-content:space-between;align-items:center;}" +
      ".terra-modal-h h2{margin:0;font-size:18px;}" +
      ".terra-modal-x{background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;}" +
      ".terra-modal-b{padding:20px 24px;color:#2B2119;font-size:14px;line-height:1.55;}" +
      ".terra-modal-b h3{color:#6B4C1E;margin:18px 0 6px;font-size:15px;}" +
      ".terra-modal-b table{width:100%;border-collapse:collapse;margin:8px 0 4px;font-size:13px;}" +
      ".terra-modal-b th{background:#6B4C1E;color:#fff;text-align:left;padding:6px 8px;}" +
      ".terra-modal-b td{border:1px solid #E4D9C8;padding:6px 8px;vertical-align:top;}" +
      ".terra-modal-b tr:nth-child(even) td{background:#F5EFE6;}" +
      ".terra-ok{color:#1A6B45;font-weight:600;}.terra-warn{color:#7A4800;font-weight:600;}" +
      ".terra-no{color:#8B2020;font-weight:600;}" +
      ".terra-nota{background:#F6EEDF;border-left:3px solid #9A6B12;padding:9px 12px;border-radius:6px;font-size:.9em;margin:8px 0 14px;line-height:1.45;}";
    var s = document.createElement("style");
    s.id = "terra-cust-css";
    s.textContent = css;
    document.head.appendChild(s);
  }

  function applyHiding() {
    try {
      var subs = document.querySelectorAll(".sidebar [data-page]");
      for (var i = 0; i < subs.length; i++) {
        var pg = subs[i].getAttribute("data-page");
        if (ALLOW[pg]) subs[i].classList.remove("terra-dev-hide");
        else subs[i].classList.add("terra-dev-hide");
      }
      // Esconde grupos que ficaram sem nenhum item visível
      var groups = document.querySelectorAll(".sidebar .sb-group");
      for (var g = 0; g < groups.length; g++) {
        var items = groups[g].querySelectorAll("[data-page]");
        var anyVisible = false;
        for (var k = 0; k < items.length; k++) {
          if (ALLOW[items[k].getAttribute("data-page")]) { anyVisible = true; break; }
        }
        if (anyVisible) groups[g].classList.remove("terra-dev-hide");
        else groups[g].classList.add("terra-dev-hide");
      }
      // Subcabeçalhos soltos do Custeio (Custo Direto) somem junto
      var subh = document.querySelectorAll(".sidebar .sb-subgroup-header");
      for (var h = 0; h < subh.length; h++) subh[h].classList.add("terra-dev-hide");
    } catch (e) { /* nunca quebrar o app */ }
  }

  function setDev(show) {
    if (show) document.body.classList.add("terra-show-dev");
    else document.body.classList.remove("terra-show-dev");
    try { localStorage.setItem(LS_KEY, show ? "1" : "0"); } catch (e) {}
    var btn = document.getElementById("terra-devtoggle");
    if (btn) {
      btn.classList.toggle("on", show);
      btn.querySelector(".sb-label").textContent = show
        ? "Ocultar itens em desenvolvimento"
        : "Mostrar itens em desenvolvimento";
    }
  }

  function buildFooterButtons() {
    var footer = document.querySelector(".sidebar .sidebar-footer");
    if (!footer || document.getElementById("terra-devtoggle")) return;

    // Botão: Orientador de importação
    var guide = document.createElement("button");
    guide.type = "button";
    guide.className = "sb-item terra-guide-btn";
    guide.id = "terra-guide-btn";
    guide.innerHTML = '<span class="sb-icon">📘</span><span class="sb-label">Orientador de importação</span>';
    guide.addEventListener("click", openGuide);

    // Botão: toggle desenvolvimento
    var dev = document.createElement("button");
    dev.type = "button";
    dev.className = "sb-item terra-devtoggle";
    dev.id = "terra-devtoggle";
    dev.innerHTML = '<span class="sb-icon">🔧</span><span class="sb-label">Mostrar itens em desenvolvimento</span>';
    dev.addEventListener("click", function () {
      setDev(!document.body.classList.contains("terra-show-dev"));
    });

    footer.appendChild(guide);
    footer.appendChild(dev);

    var saved = "0";
    try { saved = localStorage.getItem(LS_KEY) || "0"; } catch (e) {}
    setDev(saved === "1");
  }

  function guideHTML() {
    return '' +
    '<p>Este é o roteiro de <strong>qual relatório alimenta qual informação</strong>. ' +
    'Importe na ordem indicada — alguns dependem de outros.</p>' +
    '<h3>Bases obrigatórias (na ordem)</h3>' +
    '<p class="terra-nota">A antiga planilha <em>Bíblia</em> saiu desta lista: ela foi <strong>decomissionada</strong>. ' +
    'Os dados dela (<code>movimentos</code>, <code>saldo_reconhecer</code>) já estão carregados e agora vivem no ' +
    'próprio sistema — você não precisa mais enviá-la. Origem histórica, para registro: ' +
    '<code>30032026_Gestão Faturamento e Receita.xlsx</code>, abas <em>Mov Financeiro</em> e <em>Saldo a Reconhecer</em>.</p>' +
    '<table><thead><tr><th>#</th><th>Arquivo / relatório</th><th>Importação (tela)</th>' +
    '<th>Alimenta (tabelas)</th><th>Status</th></tr></thead><tbody>' +
    '<tr><td>1</td><td><strong>Dashboard de Orçamentos.xlsx</strong> (sistema interno)</td>' +
      '<td>Dashboard de Orçamentos</td><td>ordens_servico, os_custos_planejados, orcamento_items</td>' +
      '<td class="terra-no">✘ falta</td></tr>' +
    '<tr><td>2</td><td>Orçamento Aprovado por Parceiro (Aerolito, .xls)</td>' +
      '<td>Orçamentos</td><td>orcamentos</td><td class="terra-ok">✔ carregado</td></tr>' +
    '<tr><td>3</td><td>Saída de Estoque Por Período.xlsx</td>' +
      '<td>Saída de Estoque (CPV-Matéria Prima)</td>' +
      '<td>estoque_detalhes, estoque_resumo, os_evolucao_mensal, custo_direto_competencia</td>' +
      '<td class="terra-warn">◐ parcial</td></tr>' +
    '<tr><td>4</td><td>A Pagar x A Receber - Dt. Baixa.xlsx</td>' +
      '<td>A Pagar x A Receber (Dt. Baixa)</td><td>movimentos_caixa</td>' +
      '<td class="terra-no">✘ falta</td></tr>' +
    '<tr><td>5</td><td>Notas Fiscais (sistema fiscal)</td>' +
      '<td>Notas Fiscais</td><td>notas_fiscais, nf_os</td>' +
      '<td class="terra-no">✘ falta</td></tr>' +
    '</tbody></table>' +
    '<p style="margin-top:6px"><strong>Pré-requisito:</strong> importe o <em>Dashboard de Orçamentos</em> ' +
    '(#2) antes das <em>Notas Fiscais</em> (#6) — a tela de NF cruza cada nota com as OSs do orçamento.</p>' +
    '<h3>Base × Telas que ela liga</h3>' +
    '<table><thead><tr><th>Base</th><th>Telas que passam a ter dado</th></tr></thead><tbody>' +
    '<tr><td>Movimentos (base histórica — já no sistema)</td><td>Lançamentos, Despesas, Controle de Faturamento</td></tr>' +
    '<tr><td>Dashboard de Orçamentos</td><td>Dashboard de Orçamentos, Dashboard de Faturamento (rico), Custo por OS</td></tr>' +
    '<tr><td>Orçamento Aprovado</td><td>Vendas, Gestão de Faturamento, Dashboard de Faturamento</td></tr>' +
    '<tr><td>Saída de Estoque</td><td>Custo por OS, Custo Direto Via OS, Dashboard de Faturamento (Custo MP)</td></tr>' +
    '<tr><td>A Pagar x A Receber</td><td>Lançamentos de Caixa, Dashboard de Faturamento (Adto/Recebimento)</td></tr>' +
    '<tr><td>Notas Fiscais</td><td>Notas Fiscais, Dashboard de Faturamento (NF Emitida)</td></tr>' +
    '</tbody></table>' +
    '<p style="margin-top:10px;color:#7A4800"><strong>Política do sistema:</strong> nunca sobrescrever — ' +
    'reimportar cria uma nova versão (marca a anterior como não-vigente), não duplica nem perde dados.</p>';
  }

  function openGuide() {
    if (document.getElementById("terra-guide-ov")) return;
    var ov = document.createElement("div");
    ov.className = "terra-modal-ov";
    ov.id = "terra-guide-ov";
    ov.innerHTML =
      '<div class="terra-modal" role="dialog" aria-modal="true">' +
        '<div class="terra-modal-h"><h2>📘 Orientador de importação</h2>' +
          '<button class="terra-modal-x" type="button" aria-label="Fechar">×</button></div>' +
        '<div class="terra-modal-b">' + guideHTML() + '</div>' +
      '</div>';
    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    ov.querySelector(".terra-modal-x").addEventListener("click", close);
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
    });
    document.body.appendChild(ov);
  }

  function boot() {
    try {
      injectCSS();
      applyHiding();
      buildFooterButtons();
    } catch (e) { /* silencioso */ }
  }

  function start() {
    boot();
    // reaplica algumas vezes caso o app renderize a sidebar depois do login
    var tries = 0;
    var iv = setInterval(function () {
      boot();
      if (++tries >= 12) clearInterval(iv); // ~6s
    }, 500);
    // observa mudanças na sidebar (defensivo)
    try {
      var sb = document.querySelector(".sidebar");
      if (sb && window.MutationObserver) {
        new MutationObserver(function () { applyHiding(); }).observe(sb, { childList: true, subtree: true });
      }
    } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
