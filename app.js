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
  var bootTroca      = document.getElementById("boot-troca");
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
    bootTroca.hidden      = qual !== "troca";
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
    if (session) verificarSenhaTempEEntrar(session.user);
    else         entrarModoLogin();
  });

  client.auth.onAuthStateChange(function (event, session) {
    if (event === "SIGNED_IN" && session) verificarSenhaTempEEntrar(session.user);
    else if (event === "SIGNED_OUT")      entrarModoLogin();
  });

  // Antes do shell, checar a flag senha_temporaria em perfis.
  // Se true, empurrar o usuário para a tela de troca antes de deixar usar o sistema.
  function verificarSenhaTempEEntrar(user) {
    client.from("perfis").select("nome, perfil, senha_temporaria").eq("id", user.id).single()
      .then(function (r) {
        if (!r.error && r.data && r.data.senha_temporaria === true) {
          entrarModoTrocaSenha(user, /*obrigatoria=*/true);
        } else {
          entrarModoShell(user);
        }
      });
  }

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
    window._terraUser = user;

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
    if (pageId === "faturamento")  carregarOrcamentosSeNecessario();
    if (pageId === "vendas")       carregarVendasSeNecessario();
    if (pageId === "consolidado")  carregarConsolidadoSeNecessario();
    if (pageId === "notas")        esperarOrcamentosCarregados(renderNotas);
    if (pageId === "recebimentos") esperarOrcamentosCarregados(renderRecebimentos);
    if (pageId === "despesas")     carregarDespesasSeNecessario();
    if (pageId === "movimentos")   esperarOrcamentosCarregados(renderLancamentos);
    if (pageId === "custos_os")    esperarOrcamentosCarregados(renderCustosOS);
    if (pageId === "entregas")     carregarEntregasSeNecessario();
    if (pageId === "cfg_plano")      carregarPlanoContasSeNecessario();
    if (pageId === "cfg_cfop")       carregarCfopSeNecessario();
    if (pageId === "cfg_parametros") carregarParametros(window._terraUser);
    if (pageId === "cfg_diag")       renderDiagnostico();
    if (pageId === "cfg_usuarios")   carregarUsuariosSeNecessario();
    if (pageId === "dre")            carregarDreSeNecessario();
    if (pageId === "rh_funcionarios") carregarFuncionariosSeNecessario();
    if (pageId === "rh_beneficios")   carregarBeneficiosSeNecessario();
    if (pageId === "rh_folha")        carregarFolhaSeNecessario();
    if (pageId === "rh_impostos")     carregarImpostosSeNecessario();
    if (pageId === "rh_organograma")  carregarOrganogramaSeNecessario();
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

    // Vendas (reutiliza orcamentosLista carregado pela página Orçamentos)
    var vendBusca     = document.getElementById("vend-busca");
    var vendMes       = document.getElementById("vend-mes");
    var vendTipo      = document.getElementById("vend-tipo");
    var vendBtnLimpar = document.getElementById("vend-btn-limpar");
    if (vendBusca) {
      vendBusca.addEventListener("input",  renderVendas);
      vendMes.addEventListener("change",   renderVendas);
      vendTipo.addEventListener("change",  renderVendas);
      vendBtnLimpar.addEventListener("click", function () {
        vendBusca.value = "";
        vendMes.value = "";
        vendTipo.value = "";
        renderVendas();
      });
    }

    // Consolidado
    var consAno = document.getElementById("cons-ano");
    if (consAno) {
      consAno.addEventListener("change", renderConsolidado);
    }
    // DRE
    var dreAno = document.getElementById("dre-ano");
    if (dreAno) dreAno.addEventListener("change", renderDre);

    // 4c/4d — filtros de telas baseadas em movimentos
    ligarFiltros("nf-",  renderNotas);
    ligarFiltros("rec-", renderRecebimentos);
    ligarFiltros("mov-", renderLancamentos);
    ligarFiltros("os-",  renderCustosOS);
    ligarFiltros("ent-", renderEntregas);
    ligarFiltros("desp-", renderDespesas);
    ligarFiltros("pc-",  renderPlanoContas);
    ligarFiltros("cf-",  renderCfop);
    ligarFiltros("us-",  renderUsuarios);
    ligarFiltros("fn-",  renderFuncionarios);
    ligarFiltros("bn-",  renderBeneficios);
    ligarFiltros("fl-",  renderFolha);
    ligarFiltros("ir-",  renderImpostos);

    // Botões "+ Novo" do RH
    var btnNovoFun = document.getElementById("fn-btn-novo");
    var btnNovoBen = document.getElementById("bn-btn-novo");
    var btnNovoFol = document.getElementById("fl-btn-novo");
    var btnNovoImp = document.getElementById("ir-btn-novo");
    if (btnNovoFun) btnNovoFun.addEventListener("click", abrirModalFuncionario);
    if (btnNovoBen) btnNovoBen.addEventListener("click", abrirModalBeneficio);
    if (btnNovoFol) btnNovoFol.addEventListener("click", abrirModalFolha);
    if (btnNovoImp) btnNovoImp.addEventListener("click", abrirModalImposto);

    // Organograma
    var orgExp = document.getElementById("org-btn-expandir");
    var orgRec = document.getElementById("org-btn-recolher");
    var orgPdf = document.getElementById("org-btn-pdf");
    if (orgExp) orgExp.addEventListener("click", function () { setColapsoOrganograma(false); });
    if (orgRec) orgRec.addEventListener("click", function () { setColapsoOrganograma(true);  });
    if (orgPdf) orgPdf.addEventListener("click", baixarOrganogramaPdf);

    // Sub-navegação em Configuração
    document.querySelectorAll(".config-card[data-subpage]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var alvo = btn.getAttribute("data-subpage");
        if (alvo) showPage(alvo);
      });
    });
    document.querySelectorAll("[data-goto]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showPage(btn.getAttribute("data-goto"));
      });
    });

    // Limpar Dados
    document.querySelectorAll("[data-limpar]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        limparTabela(btn.getAttribute("data-limpar"));
      });
    });
  }

  function ligarFiltros(prefixo, renderFn) {
    var ids = ["busca", "mes", "ano", "tipo", "natureza", "status", "filtro", "grupo", "nivel"];
    ids.forEach(function (suf) {
      var el = document.getElementById(prefixo + suf);
      if (!el) return;
      var evt = el.tagName === "INPUT" && el.type !== "month" ? "input" : "change";
      el.addEventListener(evt, renderFn);
    });
    var btn = document.getElementById(prefixo + "btn-limpar");
    if (btn) {
      btn.addEventListener("click", function () {
        ids.forEach(function (suf) {
          var el = document.getElementById(prefixo + suf);
          if (el) {
            if (el.tagName === "SELECT") el.selectedIndex = 0;
            else el.value = "";
          }
        });
        renderFn();
      });
    }
  }

  function carregarOrcamentosSeNecessario() {
    if (orcamentosCarregados || orcamentosCarregando) return;
    orcamentosCarregando = true;

    fatTbody.innerHTML = '<tr><td colspan="9" class="tbl-vazio">Carregando orçamentos e movimentos…</td></tr>';

    var qOrc = client.from("orcamentos")
      .select("data, orcamento, nome, parceiro, venda, recebimento, a_receber, nota_fiscal, a_faturar, status_recebimento, status_faturamento")
      .order("data", { ascending: false });

    // Puxa movimentos completos — serve 4a (derivação de Tipo) e 4c/4d
    var qMov = client.from("movimentos")
      .select("id, data, orcamento, nome, tipo, natureza, valor, nota_fiscal, os, item, custo")
      .order("data", { ascending: false });

    Promise.all([qOrc, qMov]).then(function (respostas) {
      var rOrc = respostas[0], rMov = respostas[1];

      if (rOrc.error) {
        fatTbody.innerHTML = '<tr><td colspan="9" class="tbl-vazio erro">Erro ao carregar orçamentos: ' + rOrc.error.message + '</td></tr>';
        orcamentosCarregando = false;
        return;
      }

      orcamentosLista = rOrc.data || [];
      movimentosCompletos = (rMov && rMov.data) || [];
      tipoPorOrcamento = derivarTipoPorOrcamento(movimentosCompletos);
      clientePorOrcamento = {};
      orcamentosLista.forEach(function (r) { clientePorOrcamento[r.orcamento] = r.nome || null; });
      orcamentosCarregados = true;
      orcamentosCarregando = false;
      renderOrcamentos();
    });
  }

  var movimentosCompletos = [];
  var clientePorOrcamento = {};

  function esperarOrcamentosCarregados(cb) {
    if (orcamentosCarregados) { cb(); return; }
    if (!orcamentosCarregando) carregarOrcamentosSeNecessario();
    var iv = setInterval(function () {
      if (orcamentosCarregados) { clearInterval(iv); cb(); }
    }, 150);
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

  function mesRef(iso) {
    // "2025-10-15" → "10/2025"
    if (!iso) return "—";
    var p = String(iso).slice(0,10).split("-");
    if (p.length !== 3) return iso;
    return p[1] + "/" + p[0];
  }

  // =========================================================================
  // 7. PÁGINA VENDAS (Entrega 4b) — listagem + filtros
  // =========================================================================

  function carregarVendasSeNecessario() {
    // Depende da mesma lista de orçamentos da página Orçamentos.
    if (orcamentosCarregados) { renderVendas(); return; }
    if (orcamentosCarregando) return;
    // Dispara a carga (já cuida de chamar renderOrcamentos, mas não renderVendas).
    carregarOrcamentosSeNecessario();
    // Espera a carga concluir para renderizar Vendas.
    var intervalo = setInterval(function () {
      if (orcamentosCarregados) { clearInterval(intervalo); renderVendas(); }
    }, 150);
  }

  function renderVendas() {
    var vendBusca = document.getElementById("vend-busca");
    var vendMes   = document.getElementById("vend-mes");
    var vendTipo  = document.getElementById("vend-tipo");
    var vendTbody = document.getElementById("vend-tbody");
    var vendLbl   = document.getElementById("vend-lbl");
    var mQtd      = document.getElementById("vend-m-qtd");
    var mValor    = document.getElementById("vend-m-valor");
    var mTicket   = document.getElementById("vend-m-ticket");

    var busca = (vendBusca.value || "").trim().toLowerCase();
    var mes   = vendMes.value;   // formato "YYYY-MM" ou ""
    var tipo  = vendTipo.value;

    var filtrados = orcamentosLista.filter(function (r) {
      if (busca) {
        var alvo = ((r.nome || "") + " " + (r.orcamento || "") + " " + (r.parceiro || "")).toLowerCase();
        if (alvo.indexOf(busca) === -1) return false;
      }
      if (mes && String(r.data || "").slice(0,7) !== mes) return false;
      if (tipo && tipoPorOrcamento[r.orcamento] !== tipo) return false;
      return true;
    });

    var soma = 0;
    filtrados.forEach(function (r) { soma += Number(r.venda || 0); });

    mQtd.textContent   = fmtInt(filtrados.length);
    mValor.textContent = fmtBRL(soma);
    mTicket.textContent = filtrados.length ? fmtBRL(soma / filtrados.length) : "—";
    vendLbl.textContent = filtrados.length + " de " + orcamentosLista.length;

    if (!filtrados.length) {
      vendTbody.innerHTML = '<tr><td colspan="7" class="tbl-vazio">Nenhum orçamento bate com os filtros.</td></tr>';
      return;
    }

    vendTbody.innerHTML = filtrados.map(function (r) {
      var tipo = tipoPorOrcamento[r.orcamento] || "—";
      return (
        '<tr>' +
          '<td>' + fmtData(r.data) + '</td>' +
          '<td class="mono">' + escHtml(r.orcamento) + '</td>' +
          '<td>' + escHtml(r.nome || "—") + '</td>' +
          '<td>' + escHtml(r.parceiro || "—") + '</td>' +
          '<td>' + badgeTipo(tipo) + '</td>' +
          '<td class="num">' + fmtBRL(r.venda) + '</td>' +
          '<td class="mono">' + mesRef(r.data) + '</td>' +
        '</tr>'
      );
    }).join("");
  }

  // =========================================================================
  // 8. PÁGINA CONSOLIDADO (Entrega 4b) — receita × custo mês a mês
  // =========================================================================

  var rcCarregado = false;
  var rcCarregando = false;
  var rcLista = [];   // linhas de receitas_custos

  function carregarConsolidadoSeNecessario() {
    if (rcCarregado) { renderConsolidado(); return; }
    if (rcCarregando) return;
    rcCarregando = true;

    var consTbody = document.getElementById("cons-tbody");
    consTbody.innerHTML = '<tr><td colspan="5" class="tbl-vazio">Carregando receitas e custos…</td></tr>';

    client.from("receitas_custos")
      .select("ano, mes, categoria, valor")
      .then(function (r) {
        if (r.error) {
          consTbody.innerHTML = '<tr><td colspan="5" class="tbl-vazio erro">Erro: ' + r.error.message + '</td></tr>';
          rcCarregando = false;
          return;
        }
        rcLista = r.data || [];
        rcCarregado = true;
        rcCarregando = false;
        renderConsolidado();
      });
  }

  function renderConsolidado() {
    var consAno = document.getElementById("cons-ano");
    var consTbody = document.getElementById("cons-tbody");
    var consLbl  = document.getElementById("cons-lbl");
    var mReceita = document.getElementById("cons-m-receita");
    var mCusto   = document.getElementById("cons-m-custo");
    var mResult  = document.getElementById("cons-m-resultado");
    var mMargem  = document.getElementById("cons-m-margem");

    var ano = Number(consAno.value);
    var doAno = rcLista.filter(function (r) { return Number(r.ano) === ano; });

    // Agrupar por mês
    var porMes = {};
    for (var m = 1; m <= 12; m++) porMes[m] = { receita: 0, custo: 0 };
    doAno.forEach(function (r) {
      var m = Number(r.mes);
      if (!porMes[m]) return;
      if (r.categoria === "receita") porMes[m].receita += Number(r.valor || 0);
      else if (r.categoria === "custo") porMes[m].custo += Number(r.valor || 0);
    });

    // Totais do ano
    var totR = 0, totC = 0;
    for (var mm = 1; mm <= 12; mm++) { totR += porMes[mm].receita; totC += porMes[mm].custo; }
    var resultado = totR - totC;
    var margem = totR > 0 ? (resultado / totR) : null;

    mReceita.textContent = fmtBRL(totR);
    mCusto.textContent   = fmtBRL(totC);
    mResult.textContent  = fmtBRL(resultado);
    mMargem.textContent  = margem === null ? "—" : (margem * 100).toFixed(1).replace(".", ",") + "%";
    consLbl.textContent  = rcLista.length + " lançamento" + (rcLista.length === 1 ? "" : "s") + " em receitas_custos";

    // Tabela mensal
    var nomeMes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    var linhas = [];
    for (var i = 1; i <= 12; i++) {
      var rr = porMes[i].receita, cc = porMes[i].custo;
      var res = rr - cc;
      var mrg = rr > 0 ? (res / rr * 100).toFixed(1).replace(".", ",") + "%" : "—";
      linhas.push(
        '<tr>' +
          '<td>' + nomeMes[i-1] + '/' + String(ano).slice(2) + '</td>' +
          '<td class="num">' + (rr ? fmtBRL(rr) : '—') + '</td>' +
          '<td class="num">' + (cc ? fmtBRL(cc) : '—') + '</td>' +
          '<td class="num ' + (res > 0 ? 'destaque' : '') + '">' + (rr || cc ? fmtBRL(res) : '—') + '</td>' +
          '<td class="num">' + mrg + '</td>' +
        '</tr>'
      );
    }
    // Linha total
    linhas.push(
      '<tr class="tot">' +
        '<td><strong>Ano ' + ano + '</strong></td>' +
        '<td class="num"><strong>' + fmtBRL(totR) + '</strong></td>' +
        '<td class="num"><strong>' + fmtBRL(totC) + '</strong></td>' +
        '<td class="num destaque"><strong>' + fmtBRL(resultado) + '</strong></td>' +
        '<td class="num"><strong>' + (margem === null ? "—" : (margem * 100).toFixed(1).replace(".", ",") + "%") + '</strong></td>' +
      '</tr>'
    );
    consTbody.innerHTML = linhas.join("");
  }

  // =========================================================================
  // 9. HELPERS comuns às telas 4c/4d/5
  // =========================================================================

  function matchBusca(busca, campos) {
    if (!busca) return true;
    var alvo = campos.map(function (c) { return c || ""; }).join(" ").toLowerCase();
    return alvo.indexOf(busca) !== -1;
  }

  function valText(el, v) { if (el) el.textContent = v; }

  function preencherTbody(tbody, linhas, colspan, vazio) {
    if (!linhas.length) {
      tbody.innerHTML = '<tr><td colspan="' + colspan + '" class="tbl-vazio">' + (vazio || "Nada bate com os filtros.") + '</td></tr>';
      return;
    }
    tbody.innerHTML = linhas.join("");
  }

  // =========================================================================
  // 10. NOTAS FISCAIS (4c) — movimentos natureza='Nota Fiscal'
  // =========================================================================

  function renderNotas() {
    var tbody = document.getElementById("nf-tbody");
    var busca = (document.getElementById("nf-busca").value || "").trim().toLowerCase();
    var mes   = document.getElementById("nf-mes").value;

    var filtrados = movimentosCompletos.filter(function (m) {
      if (m.natureza !== "Nota Fiscal") return false;
      if (mes && String(m.data || "").slice(0,7) !== mes) return false;
      return matchBusca(busca, [m.orcamento, m.nome, m.nota_fiscal, m.os]);
    });

    var soma = 0;
    filtrados.forEach(function (m) { soma += Number(m.valor || 0); });

    valText(document.getElementById("nf-m-qtd"), fmtInt(filtrados.length));
    valText(document.getElementById("nf-m-valor"), fmtBRL(soma));
    valText(document.getElementById("nf-lbl"), filtrados.length + " NF");

    preencherTbody(tbody, filtrados.map(function (m) {
      return '<tr>' +
        '<td>' + fmtData(m.data) + '</td>' +
        '<td class="mono">' + escHtml(m.orcamento) + '</td>' +
        '<td>' + escHtml(m.nome || "—") + '</td>' +
        '<td class="mono">' + escHtml(m.nota_fiscal || "—") + '</td>' +
        '<td class="mono">' + escHtml(m.os || "—") + '</td>' +
        '<td>' + escHtml(m.item || "—") + '</td>' +
        '<td class="num">' + fmtBRL(m.valor) + '</td>' +
      '</tr>';
    }), 7);
  }

  // =========================================================================
  // 11. RECEBIMENTOS (4c) — movimentos natureza='Recebimento'
  // =========================================================================

  function renderRecebimentos() {
    var tbody = document.getElementById("rec-tbody");
    var busca = (document.getElementById("rec-busca").value || "").trim().toLowerCase();
    var mes   = document.getElementById("rec-mes").value;

    var filtrados = movimentosCompletos.filter(function (m) {
      if (m.natureza !== "Recebimento") return false;
      if (mes && String(m.data || "").slice(0,7) !== mes) return false;
      return matchBusca(busca, [m.orcamento, m.nome, m.os]);
    });

    var soma = 0;
    filtrados.forEach(function (m) { soma += Number(m.valor || 0); });

    valText(document.getElementById("rec-m-qtd"), fmtInt(filtrados.length));
    valText(document.getElementById("rec-m-valor"), fmtBRL(soma));
    valText(document.getElementById("rec-lbl"), filtrados.length + " recebimentos");

    preencherTbody(tbody, filtrados.map(function (m) {
      return '<tr>' +
        '<td>' + fmtData(m.data) + '</td>' +
        '<td class="mono">' + escHtml(m.orcamento) + '</td>' +
        '<td>' + escHtml(m.nome || "—") + '</td>' +
        '<td>' + badgeTipo(m.tipo || "—") + '</td>' +
        '<td class="mono">' + escHtml(m.os || "—") + '</td>' +
        '<td>' + escHtml(m.item || "—") + '</td>' +
        '<td class="num">' + fmtBRL(m.valor) + '</td>' +
      '</tr>';
    }), 7);
  }

  // =========================================================================
  // 12. DESPESAS (4c) — receitas_custos categoria='custo'
  // =========================================================================

  function carregarDespesasSeNecessario() {
    if (rcCarregado) { renderDespesas(); return; }
    if (rcCarregando) return;
    carregarConsolidadoSeNecessario();
    var iv = setInterval(function () {
      if (rcCarregado) { clearInterval(iv); renderDespesas(); }
    }, 150);
  }

  function renderDespesas() {
    var tbody = document.getElementById("desp-tbody");
    var busca = (document.getElementById("desp-busca").value || "").trim().toLowerCase();
    var ano   = document.getElementById("desp-ano").value;
    var mes   = document.getElementById("desp-mes").value;

    var filtrados = rcLista.filter(function (r) {
      if (r.categoria !== "custo") return false;
      if (ano && String(r.ano) !== ano) return false;
      if (mes && String(r.mes) !== mes) return false;
      return matchBusca(busca, [r.subcategoria]);
    });

    var soma = 0;
    filtrados.forEach(function (r) { soma += Number(r.valor || 0); });

    valText(document.getElementById("desp-m-qtd"), fmtInt(filtrados.length));
    valText(document.getElementById("desp-m-valor"), fmtBRL(soma));
    valText(document.getElementById("desp-lbl"), filtrados.length + " lançamentos");

    filtrados.sort(function (a, b) {
      if (a.ano !== b.ano) return b.ano - a.ano;
      return b.mes - a.mes;
    });

    var nomeMes = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
    preencherTbody(tbody, filtrados.map(function (r) {
      return '<tr>' +
        '<td>' + r.ano + '</td>' +
        '<td>' + nomeMes[r.mes - 1] + '</td>' +
        '<td>' + escHtml(r.subcategoria || "—") + '</td>' +
        '<td class="num">' + fmtBRL(r.valor) + '</td>' +
      '</tr>';
    }), 4);
  }

  // =========================================================================
  // 13. LANÇAMENTOS (4c) — todos os movimentos
  // =========================================================================

  function renderLancamentos() {
    var tbody = document.getElementById("mov-tbody");
    var busca     = (document.getElementById("mov-busca").value || "").trim().toLowerCase();
    var natureza  = document.getElementById("mov-natureza").value;
    var tipo      = document.getElementById("mov-tipo").value;
    var mes       = document.getElementById("mov-mes").value;

    var filtrados = movimentosCompletos.filter(function (m) {
      if (natureza && m.natureza !== natureza) return false;
      if (tipo && m.tipo !== tipo) return false;
      if (mes && String(m.data || "").slice(0,7) !== mes) return false;
      return matchBusca(busca, [m.orcamento, m.nome, m.os, m.nota_fiscal, m.item]);
    });

    var soma = 0;
    filtrados.forEach(function (m) { soma += Number(m.valor || 0); });

    valText(document.getElementById("mov-m-qtd"), fmtInt(filtrados.length));
    valText(document.getElementById("mov-m-valor"), fmtBRL(soma));
    valText(document.getElementById("mov-lbl"), filtrados.length + " de " + movimentosCompletos.length);

    var linhas = filtrados.slice(0, 500).map(function (m) {
      return '<tr>' +
        '<td>' + fmtData(m.data) + '</td>' +
        '<td class="mono">' + escHtml(m.orcamento) + '</td>' +
        '<td>' + escHtml(m.nome || "—") + '</td>' +
        '<td>' + badgeTipo(m.tipo || "—") + '</td>' +
        '<td>' + escHtml(m.natureza || "—") + '</td>' +
        '<td class="mono">' + escHtml(m.nota_fiscal || "—") + '</td>' +
        '<td class="mono">' + escHtml(m.os || "—") + '</td>' +
        '<td>' + escHtml(m.item || "—") + '</td>' +
        '<td class="num">' + fmtBRL(m.valor) + '</td>' +
      '</tr>';
    });
    if (filtrados.length > 500) {
      linhas.push('<tr><td colspan="9" class="tbl-vazio">… exibindo as primeiras 500 de ' + filtrados.length + '. Refine os filtros.</td></tr>');
    }
    preencherTbody(tbody, linhas, 9);
  }

  // =========================================================================
  // 14. CUSTO POR OS (4d)
  // =========================================================================

  function renderCustosOS() {
    var tbody = document.getElementById("os-tbody");
    var busca = (document.getElementById("os-busca").value || "").trim().toLowerCase();

    var porOS = {};
    movimentosCompletos.forEach(function (m) {
      var custo = Number(m.custo || 0);
      if (!m.os || !custo) return;
      var chave = m.os;
      if (!porOS[chave]) porOS[chave] = { os: m.os, orcamento: m.orcamento, cliente: m.nome, count: 0, total: 0 };
      porOS[chave].count++;
      porOS[chave].total += custo;
    });

    var lista = Object.keys(porOS).map(function (k) { return porOS[k]; });
    lista = lista.filter(function (o) {
      return matchBusca(busca, [o.os, o.orcamento, o.cliente]);
    });
    lista.sort(function (a, b) { return b.total - a.total; });

    var soma = 0;
    lista.forEach(function (o) { soma += o.total; });

    valText(document.getElementById("os-m-qtd"), fmtInt(lista.length));
    valText(document.getElementById("os-m-valor"), fmtBRL(soma));
    valText(document.getElementById("os-lbl"), lista.length + " OS");

    preencherTbody(tbody, lista.map(function (o) {
      return '<tr>' +
        '<td class="mono">' + escHtml(o.os) + '</td>' +
        '<td class="mono">' + escHtml(o.orcamento || "—") + '</td>' +
        '<td>' + escHtml(o.cliente || "—") + '</td>' +
        '<td class="num">' + fmtInt(o.count) + '</td>' +
        '<td class="num destaque">' + fmtBRL(o.total) + '</td>' +
      '</tr>';
    }), 5, "Nenhum movimento com custo cadastrado.");
  }

  // =========================================================================
  // 15. ENTREGAS PENDENTES (4d) — reconciliação Entrega S/ NF ↔ NF
  // =========================================================================

  var entregasVincCache = [];
  var entregasVincCarregado = false;

  function carregarEntregasSeNecessario() {
    esperarOrcamentosCarregados(function () {
      if (entregasVincCarregado) { renderEntregas(); return; }
      client.from("entregas_vinc").select("mov_key, nf").then(function (r) {
        entregasVincCache = (r.data || []);
        entregasVincCarregado = true;
        renderEntregas();
      });
    });
  }

  function movKey(m) {
    // Conforme v9: orcamento|data|natureza|valor|os|item
    return [m.orcamento || "", String(m.data || "").slice(0,10), m.natureza || "", String(Number(m.valor || 0)), m.os || "", m.item || ""].join("|");
  }

  function renderEntregas() {
    var tbody = document.getElementById("ent-tbody");
    var busca  = (document.getElementById("ent-busca").value || "").trim().toLowerCase();
    var status = document.getElementById("ent-status").value;

    var vincPorKey = {};
    entregasVincCache.forEach(function (v) { vincPorKey[v.mov_key] = v.nf || "—"; });

    var entregas = movimentosCompletos.filter(function (m) { return m.natureza === "Entrega S/ NF"; });

    var enriquecidas = entregas.map(function (m) {
      var k = movKey(m);
      return {
        mov: m,
        key: k,
        nf_vinculada: vincPorKey[k] || null
      };
    });

    var pendentes = enriquecidas.filter(function (e) { return !e.nf_vinculada; });
    var vinculadas = enriquecidas.filter(function (e) { return e.nf_vinculada; });

    var filtrados = enriquecidas.filter(function (e) {
      if (status === "pendente" && e.nf_vinculada) return false;
      if (status === "vinculada" && !e.nf_vinculada) return false;
      return matchBusca(busca, [e.mov.orcamento, e.mov.nome, e.mov.os, e.mov.item]);
    });

    var somaPendente = 0;
    pendentes.forEach(function (e) { somaPendente += Number(e.mov.valor || 0); });

    valText(document.getElementById("ent-m-pend"), fmtInt(pendentes.length));
    valText(document.getElementById("ent-m-vinc"), fmtInt(vinculadas.length));
    valText(document.getElementById("ent-m-valor"), fmtBRL(somaPendente));
    valText(document.getElementById("ent-lbl"), filtrados.length + " de " + enriquecidas.length);

    preencherTbody(tbody, filtrados.map(function (e) {
      var m = e.mov;
      var stTxt = e.nf_vinculada
        ? '<span class="badge-tipo solta">vinculada</span>'
        : '<span class="badge-tipo outras">pendente</span>';
      return '<tr>' +
        '<td>' + fmtData(m.data) + '</td>' +
        '<td class="mono">' + escHtml(m.orcamento) + '</td>' +
        '<td>' + escHtml(m.nome || "—") + '</td>' +
        '<td class="mono">' + escHtml(m.os || "—") + '</td>' +
        '<td>' + escHtml(m.item || "—") + '</td>' +
        '<td class="num">' + fmtBRL(m.valor) + '</td>' +
        '<td>' + stTxt + '</td>' +
        '<td class="mono">' + escHtml(e.nf_vinculada || "—") + '</td>' +
      '</tr>';
    }), 8);
  }

  // =========================================================================
  // 16. PLANO DE CONTAS (5)
  // =========================================================================

  var planoContas = [];
  var pcCarregado = false;

  function carregarPlanoContasSeNecessario() {
    if (pcCarregado) { renderPlanoContas(); return; }
    document.getElementById("pc-tbody").innerHTML = '<tr><td colspan="7" class="tbl-vazio">Carregando 510 contas…</td></tr>';
    client.from("plano_contas").select("*").order("seq", { ascending: true }).then(function (r) {
      if (r.error) {
        document.getElementById("pc-tbody").innerHTML = '<tr><td colspan="7" class="tbl-vazio erro">Erro: ' + r.error.message + '</td></tr>';
        return;
      }
      planoContas = r.data || [];
      pcCarregado = true;

      // Popular dropdown de grupos
      var grupos = {};
      planoContas.forEach(function (p) { if (p.grupo) grupos[p.grupo] = true; });
      var sel = document.getElementById("pc-grupo");
      Object.keys(grupos).sort().forEach(function (g) {
        var opt = document.createElement("option");
        opt.value = g; opt.textContent = g;
        sel.appendChild(opt);
      });

      renderPlanoContas();
    });
  }

  function renderPlanoContas() {
    var tbody = document.getElementById("pc-tbody");
    var busca = (document.getElementById("pc-busca").value || "").trim().toLowerCase();
    var grupo = document.getElementById("pc-grupo").value;
    var nivel = document.getElementById("pc-nivel").value;

    var filtrados = planoContas.filter(function (p) {
      if (grupo && p.grupo !== grupo) return false;
      if (nivel && String(p.nivel) !== nivel) return false;
      return matchBusca(busca, [p.cod_conta, p.descritivo, p.grupo, p.numero_conta]);
    });

    valText(document.getElementById("pc-lbl"), filtrados.length + " de " + planoContas.length);

    preencherTbody(tbody, filtrados.map(function (p) {
      return '<tr>' +
        '<td class="num">' + fmtInt(p.seq) + '</td>' +
        '<td class="num">' + fmtInt(p.nivel) + '</td>' +
        '<td class="mono">' + escHtml(p.cod_conta) + '</td>' +
        '<td class="mono">' + escHtml(p.numero_conta || "—") + '</td>' +
        '<td>' + escHtml(p.descritivo) + '</td>' +
        '<td>' + escHtml(p.grupo || "—") + '</td>' +
        '<td>' + escHtml(p.dre || "—") + '</td>' +
      '</tr>';
    }), 7);
  }

  // =========================================================================
  // 17. CFOP (5) — com toggle aplicavel
  // =========================================================================

  var cfopLista = [];
  var cfopCarregado = false;

  function carregarCfopSeNecessario() {
    if (cfopCarregado) { renderCfop(); return; }
    document.getElementById("cf-tbody").innerHTML = '<tr><td colspan="5" class="tbl-vazio">Carregando 590 CFOPs…</td></tr>';
    client.from("cfop").select("*").order("cfop", { ascending: true }).then(function (r) {
      if (r.error) {
        document.getElementById("cf-tbody").innerHTML = '<tr><td colspan="5" class="tbl-vazio erro">Erro: ' + r.error.message + '</td></tr>';
        return;
      }
      cfopLista = r.data || [];
      cfopCarregado = true;
      renderCfop();
    });
  }

  function renderCfop() {
    var tbody = document.getElementById("cf-tbody");
    var busca  = (document.getElementById("cf-busca").value || "").trim().toLowerCase();
    var filtro = document.getElementById("cf-filtro").value;

    var filtrados = cfopLista.filter(function (c) {
      if (filtro === "aplicaveis" && !c.aplicavel) return false;
      if (filtro === "nao" && c.aplicavel) return false;
      return matchBusca(busca, [c.cfop, c.cfop_formatado, c.descricao, c.grupo]);
    });

    var apl = 0;
    cfopLista.forEach(function (c) { if (c.aplicavel) apl++; });

    valText(document.getElementById("cf-m-tot"), fmtInt(cfopLista.length));
    valText(document.getElementById("cf-m-apl"), fmtInt(apl));
    valText(document.getElementById("cf-m-nao"), fmtInt(cfopLista.length - apl));
    valText(document.getElementById("cf-lbl"), filtrados.length + " códigos");

    preencherTbody(tbody, filtrados.map(function (c) {
      var checked = c.aplicavel ? "checked" : "";
      return '<tr>' +
        '<td class="mono">' + escHtml(c.cfop) + '</td>' +
        '<td class="mono">' + escHtml(c.cfop_formatado || "—") + '</td>' +
        '<td>' + escHtml(c.grupo || "—") + '</td>' +
        '<td>' + escHtml(c.descricao || "—") + '</td>' +
        '<td class="num"><input type="checkbox" class="cf-chk" data-id="' + c.id + '" ' + checked + ' /></td>' +
      '</tr>';
    }), 5);

    // Ligar toggles
    tbody.querySelectorAll(".cf-chk").forEach(function (chk) {
      chk.addEventListener("change", function () {
        var id = Number(chk.getAttribute("data-id"));
        var novo = chk.checked;
        chk.disabled = true;
        client.from("cfop").update({ aplicavel: novo }).eq("id", id).then(function (r) {
          chk.disabled = false;
          if (r.error) {
            chk.checked = !novo;
            alert("Erro ao atualizar CFOP: " + r.error.message);
            return;
          }
          // Atualiza cache local e métricas
          cfopLista.forEach(function (c) { if (c.id === id) c.aplicavel = novo; });
          var apl = 0;
          cfopLista.forEach(function (c) { if (c.aplicavel) apl++; });
          valText(document.getElementById("cf-m-apl"), fmtInt(apl));
          valText(document.getElementById("cf-m-nao"), fmtInt(cfopLista.length - apl));
        });
      });
    });
  }

  // =========================================================================
  // 18. PARÂMETROS (5)
  // =========================================================================

  function carregarParametros(user) {
    valText(document.getElementById("par-user"), (user && user.email) || "—");
    valText(document.getElementById("par-email"), (user && user.email) || "—");
    valText(document.getElementById("par-uid"),   (user && user.id) || "—");
    valText(document.getElementById("par-url"),   cfg.SUPABASE_URL);
    var host = window.location.hostname || "";
    var env = host.indexOf("vercel.app") !== -1 ? "Produção (Vercel)" :
              host === "localhost" || host === "127.0.0.1" ? "Local (dev)" :
              host ? host : "Arquivo local";
    valText(document.getElementById("par-env"), env);

    // Perfil (já foi carregado na topbar)
    var nomeTopbar = topbarNome.textContent || "";
    var mPerfil = nomeTopbar.split("·")[1];
    valText(document.getElementById("par-perfil"), (mPerfil || "—").trim());

    // Contagens
    valText(document.getElementById("par-cnt-orc"), orcamentosCarregados ? fmtInt(orcamentosLista.length) : "—");
    valText(document.getElementById("par-cnt-mov"), orcamentosCarregados ? fmtInt(movimentosCompletos.length) : "—");
    valText(document.getElementById("par-cnt-pc"), pcCarregado ? fmtInt(planoContas.length) : "—");
    valText(document.getElementById("par-cnt-cf"), cfopCarregado ? fmtInt(cfopLista.length) : "—");
  }

  // =========================================================================
  // 19. LIMPAR DADOS (5) — confirmação dupla
  // =========================================================================

  function limparTabela(tabela) {
    var labels = {
      movimentos:            "todos os movimentos",
      notas_fiscais:         "todas as notas fiscais",
      receitas_custos:       "todas as receitas e custos",
      entregas_vinc:         "todos os vínculos Entrega↔NF",
      classif_faturamento:   "todas as classificações manuais",
      orcamentos:            "TODOS os orçamentos (cascata em movimentos, receitas/custos etc.)"
    };

    var lim = document.getElementById("lim-status");
    function setSt(msg, tipo) {
      lim.hidden = false;
      lim.textContent = msg;
      lim.className = "status " + (tipo || "");
    }

    if (!confirm("Tem certeza que quer apagar " + labels[tabela] + "?\n\nEsta ação é IRREVERSÍVEL."))  return;
    var confirma = prompt('Digite exatamente a palavra APAGAR para confirmar.');
    if (confirma !== "APAGAR") { setSt("Operação cancelada.", "alerta"); return; }

    setSt("Apagando " + tabela + "…", "carregando");
    client.from(tabela).delete().gt("id", 0).then(function (r) {
      if (r.error) {
        setSt("Erro: " + r.error.message, "erro");
        return;
      }
      setSt("Tabela " + tabela + " limpa. Recarregue as páginas afetadas.", "ok");

      // Invalidar caches relevantes
      if (tabela === "movimentos" || tabela === "orcamentos") {
        orcamentosCarregados = false; movimentosCompletos = []; orcamentosLista = [];
      }
      if (tabela === "receitas_custos") { rcCarregado = false; rcLista = []; }
      if (tabela === "entregas_vinc") { entregasVincCarregado = false; entregasVincCache = []; }
    });
  }

  // =========================================================================
  // 20. TROCA DE SENHA (primeiro login OU pedida pelo usuário)
  // =========================================================================

  var trocaUser = null;
  var trocaObrigatoria = false;

  function entrarModoTrocaSenha(user, obrigatoria) {
    trocaUser = user;
    trocaObrigatoria = !!obrigatoria;

    document.getElementById("troca-titulo").textContent = obrigatoria ? "Defina sua nova senha" : "Trocar minha senha";
    document.getElementById("troca-desc").textContent = obrigatoria
      ? "Sua senha atual é temporária. Defina uma nova para continuar."
      : "Escolha uma nova senha. Você vai continuar logada após salvar.";
    document.getElementById("btn-troca-cancelar").hidden = obrigatoria;

    document.getElementById("troca-nova").value = "";
    document.getElementById("troca-confirma").value = "";
    document.getElementById("troca-erro").hidden = true;
    document.getElementById("troca-ok").hidden = true;
    // Recolocar tipo dos campos para "password" (caso o olho tenha aberto antes)
    document.getElementById("troca-nova").type = "password";
    document.getElementById("troca-confirma").type = "password";
    // Reseta o estado visual dos requisitos
    atualizarRequisitos();

    mostrarEstado("troca");
    setTimeout(function () { document.getElementById("troca-nova").focus(); }, 0);
  }

  // ---- Botões de olho (mostrar/ocultar senha) — delegação global ----
  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest(".btn-eye");
    if (!btn) return;
    var alvo = document.getElementById(btn.getAttribute("data-eye"));
    if (!alvo) return;
    var visivel = alvo.type === "text";
    alvo.type = visivel ? "password" : "text";
    var iShow = btn.querySelector(".eye-show");
    var iHide = btn.querySelector(".eye-hide");
    if (iShow && iHide) {
      iShow.hidden = !visivel;   // se estava visível, agora oculta → mostra olho aberto
      iHide.hidden = visivel;
    }
  });

  // ---- Validação ao vivo dos requisitos de senha ----
  function avaliarSenha(senha, conf) {
    return {
      len:     senha.length >= 8,
      upper:   /[A-Z]/.test(senha),
      lower:   /[a-z]/.test(senha),
      num:     /\d/.test(senha),
      special: /[^A-Za-z0-9]/.test(senha),
      match:   senha.length > 0 && senha === conf
    };
  }

  function atualizarRequisitos() {
    var nova = document.getElementById("troca-nova").value;
    var conf = document.getElementById("troca-confirma").value;
    var reqs = avaliarSenha(nova, conf);
    var ul = document.getElementById("troca-reqs");
    if (!ul) return;
    ul.querySelectorAll("li").forEach(function (li) {
      var k = li.getAttribute("data-req");
      li.classList.toggle("ok", !!reqs[k]);
    });
    var btn = document.getElementById("btn-troca");
    btn.disabled = !(reqs.len && reqs.upper && reqs.lower && reqs.num && reqs.special && reqs.match);
  }

  document.getElementById("troca-nova").addEventListener("input", atualizarRequisitos);
  document.getElementById("troca-confirma").addEventListener("input", atualizarRequisitos);

  document.getElementById("form-troca").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var nova = document.getElementById("troca-nova").value;
    var conf = document.getElementById("troca-confirma").value;
    var erro = document.getElementById("troca-erro");
    var ok   = document.getElementById("troca-ok");
    var btn  = document.getElementById("btn-troca");

    erro.hidden = true; ok.hidden = true;

    var r = avaliarSenha(nova, conf);
    if (!r.len || !r.upper || !r.lower || !r.num || !r.special) {
      erro.textContent = "A senha não atende a todos os requisitos.";
      erro.hidden = false;
      return;
    }
    if (!r.match) {
      erro.textContent = "As duas senhas não coincidem.";
      erro.hidden = false;
      return;
    }

    btn.disabled = true; btn.textContent = "Salvando…";

    client.auth.updateUser({ password: nova }).then(function (r1) {
      if (r1.error) {
        btn.disabled = false; btn.textContent = "Salvar nova senha";
        erro.textContent = "Erro ao atualizar senha: " + r1.error.message;
        erro.hidden = false;
        return;
      }
      // Marca senha_temporaria=false
      return client.from("perfis")
        .update({ senha_temporaria: false })
        .eq("id", trocaUser.id)
        .then(function () {
          ok.textContent = "Senha atualizada com sucesso.";
          ok.hidden = false;
          btn.textContent = "Entrando…";
          setTimeout(function () {
            btn.disabled = false; btn.textContent = "Salvar nova senha";
            entrarModoShell(trocaUser);
          }, 900);
        });
    });
  });

  document.getElementById("btn-troca-cancelar").addEventListener("click", function () {
    if (trocaObrigatoria) return;
    if (trocaUser) entrarModoShell(trocaUser);
  });

  // Link dentro de Configuração → abre a tela de troca como voluntária
  var btnAbrirTroca = document.getElementById("btn-abrir-troca");
  if (btnAbrirTroca) {
    btnAbrirTroca.addEventListener("click", function () {
      if (window._terraUser) entrarModoTrocaSenha(window._terraUser, false);
    });
  }

  // =========================================================================
  // 21. DIAGNÓSTICO — orçamentos com ruído Fixa+Solta (Entrega 5)
  // =========================================================================

  function renderDiagnostico() {
    esperarOrcamentosCarregados(function () {
      var porOrc = {};
      movimentosCompletos.forEach(function (m) {
        if (!m.orcamento || !m.tipo) return;
        if (!porOrc[m.orcamento]) porOrc[m.orcamento] = {};
        porOrc[m.orcamento][m.tipo] = (porOrc[m.orcamento][m.tipo] || 0) + Number(m.valor || 0);
      });

      var comRuido = [];
      var totalAnalisados = 0;
      Object.keys(porOrc).forEach(function (orc) {
        totalAnalisados++;
        var tipos = porOrc[orc];
        var ativos = Object.keys(tipos).filter(function (t) { return tipos[t] > 0.01; });
        if (ativos.length > 1) {
          var total = 0;
          ativos.forEach(function (t) { total += tipos[t]; });
          comRuido.push({
            orcamento: orc,
            cliente: clientePorOrcamento[orc] || "—",
            tipos: ativos.map(function (t) { return t + " (" + fmtBRL(tipos[t]) + ")"; }).join(", "),
            total: total
          });
        }
      });
      comRuido.sort(function (a, b) { return b.total - a.total; });

      valText(document.getElementById("diag-m-qtd"), fmtInt(comRuido.length));
      valText(document.getElementById("diag-m-tot"), fmtInt(totalAnalisados));

      var tbody = document.getElementById("diag-tbody");
      preencherTbody(tbody, comRuido.map(function (r) {
        return '<tr>' +
          '<td class="mono">' + escHtml(r.orcamento) + '</td>' +
          '<td>' + escHtml(r.cliente) + '</td>' +
          '<td>' + escHtml(r.tipos) + '</td>' +
          '<td class="num">' + fmtBRL(r.total) + '</td>' +
        '</tr>';
      }), 4, "Nenhum orçamento com ruído de Tipo. 👍");
    });
  }

  // =========================================================================
  // 22. IMPORTAR PLANILHAS (Entrega 4e)
  // =========================================================================

  // Templates esperados por tipo de planilha.
  // Chave = nome da coluna na planilha (case-insensitive, sem acento).
  // Valor = nome da coluna no Supabase.
  var impTemplates = {
    orcamentos: {
      nomeLegivel: "Orçamentos",
      alvo: "orcamentos",
      colunas: {
        "data":               "data",
        "orcamento":          "orcamento",
        "nome":               "nome",
        "cliente":            "nome",
        "parceiro":           "parceiro",
        "venda":              "venda",
        "adiantamento":       "adiantamento",
        "recebimento":        "recebimento",
        "resultado financeiro":"resultado_financeiro",
        "a receber":          "a_receber",
        "status recebimento": "status_recebimento",
        "nota fiscal":        "nota_fiscal",
        "venda sem nf":       "venda_sem_nf",
        "a faturar":          "a_faturar",
        "status faturamento": "status_faturamento"
      },
      obrigatorias: ["orcamento"],
      dicas: "Colunas esperadas: orcamento (obrigatória), data, nome/cliente, parceiro, venda, recebimento, nota_fiscal, a_receber, a_faturar, status_recebimento, status_faturamento."
    },
    movimentos: {
      nomeLegivel: "Movimentos",
      alvo: "movimentos",
      colunas: {
        "competencia": "competencia",
        "data":        "data",
        "orcamento":   "orcamento",
        "nome":        "nome",
        "cliente":     "nome",
        "tipo":        "tipo",
        "natureza":    "natureza",
        "valor":       "valor",
        "nota fiscal": "nota_fiscal",
        "os":          "os",
        "item":        "item",
        "custo":       "custo",
        "comentarios": "comentarios"
      },
      obrigatorias: ["orcamento", "natureza", "valor"],
      dicas: "Colunas esperadas: orcamento, natureza e valor (obrigatórias); data, tipo, nota_fiscal, os, item, custo, comentarios (opcionais)."
    },
    notas_fiscais: {
      nomeLegivel: "Notas Fiscais",
      alvo: "notas_fiscais",
      colunas: {
        "emissao":          "emissao",
        "numero nf":        "numero_nf",
        "razao social":     "razao_social",
        "numero orcamento": "numero_orcamento",
        "valor nf":         "valor_nf",
        "cfop":             "cfop",
        "mes ref":          "mes_ref"
      },
      obrigatorias: ["numero_nf"],
      dicas: "Colunas esperadas: numero_nf (obrigatória), emissao, razao_social, numero_orcamento, valor_nf, cfop, mes_ref."
    },
    receitas_custos: {
      nomeLegivel: "Receitas e Custos",
      alvo: "receitas_custos",
      colunas: {
        "ano":           "ano",
        "mes":           "mes",
        "categoria":     "categoria",
        "subcategoria":  "subcategoria",
        "valor":         "valor"
      },
      obrigatorias: ["ano", "mes", "categoria", "valor"],
      dicas: "Colunas esperadas: ano, mes, categoria (receita|custo), valor (obrigatórias); subcategoria (opcional)."
    }
  };

  var impArquivo  = document.getElementById("imp-arquivo");
  var impTipo     = document.getElementById("imp-tipo");
  var impBtnPrev  = document.getElementById("imp-btn-preview");
  var impBtnConf  = document.getElementById("imp-btn-confirmar");
  var impStatus   = document.getElementById("imp-status");
  var impPreview  = document.getElementById("imp-preview");
  var impColHint  = document.getElementById("imp-colunas-esperadas");
  var impThead    = document.getElementById("imp-thead");
  var impTbody    = document.getElementById("imp-tbody");
  var impTotal    = document.getElementById("imp-total");

  var impParsed = null;  // { linhas: [...], cabecalhos: [...] }

  function setImpStatus(msg, tipo) {
    if (!msg) { impStatus.hidden = true; return; }
    impStatus.textContent = msg;
    impStatus.className = "status " + (tipo || "");
    impStatus.hidden = false;
  }

  function atualizarEstadoImport() {
    var temTipo = !!impTipo.value;
    var temArq  = impArquivo.files && impArquivo.files.length > 0;
    impBtnPrev.disabled = !(temTipo && temArq);
    impBtnConf.disabled = !(temTipo && temArq && impParsed);
    if (temTipo && impTemplates[impTipo.value]) {
      impColHint.innerHTML = impTemplates[impTipo.value].dicas;
    } else {
      impColHint.innerHTML = "";
    }
  }

  if (impTipo) {
    impTipo.addEventListener("change", function () {
      impParsed = null;
      impPreview.hidden = true;
      setImpStatus(null);
      atualizarEstadoImport();
    });
  }
  if (impArquivo) {
    impArquivo.addEventListener("change", function () {
      impParsed = null;
      impPreview.hidden = true;
      setImpStatus(null);
      atualizarEstadoImport();
    });
  }
  if (impBtnPrev) {
    impBtnPrev.addEventListener("click", function () {
      previsualizarImport();
    });
  }
  if (impBtnConf) {
    impBtnConf.addEventListener("click", function () {
      confirmarImport();
    });
  }

  function normalizarCabecalho(nome) {
    return String(nome || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // remove acentos
      .replace(/[_\-.]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function previsualizarImport() {
    if (typeof window.XLSX === "undefined") {
      setImpStatus("Biblioteca XLSX ainda carregando. Aguarde alguns segundos e tente de novo.", "alerta");
      return;
    }
    var arq = impArquivo.files[0];
    if (!arq) return;
    var tpl = impTemplates[impTipo.value];
    if (!tpl) return;

    setImpStatus("Lendo arquivo…", "carregando");

    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var wb = window.XLSX.read(ev.target.result, { type: "array", cellDates: true });
        var sheet = wb.Sheets[wb.SheetNames[0]];
        var raw = window.XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });

        if (!raw.length) { setImpStatus("Planilha vazia.", "erro"); return; }

        // Mapear cabeçalhos → colunas do schema
        var cabAlvo = {};  // { cabecalho_original: coluna_schema }
        Object.keys(raw[0]).forEach(function (cab) {
          var norm = normalizarCabecalho(cab);
          if (tpl.colunas[norm]) cabAlvo[cab] = tpl.colunas[norm];
        });
        var alvoCols = Object.values(cabAlvo);
        var faltando = tpl.obrigatorias.filter(function (c) { return alvoCols.indexOf(c) === -1; });
        if (faltando.length) {
          setImpStatus("Faltando colunas obrigatórias: " + faltando.join(", "), "erro");
          impParsed = null;
          atualizarEstadoImport();
          return;
        }

        // Converter para objetos com nomes do schema
        var linhas = raw.map(function (row) {
          var out = {};
          Object.keys(cabAlvo).forEach(function (cab) {
            var col = cabAlvo[cab];
            var v = row[cab];
            if (v === "" || v === null || v === undefined) { out[col] = null; return; }
            // Campos numéricos
            if (["venda","adiantamento","recebimento","resultado_financeiro","a_receber","nota_fiscal","venda_sem_nf","a_faturar","valor","valor_nf","custo","ano","mes"].indexOf(col) !== -1 && col !== "nota_fiscal") {
              var n = Number(String(v).replace(/\./g,"").replace(",", "."));
              out[col] = isNaN(n) ? null : n;
              return;
            }
            // Datas — SheetJS cellDates:true já entrega Date
            if (["data","competencia","emissao"].indexOf(col) !== -1) {
              if (v instanceof Date) { out[col] = v.toISOString().slice(0,10); return; }
              out[col] = String(v).slice(0,10);
              return;
            }
            out[col] = String(v);
          });
          return out;
        });

        impParsed = { linhas: linhas, cabs: alvoCols };
        renderPreviewImport(linhas, alvoCols);

        setImpStatus("Pré-visualização gerada. " + linhas.length + " linha(s) prontas para importar.", "ok");
        atualizarEstadoImport();
      } catch (e) {
        setImpStatus("Erro lendo arquivo: " + e.message, "erro");
      }
    };
    reader.onerror = function () { setImpStatus("Falha ao ler arquivo.", "erro"); };
    reader.readAsArrayBuffer(arq);
  }

  function renderPreviewImport(linhas, cabs) {
    impThead.innerHTML = "<tr>" + cabs.map(function (c) { return "<th>" + escHtml(c) + "</th>"; }).join("") + "</tr>";
    var slice = linhas.slice(0, 10);
    impTbody.innerHTML = slice.map(function (row) {
      return "<tr>" + cabs.map(function (c) {
        var v = row[c];
        if (v === null || v === undefined) return '<td class="tbl-vazio">—</td>';
        return "<td>" + escHtml(v) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    impTotal.textContent = fmtInt(linhas.length);
    impPreview.hidden = false;
  }

  // =========================================================================
  // 23. MODAL GENÉRICO (reaproveitado pelo RH)
  // =========================================================================

  var modalOverlay  = document.getElementById("modal-overlay");
  var modalTitulo   = document.getElementById("modal-titulo");
  var modalFields   = document.getElementById("modal-fields");
  var modalForm     = document.getElementById("modal-form");
  var modalErro     = document.getElementById("modal-erro");
  var modalCancelar = document.getElementById("modal-cancelar");
  var modalSalvar   = document.getElementById("modal-salvar");

  var modalConfig = null;  // { titulo, fields:[{name,label,type,options?,required?}], onSubmit:fn(values, doneCallback) }

  function abrirModal(config) {
    modalConfig = config;
    modalTitulo.textContent = config.titulo;
    modalFields.innerHTML = config.fields.map(function (f) {
      var id = "mf-" + f.name;
      var req = f.required ? " required" : "";
      var valor = f.valor !== undefined && f.valor !== null ? String(f.valor) : "";
      if (f.type === "select") {
        var opts = (f.options || []).map(function (o) {
          var v = (typeof o === "object") ? o.value : o;
          var t = (typeof o === "object") ? o.label : o;
          var sel = String(v) === valor ? " selected" : "";
          return '<option value="' + escHtml(v) + '"' + sel + '>' + escHtml(t) + '</option>';
        }).join("");
        return '<div class="form-field"><label for="' + id + '">' + escHtml(f.label) + '</label><select id="' + id + '" name="' + f.name + '"' + req + '>' + opts + '</select></div>';
      }
      return '<div class="form-field"><label for="' + id + '">' + escHtml(f.label) + '</label><input id="' + id + '" name="' + f.name + '" type="' + (f.type || "text") + '" value="' + escHtml(valor) + '"' + req + ' /></div>';
    }).join("");
    modalErro.hidden = true;
    modalSalvar.disabled = false;
    modalSalvar.textContent = "Salvar";
    modalOverlay.hidden = false;
    setTimeout(function () {
      var first = modalFields.querySelector("input, select");
      if (first) first.focus();
    }, 0);
  }

  function fecharModal() {
    modalOverlay.hidden = true;
    modalConfig = null;
  }

  modalCancelar.addEventListener("click", fecharModal);
  modalOverlay.addEventListener("click", function (ev) {
    if (ev.target === modalOverlay) fecharModal();
  });

  modalForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!modalConfig) return;
    var values = {};
    modalConfig.fields.forEach(function (f) {
      var el = document.getElementById("mf-" + f.name);
      if (!el) return;
      var v = el.value;
      if (v === "") { values[f.name] = null; return; }
      if (f.type === "number") { var n = Number(v.replace(",", ".")); values[f.name] = isNaN(n) ? null : n; return; }
      values[f.name] = v;
    });
    modalErro.hidden = true;
    modalSalvar.disabled = true;
    modalSalvar.textContent = "Salvando…";
    modalConfig.onSubmit(values, function (err) {
      if (err) {
        modalErro.textContent = err;
        modalErro.hidden = false;
        modalSalvar.disabled = false;
        modalSalvar.textContent = "Salvar";
        return;
      }
      fecharModal();
    });
  });

  // =========================================================================
  // 24. DRE
  // =========================================================================

  var dreCarregado = false;

  function carregarDreSeNecessario() {
    if (rcCarregado) { dreCarregado = true; renderDre(); return; }
    if (rcCarregando) return;
    carregarConsolidadoSeNecessario();
    var iv = setInterval(function () {
      if (rcCarregado) { clearInterval(iv); dreCarregado = true; renderDre(); }
    }, 150);
  }

  function renderDre() {
    var ano = Number(document.getElementById("dre-ano").value);
    var nomeMes = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

    var porMes = {};
    for (var m = 1; m <= 12; m++) porMes[m] = { receita: 0, outras: 0, custo: 0 };

    rcLista.filter(function (r) { return Number(r.ano) === ano; }).forEach(function (r) {
      var m = Number(r.mes);
      if (!porMes[m]) return;
      if (r.categoria === "receita") {
        var sub = (r.subcategoria || "").toLowerCase();
        if (sub.indexOf("outras") !== -1) porMes[m].outras += Number(r.valor || 0);
        else porMes[m].receita += Number(r.valor || 0);
      } else if (r.categoria === "custo") {
        porMes[m].custo += Number(r.valor || 0);
      }
    });

    var totR = 0, totO = 0, totC = 0;
    for (var mm = 1; mm <= 12; mm++) { totR += porMes[mm].receita; totO += porMes[mm].outras; totC += porMes[mm].custo; }
    var resultado = (totR + totO) - totC;
    var margem = (totR + totO) > 0 ? (resultado / (totR + totO) * 100).toFixed(1).replace(".", ",") + "%" : "—";

    valText(document.getElementById("dre-m-receita"), fmtBRL(totR));
    valText(document.getElementById("dre-m-outras"),  fmtBRL(totO));
    valText(document.getElementById("dre-m-custo"),   fmtBRL(totC));
    valText(document.getElementById("dre-m-result"),  fmtBRL(resultado));
    valText(document.getElementById("dre-lbl"), "margem: " + margem);

    var linhas = [];
    for (var i = 1; i <= 12; i++) {
      var rr = porMes[i].receita, oo = porMes[i].outras, cc = porMes[i].custo;
      var tr = rr + oo;
      var res = tr - cc;
      var mrg = tr > 0 ? (res / tr * 100).toFixed(1).replace(".", ",") + "%" : "—";
      linhas.push(
        '<tr>' +
          '<td>' + nomeMes[i-1] + '/' + String(ano).slice(2) + '</td>' +
          '<td class="num">' + (rr ? fmtBRL(rr) : '—') + '</td>' +
          '<td class="num">' + (oo ? fmtBRL(oo) : '—') + '</td>' +
          '<td class="num">' + (cc ? fmtBRL(cc) : '—') + '</td>' +
          '<td class="num ' + (res > 0 ? 'destaque' : '') + '">' + (tr || cc ? fmtBRL(res) : '—') + '</td>' +
          '<td class="num">' + mrg + '</td>' +
        '</tr>'
      );
    }
    linhas.push(
      '<tr class="tot"><td><strong>Ano ' + ano + '</strong></td>' +
      '<td class="num"><strong>' + fmtBRL(totR) + '</strong></td>' +
      '<td class="num"><strong>' + fmtBRL(totO) + '</strong></td>' +
      '<td class="num"><strong>' + fmtBRL(totC) + '</strong></td>' +
      '<td class="num destaque"><strong>' + fmtBRL(resultado) + '</strong></td>' +
      '<td class="num"><strong>' + margem + '</strong></td></tr>'
    );
    document.getElementById("dre-tbody").innerHTML = linhas.join("");
  }

  // =========================================================================
  // 25. USUÁRIOS (perfis)
  // =========================================================================

  var usuariosLista = [];
  var usuariosCarregado = false;

  function carregarUsuariosSeNecessario() {
    usuariosCarregado = false;
    client.from("perfis").select("id, nome, perfil, senha_temporaria, criado_em, ultimo_acesso")
      .order("nome", { ascending: true })
      .then(function (r) {
        if (r.error) {
          document.getElementById("us-tbody").innerHTML = '<tr><td colspan="5" class="tbl-vazio erro">Erro: ' + r.error.message + '</td></tr>';
          return;
        }
        usuariosLista = r.data || [];
        usuariosCarregado = true;
        renderUsuarios();
      });
  }

  function renderUsuarios() {
    var tbody = document.getElementById("us-tbody");
    var busca = (document.getElementById("us-busca").value || "").trim().toLowerCase();
    var filtrados = usuariosLista.filter(function (u) {
      return matchBusca(busca, [u.id, u.nome]);
    });
    valText(document.getElementById("us-lbl"), filtrados.length + " de " + usuariosLista.length);

    preencherTbody(tbody, filtrados.map(function (u) {
      return '<tr>' +
        '<td class="mono" title="' + escHtml(u.id) + '">' + escHtml(String(u.id).slice(0,8)) + '…</td>' +
        '<td>' + escHtml(u.nome) + '</td>' +
        '<td>' + escHtml(u.perfil) + '</td>' +
        '<td>' + (u.senha_temporaria ? '<span class="badge-tipo outras">sim</span>' : '—') + '</td>' +
        '<td><button class="btn-limpar" data-us-edit="' + escHtml(u.id) + '">Editar</button></td>' +
      '</tr>';
    }), 5, "Nenhum usuário.");

    tbody.querySelectorAll("[data-us-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-us-edit");
        var u = usuariosLista.find(function (x) { return x.id === id; });
        if (u) abrirModalUsuario(u);
      });
    });
  }

  function abrirModalUsuario(u) {
    abrirModal({
      titulo: "Editar usuário",
      fields: [
        { name: "nome",            label: "Nome",                        type: "text",    valor: u.nome,    required: true },
        { name: "perfil",          label: "Perfil",                      type: "select",  valor: u.perfil,  options: ["admin","operador","consulta"], required: true },
        { name: "senha_temporaria",label: "Forçar troca no próximo login",type: "select", valor: u.senha_temporaria ? "true" : "false", options: [{value:"false",label:"Não"},{value:"true",label:"Sim"}] }
      ],
      onSubmit: function (v, done) {
        client.from("perfis").update({
          nome: v.nome,
          perfil: v.perfil,
          senha_temporaria: v.senha_temporaria === "true"
        }).eq("id", u.id).then(function (r) {
          if (r.error) { done(r.error.message); return; }
          usuariosLista = usuariosLista.map(function (x) { return x.id === u.id ? Object.assign({}, x, { nome: v.nome, perfil: v.perfil, senha_temporaria: v.senha_temporaria === "true" }) : x; });
          renderUsuarios();
          done(null);
        });
      }
    });
  }

  // =========================================================================
  // 26. RH — FUNCIONÁRIOS
  // =========================================================================

  var funcionariosLista = [];
  var funcionariosCarregado = false;

  function carregarFuncionariosSeNecessario() {
    client.from("funcionarios").select("*").order("nome", { ascending: true }).then(function (r) {
      if (r.error) {
        document.getElementById("fn-tbody").innerHTML = '<tr><td colspan="7" class="tbl-vazio erro">Erro: ' + r.error.message + '</td></tr>';
        return;
      }
      funcionariosLista = r.data || [];
      funcionariosCarregado = true;
      renderFuncionarios();
    });
  }

  function renderFuncionarios() {
    var tbody  = document.getElementById("fn-tbody");
    var busca  = (document.getElementById("fn-busca").value || "").trim().toLowerCase();
    var status = document.getElementById("fn-status").value;

    var filtrados = funcionariosLista.filter(function (f) {
      if (status === "ativos" && f.data_demissao) return false;
      if (status === "desligados" && !f.data_demissao) return false;
      return matchBusca(busca, [f.nome, f.cargo, f.cpf]);
    });

    var ativos = funcionariosLista.filter(function (f) { return !f.data_demissao; });
    var folha = 0;
    ativos.forEach(function (f) { folha += Number(f.salario_base || 0); });

    valText(document.getElementById("fn-m-ativos"), fmtInt(ativos.length));
    valText(document.getElementById("fn-m-tot"),    fmtInt(funcionariosLista.length));
    valText(document.getElementById("fn-m-folha"),  fmtBRL(folha));
    valText(document.getElementById("fn-lbl"), filtrados.length + " de " + funcionariosLista.length);

    preencherTbody(tbody, filtrados.map(function (f) {
      return '<tr>' +
        '<td>' + escHtml(f.nome) + '</td>' +
        '<td class="mono">' + escHtml(f.cpf || "—") + '</td>' +
        '<td>' + escHtml(f.cargo || "—") + '</td>' +
        '<td>' + fmtData(f.data_admissao) + '</td>' +
        '<td>' + (f.data_demissao ? fmtData(f.data_demissao) : '<span class="badge-tipo solta">ativo</span>') + '</td>' +
        '<td class="num">' + fmtBRL(f.salario_base) + '</td>' +
        '<td><button class="btn-limpar" data-fn-edit="' + f.id + '">Editar</button></td>' +
      '</tr>';
    }), 7);

    tbody.querySelectorAll("[data-fn-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.getAttribute("data-fn-edit"));
        var f = funcionariosLista.find(function (x) { return x.id === id; });
        if (f) abrirModalFuncionario(f);
      });
    });
  }

  function abrirModalFuncionario(f) {
    f = f || {};
    var editar = !!f.id;
    abrirModal({
      titulo: editar ? "Editar funcionário" : "Novo funcionário",
      fields: [
        { name: "nome",          label: "Nome completo",       type: "text",   valor: f.nome,          required: true },
        { name: "cpf",           label: "CPF",                 type: "text",   valor: f.cpf },
        { name: "cargo",         label: "Cargo",               type: "text",   valor: f.cargo },
        { name: "data_admissao", label: "Data de admissão",    type: "date",   valor: f.data_admissao },
        { name: "data_demissao", label: "Data de demissão",    type: "date",   valor: f.data_demissao },
        { name: "salario_base",  label: "Salário base (R$)",   type: "number", valor: f.salario_base },
        { name: "observacoes",   label: "Observações",         type: "text",   valor: f.observacoes }
      ],
      onSubmit: function (v, done) {
        var payload = {
          nome: v.nome, cpf: v.cpf, cargo: v.cargo,
          data_admissao: v.data_admissao, data_demissao: v.data_demissao,
          salario_base: v.salario_base || 0, observacoes: v.observacoes
        };
        var q = editar
          ? client.from("funcionarios").update(payload).eq("id", f.id)
          : client.from("funcionarios").insert(payload);
        q.then(function (r) {
          if (r.error) { done(r.error.message); return; }
          carregarFuncionariosSeNecessario();
          done(null);
        });
      }
    });
  }

  // =========================================================================
  // 27. RH — BENEFÍCIOS
  // =========================================================================

  var beneficiosLista = [];

  function carregarBeneficiosSeNecessario() {
    // Garante funcionários para preencher os selects
    if (!funcionariosCarregado) carregarFuncionariosSeNecessario();
    client.from("beneficios").select("*").order("id", { ascending: false }).then(function (r) {
      if (r.error) {
        document.getElementById("bn-tbody").innerHTML = '<tr><td colspan="7" class="tbl-vazio erro">Erro: ' + r.error.message + '</td></tr>';
        return;
      }
      beneficiosLista = r.data || [];
      renderBeneficios();
    });
  }

  function renderBeneficios() {
    var tbody = document.getElementById("bn-tbody");
    var busca = (document.getElementById("bn-busca").value || "").trim().toLowerCase();
    var tipo  = document.getElementById("bn-tipo").value;

    var nomePorId = {};
    funcionariosLista.forEach(function (f) { nomePorId[f.id] = f.nome; });

    var filtrados = beneficiosLista.filter(function (b) {
      if (tipo && b.tipo !== tipo) return false;
      return matchBusca(busca, [nomePorId[b.funcionario_id], b.tipo, b.descricao]);
    });

    var vigentes = beneficiosLista.filter(function (b) { return !b.data_fim; });
    var custo = 0;
    vigentes.forEach(function (b) { custo += Number(b.valor || 0); });

    valText(document.getElementById("bn-m-vig"),   fmtInt(vigentes.length));
    valText(document.getElementById("bn-m-custo"), fmtBRL(custo));
    valText(document.getElementById("bn-lbl"), filtrados.length + " de " + beneficiosLista.length);

    preencherTbody(tbody, filtrados.map(function (b) {
      return '<tr>' +
        '<td>' + escHtml(nomePorId[b.funcionario_id] || ("#" + b.funcionario_id)) + '</td>' +
        '<td>' + escHtml(b.tipo) + '</td>' +
        '<td>' + escHtml(b.descricao || "—") + '</td>' +
        '<td class="num">' + fmtBRL(b.valor) + '</td>' +
        '<td>' + fmtData(b.data_inicio) + '</td>' +
        '<td>' + (b.data_fim ? fmtData(b.data_fim) : '<span class="badge-tipo solta">vigente</span>') + '</td>' +
        '<td><button class="btn-limpar" data-bn-edit="' + b.id + '">Editar</button></td>' +
      '</tr>';
    }), 7, "Nenhum benefício cadastrado.");

    tbody.querySelectorAll("[data-bn-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.getAttribute("data-bn-edit"));
        var b = beneficiosLista.find(function (x) { return x.id === id; });
        if (b) abrirModalBeneficio(b);
      });
    });
  }

  function abrirModalBeneficio(b) {
    b = b || {};
    var editar = !!b.id;
    var opcoesFunc = funcionariosLista.map(function (f) { return { value: f.id, label: f.nome }; });
    abrirModal({
      titulo: editar ? "Editar benefício" : "Novo benefício",
      fields: [
        { name: "funcionario_id", label: "Funcionário", type: "select", valor: b.funcionario_id, options: opcoesFunc, required: true },
        { name: "tipo",           label: "Tipo",        type: "select", valor: b.tipo || "Vale-transporte", options: ["Vale-transporte","Vale-refeição","Plano de Saúde","Outro"], required: true },
        { name: "descricao",      label: "Descrição",   type: "text",   valor: b.descricao },
        { name: "valor",          label: "Valor (R$)",  type: "number", valor: b.valor, required: true },
        { name: "data_inicio",    label: "Início",      type: "date",   valor: b.data_inicio },
        { name: "data_fim",       label: "Fim (deixe vazio se vigente)", type: "date", valor: b.data_fim }
      ],
      onSubmit: function (v, done) {
        var payload = { funcionario_id: Number(v.funcionario_id), tipo: v.tipo, descricao: v.descricao, valor: Number(v.valor || 0), data_inicio: v.data_inicio, data_fim: v.data_fim };
        var q = editar
          ? client.from("beneficios").update(payload).eq("id", b.id)
          : client.from("beneficios").insert(payload);
        q.then(function (r) {
          if (r.error) { done(r.error.message); return; }
          carregarBeneficiosSeNecessario();
          done(null);
        });
      }
    });
  }

  // =========================================================================
  // 28. RH — FOLHA DE PAGAMENTO
  // =========================================================================

  var folhaLista = [];

  function carregarFolhaSeNecessario() {
    if (!funcionariosCarregado) carregarFuncionariosSeNecessario();
    client.from("folha_pagamento").select("*").order("mes_ref", { ascending: false }).then(function (r) {
      if (r.error) {
        document.getElementById("fl-tbody").innerHTML = '<tr><td colspan="8" class="tbl-vazio erro">Erro: ' + r.error.message + '</td></tr>';
        return;
      }
      folhaLista = r.data || [];
      renderFolha();
    });
  }

  function renderFolha() {
    var tbody = document.getElementById("fl-tbody");
    var busca = (document.getElementById("fl-busca").value || "").trim().toLowerCase();
    var mes   = document.getElementById("fl-mes").value;

    var nomePorId = {};
    funcionariosLista.forEach(function (f) { nomePorId[f.id] = f.nome; });

    var filtrados = folhaLista.filter(function (p) {
      if (mes && p.mes_ref !== mes) return false;
      return matchBusca(busca, [nomePorId[p.funcionario_id]]);
    });

    var totBruto = 0, totLiq = 0;
    filtrados.forEach(function (p) { totBruto += Number(p.salario_bruto || 0); totLiq += Number(p.liquido || 0); });

    valText(document.getElementById("fl-m-qtd"),   fmtInt(filtrados.length));
    valText(document.getElementById("fl-m-bruto"), fmtBRL(totBruto));
    valText(document.getElementById("fl-m-liq"),   fmtBRL(totLiq));
    valText(document.getElementById("fl-lbl"), filtrados.length + " de " + folhaLista.length);

    preencherTbody(tbody, filtrados.map(function (p) {
      return '<tr>' +
        '<td class="mono">' + escHtml(p.mes_ref) + '</td>' +
        '<td>' + escHtml(nomePorId[p.funcionario_id] || ("#" + p.funcionario_id)) + '</td>' +
        '<td class="num">' + fmtBRL(p.salario_bruto) + '</td>' +
        '<td class="num">' + fmtBRL(p.inss) + '</td>' +
        '<td class="num">' + fmtBRL(p.irrf) + '</td>' +
        '<td class="num">' + fmtBRL(p.fgts) + '</td>' +
        '<td class="num destaque">' + fmtBRL(p.liquido) + '</td>' +
        '<td><button class="btn-limpar" data-fl-edit="' + p.id + '">Editar</button></td>' +
      '</tr>';
    }), 8, "Nenhuma folha lançada.");

    tbody.querySelectorAll("[data-fl-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.getAttribute("data-fl-edit"));
        var p = folhaLista.find(function (x) { return x.id === id; });
        if (p) abrirModalFolha(p);
      });
    });
  }

  function abrirModalFolha(p) {
    p = p || {};
    var editar = !!p.id;
    var opcoesFunc = funcionariosLista.map(function (f) { return { value: f.id, label: f.nome }; });
    abrirModal({
      titulo: editar ? "Editar folha" : "Nova folha de pagamento",
      fields: [
        { name: "funcionario_id",   label: "Funcionário",        type: "select", valor: p.funcionario_id, options: opcoesFunc, required: true },
        { name: "mes_ref",          label: "Mês ref. (YYYY-MM)", type: "text",   valor: p.mes_ref, required: true },
        { name: "salario_bruto",    label: "Salário bruto (R$)", type: "number", valor: p.salario_bruto, required: true },
        { name: "inss",             label: "INSS (R$)",          type: "number", valor: p.inss },
        { name: "irrf",             label: "IRRF (R$)",          type: "number", valor: p.irrf },
        { name: "fgts",             label: "FGTS (R$)",          type: "number", valor: p.fgts },
        { name: "outros_descontos", label: "Outros descontos",   type: "number", valor: p.outros_descontos },
        { name: "outros_proventos", label: "Outros proventos",   type: "number", valor: p.outros_proventos },
        { name: "observacoes",      label: "Observações",        type: "text",   valor: p.observacoes }
      ],
      onSubmit: function (v, done) {
        var bruto = Number(v.salario_bruto || 0);
        var inss  = Number(v.inss || 0);
        var irrf  = Number(v.irrf || 0);
        var fgts  = Number(v.fgts || 0);
        var outD  = Number(v.outros_descontos || 0);
        var outP  = Number(v.outros_proventos || 0);
        var liq = bruto - inss - irrf - outD + outP;  // FGTS não é desconto do contracheque
        var payload = {
          funcionario_id: Number(v.funcionario_id),
          mes_ref: v.mes_ref,
          salario_bruto: bruto, inss: inss, irrf: irrf, fgts: fgts,
          outros_descontos: outD, outros_proventos: outP,
          liquido: liq,
          observacoes: v.observacoes
        };
        var q = editar
          ? client.from("folha_pagamento").update(payload).eq("id", p.id)
          : client.from("folha_pagamento").insert(payload);
        q.then(function (r) {
          if (r.error) { done(r.error.message); return; }
          carregarFolhaSeNecessario();
          done(null);
        });
      }
    });
  }

  // =========================================================================
  // 29. RH — IMPOSTOS
  // =========================================================================

  var impostosLista = [];

  function carregarImpostosSeNecessario() {
    client.from("impostos_rh").select("*").order("mes_ref", { ascending: false }).then(function (r) {
      if (r.error) {
        document.getElementById("ir-tbody").innerHTML = '<tr><td colspan="6" class="tbl-vazio erro">Erro: ' + r.error.message + '</td></tr>';
        return;
      }
      impostosLista = r.data || [];
      renderImpostos();
    });
  }

  function renderImpostos() {
    var tbody = document.getElementById("ir-tbody");
    var mes    = document.getElementById("ir-mes").value;
    var tipo   = document.getElementById("ir-tipo").value;
    var status = document.getElementById("ir-status").value;

    var filtrados = impostosLista.filter(function (i) {
      if (mes && i.mes_ref !== mes) return false;
      if (tipo && i.tipo !== tipo) return false;
      if (status === "pendente" && i.data_pagamento) return false;
      if (status === "pago" && !i.data_pagamento) return false;
      return true;
    });

    var tot = 0;
    filtrados.forEach(function (i) { tot += Number(i.valor || 0); });
    var pend = impostosLista.filter(function (i) { return !i.data_pagamento; }).length;

    valText(document.getElementById("ir-m-qtd"),   fmtInt(filtrados.length));
    valText(document.getElementById("ir-m-total"), fmtBRL(tot));
    valText(document.getElementById("ir-m-pend"),  fmtInt(pend));
    valText(document.getElementById("ir-lbl"), filtrados.length + " de " + impostosLista.length);

    preencherTbody(tbody, filtrados.map(function (i) {
      var st = i.data_pagamento
        ? '<span class="badge-tipo solta">pago</span>'
        : '<span class="badge-tipo outras">pendente</span>';
      return '<tr>' +
        '<td class="mono">' + escHtml(i.mes_ref) + '</td>' +
        '<td>' + escHtml(i.tipo) + '</td>' +
        '<td class="num">' + fmtBRL(i.valor) + '</td>' +
        '<td>' + (i.data_pagamento ? fmtData(i.data_pagamento) : '—') + '</td>' +
        '<td>' + st + '</td>' +
        '<td><button class="btn-limpar" data-ir-edit="' + i.id + '">Editar</button></td>' +
      '</tr>';
    }), 6, "Nenhum imposto lançado.");

    tbody.querySelectorAll("[data-ir-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.getAttribute("data-ir-edit"));
        var i = impostosLista.find(function (x) { return x.id === id; });
        if (i) abrirModalImposto(i);
      });
    });
  }

  function abrirModalImposto(i) {
    i = i || {};
    var editar = !!i.id;
    abrirModal({
      titulo: editar ? "Editar imposto" : "Novo imposto RH",
      fields: [
        { name: "mes_ref",        label: "Mês ref. (YYYY-MM)", type: "text",   valor: i.mes_ref, required: true },
        { name: "tipo",           label: "Tipo",               type: "select", valor: i.tipo || "INSS", options: ["INSS","FGTS","IRRF","Outro"], required: true },
        { name: "valor",          label: "Valor (R$)",         type: "number", valor: i.valor, required: true },
        { name: "data_pagamento", label: "Data de pagamento (deixe vazio se pendente)", type: "date", valor: i.data_pagamento },
        { name: "observacoes",    label: "Observações",        type: "text",   valor: i.observacoes }
      ],
      onSubmit: function (v, done) {
        var payload = { mes_ref: v.mes_ref, tipo: v.tipo, valor: Number(v.valor || 0), data_pagamento: v.data_pagamento, observacoes: v.observacoes };
        var q = editar
          ? client.from("impostos_rh").update(payload).eq("id", i.id)
          : client.from("impostos_rh").insert(payload);
        q.then(function (r) {
          if (r.error) { done(r.error.message); return; }
          carregarImpostosSeNecessario();
          done(null);
        });
      }
    });
  }

  // =========================================================================
  // 30. ORGANOGRAMA (RH > Organograma)
  // =========================================================================

  var orgLista = [];
  var orgPorPai = {};
  var orgCarregado = false;

  function carregarOrganogramaSeNecessario() {
    document.getElementById("org-tree").innerHTML = '<div class="tbl-vazio">Carregando organograma…</div>';
    client.from("organograma").select("id, parent_id, posicao, profissional, grupo, ordem")
      .order("ordem", { ascending: true })
      .then(function (r) {
        if (r.error) {
          document.getElementById("org-tree").innerHTML = '<div class="tbl-vazio erro">Erro: ' + r.error.message + '</div>';
          return;
        }
        orgLista = r.data || [];
        orgPorPai = {};
        orgLista.forEach(function (n) {
          var pid = n.parent_id;
          if (!orgPorPai[pid]) orgPorPai[pid] = [];
          orgPorPai[pid].push(n);
        });
        Object.keys(orgPorPai).forEach(function (k) {
          orgPorPai[k].sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
        });
        orgCarregado = true;
        renderOrganograma();
      });
  }

  function renderOrganograma() {
    var raiz = orgLista.find(function (n) { return n.parent_id === null; });
    var tree = document.getElementById("org-tree");
    if (!raiz) {
      tree.innerHTML = '<div class="tbl-vazio">Sem dados de organograma. Rode migracao_04_organograma.sql no Supabase.</div>';
      return;
    }
    tree.innerHTML = "";
    tree.appendChild(renderOrgNode(raiz));
    document.getElementById("org-lbl").textContent = orgLista.length + " posições";

    // Liga inputs editáveis
    tree.querySelectorAll(".org-prof").forEach(function (el) {
      el.addEventListener("click", function () { ativarEdicaoOrg(el); });
    });
    tree.querySelectorAll(".org-toggle").forEach(function (el) {
      el.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var node = el.closest(".org-node");
        var card = node.querySelector(".org-card");
        var children = node.querySelector(".org-children");
        var colap = !card.classList.contains("colapsado");
        card.classList.toggle("colapsado", colap);
        if (children) children.hidden = colap;
        el.textContent = colap ? "+" : "−";
      });
    });
  }

  function renderOrgNode(no) {
    var div = document.createElement("div");
    div.className = "org-node";

    var card = document.createElement("div");
    card.className = "org-card" + (no.grupo ? " g-" + no.grupo : "");
    card.dataset.id = no.id;

    var pos = document.createElement("div");
    pos.className = "org-pos";
    pos.textContent = no.posicao;
    card.appendChild(pos);

    var prof = document.createElement("div");
    prof.className = "org-prof" + (no.profissional ? "" : " placeholder");
    prof.textContent = no.profissional || "+ atribuir";
    prof.dataset.id = no.id;
    card.appendChild(prof);

    var filhos = orgPorPai[no.id] || [];
    if (filhos.length) {
      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "org-toggle";
      toggle.textContent = "−";
      toggle.title = "Recolher / expandir";
      card.appendChild(toggle);
    }

    div.appendChild(card);

    if (filhos.length) {
      var ch = document.createElement("div");
      ch.className = "org-children";
      filhos.forEach(function (f) { ch.appendChild(renderOrgNode(f)); });
      div.appendChild(ch);
    }

    return div;
  }

  function ativarEdicaoOrg(el) {
    if (el.classList.contains("editing")) return;
    var valorAntigo = el.classList.contains("placeholder") ? "" : el.textContent;
    el.classList.add("editing");
    el.classList.remove("placeholder");
    el.contentEditable = "true";
    el.textContent = valorAntigo;
    el.focus();
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    function fechar(salvar) {
      el.contentEditable = "false";
      el.classList.remove("editing");
      el.removeEventListener("blur", onBlur);
      el.removeEventListener("keydown", onKey);
      var novo = el.textContent.trim();
      if (salvar && novo !== valorAntigo) {
        var id = Number(el.dataset.id);
        el.classList.add("salvando");
        client.from("organograma").update({ profissional: novo || null }).eq("id", id).then(function (r) {
          el.classList.remove("salvando");
          if (r.error) {
            alert("Erro ao salvar: " + r.error.message);
            el.textContent = valorAntigo || "+ atribuir";
            if (!valorAntigo) el.classList.add("placeholder");
            return;
          }
          if (!novo) { el.textContent = "+ atribuir"; el.classList.add("placeholder"); }
          else { el.textContent = novo; el.classList.remove("placeholder"); }
          // Atualiza cache local
          var item = orgLista.find(function (n) { return n.id === id; });
          if (item) item.profissional = novo || null;
        });
      } else {
        if (!novo) { el.textContent = "+ atribuir"; el.classList.add("placeholder"); }
        else el.textContent = novo;
      }
    }

    function onBlur() { fechar(true); }
    function onKey(ev) {
      if (ev.key === "Enter") { ev.preventDefault(); fechar(true); }
      else if (ev.key === "Escape") { ev.preventDefault(); fechar(false); }
    }
    el.addEventListener("blur", onBlur);
    el.addEventListener("keydown", onKey);
  }

  function setColapsoOrganograma(colapsado) {
    document.querySelectorAll("#org-tree .org-card").forEach(function (card) {
      card.classList.toggle("colapsado", colapsado);
    });
    document.querySelectorAll("#org-tree .org-children").forEach(function (ch) {
      ch.hidden = colapsado;
    });
    document.querySelectorAll("#org-tree .org-toggle").forEach(function (t) {
      t.textContent = colapsado ? "+" : "−";
    });
    // A raiz sempre visível: garantir que filhos do nó topo apareçam mesmo quando recolhe?
    // Na verdade, deixar tudo recolhido faz sentido (só mostra a raiz).
  }

  function setStatusOrg(msg, tipo) {
    var s = document.getElementById("org-status");
    if (!msg) { s.hidden = true; return; }
    s.textContent = msg;
    s.className = "status " + (tipo || "");
    s.hidden = false;
  }

  function baixarOrganogramaPdf() {
    if (typeof window.html2canvas === "undefined" || typeof window.jspdf === "undefined") {
      setStatusOrg("Bibliotecas ainda carregando. Tente novamente em alguns segundos.", "alerta");
      return;
    }
    var papel  = document.getElementById("org-papel").value;
    var orient = document.getElementById("org-orient").value;

    var sizesMm = {
      'A4':      [210, 297],
      'A3':      [297, 420],
      'A2':      [420, 594],
      'A1':      [594, 841],
      'Letter':  [216, 279],
      'Tabloid': [279, 432]
    };
    var dim = sizesMm[papel];
    if (!dim) dim = sizesMm.A3;
    var pageW = dim[0], pageH = dim[1];
    if (orient === "landscape") { pageW = dim[1]; pageH = dim[0]; }

    setStatusOrg("Gerando PDF — pode levar alguns segundos…", "carregando");

    // Garante que tudo esteja expandido para a captura ficar completa
    setColapsoOrganograma(false);

    var tree = document.getElementById("org-tree");
    setTimeout(function () {
      window.html2canvas(tree, {
        backgroundColor: "#FDFAF6",
        scale: 2,
        useCORS: true,
        logging: false
      }).then(function (canvas) {
        var img = canvas.toDataURL("image/png");
        var jspdfNS = window.jspdf || window.jsPDF;
        var jsPDF = (jspdfNS && jspdfNS.jsPDF) || jspdfNS;
        var pdf = new jsPDF({ orientation: orient, unit: "mm", format: papel.toLowerCase() === "tabloid" ? [279, 432] : papel.toLowerCase() });

        var marginMm = 8;
        var availW = pageW - 2 * marginMm;
        var availH = pageH - 2 * marginMm;

        // Conversão px → mm: html2canvas em scale 2 dá uma imagem 2x. Largura px / scale ~ largura visual.
        // Ratio para caber na página, mantendo proporção
        var cw = canvas.width;
        var ch = canvas.height;
        var ratioW = availW / (cw * 0.264583 / 2);  // 1px ≈ 0.264583 mm @ 96dpi; canvas em scale 2 conta o dobro
        var ratioH = availH / (ch * 0.264583 / 2);
        var ratio = Math.min(ratioW, ratioH);
        var imgWmm = cw * 0.264583 / 2 * ratio;
        var imgHmm = ch * 0.264583 / 2 * ratio;
        var ox = (pageW - imgWmm) / 2;
        var oy = (pageH - imgHmm) / 2;

        pdf.addImage(img, "PNG", ox, oy, imgWmm, imgHmm, undefined, "FAST");
        var nome = "organograma-terra-" + papel + (orient === "landscape" ? "-paisagem" : "-retrato") + ".pdf";
        pdf.save(nome);
        setStatusOrg("PDF gerado: " + nome, "ok");
        setTimeout(function () { setStatusOrg(null); }, 5000);
      }).catch(function (e) {
        setStatusOrg("Falha ao gerar PDF: " + e.message, "erro");
      });
    }, 80);
  }

  function confirmarImport() {
    if (!impParsed) return;
    var tpl = impTemplates[impTipo.value];
    if (!tpl) return;

    var confirma = confirm("Confirmar importação de " + impParsed.linhas.length + " linha(s) para " + tpl.nomeLegivel + "?\n\nRegistros serão adicionados à tabela " + tpl.alvo + ".");
    if (!confirma) return;

    impBtnConf.disabled = true;
    impBtnPrev.disabled = true;
    setImpStatus("Inserindo registros em lotes de 200…", "carregando");

    var lotes = [];
    for (var i = 0; i < impParsed.linhas.length; i += 200) {
      lotes.push(impParsed.linhas.slice(i, i + 200));
    }

    var inseridos = 0;
    var erros = [];
    var processarProximo = function (idx) {
      if (idx >= lotes.length) {
        terminar();
        return;
      }
      client.from(tpl.alvo).insert(lotes[idx]).then(function (r) {
        if (r.error) {
          erros.push("Lote " + (idx + 1) + ": " + r.error.message);
        } else {
          inseridos += lotes[idx].length;
          setImpStatus("Inseridos " + inseridos + " / " + impParsed.linhas.length + "…", "carregando");
        }
        processarProximo(idx + 1);
      });
    };
    var terminar = function () {
      impBtnConf.disabled = false;
      impBtnPrev.disabled = false;
      if (erros.length) {
        setImpStatus("Importação terminou com avisos. Inseridos: " + inseridos + " · Erros em " + erros.length + " lote(s): " + erros.slice(0,3).join(" | "), "alerta");
      } else {
        setImpStatus("Importação concluída. " + inseridos + " registro(s) inseridos em " + tpl.alvo + ".", "ok");
        // Invalida caches afetados para o usuário ver os dados novos
        if (tpl.alvo === "orcamentos" || tpl.alvo === "movimentos") {
          orcamentosCarregados = false;
          movimentosCompletos = []; orcamentosLista = [];
        }
        if (tpl.alvo === "receitas_custos") { rcCarregado = false; rcLista = []; }
      }
      impParsed = null;
    };
    processarProximo(0);
  }

})();
