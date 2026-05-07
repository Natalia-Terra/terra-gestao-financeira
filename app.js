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
      // M19 — carrega permissões master e aplica restrições na UI
      if (typeof carregarPermissoesMaster === "function") carregarPermissoesMaster();
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
    if (pageId === "cfg_perfis_tipos") carregarPerfisTiposSeNecessario();
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
    if (pageId === "apr_faturamento") carregarApropriacaoFaturamentoSeNecessario();
    if (pageId === "cust_direto_via_os") carregarCustoDiretoViaOsSeNecessario();
    if (pageId === "cust_direto_lanc")   carregarCustoDiretoLancSeNecessario();
    if (pageId === "cust_indireto")      carregarCustoIndiretoSeNecessario();
    if (pageId === "cust_area")          carregarCustoAreaSeNecessario();
    if (pageId === "apr_excluidas")   carregarOsExcluidasSeNecessario();
    if (pageId === "cfg_centros")     carregarCentrosSeNecessario();
    if (pageId === "cfg_rubricas")    carregarRubricasSeNecessario();
    if (pageId === "caixa_compromissos") carregarCompromissosSeNecessario();
    if (pageId === "fluxo_contas")       carregarContasBancariasSeNecessario();
    if (pageId === "fluxo_saldos")       carregarSaldosContasSeNecessario();
    if (pageId === "fluxo_visao")        carregarFluxoVisaoSeNecessario();
    if (pageId === "entradas_outras")    carregarEntradasOutrasSeNecessario();
    if (pageId === "saidas_outras")      carregarSaidasOutrasSeNecessario();
    // M18 Onda 3.1 — telas novas
    if (pageId === "saldo_reconhecer")            carregarSaldoReconhecerSeNecessario();
    if (pageId === "dashboard_orcamentos_view")   carregarDashboardOrcamentosTeleSeNecessario();
    // M18 Onda 3.2 — Lançamentos de Caixa
    if (pageId === "movimentos_caixa")            carregarMovimentosCaixaSeNecessario();
    // M19 — Reset (master only)
    if (pageId === "cfg_reset")                   carregarResetSeNecessario();
    // M19 Fase 1 — Medidas Disciplinares
    if (pageId === "medidas_disciplinares")       carregarMedidasDisciplinaresSeNecessario();
    // M19 Fase 2 — Avaliação de Desempenho
    if (pageId === "avaliacao_desempenho")        carregarAvalDesempSeNecessario();
    // M18 Onda 3.3 — Dashboard de Faturamento rico
    if (pageId === "dashboard_faturamento")       carregarDashFatRico();
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
    var ids = ["busca", "mes", "ano", "tipo", "natureza", "status", "filtro", "grupo", "nivel", "livro", "cc", "org", "dre"];
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
      .select("id, data, orcamento, nome, tipo, natureza, valor, nota_fiscal, os, item, custo, plano_contas_id")
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
        '<tr class="linha-clicavel" data-orc="' + escHtml(r.orcamento) + '" title="Ver detalhe">' +
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
        '<tr class="linha-clicavel" data-orc="' + escHtml(r.orcamento) + '" title="Ver detalhe">' +
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
      return '<tr class="linha-clicavel" data-mvid="' + escHtml(m.id) + '" title="Ver detalhe da NF">' +
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
    if (!pcCarregado)          carregarPlanoContasSeNecessario();
    if (!orcamentosCarregados) carregarOrcamentosSeNecessario();
    if (!rcCarregado && !rcCarregando) carregarConsolidadoSeNecessario();
    var iv = setInterval(function () {
      if (rcCarregado && pcCarregado && orcamentosCarregados) {
        clearInterval(iv);
        renderDespesas();
      }
    }, 150);
    var sel = document.getElementById("desp-fonte");
    if (sel && !sel.dataset.bound) {
      sel.dataset.bound = "1";
      sel.addEventListener("change", renderDespesas);
    }
  }

  function renderDespesas() {
    var tbody = document.getElementById("desp-tbody");
    var thead = document.getElementById("desp-thead");
    var busca = (document.getElementById("desp-busca").value || "").trim().toLowerCase();
    var ano   = document.getElementById("desp-ano").value;
    var mes   = document.getElementById("desp-mes").value;
    var fonte = (document.getElementById("desp-fonte") || {}).value || "rc";
    var nomeMes = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

    if (fonte === "rc") {
      thead.innerHTML = '<tr><th>Ano</th><th>Mês</th><th>Subcategoria</th><th class="num">Valor</th></tr>';
      var filtrados = (rcLista || []).filter(function (r) {
        if (r.categoria !== "custo") return false;
        if (ano && String(r.ano) !== ano) return false;
        if (mes && String(r.mes) !== mes) return false;
        return matchBusca(busca, [r.subcategoria]);
      });
      var soma = 0;
      filtrados.forEach(function (r) { soma += Number(r.valor || 0); });
      valText(document.getElementById("desp-m-qtd"), fmtInt(filtrados.length));
      valText(document.getElementById("desp-m-valor"), fmtBRL(soma));
      valText(document.getElementById("desp-lbl"), filtrados.length + " linhas (rc agregado)");
      filtrados.sort(function (a, b) {
        if (a.ano !== b.ano) return b.ano - a.ano;
        return b.mes - a.mes;
      });
      preencherTbody(tbody, filtrados.map(function (r) {
        var key = "rc|" + r.ano + "|" + r.mes + "|" + (r.subcategoria || "");
        return '<tr class="linha-clicavel" data-desp-key="' + escHtml(key) + '" title="Ver detalhe">' +
          '<td>' + r.ano + '</td>' +
          '<td>' + nomeMes[r.mes - 1] + '</td>' +
          '<td>' + escHtml(r.subcategoria || "—") + '</td>' +
          '<td class="num">' + fmtBRL(r.valor) + '</td>' +
        '</tr>';
      }), 4);
      return;
    }

    // Fonte movimentos: agrega movimentos com plano_contas.tipo_custo='despesa' por mês × DRE
    thead.innerHTML = '<tr><th>Ano</th><th>Mês</th><th>DRE (Classificação)</th><th class="num">Qtd</th><th class="num">Valor</th></tr>';
    var contaPorId = {};
    (planoContas || []).forEach(function (p) { contaPorId[p.id] = p; });

    var agregado = {};
    var totalLanc = 0;
    (movimentosCompletos || []).forEach(function (m) {
      if (!m.plano_contas_id) return;
      var conta = contaPorId[m.plano_contas_id];
      if (!conta || conta.tipo_custo !== "despesa") return;
      var d = String(m.data || "").slice(0, 10);
      if (d.length < 7) return;
      var a = Number(d.slice(0, 4));
      var ms = Number(d.slice(5, 7));
      if (ano && String(a) !== ano) return;
      if (mes && String(ms) !== mes) return;
      var dre = conta.dre || "—";
      if (busca && !matchBusca(busca, [dre, conta.descritivo])) return;
      var key = a + "|" + ms + "|" + dre;
      if (!agregado[key]) agregado[key] = { ano: a, mes: ms, dre: dre, qtd: 0, valor: 0 };
      agregado[key].qtd += 1;
      agregado[key].valor += Number(m.valor || m.custo || 0);
      totalLanc += 1;
    });
    var lista = Object.values(agregado).sort(function (a, b) {
      if (a.ano !== b.ano) return b.ano - a.ano;
      if (a.mes !== b.mes) return b.mes - a.mes;
      return String(a.dre).localeCompare(String(b.dre));
    });
    var soma2 = lista.reduce(function (s, r) { return s + r.valor; }, 0);
    valText(document.getElementById("desp-m-qtd"), fmtInt(totalLanc));
    valText(document.getElementById("desp-m-valor"), fmtBRL(soma2));
    valText(document.getElementById("desp-lbl"), lista.length + " grupos (DRE × mês)");

    if (!lista.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="tbl-vazio">Nenhum movimento classificado como Despesa no filtro. Importe planilha de movimentos com coluna conta para classificar.</td></tr>';
      return;
    }
    tbody.innerHTML = lista.map(function (r) {
      var key = "mov|" + r.ano + "|" + r.mes + "|" + r.dre;
      return '<tr class="linha-clicavel" data-desp-key="' + escHtml(key) + '" title="Ver lançamentos individuais">' +
        '<td>' + r.ano + '</td>' +
        '<td>' + nomeMes[r.mes - 1] + '</td>' +
        '<td>' + escHtml(r.dre) + '</td>' +
        '<td class="num">' + fmtInt(r.qtd) + '</td>' +
        '<td class="num">' + fmtBRL(r.valor) + '</td>' +
      '</tr>';
    }).join("");
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
      return '<tr class="linha-clicavel" data-mvid="' + escHtml(m.id) + '" title="Ver detalhe do lançamento">' +
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
  var pcCarregando = false;

  function carregarPlanoContasSeNecessario() {
    if (pcCarregado) { renderPlanoContas(); return; }
    if (pcCarregando) return;          // evita fetch+populate em paralelo
    pcCarregando = true;
    document.getElementById("pc-tbody").innerHTML = '<tr><td colspan="7" class="tbl-vazio">Carregando 510 contas…</td></tr>';
    client.from("plano_contas").select("*").order("seq", { ascending: true }).then(function (r) {
      pcCarregando = false;
      if (r.error) {
        document.getElementById("pc-tbody").innerHTML = '<tr><td colspan="7" class="tbl-vazio erro">Erro: ' + r.error.message + '</td></tr>';
        return;
      }
      planoContas = r.data || [];
      pcCarregado = true;

      // Popular dropdown de grupos (limpa antes pra não duplicar em re-fetches)
      var grupos = {};
      planoContas.forEach(function (p) { if (p.grupo) grupos[p.grupo] = true; });
      var sel = document.getElementById("pc-grupo");
      sel.innerHTML = '<option value="">Todos os grupos</option>';
      Object.keys(grupos).sort().forEach(function (g) {
        var opt = document.createElement("option");
        opt.value = g; opt.textContent = g;
        sel.appendChild(opt);
      });

      // Popular dropdown de DRE (Classificação DRE) — limpa antes
      var dres = {};
      planoContas.forEach(function (p) { if (p.dre) dres[p.dre] = true; });
      var selDre = document.getElementById("pc-dre");
      if (selDre) {
        selDre.innerHTML = '<option value="">Classificação DRE</option>';
        Object.keys(dres).sort().forEach(function (d) {
          var opt = document.createElement("option");
          opt.value = d; opt.textContent = d;
          selDre.appendChild(opt);
        });
      }

      renderPlanoContas();
    });
  }

  function renderPlanoContas() {
    var tbody = document.getElementById("pc-tbody");
    var busca = (document.getElementById("pc-busca").value || "").trim().toLowerCase();
    var grupo = document.getElementById("pc-grupo").value;
    var nivel = document.getElementById("pc-nivel").value;

    var dre = (document.getElementById("pc-dre")||{}).value || "";
    var filtrados = planoContas.filter(function (p) {
      if (grupo && p.grupo !== grupo) return false;
      if (nivel && String(p.nivel) !== nivel) return false;
      if (dre && p.dre !== dre) return false;
      return matchBusca(busca, [p.cod_conta, p.descritivo, p.grupo, p.numero_conta, p.dre]);
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
        // Aceita 2 fontes: Controle Faturamento (arquivo) e "Orçamento Aprovado por Parceiro no Mês"
        "data":               "data",
        "dt_aprovacao":       "data",
        "dt aprovacao":       "data",
        "data aprovacao":     "data",
        "data aprovação":     "data",
        "orcamento":          "orcamento",
        "orçamento":          "orcamento",
        "numero_do_orcamento":"orcamento",
        "numero do orcamento":"orcamento",
        "número do orçamento":"orcamento",
        "n orcamento":        "orcamento",
        "nº orçamento":       "orcamento",
        "nome":               "nome",
        "cliente":            "nome",
        "parceiros":          "parceiro",
        "parceiro":           "parceiro",
        "representante":      "parceiro",
        "venda":              "venda",
        "preco_com_ipi_subst_trib": "venda",
        "preço com ipi":      "venda",
        "valor":              "venda",
        "vl total":           "venda",
        "valor total":        "venda",
        "adiantamento":       "adiantamento",
        "recebimento":        "recebimento",
        "resultado financeiro":"resultado_financeiro",
        "a receber":          "a_receber",
        "status recebimento": "status_recebimento",
        "nota fiscal":        "nota_fiscal",
        "venda sem nf":       "venda_sem_nf",
        "a faturar":          "a_faturar",
        "status faturamento": "status_faturamento",
        // M18: campos novos
        "versao":             "versao",
        "versão":             "versao",
        "tipo de faturamento":"tipo_faturamento",
        "tipo_faturamento":   "tipo_faturamento",
        "% com nf":           "pct_com_nf",
        "pct com nf":         "pct_com_nf",
        "pct_com_nf":         "pct_com_nf"
      },
      obrigatorias: ["orcamento"],
      dicas: "Colunas aceitas: orcamento (obrigatória), data/dt_aprovacao, nome/cliente, parceiros/parceiro, venda/preco_com_ipi_subst_trib, versao, tipo_faturamento (100_NF | 0_NF | PARCIAL), pct_com_nf. Aceita planilha 'Orçamento Aprovado por Parceiro no Mês' (Aerolito) e 'Controle Faturamento' (arquivo)."
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
        "comentarios": "comentarios",
        "conta":          "plano_contas_codigo",   // resolvido no parser → plano_contas_id
        "cod conta":      "plano_contas_codigo",
        "cod_conta":      "plano_contas_codigo",
        "plano de contas":"plano_contas_codigo",
        "plano_contas":   "plano_contas_codigo",
        "conta contabil": "plano_contas_codigo",
        "conta contábil": "plano_contas_codigo"
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
    },
    contas_bancarias: {
      nomeLegivel: "Contas Bancárias",
      alvo: "contas_bancarias",
      colunas: {
        "nome":        "nome",
        "apelido":     "nome",
        "banco":       "banco",
        "tipo":        "tipo",
        "agencia":     "agencia",
        "agência":     "agencia",
        "conta":       "conta",
        "ordem":       "ordem",
        "ativa":       "ativa",
        "ativo":       "ativa",
        "observacao":  "observacao",
        "observação":  "observacao"
      },
      obrigatorias: ["nome","banco","tipo"],
      dicas: "Colunas: nome (apelido), banco (Itaú|BB|CEF|XP|...), tipo (conta_corrente|poupanca|aplicacao|outro), agencia, conta, ordem (numérico), ativa (Sim/Não/true/false), observacao."
    },
    saldos_contas: {
      nomeLegivel: "Saldos Mensais por Conta",
      alvo: "saldos_contas",
      colunas: {
        "conta":                    "conta_codigo",   // resolvido no parser → conta_id (busca por nome)
        "conta nome":               "conta_codigo",
        "nome conta":               "conta_codigo",
        "mes":                      "mes_ref",
        "mes_ref":                  "mes_ref",
        "mês":                      "mes_ref",
        "mês ref":                  "mes_ref",
        "saldo inicial":            "saldo_inicial",
        "saldo_inicial":            "saldo_inicial",
        "saldo final":              "saldo_final_realizado",
        "saldo final realizado":    "saldo_final_realizado",
        "saldo_final_realizado":    "saldo_final_realizado",
        "saldo final projetado":    "saldo_final_projetado",
        "saldo_final_projetado":    "saldo_final_projetado",
        "projetado":                "saldo_final_projetado",
        "observacao":               "observacao",
        "observação":               "observacao"
      },
      obrigatorias: ["conta_codigo","mes_ref"],
      onConflict: "conta_id,mes_ref",
      dicas: "Colunas: conta (nome cadastrado em Fluxo de Caixa > Contas Bancárias), mes_ref (YYYY-MM), saldo_inicial, saldo_final_realizado, saldo_final_projetado, observacao. UPSERT por (conta, mes)."
    },
    recebimentos_previstos: {
      nomeLegivel: "Recebimentos Previstos",
      alvo: "recebimentos_previstos",
      colunas: {
        "orcamento":     "orcamento",
        "orçamento":     "orcamento",
        "parcela":       "parcela",
        "data":          "data_prevista",
        "data prevista": "data_prevista",
        "data_prevista": "data_prevista",
        "vencimento":    "data_prevista",
        "valor":         "valor",
        "recebido em":   "recebido_em",
        "recebido_em":   "recebido_em",
        "data recebimento": "recebido_em",
        "observacao":    "observacao",
        "observação":    "observacao"
      },
      obrigatorias: ["orcamento","data_prevista","valor"],
      dicas: "Colunas: orcamento (código), parcela (numérico, default 1), data_prevista, valor, recebido_em (opcional — só preencher quando já recebido), observacao."
    },
    historico_mov_financeiro: {
      nomeLegivel: "Histórico Mov Financeiro (arquivo Excel)",
      alvo: "movimentos",
      colunas: {
        "competencia":  "competencia",
        "competência":  "competencia",
        "comp.":        "competencia",
        "id":           "id_legacy",
        "data":         "data",
        "orcamento":    "orcamento",
        "orçamento":    "orcamento",
        "nome":         "nome",
        "cliente":      "nome",
        "tipo":         "tipo",
        "natureza":     "natureza",
        "valor":        "valor",
        "nota fiscal":  "nota_fiscal",
        "os":           "os",
        "item":         "item",
        "custo":        "custo",
        "comentarios":  "comentarios",
        "comentários":  "comentarios"
      },
      obrigatorias: ["data","valor"],
      dicas: "Aba 'Mov Financeiro' do arquivo. Cabeçalho na linha 3. Colunas: Competência, Data, Orçamento, Nome, Tipo, Natureza, Valor, Nota Fiscal, OS, Item, Custo, Comentários. Importa pra tabela 'movimentos'."
    },
    historico_saldo_reconhecer: {
      nomeLegivel: "Histórico Saldo a Reconhecer (arquivo Excel)",
      alvo: "saldo_reconhecer",
      colunas: {
        "orcamento":           "orcamento",
        "orçamento":           "orcamento",
        "comp.":               "competencia",
        "comp":                "competencia",
        "competencia":         "competencia",
        "competência":         "competencia",
        "data":                "data",
        "nota fiscal":         "nota_fiscal",
        "valor":               "valor",
        "adiantamento":        "adiantamento",
        "nf emitidas":         "nf_emitidas",
        "nfs emitidas":        "nf_emitidas",
        "valor a reconhecer":  "valor_a_reconhecer",
        "a reconhecer":        "valor_a_reconhecer"
      },
      obrigatorias: ["orcamento","competencia"],
      dicas: "Aba 'Saldo a Reconhecer' do arquivo. Cabeçalho na linha 2. Colunas: Orçamento, Comp., Data, Nota Fiscal, Valor, Adiantamento, NF Emitidas, Valor a Reconhecer. Importa pra tabela 'saldo_reconhecer'."
    },
    dashboard_orcamentos: {
      // M18: importa "Dashboard de Orçamentos.xlsx" — popula 3 destinos
      nomeLegivel: "Dashboard de Orçamentos",
      alvo: "orcamento_items + os_custos_planejados + ordens_servico",
      especial: true,
      dicas: "Arquivo 'Dashboard de Orçamentos.xlsx'. Cabeçalho na linha 2. Popula: orcamento_items (1 por item), os_custos_planejados (agregado por OS — previsto vs realizado em materiais/horas/terceiros/outros) e ordens_servico (UPSERT por OS)."
    },
    pagar_receber: {
      // M18: importa "Relatório A Pagar x A Receber - Dt. Baixa.xlsx" → movimentos_caixa
      // Aplica classificação automática em RECEBER c/ planos isentos.
      // Demais linhas RECEBER ficam com natureza=null (classificar depois na tela).
      nomeLegivel: "A Pagar x A Receber (Dt. Baixa)",
      alvo: "movimentos_caixa",
      especial: true,
      dicas: "Arquivo 'Relatório A Pagar x A Receber - Dt. Baixa.xlsx'. 22 colunas. Linhas PAGAR vão direto. Linhas RECEBER com plano 33.01.003.001.001 ou 33.01.003.001.007 são marcadas automaticamente como 'Resultado Financeiro'. Outras linhas RECEBER ficam pendentes (classificar depois na tela Contas a Receber)."
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
    if (impTipo.value === "dashboard_orcamentos")  return previsualizarDashboardOrcamentos(arq);
    if (impTipo.value === "pagar_receber")         return previsualizarPagarReceber(arq);
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
            if (col === "ativa" || col === "ativo") {
              var sb = String(v).trim().toLowerCase();
              out[col] = (sb === "sim" || sb === "true" || sb === "1" || sb === "s" || sb === "yes");
              return;
            }
            if (col === "saldo_inicial" || col === "saldo_final_realizado" || col === "saldo_final_projetado" || col === "ordem" || col === "parcela") {
              var n = Number(String(v).replace(/\./g, "").replace(",", "."));
              out[col] = isNaN(n) ? null : n;
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

  var perfisTiposLista = [];
  var perfisTiposCarregado = false;
  var emailsByUserId = {};   // id → email (vem de auth.admin.listUsers via Edge ou RPC)

  function carregarUsuariosSeNecessario() {
    usuariosCarregado = false;
    var qPerfis = client.from("perfis")
      .select("id, nome, perfil, senha_temporaria, criado_em, ultimo_acesso, ativo")
      .order("nome", { ascending: true });
    var qTipos  = client.from("perfis_tipos").select("*").order("ordem");
    Promise.all([qPerfis, qTipos]).then(function (rs) {
      var rP = rs[0], rT = rs[1];
      if (rP.error) {
        document.getElementById("us-tbody").innerHTML = '<tr><td colspan="7" class="tbl-vazio erro">Erro: ' + rP.error.message + '</td></tr>';
        return;
      }
      usuariosLista = rP.data || [];
      perfisTiposLista = (rT && rT.data) || [];
      perfisTiposCarregado = true;
      usuariosCarregado = true;
      renderUsuarios();
    });

    // listeners idempotentes
    var busca = document.getElementById("us-busca");
    if (busca && !busca.dataset.bound) { busca.dataset.bound = "1"; busca.addEventListener("input", renderUsuarios); }
    var st = document.getElementById("us-status");
    if (st && !st.dataset.bound) { st.dataset.bound = "1"; st.addEventListener("change", renderUsuarios); }
    var btnNovo = document.getElementById("us-btn-novo");
    if (btnNovo && !btnNovo.dataset.bound) {
      btnNovo.dataset.bound = "1";
      btnNovo.addEventListener("click", function () { abrirModalNovoUsuario(); });
    }
  }

  function renderUsuarios() {
    var tbody = document.getElementById("us-tbody");
    if (!tbody) return;
    var busca = ((document.getElementById("us-busca")||{}).value || "").trim().toLowerCase();
    var status = ((document.getElementById("us-status")||{}).value || "").trim();
    var filtrados = usuariosLista.filter(function (u) {
      if (status === "ativo" && u.ativo === false) return false;
      if (status === "inativo" && u.ativo !== false) return false;
      return matchBusca(busca, [u.id, u.nome, emailsByUserId[u.id]]);
    });
    valText(document.getElementById("us-lbl"), filtrados.length + " de " + usuariosLista.length);

    preencherTbody(tbody, filtrados.map(function (u) {
      var st = u.ativo === false
        ? '<span class="tag tag-warn">Inativo</span>'
        : '<span class="tag tag-ok">Ativo</span>';
      var senhaTempBadge = u.senha_temporaria ? '<span class="tag tag-warn">sim</span>' : '<span class="muted">—</span>';
      var ultimo = u.ultimo_acesso ? fmtData(u.ultimo_acesso) : '<span class="muted">nunca</span>';
      var emailTxt = emailsByUserId[u.id] || '<span class="muted">—</span>';
      var btnAtivar = u.ativo === false
        ? '<button type="button" class="btn-acao" data-us-reativar="' + escHtml(u.id) + '" title="Reativar usuário">Reativar</button>'
        : '<button type="button" class="btn-limpar" data-us-desativar="' + escHtml(u.id) + '" title="Desativar usuário">Desativar</button>';
      return '<tr>' +
        '<td><strong>' + escHtml(u.nome) + '</strong></td>' +
        '<td>' + emailTxt + '</td>' +
        '<td>' + escHtml(u.perfil) + '</td>' +
        '<td>' + st + '</td>' +
        '<td>' + senhaTempBadge + '</td>' +
        '<td>' + ultimo + '</td>' +
        '<td>' +
          '<button class="btn-limpar" data-us-edit="' + escHtml(u.id) + '" style="margin-right:4px">Editar</button>' +
          btnAtivar +
        '</td>' +
      '</tr>';
    }), 7, "Nenhum usuário.");

    tbody.querySelectorAll("[data-us-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-us-edit");
        var u = usuariosLista.find(function (x) { return x.id === id; });
        if (u) abrirModalUsuario(u);
      });
    });
    tbody.querySelectorAll("[data-us-desativar]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-us-desativar");
        var u = usuariosLista.find(function (x) { return x.id === id; });
        if (!u) return;
        if (!confirm("Desativar usuário '" + u.nome + "'?\n\nEle não conseguirá mais fazer login. Pode ser reativado depois.")) return;
        chamarGerenciarUsuarios({ acao: "desativar", user_id: id }, "Usuário desativado.");
      });
    });
    tbody.querySelectorAll("[data-us-reativar]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-us-reativar");
        chamarGerenciarUsuarios({ acao: "reativar", user_id: id }, "Usuário reativado.");
      });
    });
  }

  // Helper genérico pra chamar a Edge Function gerenciar-usuarios
  function chamarGerenciarUsuarios(payload, mensagemSucesso) {
    client.auth.getSession().then(function (s) {
      var token = s && s.data && s.data.session && s.data.session.access_token;
      if (!token) { alert("Sessão expirada. Faça login de novo."); return; }
      var url = (typeof TERRA_CONFIG !== "undefined" && TERRA_CONFIG.SUPABASE_URL ? TERRA_CONFIG.SUPABASE_URL : "")
                + "/functions/v1/gerenciar-usuarios";
      fetch(url, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }).then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }); })
        .then(function (resp) {
          if (resp.status >= 200 && resp.status < 300) {
            alert(mensagemSucesso + (resp.body && resp.body.aviso ? "\n\n" + resp.body.aviso : ""));
            carregarUsuariosSeNecessario();
          } else {
            alert("Falha: " + ((resp.body && resp.body.error) || "erro desconhecido"));
          }
        })
        .catch(function (e) { alert("Erro de rede: " + e.message); });
    });
  }

  function opcoesPerfis() {
    var ativos = (perfisTiposLista || []).filter(function (t) { return t.ativo; });
    if (!ativos.length) {
      // Fallback: 3 fixos
      return ["admin","operador","consulta"];
    }
    return ativos.map(function (t) { return { value: t.nome, label: t.nome + (t.descricao ? " — " + t.descricao : "") }; });
  }

  function abrirModalNovoUsuario() {
    abrirModal({
      titulo: "Novo usuário",
      fields: [
        { name: "email",  label: "Email",   type: "email", required: true },
        { name: "nome",   label: "Nome completo", type: "text", required: true },
        { name: "perfil", label: "Perfil", type: "select", valor: "operador",
          options: opcoesPerfis(), required: true }
      ],
      onSubmit: function (v, done) {
        // Bypass de done — vamos chamar Edge Function e tratar
        client.auth.getSession().then(function (s) {
          var token = s && s.data && s.data.session && s.data.session.access_token;
          if (!token) { done("Sessão expirada"); return; }
          var url = (typeof TERRA_CONFIG !== "undefined" && TERRA_CONFIG.SUPABASE_URL ? TERRA_CONFIG.SUPABASE_URL : "")
                    + "/functions/v1/gerenciar-usuarios";
          fetch(url, {
            method: "POST",
            headers: {
              "Authorization": "Bearer " + token,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ acao: "criar", email: v.email, nome: v.nome, perfil: v.perfil })
          }).then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }); })
            .then(function (resp) {
              if (resp.status >= 200 && resp.status < 300) {
                alert("Usuário criado!\n\n" + (resp.body.mensagem || "Email de redefinição enviado."));
                carregarUsuariosSeNecessario();
                done(null);
              } else {
                done((resp.body && resp.body.error) || "Erro desconhecido");
              }
            })
            .catch(function (e) { done("Rede: " + e.message); });
        });
      }
    });
  }

  function abrirModalUsuario(u) {
    abrirModal({
      titulo: "Editar usuário — " + u.nome,
      fields: [
        { name: "nome",            label: "Nome",                        type: "text",   valor: u.nome,   required: true },
        { name: "perfil",          label: "Perfil",                      type: "select", valor: u.perfil, options: opcoesPerfis(), required: true },
        { name: "senha_temporaria",label: "Forçar troca no próximo login",type: "select", valor: u.senha_temporaria ? "true" : "false", options: [{value:"false",label:"Não"},{value:"true",label:"Sim"}] }
      ],
      onSubmit: function (v, done) {
        client.from("perfis").update({
          nome: v.nome,
          perfil: v.perfil,
          senha_temporaria: v.senha_temporaria === "true"
        }).eq("id", u.id).then(function (r) {
          if (r.error) { done(r.error.message); return; }
          carregarUsuariosSeNecessario();
          done(null);
        });
      }
    });
  }

  // =========================================================================
  // TIPOS DE PERFIL (Pacote C — admin-only)
  // =========================================================================

  function carregarPerfisTiposSeNecessario() {
    client.from("perfis_tipos").select("*").order("ordem").then(function (r) {
      if (r.error) {
        document.getElementById("pt-tbody").innerHTML = '<tr><td colspan="7" class="tbl-vazio erro">Erro: ' + r.error.message + '</td></tr>';
        return;
      }
      perfisTiposLista = r.data || [];
      perfisTiposCarregado = true;
      renderPerfisTipos();
    });
    var btn = document.getElementById("pt-btn-novo");
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = "1";
      btn.addEventListener("click", function () { abrirModalPerfilTipo(null); });
    }
  }

  function renderPerfisTipos() {
    var tbody = document.getElementById("pt-tbody");
    if (!tbody) return;
    valText(document.getElementById("pt-lbl"), perfisTiposLista.length + " tipos");
    if (!perfisTiposLista.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="tbl-vazio">Nenhum tipo. Clique em + Novo tipo.</td></tr>';
      return;
    }
    tbody.innerHTML = perfisTiposLista.map(function (t) {
      var bAtivo = t.ativo ? '<span class="tag tag-ok">sim</span>' : '<span class="tag tag-warn">não</span>';
      var bAdm = t.pode_admin ? '<span class="tag tag-ok">sim</span>' : '<span class="muted">não</span>';
      var bMod = t.pode_modificar ? '<span class="tag tag-ok">sim</span>' : '<span class="muted">não</span>';
      return '<tr>' +
        '<td class="num">' + fmtInt(t.ordem) + '</td>' +
        '<td><strong>' + escHtml(t.nome) + '</strong></td>' +
        '<td>' + escHtml(t.descricao || "—") + '</td>' +
        '<td>' + bAdm + '</td>' +
        '<td>' + bMod + '</td>' +
        '<td>' + bAtivo + '</td>' +
        '<td><button class="btn-limpar" data-pt-edit="' + t.id + '">Editar</button></td>' +
      '</tr>';
    }).join("");
    tbody.querySelectorAll("[data-pt-edit]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = Number(b.getAttribute("data-pt-edit"));
        var t = perfisTiposLista.find(function (x) { return x.id === id; });
        if (t) abrirModalPerfilTipo(t);
      });
    });
  }

  function abrirModalPerfilTipo(t) {
    var ehNovo = !t;
    abrirModal({
      titulo: ehNovo ? "Novo tipo de perfil" : "Editar tipo — " + t.nome,
      fields: [
        { name: "nome",        label: "Nome (sem espaços, ex: gerente)", type: "text",   valor: t && t.nome, required: true },
        { name: "descricao",   label: "Descrição",                       type: "textarea", valor: t && t.descricao },
        { name: "pode_admin",  label: "Pode admin? (Configuração + gerenciar usuários)", type: "select",
          valor: t && t.pode_admin ? "true" : "false",
          options: [{ value: "true", label: "Sim" }, { value: "false", label: "Não" }] },
        { name: "pode_modificar", label: "Pode modificar dados?", type: "select",
          valor: t && t.pode_modificar ? "true" : "false",
          options: [{ value: "true", label: "Sim" }, { value: "false", label: "Não" }] },
        { name: "ordem", label: "Ordem (menor = aparece primeiro)", type: "number", valor: t && t.ordem !== undefined ? t.ordem : 100 },
        { name: "ativo", label: "Ativo?", type: "select",
          valor: t ? (t.ativo ? "true" : "false") : "true",
          options: [{ value: "true", label: "Sim" }, { value: "false", label: "Não" }] }
      ],
      onSubmit: function (v, done) {
        var payload = {
          nome: v.nome,
          descricao: v.descricao,
          pode_admin: v.pode_admin === "true",
          pode_modificar: v.pode_modificar === "true",
          ordem: Number(v.ordem) || 100,
          ativo: v.ativo === "true"
        };
        var q = ehNovo
          ? client.from("perfis_tipos").insert(payload)
          : client.from("perfis_tipos").update(payload).eq("id", t.id);
        q.then(function (r) {
          if (r.error) { done(r.error.message); return; }
          carregarPerfisTiposSeNecessario();
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
          folhaCustoCarregado = false;   // CC do func afeta Custo Indireto + por Área
          bonCarregado = false;           // Bônus Individual usa lista de funcionarios
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
    // M18: parser RICO. Filtra DRE em duas categorias e gera 4 destinos:
    //   - CPV - Matéria Prima → estoque_detalhes (linha-a-linha) + estoque_resumo (agregado por OS) + os_evolucao_mensal (agregado por OS+mes)
    //   - CPV - Direto        → custo_direto_competencia (sem OS)
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
        var colCodSaida   = findCol(["codigo saida","código saida","cod saida"]);
        var colCodOS      = findCol(["codigo os","código os","cod os"]);
        var colFunc       = findCol(["funcionario","funcionário"]);
        var colCodMat     = findCol(["codigo material","código material","cod material"]);
        var colDescMat    = findCol(["descricao material","descrição material","descricao do material","descrição do material"]);
        var colQtd        = findCol(["quantidade","qtde","qtd"]);
        var colCustoUnit  = findCol(["custo unitario","custo unitário"]);
        var colCustoTot   = findCol(["custo total","total custo","custo"]);
        var colCustoFiscal= findCol(["custo fiscal do material","custo fiscal"]);
        var colNumPlano   = findCol(["n plano de contas","numero plano de contas","numero_plano_contas"]);
        var colDescPlano  = findCol(["plano de contas","descritivo conta","descritivo plano contas"]);
        var colDtSaida    = findCol(["data saida","data saída","data de saida"]);
        var colDRE        = findCol(["dre"]);
        var colCmp        = findCol(["compet","compet.","competencia","competência"]);
        var colOS         = findCol(["os"]);
        var colItem       = findCol(["item"]);

        var faltam = [];
        if (!colDRE)      faltam.push("DRE");
        if (!colCmp)      faltam.push("Compet.");
        if (!colCustoTot) faltam.push("Custo Total");
        if (!colCodOS && !colOS) faltam.push("Código OS / OS");
        if (faltam.length) { setImpStatus("Faltando colunas: " + faltam.join(", "), "erro"); return; }

        function parseNum(v) {
          if (v === null || v === undefined || v === "") return 0;
          var n = Number(String(v).replace(/\./g,"").replace(",", "."));
          return isNaN(n) ? 0 : n;
        }
        function parseDateBR(v) {
          if (!v) return null;
          if (v instanceof Date) return v.toISOString().slice(0,10);
          var s = String(v).trim();
          var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
          if (m) {
            var y = m[3].length === 2 ? "20" + m[3] : m[3];
            return y + "-" + ("0"+m[2]).slice(-2) + "-" + ("0"+m[1]).slice(-2);
          }
          if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
          return null;
        }

        var detalhes = [];
        var resumoByOS = {};
        var evoluByOSMes = {};
        var diretos = [];
        var ignorados = 0;
        var totalCPVMP = 0;
        var totalCPVDireto = 0;

        raw.forEach(function (r) {
          var dre = String(r[colDRE] || "").trim().toLowerCase();
          var ehMP = ["cpv - matéria prima","cpv - materia prima","cpv-matéria prima","cpv-materia prima","cpv – matéria prima"].indexOf(dre) !== -1;
          var ehDireto = ["cpv - direto","cpv-direto","cpv – direto","cpv direto"].indexOf(dre) !== -1;
          if (!ehMP && !ehDireto) { ignorados++; return; }

          var mes = parseMesRef(r[colCmp]);
          if (!mes) { ignorados++; return; }

          var custoTotal = parseNum(r[colCustoTot]);
          var dataSaida = parseDateBR(r[colDtSaida]);
          var func = r[colFunc] ? String(r[colFunc]).trim() : null;
          var codMat = r[colCodMat] ? String(r[colCodMat]).trim() : null;
          var descMat = r[colDescMat] ? String(r[colDescMat]).trim() : null;
          var qtd = parseNum(r[colQtd]);
          var custoUnit = parseNum(r[colCustoUnit]);
          var custoFiscal = parseNum(r[colCustoFiscal]);
          var numPlano = r[colNumPlano] ? String(r[colNumPlano]).trim() : null;
          var descPlano = r[colDescPlano] ? String(r[colDescPlano]).trim() : null;

          if (ehMP) {
            var codOSraw = colCodOS ? String(r[colCodOS] || "").trim() : "";
            var osNum = colOS ? String(r[colOS] || "").trim() : "";
            var os = (codOSraw.split("/")[0].trim()) || osNum;
            if (!os) { ignorados++; return; }
            var item = colItem ? String(r[colItem] || "").trim() : (codOSraw.split("/")[1] || "").trim();
            totalCPVMP += custoTotal;

            detalhes.push({
              codigo_os: codOSraw || (os + (item ? "/" + item : "")),
              os: os,
              item: item || null,
              funcionario: func,
              codigo_material: codMat,
              descricao_material: descMat,
              quantidade: qtd,
              custo_unitario: custoUnit,
              custo_total: custoTotal,
              custo_fiscal_do_material: custoFiscal,
              n_plano_contas: numPlano,
              plano_contas: descPlano,
              data_saida: dataSaida,
              dre: r[colDRE] || null,
              compet: mes
            });

            if (!resumoByOS[os]) {
              resumoByOS[os] = {
                codigo_os: os, n_itens: 0, custo_total: 0,
                primeira_saida: dataSaida, ultima_saida: dataSaida, _funcionarios: {}
              };
            }
            var rs = resumoByOS[os];
            rs.n_itens += 1;
            rs.custo_total += custoTotal;
            if (dataSaida) {
              if (!rs.primeira_saida || dataSaida < rs.primeira_saida) rs.primeira_saida = dataSaida;
              if (!rs.ultima_saida   || dataSaida > rs.ultima_saida)   rs.ultima_saida   = dataSaida;
            }
            if (func) rs._funcionarios[func] = true;

            var k = os + "|" + mes;
            evoluByOSMes[k] = (evoluByOSMes[k] || 0) + custoTotal;
          } else if (ehDireto) {
            totalCPVDireto += custoTotal;
            diretos.push({
              mes_ref: mes, data_saida: dataSaida, valor: custoTotal,
              numero_plano_contas: numPlano, plano_contas_descritivo: descPlano,
              descricao_material: descMat, codigo_material: codMat, funcionario: func
            });
          }
        });

        var resumo = Object.keys(resumoByOS).map(function (os) {
          var rs = resumoByOS[os];
          return {
            codigo_os: rs.codigo_os, n_itens: rs.n_itens,
            custo_total: Math.round(rs.custo_total * 100) / 100,
            primeira_saida: rs.primeira_saida, ultima_saida: rs.ultima_saida,
            funcionarios: Object.keys(rs._funcionarios).join("; ")
          };
        });
        var evolucao = Object.keys(evoluByOSMes).map(function (k) {
          var p = k.split("|");
          return { os: p[0], mes_ref: p[1], custo_saida: Math.round(evoluByOSMes[k] * 100) / 100 };
        });

        impParsed = {
          tipo: "saida_estoque",
          detalhes: detalhes, resumo: resumo,
          evolucao: evolucao, diretos: diretos
        };
        var previewLinhas = detalhes.length ? detalhes : diretos;
        var previewCols = detalhes.length
          ? ["os","item","funcionario","descricao_material","quantidade","custo_total","data_saida","compet"]
          : ["mes_ref","data_saida","funcionario","descricao_material","valor"];
        impParsed.linhas = previewLinhas;
        impParsed.cabs = previewCols;
        renderPreviewImport(previewLinhas, previewCols);

        var msg = "Resultado do parse: " + detalhes.length + " em estoque_detalhes (CPV-MP R$ " + totalCPVMP.toFixed(2) + "), " + resumo.length + " em estoque_resumo, " + evolucao.length + " em os_evolucao_mensal, " + diretos.length + " em custo_direto_competencia (CPV-Direto R$ " + totalCPVDireto.toFixed(2) + "). " + ignorados + " linha(s) ignorada(s).";
        setImpStatus(msg, "ok");
        atualizarEstadoImport();
      } catch (e) {
        setImpStatus("Erro lendo arquivo: " + e.message, "erro");
      }
    };
    reader.readAsArrayBuffer(arq);
  }

  // M18 — Confirma import RICO de saída de estoque (4 destinos)
  function confirmarSaidaEstoqueRico(parsed) {
    if (!parsed) return;
    var msg = "Vai inserir: " + (parsed.detalhes||[]).length + " em estoque_detalhes, "
              + (parsed.resumo||[]).length + " em estoque_resumo, "
              + (parsed.evolucao||[]).length + " em os_evolucao_mensal (UPSERT), "
              + (parsed.diretos||[]).length + " em custo_direto_competencia. Confirma?";
    if (!confirm(msg)) return;
    impBtnConf.disabled = true;
    impBtnPrev.disabled = true;
    setImpStatus("Inserindo nos 4 destinos…", "carregando");

    function enviarLote(tabela, linhas, opts, cb) {
      if (!linhas || !linhas.length) return cb(null);
      var lotes = [];
      for (var i = 0; i < linhas.length; i += 200) lotes.push(linhas.slice(i, i + 200));
      var idx = 0;
      function proximo() {
        if (idx >= lotes.length) return cb(null);
        var q;
        if (opts && opts.upsert) q = client.from(tabela).upsert(lotes[idx], { onConflict: opts.upsert });
        else q = client.from(tabela).insert(lotes[idx]);
        q.then(function (r) {
          if (r.error) return cb({ tabela: tabela, lote: idx, erro: r.error.message });
          idx++; proximo();
        });
      }
      proximo();
    }

    enviarLote("estoque_detalhes", parsed.detalhes, null, function (e1) {
      if (e1) { setImpStatus("Erro em " + e1.tabela + ": " + e1.erro, "erro"); impBtnConf.disabled = false; impBtnPrev.disabled = false; return; }
      enviarLote("estoque_resumo", parsed.resumo, null, function (e2) {
        if (e2) { setImpStatus("Erro em " + e2.tabela + ": " + e2.erro, "erro"); impBtnConf.disabled = false; impBtnPrev.disabled = false; return; }
        enviarLote("os_evolucao_mensal", parsed.evolucao, { upsert: "os,mes_ref" }, function (e3) {
          if (e3) { setImpStatus("Erro em " + e3.tabela + ": " + e3.erro, "erro"); impBtnConf.disabled = false; impBtnPrev.disabled = false; return; }
          enviarLote("custo_direto_competencia", parsed.diretos, null, function (e4) {
            if (e4) { setImpStatus("Erro em " + e4.tabela + ": " + e4.erro, "erro"); impBtnConf.disabled = false; impBtnPrev.disabled = false; return; }
            try { aprCarregado = false; } catch (e) {}
            try { orcamentosCarregados = false; } catch (e) {}
            try { rcCarregado = false; } catch (e) {}
            setImpStatus("Sucesso! 4 destinos atualizados. Reabra as telas (Custo por OS, Custo Direto, etc.) pra ver os dados novos.", "ok");
            impBtnConf.disabled = false;
            impBtnPrev.disabled = false;
          });
        });
      });
    });
  }

  // ===========================================================================
  // M18 — Dashboard de Orçamentos (parser + confirm)
  // Importa "Dashboard de Orçamentos.xlsx" → 3 destinos:
  //   - orcamento_items (linha-a-linha por item)
  //   - os_custos_planejados (1 linha por OS, com previsto vs realizado nas 4 dimensões)
  //   - ordens_servico (1 linha por OS — metadado básico, UPSERT)
  // ===========================================================================

  function previsualizarDashboardOrcamentos(arq) {
    setImpStatus("Lendo Dashboard de Orçamentos…", "carregando");
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var wb = window.XLSX.read(ev.target.result, { type: "array", cellDates: true });
        var sheet = wb.Sheets[wb.SheetNames[0]];
        // Cabeçalho real está na linha 2 (índice 1) — linha 1 (índice 0) é título do grupo
        var matriz = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
        if (matriz.length < 3) { setImpStatus("Planilha vazia ou sem cabeçalho.", "erro"); return; }

        var headers = matriz[1] || [];
        function findColIdx(nomes) {
          for (var i = 0; i < headers.length; i++) {
            var n = normalizarCabecalho(String(headers[i] || ""));
            if (nomes.indexOf(n) !== -1) return i;
          }
          return -1;
        }

        // Mapear índices das colunas
        var iOrc       = findColIdx(["n orcamento","nº orçamento","numero orcamento","número orçamento"]);
        var iCliente   = findColIdx(["cliente"]);
        var iRepr      = findColIdx(["representante"]);
        var iComissao  = findColIdx(["vl total comissao","vl total comissão","valor total comissao","valor total comissão"]);
        var iItem      = findColIdx(["item"]);
        var iFamilia   = findColIdx(["familia","família"]);
        var iGrupo     = findColIdx(["grupo"]);
        var iPedido    = findColIdx(["n pedido","nº pedido","numero pedido","número pedido"]);
        var iNFs       = findColIdx(["notas fiscais"]);
        var iQtdVend   = findColIdx(["qtde vendida","quantidade vendida"]);
        var iQtdRes    = findColIdx(["qtde reservada"]);
        var iQtdFat    = findColIdx(["qtde faturada"]);
        var iQtdAFat   = findColIdx(["qtde a faturar"]);
        var iQtdDisp   = findColIdx(["qtde disponivel para faturar","qtde disponível para faturar"]);
        var iVlUnit    = findColIdx(["vl unitario","vl unitário","valor unitario","valor unitário"]);
        var iVlTot     = findColIdx(["vl total","valor total"]);
        var iVlAFat    = findColIdx(["vl a faturar","valor a faturar"]);
        var iVlDisp    = findColIdx(["valor disponivel para faturar","valor disponível para faturar"]);
        var iCodInt    = findColIdx(["cod interno","código interno","cod. interno","cód. interno"]);
        var iServAnd   = findColIdx(["servicos em andamento","serviços em andamento"]);
        var iServConc  = findColIdx(["servicos concluidos","serviços concluídos"]);
        var iCruz      = findColIdx(["cruzada"]);
        var iLucroPrev = findColIdx(["lucro previsto"]);
        var iLucroReal = findColIdx(["lucro realizado"]);
        var iSaldoLucr = findColIdx(["saldo do lucro"]);
        var iServReal  = findColIdx(["servicos para o realizado","serviços para o realizado"]);
        var iTotPrev   = findColIdx(["total previsto"]);
        var iTotReal   = findColIdx(["total realizado"]);
        var iSaldoTot  = findColIdx(["saldo total"]);
        var iMatPrev   = findColIdx(["materiais previstos"]);
        var iMatReal   = findColIdx(["materiais realizados"]);
        var iSaldoMat  = findColIdx(["saldo de materiais"]);
        var iCompNE    = findColIdx(["comprados e nao entregues","comprados e não entregues"]);
        var iResNU     = findColIdx(["reservado e nao utilizado","reservado e não utilizado"]);
        var iHrPrev    = findColIdx(["horas previstas"]);
        var iHrReal    = findColIdx(["horas realizadas"]);
        var iSaldoHr   = findColIdx(["saldo de horas"]);
        var iSTPrev    = findColIdx(["st previstos"]);
        var iSTReal    = findColIdx(["st realizados"]);
        var iSaldoST   = findColIdx(["saldo de st"]);
        var iOutPrev   = findColIdx(["outros previstos"]);
        var iOutReal   = findColIdx(["outros realizados"]);
        var iSaldoOut  = findColIdx(["saldo de outros"]);

        if (iOrc === -1) { setImpStatus("Coluna 'Nº Orçamento' não encontrada.", "erro"); return; }

        function parseNum(v) {
          if (v === null || v === undefined || v === "") return null;
          var n = Number(String(v).replace(/\./g,"").replace(",", "."));
          return isNaN(n) ? null : n;
        }
        function getCell(row, idx) {
          return idx === -1 ? null : row[idx];
        }
        function getStr(row, idx) {
          var v = getCell(row, idx);
          if (v === null || v === undefined) return null;
          var s = String(v).trim();
          return s === "" ? null : s;
        }
        function getNum(row, idx) {
          return parseNum(getCell(row, idx));
        }

        var items = [];                 // orcamento_items
        var osPlanejByOS = {};          // os_custos_planejados (por OS)
        var ordensServByOS = {};        // ordens_servico (por OS)
        var ignorados = 0;

        // Começa da linha 3 (índice 2) — pulando 2 linhas de cabeçalho
        for (var i = 2; i < matriz.length; i++) {
          var r = matriz[i];
          if (!r || r.length === 0) { ignorados++; continue; }
          var orcamento = getStr(r, iOrc);
          if (!orcamento) { ignorados++; continue; }

          // 1) orcamento_items — uma linha por item do orçamento
          items.push({
            orcamento: orcamento,
            item: getStr(r, iItem),
            familia: getStr(r, iFamilia),
            grupo: getStr(r, iGrupo),
            cod_interno: getStr(r, iCodInt),
            qtd_vendida: getNum(r, iQtdVend),
            qtd_reservada: getNum(r, iQtdRes),
            qtd_faturada: getNum(r, iQtdFat),
            qtd_a_faturar: getNum(r, iQtdAFat),
            qtd_disponivel: getNum(r, iQtdDisp),
            vl_unitario: getNum(r, iVlUnit),
            vl_total: getNum(r, iVlTot),
            vl_a_faturar: getNum(r, iVlAFat),
            vl_disponivel_faturar: getNum(r, iVlDisp),
            representante: getStr(r, iRepr),
            vl_total_comissao: getNum(r, iComissao),
            num_pedido: getStr(r, iPedido),
            notas_fiscais: getStr(r, iNFs),
            lucro_previsto: getNum(r, iLucroPrev),
            lucro_realizado: getNum(r, iLucroReal),
            saldo_lucro: getNum(r, iSaldoLucr)
          });

          // OS pode estar em "Serviços em andamento" OU "Serviços concluídos" OU "Serviços para o realizado"
          var os = getStr(r, iServAnd) || getStr(r, iServConc) || getStr(r, iServReal);
          if (!os) continue;

          // 2) os_custos_planejados — agregado por OS (último valor prevalece se OS aparecer 2x)
          osPlanejByOS[os] = {
            os: os,
            total_previsto: getNum(r, iTotPrev),
            total_realizado: getNum(r, iTotReal),
            saldo_total: getNum(r, iSaldoTot),
            servicos_para_realizado: getStr(r, iServReal),
            materiais_previstos: getNum(r, iMatPrev),
            materiais_realizados: getNum(r, iMatReal),
            saldo_materiais: getNum(r, iSaldoMat),
            comprados_nao_entregues: getNum(r, iCompNE),
            reservado_nao_utilizado: getNum(r, iResNU),
            horas_previstas: getNum(r, iHrPrev),
            horas_realizadas: getNum(r, iHrReal),
            saldo_horas: getNum(r, iSaldoHr),
            st_previstos: getNum(r, iSTPrev),
            st_realizados: getNum(r, iSTReal),
            saldo_st: getNum(r, iSaldoST),
            outros_previstos: getNum(r, iOutPrev),
            outros_realizados: getNum(r, iOutReal),
            saldo_outros: getNum(r, iSaldoOut)
          };

          // 3) ordens_servico — metadado básico (UPSERT por OS se a tabela tiver constraint)
          ordensServByOS[os] = {
            os: os,
            orcamento: orcamento,
            item: getStr(r, iItem),
            familia: getStr(r, iFamilia),
            grupo: getStr(r, iGrupo),
            status: getStr(r, iCruz)
          };
        }

        var osCustos = Object.keys(osPlanejByOS).map(function (k) { return osPlanejByOS[k]; });
        var ordens = Object.keys(ordensServByOS).map(function (k) { return ordensServByOS[k]; });

        impParsed = {
          tipo: "dashboard_orcamentos",
          items: items,
          os_custos: osCustos,
          ordens: ordens
        };
        // Preview: items
        var previewCols = ["orcamento","item","familia","grupo","vl_total","qtd_vendida","qtd_faturada","lucro_previsto","lucro_realizado"];
        impParsed.linhas = items;
        impParsed.cabs = previewCols;
        renderPreviewImport(items, previewCols);

        var msg = "Resultado do parse: " + items.length + " itens em orcamento_items, " + osCustos.length + " OSs em os_custos_planejados, " + ordens.length + " entradas em ordens_servico (UPSERT). " + ignorados + " linha(s) ignorada(s).";
        setImpStatus(msg, "ok");
        atualizarEstadoImport();
      } catch (e) {
        setImpStatus("Erro lendo arquivo: " + e.message, "erro");
      }
    };
    reader.readAsArrayBuffer(arq);
  }

  // M18 — Confirma import do Dashboard de Orçamentos (3 destinos)
  function confirmarDashboardOrcamentos(parsed) {
    if (!parsed) return;
    var msg = "Vai inserir: " + (parsed.items||[]).length + " em orcamento_items, "
              + (parsed.os_custos||[]).length + " em os_custos_planejados (UPSERT por os), "
              + (parsed.ordens||[]).length + " em ordens_servico (UPSERT por os). Confirma?";
    if (!confirm(msg)) return;
    impBtnConf.disabled = true;
    impBtnPrev.disabled = true;
    setImpStatus("Inserindo nos 3 destinos…", "carregando");

    function enviarLote(tabela, linhas, opts, cb) {
      if (!linhas || !linhas.length) return cb(null);
      var lotes = [];
      for (var i = 0; i < linhas.length; i += 200) lotes.push(linhas.slice(i, i + 200));
      var idx = 0;
      function proximo() {
        if (idx >= lotes.length) return cb(null);
        var q;
        if (opts && opts.upsert) q = client.from(tabela).upsert(lotes[idx], { onConflict: opts.upsert });
        else q = client.from(tabela).insert(lotes[idx]);
        q.then(function (r) {
          if (r.error) return cb({ tabela: tabela, lote: idx, erro: r.error.message });
          idx++; proximo();
        });
      }
      proximo();
    }

    enviarLote("orcamento_items", parsed.items, null, function (e1) {
      if (e1) { setImpStatus("Erro em " + e1.tabela + ": " + e1.erro, "erro"); impBtnConf.disabled = false; impBtnPrev.disabled = false; return; }
      enviarLote("os_custos_planejados", parsed.os_custos, { upsert: "os" }, function (e2) {
        if (e2) { setImpStatus("Erro em " + e2.tabela + ": " + e2.erro, "erro"); impBtnConf.disabled = false; impBtnPrev.disabled = false; return; }
        enviarLote("ordens_servico", parsed.ordens, { upsert: "os" }, function (e3) {
          if (e3) { setImpStatus("Erro em " + e3.tabela + ": " + e3.erro, "erro"); impBtnConf.disabled = false; impBtnPrev.disabled = false; return; }
          try { aprCarregado = false; } catch (e) {}
          try { orcamentosCarregados = false; } catch (e) {}
          setImpStatus("Sucesso! 3 destinos atualizados (orcamento_items, os_custos_planejados, ordens_servico).", "ok");
          impBtnConf.disabled = false;
          impBtnPrev.disabled = false;
        });
      });
    });
  }

  // ===========================================================================
  // M18 — NFs com vínculo NF↔OS (refac)
  // Após o preview do template "Notas Fiscais", abre modal de revisão:
  //   - Pra cada NF: lista as OSs do orçamento (de ordens_servico) com checkboxes
  //   - Natália marca/desmarca, confirma
  //   - Grava notas_fiscais + nf_os (vínculo N:N)
  // ===========================================================================

  function confirmarNFsComVinculo(parsed) {
    if (!parsed || !parsed.linhas || !parsed.linhas.length) return;
    impBtnConf.disabled = true;
    setImpStatus("Buscando OSs dos orçamentos no banco…", "carregando");

    // Coletar orçamentos únicos
    var orcamentosUnicos = {};
    parsed.linhas.forEach(function (nf) {
      if (nf.numero_orcamento) orcamentosUnicos[String(nf.numero_orcamento)] = true;
    });
    var orcamentosArr = Object.keys(orcamentosUnicos);
    if (!orcamentosArr.length) {
      // Nenhum orçamento — só insere as NFs, sem vínculos
      gravarNFsEnfsOs(parsed.linhas, [], function (msg) { setImpStatus(msg, "ok"); impBtnConf.disabled = false; });
      return;
    }

    // Buscar OSs por orçamento na tabela ordens_servico
    client.from("ordens_servico")
      .select("os, orcamento, item, familia, grupo, status")
      .in("orcamento", orcamentosArr)
      .then(function (r) {
        if (r.error) {
          setImpStatus("Erro ao buscar OSs: " + r.error.message, "erro");
          impBtnConf.disabled = false;
          return;
        }
        var osList = r.data || [];
        // Indexar OSs por orçamento
        var osPorOrc = {};
        osList.forEach(function (o) {
          var k = String(o.orcamento);
          if (!osPorOrc[k]) osPorOrc[k] = [];
          osPorOrc[k].push(o);
        });

        // Construir HTML do modal de revisão
        var html = '<p class="muted-tag">Revise os vínculos NF↔OS abaixo. Por padrão, todas as OSs do orçamento ficam pré-marcadas.</p>';
        html += '<div style="max-height:60vh; overflow-y:auto; margin: 12px 0;">';
        parsed.linhas.forEach(function (nf, idx) {
          var orc = nf.numero_orcamento ? String(nf.numero_orcamento) : "";
          var osDoOrc = orc ? (osPorOrc[orc] || []) : [];
          html += '<div class="card" style="margin-bottom: 12px; padding: 12px;">';
          html += '<div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;">';
          html += '<strong>NF ' + escHtml(nf.numero_nf || "(sem número)") + '</strong>';
          html += '<span class="muted-tag">Orç: ' + escHtml(orc || "-") + ' · R$ ' + (nf.valor_nf ? Number(nf.valor_nf).toLocaleString("pt-BR", {minimumFractionDigits: 2}) : "—") + '</span>';
          html += '</div>';
          if (nf.razao_social) {
            html += '<div class="muted" style="font-size:13px; margin-bottom: 8px;">' + escHtml(nf.razao_social) + '</div>';
          }
          if (osDoOrc.length === 0) {
            html += '<div class="muted" style="font-style:italic; font-size:13px;">Nenhuma OS encontrada em ordens_servico pra este orçamento. NF será inserida sem vínculo.</div>';
          } else {
            html += '<div style="display:flex; flex-wrap:wrap; gap: 8px;">';
            osDoOrc.forEach(function (o) {
              var label = "OS " + o.os + (o.item ? " · item " + o.item : "") + (o.status ? " (" + o.status + ")" : "");
              html += '<label style="display:inline-flex; align-items:center; gap:4px; padding: 4px 8px; border:1px solid var(--borda); border-radius: var(--r-pill); cursor:pointer;">';
              html += '<input type="checkbox" data-nfidx="' + idx + '" data-os="' + escHtml(o.os) + '" checked /> ';
              html += escHtml(label);
              html += '</label>';
            });
            html += '</div>';
          }
          html += '</div>';
        });
        html += '</div>';
        html += '<div class="modal-acoes" style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px;">';
        html += '<button type="button" class="btn-limpar" id="nfvinc-cancelar">Cancelar</button>';
        html += '<button type="button" class="btn-ouro" id="nfvinc-confirmar">Confirmar e gravar</button>';
        html += '</div>';

        abrirModalDetalhe("Revisão de vínculos NF↔OS (" + parsed.linhas.length + " NFs)", html);

        // Listeners
        document.getElementById("nfvinc-cancelar").addEventListener("click", function () {
          var ov = document.getElementById("modal-detalhe-overlay");
          if (ov) ov.parentNode.removeChild(ov);
          setImpStatus("Operação cancelada pela usuária.", "alerta");
          impBtnConf.disabled = false;
        });
        document.getElementById("nfvinc-confirmar").addEventListener("click", function () {
          // Coletar vínculos marcados
          var vinculosPorIdx = {};
          var checkboxes = document.querySelectorAll('#modal-detalhe-overlay input[type="checkbox"][data-nfidx]');
          checkboxes.forEach(function (cb) {
            if (cb.checked) {
              var idx = cb.getAttribute("data-nfidx");
              if (!vinculosPorIdx[idx]) vinculosPorIdx[idx] = [];
              vinculosPorIdx[idx].push(cb.getAttribute("data-os"));
            }
          });
          // Fechar modal
          var ov = document.getElementById("modal-detalhe-overlay");
          if (ov) ov.parentNode.removeChild(ov);
          setImpStatus("Gravando NFs e vínculos…", "carregando");

          // Construir lista de vínculos pra nf_os
          var vinculosLista = [];
          parsed.linhas.forEach(function (nf, idx) {
            var oss = vinculosPorIdx[idx] || [];
            oss.forEach(function (os) {
              vinculosLista.push({ numero_nf: String(nf.numero_nf), os: os });
            });
          });

          gravarNFsEnfsOs(parsed.linhas, vinculosLista, function (msg, ehErro) {
            setImpStatus(msg, ehErro ? "erro" : "ok");
            impBtnConf.disabled = false;
          });
        });
      });
  }

  // Helper — grava NFs em notas_fiscais e vínculos em nf_os
  function gravarNFsEnfsOs(nfs, vinculos, cb) {
    function lote(tabela, linhas, cb2) {
      if (!linhas.length) return cb2(null);
      var lotes = [];
      for (var i = 0; i < linhas.length; i += 200) lotes.push(linhas.slice(i, i + 200));
      var idx = 0;
      function proximo() {
        if (idx >= lotes.length) return cb2(null);
        client.from(tabela).insert(lotes[idx]).then(function (r) {
          if (r.error) return cb2({ tabela: tabela, erro: r.error.message });
          idx++; proximo();
        });
      }
      proximo();
    }
    lote("notas_fiscais", nfs, function (e1) {
      if (e1) return cb("Erro em " + e1.tabela + ": " + e1.erro, true);
      lote("nf_os", vinculos, function (e2) {
        if (e2) return cb("NFs OK, mas erro em " + e2.tabela + ": " + e2.erro, true);
        cb(nfs.length + " NFs e " + vinculos.length + " vínculo(s) NF↔OS gravados com sucesso.", false);
      });
    });
  }

  // ===========================================================================
  // M18 — A Pagar x A Receber - Dt. Baixa (parser + confirm)
  // 22 colunas. Atenção: uma mesma transação pode aparecer em VÁRIAS LINHAS
  // (uma por plano de contas — VL PLANO CONTAS rateia o VALOR total).
  // Destino: tabela movimentos_caixa.
  // Classificação automática: tipo=RECEBER + numero_plano_contas em
  // ['33.01.003.001.001','33.01.003.001.007'] → natureza='Resultado Financeiro'.
  // Outras linhas RECEBER ficam com natureza=null (classificar depois na tela).
  // ===========================================================================

  var PAGAR_RECEBER_CONTAS_RENDIMENTO = ["33.01.003.001.001", "33.01.003.001.007"];

  function previsualizarPagarReceber(arq) {
    setImpStatus("Lendo A Pagar x A Receber…", "carregando");
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
        var colTipo       = findCol(["contas a pagar/receber","contas a pagar receber","tipo"]);
        var colCodPN      = findCol(["cod pn","codigo pn"]);
        var colParceiro   = findCol(["parceiro de negocio","parceiro de negócio","parceiro"]);
        var colCnpj       = findCol(["cnpj"]);
        var colPrevisao   = findCol(["previsao","previsão"]);
        var colValor      = findCol(["valor"]);
        var colValorCorr  = findCol(["valor_corrigido","valor corrigido"]);
        var colValorPago  = findCol(["valor_pago","valor pago"]);
        var colVlPlano    = findCol(["vl plano contas","valor plano contas"]);
        var colPago       = findCol(["pago"]);
        var colDtAbertura = findCol(["dt_abertura","dt abertura","data abertura"]);
        var colDtPagto    = findCol(["dt_pagamento","dt pagamento","data pagamento","dt baixa"]);
        var colDtVenc     = findCol(["dt_vencimento","dt vencimento","data vencimento","vencimento"]);
        var colDoc        = findCol(["documento"]);
        var colHist       = findCol(["historico","histórico"]);
        var colTpDoc      = findCol(["tp_doc","tp doc","tipo doc"]);
        var colCodPC      = findCol(["cod_plano_contas","cod plano contas"]);
        var colNumPC      = findCol(["numero_plano_contas","numero plano contas"]);
        var colDescPC     = findCol(["plano_contas","plano de contas"]);
        var colNumConta   = findCol(["numeroconta","numero conta"]);
        var colContaCorr  = findCol(["contacorrente","conta corrente"]);

        var faltam = [];
        if (!colTipo) faltam.push("CONTAS A PAGAR/RECEBER");
        if (!colValor && !colVlPlano) faltam.push("VALOR ou VL PLANO CONTAS");
        if (!colDoc) faltam.push("DOCUMENTO");
        if (faltam.length) { setImpStatus("Faltando colunas: " + faltam.join(", "), "erro"); return; }

        function parseNum(v) {
          if (v === null || v === undefined || v === "") return null;
          var n = Number(String(v).replace(/\./g,"").replace(",", "."));
          return isNaN(n) ? null : n;
        }
        function parseDateBR(v) {
          if (!v) return null;
          if (v instanceof Date) return v.toISOString().slice(0,10);
          var s = String(v).trim();
          var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
          if (m) {
            var y = m[3].length === 2 ? "20" + m[3] : m[3];
            return y + "-" + ("0"+m[2]).slice(-2) + "-" + ("0"+m[1]).slice(-2);
          }
          if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
          return null;
        }
        function getStr(r, c) { if (!c) return null; var v = r[c]; return v === null || v === undefined || v === "" ? null : String(v).trim(); }
        function getBool(r, c) { var v = getStr(r, c); if (!v) return false; var lo = v.toLowerCase(); return lo === "sim" || lo === "true" || lo === "yes" || lo === "1"; }

        var linhas = [];
        var classifAuto = 0;
        var pendentesReceber = 0;
        var pagar = 0;

        raw.forEach(function (r) {
          var tipoRaw = String(r[colTipo] || "").trim().toUpperCase();
          var tipo = tipoRaw === "PAGAR" ? "PAGAR" : tipoRaw === "RECEBER" ? "RECEBER" : null;
          if (!tipo) return;

          var numPC = colNumPC ? getStr(r, colNumPC) : null;
          var natureza = null;
          // Regra automática: se RECEBER + plano isento → Resultado Financeiro
          if (tipo === "RECEBER" && numPC && PAGAR_RECEBER_CONTAS_RENDIMENTO.indexOf(numPC) !== -1) {
            natureza = "Resultado Financeiro";
            classifAuto++;
          } else if (tipo === "RECEBER") {
            pendentesReceber++;
          } else {
            pagar++;
          }

          linhas.push({
            tipo: tipo,
            cod_pn: getStr(r, colCodPN),
            parceiro: getStr(r, colParceiro),
            cnpj: getStr(r, colCnpj),
            previsao: getStr(r, colPrevisao),
            valor_total: parseNum(r[colValor]),
            valor_corrigido: colValorCorr ? parseNum(r[colValorCorr]) : null,
            valor_pago: colValorPago ? parseNum(r[colValorPago]) : null,
            valor_rateado: colVlPlano ? parseNum(r[colVlPlano]) : null,
            pago: getBool(r, colPago),
            data_abertura: colDtAbertura ? parseDateBR(r[colDtAbertura]) : null,
            data_pagamento: colDtPagto ? parseDateBR(r[colDtPagto]) : null,
            data_vencimento: colDtVenc ? parseDateBR(r[colDtVenc]) : null,
            documento: getStr(r, colDoc),
            historico: getStr(r, colHist),
            tp_doc: getStr(r, colTpDoc),
            cod_plano_contas: colCodPC ? getStr(r, colCodPC) : null,
            numero_plano_contas: numPC,
            plano_contas_descritivo: colDescPC ? getStr(r, colDescPC) : null,
            numero_conta: colNumConta ? getStr(r, colNumConta) : null,
            conta_corrente: colContaCorr ? getStr(r, colContaCorr) : null,
            natureza: natureza,
            orcamento_vinculado: null
          });
        });

        impParsed = {
          tipo: "pagar_receber",
          linhas: linhas,
          classifAuto: classifAuto,
          pendentesReceber: pendentesReceber,
          pagar: pagar
        };
        var previewCols = ["tipo","parceiro","valor_total","valor_rateado","data_pagamento","documento","numero_plano_contas","natureza"];
        impParsed.cabs = previewCols;
        renderPreviewImport(linhas, previewCols);

        var msg = "Resultado do parse: " + linhas.length + " linha(s) totais. "
                + pagar + " PAGAR, " + classifAuto + " RECEBER classificadas automaticamente como 'Resultado Financeiro' (planos isentos), "
                + pendentesReceber + " RECEBER pendentes de classificação manual (serão inseridas com natureza=null e devem ser classificadas depois na tela Contas a Receber).";
        setImpStatus(msg, "ok");
        atualizarEstadoImport();
      } catch (e) {
        setImpStatus("Erro lendo arquivo: " + e.message, "erro");
      }
    };
    reader.readAsArrayBuffer(arq);
  }

  function confirmarPagarReceber(parsed) {
    if (!parsed || !parsed.linhas || !parsed.linhas.length) return;
    var msg = "Vai inserir " + parsed.linhas.length + " linha(s) em movimentos_caixa:\n"
            + "• " + parsed.pagar + " PAGAR\n"
            + "• " + parsed.classifAuto + " RECEBER já classificadas como 'Resultado Financeiro' (planos isentos)\n"
            + "• " + parsed.pendentesReceber + " RECEBER pendentes de classificação manual\n\nConfirma?";
    if (!confirm(msg)) return;
    impBtnConf.disabled = true;
    impBtnPrev.disabled = true;
    setImpStatus("Inserindo em movimentos_caixa…", "carregando");

    var lotes = [];
    for (var i = 0; i < parsed.linhas.length; i += 200) lotes.push(parsed.linhas.slice(i, i + 200));
    var idx = 0;
    var inseridos = 0;
    function proximo() {
      if (idx >= lotes.length) {
        setImpStatus("Sucesso! " + inseridos + " linhas inseridas em movimentos_caixa. Pendentes de classificação: " + parsed.pendentesReceber + " (vão aparecer na tela Contas a Receber refatorada).", "ok");
        impBtnConf.disabled = false;
        impBtnPrev.disabled = false;
        return;
      }
      client.from("movimentos_caixa").insert(lotes[idx]).then(function (r) {
        if (r.error) {
          setImpStatus("Erro no lote " + (idx+1) + ": " + r.error.message, "erro");
          impBtnConf.disabled = false;
          impBtnPrev.disabled = false;
          return;
        }
        inseridos += lotes[idx].length;
        setImpStatus("Inseridos " + inseridos + " / " + parsed.linhas.length + "…", "carregando");
        idx++;
        proximo();
      });
    }
    proximo();
  }





  function confirmarImport() {
    if (!impParsed) return;
    var tpl = impTemplates[impTipo.value];
    if (!tpl) return;

    // M18 — Modal tipo_faturamento (apenas pra import de orcamentos)
    if (tpl.alvo === "orcamentos" && impParsed.linhas && impParsed.linhas.length) {
      // Conta quantas linhas já vêm com tipo_faturamento da própria planilha
      var jaTem = impParsed.linhas.filter(function (l) { return l.tipo_faturamento; }).length;
      if (jaTem < impParsed.linhas.length) {
        var faltam = impParsed.linhas.length - jaTem;
        var resp = prompt(
          "Tipo de faturamento padrão para " + faltam + " orçamento(s) sendo importado(s):\n\n" +
          "• Digite 100  = 100% com NF (padrão)\n" +
          "• Digite 0    = 0% com NF (sem NF, entrega informal)\n" +
          "• Digite 1-99 = parcial X% com NF (ex: 50 = 50/50)\n\n" +
          (jaTem > 0 ? "(" + jaTem + " linha(s) com tipo já preenchido na planilha serão preservadas)" : ""),
          "100"
        );
        if (resp === null) return;  // cancelou
        var pct = Number(String(resp).replace(",", "."));
        if (isNaN(pct) || pct < 0 || pct > 100) {
          setImpStatus("Valor inválido para tipo de faturamento. Operação cancelada.", "erro");
          return;
        }
        var tipoPadrao = pct >= 100 ? "100_NF" : pct <= 0 ? "0_NF" : "PARCIAL";
        impParsed.linhas.forEach(function (l) {
          if (!l.tipo_faturamento) {
            l.tipo_faturamento = tipoPadrao;
            l.pct_com_nf = pct;
          }
        });
      }
    }


    // Resolução de conta_codigo → conta_id (saldos_contas: conta bancária)
    var temColunaContaBanc = (impParsed.linhas || []).some(function (l) { return "conta_codigo" in l; });
    if (temColunaContaBanc) {
      // Carrega lista de contas bancárias
      var resolverContas = function () {
        return client.from("contas_bancarias").select("id, nome").then(function (rs) {
          if (rs.error) return false;
          var mapa = {};
          (rs.data || []).forEach(function (c) {
            mapa[String(c.nome || "").trim().toLowerCase()] = c.id;
          });
          var naoMapeados = 0;
          impParsed.linhas.forEach(function (l) {
            var k = String(l.conta_codigo || "").trim().toLowerCase();
            delete l.conta_codigo;
            if (!k) { l.conta_id = null; return; }
            var id = mapa[k] || null;
            if (id) l.conta_id = id;
            else { l.conta_id = null; naoMapeados++; }
          });
          if (naoMapeados > 0) {
            if (!confirm(naoMapeados + " linha(s) não casaram com nenhuma conta bancária cadastrada. Cadastre primeiro em Fluxo de Caixa > Contas Bancárias. Continuar mesmo assim (linhas ficarão com conta_id NULL)?")) {
              impBtnConf.disabled = false;
              setImpStatus("Importação cancelada. Cadastre as contas primeiro.", "alerta");
              return false;
            }
          }
          return true;
        });
      };
      resolverContas().then(function (ok) {
        if (ok === false) return;
        // Continua resolvendo plano_contas se também houver (raro mas possível)
        proceedAposFK();
      });
      return;
    }
    proceedAposFK();
    function proceedAposFK() {

    // Resolução de plano_contas_codigo → plano_contas_id (se as linhas tiverem)
    var temColunaConta = (impParsed.linhas || []).some(function (l) { return "plano_contas_codigo" in l; });
    if (temColunaConta) {
      // Garante plano de contas carregado em memória (planoContas)
      var resolveIds = function () {
        var mapaCod = {}, mapaNum = {}, mapaDescr = {};
        (planoContas || []).forEach(function (p) {
          if (p.cod_conta) mapaCod[String(p.cod_conta).trim().toLowerCase()] = p.id;
          if (p.numero_conta) mapaNum[String(p.numero_conta).trim().toLowerCase()] = p.id;
          if (p.descritivo) mapaDescr[String(p.descritivo).trim().toLowerCase()] = p.id;
        });
        var naoMapeados = 0;
        impParsed.linhas.forEach(function (l) {
          var k = String(l.plano_contas_codigo || "").trim().toLowerCase();
          delete l.plano_contas_codigo;  // não vai pro insert
          if (!k) { l.plano_contas_id = null; return; }
          var id = mapaCod[k] || mapaNum[k] || mapaDescr[k] || null;
          if (id) l.plano_contas_id = id;
          else { l.plano_contas_id = null; naoMapeados++; }
        });
        if (naoMapeados > 0) {
          if (!confirm(naoMapeados + " linha(s) não casaram com nenhuma conta do Plano de Contas (cod, número ou descritivo) — vão ficar com plano_contas_id NULL. Continuar?")) {
            impBtnConf.disabled = false;
            setImpStatus("Importação cancelada. " + naoMapeados + " contas não mapeadas.", "alerta");
            return false;  // sinaliza pra abortar
          }
        }
        return true;
      };
      if (!pcCarregado) {
        carregarPlanoContasSeNecessario();
        var iv = setInterval(function () {
          if (pcCarregado) {
            clearInterval(iv);
            if (resolveIds() === false) return;
            confirmarImportContinuar(tpl);
          }
        }, 150);
        return;
      } else {
        if (resolveIds() === false) return;
      }
    }
    confirmarImportContinuar(tpl);
    } // fecha proceedAposFK
  }

  function confirmarImportContinuar(tpl) {

    // M18: saída de estoque agora vai pra 4 destinos
    if (impParsed.tipo === "saida_estoque") {
      return confirmarSaidaEstoqueRico(impParsed);
    }
    // M18: dashboard de orçamentos vai pra 3 destinos
    if (impParsed.tipo === "dashboard_orcamentos") {
      return confirmarDashboardOrcamentos(impParsed);
    }
    // M18: notas_fiscais — abre modal de revisão de vínculo NF↔OS antes de gravar
    if (tpl.alvo === "notas_fiscais") {
      return confirmarNFsComVinculo(impParsed);
    }
    // M18: pagar_receber — insere em movimentos_caixa com classificação automática
    if (impParsed.tipo === "pagar_receber") {
      return confirmarPagarReceber(impParsed);
    }
    // evolucao_pct continua no UPSERT clássico em os_evolucao_mensal
    if (impParsed.tipo === "evolucao_pct") {
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
        // Invalida caches afetados (incluindo telas derivadas: Visão 12m, Bônus, Apropriação)
        if (tpl.alvo === "caixa_saldo_mensal") {
          caixaSaldoCarregado = false;
          fluxoVisaoCarregado = false;   // Visão 12m
          bonCarregado = false;          // Caixa Positivo no Bônus
        }
        if (tpl.alvo === "compromissos_financeiros") {
          compromissosCarregado = false;
          fluxoVisaoCarregado = false;   // Visão 12m (saídas projetadas)
          bonCarregado = false;          // ICC no Bônus
        }
        if (tpl.alvo === "orcamentos" || tpl.alvo === "movimentos") {
          orcamentosCarregados = false;
          movimentosCompletos = []; orcamentosLista = [];
          aprCarregado = false;          // Apropriação usa cliente_por_orcamento
          bonCarregado = false;          // Faturamento Bruto + ML
          fluxoVisaoCarregado = false;   // Visão 12m usa orcamentos+movs
        }
        if (tpl.alvo === "receitas_custos") {
          rcCarregado = false; rcLista = [];
          bonCarregado = false;          // Margem Líquida no Bônus
        }
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
    document.getElementById("cc-tbody").innerHTML = '<tr><td colspan="7" class="tbl-vazio">Carregando…</td></tr>';
    Promise.all([
      client.from("centros_custo").select("*").order("codigo"),
      client.from("funcionarios").select("centro_custo_id")
    ]).then(function (rs) {
      var rCc = rs[0], rFn = rs[1];
      if (rCc.error) { document.getElementById("cc-tbody").innerHTML = '<tr><td colspan="7" class="tbl-vazio erro">Erro: ' + rCc.error.message + '</td></tr>'; return; }
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
    var tipoLabel = { direto: "Direto", indireto: "Indireto", despesa: "Despesa" };
    var tipoClasse = { direto: "tag-ok", indireto: "tag-warn", despesa: "" };
    preencherTbody(tbody, filtrados.map(function (c) {
      var tag = tipoLabel[c.tipo_custo] || "—";
      var cls = tipoClasse[c.tipo_custo] || "";
      var tagHtml = c.tipo_custo
        ? '<span class="tag ' + cls + '">' + tag + '</span>'
        : '<span class="muted">—</span>';
      return '<tr>' +
        '<td class="mono">' + escHtml(c.codigo) + '</td>' +
        '<td>' + escHtml(c.descricao) + '</td>' +
        '<td>' + escHtml(c.dre || "—") + '</td>' +
        '<td>' + tagHtml + '</td>' +
        '<td>' + (c.ativo ? '<span class="badge-tipo solta">sim</span>' : '<span class="badge-tipo outras">não</span>') + '</td>' +
        '<td class="num">' + fmtInt(contagens[c.id] || 0) + '</td>' +
        '<td><button class="btn-limpar" data-cc-edit="' + c.id + '">Editar</button></td>' +
      '</tr>';
    }), 7);
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
        { name: "dre",       label: "DRE (descritiva — espelho da planilha)", type: "text", valor: c.dre || "" },
        { name: "tipo_custo",label: "Tipo de custo",        type: "select", valor: c.tipo_custo || "despesa",
          options: [
            { value: "direto",   label: "Direto (MOD da produção — CPV)" },
            { value: "indireto", label: "Indireto (apoio à produção)" },
            { value: "despesa",  label: "Despesa (administrativo/financeiro/comercial)" }
          ] },
        { name: "ativo",     label: "Ativo?",               type: "select", valor: c.ativo === false ? "false" : "true", options: [{value:"true",label:"Sim"},{value:"false",label:"Não"}] }
      ],
      onSubmit: function (v, done) {
        var payload = {
          codigo: v.codigo,
          descricao: v.descricao,
          dre: v.dre || null,
          tipo_custo: v.tipo_custo,
          ativo: v.ativo === "true"
        };
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
      folhaCustoCarregado = false;
      bonCarregado = false;
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
        // Invalida caches dependentes — afeta Folha, Custo Indireto, Custo por Área, Bônus, Apropriação, Visão 12m
        folhaCustoCarregado = false;
        folhaVisaoCarregado = false;
        funcionariosCarregado = false;
        bonCarregado = false;
        aprCarregado = false;
        fluxoVisaoCarregado = false;
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
  // FLUXO DE CAIXA — Contas Bancárias (Entrega 10)
  // =========================================================================

  var contasBancariasLista = [];
  var contasBancariasCarregado = false;
  var contasBancariasCarregando = false;

  function carregarContasBancariasSeNecessario() {
    if (contasBancariasCarregado) { renderContasBancarias(); return; }
    if (contasBancariasCarregando) return;
    contasBancariasCarregando = true;
    var tbody = document.getElementById("cb-tbody");
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="tbl-vazio">Carregando…</td></tr>';

    client.from("contas_bancarias").select("*").order("ordem").order("nome").then(function (r) {
      contasBancariasCarregando = false;
      if (r.error) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="tbl-vazio erro">Erro: ' + escHtml(r.error.message) + '</td></tr>';
        return;
      }
      contasBancariasLista = r.data || [];
      contasBancariasCarregado = true;
      renderContasBancarias();
    });

    var busca = document.getElementById("cb-busca");
    if (busca && !busca.dataset.bound) { busca.dataset.bound = "1"; busca.addEventListener("input", renderContasBancarias); }
    var btnNovo = document.getElementById("cb-btn-novo");
    if (btnNovo && !btnNovo.dataset.bound) { btnNovo.dataset.bound = "1"; btnNovo.addEventListener("click", function () { abrirModalContaBancaria(null); }); }
  }

  function renderContasBancarias() {
    var tbody = document.getElementById("cb-tbody");
    if (!tbody) return;
    var busca = ((document.getElementById("cb-busca")||{}).value||"").trim().toLowerCase();
    var filtrados = contasBancariasLista.filter(function (c) {
      if (!busca) return true;
      return matchBusca(busca, [c.nome, c.banco, c.agencia, c.conta]);
    });
    valText(document.getElementById("cb-lbl"), filtrados.length + " de " + contasBancariasLista.length);
    if (!filtrados.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="tbl-vazio">Nenhuma conta cadastrada. Clique em + Nova conta.</td></tr>';
      return;
    }
    var tipoLabel = { conta_corrente: "Conta corrente", poupanca: "Poupança", aplicacao: "Aplicação", outro: "Outro" };
    tbody.innerHTML = filtrados.map(function (c) {
      var st = c.ativa ? '<span class="tag tag-ok">Ativa</span>' : '<span class="tag tag-warn">Inativa</span>';
      return '<tr>' +
        '<td><strong>' + escHtml(c.nome) + '</strong></td>' +
        '<td>' + escHtml(c.banco) + '</td>' +
        '<td>' + escHtml(tipoLabel[c.tipo] || c.tipo) + '</td>' +
        '<td>' + escHtml(c.agencia || "—") + '</td>' +
        '<td>' + escHtml(c.conta || "—") + '</td>' +
        '<td>' + st + '</td>' +
        '<td><button type="button" class="btn-acao" data-cb-edit="' + c.id + '">Editar</button></td>' +
      '</tr>';
    }).join("");
    tbody.querySelectorAll("[data-cb-edit]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = Number(b.getAttribute("data-cb-edit"));
        var c = contasBancariasLista.find(function (x) { return x.id === id; });
        if (c) abrirModalContaBancaria(c);
      });
    });
  }

  function abrirModalContaBancaria(c) {
    var ehNovo = !c;
    abrirModal({
      titulo: ehNovo ? "Nova conta bancária" : "Editar conta — " + (c.nome || ""),
      fields: [
        { name: "nome",      label: "Nome (apelido)", type: "text",   required: true,  valor: c && c.nome },
        { name: "banco",     label: "Banco",          type: "select", required: true,  valor: c && c.banco,
          options: [
            { value: "Itaú", label: "Itaú" },
            { value: "BB", label: "Banco do Brasil" },
            { value: "CEF", label: "Caixa Econômica" },
            { value: "XP", label: "XP Investimentos" },
            { value: "Bradesco", label: "Bradesco" },
            { value: "Santander", label: "Santander" },
            { value: "Sicoob", label: "Sicoob" },
            { value: "Sicredi", label: "Sicredi" },
            { value: "Inter", label: "Inter" },
            { value: "Outro", label: "Outro" }
          ] },
        { name: "tipo",      label: "Tipo",          type: "select", required: true, valor: c && c.tipo,
          options: [
            { value: "conta_corrente", label: "Conta corrente" },
            { value: "poupanca",       label: "Poupança" },
            { value: "aplicacao",      label: "Aplicação" },
            { value: "outro",          label: "Outro" }
          ] },
        { name: "agencia",   label: "Agência",  type: "text", valor: c && c.agencia },
        { name: "conta",     label: "Conta",    type: "text", valor: c && c.conta },
        { name: "ordem",     label: "Ordem (menor = aparece primeiro)", type: "number", valor: c && c.ordem !== undefined ? c.ordem : 100 },
        { name: "ativa",     label: "Ativa?",   type: "select", valor: c ? (c.ativa ? "true" : "false") : "true",
          options: [{ value: "true", label: "Sim" }, { value: "false", label: "Não" }] },
        { name: "observacao", label: "Observação", type: "textarea", valor: c && c.observacao }
      ],
      onSubmit: function (values, done) {
        var payload = {
          nome: values.nome,
          banco: values.banco,
          tipo: values.tipo,
          agencia: values.agencia,
          conta: values.conta,
          ordem: values.ordem !== null ? Number(values.ordem) : 100,
          ativa: values.ativa === "true",
          observacao: values.observacao
        };
        var q = ehNovo
          ? client.from("contas_bancarias").insert(payload).select().single()
          : client.from("contas_bancarias").update(payload).eq("id", c.id).select().single();
        q.then(function (r) {
          if (r.error) { done(r.error.message); return; }
          contasBancariasCarregado = false;
          carregarContasBancariasSeNecessario();
          done(null);
        });
      }
    });
  }

  // =========================================================================
  // FLUXO DE CAIXA — Saldos Mensais por Conta (Entrega 10)
  // =========================================================================

  var saldosContasLista = [];
  var saldosContasCarregado = false;
  var saldosContasCarregando = false;

  function carregarSaldosContasSeNecessario() {
    if (!contasBancariasCarregado) carregarContasBancariasSeNecessario();
    if (saldosContasCarregado) { renderSaldosContas(); popularSelectsSaldosContas(); return; }
    if (saldosContasCarregando) return;
    saldosContasCarregando = true;
    var tbody = document.getElementById("sc-tbody");
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="tbl-vazio">Carregando…</td></tr>';

    client.from("saldos_contas").select("*").order("mes_ref", { ascending: false }).then(function (r) {
      saldosContasCarregando = false;
      if (r.error) { if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="tbl-vazio erro">Erro: ' + escHtml(r.error.message) + '</td></tr>'; return; }
      saldosContasLista = r.data || [];
      saldosContasCarregado = true;
      popularSelectsSaldosContas();
      renderSaldosContas();
    });

    var btnNovo = document.getElementById("sc-btn-novo");
    if (btnNovo && !btnNovo.dataset.bound) { btnNovo.dataset.bound = "1"; btnNovo.addEventListener("click", function () { abrirModalSaldoConta(null); }); }
    ["sc-conta","sc-mes"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el.dataset.bound) { el.dataset.bound = "1"; el.addEventListener("change", renderSaldosContas); el.addEventListener("input", renderSaldosContas); }
    });
    var btnLimpar = document.getElementById("sc-btn-limpar");
    if (btnLimpar && !btnLimpar.dataset.bound) {
      btnLimpar.dataset.bound = "1";
      btnLimpar.addEventListener("click", function () {
        var c = document.getElementById("sc-conta"); if (c) c.value = "";
        var m = document.getElementById("sc-mes");   if (m) m.value = "";
        renderSaldosContas();
      });
    }
  }

  function popularSelectsSaldosContas() {
    var sel = document.getElementById("sc-conta");
    if (!sel) return;
    var atual = sel.value;
    sel.innerHTML = '<option value="">Todas as contas</option>' +
      contasBancariasLista.filter(function (c) { return c.ativa; }).map(function (c) {
        return '<option value="' + c.id + '">' + escHtml(c.nome) + '</option>';
      }).join("");
    sel.value = atual;
  }

  function renderSaldosContas() {
    var tbody = document.getElementById("sc-tbody");
    if (!tbody) return;
    var contaSel = ((document.getElementById("sc-conta")||{}).value||"").trim();
    var mesSel   = ((document.getElementById("sc-mes")  ||{}).value||"").trim();
    var contasMap = {};
    contasBancariasLista.forEach(function (c) { contasMap[c.id] = c; });

    var filtrados = saldosContasLista.filter(function (s) {
      if (contaSel && String(s.conta_id) !== contaSel) return false;
      if (mesSel && String(s.mes_ref).slice(0,7) !== mesSel) return false;
      return true;
    });
    valText(document.getElementById("sc-lbl"), filtrados.length + " de " + saldosContasLista.length);

    if (!filtrados.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="tbl-vazio">Nenhum saldo lançado. Clique em + Lançar saldo.</td></tr>';
      return;
    }
    tbody.innerHTML = filtrados.map(function (s) {
      var c = contasMap[s.conta_id] || {};
      var classeR = Number(s.saldo_final_realizado) >= 0 ? "" : "neg";
      var classeP = Number(s.saldo_final_projetado) >= 0 ? "" : "neg";
      return '<tr>' +
        '<td>' + escHtml(mesRef(s.mes_ref)) + '</td>' +
        '<td>' + escHtml(c.nome || "(conta removida)") + '</td>' +
        '<td class="num ' + classeR + '">' + (s.saldo_final_realizado != null ? fmtBRL(s.saldo_final_realizado) : "—") + '</td>' +
        '<td class="num ' + classeP + '">' + (s.saldo_final_projetado != null ? fmtBRL(s.saldo_final_projetado) : "—") + '</td>' +
        '<td>' + escHtml(s.observacao || "") + '</td>' +
        '<td><button type="button" class="btn-acao" data-sc-edit="' + s.id + '">Editar</button></td>' +
      '</tr>';
    }).join("");
    tbody.querySelectorAll("[data-sc-edit]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = Number(b.getAttribute("data-sc-edit"));
        var s = saldosContasLista.find(function (x) { return x.id === id; });
        if (s) abrirModalSaldoConta(s);
      });
    });
  }

  function abrirModalSaldoConta(s) {
    var ehNovo = !s;
    var contas = contasBancariasLista.filter(function (c) { return c.ativa; });
    if (!contas.length) { alert("Cadastre uma conta bancária antes de lançar saldo."); return; }
    abrirModal({
      titulo: ehNovo ? "Lançar saldo" : "Editar saldo",
      fields: [
        { name: "conta_id", label: "Conta", type: "select", required: true,
          valor: s && s.conta_id,
          options: contas.map(function (c) { return { value: c.id, label: c.nome + " — " + c.banco }; }) },
        { name: "mes_ref", label: "Mês de referência (YYYY-MM)", type: "month", required: true,
          valor: s && s.mes_ref ? String(s.mes_ref).slice(0,7) : "" },
        { name: "saldo_inicial",         label: "Saldo inicial (só 1º mês da conta)", type: "number", valor: s && s.saldo_inicial },
        { name: "saldo_final_realizado", label: "Saldo final realizado",              type: "number", valor: s && s.saldo_final_realizado },
        { name: "saldo_final_projetado", label: "Saldo final projetado",              type: "number", valor: s && s.saldo_final_projetado },
        { name: "observacao",            label: "Observação",                          type: "textarea", valor: s && s.observacao }
      ],
      onSubmit: function (values, done) {
        var payload = {
          conta_id: Number(values.conta_id),
          mes_ref: values.mes_ref ? values.mes_ref + "-01" : null,
          saldo_inicial: values.saldo_inicial,
          saldo_final_realizado: values.saldo_final_realizado,
          saldo_final_projetado: values.saldo_final_projetado,
          observacao: values.observacao
        };
        var q = ehNovo
          ? client.from("saldos_contas").upsert(payload, { onConflict: "conta_id,mes_ref" }).select().single()
          : client.from("saldos_contas").update(payload).eq("id", s.id).select().single();
        q.then(function (r) {
          if (r.error) { done(r.error.message); return; }
          saldosContasCarregado = false;
          carregarSaldosContasSeNecessario();
          fluxoVisaoCarregado = false; // invalida tela 12 meses
          done(null);
        });
      }
    });
  }

  // =========================================================================
  // FLUXO DE CAIXA — Recebimentos Previstos (Entrega 10)
  // =========================================================================

  var recebimentosPrevLista = [];
  var recebimentosPrevCarregado = false;
  var recebimentosPrevCarregando = false;

  function carregarRecebimentosPrevistosSeNecessario() {
    if (!orcamentosCarregados) carregarOrcamentosSeNecessario();
    if (recebimentosPrevCarregado) { renderRecebimentosPrev(); return; }
    if (recebimentosPrevCarregando) return;
    recebimentosPrevCarregando = true;
    var tbody = document.getElementById("rp-tbody");
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="tbl-vazio">Carregando…</td></tr>';

    client.from("recebimentos_previstos").select("*").order("data_prevista").then(function (r) {
      recebimentosPrevCarregando = false;
      if (r.error) { if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="tbl-vazio erro">Erro: ' + escHtml(r.error.message) + '</td></tr>'; return; }
      recebimentosPrevLista = r.data || [];
      recebimentosPrevCarregado = true;
      renderRecebimentosPrev();
    });

    var btnNovo = document.getElementById("rp-btn-novo");
    if (btnNovo && !btnNovo.dataset.bound) { btnNovo.dataset.bound = "1"; btnNovo.addEventListener("click", function () { abrirModalRecebPrev(null); }); }
    ["rp-busca","rp-status"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el.dataset.bound) { el.dataset.bound = "1"; el.addEventListener("input", renderRecebimentosPrev); el.addEventListener("change", renderRecebimentosPrev); }
    });
    var btnLimpar = document.getElementById("rp-btn-limpar");
    if (btnLimpar && !btnLimpar.dataset.bound) {
      btnLimpar.dataset.bound = "1";
      btnLimpar.addEventListener("click", function () {
        var b = document.getElementById("rp-busca"); if (b) b.value = "";
        var s = document.getElementById("rp-status"); if (s) s.value = "";
        renderRecebimentosPrev();
      });
    }
  }

  function renderRecebimentosPrev() {
    var tbody = document.getElementById("rp-tbody");
    if (!tbody) return;
    var busca = ((document.getElementById("rp-busca")||{}).value||"").trim().toLowerCase();
    var status = ((document.getElementById("rp-status")||{}).value||"").trim();
    var hojeIso = new Date().toISOString().slice(0,10);

    var filtrados = recebimentosPrevLista.filter(function (r) {
      if (busca) {
        var cliente = clientePorOrcamento[r.orcamento] || "";
        if (!matchBusca(busca, [r.orcamento, cliente])) return false;
      }
      if (status === "pendente" && r.recebido_em) return false;
      if (status === "recebido" && !r.recebido_em) return false;
      if (status === "vencido" && (r.recebido_em || r.data_prevista >= hojeIso)) return false;
      return true;
    });

    var pendentes = recebimentosPrevLista.filter(function (r) { return !r.recebido_em; });
    var vencidos  = pendentes.filter(function (r) { return r.data_prevista < hojeIso; });
    var d12 = new Date(); d12.setMonth(d12.getMonth() + 12);
    var d12iso = d12.toISOString().slice(0,10);
    var prox12 = pendentes.filter(function (r) { return r.data_prevista <= d12iso; });
    var totalProx12 = prox12.reduce(function (acc, r) { return acc + Number(r.valor || 0); }, 0);

    valText(document.getElementById("rp-m-pen"),   fmtInt(pendentes.length));
    valText(document.getElementById("rp-m-tot12"), fmtBRL(totalProx12));
    valText(document.getElementById("rp-m-venc"),  fmtInt(vencidos.length));
    valText(document.getElementById("rp-lbl"), filtrados.length + " de " + recebimentosPrevLista.length);

    if (!filtrados.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="tbl-vazio">Nenhuma parcela. Clique em + Nova parcela ou importe via Importar.</td></tr>';
      return;
    }
    tbody.innerHTML = filtrados.map(function (r) {
      var st, classe;
      if (r.recebido_em)              { st = "Recebido"; classe = "tag tag-ok"; }
      else if (r.data_prevista < hojeIso) { st = "Vencido";  classe = "tag tag-danger"; }
      else                             { st = "Pendente"; classe = "tag tag-warn"; }
      var cliente = clientePorOrcamento[r.orcamento] || "—";
      return '<tr>' +
        '<td>' + escHtml(fmtData(r.data_prevista)) + '</td>' +
        '<td class="mono">' + escHtml(r.orcamento) + '</td>' +
        '<td>' + escHtml(cliente) + '</td>' +
        '<td class="num">' + fmtInt(r.parcela) + '</td>' +
        '<td class="num">' + fmtBRL(r.valor) + '</td>' +
        '<td>' + escHtml(r.recebido_em ? fmtData(r.recebido_em) : "—") + '</td>' +
        '<td><span class="' + classe + '">' + st + '</span></td>' +
        '<td><button type="button" class="btn-acao" data-rp-edit="' + r.id + '">Editar</button></td>' +
      '</tr>';
    }).join("");
    tbody.querySelectorAll("[data-rp-edit]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = Number(b.getAttribute("data-rp-edit"));
        var rec = recebimentosPrevLista.find(function (x) { return x.id === id; });
        if (rec) abrirModalRecebPrev(rec);
      });
    });
  }

  function abrirModalRecebPrev(r) {
    var ehNovo = !r;
    var orcamentoOpts = (orcamentosLista || []).map(function (o) {
      return { value: o.orcamento, label: o.orcamento + " — " + (o.nome || "") };
    });
    abrirModal({
      titulo: ehNovo ? "Nova parcela prevista" : "Editar parcela",
      fields: [
        { name: "orcamento",     label: "Orçamento", type: "select", required: true,
          valor: r && r.orcamento, options: orcamentoOpts },
        { name: "parcela",       label: "Nº parcela",     type: "number", valor: r ? r.parcela : 1 },
        { name: "data_prevista", label: "Data prevista",  type: "date",   required: true, valor: r && r.data_prevista },
        { name: "valor",         label: "Valor",          type: "number", required: true, valor: r && r.valor },
        { name: "recebido_em",   label: "Recebido em (deixe vazio se pendente)", type: "date", valor: r && r.recebido_em },
        { name: "observacao",    label: "Observação",     type: "textarea", valor: r && r.observacao }
      ],
      onSubmit: function (values, done) {
        var payload = {
          orcamento: values.orcamento,
          parcela: Number(values.parcela) || 1,
          data_prevista: values.data_prevista,
          valor: Number(values.valor),
          recebido_em: values.recebido_em || null,
          observacao: values.observacao
        };
        var q = ehNovo
          ? client.from("recebimentos_previstos").insert(payload).select().single()
          : client.from("recebimentos_previstos").update(payload).eq("id", r.id).select().single();
        q.then(function (rs) {
          if (rs.error) { done(rs.error.message); return; }
          recebimentosPrevCarregado = false;
          carregarRecebimentosPrevistosSeNecessario();
          fluxoVisaoCarregado = false;
          done(null);
        });
      }
    });
  }

  // =========================================================================
  // FLUXO DE CAIXA — Visão 12 meses (Entrega 10)
  // =========================================================================

  var fluxoVisaoCarregado = false;

  // Caches auxiliares pra Visão 12m
  var folhaVisaoLista = [];
  var folhaVisaoCarregado = false;
  var entradasOutrasLista = [];
  var entradasOutrasCarregado = false;
  var saidasOutrasLista = [];
  var saidasOutrasCarregado = false;

  function carregarFolhaVisao() {
    folhaVisaoCarregado = false;
    return client.from("folha_pagamento").select("funcionario_id, mes_ref, liquido, salario_bruto").then(function (r) {
      folhaVisaoLista = (r && r.data) || [];
      folhaVisaoCarregado = true;
    });
  }
  function carregarEntradasOutras() {
    entradasOutrasCarregado = false;
    return client.from("entradas_outras").select("*").order("data_prevista").then(function (r) {
      entradasOutrasLista = (r && r.data) || [];
      entradasOutrasCarregado = true;
    });
  }
  function carregarSaidasOutras() {
    saidasOutrasCarregado = false;
    return client.from("saidas_outras").select("*").order("data_prevista").then(function (r) {
      saidasOutrasLista = (r && r.data) || [];
      saidasOutrasCarregado = true;
    });
  }

  function carregarFluxoVisaoSeNecessario() {
    // Garante que todas as fontes estejam carregadas
    if (!contasBancariasCarregado)   carregarContasBancariasSeNecessario();
    if (!saldosContasCarregado)      carregarSaldosContasSeNecessario();
    if (!recebimentosPrevCarregado)  carregarRecebimentosPrevistosSeNecessario();
    if (!compromissosCarregado)      carregarCompromissosSeNecessario();
    if (!orcamentosCarregados)       carregarOrcamentosSeNecessario();
    if (!folhaVisaoCarregado)        carregarFolhaVisao();
    if (!entradasOutrasCarregado)    carregarEntradasOutras();
    if (!saidasOutrasCarregado)      carregarSaidasOutras();

    var iniInput = document.getElementById("flv-mes-ini");
    if (iniInput && !iniInput.value) {
      var hoje = new Date();
      iniInput.value = hoje.getFullYear() + "-" + String(hoje.getMonth() + 1).padStart(2, "0");
    }

    var iv = setInterval(function () {
      if (contasBancariasCarregado && saldosContasCarregado && recebimentosPrevCarregado &&
          compromissosCarregado && orcamentosCarregados &&
          folhaVisaoCarregado && entradasOutrasCarregado && saidasOutrasCarregado) {
        clearInterval(iv);
        renderFluxoVisao();
      }
    }, 150);

    if (iniInput && !iniInput.dataset.bound) { iniInput.dataset.bound = "1"; iniInput.addEventListener("change", renderFluxoVisao); }
    var modo = document.getElementById("flv-modo");
    if (modo && !modo.dataset.bound) { modo.dataset.bound = "1"; modo.addEventListener("change", renderFluxoVisao); }
    var btnRec = document.getElementById("flv-btn-recarregar");
    if (btnRec && !btnRec.dataset.bound) {
      btnRec.dataset.bound = "1";
      btnRec.addEventListener("click", function () {
        contasBancariasCarregado = false; saldosContasCarregado = false;
        recebimentosPrevCarregado = false; compromissosCarregado = false;
        carregarFluxoVisaoSeNecessario();
      });
    }
  }

  function renderFluxoVisao() {
    var iniVal = (document.getElementById("flv-mes-ini")||{}).value || "";
    var modo = (document.getElementById("flv-modo")||{}).value || "comparar";
    if (!iniVal) {
      var hoje = new Date();
      iniVal = hoje.getFullYear() + "-" + String(hoje.getMonth() + 1).padStart(2, "0");
    }
    var ano = Number(iniVal.slice(0,4)), mes = Number(iniVal.slice(5,7));
    var meses = [];
    for (var i = 0; i < 12; i++) {
      var a = ano, m = mes + i;
      while (m > 12) { m -= 12; a++; }
      meses.push({ ano: a, mes: m, iso: a + "-" + String(m).padStart(2,"0") + "-01", label: mesRef(a + "-" + String(m).padStart(2,"0")) });
    }
    valText(document.getElementById("flv-lbl"), meses[0].label + " a " + meses[11].label);

    // ----- Calcula valores por mês (todos os componentes) -----
    var dadosMes = meses.map(function (m) {
      var inicioMes = m.iso;
      var fimMes = (function () { var d = new Date(m.ano, m.mes, 0); return d.toISOString().slice(0,10); })();
      var mesYM = inicioMes.slice(0, 7);

      // Saldo final realizado e projetado
      var saldosMes = saldosContasLista.filter(function (s) { return String(s.mes_ref).slice(0,10) === inicioMes; });
      var saldoFinalReal = saldosMes.reduce(function (acc, s) { return acc + Number(s.saldo_final_realizado || 0); }, 0);
      var saldoFinalProj = saldosMes.reduce(function (acc, s) { return acc + Number(s.saldo_final_projetado || s.saldo_final_realizado || 0); }, 0);
      var temReal = saldosMes.some(function (s) { return s.saldo_final_realizado != null; });
      var temProj = saldosMes.some(function (s) { return s.saldo_final_projetado != null || s.saldo_final_realizado != null; });

      // Entradas — Recebimentos previstos
      var recProj = (recebimentosPrevLista || []).filter(function (r) { return r.data_prevista >= inicioMes && r.data_prevista <= fimMes; })
        .reduce(function (acc, r) { return acc + Number(r.valor || 0); }, 0);
      var recReal = (recebimentosPrevLista || []).filter(function (r) { return r.recebido_em && r.recebido_em >= inicioMes && r.recebido_em <= fimMes; })
        .reduce(function (acc, r) { return acc + Number(r.valor || 0); }, 0);

      // Entradas — Outras (avulsas)
      var entOutProj = (entradasOutrasLista || []).filter(function (e) { return e.data_prevista >= inicioMes && e.data_prevista <= fimMes; })
        .reduce(function (acc, e) { return acc + Number(e.valor || 0); }, 0);
      var entOutReal = (entradasOutrasLista || []).filter(function (e) { return e.recebido_em && e.recebido_em >= inicioMes && e.recebido_em <= fimMes; })
        .reduce(function (acc, e) { return acc + Number(e.valor || 0); }, 0);

      // Saídas — Folha (projetado = soma do mes_ref; realizado = mesma fonte por enquanto)
      var folhaTotal = (folhaVisaoLista || []).filter(function (f) { return String(f.mes_ref).slice(0,7) === mesYM; })
        .reduce(function (acc, f) { return acc + Number(f.liquido || f.salario_bruto || 0); }, 0);

      // Saídas — Compromissos (a pagar)
      var compProj = (compromissosLista || []).filter(function (c) { return c.vencimento >= inicioMes && c.vencimento <= fimMes; })
        .reduce(function (acc, c) { return acc + Number(c.valor || 0); }, 0);
      var compReal = (compromissosLista || []).filter(function (c) { return c.pago_em && c.pago_em >= inicioMes && c.pago_em <= fimMes; })
        .reduce(function (acc, c) { return acc + Number(c.valor || 0); }, 0);

      // Saídas — Outras (avulsas)
      var saiOutProj = (saidasOutrasLista || []).filter(function (s) { return s.data_prevista >= inicioMes && s.data_prevista <= fimMes; })
        .reduce(function (acc, s) { return acc + Number(s.valor || 0); }, 0);
      var saiOutReal = (saidasOutrasLista || []).filter(function (s) { return s.pago_em && s.pago_em >= inicioMes && s.pago_em <= fimMes; })
        .reduce(function (acc, s) { return acc + Number(s.valor || 0); }, 0);

      var entProj = recProj + entOutProj;
      var entReal = recReal + entOutReal;
      var saiProj = folhaTotal + compProj + saiOutProj;
      var saiReal = folhaTotal + compReal + saiOutReal;  // Folha por enquanto vai sempre nas duas (projetado = realizado)

      return {
        mes: m, mesYM: mesYM, inicioMes: inicioMes, fimMes: fimMes,
        saldoFinalReal: temReal ? saldoFinalReal : null,
        saldoFinalProj: temProj ? saldoFinalProj : null,
        // Detalhes pra drill-down
        recProj: recProj, recReal: recReal,
        entOutProj: entOutProj, entOutReal: entOutReal,
        folhaTotal: folhaTotal,
        compProj: compProj, compReal: compReal,
        saiOutProj: saiOutProj, saiOutReal: saiOutReal,
        // Totais
        entProj: entProj, entReal: entReal,
        saiProj: saiProj, saiReal: saiReal
      };
    });

    // Saldo inicial M = saldo final M-1
    dadosMes.forEach(function (d, i) {
      d.saldoInicialReal = i === 0 ? null : (dadosMes[i-1].saldoFinalReal != null ? dadosMes[i-1].saldoFinalReal : null);
      d.saldoInicialProj = i === 0 ? null : (dadosMes[i-1].saldoFinalProj != null ? dadosMes[i-1].saldoFinalProj : null);
    });

    // Cabeçalho
    var thead = document.getElementById("flv-thead");
    var html = '<tr><th class="flv-rotulo">&nbsp;</th>';
    meses.forEach(function (m) {
      var span = (modo === "comparar") ? 2 : 1;
      html += '<th class="flv-mes" colspan="' + span + '">' + escHtml(m.label) + '</th>';
    });
    html += '</tr>';
    if (modo === "comparar") {
      html += '<tr><th class="flv-rotulo">&nbsp;</th>';
      meses.forEach(function () {
        html += '<th class="flv-sub-p">P</th><th class="flv-sub-r">R</th>';
      });
      html += '</tr>';
    }
    thead.innerHTML = html;

    // Helpers de célula clicável
    function celValor(p, r, tipoDrill, mesYM) {
      function fmt(v) { return v == null ? '<span class="muted">—</span>' : fmtBRL(v); }
      function classeNeg(v) { return (v != null && v < 0) ? "neg" : ""; }
      var clsClick = tipoDrill ? " linha-clicavel" : "";
      var dataAttr = tipoDrill ? ' data-flv-tipo="' + tipoDrill + '" data-flv-mes="' + mesYM + '"' : "";
      if (modo === "comparar") return '<td class="num ' + classeNeg(p) + clsClick + '"' + dataAttr + '>' + fmt(p) + '</td><td class="num ' + classeNeg(r) + clsClick + '"' + dataAttr + '>' + fmt(r) + '</td>';
      if (modo === "projetado") return '<td class="num ' + classeNeg(p) + clsClick + '"' + dataAttr + '>' + fmt(p) + '</td>';
      return '<td class="num ' + classeNeg(r) + clsClick + '"' + dataAttr + '>' + fmt(r) + '</td>';
    }

    var rows = [];
    rows.push('<tr class="flv-grupo"><td class="flv-rotulo">SALDO INICIAL</td>' + dadosMes.map(function (d) { return celValor(d.saldoInicialProj, d.saldoInicialReal); }).join("") + '</tr>');
    rows.push('<tr class="flv-grupo flv-entrada"><td class="flv-rotulo">+ ENTRADAS</td>' + dadosMes.map(function (d) { return celValor(d.entProj, d.entReal); }).join("") + '</tr>');
    rows.push('<tr class="flv-detalhe"><td class="flv-rotulo">&nbsp;&nbsp;Recebimentos previstos</td>' + dadosMes.map(function (d) { return celValor(d.recProj, d.recReal, "recebimentos", d.mesYM); }).join("") + '</tr>');
    rows.push('<tr class="flv-detalhe"><td class="flv-rotulo">&nbsp;&nbsp;Outras entradas</td>' + dadosMes.map(function (d) { return celValor(d.entOutProj, d.entOutReal, "entradas_outras", d.mesYM); }).join("") + '</tr>');
    rows.push('<tr class="flv-grupo flv-saida"><td class="flv-rotulo">− SAÍDAS</td>' + dadosMes.map(function (d) { return celValor(-d.saiProj, -d.saiReal); }).join("") + '</tr>');
    rows.push('<tr class="flv-detalhe"><td class="flv-rotulo">&nbsp;&nbsp;Folha de pagamento</td>' + dadosMes.map(function (d) { return celValor(-d.folhaTotal, -d.folhaTotal, "folha", d.mesYM); }).join("") + '</tr>');
    rows.push('<tr class="flv-detalhe"><td class="flv-rotulo">&nbsp;&nbsp;Contas a pagar</td>' + dadosMes.map(function (d) { return celValor(-d.compProj, -d.compReal, "compromissos", d.mesYM); }).join("") + '</tr>');
    rows.push('<tr class="flv-detalhe"><td class="flv-rotulo">&nbsp;&nbsp;Outras saídas</td>' + dadosMes.map(function (d) { return celValor(-d.saiOutProj, -d.saiOutReal, "saidas_outras", d.mesYM); }).join("") + '</tr>');
    rows.push('<tr class="flv-grupo flv-final"><td class="flv-rotulo">SALDO FINAL</td>' + dadosMes.map(function (d) { return celValor(d.saldoFinalProj, d.saldoFinalReal); }).join("") + '</tr>');

    document.getElementById("flv-tbody").innerHTML = rows.join("");

    fluxoVisaoCarregado = true;
  }

  // Drill-down ao clicar numa célula da Visão 12m
  function abrirDrillFluxoCaixa(tipo, mesYM) {
    var ini = mesYM + "-01";
    var dt = new Date(Number(mesYM.slice(0,4)), Number(mesYM.slice(5,7)), 0);
    var fim = mesYM + "-" + String(dt.getDate()).padStart(2,"0");
    var titulo, linhasHtml = "", total = 0;

    if (tipo === "recebimentos") {
      titulo = "Recebimentos previstos — " + mesRef(mesYM);
      var lista = (recebimentosPrevLista || []).filter(function (r) { return r.data_prevista >= ini && r.data_prevista <= fim; });
      total = lista.reduce(function (s, r) { return s + Number(r.valor || 0); }, 0);
      lista.sort(function (a, b) { return String(a.data_prevista).localeCompare(String(b.data_prevista)); });
      linhasHtml = lista.map(function (r) {
        var st = r.recebido_em ? '<span class="tag tag-ok">recebido</span>' : (r.data_prevista < new Date().toISOString().slice(0,10) ? '<span class="tag tag-danger">vencido</span>' : '<span class="tag tag-warn">pendente</span>');
        var cliente = clientePorOrcamento[r.orcamento] || "—";
        return '<tr>' +
          '<td>' + fmtData(r.data_prevista) + '</td>' +
          '<td class="mono">' + escHtml(r.orcamento) + '</td>' +
          '<td>' + escHtml(cliente) + '</td>' +
          '<td class="num">' + fmtInt(r.parcela) + '</td>' +
          '<td class="num">' + fmtBRL(r.valor) + '</td>' +
          '<td>' + st + '</td>' +
        '</tr>';
      }).join("");
      linhasHtml = '<table class="tabela"><thead><tr><th>Data prevista</th><th>Orçamento</th><th>Cliente</th><th class="num">Parcela</th><th class="num">Valor</th><th>Status</th></tr></thead><tbody>' + linhasHtml + '</tbody></table>';
    }
    else if (tipo === "entradas_outras") {
      titulo = "Outras entradas — " + mesRef(mesYM);
      var lista2 = (entradasOutrasLista || []).filter(function (e) { return e.data_prevista >= ini && e.data_prevista <= fim; });
      total = lista2.reduce(function (s, e) { return s + Number(e.valor || 0); }, 0);
      linhasHtml = '<table class="tabela"><thead><tr><th>Data prevista</th><th>Descrição</th><th>Recebido em</th><th class="num">Valor</th></tr></thead><tbody>' +
        lista2.map(function (e) {
          return '<tr>' +
            '<td>' + fmtData(e.data_prevista) + '</td>' +
            '<td>' + escHtml(e.descricao) + '</td>' +
            '<td>' + (e.recebido_em ? fmtData(e.recebido_em) : '<span class="muted">—</span>') + '</td>' +
            '<td class="num">' + fmtBRL(e.valor) + '</td>' +
          '</tr>';
        }).join("") + '</tbody></table>';
    }
    else if (tipo === "folha") {
      titulo = "Folha de pagamento — " + mesRef(mesYM);
      var lista3 = (folhaVisaoLista || []).filter(function (f) { return String(f.mes_ref).slice(0,7) === mesYM; });
      total = lista3.reduce(function (s, f) { return s + Number(f.liquido || f.salario_bruto || 0); }, 0);
      var nomeF = {};
      (funcionariosLista || []).forEach(function (fn) { nomeF[fn.id] = fn.nome; });
      linhasHtml = '<table class="tabela"><thead><tr><th>Funcionário</th><th class="num">Bruto</th><th class="num">Líquido</th></tr></thead><tbody>' +
        lista3.map(function (f) {
          return '<tr>' +
            '<td>' + escHtml(nomeF[f.funcionario_id] || ("ID " + f.funcionario_id)) + '</td>' +
            '<td class="num">' + fmtBRL(f.salario_bruto || 0) + '</td>' +
            '<td class="num">' + fmtBRL(f.liquido || f.salario_bruto || 0) + '</td>' +
          '</tr>';
        }).join("") + '</tbody></table>';
    }
    else if (tipo === "compromissos") {
      titulo = "Contas a pagar — " + mesRef(mesYM);
      var lista4 = (compromissosLista || []).filter(function (c) { return c.vencimento >= ini && c.vencimento <= fim; });
      total = lista4.reduce(function (s, c) { return s + Number(c.valor || 0); }, 0);
      linhasHtml = '<table class="tabela"><thead><tr><th>Vencimento</th><th>Descrição</th><th>Tipo</th><th>Pago em</th><th class="num">Valor</th></tr></thead><tbody>' +
        lista4.map(function (c) {
          return '<tr>' +
            '<td>' + fmtData(c.vencimento) + '</td>' +
            '<td>' + escHtml(c.descricao) + '</td>' +
            '<td><span class="badge-tipo">' + escHtml(c.tipo) + '</span></td>' +
            '<td>' + (c.pago_em ? fmtData(c.pago_em) : '<span class="muted">—</span>') + '</td>' +
            '<td class="num">' + fmtBRL(c.valor) + '</td>' +
          '</tr>';
        }).join("") + '</tbody></table>';
    }
    else if (tipo === "saidas_outras") {
      titulo = "Outras saídas — " + mesRef(mesYM);
      var lista5 = (saidasOutrasLista || []).filter(function (s) { return s.data_prevista >= ini && s.data_prevista <= fim; });
      total = lista5.reduce(function (s, sa) { return s + Number(sa.valor || 0); }, 0);
      linhasHtml = '<table class="tabela"><thead><tr><th>Data prevista</th><th>Descrição</th><th>Pago em</th><th class="num">Valor</th></tr></thead><tbody>' +
        lista5.map(function (s) {
          return '<tr>' +
            '<td>' + fmtData(s.data_prevista) + '</td>' +
            '<td>' + escHtml(s.descricao) + '</td>' +
            '<td>' + (s.pago_em ? fmtData(s.pago_em) : '<span class="muted">—</span>') + '</td>' +
            '<td class="num">' + fmtBRL(s.valor) + '</td>' +
          '</tr>';
        }).join("") + '</tbody></table>';
    }

    var cards =
      '<div class="grid-metrics" style="margin-bottom:14px">' +
        '<div class="metric-card"><div class="metric-label">Mês</div><div class="metric-value" style="font-size:18px">' + mesRef(mesYM) + '</div></div>' +
        '<div class="metric-card"><div class="metric-label">Total</div><div class="metric-value">' + fmtBRL(total) + '</div></div>' +
      '</div>';

    abrirModalDetalhe(titulo, cards + (linhasHtml || '<p class="muted">Sem dados.</p>'));
  }


  // =========================================================================
  // RECEITA POR FATURAMENTO (Pacote 4 da Entrega 11)
  // =========================================================================

  function carregarApropriacaoFaturamentoSeNecessario() {
    if (!orcamentosCarregados) carregarOrcamentosSeNecessario();
    if (!aprCarregado)         carregarApropriacaoSeNecessario();

    var iv = setInterval(function () {
      if (orcamentosCarregados && aprCarregado) {
        clearInterval(iv);
        renderApropriacaoFaturamento();
      }
    }, 150);

    var sel = document.getElementById("afat-ano");
    if (sel && !sel.dataset.bound) {
      sel.dataset.bound = "1";
      // default ano atual
      var anoAtual = new Date().getFullYear();
      sel.value = String(anoAtual);
      sel.addEventListener("change", renderApropriacaoFaturamento);
    }
  }

  function renderApropriacaoFaturamento() {
    var sel = document.getElementById("afat-ano");
    var ano = Number((sel && sel.value) || new Date().getFullYear());
    var inicioAno = ano + "-01-01";
    var fimAno    = ano + "-12-31";

    // -------- Faturado por mês: soma de movimentos.natureza='Nota Fiscal' no ano
    var fatMes = {};
    for (var m = 1; m <= 12; m++) fatMes[m] = 0;
    (movimentosCompletos || []).forEach(function (mv) {
      if (mv.natureza !== "Nota Fiscal") return;
      var d = String(mv.data || "").slice(0, 10);
      if (d < inicioAno || d > fimAno) return;
      var mes = Number(d.slice(5, 7));
      fatMes[mes] += Number(mv.valor || 0);
    });

    // -------- Apropriado por mês: usa a regra calcOsAno já implementada
    var aprMes = {};
    for (var m2 = 1; m2 <= 12; m2++) aprMes[m2] = 0;
    var idxEvol = indexarEvolucao();
    (osLista || []).forEach(function (o) {
      var calc = calcOsAno(o, idxEvol, ano);
      calc.meses.forEach(function (linha) {
        // mes_ref vem como "YYYY-MM"
        var mes = Number(String(linha.mes).slice(5, 7));
        aprMes[mes] += Number(linha.rec || 0);
      });
    });

    // -------- Totais
    var totFat = 0, totApr = 0;
    for (var k = 1; k <= 12; k++) { totFat += fatMes[k]; totApr += aprMes[k]; }
    var totDif = totFat - totApr;

    valText(document.getElementById("afat-m-fat"), fmtBRL(totFat));
    valText(document.getElementById("afat-m-apr"), fmtBRL(totApr));
    valText(document.getElementById("afat-m-dif"),
      (totDif >= 0 ? "+" : "") + fmtBRL(totDif));
    valText(document.getElementById("afat-lbl"), "Ano: " + ano);

    // -------- Linhas da tabela
    var nomesMes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    var linhas = [];
    for (var i = 1; i <= 12; i++) {
      var fat = fatMes[i], apr = aprMes[i];
      var dif = fat - apr;
      var status, classe;
      if (Math.abs(dif) < 1) { status = "Em dia"; classe = "tag tag-ok"; }
      else if (dif > 0)       { status = "Faturado adiantado"; classe = "tag tag-warn"; }
      else                    { status = "Faturado atrasado"; classe = "tag tag-danger"; }
      linhas.push('<tr>' +
        '<td>' + nomesMes[i-1] + '/' + ano + '</td>' +
        '<td class="num">' + fmtBRL(fat) + '</td>' +
        '<td class="num">' + fmtBRL(apr) + '</td>' +
        '<td class="num ' + (dif < 0 ? "neg" : "") + '">' + (dif >= 0 ? "+" : "") + fmtBRL(dif) + '</td>' +
        '<td><span class="' + classe + '">' + status + '</span></td>' +
      '</tr>');
    }
    // Linha total
    linhas.push('<tr class="tot">' +
      '<td><strong>TOTAL ' + ano + '</strong></td>' +
      '<td class="num"><strong>' + fmtBRL(totFat) + '</strong></td>' +
      '<td class="num"><strong>' + fmtBRL(totApr) + '</strong></td>' +
      '<td class="num ' + (totDif < 0 ? "neg" : "") + '"><strong>' + (totDif >= 0 ? "+" : "") + fmtBRL(totDif) + '</strong></td>' +
      '<td>—</td>' +
    '</tr>');

    document.getElementById("afat-tbody").innerHTML = linhas.join("");
  }


  // =========================================================================
  // CUSTOS — Pacote 5
  // =========================================================================

  // -------- Helper genérico: popular select de ano com 2024..2027 --------
  function popularSelectAno(sel) {
    if (!sel || sel.dataset.bound) return;
    sel.dataset.bound = "1";
    var anos = [];
    for (var a = 2024; a <= 2027; a++) anos.push(a);
    sel.innerHTML = anos.map(function (a) { return '<option value="' + a + '">' + a + '</option>'; }).join("");
    sel.value = String(new Date().getFullYear());
  }

  // -------- Custo Direto — Via OS (os_evolucao_mensal) --------
  function carregarCustoDiretoViaOsSeNecessario() {
    if (!aprCarregado) carregarApropriacaoSeNecessario();
    if (!orcamentosCarregados) carregarOrcamentosSeNecessario();
    var iv = setInterval(function () {
      if (aprCarregado && orcamentosCarregados) {
        clearInterval(iv);
        renderCustoDiretoViaOs();
      }
    }, 150);
    popularSelectAno(document.getElementById("cdvos-ano"));
    ["cdvos-busca","cdvos-ano"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el.dataset.boundEv) { el.dataset.boundEv = "1"; el.addEventListener("input", renderCustoDiretoViaOs); el.addEventListener("change", renderCustoDiretoViaOs); }
    });
    var btn = document.getElementById("cdvos-btn-limpar");
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = "1";
      btn.addEventListener("click", function () {
        var b = document.getElementById("cdvos-busca"); if (b) b.value = "";
        renderCustoDiretoViaOs();
      });
    }
  }

  function renderCustoDiretoViaOs() {
    var tbody = document.getElementById("cdvos-tbody");
    if (!tbody) return;
    var ano = Number((document.getElementById("cdvos-ano") || {}).value || new Date().getFullYear());
    var busca = ((document.getElementById("cdvos-busca") || {}).value || "").trim().toLowerCase();
    var anoStr = String(ano);

    // Agrega por OS no ano
    var porOs = {};
    (osEvolLista || []).forEach(function (e) {
      var mr = String(e.mes_ref || "").slice(0, 7);
      if (!mr.startsWith(anoStr)) return;
      var c = Number(e.custo_saida || 0);
      if (c <= 0) return;
      if (!porOs[e.os]) porOs[e.os] = { os: e.os, total: 0, meses: 0 };
      porOs[e.os].total += c;
      porOs[e.os].meses += 1;
    });

    // Mapa OS → cliente (via osLista que tem orcamento + nome)
    var clientePorOs = {};
    (osLista || []).forEach(function (o) { clientePorOs[o.os] = o.cliente || o.nome_cliente || o.orcamento_nome || ""; });

    var lista = Object.keys(porOs).map(function (os) {
      var r = porOs[os];
      r.cliente = clientePorOs[os] || "—";
      return r;
    }).filter(function (r) {
      if (!busca) return true;
      return matchBusca(busca, [r.os, r.cliente]);
    });
    lista.sort(function (a, b) { return b.total - a.total; });

    var totalAno = lista.reduce(function (a, r) { return a + r.total; }, 0);
    var qtd = lista.length;
    var ticket = qtd ? totalAno / qtd : 0;

    valText(document.getElementById("cdvos-m-tot"), fmtBRL(totalAno));
    valText(document.getElementById("cdvos-m-qtd"), fmtInt(qtd));
    valText(document.getElementById("cdvos-m-tk"),  fmtBRL(ticket));
    valText(document.getElementById("cdvos-lbl"), "Ano " + ano + " — " + qtd + " OSs");

    if (!lista.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="tbl-vazio">Sem baixas de estoque no período.</td></tr>';
      return;
    }
    tbody.innerHTML = lista.map(function (r) {
      return '<tr>' +
        '<td class="mono">' + escHtml(r.os) + '</td>' +
        '<td>' + escHtml(r.cliente) + '</td>' +
        '<td class="num">' + fmtInt(r.meses) + '</td>' +
        '<td class="num">' + fmtBRL(r.total) + '</td>' +
      '</tr>';
    }).join("");
  }

  // -------- Custo Direto — Lançamento Direto (aproximação sem plano_contas_id) --------
  function carregarCustoDiretoLancSeNecessario() {
    if (!orcamentosCarregados) carregarOrcamentosSeNecessario();
    if (!pcCarregado)          carregarPlanoContasSeNecessario();
    var iv = setInterval(function () {
      if (orcamentosCarregados && pcCarregado) { clearInterval(iv); renderCustoDiretoLanc(); }
    }, 150);
    popularSelectAno(document.getElementById("cdlanc-ano"));
    ["cdlanc-busca","cdlanc-ano"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el.dataset.boundEv) { el.dataset.boundEv = "1"; el.addEventListener("input", renderCustoDiretoLanc); el.addEventListener("change", renderCustoDiretoLanc); }
    });
    var btn = document.getElementById("cdlanc-btn-limpar");
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = "1";
      btn.addEventListener("click", function () {
        var b = document.getElementById("cdlanc-busca"); if (b) b.value = "";
        renderCustoDiretoLanc();
      });
    }
  }

  function renderCustoDiretoLanc() {
    var tbody = document.getElementById("cdlanc-tbody");
    if (!tbody) return;
    var ano = Number((document.getElementById("cdlanc-ano") || {}).value || new Date().getFullYear());
    var busca = ((document.getElementById("cdlanc-busca") || {}).value || "").trim().toLowerCase();
    var ini = ano + "-01-01", fim = ano + "-12-31";

    // Mapa plano_contas_id → conta (DRE, descritivo)
    var contaPorId = {};
    (planoContas || []).forEach(function (p) { contaPorId[p.id] = p; });

    var temPlano = pcCarregado && Object.keys(contaPorId).length > 0;
    var classificadosCount = 0;
    var totalCustoSemOs = 0;

    var lista = (movimentosCompletos || []).filter(function (m) {
      var d = String(m.data || "").slice(0, 10);
      if (d < ini || d > fim) return false;
      // Sem OS preenchida (lançamento direto, não via produção)
      if (m.os && String(m.os).trim() !== "") return false;

      var conta = m.plano_contas_id ? contaPorId[m.plano_contas_id] : null;
      if (m.plano_contas_id) classificadosCount++;

      // Filtro principal: tem que ser custo direto (DRE = CPV - Matéria Prima ou CPV - Viagens)
      // ou — se não tem conta classificada — fallback heurístico (modo legacy)
      var ehCustoDireto = false;
      if (conta && conta.dre) {
        ehCustoDireto = /CPV - Matéria Prima|CPV - Viagens/i.test(conta.dre);
      } else if (!temPlano) {
        // Sem plano carregado — usa heurística antiga
        ehCustoDireto = (m.custo != null && Number(m.custo) > 0)
                     || /resultado financeiro|outras despesas|fornecedor/i.test(String(m.natureza || ""));
      } else {
        // Plano carregado mas movimento sem plano_contas_id — não classificado
        return false;
      }
      if (!ehCustoDireto) return false;

      totalCustoSemOs += Number(m.valor || m.custo || 0);
      if (busca) {
        var dreTxt = conta ? conta.dre : "";
        var descrTxt = conta ? conta.descritivo : "";
        return matchBusca(busca, [m.orcamento, m.nome, m.item, m.natureza, dreTxt, descrTxt]);
      }
      return true;
    });
    lista.sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });

    var total = lista.reduce(function (a, m) { return a + Number(m.valor || m.custo || 0); }, 0);
    var totalMovs = (movimentosCompletos || []).length;
    var pctClassif = totalMovs > 0 ? Math.round((classificadosCount / totalMovs) * 100) : 0;
    valText(document.getElementById("cdlanc-lbl"),
      "Ano " + ano + " — " + lista.length + " lançamentos · " + fmtBRL(total) +
      (temPlano ? " · " + pctClassif + "% movs classificados" : " · plano de contas não carregado")
    );

    if (!lista.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="tbl-vazio">Sem lançamentos diretos (CPV - Matéria Prima / CPV - Viagens) no período.</td></tr>';
      return;
    }
    tbody.innerHTML = lista.slice(0, 200).map(function (m) {
      var conta = m.plano_contas_id ? contaPorId[m.plano_contas_id] : null;
      var dreTxt = conta ? conta.dre : '<span class="muted">não classif.</span>';
      return '<tr>' +
        '<td>' + escHtml(fmtData(m.data)) + '</td>' +
        '<td class="mono">' + escHtml(m.orcamento || "—") + '</td>' +
        '<td>' + escHtml(m.nome || "—") + '</td>' +
        '<td>' + escHtml(m.item || "—") + '</td>' +
        '<td>' + dreTxt + '</td>' +
        '<td class="num">' + fmtBRL(m.valor || m.custo || 0) + '</td>' +
      '</tr>';
    }).join("") + (lista.length > 200 ? '<tr><td colspan="6" class="tbl-vazio">… exibindo 200 de ' + lista.length + '.</td></tr>' : "");
  }

  // -------- Custo Indireto — folha de funcionários com CC tipo Indireto --------
  var folhaCustoCarregado = false;
  var folhaCustoLista = [];

  function carregarCustoIndiretoSeNecessario() {
    if (!folhaCustoCarregado) {
      Promise.all([
        client.from("folha_pagamento").select("funcionario_id, mes_ref, salario_bruto, liquido"),
        client.from("funcionarios").select("id, centro_custo_id"),
        client.from("centros_custo").select("id, codigo, descricao, tipo_custo, dre")
      ]).then(function (rs) {
        var fp = (rs[0] && rs[0].data) || [];
        var fn = (rs[1] && rs[1].data) || [];
        var cc = (rs[2] && rs[2].data) || [];
        var ccPorId = {}; cc.forEach(function (c) { ccPorId[c.id] = c; });
        var ccPorFunc = {}; fn.forEach(function (f) { ccPorFunc[f.id] = ccPorId[f.centro_custo_id]; });
        folhaCustoLista = fp.map(function (l) {
          var cc = ccPorFunc[l.funcionario_id];
          return {
            funcionario_id: l.funcionario_id,
            mes_ref: l.mes_ref,
            valor: Number(l.salario_bruto || l.liquido || 0),
            cc_codigo: cc && cc.codigo,
            cc_desc: cc && cc.descricao,
            cc_tipo: cc && cc.tipo_custo
          };
        });
        folhaCustoCarregado = true;
        renderCustoIndireto();
      });
    } else {
      renderCustoIndireto();
    }
    popularSelectAno(document.getElementById("cind-ano"));
    var sel = document.getElementById("cind-ano");
    if (sel && !sel.dataset.boundEv) { sel.dataset.boundEv = "1"; sel.addEventListener("change", renderCustoIndireto); }
  }

  function renderCustoIndireto() {
    var tbody = document.getElementById("cind-tbody");
    if (!tbody) return;
    var ano = Number((document.getElementById("cind-ano") || {}).value || new Date().getFullYear());
    var anoStr = String(ano);

    var indireta = folhaCustoLista.filter(function (l) {
      return l.cc_tipo === "indireto" && String(l.mes_ref || "").startsWith(anoStr);
    });
    var porMes = {};
    var funcSet = {};
    for (var i = 1; i <= 12; i++) porMes[i] = { total: 0, hc: {} };
    indireta.forEach(function (l) {
      var mes = Number(String(l.mes_ref).slice(5, 7));
      if (!porMes[mes]) porMes[mes] = { total: 0, hc: {} };
      porMes[mes].total += l.valor;
      porMes[mes].hc[l.funcionario_id] = true;
      funcSet[l.funcionario_id] = true;
    });
    var totAno = indireta.reduce(function (a, l) { return a + l.valor; }, 0);

    valText(document.getElementById("cind-m-tot"),  fmtBRL(totAno));
    valText(document.getElementById("cind-m-func"), fmtInt(Object.keys(funcSet).length));
    valText(document.getElementById("cind-m-med"),  fmtBRL(totAno / 12));
    valText(document.getElementById("cind-lbl"), "Ano " + ano);

    var nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    var html = "";
    for (var m = 1; m <= 12; m++) {
      var d = porMes[m];
      html += '<tr>' +
        '<td>' + nomes[m-1] + '/' + ano + '</td>' +
        '<td class="num">' + fmtBRL(d.total) + '</td>' +
        '<td class="num">' + fmtInt(Object.keys(d.hc).length) + '</td>' +
      '</tr>';
    }
    html += '<tr class="tot"><td><strong>TOTAL</strong></td><td class="num"><strong>' + fmtBRL(totAno) + '</strong></td><td class="num">—</td></tr>';
    tbody.innerHTML = html;

    if (!indireta.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="tbl-vazio">Sem folha de pagamento de CCs Indiretos no período. Cadastre folha em RH > Folha de Pagamento ou ajuste o tipo_custo dos CCs em Configuração > Centros de Custo.</td></tr>';
    }
  }

  // -------- Custo por Área (consolidado de folha por CC) --------
  function carregarCustoAreaSeNecessario() {
    if (!folhaCustoCarregado) carregarCustoIndiretoSeNecessario(); // reusa carga
    var iv = setInterval(function () {
      if (folhaCustoCarregado) { clearInterval(iv); renderCustoArea(); }
    }, 150);
    popularSelectAno(document.getElementById("carea-ano"));
    var sel = document.getElementById("carea-ano");
    if (sel && !sel.dataset.boundEv2) { sel.dataset.boundEv2 = "1"; sel.addEventListener("change", renderCustoArea); }
  }

  function renderCustoArea() {
    var tbody = document.getElementById("carea-tbody");
    if (!tbody) return;
    var ano = Number((document.getElementById("carea-ano") || {}).value || new Date().getFullYear());
    var anoStr = String(ano);

    var noAno = folhaCustoLista.filter(function (l) { return String(l.mes_ref || "").startsWith(anoStr); });
    var porCc = {};
    noAno.forEach(function (l) {
      var key = (l.cc_codigo || "(sem CC)") + "|" + (l.cc_desc || "—") + "|" + (l.cc_tipo || "—");
      if (!porCc[key]) porCc[key] = { codigo: l.cc_codigo || "(sem CC)", desc: l.cc_desc || "—", tipo: l.cc_tipo, total: 0, hc: {} };
      porCc[key].total += l.valor;
      porCc[key].hc[l.funcionario_id] = true;
    });
    var lista = Object.values(porCc);
    lista.sort(function (a, b) { return b.total - a.total; });

    var totGeral = lista.reduce(function (a, c) { return a + c.total; }, 0);
    var hcTotal = noAno.reduce(function (s, l) { return s; }, 0); // recalcular
    var allFuncs = {}; noAno.forEach(function (l) { allFuncs[l.funcionario_id] = true; });
    var hcGeral = Object.keys(allFuncs).length;

    valText(document.getElementById("carea-m-tot"), fmtBRL(totGeral));
    var top = lista[0];
    valText(document.getElementById("carea-m-top"), top ? top.desc : "—");
    valText(document.getElementById("carea-m-top-pct"), top && totGeral ? ((top.total / totGeral) * 100).toFixed(1) + "% do total" : "—");
    valText(document.getElementById("carea-m-hc"), fmtInt(hcGeral));
    valText(document.getElementById("carea-lbl"), "Ano " + ano + " — " + lista.length + " CCs");

    var tipoLabel = { direto: "Direto", indireto: "Indireto", despesa: "Despesa" };
    var tipoClasse = { direto: "tag-ok", indireto: "tag-warn", despesa: "" };

    if (!lista.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="tbl-vazio">Sem folha de pagamento no período.</td></tr>';
      return;
    }
    tbody.innerHTML = lista.map(function (c) {
      var pct = totGeral ? ((c.total / totGeral) * 100).toFixed(1) : "0.0";
      var tag = tipoLabel[c.tipo] || "—";
      var cls = tipoClasse[c.tipo] || "";
      return '<tr>' +
        '<td><strong>' + escHtml(c.codigo) + '</strong> — ' + escHtml(c.desc) + '</td>' +
        '<td><span class="tag ' + cls + '">' + tag + '</span></td>' +
        '<td class="num">' + fmtInt(Object.keys(c.hc).length) + '</td>' +
        '<td class="num">' + fmtBRL(c.total) + '</td>' +
        '<td class="num">' + pct + '%</td>' +
      '</tr>';
    }).join("") + '<tr class="tot"><td colspan="3"><strong>TOTAL</strong></td><td class="num"><strong>' + fmtBRL(totGeral) + '</strong></td><td class="num">100,0%</td></tr>';
  }


  // =========================================================================
  // MODAIS DE DETALHE (Pacote 6 da Entrega 11)
  // =========================================================================

  // Modal genérico de exibição (não-form). Usa overlay próprio, não interfere
  // no abrirModal() de CRUD.
  function abrirModalDetalhe(titulo, contentHtml) {
    // Remove qualquer modal de detalhe anterior
    var anterior = document.getElementById("modal-detalhe-overlay");
    if (anterior) anterior.parentNode.removeChild(anterior);

    var html =
      '<div class="modal-overlay" id="modal-detalhe-overlay">' +
        '<div class="modal-content modal-detalhe">' +
          '<h2>' + escHtml(titulo) + '</h2>' +
          '<div class="modal-detalhe-body">' + contentHtml + '</div>' +
          '<div class="modal-acoes">' +
            '<button type="button" class="btn-limpar" id="modal-detalhe-fechar">Fechar</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    var div = document.createElement("div");
    div.innerHTML = html;
    document.body.appendChild(div.firstChild);

    function fechar() {
      var ov = document.getElementById("modal-detalhe-overlay");
      if (ov) ov.parentNode.removeChild(ov);
    }
    document.getElementById("modal-detalhe-fechar").addEventListener("click", fechar);
    document.getElementById("modal-detalhe-overlay").addEventListener("click", function (ev) {
      if (ev.target.id === "modal-detalhe-overlay") fechar();
    });
  }

  // ----- Detalhe de Orçamento (clica em linha de Vendas ou Gestão Faturamento) -----
  function abrirDetalheOrcamento(orcamento) {
    var orc = (orcamentosLista || []).filter(function (o) { return o.orcamento === orcamento; })[0];
    if (!orc) { abrirModalDetalhe("Orçamento " + orcamento, "<p class=\"muted\">Orçamento não encontrado.</p>"); return; }

    var movs = (movimentosCompletos || []).filter(function (m) { return m.orcamento === orcamento; });
    var tipo = tipoPorOrcamento[orcamento] || "—";

    // Cards de status financeiro
    var cards =
      '<div class="grid-metrics" style="margin-bottom:14px">' +
        '<div class="metric-card"><div class="metric-label">Venda</div><div class="metric-value">' + fmtBRL(orc.venda) + '</div></div>' +
        '<div class="metric-card"><div class="metric-label">Recebido</div><div class="metric-value">' + fmtBRL(orc.recebimento) + '</div></div>' +
        '<div class="metric-card"><div class="metric-label">A Receber</div><div class="metric-value ' + (Number(orc.a_receber)>0 ? 'destaque':'') + '">' + fmtBRL(orc.a_receber) + '</div></div>' +
        '<div class="metric-card"><div class="metric-label">NF Emitida</div><div class="metric-value">' + fmtBRL(orc.nota_fiscal) + '</div></div>' +
        '<div class="metric-card"><div class="metric-label">A Faturar</div><div class="metric-value ' + (Number(orc.a_faturar)>0 ? 'destaque':'') + '">' + fmtBRL(orc.a_faturar) + '</div></div>' +
      '</div>';

    // Header
    var header =
      '<p style="margin:0 0 12px"><strong>Cliente:</strong> ' + escHtml(orc.nome || '—') + ' · ' +
      '<strong>Tipo:</strong> ' + badgeTipo(tipo) + ' · ' +
      '<strong>Data:</strong> ' + fmtData(orc.data) + ' · ' +
      '<strong>Parceiro:</strong> ' + escHtml(orc.parceiro || '—') + '</p>';

    // Movimentos vinculados
    movs.sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
    var movHtml;
    if (!movs.length) {
      movHtml = '<p class="muted">Nenhum movimento registrado para este orçamento.</p>';
    } else {
      movHtml = '<div class="table-wrap" style="max-height:300px;overflow-y:auto">' +
        '<table class="tabela"><thead><tr><th>Data</th><th>Natureza</th><th>NF</th><th>OS</th><th>Item</th><th class="num">Valor</th></tr></thead>' +
        '<tbody>' + movs.map(function (m) {
          return '<tr>' +
            '<td>' + fmtData(m.data) + '</td>' +
            '<td>' + escHtml(m.natureza || '—') + '</td>' +
            '<td class="mono">' + escHtml(m.nota_fiscal || '—') + '</td>' +
            '<td class="mono">' + escHtml(m.os || '—') + '</td>' +
            '<td>' + escHtml(m.item || '—') + '</td>' +
            '<td class="num">' + fmtBRL(m.valor) + '</td>' +
          '</tr>';
        }).join("") + '</tbody></table></div>';
    }

    abrirModalDetalhe("Orçamento " + orcamento,
      header + cards +
      '<h3 style="margin:14px 0 8px">Movimentos vinculados (' + movs.length + ')</h3>' + movHtml
    );
  }

  // ----- Detalhe de Movimento (Lançamento ou NF) -----
  function abrirDetalheMovimento(mvId) {
    var mv = (movimentosCompletos || []).filter(function (m) { return String(m.id) === String(mvId); })[0];
    if (!mv) { abrirModalDetalhe("Lançamento", "<p class=\"muted\">Lançamento não encontrado.</p>"); return; }

    var ehNF = mv.natureza === "Nota Fiscal";
    var titulo = ehNF ? ("NF " + (mv.nota_fiscal || mv.id)) : ("Lançamento #" + mv.id);

    // Campos do movimento
    var campos =
      '<div class="grid-metrics" style="margin-bottom:14px">' +
        '<div class="metric-card"><div class="metric-label">Data</div><div class="metric-value" style="font-size:18px">' + fmtData(mv.data) + '</div></div>' +
        '<div class="metric-card"><div class="metric-label">Valor</div><div class="metric-value">' + fmtBRL(mv.valor) + '</div></div>' +
        '<div class="metric-card"><div class="metric-label">Natureza</div><div class="metric-value" style="font-size:16px">' + escHtml(mv.natureza || '—') + '</div></div>' +
      '</div>' +
      '<table class="tabela tabela-mini" style="margin-bottom:14px"><tbody>' +
        '<tr><th>Orçamento</th><td class="mono">' + escHtml(mv.orcamento || '—') + '</td></tr>' +
        '<tr><th>Cliente</th><td>' + escHtml(mv.nome || '—') + '</td></tr>' +
        '<tr><th>Tipo</th><td>' + badgeTipo(mv.tipo || '—') + '</td></tr>' +
        '<tr><th>Nota Fiscal</th><td class="mono">' + escHtml(mv.nota_fiscal || '—') + '</td></tr>' +
        '<tr><th>OS</th><td class="mono">' + escHtml(mv.os || '—') + '</td></tr>' +
        '<tr><th>Item</th><td>' + escHtml(mv.item || '—') + '</td></tr>' +
        '<tr><th>Custo</th><td>' + (mv.custo != null ? fmtBRL(mv.custo) : '—') + '</td></tr>' +
        '<tr><th>Comentários</th><td>' + escHtml(mv.comentarios || '—') + '</td></tr>' +
      '</tbody></table>';

    // Outros movimentos do mesmo orçamento
    var irmaos = (movimentosCompletos || []).filter(function (m) {
      return mv.orcamento && m.orcamento === mv.orcamento && m.id !== mv.id;
    });
    irmaos.sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });

    var irmHtml = "";
    if (mv.orcamento && irmaos.length) {
      irmHtml = '<h3 style="margin:14px 0 8px">Outros lançamentos do orçamento ' + escHtml(mv.orcamento) + ' (' + irmaos.length + ')</h3>' +
        '<div class="table-wrap" style="max-height:240px;overflow-y:auto">' +
        '<table class="tabela"><thead><tr><th>Data</th><th>Natureza</th><th>OS</th><th class="num">Valor</th></tr></thead><tbody>' +
        irmaos.slice(0, 50).map(function (m) {
          return '<tr>' +
            '<td>' + fmtData(m.data) + '</td>' +
            '<td>' + escHtml(m.natureza || '—') + '</td>' +
            '<td class="mono">' + escHtml(m.os || '—') + '</td>' +
            '<td class="num">' + fmtBRL(m.valor) + '</td>' +
          '</tr>';
        }).join("") +
        (irmaos.length > 50 ? '<tr><td colspan="4" class="tbl-vazio">… 50 de ' + irmaos.length + '</td></tr>' : '') +
        '</tbody></table></div>';
    }

    abrirModalDetalhe(titulo, campos + irmHtml);
  }

  // ----- Detalhe de Despesa/Custo (clica em linha de Despesas) -----
  function abrirDetalheDespesa(key) {
    var partes = (key || "").split("|");
    var nomesMes = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
    var prefixo, ano, mes, chaveExtra;
    if (partes[0] === "rc" || partes[0] === "mov") {
      prefixo = partes[0];
      ano = Number(partes[1]); mes = Number(partes[2]); chaveExtra = partes[3] || "";
    } else {
      prefixo = "rc"; ano = Number(partes[0]); mes = Number(partes[1]); chaveExtra = partes[2] || "";
    }

    if (prefixo === "rc") {
      var titulo = "Despesa — " + (chaveExtra || "(sem subcategoria)") + " · " + nomesMes[mes-1] + "/" + ano;
      var linha = (rcLista || []).filter(function (r) {
        return r.categoria === "custo" && r.ano === ano && r.mes === mes && (r.subcategoria || "") === chaveExtra;
      })[0];
      var info = "";
      if (linha) {
        info = '<table class="tabela tabela-mini" style="margin-bottom:14px"><tbody>' +
          '<tr><th>Ano</th><td>' + ano + '</td></tr>' +
          '<tr><th>Mês</th><td>' + nomesMes[mes-1] + '</td></tr>' +
          '<tr><th>Subcategoria</th><td>' + escHtml(chaveExtra || '—') + '</td></tr>' +
          '<tr><th>Valor agregado</th><td>' + fmtBRL(linha.valor) + '</td></tr>' +
        '</tbody></table>';
      }
      var aviso = '<div class="status alerta" style="margin:10px 0">' +
        '⚠ Esta linha vem de <code>receitas_custos</code> (agregado mensal). Para ver lançamentos individuais, troque a fonte da tela para <strong>"Lançamentos classificados (movimentos)"</strong>.' +
        '</div>';
      abrirModalDetalhe(titulo, info + aviso);
      return;
    }

    // prefixo === "mov"
    var dre = chaveExtra;
    var titulo2 = "Despesa — " + dre + " · " + nomesMes[mes-1] + "/" + ano;
    var contaPorId = {};
    (planoContas || []).forEach(function (p) { contaPorId[p.id] = p; });

    var ini = ano + "-" + String(mes).padStart(2, "0") + "-01";
    var d2 = new Date(ano, mes, 0);
    var fim = ano + "-" + String(mes).padStart(2, "0") + "-" + String(d2.getDate()).padStart(2, "0");

    var movs = (movimentosCompletos || []).filter(function (m) {
      if (!m.plano_contas_id) return false;
      var conta = contaPorId[m.plano_contas_id];
      if (!conta || conta.dre !== dre) return false;
      var d = String(m.data || "").slice(0, 10);
      if (d < ini || d > fim) return false;
      return true;
    });
    movs.sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
    var totalMov = movs.reduce(function (s, m) { return s + Number(m.valor || m.custo || 0); }, 0);

    var cards =
      '<div class="grid-metrics" style="margin-bottom:14px">' +
        '<div class="metric-card"><div class="metric-label">Lançamentos</div><div class="metric-value">' + fmtInt(movs.length) + '</div></div>' +
        '<div class="metric-card"><div class="metric-label">Total</div><div class="metric-value">' + fmtBRL(totalMov) + '</div></div>' +
        '<div class="metric-card"><div class="metric-label">Ticket médio</div><div class="metric-value">' + (movs.length ? fmtBRL(totalMov / movs.length) : "—") + '</div></div>' +
      '</div>';

    var tabela;
    if (!movs.length) {
      tabela = '<p class="muted">Nenhum movimento classificado para esta DRE/mês.</p>';
    } else {
      tabela = '<div class="table-wrap" style="max-height:380px;overflow-y:auto">' +
        '<table class="tabela"><thead><tr><th>Data</th><th>Orçamento</th><th>Cliente</th><th>Item</th><th>Conta</th><th class="num">Valor</th></tr></thead><tbody>' +
        movs.slice(0, 200).map(function (m) {
          var conta = contaPorId[m.plano_contas_id];
          return '<tr>' +
            '<td>' + fmtData(m.data) + '</td>' +
            '<td class="mono">' + escHtml(m.orcamento || '—') + '</td>' +
            '<td>' + escHtml(m.nome || '—') + '</td>' +
            '<td>' + escHtml(m.item || '—') + '</td>' +
            '<td><span class="muted">' + escHtml((conta && conta.descritivo) || '—') + '</span></td>' +
            '<td class="num">' + fmtBRL(m.valor || m.custo || 0) + '</td>' +
          '</tr>';
        }).join("") +
        (movs.length > 200 ? '<tr><td colspan="6" class="tbl-vazio">… 200 de ' + movs.length + '</td></tr>' : '') +
        '</tbody></table></div>';
    }

    abrirModalDetalhe(titulo2, cards + tabela);
  }


  // =========================================================================
  // ENTRADAS AVULSAS — UI completa (Pacote 3)
  // =========================================================================

  function carregarEntradasOutrasSeNecessario() {
    if (!entradasOutrasCarregado) {
      carregarEntradasOutras().then(function () { renderEntradasOutras(); popularContasEO_SO(); });
    } else {
      renderEntradasOutras();
      popularContasEO_SO();
    }
    if (!contasBancariasCarregado) carregarContasBancariasSeNecessario();

    var btn = document.getElementById("eo-btn-novo");
    if (btn && !btn.dataset.bound) { btn.dataset.bound = "1"; btn.addEventListener("click", function () { abrirModalEntradaOutra(null); }); }
    ["eo-busca","eo-status"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el.dataset.bound) { el.dataset.bound = "1"; el.addEventListener("input", renderEntradasOutras); el.addEventListener("change", renderEntradasOutras); }
    });
    var btnLimpar = document.getElementById("eo-btn-limpar");
    if (btnLimpar && !btnLimpar.dataset.bound) {
      btnLimpar.dataset.bound = "1";
      btnLimpar.addEventListener("click", function () {
        var b = document.getElementById("eo-busca"); if (b) b.value = "";
        var s = document.getElementById("eo-status"); if (s) s.value = "";
        renderEntradasOutras();
      });
    }
  }

  function popularContasEO_SO() {
    // Helper dummy — o select de conta é populado dentro do modal via opcoesContasBancarias()
  }
  function opcoesContasBancarias() {
    var lista = (contasBancariasLista || []).filter(function (c) { return c.ativa; });
    var opts = [{ value: "", label: "(sem conta vinculada)" }];
    lista.forEach(function (c) { opts.push({ value: c.id, label: c.nome + " — " + c.banco }); });
    return opts;
  }

  function renderEntradasOutras() {
    var tbody = document.getElementById("eo-tbody");
    if (!tbody) return;
    var busca = ((document.getElementById("eo-busca")||{}).value || "").trim().toLowerCase();
    var status = ((document.getElementById("eo-status")||{}).value || "").trim();
    var contasMap = {};
    (contasBancariasLista || []).forEach(function (c) { contasMap[c.id] = c; });
    var filtrados = (entradasOutrasLista || []).filter(function (e) {
      if (busca && !matchBusca(busca, [e.descricao, e.observacao])) return false;
      if (status === "pendente" && e.recebido_em) return false;
      if (status === "recebido" && !e.recebido_em) return false;
      return true;
    });
    var totalPrev = filtrados.reduce(function (s, e) { return s + Number(e.valor || 0); }, 0);
    var pendentes = filtrados.filter(function (e) { return !e.recebido_em; }).length;
    var recebidos = filtrados.filter(function (e) { return !!e.recebido_em; }).length;
    valText(document.getElementById("eo-m-pen"), fmtInt(pendentes));
    valText(document.getElementById("eo-m-tot"), fmtBRL(totalPrev));
    valText(document.getElementById("eo-m-rec"), fmtInt(recebidos));
    valText(document.getElementById("eo-lbl"), filtrados.length + " de " + (entradasOutrasLista || []).length);

    if (!filtrados.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="tbl-vazio">Nenhuma entrada avulsa. Clique em + Nova entrada.</td></tr>';
      return;
    }
    tbody.innerHTML = filtrados.map(function (e) {
      var st = e.recebido_em ? '<span class="tag tag-ok">Recebido</span>' : '<span class="tag tag-warn">Pendente</span>';
      var conta = contasMap[e.conta_id];
      return '<tr>' +
        '<td>' + fmtData(e.data_prevista) + '</td>' +
        '<td>' + escHtml(e.descricao) + '</td>' +
        '<td>' + (conta ? escHtml(conta.nome) : '<span class="muted">—</span>') + '</td>' +
        '<td class="num">' + fmtBRL(e.valor) + '</td>' +
        '<td>' + (e.recebido_em ? fmtData(e.recebido_em) : '<span class="muted">—</span>') + '</td>' +
        '<td>' + st + '</td>' +
        '<td><button class="btn-acao" data-eo-edit="' + e.id + '">Editar</button></td>' +
      '</tr>';
    }).join("");
    tbody.querySelectorAll("[data-eo-edit]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = Number(b.getAttribute("data-eo-edit"));
        var e = entradasOutrasLista.find(function (x) { return x.id === id; });
        if (e) abrirModalEntradaOutra(e);
      });
    });
  }

  function abrirModalEntradaOutra(e) {
    var ehNovo = !e;
    abrirModal({
      titulo: ehNovo ? "Nova entrada avulsa" : "Editar entrada — " + (e.descricao || ""),
      fields: [
        { name: "data_prevista", label: "Data prevista",  type: "date",     valor: e && e.data_prevista, required: true },
        { name: "descricao",     label: "Descrição",      type: "text",     valor: e && e.descricao,     required: true },
        { name: "valor",         label: "Valor",          type: "number",   valor: e && e.valor,         required: true },
        { name: "conta_id",      label: "Conta bancária", type: "select",   valor: e && e.conta_id, options: opcoesContasBancarias() },
        { name: "recebido_em",   label: "Recebido em (deixe vazio se pendente)", type: "date", valor: e && e.recebido_em },
        { name: "observacao",    label: "Observação",     type: "textarea", valor: e && e.observacao }
      ],
      onSubmit: function (v, done) {
        var payload = {
          data_prevista: v.data_prevista,
          descricao: v.descricao,
          valor: Number(v.valor),
          conta_id: v.conta_id ? Number(v.conta_id) : null,
          recebido_em: v.recebido_em || null,
          observacao: v.observacao
        };
        var q = ehNovo
          ? client.from("entradas_outras").insert(payload)
          : client.from("entradas_outras").update(payload).eq("id", e.id);
        q.then(function (r) {
          if (r.error) { done(r.error.message); return; }
          entradasOutrasCarregado = false;
          fluxoVisaoCarregado = false;
          carregarEntradasOutrasSeNecessario();
          done(null);
        });
      }
    });
  }

  // =========================================================================
  // SAÍDAS AVULSAS — UI completa (Pacote 3)
  // =========================================================================

  function carregarSaidasOutrasSeNecessario() {
    if (!saidasOutrasCarregado) {
      carregarSaidasOutras().then(function () { renderSaidasOutras(); });
    } else {
      renderSaidasOutras();
    }
    if (!contasBancariasCarregado) carregarContasBancariasSeNecessario();

    var btn = document.getElementById("so-btn-novo");
    if (btn && !btn.dataset.bound) { btn.dataset.bound = "1"; btn.addEventListener("click", function () { abrirModalSaidaOutra(null); }); }
    ["so-busca","so-status"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el.dataset.bound) { el.dataset.bound = "1"; el.addEventListener("input", renderSaidasOutras); el.addEventListener("change", renderSaidasOutras); }
    });
    var btnLimpar = document.getElementById("so-btn-limpar");
    if (btnLimpar && !btnLimpar.dataset.bound) {
      btnLimpar.dataset.bound = "1";
      btnLimpar.addEventListener("click", function () {
        var b = document.getElementById("so-busca"); if (b) b.value = "";
        var s = document.getElementById("so-status"); if (s) s.value = "";
        renderSaidasOutras();
      });
    }
  }

  function renderSaidasOutras() {
    var tbody = document.getElementById("so-tbody");
    if (!tbody) return;
    var busca = ((document.getElementById("so-busca")||{}).value || "").trim().toLowerCase();
    var status = ((document.getElementById("so-status")||{}).value || "").trim();
    var contasMap = {};
    (contasBancariasLista || []).forEach(function (c) { contasMap[c.id] = c; });
    var filtrados = (saidasOutrasLista || []).filter(function (s) {
      if (busca && !matchBusca(busca, [s.descricao, s.observacao])) return false;
      if (status === "pendente" && s.pago_em) return false;
      if (status === "pago" && !s.pago_em) return false;
      return true;
    });
    var totalPrev = filtrados.reduce(function (a, s) { return a + Number(s.valor || 0); }, 0);
    var pendentes = filtrados.filter(function (s) { return !s.pago_em; }).length;
    var pagos = filtrados.filter(function (s) { return !!s.pago_em; }).length;
    valText(document.getElementById("so-m-pen"), fmtInt(pendentes));
    valText(document.getElementById("so-m-tot"), fmtBRL(totalPrev));
    valText(document.getElementById("so-m-pag"), fmtInt(pagos));
    valText(document.getElementById("so-lbl"), filtrados.length + " de " + (saidasOutrasLista || []).length);

    if (!filtrados.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="tbl-vazio">Nenhuma saída avulsa. Clique em + Nova saída.</td></tr>';
      return;
    }
    tbody.innerHTML = filtrados.map(function (s) {
      var st = s.pago_em ? '<span class="tag tag-ok">Pago</span>' : '<span class="tag tag-warn">Pendente</span>';
      var conta = contasMap[s.conta_id];
      return '<tr>' +
        '<td>' + fmtData(s.data_prevista) + '</td>' +
        '<td>' + escHtml(s.descricao) + '</td>' +
        '<td>' + (conta ? escHtml(conta.nome) : '<span class="muted">—</span>') + '</td>' +
        '<td class="num">' + fmtBRL(s.valor) + '</td>' +
        '<td>' + (s.pago_em ? fmtData(s.pago_em) : '<span class="muted">—</span>') + '</td>' +
        '<td>' + st + '</td>' +
        '<td><button class="btn-acao" data-so-edit="' + s.id + '">Editar</button></td>' +
      '</tr>';
    }).join("");
    tbody.querySelectorAll("[data-so-edit]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = Number(b.getAttribute("data-so-edit"));
        var s = saidasOutrasLista.find(function (x) { return x.id === id; });
        if (s) abrirModalSaidaOutra(s);
      });
    });
  }

  function abrirModalSaidaOutra(s) {
    var ehNovo = !s;
    abrirModal({
      titulo: ehNovo ? "Nova saída avulsa" : "Editar saída — " + (s.descricao || ""),
      fields: [
        { name: "data_prevista", label: "Data prevista",  type: "date",     valor: s && s.data_prevista, required: true },
        { name: "descricao",     label: "Descrição",      type: "text",     valor: s && s.descricao,     required: true },
        { name: "valor",         label: "Valor",          type: "number",   valor: s && s.valor,         required: true },
        { name: "conta_id",      label: "Conta bancária", type: "select",   valor: s && s.conta_id, options: opcoesContasBancarias() },
        { name: "pago_em",       label: "Pago em (deixe vazio se pendente)", type: "date", valor: s && s.pago_em },
        { name: "observacao",    label: "Observação",     type: "textarea", valor: s && s.observacao }
      ],
      onSubmit: function (v, done) {
        var payload = {
          data_prevista: v.data_prevista,
          descricao: v.descricao,
          valor: Number(v.valor),
          conta_id: v.conta_id ? Number(v.conta_id) : null,
          pago_em: v.pago_em || null,
          observacao: v.observacao
        };
        var q = ehNovo
          ? client.from("saidas_outras").insert(payload)
          : client.from("saidas_outras").update(payload).eq("id", s.id);
        q.then(function (r) {
          if (r.error) { done(r.error.message); return; }
          saidasOutrasCarregado = false;
          fluxoVisaoCarregado = false;
          carregarSaidasOutrasSeNecessario();
          done(null);
        });
      }
    });
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
    // Detalhe de Orçamento (Vendas, Gestão de Faturamento)
    var trOrc = t.closest("tr.linha-clicavel[data-orc]");
    if (trOrc) {
      var oc = trOrc.getAttribute("data-orc");
      if (oc && typeof abrirDetalheOrcamento === "function") { abrirDetalheOrcamento(oc); return; }
    }
    // Detalhe de Movimento (Notas Fiscais, Lançamentos)
    var trMv = t.closest("tr.linha-clicavel[data-mvid]");
    if (trMv) {
      var mvid = trMv.getAttribute("data-mvid");
      if (mvid && typeof abrirDetalheMovimento === "function") { abrirDetalheMovimento(mvid); return; }
    }
    // Detalhe de Despesa
    var trDesp = t.closest("tr.linha-clicavel[data-desp-key]");
    if (trDesp) {
      var key = trDesp.getAttribute("data-desp-key");
      if (key && typeof abrirDetalheDespesa === "function") { abrirDetalheDespesa(key); return; }
    }
    // Drill-down nas células da Visão 12 meses
    var celFlv = t.closest("td.linha-clicavel[data-flv-tipo]");
    if (celFlv) {
      var tipoFlv = celFlv.getAttribute("data-flv-tipo");
      var mesFlv = celFlv.getAttribute("data-flv-mes");
      if (tipoFlv && mesFlv && typeof abrirDrillFluxoCaixa === "function") {
        abrirDrillFluxoCaixa(tipoFlv, mesFlv);
        return;
      }
    }
  });

  // ===========================================================================
  // M18 Onda 3.1 — 2 telas novas + 1 drill-down
  // ===========================================================================

  // --- Tela: Saldo a Reconhecer (Receita > Por Faturamento) ---
  var saldoReconhecerLista = [];
  var saldoReconhecerCarregado = false;
  var saldoReconhecerCarregando = false;

  function carregarSaldoReconhecerSeNecessario() {
    if (saldoReconhecerCarregado) { renderSaldoReconhecer(); return; }
    if (saldoReconhecerCarregando) return;
    saldoReconhecerCarregando = true;
    setStatus("sr-status", "Consultando vw_saldo_reconhecer…", "carregando");
    client.from("vw_saldo_reconhecer").select("*").order("competencia", { ascending: false }).then(function (r) {
      saldoReconhecerCarregando = false;
      if (r.error) {
        setStatus("sr-status", "Erro: " + r.error.message, "erro");
        return;
      }
      saldoReconhecerLista = r.data || [];
      saldoReconhecerCarregado = true;
      setStatus("sr-status", null);
      renderSaldoReconhecer();
    });

    var sel = document.getElementById("sr-status-filtro");
    if (sel && !sel.dataset.bound) { sel.dataset.bound = "1"; sel.addEventListener("change", renderSaldoReconhecer); }
    var bus = document.getElementById("sr-busca");
    if (bus && !bus.dataset.bound) { bus.dataset.bound = "1"; bus.addEventListener("input", renderSaldoReconhecer); }
  }

  function renderSaldoReconhecer() {
    var tbody = document.getElementById("sr-tbody");
    var lbl = document.getElementById("sr-lbl");
    if (!tbody) return;
    var filtro = (document.getElementById("sr-status-filtro") || {}).value || "abertos";
    var busca = ((document.getElementById("sr-busca") || {}).value || "").trim().toLowerCase();

    var filtrados = saldoReconhecerLista.filter(function (r) {
      if (busca && String(r.orcamento || "").toLowerCase().indexOf(busca) === -1) return false;
      var aRec = Number(r.valor_a_reconhecer || 0);
      if (filtro === "abertos" && Math.abs(aRec) < 0.01) return false;
      if (filtro === "liquidados" && Math.abs(aRec) >= 0.01) return false;
      return true;
    });

    var totVenda = 0, totAdto = 0, totNF = 0, totAREC = 0;
    filtrados.forEach(function (r) {
      totVenda += Number(r.valor_orcamento || 0);
      totAdto  += Number(r.adiantamento || 0);
      totNF    += Number(r.nf_emitidas || 0);
      totAREC  += Number(r.valor_a_reconhecer || 0);
    });

    var mTV = document.getElementById("sr-m-venda");   if (mTV) mTV.textContent = fmtBRL(totVenda);
    var mAd = document.getElementById("sr-m-adto");    if (mAd) mAd.textContent = fmtBRL(totAdto);
    var mNF = document.getElementById("sr-m-nf");      if (mNF) mNF.textContent = fmtBRL(totNF);
    var mAR = document.getElementById("sr-m-arec");    if (mAR) mAR.textContent = fmtBRL(totAREC);
    if (lbl) lbl.textContent = filtrados.length + " de " + saldoReconhecerLista.length;

    if (!filtrados.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="tbl-vazio">Nenhuma linha bate com os filtros.</td></tr>';
      return;
    }
    tbody.innerHTML = filtrados.map(function (r) {
      var aRec = Number(r.valor_a_reconhecer || 0);
      var statusClass = Math.abs(aRec) < 0.01 ? "" : (aRec > 0 ? "" : "");
      var statusTxt = Math.abs(aRec) < 0.01 ? '<span class="tag ok">Liquidado</span>' : '<span class="tag warn">Em aberto</span>';
      return (
        '<tr>' +
          '<td class="mono">' + escHtml(r.orcamento || "—") + '</td>' +
          '<td>' + (r.competencia ? fmtData(r.competencia).slice(3) : "—") + '</td>' +
          '<td class="num">' + fmtBRL(r.valor_orcamento) + '</td>' +
          '<td class="num">' + fmtBRL(r.adiantamento) + '</td>' +
          '<td class="num">' + fmtBRL(r.nf_emitidas) + '</td>' +
          '<td class="num">' + fmtBRL(aRec) + ' ' + statusTxt + '</td>' +
        '</tr>'
      );
    }).join("");
  }

  // --- Tela: Dashboard de Orçamentos (Comercial) ---
  var dashOrcItensLista = [];
  var dashOrcCarregado = false;
  var dashOrcCarregando = false;

  function carregarDashboardOrcamentosTeleSeNecessario() {
    if (dashOrcCarregado) { renderDashboardOrcamentosTela(); return; }
    if (dashOrcCarregando) return;
    dashOrcCarregando = true;
    setStatus("doc-status", "Consultando orcamento_items…", "carregando");
    client.from("orcamento_items").select("*").order("orcamento", { ascending: false }).then(function (r) {
      dashOrcCarregando = false;
      if (r.error) { setStatus("doc-status", "Erro: " + r.error.message, "erro"); return; }
      dashOrcItensLista = r.data || [];
      dashOrcCarregado = true;
      setStatus("doc-status", null);
      renderDashboardOrcamentosTela();
    });

    var bus = document.getElementById("doc-busca");
    if (bus && !bus.dataset.bound) { bus.dataset.bound = "1"; bus.addEventListener("input", renderDashboardOrcamentosTela); }
  }

  function renderDashboardOrcamentosTela() {
    var tbody = document.getElementById("doc-tbody");
    var lbl = document.getElementById("doc-lbl");
    if (!tbody) return;
    var busca = ((document.getElementById("doc-busca") || {}).value || "").trim().toLowerCase();

    // Agrupar por orçamento
    var porOrc = {};
    dashOrcItensLista.forEach(function (it) {
      var k = String(it.orcamento || "");
      if (!porOrc[k]) porOrc[k] = { orcamento: k, n_itens: 0, vl_total: 0, vl_a_faturar: 0, lucro_previsto: 0, lucro_realizado: 0, primeiro: it };
      porOrc[k].n_itens += 1;
      porOrc[k].vl_total += Number(it.vl_total || 0);
      porOrc[k].vl_a_faturar += Number(it.vl_a_faturar || 0);
      porOrc[k].lucro_previsto += Number(it.lucro_previsto || 0);
      porOrc[k].lucro_realizado += Number(it.lucro_realizado || 0);
    });
    var orcs = Object.keys(porOrc).map(function (k) { return porOrc[k]; });
    if (busca) orcs = orcs.filter(function (o) { return o.orcamento.toLowerCase().indexOf(busca) !== -1; });

    if (lbl) lbl.textContent = orcs.length + " orçamento(s) · " + dashOrcItensLista.length + " item(s)";

    if (!orcs.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="tbl-vazio">Nenhum orçamento encontrado. Use "Importar > Dashboard de Orçamentos" pra popular.</td></tr>';
      return;
    }
    tbody.innerHTML = orcs.map(function (o) {
      return (
        '<tr class="linha-clicavel" data-doc-orc="' + escHtml(o.orcamento) + '" title="Ver itens desse orçamento">' +
          '<td class="mono">' + escHtml(o.orcamento) + '</td>' +
          '<td class="num">' + o.n_itens + '</td>' +
          '<td class="num">' + fmtBRL(o.vl_total) + '</td>' +
          '<td class="num">' + fmtBRL(o.vl_a_faturar) + '</td>' +
          '<td class="num">' + fmtBRL(o.lucro_previsto) + '</td>' +
          '<td class="num">' + fmtBRL(o.lucro_realizado) + '</td>' +
        '</tr>'
      );
    }).join("");

    // Listener
    document.querySelectorAll('#doc-tbody tr[data-doc-orc]').forEach(function (tr) {
      if (tr.dataset.bound) return;
      tr.dataset.bound = "1";
      tr.addEventListener("click", function () { abrirDetalheDashboardOrc(tr.getAttribute("data-doc-orc")); });
    });
  }

  function abrirDetalheDashboardOrc(orcamento) {
    var itens = dashOrcItensLista.filter(function (it) { return String(it.orcamento) === String(orcamento); });
    if (!itens.length) { abrirModalDetalhe("Orçamento " + orcamento, "<p class=\"muted\">Sem itens.</p>"); return; }
    var html = '<p class="muted-tag">' + itens.length + ' item(s) deste orçamento.</p>';
    html += '<div class="table-wrap"><table class="tabela"><thead><tr>'
         + '<th>Item</th><th>Família</th><th>Grupo</th>'
         + '<th class="num">Qtd vendida</th><th class="num">Qtd faturada</th>'
         + '<th class="num">Vl unit.</th><th class="num">Vl total</th>'
         + '<th>NFs</th><th class="num">Lucro prev.</th><th class="num">Lucro real.</th>'
         + '</tr></thead><tbody>';
    html += itens.map(function (i) {
      return '<tr>'
           + '<td>' + escHtml(i.item || "—") + '</td>'
           + '<td>' + escHtml(i.familia || "—") + '</td>'
           + '<td>' + escHtml(i.grupo || "—") + '</td>'
           + '<td class="num">' + (i.qtd_vendida || 0) + '</td>'
           + '<td class="num">' + (i.qtd_faturada || 0) + '</td>'
           + '<td class="num">' + fmtBRL(i.vl_unitario) + '</td>'
           + '<td class="num">' + fmtBRL(i.vl_total) + '</td>'
           + '<td class="mono" style="font-size:11px">' + escHtml(i.notas_fiscais || "—") + '</td>'
           + '<td class="num">' + fmtBRL(i.lucro_previsto) + '</td>'
           + '<td class="num">' + fmtBRL(i.lucro_realizado) + '</td>'
           + '</tr>';
    }).join("");
    html += '</tbody></table></div>';
    abrirModalDetalhe("Itens do orçamento " + orcamento, html);
  }

  // --- Drill-down: Custo por OS → estoque_detalhes ---
  function abrirDetalheItensMP(os) {
    setStatus(null, "Buscando itens de matéria-prima da OS " + os + "…");
    client.from("estoque_detalhes").select("*").eq("os", String(os)).order("data_saida").then(function (r) {
      if (r.error) { abrirModalDetalhe("Itens MP — OS " + os, '<p class="muted">Erro: ' + escHtml(r.error.message) + '</p>'); return; }
      var itens = r.data || [];
      if (!itens.length) {
        abrirModalDetalhe("Itens MP — OS " + os, '<p class="muted">Nenhum item de matéria-prima registrado para esta OS. (Use "Importar > Saída de Estoque" pra alimentar.)</p>');
        return;
      }
      var totalCusto = 0;
      itens.forEach(function (i) { totalCusto += Number(i.custo_total || 0); });
      var html = '<p class="muted-tag">' + itens.length + ' item(s), custo total R$ ' + fmtBRLNum(totalCusto) + '</p>';
      html += '<div class="table-wrap"><table class="tabela"><thead><tr>'
           + '<th>Data saída</th><th>Cód. material</th><th>Descrição</th>'
           + '<th class="num">Qtd</th><th class="num">Custo unit.</th><th class="num">Custo total</th>'
           + '<th>Funcionário</th>'
           + '</tr></thead><tbody>';
      html += itens.map(function (i) {
        return '<tr>'
             + '<td>' + (i.data_saida ? fmtData(i.data_saida) : "—") + '</td>'
             + '<td class="mono">' + escHtml(i.codigo_material || "—") + '</td>'
             + '<td>' + escHtml(i.descricao_material || "—") + '</td>'
             + '<td class="num">' + (i.quantidade || 0) + '</td>'
             + '<td class="num">' + fmtBRL(i.custo_unitario) + '</td>'
             + '<td class="num">' + fmtBRL(i.custo_total) + '</td>'
             + '<td>' + escHtml(i.funcionario || "—") + '</td>'
             + '</tr>';
      }).join("");
      html += '</tbody></table></div>';
      abrirModalDetalhe("Itens MP — OS " + os, html);
    });
  }

  // Helper: setStatus genérico (usa elemento por id)
  function setStatus(elId, msg, classe) {
    if (!elId) return;
    var el = document.getElementById(elId);
    if (!el) return;
    if (msg === null || msg === undefined) { el.hidden = true; el.textContent = ""; el.className = "status"; return; }
    el.textContent = msg;
    el.className = "status" + (classe ? " " + classe : "");
    el.hidden = false;
  }
  // Helper numérico (sem R$, só número formatado)
  function fmtBRLNum(v) {
    var n = Number(v || 0);
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ===========================================================================
  // M18 Onda 3.2 — Tela "Lançamentos de Caixa" (movimentos_caixa) + bulk action
  // ===========================================================================
  var movCaixaLista = [];
  var movCaixaCarregado = false;
  var movCaixaCarregando = false;
  var movCaixaOrcOptions = [];   // cache de orçamentos pra dropdown

  function carregarMovimentosCaixaSeNecessario() {
    if (movCaixaCarregado) { renderMovimentosCaixa(); return; }
    if (movCaixaCarregando) return;
    movCaixaCarregando = true;
    setStatus("mc-status", "Consultando movimentos_caixa…", "carregando");
    var p1 = client.from("movimentos_caixa").select("*").order("data_pagamento", { ascending: false }).limit(5000).then(function (r) {
      if (r.error) throw r.error;
      movCaixaLista = r.data || [];
    });
    var p2 = client.from("orcamentos").select("orcamento, nome, parceiro").then(function (r) {
      if (r.error) throw r.error;
      movCaixaOrcOptions = r.data || [];
    });
    Promise.all([p1, p2]).then(function () {
      movCaixaCarregando = false;
      movCaixaCarregado = true;
      setStatus("mc-status", null);
      renderMovimentosCaixa();
    }).catch(function (e) {
      movCaixaCarregando = false;
      setStatus("mc-status", "Erro: " + e.message, "erro");
    });

    // Listeners (uma vez)
    var bus = document.getElementById("mc-busca");
    if (bus && !bus.dataset.bound) { bus.dataset.bound = "1"; bus.addEventListener("input", renderMovimentosCaixa); }
    var tipo = document.getElementById("mc-tipo");
    if (tipo && !tipo.dataset.bound) { tipo.dataset.bound = "1"; tipo.addEventListener("change", renderMovimentosCaixa); }
    var status = document.getElementById("mc-status-filtro");
    if (status && !status.dataset.bound) { status.dataset.bound = "1"; status.addEventListener("change", renderMovimentosCaixa); }
    var btnSel = document.getElementById("mc-btn-sel-todos");
    if (btnSel && !btnSel.dataset.bound) {
      btnSel.dataset.bound = "1";
      btnSel.addEventListener("click", function () {
        var marcar = btnSel.dataset.estado !== "marcado";
        document.querySelectorAll('#mc-tbody input[type="checkbox"][data-mcid]').forEach(function (c) { c.checked = marcar; });
        btnSel.dataset.estado = marcar ? "marcado" : "";
        btnSel.textContent = marcar ? "✕ Desmarcar todos" : "✓ Selecionar todos";
      });
    }
    var btnAplicar = document.getElementById("mc-btn-aplicar-bulk");
    if (btnAplicar && !btnAplicar.dataset.bound) {
      btnAplicar.dataset.bound = "1";
      btnAplicar.addEventListener("click", aplicarBulkClassificacao);
    }
    var selOrcBulk = document.getElementById("mc-bulk-orc");
    if (selOrcBulk && !selOrcBulk.dataset.bound) { selOrcBulk.dataset.bound = "1"; }
  }

  function renderMovimentosCaixa() {
    var tbody = document.getElementById("mc-tbody");
    if (!tbody) return;
    var busca = ((document.getElementById("mc-busca") || {}).value || "").trim().toLowerCase();
    var fTipo = (document.getElementById("mc-tipo") || {}).value || "";
    var fStatus = (document.getElementById("mc-status-filtro") || {}).value || "";

    var filtrados = movCaixaLista.filter(function (m) {
      if (fTipo && m.tipo !== fTipo) return false;
      if (fStatus === "pendentes" && (m.tipo !== "RECEBER" || m.natureza)) return false;
      if (fStatus === "classificados" && !m.natureza) return false;
      if (busca) {
        var alvo = ((m.parceiro || "") + " " + (m.documento || "") + " " + (m.historico || "") + " " + (m.numero_plano_contas || "")).toLowerCase();
        if (alvo.indexOf(busca) === -1) return false;
      }
      return true;
    });

    var totLin = filtrados.length;
    var totVal = 0;
    var totPend = 0;
    filtrados.forEach(function (m) {
      totVal += Number(m.valor_total || 0);
      if (m.tipo === "RECEBER" && !m.natureza) totPend++;
    });
    var elQtd = document.getElementById("mc-m-qtd"); if (elQtd) elQtd.textContent = fmtInt(totLin);
    var elVal = document.getElementById("mc-m-valor"); if (elVal) elVal.textContent = fmtBRL(totVal);
    var elPend = document.getElementById("mc-m-pend"); if (elPend) elPend.textContent = fmtInt(totPend);
    var elLbl = document.getElementById("mc-lbl"); if (elLbl) elLbl.textContent = totLin + " de " + movCaixaLista.length;

    // Popular dropdown de orçamentos do bulk (filtrar por parceiro do primeiro pendente, se houver)
    var selOrc = document.getElementById("mc-bulk-orc");
    if (selOrc) {
      var opts = '<option value="">— Manter sem vínculo —</option>';
      movCaixaOrcOptions.forEach(function (o) {
        opts += '<option value="' + escHtml(o.orcamento) + '">' + escHtml(o.orcamento) + ' · ' + escHtml(o.nome || o.parceiro || "") + '</option>';
      });
      selOrc.innerHTML = opts;
    }

    if (!totLin) {
      tbody.innerHTML = '<tr><td colspan="9" class="tbl-vazio">Nenhum lançamento bate com os filtros.</td></tr>';
      return;
    }

    tbody.innerHTML = filtrados.map(function (m) {
      var pend = m.tipo === "RECEBER" && !m.natureza;
      var rowCls = pend ? "linha-pendente" : "";
      var nat = m.natureza ? '<span class="tag">' + escHtml(m.natureza) + '</span>' : '<span class="tag warn">Pendente</span>';
      var vinc = m.orcamento_vinculado ? '<span class="mono">' + escHtml(m.orcamento_vinculado) + '</span>' : '—';
      return (
        '<tr class="' + rowCls + '">' +
          '<td>' + (pend ? '<input type="checkbox" data-mcid="' + m.id + '" />' : '') + '</td>' +
          '<td><span class="tag ' + (m.tipo === "PAGAR" ? "danger" : "ok") + '">' + escHtml(m.tipo) + '</span></td>' +
          '<td>' + (m.data_pagamento ? fmtData(m.data_pagamento) : "—") + '</td>' +
          '<td>' + escHtml(m.parceiro || "—") + '</td>' +
          '<td class="mono" style="font-size:11px">' + escHtml(m.documento || "—") + '</td>' +
          '<td class="num">' + fmtBRL(m.valor_total) + '</td>' +
          '<td class="mono" style="font-size:11px">' + escHtml(m.numero_plano_contas || "—") + '</td>' +
          '<td>' + nat + '</td>' +
          '<td>' + vinc + '</td>' +
        '</tr>'
      );
    }).join("");
  }

  function aplicarBulkClassificacao() {
    var natureza = (document.getElementById("mc-bulk-natureza") || {}).value;
    var orcamento = (document.getElementById("mc-bulk-orc") || {}).value;
    if (!natureza) { alert("Escolha uma Natureza para aplicar."); return; }

    var selecionados = [];
    document.querySelectorAll('#mc-tbody input[type="checkbox"][data-mcid]:checked').forEach(function (c) {
      selecionados.push(Number(c.getAttribute("data-mcid")));
    });
    if (!selecionados.length) { alert("Selecione pelo menos 1 linha pendente."); return; }
    if (!confirm("Aplicar Natureza='" + natureza + "'" + (orcamento ? " + Orçamento='" + orcamento + "'" : "") + " em " + selecionados.length + " linha(s)?")) return;

    setStatus("mc-status", "Atualizando " + selecionados.length + " linha(s)…", "carregando");
    var update = { natureza: natureza, classificado_em: new Date().toISOString() };
    if (orcamento) update.orcamento_vinculado = orcamento;

    client.from("movimentos_caixa").update(update).in("id", selecionados).then(function (r) {
      if (r.error) { setStatus("mc-status", "Erro: " + r.error.message, "erro"); return; }
      // Atualizar lista local
      var sels = {};
      selecionados.forEach(function (id) { sels[id] = true; });
      movCaixaLista.forEach(function (m) {
        if (sels[m.id]) {
          m.natureza = natureza;
          if (orcamento) m.orcamento_vinculado = orcamento;
          m.classificado_em = update.classificado_em;
        }
      });
      setStatus("mc-status", "✓ " + selecionados.length + " linha(s) classificadas.", "ok");
      renderMovimentosCaixa();
    });
  }

  // ===========================================================================
  // M18 Onda 3.2 — Drill-down "Custo por OS" via event delegation
  // ===========================================================================
  // Habilita: ao clicar numa linha de #cos-tbody com [data-cos-os], abre modal
  // com itens de matéria-prima (estoque_detalhes) daquela OS.
  document.addEventListener("DOMContentLoaded", function () {
    var tb = document.getElementById("cos-tbody");
    if (tb && !tb.dataset.drillBound) {
      tb.dataset.drillBound = "1";
      tb.addEventListener("click", function (ev) {
        var tr = ev.target && ev.target.closest && ev.target.closest("tr[data-cos-os]");
        if (!tr) return;
        var os = tr.getAttribute("data-cos-os");
        if (os && typeof abrirDetalheItensMP === "function") abrirDetalheItensMP(os);
      });
    }
    // Mesmo pra Custo Direto Via OS
    var tb2 = document.getElementById("cdvos-tbody");
    if (tb2 && !tb2.dataset.drillBound) {
      tb2.dataset.drillBound = "1";
      tb2.addEventListener("click", function (ev) {
        var tr = ev.target && ev.target.closest && ev.target.closest("tr[data-cdvos-os]");
        if (!tr) return;
        var os = tr.getAttribute("data-cdvos-os");
        if (os && typeof abrirDetalheItensMP === "function") abrirDetalheItensMP(os);
      });
    }
  });

  // ===========================================================================
  // M19 — Perfil Master + tela Reset
  // ===========================================================================

  // Cache das permissões do user logado
  var _permissoesMaster = null;

  function carregarPermissoesMaster() {
    return Promise.all([
      client.rpc("auth_pode_limpar_base"),
      client.rpc("auth_pode_carga_inicial")
    ]).then(function (rs) {
      _permissoesMaster = {
        pode_limpar_base: !!(rs[0].data),
        pode_carga_inicial: !!(rs[1].data)
      };
      aplicarPermissoesMaster();
      return _permissoesMaster;
    }).catch(function () {
      // Se falhar (ex: funções não existem), assume que não tem permissão
      _permissoesMaster = { pode_limpar_base: false, pode_carga_inicial: false };
      aplicarPermissoesMaster();
      return _permissoesMaster;
    });
  }

  function aplicarPermissoesMaster() {
    if (!_permissoesMaster) return;
    // Esconder item sidebar "Importar" se não tem pode_carga_inicial
    var btnImp = document.querySelector('[data-page="importacoes"]');
    if (btnImp) btnImp.style.display = _permissoesMaster.pode_carga_inicial ? "" : "none";
    // Esconder item sidebar "Reset" (e card em Configuração) se não tem pode_limpar_base
    var btnReset = document.querySelector('[data-page="cfg_reset"]');
    if (btnReset) btnReset.style.display = _permissoesMaster.pode_limpar_base ? "" : "none";
    var cardReset = document.querySelector('.config-card[data-subpage="cfg_reset"]');
    if (cardReset) cardReset.style.display = _permissoesMaster.pode_limpar_base ? "" : "none";
  }

  // --- Tela: Reset (Configuração > Reset) — só pra master ---
  function carregarResetSeNecessario() {
    if (!_permissoesMaster) {
      carregarPermissoesMaster().then(function () {
        if (_permissoesMaster.pode_limpar_base) renderReset();
        else renderResetSemPermissao();
      });
      return;
    }
    if (_permissoesMaster.pode_limpar_base) renderReset();
    else renderResetSemPermissao();
  }

  function renderResetSemPermissao() {
    var c = document.getElementById("reset-content");
    if (!c) return;
    c.innerHTML = '<div class="danger-box"><p><strong>Sem permissão.</strong> Apenas perfis "master" podem fazer reset da base. Pergunte pra Juliana se for o caso.</p></div>';
  }

  function renderReset() {
    var c = document.getElementById("reset-content");
    if (!c) return;
    c.innerHTML =
      '<div class="danger-box">' +
        '<p><strong>⚠️ AÇÃO IRREVERSÍVEL.</strong> O Reset Completo apaga <strong>todos os dados de negócio</strong> da base:</p>' +
        '<ul>' +
          '<li>Orçamentos, Movimentos, Movimentos de Caixa, Notas Fiscais, NF↔OS, Saldo a Reconhecer</li>' +
          '<li>Estoque (detalhes + resumo + evolução), Receitas e Custos, Custo Direto Competência</li>' +
          '<li>Folha de Pagamento (e rubricas), Benefícios, Impostos RH</li>' +
          '<li>Contas Bancárias, Saldos Mensais, Recebimentos Previstos, Entradas/Saídas Avulsas, Compromissos</li>' +
          '<li>Programa de Bônus (períodos, metas empresa/área/profissional)</li>' +
          '<li>Auditoria e log de Importações</li>' +
        '</ul>' +
        '<p><strong>O que NÃO é apagado:</strong> Plano de Contas, CFOP, Perfis, Tipos de Perfil, Centros de Custo, Funcionários, Organograma, Rubricas, Classif. Faturamento, Listas (naturezas/tipos).</p>' +
      '</div>' +
      '<div class="card fat-card" style="margin-top:16px;">' +
        '<h3 style="color: var(--danger); margin-bottom: 8px;">Confirmação dupla obrigatória</h3>' +
        '<p>Pra confirmar o reset, digite <code style="background:var(--danger-bg); color: var(--danger); padding: 2px 8px; border-radius: 4px; font-weight: bold;">RESET</code> no campo abaixo (em maiúsculas, sem espaços):</p>' +
        '<input type="text" id="reset-input-confirma" class="input-search" placeholder="Digite RESET" style="max-width: 240px; margin-bottom: 12px;" />' +
        '<div>' +
          '<button id="reset-btn-executar" type="button" class="btn-perigo" disabled>Executar Reset Completo</button> ' +
          '<button id="reset-btn-cancelar" type="button" class="btn-limpar">Cancelar</button>' +
        '</div>' +
        '<div id="reset-status" class="status" hidden role="status" aria-live="polite" style="margin-top: 12px;"></div>' +
      '</div>';

    var inp = document.getElementById("reset-input-confirma");
    var btnExec = document.getElementById("reset-btn-executar");
    var btnCanc = document.getElementById("reset-btn-cancelar");
    if (inp) {
      inp.value = "";
      inp.addEventListener("input", function () {
        btnExec.disabled = inp.value.trim() !== "RESET";
      });
    }
    if (btnExec) btnExec.addEventListener("click", executarReset);
    if (btnCanc) btnCanc.addEventListener("click", function () {
      if (inp) inp.value = "";
      btnExec.disabled = true;
      var st = document.getElementById("reset-status");
      if (st) { st.hidden = true; st.textContent = ""; }
    });
  }

  function executarReset() {
    if (!confirm("ÚLTIMA CONFIRMAÇÃO: vai apagar TODOS os dados de negócio da base. Esta ação é IRREVERSÍVEL. Continuar?")) return;
    var st = document.getElementById("reset-status");
    var btn = document.getElementById("reset-btn-executar");
    if (btn) btn.disabled = true;
    if (st) { st.hidden = false; st.className = "status carregando"; st.textContent = "Executando reset… aguarde."; }
    client.rpc("fn_reset_base_completo").then(function (r) {
      if (r.error) {
        if (st) { st.className = "status erro"; st.textContent = "Erro: " + r.error.message; }
        if (btn) btn.disabled = false;
        return;
      }
      if (st) {
        st.className = "status ok";
        st.textContent = "✓ Reset concluído com sucesso. Recarregue a página (F5) pra ver o sistema vazio.";
      }
      // Invalidar caches locais
      try {
        orcamentosCarregados = false; orcamentosLista = [];
        movimentosCompletos = []; movCaixaCarregado = false;
        notasCarregado = false; aprCarregado = false;
        rcCarregado = false; bonCarregado = false;
        saldoReconhecerCarregado = false; dashOrcCarregado = false;
      } catch (e) {}
      // Limpa input
      var inp = document.getElementById("reset-input-confirma");
      if (inp) inp.value = "";
    });
  }

  // ===========================================================================
  // M18 Onda 3.3 — Dashboard rico de Gestão de Faturamento
  // Cruza 5 fontes (orcamentos + movimentos_caixa + notas_fiscais + ordens_servico + estoque_detalhes)
  // pra mostrar TUDO por orçamento numa tabela só.
  // ===========================================================================

  var dashFatRicoCarregado = false;
  var dashFatRicoCarregando = false;
  var dashFatRicoLinhas = [];   // linhas agregadas por orcamento

  function carregarDashFatRico() {
    if (dashFatRicoCarregado) { renderDashFatRico(); return; }
    if (dashFatRicoCarregando) return;
    dashFatRicoCarregando = true;
    setStatus("dfr-status", "Cruzando 5 fontes (orçamentos, mov_caixa, NFs, OSs, estoque)…", "carregando");

    // 5 queries em paralelo
    var p1 = client.from("orcamentos").select("orcamento, data, nome, parceiro, venda, tipo_faturamento, pct_com_nf").order("data", { ascending: false }).limit(5000);
    var p2 = client.from("movimentos_caixa").select("orcamento_vinculado, natureza, valor_total").not("orcamento_vinculado", "is", null);
    var p3 = client.from("notas_fiscais").select("numero_orcamento, valor_nf, numero_nf");
    var p4 = client.from("ordens_servico").select("os, orcamento");
    var p5 = client.from("estoque_detalhes").select("os, custo_total").eq("dre", "CPV - Matéria Prima");

    Promise.all([p1, p2, p3, p4, p5]).then(function (rs) {
      dashFatRicoCarregando = false;
      // Verificar erros (mas tolerar tabelas vazias)
      for (var i = 0; i < rs.length; i++) {
        if (rs[i].error) {
          setStatus("dfr-status", "Erro ao consultar fonte " + (i+1) + ": " + rs[i].error.message, "erro");
          return;
        }
      }
      var orcs = rs[0].data || [];
      var mc = rs[1].data || [];
      var nfs = rs[2].data || [];
      var oss = rs[3].data || [];
      var est = rs[4].data || [];

      // Agregadores por orçamento
      var movPorOrc = {}; // { orc: { Adiantamento, Recebimento, "Resultado Financeiro", Outros } }
      mc.forEach(function (m) {
        var k = String(m.orcamento_vinculado || "");
        if (!movPorOrc[k]) movPorOrc[k] = { Adiantamento: 0, Recebimento: 0, "Resultado Financeiro": 0, Outros: 0 };
        var nat = m.natureza || "Outros";
        if (nat in movPorOrc[k]) movPorOrc[k][nat] += Number(m.valor_total || 0);
        else movPorOrc[k].Outros += Number(m.valor_total || 0);
      });

      var nfPorOrc = {}; // { orc: { total: X, qtd: Y } }
      nfs.forEach(function (n) {
        var k = String(n.numero_orcamento || "");
        if (!nfPorOrc[k]) nfPorOrc[k] = { total: 0, qtd: 0 };
        nfPorOrc[k].total += Number(n.valor_nf || 0);
        nfPorOrc[k].qtd += 1;
      });

      // OSs por orçamento (pra cruzar com estoque)
      var ossPorOrc = {}; // { orc: [os1, os2, ...] }
      oss.forEach(function (o) {
        var k = String(o.orcamento || "");
        if (!ossPorOrc[k]) ossPorOrc[k] = [];
        ossPorOrc[k].push(String(o.os));
      });

      // Custo MP por OS
      var custoPorOS = {};
      est.forEach(function (e) {
        var k = String(e.os || "");
        custoPorOS[k] = (custoPorOS[k] || 0) + Number(e.custo_total || 0);
      });

      // Construir linhas finais
      dashFatRicoLinhas = orcs.map(function (o) {
        var k = String(o.orcamento);
        var mov = movPorOrc[k] || { Adiantamento: 0, Recebimento: 0, "Resultado Financeiro": 0, Outros: 0 };
        var nf = nfPorOrc[k] || { total: 0, qtd: 0 };
        var ossDoOrc = ossPorOrc[k] || [];
        var custoTotal = ossDoOrc.reduce(function (acc, os) { return acc + (custoPorOS[os] || 0); }, 0);

        var venda = Number(o.venda || 0);
        var pct = (o.pct_com_nf !== null && o.pct_com_nf !== undefined) ? Number(o.pct_com_nf) : (o.tipo_faturamento === "0_NF" ? 0 : 100);
        var vendaSemNF = venda * (1 - pct / 100);
        var vendaComNF = venda - vendaSemNF;
        var aFaturar = Math.max(0, vendaComNF - nf.total);
        var aReceber = Math.max(0, venda - mov.Adiantamento - mov.Recebimento - mov["Resultado Financeiro"]);
        var saldoAdto = Math.max(0, mov.Adiantamento - nf.total);
        var statusRec = aReceber < 0.01 ? "Liquidado" : "Em aberto";
        var statusFat = aFaturar < 0.01 ? "Liquidado" : "Em aberto";

        return {
          orcamento: o.orcamento,
          data: o.data,
          nome: o.nome,
          parceiro: o.parceiro,
          tipo_faturamento: o.tipo_faturamento,
          pct_com_nf: pct,
          venda: venda,
          adto: mov.Adiantamento,
          recebimento: mov.Recebimento,
          resultado_fin: mov["Resultado Financeiro"],
          a_receber: aReceber,
          status_rec: statusRec,
          nf_emitida: nf.total,
          nf_qtd: nf.qtd,
          venda_sem_nf: vendaSemNF,
          a_faturar: aFaturar,
          status_fat: statusFat,
          saldo_adto: saldoAdto,
          custo_total: custoTotal,
          n_oss: ossDoOrc.length
        };
      });

      dashFatRicoCarregado = true;
      setStatus("dfr-status", null);
      renderDashFatRico();
    }).catch(function (e) {
      dashFatRicoCarregando = false;
      setStatus("dfr-status", "Erro: " + (e.message || e), "erro");
    });

    // Listeners
    var bus = document.getElementById("dfr-busca");
    if (bus && !bus.dataset.bound) { bus.dataset.bound = "1"; bus.addEventListener("input", renderDashFatRico); }
    var st = document.getElementById("dfr-status-filtro");
    if (st && !st.dataset.bound) { st.dataset.bound = "1"; st.addEventListener("change", renderDashFatRico); }
  }

  function renderDashFatRico() {
    var tbody = document.getElementById("dfr-tbody");
    if (!tbody) return;
    var busca = ((document.getElementById("dfr-busca") || {}).value || "").trim().toLowerCase();
    var fStatus = (document.getElementById("dfr-status-filtro") || {}).value || "";

    var filtrados = dashFatRicoLinhas.filter(function (l) {
      if (busca) {
        var alvo = ((l.orcamento || "") + " " + (l.nome || "") + " " + (l.parceiro || "")).toLowerCase();
        if (alvo.indexOf(busca) === -1) return false;
      }
      if (fStatus === "rec_aberto" && l.status_rec !== "Em aberto") return false;
      if (fStatus === "fat_aberto" && l.status_fat !== "Em aberto") return false;
      if (fStatus === "ambos_liq" && (l.status_rec !== "Liquidado" || l.status_fat !== "Liquidado")) return false;
      return true;
    });

    // Totais
    var tot = { venda: 0, adto: 0, rec: 0, nf: 0, aReceber: 0, aFaturar: 0, custo: 0 };
    filtrados.forEach(function (l) {
      tot.venda += l.venda; tot.adto += l.adto; tot.rec += l.recebimento;
      tot.nf += l.nf_emitida; tot.aReceber += l.a_receber; tot.aFaturar += l.a_faturar;
      tot.custo += l.custo_total;
    });
    var setEl = function (id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
    setEl("dfr-m-venda", fmtBRL(tot.venda));
    setEl("dfr-m-recebido", fmtBRL(tot.rec));
    setEl("dfr-m-areceber", fmtBRL(tot.aReceber));
    setEl("dfr-m-nf", fmtBRL(tot.nf));
    setEl("dfr-m-afaturar", fmtBRL(tot.aFaturar));
    setEl("dfr-m-custo", fmtBRL(tot.custo));
    setEl("dfr-lbl", filtrados.length + " de " + dashFatRicoLinhas.length);

    if (!filtrados.length) {
      tbody.innerHTML = '<tr><td colspan="14" class="tbl-vazio">Nenhum orçamento bate com os filtros.</td></tr>';
      return;
    }

    tbody.innerHTML = filtrados.map(function (l) {
      var tipoFat = l.tipo_faturamento === "PARCIAL" ? ("PARCIAL " + (l.pct_com_nf || 0) + "%") : (l.tipo_faturamento || "—");
      var statusRecTag = l.status_rec === "Liquidado" ? '<span class="tag ok">L</span>' : '<span class="tag warn">A</span>';
      var statusFatTag = l.status_fat === "Liquidado" ? '<span class="tag ok">L</span>' : '<span class="tag warn">A</span>';
      var margemPct = l.venda > 0 ? ((l.venda - l.custo_total) / l.venda * 100).toFixed(1) + "%" : "—";
      return (
        '<tr>' +
          '<td>' + (l.data ? fmtData(l.data) : "—") + '</td>' +
          '<td class="mono">' + escHtml(l.orcamento) + '</td>' +
          '<td>' + escHtml(l.nome || "—") + '</td>' +
          '<td><span class="muted-tag">' + tipoFat + '</span></td>' +
          '<td class="num">' + fmtBRL(l.venda) + '</td>' +
          '<td class="num">' + fmtBRL(l.adto) + '</td>' +
          '<td class="num">' + fmtBRL(l.recebimento) + '</td>' +
          '<td class="num">' + fmtBRL(l.a_receber) + ' ' + statusRecTag + '</td>' +
          '<td class="num">' + fmtBRL(l.nf_emitida) + (l.nf_qtd > 0 ? ' <span class="muted-tag">(' + l.nf_qtd + ')</span>' : '') + '</td>' +
          '<td class="num">' + fmtBRL(l.venda_sem_nf) + '</td>' +
          '<td class="num">' + fmtBRL(l.a_faturar) + ' ' + statusFatTag + '</td>' +
          '<td class="num">' + fmtBRL(l.saldo_adto) + '</td>' +
          '<td class="num">' + fmtBRL(l.custo_total) + (l.n_oss > 0 ? ' <span class="muted-tag">(' + l.n_oss + ' OS)</span>' : '') + '</td>' +
          '<td class="num">' + margemPct + '</td>' +
        '</tr>'
      );
    }).join("");
  }

  // ===========================================================================
  // M18 — Refacs incrementais com FALLBACK
  // Telas Notas Fiscais / Contas a Receber / Contas a Pagar passam a olhar
  // primeiro pras tabelas novas (notas_fiscais rica, movimentos_caixa);
  // se vazias, mantém o comportamento antigo (compatibilidade).
  // ===========================================================================

  // --- Carregamento de notas_fiscais (rica) + nf_os ---
  var notasFiscaisRicasLista = [];
  var nfosLista = [];
  var nfRicasCarregado = false;

  function carregarNFsRicas() {
    if (nfRicasCarregado) return Promise.resolve();
    return Promise.all([
      client.from("notas_fiscais").select("*").order("emissao", { ascending: false }),
      client.from("nf_os").select("numero_nf, os")
    ]).then(function (rs) {
      if (rs[0].data) notasFiscaisRicasLista = rs[0].data;
      if (rs[1].data) nfosLista = rs[1].data;
      nfRicasCarregado = true;
    }).catch(function () { /* tolerar erro — só não usa fallback */ });
  }

  // Override de renderNotas: se notas_fiscais (rica) tiver dados, usa ela; senão, usa a antiga.
  if (typeof renderNotas === "function") {
    var _renderNotasOriginal = renderNotas;
    renderNotas = function () {
      // Carrega NFs ricas se ainda não carregou
      if (!nfRicasCarregado) {
        carregarNFsRicas().then(function () { renderNotas(); });
        return;
      }
      // Se a tabela rica está vazia, fallback pra versão antiga
      if (!notasFiscaisRicasLista.length) {
        _renderNotasOriginal();
        return;
      }
      // Versão rica: mostra colunas de notas_fiscais + OSs vinculadas
      var tbody = document.getElementById("nf-tbody");
      if (!tbody) return;
      var busca = ((document.getElementById("nf-busca") || {}).value || "").trim().toLowerCase();
      var mes = (document.getElementById("nf-mes") || {}).value;

      // Indexar OSs por NF
      var ossPorNF = {};
      nfosLista.forEach(function (l) {
        var k = String(l.numero_nf || "");
        if (!ossPorNF[k]) ossPorNF[k] = [];
        ossPorNF[k].push(l.os);
      });

      var filtrados = notasFiscaisRicasLista.filter(function (n) {
        if (mes && n.emissao && String(n.emissao).slice(0,7) !== mes) return false;
        if (busca) {
          var alvo = ((n.numero_nf || "") + " " + (n.razao_social || "") + " " + (n.numero_orcamento || "")).toLowerCase();
          if (alvo.indexOf(busca) === -1) return false;
        }
        return true;
      });

      var soma = 0;
      filtrados.forEach(function (n) { soma += Number(n.valor_nf || 0); });

      var elQ = document.getElementById("nf-m-qtd"); if (elQ) elQ.textContent = fmtInt(filtrados.length);
      var elV = document.getElementById("nf-m-valor"); if (elV) elV.textContent = fmtBRL(soma);
      var elL = document.getElementById("nf-lbl"); if (elL) elL.textContent = filtrados.length + " NF (rica)";

      if (!filtrados.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="tbl-vazio">Nenhuma NF bate com filtros.</td></tr>';
        return;
      }
      tbody.innerHTML = filtrados.map(function (n) {
        var oss = (ossPorNF[String(n.numero_nf)] || []).join(", ") || "—";
        return '<tr>' +
          '<td>' + (n.emissao ? fmtData(n.emissao) : "—") + '</td>' +
          '<td class="mono">' + escHtml(n.numero_orcamento || "—") + '</td>' +
          '<td>' + escHtml(n.razao_social || "—") + '</td>' +
          '<td class="mono">' + escHtml(n.numero_nf || "—") + '</td>' +
          '<td class="mono">' + escHtml(oss) + '</td>' +
          '<td class="mono" style="font-size:11px">' + escHtml(n.cfop || "—") + '</td>' +
          '<td class="num">' + fmtBRL(n.valor_nf) + '</td>' +
        '</tr>';
      }).join("");
    };
  }

  // Override de renderRecebimentos: se movimentos_caixa (RECEBER) tiver dados, usa.
  if (typeof renderRecebimentos === "function") {
    var _renderRecebimentosOriginal = renderRecebimentos;
    renderRecebimentos = function () {
      // Garante que movCaixaLista esteja carregada
      if (typeof movCaixaCarregado !== "undefined" && !movCaixaCarregado && typeof carregarMovimentosCaixaSeNecessario === "function") {
        carregarMovimentosCaixaSeNecessario();
        // Não esperar — se ainda não tem, usa a antiga por enquanto
      }
      // Se movCaixaLista vazia ou indefinida, fallback
      if (typeof movCaixaLista === "undefined" || !movCaixaLista || !movCaixaLista.length) {
        _renderRecebimentosOriginal();
        return;
      }
      // Filtra apenas RECEBER
      var receber = movCaixaLista.filter(function (m) { return m.tipo === "RECEBER"; });
      if (!receber.length) {
        _renderRecebimentosOriginal();
        return;
      }
      var tbody = document.getElementById("rec-tbody");
      if (!tbody) return;
      var busca = ((document.getElementById("rec-busca") || {}).value || "").trim().toLowerCase();
      var mes = (document.getElementById("rec-mes") || {}).value;

      var filtrados = receber.filter(function (m) {
        if (mes && m.data_pagamento && String(m.data_pagamento).slice(0,7) !== mes) return false;
        if (busca) {
          var alvo = ((m.parceiro || "") + " " + (m.documento || "") + " " + (m.orcamento_vinculado || "") + " " + (m.natureza || "")).toLowerCase();
          if (alvo.indexOf(busca) === -1) return false;
        }
        return true;
      });
      var soma = 0;
      filtrados.forEach(function (m) { soma += Number(m.valor_total || 0); });

      var elQ = document.getElementById("rec-m-qtd"); if (elQ) elQ.textContent = fmtInt(filtrados.length);
      var elV = document.getElementById("rec-m-valor"); if (elV) elV.textContent = fmtBRL(soma);
      var elL = document.getElementById("rec-lbl"); if (elL) elL.textContent = filtrados.length + " recebimentos (caixa)";

      if (!filtrados.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="tbl-vazio">Nenhum recebimento bate com filtros.</td></tr>';
        return;
      }
      tbody.innerHTML = filtrados.map(function (m) {
        var nat = m.natureza || '<span class="muted">—</span>';
        return '<tr>' +
          '<td>' + (m.data_pagamento ? fmtData(m.data_pagamento) : "—") + '</td>' +
          '<td class="mono">' + escHtml(m.orcamento_vinculado || "—") + '</td>' +
          '<td>' + escHtml(m.parceiro || "—") + '</td>' +
          '<td><span class="muted-tag">' + nat + '</span></td>' +
          '<td class="mono" style="font-size:11px">' + escHtml(m.documento || "—") + '</td>' +
          '<td class="mono" style="font-size:11px">' + escHtml(m.numero_plano_contas || "—") + '</td>' +
          '<td class="num">' + fmtBRL(m.valor_total) + '</td>' +
        '</tr>';
      }).join("");
    };
  }

  // Para Contas a Pagar — adicionar lógica que mostra PAGAR de movimentos_caixa.
  // Como a tela "Contas a Pagar" hoje (caixa_compromissos) usa compromissos_financeiros,
  // que é um conceito diferente (compromissos FUTUROS),
  // NÃO faz sentido substituir — fica em paralelo via tela "Lançamentos de Caixa".
  // A refac fica como anotação de design: as 2 telas têm propósitos diferentes.

  // ===========================================================================
  // M19 Fase 1 — Medidas Disciplinares (POL_001)
  // Reincidência por ANO CIVIL.
  // Graduação automática:
  //   1ª Leve  → Advertência Verbal
  //   2ª Leve  ou 1ª Moderada → Advertência Escrita
  //   3ª Leve  ou 2ª Moderada ou 1ª Grave → Suspensão
  //   reincidência Grave OU 1ª Muito Grave → Demissão por Justa Causa
  // ===========================================================================

  var medidasDiscLista = [];
  var medidasDiscCarregado = false;

  function carregarMedidasDisciplinaresSeNecessario() {
    if (medidasDiscCarregado) { renderMedidasDisciplinares(); return; }
    setStatus("md-status", "Carregando medidas disciplinares…", "carregando");
    Promise.all([
      client.from("medidas_disciplinares").select("*").order("data", { ascending: false }),
      // Garante funcionários carregados pra fazer o JOIN no front
      typeof funcionariosLista !== "undefined" && funcionariosLista.length
        ? Promise.resolve({ data: funcionariosLista })
        : client.from("funcionarios").select("id, nome, cpf, status, cargo")
    ]).then(function (rs) {
      if (rs[0].error) { setStatus("md-status", "Erro: " + rs[0].error.message, "erro"); return; }
      medidasDiscLista = rs[0].data || [];
      // Se carreguei funcionarios localmente, salva
      if (rs[1] && rs[1].data && (typeof funcionariosLista === "undefined" || !funcionariosLista.length)) {
        try { funcionariosLista = rs[1].data; } catch (e) { window._funcsLocal = rs[1].data; }
      }
      medidasDiscCarregado = true;
      setStatus("md-status", null);
      renderMedidasDisciplinares();
    });

    // Listeners (uma vez)
    var bus = document.getElementById("md-busca");
    if (bus && !bus.dataset.bound) { bus.dataset.bound = "1"; bus.addEventListener("input", renderMedidasDisciplinares); }
    var fGrav = document.getElementById("md-filtro-gravidade");
    if (fGrav && !fGrav.dataset.bound) { fGrav.dataset.bound = "1"; fGrav.addEventListener("change", renderMedidasDisciplinares); }
    var fTipo = document.getElementById("md-filtro-tipo");
    if (fTipo && !fTipo.dataset.bound) { fTipo.dataset.bound = "1"; fTipo.addEventListener("change", renderMedidasDisciplinares); }
    var fAno = document.getElementById("md-filtro-ano");
    if (fAno && !fAno.dataset.bound) { fAno.dataset.bound = "1"; fAno.addEventListener("change", renderMedidasDisciplinares); }
    var btnNova = document.getElementById("md-btn-nova");
    if (btnNova && !btnNova.dataset.bound) { btnNova.dataset.bound = "1"; btnNova.addEventListener("click", abrirModalNovaMedida); }
  }

  function _getFuncionariosCache() {
    if (typeof funcionariosLista !== "undefined" && funcionariosLista.length) return funcionariosLista;
    if (window._funcsLocal && window._funcsLocal.length) return window._funcsLocal;
    return [];
  }
  function _funcionarioById(id) {
    var lista = _getFuncionariosCache();
    return lista.find(function (f) { return Number(f.id) === Number(id); });
  }
  function _nomeFuncionario(id) {
    var f = _funcionarioById(id);
    return f ? f.nome : ("(funcionário " + id + ")");
  }

  function renderMedidasDisciplinares() {
    var tbody = document.getElementById("md-tbody");
    if (!tbody) return;
    var busca = ((document.getElementById("md-busca") || {}).value || "").trim().toLowerCase();
    var fGrav = (document.getElementById("md-filtro-gravidade") || {}).value || "";
    var fTipo = (document.getElementById("md-filtro-tipo") || {}).value || "";
    var fAno = (document.getElementById("md-filtro-ano") || {}).value || "";

    // Popular dropdown de anos
    var selAno = document.getElementById("md-filtro-ano");
    if (selAno && selAno.children.length <= 1) {
      var anos = {};
      medidasDiscLista.forEach(function (m) { if (m.data) anos[String(m.data).slice(0,4)] = true; });
      var anosOrdenados = Object.keys(anos).sort().reverse();
      anosOrdenados.forEach(function (a) {
        var opt = document.createElement("option"); opt.value = a; opt.textContent = a;
        selAno.appendChild(opt);
      });
    }

    var filtrados = medidasDiscLista.filter(function (m) {
      if (m.status_medida === "cancelada") {
        // mostra só se o filtro pedir explicitamente
      }
      if (fGrav && m.gravidade_infracao !== fGrav) return false;
      if (fTipo && m.tipo_medida !== fTipo) return false;
      if (fAno && (!m.data || String(m.data).slice(0,4) !== fAno)) return false;
      if (busca) {
        var nomeF = _nomeFuncionario(m.funcionario_id);
        var alvo = (nomeF + " " + (m.descricao_infracao || "") + " " + (m.gestor_responsavel || "")).toLowerCase();
        if (alvo.indexOf(busca) === -1) return false;
      }
      return true;
    });

    // Cards
    var t = { total: filtrados.length, verbal: 0, escrita: 0, suspensao: 0, demissao: 0 };
    filtrados.forEach(function (m) {
      if (m.tipo_medida === "Advertência Verbal") t.verbal++;
      else if (m.tipo_medida === "Advertência Escrita") t.escrita++;
      else if (m.tipo_medida === "Suspensão") t.suspensao++;
      else if (m.tipo_medida === "Demissão por Justa Causa") t.demissao++;
    });
    var setEl = function (id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
    setEl("md-m-total", String(t.total));
    setEl("md-m-verbal", String(t.verbal));
    setEl("md-m-escrita", String(t.escrita));
    setEl("md-m-suspensao", String(t.suspensao));
    setEl("md-m-demissao", String(t.demissao));
    setEl("md-lbl", t.total + " de " + medidasDiscLista.length);

    if (!filtrados.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="tbl-vazio">Nenhuma medida disciplinar encontrada. Use "+ Nova" pra registrar a primeira.</td></tr>';
      return;
    }

    tbody.innerHTML = filtrados.map(function (m) {
      var statusTag = m.status_medida === "aplicada"
        ? '<span class="tag ok">Aplicada</span>'
        : (m.status_medida === "cancelada" ? '<span class="tag">Cancelada</span>' : '<span class="tag warn">Contestada</span>');
      var gravTag = '<span class="tag ' + (m.gravidade_infracao === "Muito Grave" || m.gravidade_infracao === "Grave" ? "danger" : (m.gravidade_infracao === "Moderada" ? "warn" : "")) + '">' + escHtml(m.gravidade_infracao || "—") + '</span>';
      return '<tr class="linha-clicavel" data-mdid="' + m.id + '">' +
        '<td>' + (m.data ? fmtData(m.data) : "—") + '</td>' +
        '<td>' + escHtml(_nomeFuncionario(m.funcionario_id)) + '</td>' +
        '<td>' + gravTag + '</td>' +
        '<td>' + escHtml(m.tipo_medida || "—") + (m.dias_suspensao ? ' <span class="muted-tag">(' + m.dias_suspensao + ' dias)</span>' : '') + '</td>' +
        '<td>' + escHtml((m.descricao_infracao || "").slice(0, 80)) + (m.descricao_infracao && m.descricao_infracao.length > 80 ? "…" : "") + '</td>' +
        '<td>' + statusTag + (m.ciencia_data ? ' <span class="muted-tag" title="Ciência em ' + fmtData(m.ciencia_data) + '">✓ ciente</span>' : '') + '</td>' +
        '<td><button type="button" class="btn-limpar" data-mdid="' + m.id + '" data-action="ver">Ver</button></td>' +
      '</tr>';
    }).join("");

    // Listener de "Ver"
    tbody.querySelectorAll('button[data-action="ver"]').forEach(function (b) {
      if (b.dataset.bound) return;
      b.dataset.bound = "1";
      b.addEventListener("click", function () {
        abrirDetalheMedida(Number(b.getAttribute("data-mdid")));
      });
    });
  }

  // Sugere tipo de medida baseado em ocorrências do ANO CIVIL atual
  function sugerirTipoMedida(funcionarioId, gravidadeProposta) {
    var anoAtual = new Date().getFullYear();
    var ocorrencias = { Leve: 0, Moderada: 0, Grave: 0, "Muito Grave": 0 };
    medidasDiscLista.forEach(function (m) {
      if (Number(m.funcionario_id) !== Number(funcionarioId)) return;
      if (m.status_medida !== "aplicada") return;
      if (!m.data || Number(String(m.data).slice(0,4)) !== anoAtual) return;
      ocorrencias[m.gravidade_infracao] = (ocorrencias[m.gravidade_infracao] || 0) + 1;
    });
    // Conta ESTA nova ocorrência
    var contagemDepoisDesta = JSON.parse(JSON.stringify(ocorrencias));
    contagemDepoisDesta[gravidadeProposta] = (contagemDepoisDesta[gravidadeProposta] || 0) + 1;

    // Aplica regras da POL_001
    if (gravidadeProposta === "Muito Grave") return "Demissão por Justa Causa";
    if (gravidadeProposta === "Grave") {
      if (contagemDepoisDesta.Grave >= 2) return "Demissão por Justa Causa";
      return "Suspensão";
    }
    if (gravidadeProposta === "Moderada") {
      if (contagemDepoisDesta.Moderada >= 2) return "Suspensão";
      return "Advertência Escrita";
    }
    if (gravidadeProposta === "Leve") {
      if (contagemDepoisDesta.Leve >= 3) return "Suspensão";
      if (contagemDepoisDesta.Leve >= 2) return "Advertência Escrita";
      return "Advertência Verbal";
    }
    return null;
  }

  function abrirModalNovaMedida() {
    abrirModalEditarMedida(null);
  }

  function abrirModalEditarMedida(medidaExistente) {
    var ehEdicao = !!medidaExistente;
    var funcs = _getFuncionariosCache().filter(function (f) { return f.status === "ATIVO" || ehEdicao; });

    var html = '<div style="display:grid; gap:12px; max-width: 700px;">';
    if (!ehEdicao) {
      html += '<div class="finding info" style="margin:0;"><strong>Política POL_001:</strong> reincidência conta no ano civil. O sistema sugere o tipo de medida automaticamente baseado na gravidade e nas ocorrências do funcionário em ' + new Date().getFullYear() + '.</div>';
    }

    html += '<div class="form-field"><label for="md-form-func">Funcionário *</label>';
    html += '<select id="md-form-func"><option value="">— escolher —</option>';
    funcs.forEach(function (f) {
      var sel = ehEdicao && Number(medidaExistente.funcionario_id) === Number(f.id) ? " selected" : "";
      html += '<option value="' + f.id + '"' + sel + '>' + escHtml(f.nome) + (f.cargo ? " · " + escHtml(f.cargo) : "") + '</option>';
    });
    html += '</select></div>';

    var hojeISO = new Date().toISOString().slice(0,10);
    html += '<div class="form-field"><label for="md-form-data">Data *</label><input type="date" id="md-form-data" value="' + (medidaExistente && medidaExistente.data ? medidaExistente.data : hojeISO) + '" /></div>';

    html += '<div class="form-field"><label for="md-form-grav">Gravidade da Infração *</label><select id="md-form-grav">';
    ["Leve","Moderada","Grave","Muito Grave"].forEach(function (g) {
      var sel = ehEdicao && medidaExistente.gravidade_infracao === g ? " selected" : "";
      html += '<option value="' + g + '"' + sel + '>' + g + '</option>';
    });
    html += '</select></div>';

    html += '<div class="finding warn" id="md-form-sugestao" style="margin:0; display:none;"></div>';

    html += '<div class="form-field"><label for="md-form-tipo">Tipo de Medida *</label><select id="md-form-tipo">';
    ["Advertência Verbal","Advertência Escrita","Suspensão","Demissão por Justa Causa"].forEach(function (t) {
      var sel = ehEdicao && medidaExistente.tipo_medida === t ? " selected" : "";
      html += '<option value="' + t + '"' + sel + '>' + t + '</option>';
    });
    html += '</select></div>';

    html += '<div class="form-field"><label for="md-form-desc">Descrição da Infração *</label><textarea id="md-form-desc" rows="3" placeholder="Descreva a infração cometida pelo colaborador">' + escHtml((medidaExistente && medidaExistente.descricao_infracao) || "") + '</textarea></div>';

    // Bloco de Suspensão (só visível se tipo=Suspensão)
    html += '<div id="md-form-bloco-suspensao" style="display:none; padding:12px; background:var(--bg3); border-radius:6px; display:grid; gap:8px;">';
    html += '<strong>Detalhes da Suspensão</strong>';
    html += '<div class="form-field"><label for="md-form-dias">Dias (1-30) *</label><input type="number" id="md-form-dias" min="1" max="30" value="' + ((medidaExistente && medidaExistente.dias_suspensao) || "") + '" /></div>';
    html += '<div class="form-field"><label for="md-form-iniciosusp">Início</label><input type="date" id="md-form-iniciosusp" value="' + ((medidaExistente && medidaExistente.data_inicio_suspensao) || "") + '" /></div>';
    html += '<div class="form-field"><label for="md-form-fimsusp">Fim</label><input type="date" id="md-form-fimsusp" value="' + ((medidaExistente && medidaExistente.data_fim_suspensao) || "") + '" /></div>';
    html += '</div>';

    // Bloco de Demissão por Justa Causa (só visível se tipo=Demissão)
    html += '<div id="md-form-bloco-demissao" style="display:none; padding:12px; background:var(--danger-bg); border-radius:6px;">';
    html += '<label style="display:flex; align-items:center; gap:8px; cursor:pointer;">';
    html += '<input type="checkbox" id="md-form-marcar-inativo" />';
    html += '<span><strong>Marcar funcionário como INATIVO</strong> (define data_demissao = data desta medida e status = INATIVO)</span>';
    html += '</label></div>';

    html += '<div class="form-field"><label for="md-form-gestor">Gestor Responsável</label><input type="text" id="md-form-gestor" value="' + escHtml((medidaExistente && medidaExistente.gestor_responsavel) || "") + '" /></div>';

    html += '<div style="padding:12px; background:var(--bg3); border-radius:6px; display:grid; gap:8px;">';
    html += '<strong>Ciência do Colaborador</strong>';
    html += '<div class="form-field"><label for="md-form-ciencia">Data e hora da ciência (deixe vazio se ainda não assinou)</label><input type="datetime-local" id="md-form-ciencia" value="' + ((medidaExistente && medidaExistente.ciencia_data) ? String(medidaExistente.ciencia_data).slice(0,16) : "") + '" /></div>';
    html += '<div class="form-field"><label for="md-form-ciencia-obs">Observações da ciência (opcional)</label><textarea id="md-form-ciencia-obs" rows="2">' + escHtml((medidaExistente && medidaExistente.ciencia_observacao) || "") + '</textarea></div>';
    html += '</div>';

    html += '<div class="form-field"><label for="md-form-status">Status</label><select id="md-form-status">';
    ["aplicada","cancelada","contestada"].forEach(function (s) {
      var sel = (ehEdicao ? medidaExistente.status_medida : "aplicada") === s ? " selected" : "";
      html += '<option value="' + s + '"' + sel + '>' + s + '</option>';
    });
    html += '</select></div>';

    html += '<div class="form-field"><label for="md-form-obs">Observações Gerais</label><textarea id="md-form-obs" rows="2">' + escHtml((medidaExistente && medidaExistente.observacoes) || "") + '</textarea></div>';
    html += '</div>';  // fim do grid

    html += '<div class="modal-acoes" style="display:flex; gap:8px; justify-content:flex-end; margin-top:16px;">';
    if (ehEdicao) {
      html += '<button type="button" class="btn-perigo" id="md-form-btn-excluir">Excluir</button>';
      html += '<span style="flex:1"></span>';
    }
    html += '<button type="button" class="btn-limpar" id="md-form-btn-cancelar">Cancelar</button>';
    html += '<button type="button" class="btn-ouro" id="md-form-btn-salvar">' + (ehEdicao ? "Salvar alterações" : "Cadastrar medida") + '</button>';
    html += '</div>';

    abrirModalDetalhe(ehEdicao ? "Editar Medida Disciplinar" : "Nova Medida Disciplinar", html);

    // ========== Listeners do formulário ==========
    var selFunc = document.getElementById("md-form-func");
    var selGrav = document.getElementById("md-form-grav");
    var selTipo = document.getElementById("md-form-tipo");
    var divSusp = document.getElementById("md-form-bloco-suspensao");
    var divDem = document.getElementById("md-form-bloco-demissao");
    var divSugestao = document.getElementById("md-form-sugestao");
    var inpDias = document.getElementById("md-form-dias");
    var inpInicio = document.getElementById("md-form-iniciosusp");
    var inpFim = document.getElementById("md-form-fimsusp");
    var inpData = document.getElementById("md-form-data");

    function atualizarBlocosCondicionais() {
      var t = selTipo.value;
      divSusp.style.display = t === "Suspensão" ? "grid" : "none";
      divDem.style.display = t === "Demissão por Justa Causa" ? "block" : "none";
    }
    function atualizarSugestao() {
      if (!selFunc.value || !selGrav.value) { divSugestao.style.display = "none"; return; }
      var sugestao = sugerirTipoMedida(Number(selFunc.value), selGrav.value);
      if (!sugestao) { divSugestao.style.display = "none"; return; }
      var anoAtual = new Date().getFullYear();
      var ocs = { Leve:0, Moderada:0, Grave:0, "Muito Grave":0 };
      medidasDiscLista.forEach(function (m) {
        if (Number(m.funcionario_id) !== Number(selFunc.value)) return;
        if (m.status_medida !== "aplicada") return;
        if (!m.data || Number(String(m.data).slice(0,4)) !== anoAtual) return;
        ocs[m.gravidade_infracao] = (ocs[m.gravidade_infracao] || 0) + 1;
      });
      var hist = "Histórico " + anoAtual + ": " + ocs.Leve + " leve(s), " + ocs.Moderada + " moderada(s), " + ocs.Grave + " grave(s), " + ocs["Muito Grave"] + " muito grave(s).";
      divSugestao.style.display = "block";
      divSugestao.innerHTML = '<strong>Sugestão automática:</strong> ' + sugestao + '. <span style="font-size:12px; color:var(--text3)">' + hist + '</span> <button type="button" class="btn-limpar" id="md-form-aplicar-sugestao" style="margin-left:8px;">Aplicar</button>';
      var btnApl = document.getElementById("md-form-aplicar-sugestao");
      if (btnApl) btnApl.addEventListener("click", function () {
        selTipo.value = sugestao;
        atualizarBlocosCondicionais();
      });
    }

    if (selFunc) selFunc.addEventListener("change", atualizarSugestao);
    if (selGrav) selGrav.addEventListener("change", atualizarSugestao);
    if (selTipo) selTipo.addEventListener("change", atualizarBlocosCondicionais);

    // Auto-calcular data fim da suspensão a partir de início + dias
    function autoCalcFimSusp() {
      if (selTipo.value !== "Suspensão") return;
      if (!inpInicio.value || !inpDias.value) return;
      var d = new Date(inpInicio.value);
      d.setDate(d.getDate() + Number(inpDias.value) - 1);
      if (!inpFim.value) inpFim.value = d.toISOString().slice(0,10);
    }
    if (inpInicio) inpInicio.addEventListener("change", autoCalcFimSusp);
    if (inpDias) inpDias.addEventListener("change", autoCalcFimSusp);

    atualizarBlocosCondicionais();
    if (!ehEdicao) atualizarSugestao();

    document.getElementById("md-form-btn-cancelar").addEventListener("click", function () {
      var ov = document.getElementById("modal-detalhe-overlay");
      if (ov) ov.parentNode.removeChild(ov);
    });

    if (ehEdicao) {
      document.getElementById("md-form-btn-excluir").addEventListener("click", function () {
        if (!confirm("Cancelar (logicamente) esta medida disciplinar? Status será marcado como 'cancelada'.")) return;
        client.from("medidas_disciplinares").update({ status_medida: "cancelada" }).eq("id", medidaExistente.id).then(function (r) {
          if (r.error) { alert("Erro: " + r.error.message); return; }
          medidasDiscCarregado = false;
          var ov = document.getElementById("modal-detalhe-overlay");
          if (ov) ov.parentNode.removeChild(ov);
          carregarMedidasDisciplinaresSeNecessario();
        });
      });
    }

    document.getElementById("md-form-btn-salvar").addEventListener("click", function () {
      // Validar
      if (!selFunc.value) { alert("Escolha o funcionário."); return; }
      if (!inpData.value) { alert("Defina a data."); return; }
      if (!selGrav.value) { alert("Escolha a gravidade."); return; }
      if (!selTipo.value) { alert("Escolha o tipo de medida."); return; }
      var desc = document.getElementById("md-form-desc").value.trim();
      if (!desc) { alert("Descreva a infração."); return; }
      if (selTipo.value === "Suspensão") {
        if (!inpDias.value || Number(inpDias.value) < 1 || Number(inpDias.value) > 30) {
          alert("Suspensão precisa de dias entre 1 e 30."); return;
        }
      }

      var dados = {
        funcionario_id: Number(selFunc.value),
        data: inpData.value,
        gravidade_infracao: selGrav.value,
        tipo_medida: selTipo.value,
        descricao_infracao: desc,
        dias_suspensao: selTipo.value === "Suspensão" ? Number(inpDias.value) : null,
        data_inicio_suspensao: selTipo.value === "Suspensão" ? (inpInicio.value || null) : null,
        data_fim_suspensao: selTipo.value === "Suspensão" ? (inpFim.value || null) : null,
        gestor_responsavel: document.getElementById("md-form-gestor").value.trim() || null,
        ciencia_data: document.getElementById("md-form-ciencia").value || null,
        ciencia_observacao: document.getElementById("md-form-ciencia-obs").value.trim() || null,
        status_medida: document.getElementById("md-form-status").value,
        observacoes: document.getElementById("md-form-obs").value.trim() || null
      };

      var marcarInativo = selTipo.value === "Demissão por Justa Causa" && document.getElementById("md-form-marcar-inativo") && document.getElementById("md-form-marcar-inativo").checked;

      var btn = document.getElementById("md-form-btn-salvar");
      btn.disabled = true;
      btn.textContent = "Salvando…";

      var op = ehEdicao
        ? client.from("medidas_disciplinares").update(dados).eq("id", medidaExistente.id)
        : client.from("medidas_disciplinares").insert(dados);

      op.then(function (r) {
        if (r.error) {
          alert("Erro ao salvar: " + r.error.message);
          btn.disabled = false;
          btn.textContent = ehEdicao ? "Salvar alterações" : "Cadastrar medida";
          return;
        }
        // Demissão por Justa Causa → marcar inativo
        if (marcarInativo) {
          client.from("funcionarios").update({
            status: "INATIVO",
            data_demissao: dados.data
          }).eq("id", dados.funcionario_id).then(function () {
            // continua mesmo se der erro — a medida foi salva
            finalizar();
          });
        } else {
          finalizar();
        }
      });

      function finalizar() {
        var ov = document.getElementById("modal-detalhe-overlay");
        if (ov) ov.parentNode.removeChild(ov);
        medidasDiscCarregado = false;
        carregarMedidasDisciplinaresSeNecessario();
      }
    });
  }

  function abrirDetalheMedida(medidaId) {
    var m = medidasDiscLista.find(function (x) { return Number(x.id) === Number(medidaId); });
    if (!m) return;
    abrirModalEditarMedida(m);
  }

  // ===========================================================================
  // M21 — Avaliação de Desempenho
  // 5 dimensões (1-5): Técnico, Qualidade, Comprometimento, Equipe, Iniciativa
  // Nota geral = média das dimensões (ou definida manualmente)
  // ===========================================================================

  var avalDesempLista = [];
  var avalDesempCarregado = false;

  function carregarAvalDesempSeNecessario() {
    if (avalDesempCarregado) { renderAvalDesemp(); return; }
    setStatus("ad-status", "Carregando avaliações…", "carregando");
    client.from("avaliacao_desempenho").select("*").order("data_avaliacao", { ascending: false, nullsLast: true }).then(function (r) {
      if (r.error) { setStatus("ad-status", "Erro: " + r.error.message, "erro"); return; }
      avalDesempLista = r.data || [];
      avalDesempCarregado = true;
      setStatus("ad-status", null);
      renderAvalDesemp();
    });

    var bus = document.getElementById("ad-busca");
    if (bus && !bus.dataset.bound) { bus.dataset.bound = "1"; bus.addEventListener("input", renderAvalDesemp); }
    var fSt = document.getElementById("ad-filtro-status");
    if (fSt && !fSt.dataset.bound) { fSt.dataset.bound = "1"; fSt.addEventListener("change", renderAvalDesemp); }
    var btn = document.getElementById("ad-btn-nova");
    if (btn && !btn.dataset.bound) { btn.dataset.bound = "1"; btn.addEventListener("click", function () { abrirModalAvaliacao(null); }); }
  }

  function _calcMedia5(a) {
    var notas = [a.nota_tecnica, a.nota_qualidade, a.nota_comprometimento, a.nota_equipe, a.nota_iniciativa].filter(function (n) { return typeof n === "number" && n > 0; });
    if (!notas.length) return null;
    return notas.reduce(function (s, n) { return s + n; }, 0) / notas.length;
  }

  function renderAvalDesemp() {
    var tbody = document.getElementById("ad-tbody");
    if (!tbody) return;
    var busca = ((document.getElementById("ad-busca") || {}).value || "").trim().toLowerCase();
    var fSt = (document.getElementById("ad-filtro-status") || {}).value || "";

    var filtrados = avalDesempLista.filter(function (a) {
      if (fSt && a.status_avaliacao !== fSt) return false;
      if (busca) {
        var nomeF = _nomeFuncionario(a.funcionario_id);
        var alvo = (nomeF + " " + (a.observacoes || "") + " " + (a.avaliador_nome || "")).toLowerCase();
        if (alvo.indexOf(busca) === -1) return false;
      }
      return true;
    });

    var totConcl = 0, totRascunho = 0, mediaGlobal = 0, mediaCount = 0;
    filtrados.forEach(function (a) {
      if (a.status_avaliacao === "concluida") totConcl++;
      else if (a.status_avaliacao === "rascunho") totRascunho++;
      var m = a.nota || _calcMedia5(a);
      if (m) { mediaGlobal += m; mediaCount++; }
    });
    var setEl = function (id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
    setEl("ad-m-total", String(filtrados.length));
    setEl("ad-m-concluidas", String(totConcl));
    setEl("ad-m-rascunhos", String(totRascunho));
    setEl("ad-m-media", mediaCount ? (mediaGlobal / mediaCount).toFixed(2) : "—");
    setEl("ad-lbl", filtrados.length + " de " + avalDesempLista.length);

    if (!filtrados.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="tbl-vazio">Nenhuma avaliação. Use "+ Nova" pra cadastrar.</td></tr>';
      return;
    }

    tbody.innerHTML = filtrados.map(function (a) {
      var media = a.nota || _calcMedia5(a);
      var statusTag = a.status_avaliacao === "concluida"
        ? '<span class="tag ok">Concluída</span>'
        : a.status_avaliacao === "rascunho"
          ? '<span class="tag warn">Rascunho</span>'
          : a.status_avaliacao === "contestada"
            ? '<span class="tag danger">Contestada</span>'
            : '<span class="tag">Arquivada</span>';
      var notaTxt = media ? media.toFixed(2) : '<span class="muted">—</span>';
      return '<tr>' +
        '<td>' + (a.data_avaliacao ? fmtData(a.data_avaliacao) : "—") + '</td>' +
        '<td>' + escHtml(_nomeFuncionario(a.funcionario_id)) + '</td>' +
        '<td>' + escHtml(a.avaliador_nome || "—") + '</td>' +
        '<td class="num"><strong>' + notaTxt + '</strong></td>' +
        '<td>' + statusTag + '</td>' +
        '<td><button type="button" class="btn-limpar" data-adid="' + a.id + '">Ver</button></td>' +
      '</tr>';
    }).join("");

    tbody.querySelectorAll('button[data-adid]').forEach(function (b) {
      if (b.dataset.bound) return;
      b.dataset.bound = "1";
      b.addEventListener("click", function () {
        var id = Number(b.getAttribute("data-adid"));
        var a = avalDesempLista.find(function (x) { return Number(x.id) === id; });
        if (a) abrirModalAvaliacao(a);
      });
    });
  }

  function abrirModalAvaliacao(av) {
    var ehEdicao = !!av;
    var funcs = _getFuncionariosCache().filter(function (f) { return f.status === "ATIVO" || ehEdicao; });

    function notaSelectHTML(name, valor) {
      var opts = '<option value="">—</option>';
      [1,2,3,4,5].forEach(function (n) {
        opts += '<option value="' + n + '"' + (Number(valor) === n ? " selected" : "") + '>' + n + '</option>';
      });
      return '<select id="ad-form-' + name + '">' + opts + '</select>';
    }

    var html = '<div style="display:grid; gap:12px; max-width: 700px;">';
    if (!ehEdicao) {
      html += '<div class="finding info" style="margin:0;"><strong>Avaliação de Desempenho:</strong> 5 dimensões com nota 1-5 (1=Insuficiente, 5=Excepcional). A nota geral é calculada como média (ou pode ser definida manualmente).</div>';
    }

    html += '<div class="form-field"><label>Funcionário *</label><select id="ad-form-func"><option value="">— escolher —</option>';
    funcs.forEach(function (f) {
      var sel = ehEdicao && Number(av.funcionario_id) === Number(f.id) ? " selected" : "";
      html += '<option value="' + f.id + '"' + sel + '>' + escHtml(f.nome) + (f.cargo ? " · " + escHtml(f.cargo) : "") + '</option>';
    });
    html += '</select></div>';

    var hojeISO = new Date().toISOString().slice(0,10);
    html += '<div class="form-field"><label>Data da avaliação *</label><input type="date" id="ad-form-data" value="' + (av && av.data_avaliacao ? av.data_avaliacao : hojeISO) + '" /></div>';

    html += '<div class="form-field"><label>Avaliador (nome do gestor que fez a avaliação)</label><input type="text" id="ad-form-avaliador" value="' + escHtml((av && av.avaliador_nome) || "") + '" /></div>';

    html += '<div style="padding:12px; background:var(--bg3); border-radius:6px; display:grid; gap:8px;">';
    html += '<strong>5 Dimensões (1=Insuficiente, 2=Abaixo, 3=Atende, 4=Supera, 5=Excepcional)</strong>';
    html += '<div class="form-field"><label>1. Conhecimento Técnico</label>' + notaSelectHTML("tec", av && av.nota_tecnica) + '</div>';
    html += '<div class="form-field"><label>2. Qualidade do Trabalho</label>' + notaSelectHTML("qual", av && av.nota_qualidade) + '</div>';
    html += '<div class="form-field"><label>3. Comprometimento e Pontualidade</label>' + notaSelectHTML("comp", av && av.nota_comprometimento) + '</div>';
    html += '<div class="form-field"><label>4. Trabalho em Equipe / Comunicação</label>' + notaSelectHTML("equ", av && av.nota_equipe) + '</div>';
    html += '<div class="form-field"><label>5. Iniciativa / Proatividade</label>' + notaSelectHTML("ini", av && av.nota_iniciativa) + '</div>';
    html += '<div class="form-field" style="margin-top:8px;"><label>Nota geral (1-5) — auto-calculada como média se vazia</label><input type="number" id="ad-form-nota-geral" min="1" max="5" step="0.01" value="' + ((av && av.nota) || "") + '" placeholder="Vazio = média das dimensões" /></div>';
    html += '</div>';

    html += '<div class="form-field"><label>Pontos fortes</label><textarea id="ad-form-fortes" rows="2">' + escHtml((av && av.pontos_fortes) || "") + '</textarea></div>';
    html += '<div class="form-field"><label>Pontos de melhoria</label><textarea id="ad-form-melhoria" rows="2">' + escHtml((av && av.pontos_melhoria) || "") + '</textarea></div>';
    html += '<div class="form-field"><label>Metas para o próximo ciclo</label><textarea id="ad-form-metas" rows="2">' + escHtml((av && av.metas_proximo_ciclo) || "") + '</textarea></div>';
    html += '<div class="form-field"><label>Observações do gestor</label><textarea id="ad-form-obs" rows="2">' + escHtml((av && av.observacoes) || "") + '</textarea></div>';
    html += '<div class="form-field"><label>Observações do colaborador (autoavaliação opcional)</label><textarea id="ad-form-obs-func" rows="2">' + escHtml((av && av.observacoes_funcionario) || "") + '</textarea></div>';

    html += '<div class="form-field"><label>Status</label><select id="ad-form-status">';
    ["rascunho","concluida","contestada","arquivada"].forEach(function (s) {
      var sel = (ehEdicao ? av.status_avaliacao : "rascunho") === s ? " selected" : "";
      html += '<option value="' + s + '"' + sel + '>' + s + '</option>';
    });
    html += '</select></div>';
    html += '</div>';

    html += '<div class="modal-acoes" style="display:flex; gap:8px; justify-content:flex-end; margin-top:16px;">';
    if (ehEdicao) html += '<button type="button" class="btn-perigo" id="ad-form-btn-arquivar">Arquivar</button><span style="flex:1"></span>';
    html += '<button type="button" class="btn-limpar" id="ad-form-btn-cancelar">Cancelar</button>';
    html += '<button type="button" class="btn-ouro" id="ad-form-btn-salvar">' + (ehEdicao ? "Salvar alterações" : "Cadastrar avaliação") + '</button>';
    html += '</div>';

    abrirModalDetalhe(ehEdicao ? "Editar Avaliação de Desempenho" : "Nova Avaliação de Desempenho", html);

    document.getElementById("ad-form-btn-cancelar").addEventListener("click", function () {
      var ov = document.getElementById("modal-detalhe-overlay");
      if (ov) ov.parentNode.removeChild(ov);
    });

    if (ehEdicao) {
      document.getElementById("ad-form-btn-arquivar").addEventListener("click", function () {
        if (!confirm("Arquivar esta avaliação? Status será marcado como 'arquivada'.")) return;
        client.from("avaliacao_desempenho").update({ status_avaliacao: "arquivada" }).eq("id", av.id).then(function (r) {
          if (r.error) { alert("Erro: " + r.error.message); return; }
          avalDesempCarregado = false;
          var ov = document.getElementById("modal-detalhe-overlay");
          if (ov) ov.parentNode.removeChild(ov);
          carregarAvalDesempSeNecessario();
        });
      });
    }

    document.getElementById("ad-form-btn-salvar").addEventListener("click", function () {
      var fid = document.getElementById("ad-form-func").value;
      if (!fid) { alert("Escolha o funcionário."); return; }
      var data = document.getElementById("ad-form-data").value;
      if (!data) { alert("Defina a data."); return; }

      function getNota(name) {
        var v = document.getElementById("ad-form-" + name).value;
        return v ? Number(v) : null;
      }
      var notas = {
        nota_tecnica: getNota("tec"),
        nota_qualidade: getNota("qual"),
        nota_comprometimento: getNota("comp"),
        nota_equipe: getNota("equ"),
        nota_iniciativa: getNota("ini")
      };
      var notaGeralInput = document.getElementById("ad-form-nota-geral").value;
      var notaGeral;
      if (notaGeralInput) {
        notaGeral = Math.round(Number(notaGeralInput));
      } else {
        var calc = _calcMedia5(notas);
        notaGeral = calc ? Math.round(calc) : null;
      }

      var dados = {
        funcionario_id: Number(fid),
        data_avaliacao: data,
        avaliador_nome: document.getElementById("ad-form-avaliador").value.trim() || null,
        nota: notaGeral,
        nota_tecnica: notas.nota_tecnica,
        nota_qualidade: notas.nota_qualidade,
        nota_comprometimento: notas.nota_comprometimento,
        nota_equipe: notas.nota_equipe,
        nota_iniciativa: notas.nota_iniciativa,
        pontos_fortes: document.getElementById("ad-form-fortes").value.trim() || null,
        pontos_melhoria: document.getElementById("ad-form-melhoria").value.trim() || null,
        metas_proximo_ciclo: document.getElementById("ad-form-metas").value.trim() || null,
        observacoes: document.getElementById("ad-form-obs").value.trim() || null,
        observacoes_funcionario: document.getElementById("ad-form-obs-func").value.trim() || null,
        status_avaliacao: document.getElementById("ad-form-status").value
      };

      var btn = document.getElementById("ad-form-btn-salvar");
      btn.disabled = true; btn.textContent = "Salvando…";

      var op = ehEdicao
        ? client.from("avaliacao_desempenho").update(dados).eq("id", av.id)
        : client.from("avaliacao_desempenho").insert(dados);

      op.then(function (r) {
        if (r.error) {
          alert("Erro: " + r.error.message);
          btn.disabled = false;
          btn.textContent = ehEdicao ? "Salvar alterações" : "Cadastrar avaliação";
          return;
        }
        avalDesempCarregado = false;
        var ov = document.getElementById("modal-detalhe-overlay");
        if (ov) ov.parentNode.removeChild(ov);
        carregarAvalDesempSeNecessario();
      });
    });
  }

  // ===========================================================================
  // M22+M23 — Cálculo REAL do Bônus Individual via RPC
  // Adiciona um botão "Calcular Bônus Real" na tela existente bonus_indiv_detalhe
  // que chama fn_calcular_bonus_total e mostra o resultado em modal.
  // ===========================================================================

  function abrirCalculoBonusReal(funcionarioId, nomeFuncionario) {
    if (!funcionarioId) { alert("Selecione um funcionário."); return; }
    // Determinar período (semestre atual por default)
    var hoje = new Date();
    var ano = hoje.getFullYear();
    var mes = hoje.getMonth() + 1;
    var inicio = mes <= 6 ? ano + "-01-01" : ano + "-07-01";
    var fim = mes <= 6 ? ano + "-06-30" : ano + "-12-31";

    abrirModalDetalhe("Bônus Individual — Cálculo Real (carregando…)",
      '<p class="muted">Calculando via fn_calcular_bonus_total…</p>');

    client.rpc("fn_calcular_bonus_total", {
      p_funcionario_id: funcionarioId,
      p_inicio: inicio,
      p_fim: fim,
      p_pct_ll: 0.10
    }).then(function (r) {
      if (r.error) {
        abrirModalDetalhe("Bônus — Erro", '<p class="muted">' + escHtml(r.error.message) + '</p>');
        return;
      }
      var d = r.data;
      var html = '<div class="finding info" style="margin:0 0 12px;"><strong>' + escHtml(d.funcionario_nome || nomeFuncionario || "—") + '</strong> · período ' + d.periodo_inicio + ' a ' + d.periodo_fim + '</div>';

      // Cards das 3 esferas
      html += '<div class="grid-metrics" style="margin-bottom:12px;">';
      html += '<div class="metric-card"><div class="metric-label">Profissional</div><div class="metric-value">' + d.esferas.profissional.esfera_profissional_pct + '%</div><div class="metric-sub">de ' + d.esferas.profissional.esfera_profissional_max_pct + '%</div></div>';
      html += '<div class="metric-card"><div class="metric-label">Área</div><div class="metric-value">' + d.esferas.area.esfera_area_pct + '%</div><div class="metric-sub">de ' + d.esferas.area.esfera_area_max_pct + '%</div></div>';
      html += '<div class="metric-card"><div class="metric-label">Empresa</div><div class="metric-value">' + d.esferas.empresa.esfera_empresa_pct + '%</div><div class="metric-sub">de ' + d.esferas.empresa.esfera_empresa_max_pct + '%</div></div>';
      html += '<div class="metric-card" style="border-left-color: var(--ouro);"><div class="metric-label">TOTAL</div><div class="metric-value">' + d.pct_total + '%</div><div class="metric-sub">de 100%</div></div>';
      html += '</div>';

      // Card de valor estimado
      html += '<div class="card" style="background:var(--bg3); padding:12px; margin-bottom:12px;">';
      html += '<strong>💰 Bônus estimado:</strong> ' + fmtBRL(d.valor_estimado);
      html += '<div class="muted" style="font-size:12px; margin-top:4px;">Pool ajustado R$ ' + fmtBRLNum(d.pool.pool_ajustado) + ' (multiplicador ' + d.pool.multiplicador + 'x da margem ' + d.pool.margem_pct + '%) ÷ ' + d.pool.qtd_elegiveis + ' elegíveis = R$ ' + fmtBRLNum(d.pool.valor_por_pessoa_100pct) + '/pessoa @ 100%, × ' + d.pct_total + '% atingido</div>';
      html += '</div>';

      // Detalhe Profissional
      var prof = d.esferas.profissional.detalhe;
      html += '<details open><summary><strong>Esfera Profissional (40%)</strong></summary>';
      html += '<table class="tabela"><thead><tr><th>Componente</th><th class="num">Atingido</th><th class="num">Máximo</th><th>Detalhe</th></tr></thead><tbody>';
      html += '<tr><td>1. Conduta</td><td class="num">' + prof.conduta.pct + '%</td><td class="num">' + prof.conduta.pct_max + '%</td><td>' + prof.conduta.qtd_medidas + ' medida(s) disciplinar(es) no período</td></tr>';
      html += '<tr><td>2. Avaliação de Performance</td><td class="num">' + prof.avaliacao.pct + '%</td><td class="num">' + prof.avaliacao.pct_max + '%</td><td>' + (prof.avaliacao.nota !== null ? "Nota " + prof.avaliacao.nota : '<span class="muted">sem avaliação no período</span>') + '</td></tr>';
      var freqMsg = prof.faltas_justificadas.frequencia_disponivel ? "" : ' <span class="muted">(aguardando dados de frequência)</span>';
      html += '<tr><td>3. Faltas Justificadas</td><td class="num">' + prof.faltas_justificadas.pct + '%</td><td class="num">' + prof.faltas_justificadas.pct_max + '%</td><td>' + prof.faltas_justificadas.qtd + ' falta(s)' + freqMsg + '</td></tr>';
      html += '<tr><td>4. Atrasos</td><td class="num">' + prof.atrasos.pct + '%</td><td class="num">' + prof.atrasos.pct_max + '%</td><td>' + prof.atrasos.qtd + ' atraso(s)' + freqMsg + '</td></tr>';
      html += '<tr><td>Penalidade — Faltas Injustificadas</td><td class="num text-danger">' + prof.faltas_injustificadas.penalidade_pct + '%</td><td class="num">−12,5%</td><td>' + prof.faltas_injustificadas.qtd + ' falta(s) injustificada(s)' + freqMsg + '</td></tr>';
      html += '</tbody></table></details>';

      // Detalhe Área
      var area = d.esferas.area.detalhe;
      html += '<details style="margin-top:12px;"><summary><strong>Esfera Área (30%)</strong></summary>';
      if (area.sem_dados) {
        html += '<p class="muted" style="margin:8px 0;">Nenhuma meta de área cadastrada para o organograma do funcionário neste período.</p>';
      } else {
        html += '<p>' + area.qtd_metas + ' meta(s) cadastrada(s). ' + area.meses_atingidos + ' meses atingidos de ' + (area.qtd_metas * area.meses_periodo) + ' possíveis (' + area.pct_atingido_metas + '%).</p>';
      }
      html += '</details>';

      // Detalhe Empresa
      var emp = d.esferas.empresa.detalhe;
      html += '<details style="margin-top:12px;"><summary><strong>Esfera Empresa (30%)</strong></summary>';
      html += '<table class="tabela"><thead><tr><th>Indicador</th><th class="num">Atingido</th><th class="num">Máximo</th><th>Detalhe</th></tr></thead><tbody>';
      html += '<tr><td>Faturamento Bruto</td><td class="num">' + emp.faturamento.pct + '%</td><td class="num">' + emp.faturamento.pct_max + '%</td><td>' + (emp.faturamento.meta ? "Meta " + fmtBRL(emp.faturamento.meta) + ", realizado " + fmtBRL(emp.faturamento.realizado) + " (" + (emp.faturamento.pct_meta || 0) + "%)" : '<span class="muted">meta não cadastrada</span>') + '</td></tr>';
      html += '<tr><td>Margem Líquida</td><td class="num">' + emp.margem_liquida.pct + '%</td><td class="num">' + emp.margem_liquida.pct_max + '%</td><td>' + emp.margem_liquida.meses_atingidos + ' mês(es) atingidos da meta de ' + emp.margem_liquida.meta_pct + '% margem</td></tr>';
      html += '<tr><td>Caixa Positivo</td><td class="num">' + emp.caixa_positivo.pct + '%</td><td class="num">' + emp.caixa_positivo.pct_max + '%</td><td>' + emp.caixa_positivo.meses_positivos + ' mês(es) positivos de ' + emp.caixa_positivo.meses_periodo + '</td></tr>';
      html += '<tr><td>ICC (cobertura 6m)</td><td class="num">' + emp.icc.pct + '%</td><td class="num">' + emp.icc.pct_max + '%</td><td>Saldo cobre compromissos próximos 6m?</td></tr>';
      html += '</tbody></table></details>';

      // Substitui o conteúdo do modal
      var ov = document.getElementById("modal-detalhe-overlay");
      if (ov) {
        var titulo = ov.querySelector("h2");
        if (titulo) titulo.textContent = "Bônus Individual — " + (d.funcionario_nome || "");
        var body = ov.querySelector(".modal-detalhe-body");
        if (body) body.innerHTML = html;
      }
    });
  }

  // Helper formato BRL como número (sem prefixo)
  if (typeof fmtBRLNum !== "function") {
    window.fmtBRLNum = function (v) {
      var n = Number(v || 0);
      return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
  }

  // ===========================================================================
  // Drill-down em Funcionários — abrir histórico de Medidas + Avaliações
  // ===========================================================================
  function abrirHistoricoRH(funcionarioId, nomeFuncionario) {
    if (!funcionarioId) return;
    abrirModalDetalhe("Histórico de RH — " + (nomeFuncionario || ""), '<p class="muted">Carregando…</p>');

    Promise.all([
      client.from("medidas_disciplinares").select("*").eq("funcionario_id", funcionarioId).order("data", { ascending: false }),
      client.from("avaliacao_desempenho").select("*").eq("funcionario_id", funcionarioId).order("data_avaliacao", { ascending: false, nullsLast: true })
    ]).then(function (rs) {
      var medidas = (rs[0].data || []).filter(function (m) { return m.status_medida !== "cancelada"; });
      var avals = (rs[1].data || []).filter(function (a) { return a.status_avaliacao !== "arquivada"; });

      var html = '<div class="grid-metrics" style="margin-bottom:12px;">';
      html += '<div class="metric-card"><div class="metric-label">Medidas Disciplinares</div><div class="metric-value">' + medidas.length + '</div></div>';
      html += '<div class="metric-card"><div class="metric-label">Avaliações</div><div class="metric-value">' + avals.length + '</div></div>';
      var ultimaNota = avals.length ? (avals[0].nota || _calcMedia5(avals[0])) : null;
      html += '<div class="metric-card"><div class="metric-label">Última nota</div><div class="metric-value">' + (ultimaNota ? Number(ultimaNota).toFixed(2) : "—") + '</div></div>';
      html += '</div>';

      // Medidas
      html += '<details open><summary><strong>Medidas Disciplinares (' + medidas.length + ')</strong></summary>';
      if (!medidas.length) {
        html += '<p class="muted" style="margin:8px 0;">Nenhuma medida disciplinar registrada.</p>';
      } else {
        html += '<table class="tabela"><thead><tr><th>Data</th><th>Gravidade</th><th>Tipo</th><th>Descrição</th><th>Status</th></tr></thead><tbody>';
        medidas.forEach(function (m) {
          html += '<tr>' +
            '<td>' + (m.data ? fmtData(m.data) : "—") + '</td>' +
            '<td><span class="tag ' + (m.gravidade_infracao === "Muito Grave" || m.gravidade_infracao === "Grave" ? "danger" : (m.gravidade_infracao === "Moderada" ? "warn" : "")) + '">' + escHtml(m.gravidade_infracao || "—") + '</span></td>' +
            '<td>' + escHtml(m.tipo_medida || "—") + '</td>' +
            '<td>' + escHtml((m.descricao_infracao || "").slice(0, 60)) + '</td>' +
            '<td><span class="tag">' + escHtml(m.status_medida) + '</span></td>' +
          '</tr>';
        });
        html += '</tbody></table>';
      }
      html += '</details>';

      // Avaliações
      html += '<details style="margin-top:12px;"><summary><strong>Avaliações de Desempenho (' + avals.length + ')</strong></summary>';
      if (!avals.length) {
        html += '<p class="muted" style="margin:8px 0;">Nenhuma avaliação cadastrada.</p>';
      } else {
        html += '<table class="tabela"><thead><tr><th>Data</th><th>Avaliador</th><th class="num">Nota geral</th><th>Status</th></tr></thead><tbody>';
        avals.forEach(function (a) {
          var media = a.nota || _calcMedia5(a);
          html += '<tr>' +
            '<td>' + (a.data_avaliacao ? fmtData(a.data_avaliacao) : "—") + '</td>' +
            '<td>' + escHtml(a.avaliador_nome || "—") + '</td>' +
            '<td class="num">' + (media ? Number(media).toFixed(2) : "—") + '</td>' +
            '<td><span class="tag">' + escHtml(a.status_avaliacao || "—") + '</span></td>' +
          '</tr>';
        });
        html += '</tbody></table>';
      }
      html += '</details>';

      // Botão calcular bônus
      html += '<div style="margin-top:16px; text-align:right;">';
      html += '<button type="button" class="btn-ouro" id="btn-rh-calcular-bonus">Calcular Bônus do semestre →</button>';
      html += '</div>';

      var ov = document.getElementById("modal-detalhe-overlay");
      if (ov) {
        var body = ov.querySelector(".modal-detalhe-body");
        if (body) body.innerHTML = html;
      }
      var btn = document.getElementById("btn-rh-calcular-bonus");
      if (btn) btn.addEventListener("click", function () {
        abrirCalculoBonusReal(funcionarioId, nomeFuncionario);
      });
    });
  }

  // Habilita drill-down nas linhas de #rhf-tbody (tela Funcionários)
  document.addEventListener("DOMContentLoaded", function () {
    var tb = document.getElementById("rhf-tbody");
    if (tb && !tb.dataset.rhBound) {
      tb.dataset.rhBound = "1";
      tb.addEventListener("click", function (ev) {
        var tr = ev.target && ev.target.closest && ev.target.closest("tr[data-rhf-id]");
        if (!tr) return;
        var fid = Number(tr.getAttribute("data-rhf-id"));
        var nome = tr.cells && tr.cells[0] ? tr.cells[0].textContent.trim() : "";
        abrirHistoricoRH(fid, nome);
      });
    }
  });

  // ===========================================================================
  // M25 — Política "Nunca Sobrescrever" aplicada nos imports
  // Cada import: 1) cria entrada em imports_historico
  //              2) marca registros anteriores do mesmo período como vigente=false
  //              3) insere novos com vigente=true + import_id
  // ===========================================================================

  // Helper genérico
  function aplicarPoliticaHistorico(opts, cb) {
    // opts = {
    //   tipo: string,
    //   arquivo: string?,
    //   competencia: string?,
    //   excecoes: array?,
    //   marcarAnteriores: [{ tabela, filtros: {col:val ou [val1,val2]} }],
    //   inserts: [{ tabela, linhas, opts: {batch?} }]
    // }
    var totalRegistros = (opts.inserts || []).reduce(function (s, i) { return s + (i.linhas || []).length; }, 0);
    var qtdExcecoes = (opts.excecoes || []).length;

    // 1) Cria entrada em imports_historico
    client.from("imports_historico").insert({
      tipo_import: opts.tipo,
      nome_arquivo: opts.arquivo || null,
      competencia_referencia: opts.competencia || null,
      qtd_registros: totalRegistros,
      qtd_excecoes: qtdExcecoes,
      excecoes_json: opts.excecoes && opts.excecoes.length ? opts.excecoes : null,
      observacoes: opts.observacoes || null
    }).select().single().then(function (r) {
      if (r.error) { cb({ erro: "Erro criando imports_historico: " + r.error.message }); return; }
      var importId = r.data.id;

      // 2) Marca anteriores como vigente=false
      var idx = 0;
      function marcarProximo() {
        if (!opts.marcarAnteriores || idx >= opts.marcarAnteriores.length) {
          inserirNovos();
          return;
        }
        var ma = opts.marcarAnteriores[idx++];
        if (!ma || !ma.tabela) { marcarProximo(); return; }
        var q = client.from(ma.tabela).update({ vigente: false }).eq("vigente", true);
        if (ma.filtros) {
          Object.keys(ma.filtros).forEach(function (col) {
            var val = ma.filtros[col];
            if (Array.isArray(val) && val.length) q = q.in(col, val);
            else if (!Array.isArray(val)) q = q.eq(col, val);
            // se array vazio, não filtra (sem-op)
          });
        }
        q.then(function (r2) {
          if (r2.error) console.warn("Erro update vigente em", ma.tabela, r2.error.message);
          marcarProximo();
        });
      }

      // 3) Insere novos com vigente=true + import_id
      function inserirNovos() {
        var insIdx = 0;
        var totalInseridos = 0;
        var erros = [];
        function inserirProx() {
          if (insIdx >= (opts.inserts || []).length) {
            cb({ importId: importId, totalInseridos: totalInseridos, erros: erros });
            return;
          }
          var ins = opts.inserts[insIdx++];
          if (!ins.linhas || !ins.linhas.length) { inserirProx(); return; }
          var linhas = ins.linhas.map(function (l) {
            var copia = {};
            Object.keys(l).forEach(function (k) { copia[k] = l[k]; });
            copia.vigente = true;
            copia.import_id = importId;
            return copia;
          });
          var lotes = [];
          for (var i = 0; i < linhas.length; i += 200) lotes.push(linhas.slice(i, i + 200));
          var li = 0;
          function lote() {
            if (li >= lotes.length) { inserirProx(); return; }
            client.from(ins.tabela).insert(lotes[li]).then(function (r3) {
              if (r3.error) erros.push({ tabela: ins.tabela, erro: r3.error.message });
              else totalInseridos += lotes[li].length;
              li++; lote();
            });
          }
          lote();
        }
        inserirProx();
      }

      marcarProximo();
    });
  }

  // ===========================================================================
  // REFAC dos imports existentes — substituem as funções `confirmar*` antigas
  // ===========================================================================

  // 1) Saída de Estoque (4 destinos)
  function confirmarSaidaEstoqueRico(parsed) {
    if (!parsed) return;
    var ossUnicas = Array.from(new Set((parsed.detalhes || []).map(function (d) { return d.os; })));
    var ossResumo = Array.from(new Set((parsed.resumo || []).map(function (r) { return r.codigo_os; })));
    var competsMP = Array.from(new Set((parsed.detalhes || []).map(function (d) { return d.compet; })));
    var competsDir = Array.from(new Set((parsed.diretos || []).map(function (d) { return d.mes_ref; })));
    var competencias = Array.from(new Set(competsMP.concat(competsDir).filter(Boolean)));

    var msg = "Vai inserir (NOVAS versões + manter histórico):\n"
            + "• " + (parsed.detalhes || []).length + " em estoque_detalhes\n"
            + "• " + (parsed.resumo || []).length + " em estoque_resumo\n"
            + "• " + (parsed.evolucao || []).length + " em os_evolucao_mensal\n"
            + "• " + (parsed.diretos || []).length + " em custo_direto_competencia\n\n"
            + "Versões anteriores serão marcadas vigente=false (não apagadas).\nConfirma?";
    if (!confirm(msg)) return;
    impBtnConf.disabled = true;
    impBtnPrev.disabled = true;
    setImpStatus("Aplicando política de histórico…", "carregando");

    aplicarPoliticaHistorico({
      tipo: "saida_estoque",
      arquivo: (impArquivo && impArquivo.files && impArquivo.files[0] ? impArquivo.files[0].name : null),
      competencia: competencias.length === 1 ? competencias[0] : (competencias.length + " competências"),
      marcarAnteriores: [
        { tabela: "estoque_detalhes", filtros: { os: ossUnicas } },
        { tabela: "estoque_resumo", filtros: { codigo_os: ossResumo } },
        { tabela: "os_evolucao_mensal", filtros: { os: ossUnicas } },
        { tabela: "custo_direto_competencia", filtros: { mes_ref: competsDir } }
      ],
      inserts: [
        { tabela: "estoque_detalhes", linhas: parsed.detalhes || [] },
        { tabela: "estoque_resumo", linhas: parsed.resumo || [] },
        { tabela: "os_evolucao_mensal", linhas: parsed.evolucao || [] },
        { tabela: "custo_direto_competencia", linhas: parsed.diretos || [] }
      ]
    }, function (res) {
      impBtnConf.disabled = false;
      impBtnPrev.disabled = false;
      if (res.erro) { setImpStatus(res.erro, "erro"); return; }
      if (res.erros && res.erros.length) {
        setImpStatus("Concluído com avisos. Inseridos: " + res.totalInseridos + " · Erros: " + res.erros.map(function(e){return e.tabela+": "+e.erro;}).slice(0,3).join(" | "), "alerta");
      } else {
        setImpStatus("Sucesso! " + res.totalInseridos + " registros inseridos. Import #" + res.importId + " registrado em imports_historico.", "ok");
      }
      try { aprCarregado = false; orcamentosCarregados = false; rcCarregado = false; } catch (e) {}
    });
  }

  // 2) Dashboard de Orçamentos (3 destinos)
  function confirmarDashboardOrcamentos(parsed) {
    if (!parsed) return;
    var orcs = Array.from(new Set((parsed.items || []).map(function (i) { return i.orcamento; })));
    var oss = Array.from(new Set((parsed.os_custos || []).map(function (o) { return o.os; })));
    var ossOrdens = Array.from(new Set((parsed.ordens || []).map(function (o) { return o.os; })));

    var msg = "Vai inserir:\n• " + (parsed.items||[]).length + " em orcamento_items\n"
            + "• " + (parsed.os_custos||[]).length + " em os_custos_planejados\n"
            + "• " + (parsed.ordens||[]).length + " em ordens_servico\n\n"
            + "Versões anteriores serão marcadas vigente=false.\nConfirma?";
    if (!confirm(msg)) return;
    impBtnConf.disabled = true;
    impBtnPrev.disabled = true;
    setImpStatus("Aplicando política de histórico…", "carregando");

    aplicarPoliticaHistorico({
      tipo: "dashboard_orcamentos",
      arquivo: (impArquivo && impArquivo.files && impArquivo.files[0] ? impArquivo.files[0].name : null),
      marcarAnteriores: [
        { tabela: "orcamento_items", filtros: { orcamento: orcs } },
        { tabela: "os_custos_planejados", filtros: { os: oss } },
        { tabela: "ordens_servico", filtros: { os: ossOrdens } }
      ],
      inserts: [
        { tabela: "orcamento_items", linhas: parsed.items || [] },
        { tabela: "os_custos_planejados", linhas: parsed.os_custos || [] },
        { tabela: "ordens_servico", linhas: parsed.ordens || [] }
      ]
    }, function (res) {
      impBtnConf.disabled = false;
      impBtnPrev.disabled = false;
      if (res.erro) { setImpStatus(res.erro, "erro"); return; }
      if (res.erros && res.erros.length) {
        setImpStatus("Concluído com avisos. Inseridos: " + res.totalInseridos + " · Erros: " + res.erros.length, "alerta");
      } else {
        setImpStatus("Sucesso! " + res.totalInseridos + " registros. Import #" + res.importId, "ok");
      }
      try { aprCarregado = false; orcamentosCarregados = false; } catch (e) {}
    });
  }

  // 3) A Pagar x A Receber → movimentos_caixa
  function confirmarPagarReceber(parsed) {
    if (!parsed || !parsed.linhas || !parsed.linhas.length) return;
    var msg = "Vai inserir " + parsed.linhas.length + " linhas em movimentos_caixa "
            + "(" + parsed.pagar + " PAGAR, " + parsed.classifAuto + " RECEBER auto-classificadas, "
            + parsed.pendentesReceber + " RECEBER pendentes).\n\nVersões anteriores marcadas vigente=false.\nConfirma?";
    if (!confirm(msg)) return;
    impBtnConf.disabled = true;
    impBtnPrev.disabled = true;
    setImpStatus("Aplicando política de histórico…", "carregando");

    // Coletar documentos únicos (chave de identidade no relatório)
    var docs = Array.from(new Set(parsed.linhas.map(function (m) { return m.documento; }).filter(Boolean)));

    aplicarPoliticaHistorico({
      tipo: "pagar_receber",
      arquivo: (impArquivo && impArquivo.files && impArquivo.files[0] ? impArquivo.files[0].name : null),
      marcarAnteriores: [
        // Marca como não-vigentes os movimentos com mesmos documentos (re-import do mesmo arquivo)
        { tabela: "movimentos_caixa", filtros: { documento: docs } }
      ],
      inserts: [
        { tabela: "movimentos_caixa", linhas: parsed.linhas }
      ]
    }, function (res) {
      impBtnConf.disabled = false;
      impBtnPrev.disabled = false;
      if (res.erro) { setImpStatus(res.erro, "erro"); return; }
      setImpStatus("Sucesso! " + res.totalInseridos + " linhas em movimentos_caixa. Import #" + res.importId + ". " + parsed.pendentesReceber + " RECEBER pendentes pra classificar manualmente em 'Lançamentos de Caixa'.", "ok");
    });
  }

  // ===========================================================================
  // Imports simples — substituir UPSERT por política de histórico
  // (caixa_saldo_mensal, saldos_contas, compromissos, recebimentos_previstos)
  //
  // Esses passam pela função genérica `confirmarImportContinuar`. Vou substituir
  // o caminho default lá (que faz upsert/insert puro) pra aplicar a política
  // quando a tabela está na lista das que têm `vigente`.
  // ===========================================================================

  var TABELAS_COM_HISTORICO = [
    'frequencia_mensal',
    'os_evolucao_mensal',
    'caixa_saldo_mensal',
    'saldos_contas',
    'os_custos_planejados',
    'ordens_servico',
    'estoque_detalhes',
    'estoque_resumo',
    'custo_direto_competencia',
    'movimentos_caixa'
  ];

  // Tabelas SEM mes_ref/competência (cadastros) — continuam INSERT puro
  // (compromissos_financeiros, recebimentos_previstos, contas_bancarias, movimentos, saldo_reconhecer, notas_fiscais não estão na M24 — não têm coluna vigente)

  // Override de confirmarImportContinuar — adiciona política nos casos aplicáveis
  // (a função original será chamada se não for caso especial)
  if (typeof confirmarImportContinuar === "function") {
    var _confirmarImportContinuarOriginal = confirmarImportContinuar;
    confirmarImportContinuar = function (tpl) {
      // Os tipos especiais (saida_estoque, dashboard_orcamentos, pagar_receber)
      // já são tratados antes (vão pelas funções refatoradas acima).
      // Pra os tipos com onConflict: aplicar política (caixa_saldo_mensal, saldos_contas)
      if (tpl && tpl.alvo && tpl.onConflict && TABELAS_COM_HISTORICO.indexOf(tpl.alvo) !== -1) {
        if (!confirm("Confirmar importação de " + impParsed.linhas.length + " linhas para " + tpl.nomeLegivel + "?\nVersões anteriores marcadas vigente=false (histórico preservado).")) return;
        impBtnConf.disabled = true;
        impBtnPrev.disabled = true;
        setImpStatus("Aplicando política de histórico…", "carregando");

        // Calcular filtros de "marcar anteriores" baseado no onConflict
        var conflictCols = String(tpl.onConflict).split(",").map(function (s) { return s.trim(); });
        var filtros = {};
        conflictCols.forEach(function (col) {
          var vals = Array.from(new Set(impParsed.linhas.map(function (l) { return l[col]; }).filter(function (v) { return v !== null && v !== undefined; })));
          if (vals.length) filtros[col] = vals;
        });

        aplicarPoliticaHistorico({
          tipo: impTipo.value,
          arquivo: (impArquivo && impArquivo.files && impArquivo.files[0] ? impArquivo.files[0].name : null),
          marcarAnteriores: [{ tabela: tpl.alvo, filtros: filtros }],
          inserts: [{ tabela: tpl.alvo, linhas: impParsed.linhas }]
        }, function (res) {
          impBtnConf.disabled = false;
          impBtnPrev.disabled = false;
          if (res.erro) { setImpStatus(res.erro, "erro"); return; }
          if (res.erros && res.erros.length) {
            setImpStatus("Concluído com avisos. Inseridos: " + res.totalInseridos + " · Erros: " + res.erros.length, "alerta");
          } else {
            setImpStatus("Sucesso! " + res.totalInseridos + " linhas em " + tpl.alvo + ". Import #" + res.importId + ".", "ok");
          }
        });
        return;
      }
      // Demais casos — chama a original
      return _confirmarImportContinuarOriginal(tpl);
    };
  }

  // ===========================================================================
  // M26 — Política de histórico aplicada nos imports restantes
  // ===========================================================================

  // Atualiza TABELAS_COM_HISTORICO pra incluir as 10 novas (M26)
  if (typeof TABELAS_COM_HISTORICO !== "undefined") {
    [
      'movimentos','notas_fiscais','nf_os','saldo_reconhecer',
      'compromissos_financeiros','recebimentos_previstos',
      'entradas_outras','saidas_outras',
      'folha_pagamento','folha_pagamento_rubricas'
    ].forEach(function (t) {
      if (TABELAS_COM_HISTORICO.indexOf(t) === -1) TABELAS_COM_HISTORICO.push(t);
    });
  }

  // Refac do confirmar de NFs com vínculo (gravarNFsEnfsOs) pra usar política
  // Substitui a função existente
  function gravarNFsEnfsOs(nfs, vinculos, cb) {
    var numerosNF = Array.from(new Set(nfs.map(function (n) { return n.numero_nf; }).filter(Boolean)));
    aplicarPoliticaHistorico({
      tipo: "notas_fiscais",
      arquivo: (impArquivo && impArquivo.files && impArquivo.files[0] ? impArquivo.files[0].name : null),
      marcarAnteriores: [
        { tabela: "notas_fiscais", filtros: { numero_nf: numerosNF } },
        { tabela: "nf_os", filtros: { numero_nf: numerosNF } }
      ],
      inserts: [
        { tabela: "notas_fiscais", linhas: nfs },
        { tabela: "nf_os", linhas: vinculos }
      ]
    }, function (res) {
      if (res.erro) { cb(res.erro, true); return; }
      if (res.erros && res.erros.length) {
        cb("NFs/vínculos com avisos: " + res.erros.length + " erros · Inseridos " + res.totalInseridos + ". Import #" + res.importId, true);
      } else {
        cb(nfs.length + " NFs e " + vinculos.length + " vínculo(s) NF↔OS gravados. Import #" + res.importId + ".", false);
      }
    });
  }

  // Override de confirmarImportContinuar pra também aplicar política quando o tipo
  // é "historico_mov_financeiro" ou "historico_saldo_reconhecer" (que vão pra
  // movimentos / saldo_reconhecer respectivamente — sem onConflict).
  if (typeof confirmarImportContinuar === "function") {
    var _confirmarOriginal_M26 = confirmarImportContinuar;
    confirmarImportContinuar = function (tpl) {
      var tipoSelect = impTipo && impTipo.value;

      // Histórico Mov Financeiro
      if (tipoSelect === "historico_mov_financeiro" && tpl && tpl.alvo === "movimentos") {
        if (!confirm("Importar " + impParsed.linhas.length + " lançamentos pra movimentos? Versões anteriores marcadas vigente=false.")) return;
        impBtnConf.disabled = true;
        impBtnPrev.disabled = true;
        setImpStatus("Aplicando política de histórico…", "carregando");

        // Coletar (orcamento, competencia) únicos
        var orcs = Array.from(new Set(impParsed.linhas.map(function (l) { return l.orcamento; }).filter(Boolean)));
        var comps = Array.from(new Set(impParsed.linhas.map(function (l) { return l.competencia; }).filter(Boolean)));

        aplicarPoliticaHistorico({
          tipo: "historico_mov_financeiro",
          arquivo: (impArquivo && impArquivo.files && impArquivo.files[0] ? impArquivo.files[0].name : null),
          marcarAnteriores: [
            { tabela: "movimentos", filtros: { orcamento: orcs } }
          ],
          inserts: [
            { tabela: "movimentos", linhas: impParsed.linhas }
          ]
        }, function (res) {
          impBtnConf.disabled = false;
          impBtnPrev.disabled = false;
          if (res.erro) { setImpStatus(res.erro, "erro"); return; }
          setImpStatus("Sucesso! " + res.totalInseridos + " lançamentos em movimentos. Import #" + res.importId, "ok");
          try { orcamentosCarregados = false; } catch (e) {}
        });
        return;
      }

      // Histórico Saldo a Reconhecer
      if (tipoSelect === "historico_saldo_reconhecer" && tpl && tpl.alvo === "saldo_reconhecer") {
        if (!confirm("Importar " + impParsed.linhas.length + " linhas pra saldo_reconhecer? Versões anteriores marcadas vigente=false.")) return;
        impBtnConf.disabled = true;
        impBtnPrev.disabled = true;
        setImpStatus("Aplicando política de histórico…", "carregando");

        var orcsSR = Array.from(new Set(impParsed.linhas.map(function (l) { return l.orcamento; }).filter(Boolean)));

        aplicarPoliticaHistorico({
          tipo: "historico_saldo_reconhecer",
          arquivo: (impArquivo && impArquivo.files && impArquivo.files[0] ? impArquivo.files[0].name : null),
          marcarAnteriores: [
            { tabela: "saldo_reconhecer", filtros: { orcamento: orcsSR } }
          ],
          inserts: [
            { tabela: "saldo_reconhecer", linhas: impParsed.linhas }
          ]
        }, function (res) {
          impBtnConf.disabled = false;
          impBtnPrev.disabled = false;
          if (res.erro) { setImpStatus(res.erro, "erro"); return; }
          setImpStatus("Sucesso! " + res.totalInseridos + " linhas em saldo_reconhecer. Import #" + res.importId, "ok");
        });
        return;
      }

      // Recebimentos Previstos
      if (tipoSelect === "recebimentos_previstos" && tpl && tpl.alvo === "recebimentos_previstos") {
        if (!confirm("Importar " + impParsed.linhas.length + " linhas pra recebimentos_previstos? Versões anteriores marcadas vigente=false.")) return;
        impBtnConf.disabled = true;
        impBtnPrev.disabled = true;
        setImpStatus("Aplicando política de histórico…", "carregando");

        var orcsRP = Array.from(new Set(impParsed.linhas.map(function (l) { return l.orcamento; }).filter(Boolean)));

        aplicarPoliticaHistorico({
          tipo: "recebimentos_previstos",
          arquivo: (impArquivo && impArquivo.files && impArquivo.files[0] ? impArquivo.files[0].name : null),
          marcarAnteriores: [
            { tabela: "recebimentos_previstos", filtros: { orcamento: orcsRP } }
          ],
          inserts: [
            { tabela: "recebimentos_previstos", linhas: impParsed.linhas }
          ]
        }, function (res) {
          impBtnConf.disabled = false;
          impBtnPrev.disabled = false;
          if (res.erro) { setImpStatus(res.erro, "erro"); return; }
          setImpStatus("Sucesso! " + res.totalInseridos + " linhas. Import #" + res.importId, "ok");
        });
        return;
      }

      // Compromissos Financeiros
      if (tipoSelect === "compromissos_financeiros" && tpl && tpl.alvo === "compromissos_financeiros") {
        if (!confirm("Importar " + impParsed.linhas.length + " compromissos? Versões anteriores marcadas vigente=false (por descricao+vencimento).")) return;
        impBtnConf.disabled = true;
        impBtnPrev.disabled = true;
        setImpStatus("Aplicando política de histórico…", "carregando");

        var descsCF = Array.from(new Set(impParsed.linhas.map(function (l) { return l.descricao; }).filter(Boolean)));

        aplicarPoliticaHistorico({
          tipo: "compromissos_financeiros",
          arquivo: (impArquivo && impArquivo.files && impArquivo.files[0] ? impArquivo.files[0].name : null),
          marcarAnteriores: [
            { tabela: "compromissos_financeiros", filtros: { descricao: descsCF } }
          ],
          inserts: [
            { tabela: "compromissos_financeiros", linhas: impParsed.linhas }
          ]
        }, function (res) {
          impBtnConf.disabled = false;
          impBtnPrev.disabled = false;
          if (res.erro) { setImpStatus(res.erro, "erro"); return; }
          setImpStatus("Sucesso! " + res.totalInseridos + " compromissos. Import #" + res.importId, "ok");
        });
        return;
      }

      // Demais casos — chama original (que pode também aplicar política se onConflict + tabela em TABELAS_COM_HISTORICO)
      return _confirmarOriginal_M26(tpl);
    };
  }

})();
