/**
 * Terra Conttemporânea — Gestão Financeira
 * Módulo: 03 imports rh
 * Parte 3/8 do refator M1 v2 (app.js antigo: linhas 3165-4806)
 *
 * IMPORTANTE: a ORDEM dos scripts no index.html importa.
 * 5 funções têm 2 declarações (a 2ª sobrescreve a 1ª) e há blocos de
 * override que dependem das funções já existirem. Não reorganizar.
 */

"use strict";


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
    if (f.type === "multiselect") {
      var checked = Array.isArray(f.valor) ? f.valor.map(String) : (f.valor ? [String(f.valor)] : []);
      var optsMs = (f.options || []).map(function (o) {
        var v = (typeof o === "object") ? o.value : o;
        var t = (typeof o === "object") ? o.label : o;
        var isChecked = (o && o.checked) || checked.indexOf(String(v)) !== -1;
        return '<label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer">'
          + '<input type="checkbox" name="' + f.name + '" value="' + escHtml(v) + '"' + (isChecked ? ' checked' : '') + ' />'
          + '<span>' + escHtml(t) + '</span></label>';
      }).join("");
      return '<div class="form-field form-field-wide"><label>' + escHtml(f.label) + '</label>'
        + '<div class="multiselect-box" id="' + id + '" style="max-height:180px;overflow-y:auto;border:1px solid var(--borda2,#d3c5b3);border-radius:6px;padding:6px 10px;background:#fff">'
        + (optsMs || '<div class="tbl-vazio">Sem opcoes disponiveis</div>')
        + '</div></div>';
    }
    if (f.type === "checkbox") {
      var ck = (f.valor === true || f.valor === "1" || f.valor === 1) ? " checked" : "";
      return '<div class="form-field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer">'
        + '<input id="' + id + '" name="' + f.name + '" type="checkbox" value="1"' + ck + ' />'
        + '<span>' + escHtml(f.label) + '</span></label></div>';
    }
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
  modalSalvar.textContent = config.salvarLabel || "Salvar como rascunho";
  modalConfig._lastAction = "salvar";
  modalConfig._dirty = false;

  // extraButtons (ex.: "Publicar") - injetados antes do botao Salvar
  var btnRowOld = document.getElementById("modal-extra-btns");
  if (btnRowOld) btnRowOld.remove();
  if (config.extraButtons && config.extraButtons.length) {
    var btnRow = document.createElement("span");
    btnRow.id = "modal-extra-btns";
    btnRow.style.display = "inline-flex";
    btnRow.style.gap = "6px";
    btnRow.style.marginRight = "8px";
    config.extraButtons.forEach(function (eb) {
      var b = document.createElement("button");
      b.type = "button";
      b.id = "modal-extra-" + eb.id;
      b.className = eb.cssClass || "btn-limpar";
      b.textContent = eb.label;
      b.addEventListener("click", function () {
        modalConfig._lastAction = eb.action || eb.id;
        modalForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      });
      btnRow.appendChild(b);
    });
    modalSalvar.parentNode.insertBefore(btnRow, modalSalvar);
  }

  // Track dirty: qualquer mudanca em input/textarea/select marca o modal como dirty
  setTimeout(function () {
    try {
      var inputs = modalFields.querySelectorAll("input, textarea, select");
      inputs.forEach(function (el) {
        el.addEventListener("input", function () { if (modalConfig) modalConfig._dirty = true; });
        el.addEventListener("change", function () { if (modalConfig) modalConfig._dirty = true; });
      });
    } catch (e) {}
  }, 70);

  // Auto-enhance selects grandes dentro do modal apos render
  setTimeout(function () { try { autoEnhanceLargeSelects(modalFields); } catch (e) {} }, 50);
  // Aplicar máscara monetária nos inputs do modal
  setTimeout(function () { try { aplicarMascaraMonetaria(modalFields); } catch (e) {} }, 60);
  // Botão opcional "Salvar e adicionar próximo" (#10)
  var salvarProx = document.getElementById("modal-salvar-prox");
  if (config.salvarProximo) {
    if (!salvarProx) {
      salvarProx = document.createElement("button");
      salvarProx.id = "modal-salvar-prox";
      salvarProx.type = "button";
      salvarProx.className = "btn-limpar";
      salvarProx.textContent = "Salvar e adicionar próximo";
      modalSalvar.parentNode.insertBefore(salvarProx, modalSalvar);
      salvarProx.addEventListener("click", function () {
        modalConfig._salvarProximoFlag = true;
        modalForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      });
    }
    salvarProx.hidden = false;
  } else if (salvarProx) {
    salvarProx.hidden = true;
  }
  modalOverlay.hidden = false;
  // M28b NUCLEAR: força tudo com !important pra vencer qualquer CSS que esteja
  // escondendo. Tambem move pro <body> caso algum container tenha overflow:hidden.
  try {
    modalOverlay.removeAttribute("hidden");
    modalOverlay.style.setProperty("display",        "flex",    "important");
    modalOverlay.style.setProperty("visibility",     "visible", "important");
    modalOverlay.style.setProperty("opacity",        "1",       "important");
    modalOverlay.style.setProperty("pointer-events", "auto",    "important");
    modalOverlay.style.setProperty("z-index",        "99999",   "important");
    modalOverlay.style.setProperty("position",       "fixed",   "important");
    modalOverlay.style.setProperty("top",            "0",       "important");
    modalOverlay.style.setProperty("left",           "0",       "important");
    modalOverlay.style.setProperty("right",          "0",       "important");
    modalOverlay.style.setProperty("bottom",         "0",       "important");
    // Move pro <body> se nao estiver direto nele (escapar de container com overflow:hidden)
    if (modalOverlay.parentNode !== document.body) {
      document.body.appendChild(modalOverlay);
    }
  } catch (e) { console.error("[M28b] erro forcando visibilidade:", e); }
  // M28 diagnóstico: loga estado real do modal 50ms após abertura
  setTimeout(function () {
    try {
      var cs = getComputedStyle(modalOverlay);
      var r = modalOverlay.getBoundingClientRect();
      console.warn("[DIAG-MODAL] estado pos-abrir:", {
        hidden: modalOverlay.hidden,
        display: cs.display,
        visibility: cs.visibility,
        opacity: cs.opacity,
        zIndex: cs.zIndex,
        position: cs.position,
        width: r.width,
        height: r.height,
        top: r.top,
        left: r.left,
        inDOM: !!modalOverlay.isConnected,
        parentTag: modalOverlay.parentNode && modalOverlay.parentNode.tagName,
        temContent: !!modalOverlay.querySelector(".modal-content"),
        contentDisplay: modalOverlay.querySelector(".modal-content") ? getComputedStyle(modalOverlay.querySelector(".modal-content")).display : "N/A"
      });
    } catch (e) { console.error("[DIAG-MODAL] erro:", e); }
  }, 50);
  setTimeout(function () {
    var first = modalFields.querySelector("input, select, textarea");
    if (first) first.focus();
  }, 0);
}

function fecharModal(opts) {
  opts = opts || {};
  // Pop-up "informacoes nao salvas" - Sair/Salvar/Cancelar
  if (modalConfig && modalConfig._dirty && !opts.force) {
    var resp = (window.confirmComOpcoes ? window.confirmComOpcoes(
      "Voce tem alteracoes nao salvas.",
      ["Sair sem salvar", "Salvar agora", "Cancelar (continuar editando)"]
    ) : null);
    // Fallback se confirmComOpcoes nao estiver disponivel: dois confirms encadeados
    if (resp === null) {
      var quer = confirm("Voce tem alteracoes nao salvas. Sair sem salvar?\n\nOK = sair (perde alteracoes)\nCancelar = continuar editando");
      if (!quer) return false;
      resp = 0;
    }
    if (resp === 1) { // Salvar
      modalForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      return false;
    }
    if (resp === 2) { // Cancelar
      return false;
    }
    // resp === 0 -> sai sem salvar
  }
  try {
    ["display","visibility","opacity","pointer-events","z-index","position","top","left","right","bottom"].forEach(function (p) {
      modalOverlay.style.removeProperty(p);
    });
  } catch (e) {}
  var btnRow = document.getElementById("modal-extra-btns");
  if (btnRow) btnRow.remove();
  modalOverlay.hidden = true;
  modalConfig = null;
  return true;
}

modalCancelar.addEventListener("click", function () { fecharModal(); });
modalOverlay.addEventListener("click", function (ev) {
  if (ev.target === modalOverlay) fecharModal();
});

modalForm.addEventListener("submit", function (ev) {
  ev.preventDefault();
  if (!modalConfig) return;
  var values = {};
  modalConfig.fields.forEach(function (f) {
    if (f.type === "multiselect") {
      var checks = modalFields.querySelectorAll('input[type="checkbox"][name="' + f.name + '"]:checked');
      values[f.name] = Array.prototype.slice.call(checks).map(function (cb) { return cb.value; });
      return;
    }
    if (f.type === "checkbox") {
      var cb = document.getElementById("mf-" + f.name);
      values[f.name] = !!(cb && cb.checked);
      return;
    }
    var el = document.getElementById("mf-" + f.name);
    if (!el) return;
    var v = el.value;
    if (v === "") { values[f.name] = null; return; }
    if (f.type === "number") { var n = Number(v.replace(",", ".")); values[f.name] = isNaN(n) ? null : n; return; }
    values[f.name] = v;
  });
  modalErro.hidden = true;
  modalSalvar.disabled = true;
  modalSalvar.textContent = "Salvando...";
  var actionAtual = modalConfig._lastAction || "salvar";
  modalConfig.onSubmit(values, function (err) {
    if (err) {
      modalErro.textContent = err;
      modalErro.hidden = false;
      modalSalvar.disabled = false;
      modalSalvar.textContent = modalConfig && modalConfig.salvarLabel ? modalConfig.salvarLabel : "Salvar como rascunho";
      return;
    }
    if (modalConfig) modalConfig._dirty = false;
    var reabrir = !!(modalConfig && modalConfig._salvarProximoFlag);
    var mc = modalConfig;
    fecharModal({ force: true });
    try { toast((mc && mc.toastSucesso) || "Salvo com sucesso.", "ok"); } catch (e) {}
    if (reabrir && mc && typeof mc.onAbrirProximo === "function") {
      try { mc.onAbrirProximo(); } catch (e) {}
    } else if (reabrir && mc) {
      // Reabre limpo com a mesma config (campos zerados)
      var copy = Object.assign({}, mc);
      copy._salvarProximoFlag = false;
      copy.fields = (mc.fields || []).map(function (f) { var c = Object.assign({}, f); delete c.valor; return c; });
      setTimeout(function () { abrirModal(copy); }, 50);
    }
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
    var clsR = rr ? ' class="num linha-clicavel" data-dre-mes="' + i + '" data-dre-cat="receita" data-dre-ano="' + ano + '"' : ' class="num"';
    var clsO = oo ? ' class="num linha-clicavel" data-dre-mes="' + i + '" data-dre-cat="outras" data-dre-ano="' + ano + '"' : ' class="num"';
    var clsC = cc ? ' class="num linha-clicavel" data-dre-mes="' + i + '" data-dre-cat="custo" data-dre-ano="' + ano + '"' : ' class="num"';
    linhas.push(
      '<tr>' +
        '<td>' + nomeMes[i-1] + '/' + String(ano).slice(2) + '</td>' +
        '<td' + clsR + '>' + (rr ? fmtBRL(rr) : '—') + '</td>' +
        '<td' + clsO + '>' + (oo ? fmtBRL(oo) : '—') + '</td>' +
        '<td' + clsC + '>' + (cc ? fmtBRL(cc) : '—') + '</td>' +
        '<td class="num ' + (res > 0 ? 'destaque' : '') + '">' + (tr || cc ? fmtBRL(res) : '—') + '</td>' +
        '<td class="num">' + mrg + '</td>' +
      '</tr>'
    );
  }
  linhas.push(
    '<tr class="tot"><td><strong>Ano ' + ano + '</strong></td>' +
    '<td class="num linha-clicavel" data-dre-mes="ano" data-dre-cat="receita" data-dre-ano="' + ano + '"><strong>' + fmtBRL(totR) + '</strong></td>' +
    '<td class="num linha-clicavel" data-dre-mes="ano" data-dre-cat="outras" data-dre-ano="' + ano + '"><strong>' + fmtBRL(totO) + '</strong></td>' +
    '<td class="num linha-clicavel" data-dre-mes="ano" data-dre-cat="custo" data-dre-ano="' + ano + '"><strong>' + fmtBRL(totC) + '</strong></td>' +
    '<td class="num destaque"><strong>' + fmtBRL(resultado) + '</strong></td>' +
    '<td class="num"><strong>' + margem + '</strong></td></tr>'
  );
  var tbody = document.getElementById("dre-tbody");
  tbody.innerHTML = linhas.join("");

  // Wire-up: clicar em célula abre drill-down
  tbody.querySelectorAll("[data-dre-cat]").forEach(function (cell) {
    cell.addEventListener("click", function () {
      var mesAttr = cell.getAttribute("data-dre-mes");
      var cat     = cell.getAttribute("data-dre-cat");
      var anoAttr = Number(cell.getAttribute("data-dre-ano"));
      abrirDrillDre(anoAttr, mesAttr, cat);
    });
  });
}

// -- Drill-down DRE: split por subcategoria ---------------------------------
function abrirDrillDre(ano, mesAttr, categoria) {
  var nomeMes = ["", "Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  var labelMes = mesAttr === "ano" ? ("Ano " + ano) : (nomeMes[Number(mesAttr)] + "/" + ano);
  var labelCat = categoria === "receita" ? "Receita" : (categoria === "outras" ? "Outras Receitas" : "Custos");

  // E6: ler a dimensão escolhida pelo usuário
  var dimensao = ((document.getElementById("dre-dimensao")||{}).value) || "subcategoria";
  var labelDim = ({ subcategoria: "Subcategoria", tipo_produto: "Tipo de Produto", area_id: "Área" })[dimensao] || dimensao;

  // Filtrar receitas_custos pelo período + categoria
  var lista = (rcLista || []).filter(function (r) {
    if (Number(r.ano) !== ano) return false;
    if (mesAttr !== "ano" && Number(r.mes) !== Number(mesAttr)) return false;
    if (categoria === "receita") {
      var sub = (r.subcategoria || "").toLowerCase();
      return r.categoria === "receita" && sub.indexOf("outras") === -1;
    } else if (categoria === "outras") {
      var sub2 = (r.subcategoria || "").toLowerCase();
      return r.categoria === "receita" && sub2.indexOf("outras") !== -1;
    } else {
      return r.categoria === "custo";
    }
  });

  // Agrupar pela dimensão escolhida
  var porKey = {};
  lista.forEach(function (r) {
    var key;
    if (dimensao === "tipo_produto") {
      key = r.tipo_produto || "(sem tipo de produto)";
    } else if (dimensao === "area_id") {
      // Resolver area_id -> nome via cache de organograma se disponível
      var areaId = r.area_id;
      if (areaId == null) { key = "(sem área)"; }
      else {
        var nodo = (typeof orgNodos !== "undefined" && orgNodos) ? orgNodos.find(function (n) { return n.id === areaId; }) : null;
        key = nodo ? (nodo.nome || nodo.label || ("Área #" + areaId)) : ("Área #" + areaId);
      }
    } else {
      key = r.subcategoria || "(sem subcategoria)";
    }
    porKey[key] = (porKey[key] || 0) + Number(r.valor || 0);
  });
  var grupos = Object.keys(porKey).map(function (k) { return { sub: k, valor: porKey[k] }; });
  grupos.sort(function (a, b) { return b.valor - a.valor; });
  var total = grupos.reduce(function (a, s) { return a + s.valor; }, 0);

  var avisoDimensao = "";
  if (dimensao !== "subcategoria") {
    var preenchidos = lista.filter(function (r) {
      if (dimensao === "tipo_produto") return r.tipo_produto != null && r.tipo_produto !== "";
      if (dimensao === "area_id")      return r.area_id != null;
      return true;
    }).length;
    var pct = lista.length > 0 ? Math.round(preenchidos / lista.length * 100) : 0;
    if (pct < 100) {
      avisoDimensao = '<div class="alert alert-warn" style="margin-bottom:12px; padding:8px 12px; background: var(--warn-bg); border-left:3px solid var(--warn); font-size:13px;">' +
        '<strong>' + pct + '%</strong> dos registros têm <code>' + dimensao + '</code> preenchido. Os demais aparecem como "' +
        (dimensao === "tipo_produto" ? "(sem tipo de produto)" : "(sem área)") + '". Para popular essa dimensão, use o import com a coluna apropriada.' +
        '</div>';
    }
  }

  var linhasHtml;
  if (!grupos.length) {
    linhasHtml = '<p class="muted">Sem registros pra este corte.</p>';
  } else {
    linhasHtml = avisoDimensao + '<table class="tabela"><thead><tr><th>' + escHtml(labelDim) + '</th><th class="num">Valor</th><th class="num">% do total</th></tr></thead><tbody>' +
      grupos.map(function (s) {
        var pct = total > 0 ? ((s.valor / total) * 100).toFixed(1).replace(".", ",") + "%" : "—";
        return '<tr><td>' + escHtml(s.sub) + '</td><td class="num">' + fmtBRL(s.valor) + '</td><td class="num">' + pct + '</td></tr>';
      }).join("") +
      '<tr class="tot"><td><strong>Total</strong></td><td class="num"><strong>' + fmtBRL(total) + '</strong></td><td class="num">100,0%</td></tr>' +
      '</tbody></table>';
  }

  abrirModalDetalhe("DRE — " + labelCat + " · " + labelMes + " · por " + labelDim, linhasHtml);
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
  // M27 — Bug #2 fix: buscar emails via RPC (antes dependia de Edge Function bugada)
  var qEmails = client.rpc("fn_listar_emails_perfis");
  Promise.all([qPerfis, qTipos, qEmails]).then(function (rs) {
    var rP = rs[0], rT = rs[1], rE = rs[2];
    if (rP.error) {
      document.getElementById("us-tbody").innerHTML = '<tr><td colspan="7" class="tbl-vazio erro">Erro: ' + rP.error.message + '</td></tr>';
      return;
    }
    usuariosLista = rP.data || [];
    perfisTiposLista = (rT && rT.data) || [];
    perfisTiposCarregado = true;
    // Indexar emails por id (silencia erro caso o usuário não seja admin)
    emailsByUserId = {};
    if (rE && !rE.error && Array.isArray(rE.data)) {
      rE.data.forEach(function (row) { emailsByUserId[row.id] = row.email || ""; });
    }
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
    var ultimo = u.ultimo_acesso
      ? '<span title="' + fmtData(u.ultimo_acesso) + '">' + fmtTempoRelativo(u.ultimo_acesso) + '</span>'
      : '<span class="muted">nunca</span>';
    var emailTxt = emailsByUserId[u.id] || '<span class="muted">—</span>';
    var btnAtivar = u.ativo === false
      ? '<button type="button" class="btn-icon btn-icon-acao" data-us-reativar="' + escHtml(u.id) + '" title="Reativar usuário">↻</button>'
      : '<button type="button" class="btn-icon" data-us-desativar="' + escHtml(u.id) + '" title="Desativar usuário">✖</button>';
    return '<tr>' +
      '<td><strong>' + escHtml(u.nome) + '</strong></td>' +
      '<td>' + emailTxt + '</td>' +
      '<td>' + escHtml(u.perfil) + '</td>' +
      '<td>' + st + '</td>' +
      '<td>' + senhaTempBadge + '</td>' +
      '<td>' + ultimo + '</td>' +
      '<td class="acoes-compact">' +
        '<button class="btn-icon" data-us-edit="' + escHtml(u.id) + '" title="Editar usuário">✏️</button>' +
        '<button class="btn-icon" data-us-resetsenha="' + escHtml(u.id) + '" title="Disparar email pra trocar senha">🔑</button>' +
        btnAtivar +
      '</td>' +
    '</tr>';
  }), 7, "Nenhum usuário.");

  tbody.querySelectorAll("[data-us-edit]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      console.warn("[DIAG] click data-us-edit disparou", { id: btn.getAttribute("data-us-edit"), ev: ev });
      var id = btn.getAttribute("data-us-edit");
      var u = usuariosLista.find(function (x) { return x.id === id; });
      console.warn("[DIAG] usuario encontrado?", !!u, "usuariosLista.length=", usuariosLista.length);
      if (u) {
        console.warn("[DIAG] chamando abrirModalUsuario", u.nome);
        try { abrirModalUsuario(u); console.warn("[DIAG] abrirModalUsuario retornou OK"); }
        catch (e) { console.error("[DIAG] erro em abrirModalUsuario:", e); }
      } else {
        console.warn("[DIAG] usuario NÃO achado pra id", id);
      }
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
  // M27 — Resetar senha: dispara email de reset usando o email do user (carregado via fn_listar_emails_perfis)
  tbody.querySelectorAll("[data-us-resetsenha]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-us-resetsenha");
      var u = usuariosLista.find(function (x) { return x.id === id; });
      var email = emailsByUserId[id];
      if (!u || !email) {
        try { toast("Email do usuário não encontrado.", "erro"); } catch(e) { alert("Email não encontrado."); }
        return;
      }
      if (!confirm("Disparar email de reset de senha pra " + u.nome + " (" + email + ")?\n\nEle vai receber um link válido por 1 hora pra criar nova senha.")) return;
      btn.disabled = true; btn.textContent = "Enviando…";
      client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/redefinir-senha.html"
      }).then(function (r) {
        btn.disabled = false; btn.textContent = "🔑 Resetar senha";
        if (r && r.error) {
          try { toast("Falha: " + r.error.message, "erro"); } catch(e) { alert("Falha: " + r.error.message); }
          return;
        }
        try { toast("✓ Email enviado pra " + email, "ok"); } catch(e) { alert("Email enviado!"); }
      });
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
              mostrarMensagem("Usuário criado!", "Um email de cadastro foi enviado para que a pessoa defina a senha de acesso.", "ok");
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
      '<td><button class="btn-limpar" data-pt-edit="' + t.id + '">Editar</button> <button class="btn-limpar" data-pt-del="' + t.id + '" title="Excluir">🗑 Excluir</button></td>' +
    '</tr>';
  }).join("");
  tbody.querySelectorAll("[data-pt-edit]").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = Number(b.getAttribute("data-pt-edit"));
      var t = perfisTiposLista.find(function (x) { return x.id === id; });
      if (t) abrirModalPerfilTipo(t);
    });
  });
  tbody.querySelectorAll("[data-pt-del]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var id = btn.getAttribute("data-pt-del");
      var rid = isNaN(Number(id)) ? id : Number(id);
      if (!confirm("Excluir este registro? Essa ação não pode ser desfeita.")) return;
      client.from("perfis_tipos").delete().eq("id", rid).then(function (r) {
        if (r.error) { try { toast("Erro ao excluir: " + r.error.message, "erro"); } catch (e) { alert("Erro ao excluir: " + r.error.message); } return; }
        try { toast("Excluído.", "ok"); } catch (e) {}
        if (typeof carregarPerfisTiposSeNecessario === "function") carregarPerfisTiposSeNecessario();
      });
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
var cargosLista = [];
var cargosCarregado = false;
var funcionarioDependentesCache = {};
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
  if (!cargosCarregado) { try { carregarCargosSeNecessario(); } catch (e) {} }
  client.from("funcionarios").select("*").order("nome", { ascending: true }).then(function (r) {
    if (r.error) {
      document.getElementById("fn-tbody").innerHTML = '<tr><td colspan="7" class="tbl-vazio erro">Erro: ' + r.error.message + '</td></tr>';
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
    return matchBusca(busca, [f.nome, f.cargo, f.cpf, f.e_social]);
  });

  var ativos = funcionariosLista.filter(function (f) { return !f.data_demissao; });
  var folha = 0;
  ativos.forEach(function (f) { folha += Number(f.salario_base || 0); });

  valText(document.getElementById("fn-m-ativos"), fmtInt(ativos.length));
  valText(document.getElementById("fn-m-tot"),    fmtInt(funcionariosLista.length));
  valText(document.getElementById("fn-m-folha"),  fmtBRL(folha));
  valText(document.getElementById("fn-lbl"), filtrados.length + " de " + funcionariosLista.length);

  preencherTbody(tbody, filtrados.map(function (f) {
    var cargoTxt = "-";
    if (f.cargo_id) {
      var cgObj = (cargosLista || []).find(function (cc) { return cc.id === f.cargo_id; });
      if (cgObj) cargoTxt = cgObj.nome;
    } else if (f.cargo) {
      cargoTxt = f.cargo;
    }
    var eSocialSub = f.e_social
      ? '<div class="row-sub" style="font-size:11px;color:var(--marrom-med,#7A5740);margin-top:2px">e-Social: ' + escHtml(f.e_social) + '</div>'
      : '';
    return '<tr style="cursor:pointer" data-fn-row="' + f.id + '">' +
      '<td><strong>' + escHtml(f.nome) + '</strong>' + eSocialSub + '</td>' +
      '<td class="mono">' + escHtml(f.cpf || "-") + '</td>' +
      '<td>' + escHtml(cargoTxt) + '</td>' +
      '<td>' + fmtData(f.data_admissao) + '</td>' +
      '<td>' + (f.data_demissao ? fmtData(f.data_demissao) : '<span class="badge-tipo solta">ativo</span>') + '</td>' +
      '<td class="num">' + fmtBRL(f.salario_base) + '</td>' +
      '<td>' +
        '<button class="btn-limpar" data-fn-edit="' + f.id + '">Editar</button> ' +
        '<button class="btn-limpar" data-fn-ficha="' + f.id + '" title="Baixar Ficha Funcional (PDF)">Ficha</button> ' +
        '<button class="btn-limpar" data-fn-holerite="' + f.id + '" title="Holerite por mes">Holerite</button> ' +
        '<button class="btn-limpar" data-fn-deps="' + f.id + '" title="Dependentes">Deps</button> ' +
        '<button class="btn-limpar" data-fn-del="' + f.id + '" title="Excluir">Excluir</button>' +
      '</td>' +
    '</tr>';
  }), 7);

  // Linha inteira clicavel abre modal (exceto se clicou em botao)
  tbody.querySelectorAll("[data-fn-row]").forEach(function (tr) {
    tr.addEventListener("click", function (ev) {
      if (ev.target.closest("button")) return;
      var id = Number(tr.getAttribute("data-fn-row"));
      var f = funcionariosLista.find(function (x) { return x.id === id; });
      if (f) abrirModalFuncionario(f);
    });
  });

  tbody.querySelectorAll("[data-fn-edit]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-fn-edit"));
      var f = funcionariosLista.find(function (x) { return x.id === id; });
      if (f) abrirModalFuncionario(f);
    });
  });
  tbody.querySelectorAll("[data-fn-ficha]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-fn-ficha"));
      var f = funcionariosLista.find(function (x) { return x.id === id; });
      if (f) gerarFichaFuncionarioPDF(f);
    });
  });
  tbody.querySelectorAll("[data-fn-holerite]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-fn-holerite"));
      var f = funcionariosLista.find(function (x) { return x.id === id; });
      if (!f) return;
      var mes = prompt("Competência do holerite (YYYY-MM):", new Date().toISOString().slice(0,7));
      if (mes && /^\d{4}-\d{2}$/.test(mes)) gerarHoleritePDF(f, mes);
    });
  });
  tbody.querySelectorAll("[data-fn-deps]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-fn-deps"));
      var f = funcionariosLista.find(function (x) { return x.id === id; });
      if (f) abrirGerenciadorDependentes(f);
    });
  });
  tbody.querySelectorAll("[data-fn-del]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var id = btn.getAttribute("data-fn-del");
      var rid = isNaN(Number(id)) ? id : Number(id);
      if (!confirm("Excluir este registro? Essa ação não pode ser desfeita.")) return;
      client.from("funcionarios").delete().eq("id", rid).then(function (r) {
        if (r.error) { try { toast("Erro ao excluir: " + r.error.message, "erro"); } catch (e) { alert("Erro ao excluir: " + r.error.message); } return; }
        try { toast("Excluído.", "ok"); } catch (e) {}
        if (typeof carregarFuncionariosSeNecessario === "function") carregarFuncionariosSeNecessario();
      });
    });
  });
  try { setupTopScrollFor(document.querySelector('[data-page="rh_funcionarios"] .table-wrap-x')); } catch (e) {}
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
      { group: "Trabalho",       name: "cargo_id",             label: "Cargo",                                 type: "select", valor: f.cargo_id || "", options: [{value:"",label:"-"}].concat((cargosLista||[]).filter(function(c){return c.ativo && c.status_publicacao === "publicado";}).sort(function(a,b){return (a.nome||"").localeCompare(b.nome||"");}).map(function(c){return {value:c.id,label:c.nome + (c.departamento?" - "+c.departamento:"")};})) },
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

      // ===== Identidade complementar (novo na Onda A)
      { group: "Identidade complementar", name: "sexo",          label: "Sexo",                    type: "select", valor: f.sexo || "", options: [{value:"",label:"—"},{value:"Masculino",label:"Masculino"},{value:"Feminino",label:"Feminino"},{value:"Outro",label:"Outro"}] },
      { group: "Identidade complementar", name: "estado_civil",  label: "Estado civil",            type: "select", valor: f.estado_civil || "", options: [{value:"",label:"—"},{value:"Solteiro(a)",label:"Solteiro(a)"},{value:"Casado(a)",label:"Casado(a)"},{value:"União estável",label:"União estável"},{value:"Divorciado(a)",label:"Divorciado(a)"},{value:"Viúvo(a)",label:"Viúvo(a)"}] },
      { group: "Identidade complementar", name: "escolaridade",  label: "Escolaridade",            type: "select", valor: f.escolaridade || "", options: [{value:"",label:"—"},{value:"Fundamental incompleto",label:"Fundamental incompleto"},{value:"Fundamental completo",label:"Fundamental completo"},{value:"Médio incompleto",label:"Médio incompleto"},{value:"Médio completo",label:"Médio completo"},{value:"Superior incompleto",label:"Superior incompleto"},{value:"Superior completo",label:"Superior completo"},{value:"Pós-graduação",label:"Pós-graduação"}] },
      { group: "Identidade complementar", name: "nacionalidade", label: "Nacionalidade",           type: "text",   valor: f.nacionalidade || "Brasileira" },
      { group: "Identidade complementar", name: "naturalidade",  label: "Naturalidade (cidade/UF)",type: "text",   valor: f.naturalidade },
      { group: "Identidade complementar", name: "nome_mae",      label: "Nome da mãe",             type: "text",   valor: f.nome_mae },
      { group: "Identidade complementar", name: "nome_pai",      label: "Nome do pai",             type: "text",   valor: f.nome_pai },
      { group: "Identidade complementar", name: "raca_cor",      label: "Raça/Cor",                type: "select", valor: f.raca_cor || "", options: [{value:"",label:"—"},{value:"Branca",label:"Branca"},{value:"Preta",label:"Preta"},{value:"Parda",label:"Parda"},{value:"Amarela",label:"Amarela"},{value:"Indígena",label:"Indígena"},{value:"Não informado",label:"Não informado"}] },
      { group: "Identidade complementar", name: "deficiencia",   label: "Deficiência (PcD)",       type: "text",   valor: f.deficiencia },
      { group: "Identidade complementar", name: "foto_url",      label: "URL da foto (rede ou link)", type: "text", valor: f.foto_url },

      // ===== Contato de emergência (novo)
      { group: "Contato de emergência",   name: "contato_emergencia_nome",        label: "Nome",        type: "text", valor: f.contato_emergencia_nome },
      { group: "Contato de emergência",   name: "contato_emergencia_parentesco",  label: "Parentesco",  type: "text", valor: f.contato_emergencia_parentesco },
      { group: "Contato de emergência",   name: "contato_emergencia_telefone",   label: "Telefone",    type: "text", valor: f.contato_emergencia_telefone },

      // ===== Vínculos legais adicionais
      { group: "Documentos",     name: "matricula_fgts",       label: "Matrícula FGTS (GFD)",                  type: "text",   valor: f.matricula_fgts },

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
        cargo_id:        v.cargo_id        ? Number(v.cargo_id)        : null,
        matricula_fgts: v.matricula_fgts, foto_url: v.foto_url,
        escolaridade: v.escolaridade, estado_civil: v.estado_civil,
        nacionalidade: v.nacionalidade, naturalidade: v.naturalidade,
        nome_mae: v.nome_mae, nome_pai: v.nome_pai,
        sexo: v.sexo, raca_cor: v.raca_cor, deficiencia: v.deficiencia,
        contato_emergencia_nome: v.contato_emergencia_nome,
        contato_emergencia_parentesco: v.contato_emergencia_parentesco,
        contato_emergencia_telefone: v.contato_emergencia_telefone,
        status: v.status, cargo: (v.cargo_id ? (function(){ var cg=(cargosLista||[]).find(function(c){return c.id===Number(v.cargo_id);}); return cg ? cg.nome : null; })() : null), cbo: v.cbo,
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

      // Onda E (item 8b): bloquear duplicidade de CPF ATIVO
      function prosseguir() {
        var q = editar
          ? client.from("funcionarios").update(payload).eq("id", f.id)
          : client.from("funcionarios").insert(payload);
        q.then(function (r) {
          if (r.error) { done(r.error.message); return; }
          funcionariosCarregado = false;
          try { folhaCustoCarregado = false; } catch (e) {}
          try { bonCarregado = false; } catch (e) {}
          carregarFuncionariosSeNecessario();
          done(null);
        });
      }
      var cpfLimpo = (v.cpf || "").replace(/\D/g, "");
      if (cpfLimpo.length >= 11) {
        // Procurar outro registro com mesmo CPF (excluindo o próprio em edição)
        var qDup = client.from("funcionarios").select("id, nome, status").eq("cpf", v.cpf);
        if (editar) qDup = qDup.neq("id", f.id);
        qDup.then(function (rd) {
          if (rd.error) { /* falha silenciosa: prossegue assumindo ok */ prosseguir(); return; }
          var existentes = rd.data || [];
          if (!existentes.length) { prosseguir(); return; }
          var ativos = existentes.filter(function (x) { return x.status === "ATIVO"; });
          if (ativos.length) {
            done("CPF já cadastrado para o funcionário ATIVO \"" + ativos[0].nome + "\". Inative o cadastro anterior antes de criar um novo, ou edite o existente.");
            return;
          }
          // Existe inativo — permitir mas avisar
          if (!confirm("Existe um cadastro INATIVO com este CPF (" + existentes[0].nome + "). Continuar mesmo assim?")) {
            done("Operação cancelada.");
            return;
          }
          prosseguir();
        });
      } else {
        prosseguir();
      }
      return; // Importante: o callback antigo abaixo é morto pra evitar duplo-save
      // -- ANCORA: codigo antigo neutralizado, fluxo passa por prosseguir() acima --
      /*
      q.then(function (r) {
        if (r.error) { done(r.error.message); return; }
        funcionariosCarregado = false;
        folhaCustoCarregado = false;
        bonCarregado = false;
        carregarFuncionariosSeNecessario();
        done(null);
      });
      */
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
      '<td><button class="btn-limpar" data-bn-edit="' + b.id + '">Editar</button> <button class="btn-limpar" data-bn-del="' + b.id + '" title="Excluir">🗑 Excluir</button></td>' +
    '</tr>';
  }), 7, "Nenhum benefício cadastrado.");

  tbody.querySelectorAll("[data-bn-edit]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-bn-edit"));
      var b = beneficiosLista.find(function (x) { return x.id === id; });
      if (b) abrirModalBeneficio(b);
    });
  });
  tbody.querySelectorAll("[data-bn-del]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var id = btn.getAttribute("data-bn-del");
      var rid = isNaN(Number(id)) ? id : Number(id);
      if (!confirm("Excluir este registro? Essa ação não pode ser desfeita.")) return;
      client.from("beneficios").delete().eq("id", rid).then(function (r) {
        if (r.error) { try { toast("Erro ao excluir: " + r.error.message, "erro"); } catch (e) { alert("Erro ao excluir: " + r.error.message); } return; }
        try { toast("Excluído.", "ok"); } catch (e) {}
        if (typeof carregarBeneficiosSeNecessario === "function") carregarBeneficiosSeNecessario();
      });
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
      '<td><button class="btn-limpar" data-fl-edit="' + p.id + '">Editar</button> <button class="btn-limpar" data-fl-del="' + p.id + '" title="Excluir">🗑 Excluir</button></td>' +
    '</tr>';
  }), 8, "Nenhuma folha lançada.");

  tbody.querySelectorAll("[data-fl-edit]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-fl-edit"));
      var p = folhaLista.find(function (x) { return x.id === id; });
      if (p) abrirModalFolha(p);
    });
  });
  tbody.querySelectorAll("[data-fl-del]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var id = btn.getAttribute("data-fl-del");
      var rid = isNaN(Number(id)) ? id : Number(id);
      if (!confirm("Excluir este registro? Essa ação não pode ser desfeita.")) return;
      client.from("folha_pagamento").delete().eq("id", rid).then(function (r) {
        if (r.error) { try { toast("Erro ao excluir: " + r.error.message, "erro"); } catch (e) { alert("Erro ao excluir: " + r.error.message); } return; }
        try { toast("Excluído.", "ok"); } catch (e) {}
        if (typeof carregarFolhaSeNecessario === "function") carregarFolhaSeNecessario();
      });
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
      '<td><button class="btn-limpar" data-ir-edit="' + i.id + '">Editar</button> <button class="btn-limpar" data-ir-del="' + i.id + '" title="Excluir">🗑 Excluir</button></td>' +
    '</tr>';
  }), 6, "Nenhum imposto lançado.");

  tbody.querySelectorAll("[data-ir-edit]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-ir-edit"));
      var i = impostosLista.find(function (x) { return x.id === id; });
      if (i) abrirModalImposto(i);
    });
  });
  tbody.querySelectorAll("[data-ir-del]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var id = btn.getAttribute("data-ir-del");
      var rid = isNaN(Number(id)) ? id : Number(id);
      if (!confirm("Excluir este registro? Essa ação não pode ser desfeita.")) return;
      client.from("impostos_rh").delete().eq("id", rid).then(function (r) {
        if (r.error) { try { toast("Erro ao excluir: " + r.error.message, "erro"); } catch (e) { alert("Erro ao excluir: " + r.error.message); } return; }
        try { toast("Excluído.", "ok"); } catch (e) {}
        if (typeof carregarImpostosSeNecessario === "function") carregarImpostosSeNecessario();
      });
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
  client.from("organograma").select("id, parent_id, posicao, profissional, funcionario_id, status_oficializacao, oficializado_em, oficializado_por, grupo, ordem")
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
      // Verifica permissao de oficializacao em paralelo (renderiza com botoes corretos)
      checarPermissaoOficializarOrg(function () {
        renderOrganograma();
      });
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

  // Selects de funcionarios + botoes Oficializar
  tree.querySelectorAll(".org-prof-select").forEach(function (sel) {
    sel.addEventListener("change", function () { salvarFuncionarioNoOrganograma(sel); });
    sel.addEventListener("click", function (ev) { ev.stopPropagation(); });
  });
  tree.querySelectorAll(".org-oficializar-btn").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      oficializarPosicaoOrg(Number(btn.dataset.orgId));
    });
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
  if (no.status_oficializacao === "pendente" && (no.funcionario_id || no.profissional)) {
    card.classList.add("org-pendente");
    card.title = "Vinculacao pendente de oficializacao pelo Analista de RH Generalista";
  } else if (no.status_oficializacao === "oficializado" && (no.funcionario_id || no.profissional)) {
    card.classList.add("org-oficializado");
  }
  card.dataset.id = no.id;

  var pos = document.createElement("div");
  pos.className = "org-pos";
  pos.textContent = no.posicao;
  card.appendChild(pos);

  // Dropdown de funcionarios ativos
  var sel = document.createElement("select");
  sel.className = "org-prof-select";
  sel.dataset.id = String(no.id);
  sel.dataset.original = String(no.funcionario_id || "");
  var opts = ['<option value="">+ atribuir</option>'];
  (funcionariosLista || []).filter(function (f) { return !f.data_demissao; })
    .sort(function (a, b) { return (a.nome || "").localeCompare(b.nome || ""); })
    .forEach(function (f) {
      var selStr = String(f.id) === String(no.funcionario_id || "") ? " selected" : "";
      opts.push('<option value="' + f.id + '"' + selStr + '>' + escHtml(f.nome) + '</option>');
    });
  sel.innerHTML = opts.join("");
  // Fallback: se nao houver funcionario_id mas tem texto antigo "profissional", mostra como label
  if (!no.funcionario_id && no.profissional) {
    var optLegacy = document.createElement("option");
    optLegacy.value = "__legacy__";
    optLegacy.textContent = no.profissional + " (legado)";
    optLegacy.selected = true;
    sel.appendChild(optLegacy);
  }
  card.appendChild(sel);

  // Badge de status (Pendente / Oficializado)
  if (no.funcionario_id || no.profissional) {
    var badge = document.createElement("div");
    badge.className = "org-status-badge";
    if (no.status_oficializacao === "oficializado") {
      badge.textContent = "OFICIALIZADO";
      badge.style.cssText = "font-size:9px;color:#1B5E20;background:#C8E6C9;padding:2px 6px;border-radius:8px;margin-top:4px;display:inline-block;font-weight:700";
    } else {
      badge.textContent = "PENDENTE";
      badge.style.cssText = "font-size:9px;color:#856404;background:#FFF3CD;padding:2px 6px;border-radius:8px;margin-top:4px;display:inline-block;font-weight:700";
    }
    card.appendChild(badge);

    // Botao Oficializar - so para quem ocupa cargo Analista de RH Generalista
    if (no.status_oficializacao !== "oficializado" && window.usuarioPodeOficializarOrg === true) {
      var btnOf = document.createElement("button");
      btnOf.type = "button";
      btnOf.className = "org-oficializar-btn";
      btnOf.textContent = "Oficializar";
      btnOf.title = "Marcar como oficial (so quem ocupa cargo Analista de RH Generalista)";
      btnOf.style.cssText = "font-size:10px;padding:2px 8px;margin-top:4px;background:#C8B79B;color:#4A2F1A;border:none;border-radius:4px;cursor:pointer;font-weight:700";
      btnOf.dataset.orgId = String(no.id);
      card.appendChild(btnOf);
    }
  }

  var filhos = orgPorPai[no.id] || [];
  if (filhos.length) {
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "org-toggle";
    toggle.textContent = "-";
    toggle.title = "Recolher / expandir";
    card.appendChild(toggle);
  }

  div.appendChild(card);

  if (filhos.length) {
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
  // Mantido por retrocompatibilidade - chama salvarFuncionarioNoOrganograma
  return salvarFuncionarioNoOrganograma(input);
}

function salvarFuncionarioNoOrganograma(sel) {
  var novoId = sel.value;
  if (novoId === "__legacy__") return;
  var antigoId = sel.dataset.original || "";
  if (String(novoId) === String(antigoId)) return;
  var orgId = Number(sel.dataset.id);
  sel.disabled = true;

  var fid = novoId ? Number(novoId) : null;
  var func = fid ? (funcionariosLista || []).find(function (x) { return x.id === fid; }) : null;
  var profNome = func ? func.nome : null;

  // Atribuicao volta pra "pendente" (precisa nova oficializacao do RH Generalista)
  var payload = {
    funcionario_id: fid,
    profissional: profNome,
    status_oficializacao: fid ? "pendente" : "pendente",
    oficializado_em: null,
    oficializado_por: null
  };

  client.from("organograma").update(payload).eq("id", orgId).then(function (r) {
    sel.disabled = false;
    if (r.error) {
      alert("Erro ao salvar: " + r.error.message);
      sel.value = antigoId;
      return;
    }
    sel.dataset.original = String(fid || "");
    var item = orgLista.find(function (n) { return n.id === orgId; });
    if (item) {
      item.funcionario_id = fid;
      item.profissional = profNome;
      item.status_oficializacao = "pendente";
      item.oficializado_em = null;
    }
    try { toast(fid ? "Vinculacao registrada como Pendente. Aguarde oficializacao do RH." : "Posicao desvinculada.", "ok"); } catch (e) {}
    renderOrganograma();
  });
}

// Verifica se o usuario logado ocupa o cargo "Analista de RH Generalista"
// (id=2). Define window.usuarioPodeOficializarOrg.
function checarPermissaoOficializarOrg(cb) {
  window.usuarioPodeOficializarOrg = false;
  try {
    var session = window.userSession || null;
    var userId = (session && session.user && session.user.id) || null;
    if (!userId) { if (cb) cb(); return; }
    // Busca perfil
    client.from("perfis").select("perfil").eq("id", userId).single().then(function (rp) {
      var ehMaster = rp && rp.data && rp.data.perfil === "master";
      // Tambem libera se ocupa o cargo Analista de RH Generalista (id=2)
      // Buscar funcionarios.id pelo email do usuario auth?
      // Simples: master sempre pode + qualquer um que esteja vinculado a uma posicao
      // do organograma cujo cargo seja "ANALISTA DE RH GENERALISTA"
      // Como nao temos email->funcionario direto, libera por perfil master
      // E por convencao: usuarios cujo email comece com juliana ou natalia
      if (ehMaster) { window.usuarioPodeOficializarOrg = true; if (cb) cb(); return; }
      // Tenta vincular via funcionarios -> cargos
      var email = session && session.user && session.user.email;
      if (!email) { if (cb) cb(); return; }
      client.from("funcionarios").select("id, cargo_id, email")
        .eq("email", email).maybeSingle().then(function (rf) {
          if (rf && rf.data && rf.data.cargo_id) {
            // Cargo id=2 = ANALISTA DE RH GENERALISTA (cadastrado)
            // Tambem verifica pelo nome (defensivo)
            var cg = (cargosLista || []).find(function (c) { return c.id === rf.data.cargo_id; });
            if (cg && (cg.id === 2 || /analista.*rh.*generalista/i.test(cg.nome || ""))) {
              window.usuarioPodeOficializarOrg = true;
            }
          }
          if (cb) cb();
        });
    });
  } catch (e) { if (cb) cb(); }
}

function oficializarPosicaoOrg(orgId) {
  if (!window.usuarioPodeOficializarOrg) {
    alert("Apenas quem ocupa o cargo 'Analista de RH Generalista' (ou perfil Master) pode oficializar vinculacoes.");
    return;
  }
  var session = window.userSession || null;
  var userId = (session && session.user && session.user.id) || null;
  if (!confirm("Confirmar oficializacao desta posicao no organograma?")) return;

  client.from("organograma").update({
    status_oficializacao: "oficializado",
    oficializado_em: new Date().toISOString(),
    oficializado_por: userId
  }).eq("id", orgId).then(function (r) {
    if (r.error) {
      alert("Erro: " + r.error.message);
      return;
    }
    try { toast("Posicao oficializada.", "ok"); } catch (e) {}
    var item = orgLista.find(function (n) { return n.id === orgId; });
    if (item) {
      item.status_oficializacao = "oficializado";
      item.oficializado_em = new Date().toISOString();
      item.oficializado_por = userId;
    }
    renderOrganograma();
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
  var tree0 = document.getElementById("org-tree");
  if (!tree0 || !orgLista || !orgLista.length || tree0.querySelector(".tbl-vazio")) {
    setStatusOrg("Organograma ainda carregando. Aguarde a arvore aparecer e tente novamente.", "alerta");
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

  setStatusOrg("Gerando PDF - pode levar alguns segundos...", "carregando");

  setColapsoOrganograma(false);

  // Esconde o status e os controles de UI durante a captura
  var statusEl = document.getElementById("org-status");
  var statusPrevDisplay = statusEl ? statusEl.style.display : "";
  if (statusEl) statusEl.style.display = "none";

  // Esconde os botoes "Oficializar" e os selects (apenas visualmente, sem mudar layout)
  var tree = document.getElementById("org-tree");
  var hideEls = tree.querySelectorAll(".org-oficializar-btn, .org-toggle");
  hideEls.forEach(function (el) { el.dataset.prevVis = el.style.visibility; el.style.visibility = "hidden"; });

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
      // Restaura UI escondida
      if (statusEl) statusEl.style.display = statusPrevDisplay;
      hideEls.forEach(function (el) { el.style.visibility = el.dataset.prevVis || ""; });
      setStatusOrg("PDF gerado: " + nome, "ok");
      setTimeout(function () { setStatusOrg(null); }, 5000);
    }).catch(function (e) {
      if (statusEl) statusEl.style.display = statusPrevDisplay;
      hideEls.forEach(function (el) { el.style.visibility = el.dataset.prevVis || ""; });
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

// =========================================================================
// ONDA A — CARGOS (descritivo), DEPENDENTES, FICHA FUNCIONAL PDF
// Adicionado em 2026-05-19. Pacote único da Onda A.
// =========================================================================

function carregarCargosSeNecessario(cb) {
  if (cargosCarregado) { if (cb) cb(); return; }
  client.from("cargos").select("*").order("nome", { ascending: true }).then(function (r) {
    if (r.error) {
      var tb = document.getElementById("cg-tbody");
      if (tb) tb.innerHTML = '<tr><td colspan="6" class="tbl-vazio erro">Erro: ' + escHtml(r.error.message) + '</td></tr>';
      return;
    }
    cargosLista = r.data || [];
    cargosCarregado = true;
    popularSelectCargosDep();
    if (document.querySelector('[data-page="rh_cargos"]:not([hidden])')) renderCargos();
    if (cb) cb();
  });
}

function getCargoById(id) {
  if (!id) return null;
  return (cargosLista || []).find(function (c) { return c.id === Number(id); });
}

function buildCargoSuperiorChain(cargoId) {
  var nomes = [];
  var visitados = {};
  var atual = getCargoById(cargoId);
  var n = 0;
  while (atual && !visitados[atual.id] && n < 4) {
    nomes.push(atual.nome);
    visitados[atual.id] = true;
    atual = atual.superior_id ? getCargoById(atual.superior_id) : null;
    n++;
  }
  return nomes.join(" > ");
}

function popularSelectCargosDep() {
  var selDep = document.getElementById("cg-dep");
  if (!selDep) return;
  var deps = {};
  (cargosLista || []).forEach(function (c) { if (c.departamento) deps[c.departamento] = true; });
  var ks = Object.keys(deps).sort();
  var atual = selDep.value;
  selDep.innerHTML = '<option value="">Todos os departamentos</option>' +
    ks.map(function (k) { return '<option value="' + escHtml(k) + '">' + escHtml(k) + '</option>'; }).join("");
  if (atual && ks.indexOf(atual) !== -1) selDep.value = atual;
}

function renderCargos() {
  var tbody = document.getElementById("cg-tbody");
  if (!tbody) return;
  var busca  = (document.getElementById("cg-busca").value || "").trim().toLowerCase();
  var status = document.getElementById("cg-status").value;
  var dep    = document.getElementById("cg-dep").value;

  var contagemPorCargo = {};
  (funcionariosLista || []).forEach(function (f) {
    if (f.cargo_id) contagemPorCargo[f.cargo_id] = (contagemPorCargo[f.cargo_id] || 0) + 1;
  });

  var filtrados = (cargosLista || []).filter(function (c) {
    if (status === "ativos" && !c.ativo) return false;
    if (status === "inativos" && c.ativo) return false;
    if (status === "rascunho" && c.status_publicacao !== "rascunho") return false;
    if (status === "publicado" && c.status_publicacao !== "publicado") return false;
    if (dep && (c.departamento || "") !== dep) return false;
    return matchBusca(busca, [c.nome, c.departamento]);
  });

  var ativos = (cargosLista || []).filter(function (c) { return c.ativo; });
  var vinculados = Object.keys(contagemPorCargo).length;
  valText(document.getElementById("cg-m-tot"), fmtInt((cargosLista || []).length));
  valText(document.getElementById("cg-m-ativos"), fmtInt(ativos.length));
  valText(document.getElementById("cg-m-vinc"), fmtInt(vinculados));
  valText(document.getElementById("cg-lbl"), filtrados.length + " de " + (cargosLista || []).length);

  preencherTbody(tbody, filtrados.map(function (c) {
    var sup = c.superior_id ? getCargoById(c.superior_id) : null;
    var qtd = contagemPorCargo[c.id] || 0;
    var badgePub = c.status_publicacao === "publicado"
      ? '<span class="badge-tipo solta" title="Cargo publicado — visivel em dropdowns">PUBLICADO</span>'
      : '<span class="badge-tipo" style="background:#FFF3CD;color:#856404;border:1px solid #FFEAA7" title="Rascunho — nao aparece em dropdowns de Funcionario/Organograma">RASCUNHO</span>';
    var badgeGestao = c.eh_gestao
      ? ' <span class="badge-tipo" style="background:#E8DDD3;color:#4A2F1A;font-size:10px" title="Cargo de gestao">GESTAO</span>'
      : '';
    return '<tr style="cursor:pointer" data-cg-row="' + c.id + '">' +
      '<td><strong>' + escHtml(c.nome) + '</strong>' + badgeGestao + '</td>' +
      '<td>' + escHtml(c.departamento || "-") + '</td>' +
      '<td>' + escHtml(sup ? sup.nome : "-") + '</td>' +
      '<td class="num">' + fmtInt(qtd) + '</td>' +
      '<td>' + badgePub + ' ' + (c.ativo ? '' : '<span class="badge-tipo">inativo</span>') + '</td>' +
      '<td>' +
        '<button class="btn-limpar" data-cg-edit="' + c.id + '">Editar</button> ' +
        '<button class="btn-limpar" data-cg-pdf="' + c.id + '" title="Baixar ficha do cargo (PDF de ciencia)">Ficha PDF</button> ' +
        '<button class="btn-limpar" data-cg-del="' + c.id + '" title="Excluir">Excluir</button>' +
      '</td>' +
    '</tr>';
  }), 6);

  tbody.querySelectorAll("[data-cg-row]").forEach(function (tr) {
    tr.addEventListener("click", function (ev) {
      if (ev.target.closest("button")) return;
      var id = Number(tr.getAttribute("data-cg-row"));
      var c = (cargosLista || []).find(function (x) { return x.id === id; });
      if (c) abrirModalCargo(c);
    });
  });
  tbody.querySelectorAll("[data-cg-edit]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var id = Number(btn.getAttribute("data-cg-edit"));
      var c = (cargosLista || []).find(function (x) { return x.id === id; });
      if (c) abrirModalCargo(c);
    });
  });
  tbody.querySelectorAll("[data-cg-pdf]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var id = Number(btn.getAttribute("data-cg-pdf"));
      var c = (cargosLista || []).find(function (x) { return x.id === id; });
      if (c) gerarFichaCargoPdf(c);
    });
  });
  tbody.querySelectorAll("[data-cg-del]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var id = Number(btn.getAttribute("data-cg-del"));
      var c = (cargosLista || []).find(function (x) { return x.id === id; });
      var qtd = contagemPorCargo[id] || 0;
      if (qtd > 0) {
        alert("Nao e possivel excluir: " + qtd + " funcionario(s) ainda usam esse cargo. Reatribua antes ou inative o cargo.");
        return;
      }
      if (!confirm("Excluir o cargo \"" + (c ? c.nome : "") + "\"? Essa acao nao pode ser desfeita.")) return;
      client.from("cargos").delete().eq("id", id).then(function (r) {
        if (r.error) { try { toast("Erro: " + r.error.message, "erro"); } catch (e) { alert(r.error.message); } return; }
        try { toast("Cargo excluido.", "ok"); } catch (e) {}
        cargosCarregado = false;
        carregarCargosSeNecessario();
      });
    });
  });
  try { setupTopScrollFor(document.querySelector('[data-page="rh_cargos"] .table-wrap-x')); } catch (e) {}
}

// Lista cargos que apontam pra cargoId como superior (subordinados diretos)
function getSubordinadosDe(cargoId) {
  if (!cargoId) return [];
  return (cargosLista || []).filter(function (c) {
    return c.superior_id === cargoId && c.id !== cargoId;
  });
}

function abrirModalCargo(c) {
  c = c || {};
  var editar = !!c.id;
  var ehRascunho = !c.status_publicacao || c.status_publicacao === "rascunho";

  var opcSuperior = [{ value: "", label: "- (sem superior)" }].concat(
    (cargosLista || []).filter(function (x) { return x.id !== c.id && x.ativo; })
      .sort(function (a, b) { return (a.nome || "").localeCompare(b.nome || ""); })
      .map(function (x) { return { value: x.id, label: x.nome + (x.departamento ? " - " + x.departamento : "") }; })
  );

  var subordinadosAtuais = c.id ? getSubordinadosDe(c.id).map(function (x) { return String(x.id); }) : [];
  var opcSub = (cargosLista || []).filter(function (x) { return x.id !== c.id && x.ativo; })
    .sort(function (a, b) { return (a.nome || "").localeCompare(b.nome || ""); })
    .map(function (x) {
      return {
        value: String(x.id),
        label: x.nome + (x.departamento ? " - " + x.departamento : ""),
        checked: subordinadosAtuais.indexOf(String(x.id)) !== -1
      };
    });

  abrirModal({
    titulo: editar ? "Editar cargo" : "Novo cargo",
    fields: [
      { group: "Identificacao", name: "nome",           label: "Titulo do cargo",            type: "text", valor: c.nome, required: true },
      { group: "Identificacao", name: "departamento",   label: "Departamento",               type: "text", valor: c.departamento },
      { group: "Identificacao", name: "superior_id",    label: "Cargo do superior imediato", type: "select", valor: c.superior_id || "", options: opcSuperior },
      { group: "Identificacao", name: "eh_gestao",      label: "E cargo de gestao?",         type: "select", valor: c.eh_gestao ? "1" : "0", options: [{value:"0",label:"Nao"},{value:"1",label:"Sim - exige ao menos 1 subordinado para publicar"}] },
      { group: "Identificacao", name: "ativo",          label: "Status (Ativo/Inativo)",     type: "select", valor: c.ativo === false ? "0" : "1", options: [{value:"1",label:"Ativo"},{value:"0",label:"Inativo"}] },

      { group: "Subordinados",  name: "subordinados",   label: "Cargos subordinados (multipla selecao)", type: "multiselect", valor: subordinadosAtuais, options: opcSub },

      { group: "Descritivo",    name: "missao",            label: "Missao do cargo",                 type: "textarea", valor: c.missao },
      { group: "Descritivo",    name: "responsabilidades", label: "Principais responsabilidades",    type: "textarea", valor: c.responsabilidades },

      { group: "Competencias Tecnicas",       name: "comp_tec_conhecimentos", label: "Conhecimentos (escolaridade e conhecimentos especificos)", type: "textarea", valor: c.comp_tec_conhecimentos || c.competencias || "" },
      { group: "Competencias Tecnicas",       name: "comp_tec_habilidades",   label: "Habilidades (experiencias praticas necessarias)",           type: "textarea", valor: c.comp_tec_habilidades || "" },

      { group: "Competencias Comportamentais", name: "comp_comp_competencias", label: "Competencias (organizacao, comprometimento, etc.)", type: "textarea", valor: c.comp_comp_competencias || "" },
      { group: "Competencias Comportamentais", name: "comp_comp_atitudes",     label: "Atitudes esperadas (postura, comportamento)",       type: "textarea", valor: c.comp_comp_atitudes || "" },

      { group: "Outros", name: "consideracoes", label: "Consideracoes importantes (opcional)", type: "textarea", valor: c.consideracoes }
    ],
    extraButtons: [
      {
        id: "btn-publicar",
        label: ehRascunho ? "Publicar (ativa em dropdowns)" : "Atualizar e manter publicado",
        cssClass: "btn-ouro",
        action: "publicar"
      }
    ],
    onSubmit: function (v, done, action) {
      var querPublicar = action === "publicar";

      var subSel = Array.isArray(v.subordinados) ? v.subordinados : (v.subordinados ? [v.subordinados] : []);
      subSel = subSel.map(function (s) { return Number(s); }).filter(function (n) { return !!n; });

      if (querPublicar) {
        var faltam = [];
        if (!v.nome) faltam.push("Titulo");
        if (!v.departamento) faltam.push("Departamento");
        if (!v.superior_id) faltam.push("Superior imediato");
        if (!v.missao) faltam.push("Missao");
        if (!v.responsabilidades) faltam.push("Responsabilidades");
        if (!v.comp_tec_conhecimentos) faltam.push("Comp. Tecnicas - Conhecimentos");
        if (!v.comp_tec_habilidades) faltam.push("Comp. Tecnicas - Habilidades");
        if (!v.comp_comp_competencias) faltam.push("Comp. Comportamentais - Competencias");
        if (!v.comp_comp_atitudes) faltam.push("Comp. Comportamentais - Atitudes");
        var ehGestao = v.eh_gestao === "1" || v.eh_gestao === 1 || v.eh_gestao === true;
        if (ehGestao && subSel.length === 0) faltam.push("Ao menos 1 Subordinado (cargo de gestao)");
        if (faltam.length) {
          done("Para publicar, preencha: " + faltam.join(", ") + ". (Voce pode salvar como rascunho mesmo incompleto.)");
          return;
        }
      }

      var payload = {
        nome: v.nome,
        departamento: v.departamento || null,
        superior_id: v.superior_id ? Number(v.superior_id) : null,
        eh_gestao: v.eh_gestao === "1" || v.eh_gestao === 1 || v.eh_gestao === true,
        ativo: v.ativo === "1" || v.ativo === 1 || v.ativo === true,
        missao: v.missao || null,
        responsabilidades: v.responsabilidades || null,
        comp_tec_conhecimentos: v.comp_tec_conhecimentos || null,
        comp_tec_habilidades: v.comp_tec_habilidades || null,
        comp_comp_competencias: v.comp_comp_competencias || null,
        comp_comp_atitudes: v.comp_comp_atitudes || null,
        consideracoes: v.consideracoes || null,
        status_publicacao: querPublicar ? "publicado" : (ehRascunho ? "rascunho" : (c.status_publicacao || "rascunho"))
      };

      var q = editar
        ? client.from("cargos").update(payload).eq("id", c.id).select()
        : client.from("cargos").insert(payload).select();

      q.then(function (r) {
        if (r.error) { done(r.error.message); return; }

        var novoCargoId = editar ? c.id : (r.data && r.data[0] && r.data[0].id);
        if (!novoCargoId) { afterSave(); return; }

        var subAntes = editar ? subordinadosAtuais.map(function (s) { return Number(s); }) : [];
        var paraAdicionar = subSel.filter(function (s) { return subAntes.indexOf(s) === -1; });
        var paraRemover   = subAntes.filter(function (s) { return subSel.indexOf(s) === -1; });

        var ops = [];
        if (paraAdicionar.length) {
          ops.push(client.from("cargos").update({ superior_id: novoCargoId }).in("id", paraAdicionar));
        }
        if (paraRemover.length) {
          ops.push(client.from("cargos").update({ superior_id: null }).in("id", paraRemover));
        }

        if (!ops.length) { afterSave(); return; }
        Promise.all(ops.map(function (p) { return p; })).then(afterSave).catch(afterSave);

        function afterSave() {
          cargosCarregado = false;
          funcionariosCarregado = false;
          carregarCargosSeNecessario(function () {
            if (document.querySelector('[data-page="rh_cargos"]:not([hidden])')) renderCargos();
          });
          try { toast(querPublicar ? "Cargo publicado." : "Cargo salvo como rascunho.", "ok"); } catch (e) {}
          done(null);
        }
      });
    }
  });
}

// =========================================================================
// PDF - Ficha de Cargo (documento de ciencia com assinatura)
// =========================================================================
function gerarFichaCargoPdf(c) {
  if (!c) return;
  var jspdfNS = window.jspdf || window.jsPDF;
  if (!jspdfNS) { alert("jsPDF nao carregado."); return; }
  var jsPDF = jspdfNS.jsPDF || jspdfNS;

  try {
    var doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    var pageW = 210, pageH = 297;
    var margin = 18;
    var maxW = pageW - 2 * margin;
    var y = margin;

    var marrom_esc = [74, 47, 26];
    var marrom_med = [122, 87, 64];
    var marrom_cl  = [232, 221, 211];
    var creme      = [253, 250, 246];

    function setFontTerra(estilo, tamanho) {
      doc.setFont("times", estilo || "normal");
      doc.setFontSize(tamanho || 11);
    }

    function novaPaginaSeNecessario(h) {
      if (y + h > pageH - margin - 20) {
        doc.addPage();
        y = margin;
        desenharRodape();
      }
    }

    function desenharRodape() {
      doc.setFontSize(8);
      doc.setTextColor(marrom_med[0], marrom_med[1], marrom_med[2]);
      doc.text("Terra Conttemporanea - Marcenaria de alto padrao | Documento de ciencia do cargo", pageW / 2, pageH - 8, { align: "center" });
      doc.text("Gerado em " + new Date().toLocaleDateString("pt-BR") + " | Pag. " + doc.internal.getCurrentPageInfo().pageNumber, pageW / 2, pageH - 4, { align: "center" });
    }

    doc.setFillColor(creme[0], creme[1], creme[2]);
    doc.rect(0, 0, pageW, 32, "F");

    try {
      var img = document.querySelector('img[src*="logo-terra"]');
      if (img && img.complete && img.naturalWidth) {
        var canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        var dataUrl = canvas.toDataURL("image/png");
        doc.addImage(dataUrl, "PNG", margin, 6, 20, 20);
      }
    } catch (e) {}

    setFontTerra("bold", 16);
    doc.setTextColor(marrom_esc[0], marrom_esc[1], marrom_esc[2]);
    doc.text("FICHA DESCRITIVA DO CARGO", margin + 24, 14);

    setFontTerra("normal", 11);
    doc.setTextColor(marrom_med[0], marrom_med[1], marrom_med[2]);
    doc.text("Terra Conttemporanea - Marcenaria de alto padrao", margin + 24, 21);
    doc.text("Documento oficial de ciencia das responsabilidades", margin + 24, 26);

    y = 38;

    doc.setFillColor(marrom_cl[0], marrom_cl[1], marrom_cl[2]);
    doc.rect(margin, y, maxW, 12, "F");
    setFontTerra("bold", 14);
    doc.setTextColor(marrom_esc[0], marrom_esc[1], marrom_esc[2]);
    doc.text(String(c.nome || "").toUpperCase(), pageW / 2, y + 7.5, { align: "center" });
    y += 16;

    setFontTerra("normal", 10);
    doc.setTextColor(marrom_med[0], marrom_med[1], marrom_med[2]);
    if (c.departamento) {
      doc.text("Departamento: " + c.departamento, margin, y);
      y += 5;
    }
    var sup = c.superior_id ? getCargoById(c.superior_id) : null;
    if (sup) {
      doc.text("Superior imediato: " + sup.nome, margin, y);
      y += 5;
    }
    y += 4;

    function secao(titulo, texto) {
      if (!texto) return;
      var linhasNec = doc.splitTextToSize(String(texto), maxW - 4);
      var alturaSec = 7 + linhasNec.length * 4.5 + 3;
      novaPaginaSeNecessario(alturaSec);

      doc.setFillColor(marrom_esc[0], marrom_esc[1], marrom_esc[2]);
      doc.rect(margin, y, maxW, 6, "F");
      setFontTerra("bold", 11);
      doc.setTextColor(255, 255, 255);
      doc.text(titulo, margin + 2, y + 4.3);
      y += 8;

      setFontTerra("normal", 10);
      doc.setTextColor(40, 30, 20);
      doc.text(linhasNec, margin + 2, y);
      y += linhasNec.length * 4.5 + 4;
    }

    secao("MISSAO DO CARGO", c.missao);
    secao("PRINCIPAIS RESPONSABILIDADES", c.responsabilidades);

    if (c.comp_tec_conhecimentos || c.comp_tec_habilidades) {
      novaPaginaSeNecessario(40);
      doc.setFillColor(marrom_esc[0], marrom_esc[1], marrom_esc[2]);
      doc.rect(margin, y, maxW, 6, "F");
      setFontTerra("bold", 11);
      doc.setTextColor(255, 255, 255);
      doc.text("COMPETENCIAS TECNICAS", margin + 2, y + 4.3);
      y += 8;

      var colW = (maxW - 4) / 2;
      var conhText = doc.splitTextToSize(String(c.comp_tec_conhecimentos || "-"), colW - 2);
      var habText  = doc.splitTextToSize(String(c.comp_tec_habilidades || "-"), colW - 2);
      var maxLin = Math.max(conhText.length, habText.length);
      var alturaQuadro = 6 + maxLin * 4.5 + 3;
      novaPaginaSeNecessario(alturaQuadro);

      doc.setFillColor(marrom_cl[0], marrom_cl[1], marrom_cl[2]);
      doc.rect(margin, y, colW, 5, "F");
      doc.rect(margin + colW + 4, y, colW, 5, "F");
      setFontTerra("bold", 9);
      doc.setTextColor(marrom_esc[0], marrom_esc[1], marrom_esc[2]);
      doc.text("Conhecimentos", margin + 2, y + 3.5);
      doc.text("Habilidades", margin + colW + 6, y + 3.5);
      y += 6;

      setFontTerra("normal", 9.5);
      doc.setTextColor(40, 30, 20);
      doc.text(conhText, margin + 2, y);
      doc.text(habText, margin + colW + 6, y);
      y += maxLin * 4.5 + 4;
    }

    if (c.comp_comp_competencias || c.comp_comp_atitudes) {
      novaPaginaSeNecessario(40);
      doc.setFillColor(marrom_esc[0], marrom_esc[1], marrom_esc[2]);
      doc.rect(margin, y, maxW, 6, "F");
      setFontTerra("bold", 11);
      doc.setTextColor(255, 255, 255);
      doc.text("COMPETENCIAS COMPORTAMENTAIS", margin + 2, y + 4.3);
      y += 8;

      var colW2 = (maxW - 4) / 2;
      var compText = doc.splitTextToSize(String(c.comp_comp_competencias || "-"), colW2 - 2);
      var atiText  = doc.splitTextToSize(String(c.comp_comp_atitudes || "-"), colW2 - 2);
      var maxLin2 = Math.max(compText.length, atiText.length);
      var alturaQuadro2 = 6 + maxLin2 * 4.5 + 3;
      novaPaginaSeNecessario(alturaQuadro2);

      doc.setFillColor(marrom_cl[0], marrom_cl[1], marrom_cl[2]);
      doc.rect(margin, y, colW2, 5, "F");
      doc.rect(margin + colW2 + 4, y, colW2, 5, "F");
      setFontTerra("bold", 9);
      doc.setTextColor(marrom_esc[0], marrom_esc[1], marrom_esc[2]);
      doc.text("Competencias", margin + 2, y + 3.5);
      doc.text("Atitudes", margin + colW2 + 6, y + 3.5);
      y += 6;

      setFontTerra("normal", 9.5);
      doc.setTextColor(40, 30, 20);
      doc.text(compText, margin + 2, y);
      doc.text(atiText, margin + colW2 + 6, y);
      y += maxLin2 * 4.5 + 4;
    }

    secao("CONSIDERACOES IMPORTANTES", c.consideracoes);

    novaPaginaSeNecessario(60);
    y += 10;
    setFontTerra("bold", 11);
    doc.setTextColor(marrom_esc[0], marrom_esc[1], marrom_esc[2]);
    doc.text("CIENCIA E ACEITE", margin, y);
    y += 6;
    setFontTerra("normal", 10);
    doc.setTextColor(40, 30, 20);
    var aviso = "Declaro, ao assinar este documento, ter recebido, lido e compreendido as responsabilidades e competencias descritas para o cargo acima, comprometendo-me a desempenha-las de acordo com os valores e padroes da Terra Conttemporanea.";
    var avisoLinhas = doc.splitTextToSize(aviso, maxW);
    doc.text(avisoLinhas, margin, y);
    y += avisoLinhas.length * 4.5 + 12;

    var colSig = (maxW - 10) / 2;
    setFontTerra("normal", 9);
    doc.setTextColor(marrom_med[0], marrom_med[1], marrom_med[2]);

    doc.line(margin, y, margin + colSig, y);
    doc.text("Profissional (nome completo)", margin, y + 4);
    doc.line(margin + colSig + 10, y, margin + colSig + 10 + colSig, y);
    doc.text("Pela empresa (Terra Conttemporanea)", margin + colSig + 10, y + 4);

    y += 14;
    doc.line(margin, y, margin + colSig / 2 - 5, y);
    doc.text("Assinatura", margin, y + 4);
    doc.line(margin + colSig / 2 + 5, y, margin + colSig, y);
    doc.text("Data ___/___/_____", margin + colSig / 2 + 5, y + 4);

    doc.line(margin + colSig + 10, y, margin + colSig + 10 + colSig / 2 - 5, y);
    doc.text("Assinatura", margin + colSig + 10, y + 4);
    doc.line(margin + colSig + 10 + colSig / 2 + 5, y, margin + colSig + 10 + colSig, y);
    doc.text("Data ___/___/_____", margin + colSig + 10 + colSig / 2 + 5, y + 4);

    desenharRodape();

    var nome = "ficha-cargo-" + String(c.nome || "cargo").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".pdf";
    doc.save(nome);
    try { toast("Ficha PDF gerada: " + nome, "ok"); } catch (e) {}
  } catch (e) {
    try { toast("Erro ao gerar PDF: " + e.message, "erro"); } catch (e2) { alert("Erro: " + e.message); }
  }
}

function abrirGerenciadorDependentes(f) {
  var titulo = "Dependentes — " + (f.nome || "");
  client.from("funcionarios_dependentes").select("*").eq("funcionario_id", f.id).order("nome", { ascending: true }).then(function (r) {
    var lista = (r && r.data) || [];
    funcionarioDependentesCache[f.id] = lista;
    var html = '<div style="margin-bottom:12px">';
    if (!lista.length) {
      html += '<div class="tbl-vazio">Nenhum dependente cadastrado.</div>';
    } else {
      html += '<table class="tabela"><thead><tr><th>Nome</th><th>Parentesco</th><th>Nascimento</th><th>CPF</th><th>IR</th><th>SF</th><th></th></tr></thead><tbody>';
      lista.forEach(function (d) {
        html += '<tr>' +
          '<td>' + escHtml(d.nome) + '</td>' +
          '<td>' + escHtml(d.parentesco || "—") + '</td>' +
          '<td>' + fmtData(d.data_nascimento) + '</td>' +
          '<td class="mono">' + escHtml(d.cpf || "—") + '</td>' +
          '<td>' + (d.dependente_ir ? "OK" : "—") + '</td>' +
          '<td>' + (d.dependente_sf ? "OK" : "—") + '</td>' +
          '<td><button class="btn-limpar" data-dep-del="' + d.id + '">🗑</button></td>' +
        '</tr>';
      });
      html += '</tbody></table>';
    }
    html += '</div>';

    abrirModal({
      titulo: titulo,
      fields: [
        { name: "_lista", label: "", type: "text", valor: "" }
      ],
      onSubmit: function (v, done) {
        if (!v.nome) { done(null); return; }
        var payload = {
          funcionario_id: f.id,
          nome: v.nome,
          parentesco: v.parentesco || null,
          data_nascimento: v.data_nascimento || null,
          cpf: v.cpf || null,
          dependente_ir: v.dependente_ir === "1",
          dependente_sf: v.dependente_sf === "1",
          observacoes: v.observacoes || null
        };
        client.from("funcionarios_dependentes").insert(payload).then(function (r2) {
          if (r2.error) { done(r2.error.message); return; }
          fecharModal();
          setTimeout(function () { abrirGerenciadorDependentes(f); }, 80);
        });
      }
    });

    setTimeout(function () {
      var fieldsEl = document.getElementById("modal-fields");
      if (!fieldsEl) return;
      fieldsEl.innerHTML =
        '<fieldset class="form-section"><legend>Lista atual</legend>' + html + '</fieldset>' +
        '<fieldset class="form-section"><legend>Adicionar novo dependente</legend>' +
          '<div class="form-field"><label for="mf-nome">Nome</label><input id="mf-nome" name="nome" type="text" /></div>' +
          '<div class="form-field"><label for="mf-parentesco">Parentesco</label>' +
            '<select id="mf-parentesco" name="parentesco">' +
              '<option value="">—</option>' +
              ['Conjuge','Companheiro(a)','Filho(a)','Enteado(a)','Pai','Mae','Irmao(a)','Tutelado(a)','Outro'].map(function(p){return '<option value="'+p+'">'+p+'</option>';}).join('') +
            '</select></div>' +
          '<div class="form-field"><label for="mf-data_nascimento">Data de nascimento</label><input id="mf-data_nascimento" name="data_nascimento" type="date" /></div>' +
          '<div class="form-field"><label for="mf-cpf">CPF</label><input id="mf-cpf" name="cpf" type="text" /></div>' +
          '<div class="form-field"><label for="mf-dependente_ir">Abate IR?</label><select id="mf-dependente_ir" name="dependente_ir"><option value="0">Nao</option><option value="1">Sim</option></select></div>' +
          '<div class="form-field"><label for="mf-dependente_sf">Salario-familia?</label><select id="mf-dependente_sf" name="dependente_sf"><option value="0">Nao</option><option value="1">Sim</option></select></div>' +
          '<div class="form-field form-field-wide"><label for="mf-observacoes">Observacoes</label><textarea id="mf-observacoes" name="observacoes" rows="2"></textarea></div>' +
        '</fieldset>';

      fieldsEl.querySelectorAll("[data-dep-del]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = Number(btn.getAttribute("data-dep-del"));
          if (!confirm("Excluir esse dependente?")) return;
          client.from("funcionarios_dependentes").delete().eq("id", id).then(function (r3) {
            if (r3.error) { alert("Erro: " + r3.error.message); return; }
            fecharModal();
            setTimeout(function () { abrirGerenciadorDependentes(f); }, 80);
          });
        });
      });
    }, 60);
  });
}

function gerarFichaFuncionarioPDF(f) {
  if (!f || !f.id) return;
  var jspdfNS = window.jspdf || window.jsPDF;
  if (!jspdfNS) { alert("Biblioteca de PDF nao carregada."); return; }
  var jsPDF = jspdfNS.jsPDF || jspdfNS;

  Promise.all([
    client.from("funcionarios_dependentes").select("*").eq("funcionario_id", f.id),
    client.from("beneficios").select("*").eq("funcionario_id", f.id).is("data_fim", null),
    client.from("medidas_disciplinares").select("*").eq("funcionario_id", f.id).order("data", { ascending: false }),
    client.from("avaliacao_desempenho").select("*").eq("funcionario_id", f.id).order("data_avaliacao", { ascending: false }),
    client.from("ferias").select("*").eq("funcionario_id", f.id).order("periodo_aquisitivo_inicio", { ascending: false }),
    client.from("ferias_parcelas").select("*").order("data_inicio", { ascending: true }),
    client.from("atestados").select("*").eq("funcionario_id", f.id).order("data_inicio", { ascending: false }),
    client.from("afastamentos").select("*").eq("funcionario_id", f.id).order("data_inicio", { ascending: false })
  ]).then(function (rs) {
    var deps  = (rs[0] && rs[0].data) || [];
    var bens  = (rs[1] && rs[1].data) || [];
    var meds  = (rs[2] && rs[2].data) || [];
    var avals = (rs[3] && rs[3].data) || [];
    var feriasF = (rs[4] && rs[4].data) || [];
    var parcelasAll = (rs[5] && rs[5].data) || [];
    var ats   = (rs[6] && rs[6].data) || [];
    var afs   = (rs[7] && rs[7].data) || [];
    var parcelasPorFerias = {};
    parcelasAll.forEach(function (p) { (parcelasPorFerias[p.ferias_id] = parcelasPorFerias[p.ferias_id] || []).push(p); });

    var doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    var pageW = 210, pageH = 297;
    var margin = 12;
    var y = margin;

    var marromEscuro = [78, 52, 34];
    var marromMedio  = [139, 102, 73];

    function escTxt(s) { return (s == null ? "" : String(s)); }
    function fmtBRLnum(v) { try { return fmtBRL(v); } catch (e) { return "R$ " + Number(v||0).toFixed(2); } }
    function fmtDataTxt(d) { try { return d ? fmtData(d) : "—"; } catch (e) { return d || "—"; } }
    function quebraPagina(neededMm) { if (y + neededMm > pageH - margin) { doc.addPage(); y = margin; } }

    function tituloSecao(txt) {
      quebraPagina(12);
      doc.setFillColor(marromMedio[0], marromMedio[1], marromMedio[2]);
      doc.rect(margin, y, pageW - 2 * margin, 6, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont("helvetica", "bold");
      doc.text(txt.toUpperCase(), margin + 2, y + 4.2);
      y += 8;
      doc.setTextColor(40, 40, 40); doc.setFont("helvetica", "normal");
    }

    function camposEm2Colunas(pares) {
      var colW = (pageW - 2 * margin - 4) / 2;
      var colX = [margin, margin + colW + 4];
      var col0Y = y, col1Y = y;
      pares.forEach(function (par, idx) {
        var col = idx % 2;
        var x = colX[col];
        var curY = (col === 0) ? col0Y : col1Y;
        doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(110, 80, 60);
        doc.text(par[0], x, curY);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(30, 30, 30);
        var v = escTxt(par[1]) || "—";
        var lines = doc.splitTextToSize(v, colW - 1);
        doc.text(lines, x, curY + 3.2);
        var nh = 3.2 + lines.length * 3.4 + 1;
        if (col === 0) col0Y = curY + nh; else col1Y = curY + nh;
      });
      y = Math.max(col0Y, col1Y) + 1;
    }

    doc.setFillColor(marromEscuro[0], marromEscuro[1], marromEscuro[2]);
    doc.rect(0, 0, pageW, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(15);
    doc.text("FICHA FUNCIONAL", margin, 11);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text("Terra Conttemporanea — Marcenaria de Alto Padrao", margin, 17);
    doc.setFontSize(8);
    doc.text("Emitida em " + new Date().toLocaleDateString("pt-BR"), pageW - margin, 11, { align: "right" });
    doc.text("Art. 41 CLT — uso interno e legal", pageW - margin, 17, { align: "right" });
    y = 30;

    doc.setTextColor(marromEscuro[0], marromEscuro[1], marromEscuro[2]);
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text(escTxt(f.nome).toUpperCase(), margin, y);
    y += 5;
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
    var cargoTxt = "";
    if (f.cargo_id) {
      var cg = getCargoById(f.cargo_id);
      cargoTxt = cg ? cg.nome + (cg.departamento ? " · " + cg.departamento : "") : "";
    }
    if (!cargoTxt) cargoTxt = f.cargo || "";
    var statusTxt = f.data_demissao ? "Desligado em " + fmtDataTxt(f.data_demissao) : (f.status || "Ativo");
    doc.text((cargoTxt || "—") + "  ·  " + statusTxt, margin, y);
    y += 6;

    tituloSecao("Dados pessoais");
    camposEm2Colunas([
      ["CPF", f.cpf], ["RG", f.rg],
      ["Data de nascimento", fmtDataTxt(f.data_nascimento)], ["Sexo", f.sexo],
      ["Estado civil", f.estado_civil], ["Escolaridade", f.escolaridade],
      ["Nacionalidade", f.nacionalidade], ["Naturalidade", f.naturalidade],
      ["Raca/Cor", f.raca_cor], ["Deficiencia (PcD)", f.deficiencia],
      ["Nome da mae", f.nome_mae], ["Nome do pai", f.nome_pai]
    ]);

    tituloSecao("Contato e endereco");
    camposEm2Colunas([
      ["Telefone", f.telefone], ["Telefone recado", f.telefone_recado],
      ["E-mail", f.email], ["CEP", f.cep],
      ["Endereco", f.endereco], ["Complemento", f.complemento],
      ["Bairro", f.bairro], ["Cidade", f.cidade]
    ]);

    if (f.contato_emergencia_nome || f.contato_emergencia_telefone) {
      tituloSecao("Contato de emergencia");
      camposEm2Colunas([
        ["Nome", f.contato_emergencia_nome], ["Parentesco", f.contato_emergencia_parentesco],
        ["Telefone", f.contato_emergencia_telefone], ["", ""]
      ]);
    }

    tituloSecao("Documentos");
    camposEm2Colunas([
      ["CTPS", f.ctps], ["Serie", f.serie],
      ["PIS/PASEP", f.pis], ["e-Social", f.e_social],
      ["Matricula FGTS", f.matricula_fgts], ["Livro", f.livro],
      ["CBO", f.cbo], ["Titulo de Eleitor", f.titulo_eleitor],
      ["CNH", f.cnh], ["Categoria CNH", f.cnh_categoria]
    ]);

    tituloSecao("Vinculo trabalhista");
    var cgFull = f.cargo_id ? getCargoById(f.cargo_id) : null;
    camposEm2Colunas([
      ["Cargo (descritivo)", cgFull ? cgFull.nome : (f.cargo || "—")],
      ["Departamento", cgFull ? (cgFull.departamento || "—") : "—"],
      ["Cadeia hierarquica", f.cargo_id ? buildCargoSuperiorChain(f.cargo_id) : "—"],
      ["Centro de custo (ID)", f.centro_custo_id || "—"],
      ["Data de admissao", fmtDataTxt(f.data_admissao)],
      ["Data de demissao", fmtDataTxt(f.data_demissao)],
      ["1a experiencia", fmtDataTxt(f.primeira_experiencia)],
      ["2a experiencia", fmtDataTxt(f.segunda_experiencia)],
      ["Data ASO", fmtDataTxt(f.data_aso)],
      ["Vencimento ASO", fmtDataTxt(f.vencimento_aso)],
      ["Salario base", fmtBRLnum(f.salario_base)],
      ["Integracao", f.integracao]
    ]);

    tituloSecao("Dados bancarios");
    camposEm2Colunas([
      ["Banco", f.banco], ["Agencia", f.agencia],
      ["Conta", f.conta], ["PIX", f.pix]
    ]);

    tituloSecao("Dependentes (" + deps.length + ")");
    if (!deps.length) {
      doc.setFontSize(9); doc.setTextColor(120, 120, 120);
      doc.text("Nenhum dependente cadastrado.", margin, y); y += 5;
    } else {
      deps.forEach(function (d) {
        quebraPagina(8);
        doc.setFontSize(9); doc.setTextColor(30, 30, 30); doc.setFont("helvetica", "bold");
        doc.text("• " + escTxt(d.nome), margin, y);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
        var detalhe = [
          d.parentesco || "—",
          d.data_nascimento ? "Nasc.: " + fmtDataTxt(d.data_nascimento) : null,
          d.cpf ? "CPF: " + d.cpf : null,
          d.dependente_ir ? "IR" : null,
          d.dependente_sf ? "Sal.-Familia" : null
        ].filter(Boolean).join(" · ");
        doc.text(detalhe, margin + 4, y + 3.5);
        y += 7;
      });
    }

    tituloSecao("Beneficios vigentes (" + bens.length + ")");
    if (!bens.length) {
      doc.setFontSize(9); doc.setTextColor(120, 120, 120);
      doc.text("Nenhum beneficio ativo.", margin, y); y += 5;
    } else {
      bens.forEach(function (b) {
        quebraPagina(7);
        doc.setFontSize(9); doc.setTextColor(30, 30, 30); doc.setFont("helvetica", "bold");
        doc.text("• " + escTxt(b.tipo), margin, y);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
        doc.text(escTxt(b.descricao || "") + "  ·  " + fmtBRLnum(b.valor) + (b.data_inicio ? " · desde " + fmtDataTxt(b.data_inicio) : ""), margin + 4, y + 3.5);
        y += 7;
      });
    }

    tituloSecao("Historico disciplinar (" + meds.length + ")");
    if (!meds.length) {
      doc.setFontSize(9); doc.setTextColor(120, 120, 120);
      doc.text("Sem registros.", margin, y); y += 5;
    } else {
      meds.forEach(function (m) {
        quebraPagina(8);
        doc.setFontSize(9); doc.setTextColor(30, 30, 30); doc.setFont("helvetica", "bold");
        doc.text(fmtDataTxt(m.data) + " — " + escTxt(m.tipo_medida || "—"), margin, y);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
        var det = [
          m.gravidade_infracao ? "Gravidade: " + m.gravidade_infracao : null,
          m.dias_suspensao ? m.dias_suspensao + " dias" : null,
          m.status_medida || null
        ].filter(Boolean).join(" · ");
        if (det) { doc.text(det, margin + 4, y + 3.5); y += 6.5; } else { y += 4; }
        if (m.descricao_infracao) {
          var lines = doc.splitTextToSize(escTxt(m.descricao_infracao), pageW - 2 * margin - 4);
          doc.text(lines, margin + 4, y); y += lines.length * 3.4 + 1;
        }
      });
    }

    tituloSecao("Avaliacoes de desempenho (" + avals.length + ")");
    if (!avals.length) {
      doc.setFontSize(9); doc.setTextColor(120, 120, 120);
      doc.text("Sem registros.", margin, y); y += 5;
    } else {
      avals.forEach(function (a) {
        quebraPagina(6);
        doc.setFontSize(9); doc.setTextColor(30, 30, 30); doc.setFont("helvetica", "bold");
        doc.text((a.data_avaliacao ? fmtDataTxt(a.data_avaliacao) : "—") + " — Nota: " + (a.nota || "—") + "/5", margin, y);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
        var det = [
          a.nota_tecnica != null ? "Tec " + a.nota_tecnica : null,
          a.nota_qualidade != null ? "Qual " + a.nota_qualidade : null,
          a.nota_comprometimento != null ? "Comp " + a.nota_comprometimento : null,
          a.nota_equipe != null ? "Eq " + a.nota_equipe : null,
          a.nota_iniciativa != null ? "Ini " + a.nota_iniciativa : null
        ].filter(Boolean).join(" · ");
        if (det) { doc.text(det, margin + 4, y + 3.5); y += 6.5; } else { y += 4; }
      });
    }

    tituloSecao("Ferias (" + feriasF.length + ")");
    if (!feriasF.length) {
      doc.setFontSize(9); doc.setTextColor(120, 120, 120);
      doc.text("Sem periodos de ferias cadastrados.", margin, y); y += 5;
    } else {
      feriasF.forEach(function (fe) {
        quebraPagina(8);
        var parc = parcelasPorFerias[fe.id] || [];
        var goz = parc.filter(function(p){return !p.abono_pecuniario;}).reduce(function(a,p){return a+(p.dias||0);}, 0);
        var abn = parc.filter(function(p){return p.abono_pecuniario;}).reduce(function(a,p){return a+(p.dias||0);}, 0);
        var saldo = (fe.dias_direito || 30) - goz - abn;
        doc.setFontSize(9); doc.setTextColor(30, 30, 30); doc.setFont("helvetica", "bold");
        doc.text(fmtDataTxt(fe.periodo_aquisitivo_inicio) + " a " + fmtDataTxt(fe.periodo_aquisitivo_fim) + " - " + (fe.status || "em_aberto"), margin, y);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
        doc.text("Concessivo ate " + fmtDataTxt(fe.periodo_concessivo_fim) + " | Direito " + (fe.dias_direito||30) + "d | Gozado " + goz + "d | Abono " + abn + "d | Saldo " + saldo + "d", margin + 4, y + 3.5);
        y += 7;
        if (parc.length) {
          parc.forEach(function (p) {
            quebraPagina(4);
            doc.setFontSize(7.5); doc.setTextColor(110, 110, 110);
            doc.text("- Parcela: " + fmtDataTxt(p.data_inicio) + " a " + fmtDataTxt(p.data_fim) + " (" + p.dias + "d" + (p.abono_pecuniario ? " - abono" : "") + ")", margin + 8, y);
            y += 3.5;
          });
        }
      });
    }

    tituloSecao("Atestados (" + ats.length + ")");
    if (!ats.length) {
      doc.setFontSize(9); doc.setTextColor(120, 120, 120);
      doc.text("Sem atestados registrados.", margin, y); y += 5;
    } else {
      ats.forEach(function (at) {
        quebraPagina(7);
        doc.setFontSize(9); doc.setTextColor(30, 30, 30); doc.setFont("helvetica", "bold");
        var dh = at.dias ? (at.dias + "d") : (at.hora_inicio && at.hora_fim ? (at.hora_inicio + "-" + at.hora_fim) : "");
        doc.text(fmtDataTxt(at.data_inicio) + " - " + escTxt(at.tipo) + " (" + dh + ")", margin, y);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
        var det = [
          at.medico_nome || null,
          at.medico_especialidade || null,
          at.cid ? "CID " + at.cid : null,
          at.status || null
        ].filter(Boolean).join(" - ");
        if (det) { doc.text(det, margin + 4, y + 3.5); y += 6.5; } else { y += 4; }
      });
    }

    tituloSecao("Afastamentos (" + afs.length + ")");
    if (!afs.length) {
      doc.setFontSize(9); doc.setTextColor(120, 120, 120);
      doc.text("Sem afastamentos registrados.", margin, y); y += 5;
    } else {
      afs.forEach(function (af) {
        quebraPagina(7);
        doc.setFontSize(9); doc.setTextColor(30, 30, 30); doc.setFont("helvetica", "bold");
        doc.text(escTxt(af.tipo) + " - " + fmtDataTxt(af.data_inicio) + (af.data_fim ? " a " + fmtDataTxt(af.data_fim) : " (em curso)"), margin, y);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
        var det = [
          af.inss_numero_beneficio ? "INSS " + af.inss_numero_beneficio : null,
          af.cat_numero ? "CAT " + af.cat_numero : null,
          af.motivo ? af.motivo.substring(0, 80) : null
        ].filter(Boolean).join(" - ");
        if (det) { doc.text(det, margin + 4, y + 3.5); y += 6.5; } else { y += 4; }
      });
    }

    if (f.observacoes) {
      tituloSecao("Observacoes");
      doc.setFontSize(9); doc.setTextColor(40, 40, 40);
      var lines = doc.splitTextToSize(escTxt(f.observacoes), pageW - 2 * margin);
      lines.forEach(function (ln) { quebraPagina(4); doc.text(ln, margin, y); y += 4; });
    }

    var totalPgs = doc.internal.getNumberOfPages();
    for (var p = 1; p <= totalPgs; p++) {
      doc.setPage(p);
      doc.setFontSize(7); doc.setTextColor(140, 120, 100);
      doc.text("Ficha funcional gerada pelo Sistema Terra · documento interno · " + new Date().toLocaleString("pt-BR"), margin, pageH - 6);
      doc.text("Pagina " + p + " de " + totalPgs, pageW - margin, pageH - 6, { align: "right" });
    }

    var safeName = (f.nome || "funcionario").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").toLowerCase();
    doc.save("ficha-" + safeName + "-" + (f.id) + ".pdf");
    try { toast("Ficha gerada.", "ok"); } catch (e) {}
  }).catch(function (e) {
    alert("Erro ao gerar ficha: " + (e && e.message ? e.message : e));
  });
}

// Listeners da toolbar Cargos
(function () {
  function bindOnce(id, ev, fn) {
    var el = document.getElementById(id);
    if (el && !el.__bound_terra) { el.addEventListener(ev, fn); el.__bound_terra = true; }
  }
  document.addEventListener("DOMContentLoaded", function () {
    bindOnce("cg-btn-novo", "click", function () { abrirModalCargo(null); });
    bindOnce("cg-busca",   "input", function () { try { renderCargos(); } catch (e) {} });
    bindOnce("cg-status",  "change", function () { try { renderCargos(); } catch (e) {} });
    bindOnce("cg-dep",     "change", function () { try { renderCargos(); } catch (e) {} });
  });
})();

// =========================================================================
// Helper: barra de rolagem horizontal acima da tabela
// (sincronizada com a barra nativa do .table-wrap-x)
// =========================================================================
function setupTopScrollFor(wrapEl) {
  if (!wrapEl) return;
  if (wrapEl.__topScrollBound) {
    // já existe — só atualiza a largura interna
    var topInner = wrapEl.previousSibling && wrapEl.previousSibling.firstChild;
    if (topInner) {
      var tbl = wrapEl.querySelector("table");
      topInner.style.width = (tbl ? tbl.scrollWidth : wrapEl.scrollWidth) + "px";
    }
    return;
  }
  var top = document.createElement("div");
  top.className = "table-scroll-top";
  var inner = document.createElement("div");
  top.appendChild(inner);
  wrapEl.parentNode.insertBefore(top, wrapEl);

  function syncWidth() {
    var tbl = wrapEl.querySelector("table");
    inner.style.width = (tbl ? tbl.scrollWidth : wrapEl.scrollWidth) + "px";
  }
  syncWidth();

  var syncing = false;
  top.addEventListener("scroll", function () {
    if (syncing) { syncing = false; return; }
    syncing = true;
    wrapEl.scrollLeft = top.scrollLeft;
  });
  wrapEl.addEventListener("scroll", function () {
    if (syncing) { syncing = false; return; }
    syncing = true;
    top.scrollLeft = wrapEl.scrollLeft;
  });
  window.addEventListener("resize", syncWidth);
  wrapEl.__topScrollBound = true;
  wrapEl.__topScrollSync = syncWidth;
}

function setupTopScrollAll() {
  document.querySelectorAll(".table-wrap-x").forEach(setupTopScrollFor);
}

// Liga após boot e expõe pra ser chamado após cada re-render
document.addEventListener("DOMContentLoaded", function () {
  setTimeout(setupTopScrollAll, 200);
});

// =========================================================================
// ONDA B — FERIAS, ATESTADOS, AFASTAMENTOS
// Adicionado em 2026-05-19.
// =========================================================================

var feriasLista = [];
var feriasParcelasCache = {};
var feriasCarregado = false;

var atestadosLista = [];
var atestadosCarregado = false;

var afastamentosLista = [];
var afastamentosCarregado = false;

var AFASTAMENTO_TIPOS = [
  'INSS - Auxílio-doença',
  'INSS - Acidente de trabalho',
  'Licença-maternidade',
  'Licença-paternidade',
  'Adoção',
  'Licença não-remunerada',
  'Serviço militar',
  'Alistamento militar',
  'Licença gala (casamento)',
  'Licença nojo (luto)',
  'Doação de sangue',
  'Mesário/eleitor convocado',
  'Comparecimento a juízo',
  'Outros'
];

var ATESTADO_TIPOS = ['Médico','Odontológico','Acompanhamento de filho','Acompanhamento de familiar','Consulta','Outros'];

function nomeFuncionarioById(id) {
  var f = (funcionariosLista || []).find(function (x) { return x.id === Number(id); });
  return f ? f.nome : ("#" + id);
}

function opcoesFuncionarioSelect() {
  return [{ value: "", label: "— selecione —" }].concat(
    (funcionariosLista || []).slice().sort(function (a, b) { return (a.nome||"").localeCompare(b.nome||""); })
      .filter(function (f) { return !f.data_demissao; })
      .map(function (f) { return { value: f.id, label: f.nome }; })
  );
}

function diasEntreDatas(a, b) {
  if (!a || !b) return 0;
  var d1 = new Date(a + "T00:00:00");
  var d2 = new Date(b + "T00:00:00");
  return Math.round((d2 - d1) / 86400000) + 1;
}

// =========================================================================
// FERIAS
// =========================================================================

function carregarFeriasSeNecessario() {
  if (!funcionariosCarregado) { carregarFuncionariosSeNecessario(); }
  if (feriasCarregado) { renderFerias(); return; }
  Promise.all([
    client.from("ferias").select("*").order("periodo_aquisitivo_inicio", { ascending: false }),
    client.from("ferias_parcelas").select("*").order("data_inicio", { ascending: true })
  ]).then(function (rs) {
    if (rs[0].error) { document.getElementById("fe-tbody").innerHTML = '<tr><td colspan="9" class="tbl-vazio erro">Erro: '+escHtml(rs[0].error.message)+'</td></tr>'; return; }
    feriasLista = rs[0].data || [];
    feriasParcelasCache = {};
    (rs[1].data || []).forEach(function (p) {
      if (!feriasParcelasCache[p.ferias_id]) feriasParcelasCache[p.ferias_id] = [];
      feriasParcelasCache[p.ferias_id].push(p);
    });
    feriasCarregado = true;
    renderFerias();
  });
}

function calcSaldoFerias(fe) {
  var parcelas = feriasParcelasCache[fe.id] || [];
  var gozado = parcelas.filter(function (p) { return !p.abono_pecuniario; }).reduce(function (a, p) { return a + (p.dias || 0); }, 0);
  var abono  = parcelas.filter(function (p) { return p.abono_pecuniario; }).reduce(function (a, p) { return a + (p.dias || 0); }, 0);
  var saldo = (fe.dias_direito || 30) - gozado - abono;
  return { gozado: gozado, abono: abono, saldo: saldo };
}

function statusVisualFerias(fe) {
  var s = fe.status;
  if (s === 'em_gozo') return '<span class="badge-tipo solta">em gozo</span>';
  if (s === 'gozado') return '<span class="badge-tipo">gozado</span>';
  if (s === 'vencido') return '<span class="badge-tipo" style="background:#c44">vencido</span>';
  if (s === 'prescrito') return '<span class="badge-tipo" style="background:#888">prescrito</span>';
  return '<span class="badge-tipo">em aberto</span>';
}

function renderFerias() {
  var tbody = document.getElementById("fe-tbody"); if (!tbody) return;
  var busca = (document.getElementById("fe-busca").value || "").trim().toLowerCase();
  var status = document.getElementById("fe-status").value;
  var hoje = new Date().toISOString().slice(0,10);
  var em60d = new Date(Date.now() + 60*86400000).toISOString().slice(0,10);

  var filtradas = (feriasLista || []).filter(function (fe) {
    if (status && fe.status !== status) return false;
    var nome = nomeFuncionarioById(fe.funcionario_id);
    return matchBusca(busca, [nome]);
  });

  var emAberto = 0, emGozo = 0, vencendo = 0, vencidas = 0;
  (feriasLista || []).forEach(function (fe) {
    if (fe.status === 'em_aberto') emAberto++;
    if (fe.status === 'em_gozo') emGozo++;
    if (fe.status === 'vencido') vencidas++;
    if (fe.status === 'em_aberto' && fe.periodo_concessivo_fim && fe.periodo_concessivo_fim <= em60d && fe.periodo_concessivo_fim >= hoje) vencendo++;
  });
  valText(document.getElementById("fe-m-aberto"), fmtInt(emAberto));
  valText(document.getElementById("fe-m-gozo"), fmtInt(emGozo));
  valText(document.getElementById("fe-m-venc"), fmtInt(vencendo));
  valText(document.getElementById("fe-m-vencido"), fmtInt(vencidas));
  valText(document.getElementById("fe-lbl"), filtradas.length + " de " + (feriasLista || []).length);

  preencherTbody(tbody, filtradas.map(function (fe) {
    var calc = calcSaldoFerias(fe);
    return '<tr>' +
      '<td>' + escHtml(nomeFuncionarioById(fe.funcionario_id)) + '</td>' +
      '<td>' + fmtData(fe.periodo_aquisitivo_inicio) + ' → ' + fmtData(fe.periodo_aquisitivo_fim) + '</td>' +
      '<td>' + fmtData(fe.periodo_concessivo_fim) + '</td>' +
      '<td class="num">' + fmtInt(fe.dias_direito) + '</td>' +
      '<td class="num">' + fmtInt(calc.gozado) + '</td>' +
      '<td class="num">' + fmtInt(calc.abono) + '</td>' +
      '<td class="num"><strong>' + fmtInt(calc.saldo) + '</strong></td>' +
      '<td>' + statusVisualFerias(fe) + '</td>' +
      '<td><button class="btn-limpar" data-fe-edit="' + fe.id + '">Editar</button> <button class="btn-limpar" data-fe-par="' + fe.id + '" title="Parcelas de gozo">📅 Parcelas</button> <button class="btn-limpar" data-fe-del="' + fe.id + '" title="Excluir">🗑</button></td>' +
    '</tr>';
  }), 9);

  tbody.querySelectorAll("[data-fe-edit]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-fe-edit"));
      var fe = feriasLista.find(function (x) { return x.id === id; });
      if (fe) abrirModalFerias(fe);
    });
  });
  tbody.querySelectorAll("[data-fe-par]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-fe-par"));
      var fe = feriasLista.find(function (x) { return x.id === id; });
      if (fe) abrirGerenciadorParcelasFerias(fe);
    });
  });
  tbody.querySelectorAll("[data-fe-del]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var id = Number(btn.getAttribute("data-fe-del"));
      if (!confirm("Excluir esse período (e todas as parcelas)?")) return;
      client.from("ferias").delete().eq("id", id).then(function (r) {
        if (r.error) { alert("Erro: " + r.error.message); return; }
        feriasCarregado = false; carregarFeriasSeNecessario();
      });
    });
  });

  try { setupTopScrollFor(document.querySelector('[data-page="rh_ferias"] .table-wrap-x')); } catch (e) {}
}

function abrirModalFerias(fe) {
  fe = fe || {};
  var editar = !!fe.id;
  abrirModal({
    titulo: editar ? "Editar período aquisitivo" : "Novo período aquisitivo",
    fields: [
      { group: "Funcionário", name: "funcionario_id", label: "Funcionário", type: "select", valor: fe.funcionario_id || "", options: opcoesFuncionarioSelect(), required: true },
      { group: "Período", name: "periodo_aquisitivo_inicio", label: "Início do período aquisitivo", type: "date", valor: fe.periodo_aquisitivo_inicio, required: true },
      { group: "Período", name: "periodo_aquisitivo_fim", label: "Fim do período aquisitivo", type: "date", valor: fe.periodo_aquisitivo_fim, required: true },
      { group: "Período", name: "periodo_concessivo_fim", label: "Fim do período concessivo", type: "date", valor: fe.periodo_concessivo_fim },
      { group: "Direito", name: "dias_direito", label: "Dias de direito", type: "number", valor: fe.dias_direito || 30 },
      { group: "Direito", name: "abono_dias", label: "Abono pecuniário (dias — máx 10)", type: "number", valor: fe.abono_dias || 0 },
      { group: "Status", name: "status", label: "Status", type: "select", valor: fe.status || "em_aberto", options: [
        {value:"em_aberto",label:"Em aberto"},{value:"em_gozo",label:"Em gozo"},{value:"gozado",label:"Gozado"},{value:"vencido",label:"Vencido"},{value:"prescrito",label:"Prescrito"}
      ]},
      { group: "Observações", name: "observacoes", label: "Observações", type: "textarea", valor: fe.observacoes }
    ],
    onSubmit: function (v, done) {
      var payload = {
        funcionario_id: Number(v.funcionario_id),
        periodo_aquisitivo_inicio: v.periodo_aquisitivo_inicio,
        periodo_aquisitivo_fim: v.periodo_aquisitivo_fim,
        periodo_concessivo_fim: v.periodo_concessivo_fim || null,
        dias_direito: Number(v.dias_direito) || 30,
        abono_dias: Number(v.abono_dias) || 0,
        status: v.status,
        observacoes: v.observacoes || null
      };
      var q = editar
        ? client.from("ferias").update(payload).eq("id", fe.id)
        : client.from("ferias").insert(payload);
      q.then(function (r) {
        if (r.error) { done(r.error.message); return; }
        feriasCarregado = false;
        carregarFeriasSeNecessario();
        done(null);
      });
    }
  });
}

function abrirGerenciadorParcelasFerias(fe) {
  var nome = nomeFuncionarioById(fe.funcionario_id);
  client.from("ferias_parcelas").select("*").eq("ferias_id", fe.id).order("data_inicio", { ascending: true }).then(function (r) {
    var lista = (r && r.data) || [];
    var calc = calcSaldoFerias(fe);
    var html = '<div style="margin-bottom:12px"><strong>' + escHtml(nome) + '</strong> · período: ' + fmtData(fe.periodo_aquisitivo_inicio) + ' → ' + fmtData(fe.periodo_aquisitivo_fim) + '<br>Direito: ' + fe.dias_direito + ' · Gozado: ' + calc.gozado + ' · Abono: ' + calc.abono + ' · <strong>Saldo: ' + calc.saldo + '</strong></div>';
    if (!lista.length) {
      html += '<div class="tbl-vazio">Nenhuma parcela registrada.</div>';
    } else {
      html += '<table class="tabela"><thead><tr><th>Início</th><th>Fim</th><th class="num">Dias</th><th>Abono?</th><th>Obs</th><th></th></tr></thead><tbody>';
      lista.forEach(function (p) {
        html += '<tr><td>' + fmtData(p.data_inicio) + '</td><td>' + fmtData(p.data_fim) + '</td><td class="num">' + p.dias + '</td><td>' + (p.abono_pecuniario ? "Sim" : "Não") + '</td><td>' + escHtml(p.observacoes || "—") + '</td><td><button class="btn-limpar" data-fp-del="' + p.id + '">🗑</button></td></tr>';
      });
      html += '</tbody></table>';
    }

    abrirModal({
      titulo: "Parcelas — " + nome,
      fields: [{ name: "_p", label: "", type: "text", valor: "" }],
      onSubmit: function (v, done) {
        if (!v.data_inicio || !v.data_fim) { done("Informe data início e fim."); return; }
        var dias = diasEntreDatas(v.data_inicio, v.data_fim);
        if (dias < 1) { done("Período inválido."); return; }
        if (lista.length >= 3) { done("Máximo 3 parcelas por período (lei 13.467/17)."); return; }
        var payload = {
          ferias_id: fe.id,
          data_inicio: v.data_inicio,
          data_fim: v.data_fim,
          dias: dias,
          abono_pecuniario: v.abono_pecuniario === "1",
          observacoes: v.observacoes || null
        };
        client.from("ferias_parcelas").insert(payload).then(function (r2) {
          if (r2.error) { done(r2.error.message); return; }
          fecharModal();
          feriasCarregado = false; carregarFeriasSeNecessario();
          setTimeout(function () { abrirGerenciadorParcelasFerias(fe); }, 100);
        });
      }
    });

    setTimeout(function () {
      var el = document.getElementById("modal-fields"); if (!el) return;
      el.innerHTML =
        '<fieldset class="form-section"><legend>Parcelas registradas (' + lista.length + ' de 3)</legend>' + html + '</fieldset>' +
        '<fieldset class="form-section"><legend>Adicionar nova parcela' + (lista.length>=3 ? ' (limite atingido)' : '') + '</legend>' +
          '<div class="form-field"><label for="mf-data_inicio">Data início</label><input id="mf-data_inicio" name="data_inicio" type="date" ' + (lista.length>=3?'disabled':'') + ' /></div>' +
          '<div class="form-field"><label for="mf-data_fim">Data fim</label><input id="mf-data_fim" name="data_fim" type="date" ' + (lista.length>=3?'disabled':'') + ' /></div>' +
          '<div class="form-field"><label for="mf-abono_pecuniario">Abono pecuniário?</label><select id="mf-abono_pecuniario" name="abono_pecuniario" ' + (lista.length>=3?'disabled':'') + '><option value="0">Não (gozo)</option><option value="1">Sim (venda)</option></select></div>' +
          '<div class="form-field form-field-wide"><label for="mf-observacoes">Observações</label><textarea id="mf-observacoes" name="observacoes" rows="2" ' + (lista.length>=3?'disabled':'') + '></textarea></div>' +
        '</fieldset>';
      el.querySelectorAll("[data-fp-del]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = Number(btn.getAttribute("data-fp-del"));
          if (!confirm("Excluir essa parcela?")) return;
          client.from("ferias_parcelas").delete().eq("id", id).then(function (r3) {
            if (r3.error) { alert("Erro: " + r3.error.message); return; }
            fecharModal();
            feriasCarregado = false; carregarFeriasSeNecessario();
            setTimeout(function () { abrirGerenciadorParcelasFerias(fe); }, 100);
          });
        });
      });
    }, 60);
  });
}

// =========================================================================
// ATESTADOS
// =========================================================================

function carregarAtestadosSeNecessario() {
  if (!funcionariosCarregado) carregarFuncionariosSeNecessario();
  if (atestadosCarregado) { renderAtestados(); return; }
  client.from("atestados").select("*").order("data_inicio", { ascending: false }).then(function (r) {
    if (r.error) { document.getElementById("at-tbody").innerHTML = '<tr><td colspan="10" class="tbl-vazio erro">Erro: '+escHtml(r.error.message)+'</td></tr>'; return; }
    atestadosLista = r.data || [];
    atestadosCarregado = true;
    renderAtestados();
  });
}

function calcPrazoAtestado(at) {
  if (!at.data_entrega || !at.data_inicio) return null;
  var dias = diasEntreDatas(at.data_inicio, at.data_entrega) - 1;
  return { dias: dias, dentro: dias <= 2 };
}

function renderAtestados() {
  var tbody = document.getElementById("at-tbody"); if (!tbody) return;
  var busca = (document.getElementById("at-busca").value || "").trim().toLowerCase();
  var tipo = document.getElementById("at-tipo").value;
  var status = document.getElementById("at-status").value;

  var filtrados = (atestadosLista || []).filter(function (at) {
    if (tipo && at.tipo !== tipo) return false;
    if (status && at.status !== status) return false;
    var nome = nomeFuncionarioById(at.funcionario_id);
    return matchBusca(busca, [nome, at.medico_nome, at.cid, at.medico_especialidade]);
  });

  var totalDias = 0, pendentes = 0, foraPrazo = 0;
  (atestadosLista || []).forEach(function (at) {
    totalDias += (at.dias || 0);
    if (at.status === 'pendente') pendentes++;
    var p = calcPrazoAtestado(at);
    if (p && !p.dentro) foraPrazo++;
  });
  valText(document.getElementById("at-m-tot"), fmtInt((atestadosLista || []).length));
  valText(document.getElementById("at-m-dias"), fmtInt(totalDias));
  valText(document.getElementById("at-m-pend"), fmtInt(pendentes));
  valText(document.getElementById("at-m-prazo"), fmtInt(foraPrazo));
  valText(document.getElementById("at-lbl"), filtrados.length + " de " + (atestadosLista || []).length);

  preencherTbody(tbody, filtrados.map(function (at) {
    var dh = at.dias ? (at.dias + " dias") : (at.hora_inicio && at.hora_fim ? (at.hora_inicio + "–" + at.hora_fim) : "—");
    var prazo = calcPrazoAtestado(at);
    var prazoTxt = prazo ? (prazo.dentro ? '<span class="badge-tipo solta">no prazo</span>' : '<span class="badge-tipo" style="background:#c44">+' + prazo.dias + 'd</span>') : "—";
    var statusBadge = at.status === 'validado' ? '<span class="badge-tipo solta">validado</span>'
                    : at.status === 'recusado' ? '<span class="badge-tipo" style="background:#c44">recusado</span>'
                    : '<span class="badge-tipo">pendente</span>';
    return '<tr>' +
      '<td>' + escHtml(nomeFuncionarioById(at.funcionario_id)) + '</td>' +
      '<td>' + escHtml(at.tipo) + '</td>' +
      '<td>' + fmtData(at.data_inicio) + '</td>' +
      '<td class="num">' + dh + '</td>' +
      '<td>' + (at.data_entrega ? fmtData(at.data_entrega) : "—") + '</td>' +
      '<td>' + prazoTxt + '</td>' +
      '<td>' + escHtml(at.medico_nome || "—") + (at.medico_especialidade ? '<br><small>'+escHtml(at.medico_especialidade)+'</small>' : '') + '</td>' +
      '<td class="mono">' + escHtml(at.cid || "—") + '</td>' +
      '<td>' + statusBadge + '</td>' +
      '<td><button class="btn-limpar" data-at-edit="' + at.id + '">Editar</button> <button class="btn-limpar" data-at-del="' + at.id + '" title="Excluir">🗑</button></td>' +
    '</tr>';
  }), 10);

  tbody.querySelectorAll("[data-at-edit]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-at-edit"));
      var at = atestadosLista.find(function (x) { return x.id === id; });
      if (at) abrirModalAtestado(at);
    });
  });
  tbody.querySelectorAll("[data-at-del]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var id = Number(btn.getAttribute("data-at-del"));
      if (!confirm("Excluir esse atestado?")) return;
      client.from("atestados").delete().eq("id", id).then(function (r) {
        if (r.error) { alert("Erro: " + r.error.message); return; }
        atestadosCarregado = false; carregarAtestadosSeNecessario();
      });
    });
  });

  try { setupTopScrollFor(document.querySelector('[data-page="rh_atestados"] .table-wrap-x')); } catch (e) {}
}

function abrirModalAtestado(at) {
  at = at || {};
  var editar = !!at.id;
  abrirModal({
    titulo: editar ? "Editar atestado" : "Novo atestado",
    fields: [
      { group: "Funcionário", name: "funcionario_id", label: "Funcionário", type: "select", valor: at.funcionario_id || "", options: opcoesFuncionarioSelect(), required: true },
      { group: "Tipo", name: "tipo", label: "Tipo do atestado", type: "select", valor: at.tipo || "Médico", options: ATESTADO_TIPOS, required: true },
      { group: "Período", name: "data_inicio", label: "Data início", type: "date", valor: at.data_inicio, required: true },
      { group: "Período", name: "dias", label: "Dias (deixar vazio se for de horas)", type: "number", valor: at.dias },
      { group: "Período", name: "hora_inicio", label: "Hora início (se atestado de horas)", type: "text", valor: at.hora_inicio },
      { group: "Período", name: "hora_fim", label: "Hora fim", type: "text", valor: at.hora_fim },
      { group: "Entrega no RH", name: "data_entrega", label: "Data de entrega (prazo CLT 48h)", type: "date", valor: at.data_entrega },
      { group: "Médico", name: "medico_nome", label: "Médico/Clínica", type: "text", valor: at.medico_nome },
      { group: "Médico", name: "medico_crm", label: "CRM", type: "text", valor: at.medico_crm },
      { group: "Médico", name: "medico_especialidade", label: "Especialidade", type: "text", valor: at.medico_especialidade },
      { group: "Médico", name: "cid", label: "CID (opcional — sigiloso)", type: "text", valor: at.cid },
      { group: "Status", name: "status", label: "Status", type: "select", valor: at.status || "pendente", options: [
        {value:"pendente",label:"Pendente"},{value:"validado",label:"Validado"},{value:"recusado",label:"Recusado"}
      ]},
      { group: "Observações", name: "observacoes", label: "Observações", type: "textarea", valor: at.observacoes }
    ],
    onSubmit: function (v, done) {
      if (!v.dias && !(v.hora_inicio && v.hora_fim)) { done("Informe os dias OU as horas (início e fim)."); return; }
      var payload = {
        funcionario_id: Number(v.funcionario_id),
        tipo: v.tipo,
        data_inicio: v.data_inicio,
        dias: v.dias ? Number(v.dias) : null,
        hora_inicio: v.hora_inicio || null,
        hora_fim: v.hora_fim || null,
        data_entrega: v.data_entrega || null,
        medico_nome: v.medico_nome || null,
        medico_crm: v.medico_crm || null,
        medico_especialidade: v.medico_especialidade || null,
        cid: v.cid || null,
        status: v.status || "pendente",
        observacoes: v.observacoes || null
      };
      var q = editar
        ? client.from("atestados").update(payload).eq("id", at.id)
        : client.from("atestados").insert(payload);
      q.then(function (r) {
        if (r.error) { done(r.error.message); return; }
        atestadosCarregado = false; carregarAtestadosSeNecessario();
        done(null);
      });
    }
  });
}

// =========================================================================
// AFASTAMENTOS
// =========================================================================

function carregarAfastamentosSeNecessario() {
  if (!funcionariosCarregado) carregarFuncionariosSeNecessario();
  if (afastamentosCarregado) { renderAfastamentos(); return; }
  client.from("afastamentos").select("*").order("data_inicio", { ascending: false }).then(function (r) {
    if (r.error) { document.getElementById("af-tbody").innerHTML = '<tr><td colspan="9" class="tbl-vazio erro">Erro: '+escHtml(r.error.message)+'</td></tr>'; return; }
    afastamentosLista = r.data || [];
    afastamentosCarregado = true;
    popularSelectAfastamentoTipo();
    renderAfastamentos();
  });
}

function popularSelectAfastamentoTipo() {
  var sel = document.getElementById("af-tipo"); if (!sel) return;
  var atual = sel.value;
  sel.innerHTML = '<option value="">Todos os tipos</option>' + AFASTAMENTO_TIPOS.map(function (t) { return '<option value="'+escHtml(t)+'">'+escHtml(t)+'</option>'; }).join("");
  if (atual) sel.value = atual;
}

function renderAfastamentos() {
  var tbody = document.getElementById("af-tbody"); if (!tbody) return;
  var busca = (document.getElementById("af-busca").value || "").trim().toLowerCase();
  var tipo = document.getElementById("af-tipo").value;
  var sit = document.getElementById("af-situacao").value;

  var filtrados = (afastamentosLista || []).filter(function (af) {
    if (tipo && af.tipo !== tipo) return false;
    if (sit === "ativo" && af.data_fim) return false;
    if (sit === "encerrado" && !af.data_fim) return false;
    var nome = nomeFuncionarioById(af.funcionario_id);
    return matchBusca(busca, [nome, af.motivo, af.tipo]);
  });

  var ativos = 0, encerrados = 0, comCat = 0;
  (afastamentosLista || []).forEach(function (af) {
    if (af.data_fim) encerrados++; else ativos++;
    if (af.cat_numero) comCat++;
  });
  valText(document.getElementById("af-m-ativo"), fmtInt(ativos));
  valText(document.getElementById("af-m-encerrado"), fmtInt(encerrados));
  valText(document.getElementById("af-m-cat"), fmtInt(comCat));
  valText(document.getElementById("af-lbl"), filtrados.length + " de " + (afastamentosLista || []).length);

  preencherTbody(tbody, filtrados.map(function (af) {
    var dias = af.data_fim ? diasEntreDatas(af.data_inicio, af.data_fim) : "—";
    return '<tr>' +
      '<td>' + escHtml(nomeFuncionarioById(af.funcionario_id)) + '</td>' +
      '<td>' + escHtml(af.tipo) + '</td>' +
      '<td>' + fmtData(af.data_inicio) + '</td>' +
      '<td>' + (af.data_fim ? fmtData(af.data_fim) : '<span class="badge-tipo solta">ativo</span>') + '</td>' +
      '<td class="num">' + dias + '</td>' +
      '<td class="mono">' + escHtml(af.inss_numero_beneficio || "—") + '</td>' +
      '<td class="mono">' + escHtml(af.cat_numero || "—") + '</td>' +
      '<td>' + escHtml((af.motivo || "—").substring(0, 60)) + '</td>' +
      '<td><button class="btn-limpar" data-af-edit="' + af.id + '">Editar</button> <button class="btn-limpar" data-af-del="' + af.id + '" title="Excluir">🗑</button></td>' +
    '</tr>';
  }), 9);

  tbody.querySelectorAll("[data-af-edit]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-af-edit"));
      var af = afastamentosLista.find(function (x) { return x.id === id; });
      if (af) abrirModalAfastamento(af);
    });
  });
  tbody.querySelectorAll("[data-af-del]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var id = Number(btn.getAttribute("data-af-del"));
      if (!confirm("Excluir esse afastamento?")) return;
      client.from("afastamentos").delete().eq("id", id).then(function (r) {
        if (r.error) { alert("Erro: " + r.error.message); return; }
        afastamentosCarregado = false; carregarAfastamentosSeNecessario();
      });
    });
  });

  try { setupTopScrollFor(document.querySelector('[data-page="rh_afastamentos"] .table-wrap-x')); } catch (e) {}
}

function abrirModalAfastamento(af) {
  af = af || {};
  var editar = !!af.id;
  abrirModal({
    titulo: editar ? "Editar afastamento" : "Novo afastamento",
    fields: [
      { group: "Funcionário", name: "funcionario_id", label: "Funcionário", type: "select", valor: af.funcionario_id || "", options: opcoesFuncionarioSelect(), required: true },
      { group: "Tipo", name: "tipo", label: "Tipo do afastamento", type: "select", valor: af.tipo || AFASTAMENTO_TIPOS[0], options: AFASTAMENTO_TIPOS, required: true },
      { group: "Período", name: "data_inicio", label: "Data início", type: "date", valor: af.data_inicio, required: true },
      { group: "Período", name: "data_fim", label: "Data fim (vazio se ativo)", type: "date", valor: af.data_fim },
      { group: "INSS/CAT", name: "inss_numero_beneficio", label: "Número do benefício INSS (B91, B31...)", type: "text", valor: af.inss_numero_beneficio },
      { group: "INSS/CAT", name: "cat_numero", label: "Número da CAT (acidente trabalho)", type: "text", valor: af.cat_numero },
      { group: "Motivo", name: "motivo", label: "Motivo/justificativa", type: "textarea", valor: af.motivo },
      { group: "Motivo", name: "observacoes", label: "Observações adicionais", type: "textarea", valor: af.observacoes }
    ],
    onSubmit: function (v, done) {
      var payload = {
        funcionario_id: Number(v.funcionario_id),
        tipo: v.tipo,
        data_inicio: v.data_inicio,
        data_fim: v.data_fim || null,
        inss_numero_beneficio: v.inss_numero_beneficio || null,
        cat_numero: v.cat_numero || null,
        motivo: v.motivo || null,
        observacoes: v.observacoes || null
      };
      var q = editar
        ? client.from("afastamentos").update(payload).eq("id", af.id)
        : client.from("afastamentos").insert(payload);
      q.then(function (r) {
        if (r.error) { done(r.error.message); return; }
        afastamentosCarregado = false; carregarAfastamentosSeNecessario();
        done(null);
      });
    }
  });
}

// =========================================================================
// LISTENERS — toolbars
// =========================================================================
(function () {
  function bindOnce(id, ev, fn) {
    var el = document.getElementById(id);
    if (el && !el.__bound_terra) { el.addEventListener(ev, fn); el.__bound_terra = true; }
  }
  document.addEventListener("DOMContentLoaded", function () {
    bindOnce("fe-btn-novo", "click", function () { abrirModalFerias(null); });
    bindOnce("fe-busca",   "input", function () { try { renderFerias(); } catch (e) {} });
    bindOnce("fe-status",  "change", function () { try { renderFerias(); } catch (e) {} });

    bindOnce("at-btn-novo", "click", function () { abrirModalAtestado(null); });
    bindOnce("at-busca",   "input", function () { try { renderAtestados(); } catch (e) {} });
    bindOnce("at-tipo",    "change", function () { try { renderAtestados(); } catch (e) {} });
    bindOnce("at-status",  "change", function () { try { renderAtestados(); } catch (e) {} });

    // botão extra na toolbar de Atestados
    var atToolbar = document.querySelector('[data-page="rh_atestados"] .toolbar');
    if (atToolbar && !document.getElementById("at-btn-freq")) {
      var btnAt = document.createElement("button");
      btnAt.id = "at-btn-freq"; btnAt.type = "button"; btnAt.className = "btn-limpar";
      btnAt.textContent = "🔄 Atualizar Frequência";
      btnAt.title = "Recalcula faltas justificadas em frequência_mensal a partir dos atestados/afastamentos";
      btnAt.addEventListener("click", abrirRecalcularFrequencia);
      atToolbar.insertBefore(btnAt, atToolbar.querySelector("#at-lbl"));
    }
    var afToolbar = document.querySelector('[data-page="rh_afastamentos"] .toolbar');
    if (afToolbar && !document.getElementById("af-btn-freq")) {
      var btnAf = document.createElement("button");
      btnAf.id = "af-btn-freq"; btnAf.type = "button"; btnAf.className = "btn-limpar";
      btnAf.textContent = "🔄 Atualizar Frequência";
      btnAf.title = "Recalcula faltas justificadas em frequência_mensal a partir dos atestados/afastamentos";
      btnAf.addEventListener("click", abrirRecalcularFrequencia);
      afToolbar.insertBefore(btnAf, afToolbar.querySelector("#af-lbl"));
    }

    bindOnce("af-btn-novo", "click", function () { abrirModalAfastamento(null); });
    bindOnce("af-busca",   "input", function () { try { renderAfastamentos(); } catch (e) {} });
    bindOnce("af-tipo",    "change", function () { try { renderAfastamentos(); } catch (e) {} });
    bindOnce("af-situacao","change", function () { try { renderAfastamentos(); } catch (e) {} });
  });
})();

// =========================================================================
// ONDA B — Integração com frequencia_mensal + Ficha PDF estendida
// =========================================================================

function diasInterseccaoMes(dataIni, dataFim, anoMes) {
  // Retorna quantos dias do intervalo [dataIni, dataFim] caem em anoMes "YYYY-MM"
  if (!dataIni) return 0;
  var ano = parseInt(anoMes.substring(0, 4), 10);
  var mes = parseInt(anoMes.substring(5, 7), 10);
  var primeiroDoMes = new Date(ano, mes - 1, 1);
  var ultimoDoMes = new Date(ano, mes, 0); // último dia
  var ini = new Date(dataIni + "T00:00:00");
  var fim = dataFim ? new Date(dataFim + "T00:00:00") : new Date();
  var maxIni = ini > primeiroDoMes ? ini : primeiroDoMes;
  var minFim = fim < ultimoDoMes ? fim : ultimoDoMes;
  if (maxIni > minFim) return 0;
  return Math.round((minFim - maxIni) / 86400000) + 1;
}

function recalcularFrequenciaMensal(funcionarioId, mesRef, cb) {
  // Lê atestados + afastamentos do funcionário, soma dias dentro do mês,
  // e UPSERT em frequencia_mensal (somando como faltas_justificadas).
  Promise.all([
    client.from("atestados").select("data_inicio,dias,hora_inicio,hora_fim,status").eq("funcionario_id", funcionarioId).neq("status","recusado"),
    client.from("afastamentos").select("data_inicio,data_fim").eq("funcionario_id", funcionarioId)
  ]).then(function (rs) {
    var diasAtest = 0;
    (rs[0].data || []).forEach(function (at) {
      if (at.dias) {
        var fim = null;
        try { var d = new Date(at.data_inicio + "T00:00:00"); d.setDate(d.getDate() + at.dias - 1); fim = d.toISOString().slice(0,10); } catch(e) {}
        diasAtest += diasInterseccaoMes(at.data_inicio, fim, mesRef);
      }
      // atestados de horas não viram falta inteira
    });
    var diasAfast = 0;
    (rs[1].data || []).forEach(function (af) {
      diasAfast += diasInterseccaoMes(af.data_inicio, af.data_fim, mesRef);
    });
    var totalJust = diasAtest + diasAfast;

    // Buscar registro atual pra preservar manuais
    client.from("frequencia_mensal").select("*").eq("funcionario_id", funcionarioId).eq("mes_ref", mesRef).then(function (r2) {
      var atual = (r2.data && r2.data[0]) || null;
      var payload = {
        funcionario_id: funcionarioId,
        mes_ref: mesRef,
        faltas_justificadas: totalJust,
        faltas_nao_justificadas: atual ? atual.faltas_nao_justificadas : 0,
        atrasos_ate_30min: atual ? atual.atrasos_ate_30min : 0,
        atrasos_acima_30min: atual ? atual.atrasos_acima_30min : 0,
        observacoes: (atual && atual.observacoes) || ("Recalculado em " + new Date().toISOString().slice(0,10) + ": " + diasAtest + " dia(s) de atestado + " + diasAfast + " dia(s) de afastamento.")
      };
      var q = atual
        ? client.from("frequencia_mensal").update(payload).eq("id", atual.id)
        : client.from("frequencia_mensal").insert(payload);
      q.then(function (r3) {
        if (cb) cb(r3.error ? r3.error.message : null, totalJust);
      });
    });
  });
}

function abrirRecalcularFrequencia() {
  abrirModal({
    titulo: "Atualizar frequência mensal a partir de atestados+afastamentos",
    fields: [
      { name: "funcionario_id", label: "Funcionário (vazio = todos os ativos)", type: "select", valor: "", options: [{value:"",label:"— todos os ativos —"}].concat(opcoesFuncionarioSelect().slice(1)) },
      { name: "mes_ref", label: "Mês de referência (YYYY-MM)", type: "text", valor: new Date().toISOString().slice(0,7), required: true }
    ],
    onSubmit: function (v, done) {
      if (!/^\d{4}-\d{2}$/.test(v.mes_ref)) { done("Use o formato YYYY-MM"); return; }
      var alvos = v.funcionario_id ? [Number(v.funcionario_id)] : (funcionariosLista || []).filter(function (f) { return !f.data_demissao; }).map(function (f) { return f.id; });
      var pendentes = alvos.length;
      var erros = [];
      var totais = 0;
      if (!pendentes) { done("Sem funcionários ativos."); return; }
      alvos.forEach(function (id) {
        recalcularFrequenciaMensal(id, v.mes_ref, function (err, total) {
          pendentes--;
          if (err) erros.push(nomeFuncionarioById(id) + ": " + err);
          else if (total > 0) totais++;
          if (pendentes === 0) {
            if (erros.length) done("Erros: " + erros.slice(0,3).join("; "));
            else { done(null); try { toast("Frequência atualizada — " + totais + " funcionário(s) com dias justificados.", "ok"); } catch (e) {} }
          }
        });
      });
    }
  });
}
