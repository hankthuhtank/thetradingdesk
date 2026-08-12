/* ============================================================
   THE TRADING DESK · DESK RUNTIME
   Loads last, after the inline app script. It adds to what is
   already there rather than replacing any of it: every existing
   function keeps its behaviour, and the two it wraps (openEnc,
   openPattern, openStrat) are called through, not rewritten.

   What it installs
     1  the live chart, any symbol, eight timeframes
     2  the economic calendar
     3  the Compass, relative strength across the market
     4  encyclopedia cross-referencing with a back trail
     5  a clickable tape
     6  scroll reveals and live-number flashes

   Every number comes from a live feed. When a feed is down the
   panel says so. A plausible wrong number is worse than a blank.
   ============================================================ */
(function(){
'use strict';

const API  = (typeof TDESK_API === 'string' && TDESK_API) || 'https://tdesk-data.safihelal.workers.dev';
const T    = window.TDESK || {};
const $    = (s,r)=>(r||document).querySelector(s);
const $$   = (s,r)=>[...(r||document).querySelectorAll(s)];
const SLOW = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc  = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt  = (n,d=2)=> n==null||isNaN(n) ? '\u2014' : n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const pctf = n => n==null||isNaN(n) ? '\u2014' : (n>=0?'+':'')+n.toFixed(2)+'%';
const dirC = n => n==null ? '' : n>0 ? 'up' : n<0 ? 'dn' : '';

async function get(path){
  const r = await fetch(API.replace(/\/$/,'')+path);
  const d = await r.json().catch(()=>null);
  if(!r.ok || (d && d.error)) throw new Error((d&&(d.message||d.error)) || ('Feed returned '+r.status));
  return d;
}
function everyVisible(fn,ms){
  setInterval(()=>{ if(!document.hidden) fn(); },ms);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) fn(); });
}
const stateBox = (t,d)=>`<div class="dk-state"><div class="t">${esc(t)}</div><div class="d">${esc(d)}</div></div>`;
const skel = n => '<div class="dk-skel"></div>'.repeat(n||3);

/* ============================================================
   1. THE CHART
   ============================================================ */
const TF = {
  '1D':{range:'1d',interval:'5m'},   '5D':{range:'5d',interval:'30m'},
  '1M':{range:'1mo',interval:'1h'},  '3M':{range:'3mo',interval:'1d'},
  '6M':{range:'6mo',interval:'1d'},  'YTD':{range:'ytd',interval:'1d'},
  '1Y':{range:'1y',interval:'1d'},   '5Y':{range:'5y',interval:'1wk'}
};
let chart, sMain, sVol, sMa20, sMa50;
const C = { sym:'SPY', tf:'3M', type:'area', vol:false, ma:false, bars:[], meta:null };

function chartMsg(on,t,d){
  const m = $('#dkMsg'); if(!m) return;
  m.classList.toggle('on', !!on);
  if(on){ $('.t',m).textContent = t||''; $('.d',m).textContent = d||''; }
}
function paintChart(){
  const LWC = window.LightweightCharts, host = $('#dkCanvas');
  if(!host) return;
  if(!LWC){ chartMsg(true,'CHART LIBRARY MISSING','Lightweight Charts did not load from the CDN.'); return; }
  if(!C.bars.length) return;

  if(!chart){
    chart = LWC.createChart(host,{
      layout:{ background:{color:'transparent'}, textColor:'#8a94a6',
               fontFamily:"'IBM Plex Mono', monospace", fontSize:10, attributionLogo:false },
      grid:{ vertLines:{color:'rgba(126,166,214,.05)'}, horzLines:{color:'rgba(126,166,214,.05)'} },
      rightPriceScale:{ borderColor:'rgba(126,166,214,.12)', scaleMargins:{top:.1,bottom:.24} },
      timeScale:{ borderColor:'rgba(126,166,214,.12)', rightOffset:3, timeVisible:true, secondsVisible:false },
      crosshair:{ mode:LWC.CrosshairMode.Normal,
        vertLine:{color:'#22d3ee',width:1,style:2,labelBackgroundColor:'#0e7490'},
        horzLine:{color:'#22d3ee',width:1,style:2,labelBackgroundColor:'#0e7490'} },
      autoSize:true
    });
    chart.subscribeCrosshairMove(onCross);
  }
  [sMain,sVol,sMa20,sMa50].forEach(s=>{ if(s){ try{ chart.removeSeries(s); }catch(e){} } });
  sMain=sVol=sMa20=sMa50=null;

  const b = C.bars;
  if(C.type==='candles'){
    sMain = chart.addSeries(LWC.CandlestickSeries,{
      upColor:'#34d399',downColor:'#f87171',borderUpColor:'#34d399',borderDownColor:'#f87171',
      wickUpColor:'rgba(52,211,153,.7)',wickDownColor:'rgba(248,113,113,.7)'});
    sMain.setData(b.map(x=>({time:x.t,open:x.o,high:x.h,low:x.l,close:x.c})));
  } else if(C.type==='line'){
    sMain = chart.addSeries(LWC.LineSeries,{color:'#22d3ee',lineWidth:2});
    sMain.setData(b.map(x=>({time:x.t,value:x.c})));
  } else {
    const up = b[b.length-1].c >= b[0].c;
    sMain = chart.addSeries(LWC.AreaSeries,{
      lineColor:up?'#34d399':'#f87171',lineWidth:2,
      topColor:up?'rgba(52,211,153,.28)':'rgba(248,113,113,.28)',
      bottomColor:'rgba(13,17,23,0)'});
    sMain.setData(b.map(x=>({time:x.t,value:x.c})));
  }
  if(C.vol && b.some(x=>x.v)){
    sVol = chart.addSeries(LWC.HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'vol'});
    sVol.setData(b.map(x=>({time:x.t,value:x.v,
      color:x.c>=x.o?'rgba(52,211,153,.3)':'rgba(248,113,113,.3)'})));
    chart.priceScale('vol').applyOptions({scaleMargins:{top:.84,bottom:0}});
  }
  if(C.ma){
    const ma=n=>{const o=[];let s=0;for(let i=0;i<b.length;i++){s+=b[i].c;if(i>=n)s-=b[i-n].c;
      if(i>=n-1)o.push({time:b[i].t,value:+(s/n).toFixed(4)});}return o;};
    if(b.length>20){ sMa20=chart.addSeries(LWC.LineSeries,{color:'#f5b942',lineWidth:1,
      priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false}); sMa20.setData(ma(20)); }
    if(b.length>50){ sMa50=chart.addSeries(LWC.LineSeries,{color:'#8a94a6',lineWidth:1,
      priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false}); sMa50.setData(ma(50)); }
  }
  chart.timeScale().fitContent();
}
function onCross(p){
  const box = $('#dkOhlc'); if(!box) return;
  if(!p || !p.time || !sMain || !p.seriesData){ writeQuote(); return; }
  const d = p.seriesData.get(sMain); if(!d){ writeQuote(); return; }
  box.innerHTML = d.open!=null
    ? `<span>O <b>${fmt(d.open)}</b></span><span>H <b>${fmt(d.high)}</b></span><span>L <b>${fmt(d.low)}</b></span><span>C <b>${fmt(d.close)}</b></span>`
    : `<span>PRICE <b>${fmt(d.value)}</b></span>`;
}
function writeQuote(){
  const m = C.meta; if(!m) return;
  const chg = (m.price!=null && m.prevClose) ? m.price-m.prevClose : null;
  const cp  = m.prevClose ? (chg/m.prevClose)*100 : null;
  const nm=$('#dkQName'), la=$('#dkQLast'), ch=$('#dkQChg'), oh=$('#dkOhlc');
  if(nm) nm.innerHTML = `${esc(m.name)}<em>${esc(m.symbol)}</em>`;
  if(la) la.textContent = fmt(m.price, (m.price!=null && m.price<10)?4:2);
  if(ch){ ch.className='chg '+dirC(chg);
    ch.textContent = chg==null?'\u2014':`${chg>=0?'+':''}${fmt(chg)}  ${pctf(cp)}`; }
  if(oh) oh.innerHTML = `<span>PREV <b>${fmt(m.prevClose)}</b></span>`
    + (m.dayLow!=null?`<span>DAY <b>${fmt(m.dayLow)} to ${fmt(m.dayHigh)}</b></span>`:'')
    + (m.fiftyTwoLow!=null?`<span>52W <b>${fmt(m.fiftyTwoLow)} to ${fmt(m.fiftyTwoHigh)}</b></span>`:'');
}
let seq = 0;
async function loadChart(sym, tf){
  const my = ++seq;
  C.sym = (sym||C.sym).toUpperCase();
  C.tf  = tf || C.tf;
  const cfg = TF[C.tf];
  chartMsg(true,'LOADING', `${C.sym} \u00b7 ${C.tf}`);
  try{
    const d = await get(`/v1/candles?symbol=${encodeURIComponent(C.sym)}&range=${cfg.range}&interval=${cfg.interval}`);
    if(my!==seq) return;
    C.bars=d.bars; C.meta=d;
    chartMsg(false); paintChart(); writeQuote();
  }catch(e){
    if(my!==seq) return;
    chartMsg(true,'NO DATA', e.message+'. If this is the first run, the Worker still needs the new endpoints deployed.');
  }
}
window.deskChart = loadChart;   /* so anything on the page can drive it */

/* ---- symbol search ---- */
function wireSymbol(){
  const inp = $('#dkSym'), box = $('#dkSug');
  if(!inp) return;
  let rows=[], at=-1, timer;
  const close = ()=>{ box.classList.remove('on'); box.innerHTML=''; rows=[]; at=-1; };
  const pick = i=>{ const r=rows[i]; if(!r) return; inp.value=''; inp.blur(); close(); loadChart(r.symbol); };
  inp.addEventListener('input',()=>{
    clearTimeout(timer);
    const q = inp.value.trim();
    if(!q){ close(); return; }
    timer = setTimeout(async()=>{
      try{
        const d = await get('/v1/ysearch?q='+encodeURIComponent(q));
        rows = d.results||[];
        if(!rows.length){ close(); return; }
        at = 0;
        box.innerHTML = rows.map((r,i)=>`<button data-i="${i}" class="${i?'':'hot'}">
          <span class="sy">${esc(r.symbol)}</span><span class="nm">${esc(r.name)}</span></button>`).join('');
        box.classList.add('on');
      }catch(e){ close(); }
    },220);
  });
  box.addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) pick(+b.dataset.i); });
  inp.addEventListener('keydown',e=>{
    if(e.key==='Enter'){ e.preventDefault();
      if(rows.length && at>=0) pick(at);
      else if(inp.value.trim()){ loadChart(inp.value.trim()); inp.value=''; close(); } }
    else if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); if(!rows.length) return;
      at = (at + (e.key==='ArrowDown'?1:-1) + rows.length) % rows.length;
      $$('button',box).forEach((x,i)=>x.classList.toggle('hot',i===at));
      const h=$('.hot',box); if(h) h.scrollIntoView({block:'nearest'}); }
    else if(e.key==='Escape'){ close(); inp.blur(); }
  });
  document.addEventListener('click',e=>{ if(!e.target.closest('.dk-sym')) close(); });
}

/* ============================================================
   2. THE ECONOMIC CALENDAR
   ============================================================ */
const DAYF = new Intl.DateTimeFormat('en-US',{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'});
async function loadEcon(){
  const host = $('#dkEcon'); if(!host) return;
  try{
    const d = await get('/v1/econ?days=7'), evs = d.events||[];
    const by = {}; evs.forEach(e=>(by[e.date]=by[e.date]||[]).push(e));
    const today = new Date().toISOString().slice(0,10);
    host.innerHTML = Object.keys(by).sort().map(day=>{
      const rows = by[day].sort((a,b)=>b.impact-a.impact || String(a.time).localeCompare(String(b.time)));
      return `<div class="dk-day ${day===today?'today':''}">${day===today?'Today \u00b7 ':''}${esc(DAYF.format(new Date(day+'T12:00:00Z')))}</div>`
        + rows.map(e=>{
          const f=[];
          if(e.actual)    f.push(`<span class="act">ACTUAL <b>${esc(e.actual)}</b></span>`);
          if(e.consensus) f.push(`<span>EST <b>${esc(e.consensus)}</b></span>`);
          if(e.previous)  f.push(`<span>PRIOR <b>${esc(e.previous)}</b></span>`);
          return `<div class="dk-ev i${e.impact}"><span class="tm">${esc(e.time||'\u2014')}</span>
            <span class="nm">${esc(e.event)}</span>${f.length?`<span class="fig">${f.join('')}</span>`:''}</div>`;
        }).join('');
    }).join('');
    setBar('#dkEcon', evs.length+' releases');
  }catch(e){
    host.innerHTML = stateBox('CALENDAR UNAVAILABLE', e.message);
    setBar('#dkEcon','offline');
  }
}
function setBar(sel,txt){
  const p = $(sel); if(!p) return;
  const pan = p.closest('.dk-panel'); if(!pan) return;
  const s = $('.dk-bar .s', pan); if(s) s.textContent = txt;
}

/* ============================================================
   3. THE COMPASS
   Relative strength against SPY across the eleven sector SPDRs
   and the majors, on four horizons at once. This is the single
   most useful thing a free feed can tell you that a price quote
   cannot: not what moved, but what is being bought harder than
   the index it belongs to.
   ============================================================ */
async function loadCompass(){
  const host = $('#dkCompass'); if(!host) return;
  try{
    const d = await get('/v1/strength');
    const rows = d.rows||[];
    if(!rows.length) throw new Error('Strength feed returned nothing.');
    const max = Math.max(1, ...rows.map(r=>Math.abs(r.score)));
    host.innerHTML =
      `<div class="dk-chead"><span>Symbol</span><span>Relative to SPY</span><span>Score</span><span>1M</span></div>`
      + rows.map((r,i)=>{
        const w = Math.min(Math.abs(r.score)/max,1)*50;
        const pos = r.score>=0;
        return `<div class="dk-crow" data-sym="${esc(r.symbol)}" role="button" tabindex="0">
          <span class="sy">${esc(r.symbol)}<small>${esc(r.name||'')}</small></span>
          <span class="dk-bar2"><i style="${pos?`left:50%;width:${w}%`:`left:${50-w}%;width:${w}%`};
            background:${pos?'var(--green)':'var(--red)'}"></i></span>
          <span class="rs ${dirC(r.score)}">${r.score>=0?'+':''}${r.score.toFixed(1)}</span>
          <span class="rk ${dirC(r.m1)}">${pctf(r.m1)}</span>
        </div>`;
      }).join('')
      + `<p class="dk-cnote">Score blends four horizons against SPY: one month and three months at 30% each, six and twelve at 20%. Positive means it outran the index over that blend, which is a statement about money flow, not a forecast. Click any row to chart it.</p>`;
    setBar('#dkCompass', rows.length+' tracked');
  }catch(e){
    host.innerHTML = stateBox('STRENGTH UNAVAILABLE', e.message);
    setBar('#dkCompass','offline');
  }
}

/* ============================================================
   4. CROSS REFERENCING
   The old behaviour dropped a term into the search box and left
   you to find it. Now a term inside an entry opens that entry
   directly, and the modal keeps a trail so you can walk back out
   the way you came in.

   This wraps the existing openEnc, openPattern and openStrat
   rather than replacing them, so their own logic (the reading
   path, the progress marks, the diagrams) is untouched.
   ============================================================ */
const ENC = T.ENCYCLOPEDIA || [];
const PAT = T.PATTERNS || [];
const IND = T.INDICATORS || [];
const STR = T.STRATEGIES || [];

const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const byTitle = {};
ENC.forEach((e,i)=>{ byTitle[norm(e.t)] = i; });

/* aliases: the text says "the greeks" where the entry is "Greeks",
   and says "IV" where the entry is "Implied Volatility". Without
   these the link rate is about a third of what it should be. */
const ALIAS = {
  'iv':'implied volatility','implied vol':'implied volatility',
  'dte':'days to expiration','0dte':'0dte','gex':'gamma exposure',
  'oi':'open interest','the greeks':'greeks','rr':'risk reward',
  'atr':'average true range','rsi':'relative strength index',
  'ema':'exponential moving average','sma':'simple moving average',
  'vix':'vix','pdt':'pattern day trader','em':'expected move'
};

/* the searchable term list, longest first so "bull call spread"
   wins over "call" */
const TERMS = ENC.map((e,i)=>({i, t:e.t, k:norm(e.t)}))
  .concat(Object.keys(ALIAS).map(a=>{
    const i = byTitle[norm(ALIAS[a])];
    return i==null ? null : {i, t:a, k:norm(a)};
  }).filter(Boolean))
  .filter(x=>x.k.length>=2)
  .sort((a,b)=>b.k.length-a.k.length);

let TRAIL = [];        /* the breadcrumb of entries opened in this walk */
let inXref = false;    /* true while a cross-reference click is routing */

/* Wrap a text container so known terms become links. Each term is
   linked at most once per entry: past that it is noise, not help. */
function linkTerms(root, selfTitle){
  const used = new Set([norm(selfTitle)]);
  const targets = $$('.enc-row .v, .pd-row .v', root);
  targets.forEach(cell=>{
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, {
      acceptNode(n){
        if(!n.nodeValue || n.nodeValue.trim().length<4) return NodeFilter.FILTER_REJECT;
        if(n.parentElement && n.parentElement.closest('button,a,.xr')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes=[]; let n; while((n=walker.nextNode())) nodes.push(n);
    nodes.forEach(node=>{
      let text = node.nodeValue, hit = false;
      for(const term of TERMS){
        if(used.has(term.k)) continue;
        const re = new RegExp('\\b('+term.t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')\\b','i');
        if(!re.test(text)) continue;
        used.add(term.k);
        text = text.replace(re, '\u0001'+term.i+'\u0002$1\u0003');
        hit = true;
        if(used.size>7) break;
      }
      if(!hit) return;
      const span = document.createElement('span');
      span.innerHTML = esc(text)
        .replace(/\u0001(\d+)\u0002/g,'<button type="button" class="xr" data-enc="$1">')
        .replace(/\u0003/g,'</button>');
      node.parentNode.replaceChild(span, node);
    });
  });
  $$('.xr', root).forEach(b=>{
    b.title = 'Open this entry';
    b.addEventListener('click', ev=>{
      ev.preventDefault(); ev.stopPropagation();
      jumpEnc(+b.dataset.enc, selfTitle);
    });
  });
}

/* push the current entry onto the trail, then open the new one */
function jumpEnc(i, fromTitle){
  if(fromTitle) TRAIL.push(fromTitle);
  inXref = true;
  window.openEnc(i);
  inXref = false;
}
function goBack(){
  const prev = TRAIL.pop();
  if(prev==null) return;
  const i = byTitle[norm(prev)];
  if(i==null) return;
  inXref = true;
  const keep = TRAIL.slice();
  window.openEnc(i);
  TRAIL = keep;
  renderTrail(prev);
  inXref = false;
}

/* the trail bar at the top of the entry */
function renderTrail(){
  const body = $('#encBody'); if(!body) return;
  const old = $('.xr-trail', body); if(old) old.remove();
  if(!TRAIL.length) return;
  const bar = document.createElement('div');
  bar.className = 'xr-trail';
  const from = TRAIL[TRAIL.length-1];
  const path = TRAIL.slice(-3).map(esc).join(' <b>\u203a</b> ');
  bar.innerHTML = `<button type="button" class="xr-back" id="xrBack">\u2190 Back to ${esc(from)}</button>
    <span class="xr-crumbs">${TRAIL.length>1?path:''}</span>`;
  body.insertBefore(bar, body.firstChild);
  $('#xrBack',bar).addEventListener('click', goBack);
}

/* SEE ALSO: entries and library items that share meaningful words,
   weighted so a hit in another library beats one more encyclopedia
   entry. Crossing libraries is the whole point. */
const STOP = new Set(['the','a','an','of','and','or','to','in','on','for','with','by','is','it','this',
  'that','at','as','from','your','you','be','are','how','what','when','not','no','one','two','its','than']);
function alsoFor(title, cat){
  const words = norm(title).split(' ').filter(w=>w.length>3 && !STOP.has(w));
  const out = [];
  const consider = (kind,name,tags,run)=>{
    if(norm(name)===norm(title)) return;
    let sc = 0;
    words.forEach(w=>{
      if(norm(name).includes(w)) sc += 3;
      else if(norm(tags||'').includes(w)) sc += 1;
    });
    if(kind!=='enc') sc *= 1.4;
    if(sc>=3) out.push({kind,name,sc,run});
  };
  ENC.forEach((e,i)=> consider('enc', e.t, (e.cat||'')+' '+(e.tag||''), ()=>jumpEnc(i,title)));
  PAT.forEach((p,i)=> consider('pattern', p.n, p.cat, ()=>{ closeAll(); window.openPattern(i); }));
  IND.forEach((x,i)=> consider('indicator', x.n||x.name, x.cat, ()=>{ closeAll(); goSection('indicators'); }));
  STR.forEach((s,i)=> consider('strategy', s.n, (s.fam||'')+' '+(s.alias||''), ()=>{ closeAll(); window.openStrat(i); }));
  /* same-category encyclopedia entries are a decent fallback when
     nothing shares a word, which happens with short titles */
  if(out.length<3 && cat){
    ENC.forEach((e,i)=>{
      if(e.cat===cat && norm(e.t)!==norm(title) && out.length<6)
        out.push({kind:'enc', name:e.t, sc:1, run:()=>jumpEnc(i,title)});
    });
  }
  const seen = new Set();
  return out.sort((a,b)=>b.sc-a.sc).filter(x=>{
    const k=x.kind+norm(x.name); if(seen.has(k)) return false; seen.add(k); return true;
  }).slice(0,6);
}
const KIND_LABEL = {enc:'Encyclopedia',pattern:'Pattern',indicator:'Indicator',strategy:'Strategy'};
function attachAlso(root, title, cat){
  if($('.xr-also', root)) return;
  const rel = alsoFor(title, cat);
  if(!rel.length) return;
  const box = document.createElement('div');
  box.className = 'xr-also';
  box.innerHTML = `<div class="h">See also</div><div class="g"></div>`;
  const g = $('.g',box);
  rel.forEach(r=>{
    const b = document.createElement('button');
    b.type='button';
    b.innerHTML = `${esc(r.name)}<i>${KIND_LABEL[r.kind]}</i>`;
    b.addEventListener('click', r.run);
    g.appendChild(b);
  });
  root.appendChild(box);
}
function closeAll(){ $$('.modal.open').forEach(m=>{ try{ window.closeModal(m.id); }catch(e){} }); }
function goSection(id){
  if(typeof window.showPage==='function'){ try{ window.showPage(id); return; }catch(e){} }
  location.hash = '#'+id;
}

/* ---- the wrappers ---- */
function installXref(){
  const _enc = window.openEnc;
  if(typeof _enc === 'function'){
    window.openEnc = function(i){
      if(!inXref) TRAIL = [];           /* a fresh click from the grid starts a new walk */
      _enc.apply(this, arguments);
      const e = ENC[i]; if(!e) return;
      const body = $('#encBody'); if(!body) return;
      try{ renderTrail(); linkTerms(body, e.t); attachAlso(body, e.t, e.cat); }catch(err){}
    };
  }
  const _pat = window.openPattern;
  if(typeof _pat === 'function'){
    window.openPattern = function(i){
      _pat.apply(this, arguments);
      const p = PAT[i]; if(!p) return;
      const body = $('#pdBody'); if(!body) return;
      try{ linkTerms(body, p.n); attachAlso(body, p.n, null); }catch(err){}
    };
  }
  const _str = window.openStrat;
  if(typeof _str === 'function'){
    window.openStrat = function(i){
      _str.apply(this, arguments);
      const s = STR[i]; if(!s) return;
      const body = $('#sdBody'); if(!body) return;
      try{ attachAlso(body, s.n, null); }catch(err){}
    };
  }
  /* Escape walks back one step before it closes the modal, which is
     what the trail implies should happen */
  document.addEventListener('keydown', e=>{
    if(e.key!=='Escape') return;
    const m = $('#m-enc');
    if(m && m.classList.contains('open') && TRAIL.length){ e.stopPropagation(); goBack(); }
  }, true);
}

/* ============================================================
   5. THE TAPE, clickable
   ============================================================ */
function wireTape(){
  const trk = $('#tapeTrack'); if(!trk) return;
  const tag = ()=> $$('#tapeTrack i').forEach(i=>{
    const b = $('b',i); if(b && !i.dataset.sym) i.dataset.sym = b.textContent.trim();
  });
  tag();
  new MutationObserver(tag).observe(trk,{childList:true});
  trk.addEventListener('click', e=>{
    const i = e.target.closest('i'); if(!i || !i.dataset.sym) return;
    loadChart(i.dataset.sym);
    const p = $('#dkChartPanel');
    if(p) p.scrollIntoView({behavior:SLOW?'auto':'smooth',block:'center'});
  });
}

/* ============================================================
   6. MOTION
   ============================================================ */
function reveals(){
  const io = new IntersectionObserver(es=>{
    es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  },{rootMargin:'0px 0px -6% 0px',threshold:.06});
  $$('.reveal:not(.in)').forEach(el=>io.observe(el));
}
function watchNumbers(){
  const prev = new WeakMap();
  setInterval(()=>{
    $$('.dk-crow .rs, .dk-cq .last, .idx-row .v, .heatmap b').forEach(el=>{
      const v = el.textContent, old = prev.get(el);
      if(old!=null && old!==v){
        const up = parseFloat(String(v).replace(/[^\d.-]/g,'')) > parseFloat(String(old).replace(/[^\d.-]/g,''));
        el.classList.remove('dk-up','dk-dn'); void el.offsetWidth;
        el.classList.add(up?'dk-up':'dk-dn');
      }
      prev.set(el,v);
    });
  },1500);
}

/* ============================================================
   BOOT
   ============================================================ */
function init(){
  installXref();
  wireSymbol();
  wireTape();
  reveals();
  if(!SLOW) watchNumbers();

  $$('#dkTf button').forEach(b=>{
    b.addEventListener('click',()=>{
      if(b.dataset.tf){ $$('#dkTf [data-tf]').forEach(x=>x.classList.toggle('on',x===b)); loadChart(C.sym,b.dataset.tf); }
      else if(b.dataset.type){ $$('#dkTf [data-type]').forEach(x=>x.classList.toggle('on',x===b));
        C.type=b.dataset.type; paintChart(); }
      else if(b.dataset.tog){ C[b.dataset.tog]=!C[b.dataset.tog];
        b.classList.toggle('on',C[b.dataset.tog]); paintChart(); }
    });
  });
  const cmp = $('#dkCompass');
  if(cmp) cmp.addEventListener('click', e=>{
    const r = e.target.closest('.dk-crow'); if(!r) return;
    loadChart(r.dataset.sym);
    const p = $('#dkChartPanel');
    if(p) p.scrollIntoView({behavior:SLOW?'auto':'smooth',block:'center'});
  });

  loadChart('SPY','3M');
  loadEcon();
  loadCompass();
  everyVisible(loadEcon, 900000);
  everyVisible(loadCompass, 900000);
  everyVisible(()=>loadChart(), 120000);
  addEventListener('hashchange', ()=>setTimeout(reveals,60));
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
