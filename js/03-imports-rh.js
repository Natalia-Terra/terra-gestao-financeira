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

function fecharModal() {
  // M28b: limpa o inline style forcado pelo abrirModal — senao o hidden=true nao
  // surte efeito (inline !important vence o [hidden]{display:none !important})
  try {
    ["display","visibility","opacity","pointer-events","z-index","position","top","left","right","bottom"].forEach(function (p) {
      modalOverlay.style.removeProperty(p);
    });
  } catch (e) {}
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
    var reabrir = !!(modalConfig && modalConfig._salvarProximoFlag);
    var mc = modalConfig;
    fecharModal();
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
      '<td><button class="btn-limpar" data-fn-edit="' + f.id + '">Editar</button> <button class="btn-limpar" data-fn-ficha="' + f.id + '" title="Baixar Ficha Funcional (PDF)">📋 Ficha</button> <button class="btn-limpar" data-fn-deps="' + f.id + '" title="Dependentes">👨‍👩‍👧 Deps</button> <button class="btn-limpar" data-fn-del="' + f.id + '" title="Excluir">🗑 Excluir</button></td>' +
    '</tr>';
  }), 9);

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
      { group: "Trabalho",       name: "cargo_id",             label: "Cargo (descritivo)",                    type: "select", valor: f.cargo_id || "", options: [{value:"",label:"— (usar texto livre abaixo)"}].concat((cargosLista||[]).filter(function(c){return c.ativo;}).sort(function(a,b){return (a.nome||"").localeCompare(b.nome||"");}).map(function(c){return {value:c.id,label:c.nome + (c.departamento?" — "+c.departamento:"")};})) },
      { group: "Trabalho",       name: "cargo",                label: "Função / Cargo (texto livre — legado)", type: "text",   valor: f.cargo },
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
    return '<tr>' +
      '<td><strong>' + escHtml(c.nome) + '</strong></td>' +
      '<td>' + escHtml(c.departamento || "—") + '</td>' +
      '<td>' + escHtml(sup ? sup.nome : "—") + '</td>' +
      '<td class="num">' + fmtInt(qtd) + '</td>' +
      '<td>' + (c.ativo ? '<span class="badge-tipo solta">ativo</span>' : '<span class="badge-tipo">inativo</span>') + '</td>' +
      '<td><button class="btn-limpar" data-cg-edit="' + c.id + '">Editar</button> <button class="btn-limpar" data-cg-del="' + c.id + '" title="Excluir">🗑 Excluir</button></td>' +
    '</tr>';
  }), 6);

  tbody.querySelectorAll("[data-cg-edit]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-cg-edit"));
      var c = (cargosLista || []).find(function (x) { return x.id === id; });
      if (c) abrirModalCargo(c);
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

function abrirModalCargo(c) {
  c = c || {};
  var editar = !!c.id;
  var opcSuperior = [{ value: "", label: "— (sem superior)" }].concat(
    (cargosLista || []).filter(function (x) { return x.id !== c.id && x.ativo; })
      .sort(function (a, b) { return (a.nome || "").localeCompare(b.nome || ""); })
      .map(function (x) { return { value: x.id, label: x.nome + (x.departamento ? " — " + x.departamento : "") }; })
  );

  abrirModal({
    titulo: editar ? "Editar cargo" : "Novo cargo",
    fields: [
      { group: "Identificacao", name: "nome",           label: "Titulo do cargo",            type: "text", valor: c.nome, required: true },
      { group: "Identificacao", name: "departamento",   label: "Departamento",               type: "text", valor: c.departamento },
      { group: "Identificacao", name: "superior_id",    label: "Cargo do superior imediato", type: "select", valor: c.superior_id || "", options: opcSuperior },
      { group: "Identificacao", name: "ativo",          label: "Status",                     type: "select", valor: c.ativo === false ? "0" : "1", options: [{value:"1",label:"Ativo"},{value:"0",label:"Inativo"}] },
      { group: "Descritivo",    name: "missao",            label: "Missao do cargo",           type: "textarea", valor: c.missao },
      { group: "Descritivo",    name: "responsabilidades", label: "Principais responsabilidades", type: "textarea", valor: c.responsabilidades },
      { group: "Descritivo",    name: "competencias",      label: "Competencias",              type: "textarea", valor: c.competencias },
      { group: "Descritivo",    name: "consideracoes",     label: "Consideracoes importantes", type: "textarea", valor: c.consideracoes }
    ],
    onSubmit: function (v, done) {
      var payload = {
        nome: v.nome,
        departamento: v.departamento || null,
        superior_id: v.superior_id ? Number(v.superior_id) : null,
        ativo: v.ativo === "1" || v.ativo === 1 || v.ativo === true,
        missao: v.missao || null,
        responsabilidades: v.responsabilidades || null,
        competencias: v.competencias || null,
        consideracoes: v.consideracoes || null
      };
      var q = editar
        ? client.from("cargos").update(payload).eq("id", c.id)
        : client.from("cargos").insert(payload);
      q.then(function (r) {
        if (r.error) { done(r.error.message); return; }
        cargosCarregado = false;
        funcionariosCarregado = false;
        carregarCargosSeNecessario(function () {
          if (document.querySelector('[data-page="rh_cargos"]:not([hidden])')) renderCargos();
        });
        done(null);
      });
    }
  });
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
    client.from("avaliacao_desempenho").select("*").eq("funcionario_id", f.id).order("data_avaliacao", { ascending: false })
  ]).then(function (rs) {
    var deps  = (rs[0] && rs[0].data) || [];
    var bens  = (rs[1] && rs[1].data) || [];
    var meds  = (rs[2] && rs[2].data) || [];
    var avals = (rs[3] && rs[3].data) || [];

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
