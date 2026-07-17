/* Terra Conttemporanea - tema (madeira escura + contraste + tipografia) e periodo da base.
   Aditivo e a prova de falha. */
(function () {
  "use strict";
  var MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

  function css() {
    if (document.getElementById("terra-tema-css")) return;
    var t = document.createElement("style");
    t.id = "terra-tema-css";
    t.textContent = [
      ":root{--bg:#ECE3D5;--bg2:#FBF7F0;--bg3:#E2D6C4;--bg4:#D6C7AF;",
        "--ouro:#9A6B12;--ouro-cl:#B7842A;--ouro-esc:#6E4A0E;--ouro-foco:rgba(154,107,18,.38);",
        "--text:#241606;--text2:#4A3316;--text3:#6E4E22;--text4:#8A6A38;",
        "--borda:rgba(74,52,24,.16);--borda2:rgba(74,52,24,.34);--wood-txt:#F1E6D2;--wood-txt2:#CDB48C;}",
      "html{font-size:clamp(15px,0.4vw + 13px,17px);}",
      "body,html{background:var(--bg);}",
      "h1{font-size:1.7rem !important;line-height:1.2;}h2{font-size:1.3rem !important;}h3{font-size:1.08rem !important;}",
      ".topbar{background:linear-gradient(180deg,#3C2A18,#2E2012) !important;color:var(--wood-txt) !important;",
        "border-bottom:2px solid var(--ouro) !important;box-shadow:0 2px 10px rgba(0,0,0,.18);}",
      ".topbar *{color:var(--wood-txt) !important;}",
      ".topbar .muted,.topbar time{color:var(--wood-txt2) !important;}",
      ".topbar-logo-img{filter:brightness(0) invert(1);opacity:.92;}",
      ".topbar-perfil-pill{background:rgba(255,255,255,.14) !important;border:1px solid rgba(241,230,210,.35) !important;",
        "color:var(--wood-txt) !important;border-radius:999px;padding:2px 10px;text-transform:uppercase;letter-spacing:.05em;font-size:.7rem;}",
      ".topbar-user-avatar{background:var(--ouro) !important;color:#2E2012 !important;font-weight:700;}",
      ".topbar button,.topbar .btn{background:rgba(255,255,255,.10) !important;border:1px solid rgba(241,230,210,.35) !important;",
        "color:var(--wood-txt) !important;border-radius:8px;}",
      ".terra-periodo{display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.10);",
        "border:1px solid rgba(241,230,210,.32);color:var(--wood-txt) !important;padding:5px 12px;border-radius:999px;",
        "font-size:.82rem;font-weight:700;white-space:nowrap;}",
      ".terra-periodo svg{stroke:var(--ouro-cl);width:15px;height:15px;flex:0 0 auto;}",
      ".terra-periodo b{color:var(--ouro-cl) !important;}",
      ".sidebar{background:linear-gradient(180deg,#332314,#2A1C0F) !important;border-right:1px solid rgba(0,0,0,.25) !important;}",
      ".sidebar *{color:var(--wood-txt) !important;}",
      ".sidebar .sb-group-header{color:var(--wood-txt2) !important;font-weight:700;}",
      ".sidebar .sb-sub,.sidebar .sb-item{color:#E7D8BF !important;border-radius:8px;}",
      ".sidebar .sb-sub:hover,.sidebar .sb-item:hover,.sidebar .sb-group-header:hover{background:rgba(255,255,255,.08) !important;}",
      ".sidebar .sb-icon svg{stroke:#D9C09A !important;}",
      ".card,.metric-card,.fat-card,.config-card{background:var(--bg2) !important;border:1px solid var(--borda2) !important;",
        "border-radius:12px !important;box-shadow:0 1px 3px rgba(46,32,18,.06);}",
      ".metric-card{border-left:4px solid var(--ouro) !important;padding:16px 18px !important;}",
      "@media(max-width:900px){.metric-card{min-width:0 !important;}.topbar{flex-wrap:wrap;height:auto !important;}.terra-periodo{font-size:.74rem;}}"
    ].join("");
    document.head.appendChild(t);
  }

  function fmt(ym) {
    if (!ym) return null;
    var p = String(ym).split("-"), m = parseInt(p[1], 10);
    return m ? MESES[m - 1] + "/" + p[0] : null;
  }

  function svgCal() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4"></path><path d="M8 2v4"></path><path d="M3 10h18"></path></svg>';
  }

  function badge() {
    var tb = document.querySelector(".topbar");
    if (!tb || document.getElementById("terra-periodo")) return;
    var el = document.createElement("div");
    el.id = "terra-periodo";
    el.className = "terra-periodo";
    el.title = "Periodo coberto pela base de dados";
    el.innerHTML = svgCal() + ' <span>Base: <b id="terra-per-val">carregando...</b></span>';
    var sp = tb.querySelector(".topbar-spacer");
    if (sp) sp.parentNode.insertBefore(el, sp); else tb.appendChild(el);
  }

  function updateBadge() {
    var v = document.getElementById("terra-per-val");
    if (!v) return;
    if (v.textContent.indexOf("/") > -1) return;
    try {
      var c = window.client;
      if (c && c.from) {
        Promise.all([
          c.from("movimentos").select("competencia").order("competencia", { ascending: true }).limit(1),
          c.from("movimentos").select("competencia").order("competencia", { ascending: false }).limit(1)
        ]).then(function (r) {
          try {
            var mn = r[0].data && r[0].data[0] && r[0].data[0].competencia;
            var mx = r[1].data && r[1].data[0] && r[1].data[0].competencia;
            var a = fmt(mn && mn.slice(0, 7)), b = fmt(mx && mx.slice(0, 7));
            if (a && b) v.textContent = a + " a " + b;
          } catch (e) {}
        }).catch(function () {});
      }
    } catch (e) {}
  }

  var ICON_GUIDE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>';
  var ICON_DEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"></path></svg>';

  function fixIcons() {
    try {
      var g = document.querySelector("#terra-guide-btn .sb-icon");
      if (g && g.textContent.trim().length < 4) g.innerHTML = ICON_GUIDE;
      var d = document.querySelector("#terra-devtoggle .sb-icon");
      if (d && d.textContent.trim().length < 4) d.innerHTML = ICON_DEV;
    } catch (e) {}
  }

  function boot() { try { css(); badge(); updateBadge(); fixIcons(); } catch (e) {} }

  function start() {
    boot();
    var n = 0, iv = setInterval(function () { boot(); if (++n >= 20) clearInterval(iv); }, 500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
