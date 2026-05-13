/**
 * Terra Conttemporânea — Gestão Financeira
 * Módulo: 02 financeiro basico
 * Parte 2/8 do refator M1 v2 (app.js antigo: linhas 1574-3165)
 *
 * IMPORTANTE: a ORDEM dos scripts no index.html importa.
 * 5 funções têm 2 declarações (a 2ª sobrescreve a 1ª) e há blocos de
 * override que dependem das funções já existirem. Não reorganizar.
 */

"use strict";


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
  document.getElementById("pc-tbody").innerHTML = '<tr><td colspan="8" class="tbl-vazio">Carregando contas…</td></tr>';
  client.from("plano_contas").select("*").order("seq", { ascending: true }).then(function (r) {
    pcCarregando = false;
    if (r.error) {
      document.getElementById("pc-tbody").innerHTML = '<tr><td colspan="8" class="tbl-vazio erro">Erro: ' + r.error.message + '</td></tr>';
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
    return matchBusca(busca, [p.descritivo, p.grupo, p.numero_conta, p.dre]);
  });

  // Onda A: ordenar pelo numero_conta (hierárquico) e seq como fallback
  filtrados.sort(function (a, b) {
    var na = a.numero_conta || "";
    var nb = b.numero_conta || "";
    if (na && nb) return na.localeCompare(nb, "pt-BR", { numeric: true });
    return (a.seq || 0) - (b.seq || 0);
  });

  valText(document.getElementById("pc-lbl"), filtrados.length + " de " + planoContas.length);
  var pgSub = document.querySelector('section[data-page="cfg_plano"] .page-sub');
  if (pgSub) {
    var niveis = {}; planoContas.forEach(function (p) { if (p.nivel) niveis[p.nivel] = true; });
    var ativos = planoContas.filter(function (p) { return p.ativo !== false; }).length;
    pgSub.textContent = ativos + " contas ativas · " + Object.keys(niveis).length + " níveis hierárquicos";
  }

  preencherTbody(tbody, filtrados.map(function (p) {
    var inativa = p.ativo === false;
    var rowStyle = inativa ? ' style="opacity: 0.55;"' : '';
    var badgeAtivo = inativa
      ? '<span class="badge-tipo outras">inativa</span>'
      : '<span class="badge-tipo solta">ativa</span>';
    var btnToggle = inativa
      ? '<button class="btn-limpar" data-pc-reativar="' + p.id + '" title="Reativar">▶ Reativar</button> '
      : '<button class="btn-limpar" data-pc-inativar="' + p.id + '" title="Inativar (preserva histórico, bloqueia novos lançamentos)">⏸ Inativar</button> ';
    return '<tr' + rowStyle + '>' +
      '<td class="num">' + fmtInt(p.seq) + '</td>' +
      '<td class="num">' + fmtInt(p.nivel) + '</td>' +
      '<td class="mono">' + escHtml(p.numero_conta || "—") + '</td>' +
      '<td>' + escHtml(p.descritivo) + '</td>' +
      '<td>' + escHtml(p.grupo || "—") + '</td>' +
      '<td>' + escHtml(p.dre || "—") + '</td>' +
      '<td>' + badgeAtivo + '</td>' +
      '<td>' +
        '<button class="btn-limpar" data-pc-edit="' + p.id + '" title="Editar">✎ Editar</button> ' +
        btnToggle +
        '<button class="btn-limpar" data-pc-del="' + p.id + '" title="Excluir (somente sem lançamentos)">🗑 Excluir</button>' +
      '</td>' +
    '</tr>';
  }), 8);

  // Wire-up: editar
  tbody.querySelectorAll("[data-pc-edit]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-pc-edit"));
      var p = planoContas.find(function (x) { return x.id === id; });
      if (p) abrirModalPlanoContas(p);
    });
  });
  // Wire-up: inativar
  tbody.querySelectorAll("[data-pc-inativar]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-pc-inativar"));
      var p = planoContas.find(function (x) { return x.id === id; });
      if (!p) return;
      if (!confirm("Inativar a conta " + (p.numero_conta || p.descritivo) + "?\n\nA conta vai sumir dos selects de outras telas mas o histórico de lançamentos é preservado.")) return;
      client.from("plano_contas").update({ ativo: false }).eq("id", id).then(function (r) {
        if (r.error) { try { toast(r.error.message, "erro"); } catch (e) { alert(r.error.message); } return; }
        try { toast("Conta inativada.", "ok"); } catch (e) {}
        pcCarregado = false; carregarPlanoContasSeNecessario();
      });
    });
  });
  // Wire-up: reativar
  tbody.querySelectorAll("[data-pc-reativar]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-pc-reativar"));
      client.from("plano_contas").update({ ativo: true }).eq("id", id).then(function (r) {
        if (r.error) { try { toast(r.error.message, "erro"); } catch (e) { alert(r.error.message); } return; }
        try { toast("Conta reativada.", "ok"); } catch (e) {}
        pcCarregado = false; carregarPlanoContasSeNecessario();
      });
    });
  });
  // Wire-up: excluir — bloqueado se há lançamentos
  tbody.querySelectorAll("[data-pc-del]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-pc-del"));
      var p = planoContas.find(function (x) { return x.id === id; });
      if (!p) return;
      // Onda A: checar lançamentos antes
      client.from("movimentos").select("id", { count: "exact", head: true }).eq("plano_contas_id", id).then(function (rChk) {
        if (rChk.error) {
          try { toast("Erro ao verificar lançamentos: " + rChk.error.message, "erro"); } catch (e) {}
          return;
        }
        if (rChk.count && rChk.count > 0) {
          alert("Esta conta tem " + rChk.count + " lançamento(s) vinculado(s). Use \"Inativar\" em vez de Excluir — preserva o histórico.");
          return;
        }
        if (!confirm("Excluir conta " + (p.numero_conta || "?") + " - " + (p.descritivo || "") + "?\n\nEssa ação não pode ser desfeita.")) return;
        client.from("plano_contas").delete().eq("id", id).then(function (r) {
          if (r.error) { try { toast("Erro ao excluir: " + r.error.message, "erro"); } catch (e) { alert(r.error.message); } return; }
          try { toast("Conta excluída.", "ok"); } catch (e) {}
          pcCarregado = false; carregarPlanoContasSeNecessario();
        });
      });
    });
  });
}

// -- CRUD: modal Novo/Editar conta -----------------------------------------
// Helper: máscara variável conforme nível
function _pcMascaraPorNivel(n) {
  n = Number(n) || 5;
  if (n <= 1) return { mascara: "NN", regex: /^\d{2}$/, hint: "2 dígitos (ex: 11)" };
  if (n <= 2) return { mascara: "NN.NN", regex: /^\d{2}\.\d{2}$/, hint: "ex: 11.01" };
  if (n <= 3) return { mascara: "NN.NN.NNN", regex: /^\d{2}\.\d{2}\.\d{3}$/, hint: "ex: 11.01.001" };
  if (n <= 4) return { mascara: "NN.NN.NNN.NNN", regex: /^\d{2}\.\d{2}\.\d{3}\.\d{3}$/, hint: "ex: 11.01.001.001" };
  return { mascara: "NN.NN.NNN.NNN.NNN", regex: /^\d{2}\.\d{2}\.\d{3}\.\d{3}\.\d{3}$/, hint: "ex: 11.01.001.001.001" };
}

function abrirModalPlanoContas(p) {
  p = p || {};
  var editar = !!p.id;

  // Onda A: perfil do usuário corrente decide o que pode editar
  var perfilUser = (window._terraUserPerfilTipo || "").toLowerCase();
  var soDescritivo = perfilUser === "operador";

  var grupos = {};
  var dres   = {};
  var nats   = {};
  (planoContas || []).forEach(function (x) {
    if (x.grupo)    grupos[x.grupo]    = true;
    if (x.dre)      dres[x.dre]        = true;
    if (x.natureza) nats[x.natureza]   = true;
  });
  var optsGrupo = [{ value: "", label: "—" }].concat(Object.keys(grupos).sort().map(function (g) { return { value: g, label: g }; }));
  var optsDre   = [{ value: "", label: "—" }].concat(Object.keys(dres).sort().map(function (d) { return { value: d, label: d }; }));
  var optsNat   = [{ value: "", label: "—" }].concat(Object.keys(nats).sort().map(function (n) { return { value: n, label: n }; }));

  // Próximo seq automático (max + 1)
  var maxSeq = 0;
  (planoContas || []).forEach(function (x) { if (x.seq && x.seq > maxSeq) maxSeq = x.seq; });
  var seqAuto = editar ? p.seq : (maxSeq + 1);

  var nivelInicial = p.nivel || 5;
  var mInicial = _pcMascaraPorNivel(nivelInicial);

  var campos = [
    { name: "seq",          label: "Seq (gerado automaticamente)", type: "number", valor: seqAuto, group: "Identificação" },
    { name: "nivel",        label: "Nível (1 a 5)",                type: "select", valor: String(nivelInicial), required: true, group: "Identificação",
      options: [
        { value: "1", label: "1 — Grupo (NN)" },
        { value: "2", label: "2 — Subgrupo (NN.NN)" },
        { value: "3", label: "3 — Conta (NN.NN.NNN)" },
        { value: "4", label: "4 — Subconta (NN.NN.NNN.NNN)" },
        { value: "5", label: "5 — Detalhe (NN.NN.NNN.NNN.NNN)" }
      ]
    },
    { name: "numero_conta", label: "Nº da Conta — " + mInicial.hint, type: "text", valor: p.numero_conta, required: true, group: "Identificação" },
    { name: "descritivo",   label: "Descritivo",                   type: "text",   valor: p.descritivo, required: true, group: "Identificação" },
    { name: "grupo",        label: "Grupo",                        type: "select", valor: p.grupo || "", options: optsGrupo, group: "Classificação" },
    { name: "dre",          label: "DRE",                          type: "select", valor: p.dre || "",   options: optsDre,   group: "Classificação" },
    { name: "natureza",     label: "Natureza (Fixo/Variável)",     type: "select", valor: p.natureza || "", options: optsNat, group: "Classificação" },
    { name: "rateio",       label: "Rateio?",                      type: "select", valor: p.rateio || "Não",
      options: [{ value: "Sim", label: "Sim" }, { value: "Não", label: "Não" }], group: "Classificação" }
  ];

  abrirModal({
    titulo: editar ? "Editar conta" + (soDescritivo ? " (apenas descritivo — seu perfil)" : "") : "Nova conta",
    fields: campos,
    onSubmit: function (v, done) {
      // Onda A: validar máscara conforme nível
      var nivel = Number(v.nivel);
      var m = _pcMascaraPorNivel(nivel);
      var numero = (v.numero_conta || "").trim();
      if (!m.regex.test(numero)) {
        done("Formato do Nº da Conta inválido para nível " + nivel + ". Esperado: " + m.mascara + " (" + m.hint + ")");
        return;
      }

      // Se for operador, mandar só descritivo (preserva o resto)
      var payload;
      if (soDescritivo && editar) {
        payload = { descritivo: v.descritivo };
      } else {
        payload = {
          seq:          v.seq != null ? Number(v.seq) : (editar ? p.seq : null),
          nivel:        nivel,
          numero_conta: numero,
          descritivo:   v.descritivo,
          grupo:        v.grupo || null,
          dre:          v.dre || null,
          natureza:     v.natureza || null,
          rateio:       v.rateio || "Não"
        };
      }

      // Onda A: bloquear duplicidade de numero_conta antes do save
      function prosseguirSave() {
        var q = editar
          ? client.from("plano_contas").update(payload).eq("id", p.id)
          : client.from("plano_contas").insert(Object.assign({ importacao_id: 1, cod_conta: null }, payload));
        q.then(function (r) {
          if (r.error) {
            // Mensagem amigável pra constraint de unique
            if (String(r.error.message || "").indexOf("idx_plano_contas_numero_unique_ativo") !== -1) {
              done("Já existe outra conta ATIVA com este Nº (" + numero + "). Use outro número ou inative a conta existente antes.");
            } else {
              done(r.error.message);
            }
            return;
          }
          pcCarregado = false; carregarPlanoContasSeNecessario();
          done(null);
        });
      }
      // Pré-checar duplicidade (UX melhor que erro do banco)
      if (numero && (!editar || numero !== p.numero_conta)) {
        var qDup = client.from("plano_contas").select("id, descritivo").eq("numero_conta", numero).eq("ativo", true);
        if (editar) qDup = qDup.neq("id", p.id);
        qDup.then(function (rDup) {
          if (!rDup.error && rDup.data && rDup.data.length) {
            done("Já existe conta ATIVA com Nº " + numero + ": \"" + rDup.data[0].descritivo + "\". Use outro número ou inative a existente.");
            return;
          }
          prosseguirSave();
        });
      } else {
        prosseguirSave();
      }
    }
  });
}

// -- Importação XLSX do Plano de Contas ------------------------------------
function importarPlanoContasXlsx(arq) {
  if (typeof window.XLSX === "undefined") {
    alert("Biblioteca XLSX ainda carregando. Aguarde alguns segundos e tente de novo.");
    return;
  }
  var reader = new FileReader();
  reader.onload = function (ev) {
    try {
      var wb = window.XLSX.read(ev.target.result, { type: "array", cellDates: true });
      var sheet = wb.Sheets[wb.SheetNames[0]];
      var raw = window.XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false, header: 1 });
      if (!raw.length) { alert("Planilha vazia."); return; }

      var headerRow = -1;
      for (var i = 0; i < Math.min(raw.length, 10); i++) {
        var row = raw[i] || [];
        var hasCod = row.some(function (c) { return /c[oó]d.*conta/i.test(String(c || "")); });
        if (hasCod) { headerRow = i; break; }
      }
      if (headerRow === -1) {
        alert("Não foi possível encontrar o cabeçalho. A planilha precisa ter uma coluna chamada 'CÓD CONTA' (ou 'Cod Conta').");
        return;
      }

      var cabs = raw[headerRow].map(function (c) { return String(c || "").trim(); });
      var idx = {};
      cabs.forEach(function (c, i) {
        var n = c.toLowerCase().replace(/[^a-zà-ú0-9]+/gi, " ").trim();
        if (/^seq/.test(n))                    idx.seq = i;
        else if (/^n[ií]vel/.test(n))          idx.nivel = i;
        else if (/c[oó]d.*conta/.test(n))      idx.cod_conta = i;
        else if (/n.*da.*conta|n[uú]mero.*conta|n.*conta/.test(n)) idx.numero_conta = i;
        else if (/descritivo|descri[cç][aã]o/.test(n)) idx.descritivo = i;
        else if (/^grupo$/.test(n))            idx.grupo = i;
        else if (/^dre$/.test(n))              idx.dre = i;
        else if (/natureza/.test(n))           idx.natureza = i;
        else if (/rateio/.test(n))             idx.rateio = i;
      });

      var faltando = ["cod_conta","descritivo"].filter(function (k) { return idx[k] === undefined; });
      if (faltando.length) {
        alert("Faltando colunas obrigatórias: " + faltando.join(", "));
        return;
      }

      var linhas = [];
      for (var r = headerRow + 1; r < raw.length; r++) {
        var row = raw[r] || [];
        if (!row.length) continue;
        var cod = row[idx.cod_conta];
        if (cod === null || cod === undefined || String(cod).trim() === "") continue;
        linhas.push({
          seq:          idx.seq          !== undefined && row[idx.seq]    !== null ? Number(row[idx.seq])    : null,
          nivel:        idx.nivel        !== undefined && row[idx.nivel]  !== null ? Number(row[idx.nivel])  : null,
          cod_conta:    String(cod).trim(),
          numero_conta: idx.numero_conta !== undefined && row[idx.numero_conta] !== null ? String(row[idx.numero_conta]).trim() : null,
          descritivo:   idx.descritivo   !== undefined && row[idx.descritivo] !== null ? String(row[idx.descritivo]).trim() : null,
          grupo:        idx.grupo        !== undefined && row[idx.grupo]  !== null ? String(row[idx.grupo]).trim() : null,
          dre:          idx.dre          !== undefined && row[idx.dre]    !== null ? String(row[idx.dre]).trim()   : null,
          natureza:     idx.natureza     !== undefined && row[idx.natureza] !== null ? String(row[idx.natureza]).trim() : null,
          rateio:       idx.rateio       !== undefined && row[idx.rateio] !== null ? String(row[idx.rateio]).trim() : "Não"
        });
      }
      if (!linhas.length) { alert("Nenhuma linha de dados encontrada (depois do cabeçalho)."); return; }

      if (!confirm("Importar " + linhas.length + " linha(s) do Plano de Contas?\n\nEstratégia: para cada linha, atualiza pelo (cod_conta + descritivo) se já existe; senão insere nova.\nAs contas que estão no banco mas NÃO na planilha permanecem inalteradas.")) return;

      var existentes = {};
      (planoContas || []).forEach(function (p) {
        existentes[(p.cod_conta || "") + "||" + (p.descritivo || "")] = p;
      });

      var atualizados = 0, inseridos = 0, erros = 0;
      var pendente = linhas.length;
      function done() {
        pendente--;
        if (pendente === 0) {
          alert("Importação concluída.\nAtualizados: " + atualizados + "\nInseridos: " + inseridos + "\nErros: " + erros);
          pcCarregado = false; carregarPlanoContasSeNecessario();
        }
      }
      linhas.forEach(function (lin) {
        var key = (lin.cod_conta || "") + "||" + (lin.descritivo || "");
        var ex  = existentes[key];
        var payload = {
          seq:          lin.seq,
          nivel:        lin.nivel,
          cod_conta:    lin.cod_conta,
          numero_conta: lin.numero_conta,
          descritivo:   lin.descritivo,
          grupo:        lin.grupo,
          dre:          lin.dre,
          natureza:     lin.natureza,
          rateio:       lin.rateio
        };
        var q = ex
          ? client.from("plano_contas").update(payload).eq("id", ex.id)
          : client.from("plano_contas").insert(Object.assign({ importacao_id: 1 }, payload));
        q.then(function (r) {
          if (r.error) erros++;
          else if (ex) atualizados++;
          else inseridos++;
          done();
        });
      });
    } catch (e) {
      alert("Erro lendo arquivo: " + e.message);
    }
  };
  reader.onerror = function () { alert("Falha ao ler arquivo."); };
  reader.readAsArrayBuffer(arq);
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
  // Subtítulo dinâmico CFOP
  var cfPgSub = document.querySelector('section[data-page="cfg_cfop"] .page-sub');
  if (cfPgSub) cfPgSub.textContent = cfopLista.length + " códigos · " + apl + " marcados como aplicáveis à Terra";
  valText(document.getElementById("cf-lbl"), filtrados.length + " códigos");

  preencherTbody(tbody, filtrados.map(function (c) {
    var ativo = !!c.aplicavel;
    var btnTxt = ativo ? "✓ Aplicável" : "○ Não aplicável";
    var btnCls = ativo ? "cf-toggle-on" : "cf-toggle-off";
    return '<tr>' +
      '<td class="mono">' + escHtml(c.cfop) + '</td>' +
      '<td class="mono">' + escHtml(c.cfop_formatado || "—") + '</td>' +
      '<td>' + escHtml(c.grupo || "—") + '</td>' +
      '<td>' + escHtml(c.descricao || "—") + '</td>' +
      '<td class="num"><button type="button" class="cf-toggle ' + btnCls + '" data-id="' + c.id + '">' + btnTxt + '</button></td>' +
    '</tr>';
  }), 5);

  // Ligar toggles (clica e alterna)
  tbody.querySelectorAll(".cf-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-id"));
      var c = cfopLista.find(function (x) { return x.id === id; });
      var novo = !c.aplicavel;
      btn.disabled = true;
      client.from("cfop").update({ aplicavel: novo }).eq("id", id).then(function (r) {
        btn.disabled = false;
        if (r.error) {
          try { toast("Erro ao atualizar CFOP: " + r.error.message, "erro"); } catch (e) { alert("Erro: " + r.error.message); }
          return;
        }
        // Atualiza cache local e visual
        cfopLista.forEach(function (x) { if (x.id === id) x.aplicavel = novo; });
        btn.textContent = novo ? "✓ Aplicável" : "○ Não aplicável";
        btn.className = "cf-toggle " + (novo ? "cf-toggle-on" : "cf-toggle-off");
        var apl = 0;
        cfopLista.forEach(function (x) { if (x.aplicavel) apl++; });
        valText(document.getElementById("cf-m-apl"), fmtInt(apl));
        valText(document.getElementById("cf-m-nao"), fmtInt(cfopLista.length - apl));
        // Atualiza subtítulo dinâmico
        var cfPgSub2 = document.querySelector('section[data-page="cfg_cfop"] .page-sub');
        if (cfPgSub2) cfPgSub2.textContent = cfopLista.length + " códigos · " + apl + " marcados como aplicáveis à Terra";
      });
    });
  });
}

// -- CFOP: ações em massa (marcar/desmarcar todos os visíveis) ------------
function aplicarCfopMassa(novoValor) {
  if (!cfopCarregado || !cfopLista.length) {
    alert("Aguarde a tabela carregar.");
    return;
  }
  var busca  = ((document.getElementById("cf-busca")||{}).value || "").trim().toLowerCase();
  var filtro = ((document.getElementById("cf-filtro")||{}).value || "");
  var visiveis = cfopLista.filter(function (c) {
    if (filtro === "aplicaveis" && !c.aplicavel) return false;
    if (filtro === "nao" && c.aplicavel) return false;
    return matchBusca(busca, [c.cfop, c.cfop_formatado, c.descricao, c.grupo]);
  });
  var mudar = visiveis.filter(function (c) { return Boolean(c.aplicavel) !== Boolean(novoValor); });
  if (!mudar.length) {
    alert("Nenhum CFOP visível precisa de mudança (todos já estão " + (novoValor ? "marcados" : "desmarcados") + ").");
    return;
  }
  var msg = (novoValor ? "Marcar como APLICÁVEL " : "Desmarcar (Não-aplicável) ") + mudar.length + " CFOP(s) visível(eis)?";
  if (!confirm(msg)) return;

  var ids = mudar.map(function (c) { return c.id; });
  client.from("cfop").update({ aplicavel: novoValor }).in("id", ids).then(function (r) {
    if (r.error) { alert("Erro ao atualizar em massa: " + r.error.message); return; }
    cfopLista.forEach(function (c) { if (ids.indexOf(c.id) !== -1) c.aplicavel = novoValor; });
    renderCfop();
  });
}

// -- CFOP: importação XLSX (lista de aplicáveis) ---------------------------
function importarCfopXlsx(arq) {
  if (typeof window.XLSX === "undefined") {
    alert("Biblioteca XLSX ainda carregando. Aguarde alguns segundos e tente de novo.");
    return;
  }
  var reader = new FileReader();
  reader.onload = function (ev) {
    try {
      var wb = window.XLSX.read(ev.target.result, { type: "array", cellDates: true });
      var sheet = wb.Sheets[wb.SheetNames[0]];
      var raw = window.XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false, header: 1 });
      if (!raw.length) { alert("Planilha vazia."); return; }

      var headerRow = -1;
      for (var i = 0; i < Math.min(raw.length, 10); i++) {
        var row = raw[i] || [];
        var hasCfop = row.some(function (c) { return /^c[oó]digo$|cfop/i.test(String(c || "").trim()); });
        if (hasCfop) { headerRow = i; break; }
      }
      if (headerRow === -1) {
        alert("Não foi possível encontrar o cabeçalho. A planilha precisa ter uma coluna 'CFOP' ou 'Código'.");
        return;
      }

      var cabs = raw[headerRow].map(function (c) { return String(c || "").trim().toLowerCase(); });
      var idxCfop = -1, idxApl = -1;
      cabs.forEach(function (c, i) {
        if (/cfop|c[oó]digo/.test(c) && idxCfop === -1) idxCfop = i;
        else if (/aplic[aá]vel|aplicavel|aplic/.test(c)) idxApl = i;
      });
      if (idxCfop === -1) { alert("Coluna 'CFOP' não encontrada."); return; }

      var pares = [];
      for (var r = headerRow + 1; r < raw.length; r++) {
        var row = raw[r] || [];
        var v = row[idxCfop];
        if (v === null || v === undefined || String(v).trim() === "") continue;
        var cfop = String(v).replace(/\D/g, "");
        if (!cfop) continue;
        var apl = true;
        if (idxApl !== -1) {
          var s = String(row[idxApl] || "").trim().toLowerCase();
          apl = (s === "sim" || s === "true" || s === "1" || s === "x" || s === "s" || s === "yes");
        }
        pares.push({ cfop: cfop, aplicavel: apl });
      }
      if (!pares.length) { alert("Nenhum CFOP encontrado na planilha."); return; }

      var dialog = "Importar " + pares.length + " linha(s) de CFOP?\n\n";
      if (idxApl === -1) {
        dialog += "Modo: TODOS os CFOPs listados ficarão marcados como APLICÁVEIS. Os demais permanecem como estão.\n";
      } else {
        dialog += "Modo: cada linha define explicitamente se o CFOP é aplicável (coluna Aplicável). Os CFOPs não listados permanecem como estão.\n";
      }
      if (!confirm(dialog)) return;

      var atualizados = 0, naoEncontrados = 0, erros = 0;
      var pendente = pares.length;
      function done() {
        pendente--;
        if (pendente === 0) {
          alert("Importação CFOP concluída.\nAtualizados: " + atualizados + "\nNão encontrados (cfop ausente do cadastro): " + naoEncontrados + "\nErros: " + erros);
          cfopCarregado = false;
          carregarCfopSeNecessario();
        }
      }
      pares.forEach(function (par) {
        client.from("cfop").update({ aplicavel: par.aplicavel }).eq("cfop", par.cfop).select("id").then(function (r) {
          if (r.error) { erros++; done(); return; }
          if (!r.data || !r.data.length) naoEncontrados++;
          else atualizados++;
          done();
        });
      });
    } catch (e) {
      alert("Erro lendo arquivo: " + e.message);
    }
  };
  reader.onerror = function () { alert("Falha ao ler arquivo."); };
  reader.readAsArrayBuffer(arq);
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
      "ano":            "ano",
      "mes":            "mes",
      "categoria":      "categoria",
      "subcategoria":   "subcategoria",
      "valor":          "valor",
      "tipo produto":  "tipo_produto",
      "tipo_produto":  "tipo_produto",
      "tipo manual":   "tipo_produto",
      "tipo":          "tipo_produto",
      "area id":       "area_id",
      "area_id":       "area_id"
    },
    obrigatorias: ["ano", "mes", "categoria", "valor"],
    dicas: "Colunas esperadas: ano, mes, categoria (receita|custo), valor (obrigatórias); subcategoria (texto livre), tipo_produto (ex: Mobília Fixa/Solta/Serviço/Mercadoria), area_id (numero do organograma — consulte na tela Configuração > Organograma) — todas opcionais."
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
