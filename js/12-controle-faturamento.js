/* Terra Conttemporanea - tela "Controle de Faturamento" (visao unica)
   v2: seletor Safra/Competencia, filtro multiplo de ano+mes, cabecalho fixo,
   rolagem sempre visivel e destaque dos lancamentos SEM_ORC.
   Aditivo e a prova de falha. */
(function () {
  "use strict";
  var PAGE = "controle_faturamento";
  var MES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  var G = {
    ident: ["#F1DCCF", "#7A3B1D", "#F8EBE2"],
    receb: ["#E2E0DA", "#4A4A44", "#EFEEEA"],
    fat:   ["#DCE6F2", "#1A4A7A", "#EDF3FB"],
    saldo: ["#F3E6C0", "#7A5A0B", "#FAF3E0"]
  };
  /* [rotulo, largura, grupo, tipo(0 texto,1 dinheiro,2 chip), campo] */
  var COLS_SAFRA = [
    ["Data",78,"ident",0,"data"],["Orçamento",92,"ident",0,"orcamento"],["Nome",200,"ident",0,"nome"],["Venda",118,"ident",1,"venda"],
    ["Adiantamento",118,"receb",1,"adiantamento"],["Recebimento",118,"receb",1,"recebimento"],["Result. Fin.",106,"receb",1,"resultado_financeiro"],["A Receber",118,"receb",1,"a_receber"],["Status Receb.",116,"receb",2,"status_recebimento"],
    ["Nota Fiscal",118,"fat",1,"nota_fiscal"],["Venda S/ NF",112,"fat",1,"venda_sem_nf"],["A Faturar",118,"fat",1,"a_faturar"],["Status Fat.",116,"fat",2,"status_faturamento"],
    ["Saldo Adiant.",120,"saldo",1,"saldo_adiantamento"]
  ];
  var BANDS_SAFRA = [["Identificação","ident",4],["Gestão Recebimento (Caixa)","receb",5],["Gestão Faturamento (Competência)","fat",4],["Saldo","saldo",1]];
  var COLS_COMP = [
    ["Orçamento",100,"ident",0,"orcamento"],["Nome",210,"ident",0,"nome"],["Venda",120,"ident",1,"venda"],
    ["Adiantamento",120,"receb",1,"adiantamento"],["Recebimento",120,"receb",1,"recebimento"],["Result. Fin.",110,"receb",1,"resultado_financeiro"],
    ["Nota Fiscal",120,"fat",1,"nota_fiscal"],["Venda S/ NF",115,"fat",1,"venda_sem_nf"],["Entrega S/ NF",120,"fat",1,"entrega_sem_nf"]
  ];
  var BANDS_COMP = [["Identificação","ident",3],["Gestão Recebimento (Caixa)","receb",3],["Gestão Faturamento (Competência)","fat",3]];
  var NAT2F = {"Venda":"venda","Adiantamento":"adiantamento","Recebimento":"recebimento","Resultado Financeiro":"resultado_financeiro","Nota Fiscal":"nota_fiscal","Venda S/ NF":"venda_sem_nf","Entrega S/ NF":"entrega_sem_nf","Nota Fiscal Serviço":"nf_servico","Outras Receitas":"outras_receitas"};
  var CARDS_SAFRA = [
    ["receb","Gestão Recebimento (Caixa)",[["Adiantamento","adiantamento"],["Recebimento","recebimento"],["Resultado Financeiro","resultado_financeiro"],["A Receber","a_receber"]]],
    ["fat","Gestão Faturamento (Competência)",[["Nota Fiscal","nota_fiscal"],["Venda S/ NF","venda_sem_nf"],["A Faturar","a_faturar"]]],
    ["saldo","Saldo de Adiantamento",[["Saldo em aberto","saldo_adiantamento"]]]
  ];
  var CARDS_COMP = [
    ["receb","Gestão Recebimento (Caixa)",[["Adiantamento","adiantamento"],["Recebimento","recebimento"],["Resultado Financeiro","resultado_financeiro"]]],
    ["fat","Gestão Faturamento (Competência)",[["Nota Fiscal","nota_fiscal"],["Venda S/ NF","venda_sem_nf"],["Entrega S/ NF","entrega_sem_nf"],["NF Serviço","nf_servico"],["Outras Receitas","outras_receitas"]]]
  ];

  var orcs=null, movs=null, carregando=false;
  var modo="safra", fAnos=[], fMeses=[], soSemOrc=false;

  function b0(n){ return "R$ " + Math.round(n||0).toLocaleString("pt-BR"); }
  function b2(n){ return "R$ " + (Number(n)||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function dtBR(s){ if(!s) return "–"; var p=String(s).split("-"); return p[2]+"/"+MES[parseInt(p[1],10)-1]+"/"+p[0].slice(2); }
  function ymd(s){ if(!s) return null; var p=String(s).split("-"); return {a:parseInt(p[0],10), m:parseInt(p[1],10)}; }

  function css(){
    if(document.getElementById("terra-cf-css")) return;
    var t=document.createElement("style"); t.id="terra-cf-css";
    t.textContent=[
      ".sidebar #terra-cf-btn{display:flex !important;}",
      "#cf-modo button{font:inherit;font-size:12px;padding:7px 13px;border:1px solid #D8C9AE;background:#FBF7F0;color:#6E4E22;cursor:pointer;}",
      "#cf-modo button:first-child{border-radius:8px 0 0 8px;}#cf-modo button:last-child{border-radius:0 8px 8px 0;border-left:0;}",
      "#cf-modo button.on{background:#3C2A18;color:#F1E6D2;border-color:#3C2A18;font-weight:700;}",
      "#cf-dica{font-size:12px;color:#6E4E22;background:#F3EADB;border-left:3px solid #9A6B12;padding:7px 11px;border-radius:0 8px 8px 0;margin:10px 0;}",
      "#cf-periodo{display:flex;gap:8px;align-items:center;margin:10px 0 2px;flex-wrap:wrap;}",
      "#cf-periodo>button{font:inherit;font-size:12px;padding:7px 12px;border-radius:8px;border:1px solid #D8C9AE;background:#FBF7F0;color:#6E4E22;cursor:pointer;}",
      ".cf-dd{position:relative;}",
      ".cf-dd-b{font:inherit;font-size:12px;padding:7px 12px;border-radius:8px;border:1px solid #D8C9AE;background:#FBF7F0;color:#241606;cursor:pointer;display:inline-flex;align-items:center;gap:10px;min-width:150px;justify-content:space-between;}",
      ".cf-dd.on .cf-dd-b{border-color:#9A6B12;box-shadow:0 0 0 2px rgba(154,107,18,.18);}",
      ".cf-dd-c{color:#8A6A38;font-size:10px;}",
      ".cf-dd-m{display:none;position:absolute;z-index:50;top:calc(100% + 4px);left:0;min-width:190px;max-height:260px;overflow:auto;background:#FBF7F0;border:1px solid #D8C9AE;border-radius:10px;box-shadow:0 8px 24px rgba(46,32,18,.18);padding:6px;}",
      ".cf-dd.aberto .cf-dd-m{display:block;}",
      ".cf-opt{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;font-size:12.5px;color:#241606;cursor:pointer;}",
      ".cf-opt:hover{background:#F1E9DC;}",
      ".cf-opt input{width:14px;height:14px;accent-color:#9A6B12;cursor:pointer;}",
      "#cf-cards .cf-g{margin-bottom:10px;}",
      "#cf-cards .cf-gh{font-size:11px;font-weight:700;padding:3px 10px;border-radius:6px;display:inline-block;margin-bottom:6px;}",
      "#cf-cards .cf-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,190px));gap:8px;}",
      "#cf-cards .cf-cd{border-radius:8px;padding:8px 12px;}",
      "#cf-cards .cf-cl{font-size:11px;}",
      "#cf-cards .cf-cv{font-size:15px;font-weight:700;color:#241606;margin-top:1px;}",
      "#cf-scroll{background:#FBF7F0;border:1px solid rgba(74,52,24,.34);border-radius:12px;overflow:auto;max-height:calc(100vh - 300px);}",
      "#cf-xbar{overflow-x:auto;overflow-y:hidden;height:14px;margin-bottom:3px;}",
      "#cf-xbar-in{height:1px;}",
      "#cf-scroll .cf-band{position:sticky;top:0;z-index:3;}",
      "#cf-scroll .cf-head{position:sticky;top:27px;z-index:3;}",
      "#cf-scroll .cf-row:hover{background:#F0E8DA !important;}",
      ".cf-semorc{background:#FDF3DE !important;}",
      "#cf-alerta{font-size:12px;background:#FEF3E2;color:#7A4800;border:1px solid #F0D9AE;border-radius:8px;padding:7px 11px;margin-bottom:8px;display:none;}",
      "#cf-alerta button{font:inherit;font-size:11.5px;margin-left:8px;padding:3px 9px;border-radius:6px;border:1px solid #C99B4A;background:#fff;color:#7A4800;cursor:pointer;}",
      "#cf-filtros{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0;}",
      "#cf-filtros input,#cf-filtros select{font:inherit;font-size:12px;padding:6px 9px;border:1px solid #D8C9AE;border-radius:8px;background:#FBF7F0;color:#241606;}",
      "#cf-vazio{padding:22px;text-align:center;color:#8A6A38;font-size:13px;}"
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
      +'<div id="cf-modo" style="display:inline-flex;margin:8px 0 0;">'
        +'<button type="button" data-m="safra" class="on">Safra (data do orçamento)</button>'
        +'<button type="button" data-m="competencia">Competência (movimento no mês)</button>'
      +'</div>'
      +'<div id="cf-dica"></div>'
      +'<div id="cf-periodo">'
        +'<div class="cf-dd" id="cf-dd-ano"><button type="button" class="cf-dd-b"><span class="cf-dd-t">Ano: todos</span><span class="cf-dd-c">▾</span></button><div class="cf-dd-m" id="cf-anos"></div></div>'
        +'<div class="cf-dd" id="cf-dd-mes"><button type="button" class="cf-dd-b"><span class="cf-dd-t">Mês: todos</span><span class="cf-dd-c">▾</span></button><div class="cf-dd-m" id="cf-meses"></div></div>'
        +'<button type="button" id="cf-limpar">limpar período</button>'
      +'</div>'
      +'<div id="cf-filtros">'
        +'<input id="cf-busca" type="text" placeholder="Buscar cliente ou orçamento" style="min-width:220px;">'
        +'<select id="cf-fr"><option value="">Status recebimento: todos</option></select>'
        +'<select id="cf-ff"><option value="">Status faturamento: todos</option></select>'
        +'<span id="cf-cont" style="font-size:12px;color:#6E4E22;"></span>'
        +'<span style="flex:1"></span>'
        +'<button id="cf-reload" type="button" style="font:inherit;font-size:12px;padding:6px 11px;border-radius:8px;border:1px solid #D8C9AE;background:#FBF7F0;color:#241606;cursor:pointer;">Atualizar</button>'
      +'</div>'
      +'<div id="cf-alerta"></div>'
      +'<div id="cf-cards"></div>'
      +'<div id="cf-xbar"><div id="cf-xbar-in"></div></div>'
      +'<div id="cf-scroll"><div id="cf-vazio">Carregando…</div></div>'
      +'</div>';
    m.appendChild(s);
    try{
      if(window.MutationObserver){
        new MutationObserver(function(){ if(!s.hidden) abrir(); })
          .observe(s,{attributes:true, attributeFilter:["hidden"]});
      }
    }catch(e){}
    return s;
  }

  function botao(){
    if(document.getElementById("terra-cf-btn")) return;
    var grp=document.querySelector('.sidebar .sb-group[data-macro="comercial"] .sb-group-items');
    if(!grp) return;
    var b=document.createElement("button");
    b.type="button"; b.id="terra-cf-btn"; b.className="sb-sub";
    b.setAttribute("data-page",PAGE); b.style.fontWeight="700";
    b.textContent="★ Controle de Faturamento";
    b.addEventListener("click",function(){ try{ window.showPage(PAGE); }catch(e){} abrir(); });
    grp.insertBefore(b, grp.firstChild);
  }

  function pagina(tabela, campos, cb){
    var acc=[], p=0;
    function go(){
      window.client.from(tabela).select(campos).range(p*1000,p*1000+999).then(function(r){
        if(r.error){ cb(r.error.message, null); return; }
        acc=acc.concat(r.data||[]);
        if((r.data||[]).length===1000 && p<9){ p++; go(); return; }
        cb(null, acc);
      }, function(e){ cb(String(e), null); });
    }
    go();
  }

  function carregar(force){
    if(carregando) return;
    if(orcs && movs && !force){ opcoes(); pintar(); return; }
    carregando=true;
    pagina("orcamentos","data,orcamento,nome,venda,adiantamento,recebimento,resultado_financeiro,a_receber,status_recebimento,nota_fiscal,venda_sem_nf,a_faturar,status_faturamento,saldo_adiantamento",function(e1,a){
      if(e1){ carregando=false; erro(e1); return; }
      orcs=a;
      pagina("movimentos","competencia,orcamento,nome,natureza,valor",function(e2,b){
        carregando=false;
        if(e2){ erro(e2); return; }
        movs=(b||[]).filter(function(m){return m.competencia;});
        opcoes(); pintar();
      });
    });
  }
  function erro(m){ var v=document.getElementById("cf-scroll"); if(v) v.innerHTML='<div id="cf-vazio">Não foi possível carregar: '+m+'</div>'; }

  function anosDisponiveis(){
    var s={};
    (modo==="safra"?orcs:movs).forEach(function(r){
      var d=ymd(modo==="safra"?r.data:r.competencia); if(d) s[d.a]=1;
    });
    return Object.keys(s).map(Number).sort();
  }

  function opcoes(){
    var box=document.getElementById("cf-anos");
    if(box){
      box.innerHTML=anosDisponiveis().map(function(a){
        return '<label class="cf-opt"><input type="checkbox" data-ano="'+a+'"'+(fAnos.indexOf(a)>-1?' checked':'')+'>'+a+'</label>';
      }).join("");
      [].forEach.call(box.querySelectorAll("[data-ano]"),function(cb){
        cb.addEventListener("change",function(){
          var a=parseInt(cb.getAttribute("data-ano"),10); var i=fAnos.indexOf(a);
          if(cb.checked){ if(i<0) fAnos.push(a); } else if(i>-1) fAnos.splice(i,1);
          rotulos(); pintar();
        });
      });
    }
    var bm=document.getElementById("cf-meses");
    if(bm){
      bm.innerHTML=MES.map(function(nm,i){
        return '<label class="cf-opt"><input type="checkbox" data-mes="'+(i+1)+'"'+(fMeses.indexOf(i+1)>-1?' checked':'')+'>'+nm+'</label>';
      }).join("");
      [].forEach.call(bm.querySelectorAll("[data-mes]"),function(cb){
        cb.addEventListener("change",function(){
          var m=parseInt(cb.getAttribute("data-mes"),10); var i=fMeses.indexOf(m);
          if(cb.checked){ if(i<0) fMeses.push(m); } else if(i>-1) fMeses.splice(i,1);
          rotulos(); pintar();
        });
      });
    }
    rotulos();
    if(orcs){
      function fill(id,campo,lbl){
        var el=document.getElementById(id); if(!el) return;
        var v=el.value, vals=[];
        orcs.forEach(function(r){ var x=r[campo]; if(x && vals.indexOf(x)<0) vals.push(x); });
        vals.sort();
        el.innerHTML='<option value="">'+lbl+': todos</option>'+vals.map(function(x){return '<option value="'+x+'">'+x+'</option>';}).join("");
        el.value=v;
      }
      fill("cf-fr","status_recebimento","Status recebimento");
      fill("cf-ff","status_faturamento","Status faturamento");
    }
    var d=document.getElementById("cf-dica");
    if(d) d.innerHTML = modo==="safra"
      ? "<b>Safra:</b> mostra os orçamentos <b>aprovados</b> no período escolhido, com a <b>posição atual</b> deles (o quanto já foi faturado/recebido até hoje)."
      : "<b>Competência:</b> mostra o que <b>aconteceu dentro</b> do período — vendas, faturamento e recebimentos lançados naquele(s) mês(es). É o fechamento do mês.";
    var fr=document.getElementById("cf-fr"), ff=document.getElementById("cf-ff");
    if(fr) fr.style.display = modo==="safra"?"":"none";
    if(ff) ff.style.display = modo==="safra"?"":"none";
  }

  function rotulos(){
    try{
      var da=document.querySelector("#cf-dd-ano .cf-dd-t");
      if(da) da.textContent = fAnos.length? ("Ano: "+fAnos.slice().sort().join(", ")) : "Ano: todos";
      var dm=document.querySelector("#cf-dd-mes .cf-dd-t");
      if(dm) dm.textContent = !fMeses.length ? "Mês: todos"
        : (fMeses.length<=3 ? ("Mês: "+fMeses.slice().sort(function(a,b){return a-b;}).map(function(m){return MES[m-1];}).join(", "))
                            : ("Mês: "+fMeses.length+" selecionados"));
      var ca=document.getElementById("cf-dd-ano"); if(ca) ca.classList.toggle("on", fAnos.length>0);
      var cm=document.getElementById("cf-dd-mes"); if(cm) cm.classList.toggle("on", fMeses.length>0);
    }catch(e){}
  }

  function ligarDropdowns(){
    ["cf-dd-ano","cf-dd-mes"].forEach(function(id){
      var dd=document.getElementById(id); if(!dd||dd._dd) return; dd._dd=true;
      dd.querySelector(".cf-dd-b").addEventListener("click",function(ev){
        ev.stopPropagation();
        var aberto=dd.classList.contains("aberto");
        document.querySelectorAll(".cf-dd").forEach(function(x){x.classList.remove("aberto");});
        if(!aberto) dd.classList.add("aberto");
      });
      dd.querySelector(".cf-dd-m").addEventListener("click",function(ev){ ev.stopPropagation(); });
    });
    if(!document._ddDoc){ document._ddDoc=true;
      document.addEventListener("click",function(){ document.querySelectorAll(".cf-dd").forEach(function(x){x.classList.remove("aberto");}); });
    }
  }

  function noPeriodo(dstr){
    var d=ymd(dstr); if(!d) return false;
    if(fAnos.length && fAnos.indexOf(d.a)<0) return false;
    if(fMeses.length && fMeses.indexOf(d.m)<0) return false;
    return true;
  }

  function linhasSafra(){
    var q=((document.getElementById("cf-busca")||{}).value||"").trim().toLowerCase();
    var fr=(document.getElementById("cf-fr")||{}).value||"";
    var ff=(document.getElementById("cf-ff")||{}).value||"";
    return (orcs||[]).filter(function(r){
      if((fAnos.length||fMeses.length) && !noPeriodo(r.data)) return false;
      if(fr && r.status_recebimento!==fr) return false;
      if(ff && r.status_faturamento!==ff) return false;
      if(q && (((r.nome||"")+" "+(r.orcamento||"")).toLowerCase().indexOf(q)<0)) return false;
      return true;
    });
  }

  function linhasComp(){
    var q=((document.getElementById("cf-busca")||{}).value||"").trim().toLowerCase();
    var mapa={}, semOrc={n:0,t:0};
    (movs||[]).forEach(function(m){
      if((fAnos.length||fMeses.length) && !noPeriodo(m.competencia)) return;
      var k=m.orcamento||"SEM_ORC";
      if(soSemOrc && k!=="SEM_ORC") return;
      if(q && (((m.nome||"")+" "+k).toLowerCase().indexOf(q)<0)) return;
      if(!mapa[k]) mapa[k]={orcamento:k, nome:m.nome||"", _semorc:(k==="SEM_ORC"), venda:0,adiantamento:0,recebimento:0,resultado_financeiro:0,nota_fiscal:0,venda_sem_nf:0,entrega_sem_nf:0,nf_servico:0,outras_receitas:0};
      var f=NAT2F[m.natureza];
      if(f) mapa[k][f]+=(Number(m.valor)||0);
      if(k==="SEM_ORC"){ semOrc.n++; semOrc.t+=(Number(m.valor)||0); }
    });
    var arr=Object.keys(mapa).map(function(k){return mapa[k];});
    arr.sort(function(a,b){ if(a._semorc) return 1; if(b._semorc) return -1; return b.venda-a.venda; });
    arr._semOrc=semOrc;
    return arr;
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
    var safra = modo==="safra";
    var COLS = safra?COLS_SAFRA:COLS_COMP, BANDS = safra?BANDS_SAFRA:BANDS_COMP, CARDS = safra?CARDS_SAFRA:CARDS_COMP;
    var rows = safra?linhasSafra():linhasComp();

    var soma={}; COLS.forEach(function(c){ if(c[3]===1) soma[c[4]]=0; });
    if(!safra){ soma.nf_servico=0; soma.outras_receitas=0; }
    rows.forEach(function(r){ Object.keys(soma).forEach(function(k){ soma[k]+=Number(r[k])||0; }); });

    var cont=document.getElementById("cf-cont");
    if(cont) cont.textContent = safra
      ? rows.length+" de "+(orcs||[]).length+" orçamentos"
      : rows.length+" orçamento(s) com movimento no período";

    var al=document.getElementById("cf-alerta");
    if(al){
      var so = !safra && rows._semOrc && rows._semOrc.n>0;
      if(so){
        al.style.display="block";
        al.innerHTML='⚠ <b>'+rows._semOrc.n+' lançamento(s) sem orçamento</b> ('+b0(rows._semOrc.t)+') incluídos no período — aparecem destacados na última linha. Vale corrigir a origem.'
          +'<button type="button" id="cf-so">'+(soSemOrc?"ver todos":"ver só estes")+'</button>';
        var bso=document.getElementById("cf-so");
        if(bso) bso.addEventListener("click",function(){ soSemOrc=!soSemOrc; pintar(); });
      } else al.style.display="none";
    }

    var cards=document.getElementById("cf-cards");
    if(cards){
      var html='<div class="cf-g"><div class="cf-cards">'
        +'<div class="cf-cd" style="background:#F3EADB;"><div class="cf-cl" style="color:#6E4E22;">'+(safra?"Orçamentos":"Orçamentos c/ mov.")+'</div><div class="cf-cv">'+rows.length+'</div></div>'
        +'<div class="cf-cd" style="background:'+G.ident[2]+';border:1px solid '+G.ident[0]+';"><div class="cf-cl" style="color:'+G.ident[1]+';">Venda</div><div class="cf-cv">'+b0(soma.venda)+'</div></div>'
        +'</div></div>';
      CARDS.forEach(function(g){
        var c=G[g[0]];
        var its=g[2].filter(function(it){ return safra || Math.abs(soma[it[1]]||0)>0.5 || ["adiantamento","recebimento","nota_fiscal","venda_sem_nf","entrega_sem_nf"].indexOf(it[1])>-1; });
        if(!its.length) return;
        html+='<div class="cf-g"><span class="cf-gh" style="background:'+c[0]+';color:'+c[1]+';">'+g[1]+'</span><div class="cf-cards">'
          +its.map(function(it){ return '<div class="cf-cd" style="background:'+c[2]+';border:1px solid '+c[0]+';"><div class="cf-cl" style="color:'+c[1]+';">'+it[0]+'</div><div class="cf-cv">'+b0(soma[it[1]])+'</div></div>'; }).join("")
          +'</div></div>';
      });
      cards.innerHTML=html;
    }

    var tmpl=COLS.map(function(c){return c[1]+"px";}).join(" ");
    var total=COLS.reduce(function(a,c){return a+c[1];},0);
    var bcols=[], start=0;
    BANDS.forEach(function(b){ var w=0; for(var i=start;i<start+b[2];i++) w+=COLS[i][1]; bcols.push(w+"px"); start+=b[2]; });
    var h='<div style="min-width:'+total+'px;">'
      +'<div class="cf-band" style="display:grid;grid-template-columns:'+bcols.join(" ")+';font-size:11.5px;font-weight:700;">'
      + BANDS.map(function(b){var c=G[b[1]];return '<div style="background:'+c[0]+';color:'+c[1]+';text-align:center;padding:5px 4px;border-right:2px solid #ECE3D5;">'+b[0]+'</div>';}).join("")
      +'</div>'
      +'<div class="cf-head" style="display:grid;grid-template-columns:'+tmpl+';font-size:11px;">'
      + COLS.map(function(c){var g=G[c[2]];return '<div style="background:'+g[2]+';color:'+g[1]+';padding:6px 8px;border-right:1px solid #ECE3D5;font-weight:700;'+(c[3]===1?"text-align:right;":"")+'">'+c[0]+'</div>';}).join("")
      +'</div>';
    if(!rows.length) h+='<div id="cf-vazio">Nenhum registro com esse filtro.</div>';
    h+= rows.map(function(r,ri){
      var cells=COLS.map(function(c){
        var v=r[c[4]], inner;
        if(c[3]===2) inner=chip(v);
        else if(c[3]===1) inner=money(v);
        else if(c[4]==="data") inner='<span style="color:#8A6A38;">'+dtBR(v)+'</span>';
        else if(c[4]==="orcamento" && r._semorc) inner='<span style="color:#7A4800;font-weight:700;">sem orçamento</span>';
        else inner='<span style="color:'+(c[4]==="orcamento"?"#8A6A38":"#3C2A18")+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;">'+(v||"–")+'</span>';
        return '<div style="padding:7px 8px;border-right:1px solid #F0E7D6;'+(c[3]===1?"text-align:right;font-weight:700;":"")+'">'+inner+'</div>';
      }).join("");
      return '<div class="cf-row'+(r._semorc?" cf-semorc":"")+'" style="display:grid;grid-template-columns:'+tmpl+';font-size:11px;border-top:1px solid #EBDFCB;'+(!r._semorc&&ri%2?"background:#F7F1E6;":"")+'">'+cells+'</div>';
    }).join("");
    h+='</div>';
    var sc=document.getElementById("cf-scroll");
    if(sc){ sc.innerHTML=h; ajustarAltura(); }
  }

  function ajustarAltura(){
    try{
      var sc=document.getElementById("cf-scroll"); if(!sc) return;
      var top=sc.getBoundingClientRect().top;
      sc.style.maxHeight=Math.max(360, window.innerHeight - top - 18)+"px";
      sincronizarBarraX();
    }catch(e){}
  }

  function sincronizarBarraX(){
    try{
      var sc=document.getElementById("cf-scroll"), xb=document.getElementById("cf-xbar"), xi=document.getElementById("cf-xbar-in");
      if(!sc||!xb||!xi) return;
      xi.style.width=sc.scrollWidth+"px";
      xb.style.display = sc.scrollWidth>sc.clientWidth ? "block" : "none";
      if(!xb._sync){
        xb._sync=true;
        xb.addEventListener("scroll",function(){ if(sc.scrollLeft!==xb.scrollLeft) sc.scrollLeft=xb.scrollLeft; });
        sc.addEventListener("scroll",function(){ if(xb.scrollLeft!==sc.scrollLeft) xb.scrollLeft=sc.scrollLeft; });
      }
    }catch(e){}
  }

  function abrir(){
    css(); var s=secao(); if(!s) return;
    if(!s._bound){
      s._bound=true;
      ["cf-busca","cf-fr","cf-ff"].forEach(function(id){
        var el=document.getElementById(id);
        if(el) el.addEventListener(id==="cf-busca"?"input":"change",function(){ if(orcs) pintar(); });
      });
      var rl=document.getElementById("cf-reload"); if(rl) rl.addEventListener("click",function(){ carregar(true); });
      window.addEventListener("resize", ajustarAltura);
      var lp=document.getElementById("cf-limpar"); if(lp) lp.addEventListener("click",function(){ fAnos=[]; fMeses=[]; opcoes(); pintar(); });
      ligarDropdowns();
      [].forEach.call(document.querySelectorAll("#cf-modo button"),function(b){
        b.addEventListener("click",function(){
          modo=b.getAttribute("data-m"); soSemOrc=false;
          [].forEach.call(document.querySelectorAll("#cf-modo button"),function(x){x.classList.toggle("on",x===b);});
          opcoes(); pintar();
        });
      });
    }
    carregar(false);
  }

  function boot(){
    try{
      css(); var s=secao(); botao();
      if(s && !s.hidden && !s._auto){ s._auto=true; abrir(); }
    }catch(e){}
  }
  function start(){ boot(); var n=0, iv=setInterval(function(){ boot(); if(++n>=20) clearInterval(iv); },500); }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",start); else start();
})();
