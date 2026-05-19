// =========================================================================
// MODULO 09 — IMPORTACOES DE PDF (Onda C)
// Parsers para 5 PDFs (Folha detalhada, IRRF, GFD, Consignado, M19) +
// CRUD Pensao Alimenticia + gerador de Holerite individual PDF.
// =========================================================================

// Configurar worker do pdf.js
(function () {
  function tryConfig() {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    } else {
      setTimeout(tryConfig, 200);
    }
  }
  tryConfig();
})();

var pensoesLista = [];
var pensoesCarregado = false;
var importsLog = [];
var importsCarregado = false;

// =========================================================================
// HELPERS
// =========================================================================
function lerPdfTexto(file) {
  // Retorna Promise<{textoCompleto, paginas: [{texto, linhas}]}>
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () {
      var arr = new Uint8Array(reader.result);
      window.pdfjsLib.getDocument({ data: arr }).promise.then(function (pdf) {
        var promises = [];
        for (var i = 1; i <= pdf.numPages; i++) promises.push(pdf.getPage(i).then(function (p) { return p.getTextContent(); }));
        Promise.all(promises).then(function (conteudos) {
          var paginas = conteudos.map(function (c) {
            // reagrupar items por linha (transform[5] = y)
            var byY = {};
            c.items.forEach(function (it) {
              var y = Math.round(it.transform[5]);
              if (!byY[y]) byY[y] = [];
              byY[y].push({ x: it.transform[4], s: it.str });
            });
            var linhas = Object.keys(byY).map(Number).sort(function (a, b) { return b - a; }).map(function (y) {
              return byY[y].sort(function (a, b) { return a.x - b.x; }).map(function (i) { return i.s; }).join(" ");
            });
            return { texto: linhas.join("\n"), linhas: linhas };
          });
          resolve({
            textoCompleto: paginas.map(function (p) { return p.texto; }).join("\n\n=====PAGINA=====\n\n"),
            paginas: paginas
          });
        }).catch(reject);
      }).catch(reject);
    };
    reader.onerror = function () { reject(reader.error); };
    reader.readAsArrayBuffer(file);
  });
}

function normCpf(cpf) {
  return (cpf || "").replace(/\D/g, "").padStart(11, "0").substring(0, 11);
}

function parseNum(s) {
  // "1.234,56" -> 1234.56
  if (s == null) return 0;
  var t = String(s).replace(/\./g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
  var n = parseFloat(t);
  return isNaN(n) ? 0 : n;
}

function parseTimeToMin(s) {
  // "HH:MM" -> minutos
  if (!s) return 0;
  var m = /^(-?)(\d+):(\d{2})$/.exec(String(s).trim());
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

function detectarTipoPdf(textoCompleto) {
  var t = textoCompleto;
  if (/RELAÇÃO DAS BASES DO IRRF|RELACAO DAS BASES DO IRRF/i.test(t)) return "irrf";
  if (/RELAÇÃO DE BASES DO INSS|RELACAO DE BASES DO INSS/i.test(t)) return "inss";
  if (/RELAÇÃO GERAL DOS LÍQUIDOS|RELACAO GERAL DOS LIQUIDOS/i.test(t)) return "liquido";
  if (/EXTRATO MENSAL.*Empr\.|Empr\.:\s+\d/i.test(t)) return "folha_detalhada";
  if (/Detalhe da Guia Emitida.*FGTS/i.test(t) || (/Relação de Trabalhadores/i.test(t) && /Valor FGTS/i.test(t))) return "fgts_gfd";
  if (/Detalhe da Guia Emitida.*Consignado/i.test(t) || /Valor Consignado/i.test(t)) return "consignado";
  if (/Folha de Ponto/i.test(t) && /DADOS DO COLABORADOR/i.test(t)) return "m19";
  if (/MOVIMENTOS.*PENSAO ALIMENTICIA|PENSAO ALIMENTICIA/i.test(t)) return "pensao";
  return "desconhecido";
}

function buscarFuncionarioPorCpf(cpf) {
  var n = normCpf(cpf);
  return (funcionariosLista || []).find(function (f) { return normCpf(f.cpf) === n; });
}

function nomePdf(tipo) {
  return ({
    folha_detalhada: "Folha de Pagamento detalhada",
    irrf: "Encargos IRRF",
    fgts_gfd: "GFD/FGTS",
    consignado: "Consignado",
    m19: "Folha de Ponto M19",
    inss: "Bases INSS (auxiliar)",
    liquido: "Líquidos (auxiliar)",
    pensao: "Pensão Alimentícia",
    desconhecido: "Desconhecido"
  })[tipo] || tipo;
}

function logImport(payload, cb) {
  client.from("folha_imports_log").insert(payload).then(function (r) { if (cb) cb(r); });
}

// =========================================================================
// PARSERS
// =========================================================================

// --------- Folha de Pagamento detalhada ---------
function parserFolhaDetalhada(texto) {
  // Cada funcionário começa com "Empr.:" — separar em blocos
  var blocos = texto.split(/\n\s*Empr\.:\s+/).slice(1);
  var compMatch = texto.match(/Compet[êe]ncia:\s*(\d{2})\/(\d{4})/);
  var mes = compMatch ? compMatch[2] + "-" + compMatch[1] : null;
  var registros = [];

  blocos.forEach(function (b) {
    // Linha 1: "10 NOME ... Situação: ... CPF: 934.743.933-91 ... Adm: 02/08/2004"
    var head = b.split("\n")[0] || "";
    var mCpf = head.match(/CPF:\s*([\d.\-]+)/);
    if (!mCpf) return;
    var cpf = normCpf(mCpf[1]);
    var mStatus = head.match(/Situa[çc][ãa]o:\s*(\w+)/);

    // Totais: "Proventos: 8.859,58 Descontos: 4.922,67 ... Líquido: 3.936,91"
    var totLine = b.match(/Proventos:\s*([\d.,]+)\s+Descontos:\s*([\d.,]+).*?Líquido:\s*([\d.,]+)/i);
    var basesLine = b.match(/Base INSS:\s*([\d.,]+).*?Base FGTS:\s*([\d.,]+).*?Valor FGTS:\s*([\d.,]+).*?Base IRRF:\s*([\d.,]+)/i);
    var inssLine = b.match(/\b998\b\s+I\.N\.S\.S\.\s+[\d.,]+\s+([\d.,]+)\s*D/);
    var irrfLine = b.match(/\b948\b\s+I\.R\.R\.F\.\s+[\d.,]+\s+([\d.,]+)\s*D/);

    if (!totLine) return;
    var reg = {
      cpf: cpf,
      mes_ref: mes,
      situacao: mStatus ? mStatus[1] : null,
      salario_bruto: parseNum(totLine[1]),
      outros_descontos: 0,
      outros_proventos: 0,
      inss: inssLine ? parseNum(inssLine[1]) : 0,
      irrf: irrfLine ? parseNum(irrfLine[1]) : 0,
      fgts: basesLine ? parseNum(basesLine[3]) : 0,
      liquido: parseNum(totLine[3]),
      base_inss: basesLine ? parseNum(basesLine[1]) : null,
      base_fgts: basesLine ? parseNum(basesLine[2]) : null,
      base_irrf: basesLine ? parseNum(basesLine[4]) : null,
      descontos_total: parseNum(totLine[2]),
      observacoes: null
    };
    // outros_descontos = total - inss - irrf  (aprox)
    reg.outros_descontos = Math.max(0, reg.descontos_total - reg.inss - reg.irrf);
    // outros_proventos = bruto (todos os P) - salario_base (se conhecido) — deixa 0 e ajusta depois
    registros.push(reg);
  });
  return { tipo: "folha_detalhada", mes_ref: mes, registros: registros };
}

// --------- Encargos IRRF ---------
function parserIRRF(texto) {
  var compMatch = texto.match(/Per[ií]odo:\s*\d{2}\/(\d{2})\/(\d{4})/);
  var mes = compMatch ? compMatch[2] + "-" + compMatch[1] : null;
  // Cabeçalho da tabela tem: Código Nome Tipo Base Abatimentos Dependentes ND Ded.Simplificada Taxa Dedução Redução IRRF
  // Cada linha tipo: "10 ADAILTON ... Mensal 12/25  2.031,80  434,05  189,59  1  0,00  0,00  0,00  0,00  0,00"
  var linhas = texto.split("\n");
  var registros = [];
  linhas.forEach(function (ln) {
    // Detectar linhas com tipo conhecido
    var m = ln.match(/^\s*\d+\s+(.+?)\s+(Mensal\s+\d+\/\d+|F[ée]rias|13o\s+\d+\/\d+|Adiant\.\s+\d+\/\d+|Rescis[ãa]o|Fer\.Resc\.|13o\s+Resc\.|13o\b)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+(\d+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/);
    if (!m) return;
    registros.push({
      mes_ref: mes,
      nome: m[1].trim(),
      tipo_evento: m[2].split(/\s/)[0].replace(".", ""),
      base_calculo: parseNum(m[3]),
      abatimentos: parseNum(m[4]),
      dependentes_valor: parseNum(m[5]),
      dependentes_qtd: parseInt(m[6], 10),
      deducao_simplificada: parseNum(m[7]),
      aliquota_pct: parseNum(m[8]),
      deducao: parseNum(m[9]),
      reducao: parseNum(m[10]),
      valor_irrf: parseNum(m[11])
    });
  });
  return { tipo: "irrf", mes_ref: mes, registros: registros };
}

// --------- GFD/FGTS ---------
function parserGFD(texto) {
  var mGuia = texto.match(/N[úu]mero da Guia:\s*([\d\-]+)/);
  var mVenc = texto.match(/Vencimento da Guia:\s*(\d{2}\/\d{2}\/\d{4})/);
  var mEmissao = texto.match(/Data Emiss[ãa]o:\s*(\d{2}\/\d{2}\/\d{4})/);
  var mTotal = texto.match(/Total da Guia.*?([\d.,]+)\s*$/m);
  var mQtd = texto.match(/Qtd\.\s*Trabalhadores FGTS:\s*(\d+)/);
  var competLine = texto.match(/01\/\d{4}|02\/\d{4}|03\/\d{4}|04\/\d{4}|05\/\d{4}|06\/\d{4}|07\/\d{4}|08\/\d{4}|09\/\d{4}|10\/\d{4}|11\/\d{4}|12\/\d{4}/);
  var mes = competLine ? competLine[0].split("/").reverse().join("-") : null;

  function fmtData(br) { var p = br.split("/"); return p[2] + "-" + p[1] + "-" + p[0]; }
  var guia = {
    numero_guia: mGuia ? mGuia[1] : null,
    mes_ref: mes,
    vencimento: mVenc ? fmtData(mVenc[1]) : null,
    data_emissao: mEmissao ? fmtData(mEmissao[1]) : null,
    total_guia: mTotal ? parseNum(mTotal[1]) : null,
    qtd_trabalhadores: mQtd ? parseInt(mQtd[1], 10) : null
  };

  // Items: "01/2026  NOME  MATRICULA  CPF 101 20/02/2026  Mensal  BASE  VALOR ..."
  var items = [];
  var linhas = texto.split("\n");
  linhas.forEach(function (ln) {
    var m = ln.match(/^\s*\d{2}\/\d{4}\s+(.+?)\s+([\d\w]+)\s+(\d{3}\.\d{3}\.\d{3}-\d{2})\s+(\d+)\s+\d{2}\/\d{2}\/\d{4}\s+(\w+)\s+([\d.,]+)\s+([\d.,]+)/);
    if (!m) return;
    items.push({
      nome: m[1].trim(),
      matricula_fgts: m[2],
      cpf: normCpf(m[3]),
      categoria: m[4],
      tipo_deposito: m[5],
      base_remuneracao: parseNum(m[6]),
      valor_fgts: parseNum(m[7])
    });
  });
  return { tipo: "fgts_gfd", mes_ref: mes, guia: guia, registros: items };
}

// --------- Consignado ---------
function parserConsignado(texto) {
  var competLine = texto.match(/01\/\d{4}|02\/\d{4}|03\/\d{4}|04\/\d{4}|05\/\d{4}|06\/\d{4}|07\/\d{4}|08\/\d{4}|09\/\d{4}|10\/\d{4}|11\/\d{4}|12\/\d{4}/);
  var mes = competLine ? competLine[0].split("/").reverse().join("-") : null;
  // Linha: "01/2026  20/02/2026  NOME  MATRICULA  CPF  CONTRATO  INSTITUICAO  VALOR"
  var linhas = texto.split("\n");
  var items = [];
  linhas.forEach(function (ln) {
    var m = ln.match(/^\s*\d{2}\/\d{4}\s+\d{2}\/\d{2}\/\d{4}\s+(.+?)\s+([\d\w]+)\s+(\d{3}\.\d{3}\.\d{3}-\d{2})\s+(\S+)\s+(\d{3})\s+([\d.,]+)\s*$/);
    if (!m) return;
    items.push({
      mes_ref: mes,
      nome: m[1].trim(),
      matricula: m[2],
      cpf: normCpf(m[3]),
      numero_contrato: m[4],
      codigo_banco: m[5],
      valor: parseNum(m[6])
    });
  });
  return { tipo: "consignado", mes_ref: mes, registros: items };
}

// --------- M19 Folha de Ponto ---------
function parserM19(paginas) {
  // Cada página = 1 funcionário
  var registros = [];
  paginas.forEach(function (pag) {
    var t = pag.texto;
    var mCpf = t.match(/CPF:\s*(\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})/);
    var mPeriodo = t.match(/(\d{2})\/(\d{2})\/(\d{4})\s+a\s+\d{2}\/\d{2}\/(\d{4})/);
    var mAtrasos = t.match(/Atrasos:\s+-?(\d+:\d{2})/);
    var mExtras = t.match(/Horas Extras Totais:\s+(\d+:\d{2})/);
    var mDiasFalt = t.match(/Dias Faltosos:\s+(\d+)/);
    if (!mCpf || !mPeriodo) return;
    var cpf = normCpf(mCpf[1]);
    var mes = mPeriodo[3] + "-" + mPeriodo[2];

    // Conta atrasos por dia (linhas com "-HH:MM" no col atraso)
    var atrasoAte30 = 0, atrasoAcima30 = 0;
    var linhas = t.split("\n");
    linhas.forEach(function (ln) {
      var matA = ln.match(/^\s*\d{2}\/\d{2}\s+\w+.*?-(\d{2}):(\d{2})\s*$/);
      if (matA) {
        var min = parseInt(matA[1], 10) * 60 + parseInt(matA[2], 10);
        if (min > 0 && min <= 30) atrasoAte30++;
        else if (min > 30) atrasoAcima30++;
      }
    });
    registros.push({
      cpf: cpf,
      mes_ref: mes,
      faltas_nao_justificadas: mDiasFalt ? parseInt(mDiasFalt[1], 10) : 0,
      atrasos_ate_30min: atrasoAte30,
      atrasos_acima_30min: atrasoAcima30,
      observacoes: "Importado M19 em " + new Date().toISOString().slice(0,10)
        + " | Atrasos total " + (mAtrasos ? mAtrasos[1] : "0:00")
        + " | HE total " + (mExtras ? mExtras[1] : "0:00")
    });
  });
  return { tipo: "m19", registros: registros };
}

// =========================================================================
// UPSERT — grava no banco
// =========================================================================

function upsertFolhaDetalhada(parsed) {
  var ins = 0, upd = 0, err = [];
  var promises = parsed.registros.map(function (reg) {
    var f = buscarFuncionarioPorCpf(reg.cpf);
    if (!f) { err.push("CPF não encontrado: " + reg.cpf); return Promise.resolve(); }
    var payload = {
      funcionario_id: f.id,
      mes_ref: reg.mes_ref,
      salario_bruto: reg.salario_bruto,
      inss: reg.inss, irrf: reg.irrf, fgts: reg.fgts,
      outros_descontos: reg.outros_descontos,
      outros_proventos: reg.outros_proventos,
      liquido: reg.liquido,
      observacoes: "Importado da Folha detalhada Corsi em " + new Date().toISOString().slice(0,10),
      vigente: true
    };
    return client.from("folha_pagamento").select("id").eq("funcionario_id", f.id).eq("mes_ref", reg.mes_ref).then(function (r0) {
      if (r0.data && r0.data[0]) {
        return client.from("folha_pagamento").update(payload).eq("id", r0.data[0].id).then(function (r) { if (!r.error) upd++; else err.push(r.error.message); });
      }
      return client.from("folha_pagamento").insert(payload).then(function (r) { if (!r.error) ins++; else err.push(r.error.message); });
    });
  });
  return Promise.all(promises).then(function () { return { tipo: "folha_detalhada", mes_ref: parsed.mes_ref, ins: ins, upd: upd, err: err, total: parsed.registros.length }; });
}

function upsertIRRF(parsed) {
  // Sempre apaga IRRF anterior do mês e re-importa (substitui)
  return client.from("folha_ir_eventos").delete().eq("mes_ref", parsed.mes_ref).then(function () {
    var rows = parsed.registros.map(function (reg) {
      var f = (funcionariosLista || []).find(function (x) {
        return (x.nome || "").toLowerCase().replace(/\s+/g, " ").trim() === reg.nome.toLowerCase().replace(/\s+/g, " ").trim();
      });
      return {
        funcionario_id: f ? f.id : null,
        cpf: f ? f.cpf : null,
        mes_ref: parsed.mes_ref,
        tipo_evento: reg.tipo_evento,
        base_calculo: reg.base_calculo,
        abatimentos: reg.abatimentos,
        dependentes_valor: reg.dependentes_valor,
        dependentes_qtd: reg.dependentes_qtd,
        deducao_simplificada: reg.deducao_simplificada,
        aliquota_pct: reg.aliquota_pct,
        deducao: reg.deducao,
        reducao: reg.reducao,
        valor_irrf: reg.valor_irrf,
        vigente: true
      };
    });
    return client.from("folha_ir_eventos").insert(rows).then(function (r) {
      return { tipo: "irrf", mes_ref: parsed.mes_ref, ins: rows.length, upd: 0, err: r.error ? [r.error.message] : [], total: rows.length };
    });
  });
}

function upsertGFD(parsed) {
  if (!parsed.guia || !parsed.guia.numero_guia) {
    return Promise.resolve({ tipo: "fgts_gfd", err: ["Número da guia não detectado"], ins: 0, upd: 0, total: 0 });
  }
  return client.from("folha_fgts_guia").upsert(parsed.guia, { onConflict: "numero_guia" }).select().then(function (r) {
    if (r.error) return { tipo: "fgts_gfd", err: [r.error.message], ins: 0, upd: 0, total: 0 };
    var guiaId = r.data[0].id;
    // Remove itens anteriores e re-insere
    return client.from("folha_fgts_guia_itens").delete().eq("guia_id", guiaId).then(function () {
      var rows = parsed.registros.map(function (it) {
        var f = buscarFuncionarioPorCpf(it.cpf);
        return {
          guia_id: guiaId,
          funcionario_id: f ? f.id : null,
          cpf: it.cpf,
          matricula_fgts: it.matricula_fgts,
          categoria: it.categoria,
          tipo_deposito: it.tipo_deposito,
          base_remuneracao: it.base_remuneracao,
          valor_fgts: it.valor_fgts
        };
      });
      return client.from("folha_fgts_guia_itens").insert(rows).then(function (r2) {
        // Atualiza matricula_fgts em funcionarios
        var updProm = parsed.registros.map(function (it) {
          var f = buscarFuncionarioPorCpf(it.cpf);
          if (f && it.matricula_fgts && f.matricula_fgts !== it.matricula_fgts) {
            return client.from("funcionarios").update({ matricula_fgts: it.matricula_fgts }).eq("id", f.id);
          }
          return Promise.resolve();
        });
        return Promise.all(updProm).then(function () {
          return { tipo: "fgts_gfd", mes_ref: parsed.mes_ref, ins: rows.length, upd: 0, err: r2.error ? [r2.error.message] : [], total: rows.length };
        });
      });
    });
  });
}

function upsertConsignado(parsed) {
  var ins = 0, upd = 0, err = [];
  var promises = parsed.registros.map(function (it) {
    var f = buscarFuncionarioPorCpf(it.cpf);
    if (!f) { err.push("CPF não encontrado: " + it.cpf); return Promise.resolve(); }
    // Upsert contrato
    return client.from("consignados").select("id").eq("funcionario_id", f.id).eq("numero_contrato", it.numero_contrato).then(function (r0) {
      var cId;
      var p = r0.data && r0.data[0]
        ? Promise.resolve({ data: r0.data })
        : client.from("consignados").insert({
            funcionario_id: f.id,
            numero_contrato: it.numero_contrato,
            codigo_banco: it.codigo_banco,
            instituicao: it.codigo_banco === "341" ? "Itaú" : (it.codigo_banco === "079" ? "Original" : ("Banco " + it.codigo_banco)),
            status: "ativo"
          }).select();
      return p.then(function (rc) {
        if (rc.error) { err.push(rc.error.message); return; }
        cId = (rc.data && rc.data[0] && rc.data[0].id) || (r0.data[0] && r0.data[0].id);
        if (!cId) return;
        return client.from("consignados_parcelas").upsert({
          consignado_id: cId,
          mes_ref: it.mes_ref,
          valor: it.valor
        }, { onConflict: "consignado_id,mes_ref" }).then(function (rp) {
          if (rp.error) err.push(rp.error.message);
          else ins++;
        });
      });
    });
  });
  return Promise.all(promises).then(function () { return { tipo: "consignado", mes_ref: parsed.mes_ref, ins: ins, upd: upd, err: err, total: parsed.registros.length }; });
}

function upsertM19(parsed) {
  var ins = 0, upd = 0, err = [];
  var promises = parsed.registros.map(function (reg) {
    var f = buscarFuncionarioPorCpf(reg.cpf);
    if (!f) { err.push("CPF não encontrado: " + reg.cpf); return Promise.resolve(); }
    var payload = {
      funcionario_id: f.id,
      mes_ref: reg.mes_ref,
      faltas_nao_justificadas: reg.faltas_nao_justificadas,
      atrasos_ate_30min: reg.atrasos_ate_30min,
      atrasos_acima_30min: reg.atrasos_acima_30min,
      observacoes: reg.observacoes
    };
    return client.from("frequencia_mensal").select("id,faltas_justificadas").eq("funcionario_id", f.id).eq("mes_ref", reg.mes_ref).then(function (r0) {
      if (r0.data && r0.data[0]) {
        // Preserva faltas_justificadas existentes (vêm de atestados/afastamentos da Onda B)
        payload.faltas_justificadas = r0.data[0].faltas_justificadas;
        return client.from("frequencia_mensal").update(payload).eq("id", r0.data[0].id).then(function (r) { if (!r.error) upd++; else err.push(r.error.message); });
      }
      payload.faltas_justificadas = 0;
      return client.from("frequencia_mensal").insert(payload).then(function (r) { if (!r.error) ins++; else err.push(r.error.message); });
    });
  });
  return Promise.all(promises).then(function () { return { tipo: "m19", mes_ref: parsed.registros[0] && parsed.registros[0].mes_ref, ins: ins, upd: upd, err: err, total: parsed.registros.length }; });
}

// =========================================================================
// DISPATCHER — recebe File e processa
// =========================================================================

function processarPdf(file) {
  return lerPdfTexto(file).then(function (data) {
    var tipo = detectarTipoPdf(data.textoCompleto);
    var parsed;
    switch (tipo) {
      case "folha_detalhada": parsed = parserFolhaDetalhada(data.textoCompleto); return upsertFolhaDetalhada(parsed);
      case "irrf":            parsed = parserIRRF(data.textoCompleto);            return upsertIRRF(parsed);
      case "fgts_gfd":        parsed = parserGFD(data.textoCompleto);             return upsertGFD(parsed);
      case "consignado":      parsed = parserConsignado(data.textoCompleto);      return upsertConsignado(parsed);
      case "m19":             parsed = parserM19(data.paginas);                   return upsertM19(parsed);
      default:                return Promise.resolve({ tipo: tipo, err: ["Tipo não reconhecido"], total: 0 });
    }
  }).then(function (result) {
    result.arquivo_nome = file.name;
    return logImport({
      tipo_pdf: result.tipo,
      mes_ref: result.mes_ref,
      arquivo_nome: file.name,
      registros_processados: result.total || 0,
      registros_inseridos: result.ins || 0,
      registros_atualizados: result.upd || 0,
      registros_erro: (result.err || []).length,
      erros_resumo: (result.err || []).slice(0, 5).join("; ")
    }).then(function () { return result; });
  });
}

// =========================================================================
// TELA: rh_imports_pdf
// =========================================================================

function carregarImportsSeNecessario() {
  if (!funcionariosCarregado) carregarFuncionariosSeNecessario();
  if (importsCarregado) { renderImportsHist(); return; }
  Promise.all([
    client.from("folha_imports_log").select("*").order("criado_em", { ascending: false }).limit(50),
    client.from("folha_pagamento").select("id", { count: "exact", head: true }),
    client.from("folha_ir_eventos").select("id", { count: "exact", head: true }),
    client.from("folha_fgts_guia").select("id", { count: "exact", head: true }),
    client.from("frequencia_mensal").select("id", { count: "exact", head: true })
  ]).then(function (rs) {
    importsLog = (rs[0] && rs[0].data) || [];
    valText(document.getElementById("im-m-folha"), fmtInt((rs[1] && rs[1].count) || 0));
    valText(document.getElementById("im-m-irrf"),  fmtInt((rs[2] && rs[2].count) || 0));
    valText(document.getElementById("im-m-fgts"),  fmtInt((rs[3] && rs[3].count) || 0));
    valText(document.getElementById("im-m-freq"),  fmtInt((rs[4] && rs[4].count) || 0));
    importsCarregado = true;
    renderImportsHist();
  });
}

function renderImportsHist() {
  var tbody = document.getElementById("im-hist-tbody"); if (!tbody) return;
  if (!importsLog.length) { tbody.innerHTML = '<tr><td colspan="7" class="tbl-vazio">Sem importações ainda.</td></tr>'; return; }
  preencherTbody(tbody, importsLog.map(function (l) {
    return '<tr>' +
      '<td>' + (l.criado_em ? new Date(l.criado_em).toLocaleString("pt-BR") : "—") + '</td>' +
      '<td>' + escHtml(nomePdf(l.tipo_pdf)) + '</td>' +
      '<td>' + escHtml(l.arquivo_nome || "—") + '</td>' +
      '<td>' + escHtml(l.mes_ref || "—") + '</td>' +
      '<td class="num">' + fmtInt(l.registros_inseridos) + '</td>' +
      '<td class="num">' + fmtInt(l.registros_atualizados) + '</td>' +
      '<td class="num">' + (l.registros_erro ? '<span class="badge-tipo" style="background:#c44">'+l.registros_erro+'</span>' : '0') + '</td>' +
    '</tr>';
  }), 7);
  try { setupTopScrollFor(document.querySelector('[data-page="rh_imports_pdf"] .table-wrap-x')); } catch (e) {}
}

function processarArquivosSelecionados() {
  var inp = document.getElementById("im-arquivos");
  var st  = document.getElementById("im-status");
  if (!inp || !inp.files.length) { alert("Selecione pelo menos um PDF."); return; }
  if (!window.pdfjsLib) { alert("Biblioteca pdf.js ainda carregando — aguarde 2s e tente de novo."); return; }
  var files = Array.from(inp.files);
  st.innerHTML = '<div style="padding:8px;background:var(--bg2);border-radius:6px">Processando ' + files.length + ' arquivo(s)…</div>';
  var resultados = [];
  var sequencial = Promise.resolve();
  files.forEach(function (f) {
    sequencial = sequencial.then(function () {
      st.innerHTML += '<div style="padding:4px 8px">⏳ ' + escHtml(f.name) + '…</div>';
      return processarPdf(f).then(function (r) {
        resultados.push(r);
        var icone = (r.err && r.err.length) ? "⚠️" : "✅";
        st.innerHTML += '<div style="padding:4px 8px">' + icone + ' ' + escHtml(f.name) + ' — <strong>' + nomePdf(r.tipo) + '</strong>: ' + (r.ins||0) + ' inseridos, ' + (r.upd||0) + ' atualizados' + ((r.err||[]).length ? ', ' + r.err.length + ' erro(s)' : '') + (r.mes_ref ? ' (' + r.mes_ref + ')' : '') + '</div>';
      }).catch(function (e) {
        st.innerHTML += '<div style="padding:4px 8px;color:#c44">❌ ' + escHtml(f.name) + ' — erro: ' + escHtml(e.message || e) + '</div>';
      });
    });
  });
  sequencial.then(function () {
    st.innerHTML += '<div style="padding:8px;margin-top:8px;background:var(--bg3);border-radius:6px"><strong>Concluído.</strong></div>';
    importsCarregado = false;
    carregarImportsSeNecessario();
    try { toast("Importações processadas.", "ok"); } catch (e) {}
  });
}

// =========================================================================
// PENSAO ALIMENTICIA — CRUD
// =========================================================================

function carregarPensoesSeNecessario() {
  if (!funcionariosCarregado) carregarFuncionariosSeNecessario();
  if (pensoesCarregado) { renderPensoes(); return; }
  client.from("pensoes_alimenticias").select("*").order("criado_em", { ascending: false }).then(function (r) {
    if (r.error) { document.getElementById("pe-tbody").innerHTML = '<tr><td colspan="9" class="tbl-vazio erro">Erro: '+escHtml(r.error.message)+'</td></tr>'; return; }
    pensoesLista = r.data || [];
    pensoesCarregado = true;
    renderPensoes();
  });
}

function renderPensoes() {
  var tbody = document.getElementById("pe-tbody"); if (!tbody) return;
  var busca = (document.getElementById("pe-busca").value || "").trim().toLowerCase();
  var status = document.getElementById("pe-status").value;
  var filtrados = (pensoesLista || []).filter(function (p) {
    if (status === "ativas" && !p.ativo) return false;
    if (status === "inativas" && p.ativo) return false;
    var nome = nomeFuncionarioById(p.funcionario_id);
    return matchBusca(busca, [nome, p.beneficiario_nome, p.numero_processo]);
  });
  valText(document.getElementById("pe-m-ativas"), fmtInt(pensoesLista.filter(function (p) { return p.ativo; }).length));
  valText(document.getElementById("pe-lbl"), filtrados.length + " de " + pensoesLista.length);
  preencherTbody(tbody, filtrados.map(function (p) {
    return '<tr>' +
      '<td>' + escHtml(nomeFuncionarioById(p.funcionario_id)) + '</td>' +
      '<td>' + escHtml(p.beneficiario_nome) + '</td>' +
      '<td>' + escHtml(p.parentesco || "—") + '</td>' +
      '<td class="mono">' + escHtml(p.rubrica_codigo || "—") + (p.rubrica_descricao ? '<br><small>'+escHtml(p.rubrica_descricao.substring(0,40))+'</small>' : '') + '</td>' +
      '<td class="num">' + (p.percentual ? p.percentual.toFixed(2)+"%" : "—") + '</td>' +
      '<td class="num">' + (p.valor_fixo ? fmtBRL(p.valor_fixo) : "—") + '</td>' +
      '<td>' + fmtData(p.data_inicio) + '</td>' +
      '<td>' + (p.ativo ? '<span class="badge-tipo solta">ativa</span>' : '<span class="badge-tipo">inativa</span>') + '</td>' +
      '<td><button class="btn-limpar" data-pe-edit="' + p.id + '">Editar</button> <button class="btn-limpar" data-pe-del="' + p.id + '">🗑</button></td>' +
    '</tr>';
  }), 9);
  tbody.querySelectorAll("[data-pe-edit]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-pe-edit"));
      var p = pensoesLista.find(function (x) { return x.id === id; });
      if (p) abrirModalPensao(p);
    });
  });
  tbody.querySelectorAll("[data-pe-del]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var id = Number(btn.getAttribute("data-pe-del"));
      if (!confirm("Excluir essa pensão?")) return;
      client.from("pensoes_alimenticias").delete().eq("id", id).then(function (r) {
        if (r.error) { alert(r.error.message); return; }
        pensoesCarregado = false; carregarPensoesSeNecessario();
      });
    });
  });
  try { setupTopScrollFor(document.querySelector('[data-page="rh_pensoes"] .table-wrap-x')); } catch (e) {}
}

function abrirModalPensao(p) {
  p = p || {};
  var editar = !!p.id;
  abrirModal({
    titulo: editar ? "Editar pensão" : "Nova pensão alimentícia",
    fields: [
      { group: "Funcionário", name: "funcionario_id", label: "Funcionário (devedor)", type: "select", valor: p.funcionario_id || "", options: opcoesFuncionarioSelect(), required: true },
      { group: "Beneficiário", name: "beneficiario_nome", label: "Nome do beneficiário", type: "text", valor: p.beneficiario_nome, required: true },
      { group: "Beneficiário", name: "beneficiario_cpf", label: "CPF do beneficiário", type: "text", valor: p.beneficiario_cpf },
      { group: "Beneficiário", name: "parentesco", label: "Parentesco", type: "select", valor: p.parentesco || "Filho(a)", options: ["Filho(a)","Enteado(a)","Ex-cônjuge","Pai/Mãe","Outro"] },
      { group: "Cálculo", name: "rubrica_codigo", label: "Rubrica (cód Corsi)", type: "select", valor: p.rubrica_codigo || "219", options: [
        {value:"209",label:"209 — S/ incidência HE"},
        {value:"216",label:"216 — Líq. INSS-IR"},
        {value:"219",label:"219 — Dedução IR"},
        {value:"outra",label:"Outra"}
      ]},
      { group: "Cálculo", name: "base_calculo", label: "Base de cálculo", type: "select", valor: p.base_calculo || "salario_bruto", options: [
        {value:"salario_bruto",label:"Salário bruto"},
        {value:"liquido_inss_ir",label:"Líquido (após INSS+IR)"},
        {value:"liquido_inss",label:"Líquido (após INSS apenas)"},
        {value:"outro",label:"Outro"}
      ]},
      { group: "Cálculo", name: "percentual", label: "Percentual (ex: 30 = 30%)", type: "number", valor: p.percentual },
      { group: "Cálculo", name: "valor_fixo", label: "Valor fixo (R$) — se aplicável", type: "number", valor: p.valor_fixo },
      { group: "Conta", name: "conta_credito", label: "Conta crédito do beneficiário (banco/agência/conta)", type: "text", valor: p.conta_credito },
      { group: "Decisão Judicial", name: "data_decisao", label: "Data da decisão", type: "date", valor: p.data_decisao },
      { group: "Decisão Judicial", name: "numero_processo", label: "Número do processo", type: "text", valor: p.numero_processo },
      { group: "Vigência", name: "data_inicio", label: "Data início", type: "date", valor: p.data_inicio, required: true },
      { group: "Vigência", name: "data_fim", label: "Data fim (vazio se vigente)", type: "date", valor: p.data_fim },
      { group: "Vigência", name: "ativo", label: "Status", type: "select", valor: p.ativo === false ? "0" : "1", options: [{value:"1",label:"Ativa"},{value:"0",label:"Inativa"}] },
      { group: "Observações", name: "observacoes", label: "Observações", type: "textarea", valor: p.observacoes }
    ],
    onSubmit: function (v, done) {
      var payload = {
        funcionario_id: Number(v.funcionario_id),
        beneficiario_nome: v.beneficiario_nome,
        beneficiario_cpf: v.beneficiario_cpf || null,
        parentesco: v.parentesco || null,
        rubrica_codigo: v.rubrica_codigo,
        rubrica_descricao: ({ "209": "PENSAO ALIMENTICIA - S/ INC HE", "216": "PENSAO ALIMENTICIA - LÍQ INSS-IR", "219": "PENSAO ALIMENTICIA DEDUCAO IR" })[v.rubrica_codigo] || null,
        base_calculo: v.base_calculo,
        percentual: v.percentual ? Number(v.percentual) : null,
        valor_fixo: v.valor_fixo ? Number(v.valor_fixo) : null,
        conta_credito: v.conta_credito || null,
        data_decisao: v.data_decisao || null,
        numero_processo: v.numero_processo || null,
        data_inicio: v.data_inicio,
        data_fim: v.data_fim || null,
        ativo: v.ativo === "1",
        observacoes: v.observacoes || null
      };
      var q = editar
        ? client.from("pensoes_alimenticias").update(payload).eq("id", p.id)
        : client.from("pensoes_alimenticias").insert(payload);
      q.then(function (r) {
        if (r.error) { done(r.error.message); return; }
        pensoesCarregado = false; carregarPensoesSeNecessario();
        done(null);
      });
    }
  });
}

// =========================================================================
// HOLERITE INDIVIDUAL PDF (no estilo do extrato Corsi)
// =========================================================================

function gerarHoleritePDF(f, mesRef) {
  var jspdfNS = window.jspdf || window.jsPDF;
  if (!jspdfNS) { alert("jsPDF não carregado."); return; }
  var jsPDF = jspdfNS.jsPDF || jspdfNS;
  Promise.all([
    client.from("folha_pagamento").select("*").eq("funcionario_id", f.id).eq("mes_ref", mesRef),
    client.from("folha_pagamento_rubricas").select("*,rubricas(nome,tipo)")
  ]).then(function (rs) {
    var folha = rs[0].data && rs[0].data[0];
    if (!folha) { alert("Sem folha para " + (f.nome || "funcionário") + " em " + mesRef); return; }
    var rubricasFolha = (rs[1].data || []).filter(function (r) { return r.folha_id === folha.id; });

    var doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    var pageW = 210, pageH = 297, margin = 14;
    var y = margin;
    var marromEscuro = [78, 52, 34];
    var marromMedio = [139, 102, 73];

    function esc(s) { return s == null ? "" : String(s); }

    // Cabeçalho
    doc.setFillColor(marromEscuro[0], marromEscuro[1], marromEscuro[2]);
    doc.rect(0, 0, pageW, 22, "F");
    doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(14);
    doc.text("HOLERITE — RECIBO DE PAGAMENTO DE SALÁRIO", margin, 10);
    doc.setFont("helvetica","normal"); doc.setFontSize(9);
    doc.text("Terra Conttemporânea Móveis Ltda · CNPJ 64.892.615/0001-52", margin, 16);
    doc.setFontSize(8);
    doc.text("Competência: " + mesRef, pageW - margin, 10, { align: "right" });
    doc.text("Emitido em " + new Date().toLocaleDateString("pt-BR"), pageW - margin, 16, { align: "right" });
    y = 28;

    // Empregado
    doc.setTextColor(40,40,40); doc.setFont("helvetica","bold"); doc.setFontSize(10);
    doc.text(esc(f.nome).toUpperCase(), margin, y); y += 5;
    doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(80,80,80);
    var info = [
      "CPF " + (f.cpf || "—"),
      "Cargo: " + (f.cargo || "—"),
      "Admissão: " + (f.data_admissao || "—"),
      "Salário base: R$ " + Number(f.salario_base || 0).toFixed(2)
    ];
    doc.text(info.join("  ·  "), margin, y); y += 6;

    // Linha
    doc.setDrawColor(marromMedio[0],marromMedio[1],marromMedio[2]);
    doc.line(margin, y, pageW - margin, y); y += 4;

    // Cabeçalho da tabela P/D
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setFillColor(marromMedio[0],marromMedio[1],marromMedio[2]); doc.setTextColor(255,255,255);
    var colW = (pageW - 2 * margin) / 2;
    doc.rect(margin, y, colW, 5, "F");
    doc.rect(margin + colW, y, colW, 5, "F");
    doc.text("PROVENTOS", margin + 2, y + 3.7);
    doc.text("DESCONTOS", margin + colW + 2, y + 3.7);
    y += 7;
    doc.setTextColor(40,40,40); doc.setFont("helvetica","normal"); doc.setFontSize(8.5);

    // Rubricas
    var proventos = rubricasFolha.filter(function (r) { return r.rubricas && r.rubricas.tipo === "P"; });
    var descontos = rubricasFolha.filter(function (r) { return r.rubricas && r.rubricas.tipo === "D"; });
    var maxRows = Math.max(proventos.length, descontos.length, 1);
    for (var i = 0; i < maxRows; i++) {
      var p = proventos[i];
      var d = descontos[i];
      if (p) doc.text(esc(p.rubricas.nome) + "  ·  R$ " + Number(p.valor).toFixed(2), margin + 1, y);
      if (d) doc.text(esc(d.rubricas.nome) + "  ·  R$ " + Number(d.valor).toFixed(2), margin + colW + 1, y);
      y += 4;
    }
    // Caso não haja rubricas, mostra só os totais
    if (!rubricasFolha.length) {
      doc.text("Salário bruto · R$ " + Number(folha.salario_bruto || 0).toFixed(2), margin + 1, y);
      var dl = "";
      if (folha.inss) doc.text("INSS · R$ " + Number(folha.inss).toFixed(2), margin + colW + 1, y);
      y += 4;
      if (folha.irrf) { doc.text("IRRF · R$ " + Number(folha.irrf).toFixed(2), margin + colW + 1, y); y += 4; }
      if (folha.outros_descontos) { doc.text("Outros · R$ " + Number(folha.outros_descontos).toFixed(2), margin + colW + 1, y); y += 4; }
    }
    y += 4;
    // Totalizadores
    doc.setFont("helvetica","bold"); doc.setFontSize(10);
    doc.text("Total Proventos: R$ " + Number(folha.salario_bruto || 0).toFixed(2), margin + 1, y);
    doc.text("Total Descontos: R$ " + Number(folha.outros_descontos + (folha.inss||0) + (folha.irrf||0) + (folha.fgts||0)).toFixed(2), margin + colW + 1, y);
    y += 6;
    doc.setFontSize(12); doc.setTextColor(marromEscuro[0],marromEscuro[1],marromEscuro[2]);
    doc.text("LÍQUIDO A RECEBER: R$ " + Number(folha.liquido || 0).toFixed(2), margin, y);
    y += 8;

    doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.setTextColor(80,80,80);
    doc.text("Base INSS: R$ " + Number(folha.base_inss || 0).toFixed(2) + "  ·  Base FGTS: R$ " + Number(folha.base_fgts || 0).toFixed(2) + "  ·  Valor FGTS: R$ " + Number(folha.fgts || 0).toFixed(2) + "  ·  Base IRRF: R$ " + Number(folha.base_irrf || 0).toFixed(2), margin, y);
    y += 12;
    doc.text("___________________________________", margin, y); y += 4;
    doc.text("Assinatura do empregado", margin, y);
    doc.text("___________________________________", pageW - margin - 60, y - 4); 
    doc.text("Terra Conttemporânea", pageW - margin - 60, y);

    doc.setFontSize(7); doc.setTextColor(140,120,100);
    doc.text("Holerite gerado pelo Sistema Terra · " + new Date().toLocaleString("pt-BR"), margin, pageH - 8);

    var safe = (f.nome || "func").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").toLowerCase();
    doc.save("holerite-" + safe + "-" + mesRef + ".pdf");
    try { toast("Holerite gerado.", "ok"); } catch (e) {}
  });
}

// =========================================================================
// LISTENERS
// =========================================================================
(function () {
  function bindOnce(id, ev, fn) {
    var el = document.getElementById(id);
    if (el && !el.__bound_terra) { el.addEventListener(ev, fn); el.__bound_terra = true; }
  }
  document.addEventListener("DOMContentLoaded", function () {
    bindOnce("im-btn-processar", "click", processarArquivosSelecionados);

    bindOnce("pe-btn-novo", "click", function () { abrirModalPensao(null); });
    bindOnce("pe-busca",   "input", function () { try { renderPensoes(); } catch (e) {} });
    bindOnce("pe-status",  "change", function () { try { renderPensoes(); } catch (e) {} });
  });
})();
