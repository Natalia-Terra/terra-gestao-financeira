/**
 * Terra Conttemporânea — Gestão Financeira
 * Módulo: 04 apropriacao folha
 * Parte 4/8 do refator M1 (app.js antigo: linhas 4794-6443)
 *
 * AVISO: gerado pela divisão automática de app.js.
 * Edições devem preservar a ORDEM das funções (algumas dependem de
 * declarações anteriores e overrides posteriores).
 */

"use strict";


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
      '<td><button class="btn-limpar" data-cc-edit="' + c.id + '">Editar</button> <button class="btn-limpar" data-cc-del="' + c.id + '" title="Excluir">🗑 Excluir</button></td>' +
    '</tr>';
  }), 7);
  tbody.querySelectorAll("[data-cc-edit]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-cc-edit"));
      var c = centrosCustoLista.find(function (x) { return x.id === id; });
      if (c) abrirModalCentroCusto(c);
    });
  tbody.querySelectorAll("[data-cc-del]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var id = btn.getAttribute("data-cc-del");
      var rid = isNaN(Number(id)) ? id : Number(id);
      if (!confirm("Excluir este registro? Essa ação não pode ser desfeita.")) return;
      client.from("centros_custo").delete().eq("id", rid).then(function (r) {
        if (r.error) { try { toast("Erro ao excluir: " + r.error.message, "erro"); } catch (e) { alert("Erro ao excluir: " + r.error.message); } return; }
        try { toast("Excluído.", "ok"); } catch (e) {}
        if (typeof carregarCentrosSeNecessario === "function") carregarCentrosSeNecessario();
      });
    });
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
      '<td><button class="btn-limpar" data-rb-edit="' + r.id + '">Editar</button> <button class="btn-limpar" data-rb-del="' + r.id + '" title="Excluir">🗑 Excluir</button></td>' +
    '</tr>';
  }), 6);
  tbody.querySelectorAll("[data-rb-edit]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-rb-edit"));
      var r = rubricasLista.find(function (x) { return x.id === id; });
      if (r) abrirModalRubrica(r);
    });
  tbody.querySelectorAll("[data-rb-del]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var id = btn.getAttribute("data-rb-del");
      var rid = isNaN(Number(id)) ? id : Number(id);
      if (!confirm("Excluir este registro? Essa ação não pode ser desfeita.")) return;
      client.from("rubricas").delete().eq("id", rid).then(function (r) {
        if (r.error) { try { toast("Erro ao excluir: " + r.error.message, "erro"); } catch (e) { alert("Erro ao excluir: " + r.error.message); } return; }
        try { toast("Excluído.", "ok"); } catch (e) {}
        if (typeof carregarRubricasSeNecessario === "function") carregarRubricasSeNecessario();
      });
    });
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
