/**
 * Terra Conttemporânea — Gestão Financeira
 * Módulo: 07 saidas dash rico
 * Parte 7/8 do refator M1 v2 (app.js antigo: linhas 9597-11134)
 *
 * IMPORTANTE: a ORDEM dos scripts no index.html importa.
 * 5 funções têm 2 declarações (a 2ª sobrescreve a 1ª) e há blocos de
 * override que dependem das funções já existirem. Não reorganizar.
 */

"use strict";


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

  // DELEGATE DEFENSIVO: botões "+ Novo" — garante que SEMPRE funcionem
  // mesmo se ativarPaginaOrcamentos() abortar (bug recorrente).
  // Mapeia o ID do botão (ex: 'cc-btn-novo') pra função de modal correspondente.
  var btnNovoEl = t.closest && t.closest("[id$='-btn-novo']");
  if (btnNovoEl) {
    var id = btnNovoEl.id;
    var mapaModalNovo = {
      "cc-btn-novo": typeof abrirModalCentroCusto    !== "undefined" ? abrirModalCentroCusto    : null,
      "rb-btn-novo": typeof abrirModalRubrica        !== "undefined" ? abrirModalRubrica        : null,
      "fn-btn-novo": typeof abrirModalFuncionario    !== "undefined" ? abrirModalFuncionario    : null,
      "bn-btn-novo": typeof abrirModalBeneficio      !== "undefined" ? abrirModalBeneficio      : null,
      "fl-btn-novo": typeof abrirModalFolha          !== "undefined" ? abrirModalFolha          : null,
      "ir-btn-novo": typeof abrirModalImposto        !== "undefined" ? abrirModalImposto        : null,
      "pc-btn-novo": typeof abrirModalPlanoContas    !== "undefined" ? abrirModalPlanoContas    : null,
      "us-btn-novo": typeof abrirModalNovoUsuario    !== "undefined" ? abrirModalNovoUsuario    : null,
      "pt-btn-novo": typeof abrirModalPerfilTipo     !== "undefined" ? function() { abrirModalPerfilTipo(null); } : null,
      "cb-btn-novo": typeof abrirModalContaBancaria  !== "undefined" ? abrirModalContaBancaria  : null,
      "sc-btn-novo": typeof abrirModalSaldoConta     !== "undefined" ? abrirModalSaldoConta     : null,
      "eo-btn-novo": typeof abrirModalEntradaOutra   !== "undefined" ? abrirModalEntradaOutra   : null,
      "so-btn-novo": typeof abrirModalSaidaOutra     !== "undefined" ? abrirModalSaidaOutra     : null,
      "alr-btn-novo": typeof abrirModalRegraAlerta   !== "undefined" ? abrirModalRegraAlerta    : null
    };
    var fn = mapaModalNovo[id];
    if (typeof fn === "function") {
      ev.preventDefault();
      try { fn(); } catch (e) { console.error("Erro ao abrir modal " + id + ":", e); }
      return;
    }
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
  // Defensivo: limpa overlays antes de tentar render (bug critico)
  try { limparOverlaysOrfaos(); } catch (e) {}
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
