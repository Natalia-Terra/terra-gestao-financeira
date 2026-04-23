/**
 * Terra Conttemporânea — Gestão Financeira
 * Entrega 3: shell da aplicação (topbar + sidebar + dashboard real + stubs).
 *
 * Estrutura de estados:
 *   • boot-carregando → enquanto getSession() resolve
 *   • boot-login      → sem sessão; formulário de login
 *   • shell           → autenticado; topbar + sidebar + páginas
 *
 * A lógica de negócio do v11 (orçamentos, NFs, reconciliação Entrega S/NF,
 * fórmula a_faturar, Tipo único por orçamento etc.) entra na Entrega 4.
 */

(function () {
  "use strict";

  // =========================================================================
  // 1. ELEMENTOS
  // =========================================================================

  var bootCarregando = document.getElementById("boot-carregando");
  var bootLogin      = document.getElementById("boot-login");
  var shell          = document.getElementById("shell");

  // Login
  var formLogin   = document.getElementById("form-login");
  var inputEmail  = document.getElementById("login-email");
  var inputSenha  = document.getElementById("login-senha");
  var btnEntrar   = document.getElementById("btn-entrar");
  var erroLogin   = document.getElementById("login-erro");

  // Topbar
  var topbarNome    = document.getElementById("topbar-nome");
  var topbarAvatar  = document.getElementById("topbar-avatar");
  var topbarData    = document.getElementById("topbar-data");
  var btnSair       = document.getElementById("btn-sair");

  // Sidebar
  var sidebar            = document.getElementById("sidebar");
  var btnToggleSidebar   = document.getElementById("btn-toggle-sidebar");

  // Dashboard
  var debugEl     = document.getElementById("debug-saida");
  var dashStatus  = document.getElementById("dash-status");
  var mOrcamentos = document.getElementById("m-orcamentos");
  var mVendido    = document.getElementById("m-vendido");
  var mFaturado   = document.getElementById("m-faturado");
  var mRecebido   = document.getElementById("m-recebido");

  // =========================================================================
  // 2. UTILITÁRIOS
  // =========================================================================

  function mostrarEstado(qual) {
    bootCarregando.hidden = qual !== "carregando";
    bootLogin.hidden      = qual !== "login";
    shell.hidden          = qual !== "shell";
  }

  function setErroLogin(msg) {
    if (!msg) {
      erroLogin.hidden = true;
      erroLogin.textContent = "";
    } else {
      erroLogin.textContent = msg;
      erroLogin.hidden = false;
    }
  }

  function setDashStatus(msg, tipo) {
    if (!msg) { dashStatus.hidden = true; return; }
    dashStatus.textContent = msg;
    dashStatus.className = "status " + (tipo || "");
    dashStatus.hidden = false;
  }

  function setDebug(obj) {
    try { debugEl.textContent = JSON.stringify(obj, null, 2); }
    catch (e) { debugEl.textContent = String(obj); }
  }

  function fmtBRL(valor) {
    if (valor === null || valor === undefined || isNaN(valor)) return "—";
    return Number(valor).toLocaleString("pt-BR", {
      style: "currency", currency: "BRL", maximumFractionDigits: 0
    });
  }

  function fmtInt(valor) {
    if (valor === null || valor === undefined || isNaN(valor)) return "—";
    return Number(valor).toLocaleString("pt-BR");
  }

  function iniciais(nome) {
    if (!nome) return "·";
    var partes = String(nome).trim().split(/\s+/);
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
  }

  function dataHoje() {
    var d = new Date();
    return d.toLocaleDateString("pt-BR", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric"
    });
  }

  // =========================================================================
  // 3. PRÉ-CONDIÇÕES: CONFIG + SDK
  // =========================================================================

  if (typeof window.TERRA_CONFIG === "undefined") {
    mostrarEstado("login");
    setErroLogin("config.js não encontrado. Copie config.example.js para config.js.");
    btnEntrar.disabled = true;
    return;
  }
  var cfg = window.TERRA_CONFIG;
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) {
    mostrarEstado("login");
    setErroLogin("config.js incompleto.");
    btnEntrar.disabled = true;
    return;
  }
  if (typeof window.supabase === "undefined" || !window.supabase.createClient) {
    mostrarEstado("login");
    setErroLogin("SDK do Supabase não carregado.");
    btnEntrar.disabled = true;
    return;
  }

  var client = window.supabase.createClient(
    cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY
  );

  // =========================================================================
  // 4. AUTH FLOW
  // =========================================================================

  mostrarEstado("carregando");

  client.auth.getSession().then(function (resp) {
    var session = resp && resp.data ? resp.data.session : null;
    if (session) entrarModoShell(session.user);
    else         entrarModoLogin();
  });

  client.auth.onAuthStateChange(function (event, session) {
    if (event === "SIGNED_IN" && session) entrarModoShell(session.user);
    else if (event === "SIGNED_OUT")      entrarModoLogin();
  });

  function entrarModoLogin() {
    setErroLogin(null);
    inputEmail.value = "";
    inputSenha.value = "";
    btnEntrar.disabled = false;
    btnEntrar.textContent = "Entrar";
    mostrarEstado("login");
    setTimeout(function () { inputEmail.focus(); }, 0);
  }

  formLogin.addEventListener("submit", function (ev) {
    ev.preventDefault();
    setErroLogin(null);

    var email = (inputEmail.value || "").trim();
    var senha = inputSenha.value || "";

    if (!email || !senha) { setErroLogin("Preencha email e senha."); return; }

    btnEntrar.disabled = true;
    btnEntrar.textContent = "Entrando…";

    client.auth.signInWithPassword({ email: email, password: senha })
      .then(function (resposta) {
        if (resposta.error) {
          btnEntrar.disabled = false;
          btnEntrar.textContent = "Entrar";
          var msg = resposta.error.message || "Falha ao entrar.";
          if (/invalid login credentials/i.test(msg)) msg = "Email ou senha incorretos.";
          setErroLogin(msg);
        }
      })
      .catch(function (err) {
        btnEntrar.disabled = false;
        btnEntrar.textContent = "Entrar";
        setErroLogin("Falha de rede: " + err.message);
      });
  });

  btnSair.addEventListener("click", function () {
    btnSair.disabled = true;
    client.auth.signOut().then(function () { btnSair.disabled = false; });
  });

  // =========================================================================
  // 5. SHELL (pós-login): topbar + sidebar + router + dashboard
  // =========================================================================

  var shellJaInicializado = false;

  function entrarModoShell(user) {
    mostrarEstado("shell");
    topbarData.textContent = dataHoje();

    // Setup DOM roda APENAS UMA VEZ — evita listeners duplicados
    // (Supabase pode disparar SIGNED_IN mais de uma vez no carregamento)
    if (!shellJaInicializado) {
      aplicarPreferenciaSidebar();
      ativarNavegacao();
      ativarPaginaOrcamentos();
      shellJaInicializado = true;
    }

    // Busca perfil (nome + tipo) e preenche topbar
    client.from("perfis").select("nome, perfil").eq("id", user.id).single()
      .then(function (resposta) {
        var nome = user.email;
        var perfil = "";
        if (!resposta.error && resposta.data) {
          nome = resposta.data.nome || user.email;
          perfil = resposta.data.perfil || "";
        }
        topbarNome.textContent = nome + (perfil ? " · " + perfil : "");
        topbarAvatar.textContent = iniciais(nome);
      });

    carregarDashboard(user);

    // Entrar já na página Dashboard
    showPage("dashboard");
  }

  // ------------- Sidebar (colapso + macros expansíveis) --------------------

  var SIDEBAR_PREF_KEY = "terra.sidebar.colapsada";

  function aplicarPreferenciaSidebar() {
    var colapsada = localStorage.getItem(SIDEBAR_PREF_KEY) === "1";
    sidebar.classList.toggle("colapsada", colapsada);
  }

  btnToggleSidebar.addEventListener("click", function () {
    var agora = !sidebar.classList.contains("colapsada");
    sidebar.classList.toggle("colapsada", agora);
    localStorage.setItem(SIDEBAR_PREF_KEY, agora ? "1" : "0");
  });

  // ------------- Navegação entre páginas -----------------------------------

  function ativarNavegacao() {
    // Cliques em itens raiz (Dashboard, Configuração) e subitens: mostram página
    document.querySelectorAll("#shell [data-page]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var page = btn.getAttribute("data-page");
        showPage(page);
      });
    });

    // Cliques no header da macro: expandem/recolhem
    document.querySelectorAll("#shell .sb-group").forEach(function (grupo) {
      var header = grupo.querySelector(".sb-group-header");
      if (!header) return;
      header.addEventListener("click", function () {
        grupo.classList.toggle("aberto");
      });
    });
  }

  function showPage(pageId) {
    // Mostrar/esconder seções da main
    document.querySelectorAll("#shell .main .page").forEach(function (sec) {
      sec.hidden = sec.getAttribute("data-page") !== pageId;
    });

    // Marcar item ativo na sidebar (e abrir a macro que contém o item, se houver)
    document.querySelectorAll("#shell .sb-item, #shell .sb-sub").forEach(function (b) {
      b.classList.toggle("ativo", b.getAttribute("data-page") === pageId);
    });
    var alvo = document.querySelector('#shell [data-page="' + pageId + '"]');
    if (alvo) {
      var grupo = alvo.closest(".sb-group");
      if (grupo) grupo.classList.add("aberto");
    }

    // Carregamento sob demanda
    if (pageId === "faturamento") carregarOrcamentosSeNecessario();
  }

  // ------------- Dashboard: 4 cards de totais ------------------------------

  function carregarDashboard(user) {
    setDashStatus("Consultando totais…", "carregando");

    var debug = { user_id: user.id, email: user.email, queries: {} };

    // 1) Contagem de orçamentos
    var q1 = client.from("orcamentos")
      .select("*", { count: "exact", head: true })
      .then(function (r) {
        if (r.error) { mOrcamentos.textContent = "erro"; debug.queries.orcamentos_count = r.error.message; return; }
        mOrcamentos.textContent = fmtInt(r.count);
        debug.queries.orcamentos_count = r.count;
      });

    // 2, 3, 4) Somas (venda, nota_fiscal, recebimento) — puxa 3 colunas numa query só
    var q2 = client.from("orcamentos")
      .select("venda, nota_fiscal, recebimento")
      .then(function (r) {
        if (r.error) {
          mVendido.textContent = mFaturado.textContent = mRecebido.textContent = "erro";
          debug.queries.orcamentos_sums = r.error.message;
          return;
        }
        var sV = 0, sF = 0, sR = 0;
        (r.data || []).forEach(function (row) {
          sV += Number(row.venda || 0);
          sF += Number(row.nota_fiscal || 0);
          sR += Number(row.recebimento || 0);
        });
        mVendido.textContent  = fmtBRL(sV);
        mFaturado.textContent = fmtBRL(sF);
        mRecebido.textContent = fmtBRL(sR);
        debug.queries.orcamentos_sums = {
          linhas: (r.data || []).length,
          total_vendido: sV, total_faturado: sF, total_recebido: sR
        };
      });

    Promise.all([q1, q2]).then(function () {
      setDashStatus(null);
      setDebug(debug);
    });
  }

  // =========================================================================
  // 6. PÁGINA ORÇAMENTOS (Entrega 4a) — Gestão de Faturamento
  // =========================================================================

  var orcamentosCarregados = false;
  var orcamentosCarregando = false;
  var orcamentosLista = [];        // linhas da tabela orcamentos
  var tipoPorOrcamento = {};       // { "24-001": "Mobília Fixa", ... }

  var fatBusca     = document.getElementById("fat-busca");
  var fatStatus    = document.getElementById("fat-status");
  var fatTipo      = document.getElementById("fat-tipo");
  var fatBtnLimpar = document.getElementById("fat-btn-limpar");
  var fatTbody     = document.getElementById("fat-tbody");
  var fatLbl       = document.getElementById("fat-lbl");
  var fatMQtd      = document.getElementById("fat-m-qtd");
  var fatMVenda    = document.getElementById("fat-m-venda");
  var fatMAFat     = document.getElementById("fat-m-afaturar");
  var fatMARec     = document.getElementById("fat-m-areceber");

  function ativarPaginaOrcamentos() {
    if (!fatBusca) return;
    fatBusca.addEventListener("input",  renderOrcamentos);
    fatStatus.addEventListener("change", renderOrcamentos);
    fatTipo.addEventListener("change",   renderOrcamentos);
    fatBtnLimpar.addEventListener("click", function () {
      fatBusca.value = "";
      fatStatus.value = "abertos";
      fatTipo.value = "";
      renderOrcamentos();
    });
  }

  function carregarOrcamentosSeNecessario() {
    if (orcamentosCarregados || orcamentosCarregando) return;
    orcamentosCarregando = true;

    fatTbody.innerHTML = '<tr><td colspan="9" class="tbl-vazio">Carregando orçamentos e movimentos…</td></tr>';

    var qOrc = client.from("orcamentos")
      .select("data, orcamento, nome, venda, recebimento, a_receber, nota_fiscal, a_faturar, status_recebimento, status_faturamento")
      .order("data", { ascending: false });

    // Puxa só o necessário para derivar Tipo por orçamento
    var qMov = client.from("movimentos")
      .select("orcamento, tipo, valor");

    Promise.all([qOrc, qMov]).then(function (respostas) {
      var rOrc = respostas[0], rMov = respostas[1];

      if (rOrc.error) {
        fatTbody.innerHTML = '<tr><td colspan="9" class="tbl-vazio erro">Erro ao carregar orçamentos: ' + rOrc.error.message + '</td></tr>';
        orcamentosCarregando = false;
        return;
      }

      orcamentosLista = rOrc.data || [];
      tipoPorOrcamento = derivarTipoPorOrcamento((rMov && rMov.data) || []);
      orcamentosCarregados = true;
      orcamentosCarregando = false;
      renderOrcamentos();
    });
  }

  // Derivação: para cada orçamento, soma os valores de movimentos por tipo
  // e o Tipo dominante (maior soma) vence. Ignora tipos vazios.
  function derivarTipoPorOrcamento(movimentos) {
    var somaPorOrcTipo = {};
    movimentos.forEach(function (m) {
      if (!m.orcamento || !m.tipo) return;
      if (!somaPorOrcTipo[m.orcamento]) somaPorOrcTipo[m.orcamento] = {};
      somaPorOrcTipo[m.orcamento][m.tipo] = (somaPorOrcTipo[m.orcamento][m.tipo] || 0) + Number(m.valor || 0);
    });

    var mapa = {};
    Object.keys(somaPorOrcTipo).forEach(function (orc) {
      var tipos = somaPorOrcTipo[orc];
      var melhor = null, melhorValor = -Infinity;
      Object.keys(tipos).forEach(function (t) {
        if (tipos[t] > melhorValor) { melhor = t; melhorValor = tipos[t]; }
      });
      mapa[orc] = melhor;
    });
    return mapa;
  }

  function filtrarOrcamentos() {
    var busca  = (fatBusca.value || "").trim().toLowerCase();
    var status = fatStatus.value;
    var tipo   = fatTipo.value;

    return orcamentosLista.filter(function (r) {
      // Busca
      if (busca) {
        var alvo = ((r.nome || "") + " " + (r.orcamento || "")).toLowerCase();
        if (alvo.indexOf(busca) === -1) return false;
      }
      // Tipo
      if (tipo) {
        if (tipoPorOrcamento[r.orcamento] !== tipo) return false;
      }
      // Status
      var areceber = Number(r.a_receber || 0);
      var afaturar = Number(r.a_faturar || 0);
      if (status === "abertos") {
        if (areceber <= 0.01 && afaturar <= 0.01) return false;
      } else if (status === "ambos_liq") {
        if (areceber > 0.01 || afaturar > 0.01) return false;
      } else if (status === "rec_aberto") {
        if (areceber <= 0.01) return false;
      } else if (status === "fat_aberto") {
        if (afaturar <= 0.01) return false;
      }
      return true;
    });
  }

  function renderOrcamentos() {
    var filtrados = filtrarOrcamentos();

    // Métricas
    var mQtd = filtrados.length;
    var mV = 0, mF = 0, mR = 0;
    filtrados.forEach(function (r) {
      mV += Number(r.venda || 0);
      mF += Number(r.a_faturar || 0);
      mR += Number(r.a_receber || 0);
    });
    fatMQtd.textContent   = fmtInt(mQtd);
    fatMVenda.textContent = fmtBRL(mV);
    fatMAFat.textContent  = fmtBRL(mF);
    fatMARec.textContent  = fmtBRL(mR);
    fatLbl.textContent    = mQtd + " de " + orcamentosLista.length + " orçamento" + (orcamentosLista.length === 1 ? "" : "s");

    // Tabela
    if (!filtrados.length) {
      fatTbody.innerHTML = '<tr><td colspan="9" class="tbl-vazio">Nenhum orçamento bate com os filtros.</td></tr>';
      return;
    }

    var html = filtrados.map(function (r) {
      var tipo = tipoPorOrcamento[r.orcamento] || "—";
      return (
        '<tr>' +
          '<td>' + fmtData(r.data) + '</td>' +
          '<td class="mono">' + escHtml(r.orcamento) + '</td>' +
          '<td>' + escHtml(r.nome || "—") + '</td>' +
          '<td>' + badgeTipo(tipo) + '</td>' +
          '<td class="num">' + fmtBRL(r.venda) + '</td>' +
          '<td class="num">' + fmtBRL(r.recebimento) + '</td>' +
          '<td class="num ' + (Number(r.a_receber) > 0 ? 'destaque' : '') + '">' + fmtBRL(r.a_receber) + '</td>' +
          '<td class="num">' + fmtBRL(r.nota_fiscal) + '</td>' +
          '<td class="num ' + (Number(r.a_faturar) > 0 ? 'destaque' : '') + '">' + fmtBRL(r.a_faturar) + '</td>' +
        '</tr>'
      );
    }).join("");
    fatTbody.innerHTML = html;
  }

  function fmtData(iso) {
    if (!iso) return "—";
    var partes = String(iso).slice(0,10).split("-");
    if (partes.length !== 3) return iso;
    return partes[2] + "/" + partes[1] + "/" + partes[0];
  }
  function escHtml(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function badgeTipo(tipo) {
    if (!tipo || tipo === "—") return '<span class="badge-tipo vazio">—</span>';
    var classe = "outras";
    if (/fixa/i.test(tipo))          classe = "fixa";
    else if (/solta/i.test(tipo))    classe = "solta";
    else if (/assist/i.test(tipo))   classe = "assist";
    return '<span class="badge-tipo ' + classe + '">' + escHtml(tipo) + '</span>';
  }

})();
