/**
 * Terra Conttemporânea — Gestão Financeira
 * Módulo: 01 boot e comum
 * Parte 1/8 do refator M1 v2 (app.js antigo: linhas 15-1574)
 *
 * IMPORTANTE: a ORDEM dos scripts no index.html importa.
 * 5 funções têm 2 declarações (a 2ª sobrescreve a 1ª) e há blocos de
 * override que dependem das funções já existirem. Não reorganizar.
 */

"use strict";

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
var topbarPerfil  = document.getElementById("topbar-perfil");
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

// M1: sem IIFE wrapper, então `return` no top-level dá SyntaxError no browser.
// Substituído por flag `_terraBootOK` que pula o resto do boot se algo faltar.
var _terraBootOK = true;
var cfg = null;
var client = null;
if (typeof window.TERRA_CONFIG === "undefined") {
  mostrarEstado("login");
  setErroLogin("config.js não encontrado. Copie config.example.js para config.js.");
  btnEntrar.disabled = true;
  _terraBootOK = false;
}
if (_terraBootOK) {
  cfg = window.TERRA_CONFIG;
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) {
    mostrarEstado("login");
    setErroLogin("config.js incompleto.");
    btnEntrar.disabled = true;
    _terraBootOK = false;
  }
}
if (_terraBootOK) {
  if (typeof window.supabase === "undefined" || !window.supabase.createClient) {
    mostrarEstado("login");
    setErroLogin("SDK do Supabase não carregado.");
    btnEntrar.disabled = true;
    _terraBootOK = false;
  }
}
if (_terraBootOK) {
  client = window.supabase.createClient(
    cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY
  );
}

// =========================================================================
// 4. AUTH FLOW
// =========================================================================

if (_terraBootOK) {
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
}

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

// -----------------------------------------------------------------------
// 4.b — Esqueci minha senha (modal sobreposto ao login)
// -----------------------------------------------------------------------
var linkEsqueci         = document.getElementById("link-esqueci");
var modalEsqueci        = document.getElementById("modal-esqueci");
var inputEsqueciEmail   = document.getElementById("esqueci-email");
var btnEsqueciEnviar    = document.getElementById("btn-esqueci-enviar");
var btnEsqueciCancelar  = document.getElementById("btn-esqueci-cancelar");
var statusEsqueci       = document.getElementById("esqueci-status");

function setStatusEsqueci(msg, tipo) {
  statusEsqueci.hidden = false;
  statusEsqueci.className = "status " + (tipo || "info");
  statusEsqueci.textContent = msg;
}

function abrirEsqueci() {
  statusEsqueci.hidden = true;
  statusEsqueci.textContent = "";
  btnEsqueciEnviar.disabled = false;
  btnEsqueciEnviar.textContent = "Enviar email";
  btnEsqueciEnviar.style.display = "";
  inputEsqueciEmail.value = (inputEmail && inputEmail.value) ? inputEmail.value : "";
  modalEsqueci.hidden = false;
  setTimeout(function () { try { inputEsqueciEmail.focus(); } catch (e) {} }, 0);
}

function fecharEsqueci() {
  modalEsqueci.hidden = true;
}

if (linkEsqueci) {
  linkEsqueci.addEventListener("click", function (e) { e.preventDefault(); abrirEsqueci(); });
}
if (btnEsqueciCancelar) {
  btnEsqueciCancelar.addEventListener("click", fecharEsqueci);
}
if (modalEsqueci) {
  // Click fora do card fecha
  modalEsqueci.addEventListener("click", function (e) {
    if (e.target === modalEsqueci) fecharEsqueci();
  });
}
if (btnEsqueciEnviar) {
  btnEsqueciEnviar.addEventListener("click", function () {
    var email = (inputEsqueciEmail.value || "").trim();
    if (!email || email.indexOf("@") < 1) {
      setStatusEsqueci("Digite um email válido.", "erro");
      return;
    }
    btnEsqueciEnviar.disabled = true;
    btnEsqueciEnviar.textContent = "Enviando…";
    statusEsqueci.hidden = true;

    client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/redefinir-senha.html"
    }).then(function (resposta) {
      if (resposta && resposta.error) {
        setStatusEsqueci("Não foi possível enviar: " + resposta.error.message, "erro");
        btnEsqueciEnviar.disabled = false;
        btnEsqueciEnviar.textContent = "Enviar email";
        return;
      }
      setStatusEsqueci("Email enviado! Confira sua caixa de entrada (e o SPAM). O link é válido por 1 hora.", "ok");
      btnEsqueciEnviar.style.display = "none";
    }).catch(function (err) {
      setStatusEsqueci("Falha de rede: " + (err && err.message ? err.message : "erro desconhecido"), "erro");
      btnEsqueciEnviar.disabled = false;
      btnEsqueciEnviar.textContent = "Enviar email";
    });
  });
}

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
      topbarNome.textContent = nome;
    if (topbarPerfil) topbarPerfil.textContent = (perfil && (perfil.perfil || perfil.tipo)) || (window.__userPerfilTipo || "") + (perfil ? " · " + perfil : "");
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

// -- Self-healing: remove overlays orfaos (bug do Reset Completo) ---------
// Modais criados dinamicamente (mostrarMensagem/abrirModalDetalhe) podem
// ficar no DOM se um erro JS interromper o close. Como tem
// position:fixed; inset:0; z-index:50, eles bloqueiam interacao com toda
// a app — incluindo a tela de Reset Completo. Esta funcao roda antes de
// cada navegacao e limpa orfaos.
function limparOverlaysOrfaos() {
  // Modais dinamicos: remover do DOM
  ["modal-msg", "modal-detalhe-overlay"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el && el.parentNode) {
      try { el.parentNode.removeChild(el); } catch (e) {}
    }
  });
  // Outros modais .modal-overlay: garantir [hidden]
  document.querySelectorAll(".modal-overlay").forEach(function (el) {
    if (el.id === "modal-overlay" || el.id === "modal-esqueci") {
      // Sao os modais HTML estaticos — devem estar hidden quando nao em uso
      if (!el.hidden) {
        // Se a app esta tentando navegar e este modal esta aberto, fecha
        el.hidden = true;
      }
    }
  });
}

// Tecla ESC: fecha modal aberto OU volta pra tela anterior (breadcrumb)
document.addEventListener("keydown", function (ev) {
  if (ev.key !== "Escape") return;
  // 1) Se há algum modal-overlay visível, fechar (já existe limparOverlaysOrfaos)
  var algumModal = Array.prototype.find.call(document.querySelectorAll(".modal-overlay"), function (m) { return !m.hidden; });
  if (algumModal) { limparOverlaysOrfaos(); return; }
  // 2) Senão, tentar navegar pra tela "pai" via breadcrumb
  try {
    var ativa = Array.prototype.find.call(document.querySelectorAll("section.page"), function (s) { return !s.hidden; });
    var pageId = ativa ? ativa.getAttribute("data-page") : null;
    var parts = (typeof BREADCRUMB_MAP !== "undefined" && BREADCRUMB_MAP[pageId]) ? BREADCRUMB_MAP[pageId] : null;
    if (!parts || parts.length < 2) return;
    // Procurar o "pai" no breadcrumb com data-goto correspondente
    // Mapa rápido label → pageId base
    var maiMap = { "Configuração": "configuracao", "Dashboard": "dashboard", "Comercial": "vendas", "Receita": "consolidado", "Financeiro": "fluxo_visao", "Custeio": "custos_os", "Contabilidade Gerencial": "fluxo_visao", "Dep. Pessoal e RH": "rh_funcionarios" };
    var paiLabel = parts[0];
    var paiPageId = maiMap[paiLabel];
    if (paiPageId && typeof showPage === "function") showPage(paiPageId);
  } catch (e) { /* silencioso */ }
});

// -- Busca em selects grandes (>50 opcoes) ---------------------------------
// Insere um input de busca acima do <select> e filtra as opcoes conforme o
// usuario digita. Idempotente — nao aplica duas vezes no mesmo select.
function enhanceLargeSelect(sel, opts) {
  if (!sel || sel.dataset.enhanced === "1") return;
  var minOpts = (opts && opts.minOpts) || 50;
  if (sel.options.length < minOpts) return;
  sel.dataset.enhanced = "1";

  var wrapper = document.createElement("div");
  wrapper.className = "select-com-busca";
  sel.parentNode.insertBefore(wrapper, sel);
  wrapper.appendChild(sel);

  var inp = document.createElement("input");
  inp.type = "text";
  inp.className = "input-search select-busca-input";
  inp.placeholder = "🔍 Filtrar (" + sel.options.length + " opcoes)";
  inp.style.marginBottom = "4px";
  wrapper.insertBefore(inp, sel);

  // Snapshot inicial das opcoes (sem filtro)
  var snap = Array.prototype.slice.call(sel.options).map(function (o) {
    return { value: o.value, text: o.textContent, parent: o.parentNode };
  });

  inp.addEventListener("input", function () {
    var q = (inp.value || "").trim().toLowerCase();
    var visiveis = 0;
    Array.prototype.forEach.call(sel.options, function (opt) {
      var bate = !q || opt.textContent.toLowerCase().indexOf(q) !== -1;
      opt.hidden = !bate;
      if (bate) visiveis++;
    });
    // Se a opcao atualmente selecionada foi escondida, abrir o select pra
    // forcar o usuario a escolher uma visivel
    if (sel.selectedOptions[0] && sel.selectedOptions[0].hidden) {
      // Procura a primeira visivel e seleciona
      var firstVis = Array.prototype.find.call(sel.options, function (o) { return !o.hidden; });
      if (firstVis) sel.value = firstVis.value;
    }
  });
}

// Auto-aplicar enhanceLargeSelect em todos os <select> visiveis com >50 opcoes
function autoEnhanceLargeSelects(root) {
  var scope = root || document;
  scope.querySelectorAll("select").forEach(function (s) {
    try { enhanceLargeSelect(s); } catch (e) {}
  });
}


// -- Onda B: máscara monetária BR ------------------------------------------
// Auto-aplica em inputs type="number" cujo name/id sugere valor monetário.
// Adiciona step="0.01" (resolve bug do step=1 que bloqueava centavos) e
// wrapper com prefixo "R$ " antes do input. On-type opcional via formatação
// no blur (aceita "1234.56" e exibe "1.234,56" se o usuário sair do campo).
function ehInputValorMonetario(el) {
  if (!el || el.tagName !== "INPUT") return false;
  if (el.type !== "number" && el.type !== "text") return false;
  if (el.dataset.monetario === "0") return false; // opt-out
  var key = (el.name || el.id || "").toLowerCase();
  // Lista de tokens que sugerem valor monetário
  var tokens = ["valor","saldo","venda","custo","preco","preço","salario","salário","liquido","líquido","bruto","total","faturado","recebido","pagar","receber","ipi","icms","comissao","comissão","aluguel","desconto","reembolso","bonus","bônus","meta_valor"];
  return tokens.some(function (t) { return key.indexOf(t) !== -1; });
}

function aplicarMascaraMonetaria(root) {
  var scope = root || document;
  scope.querySelectorAll("input").forEach(function (el) {
    if (el.dataset.monetarioAplicado === "1") return;
    if (!ehInputValorMonetario(el)) return;
    el.dataset.monetarioAplicado = "1";

    // Garantir step=0.01 (corrige o bug do step=1)
    if (el.type === "number" && !el.step) el.step = "0.01";

    // Wrapper com prefixo R$
    var wrap = document.createElement("span");
    wrap.className = "input-money-wrap";
    el.parentNode.insertBefore(wrap, el);
    var prefix = document.createElement("span");
    prefix.className = "input-money-prefix";
    prefix.textContent = "R$";
    wrap.appendChild(prefix);
    wrap.appendChild(el);

    // Formatação on-blur (mantém type="number" pra usabilidade)
    el.addEventListener("blur", function () {
      if (!el.value) return;
      var n = Number(el.value);
      if (isNaN(n)) return;
      // Arredondar pra 2 casas (centavos)
      el.value = (Math.round(n * 100) / 100).toFixed(2);
    });
  });
}

function showPage(pageId) {
  // Self-healing: limpa overlays orfaos antes de navegar (bug do Reset)
  try { limparOverlaysOrfaos(); } catch (e) {}
  // Mostrar/esconder seções da main
  document.querySelectorAll("#shell .main .page").forEach(function (sec) {
    sec.hidden = sec.getAttribute("data-page") !== pageId;
  });
  // Auto-inject export XLSX em toolbars que ainda nao tem
  setTimeout(function () { try { autoInjetarExportXlsx(); } catch (e) {} }, 100);
  // Auto-enhance selects grandes (>50 opcoes)
  setTimeout(function () { try { autoEnhanceLargeSelects(); } catch (e) {} }, 200);
  // Auto-aplicar máscara monetária em inputs de valor
  setTimeout(function () { try { aplicarMascaraMonetaria(); } catch (e) {} }, 250);

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
  if (pageId === "margem_os")    carregarMargemOsSeNecessario();
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
  if (pageId === "dashboard")       { try { carregarKpisDashboard(); } catch (e) {} }
  if (pageId === "rh_organograma")  carregarOrganogramaSeNecessario();
  if (pageId === "programa_bonus")  carregarProgramaBonusSeNecessario();
  if (pageId === "programa_bonus_individual") carregarBonusIndividualSeNecessario();
  if (pageId === "rh_bonus_config") carregarConfigBonusSeNecessario();
  if (pageId === "cfg_auditoria")  carregarAuditoriaSeNecessario();
  if (pageId === "cfg_aud_alertas") carregarAlertasSeNecessario();
  if (pageId === "cfg_aud_regras")  carregarRegrasAlertaSeNecessario();
  if (pageId === "cfg_backups")     carregarBackupsSeNecessario();
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

  // Plano de Contas — Novo + Importar XLSX
  var btnNovoPc = document.getElementById("pc-btn-novo");
  var btnImpPc  = document.getElementById("pc-btn-import");
  var fileImpPc = document.getElementById("pc-import-file");
  if (btnNovoPc) btnNovoPc.addEventListener("click", function () { abrirModalPlanoContas(); });
  if (btnImpPc && fileImpPc) {
    btnImpPc.addEventListener("click", function () { fileImpPc.value = ""; fileImpPc.click(); });
    fileImpPc.addEventListener("change", function () {
      if (fileImpPc.files && fileImpPc.files[0]) importarPlanoContasXlsx(fileImpPc.files[0]);
    });
  }

  // CFOP — Marcar / Desmarcar visíveis + Importar XLSX
  var btnCfMarcar    = document.getElementById("cf-btn-marcar-todos");
  var btnCfDesmarcar = document.getElementById("cf-btn-desmarcar-todos");
  var btnCfImp       = document.getElementById("cf-btn-import");
  var fileCfImp      = document.getElementById("cf-import-file");
  if (btnCfMarcar)    btnCfMarcar.addEventListener("click",    function () { aplicarCfopMassa(true);  });
  if (btnCfDesmarcar) btnCfDesmarcar.addEventListener("click", function () { aplicarCfopMassa(false); });
  if (btnCfImp && fileCfImp) {
    btnCfImp.addEventListener("click", function () { fileCfImp.value = ""; fileCfImp.click(); });
    fileCfImp.addEventListener("change", function () {
      if (fileCfImp.files && fileCfImp.files[0]) importarCfopXlsx(fileCfImp.files[0]);
    });
  }

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
  var STORAGE_KEY = "terra-filtros-" + prefixo;

  function salvar() {
    var snap = {};
    ids.forEach(function (suf) {
      var el = document.getElementById(prefixo + suf);
      if (el) snap[suf] = el.value;
    });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snap)); } catch (e) {}
  }
  function restaurar() {
    var snap = null;
    try { snap = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (e) {}
    if (!snap) return false;
    var aplicou = false;
    ids.forEach(function (suf) {
      var el = document.getElementById(prefixo + suf);
      if (el && snap[suf] !== undefined && snap[suf] !== "") {
        el.value = snap[suf];
        aplicou = true;
      }
    });
    return aplicou;
  }

  ids.forEach(function (suf) {
    var el = document.getElementById(prefixo + suf);
    if (!el) return;
    var evt = el.tagName === "INPUT" && el.type !== "month" ? "input" : "change";
    el.addEventListener(evt, function () { salvar(); renderFn(); });
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
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      renderFn();
    });
  }
  // Restaurar filtros salvos (se houver) na primeira chamada — postergar
  // pra acontecer apos a tabela ter carregado.
  setTimeout(function () {
    if (restaurar()) renderFn();
  }, 50);
}

// -- Export XLSX universal (qualquer tabela renderizada) -------------------
function exportarTabelaXlsx(tableEl, nomeArquivo, abaName) {
  if (typeof window.XLSX === "undefined") {
    try { toast("Biblioteca XLSX ainda carregando — tente em alguns segundos.", "warn"); } catch (e) { alert("XLSX ainda carregando."); }
    return;
  }
  if (!tableEl) {
    try { toast("Tabela nao encontrada para exportar.", "erro"); } catch (e) {}
    return;
  }
  try {
    var wb = window.XLSX.utils.book_new();
    var ws = window.XLSX.utils.table_to_sheet(tableEl);
    window.XLSX.utils.book_append_sheet(wb, ws, (abaName || "Dados").slice(0, 31));
    var iso = new Date().toISOString().slice(0, 10);
    var nome = (nomeArquivo || "exportacao") + "-" + iso + ".xlsx";
    window.XLSX.writeFile(wb, nome);
    try { toast("Exportado: " + nome, "ok"); } catch (e) {}
  } catch (e) {
    try { toast("Erro ao exportar: " + e.message, "erro"); } catch (er) { alert("Erro: " + e.message); }
  }
}

// -- Auto-injeta botao "Exportar XLSX" em todas as toolbars dentro de .fat-card --
// Idempotente: nao adiciona dois.
function autoInjetarExportXlsx() {
  document.querySelectorAll(".fat-card .toolbar").forEach(function (toolbar) {
    // Se ja tem botao de export, pular
    if (toolbar.querySelector(".btn-export-auto") || toolbar.querySelector("[id$=\"-btn-export\"]")) return;
    // Procurar a tabela irma (dentro do mesmo fat-card)
    var card = toolbar.closest(".fat-card");
    if (!card) return;
    var table = card.querySelector("table.tabela");
    if (!table) return;
    var tbody = table.querySelector("tbody");
    var tbodyId = tbody ? tbody.id : "";
    // Derivar nome do arquivo a partir do prefix do tbody (ex: "fn-tbody" -> "funcionarios")
    var pageSec = card.closest("section.page");
    var pageId = pageSec ? pageSec.getAttribute("data-page") : "tabela";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-limpar btn-export-auto";
    btn.title = "Exportar tabela atual em XLSX";
    btn.textContent = "⤓ Exportar XLSX";
    btn.style.marginLeft = "auto";
    btn.addEventListener("click", function () {
      exportarTabelaXlsx(table, pageId || "exportacao", pageId || "Dados");
    });
    toolbar.appendChild(btn);
  });
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

// Onda I — Humaniza tempos: "agora", "há 5 min", "há 3 h", "ontem", "há 2 dias", "há 3 sem", "há 4 meses", "há 2 anos"
// Para datas futuras: "em 5 min", "amanhã", "em 3 dias"
function fmtTempoRelativo(iso) {
  if (!iso) return "—";
  var d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  var diff = (Date.now() - d.getTime()) / 1000; // segundos; positivo = passado
  var abs = Math.abs(diff);
  var prefixo = diff >= 0 ? "há " : "em ";
  // Casos especiais
  if (abs < 45) return diff >= 0 ? "agora" : "agora";
  if (abs < 90) return prefixo + "1 min";
  if (abs < 3600) return prefixo + Math.round(abs / 60) + " min";
  if (abs < 5400) return prefixo + "1 h";
  if (abs < 86400) return prefixo + Math.round(abs / 3600) + " h";
  if (abs < 129600) return diff >= 0 ? "ontem" : "amanhã";
  if (abs < 2592000) return prefixo + Math.round(abs / 86400) + " dias";
  if (abs < 5184000) return prefixo + "1 mês";
  if (abs < 31536000) return prefixo + Math.round(abs / 2592000) + " meses";
  if (abs < 63072000) return prefixo + "1 ano";
  return prefixo + Math.round(abs / 31536000) + " anos";
}
function escHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, function (c) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
  });
}

// Modal customizado Terra (substitui alert nativo). Tipo: 'ok' | 'erro' | 'info'

// -- Toast (notificações leves no canto inferior direito) -------------------
function toast(msg, tipo, durMs) {
  if (!msg) return;
  var host = document.getElementById("toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "toast-host";
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  var el = document.createElement("div");
  el.className = "toast toast-" + (tipo || "ok");
  el.innerHTML = '<span>' + escHtml(msg) + '</span><button type="button" class="toast-x" aria-label="Fechar">×</button>';
  host.appendChild(el);
  var dur = (typeof durMs === "number") ? durMs : 2600;
  var t1 = setTimeout(function () { el.classList.add("toast-saindo"); }, dur - 180);
  var t2 = setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, dur);
  el.querySelector(".toast-x").addEventListener("click", function () {
    clearTimeout(t1); clearTimeout(t2);
    el.classList.add("toast-saindo");
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 180);
  });
}


// -- Breadcrumb global -----------------------------------------------------
function setBreadcrumb(parts) {
  var nav = document.getElementById("breadcrumb-nav");
  if (!nav) return;
  if (!parts || !parts.length) { nav.innerHTML = ""; nav.classList.remove("has-content"); return; }
  var html = parts.map(function (p, i) {
    var last = i === parts.length - 1;
    var label = (typeof p === "string") ? p : p.label;
    var goto  = (typeof p === "object") ? p.goto : null;
    var sep = i > 0 ? '<span class="sep">›</span>' : '';
    if (last) return sep + '<span class="current">' + escHtml(label) + '</span>';
    if (goto) return sep + '<button type="button" data-goto="' + escHtml(goto) + '">' + escHtml(label) + '</button>';
    return sep + '<span>' + escHtml(label) + '</span>';
  }).join("");
  nav.innerHTML = html;
  nav.classList.add("has-content");
}

// Mapa pageId → breadcrumb parts (Configuração > X / Comercial > X / etc)
var BREADCRUMB_MAP = {
  "dashboard":         ["Dashboard", "Visão geral"],
  "programa_bonus":    ["Dashboard", "Programa de Bônus"],
  "consolidado":       ["Receita", "Por Apropriação"],
  "fat_apropr":        ["Receita", "Por Faturamento"],
  "vendas":            ["Comercial", "Vendas"],
  "fat_orcamentos":    ["Comercial", "Gestão de Faturamento"],
  "notas_fiscais":     ["Comercial", "Notas Fiscais"],
  "consolidado_fin":   ["Financeiro", "Consolidado"],
  "contas_receber":    ["Financeiro", "Contas a Receber"],
  "contas_pagar":      ["Financeiro", "Contas a Pagar"],
  "despesas":          ["Custeio", "Despesas"],
  "lancamentos":       ["Contabilidade Gerencial", "Lançamentos"],
  "fluxo_caixa":       ["Contabilidade Gerencial", "Fluxo de Caixa 12m"],
  "contas_bancarias":  ["Contabilidade Gerencial", "Contas Bancárias"],
  "saldos_mensais":    ["Contabilidade Gerencial", "Saldos Mensais"],
  "entradas_outras":   ["Contabilidade Gerencial", "Entradas Avulsas"],
  "saidas_outras":     ["Contabilidade Gerencial", "Saídas Avulsas"],
  "dre":               ["Contabilidade Gerencial", "DRE"],
  "custo_os":          ["Custeio", "Custo por OS"],
  "custo_direto_os":   ["Custeio", "Custo Direto Via OS"],
  "custo_direto_lc":   ["Custeio", "Custo Direto Lançamento"],
  "custo_indireto":    ["Custeio", "Custo Indireto"],
  "custo_area":        ["Custeio", "Custo por Área"],
  "os_excluidas":      ["Custeio", "OSs excluídas"],
  "entregas":          ["Custeio", "Entregas pendentes"],
  "organograma":       ["Dep. Pessoal e RH", "Organograma"],
  "funcionarios":      ["Dep. Pessoal e RH", "Funcionários"],
  "beneficios":        ["Dep. Pessoal e RH", "Benefícios"],
  "folha":             ["Dep. Pessoal e RH", "Folha"],
  "impostos":          ["Dep. Pessoal e RH", "Impostos"],
  "bonus_config":      ["Dep. Pessoal e RH", "Bônus — Configuração"],
  "bonus_individual":  ["Dep. Pessoal e RH", "Bônus — Individual"],
  "configuracao":      ["Configuração"],
  "cfg_centros":       ["Configuração", "Centros de Custo"],
  "cfg_plano":         ["Configuração", "Plano de Contas"],
  "cfg_cfop":          ["Configuração", "CFOP"],
  "cfg_classif":       ["Configuração", "Classif. Faturamento"],
  "cfg_estoque":       ["Configuração", "Estoque"],
  "cfg_auditoria":     ["Configuração", "Auditoria"],
  "cfg_aud_alertas":   ["Configuração", "Alertas"],
  "cfg_aud_regras":    ["Configuração", "Regras de Alerta"],
  "cfg_backups":       ["Configuração", "Backups"],
  "cfg_usuarios":      ["Configuração", "Usuários"],
  "cfg_perfis":        ["Configuração", "Tipos de Perfil"],
  "cfg_diagnostico":   ["Configuração", "Diagnóstico"],
  "cfg_parametros":    ["Configuração", "Parâmetros"],
  "cfg_rubricas":      ["Configuração", "Rubricas"],
  "cfg_trocasenha":    ["Configuração", "Trocar minha senha"]
};

function aplicarBreadcrumb(pageId) {
  var parts = BREADCRUMB_MAP[pageId];
  if (!parts) { setBreadcrumb([]); return; }
  setBreadcrumb(parts);
}

// Cliques em botões dentro do breadcrumb (navegação)
document.addEventListener("click", function (ev) {
  var t = ev.target;
  if (t && t.matches && t.matches("#breadcrumb-nav [data-goto]")) {
    var dest = t.getAttribute("data-goto");
    if (dest && typeof navegarPara === "function") navegarPara(dest);
  }
});

function mostrarMensagem(titulo, mensagem, tipo, onOk) {
  tipo = tipo || "info";
  var existente = document.getElementById("modal-msg");
  if (existente) existente.remove();

  var icone = ({ ok: "✓", erro: "⚠", info: "ℹ" })[tipo] || "";
  var cor = ({
    ok:   { bg: "#d4eede",   borda: "#1A6B45", texto: "#1A6B45" },
    erro: { bg: "#fdf2f2",   borda: "#8B2020", texto: "#8B2020" },
    info: { bg: "var(--bg3)", borda: "var(--ouro-esc)", texto: "var(--ouro-esc)" }
  })[tipo];

  var div = document.createElement("div");
  div.id = "modal-msg";
  div.className = "modal-overlay";
  div.innerHTML =
    '<div class="modal-content" style="max-width:440px; text-align:center; padding:32px 28px 24px;">' +
      '<div style="display:inline-flex; align-items:center; justify-content:center; width:64px; height:64px; border-radius:50%; background:' + cor.bg + '; border:2px solid ' + cor.borda + '; margin-bottom:12px; font-size:32px; color:' + cor.texto + '; font-weight:bold;">' + icone + '</div>' +
      '<h2 style="text-align:center; color:' + cor.texto + '; margin:0 0 12px; font-size:20px;">' + escHtml(titulo) + '</h2>' +
      '<p style="margin:0 0 22px; color:var(--text); white-space:pre-line;">' + escHtml(mensagem) + '</p>' +
      '<button type="button" class="btn-ouro" id="modal-msg-ok" style="min-width:100px;">OK</button>' +
    '</div>';
  document.body.appendChild(div);

  function fechar() {
    try { div.remove(); } catch (e) {}
    document.removeEventListener("keydown", onKey);
    if (typeof onOk === "function") { try { onOk(); } catch (e) {} }
  }
  function onKey(e) {
    if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); fechar(); }
  }
  document.getElementById("modal-msg-ok").addEventListener("click", fechar);
  div.addEventListener("click", function (e) { if (e.target === div) fechar(); });
  document.addEventListener("keydown", onKey);
  setTimeout(function () { var b = document.getElementById("modal-msg-ok"); if (b) b.focus(); }, 0);
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
    var cfg = (vazio && typeof vazio === "object") ? vazio : { msg: vazio || "Nada bate com os filtros." };
    var icon = cfg.icon || "📭";
    var msg  = cfg.msg  || "Nada bate com os filtros.";
    var cta  = cfg.cta  || "";
    var html = '<tr><td colspan="' + colspan + '" class="tbl-vazio">' +
      '<div class="empty-state">' +
        '<div class="empty-icon">' + icon + '</div>' +
        '<div class="empty-msg">' + msg + '</div>' +
        (cta ? '<div class="empty-cta">' + cta + '</div>' : '') +
      '</div>' +
    '</td></tr>';
    tbody.innerHTML = html;
    try { _atualizarPageSubAuto(tbody, 0); } catch (e) {}
    return;
  }
  tbody.innerHTML = linhas.join("");
  try { _atualizarPageSubAuto(tbody, linhas.length); } catch (e) {}
}

// -- Q1: atualizar subtitulo da pagina com contagem real -------------------
// Sempre que preencherTbody renderiza uma tabela, anexa "· N registros"
// ao final do page-sub original. Idempotente — guarda o texto original
// em dataset pra nao acumular sufixos.
function _atualizarPageSubAuto(tbody, n) {
  if (!tbody) return;
  var sec = tbody.closest && tbody.closest("section.page");
  if (!sec) return;
  if (sec.dataset.subAuto === "0") return; // opt-out via data-sub-auto="0"
  var sub = sec.querySelector(".page-sub");
  if (!sub) return;
  if (!sub.dataset.original) sub.dataset.original = sub.textContent;
  var label = (n === 1) ? "registro" : "registros";
  sub.textContent = sub.dataset.original.replace(/\s*·\s*\d+\s+(registro|registros)\s*$/, "") + " · " + n + " " + label;
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
