/**
 * Terra Conttemporânea — Gestão Financeira
 * Módulo: 05 bonus caixa
 * Parte 5/8 do refator M1 v2 (app.js antigo: linhas 6365-7989)
 *
 * IMPORTANTE: a ORDEM dos scripts no index.html importa.
 * 5 funções têm 2 declarações (a 2ª sobrescreve a 1ª) e há blocos de
 * override que dependem das funções já existirem. Não reorganizar.
 */

"use strict";


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

// Bind: re-render quando 'minhas' muda
(function () {
  function bindAudMinhas() {
    var cb = document.getElementById("aud-minhas");
    if (!cb || cb.dataset.bound) return;
    cb.dataset.bound = "aud-minhas-bound";
    cb.addEventListener("change", function () { if (typeof renderAuditoria === "function") renderAuditoria(); });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindAudMinhas);
  } else {
    setTimeout(bindAudMinhas, 100);
  }
})();

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
  var minhas  = (document.getElementById("aud-minhas") || {}).checked;
  var tipo    = document.getElementById("aud-tipo").value;
  var mes     = document.getElementById("aud-mes").value;

  var filtrados = audLista.filter(function (e) {
    if (tabela && e.tabela !== tabela) return false;
    if (tipo && e.acao !== tipo) return false;
    if (mes && String(e.criado_em || "").slice(0,7) !== mes) return false;
    if (minhas) {
      var meId = (window._terraUser && window._terraUser.id) || (typeof currentUser !== "undefined" && currentUser && currentUser.id) || "";
      if (meId && e.usuario_id !== meId) return false;
    }
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
    var dataCompleta = d[2] + "/" + d[1] + "/" + d[0] + " " + t;
    return '<span title="' + dataCompleta + '">' + fmtTempoRelativo(iso) + '</span>';
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
        abrirDetalheAuditoria(r.data);
      });
    });
  });
}

// -- E7: detalhe rico de auditoria com diff + botão Reverter ---------------
function abrirDetalheAuditoria(d) {
  var antes = d.dados_antes || {};
  var depois = d.dados_depois || {};
  var todos = {};
  Object.keys(antes).forEach(function (k) { todos[k] = true; });
  Object.keys(depois).forEach(function (k) { todos[k] = true; });

  var linhas = Object.keys(todos).sort().map(function (k) {
    var vA = antes[k];
    var vD = depois[k];
    var iguais = JSON.stringify(vA) === JSON.stringify(vD);
    function fmt(v) {
      if (v === null || v === undefined) return '<span class="muted">—</span>';
      if (typeof v === "object") return '<code>' + escHtml(JSON.stringify(v)) + '</code>';
      return escHtml(String(v));
    }
    var cls = iguais ? "" : "destaque-warn";
    return '<tr>' +
      '<td class="mono"><strong>' + escHtml(k) + '</strong></td>' +
      '<td class="' + cls + '">' + fmt(vA) + '</td>' +
      '<td class="' + cls + '">' + fmt(vD) + '</td>' +
      '<td>' + (iguais ? '<span class="muted">=</span>' : '<span class="destaque-warn">≠</span>') + '</td>' +
    '</tr>';
  });

  var info = '<div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 8px 16px; margin-bottom: 14px; font-size: 13px;">' +
    '<div><strong>Tabela:</strong> <code>' + escHtml(d.tabela) + '</code></div>' +
    '<div><strong>Ação:</strong> <code>' + escHtml(d.acao) + '</code></div>' +
    '<div><strong>Registro:</strong> <code>' + escHtml(d.registro_id || "—") + '</code></div>' +
    '<div><strong>Usuário:</strong> ' + escHtml(d.usuario_nome || "—") + '</div>' +
    '<div style="grid-column: 1 / -1;"><strong>Quando:</strong> ' + escHtml(String(d.criado_em || "")) + '</div>' +
  '</div>';

  var tabela = linhas.length
    ? '<table class="tabela"><thead><tr><th>Campo</th><th>Antes</th><th>Depois</th><th>Δ</th></tr></thead><tbody>' + linhas.join("") + '</tbody></table>'
    : '<p class="muted">Sem campos pra comparar.</p>';

  // Botão Reverter — só pra DELETE recentes (até 24h)
  var podeReverter = false;
  if (d.acao === "DELETE" && d.dados_antes) {
    try {
      var horas = (Date.now() - new Date(d.criado_em).getTime()) / 3600000;
      podeReverter = horas <= 24;
    } catch (e) {}
  }
  var btnRev = "";
  if (podeReverter) {
    btnRev = '<div style="margin-top:14px; padding:12px; background: var(--warn-bg); border-left: 3px solid var(--warn); border-radius: 4px;">' +
      '<p style="margin:0 0 8px; font-size:13px;"><strong>Esta acao foi um DELETE de menos de 24h.</strong> Voce pode reverter (re-inserir o registro com os mesmos dados).</p>' +
      '<button class="btn-ouro" id="aud-btn-reverter-' + d.id + '" type="button">↶ Reverter (re-inserir registro)</button>' +
    '</div>';
  } else if (d.acao === "DELETE") {
    btnRev = '<p class="muted" style="margin-top:14px; font-size:12px;">Reverter so esta disponivel para DELETEs feitos nas ultimas 24h.</p>';
  }

  abrirModalDetalhe("Auditoria — " + (d.tabela || "?") + " #" + (d.registro_id || d.id), info + tabela + btnRev);

  // Wire-up do reverter
  if (podeReverter) {
    setTimeout(function () {
      var btn = document.getElementById("aud-btn-reverter-" + d.id);
      if (btn) {
        btn.addEventListener("click", function () {
          if (!confirm("Tem certeza que quer re-inserir este registro?\n\nTabela: " + d.tabela + "\nRegistro original: " + (d.registro_id || "—") + "\n\nO registro vai voltar exatamente como estava antes do DELETE.")) return;
          btn.disabled = true;
          btn.textContent = "Revertendo...";
          // Remove campos de timestamps automaticos pra deixar o banco recriar
          var payload = Object.assign({}, d.dados_antes);
          delete payload.criado_em;
          delete payload.atualizado_em;
          client.from(d.tabela).insert(payload).then(function (r) {
            if (r.error) {
              btn.disabled = false;
              btn.textContent = "↶ Reverter (re-inserir registro)";
              try { toast("Erro ao reverter: " + r.error.message, "erro"); } catch (e) { alert("Erro: " + r.error.message); }
              return;
            }
            try { toast("Registro re-inserido com sucesso.", "ok"); } catch (e) {}
            // Recarrega auditoria
            audCarregado = false;
            carregarAuditoriaSeNecessario();
            // Fecha modal
            var ov = document.getElementById("modal-detalhe-overlay");
            if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
          });
        });
      }
    }, 50);
  }
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
      '<td><button type="button" class="btn-acao" data-cb-edit="' + c.id + '">Editar</button> <button class="btn-limpar" data-cb-del="' + c.id + '" title="Excluir">🗑 Excluir</button></td>' +
    '</tr>';
  }).join("");
  tbody.querySelectorAll("[data-cb-edit]").forEach(function (b) {
    b.addEventListener("click", function () {
      var id = Number(b.getAttribute("data-cb-edit"));
      var c = contasBancariasLista.find(function (x) { return x.id === id; });
      if (c) abrirModalContaBancaria(c);
    });
  tbody.querySelectorAll("[data-cb-del]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var id = btn.getAttribute("data-cb-del");
      var rid = isNaN(Number(id)) ? id : Number(id);
      if (!confirm("Excluir este registro? Essa ação não pode ser desfeita.")) return;
      client.from("contas_bancarias").delete().eq("id", rid).then(function (r) {
        if (r.error) { try { toast("Erro ao excluir: " + r.error.message, "erro"); } catch (e) { alert("Erro ao excluir: " + r.error.message); } return; }
        try { toast("Excluído.", "ok"); } catch (e) {}
        if (typeof carregarContasBancariasSeNecessario === "function") carregarContasBancariasSeNecessario();
      });
    });
  });
  });
}
