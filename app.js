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
        // Atualiza ultimo_acesso em paralelo (fire-and-forget)
        client.from("perfis").update({ ultimo_acesso: new Date().toISOString() }).eq("id", user.id).then(function () {});
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
    // (Supabase pode disparar SIGNED_IN mais de uma vez no carregamento;
    // antes, isso reiniciava a página para o Dashboard derrubando a navegação atual)
    var primeiraVez = !shellJaInicializado;
    if (primeiraVez) {
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

    if (primeiraVez) {
      carregarDashboard(user);
      // Só redireciona pra dashboard no primeiro carregamento
      showPage("dashboard");
    }
  }

  // ------------- Sidebar (colapso + macros expansíveis) --------------------

  var SIDEBAR_PREF_KEY = "terra.sidebar.colapsada";

  function aplicarPreferenciaSidebar() {
    var colapsada = false;
    try { colapsada = localStorage.getItem(SIDEBAR_PREF_KEY) === "1"; } catch (e) { /* tracking prevention bloqueou storage — segue sem preferência */ }
    sidebar.classList.toggle("colapsada", colapsada);
  }

  btnToggleSidebar.addEventListener("click", function () {
    var agora = !sidebar.classList.contains("colapsada");
    sidebar.classList.toggle("colapsada", agora);
    try { localStorage.setItem(SIDEBAR_PREF_KEY, agora ? "1" : "0"); } catch (e) { /* tracking prevention */ }
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

    // Atualiza a faixa 2 da topbar com o título da página atual
    var pagina = document.querySelector('#shell .main .page[data-page="' + pageId + '"]');
    var elTit = document.getElementById("topbar-page-title");
    var elSub = document.getElementById("topbar-page-sub");
    if (elTit && pagina) {
      var h = pagina.querySelector(".page-title");
      var p = pagina.querySelector(".page-sub");
      elTit.textContent = h ? h.textContent : "—";
      elSub.textContent = p ? p.textContent : "";
    }

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
    if (pageId === "programa_bonus")  carregarProgramaBonusSeNecessario();
    if (pageId === "programa_bonus_individual") carregarBonusIndividualSeNecessario();
    if (pageId === "rh_bonus_config") carregarConfigBonusSeNecessario();
    if (pageId === "cfg_auditoria")  carregarAuditoriaSeNecessario();
    if (pageId === "apr_dashboard")   carregarApropriacaoSeNecessario();
    if (pageId === "apr_excluidas")   carregarOsExcluidasSeNecessario();
    if (pageId === "cfg_centros")     carregarCentrosSeNecessario();
    if (pageId === "cfg_rubricas")    carregarRubricasSeNecessario();
    if (pageId === "caixa_saldo")        carregarCaixaSaldoSeNecessario();
    if (pageId === "caixa_compromissos") carregarCompromissosSeNecessario();
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
    });
  }

  // =========================================================================
  // 6. PÁGINA ORÇAMENTOS (Entrega 4a) — Gestão de Faturamento
  // =========================================================================

  var orcamentosCarregados = false;
  var orcamentosCarregando = false;
  var orcamentosLista = [];        // linhas da tabela orcamentos
  var tipoPorOrcamento = {};       // { "24-001": "Mobília Fixa", ... }
  var tipoManualPorOrcamento = {}; // sobrepõe a derivação automática quando preenchido

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
    ligarFiltros("cc-",  renderCentros);
    ligarFiltros("rb-",  renderRubricas);
    ligarFiltros("fn-",  renderFuncionarios);
    ligarFiltros("bn-",  renderBeneficios);
    ligarFiltros("fl-",  renderFolha);
    ligarFiltros("ir-",  renderImpostos);
    ligarFiltros("aud-", renderAuditoria);

    var btnExpCfop = document.getElementById("cf-btn-export");
    if (btnExpCfop) btnExpCfop.addEventListener("click", exportarCfopXlsx);

    // Botões "+ Novo" do RH
    var btnNovoFun = document.getElementById("fn-btn-novo");
    var btnNovoBen = document.getElementById("bn-btn-novo");
    var btnNovoFol = document.getElementById("fl-btn-novo");
    var btnNovoImp = document.getElementById("ir-btn-novo");
    var btnNovoCc = document.getElementById("cc-btn-novo");
    var btnNovoRb = document.getElementById("rb-btn-novo");
    if (btnNovoCc) btnNovoCc.addEventListener("click", abrirModalCentroCusto);
    if (btnNovoRb) btnNovoRb.addEventListener("click", abrirModalRubrica);
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

    // Tela cheia do organograma
    var orgFs = document.getElementById("org-btn-fs");
    var orgFechar = document.getElementById("org-fechar-fs");
    var orgScroll = document.getElementById("org-scroll");
    function abrirTelaCheia() {
      orgScroll.classList.add("tela-cheia");
      orgFechar.classList.add("ativo");
      document.body.style.overflow = "hidden";
    }
    function fecharTelaCheia() {
      orgScroll.classList.remove("tela-cheia");
      orgFechar.classList.remove("ativo");
      document.body.style.overflow = "";
    }
    // Apropriação — handlers de filtro
    var aprAno = document.getElementById("apr-ano");
    var aprStatus = document.getElementById("apr-status");
    if (aprAno) aprAno.addEventListener("change", renderApropriacao);
    if (aprStatus) aprStatus.addEventListener("change", renderApropriacao);

    if (orgFs) orgFs.addEventListener("click", abrirTelaCheia);
    if (orgFechar) orgFechar.addEventListener("click", fecharTelaCheia);
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && orgScroll && orgScroll.classList.contains("tela-cheia")) fecharTelaCheia();
    });

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
    var ids = ["busca", "mes", "ano", "tipo", "natureza", "status", "filtro", "grupo", "nivel", "livro", "cc", "org"];
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
      .select("data, orcamento, nome, parceiro, venda, recebimento, a_receber, nota_fiscal, a_faturar, status_recebimento, status_faturamento, tipo_manual")
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
      tipoManualPorOrcamento = {};
      orcamentosLista.forEach(function (r) {
        if (r.tipo_manual) tipoManualPorOrcamento[r.orcamento] = r.tipo_manual;
      });
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
      // Decisão manual sobrepõe derivação automática
      if (tipoManualPorOrcamento[orc]) { mapa[orc] = tipoManualPorOrcamento[orc]; return; }
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
      var resolvidos = [];
      var totalAnalisados = 0;
      Object.keys(porOrc).forEach(function (orc) {
        totalAnalisados++;
        var tipos = porOrc[orc];
        var ativos = Object.keys(tipos).filter(function (t) { return tipos[t] > 0.01; });
        if (ativos.length > 1) {
          var total = 0;
          ativos.forEach(function (t) { total += tipos[t]; });
          var registro = {
            orcamento: orc,
            cliente: clientePorOrcamento[orc] || "—",
            tipos: ativos.map(function (t) { return t + " (" + fmtBRL(tipos[t]) + ")"; }).join(", "),
            total: total,
            tipoManual: tipoManualPorOrcamento[orc] || null
          };
          if (registro.tipoManual) resolvidos.push(registro);
          else comRuido.push(registro);
        }
      });
      comRuido.sort(function (a, b) { return b.total - a.total; });
      resolvidos.sort(function (a, b) { return b.total - a.total; });

      valText(document.getElementById("diag-m-qtd"), fmtInt(comRuido.length));
      valText(document.getElementById("diag-m-tot"), fmtInt(totalAnalisados));

      var linhasPendentes = comRuido.map(function (r) {
        return '<tr>' +
          '<td class="mono">' + escHtml(r.orcamento) + '</td>' +
          '<td>' + escHtml(r.cliente) + '</td>' +
          '<td>' + escHtml(r.tipos) + '</td>' +
          '<td class="num">' + fmtBRL(r.total) + '</td>' +
          '<td><button type="button" class="btn-acao btn-resolver-ruido" data-orc="' + escHtml(r.orcamento) + '">Resolver</button></td>' +
        '</tr>';
      });

      var linhasResolvidos = resolvidos.map(function (r) {
        return '<tr class="linha-resolvido">' +
          '<td class="mono">' + escHtml(r.orcamento) + '</td>' +
          '<td>' + escHtml(r.cliente) + '</td>' +
          '<td><span class="badge-tipo">' + escHtml(r.tipoManual) + '</span> <span class="muted">(decisão manual)</span></td>' +
          '<td class="num">' + fmtBRL(r.total) + '</td>' +
          '<td><button type="button" class="btn-acao btn-resolver-ruido" data-orc="' + escHtml(r.orcamento) + '">Alterar</button></td>' +
        '</tr>';
      });

      var tbody = document.getElementById("diag-tbody");
      if (linhasPendentes.length === 0 && linhasResolvidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="tbl-vazio">Nenhum orçamento com ruído de Tipo. 👍</td></tr>';
      } else {
        var html = "";
        if (linhasPendentes.length) html += linhasPendentes.join("");
        if (linhasResolvidos.length) {
          html += '<tr class="separador-grupo"><td colspan="5">— Resolvidos manualmente (' + linhasResolvidos.length + ') —</td></tr>';
          html += linhasResolvidos.join("");
        }
        tbody.innerHTML = html;
      }

      // Liga listeners dos botões Resolver
      tbody.querySelectorAll(".btn-resolver-ruido").forEach(function (btn) {
        btn.addEventListener("click", function () {
          abrirModalResolverRuido(btn.getAttribute("data-orc"));
        });
      });
    });
  }

  function abrirModalResolverRuido(orcamento) {
    var registro = orcamentosLista.filter(function (r) { return r.orcamento === orcamento; })[0];
    var atual = registro && registro.tipo_manual ? registro.tipo_manual : "";
    var cliente = (registro && registro.nome) || clientePorOrcamento[orcamento] || "—";

    abrirModal({
      titulo: "Resolver ruído de Tipo — " + orcamento,
      fields: [
        {
          name: "tipo_manual",
          label: "Decisão para o orçamento (" + cliente + ")",
          type: "select",
          required: true,
          valor: atual,
          options: [
            { value: "",               label: "— derivar automaticamente pelos movimentos —" },
            { value: "Mobília Fixa",   label: "Mobília Fixa (tratar tudo como Fixa)" },
            { value: "Mobília Solta",  label: "Mobília Solta (tratar tudo como Solta)" },
            { value: "Misto",          label: "Misto (manter ambos como decisão consciente)" }
          ]
        }
      ],
      onSubmit: function (values, done) {
        var valor = values.tipo_manual || null; // null = limpar
        client.from("orcamentos").update({ tipo_manual: valor }).eq("orcamento", orcamento).then(function (r) {
          if (r.error) { done(r.error.message); return; }
          if (registro) registro.tipo_manual = valor;
          if (valor) tipoManualPorOrcamento[orcamento] = valor;
          else delete tipoManualPorOrcamento[orcamento];
          tipoPorOrcamento = derivarTipoPorOrcamento(movimentosCompletos);
          done(null);
          renderDiagnostico();
        });
      }
    });
  }

  // =========================================================================
  // 22. IMPORTAR PLANILHAS (Entrega 4e)
  // =========================================================================

  // Templates esperados por tipo de planilha.
  // Chave = nome da coluna na planilha (case-insensitive, sem acento).
  // Valor = nome da coluna no Supabase.
  // Parser auxiliar de meses ("YYYY-MM" a partir de Date / "01/2026" / "jan-26" / "Janeiro 2026")
  function parseMesRef(v) {
    if (v == null || v === "") return null;
    if (v instanceof Date) {
      return v.getFullYear() + "-" + String(v.getMonth() + 1).padStart(2, "0");
    }
    var s = String(v).trim();
    var m;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); // dd/mm/yyyy
    if (m) {
      var a = m[3].length === 2 ? "20" + m[3] : m[3];
      return a + "-" + String(m[2]).padStart(2, "0");
    }
    m = s.match(/^(\d{4})-(\d{1,2})$/); // yyyy-mm
    if (m) return m[1] + "-" + String(m[2]).padStart(2, "0");
    m = s.match(/^(\d{1,2})\/(\d{4})$/); // mm/yyyy
    if (m) return m[2] + "-" + String(m[1]).padStart(2, "0");
    var nomes = { jan:"01", fev:"02", mar:"03", abr:"04", mai:"05", jun:"06", jul:"07", ago:"08", set:"09", out:"10", nov:"11", dez:"12", janeiro:"01", fevereiro:"02", março:"03", marco:"03", abril:"04", maio:"05", junho:"06", julho:"07", agosto:"08", setembro:"09", outubro:"10", novembro:"11", dezembro:"12" };
    var sl = s.toLowerCase();
    for (var k in nomes) {
      if (sl.indexOf(k) !== -1) {
        var ya = s.match(/(\d{2,4})/);
        if (ya) { var an = ya[1].length === 2 ? "20" + ya[1] : ya[1]; return an + "-" + nomes[k]; }
      }
    }
    return null;
  }

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
    },
    evolucao_pct: {
      nomeLegivel: "Evolução % (Planilha de Produção)",
      alvo: "os_evolucao_mensal",
      especial: true,
      dicas: "Aba 'Evolução %' do PRODUÇÃO. Espera linha de cabeçalho com 'OS' na 1ª coluna e datas/meses nas demais. Valores são % (0 a 100). UPSERT por (os, mes_ref) preservando custo_saida existente."
    },
    saida_estoque: {
      nomeLegivel: "Saída de Estoque (CPV-Matéria Prima)",
      alvo: "os_evolucao_mensal",
      especial: true,
      dicas: "Filtra DRE='CPV - Matéria Prima', cruza por OS (split por '/'), Compet. → mes_ref, soma Custo Total. UPSERT por (os, mes_ref) preservando pct existente."
    },
    funcionarios_tc: {
      nomeLegivel: "Funcionários ativos (Planilha TC)",
      alvo: "funcionarios",
      especial: true,
      dicas: "Aba 'FUNCIONÁRIOS GERAL'. Importa só STATUS='ATIVO'. UPSERT por CPF (ou nome se sem CPF). Não atribui CC ainda — isso vem do import 'Despesas Folha Mensal'."
    },
    despesas_folha_mensal: {
      nomeLegivel: "Despesas Folha Mensal",
      alvo: "folha_pagamento + folha_pagamento_rubricas + atualiza centro_custo_id",
      especial: true,
      dicas: "Uma aba mensal (ex: 'Outubro'). Cruza nome → funcionário, atribui CC, cria linha em folha_pagamento (mes_ref derivado da data na linha 3) e povoa folha_pagamento_rubricas para cada coluna não-vazia."
    },
    caixa_saldo_mensal: {
      nomeLegivel: "Saldo de Caixa Mensal",
      alvo: "caixa_saldo_mensal",
      colunas: {
        "mes":          "mes_ref",
        "mes_ref":      "mes_ref",
        "mês":          "mes_ref",
        "mês ref":      "mes_ref",
        "saldo":        "saldo_final",
        "saldo final":  "saldo_final",
        "saldo_final":  "saldo_final",
        "observacao":   "observacoes",
        "observação":   "observacoes",
        "observacoes":  "observacoes",
        "observações":  "observacoes",
        "obs":          "observacoes"
      },
      obrigatorias: ["mes_ref","saldo_final"],
      onConflict: "mes_ref",
      dicas: "Colunas: mes_ref (YYYY-MM ou data), saldo_final (negativos OK), observacao (opcional). UPSERT pela coluna mes_ref."
    },
    compromissos_financeiros: {
      nomeLegivel: "Compromissos Financeiros",
      alvo: "compromissos_financeiros",
      colunas: {
        "vencimento":  "vencimento",
        "data":        "vencimento",
        "descricao":   "descricao",
        "descrição":   "descricao",
        "valor":       "valor",
        "tipo":        "tipo",
        "categoria":   "tipo",
        "pago em":     "pago_em",
        "pago_em":     "pago_em",
        "data pgto":   "pago_em",
        "observacao":  "observacao",
        "observação":  "observacao",
        "obs":         "observacao"
      },
      obrigatorias: ["vencimento","descricao","valor","tipo"],
      dicas: "Colunas: vencimento (data), descricao, valor, tipo (folha|fornecedor|imposto|aluguel|outro), pago_em (opcional — só preencher quando pago)."
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
      .normalize("NFD").replace(/[̀-ͯ]/g, "")  // remove acentos
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

    if (impTipo.value === "evolucao_pct")          return previsualizarEvolucaoPct(arq);
    if (impTipo.value === "saida_estoque")         return previsualizarSaidaEstoque(arq);
    if (impTipo.value === "funcionarios_tc")       return previsualizarFuncionariosTc(arq);
    if (impTipo.value === "despesas_folha_mensal") return previsualizarDespesasFolha(arq);

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
            if (["venda","adiantamento","recebimento","resultado_financeiro","a_receber","nota_fiscal","venda_sem_nf","a_faturar","valor","valor_nf","custo","ano","mes","saldo_final"].indexOf(col) !== -1 && col !== "nota_fiscal") {
              var n = Number(String(v).replace(/\./g,"").replace(",", "."));
              out[col] = isNaN(n) ? null : n;
              return;
            }
            // Datas — SheetJS cellDates:true já entrega Date
            if (["data","competencia","emissao","vencimento","pago_em"].indexOf(col) !== -1) {
              if (v instanceof Date) { out[col] = v.toISOString().slice(0,10); return; }
              out[col] = String(v).slice(0,10);
              return;
            }
            // mes_ref — aceita "YYYY-MM", "MM/YYYY", Date, etc — sempre vira "YYYY-MM-01"
            if (col === "mes_ref") {
              var mr = parseMesRef(v);
              out[col] = mr ? (mr + "-01") : null;
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

    function renderField(f) {
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
      if (f.type === "textarea") {
        return '<div class="form-field form-field-wide"><label for="' + id + '">' + escHtml(f.label) + '</label><textarea id="' + id + '" name="' + f.name + '" rows="3"' + req + '>' + escHtml(valor) + '</textarea></div>';
      }
      return '<div class="form-field"><label for="' + id + '">' + escHtml(f.label) + '</label><input id="' + id + '" name="' + f.name + '" type="' + (f.type || "text") + '" value="' + escHtml(valor) + '"' + req + ' /></div>';
    }

    // Suporte a seções: agrupar por f.group; campos sem group ficam num grupo "" inicial.
    var groupsOrder = [];
    var groupsMap = {};
    config.fields.forEach(function (f) {
      var g = f.group || "";
      if (!(g in groupsMap)) { groupsMap[g] = []; groupsOrder.push(g); }
      groupsMap[g].push(f);
    });
    if (groupsOrder.length === 1 && groupsOrder[0] === "") {
      // Modal simples (sem seções) — preserva comportamento antigo.
      modalFields.innerHTML = config.fields.map(renderField).join("");
    } else {
      modalFields.innerHTML = groupsOrder.map(function (g) {
        var inner = groupsMap[g].map(renderField).join("");
        if (!g) return '<div class="form-section-anon">' + inner + '</div>';
        return '<fieldset class="form-section"><legend>' + escHtml(g) + '</legend>' + inner + '</fieldset>';
      }).join("");
    }

    modalErro.hidden = true;
    modalSalvar.disabled = false;
    modalSalvar.textContent = "Salvar";
    modalOverlay.hidden = false;
    setTimeout(function () {
      var first = modalFields.querySelector("input, select, textarea");
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
  var organogramaLista = [];
  var organogramaCarregado = false;
  var organogramaPathCache = {};

  // Constrói "Família › Diretoria › Núcleo › Área › Atividade" para um id
  function buildOrgPath(id) {
    if (id == null) return "";
    if (organogramaPathCache[id]) return organogramaPathCache[id];
    var byId = {};
    organogramaLista.forEach(function (n) { byId[n.id] = n; });
    var parts = [];
    var cur = byId[id];
    var safety = 0;
    while (cur && safety++ < 20) {
      parts.unshift(cur.posicao || ("#" + cur.id));
      cur = cur.parent_id != null ? byId[cur.parent_id] : null;
    }
    var path = parts.join(" › ");
    organogramaPathCache[id] = path;
    return path;
  }

  function carregarOrganogramaParaSelectSeNecessario(cb) {
    if (organogramaCarregado) { if (cb) cb(); return; }
    client.from("organograma").select("id, parent_id, posicao, grupo, ordem").order("id").then(function (r) {
      organogramaLista = (r && r.data) || [];
      organogramaCarregado = true;
      organogramaPathCache = {};
      if (cb) cb();
    });
  }

  function carregarFuncionariosSeNecessario() {
    // Centros de custo + organograma carregam em paralelo (selects do modal e filtros).
    if (!centrosCustoLista || !centrosCustoLista.length) {
      client.from("centros_custo").select("id, codigo, descricao").order("codigo").then(function (rc) {
        centrosCustoLista = (rc && rc.data) || [];
        popularSelectsFuncionarios();
      });
    }
    carregarOrganogramaParaSelectSeNecessario(popularSelectsFuncionarios);
    client.from("funcionarios").select("*").order("nome", { ascending: true }).then(function (r) {
      if (r.error) {
        document.getElementById("fn-tbody").innerHTML = '<tr><td colspan="9" class="tbl-vazio erro">Erro: ' + r.error.message + '</td></tr>';
        return;
      }
      funcionariosLista = r.data || [];
      funcionariosCarregado = true;
      popularSelectsFuncionarios();
      renderFuncionarios();
    });
  }

  function popularSelectsFuncionarios() {
    var selLivro = document.getElementById("fn-livro");
    var selCc    = document.getElementById("fn-cc");
    var selOrg   = document.getElementById("fn-org");

    if (selLivro && funcionariosLista.length) {
      var livros = {};
      funcionariosLista.forEach(function (f) { if (f.livro) livros[f.livro] = true; });
      var atual = selLivro.value;
      var ks = Object.keys(livros).sort();
      selLivro.innerHTML = '<option value="">Todos os livros</option>' +
        ks.map(function (k) { return '<option value="' + escHtml(k) + '">Livro ' + escHtml(k) + '</option>'; }).join("");
      if (atual && ks.indexOf(atual) !== -1) selLivro.value = atual;
    }

    if (selCc && centrosCustoLista && centrosCustoLista.length) {
      var atualCc = selCc.value;
      selCc.innerHTML = '<option value="">Todos os centros</option>' +
        centrosCustoLista.map(function (c) { return '<option value="' + c.id + '">' + escHtml(c.codigo + " — " + c.descricao) + '</option>'; }).join("");
      if (atualCc) selCc.value = atualCc;
    }

    if (selOrg && organogramaLista.length) {
      var atualOrg = selOrg.value;
      // Ordena por path (deixa hierarquia legível)
      var lst = organogramaLista.slice().sort(function (a, b) { return buildOrgPath(a.id).localeCompare(buildOrgPath(b.id)); });
      selOrg.innerHTML = '<option value="">Todas as posições</option>' +
        lst.map(function (n) { return '<option value="' + n.id + '">' + escHtml(buildOrgPath(n.id)) + '</option>'; }).join("");
      if (atualOrg) selOrg.value = atualOrg;
    }
  }

  function renderFuncionarios() {
    var tbody  = document.getElementById("fn-tbody");
    var busca  = (document.getElementById("fn-busca").value || "").trim().toLowerCase();
    var status = document.getElementById("fn-status").value;
    var livro  = document.getElementById("fn-livro").value;
    var ccSel  = document.getElementById("fn-cc").value;
    var orgSel = document.getElementById("fn-org").value;

    var ccById = {};
    (centrosCustoLista || []).forEach(function (c) { ccById[c.id] = c.codigo + " — " + c.descricao; });

    var filtrados = funcionariosLista.filter(function (f) {
      if (status === "ativos" && f.data_demissao) return false;
      if (status === "desligados" && !f.data_demissao) return false;
      if (livro && (f.livro || "") !== livro) return false;
      if (ccSel && String(f.centro_custo_id || "") !== String(ccSel)) return false;
      if (orgSel && String(f.organograma_id || "") !== String(orgSel)) return false;
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
      var ccTxt = f.centro_custo_id ? (ccById[f.centro_custo_id] || ("#" + f.centro_custo_id)) : "—";
      var orgTxt = f.organograma_id ? buildOrgPath(f.organograma_id) : "—";
      return '<tr>' +
        '<td>' + escHtml(f.nome) + '</td>' +
        '<td class="mono">' + escHtml(f.cpf || "—") + '</td>' +
        '<td>' + escHtml(f.cargo || "—") + '</td>' +
        '<td>' + escHtml(ccTxt) + '</td>' +
        '<td title="' + escHtml(orgTxt) + '">' + escHtml(orgTxt) + '</td>' +
        '<td>' + fmtData(f.data_admissao) + '</td>' +
        '<td>' + (f.data_demissao ? fmtData(f.data_demissao) : '<span class="badge-tipo solta">ativo</span>') + '</td>' +
        '<td class="num">' + fmtBRL(f.salario_base) + '</td>' +
        '<td><button class="btn-limpar" data-fn-edit="' + f.id + '">Editar</button></td>' +
      '</tr>';
    }), 9);

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
    var opcoesCc = [{ value: "", label: "—" }].concat(
      (centrosCustoLista || []).map(function (c) { return { value: c.id, label: c.codigo + " — " + c.descricao }; })
    );
    var opcoesOrg = [{ value: "", label: "—" }].concat(
      (organogramaLista || []).slice().sort(function (a, b) {
        return buildOrgPath(a.id).localeCompare(buildOrgPath(b.id));
      }).map(function (n) { return { value: n.id, label: buildOrgPath(n.id) }; })
    );

    abrirModal({
      titulo: editar ? "Editar funcionário" : "Novo funcionário",
      fields: [
        // ===== Pessoais
        { group: "Dados pessoais", name: "nome",            label: "Nome completo",       type: "text", valor: f.nome, required: true },
        { group: "Dados pessoais", name: "cpf",             label: "CPF",                 type: "text", valor: f.cpf },
        { group: "Dados pessoais", name: "rg",              label: "RG",                  type: "text", valor: f.rg },
        { group: "Dados pessoais", name: "data_nascimento", label: "Data de nascimento",  type: "date", valor: f.data_nascimento },
        { group: "Dados pessoais", name: "filhos",          label: "Filhos",              type: "text", valor: f.filhos },

        // ===== Contato e endereço
        { group: "Contato e endereço", name: "telefone",        label: "Telefone",         type: "text", valor: f.telefone },
        { group: "Contato e endereço", name: "telefone_recado", label: "Telefone recado",  type: "text", valor: f.telefone_recado },
        { group: "Contato e endereço", name: "email",           label: "E-mail",           type: "text", valor: f.email },
        { group: "Contato e endereço", name: "endereco",        label: "Endereço",         type: "text", valor: f.endereco },
        { group: "Contato e endereço", name: "complemento",     label: "Complemento",      type: "text", valor: f.complemento },
        { group: "Contato e endereço", name: "bairro",          label: "Bairro",           type: "text", valor: f.bairro },
        { group: "Contato e endereço", name: "cidade",          label: "Cidade",           type: "text", valor: f.cidade },
        { group: "Contato e endereço", name: "cep",             label: "CEP",              type: "text", valor: f.cep },

        // ===== Trabalho
        { group: "Trabalho",       name: "status",               label: "Status",                                type: "select", valor: f.status || "ATIVO", options: ["ATIVO","INATIVO","AFASTADO"], required: true },
        { group: "Trabalho",       name: "cargo",                label: "Função / Cargo",                        type: "text",   valor: f.cargo },
        { group: "Trabalho",       name: "cbo",                  label: "CBO",                                   type: "text",   valor: f.cbo },
        { group: "Trabalho",       name: "salario_base",         label: "Salário base (R$)",                     type: "number", valor: f.salario_base },
        { group: "Trabalho",       name: "centro_custo_id",      label: "Centro de Custo",                       type: "select", valor: f.centro_custo_id || "", options: opcoesCc },
        { group: "Trabalho",       name: "organograma_id",       label: "Posição no Organograma",                type: "select", valor: f.organograma_id || "",  options: opcoesOrg },
        { group: "Trabalho",       name: "data_admissao",        label: "Data de admissão",                      type: "date",   valor: f.data_admissao },
        { group: "Trabalho",       name: "data_demissao",        label: "Data de demissão (vazio se ativo)",     type: "date",   valor: f.data_demissao },
        { group: "Trabalho",       name: "primeira_experiencia", label: "1ª Experiência",                        type: "date",   valor: f.primeira_experiencia },
        { group: "Trabalho",       name: "segunda_experiencia",  label: "2ª Experiência",                        type: "date",   valor: f.segunda_experiencia },
        { group: "Trabalho",       name: "data_aso",             label: "Data ASO",                              type: "date",   valor: f.data_aso },
        { group: "Trabalho",       name: "vencimento_aso",       label: "Vencimento ASO",                        type: "date",   valor: f.vencimento_aso },
        { group: "Trabalho",       name: "integracao",           label: "Integração",                            type: "text",   valor: f.integracao },

        // ===== Documentos
        { group: "Documentos",     name: "ctps",                 label: "CTPS",                                  type: "text",   valor: f.ctps },
        { group: "Documentos",     name: "serie",                label: "Série",                                 type: "text",   valor: f.serie },
        { group: "Documentos",     name: "pis",                  label: "PIS",                                   type: "text",   valor: f.pis },
        { group: "Documentos",     name: "cnh",                  label: "CNH",                                   type: "text",   valor: f.cnh },
        { group: "Documentos",     name: "cnh_categoria",        label: "Categoria CNH",                         type: "text",   valor: f.cnh_categoria },
        { group: "Documentos",     name: "titulo_eleitor",       label: "Título de Eleitor",                     type: "text",   valor: f.titulo_eleitor },
        { group: "Documentos",     name: "e_social",             label: "E-Social",                              type: "text",   valor: f.e_social },
        { group: "Documentos",     name: "livro",                label: "Livro",                                 type: "text",   valor: f.livro },

        // ===== Bancário e observações
        { group: "Bancário e observações", name: "banco",       label: "Banco",        type: "text", valor: f.banco },
        { group: "Bancário e observações", name: "agencia",     label: "Agência",      type: "text", valor: f.agencia },
        { group: "Bancário e observações", name: "conta",       label: "Conta",        type: "text", valor: f.conta },
        { group: "Bancário e observações", name: "pix",         label: "Chave PIX",    type: "text", valor: f.pix },
        { group: "Bancário e observações", name: "observacoes", label: "Observações",  type: "textarea", valor: f.observacoes }
      ],
      onSubmit: function (v, done) {
        var payload = {
          nome: v.nome,
          centro_custo_id: v.centro_custo_id ? Number(v.centro_custo_id) : null,
          organograma_id:  v.organograma_id  ? Number(v.organograma_id)  : null,
          status: v.status, cargo: v.cargo, cbo: v.cbo,
          salario_base: v.salario_base || 0,
          data_admissao: v.data_admissao, data_demissao: v.data_demissao,
          primeira_experiencia: v.primeira_experiencia, segunda_experiencia: v.segunda_experiencia,
          data_aso: v.data_aso, vencimento_aso: v.vencimento_aso,
          data_nascimento: v.data_nascimento,
          cpf: v.cpf, rg: v.rg, pis: v.pis, ctps: v.ctps, serie: v.serie,
          cnh: v.cnh, cnh_categoria: v.cnh_categoria, titulo_eleitor: v.titulo_eleitor,
          e_social: v.e_social, livro: v.livro,
          telefone: v.telefone, telefone_recado: v.telefone_recado, email: v.email,
          endereco: v.endereco, complemento: v.complemento, bairro: v.bairro, cidade: v.cidade, cep: v.cep,
          filhos: v.filhos, integracao: v.integracao,
          banco: v.banco, agencia: v.agencia, conta: v.conta, pix: v.pix,
          observacoes: v.observacoes
        };
        var q = editar
          ? client.from("funcionarios").update(payload).eq("id", f.id)
          : client.from("funcionarios").insert(payload);
        q.then(function (r) {
          if (r.error) { done(r.error.message); return; }
          funcionariosCarregado = false;
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

    // Liga inputs editáveis (delegado: salva ao perder foco se mudou)
    tree.querySelectorAll(".org-prof-input").forEach(function (input) {
      input.addEventListener("blur", function () { salvarProfissional(input); });
      input.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") { ev.preventDefault(); input.blur(); }
        else if (ev.key === "Escape") { input.value = input.dataset.original || ""; input.blur(); }
      });
      input.addEventListener("click", function (ev) { ev.stopPropagation(); });
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

    var prof = document.createElement("input");
    prof.type = "text";
    prof.className = "org-prof-input";
    prof.placeholder = "+ atribuir";
    prof.value = no.profissional || "";
    prof.dataset.id = String(no.id);
    prof.dataset.original = no.profissional || "";
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
      // Se TODOS os filhos forem folhas (sem netos), render em coluna vertical
      // (compacta, evita explodir a largura como acontecia antes).
      // Caso contrário, segue a régua horizontal padrão de organograma.
      var todosFolhas = filhos.every(function (f) {
        var netos = orgPorPai[f.id] || [];
        return netos.length === 0;
      });
      var ch = document.createElement("div");
      ch.className = "org-children" + (todosFolhas ? " vertical" : "");
      filhos.forEach(function (f) { ch.appendChild(renderOrgNode(f)); });
      div.appendChild(ch);
    }

    return div;
  }

  function salvarProfissional(input) {
    var novo = (input.value || "").trim();
    var antigo = input.dataset.original || "";
    if (novo === antigo) return;  // nada a fazer
    var id = Number(input.dataset.id);
    input.disabled = true;
    client.from("organograma").update({ profissional: novo || null }).eq("id", id).then(function (r) {
      input.disabled = false;
      if (r.error) {
        alert("Erro ao salvar: " + r.error.message);
        input.value = antigo;
        return;
      }
      input.dataset.original = novo;
      var item = orgLista.find(function (n) { return n.id === id; });
      if (item) item.profissional = novo || null;
    });
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

  // =========================================================================
  // 31. APROPRIAÇÃO DE RECEITA (incorporado do dashboard antigo)
  // =========================================================================

  var osLista = [];
  var osEvolLista = [];
  var osExcluidas = [];
  var aprCarregado = false;

  var MESES_ANO = function (ano) {
    var arr = [];
    for (var m = 1; m <= 12; m++) {
      arr.push(ano + "-" + (m < 10 ? "0" + m : "" + m));
    }
    return arr;
  };
  var NOMES_MES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

  function carregarApropriacaoSeNecessario() {
    Promise.all([
      client.from("ordens_servico").select("*"),
      client.from("os_evolucao_mensal").select("*"),
      client.from("os_excluidas").select("os")
    ]).then(function (rs) {
      var rOs = rs[0], rEv = rs[1], rEx = rs[2];
      if (rOs.error) {
        document.getElementById("apr-grid-meses").innerHTML = '<div class="tbl-vazio erro">Erro: ' + rOs.error.message + '</div>';
        return;
      }
      osLista = rOs.data || [];
      osEvolLista = (rEv && rEv.data) || [];
      var exclSet = {};
      ((rEx && rEx.data) || []).forEach(function (x) { exclSet[x.os] = true; });
      osLista = osLista.filter(function (o) { return !exclSet[o.os]; });
      aprCarregado = true;
      renderApropriacao();
    });
  }

  // Mapa { os → { mes_ref → { pct, custo_saida, mat_usado_arq, ancora_custo } } }
  function indexarEvolucao() {
    var idx = {};
    osEvolLista.forEach(function (e) {
      if (!idx[e.os]) idx[e.os] = {};
      idx[e.os][e.mes_ref] = e;
    });
    return idx;
  }

  // Replica a regra calcOS do dashboard antigo, ano a ano:
  //   Receita do mês = min(residual, vl × pct/100), com pct vindo de os_evolucao_mensal
  //   Custo do mês  = custo_saida (Saída de Estoque) preferencial; fallback mat_usado_arq incremental
  //   Residual atualiza-se mês a mês.
  function calcOsAno(o, idxEvol, ano) {
    var hist = idxEvol[o.os] || {};
    var residual = Number(o.valor_contrato || 0);
    var matAnt = 0;
    var meses = MESES_ANO(ano);
    var resultado = [];
    meses.forEach(function (mes) {
      var h = hist[mes] || {};
      var pct = (h.pct != null) ? Number(h.pct) : null;
      var rec = 0;
      if (pct != null) {
        rec = Math.min(residual, (Number(o.valor_contrato || 0) * pct) / 100);
        residual = Math.max(0, residual - rec);
      }
      var cus = 0;
      if (h.custo_saida != null) {
        cus = Number(h.custo_saida);
      } else if (h.mat_usado_arq != null && !h.ancora_custo) {
        cus = Math.max(0, Number(h.mat_usado_arq) - matAnt);
        matAnt = Number(h.mat_usado_arq);
      }
      resultado.push({ mes: mes, pct: pct, rec: rec, cus: cus });
    });
    return { residual: residual, meses: resultado };
  }

  function renderApropriacao() {
    var ano = Number(document.getElementById("apr-ano").value);
    var status = document.getElementById("apr-status").value;
    var idxEvol = indexarEvolucao();

    var alvo = osLista.filter(function (o) {
      if (status && o.status !== status) return false;
      return true;
    });

    // Acumular por mês
    var porMes = {};
    MESES_ANO(ano).forEach(function (mes) { porMes[mes] = { rec: 0, cus: 0 }; });

    var totRec = 0, totCus = 0, totResidualSomado = 0;
    var carteira = {}; // por orçamento

    alvo.forEach(function (o) {
      var calc = calcOsAno(o, idxEvol, ano);
      var oRec = 0, oCus = 0;
      calc.meses.forEach(function (m) {
        porMes[m.mes].rec += m.rec;
        porMes[m.mes].cus += m.cus;
        oRec += m.rec;
        oCus += m.cus;
      });
      totRec += oRec;
      totCus += oCus;
      totResidualSomado += calc.residual;

      var orc = o.orcamento || "(sem orçamento)";
      if (!carteira[orc]) carteira[orc] = { orcamento: orc, cliente: o.cliente, oss: 0, contrato: 0, apropriado: 0, residual: 0, custo: 0 };
      carteira[orc].oss++;
      carteira[orc].contrato += Number(o.valor_contrato || 0);
      carteira[orc].apropriado += oRec;
      carteira[orc].residual += calc.residual;
      carteira[orc].custo += oCus;
    });

    // Métricas topo
    valText(document.getElementById("apr-m-rec"), fmtBRL(totRec));
    valText(document.getElementById("apr-m-cus"), fmtBRL(totCus));
    valText(document.getElementById("apr-m-mrg"), totRec > 0 ? ((totRec - totCus) / totRec * 100).toFixed(1).replace(".", ",") + "%" : "—");
    valText(document.getElementById("apr-m-res"), fmtBRL(totResidualSomado));
    valText(document.getElementById("apr-lbl"), alvo.length + " OS no filtro · " + osLista.length + " no total");

    // Grid de meses
    var grid = document.getElementById("apr-grid-meses");
    grid.innerHTML = MESES_ANO(ano).map(function (mes, idx) {
      var p = porMes[mes];
      var temDado = p.rec > 0.01 || p.cus > 0.01;
      var mrg = p.rec > 0 ? ((p.rec - p.cus) / p.rec * 100) : null;
      var mrgClasse = mrg !== null && mrg < 0 ? "neg" : "";
      return (
        '<div class="apr-mes' + (temDado ? "" : " vazio") + '">' +
          '<div class="apr-mes-titulo">' + NOMES_MES[idx] + "/" + String(ano).slice(2) + '</div>' +
          '<div class="apr-mes-rec">' + (temDado ? fmtBRL(p.rec) : "—") + '</div>' +
          '<div class="apr-mes-cus">custo ' + (p.cus ? fmtBRL(p.cus) : "—") + '</div>' +
          '<div class="apr-mes-mrg ' + mrgClasse + '">' + (mrg !== null ? mrg.toFixed(1).replace(".", ",") + "% margem" : "—") + '</div>' +
        '</div>'
      );
    }).join("");

    // Carteira
    var carteiraArr = Object.values(carteira).sort(function (a, b) { return b.contrato - a.contrato; });
    var tbody = document.getElementById("apr-carteira-tbody");
    preencherTbody(tbody, carteiraArr.map(function (c) {
      var mrg = c.apropriado > 0 ? ((c.apropriado - c.custo) / c.apropriado * 100).toFixed(1).replace(".", ",") + "%" : "—";
      return '<tr>' +
        '<td class="mono">' + escHtml(c.orcamento) + '</td>' +
        '<td>' + escHtml(c.cliente || "—") + '</td>' +
        '<td class="num">' + fmtInt(c.oss) + '</td>' +
        '<td class="num">' + fmtBRL(c.contrato) + '</td>' +
        '<td class="num destaque">' + fmtBRL(c.apropriado) + '</td>' +
        '<td class="num">' + fmtBRL(c.residual) + '</td>' +
        '<td class="num">' + fmtBRL(c.custo) + '</td>' +
        '<td class="num">' + mrg + '</td>' +
      '</tr>';
    }), 8, "Sem orçamentos no filtro.");
  }

  function carregarOsExcluidasSeNecessario() {
    var tbody = document.getElementById("apr-excl-tbody");
    client.from("os_excluidas").select("*").order("excluida_em", { ascending: false })
      .then(function (r) {
        if (r.error) {
          tbody.innerHTML = '<tr><td colspan="5" class="tbl-vazio erro">Erro: ' + r.error.message + '</td></tr>';
          return;
        }
        var lista = r.data || [];
        preencherTbody(tbody, lista.map(function (e) {
          return '<tr>' +
            '<td class="mono">' + escHtml(e.os) + '</td>' +
            '<td>' + escHtml(e.justificativa) + '</td>' +
            '<td>' + fmtData(e.excluida_em) + '</td>' +
            '<td class="mono">' + escHtml(String(e.excluida_por || "—").slice(0,8)) + '…</td>' +
            '<td><button class="btn-limpar" data-restaurar-os="' + escHtml(e.os) + '">Restaurar</button></td>' +
          '</tr>';
        }), 5, "Nenhuma OS excluída.");

        tbody.querySelectorAll("[data-restaurar-os]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var os = btn.getAttribute("data-restaurar-os");
            if (!confirm("Restaurar OS " + os + " para a análise?")) return;
            client.from("os_excluidas").delete().eq("os", os).then(function () {
              carregarOsExcluidasSeNecessario();
              aprCarregado = false;
            });
          });
        });
      });
  }

  // ----- Parser específico: Evolução % -----
  function previsualizarEvolucaoPct(arq) {
    setImpStatus("Lendo planilha de Evolução %…", "carregando");
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var wb = window.XLSX.read(ev.target.result, { type: "array", cellDates: true });
        var sheet = wb.Sheets["Evolução %"] || wb.Sheets["Evolucao %"] || wb.Sheets[wb.SheetNames[0]];
        var matriz = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
        // Encontrar a linha de cabeçalho que tem "OS" como primeira célula
        var iCab = -1;
        for (var i = 0; i < matriz.length; i++) {
          var c0 = String((matriz[i] && matriz[i][0]) || "").trim().toLowerCase();
          if (c0 === "os" || c0 === "n.os" || c0 === "nº os" || c0 === "no os") { iCab = i; break; }
        }
        if (iCab === -1) { setImpStatus("Não encontrei a linha de cabeçalho com 'OS' na coluna A.", "erro"); return; }
        var cab = matriz[iCab];
        var colsMes = [];
        for (var j = 1; j < cab.length; j++) {
          var mes = parseMesRef(cab[j]);
          if (mes) colsMes.push({ idx: j, mes: mes });
        }
        if (!colsMes.length) { setImpStatus("Não identifiquei colunas de mês válidas no cabeçalho.", "erro"); return; }
        var linhas = [];
        for (var i2 = iCab + 1; i2 < matriz.length; i2++) {
          var row = matriz[i2] || [];
          var os = String(row[0] || "").trim().split("/")[0].trim();
          if (!os || isNaN(Number(os))) continue;
          colsMes.forEach(function (col) {
            var v = row[col.idx];
            if (v == null || v === "") return;
            var pct = Number(String(v).replace(/[^0-9,.\-]/g, "").replace(",", "."));
            if (isNaN(pct) || pct === 0) return;
            linhas.push({ os: os, mes_ref: col.mes, pct: pct });
          });
        }
        impParsed = { linhas: linhas, cabs: ["os","mes_ref","pct"], tipo: "evolucao_pct" };
        renderPreviewImport(linhas, ["os","mes_ref","pct"]);
        setImpStatus(linhas.length + " atualização(ões) de % evolução prontas. " + colsMes.length + " coluna(s) de mês detectada(s).", "ok");
        atualizarEstadoImport();
      } catch (e) {
        setImpStatus("Erro lendo arquivo: " + e.message, "erro");
      }
    };
    reader.readAsArrayBuffer(arq);
  }

  // ----- Parser específico: Saída de Estoque (CPV-Matéria Prima) -----
  function previsualizarSaidaEstoque(arq) {
    setImpStatus("Lendo Saída de Estoque…", "carregando");
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var wb = window.XLSX.read(ev.target.result, { type: "array", cellDates: true });
        var sheet = wb.Sheets[wb.SheetNames[0]];
        var raw = window.XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
        if (!raw.length) { setImpStatus("Planilha vazia.", "erro"); return; }
        var headers = Object.keys(raw[0]);
        function findCol(nomes) {
          for (var i = 0; i < headers.length; i++) {
            var n = normalizarCabecalho(headers[i]);
            if (nomes.indexOf(n) !== -1) return headers[i];
          }
          return null;
        }
        var colDRE = findCol(["dre"]);
        var colOS  = findCol(["os"]);
        var colCmp = findCol(["compet","competencia","competência"]);
        var colCt  = findCol(["custo total","total custo","custo"]);
        var faltam = [];
        if (!colDRE) faltam.push("DRE");
        if (!colOS)  faltam.push("OS");
        if (!colCmp) faltam.push("Compet.");
        if (!colCt)  faltam.push("Custo Total");
        if (faltam.length) { setImpStatus("Faltando colunas: " + faltam.join(", "), "erro"); return; }
        var agg = {}, ignorados = 0;
        raw.forEach(function (r) {
          var dre = String(r[colDRE] || "").trim().toLowerCase();
          var ehMP = dre === "cpv - matéria prima" || dre === "cpv - materia prima" || dre === "cpv-matéria prima" || dre === "cpv-materia prima";
          if (!ehMP) { ignorados++; return; }
          var os = String(r[colOS] || "").trim().split("/")[0].trim();
          if (!os) { ignorados++; return; }
          var mes = parseMesRef(r[colCmp]);
          if (!mes) { ignorados++; return; }
          var v = Number(String(r[colCt] || "").replace(/\./g,"").replace(",", "."));
          if (isNaN(v)) v = 0;
          var k = os + "|" + mes;
          agg[k] = (agg[k] || 0) + v;
        });
        var linhas = Object.keys(agg).map(function (k) {
          var p = k.split("|");
          return { os: p[0], mes_ref: p[1], custo_saida: Math.round(agg[k] * 100) / 100 };
        });
        impParsed = { linhas: linhas, cabs: ["os","mes_ref","custo_saida"], tipo: "saida_estoque" };
        renderPreviewImport(linhas, ["os","mes_ref","custo_saida"]);
        setImpStatus(linhas.length + " agregação(ões) de CPV-Matéria Prima prontas. " + ignorados + " linha(s) ignorada(s) (DRE diferente, sem OS, etc).", "ok");
        atualizarEstadoImport();
      } catch (e) {
        setImpStatus("Erro lendo arquivo: " + e.message, "erro");
      }
    };
    reader.readAsArrayBuffer(arq);
  }

  function confirmarImport() {
    if (!impParsed) return;
    var tpl = impTemplates[impTipo.value];
    if (!tpl) return;

    // Tipos especiais usam UPSERT em os_evolucao_mensal
    if (impParsed.tipo === "evolucao_pct" || impParsed.tipo === "saida_estoque") {
      return confirmarUpsertEvolucao(impParsed.tipo, impParsed.linhas);
    }
    if (impParsed.tipo === "funcionarios_tc") {
      return confirmarUpsertFuncionarios(impParsed.linhas);
    }
    if (impParsed.tipo === "despesas_folha_mensal") {
      return confirmarFolhaMensal(impParsed);
    }

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
      var query = tpl.onConflict
        ? client.from(tpl.alvo).upsert(lotes[idx], { onConflict: tpl.onConflict })
        : client.from(tpl.alvo).insert(lotes[idx]);
      query.then(function (r) {
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
        if (tpl.alvo === "caixa_saldo_mensal")     { caixaSaldoCarregado = false; }
        if (tpl.alvo === "compromissos_financeiros"){ compromissosCarregado = false; }
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

  // =========================================================================
  // 32. CENTROS DE CUSTO (Configuração)
  // =========================================================================

  var centrosCustoLista = [];
  function carregarCentrosSeNecessario() {
    document.getElementById("cc-tbody").innerHTML = '<tr><td colspan="5" class="tbl-vazio">Carregando…</td></tr>';
    Promise.all([
      client.from("centros_custo").select("*").order("codigo"),
      client.from("funcionarios").select("centro_custo_id")
    ]).then(function (rs) {
      var rCc = rs[0], rFn = rs[1];
      if (rCc.error) { document.getElementById("cc-tbody").innerHTML = '<tr><td colspan="5" class="tbl-vazio erro">Erro: ' + rCc.error.message + '</td></tr>'; return; }
      centrosCustoLista = rCc.data || [];
      var contagens = {};
      ((rFn && rFn.data) || []).forEach(function (f) { if (f.centro_custo_id) contagens[f.centro_custo_id] = (contagens[f.centro_custo_id] || 0) + 1; });
      window._ccContagens = contagens;
      renderCentros();
    });
  }

  function renderCentros() {
    var tbody = document.getElementById("cc-tbody");
    var busca = (document.getElementById("cc-busca").value || "").trim().toLowerCase();
    var filtrados = centrosCustoLista.filter(function (c) { return matchBusca(busca, [c.codigo, c.descricao]); });
    valText(document.getElementById("cc-lbl"), filtrados.length + " de " + centrosCustoLista.length);
    var contagens = window._ccContagens || {};
    preencherTbody(tbody, filtrados.map(function (c) {
      return '<tr>' +
        '<td class="mono">' + escHtml(c.codigo) + '</td>' +
        '<td>' + escHtml(c.descricao) + '</td>' +
        '<td>' + (c.ativo ? '<span class="badge-tipo solta">sim</span>' : '<span class="badge-tipo outras">não</span>') + '</td>' +
        '<td class="num">' + fmtInt(contagens[c.id] || 0) + '</td>' +
        '<td><button class="btn-limpar" data-cc-edit="' + c.id + '">Editar</button></td>' +
      '</tr>';
    }), 5);
    tbody.querySelectorAll("[data-cc-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.getAttribute("data-cc-edit"));
        var c = centrosCustoLista.find(function (x) { return x.id === id; });
        if (c) abrirModalCentroCusto(c);
      });
    });
  }

  function abrirModalCentroCusto(c) {
    c = c || {};
    var editar = !!c.id;
    abrirModal({
      titulo: editar ? "Editar Centro de Custo" : "Novo Centro de Custo",
      fields: [
        { name: "codigo",    label: "Código (ex: 05.0007)", type: "text", valor: c.codigo, required: true },
        { name: "descricao", label: "Descrição",            type: "text", valor: c.descricao, required: true },
        { name: "ativo",     label: "Ativo?",               type: "select", valor: c.ativo === false ? "false" : "true", options: [{value:"true",label:"Sim"},{value:"false",label:"Não"}] }
      ],
      onSubmit: function (v, done) {
        var payload = { codigo: v.codigo, descricao: v.descricao, ativo: v.ativo === "true" };
        var q = editar
          ? client.from("centros_custo").update(payload).eq("id", c.id)
          : client.from("centros_custo").insert(payload);
        q.then(function (r) { if (r.error) { done(r.error.message); return; } carregarCentrosSeNecessario(); done(null); });
      }
    });
  }

  // =========================================================================
  // 33. RUBRICAS (Configuração)
  // =========================================================================

  var rubricasLista = [];
  function carregarRubricasSeNecessario() {
    document.getElementById("rb-tbody").innerHTML = '<tr><td colspan="6" class="tbl-vazio">Carregando…</td></tr>';
    client.from("rubricas").select("*").order("ordem").then(function (r) {
      if (r.error) { document.getElementById("rb-tbody").innerHTML = '<tr><td colspan="6" class="tbl-vazio erro">Erro: ' + r.error.message + '</td></tr>'; return; }
      rubricasLista = r.data || [];
      renderRubricas();
    });
  }

  function renderRubricas() {
    var tbody = document.getElementById("rb-tbody");
    var busca = (document.getElementById("rb-busca").value || "").trim().toLowerCase();
    var tipo  = document.getElementById("rb-tipo").value;
    var filtrados = rubricasLista.filter(function (r) {
      if (tipo && r.tipo !== tipo) return false;
      return matchBusca(busca, [r.nome, r.conta_contabil]);
    });
    valText(document.getElementById("rb-lbl"), filtrados.length + " de " + rubricasLista.length);
    preencherTbody(tbody, filtrados.map(function (r) {
      return '<tr>' +
        '<td class="num">' + fmtInt(r.ordem) + '</td>' +
        '<td>' + escHtml(r.nome) + '</td>' +
        '<td><span class="badge-tipo ' + (r.tipo === 'desconto' || r.tipo === 'tributo' ? 'outras' : 'solta') + '">' + escHtml(r.tipo) + '</span></td>' +
        '<td class="mono">' + escHtml(r.conta_contabil || "—") + '</td>' +
        '<td>' + (r.ativa ? '<span class="badge-tipo solta">sim</span>' : '<span class="badge-tipo outras">não</span>') + '</td>' +
        '<td><button class="btn-limpar" data-rb-edit="' + r.id + '">Editar</button></td>' +
      '</tr>';
    }), 6);
    tbody.querySelectorAll("[data-rb-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.getAttribute("data-rb-edit"));
        var r = rubricasLista.find(function (x) { return x.id === id; });
        if (r) abrirModalRubrica(r);
      });
    });
  }

  function abrirModalRubrica(r) {
    r = r || {};
    var editar = !!r.id;
    abrirModal({
      titulo: editar ? "Editar rubrica" : "Nova rubrica",
      fields: [
        { name: "nome",           label: "Nome",                type: "text",   valor: r.nome, required: true },
        { name: "tipo",           label: "Tipo",                type: "select", valor: r.tipo || "provento", options: ["provento","desconto","tributo","beneficio","evento"], required: true },
        { name: "conta_contabil", label: "Conta contábil",      type: "text",   valor: r.conta_contabil },
        { name: "ordem",          label: "Ordem (1=mais alta)", type: "number", valor: r.ordem || 0 },
        { name: "ativa",          label: "Ativa?",              type: "select", valor: r.ativa === false ? "false" : "true", options: [{value:"true",label:"Sim"},{value:"false",label:"Não"}] }
      ],
      onSubmit: function (v, done) {
        var payload = { nome: v.nome, tipo: v.tipo, conta_contabil: v.conta_contabil, ordem: Number(v.ordem || 0), ativa: v.ativa === "true" };
        var q = editar
          ? client.from("rubricas").update(payload).eq("id", r.id)
          : client.from("rubricas").insert(payload);
        q.then(function (rr) { if (rr.error) { done(rr.error.message); return; } carregarRubricasSeNecessario(); done(null); });
      }
    });
  }

  // ----- Parser específico: Funcionários da Planilha TC -----
  function previsualizarFuncionariosTc(arq) {
    setImpStatus("Lendo Planilha Funcionários TC…", "carregando");
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var wb = window.XLSX.read(ev.target.result, { type: "array", cellDates: true });
        var sheet = wb.Sheets["FUNCIONÁRIOS GERAL"] || wb.Sheets["FUNCIONARIOS GERAL"] || wb.Sheets[wb.SheetNames[0]];
        var raw = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
        // Cabeçalho está na linha 2 (índice 1)
        var cab = raw[1] || [];
        // Mapa de coluna por nome do header normalizado
        var idx = {};
        cab.forEach(function (h, i) { if (h) idx[normalizarCabecalho(h)] = i; });
        function pegar(row, nomes) {
          for (var n = 0; n < nomes.length; n++) {
            var i = idx[nomes[n]];
            if (i !== undefined && row[i] != null && row[i] !== "") return row[i];
          }
          return null;
        }
        function dataIso(v) {
          if (!v || v === "-") return null;
          if (v instanceof Date) {
            try { return v.toISOString().slice(0,10); } catch (e) { return null; }
          }
          var s = String(v).trim();
          var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
          if (m) {
            var aa = m[1], mm = parseInt(m[2],10), dd = parseInt(m[3],10);
            if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
            return aa + "-" + String(mm).padStart(2,"0") + "-" + String(dd).padStart(2,"0");
          }
          m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
          if (m) {
            var ano = m[3].length === 2 ? "20" + m[3] : m[3];
            var d1 = parseInt(m[1], 10), d2 = parseInt(m[2], 10);
            // Heurística: por padrão DD/MM. Se mês > 12 e dia <= 12, troca (formato MM/DD).
            var dia = d1, mes = d2;
            if (mes > 12 && dia <= 12) { var tmp = mes; mes = dia; dia = tmp; }
            if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
            return ano + "-" + String(mes).padStart(2,"0") + "-" + String(dia).padStart(2,"0");
          }
          return null;
        }
        var linhas = [];
        for (var i = 2; i < raw.length; i++) {
          var row = raw[i] || [];
          var rawStatus = String(pegar(row, ["status"]) || "").trim().toUpperCase();
          // Importa todos (ativos, inativos, afastados) — histórico completo.
          var status = rawStatus.indexOf("INAT") === 0 ? "INATIVO"
                     : rawStatus.indexOf("AFAST") === 0 ? "AFASTADO"
                     : rawStatus.indexOf("ATIV") === 0 ? "ATIVO"
                     : "INATIVO";
          var nome = pegar(row, ["nome"]);
          if (!nome) continue;
          linhas.push({
            nome: String(nome).trim(),
            status: status,
            cpf: pegar(row, ["cpf"]),
            rg: pegar(row, ["rg"]),
            pis: pegar(row, ["pis"]),
            ctps: pegar(row, ["ctps"]),
            cargo: pegar(row, ["funcao", "função"]),
            cbo: pegar(row, ["cbo"]),
            salario_base: Number(String(pegar(row, ["salario atual","salário atual"]) || "0").replace(/\./g,"").replace(",", ".")) || 0,
            data_admissao: dataIso(pegar(row, ["data admissao","data admissão"])),
            data_demissao: dataIso(pegar(row, ["data demissao","data demissão"])),
            data_aso: dataIso(pegar(row, ["data aso"])),
            vencimento_aso: dataIso(pegar(row, ["vencimento aso"])),
            primeira_experiencia: dataIso(pegar(row, ["1a experiencia","1ª experiência"])),
            segunda_experiencia: dataIso(pegar(row, ["2a experiencia","2ª experiência"])),
            data_nascimento: dataIso(pegar(row, ["data de nascimento","data nascimento"])),
            livro: pegar(row, ["livro"]),
            serie: pegar(row, ["serie","série"]),
            cnh: pegar(row, ["cnh"]),
            cnh_categoria: pegar(row, ["cat", "cat."]),
            titulo_eleitor: pegar(row, ["titulo de eleitor","título de eleitor"]),
            telefone: pegar(row, ["telefone"]),
            telefone_recado: pegar(row, ["telefone recado"]),
            email: pegar(row, ["e mail","e-mail","email"]),
            endereco: pegar(row, ["endereco","endereço"]),
            complemento: pegar(row, ["complemento"]),
            bairro: pegar(row, ["bairro"]),
            cidade: pegar(row, ["cidade"]),
            cep: pegar(row, ["cep"]),
            filhos: pegar(row, ["filho", "filhos"]),
            integracao: pegar(row, ["integracao","integração"]),
            banco: pegar(row, ["banco"]),
            agencia: pegar(row, ["agencia","agência"]),
            conta: pegar(row, ["conta"]),
            pix: pegar(row, ["pix"]),
            e_social: pegar(row, ["e social","e-social"])
          });
        }
        impParsed = { linhas: linhas, cabs: ["nome","status","cargo","cpf","salario_base"], tipo: "funcionarios_tc" };
        renderPreviewImport(linhas, ["nome","status","cargo","cpf","salario_base"]);
        setImpStatus("Pré-visualização: " + linhas.length + " funcionário(s) prontos para importar.", "ok");
        atualizarEstadoImport();
      } catch (e) { setImpStatus("Erro: " + e.message, "erro"); }
    };
    reader.readAsArrayBuffer(arq);
  }

  function confirmarUpsertFuncionarios(linhas) {
    if (!confirm("Importar " + linhas.length + " funcionário(s)?\n\nO histórico aceita CPFs duplicados (readmissões geram registros separados).")) return;
    impBtnConf.disabled = true;
    setImpStatus("Inserindo funcionários…", "carregando");
    client.from("funcionarios").insert(linhas).then(function (r) {
      impBtnConf.disabled = false;
      if (r.error) { setImpStatus("Erro: " + r.error.message, "erro"); return; }
      var ativos = linhas.filter(function (l) { return l.status === "ATIVO"; }).length;
      var inativos = linhas.length - ativos;
      setImpStatus("Importação concluída. " + linhas.length + " funcionários (" + ativos + " ativos / " + inativos + " inativos/afastados). Vincule Centro de Custo e Posição via Editar.", "ok");
      funcionariosCarregado = false;
      impParsed = null;
    });
  }

  // ----- Parser específico: Despesas Folha Mensal -----
  // Layout: linha 4 = cabeçalho rubricas (col E em diante), linhas 5+ = dados.
  // Col A = NOME, B = CC código, C = CC descrição.
  // Linha 3 col D = data de referência da folha (datetime).
  function previsualizarDespesasFolha(arq) {
    setImpStatus("Lendo Despesas Folha…", "carregando");
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var wb = window.XLSX.read(ev.target.result, { type: "array", cellDates: true });
        // Tenta achar a primeira aba mensal (excluindo Resumo* e Conta*)
        var mesAbas = wb.SheetNames.filter(function (n) {
          return /(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/i.test(n);
        });
        if (!mesAbas.length) { setImpStatus("Nenhuma aba mensal encontrada.", "erro"); return; }
        // Pega a primeira mensal — usuário pode preparar a planilha contendo apenas o mês desejado
        var nomeAba = mesAbas[0];
        var sheet = wb.Sheets[nomeAba];
        var raw = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
        // Data de referência (linha 3, col D) → mes_ref "YYYY-MM"
        var dataRef = raw[2] && raw[2][3];
        var mesRef = dataRef instanceof Date
          ? dataRef.getFullYear() + "-" + String(dataRef.getMonth() + 1).padStart(2,"0")
          : null;
        if (!mesRef) {
          // Tenta inferir do nome da aba
          var nomesMes = {janeiro:"01",fevereiro:"02",marco:"03","março":"03",abril:"04",maio:"05",junho:"06",julho:"07",agosto:"08",setembro:"09",outubro:"10",novembro:"11",dezembro:"12"};
          for (var n in nomesMes) {
            if (nomeAba.toLowerCase().indexOf(n) !== -1) { mesRef = "2025-" + nomesMes[n]; break; }
          }
        }
        if (!mesRef) { setImpStatus("Não consegui identificar o mês de referência.", "erro"); return; }
        // Cabeçalho de rubricas — linha 4 (índice 3), col E (índice 4) em diante até "Total"
        var cab = raw[3] || [];
        var colsRubrica = [];
        for (var c = 4; c < cab.length; c++) {
          var nome = cab[c];
          if (!nome) continue;
          var nomeStr = String(nome).trim();
          if (nomeStr.toLowerCase() === "total") continue;
          colsRubrica.push({ idx: c, nome: nomeStr });
        }
        // Coletar linhas de funcionários
        var registros = [];
        for (var r = 4; r < raw.length; r++) {
          var row = raw[r] || [];
          var nome = String(row[0] || "").trim();
          if (!nome) continue;
          var ccCodigo = row[1] != null ? String(row[1]).trim() : null;
          var rubricasFun = [];
          colsRubrica.forEach(function (col) {
            var v = row[col.idx];
            if (v == null || v === "") return;
            var num = Number(String(v).replace(/[^0-9,.\-]/g,"").replace(",", "."));
            if (isNaN(num) || num === 0) return;
            rubricasFun.push({ rubrica_nome: col.nome, valor: num });
          });
          if (!rubricasFun.length && !ccCodigo) continue;
          registros.push({ nome: nome, cc_codigo: ccCodigo, mes_ref: mesRef, rubricas: rubricasFun });
        }
        impParsed = { tipo: "despesas_folha_mensal", aba: nomeAba, mes_ref: mesRef, registros: registros };
        // Render preview
        var preview = registros.slice(0, 10).map(function (r) {
          return { nome: r.nome, cc: r.cc_codigo || "—", mes_ref: r.mes_ref, qtd_rubricas: r.rubricas.length, soma: r.rubricas.reduce(function (a, b) { return a + b.valor; }, 0) };
        });
        renderPreviewImport(preview, ["nome","cc","mes_ref","qtd_rubricas","soma"]);
        impTotal.textContent = fmtInt(registros.length);
        impPreview.hidden = false;
        setImpStatus("Aba '" + nomeAba + "' (mês " + mesRef + "): " + registros.length + " funcionários com lançamentos.", "ok");
        atualizarEstadoImport();
      } catch (e) { setImpStatus("Erro: " + e.message, "erro"); }
    };
    reader.readAsArrayBuffer(arq);
  }

  function confirmarFolhaMensal(parsed) {
    if (!confirm("Importar folha de " + parsed.mes_ref + "?\n\n" + parsed.registros.length + " funcionário(s). Para cada um:\n• Cria/atualiza linha em folha_pagamento (nesse mes_ref)\n• Atribui CC ao funcionário (cruzamento por nome)\n• Insere todas as rubricas em folha_pagamento_rubricas")) return;
    impBtnConf.disabled = true;
    setImpStatus("Carregando funcionários, CCs e rubricas para cruzamento…", "carregando");

    Promise.all([
      client.from("funcionarios").select("id, nome, cpf"),
      client.from("centros_custo").select("id, codigo"),
      client.from("rubricas").select("id, nome")
    ]).then(function (rs) {
      var funcs = rs[0].data || [];
      var ccs   = rs[1].data || [];
      var rubs  = rs[2].data || [];
      // Mapas de busca
      function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim(); }
      var funcPorNome = {};
      funcs.forEach(function (f) { funcPorNome[norm(f.nome)] = f; });
      var ccPorCodigo = {};
      ccs.forEach(function (c) { ccPorCodigo[c.codigo] = c.id; });
      var rubPorNome = {};
      rubs.forEach(function (r) { rubPorNome[norm(r.nome)] = r.id; });

      var processados = 0, naoEncontrados = [], erros = [];
      var i = 0;
      function processarUm() {
        if (i >= parsed.registros.length) { terminar(); return; }
        var reg = parsed.registros[i++];
        var f = funcPorNome[norm(reg.nome)];
        if (!f) {
          naoEncontrados.push(reg.nome);
          processarUm(); return;
        }
        // 1) Atualiza CC se aplicável
        var ccId = ccPorCodigo[reg.cc_codigo];
        var pUpdateCc = ccId
          ? client.from("funcionarios").update({ centro_custo_id: ccId }).eq("id", f.id)
          : Promise.resolve({});
        // 2) UPSERT na folha
        var totalBruto = 0, totalDesc = 0;
        reg.rubricas.forEach(function (r) {
          var rid = rubPorNome[norm(r.rubrica_nome)];
          if (!rid) return;
          var rub = rubs.find(function (x) { return x.id === rid; });
          // Aproximação: tributos e descontos são abatidos do bruto
          if (rub) totalBruto += r.valor;
        });
        var folhaPayload = {
          funcionario_id: f.id,
          mes_ref: reg.mes_ref,
          salario_bruto: totalBruto,
          observacoes: "Importado de Despesas Folha Mensal · " + reg.rubricas.length + " rubricas"
        };
        pUpdateCc.then(function () {
          return client.from("folha_pagamento").upsert(folhaPayload, { onConflict: "funcionario_id,mes_ref" }).select();
        }).then(function (rFol) {
          if (rFol.error) { erros.push(reg.nome + ": " + rFol.error.message); processarUm(); return; }
          var folha = rFol.data && rFol.data[0];
          if (!folha) { erros.push(reg.nome + ": sem folha retornada"); processarUm(); return; }
          // 3) Insere rubricas (UPSERT por folha_id+rubrica_id)
          var linhasRub = reg.rubricas
            .map(function (r) { return { folha_id: folha.id, rubrica_id: rubPorNome[norm(r.rubrica_nome)], valor: r.valor }; })
            .filter(function (x) { return x.rubrica_id; });
          if (!linhasRub.length) { processados++; processarUm(); return; }
          client.from("folha_pagamento_rubricas").upsert(linhasRub, { onConflict: "folha_id,rubrica_id" }).then(function (rR) {
            if (rR.error) erros.push(reg.nome + ": " + rR.error.message);
            processados++;
            setImpStatus("Processados " + processados + " / " + parsed.registros.length + "…", "carregando");
            processarUm();
          });
        });
      }
      function terminar() {
        impBtnConf.disabled = false;
        var msg = "Folha " + parsed.mes_ref + " importada. " + processados + " funcionários processados.";
        if (naoEncontrados.length) msg += " · " + naoEncontrados.length + " sem cadastro: " + naoEncontrados.slice(0,3).join(", ") + (naoEncontrados.length > 3 ? "…" : "");
        if (erros.length)         msg += " · " + erros.length + " erros: " + erros.slice(0,2).join(" | ");
        setImpStatus(msg, naoEncontrados.length || erros.length ? "alerta" : "ok");
        impParsed = null;
      }
      processarUm();
    });
  }

  // UPSERT de evolução/saída em os_evolucao_mensal (preserva campos não enviados)
  function confirmarUpsertEvolucao(tipo, linhas) {
    var nomeOp = tipo === "evolucao_pct" ? "% evolução" : "custo CPV-Matéria Prima";
    if (!confirm("Confirmar atualização de " + linhas.length + " linha(s) de " + nomeOp + " em os_evolucao_mensal?\n\nUPSERT por (os, mes_ref): novos são inseridos, existentes têm o campo deste import atualizado e os demais campos preservados.")) return;
    impBtnConf.disabled = true;
    impBtnPrev.disabled = true;
    setImpStatus("Atualizando em lotes de 200…", "carregando");
    var lotes = [];
    for (var i = 0; i < linhas.length; i += 200) lotes.push(linhas.slice(i, i + 200));
    var atualizados = 0, erros = [];
    var processar = function (idx) {
      if (idx >= lotes.length) {
        impBtnConf.disabled = false;
        impBtnPrev.disabled = false;
        if (erros.length) {
          setImpStatus("Concluído com avisos. Atualizados: " + atualizados + ". Erros em " + erros.length + " lote(s): " + erros.slice(0,2).join(" | "), "alerta");
        } else {
          setImpStatus("Pronto. " + atualizados + " linha(s) atualizadas em os_evolucao_mensal.", "ok");
          aprCarregado = false;
        }
        impParsed = null;
        return;
      }
      client.from("os_evolucao_mensal")
        .upsert(lotes[idx], { onConflict: "os,mes_ref" })
        .then(function (r) {
          if (r.error) erros.push("Lote " + (idx + 1) + ": " + r.error.message);
          else atualizados += lotes[idx].length;
          setImpStatus("Atualizados " + atualizados + " / " + linhas.length + "…", "carregando");
          processar(idx + 1);
        });
    };
    processar(0);
  }


  // =========================================================================
  // 34. PROGRAMA DE BÔNUS (Entrega 6) — Cálculo por esfera
  // =========================================================================

  var bonPeriodos = [];
  var bonPeriodoSel = null;
  var bonMetasEmpresa = [];
  var bonMetasArea = [];
  var bonAreaMes = [];
  var bonCarregado = false;

  // ---- Aplicar escala configurável (do banco, escala_json) -----------------
  // escala = { tipo: 'min'|'max', unidade, faixas: [{limite, peso_pct, label}, ...] }
  // tipo "min": ganha a primeira faixa (ordem decrescente de limite) onde valor >= limite
  // tipo "max": ganha a primeira faixa (ordem crescente de limite) onde valor <= limite
  // Se faixa.limite === null em "max", essa é a faixa de "fora" (qualquer valor maior).
  function aplicarEscala(escala, valor) {
    if (!escala || !escala.faixas || valor == null || isNaN(valor)) {
      return { peso_pct: 0, faixa: null };
    }
    var tipo = (escala.tipo || "min").toLowerCase();
    var faixas = escala.faixas.slice();
    if (tipo === "max") {
      // Em "max", limite null vale como "infinito" (cabe sempre depois das outras)
      faixas.sort(function (a, b) {
        var la = a.limite == null ? Infinity : Number(a.limite);
        var lb = b.limite == null ? Infinity : Number(b.limite);
        return la - lb;
      });
      for (var i = 0; i < faixas.length; i++) {
        var f = faixas[i];
        var lim = f.limite == null ? Infinity : Number(f.limite);
        if (Number(valor) <= lim) return { peso_pct: Number(f.peso_pct || 0), faixa: f };
      }
    } else {
      // tipo "min" — descrescente (limite null vira -infinito)
      faixas.sort(function (a, b) {
        var la = a.limite == null ? -Infinity : Number(a.limite);
        var lb = b.limite == null ? -Infinity : Number(b.limite);
        return lb - la;
      });
      for (var j = 0; j < faixas.length; j++) {
        var ff = faixas[j];
        var lm = ff.limite == null ? -Infinity : Number(ff.limite);
        if (Number(valor) >= lm) return { peso_pct: Number(ff.peso_pct || 0), faixa: ff };
      }
    }
    return { peso_pct: 0, faixa: null };
  }

  function carregarProgramaBonusSeNecessario() {
    if (bonCarregado) { renderProgramaBonus(); return; }
    var grid = document.getElementById("bon-empresa-grid");
    if (grid) grid.innerHTML = '<div class="tbl-vazio">Carregando…</div>';

    Promise.all([
      client.from("bonif_periodos").select("*").order("inicio_em", { ascending: false }),
      client.from("bonif_metas_empresa").select("*"),
      client.from("bonif_metas_area").select("*"),
      client.from("bonif_meta_area_mes").select("*")
    ]).then(function (rs) {
      bonPeriodos     = (rs[0] && rs[0].data) || [];
      bonMetasEmpresa = (rs[1] && rs[1].data) || [];
      bonMetasArea    = (rs[2] && rs[2].data) || [];
      bonAreaMes      = (rs[3] && rs[3].data) || [];
      bonCarregado = true;

      // Popular dropdown de período + selecionar o ativo
      var sel = document.getElementById("bon-periodo");
      if (sel) {
        sel.innerHTML = bonPeriodos.map(function (p) {
          return '<option value="' + p.id + '">' + escHtml(p.nome) + '</option>';
        }).join("");
        var ativo = bonPeriodos.find(function (p) { return p.status === "ativo"; });
        bonPeriodoSel = ativo ? ativo.id : (bonPeriodos[0] && bonPeriodos[0].id) || null;
        if (bonPeriodoSel) sel.value = String(bonPeriodoSel);
        sel.onchange = function () {
          bonPeriodoSel = Number(sel.value);
          renderProgramaBonus();
        };
      }
      // Dispara cargas auxiliares (caixa + compromissos) em paralelo — destravam Caixa Positivo e ICC
      if (!caixaSaldoCarregado && !caixaSaldoCarregando)   carregarCaixaSaldoSeNecessario();
      if (!compromissosCarregado && !compromissosCarregando) carregarCompromissosSeNecessario();

      // Garante que receitas_custos esteja carregado para os cálculos
      if (!rcCarregado) {
        carregarConsolidadoSeNecessario();
        var iv = setInterval(function () {
          if (rcCarregado) { clearInterval(iv); renderProgramaBonus(); }
        }, 150);
      } else {
        // E orcamentos para faturamento por nota_fiscal
        if (!orcamentosCarregados) {
          carregarOrcamentosSeNecessario();
          var iv2 = setInterval(function () {
            if (orcamentosCarregados) { clearInterval(iv2); renderProgramaBonus(); }
          }, 150);
        } else {
          renderProgramaBonus();
        }
      }
    });
  }

  function periodoAtual() {
    return bonPeriodos.find(function (p) { return p.id === bonPeriodoSel; }) || null;
  }

  function calcularEmpresa() {
    var periodo = periodoAtual();
    if (!periodo) return null;
    var inicio = String(periodo.inicio_em).slice(0,10);
    var fim    = String(periodo.fim_em).slice(0,10);
    var anoIni = Number(inicio.slice(0,4)), mesIni = Number(inicio.slice(5,7));
    var anoFim = Number(fim.slice(0,4)),    mesFim = Number(fim.slice(5,7));

    var metasPorChave = {};
    bonMetasEmpresa.forEach(function (m) {
      if (m.periodo_id === periodo.id) metasPorChave[m.meta_chave] = m;
    });

    // -- Faturamento Bruto acumulado no período (sum de orcamentos.nota_fiscal cuja data está no período)
    var fatAcum = 0;
    (orcamentosLista || []).forEach(function (o) {
      var d = String(o.data || "").slice(0,10);
      if (!d) return;
      if (d >= inicio && d <= fim) fatAcum += Number(o.nota_fiscal || 0);
    });

    // -- Margem Líquida acumulada (receita - custo) / receita no período
    var totReceita = 0, totCusto = 0;
    (rcLista || []).forEach(function (r) {
      var ano = Number(r.ano), mes = Number(r.mes);
      var dentro = (ano > anoIni || (ano === anoIni && mes >= mesIni)) &&
                   (ano < anoFim || (ano === anoFim && mes <= mesFim));
      if (!dentro) return;
      if (r.categoria === "receita") totReceita += Number(r.valor || 0);
      else if (r.categoria === "custo") totCusto += Number(r.valor || 0);
    });
    var mlPct = totReceita > 0 ? ((totReceita - totCusto) / totReceita * 100) : null;

    // Cálculo dos pesos
    var resultado = {};

    // Faturamento Bruto → aplica escala do banco (sobre % atingido)
    var mFat = metasPorChave.faturamento_bruto;
    if (mFat) {
      var metaFat = Number(mFat.valor_meta);
      var pctAt  = metaFat > 0 ? (fatAcum / metaFat * 100) : 0;
      var rFat   = aplicarEscala(mFat.escala_json, pctAt);
      resultado.faturamento_bruto = {
        meta: metaFat, valor: fatAcum, pctAtingido: pctAt,
        pesoBase: Number(mFat.peso_pct), pesoGanho: rFat.peso_pct, unidade: "BRL",
        faixaLabel: rFat.faixa && rFat.faixa.label,
        fonte: "orcamentos.nota_fiscal somado por data · escala em rh_bonus_config"
      };
    }

    // Margem Líquida → aplica escala do banco (sobre ML% / meta% × 100)
    var mML = metasPorChave.margem_liquida;
    if (mML) {
      var metaML = Number(mML.valor_meta);
      var pctAt2 = (mlPct != null && metaML > 0) ? (mlPct / metaML * 100) : null;
      var rML    = pctAt2 != null ? aplicarEscala(mML.escala_json, pctAt2) : { peso_pct: null, faixa: null };
      resultado.margem_liquida = {
        meta: metaML, valor: mlPct, pctAtingido: pctAt2,
        pesoBase: Number(mML.peso_pct), pesoGanho: rML.peso_pct, unidade: "pct",
        faixaLabel: rML.faixa && rML.faixa.label,
        fonte: "receitas_custos (receita − custo) / receita · escala em rh_bonus_config",
        receita: totReceita, custo: totCusto
      };
    }

    // Caixa Positivo (peso 5) — saldo_final > 0 em todos os meses do período
    var mCx = metasPorChave.caixa_positivo;
    if (mCx) {
      if (!caixaSaldoCarregado || !caixaSaldoLista.length) {
        resultado.caixa_positivo = {
          meta: 1, valor: null, pctAtingido: null,
          pesoBase: Number(mCx.peso_pct), pesoGanho: null, unidade: "bool",
          faltaDado: true,
          fonte: "caixa_saldo_mensal — sem dados ainda. Importe os saldos via Importar > Saldo de Caixa Mensal."
        };
      } else {
        // Conta meses do período (anoIni-mesIni até anoFim-mesFim) com saldo > 0
        var totalMeses = 0, mesesPositivos = 0, mesesAusentes = 0;
        for (var ano = anoIni; ano <= anoFim; ano++) {
          var mIni = (ano === anoIni) ? mesIni : 1;
          var mFim = (ano === anoFim) ? mesFim : 12;
          for (var m = mIni; m <= mFim; m++) {
            totalMeses++;
            var iso = ano + "-" + (m < 10 ? "0" + m : m) + "-01";
            var reg = caixaSaldoLista.find(function (r) { return String(r.mes_ref).slice(0,10) === iso; });
            if (!reg) mesesAusentes++;
            else if (Number(reg.saldo_final) > 0) mesesPositivos++;
          }
        }
        var pctAtCx = totalMeses ? (mesesPositivos / totalMeses) : 0;
        // Regra do PPT: TODOS os meses positivos = 100% do peso. Caso contrário, 0.
        var pesoGanhoCx = (mesesPositivos === totalMeses && mesesAusentes === 0) ? Number(mCx.peso_pct) : 0;
        resultado.caixa_positivo = {
          meta: 1,
          valor: mesesPositivos + " de " + totalMeses + " meses positivos" + (mesesAusentes ? " (" + mesesAusentes + " sem dado)" : ""),
          pctAtingido: pctAtCx,
          pesoBase: Number(mCx.peso_pct), pesoGanho: pesoGanhoCx,
          unidade: "bool",
          faltaDado: mesesAusentes > 0,
          fonte: "caixa_saldo_mensal — saldo_final > 0 em todos os meses do período"
        };
      }
    }

    // ICC ≥ 100% (peso 5) — saldo de caixa atual cobre compromissos próximos 6 meses
    var mIcc = metasPorChave.icc_6m;
    if (mIcc) {
      var faltaCx = !caixaSaldoCarregado || !caixaSaldoLista.length;
      var faltaCp = !compromissosCarregado;
      if (faltaCx || faltaCp) {
        var pendentes = [];
        if (faltaCx) pendentes.push("saldo de caixa");
        if (faltaCp) pendentes.push("compromissos");
        resultado.icc_6m = {
          meta: 100, valor: null, pctAtingido: null,
          pesoBase: Number(mIcc.peso_pct), pesoGanho: null, unidade: "pct",
          faltaDado: true,
          fonte: "ICC depende de: " + pendentes.join(" + ") + ". Importe via Importar."
        };
      } else {
        // Saldo mais recente
        var saldoAtual = Number(caixaSaldoLista[0].saldo_final || 0);
        // Compromissos pendentes nos próximos 183 dias
        var hoje = new Date(); hoje.setHours(0,0,0,0);
        var d6 = new Date(); d6.setDate(d6.getDate() + 183);
        var hojeIso = hoje.toISOString().slice(0,10);
        var d6iso   = d6.toISOString().slice(0,10);
        var totalCompr = (compromissosLista || []).filter(function (c) {
          return !c.pago_em && c.vencimento >= hojeIso && c.vencimento <= d6iso;
        }).reduce(function (acc, c) { return acc + Number(c.valor || 0); }, 0);

        var iccPct = totalCompr > 0 ? (saldoAtual / totalCompr) * 100 : (saldoAtual > 0 ? 999 : 0);
        var pctAtIcc = totalCompr > 0 ? Math.min(1, saldoAtual / totalCompr) : (saldoAtual > 0 ? 1 : 0);
        var pesoGanhoIcc = (iccPct >= 100) ? Number(mIcc.peso_pct) : 0;
        resultado.icc_6m = {
          meta: 100,
          valor: iccPct >= 999 ? "Sem compromissos próximos" : (iccPct.toFixed(0) + "%"),
          pctAtingido: pctAtIcc,
          pesoBase: Number(mIcc.peso_pct), pesoGanho: pesoGanhoIcc,
          unidade: "pct",
          faltaDado: false,
          fonte: "ICC = R$ " + fmtBRL(saldoAtual).replace("R$","").trim() + " (saldo mais recente) ÷ R$ " + fmtBRL(totalCompr).replace("R$","").trim() + " (compromissos próx. 6m)"
        };
      }
    }

    return resultado;
  }

  function calcularAreas() {
    var periodo = periodoAtual();
    if (!periodo) return [];
    var metasDoPeriodo = bonMetasArea.filter(function (m) { return m.periodo_id === periodo.id; });
    if (!metasDoPeriodo.length) return [];

    // Escala-padrão de área (slide 19) caso a meta não tenha escala_json definida
    var escalaPadrao = {
      tipo: "min", unidade: "meses",
      faixas: [
        { limite: 6, peso_pct: 100, label: "6 meses" },
        { limite: 5, peso_pct: 83,  label: "5 meses" },
        { limite: 4, peso_pct: 67,  label: "4 meses" },
        { limite: 3, peso_pct: 50,  label: "3 meses" },
        { limite: 2, peso_pct: 33,  label: "2 meses" },
        { limite: 1, peso_pct: 17,  label: "1 mês"   },
        { limite: 0, peso_pct: 0,   label: "0 meses" }
      ]
    };

    return metasDoPeriodo.map(function (m) {
      var atingiu = bonAreaMes.filter(function (x) { return x.meta_id === m.id && x.atingiu; });
      var meses = atingiu.length;
      var escala = m.escala_json || escalaPadrao;
      var r = aplicarEscala(escala, meses);
      // A escala-padrão dá peso_pct em 0..100 (proporção). Convertemos pra peso real.
      var fatorProp = (r.peso_pct || 0) / 100;
      var pesoBase = Number(m.peso_pct || 30);
      var pesoGanho = pesoBase * fatorProp;
      var path = (organogramaLista && organogramaLista.length) ? buildOrgPath(m.organograma_id) : ("#" + m.organograma_id);
      return {
        id: m.id, area: path, descricao: m.descricao, indicador: m.indicador_descritivo,
        peso_base: pesoBase, meses_cumpridos: meses, peso_ganho: pesoGanho,
        faixaLabel: r.faixa && r.faixa.label
      };
    });
  }

  function renderProgramaBonus() {
    if (!bonCarregado) return;
    var periodo = periodoAtual();
    if (!periodo) {
      document.getElementById("bon-empresa-grid").innerHTML = '<div class="tbl-vazio">Nenhum período cadastrado.</div>';
      return;
    }

    valText(document.getElementById("bon-lbl"),
      periodo.nome + " · " + fmtData(periodo.inicio_em) + " a " + fmtData(periodo.fim_em));

    // ===== Esfera Empresa
    var empresa = calcularEmpresa();
    var grid = document.getElementById("bon-empresa-grid");
    var pesoEmpresa = 0, pesoEmpresaMax = 0, pesoEmpresaCalculavel = 0;
    var ordemEmpresa = ["faturamento_bruto","margem_liquida","caixa_positivo","icc_6m"];
    var labelEmpresa = {
      faturamento_bruto: "Faturamento Bruto",
      margem_liquida:    "Rentabilidade (Margem Líquida)",
      caixa_positivo:    "Fluxo de Caixa Positivo (mensal)",
      icc_6m:            "ICC ≥ 100% (cobertura 6 meses)"
    };

    var html = ordemEmpresa.map(function (chave) {
      var x = empresa && empresa[chave];
      if (!x) return "";
      pesoEmpresaMax += x.pesoBase;
      var faltaDado = !!x.faltaDado;
      if (!faltaDado && x.pesoGanho != null) {
        pesoEmpresa += x.pesoGanho;
        pesoEmpresaCalculavel += x.pesoBase;
      }

      var valTxt, metaTxt, pctAtTxt;
      if (faltaDado) {
        valTxt = "—"; metaTxt = (chave === "caixa_positivo" ? "saldo > 0 todo mês" : (chave === "icc_6m" ? "ICC ≥ 100%" : "")); pctAtTxt = "Aguardando dado";
      } else if (chave === "faturamento_bruto") {
        valTxt = fmtBRL(x.valor); metaTxt = fmtBRL(x.meta); pctAtTxt = (x.pctAtingido).toFixed(1).replace(".", ",") + "% da meta";
      } else if (chave === "margem_liquida") {
        valTxt = (x.valor != null ? x.valor.toFixed(1).replace(".", ",") + "%" : "—");
        metaTxt = x.meta + "%"; pctAtTxt = (x.pctAtingido != null ? x.pctAtingido.toFixed(1).replace(".", ",") + "% da meta" : "—");
      }

      var pesoTxt = faltaDado ? "— / " + x.pesoBase + "%" : (x.pesoGanho.toFixed(2).replace(".", ",") + "% / " + x.pesoBase + "%");
      var clsValor = faltaDado ? " neg" : (x.pesoGanho >= x.pesoBase ? " ok" : (x.pesoGanho > 0 ? " alert" : " neg"));
      var pctAtingido = faltaDado ? 0 : Math.min(100, Math.max(0, x.pctAtingido || 0));

      return '<div class="bon-card' + (faltaDado ? ' bon-card-faltadado' : '') + '">' +
        '<div class="bon-card-titulo">' + escHtml(labelEmpresa[chave]) + '</div>' +
        '<div class="bon-card-meta">Meta: ' + escHtml(metaTxt) + '</div>' +
        '<div class="bon-card-valor">' + escHtml(valTxt) + '</div>' +
        '<div class="bon-card-bar"><div class="bon-card-bar-fill" style="width:' + pctAtingido + '%"></div></div>' +
        '<div class="bon-card-peso-linha"><span>' + escHtml(pctAtTxt) + '</span><span class="' + clsValor.trim() + '">' + escHtml(pesoTxt) + '</span></div>' +
        '<div class="bon-card-fonte">' + escHtml(x.fonte || "") + '</div>' +
      '</div>';
    }).join("");
    grid.innerHTML = html || '<div class="tbl-vazio">Sem metas cadastradas para este período.</div>';

    // ===== Esfera Áreas
    var areas = calcularAreas();
    var gAreas = document.getElementById("bon-areas-grid");
    if (!areas.length) {
      gAreas.innerHTML = '<div class="tbl-vazio">Nenhuma meta de área cadastrada para o período. (UI de cadastro virá em entrega futura.)</div>';
    } else {
      var pesoAreas = 0, pesoAreasMax = 0;
      gAreas.innerHTML = areas.map(function (a) {
        pesoAreas += a.peso_ganho;
        pesoAreasMax += a.peso_base;
        var pct = a.peso_base > 0 ? (a.peso_ganho / a.peso_base * 100) : 0;
        return '<div class="bon-card">' +
          '<div class="bon-card-titulo">' + escHtml(a.area) + '</div>' +
          '<div class="bon-card-meta">' + escHtml(a.descricao) + '</div>' +
          '<div class="bon-card-valor">' + a.meses_cumpridos + ' / 6 meses</div>' +
          '<div class="bon-card-bar"><div class="bon-card-bar-fill" style="width:' + pct + '%"></div></div>' +
          '<div class="bon-card-peso-linha"><span>' + escHtml(a.indicador || "") + '</span><span>' + a.peso_ganho.toFixed(2).replace(".", ",") + '% / ' + a.peso_base + '%</span></div>' +
        '</div>';
      }).join("");
    }

    // ===== Cards globais no topo (Empresa + Áreas — Profissional foi para a tela "Bônus Individual")
    valText(document.getElementById("bon-m-empresa"),
      pesoEmpresa.toFixed(2).replace(".", ",") + "% / 30%");
    valText(document.getElementById("bon-m-empresa-sub"),
      pesoEmpresaCalculavel < 30
        ? "calculado sobre " + pesoEmpresaCalculavel + "% (faltam " + (30 - pesoEmpresaCalculavel) + "% de dados)"
        : "todas as 4 metas calculadas");

    if (areas.length) {
      var somaA = areas.reduce(function (acc, a) { return acc + a.peso_ganho; }, 0);
      valText(document.getElementById("bon-m-areas"), somaA.toFixed(2).replace(".", ",") + "% / 30%");
      valText(document.getElementById("bon-m-areas-sub"), areas.length + " meta(s) por área");
    } else {
      valText(document.getElementById("bon-m-areas"), "—");
      valText(document.getElementById("bon-m-areas-sub"), "Aguardando definição");
    }

    var totalEA = pesoEmpresa + (areas.length ? areas.reduce(function (acc, a) { return acc + a.peso_ganho; }, 0) : 0);
    valText(document.getElementById("bon-m-total"), totalEA.toFixed(2).replace(".", ",") + "%");
  }


  // =========================================================================
  // 35. RH > BÔNUS — CONFIGURAÇÃO (Entrega 7)
  // =========================================================================

  var bcfgPeriodos     = [];
  var bcfgMetasEmpresa = [];
  var bcfgMetasArea    = [];
  var bcfgMetasProf    = [];
  var bcfgPeriodoSel   = null;
  var bcfgInicializado = false;

  // Labels amigáveis
  var BCFG_EMPRESA_LABELS = {
    faturamento_bruto: "Faturamento Bruto",
    margem_liquida:    "Rentabilidade (Margem Líquida)",
    caixa_positivo:    "Fluxo de Caixa Positivo",
    icc_6m:            "ICC ≥ 100% (6 meses)"
  };
  var BCFG_PROF_LABELS = {
    conduta:     "Aderência ao Código de Conduta",
    faltas_just: "Faltas Justificadas",
    atrasos:     "Atrasos",
    performance: "Avaliação de Performance",
    penalidade:  "Penalidade por falta/atraso sem justificativa"
  };

  function carregarConfigBonusSeNecessario() {
    // Garante que o organograma esteja carregado para o select de áreas
    if (!organogramaCarregado) carregarOrganogramaParaSelectSeNecessario();

    Promise.all([
      client.from("bonif_periodos").select("*").order("inicio_em", { ascending: false }),
      client.from("bonif_metas_empresa").select("*"),
      client.from("bonif_metas_area").select("*"),
      client.from("bonif_metas_profissional").select("*")
    ]).then(function (rs) {
      bcfgPeriodos     = (rs[0] && rs[0].data) || [];
      bcfgMetasEmpresa = (rs[1] && rs[1].data) || [];
      bcfgMetasArea    = (rs[2] && rs[2].data) || [];
      bcfgMetasProf    = (rs[3] && rs[3].data) || [];

      // Popular dropdown de período
      var sel = document.getElementById("bcfg-periodo");
      if (sel) {
        sel.innerHTML = bcfgPeriodos.map(function (p) {
          return '<option value="' + p.id + '">' + escHtml(p.nome) + '</option>';
        }).join("");
        var ativo = bcfgPeriodos.find(function (p) { return p.status === "ativo"; });
        bcfgPeriodoSel = ativo ? ativo.id : (bcfgPeriodos[0] && bcfgPeriodos[0].id) || null;
        if (bcfgPeriodoSel) sel.value = String(bcfgPeriodoSel);
        sel.onchange = function () {
          bcfgPeriodoSel = Number(sel.value);
          renderConfigBonus();
        };
      }
      if (!bcfgInicializado) ligarTabsBcfg();
      renderConfigBonus();
    });
  }

  function ligarTabsBcfg() {
    bcfgInicializado = true;
    document.querySelectorAll(".bcfg-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        var alvo = tab.getAttribute("data-bcfg-tab");
        document.querySelectorAll(".bcfg-tab").forEach(function (t) { t.classList.toggle("ativo", t === tab); });
        document.querySelectorAll(".bcfg-pane").forEach(function (p) {
          p.hidden = p.getAttribute("data-bcfg-pane") !== alvo;
          p.classList.toggle("ativo", p.getAttribute("data-bcfg-pane") === alvo);
        });
      });
    });
    var btnNovoP = document.getElementById("bcfg-btn-novo-periodo");
    if (btnNovoP) btnNovoP.addEventListener("click", function () { abrirModalPeriodo(null); });
    var btnNovaA = document.getElementById("bcfg-areas-btn-novo");
    if (btnNovaA) btnNovaA.addEventListener("click", function () { abrirModalMetaArea(null); });
  }

  function renderConfigBonus() {
    if (!bcfgPeriodoSel && bcfgPeriodos.length) bcfgPeriodoSel = bcfgPeriodos[0].id;
    valText(document.getElementById("bcfg-lbl"), bcfgPeriodos.length + " período(s) cadastrado(s)");
    renderBcfgEmpresa();
    renderBcfgAreas();
    renderBcfgProf();
    renderBcfgPeriodos();
  }

  function escalaPreviewHtml(escala) {
    if (!escala || !escala.faixas || !escala.faixas.length) return '<span class="bcfg-escala-prev-faixa">sem escala</span>';
    return '<div class="bcfg-escala-prev">' + escala.faixas.map(function (f) {
      var l = f.limite == null ? "∞" : f.limite;
      var op = (escala.tipo === "max") ? "≤" : "≥";
      return '<span class="bcfg-escala-prev-faixa" title="' + escHtml(f.label || "") + '">' + op + l + ' → ' + f.peso_pct + '%</span>';
    }).join("") + '</div>';
  }

  // ---- Aba Empresa ---------------------------------------------------------
  function renderBcfgEmpresa() {
    var tbody = document.getElementById("bcfg-empresa-tbody");
    if (!tbody) return;
    var lista = bcfgMetasEmpresa.filter(function (m) { return m.periodo_id === bcfgPeriodoSel; });
    var ordem = ["faturamento_bruto","margem_liquida","caixa_positivo","icc_6m"];
    lista.sort(function (a, b) { return ordem.indexOf(a.meta_chave) - ordem.indexOf(b.meta_chave); });
    if (!lista.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="tbl-vazio">Nenhuma meta. Selecione um período válido.</td></tr>';
      return;
    }
    tbody.innerHTML = lista.map(function (m) {
      var valTxt = m.unidade === "BRL" ? fmtBRL(m.valor_meta) : (Number(m.valor_meta) + (m.unidade === "pct" ? "%" : ""));
      return '<tr>' +
        '<td><strong>' + escHtml(BCFG_EMPRESA_LABELS[m.meta_chave] || m.meta_chave) + '</strong></td>' +
        '<td>' + escHtml(m.descricao || "—") + '</td>' +
        '<td class="num">' + escHtml(valTxt) + '</td>' +
        '<td class="num">' + Number(m.peso_pct).toFixed(2).replace(".", ",") + '%</td>' +
        '<td>' + escalaPreviewHtml(m.escala_json) + '</td>' +
        '<td><button class="btn-limpar" data-bcfg-emp-edit="' + m.id + '">Editar</button></td>' +
      '</tr>';
    }).join("");
    tbody.querySelectorAll("[data-bcfg-emp-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.getAttribute("data-bcfg-emp-edit"));
        var m = bcfgMetasEmpresa.find(function (x) { return x.id === id; });
        if (m) abrirModalMetaEmpresa(m);
      });
    });
  }

  // ---- Aba Áreas -----------------------------------------------------------
  function renderBcfgAreas() {
    var tbody = document.getElementById("bcfg-areas-tbody");
    if (!tbody) return;
    var lista = bcfgMetasArea.filter(function (m) { return m.periodo_id === bcfgPeriodoSel; });
    valText(document.getElementById("bcfg-areas-lbl"), lista.length + " meta(s) de área");
    if (!lista.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="tbl-vazio">Nenhuma meta de área cadastrada para este período. Clique em + Nova meta de área.</td></tr>';
      return;
    }
    tbody.innerHTML = lista.map(function (m) {
      var path = (organogramaLista && organogramaLista.length) ? buildOrgPath(m.organograma_id) : ("#" + m.organograma_id);
      return '<tr>' +
        '<td>' + escHtml(path) + '</td>' +
        '<td>' + escHtml(m.descricao) + '</td>' +
        '<td>' + escHtml(m.indicador_descritivo || "—") + '</td>' +
        '<td class="num">' + Number(m.peso_pct).toFixed(2).replace(".", ",") + '%</td>' +
        '<td><button class="btn-limpar" data-bcfg-area-edit="' + m.id + '">Editar</button> <button class="btn-limpar" data-bcfg-area-del="' + m.id + '">Excluir</button></td>' +
      '</tr>';
    }).join("");
    tbody.querySelectorAll("[data-bcfg-area-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.getAttribute("data-bcfg-area-edit"));
        var m = bcfgMetasArea.find(function (x) { return x.id === id; });
        if (m) abrirModalMetaArea(m);
      });
    });
    tbody.querySelectorAll("[data-bcfg-area-del]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.getAttribute("data-bcfg-area-del"));
        if (!confirm("Excluir esta meta de área?")) return;
        client.from("bonif_metas_area").delete().eq("id", id).then(function (r) {
          if (r.error) { alert("Erro: " + r.error.message); return; }
          carregarConfigBonusSeNecessario();
        });
      });
    });
  }

  // ---- Aba Profissional ----------------------------------------------------
  function renderBcfgProf() {
    var tbody = document.getElementById("bcfg-prof-tbody");
    if (!tbody) return;
    var lista = bcfgMetasProf.filter(function (m) { return m.periodo_id === bcfgPeriodoSel; });
    var ordem = ["conduta","faltas_just","atrasos","performance","penalidade"];
    lista.sort(function (a, b) { return ordem.indexOf(a.meta_chave) - ordem.indexOf(b.meta_chave); });
    if (!lista.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="tbl-vazio">Nenhuma meta. Selecione um período válido.</td></tr>';
      return;
    }
    tbody.innerHTML = lista.map(function (m) {
      return '<tr>' +
        '<td><strong>' + escHtml(BCFG_PROF_LABELS[m.meta_chave] || m.meta_chave) + '</strong></td>' +
        '<td>' + escHtml(m.descricao || "—") + '</td>' +
        '<td class="num">' + Number(m.peso_pct).toFixed(2).replace(".", ",") + '%</td>' +
        '<td>' + escHtml(m.unidade) + '</td>' +
        '<td>' + escalaPreviewHtml(m.escala_json) + '</td>' +
        '<td><button class="btn-limpar" data-bcfg-prof-edit="' + m.id + '">Editar</button></td>' +
      '</tr>';
    }).join("");
    tbody.querySelectorAll("[data-bcfg-prof-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.getAttribute("data-bcfg-prof-edit"));
        var m = bcfgMetasProf.find(function (x) { return x.id === id; });
        if (m) abrirModalMetaProf(m);
      });
    });
  }

  // ---- Aba Períodos --------------------------------------------------------
  function renderBcfgPeriodos() {
    var tbody = document.getElementById("bcfg-periodos-tbody");
    if (!tbody) return;
    if (!bcfgPeriodos.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="tbl-vazio">Nenhum período. Clique em + Novo Período.</td></tr>';
      return;
    }
    tbody.innerHTML = bcfgPeriodos.map(function (p) {
      var stCls = p.status === "ativo" ? "solta" : "outras";
      return '<tr>' +
        '<td><strong>' + escHtml(p.nome) + '</strong></td>' +
        '<td>' + fmtData(p.inicio_em) + '</td>' +
        '<td>' + fmtData(p.fim_em) + '</td>' +
        '<td><span class="badge-tipo ' + stCls + '">' + escHtml(p.status) + '</span></td>' +
        '<td><button class="btn-limpar" data-bcfg-per-edit="' + p.id + '">Editar</button></td>' +
      '</tr>';
    }).join("");
    tbody.querySelectorAll("[data-bcfg-per-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.getAttribute("data-bcfg-per-edit"));
        var p = bcfgPeriodos.find(function (x) { return x.id === id; });
        if (p) abrirModalPeriodo(p);
      });
    });
  }

  // =========================================================================
  // Editor de escala (campos dinâmicos)
  // =========================================================================
  // Constrói o HTML da seção de edição de escala dentro do modal.
  // Após salvar, lê do DOM e devolve um JSONB { tipo, faixas: [...] }.
  function escalaEditorHtml(escala) {
    escala = escala || { tipo: "min", faixas: [] };
    var rows = (escala.faixas || []).map(function (f, i) {
      return '<div class="bcfg-escala-row" data-row="' + i + '">' +
        '<input type="text" class="bcfg-lim" placeholder="(vazio = ∞)" value="' + (f.limite == null ? "" : escHtml(f.limite)) + '" />' +
        '<input type="number" step="0.01" class="bcfg-peso" placeholder="peso %" value="' + (f.peso_pct == null ? "" : escHtml(f.peso_pct)) + '" />' +
        '<input type="text" class="bcfg-label" placeholder="rótulo (opcional)" value="' + escHtml(f.label || "") + '" />' +
        '<button type="button" class="bcfg-rm" title="Remover faixa">×</button>' +
      '</div>';
    }).join("");
    return '<div class="bcfg-escala-edit" id="bcfg-escala-edit">' +
      '<div class="bcfg-escala-edit-titulo">Escala (faixas)</div>' +
      '<div class="bcfg-escala-row bcfg-escala-row-header">' +
        '<span>Limite</span><span>Peso (%)</span><span>Rótulo (opcional)</span><span></span>' +
      '</div>' +
      '<div id="bcfg-escala-rows">' + rows + '</div>' +
      '<button type="button" class="bcfg-add-faixa" id="bcfg-add-faixa">+ adicionar faixa</button>' +
      '<div class="form-field" style="margin-top:10px"><label>Tipo da escala</label>' +
      '<select id="bcfg-tipo">' +
        '<option value="min"' + (escala.tipo === "min" ? " selected" : "") + '>"min" — ganha quando valor ≥ limite (mais é melhor)</option>' +
        '<option value="max"' + (escala.tipo === "max" ? " selected" : "") + '>"max" — ganha quando valor ≤ limite (menos é melhor)</option>' +
      '</select></div>' +
    '</div>';
  }

  function escalaEditorLer() {
    var tipo = (document.getElementById("bcfg-tipo") || {}).value || "min";
    var faixas = [];
    document.querySelectorAll("#bcfg-escala-rows .bcfg-escala-row").forEach(function (row) {
      var lim   = (row.querySelector(".bcfg-lim") || {}).value;
      var peso  = (row.querySelector(".bcfg-peso") || {}).value;
      var label = (row.querySelector(".bcfg-label") || {}).value || "";
      var lf = (lim === "" || lim == null) ? null : Number(lim);
      var pf = (peso === "" || peso == null) ? 0 : Number(peso);
      if (isNaN(pf)) pf = 0;
      faixas.push({ limite: (isNaN(lf) ? null : lf), peso_pct: pf, label: label });
    });
    return { tipo: tipo, faixas: faixas };
  }

  function ligarBotoesEscala() {
    var add = document.getElementById("bcfg-add-faixa");
    if (add) {
      add.addEventListener("click", function () {
        var rows = document.getElementById("bcfg-escala-rows");
        var n = rows.children.length;
        var div = document.createElement("div");
        div.className = "bcfg-escala-row";
        div.dataset.row = String(n);
        div.innerHTML =
          '<input type="text" class="bcfg-lim" placeholder="(vazio = ∞)" />' +
          '<input type="number" step="0.01" class="bcfg-peso" placeholder="peso %" />' +
          '<input type="text" class="bcfg-label" placeholder="rótulo (opcional)" />' +
          '<button type="button" class="bcfg-rm" title="Remover faixa">×</button>';
        rows.appendChild(div);
        ligarBotoesEscala();
      });
    }
    document.querySelectorAll(".bcfg-rm").forEach(function (btn) {
      btn.onclick = function () { btn.parentElement.remove(); };
    });
  }

  // =========================================================================
  // Modais de edição
  // =========================================================================

  function abrirModalPeriodo(p) {
    p = p || {};
    var editar = !!p.id;
    abrirModal({
      titulo: editar ? "Editar Período" : "Novo Período",
      fields: [
        { name: "nome",      label: "Nome (ex: 2026-1)", type: "text", valor: p.nome, required: true },
        { name: "inicio_em", label: "Início",            type: "date", valor: p.inicio_em, required: true },
        { name: "fim_em",    label: "Fim",               type: "date", valor: p.fim_em, required: true },
        { name: "status",    label: "Status",            type: "select", valor: p.status || "ativo", options: ["ativo","encerrado"], required: true }
      ],
      onSubmit: function (v, done) {
        var payload = { nome: v.nome, inicio_em: v.inicio_em, fim_em: v.fim_em, status: v.status };
        var q = editar
          ? client.from("bonif_periodos").update(payload).eq("id", p.id)
          : client.from("bonif_periodos").insert(payload);
        q.then(function (r) {
          if (r.error) { done(r.error.message); return; }
          carregarConfigBonusSeNecessario();
          // Invalida cache do dashboard
          bonCarregado = false;
          done(null);
        });
      }
    });
  }

  function abrirModalMetaEmpresa(m) {
    var nome = BCFG_EMPRESA_LABELS[m.meta_chave] || m.meta_chave;
    abrirModal({
      titulo: "Editar — " + nome,
      fields: [
        { name: "descricao",  label: "Descrição",                 type: "text",   valor: m.descricao },
        { name: "valor_meta", label: "Valor da meta",             type: "number", valor: m.valor_meta, required: true },
        { name: "peso_pct",   label: "Peso (%)",                  type: "number", valor: m.peso_pct, required: true },
        { name: "unidade",    label: "Unidade",                   type: "select", valor: m.unidade, options: [{value:"BRL",label:"R$ (BRL)"},{value:"pct",label:"% (porcentagem)"},{value:"bool",label:"Sim/Não (binário)"}], required: true }
      ],
      onSubmit: function (v, done) {
        var escala = escalaEditorLer();
        var payload = {
          descricao: v.descricao,
          valor_meta: Number(v.valor_meta),
          peso_pct: Number(v.peso_pct),
          unidade: v.unidade,
          escala_json: escala
        };
        client.from("bonif_metas_empresa").update(payload).eq("id", m.id).then(function (r) {
          if (r.error) { done(r.error.message); return; }
          carregarConfigBonusSeNecessario();
          bonCarregado = false;  // invalida dashboard
          done(null);
        });
      }
    });
    // Injeta o editor de escala depois do form
    setTimeout(function () {
      var modalFields = document.getElementById("modal-fields");
      var holder = document.createElement("div");
      holder.innerHTML = escalaEditorHtml(m.escala_json);
      modalFields.appendChild(holder.firstChild);
      ligarBotoesEscala();
    }, 0);
  }

  function abrirModalMetaProf(m) {
    var nome = BCFG_PROF_LABELS[m.meta_chave] || m.meta_chave;
    abrirModal({
      titulo: "Editar — " + nome,
      fields: [
        { name: "descricao", label: "Descrição",          type: "text",   valor: m.descricao },
        { name: "peso_pct",  label: "Peso (%)",           type: "number", valor: m.peso_pct, required: true },
        { name: "unidade",   label: "Unidade",            type: "select", valor: m.unidade, options: ["bool","faltas_qtd","atrasos_qtd","nota_1a5","penalidade"], required: true },
        { name: "ativa",     label: "Ativa?",             type: "select", valor: m.ativa === false ? "false" : "true", options: [{value:"true",label:"Sim"},{value:"false",label:"Não"}] }
      ],
      onSubmit: function (v, done) {
        var escala = escalaEditorLer();
        var payload = {
          descricao: v.descricao,
          peso_pct: Number(v.peso_pct),
          unidade: v.unidade,
          ativa: v.ativa === "true",
          escala_json: escala
        };
        client.from("bonif_metas_profissional").update(payload).eq("id", m.id).then(function (r) {
          if (r.error) { done(r.error.message); return; }
          carregarConfigBonusSeNecessario();
          bonCarregado = false;
          done(null);
        });
      }
    });
    setTimeout(function () {
      var modalFields = document.getElementById("modal-fields");
      var holder = document.createElement("div");
      holder.innerHTML = escalaEditorHtml(m.escala_json);
      modalFields.appendChild(holder.firstChild);
      ligarBotoesEscala();
    }, 0);
  }

  function abrirModalMetaArea(m) {
    m = m || {};
    var editar = !!m.id;
    var opcoesOrg = (organogramaLista || []).slice().sort(function (a, b) {
      return buildOrgPath(a.id).localeCompare(buildOrgPath(b.id));
    }).map(function (n) { return { value: n.id, label: buildOrgPath(n.id) }; });

    abrirModal({
      titulo: editar ? "Editar meta de área" : "Nova meta de área",
      fields: [
        { name: "organograma_id", label: "Área (organograma)", type: "select", valor: m.organograma_id || "", options: opcoesOrg, required: true },
        { name: "descricao",      label: "Descrição da meta",  type: "text",   valor: m.descricao, required: true },
        { name: "indicador_descritivo", label: "Indicador (como medir)", type: "text", valor: m.indicador_descritivo },
        { name: "peso_pct",       label: "Peso (%)",           type: "number", valor: m.peso_pct || 30, required: true }
      ],
      onSubmit: function (v, done) {
        var escala = escalaEditorLer();
        var payload = {
          periodo_id: bcfgPeriodoSel,
          organograma_id: Number(v.organograma_id),
          descricao: v.descricao,
          indicador_descritivo: v.indicador_descritivo,
          peso_pct: Number(v.peso_pct),
          escala_json: escala
        };
        var q = editar
          ? client.from("bonif_metas_area").update(payload).eq("id", m.id)
          : client.from("bonif_metas_area").insert(payload);
        q.then(function (r) {
          if (r.error) { done(r.error.message); return; }
          carregarConfigBonusSeNecessario();
          bonCarregado = false;
          done(null);
        });
      }
    });
    setTimeout(function () {
      var modalFields = document.getElementById("modal-fields");
      var holder = document.createElement("div");
      holder.innerHTML = escalaEditorHtml(m.escala_json);
      modalFields.appendChild(holder.firstChild);
      ligarBotoesEscala();
    }, 0);
  }


  // =========================================================================
  // 36. AUDITORIA — visualização de logs (Configuração > Auditoria)
  // =========================================================================
  var audLista = [];
  var audCarregado = false;

  function carregarAuditoriaSeNecessario() {
    document.getElementById("aud-tbody").innerHTML = '<tr><td colspan="6" class="tbl-vazio">Carregando…</td></tr>';
    // Limita a últimos 1000 eventos para não estourar
    client.from("auditoria")
      .select("id, tabela, registro_id, acao, usuario_nome, criado_em")
      .order("id", { ascending: false })
      .limit(1000)
      .then(function (r) {
        if (r.error) {
          document.getElementById("aud-tbody").innerHTML = '<tr><td colspan="6" class="tbl-vazio erro">Erro: ' + r.error.message + '</td></tr>';
          return;
        }
        audLista = r.data || [];
        audCarregado = true;
        // Popular dropdown de tabelas
        var sel = document.getElementById("aud-tabela");
        if (sel) {
          var tabelas = {};
          audLista.forEach(function (e) { if (e.tabela) tabelas[e.tabela] = true; });
          var ks = Object.keys(tabelas).sort();
          var atual = sel.value;
          sel.innerHTML = '<option value="">Todas as tabelas</option>' +
            ks.map(function (t) { return '<option value="' + escHtml(t) + '">' + escHtml(t) + '</option>'; }).join("");
          if (atual) sel.value = atual;
        }
        renderAuditoria();
      });
  }

  function renderAuditoria() {
    if (!audCarregado) return;
    var tbody = document.getElementById("aud-tbody");
    var busca   = (document.getElementById("aud-busca").value || "").trim().toLowerCase();
    var tabela  = document.getElementById("aud-tabela").value;
    var tipo    = document.getElementById("aud-tipo").value;
    var mes     = document.getElementById("aud-mes").value;

    var filtrados = audLista.filter(function (e) {
      if (tabela && e.tabela !== tabela) return false;
      if (tipo && e.acao !== tipo) return false;
      if (mes && String(e.criado_em || "").slice(0,7) !== mes) return false;
      return matchBusca(busca, [e.tabela, e.registro_id, e.usuario_nome, e.acao]);
    });

    valText(document.getElementById("aud-m-qtd"), fmtInt(filtrados.length));
    valText(document.getElementById("aud-m-tot"), fmtInt(audLista.length));
    valText(document.getElementById("aud-lbl"), filtrados.length + " de " + audLista.length + " (limit 1000)");

    function badgeAcao(acao) {
      var classe = acao === "INSERT" ? "solta" : (acao === "DELETE" ? "outras" : "assist");
      return '<span class="badge-tipo ' + classe + '">' + escHtml(acao) + '</span>';
    }
    function fmtTs(iso) {
      if (!iso) return "—";
      var s = String(iso);
      var d = s.slice(0,10).split("-");
      var t = s.slice(11,16);
      if (d.length !== 3) return iso;
      return d[2] + "/" + d[1] + "/" + d[0] + " " + t;
    }

    preencherTbody(tbody, filtrados.slice(0, 500).map(function (e) {
      return '<tr>' +
        '<td class="mono">' + fmtTs(e.criado_em) + '</td>' +
        '<td class="mono">' + escHtml(e.tabela) + '</td>' +
        '<td>' + badgeAcao(e.acao) + '</td>' +
        '<td class="mono">' + escHtml(e.registro_id || "—") + '</td>' +
        '<td>' + escHtml(e.usuario_nome || "—") + '</td>' +
        '<td><button class="btn-limpar" data-aud-detail="' + e.id + '">Detalhe</button></td>' +
      '</tr>';
    }), 6, "Nenhum evento.");

    tbody.querySelectorAll("[data-aud-detail]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.getAttribute("data-aud-detail"));
        client.from("auditoria").select("*").eq("id", id).single().then(function (r) {
          if (r.error) { alert("Erro: " + r.error.message); return; }
          var d = r.data;
          var antes  = d.dados_antes  ? JSON.stringify(d.dados_antes,  null, 2) : "(sem)";
          var depois = d.dados_depois ? JSON.stringify(d.dados_depois, null, 2) : "(sem)";
          alert(
            "Tabela: " + d.tabela + "\nAção: " + d.acao + "\nRegistro: " + (d.registro_id || "—") +
            "\nUsuário: " + (d.usuario_nome || "—") + "\nQuando: " + d.criado_em +
            "\n\n=== Antes ===\n" + antes + "\n\n=== Depois ===\n" + depois
          );
        });
      });
    });
  }

  // =========================================================================
  // 37. EXPORT CFOP — Configuração > CFOP > botão Exportar
  // =========================================================================
  function exportarCfopXlsx() {
    if (typeof window.XLSX === "undefined") {
      alert("Biblioteca XLSX ainda carregando. Tente em alguns segundos.");
      return;
    }
    if (!cfopCarregado || !cfopLista.length) {
      alert("Carregue a tabela CFOP primeiro (clique no menu Configuração > CFOP).");
      return;
    }
    // Separar em duas abas: Aplicáveis × Não aplicáveis
    var apl = cfopLista.filter(function (c) { return c.aplicavel; });
    var nao = cfopLista.filter(function (c) { return !c.aplicavel; });
    function toRows(arr) {
      return arr.map(function (c) {
        return {
          "CFOP":           c.cfop,
          "CFOP formatado": c.cfop_formatado || "",
          "Grupo":          c.grupo || "",
          "Descrição":      c.descricao || "",
          "Vigência":       c.vigencia || ""
        };
      });
    }
    var wb = window.XLSX.utils.book_new();
    var w1 = window.XLSX.utils.json_to_sheet(toRows(apl));
    var w2 = window.XLSX.utils.json_to_sheet(toRows(nao));
    window.XLSX.utils.book_append_sheet(wb, w1, "Aplicaveis");
    window.XLSX.utils.book_append_sheet(wb, w2, "Nao aplicaveis");
    var nome = "cfop-aplicaveis-vs-nao-" + new Date().toISOString().slice(0,10) + ".xlsx";
    window.XLSX.writeFile(wb, nome);
  }


  // =========================================================================
  // 38. BÔNUS INDIVIDUAL — Esfera Profissional por funcionário
  // =========================================================================

  function carregarBonusIndividualSeNecessario() {
    // Reusa os dados já carregados pelo programa_bonus se possível;
    // se não, dispara as cargas necessárias.
    if (!bonCarregado) carregarProgramaBonusSeNecessario();
    if (!funcionariosCarregado) carregarFuncionariosSeNecessario();
    var iv = setInterval(function () {
      if (bonCarregado && funcionariosCarregado) {
        clearInterval(iv);
        // Popula dropdown de período
        var sel = document.getElementById("bind-periodo");
        if (sel) {
          sel.innerHTML = bonPeriodos.map(function (p) {
            return '<option value="' + p.id + '">' + escHtml(p.nome) + '</option>';
          }).join("");
          var ativo = bonPeriodos.find(function (p) { return p.status === "ativo"; });
          var idAtivo = ativo ? ativo.id : (bonPeriodos[0] && bonPeriodos[0].id) || null;
          if (idAtivo) sel.value = String(idAtivo);
          sel.onchange = renderBonusIndividual;
        }
        renderBonusIndividual();
      }
    }, 150);

    // Liga busca (idempotente)
    var busca = document.getElementById("bind-busca");
    if (busca && !busca.dataset.bound) {
      busca.dataset.bound = "1";
      busca.addEventListener("input", renderBonusIndividual);
    }
  }

  function renderBonusIndividual() {
    var sel = document.getElementById("bind-periodo");
    var periodoSel = sel ? Number(sel.value) : null;
    var periodo = bonPeriodos.find(function (p) { return p.id === periodoSel; });

    valText(document.getElementById("bind-lbl"),
      periodo ? (periodo.nome + " · " + fmtData(periodo.inicio_em) + " a " + fmtData(periodo.fim_em)) : "—");

    var ativos = (funcionariosLista || []).filter(function (f) { return f.status === "ATIVO"; });
    valText(document.getElementById("bind-m-ativos"), fmtInt(ativos.length));
    valText(document.getElementById("bind-m-media"), "—");
    valText(document.getElementById("bind-m-dados"), "Aguardando importação");

    var busca = (document.getElementById("bind-busca").value || "").trim().toLowerCase();
    var filtrados = ativos.filter(function (f) {
      return matchBusca(busca, [f.nome, f.cargo, f.cpf]);
    });
    valText(document.getElementById("bind-tbl-lbl"), filtrados.length + " de " + ativos.length);

    var tbody = document.getElementById("bind-tbody");
    if (!filtrados.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="tbl-vazio">Nenhum funcionário ativo no filtro.</td></tr>';
      return;
    }
    // Placeholder com colunas vazias — preenchemos quando importarmos frequencia/conduta/avaliações
    tbody.innerHTML = filtrados.slice(0, 100).map(function (f) {
      return '<tr class="linha-clicavel" data-fid="' + f.id + '" title="Ver detalhamento">' +
        '<td>' + escHtml(f.nome) + '</td>' +
        '<td class="num">—</td>' +
        '<td class="num">—</td>' +
        '<td class="num">—</td>' +
        '<td class="num">—</td>' +
        '<td class="num">—</td>' +
        '<td class="num">— / 40%</td>' +
      '</tr>';
    }).join("") + (filtrados.length > 100
      ? '<tr><td colspan="7" class="tbl-vazio">… exibindo 100 de ' + filtrados.length + '. Cálculo individual ativa quando importarmos frequencia_mensal, medidas_disciplinares e avaliacao_desempenho.</td></tr>'
      : "");

  }

  // ----- Detalhamento por funcionário (drill-down) -----
  function abrirDetalheBonusIndividual(funcionarioId) {
    var f = (funcionariosLista || []).filter(function (x) { return x.id === funcionarioId; })[0];
    if (!f) return;
    var sel = document.getElementById("bind-periodo");
    var periodoSel = sel ? Number(sel.value) : null;
    var periodo = bonPeriodos.find(function (p) { return p.id === periodoSel; });

    valText(document.getElementById("bind-det-nome"), f.nome || "—");
    var orgPath = (typeof buildOrgPath === "function" && f.organograma_id) ? buildOrgPath(f.organograma_id) : "";
    var sub = [f.cargo || "—", orgPath || "Sem posição no organograma",
               periodo ? (periodo.nome + " · " + fmtData(periodo.inicio_em) + " a " + fmtData(periodo.fim_em)) : "Sem período"]
      .filter(Boolean).join(" · ");
    valText(document.getElementById("bind-det-sub"), sub);

    valText(document.getElementById("bind-det-total"), "— / 40%");
    valText(document.getElementById("bind-det-dados"), "Aguardando importação");

    // Renderiza 5 cards (Conduta, Faltas just., Atrasos, Performance, Penalidade)
    var cards = [
      {
        titulo: "Conduta", peso: "12,5%",
        regra: "Sem advertência ou medida disciplinar no semestre = 100% do peso. Cada ocorrência registrada em medidas_disciplinares deduz proporcionalmente.",
        fonte: "RH > medidas_disciplinares",
        valor: "—", status: "aguardando"
      },
      {
        titulo: "Faltas justificadas", peso: "6,25%",
        regra: "Até 1/mês = 100%. Acima disso, deduz pela escala configurada em RH > Bônus — Configuração > Profissional.",
        fonte: "RH > frequencia_mensal",
        valor: "—", status: "aguardando"
      },
      {
        titulo: "Atrasos", peso: "6,25%",
        regra: "Até 2/mês = 100% (= 12 no semestre). 13º atraso em diante deduz pela escala configurada.",
        fonte: "RH > frequencia_mensal",
        valor: "—", status: "aguardando"
      },
      {
        titulo: "Performance", peso: "15%",
        regra: "Avaliação semestral nota 1 a 5. Conversão pela escala configurada (5 = 100%, 4 = 75%, 3 = 50%, abaixo = 0% por padrão).",
        fonte: "RH > avaliacao_desempenho",
        valor: "—", status: "aguardando"
      },
      {
        titulo: "Penalidade", peso: "−12,5%",
        regra: "Cada falta ou atraso SEM justificativa subtrai 12,5% do total. Pode levar o resultado a zero, não a negativo.",
        fonte: "RH > frequencia_mensal (faltas_nao_just, atrasos)",
        valor: "—", status: "aguardando"
      }
    ];
    var cont = document.getElementById("bind-det-cards");
    cont.innerHTML = cards.map(function (c) {
      return '<div class="bon-card">' +
        '<div class="bon-card-titulo">' + escHtml(c.titulo) + ' <span class="muted">(' + escHtml(c.peso) + ')</span></div>' +
        '<div class="bon-card-valor">' + escHtml(c.valor) + '</div>' +
        '<div class="bon-card-bar"><div class="bon-card-bar-fill" style="width:0%"></div></div>' +
        '<div class="bon-card-regra">' + escHtml(c.regra) + '</div>' +
        '<div class="bon-card-fonte"><strong>Fonte:</strong> ' + escHtml(c.fonte) + ' <span class="muted-tag">aguardando importação</span></div>' +
      '</div>';
    }).join("");

    showPage("bonus_indiv_detalhe");
  }



  // =========================================================================
  // CAIXA — Saldo Mensal (Entrega 9)
  // =========================================================================

  var caixaSaldoLista = [];
  var caixaSaldoCarregado = false;
  var caixaSaldoCarregando = false;

  function carregarCaixaSaldoSeNecessario() {
    if (caixaSaldoCarregado || caixaSaldoCarregando) {
      if (caixaSaldoCarregado) renderCaixaSaldo();
      return;
    }
    caixaSaldoCarregando = true;
    var tbody = document.getElementById("cxs-tbody");
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="tbl-vazio">Carregando…</td></tr>';

    client.from("caixa_saldo_mensal")
      .select("mes_ref, saldo_final, observacoes, atualizado_em")
      .order("mes_ref", { ascending: false })
      .then(function (r) {
        caixaSaldoCarregando = false;
        if (r.error) {
          if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="tbl-vazio erro">Erro: ' + escHtml(r.error.message) + '</td></tr>';
          return;
        }
        caixaSaldoLista = r.data || [];
        caixaSaldoCarregado = true;
        renderCaixaSaldo();
      });

    var busca = document.getElementById("cxs-busca");
    if (busca && !busca.dataset.bound) {
      busca.dataset.bound = "1";
      busca.addEventListener("input", renderCaixaSaldo);
    }
    var btnLimpar = document.getElementById("cxs-btn-limpar");
    if (btnLimpar && !btnLimpar.dataset.bound) {
      btnLimpar.dataset.bound = "1";
      btnLimpar.addEventListener("click", function () {
        var b = document.getElementById("cxs-busca"); if (b) b.value = "";
        renderCaixaSaldo();
      });
    }
  }

  function renderCaixaSaldo() {
    var tbody = document.getElementById("cxs-tbody");
    if (!tbody) return;
    var busca = ((document.getElementById("cxs-busca") || {}).value || "").trim().toLowerCase();
    var filtrados = caixaSaldoLista.filter(function (r) {
      if (!busca) return true;
      return String(r.mes_ref).toLowerCase().indexOf(busca) !== -1;
    });

    valText(document.getElementById("cxs-m-qtd"), fmtInt(caixaSaldoLista.length));
    var ult = caixaSaldoLista[0];
    valText(document.getElementById("cxs-m-ult"), ult ? fmtBRL(ult.saldo_final) : "—");
    valText(document.getElementById("cxs-m-ult-mes"), ult ? mesRef(ult.mes_ref) : "—");
    var ultimos12 = caixaSaldoLista.slice(0, 12);
    var positivos = ultimos12.filter(function (r) { return Number(r.saldo_final) > 0; }).length;
    valText(document.getElementById("cxs-m-pos"), positivos + " / " + Math.min(12, caixaSaldoLista.length));
    valText(document.getElementById("cxs-lbl"), filtrados.length + " de " + caixaSaldoLista.length);

    if (!filtrados.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="tbl-vazio">Nenhum mês cadastrado. Importe via Importar > Saldo de Caixa Mensal.</td></tr>';
      return;
    }
    tbody.innerHTML = filtrados.map(function (r) {
      var classe = Number(r.saldo_final) >= 0 ? "" : "neg";
      return '<tr>' +
        '<td>' + escHtml(mesRef(r.mes_ref)) + '</td>' +
        '<td class="num ' + classe + '">' + fmtBRL(r.saldo_final) + '</td>' +
        '<td>' + escHtml(r.observacoes || "") + '</td>' +
        '<td>' + escHtml(fmtData(r.atualizado_em)) + '</td>' +
      '</tr>';
    }).join("");
  }

  function mesRef(d) {
    if (!d) return "—";
    var s = String(d).slice(0, 7); // YYYY-MM
    var partes = s.split("-");
    if (partes.length < 2) return s;
    var nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    var idx = parseInt(partes[1], 10) - 1;
    if (idx < 0 || idx > 11) return s;
    return nomes[idx] + "/" + partes[0];
  }

  // =========================================================================
  // CAIXA — Compromissos Financeiros (Entrega 9)
  // =========================================================================

  var compromissosLista = [];
  var compromissosCarregado = false;
  var compromissosCarregando = false;

  function carregarCompromissosSeNecessario() {
    if (compromissosCarregado || compromissosCarregando) {
      if (compromissosCarregado) renderCompromissos();
      return;
    }
    compromissosCarregando = true;
    var tbody = document.getElementById("cmp-tbody");
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="tbl-vazio">Carregando…</td></tr>';

    client.from("compromissos_financeiros")
      .select("id, vencimento, descricao, valor, tipo, pago_em, observacao")
      .order("vencimento", { ascending: true })
      .then(function (r) {
        compromissosCarregando = false;
        if (r.error) {
          if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="tbl-vazio erro">Erro: ' + escHtml(r.error.message) + '</td></tr>';
          return;
        }
        compromissosLista = r.data || [];
        compromissosCarregado = true;
        renderCompromissos();
      });

    var busca = document.getElementById("cmp-busca");
    if (busca && !busca.dataset.bound) {
      busca.dataset.bound = "1";
      busca.addEventListener("input", renderCompromissos);
    }
    var selTipo = document.getElementById("cmp-tipo");
    if (selTipo && !selTipo.dataset.bound) {
      selTipo.dataset.bound = "1";
      selTipo.addEventListener("change", renderCompromissos);
    }
    var selStatus = document.getElementById("cmp-status");
    if (selStatus && !selStatus.dataset.bound) {
      selStatus.dataset.bound = "1";
      selStatus.addEventListener("change", renderCompromissos);
    }
    var btnLimpar = document.getElementById("cmp-btn-limpar");
    if (btnLimpar && !btnLimpar.dataset.bound) {
      btnLimpar.dataset.bound = "1";
      btnLimpar.addEventListener("click", function () {
        var b = document.getElementById("cmp-busca"); if (b) b.value = "";
        var t = document.getElementById("cmp-tipo"); if (t) t.value = "";
        var s = document.getElementById("cmp-status"); if (s) s.value = "";
        renderCompromissos();
      });
    }
  }

  function renderCompromissos() {
    var tbody = document.getElementById("cmp-tbody");
    if (!tbody) return;
    var busca  = ((document.getElementById("cmp-busca")  || {}).value || "").trim().toLowerCase();
    var tipo   = ((document.getElementById("cmp-tipo")   || {}).value || "").trim();
    var status = ((document.getElementById("cmp-status") || {}).value || "").trim();
    var hojeIso = new Date().toISOString().slice(0, 10);

    var filtrados = compromissosLista.filter(function (r) {
      if (busca && (r.descricao || "").toLowerCase().indexOf(busca) === -1) return false;
      if (tipo && r.tipo !== tipo) return false;
      if (status === "pendente" && r.pago_em) return false;
      if (status === "pago" && !r.pago_em) return false;
      if (status === "vencido" && (r.pago_em || r.vencimento >= hojeIso)) return false;
      return true;
    });

    var pendentes = compromissosLista.filter(function (r) { return !r.pago_em && r.vencimento >= hojeIso; });
    var vencidos  = compromissosLista.filter(function (r) { return !r.pago_em && r.vencimento <  hojeIso; });
    // Próximos 6 meses (aproximação: 183 dias)
    var d6 = new Date(); d6.setDate(d6.getDate() + 183);
    var d6iso = d6.toISOString().slice(0, 10);
    var proximos6 = compromissosLista.filter(function (r) {
      return !r.pago_em && r.vencimento >= hojeIso && r.vencimento <= d6iso;
    });
    var totalProx6 = proximos6.reduce(function (acc, r) { return acc + Number(r.valor || 0); }, 0);

    valText(document.getElementById("cmp-m-pen"),  fmtInt(pendentes.length));
    valText(document.getElementById("cmp-m-tot6"), fmtBRL(totalProx6));
    valText(document.getElementById("cmp-m-venc"), fmtInt(vencidos.length));
    valText(document.getElementById("cmp-lbl"), filtrados.length + " de " + compromissosLista.length);

    if (!filtrados.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="tbl-vazio">Nenhum compromisso bate com os filtros. Importe via Importar > Compromissos Financeiros.</td></tr>';
      return;
    }
    tbody.innerHTML = filtrados.map(function (r) {
      var st, classe;
      if (r.pago_em) { st = "Pago"; classe = "tag tag-ok"; }
      else if (r.vencimento < hojeIso) { st = "Vencido"; classe = "tag tag-danger"; }
      else { st = "Pendente"; classe = "tag tag-warn"; }
      return '<tr>' +
        '<td>' + escHtml(fmtData(r.vencimento)) + '</td>' +
        '<td>' + escHtml(r.descricao) + '</td>' +
        '<td><span class="badge-tipo">' + escHtml(r.tipo) + '</span></td>' +
        '<td class="num">' + fmtBRL(r.valor) + '</td>' +
        '<td><span class="' + classe + '">' + st + '</span></td>' +
      '</tr>';
    }).join("");
  }


  // =========================================================================
  // BOOT FINAL — delegação global de cliques em botões estáticos.
  // Garante que .config-card[data-subpage], [data-goto] e [data-limpar]
  // SEMPRE funcionem, mesmo se ativarPaginaOrcamentos() falhar por qualquer
  // motivo (elemento ausente, erro no fluxo de auth, etc).
  // Bug histórico: listeners eram registrados dentro de ativarPaginaOrcamentos;
  // se essa função abortasse antes da linha 503, os botões ficavam mortos
  // sem nenhum erro visível no console.
  // =========================================================================
  document.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var card = t.closest(".config-card[data-subpage]");
    if (card) {
      var alvo = card.getAttribute("data-subpage");
      if (alvo && typeof showPage === "function") { showPage(alvo); return; }
    }
    var gotoBtn = t.closest("[data-goto]");
    if (gotoBtn) {
      var pg = gotoBtn.getAttribute("data-goto");
      if (pg && typeof showPage === "function") { showPage(pg); return; }
    }
    var limparBtn = t.closest("[data-limpar]");
    if (limparBtn) {
      var tabela = limparBtn.getAttribute("data-limpar");
      if (tabela && typeof limparTabela === "function") { limparTabela(tabela); return; }
    }
    // Drill-down de tabelas — qualquer <tr class="linha-clicavel" data-fid="...">
    var trBonus = t.closest("tr.linha-clicavel[data-fid]");
    if (trBonus) {
      var fid = Number(trBonus.getAttribute("data-fid"));
      if (fid && typeof abrirDetalheBonusIndividual === "function") {
        abrirDetalheBonusIndividual(fid);
        return;
      }
    }
  });

})();
