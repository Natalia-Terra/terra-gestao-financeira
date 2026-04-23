/**
 * Terra Conttemporânea — Gestão Financeira
 * Entrega 2: login com Supabase Auth + stub de dashboard.
 *
 * Fluxo:
 *   1. Carrega → getSession()
 *        • Se há sessão: mostra stub de dashboard (busca perfil + plano_contas).
 *        • Se não há: mostra tela de login.
 *   2. Submit do form → signInWithPassword → se OK, re-renderiza para dashboard.
 *   3. Botão Sair → signOut → re-renderiza para login.
 *
 * A sessão é persistida automaticamente pelo SDK no localStorage.
 * A lógica de negócio do v11 (orçamentos, NFs, a_faturar etc.) entra a
 * partir da Entrega 4.
 */

(function () {
  "use strict";

  // ---------- Elementos da UI ----------
  var cardCarregando = document.getElementById("card-carregando");
  var cardLogin = document.getElementById("card-login");
  var cardDashboard = document.getElementById("card-dashboard");

  var formLogin = document.getElementById("form-login");
  var inputEmail = document.getElementById("login-email");
  var inputSenha = document.getElementById("login-senha");
  var btnEntrar = document.getElementById("btn-entrar");
  var erroLogin = document.getElementById("login-erro");

  var dashSaudacao = document.getElementById("dash-saudacao");
  var dashPerfil = document.getElementById("dash-perfil");
  var dashStatus = document.getElementById("dash-status");
  var debugEl = document.getElementById("debug-saida");
  var btnSair = document.getElementById("btn-sair");

  // ---------- Utilitários ----------
  function mostrarCard(cardVisivel) {
    [cardCarregando, cardLogin, cardDashboard].forEach(function (c) {
      if (!c) return;
      c.hidden = c !== cardVisivel;
    });
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
    dashStatus.textContent = msg;
    dashStatus.className = "status " + (tipo || "");
  }

  function setDebug(obj) {
    try {
      debugEl.textContent = JSON.stringify(obj, null, 2);
    } catch (e) {
      debugEl.textContent = String(obj);
    }
  }

  // ---------- Pré-condições: config + SDK ----------
  if (typeof window.TERRA_CONFIG === "undefined") {
    mostrarCard(cardLogin);
    setErroLogin(
      "config.js não encontrado. Copie config.example.js para config.js e preencha as credenciais."
    );
    btnEntrar.disabled = true;
    return;
  }

  var cfg = window.TERRA_CONFIG;
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) {
    mostrarCard(cardLogin);
    setErroLogin(
      "config.js incompleto. Preencha SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY."
    );
    btnEntrar.disabled = true;
    return;
  }

  if (typeof window.supabase === "undefined" || !window.supabase.createClient) {
    mostrarCard(cardLogin);
    setErroLogin(
      "SDK do Supabase não carregado. Verifique a conexão de internet."
    );
    btnEntrar.disabled = true;
    return;
  }

  var client = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_PUBLISHABLE_KEY
  );

  // ---------- Renderização conforme sessão ----------
  mostrarCard(cardCarregando);

  client.auth.getSession().then(function (resp) {
    var session = resp && resp.data ? resp.data.session : null;
    if (session) {
      entrarModoDashboard(session.user);
    } else {
      entrarModoLogin();
    }
  });

  // Reagir a mudanças de auth (login, logout, refresh de token)
  client.auth.onAuthStateChange(function (event, session) {
    if (event === "SIGNED_IN" && session) {
      entrarModoDashboard(session.user);
    } else if (event === "SIGNED_OUT") {
      entrarModoLogin();
    }
  });

  // ---------- Modo login ----------
  function entrarModoLogin() {
    setErroLogin(null);
    inputEmail.value = "";
    inputSenha.value = "";
    btnEntrar.disabled = false;
    btnEntrar.textContent = "Entrar";
    mostrarCard(cardLogin);
    setTimeout(function () { inputEmail.focus(); }, 0);
  }

  formLogin.addEventListener("submit", function (ev) {
    ev.preventDefault();
    setErroLogin(null);

    var email = (inputEmail.value || "").trim();
    var senha = inputSenha.value || "";

    if (!email || !senha) {
      setErroLogin("Preencha email e senha.");
      return;
    }

    btnEntrar.disabled = true;
    btnEntrar.textContent = "Entrando…";

    client.auth
      .signInWithPassword({ email: email, password: senha })
      .then(function (resposta) {
        if (resposta.error) {
          btnEntrar.disabled = false;
          btnEntrar.textContent = "Entrar";
          var msg = resposta.error.message || "Falha ao entrar.";
          if (/invalid login credentials/i.test(msg)) {
            msg = "Email ou senha incorretos.";
          }
          setErroLogin(msg);
          return;
        }
        // onAuthStateChange cuida de renderizar o dashboard.
      })
      .catch(function (err) {
        btnEntrar.disabled = false;
        btnEntrar.textContent = "Entrar";
        setErroLogin("Falha de rede: " + err.message);
      });
  });

  // ---------- Modo dashboard (stub) ----------
  function entrarModoDashboard(user) {
    mostrarCard(cardDashboard);

    dashSaudacao.textContent = "Olá";
    dashPerfil.textContent = "Carregando perfil…";
    setDashStatus("Consultando plano_contas…", "carregando");
    setDebug("—");

    // Busca perfil do usuário na tabela perfis (nome + perfil).
    // O email vive em auth.users, não em perfis, então pegamos de user.email.
    client
      .from("perfis")
      .select("nome, perfil")
      .eq("id", user.id)
      .single()
      .then(function (resposta) {
        if (resposta.error) {
          dashSaudacao.textContent = "Olá";
          dashPerfil.textContent =
            "Sem perfil cadastrado (" + (user.email || "—") +
            "). Detalhe: " + resposta.error.message;
          return;
        }
        var p = resposta.data || {};
        dashSaudacao.textContent = "Olá, " + (p.nome || user.email);
        dashPerfil.textContent =
          "Perfil: " + (p.perfil || "—") + " · " + (user.email || "—");
      });

    // Reconsulta plano_contas — agora autenticado, a RLS deve liberar leitura.
    client
      .from("plano_contas")
      .select("*", { count: "exact", head: true })
      .then(function (resposta) {
        if (resposta.error) {
          setDashStatus("Erro ao consultar plano_contas: " + resposta.error.message, "erro");
          setDebug(resposta.error);
          return;
        }
        var total = resposta.count;
        var bateu = total === 510;
        setDashStatus(
          bateu
            ? "Autenticado. " + total + " registros em plano_contas (tripé validado de ponta a ponta)."
            : "Autenticado, mas contagem inesperada: " + total + " (esperado 510).",
          bateu ? "ok" : "alerta"
        );
        setDebug({
          user_id: user.id,
          email: user.email,
          plano_contas_count: total,
          esperado: 510
        });
      });
  }

  // ---------- Sair ----------
  btnSair.addEventListener("click", function () {
    btnSair.disabled = true;
    client.auth.signOut().then(function () {
      btnSair.disabled = false;
      // onAuthStateChange cuida de voltar para o login.
    });
  });
})();
