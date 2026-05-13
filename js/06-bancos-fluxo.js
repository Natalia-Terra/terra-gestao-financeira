/**
 * Terra Conttemporânea — Gestão Financeira
 * Módulo: 06 bancos fluxo
 * Parte 6/8 do refator M1 v2 (app.js antigo: linhas 7989-9597)
 *
 * IMPORTANTE: a ORDEM dos scripts no index.html importa.
 * 5 funções têm 2 declarações (a 2ª sobrescreve a 1ª) e há blocos de
 * override que dependem das funções já existirem. Não reorganizar.
 */

"use strict";


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
      '<td><button type="button" class="btn-acao" data-sc-edit="' + s.id + '">Editar</button> <button class="btn-limpar" data-sc-del="' + s.id + '" title="Excluir">🗑 Excluir</button></td>' +
    '</tr>';
  }).join("");
  tbody.querySelectorAll("[data-sc-edit]").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = Number(b.getAttribute("data-sc-edit"));
      var s = saldosContasLista.find(function (x) { return x.id === id; });
      if (s) abrirModalSaldoConta(s);
    });
  tbody.querySelectorAll("[data-sc-del]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var id = btn.getAttribute("data-sc-del");
      var rid = isNaN(Number(id)) ? id : Number(id);
      if (!confirm("Excluir este registro? Essa ação não pode ser desfeita.")) return;
      client.from("saldos_contas").delete().eq("id", rid).then(function (r) {
        if (r.error) { try { toast("Erro ao excluir: " + r.error.message, "erro"); } catch (e) { alert("Erro ao excluir: " + r.error.message); } return; }
        try { toast("Excluído.", "ok"); } catch (e) {}
        if (typeof carregarSaldosMensaisSeNecessario === "function") carregarSaldosMensaisSeNecessario();
      });
    });
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
      { name: "observacao",            label: "Observação",                          type: "textarea", valor: s && s.observacao }
    ],
    onSubmit: function (values, done) {
      var payload = {
        conta_id: Number(values.conta_id),
        mes_ref: values.mes_ref ? values.mes_ref + "-01" : null,
        saldo_inicial: values.saldo_inicial,
        saldo_final_realizado: values.saldo_final_realizado,
        // saldo_final_projetado fica calculado (não cadastrado manualmente)
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
      '<td><button type="button" class="btn-acao" data-rp-edit="' + r.id + '">Editar</button> <button class="btn-limpar" data-rp-del="' + r.id + '" title="Excluir">🗑 Excluir</button></td>' +
    '</tr>';
  }).join("");
  tbody.querySelectorAll("[data-rp-edit]").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = Number(b.getAttribute("data-rp-edit"));
      var rec = recebimentosPrevLista.find(function (x) { return x.id === id; });
      if (rec) abrirModalRecebPrev(rec);
    });
  tbody.querySelectorAll("[data-rp-del]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var id = btn.getAttribute("data-rp-del");
      var rid = isNaN(Number(id)) ? id : Number(id);
      if (!confirm("Excluir este registro? Essa ação não pode ser desfeita.")) return;
      client.from("recebimentos_previstos").delete().eq("id", rid).then(function (r) {
        if (r.error) { try { toast("Erro ao excluir: " + r.error.message, "erro"); } catch (e) { alert("Erro ao excluir: " + r.error.message); } return; }
        try { toast("Excluído.", "ok"); } catch (e) {}
        if (typeof carregarRecebimentosPrevistosSeNecessario === "function") carregarRecebimentosPrevistosSeNecessario();
      });
    });
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
  var cen = document.getElementById("flv-cenario");
  if (cen && !cen.dataset.bound) { cen.dataset.bound = "1"; cen.addEventListener("change", renderFluxoVisao); }
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


// -- Fluxo preditivo: fatores de cenario --------------------------------
function getCenarioFatores() {
  var cenario = ((document.getElementById("flv-cenario")||{}).value || "realista");
  if (cenario === "otimista")    return { receita: 1.10, saida: 0.95, label: "Otimista" };
  if (cenario === "pessimista")  return { receita: 0.90, saida: 1.10, label: "Pessimista" };
  return { receita: 1.00, saida: 1.00, label: "Realista" };
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

    // Fatores de cenário aplicados sobre PROJETADO (realizado é fato)
    var fatores = getCenarioFatores();
    var entProj = (recProj + entOutProj) * fatores.receita;
    var entReal = recReal + entOutReal;
    var saiProj = (folhaTotal + compProj + saiOutProj) * fatores.saida;
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

  // -- KPIs preditivos: caixa hoje, runway, mês crítico, saldo 12m --
  try {
    // Caixa hoje = ultimo saldoFinalProj disponível (ou soma dos saldos por conta)
    var caixaHoje = 0;
    // Procura último mês que tem saldoFinalReal não-null; senão usa saldoInicialProj do mês 0
    for (var i = dadosMes.length - 1; i >= 0; i--) {
      if (dadosMes[i].saldoFinalReal != null) { caixaHoje = dadosMes[i].saldoFinalReal; break; }
    }
    if (caixaHoje === 0 && dadosMes[0].saldoInicialProj != null) caixaHoje = dadosMes[0].saldoInicialProj;

    // Runway: simula saldo acumulado mês a mês com fluxo projetado, e acha primeiro mês negativo
    var saldoAcum = caixaHoje;
    var mesCritico = null;
    var diasRunway = null;
    var diaInicio = new Date(meses[0].iso);
    for (var j = 0; j < dadosMes.length; j++) {
      var d = dadosMes[j];
      var fluxoMes = d.entProj - d.saiProj;
      var saldoAntes = saldoAcum;
      saldoAcum += fluxoMes;
      if (saldoAcum < 0 && mesCritico === null) {
        mesCritico = meses[j].label;
        // Estimar quantos dias dentro deste mês
        var diasNoMes = new Date(meses[j].ano, meses[j].mes, 0).getDate();
        var fracaoConsumida = saldoAntes > 0 ? (saldoAntes / Math.abs(fluxoMes)) : 0;
        var diasEsteMes = Math.floor(fracaoConsumida * diasNoMes);
        // Soma dias dos meses anteriores
        var diasAcum = 0;
        for (var k = 0; k < j; k++) {
          diasAcum += new Date(meses[k].ano, meses[k].mes, 0).getDate();
        }
        diasRunway = diasAcum + diasEsteMes;
      }
    }
    var saldo12m = dadosMes[dadosMes.length - 1].saldoFinalProj != null ? dadosMes[dadosMes.length - 1].saldoFinalProj : saldoAcum;

    // Popular cards
    function vt(id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; }
    vt("flv-k-caixa", fmtBRL(caixaHoje));
    if (diasRunway !== null) {
      vt("flv-k-runway", diasRunway + " dias");
      var elRunway = document.getElementById("flv-k-runway");
      if (elRunway) elRunway.style.color = diasRunway < 60 ? "var(--danger)" : (diasRunway < 180 ? "var(--warn)" : "var(--success)");
      vt("flv-k-runway-sub", "no cenário " + getCenarioFatores().label);
      vt("flv-k-mes-critico", mesCritico || "—");
      var elMc = document.getElementById("flv-k-mes-critico");
      if (elMc) elMc.style.color = "var(--danger)";
    } else {
      vt("flv-k-runway", "12m+");
      var elRunway2 = document.getElementById("flv-k-runway");
      if (elRunway2) elRunway2.style.color = "var(--success)";
      vt("flv-k-runway-sub", "saldo nunca fica negativo no horizonte");
      vt("flv-k-mes-critico", "—");
    }
    vt("flv-k-saldo-12m", fmtBRL(saldo12m));
    var elS = document.getElementById("flv-k-saldo-12m");
    if (elS) elS.style.color = saldo12m < 0 ? "var(--danger)" : "var(--text)";
  } catch (e) { console.error("Erro nos KPIs preditivos:", e); }

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
      '<td><button class="btn-acao" data-eo-edit="' + e.id + '">Editar</button> <button class="btn-limpar" data-eo-del="' + e.id + '" title="Excluir">🗑 Excluir</button></td>' +
    '</tr>';
  }).join("");
  tbody.querySelectorAll("[data-eo-edit]").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = Number(b.getAttribute("data-eo-edit"));
      var e = entradasOutrasLista.find(function (x) { return x.id === id; });
      if (e) abrirModalEntradaOutra(e);
    });
  tbody.querySelectorAll("[data-eo-del]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var id = btn.getAttribute("data-eo-del");
      var rid = isNaN(Number(id)) ? id : Number(id);
      if (!confirm("Excluir este registro? Essa ação não pode ser desfeita.")) return;
      client.from("entradas_outras").delete().eq("id", rid).then(function (r) {
        if (r.error) { try { toast("Erro ao excluir: " + r.error.message, "erro"); } catch (e) { alert("Erro ao excluir: " + r.error.message); } return; }
        try { toast("Excluído.", "ok"); } catch (e) {}
        if (typeof carregarEntradasOutrasSeNecessario === "function") carregarEntradasOutrasSeNecessario();
      });
    });
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
      '<td><button class="btn-acao" data-so-edit="' + s.id + '">Editar</button> <button class="btn-limpar" data-so-del="' + s.id + '" title="Excluir">🗑 Excluir</button></td>' +
    '</tr>';
  }).join("");
  tbody.querySelectorAll("[data-so-edit]").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = Number(b.getAttribute("data-so-edit"));
      var s = saidasOutrasLista.find(function (x) { return x.id === id; });
      if (s) abrirModalSaidaOutra(s);
    });
  tbody.querySelectorAll("[data-so-del]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var id = btn.getAttribute("data-so-del");
      var rid = isNaN(Number(id)) ? id : Number(id);
      if (!confirm("Excluir este registro? Essa ação não pode ser desfeita.")) return;
      client.from("saidas_outras").delete().eq("id", rid).then(function (r) {
        if (r.error) { try { toast("Erro ao excluir: " + r.error.message, "erro"); } catch (e) { alert("Erro ao excluir: " + r.error.message); } return; }
        try { toast("Excluído.", "ok"); } catch (e) {}
        if (typeof carregarSaidasOutrasSeNecessario === "function") carregarSaidasOutrasSeNecessario();
      });
    });
  });
  });
}
