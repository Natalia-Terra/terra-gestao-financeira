/**
 * Terra Conttemporânea — Gestão Financeira
 * Módulo: 08 extensoes bonus backup
 * Parte 8/8 do refator M1 (app.js antigo: linhas 11267-12922)
 *
 * AVISO: gerado pela divisão automática de app.js.
 * Edições devem preservar a ORDEM das funções (algumas dependem de
 * declarações anteriores e overrides posteriores).
 */

"use strict";


// ===========================================================================
// M22+M23 — Cálculo REAL do Bônus Individual via RPC
// Adiciona um botão "Calcular Bônus Real" na tela existente bonus_indiv_detalhe
// que chama fn_calcular_bonus_total e mostra o resultado em modal.
// ===========================================================================

function abrirCalculoBonusReal(funcionarioId, nomeFuncionario) {
  if (!funcionarioId) { alert("Selecione um funcionário."); return; }
  // Determinar período (semestre atual por default)
  var hoje = new Date();
  var ano = hoje.getFullYear();
  var mes = hoje.getMonth() + 1;
  var inicio = mes <= 6 ? ano + "-01-01" : ano + "-07-01";
  var fim = mes <= 6 ? ano + "-06-30" : ano + "-12-31";

  abrirModalDetalhe("Bônus Individual — Cálculo Real (carregando…)",
    '<p class="muted">Calculando via fn_calcular_bonus_total…</p>');

  client.rpc("fn_calcular_bonus_total", {
    p_funcionario_id: funcionarioId,
    p_inicio: inicio,
    p_fim: fim,
    p_pct_ll: 0.10
  }).then(function (r) {
    if (r.error) {
      abrirModalDetalhe("Bônus — Erro", '<p class="muted">' + escHtml(r.error.message) + '</p>');
      return;
    }
    var d = r.data;
    var html = '<div class="finding info" style="margin:0 0 12px;"><strong>' + escHtml(d.funcionario_nome || nomeFuncionario || "—") + '</strong> · período ' + d.periodo_inicio + ' a ' + d.periodo_fim + '</div>';

    // Cards das 3 esferas
    html += '<div class="grid-metrics" style="margin-bottom:12px;">';
    html += '<div class="metric-card"><div class="metric-label">Profissional</div><div class="metric-value">' + d.esferas.profissional.esfera_profissional_pct + '%</div><div class="metric-sub">de ' + d.esferas.profissional.esfera_profissional_max_pct + '%</div></div>';
    html += '<div class="metric-card"><div class="metric-label">Área</div><div class="metric-value">' + d.esferas.area.esfera_area_pct + '%</div><div class="metric-sub">de ' + d.esferas.area.esfera_area_max_pct + '%</div></div>';
    html += '<div class="metric-card"><div class="metric-label">Empresa</div><div class="metric-value">' + d.esferas.empresa.esfera_empresa_pct + '%</div><div class="metric-sub">de ' + d.esferas.empresa.esfera_empresa_max_pct + '%</div></div>';
    html += '<div class="metric-card" style="border-left-color: var(--ouro);"><div class="metric-label">TOTAL</div><div class="metric-value">' + d.pct_total + '%</div><div class="metric-sub">de 100%</div></div>';
    html += '</div>';

    // Card de valor estimado
    html += '<div class="card" style="background:var(--bg3); padding:12px; margin-bottom:12px;">';
    html += '<strong>💰 Bônus estimado:</strong> ' + fmtBRL(d.valor_estimado);
    html += '<div class="muted" style="font-size:12px; margin-top:4px;">Pool ajustado R$ ' + fmtBRLNum(d.pool.pool_ajustado) + ' (multiplicador ' + d.pool.multiplicador + 'x da margem ' + d.pool.margem_pct + '%) ÷ ' + d.pool.qtd_elegiveis + ' elegíveis = R$ ' + fmtBRLNum(d.pool.valor_por_pessoa_100pct) + '/pessoa @ 100%, × ' + d.pct_total + '% atingido</div>';
    html += '</div>';

    // Detalhe Profissional
    var prof = d.esferas.profissional.detalhe;
    html += '<details open><summary><strong>Esfera Profissional (40%)</strong></summary>';
    html += '<table class="tabela"><thead><tr><th>Componente</th><th class="num">Atingido</th><th class="num">Máximo</th><th>Detalhe</th></tr></thead><tbody>';
    html += '<tr><td>1. Conduta</td><td class="num">' + prof.conduta.pct + '%</td><td class="num">' + prof.conduta.pct_max + '%</td><td>' + prof.conduta.qtd_medidas + ' medida(s) disciplinar(es) no período</td></tr>';
    html += '<tr><td>2. Avaliação de Performance</td><td class="num">' + prof.avaliacao.pct + '%</td><td class="num">' + prof.avaliacao.pct_max + '%</td><td>' + (prof.avaliacao.nota !== null ? "Nota " + prof.avaliacao.nota : '<span class="muted">sem avaliação no período</span>') + '</td></tr>';
    var freqMsg = prof.faltas_justificadas.frequencia_disponivel ? "" : ' <span class="muted">(aguardando dados de frequência)</span>';
    html += '<tr><td>3. Faltas Justificadas</td><td class="num">' + prof.faltas_justificadas.pct + '%</td><td class="num">' + prof.faltas_justificadas.pct_max + '%</td><td>' + prof.faltas_justificadas.qtd + ' falta(s)' + freqMsg + '</td></tr>';
    html += '<tr><td>4. Atrasos</td><td class="num">' + prof.atrasos.pct + '%</td><td class="num">' + prof.atrasos.pct_max + '%</td><td>' + prof.atrasos.qtd + ' atraso(s)' + freqMsg + '</td></tr>';
    html += '<tr><td>Penalidade — Faltas Injustificadas</td><td class="num text-danger">' + prof.faltas_injustificadas.penalidade_pct + '%</td><td class="num">−12,5%</td><td>' + prof.faltas_injustificadas.qtd + ' falta(s) injustificada(s)' + freqMsg + '</td></tr>';
    html += '</tbody></table></details>';

    // Detalhe Área
    var area = d.esferas.area.detalhe;
    html += '<details style="margin-top:12px;"><summary><strong>Esfera Área (30%)</strong></summary>';
    if (area.sem_dados) {
      html += '<p class="muted" style="margin:8px 0;">Nenhuma meta de área cadastrada para o organograma do funcionário neste período.</p>';
    } else {
      html += '<p>' + area.qtd_metas + ' meta(s) cadastrada(s). ' + area.meses_atingidos + ' meses atingidos de ' + (area.qtd_metas * area.meses_periodo) + ' possíveis (' + area.pct_atingido_metas + '%).</p>';
    }
    html += '</details>';

    // Detalhe Empresa
    var emp = d.esferas.empresa.detalhe;
    html += '<details style="margin-top:12px;"><summary><strong>Esfera Empresa (30%)</strong></summary>';
    html += '<table class="tabela"><thead><tr><th>Indicador</th><th class="num">Atingido</th><th class="num">Máximo</th><th>Detalhe</th></tr></thead><tbody>';
    html += '<tr><td>Faturamento Bruto</td><td class="num">' + emp.faturamento.pct + '%</td><td class="num">' + emp.faturamento.pct_max + '%</td><td>' + (emp.faturamento.meta ? "Meta " + fmtBRL(emp.faturamento.meta) + ", realizado " + fmtBRL(emp.faturamento.realizado) + " (" + (emp.faturamento.pct_meta || 0) + "%)" : '<span class="muted">meta não cadastrada</span>') + '</td></tr>';
    html += '<tr><td>Margem Líquida</td><td class="num">' + emp.margem_liquida.pct + '%</td><td class="num">' + emp.margem_liquida.pct_max + '%</td><td>' + emp.margem_liquida.meses_atingidos + ' mês(es) atingidos da meta de ' + emp.margem_liquida.meta_pct + '% margem</td></tr>';
    html += '<tr><td>Caixa Positivo</td><td class="num">' + emp.caixa_positivo.pct + '%</td><td class="num">' + emp.caixa_positivo.pct_max + '%</td><td>' + emp.caixa_positivo.meses_positivos + ' mês(es) positivos de ' + emp.caixa_positivo.meses_periodo + '</td></tr>';
    html += '<tr><td>ICC (cobertura 6m)</td><td class="num">' + emp.icc.pct + '%</td><td class="num">' + emp.icc.pct_max + '%</td><td>Saldo cobre compromissos próximos 6m?</td></tr>';
    html += '</tbody></table></details>';

    // Substitui o conteúdo do modal
    var ov = document.getElementById("modal-detalhe-overlay");
    if (ov) {
      var titulo = ov.querySelector("h2");
      if (titulo) titulo.textContent = "Bônus Individual — " + (d.funcionario_nome || "");
      var body = ov.querySelector(".modal-detalhe-body");
      if (body) body.innerHTML = html;
    }
  });
}

// Helper formato BRL como número (sem prefixo)
if (typeof fmtBRLNum !== "function") {
  window.fmtBRLNum = function (v) {
    var n = Number(v || 0);
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
}

// ===========================================================================
// Drill-down em Funcionários — abrir histórico de Medidas + Avaliações
// ===========================================================================
function abrirHistoricoRH(funcionarioId, nomeFuncionario) {
  if (!funcionarioId) return;
  abrirModalDetalhe("Histórico de RH — " + (nomeFuncionario || ""), '<p class="muted">Carregando…</p>');

  Promise.all([
    client.from("medidas_disciplinares").select("*").eq("funcionario_id", funcionarioId).order("data", { ascending: false }),
    client.from("avaliacao_desempenho").select("*").eq("funcionario_id", funcionarioId).order("data_avaliacao", { ascending: false, nullsLast: true })
  ]).then(function (rs) {
    var medidas = (rs[0].data || []).filter(function (m) { return m.status_medida !== "cancelada"; });
    var avals = (rs[1].data || []).filter(function (a) { return a.status_avaliacao !== "arquivada"; });

    var html = '<div class="grid-metrics" style="margin-bottom:12px;">';
    html += '<div class="metric-card"><div class="metric-label">Medidas Disciplinares</div><div class="metric-value">' + medidas.length + '</div></div>';
    html += '<div class="metric-card"><div class="metric-label">Avaliações</div><div class="metric-value">' + avals.length + '</div></div>';
    var ultimaNota = avals.length ? (avals[0].nota || _calcMedia5(avals[0])) : null;
    html += '<div class="metric-card"><div class="metric-label">Última nota</div><div class="metric-value">' + (ultimaNota ? Number(ultimaNota).toFixed(2) : "—") + '</div></div>';
    html += '</div>';

    // Medidas
    html += '<details open><summary><strong>Medidas Disciplinares (' + medidas.length + ')</strong></summary>';
    if (!medidas.length) {
      html += '<p class="muted" style="margin:8px 0;">Nenhuma medida disciplinar registrada.</p>';
    } else {
      html += '<table class="tabela"><thead><tr><th>Data</th><th>Gravidade</th><th>Tipo</th><th>Descrição</th><th>Status</th></tr></thead><tbody>';
      medidas.forEach(function (m) {
        html += '<tr>' +
          '<td>' + (m.data ? fmtData(m.data) : "—") + '</td>' +
          '<td><span class="tag ' + (m.gravidade_infracao === "Muito Grave" || m.gravidade_infracao === "Grave" ? "danger" : (m.gravidade_infracao === "Moderada" ? "warn" : "")) + '">' + escHtml(m.gravidade_infracao || "—") + '</span></td>' +
          '<td>' + escHtml(m.tipo_medida || "—") + '</td>' +
          '<td>' + escHtml((m.descricao_infracao || "").slice(0, 60)) + '</td>' +
          '<td><span class="tag">' + escHtml(m.status_medida) + '</span></td>' +
        '</tr>';
      });
      html += '</tbody></table>';
    }
    html += '</details>';

    // Avaliações
    html += '<details style="margin-top:12px;"><summary><strong>Avaliações de Desempenho (' + avals.length + ')</strong></summary>';
    if (!avals.length) {
      html += '<p class="muted" style="margin:8px 0;">Nenhuma avaliação cadastrada.</p>';
    } else {
      html += '<table class="tabela"><thead><tr><th>Data</th><th>Avaliador</th><th class="num">Nota geral</th><th>Status</th></tr></thead><tbody>';
      avals.forEach(function (a) {
        var media = a.nota || _calcMedia5(a);
        html += '<tr>' +
          '<td>' + (a.data_avaliacao ? fmtData(a.data_avaliacao) : "—") + '</td>' +
          '<td>' + escHtml(a.avaliador_nome || "—") + '</td>' +
          '<td class="num">' + (media ? Number(media).toFixed(2) : "—") + '</td>' +
          '<td><span class="tag">' + escHtml(a.status_avaliacao || "—") + '</span></td>' +
        '</tr>';
      });
      html += '</tbody></table>';
    }
    html += '</details>';

    // Botão calcular bônus
    html += '<div style="margin-top:16px; text-align:right;">';
    html += '<button type="button" class="btn-ouro" id="btn-rh-calcular-bonus">Calcular Bônus do semestre →</button>';
    html += '</div>';

    var ov = document.getElementById("modal-detalhe-overlay");
    if (ov) {
      var body = ov.querySelector(".modal-detalhe-body");
      if (body) body.innerHTML = html;
    }
    var btn = document.getElementById("btn-rh-calcular-bonus");
    if (btn) btn.addEventListener("click", function () {
      abrirCalculoBonusReal(funcionarioId, nomeFuncionario);
    });
  });
}

// Habilita drill-down nas linhas de #rhf-tbody (tela Funcionários)
document.addEventListener("DOMContentLoaded", function () {
  var tb = document.getElementById("rhf-tbody");
  if (tb && !tb.dataset.rhBound) {
    tb.dataset.rhBound = "1";
    tb.addEventListener("click", function (ev) {
      var tr = ev.target && ev.target.closest && ev.target.closest("tr[data-rhf-id]");
      if (!tr) return;
      var fid = Number(tr.getAttribute("data-rhf-id"));
      var nome = tr.cells && tr.cells[0] ? tr.cells[0].textContent.trim() : "";
      abrirHistoricoRH(fid, nome);
    });
  }
});

// ===========================================================================
// M25 — Política "Nunca Sobrescrever" aplicada nos imports
// Cada import: 1) cria entrada em imports_historico
//              2) marca registros anteriores do mesmo período como vigente=false
//              3) insere novos com vigente=true + import_id
// ===========================================================================

// Helper genérico
function aplicarPoliticaHistorico(opts, cb) {
  // opts = {
  //   tipo: string,
  //   arquivo: string?,
  //   competencia: string?,
  //   excecoes: array?,
  //   marcarAnteriores: [{ tabela, filtros: {col:val ou [val1,val2]} }],
  //   inserts: [{ tabela, linhas, opts: {batch?} }]
  // }
  var totalRegistros = (opts.inserts || []).reduce(function (s, i) { return s + (i.linhas || []).length; }, 0);
  var qtdExcecoes = (opts.excecoes || []).length;

  // 1) Cria entrada em imports_historico
  client.from("imports_historico").insert({
    tipo_import: opts.tipo,
    nome_arquivo: opts.arquivo || null,
    competencia_referencia: opts.competencia || null,
    qtd_registros: totalRegistros,
    qtd_excecoes: qtdExcecoes,
    excecoes_json: opts.excecoes && opts.excecoes.length ? opts.excecoes : null,
    observacoes: opts.observacoes || null
  }).select().single().then(function (r) {
    if (r.error) { cb({ erro: "Erro criando imports_historico: " + r.error.message }); return; }
    var importId = r.data.id;

    // 2) Marca anteriores como vigente=false
    var idx = 0;
    function marcarProximo() {
      if (!opts.marcarAnteriores || idx >= opts.marcarAnteriores.length) {
        inserirNovos();
        return;
      }
      var ma = opts.marcarAnteriores[idx++];
      if (!ma || !ma.tabela) { marcarProximo(); return; }
      var q = client.from(ma.tabela).update({ vigente: false }).eq("vigente", true);
      if (ma.filtros) {
        Object.keys(ma.filtros).forEach(function (col) {
          var val = ma.filtros[col];
          if (Array.isArray(val) && val.length) q = q.in(col, val);
          else if (!Array.isArray(val)) q = q.eq(col, val);
          // se array vazio, não filtra (sem-op)
        });
      }
      q.then(function (r2) {
        if (r2.error) console.warn("Erro update vigente em", ma.tabela, r2.error.message);
        marcarProximo();
      });
    }

    // 3) Insere novos com vigente=true + import_id
    function inserirNovos() {
      var insIdx = 0;
      var totalInseridos = 0;
      var erros = [];
      function inserirProx() {
        if (insIdx >= (opts.inserts || []).length) {
          cb({ importId: importId, totalInseridos: totalInseridos, erros: erros });
          return;
        }
        var ins = opts.inserts[insIdx++];
        if (!ins.linhas || !ins.linhas.length) { inserirProx(); return; }
        var linhas = ins.linhas.map(function (l) {
          var copia = {};
          Object.keys(l).forEach(function (k) { copia[k] = l[k]; });
          copia.vigente = true;
          copia.import_id = importId;
          return copia;
        });
        var lotes = [];
        for (var i = 0; i < linhas.length; i += 200) lotes.push(linhas.slice(i, i + 200));
        var li = 0;
        function lote() {
          if (li >= lotes.length) { inserirProx(); return; }
          client.from(ins.tabela).insert(lotes[li]).then(function (r3) {
            if (r3.error) erros.push({ tabela: ins.tabela, erro: r3.error.message });
            else totalInseridos += lotes[li].length;
            li++; lote();
          });
        }
        lote();
      }
      inserirProx();
    }

    marcarProximo();
  });
}

// ===========================================================================
// REFAC dos imports existentes — substituem as funções `confirmar*` antigas
// ===========================================================================

// 1) Saída de Estoque (4 destinos)
function confirmarSaidaEstoqueRico(parsed) {
  if (!parsed) return;
  var ossUnicas = Array.from(new Set((parsed.detalhes || []).map(function (d) { return d.os; })));
  var ossResumo = Array.from(new Set((parsed.resumo || []).map(function (r) { return r.codigo_os; })));
  var competsMP = Array.from(new Set((parsed.detalhes || []).map(function (d) { return d.compet; })));
  var competsDir = Array.from(new Set((parsed.diretos || []).map(function (d) { return d.mes_ref; })));
  var competencias = Array.from(new Set(competsMP.concat(competsDir).filter(Boolean)));

  var msg = "Vai inserir (NOVAS versões + manter histórico):\n"
          + "• " + (parsed.detalhes || []).length + " em estoque_detalhes\n"
          + "• " + (parsed.resumo || []).length + " em estoque_resumo\n"
          + "• " + (parsed.evolucao || []).length + " em os_evolucao_mensal\n"
          + "• " + (parsed.diretos || []).length + " em custo_direto_competencia\n\n"
          + "Versões anteriores serão marcadas vigente=false (não apagadas).\nConfirma?";
  if (!confirm(msg)) return;
  impBtnConf.disabled = true;
  impBtnPrev.disabled = true;
  setImpStatus("Aplicando política de histórico…", "carregando");

  aplicarPoliticaHistorico({
    tipo: "saida_estoque",
    arquivo: (impArquivo && impArquivo.files && impArquivo.files[0] ? impArquivo.files[0].name : null),
    competencia: competencias.length === 1 ? competencias[0] : (competencias.length + " competências"),
    marcarAnteriores: [
      { tabela: "estoque_detalhes", filtros: { os: ossUnicas } },
      { tabela: "estoque_resumo", filtros: { codigo_os: ossResumo } },
      { tabela: "os_evolucao_mensal", filtros: { os: ossUnicas } },
      { tabela: "custo_direto_competencia", filtros: { mes_ref: competsDir } }
    ],
    inserts: [
      { tabela: "estoque_detalhes", linhas: parsed.detalhes || [] },
      { tabela: "estoque_resumo", linhas: parsed.resumo || [] },
      { tabela: "os_evolucao_mensal", linhas: parsed.evolucao || [] },
      { tabela: "custo_direto_competencia", linhas: parsed.diretos || [] }
    ]
  }, function (res) {
    impBtnConf.disabled = false;
    impBtnPrev.disabled = false;
    if (res.erro) { setImpStatus(res.erro, "erro"); return; }
    if (res.erros && res.erros.length) {
      setImpStatus("Concluído com avisos. Inseridos: " + res.totalInseridos + " · Erros: " + res.erros.map(function(e){return e.tabela+": "+e.erro;}).slice(0,3).join(" | "), "alerta");
    } else {
      setImpStatus("Sucesso! " + res.totalInseridos + " registros inseridos. Import #" + res.importId + " registrado em imports_historico.", "ok");
    }
    try { aprCarregado = false; orcamentosCarregados = false; rcCarregado = false; } catch (e) {}
  });
}

// 2) Dashboard de Orçamentos (3 destinos)
function confirmarDashboardOrcamentos(parsed) {
  if (!parsed) return;
  var orcs = Array.from(new Set((parsed.items || []).map(function (i) { return i.orcamento; })));
  var oss = Array.from(new Set((parsed.os_custos || []).map(function (o) { return o.os; })));
  var ossOrdens = Array.from(new Set((parsed.ordens || []).map(function (o) { return o.os; })));

  var msg = "Vai inserir:\n• " + (parsed.items||[]).length + " em orcamento_items\n"
          + "• " + (parsed.os_custos||[]).length + " em os_custos_planejados\n"
          + "• " + (parsed.ordens||[]).length + " em ordens_servico\n\n"
          + "Versões anteriores serão marcadas vigente=false.\nConfirma?";
  if (!confirm(msg)) return;
  impBtnConf.disabled = true;
  impBtnPrev.disabled = true;
  setImpStatus("Aplicando política de histórico…", "carregando");

  aplicarPoliticaHistorico({
    tipo: "dashboard_orcamentos",
    arquivo: (impArquivo && impArquivo.files && impArquivo.files[0] ? impArquivo.files[0].name : null),
    marcarAnteriores: [
      { tabela: "orcamento_items", filtros: { orcamento: orcs } },
      { tabela: "os_custos_planejados", filtros: { os: oss } },
      { tabela: "ordens_servico", filtros: { os: ossOrdens } }
    ],
    inserts: [
      { tabela: "orcamento_items", linhas: parsed.items || [] },
      { tabela: "os_custos_planejados", linhas: parsed.os_custos || [] },
      { tabela: "ordens_servico", linhas: parsed.ordens || [] }
    ]
  }, function (res) {
    impBtnConf.disabled = false;
    impBtnPrev.disabled = false;
    if (res.erro) { setImpStatus(res.erro, "erro"); return; }
    if (res.erros && res.erros.length) {
      setImpStatus("Concluído com avisos. Inseridos: " + res.totalInseridos + " · Erros: " + res.erros.length, "alerta");
    } else {
      setImpStatus("Sucesso! " + res.totalInseridos + " registros. Import #" + res.importId, "ok");
    }
    try { aprCarregado = false; orcamentosCarregados = false; } catch (e) {}
  });
}

// 3) A Pagar x A Receber → movimentos_caixa
function confirmarPagarReceber(parsed) {
  if (!parsed || !parsed.linhas || !parsed.linhas.length) return;
  var msg = "Vai inserir " + parsed.linhas.length + " linhas em movimentos_caixa "
          + "(" + parsed.pagar + " PAGAR, " + parsed.classifAuto + " RECEBER auto-classificadas, "
          + parsed.pendentesReceber + " RECEBER pendentes).\n\nVersões anteriores marcadas vigente=false.\nConfirma?";
  if (!confirm(msg)) return;
  impBtnConf.disabled = true;
  impBtnPrev.disabled = true;
  setImpStatus("Aplicando política de histórico…", "carregando");

  // Coletar documentos únicos (chave de identidade no relatório)
  var docs = Array.from(new Set(parsed.linhas.map(function (m) { return m.documento; }).filter(Boolean)));

  aplicarPoliticaHistorico({
    tipo: "pagar_receber",
    arquivo: (impArquivo && impArquivo.files && impArquivo.files[0] ? impArquivo.files[0].name : null),
    marcarAnteriores: [
      // Marca como não-vigentes os movimentos com mesmos documentos (re-import do mesmo arquivo)
      { tabela: "movimentos_caixa", filtros: { documento: docs } }
    ],
    inserts: [
      { tabela: "movimentos_caixa", linhas: parsed.linhas }
    ]
  }, function (res) {
    impBtnConf.disabled = false;
    impBtnPrev.disabled = false;
    if (res.erro) { setImpStatus(res.erro, "erro"); return; }
    setImpStatus("Sucesso! " + res.totalInseridos + " linhas em movimentos_caixa. Import #" + res.importId + ". " + parsed.pendentesReceber + " RECEBER pendentes pra classificar manualmente em 'Lançamentos de Caixa'.", "ok");
  });
}

// ===========================================================================
// Imports simples — substituir UPSERT por política de histórico
// (caixa_saldo_mensal, saldos_contas, compromissos, recebimentos_previstos)
//
// Esses passam pela função genérica `confirmarImportContinuar`. Vou substituir
// o caminho default lá (que faz upsert/insert puro) pra aplicar a política
// quando a tabela está na lista das que têm `vigente`.
// ===========================================================================

var TABELAS_COM_HISTORICO = [
  'frequencia_mensal',
  'os_evolucao_mensal',
  'caixa_saldo_mensal',
  'saldos_contas',
  'os_custos_planejados',
  'ordens_servico',
  'estoque_detalhes',
  'estoque_resumo',
  'custo_direto_competencia',
  'movimentos_caixa'
];

// Tabelas SEM mes_ref/competência (cadastros) — continuam INSERT puro
// (compromissos_financeiros, recebimentos_previstos, contas_bancarias, movimentos, saldo_reconhecer, notas_fiscais não estão na M24 — não têm coluna vigente)

// Override de confirmarImportContinuar — adiciona política nos casos aplicáveis
// (a função original será chamada se não for caso especial)
if (typeof confirmarImportContinuar === "function") {
  var _confirmarImportContinuarOriginal = confirmarImportContinuar;
  confirmarImportContinuar = function (tpl) {
    // Os tipos especiais (saida_estoque, dashboard_orcamentos, pagar_receber)
    // já são tratados antes (vão pelas funções refatoradas acima).
    // Pra os tipos com onConflict: aplicar política (caixa_saldo_mensal, saldos_contas)
    if (tpl && tpl.alvo && tpl.onConflict && TABELAS_COM_HISTORICO.indexOf(tpl.alvo) !== -1) {
      if (!confirm("Confirmar importação de " + impParsed.linhas.length + " linhas para " + tpl.nomeLegivel + "?\nVersões anteriores marcadas vigente=false (histórico preservado).")) return;
      impBtnConf.disabled = true;
      impBtnPrev.disabled = true;
      setImpStatus("Aplicando política de histórico…", "carregando");

      // Calcular filtros de "marcar anteriores" baseado no onConflict
      var conflictCols = String(tpl.onConflict).split(",").map(function (s) { return s.trim(); });
      var filtros = {};
      conflictCols.forEach(function (col) {
        var vals = Array.from(new Set(impParsed.linhas.map(function (l) { return l[col]; }).filter(function (v) { return v !== null && v !== undefined; })));
        if (vals.length) filtros[col] = vals;
      });

      aplicarPoliticaHistorico({
        tipo: impTipo.value,
        arquivo: (impArquivo && impArquivo.files && impArquivo.files[0] ? impArquivo.files[0].name : null),
        marcarAnteriores: [{ tabela: tpl.alvo, filtros: filtros }],
        inserts: [{ tabela: tpl.alvo, linhas: impParsed.linhas }]
      }, function (res) {
        impBtnConf.disabled = false;
        impBtnPrev.disabled = false;
        if (res.erro) { setImpStatus(res.erro, "erro"); return; }
        if (res.erros && res.erros.length) {
          setImpStatus("Concluído com avisos. Inseridos: " + res.totalInseridos + " · Erros: " + res.erros.length, "alerta");
        } else {
          setImpStatus("Sucesso! " + res.totalInseridos + " linhas em " + tpl.alvo + ". Import #" + res.importId + ".", "ok");
        }
      });
      return;
    }
    // Demais casos — chama a original
    return _confirmarImportContinuarOriginal(tpl);
  };
}

// ===========================================================================
// M26 — Política de histórico aplicada nos imports restantes
// ===========================================================================

// Atualiza TABELAS_COM_HISTORICO pra incluir as 10 novas (M26)
if (typeof TABELAS_COM_HISTORICO !== "undefined") {
  [
    'movimentos','notas_fiscais','nf_os','saldo_reconhecer',
    'compromissos_financeiros','recebimentos_previstos',
    'entradas_outras','saidas_outras',
    'folha_pagamento','folha_pagamento_rubricas'
  ].forEach(function (t) {
    if (TABELAS_COM_HISTORICO.indexOf(t) === -1) TABELAS_COM_HISTORICO.push(t);
  });
}

// Refac do confirmar de NFs com vínculo (gravarNFsEnfsOs) pra usar política
// Substitui a função existente
function gravarNFsEnfsOs(nfs, vinculos, cb) {
  var numerosNF = Array.from(new Set(nfs.map(function (n) { return n.numero_nf; }).filter(Boolean)));
  aplicarPoliticaHistorico({
    tipo: "notas_fiscais",
    arquivo: (impArquivo && impArquivo.files && impArquivo.files[0] ? impArquivo.files[0].name : null),
    marcarAnteriores: [
      { tabela: "notas_fiscais", filtros: { numero_nf: numerosNF } },
      { tabela: "nf_os", filtros: { numero_nf: numerosNF } }
    ],
    inserts: [
      { tabela: "notas_fiscais", linhas: nfs },
      { tabela: "nf_os", linhas: vinculos }
    ]
  }, function (res) {
    if (res.erro) { cb(res.erro, true); return; }
    if (res.erros && res.erros.length) {
      cb("NFs/vínculos com avisos: " + res.erros.length + " erros · Inseridos " + res.totalInseridos + ". Import #" + res.importId, true);
    } else {
      cb(nfs.length + " NFs e " + vinculos.length + " vínculo(s) NF↔OS gravados. Import #" + res.importId + ".", false);
    }
  });
}

// Override de confirmarImportContinuar pra também aplicar política quando o tipo
// é "historico_mov_financeiro" ou "historico_saldo_reconhecer" (que vão pra
// movimentos / saldo_reconhecer respectivamente — sem onConflict).
if (typeof confirmarImportContinuar === "function") {
  var _confirmarOriginal_M26 = confirmarImportContinuar;
  confirmarImportContinuar = function (tpl) {
    var tipoSelect = impTipo && impTipo.value;

    // Histórico Mov Financeiro
    if (tipoSelect === "historico_mov_financeiro" && tpl && tpl.alvo === "movimentos") {
      if (!confirm("Importar " + impParsed.linhas.length + " lançamentos pra movimentos? Versões anteriores marcadas vigente=false.")) return;
      impBtnConf.disabled = true;
      impBtnPrev.disabled = true;
      setImpStatus("Aplicando política de histórico…", "carregando");

      // Coletar (orcamento, competencia) únicos
      var orcs = Array.from(new Set(impParsed.linhas.map(function (l) { return l.orcamento; }).filter(Boolean)));
      var comps = Array.from(new Set(impParsed.linhas.map(function (l) { return l.competencia; }).filter(Boolean)));

      aplicarPoliticaHistorico({
        tipo: "historico_mov_financeiro",
        arquivo: (impArquivo && impArquivo.files && impArquivo.files[0] ? impArquivo.files[0].name : null),
        marcarAnteriores: [
          { tabela: "movimentos", filtros: { orcamento: orcs } }
        ],
        inserts: [
          { tabela: "movimentos", linhas: impParsed.linhas }
        ]
      }, function (res) {
        impBtnConf.disabled = false;
        impBtnPrev.disabled = false;
        if (res.erro) { setImpStatus(res.erro, "erro"); return; }
        setImpStatus("Sucesso! " + res.totalInseridos + " lançamentos em movimentos. Import #" + res.importId, "ok");
        try { orcamentosCarregados = false; } catch (e) {}
      });
      return;
    }

    // Histórico Saldo a Reconhecer
    if (tipoSelect === "historico_saldo_reconhecer" && tpl && tpl.alvo === "saldo_reconhecer") {
      if (!confirm("Importar " + impParsed.linhas.length + " linhas pra saldo_reconhecer? Versões anteriores marcadas vigente=false.")) return;
      impBtnConf.disabled = true;
      impBtnPrev.disabled = true;
      setImpStatus("Aplicando política de histórico…", "carregando");

      var orcsSR = Array.from(new Set(impParsed.linhas.map(function (l) { return l.orcamento; }).filter(Boolean)));

      aplicarPoliticaHistorico({
        tipo: "historico_saldo_reconhecer",
        arquivo: (impArquivo && impArquivo.files && impArquivo.files[0] ? impArquivo.files[0].name : null),
        marcarAnteriores: [
          { tabela: "saldo_reconhecer", filtros: { orcamento: orcsSR } }
        ],
        inserts: [
          { tabela: "saldo_reconhecer", linhas: impParsed.linhas }
        ]
      }, function (res) {
        impBtnConf.disabled = false;
        impBtnPrev.disabled = false;
        if (res.erro) { setImpStatus(res.erro, "erro"); return; }
        setImpStatus("Sucesso! " + res.totalInseridos + " linhas em saldo_reconhecer. Import #" + res.importId, "ok");
      });
      return;
    }

    // Recebimentos Previstos
    if (tipoSelect === "recebimentos_previstos" && tpl && tpl.alvo === "recebimentos_previstos") {
      if (!confirm("Importar " + impParsed.linhas.length + " linhas pra recebimentos_previstos? Versões anteriores marcadas vigente=false.")) return;
      impBtnConf.disabled = true;
      impBtnPrev.disabled = true;
      setImpStatus("Aplicando política de histórico…", "carregando");

      var orcsRP = Array.from(new Set(impParsed.linhas.map(function (l) { return l.orcamento; }).filter(Boolean)));

      aplicarPoliticaHistorico({
        tipo: "recebimentos_previstos",
        arquivo: (impArquivo && impArquivo.files && impArquivo.files[0] ? impArquivo.files[0].name : null),
        marcarAnteriores: [
          { tabela: "recebimentos_previstos", filtros: { orcamento: orcsRP } }
        ],
        inserts: [
          { tabela: "recebimentos_previstos", linhas: impParsed.linhas }
        ]
      }, function (res) {
        impBtnConf.disabled = false;
        impBtnPrev.disabled = false;
        if (res.erro) { setImpStatus(res.erro, "erro"); return; }
        setImpStatus("Sucesso! " + res.totalInseridos + " linhas. Import #" + res.importId, "ok");
      });
      return;
    }

    // Compromissos Financeiros
    if (tipoSelect === "compromissos_financeiros" && tpl && tpl.alvo === "compromissos_financeiros") {
      if (!confirm("Importar " + impParsed.linhas.length + " compromissos? Versões anteriores marcadas vigente=false (por descricao+vencimento).")) return;
      impBtnConf.disabled = true;
      impBtnPrev.disabled = true;
      setImpStatus("Aplicando política de histórico…", "carregando");

      var descsCF = Array.from(new Set(impParsed.linhas.map(function (l) { return l.descricao; }).filter(Boolean)));

      aplicarPoliticaHistorico({
        tipo: "compromissos_financeiros",
        arquivo: (impArquivo && impArquivo.files && impArquivo.files[0] ? impArquivo.files[0].name : null),
        marcarAnteriores: [
          { tabela: "compromissos_financeiros", filtros: { descricao: descsCF } }
        ],
        inserts: [
          { tabela: "compromissos_financeiros", linhas: impParsed.linhas }
        ]
      }, function (res) {
        impBtnConf.disabled = false;
        impBtnPrev.disabled = false;
        if (res.erro) { setImpStatus(res.erro, "erro"); return; }
        setImpStatus("Sucesso! " + res.totalInseridos + " compromissos. Import #" + res.importId, "ok");
      });
      return;
    }

    // Demais casos — chama original (que pode também aplicar política se onConflict + tabela em TABELAS_COM_HISTORICO)
    return _confirmarOriginal_M26(tpl);
  };
}


// -- Dashboard KPIs --------------------------------------------------------
function carregarKpisDashboard() {
  var hoje = new Date();
  var iso7 = new Date(hoje.getTime() + 7*24*60*60*1000).toISOString().slice(0,10);
  var hojeIso = hoje.toISOString().slice(0,10);

  // Caixa hoje: soma do último saldo de cada conta bancária
  var elCaixa = document.getElementById("kpi-caixa-hoje");
  if (elCaixa) {
    client.from("saldos_contas").select("conta_bancaria_id, saldo_final, mes_ref").order("mes_ref", { ascending: false }).then(function (r) {
      if (r.error) { elCaixa.textContent = "—"; return; }
      var byConta = {};
      (r.data || []).forEach(function (s) {
        if (!(s.conta_bancaria_id in byConta)) byConta[s.conta_bancaria_id] = Number(s.saldo_final || 0);
      });
      var soma = 0;
      Object.keys(byConta).forEach(function (k) { soma += byConta[k]; });
      elCaixa.textContent = fmtBRL(soma);
    });
  }

  // A pagar 7d: compromissos_financeiros com vencimento <= +7d e pago_em IS NULL
  var elPagar = document.getElementById("kpi-pagar-7d");
  if (elPagar) {
    client.from("compromissos_financeiros").select("valor, vencimento, pago_em").is("pago_em", null).lte("vencimento", iso7).then(function (r) {
      if (r.error) { elPagar.textContent = "—"; return; }
      var soma = (r.data || []).reduce(function (acc, c) { return acc + Number(c.valor || 0); }, 0);
      elPagar.textContent = fmtBRL(soma);
    });
  }

  // NFs em aberto: notas fiscais sem recebimento (heurística: status_recebimento != 'Liquidado')
  var elNf = document.getElementById("kpi-nf-aberto");
  if (elNf) {
    // Usar orcamentos como proxy (mesma lógica do Dashboard atual)
    client.from("orcamentos").select("nota_fiscal, status_recebimento").not("nota_fiscal", "is", null).then(function (r) {
      if (r.error) { elNf.textContent = "—"; return; }
      var emAberto = (r.data || []).filter(function (o) { return o.status_recebimento && o.status_recebimento !== "Liquidado"; });
      elNf.textContent = fmtInt(emAberto.length);
    });
  }

  // A receber (7 dias): recebimentos_previstos com data_prevista <= +7d e ainda não recebidos.
  // Espelha simetricamente o "A pagar (7 dias)". Inclui parcelas vencidas (passado) — destacadas.
  var elRec = document.getElementById("kpi-receber");
  var elRecSub = document.getElementById("kpi-receber-sub");
  if (elRec) {
    client.from("recebimentos_previstos").select("valor, data_prevista, recebido_em").is("recebido_em", null).lte("data_prevista", iso7).then(function (r) {
      if (r.error) { elRec.textContent = "—"; return; }
      var lista = r.data || [];
      var soma = lista.reduce(function (acc, p) { return acc + Number(p.valor || 0); }, 0);
      elRec.textContent = fmtBRL(soma);
      var vencidas = lista.filter(function (p) { return p.data_prevista && p.data_prevista < hojeIso; }).length;
      var aVencer  = lista.length - vencidas;
      if (elRecSub) {
        if (vencidas > 0) {
          elRecSub.innerHTML = '<strong style="color: var(--danger);">' + vencidas + ' vencida(s)</strong>' + (aVencer > 0 ? ' · ' + aVencer + ' a vencer em 7d' : '');
        } else {
          elRecSub.textContent = lista.length + " parcela(s) vencendo até 7 dias";
        }
      }
      elRec.style.color = vencidas > 0 ? "var(--warn)" : "var(--text)";
    });
  }

  // OSs em atraso: ordens_servico com prazo_entrega < hoje e status != 'Entregue'
  var elOs = document.getElementById("kpi-os-atraso");
  if (elOs) {
    client.from("ordens_servico").select("id, status, prazo_entrega").lt("prazo_entrega", hojeIso).then(function (r) {
      if (r.error) { elOs.textContent = "—"; return; }
      var atrasadas = (r.data || []).filter(function (os) {
        var s = (os.status || "").toLowerCase();
        return s !== "entregue" && s !== "concluida" && s !== "concluída" && s !== "cancelada";
      });
      elOs.textContent = fmtInt(atrasadas.length);
    });
  }
}


// ===========================================================================
// MARGEM POR OS — Tela consolidada (Frente 3)
// Cruza orcamentos.venda (receita) com os_custos_planejados (custo prev/real)
// por OS. Calcula margens e estouros.
// ===========================================================================

var mosCarregado = false;
var mosCarregando = false;
var mosLista = [];

function carregarMargemOsSeNecessario() {
  if (mosCarregado) { renderMargemOs(); return; }
  if (mosCarregando) return;
  mosCarregando = true;
  var tbody = document.getElementById("mos-tbody");
  if (tbody) tbody.innerHTML = '<tr><td colspan="15" class="tbl-vazio">Carregando custos planejados…</td></tr>';

  Promise.all([
    client.from("os_custos_planejados").select("*").eq("vigente", true),
    client.from("ordens_servico").select("os, orcamento"),
    client.from("orcamentos").select("orcamento, nome, parceiro, venda")
  ]).then(function (rs) {
    mosCarregando = false;
    var rOcp = rs[0], rOs = rs[1], rOrc = rs[2];
    if (rOcp.error) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="15" class="tbl-vazio erro">Erro: ' + rOcp.error.message + '</td></tr>';
      return;
    }
    var custos = rOcp.data || [];
    var ordens = rOs.data || [];
    var orcs   = rOrc.data || [];

    // Indexar OS -> orcamento, e orcamento -> dados
    var osToOrc = {};
    ordens.forEach(function (o) { if (o.os) osToOrc[o.os] = o.orcamento; });
    var orcDados = {};
    orcs.forEach(function (o) { orcDados[o.orcamento] = o; });

    // Construir lista consolidada
    mosLista = custos.map(function (c) {
      var orcNum = osToOrc[c.os];
      var orc = orcDados[orcNum] || {};
      var receita = Number(orc.venda || 0);
      var prevTotal = Number(c.total_previsto || 0);
      var realTotal = Number(c.total_realizado || 0);
      var saldoTotal = Number(c.saldo_total || (prevTotal - realTotal));
      var pctExec = prevTotal > 0 ? (realTotal / prevTotal) : 0;
      var margemPrev = receita > 0 ? ((receita - prevTotal) / receita) : null;
      var margemReal = receita > 0 ? ((receita - realTotal) / receita) : null;
      return {
        os: c.os,
        orcamento: orcNum,
        cliente: orc.nome || "—",
        receita: receita,
        mp_prev: Number(c.materiais_previstos || 0),
        mp_real: Number(c.materiais_realizados || 0),
        mod_prev: Number(c.horas_previstas || 0),
        mod_real: Number(c.horas_realizadas || 0),
        st_prev: Number(c.st_previstos || 0),
        st_real: Number(c.st_realizados || 0),
        outros_prev: Number(c.outros_previstos || 0),
        outros_real: Number(c.outros_realizados || 0),
        prev_total: prevTotal,
        real_total: realTotal,
        saldo: saldoTotal,
        pct_exec: pctExec,
        margem_prev: margemPrev,
        margem_real: margemReal
      };
    });
    mosCarregado = true;
    renderMargemOs();

    // Bind dos filtros (idempotente)
    var b = document.getElementById("mos-busca");
    var f = document.getElementById("mos-filtro");
    var bl = document.getElementById("mos-btn-limpar");
    if (b && !b.dataset.bound) { b.dataset.bound = "1"; b.addEventListener("input", renderMargemOs); }
    if (f && !f.dataset.bound) { f.dataset.bound = "1"; f.addEventListener("change", renderMargemOs); }
    if (bl && !bl.dataset.bound) {
      bl.dataset.bound = "1";
      bl.addEventListener("click", function () {
        if (b) b.value = "";
        if (f) f.selectedIndex = 0;
        renderMargemOs();
      });
    }
  });
}

function renderMargemOs() {
  var tbody = document.getElementById("mos-tbody");
  if (!tbody) return;
  var busca = ((document.getElementById("mos-busca")||{}).value || "").trim().toLowerCase();
  var filtro = ((document.getElementById("mos-filtro")||{}).value || "");

  var filtrados = (mosLista || []).filter(function (m) {
    if (filtro === "estouro" && m.pct_exec <= 1.10) return false;
    if (filtro === "atencao" && (m.pct_exec < 0.90 || m.pct_exec > 1.10)) return false;
    if (filtro === "ok" && m.pct_exec >= 0.90) return false;
    if (filtro === "naoiniciada" && m.pct_exec > 0) return false;
    if (busca && (m.os || "").toLowerCase().indexOf(busca) === -1 && (m.cliente || "").toLowerCase().indexOf(busca) === -1) return false;
    return true;
  });

  // Cards
  var totQtd = mosLista.length;
  var totPrev = mosLista.reduce(function (a, m) { return a + m.prev_total; }, 0);
  var totReal = mosLista.reduce(function (a, m) { return a + m.real_total; }, 0);
  var pctTot = totPrev > 0 ? (totReal / totPrev * 100) : 0;
  var qtdEstouro = mosLista.filter(function (m) { return m.pct_exec > 1.10; }).length;
  valText(document.getElementById("mos-m-qtd"), fmtInt(totQtd));
  valText(document.getElementById("mos-m-prev"), fmtBRL(totPrev));
  valText(document.getElementById("mos-m-real"), fmtBRL(totReal));
  valText(document.getElementById("mos-m-pct"), pctTot.toFixed(1).replace(".", ",") + "%");
  valText(document.getElementById("mos-m-estouro"), fmtInt(qtdEstouro));
  valText(document.getElementById("mos-lbl"), filtrados.length + " de " + mosLista.length + " OSs");

  function fmtPct(v) { return v == null ? "—" : (v * 100).toFixed(1).replace(".", ",") + "%"; }
  function fmtPctClass(v, opts) {
    // Para % executado: vermelho se >110, amarelo 90-110, verde se <90
    if (v == null) return "";
    var pct = (opts && opts.margem) ? v : (v * 100);
    if (opts && opts.margem) {
      if (pct < 0) return "destaque-erro";
      if (pct < 0.20) return "destaque-warn";
      return "destaque-ok";
    } else {
      if (pct > 110) return "destaque-erro";
      if (pct > 90) return "destaque-warn";
      return "";
    }
  }

  preencherTbody(tbody, filtrados.map(function (m) {
    var pctClass = fmtPctClass(m.pct_exec * 100);
    var mPrevClass = fmtPctClass(m.margem_prev, { margem: true });
    var mRealClass = fmtPctClass(m.margem_real, { margem: true });
    return '<tr>' +
      '<td class="mono">' + escHtml(m.os || "—") + '</td>' +
      '<td>' + escHtml(m.cliente) + '</td>' +
      '<td class="num">' + (m.receita ? fmtBRL(m.receita) : "—") + '</td>' +
      '<td class="num">' + fmtBRL(m.mp_prev) + '</td>' +
      '<td class="num">' + fmtBRL(m.mp_real) + '</td>' +
      '<td class="num">' + fmtBRL(m.mod_prev) + '</td>' +
      '<td class="num">' + fmtBRL(m.mod_real) + '</td>' +
      '<td class="num">' + fmtBRL(m.st_prev) + '</td>' +
      '<td class="num">' + fmtBRL(m.st_real) + '</td>' +
      '<td class="num"><strong>' + fmtBRL(m.prev_total) + '</strong></td>' +
      '<td class="num"><strong>' + fmtBRL(m.real_total) + '</strong></td>' +
      '<td class="num">' + fmtBRL(m.saldo) + '</td>' +
      '<td class="num ' + pctClass + '">' + (m.pct_exec * 100).toFixed(1).replace(".", ",") + '%</td>' +
      '<td class="num ' + mPrevClass + '">' + fmtPct(m.margem_prev) + '</td>' +
      '<td class="num ' + mRealClass + '">' + fmtPct(m.margem_real) + '</td>' +
    '</tr>';
  }), 15, { msg: "Nenhuma OS bate com esse filtro.", icon: "📊" });
}

// ===========================================================================
// E7 — ALERTAS DE AUDITORIA (sino + caixa de entrada + regras)
// ===========================================================================

var alertasNaoLidosCount = 0;
var ALERTAS_POLL_MS = 30000;
var alertasPollIv = null;

function atualizarBadgeSino(n) {
  var b = document.getElementById("topbar-sino-badge");
  if (!b) return;
  if (!n || n <= 0) { b.textContent = "0"; b.hidden = true; }
  else { b.textContent = n > 99 ? "99+" : String(n); b.hidden = false; }
}

function pollAlertasNaoLidos() {
  var uid = (window._terraUser && window._terraUser.id) || null;
  if (!uid) return;
  client.from("auditoria_alertas")
    .select("id", { count: "exact", head: true })
    .eq("destinatario_user_id", uid)
    .is("lido_em", null)
    .then(function (r) {
      if (r.error) return;
      alertasNaoLidosCount = r.count || 0;
      atualizarBadgeSino(alertasNaoLidosCount);
    });
}

function iniciarPollingAlertas() {
  if (alertasPollIv) return;
  pollAlertasNaoLidos();
  alertasPollIv = setInterval(pollAlertasNaoLidos, ALERTAS_POLL_MS);
}

(function bindSino() {
  function bind() {
    var s = document.getElementById("topbar-sino");
    if (!s || s.dataset.bound) return;
    s.dataset.bound = "1";
    s.addEventListener("click", function () {
      if (typeof navegarPara === "function") navegarPara("cfg_aud_alertas");
      else if (typeof showPage === "function") showPage("cfg_aud_alertas");
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else setTimeout(bind, 100);
})();

var alertasLista = [];
var alertasCarregado = false;

function carregarAlertasSeNecessario() {
  var uid = (window._terraUser && window._terraUser.id) || null;
  var tbody = document.getElementById("ala-tbody");
  if (!uid) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="tbl-vazio erro">Não foi possível identificar o usuário.</td></tr>';
    return;
  }
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="tbl-vazio">Carregando alertas…</td></tr>';

  client.from("auditoria_alertas")
    .select("*")
    .eq("destinatario_user_id", uid)
    .order("disparado_em", { ascending: false })
    .limit(500)
    .then(function (r) {
      if (r.error) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="tbl-vazio erro">Erro: ' + r.error.message + '</td></tr>';
        return;
      }
      alertasLista = r.data || [];
      alertasCarregado = true;
      renderAlertas();
    });

  ["ala-filtro", "ala-severidade"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el && !el.dataset.bound) { el.dataset.bound = "1"; el.addEventListener("change", renderAlertas); }
  });
  var btnTodos = document.getElementById("ala-btn-marcar-todos");
  if (btnTodos && !btnTodos.dataset.bound) {
    btnTodos.dataset.bound = "1";
    btnTodos.addEventListener("click", marcarTodosAlertasComoLidos);
  }
}

function renderAlertas() {
  var tbody = document.getElementById("ala-tbody");
  if (!tbody) return;
  var f = ((document.getElementById("ala-filtro") || {}).value) || "nao_lidos";
  var sev = ((document.getElementById("ala-severidade") || {}).value) || "";

  var filtrados = (alertasLista || []).filter(function (a) {
    if (f === "nao_lidos" && a.lido_em) return false;
    if (f === "lidos" && !a.lido_em) return false;
    if (sev && a.severidade !== sev) return false;
    return true;
  });

  valText(document.getElementById("ala-lbl"), filtrados.length + " de " + alertasLista.length);

  function badgeSev(s) {
    var classe = s === "critico" ? "outras" : (s === "warn" ? "assist" : "solta");
    return '<span class="badge-tipo ' + classe + '">' + escHtml(s) + '</span>';
  }
  function fmtTs(iso) {
    if (!iso) return "—";
    var s = String(iso);
    return s.slice(8,10) + "/" + s.slice(5,7) + "/" + s.slice(0,4) + " " + s.slice(11,16);
  }

  preencherTbody(tbody, filtrados.map(function (a) {
    var lidoCls = a.lido_em ? "" : ' style="background: var(--info-bg);"';
    var actions = a.lido_em
      ? '<button class="btn-limpar" data-ala-unread="' + a.id + '" title="Marcar como não lido">↩ Não lido</button>'
      : '<button class="btn-limpar" data-ala-read="' + a.id + '" title="Marcar como lido">✓ Lido</button>';
    if (a.auditoria_id) {
      actions += ' <button class="btn-limpar" data-ala-detail="' + a.auditoria_id + '" title="Ver evento de auditoria">🔍 Detalhe</button>';
    }
    return '<tr' + lidoCls + '>' +
      '<td class="mono">' + fmtTs(a.disparado_em) + '</td>' +
      '<td>' + badgeSev(a.severidade) + '</td>' +
      '<td><strong>' + escHtml(a.titulo) + '</strong></td>' +
      '<td>' + escHtml(a.mensagem) + '</td>' +
      '<td>' + actions + '</td>' +
    '</tr>';
  }), 5, { msg: "Nenhum alerta neste filtro.", icon: "🔔" });

  tbody.querySelectorAll("[data-ala-read]").forEach(function (btn) {
    btn.addEventListener("click", function () { marcarAlertaComoLido(Number(btn.getAttribute("data-ala-read")), true); });
  });
  tbody.querySelectorAll("[data-ala-unread]").forEach(function (btn) {
    btn.addEventListener("click", function () { marcarAlertaComoLido(Number(btn.getAttribute("data-ala-unread")), false); });
  });
  tbody.querySelectorAll("[data-ala-detail]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var audId = Number(btn.getAttribute("data-ala-detail"));
      client.from("auditoria").select("*").eq("id", audId).single().then(function (r) {
        if (r.error) { alert("Erro: " + r.error.message); return; }
        if (typeof abrirDetalheAuditoria === "function") abrirDetalheAuditoria(r.data);
      });
    });
  });
}

function marcarAlertaComoLido(id, lido) {
  var payload = lido ? { lido_em: new Date().toISOString() } : { lido_em: null };
  client.from("auditoria_alertas").update(payload).eq("id", id).then(function (r) {
    if (r.error) { try { toast("Erro: " + r.error.message, "erro"); } catch (e) {} return; }
    var a = alertasLista.find(function (x) { return x.id === id; });
    if (a) a.lido_em = lido ? new Date().toISOString() : null;
    renderAlertas();
    pollAlertasNaoLidos();
  });
}

function marcarTodosAlertasComoLidos() {
  var uid = (window._terraUser && window._terraUser.id) || null;
  if (!uid) return;
  if (!confirm("Marcar TODOS os alertas como lidos?")) return;
  client.from("auditoria_alertas")
    .update({ lido_em: new Date().toISOString() })
    .eq("destinatario_user_id", uid)
    .is("lido_em", null)
    .then(function (r) {
      if (r.error) { try { toast("Erro: " + r.error.message, "erro"); } catch (e) {} return; }
      try { toast("Alertas marcados como lidos.", "ok"); } catch (e) {}
      alertasCarregado = false;
      carregarAlertasSeNecessario();
      pollAlertasNaoLidos();
    });
}

var regrasAlertaLista = [];
var regrasAlertaCarregado = false;

function carregarRegrasAlertaSeNecessario() {
  var tbody = document.getElementById("alr-tbody");
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="tbl-vazio">Carregando regras…</td></tr>';

  client.from("auditoria_regras").select("*").order("nome").then(function (r) {
    if (r.error) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="tbl-vazio erro">Erro: ' + r.error.message + '</td></tr>';
      return;
    }
    regrasAlertaLista = r.data || [];
    regrasAlertaCarregado = true;
    renderRegrasAlerta();
  });

  var b = document.getElementById("alr-busca");
  var a = document.getElementById("alr-ativo");
  var bl = document.getElementById("alr-btn-limpar");
  var bn = document.getElementById("alr-btn-novo");
  if (b && !b.dataset.bound) { b.dataset.bound = "1"; b.addEventListener("input", renderRegrasAlerta); }
  if (a && !a.dataset.bound) { a.dataset.bound = "1"; a.addEventListener("change", renderRegrasAlerta); }
  if (bl && !bl.dataset.bound) {
    bl.dataset.bound = "1";
    bl.addEventListener("click", function () { if (b) b.value = ""; if (a) a.value = "ativo"; renderRegrasAlerta(); });
  }
  if (bn && !bn.dataset.bound) {
    bn.dataset.bound = "1";
    bn.addEventListener("click", function () { abrirModalRegraAlerta(); });
  }
}

function renderRegrasAlerta() {
  var tbody = document.getElementById("alr-tbody");
  if (!tbody) return;
  var busca = ((document.getElementById("alr-busca")||{}).value || "").trim().toLowerCase();
  var ativo = ((document.getElementById("alr-ativo")||{}).value || "ativo");

  var filtradas = (regrasAlertaLista || []).filter(function (r) {
    if (ativo === "ativo" && !r.ativo) return false;
    if (ativo === "inativo" && r.ativo) return false;
    if (busca && (r.nome || "").toLowerCase().indexOf(busca) === -1 && (r.tabela_alvo || "").toLowerCase().indexOf(busca) === -1) return false;
    return true;
  });

  valText(document.getElementById("alr-lbl"), filtradas.length + " de " + regrasAlertaLista.length);

  function condicaoText(r) {
    if (!r.campo_valor || !r.operador_valor) return '<span class="muted">—</span>';
    return '<code>' + escHtml(r.campo_valor) + ' ' + escHtml(r.operador_valor) + ' ' + (r.valor_referencia != null ? fmtBRL(r.valor_referencia) : "?") + '</code>';
  }
  function destText(r) {
    if (r.destinatario_user_id) return '<span class="mono">user: ' + escHtml(String(r.destinatario_user_id).slice(0,8)) + '…</span>';
    if (r.destinatario_perfil)  return '<span>perfil: <strong>' + escHtml(r.destinatario_perfil) + '</strong></span>';
    return '<span class="muted">—</span>';
  }
  function sevBadge(s) {
    var classe = s === "critico" ? "outras" : (s === "warn" ? "assist" : "solta");
    return '<span class="badge-tipo ' + classe + '">' + escHtml(s) + '</span>';
  }

  preencherTbody(tbody, filtradas.map(function (r) {
    return '<tr>' +
      '<td><strong>' + escHtml(r.nome) + '</strong>' + (r.descricao ? '<br><span class="muted" style="font-size:11px;">' + escHtml(r.descricao) + '</span>' : '') + '</td>' +
      '<td class="mono">' + escHtml(r.tabela_alvo) + '</td>' +
      '<td class="mono">' + escHtml(r.acao_alvo) + '</td>' +
      '<td>' + condicaoText(r) + '</td>' +
      '<td>' + destText(r) + '</td>' +
      '<td>' + sevBadge(r.severidade) + '</td>' +
      '<td>' + (r.ativo ? '<span class="badge-tipo solta">sim</span>' : '<span class="badge-tipo outras">não</span>') + '</td>' +
      '<td>' +
        '<button class="btn-limpar" data-alr-edit="' + r.id + '">✎ Editar</button> ' +
        '<button class="btn-limpar" data-alr-toggle="' + r.id + '">' + (r.ativo ? '⏸ Desativar' : '▶ Ativar') + '</button> ' +
        '<button class="btn-limpar" data-alr-del="' + r.id + '">🗑</button>' +
      '</td>' +
    '</tr>';
  }), 8, { msg: "Nenhuma regra cadastrada. Crie a primeira pra começar a receber alertas.", icon: "⚙️" });

  tbody.querySelectorAll("[data-alr-edit]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-alr-edit"));
      var r = regrasAlertaLista.find(function (x) { return x.id === id; });
      if (r) abrirModalRegraAlerta(r);
    });
  });
  tbody.querySelectorAll("[data-alr-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-alr-toggle"));
      var r = regrasAlertaLista.find(function (x) { return x.id === id; });
      if (!r) return;
      client.from("auditoria_regras").update({ ativo: !r.ativo }).eq("id", id).then(function (res) {
        if (res.error) { try { toast(res.error.message, "erro"); } catch (e) {} return; }
        try { toast(r.ativo ? "Regra desativada." : "Regra ativada.", "ok"); } catch (e) {}
        regrasAlertaCarregado = false;
        carregarRegrasAlertaSeNecessario();
      });
    });
  });
  tbody.querySelectorAll("[data-alr-del]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = Number(btn.getAttribute("data-alr-del"));
      if (!confirm("Excluir esta regra de alerta? Alertas antigos disparados por ela não serão removidos.")) return;
      client.from("auditoria_regras").delete().eq("id", id).then(function (res) {
        if (res.error) { try { toast(res.error.message, "erro"); } catch (e) {} return; }
        try { toast("Regra excluída.", "ok"); } catch (e) {}
        regrasAlertaCarregado = false;
        carregarRegrasAlertaSeNecessario();
      });
    });
  });
}

function abrirModalRegraAlerta(r) {
  r = r || {};
  var editar = !!r.id;
  var tabelasComuns = ["*", "compromissos_financeiros", "saidas_outras", "entradas_outras", "folha_pagamento", "funcionarios", "orcamentos", "movimentos", "saldos_contas", "centros_custo", "perfis"];

  abrirModal({
    titulo: editar ? "Editar regra de alerta" : "Nova regra de alerta",
    fields: [
      { name: "nome",        label: "Nome da regra",            type: "text", valor: r.nome, required: true, group: "Identificação" },
      { name: "descricao",   label: "Descrição (opcional)",     type: "textarea", valor: r.descricao || "", group: "Identificação" },
      { name: "tabela_alvo", label: "Tabela monitorada",        type: "select", valor: r.tabela_alvo || "*", required: true,
        options: tabelasComuns.map(function (t) { return { value: t, label: t === "*" ? "Qualquer tabela" : t }; }), group: "Quando disparar" },
      { name: "acao_alvo",   label: "Ação que dispara",         type: "select", valor: r.acao_alvo || "*", required: true,
        options: [
          { value: "*",      label: "Qualquer ação" },
          { value: "INSERT", label: "INSERT (criação)" },
          { value: "UPDATE", label: "UPDATE (alteração)" },
          { value: "DELETE", label: "DELETE (exclusão)" }
        ], group: "Quando disparar" },
      { name: "campo_valor",     label: "Campo numérico para condição (opcional, ex: valor, salario_base)", type: "text", valor: r.campo_valor || "", group: "Condição opcional" },
      { name: "operador_valor",  label: "Operador",                 type: "select", valor: r.operador_valor || "",
        options: [
          { value: "",   label: "(sem condição — dispara sempre)" },
          { value: ">",  label: "maior que" },
          { value: ">=", label: "maior ou igual" },
          { value: "<",  label: "menor que" },
          { value: "<=", label: "menor ou igual" },
          { value: "=",  label: "igual a" }
        ], group: "Condição opcional" },
      { name: "valor_referencia", label: "Valor de comparação (R$)", type: "number", valor: r.valor_referencia, group: "Condição opcional" },
      { name: "destinatario_perfil", label: "Enviar para todos com perfil", type: "select", valor: r.destinatario_perfil || "master",
        options: [
          { value: "master",   label: "Master" },
          { value: "admin",    label: "Admin" },
          { value: "operador", label: "Operador" },
          { value: "consulta", label: "Consulta" }
        ], group: "Destinatário" },
      { name: "severidade",  label: "Severidade",               type: "select", valor: r.severidade || "info",
        options: [
          { value: "info",    label: "Info (azul)" },
          { value: "warn",    label: "Atenção (amarelo)" },
          { value: "critico", label: "Crítico (vermelho)" }
        ], group: "Apresentação" },
      { name: "canal",       label: "Canal de notificação",     type: "select", valor: r.canal || "in_app",
        options: [
          { value: "in_app", label: "In-app (sino)" },
          { value: "email",  label: "Email (precisa SMTP ativo)" },
          { value: "both",   label: "Ambos" }
        ], group: "Apresentação" },
      { name: "ativo",       label: "Regra ativa?",             type: "select", valor: r.ativo === false ? "false" : "true",
        options: [{ value: "true", label: "Sim" }, { value: "false", label: "Não" }], group: "Apresentação" }
    ],
    onSubmit: function (v, done) {
      var payload = {
        nome: v.nome,
        descricao: v.descricao || null,
        tabela_alvo: v.tabela_alvo,
        acao_alvo: v.acao_alvo,
        campo_valor: v.campo_valor || null,
        operador_valor: v.operador_valor || null,
        valor_referencia: v.valor_referencia != null ? Number(v.valor_referencia) : null,
        destinatario_perfil: v.destinatario_perfil || null,
        destinatario_user_id: null,
        canal: v.canal || "in_app",
        severidade: v.severidade || "info",
        ativo: v.ativo === "true"
      };
      var q = editar
        ? client.from("auditoria_regras").update(payload).eq("id", r.id)
        : client.from("auditoria_regras").insert(payload);
      q.then(function (res) {
        if (res.error) { done(res.error.message); return; }
        regrasAlertaCarregado = false;
        carregarRegrasAlertaSeNecessario();
        done(null);
      });
    }
  });
}

setInterval(function () {
  if (window._terraUser && !alertasPollIv) iniciarPollingAlertas();
}, 5000);


// ===========================================================================
// Onda H — Detector e gestor de duplicados de FUNCIONÁRIOS
// ===========================================================================

function abrirDetectorDuplicadosFuncionarios() {
  var lista = funcionariosLista || [];
  if (!lista.length) {
    try { toast("Carregue a lista de funcionários antes (a tabela precisa estar carregada).", "warn"); } catch (e) {}
    return;
  }
  // Agrupar por CPF (só os que têm CPF)
  var byCpf = {};
  lista.forEach(function (f) {
    var cpf = (f.cpf || "").replace(/\D/g, "");
    if (!cpf || cpf.length < 11) return;
    if (!byCpf[cpf]) byCpf[cpf] = [];
    byCpf[cpf].push(f);
  });
  var gruposDup = Object.keys(byCpf).filter(function (k) { return byCpf[k].length > 1; }).map(function (k) {
    return { cpf: k, funcs: byCpf[k] };
  });

  if (!gruposDup.length) {
    try { toast("Nenhuma duplicidade de CPF encontrada. 🎉", "ok"); } catch (e) {}
    return;
  }

  // Construir HTML do modal
  var html = '<div style="margin-bottom: 14px; padding: 10px 14px; background: var(--warn-bg); border-left: 3px solid var(--warn); border-radius: 4px;">' +
    '<p style="margin:0; font-size:13px;"><strong>' + gruposDup.length + ' grupo(s) de CPF duplicado.</strong> Por grupo, escolha qual manter ATIVO. Os outros serão INATIVADOS (preserva histórico).</p>' +
    '<button class="btn-ouro" id="dup-auto-todos" type="button" style="margin-top:8px;">⚡ Auto-resolver todos (mantém ATIVO de cada grupo, inativa duplicatas)</button>' +
  '</div>';

  gruposDup.forEach(function (g, i) {
    html += '<div class="card fat-card" style="margin-bottom: 12px; padding: 14px;">' +
      '<h3 style="margin: 0 0 10px; font-size: 14px;">CPF <code>' + escHtml(g.cpf) + '</code> · ' + g.funcs.length + ' cadastro(s)</h3>' +
      '<table class="tabela"><thead><tr><th>Nome</th><th>Status</th><th>Cargo</th><th>Admissão</th><th>Demissão</th><th>Ações</th></tr></thead><tbody>';
    g.funcs.forEach(function (f) {
      var statusCls = f.status === "ATIVO" ? "solta" : "outras";
      html += '<tr data-dup-row="' + f.id + '">' +
        '<td><strong>' + escHtml(f.nome) + '</strong></td>' +
        '<td><span class="badge-tipo ' + statusCls + '">' + escHtml(f.status || "?") + '</span></td>' +
        '<td>' + escHtml(f.cargo || "—") + '</td>' +
        '<td>' + escHtml(f.data_admissao || "—") + '</td>' +
        '<td>' + escHtml(f.data_demissao || "—") + '</td>' +
        '<td>' +
          (f.status === "ATIVO"
            ? '<button class="btn-limpar" data-dup-action="inativar" data-id="' + f.id + '">⏸ Inativar este</button>'
            : '<button class="btn-limpar" data-dup-action="reativar" data-id="' + f.id + '">▶ Reativar este</button>'
          ) +
        '</td>' +
      '</tr>';
    });
    html += '</tbody></table></div>';
  });

  abrirModalDetalhe("Duplicados de CPF — funcionários", html);

  setTimeout(function () {
    // Wire-up auto-resolver
    var btnAuto = document.getElementById("dup-auto-todos");
    if (btnAuto) btnAuto.addEventListener("click", function () {
      if (!confirm("Auto-resolver TODOS os " + gruposDup.length + " grupos?\n\nPara cada CPF: mantém ATIVO o primeiro (ou o mais recente se nenhum estiver ativo) e inativa os outros.")) return;
      autoResolverDuplicadosFuncionarios(gruposDup);
    });
    // Wire-up por linha
    document.querySelectorAll("[data-dup-action]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.getAttribute("data-id"));
        var acao = btn.getAttribute("data-dup-action");
        var novoStatus = acao === "inativar" ? "INATIVO" : "ATIVO";
        client.from("funcionarios").update({ status: novoStatus }).eq("id", id).then(function (r) {
          if (r.error) { try { toast(r.error.message, "erro"); } catch (e) {} return; }
          try { toast(acao === "inativar" ? "Inativado." : "Reativado.", "ok"); } catch (e) {}
          // Atualizar visualmente: badge + label do botão
          var row = document.querySelector('[data-dup-row="' + id + '"]');
          if (row) {
            var badge = row.querySelector(".badge-tipo");
            if (badge) {
              badge.textContent = novoStatus;
              badge.className = "badge-tipo " + (novoStatus === "ATIVO" ? "solta" : "outras");
            }
            btn.textContent = novoStatus === "ATIVO" ? "⏸ Inativar este" : "▶ Reativar este";
            btn.setAttribute("data-dup-action", novoStatus === "ATIVO" ? "inativar" : "reativar");
          }
          // Atualizar cache local
          (funcionariosLista || []).forEach(function (f) { if (f.id === id) f.status = novoStatus; });
        });
      });
    });
  }, 50);
}

function autoResolverDuplicadosFuncionarios(grupos) {
  var idsParaInativar = [];
  grupos.forEach(function (g) {
    var ativos = g.funcs.filter(function (f) { return f.status === "ATIVO"; });
    var manter;
    if (ativos.length === 1) {
      manter = ativos[0];
    } else if (ativos.length > 1) {
      // Múltiplos ativos — manter o de admissão mais recente; senão o id maior
      manter = ativos.slice().sort(function (a, b) {
        var dA = a.data_admissao || "";
        var dB = b.data_admissao || "";
        if (dA && dB) return dB.localeCompare(dA);
        return b.id - a.id;
      })[0];
    } else {
      // Nenhum ativo — manter o de id maior (mais recente)
      manter = g.funcs.slice().sort(function (a, b) { return b.id - a.id; })[0];
    }
    g.funcs.forEach(function (f) {
      if (f.id !== manter.id && f.status === "ATIVO") idsParaInativar.push(f.id);
    });
  });
  if (!idsParaInativar.length) {
    try { toast("Nada pra fazer — cada grupo já tem só 1 ATIVO ou nenhum.", "warn"); } catch (e) {}
    return;
  }
  client.from("funcionarios").update({ status: "INATIVO" }).in("id", idsParaInativar).then(function (r) {
    if (r.error) { try { toast(r.error.message, "erro"); } catch (e) { alert(r.error.message); } return; }
    try { toast(idsParaInativar.length + " cadastro(s) inativado(s). 🎉", "ok"); } catch (e) {}
    funcionariosCarregado = false;
    carregarFuncionariosSeNecessario();
    // Fechar modal
    var ov = document.getElementById("modal-detalhe-overlay");
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  });
}

// Bind do botão "🔍 Duplicados" (idempotente, via showPage / dataset.bound)
(function () {
  function bind() {
    var b = document.getElementById("fn-btn-duplicados");
    if (!b || b.dataset.bound) return;
    b.dataset.bound = "1";
    b.addEventListener("click", abrirDetectorDuplicadosFuncionarios);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else setTimeout(bind, 200);
  // Re-bind em cada navegação (caso a section seja re-renderizada)
  document.addEventListener("click", function () { setTimeout(bind, 50); });
})();

// ===========================================================================
// Q5 — Command Palette (Ctrl+K)
// ===========================================================================

var CMD_PALETTE_PAGES = [
  { label: "Dashboard", page: "dashboard", grupo: "Dashboard" },
  { label: "Programa de Bônus", page: "programa_bonus", grupo: "Dashboard" },
  { label: "Bônus Individual", page: "programa_bonus_individual", grupo: "Dashboard" },
  { label: "Por Apropriação", page: "apr_dashboard", grupo: "Receita" },
  { label: "Por Faturamento", page: "apr_faturamento", grupo: "Receita" },
  { label: "Saldo a Reconhecer", page: "saldo_reconhecer", grupo: "Receita" },
  { label: "Vendas", page: "vendas", grupo: "Comercial" },
  { label: "Gestão de Faturamento", page: "faturamento", grupo: "Comercial" },
  { label: "Notas Fiscais", page: "notas", grupo: "Comercial" },
  { label: "Dashboard de Faturamento", page: "dashboard_faturamento", grupo: "Comercial" },
  { label: "Recebimentos", page: "recebimentos", grupo: "Financeiro" },
  { label: "Compromissos / A pagar", page: "caixa_compromissos", grupo: "Financeiro" },
  { label: "Entradas Avulsas", page: "entradas_outras", grupo: "Financeiro" },
  { label: "Saídas Avulsas", page: "saidas_outras", grupo: "Financeiro" },
  { label: "★ Margem por OS", page: "margem_os", grupo: "Custeio" },
  { label: "Custo por OS", page: "custos_os", grupo: "Custeio" },
  { label: "Custo Direto Via OS", page: "cust_direto_via_os", grupo: "Custeio" },
  { label: "Custo Direto Lançamento", page: "cust_direto_lanc", grupo: "Custeio" },
  { label: "Custo Indireto", page: "cust_indireto", grupo: "Custeio" },
  { label: "Despesas", page: "despesas", grupo: "Custeio" },
  { label: "Custo por Área", page: "cust_area", grupo: "Custeio" },
  { label: "OSs excluídas", page: "apr_excluidas", grupo: "Custeio" },
  { label: "Entregas pendentes", page: "entregas", grupo: "Custeio" },
  { label: "Fluxo de Caixa 12m", page: "fluxo_visao", grupo: "Contabilidade Gerencial" },
  { label: "Contas Bancárias", page: "fluxo_contas", grupo: "Contabilidade Gerencial" },
  { label: "Saldos Mensais", page: "fluxo_saldos", grupo: "Contabilidade Gerencial" },
  { label: "DRE", page: "dre", grupo: "Contabilidade Gerencial" },
  { label: "Lançamentos", page: "movimentos", grupo: "Contabilidade Gerencial" },
  { label: "Lançamentos de Caixa", page: "movimentos_caixa", grupo: "Contabilidade Gerencial" },
  { label: "Funcionários", page: "rh_funcionarios", grupo: "RH" },
  { label: "Benefícios", page: "rh_beneficios", grupo: "RH" },
  { label: "Folha", page: "rh_folha", grupo: "RH" },
  { label: "Impostos", page: "rh_impostos", grupo: "RH" },
  { label: "Organograma", page: "rh_organograma", grupo: "RH" },
  { label: "Medidas Disciplinares", page: "medidas_disciplinares", grupo: "RH" },
  { label: "Avaliação de Desempenho", page: "avaliacao_desempenho", grupo: "RH" },
  { label: "Bônus — Configuração", page: "rh_bonus_config", grupo: "RH" },
  { label: "Configuração", page: "configuracao", grupo: "Configuração" },
  { label: "Plano de Contas", page: "cfg_plano", grupo: "Configuração" },
  { label: "CFOP", page: "cfg_cfop", grupo: "Configuração" },
  { label: "Centros de Custo", page: "cfg_centros", grupo: "Configuração" },
  { label: "Rubricas", page: "cfg_rubricas", grupo: "Configuração" },
  { label: "Usuários", page: "cfg_usuarios", grupo: "Configuração" },
  { label: "Tipos de Perfil", page: "cfg_perfis_tipos", grupo: "Configuração" },
  { label: "Auditoria", page: "cfg_auditoria", grupo: "Configuração" },
  { label: "Alertas (caixa de entrada)", page: "cfg_aud_alertas", grupo: "Configuração" },
  { label: "Regras de Alerta", page: "cfg_aud_regras", grupo: "Configuração" },
  { label: "Diagnóstico", page: "cfg_diag", grupo: "Configuração" },
  { label: "Reset Completo", page: "cfg_reset", grupo: "Configuração" },
  { label: "Parâmetros", page: "cfg_parametros", grupo: "Configuração" },
  { label: "Importar", page: "importacoes", grupo: "Configuração" }
];

function abrirCommandPalette() {
  // Remove existente
  var ex = document.getElementById("cmd-palette");
  if (ex) { ex.remove(); return; }

  var ov = document.createElement("div");
  ov.id = "cmd-palette";
  ov.className = "cmd-palette-overlay";
  ov.innerHTML =
    '<div class="cmd-palette-box">' +
      '<input type="text" class="cmd-palette-input" id="cmd-palette-input" placeholder="🔍 Buscar tela ou ação… (Esc fecha)" autocomplete="off" />' +
      '<ul class="cmd-palette-list" id="cmd-palette-list"></ul>' +
      '<div class="cmd-palette-foot"><kbd>↑</kbd> <kbd>↓</kbd> navegar · <kbd>Enter</kbd> abrir · <kbd>Esc</kbd> fechar</div>' +
    '</div>';
  document.body.appendChild(ov);

  var input = document.getElementById("cmd-palette-input");
  var list  = document.getElementById("cmd-palette-list");
  var sel = 0;

  function renderResultados() {
    var q = (input.value || "").trim().toLowerCase();
    var resultados = CMD_PALETTE_PAGES.filter(function (p) {
      if (!q) return true;
      return (p.label.toLowerCase().indexOf(q) !== -1) || (p.grupo.toLowerCase().indexOf(q) !== -1);
    }).slice(0, 12);
    if (sel >= resultados.length) sel = 0;
    list.innerHTML = resultados.map(function (p, i) {
      return '<li class="cmd-item' + (i === sel ? ' cmd-item-sel' : '') + '" data-page="' + p.page + '">' +
        '<span class="cmd-grupo">' + escHtml(p.grupo) + '</span>' +
        '<span class="cmd-label">' + escHtml(p.label) + '</span>' +
      '</li>';
    }).join("");
    list.querySelectorAll(".cmd-item").forEach(function (li, i) {
      li.addEventListener("click", function () { irPara(resultados[i].page); });
    });
    list.querySelectorAll = list.querySelectorAll; // no-op
  }

  function irPara(pageId) {
    try { if (typeof showPage === "function") showPage(pageId); } catch (e) {}
    ov.remove();
  }

  input.addEventListener("input", renderResultados);
  input.addEventListener("keydown", function (e) {
    var itens = list.querySelectorAll(".cmd-item");
    if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, itens.length - 1); renderResultados(); input.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); renderResultados(); input.focus(); }
    else if (e.key === "Enter") {
      e.preventDefault();
      var pg = (list.querySelector(".cmd-item-sel") || itens[0] || {}).getAttribute && (list.querySelector(".cmd-item-sel") || itens[0]).getAttribute("data-page");
      if (pg) irPara(pg);
    }
    else if (e.key === "Escape") { e.preventDefault(); ov.remove(); }
  });

  ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });

  setTimeout(function () { input.focus(); renderResultados(); }, 0);
}

// Ctrl+K / Cmd+K — abre command palette
document.addEventListener("keydown", function (ev) {
  if ((ev.ctrlKey || ev.metaKey) && (ev.key === "k" || ev.key === "K")) {
    ev.preventDefault();
    abrirCommandPalette();
  }
});


// ===========================================================================
// M5 — BACKUPS (snapshots JSON do banco)
// ===========================================================================

var backupsLista = [];
var backupsCarregado = false;

function carregarBackupsSeNecessario() {
  var tbody = document.getElementById("bk-tbody");
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="tbl-vazio">Carregando histórico…</td></tr>';
  client.from("backups_historico").select("*").order("iniciado_em", { ascending: false }).limit(200).then(function (r) {
    if (r.error) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="tbl-vazio erro">Erro: ' + escHtml(r.error.message) + '</td></tr>';
      return;
    }
    backupsLista = r.data || [];
    backupsCarregado = true;
    renderBackups();
  });

  var btn = document.getElementById("bk-btn-gerar");
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = "1";
    btn.addEventListener("click", gerarBackupAgora);
  }
}

function renderBackups() {
  var tbody = document.getElementById("bk-tbody");
  if (!tbody) return;

  // KPIs
  var sucessos = backupsLista.filter(function (b) { return b.status === "sucesso"; });
  var ultimo = sucessos[0];
  var totalSize = sucessos.reduce(function (a, b) { return a + Number(b.tamanho_bytes || 0); }, 0);
  var tamMedio = sucessos.length ? Math.round(totalSize / sucessos.length) : 0;
  valText(document.getElementById("bk-m-qtd"), fmtInt(backupsLista.length));
  if (ultimo) {
    var iso = String(ultimo.iniciado_em || "");
    valText(document.getElementById("bk-m-ultimo"), iso.slice(8,10) + "/" + iso.slice(5,7) + " " + iso.slice(11,16));
    valText(document.getElementById("bk-m-ultimo-sub"), "tipo: " + ultimo.tipo);
  } else {
    valText(document.getElementById("bk-m-ultimo"), "—");
    valText(document.getElementById("bk-m-ultimo-sub"), "nenhum backup gerado ainda");
  }
  valText(document.getElementById("bk-m-tam"), tamMedio ? fmtBytes(tamMedio) : "—");

  function badgeStatus(s) {
    if (s === "sucesso") return '<span class="badge-tipo solta">sucesso</span>';
    if (s === "erro")    return '<span class="badge-tipo outras">erro</span>';
    return '<span class="badge-tipo assist">' + escHtml(s) + '</span>';
  }
  function fmtTs(iso) {
    if (!iso) return "—";
    var s = String(iso);
    return s.slice(8,10) + "/" + s.slice(5,7) + "/" + s.slice(0,4) + " " + s.slice(11,16);
  }

  preencherTbody(tbody, backupsLista.map(function (b) {
    var dur = b.duracao_ms ? Math.round(b.duracao_ms/1000) + "s" : "—";
    return '<tr>' +
      '<td class="mono">' + fmtTs(b.iniciado_em) + '</td>' +
      '<td>' + escHtml(b.tipo) + '</td>' +
      '<td>' + badgeStatus(b.status) + (b.erro ? '<br><span class="muted" style="font-size:11px;">' + escHtml(b.erro) + '</span>' : '') + '</td>' +
      '<td class="num">' + fmtInt(b.total_tabelas) + '</td>' +
      '<td class="num">' + fmtInt(b.total_linhas) + '</td>' +
      '<td class="num">' + (b.tamanho_bytes ? fmtBytes(b.tamanho_bytes) : "—") + '</td>' +
      '<td>' + dur + '</td>' +
      '<td>—</td>' +
    '</tr>';
  }), 8, { msg: "Nenhum backup gerado ainda. Clique em \"Gerar backup agora\" pra criar o primeiro.", icon: "💾" });
}

function fmtBytes(b) {
  if (!b) return "—";
  if (b < 1024) return b + " B";
  if (b < 1024*1024) return (b/1024).toFixed(1).replace(".", ",") + " KB";
  if (b < 1024*1024*1024) return (b/(1024*1024)).toFixed(1).replace(".", ",") + " MB";
  return (b/(1024*1024*1024)).toFixed(2).replace(".", ",") + " GB";
}

function gerarBackupAgora() {
  var btn = document.getElementById("bk-btn-gerar");
  var st  = document.getElementById("bk-status");
  if (btn) btn.disabled = true;
  if (st) { st.textContent = "⏳ Gerando snapshot (pode levar 10-30s)…"; st.style.color = "var(--text2)"; }

  var t0 = Date.now();
  client.rpc("fn_gerar_dump_json", { p_tipo: "manual" }).then(function (r) {
    if (btn) btn.disabled = false;
    if (r.error) {
      if (st) { st.textContent = "❌ " + r.error.message; st.style.color = "var(--danger)"; }
      try { toast("Erro ao gerar backup: " + r.error.message, "erro"); } catch (e) {}
      return;
    }
    var dump = r.data;
    var meta = (dump && dump.metadata) || {};
    // Download como arquivo
    try {
      var blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      var ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.href = url;
      a.download = "terra-backup-" + ts + ".json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      if (st) { st.textContent = "Backup gerado, mas falhou ao iniciar download: " + e.message; st.style.color = "var(--warn)"; }
      return;
    }
    var secs = Math.round((Date.now() - t0) / 1000);
    if (st) {
      st.textContent = "✓ Backup gerado em " + secs + "s — " + (meta.total_linhas || 0) + " linhas de " + (meta.total_tabelas || 0) + " tabelas. Arquivo salvo na sua pasta de Downloads.";
      st.style.color = "var(--success)";
    }
    try { toast("✓ Backup baixado!", "ok"); } catch (e) {}
    backupsCarregado = false;
    carregarBackupsSeNecessario();
  });
}


