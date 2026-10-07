import { catalogUrl } from "./supabase.js";

const CATS={pokemon:"Pokémon",dragonball:"Dragon Ball",futbol:"Fútbol",arte:"Arte",videojuegos:"Videojuegos",vhs:"VHS",otro:"Otro"};
const WCATS=CATS;
const CATVAR={pokemon:"var(--c-pokemon)",dragonball:"var(--c-dragonball)",futbol:"var(--c-futbol)",arte:"var(--c-arte)",videojuegos:"var(--c-videojuegos)",vhs:"var(--c-vhs)",otro:"var(--c-otro)"};
const SRC={guia:"Guía de precios",ebay:"Ventas eBay",manual:"Sin comparables",revisar:"Revisar versión"};
const SRCS={guia:"Guía",ebay:"eBay",manual:"Sin comparables",revisar:"Revisar"};
const state={items:[],media:{},wish:[],meta:null,filter:"all",evoFilter:"all",range:"30",q:"",sort:"value",dir:"desc",tab:"col",modes:{},sel:null,dmode:null,flipped:false,confirmDel:null,wConfirm:null,moving:null,settings:null};
let db=null,assets=null,photos=null,photoFor=null,lastFocus=null;
try{const g=k=>localStorage.getItem(k);state.sort=g("mc.sort")||"value";state.filter=g("mc.filter")||"all";state.dir=g("mc.dir")||(state.sort==="name"?"asc":"desc");try{const m=JSON.parse(g("mc.modes")||"{}");if(m&&typeof m==="object")state.modes=m}catch(_){}state.tab=g("mc.tab")||"col";state.range=g("mc.range")||"30"}catch(e){}
const h0=(location.hash||"").slice(1);if(h0==="deseos")state.tab="wish";else if(h0==="evolucion")state.tab="evo";else if(h0==="coleccion")state.tab="col";else if(h0==="topps")state.tab="topps";

const $=id=>document.getElementById(id);
const fmt=n=>n==null||isNaN(n)?"—":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:n%1?2:0,maximumFractionDigits:2});
const fmt0=n=>n==null||isNaN(n)?"—":"$"+Math.round(n).toLocaleString("en-US");
const pct=n=>n==null||!isFinite(n)?"":(n>=0?"+":"−")+Math.abs(n*100).toFixed(Math.abs(n)<.1?1:0)+"%";
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const dateES=d=>{if(!d)return"";const t=new Date(d+"T12:00:00");return t.toLocaleDateString("es-ES",{day:"numeric",month:"short",year:"numeric"})};
const dateShort=d=>{if(!d)return"";const t=new Date(d+"T12:00:00");return t.toLocaleDateString("es-ES",{day:"numeric",month:"short"})};
const daysAgo=n=>{const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().slice(0,10)};
function toast(t,action){const el=$("toast");el.textContent=t;if(action){const b=document.createElement("button");b.type="button";b.textContent=action.label;b.addEventListener("click",()=>{el.hidden=true;action.run()});el.append(b)}el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,action?7000:2600)}
function savePref(k,v){try{localStorage.setItem(k,v)}catch(e){}}
const isSealed=it=>it.kind==="Sellado";
const CARDCATS=new Set(["pokemon","dragonball","futbol"]);
const isBoxy=it=>isSealed(it)||!CARDCATS.has(it.cat);
const isGraded=it=>it.kind==="Graded"&&!!it.grade;
function pillHTML(r,extra=""){if(r==null||!isFinite(r))return"";const c=Math.abs(r)<.005?"flat":r>0?"up":"down";const a=c==="flat"?"•":c==="up"?"▲":"▼";return `<span class="pill ${c}">${a} ${pct(r).replace(/^[+−]/,"")}${extra}</span>`}

/* numbers */
function totals(list){let inv=0,val=0,rel=0,unpriced=0,noPaid=0,pcs=0;
  for(const it of list){const q=it.qty||1;pcs+=q;
    if(it.paid!=null)inv+=it.paid*q;else noPaid++;
    if(it.value!=null){val+=it.value*q;if(it.source==="guia"||it.source==="ebay")rel+=it.value*q}else unpriced++;}
  return{inv,val,rel,unpriced,noPaid,pcs}}
function plOf(it){if(it.value==null||it.paid==null)return null;return(it.value-it.paid)*(it.qty||1)}
function hist(it){return(it.history||[]).filter(p=>p.v!=null).sort((a,b)=>a.d<b.d?-1:1)}
function weekChange(it){const h=hist(it);if(h.length<2||!h[h.length-2].v)return null;return h[h.length-1].v/h[h.length-2].v-1}
function avgSince(it,n){const c=daysAgo(n);const h=hist(it).filter(p=>p.d>c);if(!h.length)return null;return{v:h.reduce((a,p)=>a+p.v,0)/h.length,n:h.length}}
function trendOf(it,n){const c=n==="all"?"":daysAgo(+n);const h=hist(it).filter(p=>p.d>c);if(h.length<2||!h[0].v)return null;return h[h.length-1].v/h[0].v-1}
function seriesFor(items){
  const dates=[...new Set(items.flatMap(it=>(it.history||[]).map(p=>p.d)))].sort();
  return dates.map(d=>{let value=0,invested=0;
    for(const it of items){const h=hist(it).filter(p=>p.d<=d);if(!h.length)continue;const q=it.qty||1;value+=h[h.length-1].v*q;if(it.paid!=null)invested+=it.paid*q}
    return{d,value:+value.toFixed(2),invested:+invested.toFixed(2)}});
}
function lineSVG(points,{h=150,pad=[10,10,22,50],labels=true,color="var(--lime)",second=null,id="g",w=600}={}){
  if(!points.length)return"";const[pt,pr,pb,pl]=labels?pad:[6,6,6,6];
  const all=points.map(p=>p.v).concat(second?second.map(p=>p.v):[]);
  let lo=Math.min(...all),hi=Math.max(...all);if(lo===hi){lo=lo*0.9;hi=hi*1.1||1}
  const span=hi-lo;lo-=span*.1;hi+=span*.1;
  const x=i=>points.length===1?pl+(w-pl-pr)/2:pl+i*(w-pl-pr)/(points.length-1);
  const y=v=>pt+(hi-v)*(h-pt-pb)/(hi-lo);
  let g=`<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${color};stop-opacity:.35"/><stop offset="1" style="stop-color:${color};stop-opacity:0"/></linearGradient></defs>`;
  if(labels){for(let k=0;k<=2;k++){const v=lo+(hi-lo)*k/2;const yy=y(v).toFixed(1);g+=`<line x1="${pl}" x2="${w-pr}" y1="${yy}" y2="${yy}" style="stroke:var(--line);stroke-width:1"/><text x="${pl-8}" y="${+yy+4}" text-anchor="end" font-size="11" style="fill:var(--faint);font-family:var(--mono)">${fmt0(v)}</text>`}
    const idx=points.length>1?[0,points.length-1]:[0];for(const i of idx)g+=`<text x="${x(i)}" y="${h-4}" text-anchor="${points.length===1?"middle":i?"end":"start"}" font-size="11" style="fill:var(--faint)">${esc(dateShort(points[i].d))}</text>`}
  const path=ps=>ps.map((p,i)=>(i?"L":"M")+x(i).toFixed(1)+","+y(p.v).toFixed(1)).join("");
  if(second&&second.length>1)g+=`<path d="${path(second)}" style="fill:none;stroke:var(--faint);stroke-width:1.5;stroke-dasharray:4 4"/>`;
  if(points.length>1)g+=`<path d="${path(points)}L${x(points.length-1)},${h-pb}L${x(0)},${h-pb}Z" style="fill:url(#${id})"/><path d="${path(points)}" style="fill:none;stroke:${color};stroke-width:2.5;stroke-linejoin:round"/>`;
  const li=points.length-1;g+=`<circle cx="${x(li)}" cy="${y(points[li].v)}" r="5" style="fill:${color};stroke:var(--bg);stroke-width:2"/>`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Gráfica de evolución del valor">${g}</svg>`;
}

const cw=id=>{const w=$(id).clientWidth;return w>200?Math.round(w):600};
let rzT;window.addEventListener("resize",()=>{clearTimeout(rzT);rzT=setTimeout(()=>{renderSummary();if(state.tab==="evo")renderEvo()},200)});
/* images */
function imgs(it){const m=state.media[it.id]||{};const mine=it.photo&&photos?photos.url(it.photo):"";return{off:m.official?catalogUrl(m.official):m.sprite?"sp:"+m.sprite.sheet+":"+m.sprite.cell+(m.sprite.rot?":1":""):null,mine:mine||null}}
function sprHTML(sheet,cell,alt,rot){const c=+cell,x=(c%10)/9*100,y=Math.floor(c/10)/9*100;if(rot)return `<div class="sprw">${sprHTML(sheet,cell,alt).replace('class="spr"','class="spr rot"')}</div>`;return `<div class="spr" role="img" aria-label="${esc(alt||"")}" style="background-image:url(${esc(catalogUrl(sheet))});background-position:${x.toFixed(3)}% ${y.toFixed(3)}%"></div>`}
function srcHTML(src,alt,extra){if(String(src).startsWith("sp:")){const[,sh,c,r]=src.split(":");return sprHTML(sh,c,alt,r==="1")}return `<img src="${esc(src)}" alt="${esc(alt)}"${extra||""}>`}
const modeFor=cat=>state.modes[cat]==="mine"?"mine":"off";
function pick(it,mode){const s=imgs(it);if(mode==="mine")return s.mine?{src:s.mine,kind:"mine"}:s.off?{src:s.off,kind:"off"}:null;return s.off?{src:s.off,kind:"off"}:s.mine?{src:s.mine,kind:"mine"}:null}
function phHTML(it){return `<div class="ph ${esc(it.cat)}">${esc(it.name)}</div>`}
function imgHTML(it,mode,lazy=true){const p=pick(it,mode);if(!p)return phHTML(it);
  if(String(p.src).startsWith("sp:"))return srcHTML(p.src,it.name);
  return `<img src="${esc(p.src)}" alt="${esc(it.name)}${p.kind==="mine"?" (mi copia)":""}"${lazy?' loading="lazy"':""} onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph ${esc(it.cat)}',textContent:'Sin imagen'}))">`}

/* summary */
function renderSummary(){
  const f=state.filter,byCat=f!=="all"&&f!=="pending";
  const items=byCat?state.items.filter(i=>i.cat===f&&!i.pending):state.items,t=totals(items);
  $("heroLabel").textContent=byCat?`Valor de ${CATS[f]}`:"Valor total de la colección";
  $("kVal").textContent=fmt0(t.val);
  let inv2=0,val2=0;for(const it of items){if(it.paid!=null&&it.value!=null){inv2+=it.paid*(it.qty||1);val2+=it.value*(it.qty||1)}}
  const pl=val2-inv2;const el=$("kPl");
  el.className="pill "+(pl>=0?"up":"down");el.textContent=(pl>=0?"▲ +":"▼ −")+fmt0(Math.abs(pl));
  $("kPlS").textContent=inv2?`${pct(pl/inv2)} sobre lo invertido`:"";
  $("kInv").textContent=fmt0(t.inv);$("kInvS").textContent=t.noPaid?`${t.noPaid} sin precio de compra`:"coste de compra";
  $("kPcs").textContent=t.pcs;$("kPcsS").textContent=t.unpriced?`${t.unpriced} sin valorar`:`${items.length} productos`;
  $("kRel").textContent=t.val?Math.round(t.rel/t.val*100)+"%":"—";
  const m=state.meta;
  $("updated").textContent=m&&m.updated?`Precios revisados el ${dateES(m.updated)} · próxima: ${m.nextCheck?dateES(m.nextCheck):"cada día"}`:"Aún sin revisión de precios";
  const pts=seriesFor(items);
  $("heroChart").innerHTML=pts.length?lineSVG(pts.map(p=>({d:p.d,v:p.value})),{h:150,w:cw("heroChart"),color:byCat?CATVAR[f]:"var(--lime)",second:pts.map(p=>({d:p.d,v:p.invested})),id:"gh"}):"";
  $("heroCap").textContent=pts.length<2?"El historial empieza con la primera revisión; cada revisión diaria añade un punto.":`Valor de mercado desde el ${dateES(pts[0].d)} · línea discontinua: invertido`;
  $("cntCol").textContent=state.items.length;$("cntWish").textContent=state.wish.length||"";
}

/* collection */
function renderChips(){
  const counts={all:state.items.length,pending:0};for(const it of state.items){if(it.pending)counts.pending++;else counts[it.cat]=(counts[it.cat]||0)+1}
  const cats=Object.entries(CATS).filter(([k])=>counts[k]);
  const opts=[["all","Todo"],...(counts.pending?[["pending","Por identificar"]]:[]),...cats];
  if(state.filter!=="all"&&!counts[state.filter])state.filter="all";
  const dot=k=>k==="all"?"":`<span class="d" style="background:${k==="pending"?"var(--warn)":CATVAR[k]}"></span>`;
  const mk=(list,sel,attr)=>list.map(([k,l])=>`<button type="button" class="chip${k==="pending"?" pendchip":""}" ${attr}="${k}" aria-pressed="${sel===k}">${dot(k)}${l}<span class="c">${counts[k]||0}</span></button>`).join("");
  $("chips").innerHTML=mk(opts,state.filter,"data-f");
  if(state.evoFilter!=="all"&&(state.evoFilter==="pending"||!counts[state.evoFilter]))state.evoFilter="all";
  $("evoChips").innerHTML=mk([["all","Todo"],...cats],state.evoFilter,"data-ef");
}
const RELIAB={guia:3,ebay:2,manual:1,revisar:0};
function sortKey(it){const s=state.sort,q=it.qty||1;
  switch(s){case"value":return it.value!=null?it.value*q:null;case"plpct":return it.paid&&it.value!=null?it.value/it.paid-1:null;case"pl":return plOf(it);case"week":return weekChange(it);case"paid":return it.paid!=null?it.paid*q:null;case"reliab":return RELIAB[it.source]??0;default:return(it.name||"").toLowerCase()}}
function visible(f0=state.filter){
  const q=state.q.trim().toLowerCase();
  let l=state.items.filter(i=>f0==="all"||(f0==="pending"?i.pending:(i.cat===f0&&!i.pending)));
  if(q)l=l.filter(i=>[i.name,i.set,i.code,i.grade,i.serial,CATS[i.cat],i.kind].join(" ").toLowerCase().includes(q));
  const dir=state.dir==="asc"?1:-1,isName=state.sort==="name";
  return l.map(it=>({it,k:sortKey(it)})).sort((a,b)=>{
    if(a.k==null&&b.k==null)return a.it.name.localeCompare(b.it.name);if(a.k==null)return 1;if(b.k==null)return -1;
    if(isName)return a.k.localeCompare(b.k)*(state.dir==="desc"?-1:1);return(a.k-b.k)*dir||a.it.name.localeCompare(b.it.name)}).map(x=>x.it);
}
function tileHTML(it){
  const q=it.qty||1,pl=plOf(it),w=weekChange(it);
  const chg=state.sort==="week"?w:(pl!=null&&it.paid?pl/(it.paid*q):null);
  return `<button type="button" class="tile" data-id="${esc(it.id)}" aria-label="${esc(it.name)}, ${it.value==null?"sin valor":fmt0(it.value*q)}">
    <div class="pic${isBoxy(it)?" box":""}${(state.media[it.id]||{}).cutout&&modeFor(it.cat)!=="mine"?" cutpic":""}">${imgHTML(it,modeFor(it.cat))}${it.grade?`<span class="gr">${esc(it.grade)}</span>`:""}${q>1?`<span class="qt">×${q}</span>`:""}${it.pending?`<span class="pend">Por identificar</span>`:""}</div>
    <div class="tn">${esc(it.name)}</div>
    <div class="ts">${esc([it.code,it.set].filter(Boolean).join(" · ")||CATS[it.cat])}</div>
    <div class="tv"><span class="mono">${it.value==null?"Sin valor":fmt0(it.value*q)}</span>${pillHTML(chg)}</div>
  </button>`;
}
function renderGrid(){
  const am=albumMode();$("grid").hidden=am;$("calbum").hidden=!am;
  for(const b of $("cLay").querySelectorAll("button"))b.setAttribute("aria-pressed",b.dataset.clay===state.lay);
  if(am){if(!CA.anim){$("calbum").innerHTML=state.filter==="all"?shelfHTML():cAlbumHTML(state.filter);cAlbumAfter()}}
  else{const l=visible();
  $("grid").innerHTML=l.length?l.map(tileHTML).join(""):`<div class="empty" style="grid-column:1/-1">${state.q?`Nada coincide con «${esc(state.q)}».`:"No hay productos en esta categoría."}</div>`;}
  const f=state.filter;$("mSeg").hidden=f==="all"||f==="pending";
  $("mLbl").textContent=f==="all"?"Cada categoría recuerda su imagen: elige una para cambiarla":f==="pending"?"Abre su ficha para completar los datos":`Imagen de ${CATS[f]}:`;
  if(f!=="all"){$("mOff").setAttribute("aria-pressed",modeFor(f)==="off");$("mMine").setAttribute("aria-pressed",modeFor(f)==="mine")}
  const n=state.sort==="name";$("sortDir").textContent=state.dir==="asc"?"↑":"↓";$("sortDir").title=state.dir==="asc"?(n?"A → Z":"Menor a mayor"):(n?"Z → A":"Mayor a menor");
  $("sort").value=state.sort;
}

/* wishlist */
function renderWish(){
  const l=[...state.wish].sort((a,b)=>(b.added||"").localeCompare(a.added||""));
  $("cntWish").textContent=l.length||"";
  $("wlist").innerHTML=l.length?l.map(w=>{const conf=state.wConfirm===w.id;const ebay="https://www.ebay.com/sch/i.html?_nkw="+encodeURIComponent(w.name||"");
    return `<div class="wish"><div class="meta">${esc(WCATS[w.cat]||"Otro")}${w.grade?" · "+esc(w.grade):w.kind?" · "+esc(w.kind):""}${w.added?" · desde el "+esc(dateShort(w.added)):""}</div><div class="n">${esc(w.name)}</div>
      <div class="t">${w.target!=null?`≤ ${fmt(w.target)}`:`<span class="meta">Sin precio objetivo</span>`}</div>
      <div class="row"><a href="${esc(ebay)}" target="_blank" rel="noopener">Buscar en eBay</a>${w.ref?` · <a href="${esc(w.ref)}" target="_blank" rel="noopener">Referencia</a>`:""}</div>
      <label class="got"><input type="checkbox" id="got-${esc(w.id)}" data-got="${esc(w.id)}"${state.moving===w.id?" checked disabled":""}> Ya lo tengo</label>
      <div class="row">${conf?`<button type="button" class="danger" data-wdel-yes="${esc(w.id)}">Sí, quitar</button><button type="button" class="ghost" data-wdel-no>No</button>`:`<button type="button" class="ghost" data-wdel="${esc(w.id)}">Quitar</button>`}</div></div>`}).join(""):`<div class="empty" style="grid-column:1/-1">Aún no tienes objetivos. Añade lo que buscas y el precio al que lo comprarías.</div>`;
}

/* evolution */
function renderEvo(){
  const items=state.items.filter(i=>state.evoFilter==="all"||i.cat===state.evoFilter);
  const cut=state.range==="all"?"":daysAgo(+state.range);
  const all=seriesFor(items);const pts=all.filter(p=>p.d>cut);
  const col=state.evoFilter==="all"?"var(--lime)":CATVAR[state.evoFilter];
  $("evoChart").innerHTML=pts.length?lineSVG(pts.map(p=>({d:p.d,v:p.value})),{h:240,w:cw("evoChart"),color:col,second:pts.map(p=>({d:p.d,v:p.invested})),id:"ge"}):`<div class="empty">Aún no hay precios en este periodo.</div>`;
  const last=pts[pts.length-1],first=pts[0];
  $("evoVal").textContent=last?fmt0(last.value):"—";
  if(pts.length>1){const d=last.value-first.value;const e=$("evoChg");e.textContent=(d>=0?"+":"−")+fmt0(Math.abs(d))+" · "+pct(first.value?d/first.value:0);e.className="v "+(d>=0?"pos":"neg")}else{$("evoChg").textContent="—";$("evoChg").className="v"}
  $("evoNote").textContent=all.length?`Historial desde el ${dateES(all[0].d)} (${all.length} revisión${all.length>1?"es":""})`:"";
  document.querySelectorAll("[data-r]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.r===state.range));
  // category bars (always full collection)
  const byCat={};let tot=0;for(const it of state.items){if(it.value==null)continue;const v=it.value*(it.qty||1);byCat[it.cat]=(byCat[it.cat]||0)+v;tot+=v}
  $("bars").innerHTML=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="bar"><div class="l"><span>${CATS[k]||k}</span><span class="mono">${fmt0(v)} · ${Math.round(v/tot*100)}%</span></div><div class="t"><i style="width:${(v/tot*100).toFixed(1)}%;background:${CATVAR[k]||"var(--muted)"}"></i></div></div>`).join("")||`<div class="msg">Sin valores todavía.</div>`;
  const mv=items.map(it=>({it,r:trendOf(it,state.range)})).filter(x=>x.r!=null&&Math.abs(x.r)>=.0005).sort((a,b)=>Math.abs(b.r)-Math.abs(a.r)).slice(0,6);
  $("movers").innerHTML=mv.length?mv.map(({it,r})=>`<button type="button" class="mover" data-id="${esc(it.id)}">${pick(it,modeFor(it.cat))?srcHTML(pick(it,modeFor(it.cat)).src,""," loading=\"lazy\""):phHTML(it)}<div style="min-width:0"><div class="nm">${esc(it.name)}</div><div class="sb">${esc(it.grade||it.kind||"")} · ${fmt(it.value)}</div></div>${pillHTML(r)}</button>`).join(""):`<div class="msg">Ningún precio ha cambiado en este periodo.</div>`;
}

/* tabs */
function setTab(t){state.tab=t;savePref("mc.tab",t);
  for(const[k,p]of[["col","p-col"],["wish","p-wish"],["evo","p-evo"],["topps","p-topps"]]){$("tab-"+k).setAttribute("aria-selected",k===t);$(p).hidden=k!==t}
  if(t==="evo")renderEvo();if(t==="wish")renderWish();if(t==="topps")renderTopps();}
document.querySelector(".tabs").addEventListener("click",e=>{const b=e.target.closest("[data-tab]");if(b)setTab(b.dataset.tab)});
const tabsEl=document.querySelector(".tabs");
const tabOrder=()=>[...tabsEl.querySelectorAll("[data-tab]")].map(b=>b.dataset.tab);
tabsEl.addEventListener("keydown",e=>{if(e.key!=="ArrowRight"&&e.key!=="ArrowLeft")return;const o=tabOrder();
  if(e.altKey){const b=$("tab-"+state.tab);if(e.key==="ArrowRight"&&b.nextElementSibling)b.nextElementSibling.after(b);else if(e.key==="ArrowLeft"&&b.previousElementSibling)b.previousElementSibling.before(b);saveTabOrder();b.focus();return}
  let i=(o.indexOf(state.tab)+(e.key==="ArrowRight"?1:-1)+o.length)%o.length;setTab(o[i]);$("tab-"+o[i]).focus()});
/* reordenar pestañas arrastrando (mantener pulsado y mover) */
function saveTabOrder(){savePref("mc.tabs",JSON.stringify(tabOrder()))}
(function(){try{const o=JSON.parse(localStorage.getItem("mc.tabs")||"null");if(Array.isArray(o))for(const k of o){const b=$("tab-"+k);if(b)tabsEl.append(b)}}catch(e){}})();
let drag=null;
tabsEl.addEventListener("pointerdown",e=>{const b=e.target.closest("[data-tab]");if(!b||e.button>0)return;
  drag={b,x0:e.clientX,id:e.pointerId,on:false,t:setTimeout(()=>{if(drag&&!drag.on)startDrag()},e.pointerType==="mouse"?180:350)}});
function startDrag(){drag.on=true;drag.b.classList.add("dragging");tabsEl.classList.add("sorting");try{drag.b.setPointerCapture(drag.id)}catch(e){}if(navigator.vibrate)try{navigator.vibrate(10)}catch(e){}}
tabsEl.addEventListener("pointermove",e=>{if(!drag)return;
  if(!drag.on){if(Math.abs(e.clientX-drag.x0)>6&&e.pointerType==="mouse"){clearTimeout(drag.t);startDrag()}else if(Math.abs(e.clientX-drag.x0)>10){clearTimeout(drag.t);drag=null}return}
  e.preventDefault();
  for(const o of tabsEl.querySelectorAll("[data-tab]")){if(o===drag.b)continue;const r=o.getBoundingClientRect(),mid=r.left+r.width/2;
    const idxB=[...tabsEl.children].indexOf(drag.b),idxO=[...tabsEl.children].indexOf(o);
    if(idxO>idxB&&e.clientX>mid){o.after(drag.b);break}
    if(idxO<idxB&&e.clientX<mid){o.before(drag.b);break}}});
function endDrag(){if(!drag)return;clearTimeout(drag.t);if(drag.on){drag.b.classList.remove("dragging");tabsEl.classList.remove("sorting");saveTabOrder();drag.moved=true;const d=drag;setTimeout(()=>{if(drag===d)drag=null},0);return}drag=null}
tabsEl.addEventListener("pointerup",endDrag);tabsEl.addEventListener("pointercancel",endDrag);
tabsEl.addEventListener("click",e=>{if(drag&&drag.moved){e.stopImmediatePropagation();drag=null}},true);
tabsEl.addEventListener("contextmenu",e=>{if(e.target.closest("[data-tab]"))e.preventDefault()});


const nES=n=>n==null||isNaN(n)?"—":Number(n).toLocaleString("es-ES");
function popCardHTML(it,pop){
  const g=gradeParts(it.grade);
  if(!pop)return `<div class="card"><div class="cardhead"><h3 style="font-size:16px">Población PSA</h3><span class="msg">sin datos todavía</span></div><div class="msg">Todavía no hay datos de población para esta pieza.</div></div>`;
  const rate=pop.total?Math.round(pop.g10/pop.total*1000)/10:null;
  const scarce=pop.total<=10?"Muy escasa":pop.total<=100?"Escasa":pop.total<=1000?"Media":"Muy común";
  return `<div class="card">
    <div class="cardhead"><h3 style="font-size:16px">Población PSA</h3><span class="msg">${esc(pop.src||"")} · ${esc(dateES(pop.d))}${pop.url?` · <a href="${esc(pop.url)}" target="_blank" rel="noopener">ver</a>`:""}</span></div>
    <div class="stats3">
      <div class="stat me"><div class="l">Con tu nota (${esc(g.num?("PSA "+g.num):it.grade)})</div><div class="v">${nES(pop.mine)}</div><div class="s">tu copia es una de ellas</div></div>
      <div class="stat"><div class="l">Con nota mayor</div><div class="v ${pop.higher?"":"pos"}">${nES(pop.higher)}</div><div class="s">${pop.higher?"copias por encima":"ninguna por encima"}</div></div>
      <div class="stat"><div class="l">Total gradeadas</div><div class="v">${nES(pop.total)}</div><div class="s">${scarce}</div></div>
    </div>
    <div class="msg">${rate!=null?`El ${String(rate).replace(".",",")}% de las copias gradeadas saca PSA 10 (${nES(pop.g10)} de ${nES(pop.total)})`:""}${pop.g9!=null?` · PSA 9: ${nES(pop.g9)}`:""}${pop.allGraders?` · Contando todas las empresas (PSA, CGC, BGS, SGC): ${nES(pop.allGraders)}`:""}.${pop.note?" "+esc(pop.note)+".":""}</div>
  </div>`;
}
/* detail */
function gradeParts(g){const m=String(g||"").match(/^([A-Za-z]+)\s*([\d.]+)/);if(!m)return{grader:g||"",num:""};return{grader:m[1].toUpperCase(),num:m[2]}}
const GDESC={"10":"GEM MT","9.5":"MINT+","9":"MINT","8.5":"NM-MT+","8":"NM-MT","7":"NM"};
function stageHTML(it){
  const mode=state.dmode,p=pick(it,mode);
  const fx=isBoxy(it)?"":`<div class="shine ${it.cat==="futbol"?"refr":"holo"}"></div>`;
  const cut=!!(p&&p.kind==="off"&&(state.media[it.id]||{}).cutout);
  const art=`<div class="art${cut?" cut":""}"${cut?` style="--src:url(&quot;${esc(p.src)}&quot;)"`:""}>${p?srcHTML(p.src,it.name,' draggable="false"'):phHTML(it)}${fx}<div class="glare"></div></div>${cut?`<div class="floor"></div>`:""}`;
  let front;
  if(isGraded(it)){const g=gradeParts(it.grade);
    front=`<div class="slab"><div class="label"><div style="min-width:0"><div class="l1">${esc([it.set].filter(Boolean).join(" "))}</div><div class="l1">${esc(it.name)}</div><div class="l2">${esc([it.code,it.serial].filter(Boolean).join(" · "))}</div>${it.cert?`<div class="cert">${esc(g.grader)} · ${esc(it.cert)}</div>`:""}</div><div class="gd"><span>${esc(GDESC[g.num]||g.grader)}</span><b>${esc(g.num||it.grade)}</b></div></div><div class="well">${art}</div><div class="plastic"></div></div>`;
  }else front=art;
  const m=(state.media[it.id]||{}).market||{};const q=it.qty||1,pl=plOf(it),pop=(state.media[it.id]||{}).pop;
  const mk=isSealed(it)?`<div class="mk" style="grid-template-columns:1fr"><div>Sellado (guía)<b>${fmt(m.sealed)}</b></div></div>`:`<div class="mk"><div>Raw<b>${fmt(m.raw)}</b></div><div>PSA 9<b>${fmt(m.psa9)}</b></div><div>PSA 10<b>${fmt(m.psa10)}</b></div></div>`;
  const back=`<div class="bk"><div class="s">${esc([CATS[it.cat],it.set].filter(Boolean).join(" · "))}</div><div class="h">${esc(it.name)}</div>
    <div><div class="s">Valor de tu pieza${q>1?` (×${q})`:""}</div><div class="val">${it.value==null?"—":fmt0(it.value*q)}</div></div>
    <dl>${it.code?`<dt>Código</dt><dd>${esc(it.code)}</dd>`:""}${it.grade?`<dt>Nota</dt><dd>${esc(it.grade)}</dd>`:""}${it.serial?`<dt>Numeración</dt><dd>${esc(it.serial)}</dd>`:""}${it.cert?`<dt>Certificado</dt><dd>${esc(it.cert)}</dd>`:""}<dt>${it.paidMode==="pull"?"Coste estimado":"Pagado"}</dt><dd>${it.paidMode==="pull"&&it.paid==null?"pendiente":fmt(it.paid!=null?it.paid*q:null)}</dd><dt>Ganancia</dt><dd class="${pl==null?"":pl>=0?"pos":"neg"}">${pl==null?"—":(pl>=0?"+":"−")+fmt(Math.abs(pl))}</dd>${pop&&isGraded(it)?`<dt>Población PSA</dt><dd>${esc(it.grade)}: ${nES(pop.mine)} de ${nES(pop.total)}${pop.higher?` · ${nES(pop.higher)} mejores`:" · 0 mejores"}</dd>`:""}</dl>
    ${mk}${it.paidMode==="pull"?`<div class="disc"><b>Obtenida de sobre/caja.</b> ${it.paid==null?`Su coste será el ${Math.round(pullPct()*100)}% del precio raw cuando tenga precio.`:esc((it.paidNote||"").replace(/^Coste estimado: /,"Coste estimado: "))+". Queda fijo; la ganancia sale de la diferencia con el valor actual."}</div>`:""}<div class="s" style="margin-top:auto">${esc(it.sourceName||SRC[it.source]||"")}</div></div>`;
  const wcls=isBoxy(it)?"boxw":"cardw"+(((state.media[it.id]||{}).sprite||{}).rot&&p&&String(p.src).startsWith("sp:")?" land":"");
  return `<div class="c3d ${wcls}" id="c3d" tabindex="0" role="img" aria-label="${esc(it.name)} en 3D. Pulsa Intro para darle la vuelta.">
    <div class="face front">${front}</div><div class="face back">${back}</div></div>`;
}
function infoHTML(it){
  const q=it.qty||1,pl=plOf(it),h=hist(it),md=state.media[it.id]||{},m=md.market||{};
  const a7=avgSince(it,7),a30=avgSince(it,30),tr=trendOf(it,30);
  const tags=[];
  if(it.grade)tags.push(`<span class="tag slab">${esc(it.grade)}</span>`);
  if(it.kind&&it.kind!=="Graded")tags.push(`<span class="tag">${esc(it.kind)}</span>`);
  if(q>1)tags.push(`<span class="tag">×${q}</span>`);
  if(it.paidMode==="pull")tags.push(`<span class="tag" title="${esc(it.paidNote||"")}">De sobre/caja</span>`);
  if(it.serial)tags.push(`<span class="tag mono">${esc(it.serial)}</span>`);
  tags.push(`<span class="tag src-${esc(it.source||"manual")}">${SRC[it.source]||"Sin comparables"}</span>`);
  const trLbl=tr==null?"Sin datos":Math.abs(tr)<.01?"Estable":tr>0?"Al alza":"A la baja";
  const nAvg=x=>x?`${x.n} precio${x.n>1?"s":""}`:"sin precios";
  const myKey=isSealed(it)?"sealed":(()=>{const g=gradeParts(it.grade);if(!it.grade)return"raw";if(g.num==="10")return"psa10";if(g.num==="9")return"psa9";return""})();
  const mt=(k,l)=>{const mine=myKey===k,useOwn=mine&&m[k]==null&&it.value!=null&&(it.source==="guia"||it.source==="ebay");const v=useOwn?it.value:m[k];
    return `<div class="stat${mine?" me":""}"><div class="l">${l}${mine?" · la tuya":""}</div><div class="v">${fmt(v)}</div><div class="s">${useOwn?"tu referencia de precio":v==null?"sin ventas":"mercado"}</div></div>`};
  const conf=state.confirmDel===it.id;
  return `
    <div class="kicker"><span class="d" style="background:${CATVAR[it.cat]||"var(--muted)"}"></span>${esc([CATS[it.cat],it.set].filter(Boolean).join(" · "))}</div>
    <h2 id="dName">${esc(it.name)}</h2>
    <div class="tags">${tags.join("")}</div>
    <div class="valuebox"><div><div class="v">${it.value==null?"Sin valor":fmt(it.value*q)}</div><div class="u">${q>1?`${fmt(it.value)} por unidad · `:""}${it.paidMode==="pull"?(it.paid==null?"coste de sobre: esperando precio raw":"coste estimado (sobre/caja) "+fmt(it.paid*q)):"pagado "+fmt(it.paid!=null?it.paid*q:null)}</div></div>${pl==null?"":`<span class="pill ${pl>=0?"up":"down"}">${pl>=0?"▲ +":"▼ −"}${fmt(Math.abs(pl))}${it.paid?" · "+pct(pl/(it.paid*q)):""}</span>`}</div>

    <div class="card">
      <div class="cardhead"><h3 style="font-size:16px">Tendencia</h3>${tr==null?`<span class="pill flat">sin datos</span>`:pillHTML(tr," · 30 d")}</div>
      ${h.length?lineSVG(h.map(p=>({d:p.d,v:p.v})),{h:130,w:Math.max(300,Math.min(600,$("info").clientWidth-34||600)),id:"gd",color:tr!=null&&tr<-.005?"var(--loss)":"var(--lime)"}):`<div class="msg">Aún no hay historial de precios para esta pieza.</div>`}
      <div class="stats3">
        <div class="stat"><div class="l">Media 7 días</div><div class="v">${a7?fmt(a7.v):"—"}</div><div class="s">${nAvg(a7)}</div></div>
        <div class="stat"><div class="l">Media 30 días</div><div class="v">${a30?fmt(a30.v):"—"}</div><div class="s">${nAvg(a30)}</div></div>
        <div class="stat"><div class="l">Tendencia 30 d</div><div class="v ${tr==null?"":tr>0?"pos":tr<0?"neg":""}">${trLbl}</div><div class="s">${tr==null?"hace falta más historial":pct(tr)}</div></div>
      </div>
      ${h.length&&h.length<7?`<div class="msg">El historial empezó el ${esc(dateES(h[0].d))}: las medias se completan con cada revisión diaria.</div>`:""}
    </div>

    <div class="card">
      <div class="cardhead"><h3 style="font-size:16px">Precios de mercado</h3><span class="msg">${m.d?`${esc(md.src||"")} · ${esc(dateES(m.d))}`:"sin referencia"}</span></div>
      ${isSealed(it)?`<div class="stats3" style="grid-template-columns:1fr">${mt("sealed","Sellado")}</div>`:`<div class="stats3">${mt("raw","Raw")}${mt("psa9","PSA 9")}${mt("psa10","PSA 10")}</div>`}
      ${m.note?`<div class="msg">${esc(m.note)}</div>`:""}
    </div>
    ${isGraded(it)?popCardHTML(it,md.pop):""}

    <div class="card">
      <h3 style="font-size:16px">Datos</h3>
      <dl class="facts">
        ${it.code?`<dt>Código</dt><dd class="mono">${esc(it.code)}</dd>`:""}
        ${it.cert?`<dt>Certificado</dt><dd class="mono">${esc(it.cert)}</dd>`:""}
        <dt>Precio unidad</dt><dd class="mono">${fmt(it.value)}</dd>
        <dt>Fuente</dt><dd>${esc(it.sourceName||SRC[it.source]||"")}${it.ref?` · <a href="${esc(it.ref)}" target="_blank" rel="noopener">ver referencia</a>`:""}</dd>
        ${it.updated?`<dt>Revisado</dt><dd>${esc(dateES(it.updated))}</dd>`:""}
        ${md.check?`<dt>Imagen oficial</dt><dd>${esc(md.check)}</dd>`:""}
      </dl>
      ${it.note?`<p class="note">${esc(it.note)}</p>`:""}
    </div>

    <div class="card">
      <h3 style="font-size:16px">Editar</h3>
      <div class="form">
        <label>Pagado (unidad)<input id="e-paid" type="number" step="0.01" min="0" value="${it.paid??""}"${it.paidMode==="pull"?" disabled":""}></label>
        <label class="full pullchk"><span><input type="checkbox" id="e-pull"${it.paidMode==="pull"?" checked":""}> Obtenida de sobres / caja</span><small>${it.paidMode==="pull"&&it.paidNote?esc(it.paidNote):`El coste será el <b class="pullpct">${Math.round(pullPct()*100)}%</b> del precio raw del día en que se registre.`}</small></label>
        <label>Cantidad<input id="e-qty" type="number" min="1" value="${it.qty||1}"></label>
        <label class="full">Valor manual (unidad)<input id="e-val" type="number" step="0.01" min="0" value="${it.source==="guia"||it.source==="ebay"?"":(it.value??"")}" placeholder="${it.source==="guia"?"se actualiza solo cada día":it.source==="ebay"?"precio de ventas eBay":""}"></label>
      </div>
      <div class="formbar">
        <button type="button" class="primary" data-act="save">Guardar cambios</button>
        ${conf?`<button type="button" class="danger" data-act="del-yes">Sí, borrar</button><button type="button" class="ghost" data-act="del-no">No</button>`:`<button type="button" class="ghost" data-act="del">Borrar</button>`}
      </div>
    </div>`;
}
function renderStage(){const it=state.items.find(i=>i.id===state.sel);if(!it)return;
  $("stage").innerHTML=stageHTML(it);
  const s=imgs(it);const eff=pick(it,state.dmode);
  $("dOff").setAttribute("aria-pressed",!!eff&&eff.kind==="off");$("dMine").setAttribute("aria-pressed",!!eff&&eff.kind==="mine");
  $("dOff").disabled=!s.off;$("dMine").disabled=!s.mine;
  $("dPhoto").hidden=!assets;$("dPhoto").textContent=it.photo?"Cambiar mi foto":"Subir mi foto";
  const md=state.media[it.id]||{};
  $("imgsrc").textContent=!eff?"Sin imagen todavía. Sube una foto de tu copia.":eff.kind==="off"?`Imagen oficial · ${md.src||"referencia"}${s.mine?"":" · aún no has subido tu foto"}`:`Mi copia${s.off?"":" · no hay imagen oficial de esta versión exacta"}`;
  applyFlip();bindTilt();
}
function renderInfo(force){const it=state.items.find(i=>i.id===state.sel);if(!it){closeDetail();return}
  const a=document.activeElement;if(!force&&a&&$("info").contains(a)&&a.tagName==="INPUT")return;
  $("info").innerHTML=infoHTML(it)}
function openDetail(id){if(!state.tsel&&$("overlay").hidden)lastFocus=document.activeElement;state.tsel=null;$("dOff").parentElement.hidden=false;state.sel=id;state.dmode=modeFor((state.items.find(i=>i.id===id)||{}).cat);state.flipped=false;state.confirmDel=null;
  $("overlay").hidden=false;document.body.style.overflow="hidden";$("overlay").scrollTop=0;renderStage();renderInfo(true);$("dClose").focus();
  $("dGyro").hidden=!("DeviceOrientationEvent" in window&&matchMedia("(pointer:coarse)").matches);}
function closeDetail(){const wasT=state.tsel,wasC=state.sel;if(wasT&&$("abook"))try{tpPutBack(wasT)}catch(e){}if(wasC&&$("cbook"))try{cPutBack(wasC)}catch(e){}state.sel=null;state.tsel=null;TP.confirmOff=null;$("dOff").parentElement.hidden=false;$("overlay").hidden=true;document.body.style.overflow="";stopGyro();if(lastFocus&&lastFocus.focus)try{lastFocus.focus()}catch(e){}}
function applyFlip(){const c=$("c3d");if(c)c.style.setProperty("--flip",state.flipped?"180deg":"0deg")}
$("dClose").addEventListener("click",closeDetail);
$("overlay").addEventListener("click",e=>{if(e.target===$("overlay"))closeDetail()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("overlay").hidden)closeDetail()});
$("dFlip").addEventListener("click",()=>{state.flipped=!state.flipped;applyFlip()});
$("dOff").addEventListener("click",()=>{state.dmode="off";renderStage()});
$("dMine").addEventListener("click",()=>{state.dmode="mine";renderStage()});
$("stage").addEventListener("dblclick",()=>{state.flipped=!state.flipped;applyFlip()});
$("stage").addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();state.flipped=!state.flipped;applyFlip()}});

/* tilt */
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
function setTilt(px,py,live){const c=$("c3d");if(!c)return;
  c.classList.toggle("live",!!live);
  c.style.setProperty("--rx",((.5-py)*22).toFixed(2)+"deg");c.style.setProperty("--ry",((px-.5)*26).toFixed(2)+"deg");
  c.style.setProperty("--mx",(px*100).toFixed(1)+"%");c.style.setProperty("--my",(py*100).toFixed(1)+"%");
  c.style.setProperty("--hl",live?Math.min(1,Math.hypot(px-.5,py-.5)*2.2).toFixed(2):"0")}
function bindTilt(){const c=$("c3d");if(!c||reduce)return;
  c.addEventListener("pointermove",e=>{if(e.pointerType==="touch"&&gyroOn)return;const r=c.getBoundingClientRect();setTilt(Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),Math.min(1,Math.max(0,(e.clientY-r.top)/r.height)),true)});
  c.addEventListener("pointerleave",()=>{if(!gyroOn)setTilt(.5,.5,false)});
  if(c.animate&&!state.flipped)c.animate([{transform:"rotateX(8deg) rotateY(-24deg)"},{transform:"rotateX(0) rotateY(0)"}],{duration:900,easing:"cubic-bezier(.2,.7,.2,1)"});
}
let gyroOn=false,gyroBase=null;
function onOrient(e){if(e.beta==null)return;if(gyroBase==null)gyroBase=e.beta;
  const px=Math.min(1,Math.max(0,.5+(e.gamma||0)/50)),py=Math.min(1,Math.max(0,.5+(e.beta-gyroBase)/50));setTilt(px,py,true)}
function stopGyro(){if(gyroOn){window.removeEventListener("deviceorientation",onOrient);gyroOn=false;gyroBase=null;$("dGyro").textContent="Mover con el móvil"}}
$("dGyro").addEventListener("click",async()=>{
  if(gyroOn){stopGyro();setTilt(.5,.5,false);return}
  try{if(typeof DeviceOrientationEvent.requestPermission==="function"){const r=await DeviceOrientationEvent.requestPermission();if(r!=="granted")throw 0}}
  catch(e){toast("Este navegador no deja usar el giroscopio aquí. Arrastra el dedo sobre la carta.");return}
  let got=false;const probe=ev=>{if(ev.beta!=null)got=true};window.addEventListener("deviceorientation",probe);
  setTimeout(()=>{window.removeEventListener("deviceorientation",probe);if(!got){toast("No llegan datos del giroscopio en esta vista. Arrastra el dedo sobre la carta.");return}
    gyroOn=true;window.addEventListener("deviceorientation",onOrient);$("dGyro").textContent="Parar giroscopio"},600);
});

/* info actions */
$("info").addEventListener("change",e=>{if(e.target.id==="e-pull")$("e-paid").disabled=e.target.checked});
$("info").addEventListener("click",async e=>{
  const b=e.target.closest("[data-act]");if(!b)return;const id=state.sel;const it=state.items.find(i=>i.id===id);if(!it||!db)return;
  const a=b.dataset.act;
  if(a==="del"){state.confirmDel=id;renderInfo(true);return}
  if(a==="del-no"){state.confirmDel=null;renderInfo(true);return}
  if(a==="del-yes"){try{await db.doc("items/"+id).delete();closeDetail();toast("Producto borrado")}catch(err){toast("No se pudo borrar. Inténtalo otra vez.")}return}
  if(a==="save"){
    const paid=parseFloat($("e-paid").value),qty=parseInt($("e-qty").value,10),vs=$("e-val").value,pull=$("e-pull").checked;
    const patch={qty:qty>0?qty:1};
    if(pull){if(it.paidMode!=="pull"){patch.paidMode="pull";patch.paid=null;patch.paidNote=""}}
    else{patch.paid=isNaN(paid)?null:paid;if(it.paidMode==="pull"){patch.paidMode="";patch.paidNote=""}}
    if(vs!==""){const v=parseFloat(vs);if(!isNaN(v)){patch.value=v;patch.source="manual";patch.sourceName="Valor puesto a mano";const today=new Date().toISOString().slice(0,10);patch.history=[...(it.history||[]).filter(p=>p.d!==today),{d:today,v}]}}
    try{await db.doc("items/"+id).update(patch);b.blur();toast("Cambios guardados");setTimeout(ensurePullCosts,400)}catch(err){toast("No se pudo guardar. Revisa los números e inténtalo otra vez.")}
  }
});

/* photo upload (Mi copia) */
$("dPhoto").addEventListener("click",()=>{photoFor=state.sel;$("photoInput").click()});
async function toJpeg(file){const url=URL.createObjectURL(file);
  try{const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url});
    const s=Math.min(1,1100/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement("canvas");c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);
    c.getContext("2d").drawImage(img,0,0,c.width,c.height);return await new Promise(res=>c.toBlob(b=>res(b||file),"image/jpeg",.88));
  }catch(e){return file}finally{URL.revokeObjectURL(url)}}
$("photoInput").addEventListener("change",async e=>{
  const file=e.target.files&&e.target.files[0];e.target.value="";const id=photoFor;photoFor=null;if(!file||!id||!assets)return;
  const it=state.items.find(i=>i.id===id);const old=it&&it.photo;toast("Subiendo foto…");
  try{const blob=await toJpeg(file);const r=await assets.upload(blob,{type:blob.type||"image/jpeg"});await db.doc("items/"+id).update({photo:r.id});
    if(old){try{await assets.delete(old)}catch(_){}}state.dmode="mine";toast("Foto guardada")}
  catch(err){const c=err&&err.code;toast(c==="too_large"?"La foto es demasiado grande.":c==="unsupported_type"?"Ese formato no es compatible. Prueba con JPG o PNG.":c==="quota_or_state"?"No queda espacio para más fotos.":"No se pudo subir la foto. Inténtalo otra vez.")}
});


/* coste de cartas de sobre */
function pullPct(){const v=state.settings&&state.settings.pullPct;return typeof v==="number"&&v>=0&&v<=1?v:.5}
const pullBusy=new Set();
function rawRef(it){const m=(state.media[it.id]||{}).market||{};if(m.raw!=null)return m.raw;if(it.kind!=="Graded"&&!isSealed(it)&&(it.source==="guia"||it.source==="ebay")&&it.value!=null)return it.value;return null}
async function ensurePullCosts(){
  if(!db)return;const today=new Date().toISOString().slice(0,10),pc=pullPct();
  for(const it of state.items){
    if(it.paidMode!=="pull"||it.paid!=null||it.pending||pullBusy.has(it.id))continue;
    const raw=rawRef(it);if(raw==null)continue;
    pullBusy.add(it.id);
    try{await db.doc("items/"+it.id).update({paid:Math.round(raw*pc*100)/100,paidNote:`Coste estimado: ${Math.round(pc*100)}% de ${fmt(raw)} (precio raw del ${dateES(today)})`})}catch(e){}
    finally{pullBusy.delete(it.id)}
  }
}
function renderPull(){const pc=Math.round(pullPct()*100);document.querySelectorAll(".pullpct").forEach(e=>e.textContent=pc+"%");
  const inp=$("pullPctIn");if(document.activeElement!==inp)inp.value=pc;
  const n=state.items.filter(i=>i.paidMode==="pull").length,w=state.items.filter(i=>i.paidMode==="pull"&&i.paid==null).length;
  $("pullCount").textContent=n?`Ahora: ${n} pieza${n>1?"s":""} con este coste${w?`, ${w} esperando su precio raw`:""}.`:""}
$("pullPctIn").addEventListener("change",async e=>{const v=parseFloat(e.target.value);if(isNaN(v)||v<0||v>100){renderPull();return}
  if(!db)return;try{await db.doc("meta/settings").set({...(state.settings||{}),pullPct:v/100});toast(`Nuevas cartas de sobre: coste al ${v}% del raw`)}catch(err){toast("No se pudo guardar el porcentaje.")}});
/* collection interactions */
$("grid").addEventListener("click",e=>{const t=e.target.closest("[data-id]");if(t)openDetail(t.dataset.id)});
$("movers").addEventListener("click",e=>{const t=e.target.closest("[data-id]");if(t)openDetail(t.dataset.id)});
$("chips").addEventListener("click",e=>{const b=e.target.closest("[data-f]");if(!b)return;const k=b.dataset.f;
  if(state.lay==="album"&&!state.q.trim()&&k!==state.filter){
    if(k==="all"&&CATS[state.filter]){closeAlbum();return}
    if(CATS[k]){openAlbum(k,state.filter==="all"?document.querySelector(`.shelfbook[data-album="${k}"]`):null);return}}
  state.filter=k;savePref("mc.filter",state.filter);renderChips();renderGrid();renderSummary()});
$("evoChips").addEventListener("click",e=>{const b=e.target.closest("[data-ef]");if(!b)return;state.evoFilter=b.dataset.ef;renderChips();renderEvo()});
document.querySelectorAll("[data-r]").forEach(b=>b.addEventListener("click",()=>{state.range=b.dataset.r;savePref("mc.range",state.range);renderEvo()}));
$("q").addEventListener("input",e=>{state.q=e.target.value;renderGrid()});
$("sort").addEventListener("change",e=>{state.sort=e.target.value;state.dir=state.sort==="name"?"asc":"desc";savePref("mc.sort",state.sort);savePref("mc.dir",state.dir);renderGrid()});
$("sortDir").addEventListener("click",()=>{state.dir=state.dir==="asc"?"desc":"asc";savePref("mc.dir",state.dir);renderGrid()});
function setMode(m){const f=state.filter;if(f==="all"||f==="pending")return;state.modes={...state.modes,[f]:m};savePref("mc.modes",JSON.stringify(state.modes));renderGrid();if(state.tab==="evo")renderEvo()}
$("mOff").addEventListener("click",()=>setMode("off"));
$("mMine").addEventListener("click",()=>setMode("mine"));

/* add product */
$("btnAdd").addEventListener("click",()=>{if(state.tab==="wish"){$("wName").focus();return}$("addPanel").hidden=!$("addPanel").hidden;if(!$("addPanel").hidden)$("fName").focus()});
$("addCancel").addEventListener("click",()=>{$("addPanel").hidden=true});
$("addForm").addEventListener("submit",e=>{e.preventDefault();$("addSave").click()});
$("addSave").addEventListener("click",async()=>{
  const name=$("fName").value.trim();if(!name){$("fName").focus();toast("Pon al menos el nombre");return}
  if(!db){toast("No se puede guardar desde esta vista");return}
  const num=id=>{const v=parseFloat($(id).value);return isNaN(v)?null:v};const val=num("fVal"),today=new Date().toISOString().slice(0,10);
  const doc={name,cat:$("fCat").value,kind:$("fKind").value,set:$("fSet").value.trim(),grade:$("fGrade").value.trim(),qty:Math.max(1,parseInt($("fQty").value,10)||1),paid:num("fPaid"),value:val,source:"manual",sourceName:val==null?"Pendiente de buscar referencia":"Valor puesto a mano",ref:$("fRef").value.trim(),history:val==null?[]:[{d:today,v:val}],added:today,updated:today};
  if($("fPull").checked){doc.paidMode="pull";doc.paid=null}
  try{await db.collection("items").add(doc);$("addForm").reset();$("fQty").value=1;$("addPanel").hidden=true;toast("Producto añadido")}catch(err){toast(err&&err.code==="quota_exceeded"?"La colección está llena.":"No se pudo guardar. Inténtalo otra vez.")}
});

/* wishlist actions */
$("wForm").addEventListener("submit",e=>{e.preventDefault();$("wSave").click()});
$("wSave").addEventListener("click",async()=>{
  const name=$("wName").value.trim();if(!name){$("wName").focus();toast("Escribe qué buscas");return}
  if(!db){toast("No se puede guardar desde esta vista");return}
  const t=parseFloat($("wTarget").value);
  try{await db.collection("wishlist").add({name,cat:$("wCat").value,kind:$("wKind").value,grade:$("wGrade").value.trim(),target:isNaN(t)?null:t,ref:$("wRef").value.trim(),added:new Date().toISOString().slice(0,10)});$("wForm").reset();toast("Añadido a tus objetivos")}catch(err){toast("No se pudo guardar. Inténtalo otra vez.")}
});
$("wlist").addEventListener("change",async e=>{
  const cb=e.target.closest("[data-got]");if(!cb||!cb.checked||!db)return;
  const w=state.wish.find(x=>x.id===cb.dataset.got);if(!w||state.moving)return;
  state.moving=w.id;cb.disabled=true;
  const today=new Date().toISOString().slice(0,10);
  const doc={name:w.name,cat:CATS[w.cat]?w.cat:"otro",kind:w.kind||"Suelta",set:"",grade:w.grade||"",qty:1,paid:null,value:null,source:"manual",sourceName:"Pendiente de buscar referencia",ref:w.ref||"",history:[],added:today,updated:today};
  let ref=null;
  try{ref=await db.collection("items").add(doc)}catch(err){state.moving=null;cb.checked=false;cb.disabled=false;toast("No se pudo pasar a tu colección. Inténtalo otra vez.");return}
  try{await db.doc("wishlist/"+w.id).delete()}catch(err){}
  state.moving=null;
  const {id:_,...wdata}=w;
  toast(`«${w.name}» ya está en tu colección. Pon cuánto pagaste en su ficha.`,{label:"Deshacer",run:async()=>{
    try{await db.doc("wishlist/"+w.id).set(wdata);await db.doc("items/"+ref.id).delete();toast("Vuelve a estar en tus objetivos")}catch(err){toast("No se pudo deshacer.")}}});
});
$("wlist").addEventListener("click",async e=>{
  const d=e.target.closest("[data-wdel]"),y=e.target.closest("[data-wdel-yes]"),n=e.target.closest("[data-wdel-no]");
  if(d){state.wConfirm=d.dataset.wdel;renderWish();return}if(n){state.wConfirm=null;renderWish();return}
  if(y&&db){try{await db.doc("wishlist/"+y.dataset.wdelYes).delete();state.wConfirm=null;toast("Quitado de tus objetivos")}catch(err){toast("No se pudo quitar. Inténtalo otra vez.")}}
});

/* export CSV */
$("btnExport").addEventListener("click",async()=>{
  const cols=["Nombre","Categoría","Tipo","Set","Código","Nota","Cert","Cantidad","Pagado unidad","Valor unidad","Pagado total","Valor total","Ganancia","Ganancia %","Fuente","Referencia","Revisado"];
  const q=v=>{v=v==null?"":String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
  const rows=visible().map(it=>{const n=it.qty||1,pl=plOf(it);return[it.name,CATS[it.cat],it.kind,it.set,it.code,it.grade,it.cert,n,it.paid,it.value,it.paid!=null?+(it.paid*n).toFixed(2):"",it.value!=null?+(it.value*n).toFixed(2):"",pl!=null?+pl.toFixed(2):"",pl!=null&&it.paid?+(pl/(it.paid*n)*100).toFixed(1):"",SRC[it.source]||"",it.ref,it.updated].map(q).join(",")});
  const hist=["","Historial,Fecha,Valor unidad",...state.items.flatMap(it=>(it.history||[]).map(p=>[q(it.name),p.d,p.v].join(",")))];
  const csv="﻿"+[cols.join(","),...rows,...hist].join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download=`mi-coleccion-${new Date().toISOString().slice(0,10)}.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
});

/* ---------- TOPPS × Pokémon ---------- */
const TP={lay:"album",pg:{},catId:null,sheets:[],byId:{},err:null,view:"sets",set:"kanto1",filt:"all",q:"",poke:"all",want:{},confirmOff:null,busy:{}};
try{const g=k=>localStorage.getItem(k);TP.view=g("mc.tpView")||"sets";TP.set=g("mc.tpSet")||"kanto1";TP.filt=g("mc.tpFilt")||"all";TP.poke=g("mc.tpPoke")||"all";TP.lay=g("mc.tpLay")||"album"}catch(e){}
const TP_FAVS=["Bulbasaur","Ivysaur","Venusaur","Charmander","Charmeleon","Charizard","Squirtle","Wartortle","Blastoise","Chikorita","Bayleef","Meganium","Cyndaquil","Quilava","Typhlosion","Totodile","Croconaw","Feraligatr","Pichu","Pikachu","Raichu"];
const TP_GROUPS=[["Kanto",["kanto1","kanto2","kanto3"]],["Johto",["johto1","johtolc","johtoeu"]],["Hoenn",["adv","advc"]]];
const TP_EU="Johto Series 3 solo se vendió en Europa (en EE. UU. no salió). Búscala en eBay de Reino Unido, Alemania, España o Italia, o en Cardmarket.";
const tpOwnedMap=()=>{const m={};for(const it of state.items)if(it.topps)(m[it.topps]=m[it.topps]||[]).push(it);return m};
function tpSetName(c){const s=TP.cat.sets[c.k]||["","",""];if(c.g==="var"){const v=(c.v||"").split(" · ");return v[0]}return `${s[0]} (${s[2]})`}
function tpVersion(c){if(c.g!=="var")return "Normal";const v=(c.v||"").split(" · ");return v.slice(1).join(" · ")||"Normal"}
const tpEU=c=>c.k==="johtoeu"||/solo europa|europe/i.test(c.v||"");
function tpPic(c){return c.sp&&TP.sheets[c.sp[0]]?sprHTML(TP.sheets[c.sp[0]],c.sp[1],c.name,!!c.L):`<div class="ph pokemon">${esc(c.name)}<small>sin imagen</small></div>`}
function tpPokes(){const L=(TP.cat.legend||[]);return{leg:L,fav:TP_FAVS}}
function tpInFav(c){const n=c.p||c.name;return TP_FAVS.includes(n)||(TP.cat.legend||[]).includes(n)}
function tpLoad(meta){if(!meta||!meta.catalog||meta.catalog===TP.catId)return;TP.catId=meta.catalog;TP.sheets=meta.sheets||[];
  fetch(catalogUrl(meta.catalog)).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(c=>{TP.cat=c;TP.byId=Object.fromEntries(c.cards.map(x=>[x.id,x]));TP.err=null;renderTopps();tpCount();if(state.tsel)renderToppsDetail(true)})
  .catch(()=>{TP.err=1;TP.catId=null;renderTopps()})}
function tpCount(){const m=tpOwnedMap();$("cntTopps").textContent=Object.keys(m).length||""}
function tpFilterCards(list,own){const q=TP.q.trim().toLowerCase();
  return list.filter(c=>{if(TP.filt==="miss"&&own[c.id])return false;if(TP.filt==="own"&&!own[c.id])return false;if(TP.filt==="want"&&!TP.want[c.id])return false;
    if(q){const hay=(c.name+" "+(c.p||"")+" #"+c.n+" "+(c.v||"")+" "+tpSetName(c)).toLowerCase();if(!hay.includes(q.replace(/^#/,"#")))return false}return true})}
function tpTile(c,own){const o=!!own[c.id],w=!!TP.want[c.id],conf=TP.confirmOff===c.id;
  const sub=TP.view==="fav"?`${tpSetName(c)} · ${tpVersion(c)}`:(c.g==="var"?tpVersion(c):tpSetName(c));
  return `<div class="tile tp${o?" own":""}" data-tid="${c.id}">
    <button type="button" class="pic" data-topen="${c.id}" aria-label="Ver ${esc(c.name)} #${esc(c.n)} en 3D">${tpPic(c)}${o?`<span class="qt">✓ la tienes</span>`:""}${tpEU(c)?`<span class="eu">Solo Europa</span>`:""}</button>
    <button type="button" class="star" data-twant="${c.id}" aria-pressed="${w}" aria-label="${w?"Quitar de las que quiero":"Marcar como la que quiero"}" title="La quiero">★</button>
    <div class="tn">#${esc(c.n)} ${esc(c.name)}</div>
    <div class="ts" title="${esc(sub)}">${esc(sub)}</div>
    <div class="tv"><span class="mono">${fmt(c.raw)}</span><span class="msg" style="font-size:11.5px">${c.raw!=null?"raw":"sin precio"}</span></div>
    ${conf?`<div class="tpconf">¿Quitarla de tu colección? <button type="button" class="danger" data-toffyes="${c.id}">Sí</button><button type="button" class="ghost" data-toffno="${c.id}">No</button></div>`:`<label class="tpchk"><input type="checkbox" data-town="${c.id}"${o?" checked":""}${TP.busy[c.id]?" disabled":""}> Ya la tengo</label>`}
  </div>`}
function renderTopps(){if(state.tab!=="topps")return;
  for(const b of $("tpView").querySelectorAll("button"))b.setAttribute("aria-pressed",b.dataset.v===TP.view);
  for(const b of $("tpFilt").querySelectorAll("button"))b.setAttribute("aria-pressed",b.dataset.f===TP.filt);
  for(const b of $("tpLay").querySelectorAll("button"))b.setAttribute("aria-pressed",b.dataset.lay===TP.lay);
  $("tpFilt").hidden=TP.lay==="album"&&!TP.q.trim();
  if(TP.err){$("tpTitle").textContent="No se pudieron cargar las cartas";$("tpGrid").innerHTML=`<div class="empty">No se pudo cargar el catálogo Topps. Recarga la página.</div>`;return}
  if(!TP.cat){$("tpTitle").textContent="Cargando las cartas…";return}
  const C=TP.cat,own=tpOwnedMap();
  $("tpSrc").textContent=`Sets del hilo de Elite Fourum · checklists verificados con nslists.com, TCDB y Bulbapedia · imágenes de PriceCharting y de la galería de Elite Fourum, recortadas y enderezadas · precios de PriceCharting (${dateES(C.d)}).`;
  const cnt=list=>list.filter(c=>own[c.id]).length;
  if(TP.view==="sets"){
    const base=C.cards.filter(c=>c.g==="base"),have=cnt(base),miss=base.filter(c=>!own[c.id]),cost=miss.reduce((a,c)=>a+(c.raw||0),0);
    $("tpTitle").textContent=`Tienes ${have} de ${base.length} cartas`;
    $("tpSub").textContent=`8 sets de las 3 generaciones (Kanto, Johto y Hoenn). Completar lo que falta costaría unos ${fmt0(cost)} en raw${miss.some(c=>c.raw==null)?" (algunas aún sin precio)":""}.`;
    $("tpFill").style.width=(have/base.length*100).toFixed(2)+"%";
    $("tpPick").innerHTML=`<div class="tpsets">${TP_GROUPS.map(([g,ks])=>`<div class="tpg"><h4>${g}</h4><div class="col">${ks.map(k=>{const l=base.filter(c=>c.k===k),h=cnt(l),s=C.sets[k];
      return `<button type="button" class="tpset" data-tset="${k}" aria-pressed="${TP.set===k}"><span class="r"><span>${esc(s[0].replace(" (solo Europa)",""))}${k==="johtoeu"?`<span class="eub">Solo Europa</span>`:""}</span><span class="m">${h}/${l.length}</span></span><span class="tpbar"><i style="width:${(h/l.length*100).toFixed(1)}%"></i></span></button>`}).join("")}</div></div>`).join("")}</div>`;
    const searching=!!TP.q.trim();
    const list=tpFilterCards(searching?base:base.filter(c=>c.k===TP.set),own);
    const k=TP.set,s=C.sets[k];
    $("tpBanner").innerHTML=!searching&&k==="johtoeu"?`<div class="warn"><b>Recordatorio: esta serie solo salió en Europa.</b> ${esc(TP_EU)} Las fotos son de copias europeas reales (galería de Elite Fourum).</div>`:"";
    const head=searching?`${list.length} resultado${list.length===1?"":"s"} en los 8 sets`:`${esc(s[0])} · ${esc(s[1])} · ${esc(s[2])} · ${cnt(base.filter(c=>c.k===k))} de ${base.filter(c=>c.k===k).length}`;
    if(TP.lay==="album"&&!searching){$("tpGrid").innerHTML=`<div class="tpsec"><div class="sh"><h3>${head}</h3><span class="msg">Lo que falta: ${fmt0(base.filter(c=>c.k===k&&!own[c.id]).reduce((a,c)=>a+(c.raw||0),0))} en raw</span></div>${tpAlbumHTML("set:"+k,base.filter(c=>c.k===k),own)}</div>`;tpAlbumAfter();return}
    $("tpGrid").innerHTML=`<div class="tpsec"><div class="sh"><h3>${head}</h3>${!searching?`<span class="msg">Lo que falta: ${fmt0(base.filter(c=>c.k===k&&!own[c.id]).reduce((a,c)=>a+(c.raw||0),0))} en raw</span>`:""}</div>${list.length?`<div class="grid">${list.map(c=>tpTile(c,own)).join("")}</div>`:`<div class="empty">${TP.filt==="own"?"Aún no tienes ninguna de este set.":TP.filt==="miss"?"¡Set completo!":TP.filt==="want"?"No has marcado ninguna con ★ aquí.":"No hay cartas que coincidan."}</div>`}</div>`;
  }else{
    const pool=C.cards.filter(tpInFav),P=tpPokes(),have=cnt(pool),wantN=pool.filter(c=>TP.want[c.id]).length,wantCost=pool.filter(c=>TP.want[c.id]&&!own[c.id]).reduce((a,c)=>a+(c.raw||0),0);
    $("tpTitle").textContent=`Tienes ${have} de ${pool.length} versiones`;
    $("tpSub").textContent=`Todas las versiones (normal, foil, rainbow, prismáticas, etc.) de los 18 legendarios y de tus favoritos. Marca con ★ la que quieres de cada uno.${wantN?` Has marcado ${wantN}; te costarían unos ${fmt0(wantCost)} en raw.`:""}`;
    $("tpFill").style.width=(pool.length?have/pool.length*100:0).toFixed(2)+"%";
    const chip=n=>{const l=pool.filter(c=>(c.p||c.name)===n);if(!l.length)return"";const h=cnt(l),st=l.some(c=>TP.want[c.id]);return `<button type="button" class="chip" data-tpoke="${esc(n)}" aria-pressed="${TP.poke===n}">${st?"★ ":""}${esc(n)}<span class="c">${h?h+"/":""}${l.length}</span></button>`};
    $("tpPick").innerHTML=`<div class="pokechips" style="display:flex;flex-direction:column;gap:8px"><div class="chips"><button type="button" class="chip" data-tpoke="all" aria-pressed="${TP.poke==="all"}">Todos</button></div><div><h4 class="eyebrow" style="margin:0 0 6px">Legendarios</h4><div class="chips">${P.leg.map(chip).join("")}</div></div><div><h4 class="eyebrow" style="margin:0 0 6px">Tus favoritos</h4><div class="chips">${P.fav.map(chip).join("")}</div></div></div>`;
    $("tpBanner").innerHTML="";
    const names=(TP.poke==="all"?[...P.leg,...P.fav]:[TP.poke]);
    if(TP.lay==="album"&&!TP.q.trim()){const full=names.flatMap(n=>pool.filter(c=>(c.p||c.name)===n).sort((a,b)=>(a.raw??1e9)-(b.raw??1e9)));$("tpGrid").innerHTML=`<div class="tpsec"><div class="sh"><h3>${TP.poke==="all"?"Legendarios y favoritos":esc(TP.poke)}</h3><span class="msg">${full.length} versiones · ordenadas por Pokémon y precio</span></div>${tpAlbumHTML("fav:"+TP.poke,full,own)}</div>`;tpAlbumAfter();return}
    const secs=names.map(n=>{const l=tpFilterCards(pool.filter(c=>(c.p||c.name)===n),own);if(!l.length)return"";
      return `<div class="tpsec"><div class="sh"><h3>${esc(n)}</h3><span class="msg">${l.length} versi${l.length===1?"ón":"ones"} · de ${fmt(Math.min(...l.map(c=>c.raw??Infinity).filter(isFinite))||null)} a ${fmt(Math.max(0,...l.map(c=>c.raw||0))||null)} raw</span></div><div class="grid">${l.sort((a,b)=>(a.raw??1e9)-(b.raw??1e9)).map(c=>tpTile(c,own)).join("")}</div></div>`}).join("");
    $("tpGrid").innerHTML=secs?`<div style="display:flex;flex-direction:column;gap:22px">${secs}</div>`:`<div class="empty">${TP.filt==="want"?"Aún no has marcado ninguna versión con ★.":TP.filt==="own"?"Aún no tienes ninguna de estas.":"No hay cartas que coincidan."}</div>`;
  }
}
async function tpOwn(id){const c=TP.byId[id];if(!c)return;if(!db){toast("No se puede guardar desde esta vista");renderTopps();return}
  if(TP.busy[id]||tpOwnedMap()[id])return;TP.busy[id]=1;
  const today=new Date().toISOString().slice(0,10),raw=c.raw??null,ver=tpVersion(c);
  const doc={name:`${c.name} #${c.n} – Topps ${tpSetName(c).replace(/ \(\d{4}\)$/,"")}${ver!=="Normal"?" ("+ver+")":""}`,cat:"pokemon",kind:"Suelta",set:"Topps "+tpSetName(c),code:"#"+c.n,grade:"",qty:1,paid:null,value:raw,
    source:raw!=null?"guia":"manual",sourceName:raw!=null?`PriceCharting · raw ${fmt(raw)}`:"Sin precio de referencia todavía",ref:c.u?"https://www.pricecharting.com/game/"+c.u:"",history:raw!=null?[{d:today,v:raw}]:[],added:today,updated:today,topps:c.id,...(tpEU(c)?{note:"Solo se vendió en Europa."}:{})};
  let ref;
  try{ref=await db.collection("items").add(doc)}catch(err){delete TP.busy[id];renderTopps();toast(err&&err.code==="quota_exceeded"?"La colección está llena.":"No se pudo pasar a tu colección. Inténtalo otra vez.");return}
  const md={src:"PriceCharting",check:"Imagen de PriceCharting (Topps)",market:{raw,psa9:c.g9??null,psa10:c.p10??null,d:TP.cat.d}};
  if(c.sp&&TP.sheets[c.sp[0]])md.sprite={sheet:TP.sheets[c.sp[0]],cell:c.sp[1],...(c.L?{rot:1}:{})};
  try{await db.doc("media/"+ref.id).set(md)}catch(e){}
  delete TP.busy[id];renderTopps();tpCount();
  toast(`«${c.name} #${c.n}» ya está en tu colección (Pokémon). Apunta lo que pagaste en su ficha.`,{label:"Deshacer",run:()=>tpUnown(id,true)});
}
async function tpUnown(id,quiet){if(!db)return;const its=tpOwnedMap()[id]||[];
  try{for(const it of its){await db.doc("items/"+it.id).delete();try{await db.doc("media/"+it.id).delete()}catch(e){}}TP.confirmOff=null;renderTopps();tpCount();if(state.tsel)renderToppsDetail(false);toast(quiet?"Deshecho":"Quitada de tu colección")}
  catch(e){toast("No se pudo quitar. Inténtalo otra vez.")}}
async function tpWant(id){if(!db){toast("No se puede guardar desde esta vista");return}const on=!TP.want[id];
  if(on)TP.want[id]=true;else delete TP.want[id];renderTopps();if(state.tsel)renderToppsDetail(false);
  try{if(on)await db.doc("topps/"+id).set({want:true,d:new Date().toISOString().slice(0,10)});else await db.doc("topps/"+id).delete()}catch(e){toast("No se pudo guardar la ★.")}}
/* detalle Topps */
function toppsStageHTML(c){const own=!!tpOwnedMap()[c.id];
  const foil=c.g==="var"&&!/^normal$/i.test(tpVersion(c));
  const art=`<div class="art">${tpPic(c)}${foil?`<div class="shine holo"></div>`:""}<div class="glare"></div></div>`;
  const back=`<div class="bk"><div class="s">Topps × Pokémon · ${esc(tpSetName(c))}</div><div class="h">${esc(c.name)} #${esc(c.n)}</div>
    <div><div class="s">Precio raw (sin gradear)</div><div class="val">${c.raw==null?"—":fmt(c.raw)}</div></div>
    <dl><dt>Set</dt><dd>${esc(tpSetName(c))}</dd><dt>Número</dt><dd>#${esc(c.n)}</dd><dt>Versión</dt><dd>${esc(tpVersion(c))}</dd><dt>Estado</dt><dd class="${own?"pos":""}">${own?"En tu colección":"Te falta"}</dd>${TP.want[c.id]?`<dt>Objetivo</dt><dd>★ la quieres</dd>`:""}</dl>
    <div class="mk"><div>Raw<b>${fmt(c.raw)}</b></div><div>PSA 9<b>${fmt(c.g9)}</b></div><div>PSA 10<b>${fmt(c.p10)}</b></div></div>
    ${tpEU(c)?`<div class="disc"><b>Solo se vendió en Europa.</b>${c.standin?" La imagen es la de la versión americana.":""}</div>`:""}
    <div class="s" style="margin-top:auto">PriceCharting · ${esc(dateES(TP.cat.d))}</div></div>`;
  return `<div class="c3d cardw${c.L?" land":""}" id="c3d" tabindex="0" role="img" aria-label="${esc(c.name)} en 3D. Pulsa Intro para darle la vuelta."><div class="face front">${art}</div><div class="face back">${back}</div></div>`}
function toppsInfoHTML(c){const own=tpOwnedMap()[c.id],w=!!TP.want[c.id],conf=TP.confirmOff===c.id;
  const others=TP.cat.cards.filter(x=>x.id!==c.id&&(x.p||x.name)===(c.p||c.name)&&tpInFav(x)&&tpInFav(c));
  const all=[c,...others].sort((a,b)=>(a.raw??1e9)-(b.raw??1e9)),om=tpOwnedMap();
  const tags=[`<span class="tag">${esc(tpSetName(c))}</span>`,`<span class="tag">${esc(tpVersion(c))}</span>`];
  if(tpEU(c))tags.push(`<span class="tag src-manual">Solo Europa</span>`);
  if(own)tags.push(`<span class="tag gold">En tu colección</span>`);if(w)tags.push(`<span class="tag gold">★ La quieres</span>`);
  const notes=[];
  if(tpEU(c))notes.push(`<div class="warn"><b>Recordatorio: solo salió en Europa.</b> ${esc(TP_EU)}</div>`);
  if(c.standin)notes.push(`<div class="msg">La imagen es la de la versión americana (Johto Series 1); la europea cambia el logo.</div>`);
  if(!c.sp)notes.push(`<div class="msg">Aún no hay foto de esta carta en PriceCharting.</div>`);
  return `
    <div class="kicker"><span class="d" style="background:var(--c-pokemon)"></span>Topps × Pokémon · ${esc(tpSetName(c))}</div>
    <h2 id="dName">${esc(c.name)} #${esc(c.n)}</h2>
    <div class="tags">${tags.join("")}</div>
    <div class="valuebox"><div><div class="v">${c.raw==null?"Sin precio":fmt(c.raw)}</div><div class="u">precio raw (sin gradear) · PriceCharting ${esc(dateES(TP.cat.d))}</div></div></div>
    <div class="card">
      ${conf?`<div class="tpconf" style="font-size:14px;padding:10px 12px">¿Quitarla de tu colección? Se borra su ficha${own&&own.some(i=>i.paid!=null)?" y lo que apuntaste como pagado":""}. <button type="button" class="danger" data-toffyes="${c.id}">Sí, quitar</button><button type="button" class="ghost" data-toffno="${c.id}">No</button></div>`
      :`<label class="bigchk"><input type="checkbox" data-town="${c.id}"${own?" checked":""}${TP.busy[c.id]?" disabled":""}><span>Ya la tengo<small>${own?"Está en tu colección, en la categoría Pokémon.":"Márcala cuando la compres: se crea su ficha en tu colección (Pokémon) con el precio raw de hoy."}</small></span></label>`}
      <div class="formbar" style="margin:0">${own?`<button type="button" data-tgoto="${own[0].id}">Ver su ficha en la colección</button>`:""}<button type="button" class="${w?"primary":""}" data-twant="${c.id}" aria-pressed="${w}">${w?"★ Es la que quiero":"☆ Es la que quiero"}</button></div>
    </div>
    <div class="card">
      <div class="cardhead"><h3 style="font-size:16px">Precios de mercado</h3><span class="msg">PriceCharting · ${esc(dateES(TP.cat.d))}</span></div>
      <div class="stats3"><div class="stat me"><div class="l">Raw</div><div class="v">${fmt(c.raw)}</div><div class="s">${c.raw==null?"sin ventas":"sin gradear"}</div></div><div class="stat"><div class="l">PSA 9</div><div class="v">${fmt(c.g9)}</div><div class="s">${c.g9==null?"sin ventas":"mercado"}</div></div><div class="stat"><div class="l">PSA 10</div><div class="v">${fmt(c.p10)}</div><div class="s">${c.p10==null?"sin ventas":"mercado"}</div></div></div>
      ${c.u?`<div class="msg"><a href="https://www.pricecharting.com/game/${esc(c.u)}" target="_blank" rel="noopener">Ver ventas en PriceCharting</a></div>`:""}
    </div>
    ${notes.length?`<div class="card">${notes.join("")}</div>`:""}
    ${others.length?`<div class="card"><div class="cardhead"><h3 style="font-size:16px">Todas las versiones de ${esc(c.p||c.name)}</h3><span class="msg">${all.length} · de más barata a más cara</span></div>
      <div class="vers">${all.map(x=>`<button type="button" data-topen="${x.id}" aria-current="${x.id===c.id}"><div class="vp">${tpPic(x)}${om[x.id]?`<span class="ok">✓</span>`:""}</div><span>${TP.want[x.id]?"★ ":""}${esc(tpVersion(x))}</span><span class="msg" style="font-size:10px">${esc(tpSetName(x).replace(/ \(\d{4}\)$/,""))}</span><b class="mono" style="font-size:11px">${fmt(x.raw)}</b></button>`).join("")}</div></div>`:""}
    <div class="card"><dl class="facts"><dt>Set</dt><dd>${esc(tpSetName(c))}</dd><dt>Número</dt><dd class="mono">#${esc(c.n)}</dd><dt>Versión</dt><dd>${esc(tpVersion(c))}</dd><dt>Generación</dt><dd>${esc((TP.cat.sets[c.k]||[])[1]||({1999:"Kanto",2000:"Kanto",2001:"Johto",2003:"Hoenn",2004:"Hoenn"})[((c.v||"").match(/\d{4}/)||[])[0]]||"")}</dd></dl></div>`;
}

/* ---- álbum ---- */
const tpPer=()=>window.innerWidth>=980?2:1;
function tpPocket(c,own){const o=!!own[c.id],w=!!TP.want[c.id];
  return `<button type="button" class="pocket ${o?"own":"miss"}${tpEU(c)?" eu":""}" data-apocket="${c.id}" aria-label="#${esc(c.n)} ${esc(c.name)}${o?", la tienes":", te falta"}. Ver en 3D">
    <span class="pc">${tpPic(c)}</span><span class="sleeve"></span>
    <span class="plab"><b>#${esc(c.n)}</b> ${esc(c.name)}</span>${o?`<span class="pok">✓</span>`:""}${w?`<span class="pst">★</span>`:""}</button>`}
function tpAlbumHTML(key,list,own){const pages=Math.max(1,Math.ceil(list.length/9)),per=tpPer();
  let pg=Math.min(TP.pg[key]||0,pages-1);pg-=pg%per;TP.pg[key]=pg;TP.akey=key;TP.alist=list;TP.apages=pages;
  const pageHTML=i=>{const l=list.slice(i*9,i*9+9);const cells=l.map(c=>tpPocket(c,own)).join("")+Array.from({length:9-l.length},()=>`<span class="pocket empty"><span class="sleeve"></span></span>`).join("");
    const h=l.filter(c=>own[c.id]).length;return `<div class="apage${i%2?" right":" left"}"><div class="apgrid">${cells}</div><div class="afoot">Página ${i+1} · ${h}/${l.length}</div></div>`};
  const spread=[pageHTML(pg)];if(per===2&&pg+1<pages)spread.push(pageHTML(pg+1));
  const dots=Array.from({length:Math.ceil(pages/per)},(_,i)=>`<button type="button" class="adot" data-agoto="${i*per}" aria-label="Ir a la página ${i*per+1}" aria-current="${i*per===pg}"></button>`).join("");
  return `<div class="album"><div class="anav"><button type="button" class="ghost" data-apg="-1" aria-label="Página anterior"${pg===0?" disabled":""}>‹</button><span class="apos">Página ${pg+1}${per===2&&pg+1<pages?`–${pg+2}`:""} de ${pages}</span><button type="button" class="ghost" data-apg="1" aria-label="Página siguiente"${pg+per>=pages?" disabled":""}>›</button></div>
    <div class="abook${spread.length===2?" two":""}" id="abook">${spread.join("")}</div><div class="adots">${dots}</div>
    <div class="msg ahint">Desliza o usa ← → para pasar página · toca una carta para sacarla de la funda</div></div>`}
let tpTurnDir=0;
function tpAlbumAfter(){const b=$("abook");if(!b)return;
  if(state.tsel){const p=b.querySelector(`[data-apocket="${state.tsel}"]`);if(p)p.classList.add("out")}
  if(tpTurnDir&&!reduce&&b.animate){const d=tpTurnDir;b.animate([{transform:`perspective(1600px) rotateY(${d*28}deg) translateX(${d*40}px)`,opacity:.25},{transform:"none",opacity:1}],{duration:340,easing:"cubic-bezier(.2,.7,.2,1)"})}
  tpTurnDir=0}
function tpTurn(d){if(!TP.akey)return;const per=tpPer();const n=(TP.pg[TP.akey]||0)+d*per;if(n<0||n>=TP.apages)return;
  const b=$("abook");const go=()=>{TP.pg[TP.akey]=n;tpTurnDir=d;renderTopps()};
  if(b&&!reduce&&b.animate){const a=b.animate([{transform:"none",opacity:1},{transform:`perspective(1600px) rotateY(${-d*28}deg) translateX(${-d*40}px)`,opacity:.2}],{duration:200,easing:"ease-in"});a.onfinish=go}else go()}
function tpPull(btn){const id=btn.dataset.apocket,pc=btn.querySelector(".pc");
  if(reduce||!pc||!pc.animate){openTopps(id);return}
  const r=pc.getBoundingClientRect();const cl=document.createElement("div");cl.className="pullcard";cl.innerHTML=pc.innerHTML+'<span class="pglare"></span>';
  Object.assign(cl.style,{left:r.left+"px",top:r.top+"px",width:r.width+"px",height:r.height+"px"});document.body.append(cl);btn.classList.add("out");
  const vw=innerWidth,vh=innerHeight,tw=Math.min(320,vw*.74),sc=tw/r.width,cx=vw/2-(r.left+r.width/2),cy=vh*.42-(r.top+r.height/2);
  const a1=cl.animate([{transform:"translateY(0)"},{transform:`translateY(${-r.height*.55}px) rotate(-2deg)`}],{duration:260,easing:"cubic-bezier(.3,.6,.3,1)",fill:"forwards"});
  a1.onfinish=()=>{const a2=cl.animate([{transform:`translateY(${-r.height*.55}px) rotate(-2deg)`},{transform:`translate(${cx}px,${cy}px) scale(${sc}) rotate(0deg)`}],{duration:420,easing:"cubic-bezier(.2,.7,.2,1)",fill:"forwards"});
    a2.onfinish=()=>{openTopps(id);cl.animate([{opacity:1},{opacity:0}],{duration:180,fill:"forwards"}).onfinish=()=>cl.remove()}}}
function tpPutBack(id){const btn=document.querySelector(`#abook [data-apocket="${id}"]`);if(!btn)return;const pc=btn.querySelector(".pc");
  const src=document.querySelector("#c3d .art");if(reduce||!pc||!src||!pc.animate){btn.classList.remove("out");return}
  const a=src.getBoundingClientRect(),r=pc.getBoundingClientRect();if(!r.width||r.bottom<0||r.top>innerHeight){btn.classList.remove("out");return}
  const cl=document.createElement("div");cl.className="pullcard";cl.innerHTML=pc.innerHTML;
  Object.assign(cl.style,{left:r.left+"px",top:r.top+"px",width:r.width+"px",height:r.height+"px"});document.body.append(cl);
  const sc=a.width/r.width,dx=(a.left+a.width/2)-(r.left+r.width/2),dy=(a.top+a.height/2)-(r.top+r.height/2);
  cl.animate([{transform:`translate(${dx}px,${dy}px) scale(${sc})`},{transform:`translateY(${-r.height*.55}px)`,offset:.7},{transform:"none"}],{duration:520,easing:"cubic-bezier(.3,.6,.3,1)"}).onfinish=()=>{btn.classList.remove("out");cl.remove()}}
function renderToppsDetail(stage){const c=TP.byId[state.tsel];if(!c){closeDetail();return}
  if(stage){$("stage").innerHTML=toppsStageHTML(c);$("imgsrc").textContent=c.sp?(c.src==="ef"?"Foto de la galería de Elite Fourum · enderezada y retocada":"Imagen de PriceCharting · enderezada y retocada"):"Sin foto todavía";applyFlip();bindTilt()}
  $("info").innerHTML=toppsInfoHTML(c)}
function openTopps(id){if(!TP.byId[id])return;const reopen=!$("overlay").hidden&&state.tsel;if(!reopen)lastFocus=document.activeElement;
  state.sel=null;state.tsel=id;state.flipped=false;TP.confirmOff=null;
  $("dOff").parentElement.hidden=true;$("dPhoto").hidden=true;
  $("overlay").hidden=false;document.body.style.overflow="hidden";$("overlay").scrollTop=0;renderToppsDetail(true);if(!reopen)$("dClose").focus();
  $("dGyro").hidden=!("DeviceOrientationEvent" in window&&matchMedia("(pointer:coarse)").matches)}
$("p-topps").addEventListener("click",e=>{
  const v=e.target.closest("[data-v]");if(v&&v.closest("#tpView")){TP.view=v.dataset.v;savePref("mc.tpView",TP.view);TP.confirmOff=null;renderTopps();return}
  const f=e.target.closest("[data-f]");if(f){TP.filt=f.dataset.f;savePref("mc.tpFilt",TP.filt);renderTopps();return}
  const st=e.target.closest("[data-tset]");if(st){TP.set=st.dataset.tset;savePref("mc.tpSet",TP.set);if(TP.q){TP.q="";$("tpQ").value=""}renderTopps();return}
  const pk=e.target.closest("[data-tpoke]");if(pk){TP.poke=pk.dataset.tpoke;savePref("mc.tpPoke",TP.poke);renderTopps();return}
  const ly=e.target.closest("[data-lay]");if(ly){TP.lay=ly.dataset.lay;savePref("mc.tpLay",TP.lay);renderTopps();return}
  const ap=e.target.closest("[data-apg]");if(ap){tpTurn(+ap.dataset.apg);return}
  const ag=e.target.closest("[data-agoto]");if(ag){const n=+ag.dataset.agoto,c=TP.pg[TP.akey]||0;if(n!==c){TP.pg[TP.akey]=n;tpTurnDir=n>c?1:-1;renderTopps()}return}
  const po=e.target.closest("[data-apocket]");if(po){if(tpSwiped)return;tpPull(po);return}
  const o=e.target.closest("[data-topen]");if(o){openTopps(o.dataset.topen);return}
  const w=e.target.closest("[data-twant]");if(w){tpWant(w.dataset.twant);return}
  const y=e.target.closest("[data-toffyes]");if(y){tpUnown(y.dataset.toffyes);return}
  const n=e.target.closest("[data-toffno]");if(n){TP.confirmOff=null;renderTopps();return}
});
$("p-topps").addEventListener("change",e=>{const cb=e.target.closest("[data-town]");if(!cb)return;
  if(cb.checked)tpOwn(cb.dataset.town);else{TP.confirmOff=cb.dataset.town;renderTopps()}});
let tpSw=null,tpSwiped=false;
$("p-topps").addEventListener("pointerdown",e=>{if(!e.target.closest("#abook"))return;tpSw={x:e.clientX,y:e.clientY,t:Date.now()};tpSwiped=false});
$("p-topps").addEventListener("pointerup",e=>{if(!tpSw)return;const dx=e.clientX-tpSw.x,dy=e.clientY-tpSw.y;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.3){tpSwiped=true;setTimeout(()=>tpSwiped=false,50);tpTurn(dx<0?1:-1)}tpSw=null});
document.addEventListener("keydown",e=>{if(state.tab!=="topps"||!$("overlay").hidden||!$("abook"))return;const t=e.target;if(t&&(t.tagName==="INPUT"||t.tagName==="SELECT"||t.closest(".tabs")))return;if(e.key==="ArrowRight"){e.preventDefault();tpTurn(1)}else if(e.key==="ArrowLeft"){e.preventDefault();tpTurn(-1)}});
let tpRz;window.addEventListener("resize",()=>{clearTimeout(tpRz);tpRz=setTimeout(()=>{if(state.tab==="topps"&&$("abook")){const two=$("abook").classList.contains("two");if((tpPer()===2)!==two)renderTopps()}},250)});
let tpQT;$("tpQ").addEventListener("input",e=>{clearTimeout(tpQT);tpQT=setTimeout(()=>{TP.q=e.target.value;renderTopps()},150)});
$("info").addEventListener("click",e=>{if(!state.tsel)return;
  const o=e.target.closest("[data-topen]");if(o){openTopps(o.dataset.topen);return}
  const w=e.target.closest("[data-twant]");if(w){tpWant(w.dataset.twant);return}
  const y=e.target.closest("[data-toffyes]");if(y){tpUnown(y.dataset.toffyes);return}
  const n=e.target.closest("[data-toffno]");if(n){TP.confirmOff=null;renderToppsDetail(false);return}
  const g=e.target.closest("[data-tgoto]");if(g){const id=g.dataset.tgoto;state.tsel=null;$("dOff").parentElement.hidden=false;openDetail(id);return}});
$("info").addEventListener("change",async e=>{if(!state.tsel)return;const cb=e.target.closest("[data-town]");if(!cb)return;
  if(cb.checked){await tpOwn(cb.dataset.town);renderToppsDetail(true)}else{TP.confirmOff=cb.dataset.town;renderToppsDetail(false)}});

/* ---------- Álbumes de la colección ----------
   «Todo» muestra una estantería con un álbum 3D por categoría. Al elegir uno, la cámara se acerca,
   se abre la tapa y aparecen las páginas con las piezas en sus fundas. */
const CA={pg:{},anim:false,turnDir:0,sw:null,swiped:false};
try{state.lay=localStorage.getItem("mc.lay")||"album"}catch(e){state.lay="album"}
const albumMode=()=>state.lay==="album"&&!state.q.trim()&&state.filter!=="pending";
const CICON={
  pokemon:'<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h5.4m6.2 0h5.4"/><circle cx="12" cy="12" r="2.6"/>',
  dragonball:'<circle cx="12" cy="12" r="8.5"/><path d="m12 7.4 1.4 2.9 3.1.4-2.3 2.1.6 3.1L12 14.4l-2.8 1.5.6-3.1-2.3-2.1 3.1-.4z"/>',
  futbol:'<circle cx="12" cy="12" r="8.5"/><path d="m12 8.4 3.1 2.2-1.2 3.6h-3.8l-1.2-3.6zM12 3.5v4.9m3.1 2.2 4.4-1.4m-5.6 5 2.7 3.7m-6.5-3.7-2.7 3.7m1.5-7.3-4.4-1.4"/>',
  arte:'<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 1.5-2.2-.6-1.3.2-2.6 1.7-2.6H17a3.5 3.5 0 0 0 3.5-3.5c0-4.9-3.8-8.7-8.5-8.7z"/><circle cx="7.8" cy="11" r="1.1"/><circle cx="10.5" cy="7.4" r="1.1"/><circle cx="15" cy="7.8" r="1.1"/>',
  videojuegos:'<path d="M6.5 8.5h11a3.5 3.5 0 0 1 3.4 4.3l-.9 3.6a2 2 0 0 1-3.5.7L15 15H9l-1.5 2.1a2 2 0 0 1-3.5-.7l-.9-3.6a3.5 3.5 0 0 1 3.4-4.3z"/><path d="M8 11v3m-1.5-1.5h3"/><circle cx="15.5" cy="11.5" r=".9"/><circle cx="17.3" cy="13.3" r=".9"/>',
  vhs:'<rect x="3" y="6.5" width="18" height="11" rx="1.5"/><circle cx="8.5" cy="12" r="2"/><circle cx="15.5" cy="12" r="2"/><path d="M10.5 12h3"/>',
  otro:'<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>'
};
const catTotals=l=>({n:l.reduce((a,i)=>a+(i.qty||1),0),v:l.reduce((a,i)=>a+(i.value||0)*(i.qty||1),0)});
function bookHTML(cat){
  const l=visible(cat),{n,v}=catTotals(l),top=l.slice(0,9);
  const mini=top.map(it=>`<span class="mp${isBoxy(it)?" boxy":""}">${imgHTML(it,modeFor(cat),false)}</span>`).join("")+Array.from({length:9-top.length},()=>'<span class="mp"></span>').join("");
  return `<div class="book" style="--cc:${CATVAR[cat]||"var(--c-otro)"}">
    <div class="b-back"></div><div class="b-edge"></div>
    <div class="b-page"><div class="b-grid">${mini}</div></div>
    <div class="b-cover"><div class="b-front"><span class="b-spine"></span><span class="b-frame"></span>
      <span class="b-emb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${CICON[cat]||CICON.otro}</svg></span>
      <span class="b-title">${esc(CATS[cat])}</span><span class="b-sub">${n} pieza${n===1?"":"s"} · ${fmt0(v)}</span>
      <span class="b-corner t"></span><span class="b-corner b"></span><span class="b-gloss"></span></div><div class="b-inside"></div></div>
  </div>`}
function shelfHTML(){
  const cats=Object.keys(CATS).filter(k=>state.items.some(i=>i.cat===k&&!i.pending));
  if(!cats.length)return `<div class="empty">${state.items.length?"Tus piezas están todas en «Por identificar».":"Aún no tienes piezas. Pulsa «+ Añadir» para empezar."}</div>`;
  return `<div class="shelf">${cats.map(k=>`<button type="button" class="shelfbook" data-album="${k}" aria-label="Abrir el álbum de ${esc(CATS[k])}">${bookHTML(k)}</button>`).join("")}</div><div class="msg ahint">Toca un álbum para abrirlo</div>`}
function cPocket(it){const q=it.qty||1;
  return `<button type="button" class="pocket own${isBoxy(it)?" boxy":""}" data-cpocket="${esc(it.id)}" aria-label="${esc(it.name)}, ${it.value==null?"sin valor":fmt0(it.value*q)}. Ver en 3D">
    <span class="pc">${imgHTML(it,modeFor(it.cat))}</span><span class="sleeve"></span>
    <span class="plab"><b>${it.value==null?"—":fmt0(it.value*q)}</b> ${esc(it.name)}</span>${it.grade?`<span class="pgr">${esc(it.grade)}</span>`:""}${q>1?`<span class="pok">×${q}</span>`:""}</button>`}
function cAlbumHTML(cat){
  const list=visible(cat),pages=Math.max(1,Math.ceil(list.length/9)),per=tpPer();
  let pg=Math.min(CA.pg[cat]||0,pages-1);pg-=pg%per;CA.pg[cat]=pg;CA.cat=cat;CA.pages=pages;
  const page=i=>{const l=list.slice(i*9,i*9+9);return `<div class="apage${i%2?" right":" left"}"><div class="apgrid">${l.map(cPocket).join("")}${Array.from({length:9-l.length},()=>'<span class="pocket empty"><span class="sleeve"></span></span>').join("")}</div><div class="afoot">Página ${i+1}</div></div>`};
  const spread=[page(pg)];if(per===2&&pg+1<pages)spread.push(page(pg+1));
  const dots=pages>per?`<div class="adots">${Array.from({length:Math.ceil(pages/per)},(_,i)=>`<button type="button" class="adot" data-cgoto="${i*per}" aria-label="Ir a la página ${i*per+1}" aria-current="${i*per===pg}"></button>`).join("")}</div>`:"";
  const{n,v}=catTotals(list);
  return `<div class="album calb" style="--cc:${CATVAR[cat]||"var(--c-otro)"}">
    <div class="calhead"><button type="button" class="ghost" data-cclose>‹ Estantería</button><div class="caltitle"><span class="d"></span>${esc(CATS[cat])}<span class="msg">${n} pieza${n===1?"":"s"} · ${fmt0(v)}</span></div></div>
    <div class="anav"><button type="button" class="ghost" data-cpg="-1" aria-label="Página anterior"${pg===0?" disabled":""}>‹</button><span class="apos">Página ${pg+1}${per===2&&pg+1<pages?`–${pg+2}`:""} de ${pages}</span><button type="button" class="ghost" data-cpg="1" aria-label="Página siguiente"${pg+per>=pages?" disabled":""}>›</button></div>
    <div class="abook${spread.length===2?" two":""}" id="cbook">${spread.join("")}</div>${dots}
    <div class="msg ahint">Desliza o usa ← → para pasar página · toca una pieza para sacarla de la funda</div></div>`}
function cAlbumAfter(){const b=$("cbook");if(!b)return;
  if(state.sel){const p=b.querySelector(`[data-cpocket="${state.sel}"]`);if(p)p.classList.add("out")}
  if(CA.turnDir&&!reduce&&b.animate){const d=CA.turnDir;b.animate([{transform:`perspective(1600px) rotateY(${d*28}deg) translateX(${d*40}px)`,opacity:.25},{transform:"none",opacity:1}],{duration:340,easing:"cubic-bezier(.2,.7,.2,1)"})}
  CA.turnDir=0}
function cTurn(d){if(!CA.cat||!$("cbook"))return;const per=tpPer(),n=(CA.pg[CA.cat]||0)+d*per;if(n<0||n>=CA.pages)return;
  const b=$("cbook"),go=()=>{CA.pg[CA.cat]=n;CA.turnDir=d;renderGrid()};
  if(!reduce&&b.animate){b.animate([{transform:"none",opacity:1},{transform:`perspective(1600px) rotateY(${-d*28}deg) translateX(${-d*40}px)`,opacity:.2}],{duration:200,easing:"ease-in"}).onfinish=go}else go()}
function cPull(btn){const id=btn.dataset.cpocket,pc=btn.querySelector(".pc");
  if(reduce||!pc||!pc.animate){openDetail(id);return}
  const r=pc.getBoundingClientRect(),cl=document.createElement("div");cl.className="pullcard";cl.innerHTML=pc.innerHTML+'<span class="pglare"></span>';
  Object.assign(cl.style,{left:r.left+"px",top:r.top+"px",width:r.width+"px",height:r.height+"px"});document.body.append(cl);btn.classList.add("out");
  const vw=innerWidth,vh=innerHeight,sc=Math.min(320,vw*.74)/r.width,cx=vw/2-(r.left+r.width/2),cy=vh*.42-(r.top+r.height/2);
  cl.animate([{transform:"translateY(0)"},{transform:`translateY(${-r.height*.55}px) rotate(-2deg)`}],{duration:260,easing:"cubic-bezier(.3,.6,.3,1)",fill:"forwards"}).onfinish=()=>{
    cl.animate([{transform:`translateY(${-r.height*.55}px) rotate(-2deg)`},{transform:`translate(${cx}px,${cy}px) scale(${sc}) rotate(0deg)`}],{duration:420,easing:"cubic-bezier(.2,.7,.2,1)",fill:"forwards"}).onfinish=()=>{
      openDetail(id);cl.animate([{opacity:1},{opacity:0}],{duration:180,fill:"forwards"}).onfinish=()=>cl.remove()}}}
function cPutBack(id){const btn=document.querySelector(`#cbook [data-cpocket="${id}"]`);if(!btn)return;const pc=btn.querySelector(".pc"),src=document.querySelector("#c3d .art");
  if(reduce||!pc||!src||!pc.animate){btn.classList.remove("out");return}
  const a=src.getBoundingClientRect(),r=pc.getBoundingClientRect();if(!r.width||r.bottom<0||r.top>innerHeight){btn.classList.remove("out");return}
  const cl=document.createElement("div");cl.className="pullcard";cl.innerHTML=pc.innerHTML;Object.assign(cl.style,{left:r.left+"px",top:r.top+"px",width:r.width+"px",height:r.height+"px"});document.body.append(cl);
  const sc=a.width/r.width,dx=(a.left+a.width/2)-(r.left+r.width/2),dy=(a.top+a.height/2)-(r.top+r.height/2);
  cl.animate([{transform:`translate(${dx}px,${dy}px) scale(${sc})`},{transform:`translateY(${-r.height*.55}px)`,offset:.7},{transform:"none"}],{duration:520,easing:"cubic-bezier(.3,.6,.3,1)"}).onfinish=()=>{btn.classList.remove("out");cl.remove()}}

/* animaciones de abrir y cerrar */
const EASE="cubic-bezier(.45,.05,.25,1)",SHELF_POSE="rotateX(10deg) rotateY(-24deg)";
function flyBook(cat){const W=Math.min(340,innerWidth*.62,(innerHeight-120)*.75),H=W*4/3;
  const veil=document.createElement("div");veil.className="zveil";
  const fly=document.createElement("div");fly.className="flybook";fly.innerHTML=bookHTML(cat);
  Object.assign(fly.style,{left:(innerWidth-W)/2+"px",top:(innerHeight-H)/2+"px",width:W+"px"});
  const shift=innerWidth>=W*2*1.18+48?W/2:0;document.body.append(veil,fly);return{W,H,shift,veil,fly,book:fly.querySelector(".book"),cover:fly.querySelector(".b-cover")}}
function fromRect(r,W,H){return r?{s:r.width/W,dx:r.left+r.width/2-innerWidth/2,dy:r.top+r.height/2-innerHeight/2}:{s:.35,dx:0,dy:0}}
async function openAlbum(cat,src){
  if(CA.anim)return;
  const show=()=>{state.filter=cat;savePref("mc.filter",cat);renderChips();renderSummary();renderGrid()};
  if(reduce||!document.body.animate){show();return}
  CA.anim=true;
  try{
    const f=flyBook(cat),srcBook=src&&src.querySelector(".book"),p=fromRect(srcBook&&srcBook.getBoundingClientRect(),f.W,f.H);
    if(src)src.style.visibility="hidden";
    f.veil.animate([{opacity:0},{opacity:1}],{duration:500,fill:"forwards"});
    // 1. la cámara se acerca al álbum
    await Promise.all([
      f.fly.animate([{transform:`translate(${p.dx}px,${p.dy}px) scale(${p.s})`,opacity:src?1:0},{transform:"none",opacity:1}],{duration:650,easing:"cubic-bezier(.2,.7,.2,1)",fill:"forwards"}).finished,
      f.book.animate([{transform:SHELF_POSE},{transform:"none"}],{duration:650,easing:"cubic-bezier(.2,.7,.2,1)",fill:"forwards"}).finished]);
    // 2. se abre la tapa y seguimos acercándonos a la primera página
    const zoom=`translateX(${f.shift}px) scale(1.18)`;
    await Promise.all([
      f.cover.animate([{transform:"rotateY(0deg)"},{transform:"rotateY(-172deg)"}],{duration:950,easing:EASE,fill:"forwards"}).finished,
      f.fly.animate([{transform:"none"},{transform:zoom}],{duration:950,easing:EASE,fill:"forwards"}).finished]);
    // 3. aparece el álbum de verdad
    CA.anim=false;show();
    window.scrollTo({top:$("calbum").getBoundingClientRect().top+scrollY-12,behavior:"instant"});
    $("calbum").animate([{opacity:0,transform:"scale(.96)"},{opacity:1,transform:"none"}],{duration:450,easing:"ease-out"});
    await Promise.all([
      f.fly.animate([{transform:zoom,opacity:1},{transform:`translateX(${f.shift}px) scale(1.45)`,opacity:0}],{duration:420,easing:"ease-in",fill:"forwards"}).finished,
      f.veil.animate([{opacity:1},{opacity:0}],{duration:450,fill:"forwards"}).finished]);
    f.fly.remove();f.veil.remove();
  }catch(e){document.querySelectorAll(".flybook,.zveil").forEach(x=>x.remove());CA.anim=false;show()}
}
async function closeAlbum(){
  const cat=state.filter;if(CA.anim)return;
  const show=()=>{state.filter="all";savePref("mc.filter","all");renderChips();renderSummary();renderGrid()};
  if(reduce||!document.body.animate||!CATS[cat]){show();return}
  CA.anim=true;
  try{
    const f=flyBook(cat),zoom=`translateX(${f.shift}px) scale(1.18)`;
    f.cover.animate([{transform:"rotateY(-172deg)"}],{fill:"forwards"});
    const fade=$("calbum").animate([{opacity:1},{opacity:0}],{duration:300,fill:"forwards"});
    f.veil.animate([{opacity:0},{opacity:1}],{duration:300,fill:"forwards"});
    await f.fly.animate([{transform:`translateX(${f.shift}px) scale(1.45)`,opacity:0},{transform:zoom,opacity:1}],{duration:360,easing:"ease-out",fill:"forwards"}).finished;
    // la tapa se cierra
    await Promise.all([
      f.cover.animate([{transform:"rotateY(-172deg)"},{transform:"rotateY(0deg)"}],{duration:800,easing:EASE,fill:"forwards"}).finished,
      f.fly.animate([{transform:zoom},{transform:"none"}],{duration:800,easing:EASE,fill:"forwards"}).finished]);
    // vuelve a su sitio en la estantería
    CA.anim=false;show();fade.cancel();
    const slot=document.querySelector(`.shelfbook[data-album="${cat}"]`);
    if(slot){slot.style.visibility="hidden";const r0=slot.getBoundingClientRect();if(r0.top<0||r0.bottom>innerHeight)window.scrollTo({top:r0.top+scrollY-innerHeight/3,behavior:"instant"})}
    const p=fromRect(slot&&slot.querySelector(".book").getBoundingClientRect(),f.W,f.H);
    await Promise.all([
      f.fly.animate([{transform:"none",opacity:1},{transform:`translate(${p.dx}px,${p.dy}px) scale(${p.s})`,opacity:slot?1:0}],{duration:600,easing:"cubic-bezier(.2,.7,.2,1)",fill:"forwards"}).finished,
      f.book.animate([{transform:"none"},{transform:SHELF_POSE}],{duration:600,easing:"cubic-bezier(.2,.7,.2,1)",fill:"forwards"}).finished,
      f.veil.animate([{opacity:1},{opacity:0}],{duration:600,fill:"forwards"}).finished]);
    if(slot)slot.style.visibility="";f.fly.remove();f.veil.remove();
  }catch(e){document.querySelectorAll(".flybook,.zveil").forEach(x=>x.remove());CA.anim=false;show()}
}

$("calbum").addEventListener("click",e=>{
  const a=e.target.closest("[data-album]");if(a){openAlbum(a.dataset.album,a);return}
  if(e.target.closest("[data-cclose]")){closeAlbum();return}
  const pg=e.target.closest("[data-cpg]");if(pg){cTurn(+pg.dataset.cpg);return}
  const g=e.target.closest("[data-cgoto]");if(g){const n=+g.dataset.cgoto,c=CA.pg[CA.cat]||0;if(n!==c){CA.pg[CA.cat]=n;CA.turnDir=n>c?1:-1;renderGrid()}return}
  const po=e.target.closest("[data-cpocket]");if(po&&!CA.swiped)cPull(po)});
$("calbum").addEventListener("pointerdown",e=>{if(!e.target.closest("#cbook"))return;CA.sw={x:e.clientX,y:e.clientY};CA.swiped=false});
$("calbum").addEventListener("pointerup",e=>{if(!CA.sw)return;const dx=e.clientX-CA.sw.x,dy=e.clientY-CA.sw.y;
  if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.3){CA.swiped=true;setTimeout(()=>CA.swiped=false,50);cTurn(dx<0?1:-1)}CA.sw=null});
document.addEventListener("keydown",e=>{if(state.tab!=="col"||!$("overlay").hidden||!$("cbook"))return;const t=e.target;
  if(t&&(t.tagName==="INPUT"||t.tagName==="SELECT"||t.closest(".tabs")))return;
  if(e.key==="ArrowRight"){e.preventDefault();cTurn(1)}else if(e.key==="ArrowLeft"){e.preventDefault();cTurn(-1)}});
$("cLay").addEventListener("click",e=>{const b=e.target.closest("[data-clay]");if(!b)return;state.lay=b.dataset.clay;savePref("mc.lay",state.lay);renderGrid()});
let cRz;window.addEventListener("resize",()=>{clearTimeout(cRz);cRz=setTimeout(()=>{const b=$("cbook");if(b&&(tpPer()===2)!==b.classList.contains("two"))renderGrid()},250)});

function renderAll(){renderChips();renderSummary();renderGrid();if(state.tab==="evo")renderEvo();if(state.tab==="wish")renderWish();if(state.tab==="topps")renderTopps();tpCount();if(state.sel){renderInfo(false)}if(state.tsel&&TP.cat){const a=document.activeElement;if(!(a&&$("info").contains(a)&&a.tagName==="INPUT"&&a.type!=="checkbox"))renderToppsDetail(false)}}
setTab(state.tab);

/* arranque (con sesión iniciada) */
const unsubs=[];
export function startApp(store,ph){
  stopApp();
  db=store;photos=ph;
  assets={upload:b=>photos.upload(b),delete:f=>photos.remove(f)};
  if(state.sel)renderStage();
  let prevPhoto={};
  const withPhotos=()=>photos.ensure(state.items.map(i=>i.photo)).then(ch=>{if(!ch)return;renderGrid();if(state.tab==="evo")renderEvo();if(state.sel)renderStage()});
  unsubs.push(db.collection("items").onSnapshot(s=>{state.items=s.docs.map(d=>({id:d.id,...d.data()}));renderAll();renderPull();ensurePullCosts();withPhotos();
    if(state.sel){const it=state.items.find(i=>i.id===state.sel);if(it&&prevPhoto[it.id]!==it.photo)withPhotos().then(()=>renderStage())}
    prevPhoto=Object.fromEntries(state.items.map(i=>[i.id,i.photo]))},
    ()=>{$("grid").innerHTML='<div class="empty" style="grid-column:1/-1">No se pudo conectar con tus datos. Recarga la página.</div>'}));
  unsubs.push(db.collection("media").onSnapshot(s=>{state.media=Object.fromEntries(s.docs.map(d=>[d.id,d.data()]));ensurePullCosts();renderGrid();if(state.tab==="evo")renderEvo();if(state.sel){renderStage();renderInfo(false)}}));
  unsubs.push(db.collection("wishlist").onSnapshot(s=>{state.wish=s.docs.map(d=>({id:d.id,...d.data()}));renderWish();$("cntWish").textContent=state.wish.length||""}));
  unsubs.push(db.doc("meta/summary").onSnapshot(s=>{state.meta=s.exists?s.data():null;renderSummary()}));
  unsubs.push(db.doc("meta/settings").onSnapshot(s=>{state.settings=s.exists?s.data():null;renderPull()}));
  unsubs.push(db.doc("meta/topps").onSnapshot(s=>{tpLoad(s.exists?s.data():null)}));
  unsubs.push(db.collection("topps").onSnapshot(s=>{TP.want=Object.fromEntries(s.docs.filter(d=>(d.data()||{}).want).map(d=>[d.id,true]));renderTopps();if(state.tsel&&TP.cat)renderToppsDetail(false)}));
}
export function stopApp(){
  while(unsubs.length)try{unsubs.pop()()}catch(e){}
  if(db&&db.close)db.close();
  db=null;photos=null;assets=null;
  state.items=[];state.media={};state.wish=[];state.meta=null;state.settings=null;TP.want={};TP.cat=null;TP.catId=null;
  if(!$("overlay").hidden)closeDetail();
  $("grid").innerHTML='<div class="empty" style="grid-column:1/-1">Cargando tu colección…</div>';
}
