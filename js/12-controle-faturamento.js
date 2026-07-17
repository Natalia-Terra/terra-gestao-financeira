/* Terra Conttemporanea - tela "Controle de Faturamento" (visao unica)
   Segue a aba Controle Faturamento da planilha: 4 blocos separados por cor,
   totalizadores em cards (respeitam o filtro) e uma linha por orcamento.
   Aditivo e a prova de falha: cria a propria section.page e o botao no menu. */
(function () {
  "use strict";
  var PAGE = "controle_faturamento";
  var G = {
    ident: ["#F1DCCF", "#7A3B1D", "#F8EBE2"],
    receb: ["#E2E0DA", "#4A4A44", "#EFEEEA"],
    fat:   ["#DCE6F2", "#1A4A7A", "#EDF3FB"],
    saldo: ["#F3E6C0", "#7A5A0B", "#FAF3E0"]
  };
  var COLS = [
    ["Data", 78, "ident", 0, "data"],
    ["Orçamento", 92, "ident", 0, "orcamento"],
    ["Nome", 210, "ident", 0, "nome"],
    ["Venda", 120, "ident", 1, "venda"],
    ["Adiantamento", 120, "receb", 1, "adiantamento"],
    ["Recebimento", 120, "receb", 1, "recebimento"],
    ["Result. Fin.", 110, "receb", 1, "resultado_financeiro"],
    ["A Receber", 120, "receb", 1, "a_receber"],
    ["Status Receb.", 118, "receb", 2, "status_recebimento"],
    ["Nota Fiscal", 120, "fat", 1, "nota_fiscal"],
    ["Venda S/ NF", 115, "fat", 1, "venda_sem_nf"],
    ["A Faturar", 120, "fat", 1, "a_faturar"],
    ["Status Fat.", 118, "fat", 2, "status_faturamento"],
    ["Saldo Adiant.", 122, "saldo", 1, "saldo_adiantamento"]
  ];
  var BANDS = [["Identificação","ident",4],["Gestão Recebimento (Caixa)","receb",5],["Gestão Faturamento (Competência)","fat",4],["Saldo","saldo",1]];
  var CARDS = [
    ["receb","Gestão Recebimento (Caixa)",[["Adiantamento","adiantamento"],["Recebimento","recebimento"],["Resultado Financeiro","resultado_financeiro"],["A Receber","a_receber"]]],
    ["fat","Gestão Faturamento (Competência)",[["Nota Fiscal","nota_fiscal"],["Venda S/ NF","venda_sem_nf"],["A Faturar","a_faturar"]]],
    ["saldo","Saldo de Adiantamento",[["Saldo em aberto","saldo_adiantamento"]]]
  ];
  var MES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  var dados = null, carregando = false;

  function b0(n){ return "R$ " + Math.round(n||0).toLocaleString("pt-BR"); }
  function b2(n){ return "R$ " + (Number(n)||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function dt(s){ if(!s) return "–"; var p=String(s).split("-"); return p[2]+"/"+MES[parseInt(p[1],10)-1]+"/"+p[0].slice(2); }

  function css(){
    if(document.getElementById("terra-cf-css")) return;
    var t=document.createElement("style"); t.id="terra-cf-css";
    t.textContent=[
      ".sidebar #terra-cf-btn{display:flex !important;}",
      "#cf-wrap{padding:2px 0 8px;}",
      "#cf-cards .cf-g{margin-bottom:12px;}",
      "#cf-cards .cf-gh{font-size:11px;font-weight:700;padding:3px 10px;border-radius:6px;display:inline-block;margin-bottom:7px;}",
      "#cf-cards .cf-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;}",
      "#cf-cards .cf-cd{border-radius:8px;padding:8px 12px;}",
      "#cf-cards .cf-cl{font-size:11px;}",
      "#cf-cards .cf-cv{font-size:16px;font-weight:700;color:#241606;margin-top:1px;}",
      "#cf-tbl{background:#FBF7F0;border:1px solid rgba(74,52,24,.34);border-radius:12px;overflow-x:auto;}",
      "#cf-tbl .cf-row:hover{background:#F0E8DA !important;}",
      "#cf-filtros{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0 12px;}",
      "#cf-filtros input,#cf-filtros select{font:inherit;font-size:12px;padding:6px 9px;border:1px solid #D8C9AE;border-radius:8px;background:#FBF7F0;color:#241606;}",
      "#cf-vazio{padding:24px;text-align:center;color:#8A6A38;font-size:13px;}"
    ].join("");
    document.head.appendChild(t);
  }

  function secao(){
    var m=document.querySelector("main.main"); if(!m) return null;
    var s=document.querySelector('section.page[data-page="'+PAGE+'"]');
    if(s) return s;
    s=document.createElement("section"); s.className="page"; s.setAttribute("data-page",PAGE); s.hidden=true;
    s.innerHTML='<div id="cf-wrap">'
      +'<h2 style="margin:0 0 2px;">Controle de Faturamento</h2>'
      +'<p style="margin:0 0 12px;font-size:13px;color:#6E4E22;">Uma linha por orçamento. Os totais respeitam o filtro aplicado.</p>'
      +'<div id="cf-filtros">'
        +'<input id="cf-busca" type="text" placeholder="Buscar cliente ou orçamento" style="min-width:230px;">'
        +'<select id="cf-fr"><option value="">Status recebimento: todos</option></select>'
        +'<select id="cf-ff"><option value="">Status faturamento: todos</option></select>'
        +'<span id="cf-cont" style="font-size:12px;color:#6E4E22;"></span>'
        +'<span style="flex:1"></span>'
        +'<button id="cf-reload" type="button" style="font:inherit;font-size:12px;padding:6px 11px;border-radius:8px;border:1px solid #D8C9AE;background:#FBF7F0;color:#241606;cursor:pointer;">Atualizar</button>'
      +'</div>'
      +'<div id="cf-cards"></div>'
      +'<div id="cf-tbl"><div id="cf-vazio">Carregando…</div></div>'
      +'</div>';
    m.appendChild(s);
    return s;
  }

  function botao(){
    if(document.getElementById("terra-cf-btn")) return;
    var grp=document.querySelector('.sidebar .sb-group[data-macro="comercial"] .sb-group-items');
    if(!grp) return;
    var b=document.createElement("button");
    b.type="button"; b.id="terra-cf-btn"; b.className="sb-sub";
    b.setAttribute("data-page",PAGE);
    b.style.fontWeight="700";
    b.textContent="★ Controle de Faturamento";
    b.addEventListener("click",function(){ try{ window.showPage(PAGE); }catch(e){} abrir(); });
    grp.insertBefore(b, grp.firstChild);
  }

  function carregar(force){
    if(carregando) return; 
    if(dados && !force){ pintar(); return; }
    carregando=true;
    var f="data,orcamento,nome,venda,adiantamento,recebimento,resultado_financeiro,a_receber,status_recebimento,nota_fiscal,venda_sem_nf,a_faturar,status_faturamento,saldo_adiantamento";
    var acc=[], page=0;
    function next(){
      window.client.from("orcamentos").select(f).order("data",{ascending:true}).range(page*1000,page*1000+999)
      .then(function(r){
        if(r.error){ carregando=false; erro(r.error.message); return; }
        acc=acc.concat(r.data||[]);
        if((r.data||[]).length===1000 && page<9){ page++; next(); return; }
        dados=acc; carregando=false; opcoes(); pintar();
      }, function(e){ carregando=false; erro(String(e)); });
    }
    next();
  }
  function erro(m){ var v=document.getElementById("cf-tbl"); if(v) v.innerHTML='<div id="cf-vazio">Não foi possível carregar: '+m+'</div>'; }

  function opcoes(){
    function fill(id,campo,lbl){
      var el=document.getElementById(id); if(!el) return;
      var vals=[]; dados.forEach(function(r){ var v=r[campo]; if(v && vals.indexOf(v)<0) vals.push(v); });
      vals.sort();
      el.innerHTML='<option value="">'+lbl+': todos</option>'+vals.map(function(v){return '<option value="'+v+'">'+v+'</option>';}).join("");
    }
    fill("cf-fr","status_recebimento","Status recebimento");
    fill("cf-ff","status_faturamento","Status faturamento");
  }

  function filtrados(){
    var q=(document.getElementById("cf-busca")||{}).value||"";
    var fr=(document.getElementById("cf-fr")||{}).value||"";
    var ff=(document.getElementById("cf-ff")||{}).value||"";
    q=q.trim().toLowerCase();
    return (dados||[]).filter(function(r){
      if(fr && r.status_recebimento!==fr) return false;
      if(ff && r.status_faturamento!==ff) return false;
      if(q){
        var s=((r.nome||"")+" "+(r.orcamento||"")).toLowerCase();
        if(s.indexOf(q)<0) return false;
      }
      return true;
    });
  }

  function chip(s){
    var m={"Liquidado":["#E6F5EE","#1A6B45"],"Em aberto":["#FEF3E2","#7A4800"],"A maior":["#E6EFF8","#1A4A7A"]};
    var c=m[s]||["#EDE4D8","#8A6A38"];
    return '<span style="background:'+c[0]+';color:'+c[1]+';font-size:10px;padding:2px 7px;border-radius:999px;white-space:nowrap;">'+(s||"—")+'</span>';
  }
  function money(v){
    v=Number(v)||0;
    if(v===0) return '<span style="color:#B9AC93;">–</span>';
    return '<span style="color:'+(v<0?"#8B2020":"#241606")+';">'+b2(v)+'</span>';
  }

  function pintar(){
    var rows=filtrados();
    var soma={}; COLS.forEach(function(c){ if(c[3]===1) soma[c[4]]=0; });
    rows.forEach(function(r){ Object.keys(soma).forEach(function(k){ soma[k]+=Number(r[k])||0; }); });
    var cont=document.getElementById("cf-cont");
    if(cont) cont.textContent=rows.length+" de "+(dados||[]).length+" orçamentos";

    var cards=document.getElementById("cf-cards");
    if(cards){
      var html='<div class="cf-g"><div class="cf-cards" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));">'
        +'<div class="cf-cd" style="background:#F3EADB;"><div class="cf-cl" style="color:#6E4E22;">Orçamentos</div><div class="cf-cv">'+rows.length+'</div></div>'
        +'<div class="cf-cd" style="background:'+G.ident[2]+';border:1px solid '+G.ident[0]+';"><div class="cf-cl" style="color:'+G.ident[1]+';">Venda total</div><div class="cf-cv">'+b0(soma.venda)+'</div></div>'
        +'</div></div>';
      CARDS.forEach(function(g){
        var c=G[g[0]];
        html+='<div class="cf-g"><span class="cf-gh" style="background:'+c[0]+';color:'+c[1]+';">'+g[1]+'</span><div class="cf-cards">'
          +g[2].map(function(it){ return '<div class="cf-cd" style="background:'+c[2]+';border:1px solid '+c[0]+';"><div class="cf-cl" style="color:'+c[1]+';">'+it[0]+'</div><div class="cf-cv">'+b0(soma[it[1]])+'</div></div>'; }).join("")
          +'</div></div>';
      });
      cards.innerHTML=html;
    }

    var tmpl=COLS.map(function(c){return c[1]+"px";}).join(" ");
    var total=COLS.reduce(function(a,c){return a+c[1];},0);
    var bcols=[], start=0;
    BANDS.forEach(function(b){ var w=0; for(var i=start;i<start+b[2];i++) w+=COLS[i][1]; bcols.push(w+"px"); start+=b[2]; });
    var h='<div style="min-width:'+total+'px;">'
      +'<div style="display:grid;grid-template-columns:'+bcols.join(" ")+';font-size:11.5px;font-weight:700;">'
      + BANDS.map(function(b){var c=G[b[1]];return '<div style="background:'+c[0]+';color:'+c[1]+';text-align:center;padding:6px 4px;border-right:2px solid #ECE3D5;">'+b[0]+'</div>';}).join("")
      +'</div>'
      +'<div style="display:grid;grid-template-columns:'+tmpl+';font-size:11px;">'
      + COLS.map(function(c){var g=G[c[2]];return '<div style="background:'+g[2]+';color:'+g[1]+';padding:6px 8px;border-right:1px solid #ECE3D5;font-weight:700;'+(c[3]===1?"text-align:right;":"")+'">'+c[0]+'</div>';}).join("")
      +'</div>';
    if(!rows.length){ h+='<div id="cf-vazio">Nenhum orçamento com esse filtro.</div>'; }
    h+= rows.map(function(r,ri){
      var cells=COLS.map(function(c){
        var v=r[c[4]], inner;
        if(c[3]===2) inner=chip(v);
        else if(c[3]===1) inner=money(v);
        else if(c[4]==="data") inner='<span style="color:#8A6A38;">'+dt(v)+'</span>';
        else inner='<span style="color:'+(c[4]==="orcamento"?"#8A6A38":"#3C2A18")+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;">'+(v||"–")+'</span>';
        return '<div style="padding:8px;border-right:1px solid #F0E7D6;'+(c[3]===1?"text-align:right;font-weight:700;":"")+'">'+inner+'</div>';
      }).join("");
      return '<div class="cf-row" style="display:grid;grid-template-columns:'+tmpl+';font-size:11px;border-top:1px solid #EBDFCB;'+(ri%2?"background:#F7F1E6;":"")+'">'+cells+'</div>';
    }).join("");
    h+='</div>';
    var tbl=document.getElementById("cf-tbl");
    if(tbl) tbl.innerHTML=h;
  }

  function abrir(){
    css(); var s=secao(); if(!s) return;
    if(!s._bound){
      s._bound=true;
      ["cf-busca","cf-fr","cf-ff"].forEach(function(id){
        var el=document.getElementById(id);
        if(el) el.addEventListener(id==="cf-busca"?"input":"change",function(){ if(dados) pintar(); });
      });
      var rl=document.getElementById("cf-reload");
      if(rl) rl.addEventListener("click",function(){ carregar(true); });
    }
    carregar(false);
  }

  function boot(){ try{ css(); secao(); botao(); }catch(e){} }
  function start(){
    boot();
    var n=0, iv=setInterval(function(){ boot(); if(++n>=20) clearInterval(iv); },500);
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",start); else start();
})();
