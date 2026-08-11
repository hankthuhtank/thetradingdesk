/* ============================================================
   THE TRADING DESK · COCKPIT RUNTIME
   Loads last. It adds behaviour on top of the existing app rather
   than replacing it, so nothing already working gets touched.

   What it installs
     1  boot sequence, one orchestrated moment per session
     2  PREFLIGHT, the interactive learning path in the hero
     3  the horizon instrument
     4  the live board, where the chart is one panel of four
     5  an editable tape
     6  the cross-reference engine across every dataset
     7  motion: reveals, number flashes, cursor reticle

   Every number comes from a live feed. When a feed is down the
   panel says so in plain words. A plausible wrong number is worse
   than a blank one.
   ============================================================ */
(function(){
'use strict';

const API   = (typeof TDESK_API === 'string' && TDESK_API) || 'https://tdesk-data.safihelal.workers.dev';
const T     = window.TDESK || {};
const $     = (s,r)=> (r||document).querySelector(s);
const $$    = (s,r)=> [...(r||document).querySelectorAll(s)];
const SLOW  = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc   = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt   = (n,d=2)=> n==null||isNaN(n) ? '\u2014' : n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const pctf  = n => n==null||isNaN(n) ? '\u2014' : (n>=0?'+':'')+n.toFixed(2)+'%';
const dirC  = n => n==null ? 'flat' : n>0 ? 'up' : n<0 ? 'dn' : 'flat';

async function get(path){
  const r = await fetch(API.replace(/\/$/,'')+path);
  const d = await r.json().catch(()=>null);
  if(!r.ok || (d && d.error)) throw new Error((d&&d.message) || ('Feed returned '+r.status));
  return d;
}
function everyVisible(fn,ms){
  setInterval(()=>{ if(!document.hidden) fn(); }, ms);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) fn(); });
}
const panel = (label,sub,cls,body,fd)=>
  `<section class="ck-panel ${cls||''}">
     <div class="ck-head ${fd?'fd':''}"><span class="tick"></span><span class="lbl">${label}</span>
       <span class="sub">${sub||''}</span></div>
     ${body}
   </section>`;
const stateBox = (t,d)=> `<div class="ck-state"><div class="t">${esc(t)}</div><div class="d">${esc(d)}</div></div>`;

/* ============================================================
   1. BOOT SEQUENCE
   The one orchestrated moment. Everything else stays quiet.
   ============================================================ */
const BOOT_LINES = [
  'MOUNTING INSTRUMENT BUS',
  'LINKING MARKET FEED',
  'ARMING LEARNING PATH',
  'CROSS REFERENCING LIBRARY',
  'DESK READY'
];
function boot(){
  if(SLOW || sessionStorage.getItem('ck_booted')) return Promise.resolve();
  sessionStorage.setItem('ck_booted','1');
  const el = document.createElement('div');
  el.id = 'ckBoot';
  el.innerHTML = `<div class="bl">THE TRADING DESK</div>
    <div class="bbar"><i></i></div><div class="blog"></div>`;
  document.body.appendChild(el);
  const bar = $('i',el), log = $('.blog',el);
  return new Promise(res=>{
    let i = 0;
    const step = ()=>{
      if(i >= BOOT_LINES.length){
        el.classList.add('done');
        setTimeout(()=>{ el.remove(); res(); }, 520);
        return;
      }
      log.textContent = BOOT_LINES[i];
      bar.style.width = Math.round(((i+1)/BOOT_LINES.length)*100)+'%';
      i++; setTimeout(step, 190);
    };
    setTimeout(step, 120);
  });
}

/* ============================================================
   2. PREFLIGHT: the learning path, made interactive
   The site already carries an ordered eight-step curriculum in
   TDESK.SESSIONS. It was buried on a page nobody reaches first,
   so it moves into the hero and becomes the way in.
   ============================================================ */
const PRE_ROUTE = [
  ['encyclopedia','lvl1'], ['encyclopedia','lvl1'], ['sessions',''],
  ['patterns',''],         ['indicators',''],       ['strategies',''],
  ['riskdesk',''],         ['tools','']
];
const PRE_KEY = 'ck_preflight_v1';
let preDone = (()=>{ try{ return JSON.parse(localStorage.getItem(PRE_KEY))||[]; }catch(e){ return []; } })();

function preSave(){ localStorage.setItem(PRE_KEY, JSON.stringify(preDone)); drawProgress(); }

function buildPreflight(){
  const hero = $('#top .hero'); if(!hero) return;
  const S = T.SESSIONS || [];
  if(!S.length) return;

  const box = document.createElement('div');
  box.className = 'ck-pre reveal';
  box.innerHTML =
    `<div class="ck-pre-top"><span class="lbl">Preflight</span>
       <span class="cnt" id="ckPreCnt"></span>
       <button class="rst" id="ckPreRst">RESET</button></div>
     <div class="ck-pre-list" id="ckPreList"></div>
     <div class="ck-pre-foot">
       <span class="b" id="ckPreNext"></span>
       <button class="ck-resume" id="ckPreGo">START</button>
     </div>`;

  const cta = $('.cta-row', hero);
  if(cta) cta.after(box); else hero.appendChild(box);

  const list = $('#ckPreList');
  list.innerHTML = S.map((s,i)=>{
    const done = preDone.includes(i);
    return `<button class="ck-step ${done?'done':''}" data-i="${i}">
      <span class="lamp"></span>
      <span class="no">${String(i+1).padStart(2,'0')}</span>
      <span class="tx"><b>${esc(s[0])}</b><span>${esc(s[2]||'')}</span></span>
      <span class="go">${done?'CLEARED':'OPEN'}</span>
    </button>`;
  }).join('');

  /* rows arm in sequence, the way a checklist is actually run */
  $$('.ck-step', list).forEach((r,i)=>{
    if(SLOW){ r.classList.add('armed'); return; }
    setTimeout(()=>r.classList.add('armed'), 90*i + 260);
  });

  list.addEventListener('click', e=>{
    const b = e.target.closest('.ck-step'); if(!b) return;
    const i = +b.dataset.i;
    if(!preDone.includes(i)){ preDone.push(i); preSave(); }
    b.classList.add('done');
    $('.go',b).textContent = 'CLEARED';
    refreshPre();
    const [sec,q] = PRE_ROUTE[i] || ['encyclopedia',''];
    XR.goto(sec, q ? {filter:q} : {});
  });

  $('#ckPreRst').onclick = ()=>{
    preDone = []; preSave();
    $$('.ck-step',list).forEach(r=>{ r.classList.remove('done'); $('.go',r).textContent='OPEN'; });
    refreshPre();
  };
  $('#ckPreGo').onclick = ()=>{
    const nx = nextStep();
    const [sec,q] = PRE_ROUTE[nx] || ['encyclopedia',''];
    XR.goto(sec, q ? {filter:q} : {});
  };
  refreshPre();
}
function nextStep(){
  const S = T.SESSIONS || [];
  for(let i=0;i<S.length;i++) if(!preDone.includes(i)) return i;
  return 0;
}
function refreshPre(){
  const S = T.SESSIONS || [];
  const cnt = $('#ckPreCnt'); if(cnt) cnt.textContent = `${preDone.length} / ${S.length} CLEARED`;
  const nx = nextStep(), all = preDone.length >= S.length;
  const nlab = $('#ckPreNext'), ngo = $('#ckPreGo');
  if(nlab) nlab.textContent = all ? 'Path complete. Everything stays open for reference.'
                                  : `Next: ${S[nx] ? S[nx][0] : ''}`;
  if(ngo) ngo.textContent = all ? 'REVIEW' : (preDone.length ? 'RESUME' : 'START');
  drawProgress();
}
/* the syllabus ring in the nav */
function drawProgress(){
  const S = T.SESSIONS || []; if(!S.length) return;
  let host = $('#ckProg');
  if(!host){
    const nav = $('#nav .nav-in'); if(!nav) return;
    host = document.createElement('div');
    host.id = 'ckProg'; host.className = 'ck-prog';
    host.title = 'Your progress through the learning path';
    host.innerHTML = `<svg width="22" height="22" viewBox="0 0 22 22">
        <circle class="bgc" cx="11" cy="11" r="9"></circle>
        <circle class="fgc" cx="11" cy="11" r="9"></circle></svg><span></span>`;
    host.style.cursor = 'pointer';
    host.onclick = ()=>{ location.hash = ''; setTimeout(()=>{
      const p = $('.ck-pre'); if(p) p.scrollIntoView({behavior:SLOW?'auto':'smooth',block:'center'});
    },60); };
    const cmd = $('.nav-cmd', nav);
    if(cmd) cmd.before(host); else nav.appendChild(host);
  }
  const c = 2*Math.PI*9, done = preDone.length, pct = done/S.length;
  const fg = $('.fgc',host);
  fg.setAttribute('stroke-dasharray', c);
  fg.setAttribute('stroke-dashoffset', c*(1-pct));
  $('span',host).textContent = `${done}/${S.length}`;
}

/* ============================================================
   3. THE HORIZON
   Pitch is the index move, bank is how lopsided the sectors are
   underneath it. Both are read off live quotes, never eased into
   a shape that looks better than the tape.
   ============================================================ */
const IDX = [['SPY','S&P 500'],['QQQ','Nasdaq 100'],['IWM','Russell 2000'],
             ['DIA','Dow 30'],['^VIX','Volatility'],['^TNX','US 10Y']];
const SECT = [['XLK','TECH'],['XLF','FIN'],['XLY','DISC'],['XLC','COMM'],
              ['XLV','HLTH'],['XLI','INDU'],['XLP','STPL'],['XLE','ENGY'],
              ['XLU','UTIL'],['XLB','MATL'],['XLRE','RE'],['GLD','GOLD']];
let BOARD = {};

function adiSvg(){
  const marks = [.5,1,1.5,2].map(p=>{
    const y = 100 - p*18.6, w = (p===1||p===2) ? 30 : 17;
    return `<g stroke="rgba(230,238,240,.45)" stroke-width="1">
      <line x1="${100-w}" y1="${y}" x2="${100+w}" y2="${y}"/>
      <line x1="${100-w}" y1="${200-y}" x2="${100+w}" y2="${200-y}"/></g>
      <text x="${100+w+5}" y="${y+3}" fill="rgba(230,238,240,.4)" font-size="7" font-family="IBM Plex Mono">${p}%</text>
      <text x="${100+w+5}" y="${203-y}" fill="rgba(230,238,240,.4)" font-size="7" font-family="IBM Plex Mono">${p}%</text>`;
  }).join('');
  const bank = [-30,-20,-10,0,10,20,30].map(a=>{
    const r1 = a===0?86:80, rad=(a-90)*Math.PI/180;
    return `<line x1="${(100+Math.cos(rad)*r1).toFixed(1)}" y1="${(100+Math.sin(rad)*r1).toFixed(1)}"
      x2="${(100+Math.cos(rad)*72).toFixed(1)}" y2="${(100+Math.sin(rad)*72).toFixed(1)}"
      stroke="${a===0?'#8DA2A9':'rgba(150,180,190,.38)'}" stroke-width="${a===0?1.6:1}"/>`;
  }).join('');
  return `<svg viewBox="0 0 200 200" role="img" aria-label="Market attitude indicator">
    <defs><clipPath id="ckBall"><circle cx="100" cy="100" r="72"/></clipPath></defs>
    <circle cx="100" cy="100" r="86" fill="none" stroke="rgba(150,180,190,.13)"/>
    <g clip-path="url(#ckBall)"><g class="ball">
      <rect x="-90" y="-190" width="380" height="290" fill="rgba(49,224,141,.15)"/>
      <rect x="-90" y="100" width="380" height="290" fill="rgba(255,91,91,.15)"/>
      <line x1="-90" y1="100" x2="290" y2="100" stroke="#E6EEF0" stroke-width="1.4"/>
      ${marks}
    </g></g>
    <circle cx="100" cy="100" r="72" fill="none" stroke="rgba(150,180,190,.26)"/>
    ${bank}
    <g class="bank"><path d="M100 24 L94 34 L106 34 Z" fill="#FF4FA3"/></g>
    <g stroke="#FF4FA3" stroke-width="2.6" fill="none" stroke-linecap="square">
      <line x1="62" y1="100" x2="86" y2="100"/><line x1="114" y1="100" x2="138" y2="100"/></g>
    <rect x="97" y="97" width="6" height="6" fill="#FF4FA3"/></svg>`;
}
function adiBody(){
  return `<div class="ck-body flush"><div class="ck-adi">
    ${adiSvg()}
    <div class="ck-adi-read">
      <div><span class="k">Pitch \u00b7 SPY</span><span class="v" id="ckPitch">\u2014</span></div>
      <div><span class="k">Bank \u00b7 breadth</span><span class="v" id="ckBank">\u2014</span></div>
    </div>
    <p class="ck-adi-note">Pitch is the index move. Bank is how lopsided the sectors are underneath it.</p>
  </div></div>`;
}
function paintHorizon(){
  const spy = BOARD['SPY'];
  const dps = SECT.map(([s])=>BOARD[s]).filter(Boolean).map(q=>q.dp).filter(v=>v!=null);
  const ball = $('.ck-adi svg g.ball'), bankG = $('.ck-adi svg g.bank');
  if(!spy || spy.dp==null || !dps.length || !ball) return;

  const dp = spy.dp;
  const adv = dps.filter(v=>v>0).length, dec = dps.filter(v=>v<0).length;
  const skew = (adv-dec)/dps.length;
  /* 1% on the index reads as 12 degrees, so a normal session fills
     the instrument without a 0.2% drift looking like a dive */
  const pitch = Math.max(-34,Math.min(34, dp*12)) * 1.55;
  const bank  = Math.max(-30,Math.min(30, -skew*30));

  ball.setAttribute('transform', `rotate(${bank.toFixed(2)} 100 100) translate(0 ${pitch.toFixed(1)})`);
  bankG.setAttribute('transform', `rotate(${bank.toFixed(2)} 100 100)`);
  const p = $('#ckPitch'), b = $('#ckBank');
  if(p) p.innerHTML = `<span class="${dirC(dp)}">${pctf(dp)}</span>`;
  if(b) b.innerHTML = `<span class="${skew>0?'up':skew<0?'dn':'flat'}">${adv}\u2191 / ${dec}\u2193</span>`;
}

/* ============================================================
   4. THE LIVE BOARD
   Four panels of equal weight. The chart is a feature here, not
   the headline: market state, the wire and the macro calendar sit
   beside it, and the chart opens to full deck only on demand.
   ============================================================ */
const TF = {
  '1D':{range:'1d',interval:'5m'},   '5D':{range:'5d',interval:'30m'},
  '1M':{range:'1mo',interval:'1h'},  '3M':{range:'3mo',interval:'1d'},
  '6M':{range:'6mo',interval:'1d'},  'YTD':{range:'ytd',interval:'1d'},
  '1Y':{range:'1y',interval:'1d'},   '5Y':{range:'5y',interval:'1wk'}
};
let chart, sMain, sVol, sMa20, sMa50;
let C = { sym:'SPY', tf:'1M', type:'candles', vol:true, ma:false, full:false, bars:[], meta:null };

function buildBoard(){
  const host = $('#ckBoard'); if(!host) return;
  host.className = 'ck-board reveal';
  host.innerHTML =
    panel('Market state','live','sp2', adiBody(), true) +
    panel('The Wire','\u2014','sp2', `<div class="ck-body flush" id="ckWire">
        <div class="ck-skel"></div><div class="ck-skel"></div><div class="ck-skel"></div></div>`) +
    panel('Chart','feature','sp2',
      `<div class="ck-q">
         <span class="nm" id="ckQName">\u2014</span>
         <span class="last" id="ckQLast">\u2014</span>
         <span class="chg" id="ckQChg">\u2014</span>
         <span class="ohlc" id="ckQOhlc"></span>
       </div>
       <div class="ck-tf" id="ckTf">
         ${Object.keys(TF).map(k=>`<button data-tf="${k}" class="${k==='1M'?'on':''}">${k}</button>`).join('')}
         <span class="gap"></span>
         <button data-type="candles" class="on">CANDLE</button>
         <button data-type="line">LINE</button>
         <button data-tog="vol" class="on">VOL</button>
         <button data-tog="ma">MA</button>
         <button data-act="full">EXPAND</button>
       </div>
       <div class="ck-cv" id="ckCanvas"><div class="ck-msg on" id="ckMsg">
         <span class="t">LOADING</span><span class="d"></span></div></div>`, true) +
    panel('Macro calendar','\u2014','sp2', `<div class="ck-body flush" id="ckEcon">
        <div class="ck-skel"></div><div class="ck-skel"></div><div class="ck-skel"></div></div>`) +
    panel('Index','tap to chart','sp2', `<div class="ck-body flush" id="ckIdx"></div>`) +
    panel('Sectors','% day','sp2', `<div class="ck-body flush"><div class="ck-sect" id="ckSect"></div></div>`);

  $('#ckTf').addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    if(b.dataset.tf){
      $$('#ckTf [data-tf]').forEach(x=>x.classList.toggle('on',x===b));
      loadChart(C.sym, b.dataset.tf);
    } else if(b.dataset.type){
      $$('#ckTf [data-type]').forEach(x=>x.classList.toggle('on',x===b));
      C.type = b.dataset.type; paintChart();
    } else if(b.dataset.tog){
      C[b.dataset.tog] = !C[b.dataset.tog];
      b.classList.toggle('on', C[b.dataset.tog]); paintChart();
    } else if(b.dataset.act === 'full'){ toggleFull(true); }
  });
  $('#ckIdx').addEventListener('click', e=>{
    const r = e.target.closest('.ck-srow'); if(r) loadChart(r.dataset.sym);
  });
  $('#ckSect').addEventListener('click', e=>{
    const b = e.target.closest('button'); if(b) loadChart(b.dataset.sym);
  });
}

/* ---- fullscreen: the feature becomes the focus on demand ---- */
function toggleFull(on){
  let f = $('#ckFull');
  if(!f){
    f = document.createElement('div'); f.id='ckFull'; f.className='ck-full';
    f.innerHTML = `<section class="ck-panel" style="flex:1">
      <div class="ck-head fd"><span class="tick"></span><span class="lbl">Chart</span>
        <span class="sub"><button id="ckFullX">CLOSE \u2715</button></span></div>
      <div class="ck-cv" id="ckFullCv"></div></section>`;
    document.body.appendChild(f);
    $('#ckFullX').onclick = ()=>toggleFull(false);
  }
  C.full = on;
  f.classList.toggle('on', on);
  const target = on ? $('#ckFullCv') : $('#ckCanvas');
  if(chart){ try{ chart.remove(); }catch(e){} chart=sMain=sVol=sMa20=sMa50=null; }
  if(target){ target.innerHTML = on ? '' : `<div class="ck-msg" id="ckMsg"><span class="t"></span><span class="d"></span></div>`; }
  paintChart();
}
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && C.full) toggleFull(false); });

function chartHost(){ return C.full ? $('#ckFullCv') : $('#ckCanvas'); }
function chartMsg(on,t,d){
  const host = chartHost(); if(!host) return;
  let m = $('.ck-msg', host);
  if(!m){ m=document.createElement('div'); m.className='ck-msg';
    m.innerHTML='<span class="t"></span><span class="d"></span>'; host.appendChild(m); }
  m.classList.toggle('on', !!on);
  if(on){ $('.t',m).textContent=t||''; $('.d',m).textContent=d||''; }
}
function paintChart(){
  const LWC = window.LightweightCharts, host = chartHost();
  if(!LWC || !host){ chartMsg(true,'CHART LIBRARY MISSING','Lightweight Charts did not load from the CDN.'); return; }
  if(!C.bars.length) return;

  if(!chart){
    chart = LWC.createChart(host,{
      layout:{ background:{color:'#0B1215'}, textColor:'#8DA2A9',
               fontFamily:"'IBM Plex Mono', monospace", fontSize:10, attributionLogo:false },
      grid:{ vertLines:{color:'rgba(150,180,190,.05)'}, horzLines:{color:'rgba(150,180,190,.05)'} },
      rightPriceScale:{ borderColor:'rgba(150,180,190,.13)', scaleMargins:{top:.09,bottom:.26} },
      timeScale:{ borderColor:'rgba(150,180,190,.13)', rightOffset:3, timeVisible:true, secondsVisible:false },
      /* the crosshair is the thing being tracked, so it is the one
         element on the chart wearing flight-director magenta */
      crosshair:{ mode:LWC.CrosshairMode.Normal,
        vertLine:{color:'#FF4FA3',width:1,style:2,labelBackgroundColor:'#FF4FA3'},
        horzLine:{color:'#FF4FA3',width:1,style:2,labelBackgroundColor:'#FF4FA3'} },
      autoSize:true
    });
    chart.subscribeCrosshairMove(onCross);
  }
  [sMain,sVol,sMa20,sMa50].forEach(s=>{ if(s){ try{ chart.removeSeries(s); }catch(e){} } });
  sMain=sVol=sMa20=sMa50=null;

  const b = C.bars;
  if(C.type==='candles'){
    sMain = chart.addSeries(LWC.CandlestickSeries,{
      upColor:'#31E08D',downColor:'#FF5B5B',borderUpColor:'#31E08D',borderDownColor:'#FF5B5B',
      wickUpColor:'rgba(49,224,141,.7)',wickDownColor:'rgba(255,91,91,.7)',
      priceLineColor:'#FF4FA3',priceLineStyle:2});
    sMain.setData(b.map(x=>({time:x.t,open:x.o,high:x.h,low:x.l,close:x.c})));
  } else {
    const up = b[b.length-1].c >= b[0].c;
    sMain = chart.addSeries(LWC.AreaSeries,{
      lineColor:up?'#31E08D':'#FF5B5B',lineWidth:2,
      topColor:up?'rgba(49,224,141,.24)':'rgba(255,91,91,.24)',
      bottomColor:'rgba(11,18,21,0)',priceLineColor:'#FF4FA3',priceLineStyle:2});
    sMain.setData(b.map(x=>({time:x.t,value:x.c})));
  }
  if(C.vol && b.some(x=>x.v)){
    sVol = chart.addSeries(LWC.HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'vol'});
    sVol.setData(b.map(x=>({time:x.t,value:x.v,
      color:x.c>=x.o?'rgba(49,224,141,.3)':'rgba(255,91,91,.3)'})));
    chart.priceScale('vol').applyOptions({scaleMargins:{top:.84,bottom:0}});
  }
  if(C.ma){
    const ma=n=>{const o=[];let s=0;for(let i=0;i<b.length;i++){s+=b[i].c;if(i>=n)s-=b[i-n].c;
      if(i>=n-1)o.push({time:b[i].t,value:+(s/n).toFixed(4)});}return o;};
    if(b.length>20){ sMa20=chart.addSeries(LWC.LineSeries,{color:'#FFAE35',lineWidth:1,
      priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false}); sMa20.setData(ma(20)); }
    if(b.length>50){ sMa50=chart.addSeries(LWC.LineSeries,{color:'#8DA2A9',lineWidth:1,
      priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false}); sMa50.setData(ma(50)); }
  }
  chart.timeScale().fitContent();
}
function onCross(p){
  const box = $('#ckQOhlc'); if(!box) return;
  if(!p || !p.time || !sMain || !p.seriesData){ writeQuote(); return; }
  const d = p.seriesData.get(sMain); if(!d){ writeQuote(); return; }
  box.innerHTML = d.open!=null
    ? `<span>O <b>${fmt(d.open)}</b></span><span>H <b>${fmt(d.high)}</b></span><span>L <b>${fmt(d.low)}</b></span><span>C <b>${fmt(d.close)}</b></span>`
    : `<span>VAL <b>${fmt(d.value)}</b></span>`;
}
function writeQuote(){
  const m = C.meta; if(!m) return;
  const chg = (m.price!=null && m.prevClose) ? m.price-m.prevClose : null;
  const cp  = m.prevClose ? (chg/m.prevClose)*100 : null;
  const nm=$('#ckQName'), la=$('#ckQLast'), ch=$('#ckQChg'), oh=$('#ckQOhlc');
  if(nm) nm.innerHTML = `${esc(m.name)}<em>${esc(m.symbol)}</em>`;
  if(la) la.textContent = fmt(m.price, (m.price!=null && m.price<10)?4:2);
  if(ch){ ch.className='chg '+dirC(chg);
    ch.textContent = chg==null?'\u2014':`${chg>=0?'+':''}${fmt(chg)}  ${pctf(cp)}`; }
  if(oh) oh.innerHTML = `<span>PREV <b>${fmt(m.prevClose)}</b></span>` +
    (m.dayLow!=null?`<span>DAY <b>${fmt(m.dayLow)} to ${fmt(m.dayHigh)}</b></span>`:'') +
    (m.fiftyTwoLow!=null?`<span>52W <b>${fmt(m.fiftyTwoLow)} to ${fmt(m.fiftyTwoHigh)}</b></span>`:'');
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
    C.bars = d.bars; C.meta = d;
    chartMsg(false); paintChart(); writeQuote(); markIdx();
  }catch(e){
    if(my!==seq) return;
    chartMsg(true,'NO DATA', e.message + '. If this is the first run, the Worker still needs the v2 endpoint pack deployed.');
  }
}

/* ---- board data ---- */
async function loadBoardData(){
  const syms = [...IDX.map(x=>x[0]), ...SECT.map(x=>x[0])].join(',');
  try{
    const d = await get('/v1/yquote?symbols='+encodeURIComponent(syms));
    BOARD = d.quotes || {};
    paintIdx(); paintSect(); paintHorizon();
  }catch(e){
    const i=$('#ckIdx'); if(i) i.innerHTML = stateBox('FEED DOWN', e.message);
  }
}
function paintIdx(){
  const host = $('#ckIdx'); if(!host) return;
  host.innerHTML = IDX.map(([sy,nm])=>{
    const q = BOARD[sy]; if(!q) return '';
    const dec = Math.abs(q.c)<10?3:2;
    let slug='';
    if(q.h!=null && q.l!=null && q.h>q.l){
      const p = Math.max(0,Math.min(1,(q.c-q.l)/(q.h-q.l)))*100;
      slug = `<div class="ck-slug"><i style="left:calc(${p.toFixed(1)}% - 1px)"></i></div>`;
    }
    return `<div class="ck-srow" data-sym="${sy}" role="button" tabindex="0" title="${esc(nm)}">
      <span class="sy">${esc(sy.replace('^',''))}</span>
      <span class="px">${fmt(q.c,dec)}</span>
      <span class="ch ${dirC(q.dp)}">${pctf(q.dp)}</span>${slug}</div>`;
  }).join('');
  markIdx();
}
function markIdx(){ $$('#ckIdx .ck-srow').forEach(r=>r.classList.toggle('on', r.dataset.sym===C.sym)); }
function paintSect(){
  const host = $('#ckSect'); if(!host) return;
  host.innerHTML = SECT.map(([sy,nm])=>{
    const q = BOARD[sy]; if(!q) return '';
    const dp = q.dp||0;
    /* magnitude is capped at 2% so one violent name cannot flatten
       the rest of the grid into nothing */
    const h = Math.min(Math.abs(dp)/2,1)*100;
    return `<button data-sym="${sy}" title="${esc(nm)}">
      <span class="fill" style="height:${h}%;background:${dp>=0?'var(--green)':'var(--red)'}"></span>
      <span class="sy">${nm}</span><span class="ch ${dirC(dp)}">${pctf(dp)}</span></button>`;
  }).join('');
}

/* ---- the wire ---- */
const ago = ts => { if(!ts) return '';
  const m = Math.floor((Date.now()-ts)/60000);
  return m<1?'now':m<60?m+'m':m<1440?Math.floor(m/60)+'h':Math.floor(m/1440)+'d'; };
async function loadWire(){
  const host = $('#ckWire'); if(!host) return;
  try{
    const d = await get('/v1/news'); const it = d.items||[];
    host.innerHTML = it.map(n=>`<a class="ck-wi ${n.tag==='official'?'official':''}"
      href="${esc(n.url)}" target="_blank" rel="noopener">
      <div class="h">${esc(n.title)}</div>
      <div class="m"><span class="src">${esc(n.source)}</span><span>${ago(n.ts)}</span></div></a>`).join('');
    setSub(host, it.length+' live');
  }catch(e){ host.innerHTML = stateBox('WIRE DOWN', e.message); setSub(host,'offline'); }
}
/* ---- the macro calendar ---- */
const DAYF = new Intl.DateTimeFormat('en-US',{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'});
async function loadEcon(){
  const host = $('#ckEcon'); if(!host) return;
  try{
    const d = await get('/v1/econ?days=7'); const evs = d.events||[];
    const by = {}; evs.forEach(e=>(by[e.date]=by[e.date]||[]).push(e));
    const today = new Date().toISOString().slice(0,10);
    host.innerHTML = Object.keys(by).sort().map(day=>{
      const rows = by[day].sort((a,b)=>b.impact-a.impact || String(a.time).localeCompare(String(b.time)));
      return `<div class="ck-day ${day===today?'today':''}">${day===today?'TODAY \u00b7 ':''}${esc(DAYF.format(new Date(day+'T12:00:00Z')))}</div>`
        + rows.map(e=>{
          const f=[];
          if(e.actual)    f.push(`<span class="act">ACT <b>${esc(e.actual)}</b></span>`);
          if(e.consensus) f.push(`<span>EST <b>${esc(e.consensus)}</b></span>`);
          if(e.previous)  f.push(`<span>PRV <b>${esc(e.previous)}</b></span>`);
          return `<div class="ck-ev i${e.impact}"><span class="tm">${esc(e.time||'\u2014')}</span>
            <span class="nm">${esc(e.event)}</span>${f.length?`<span class="fig">${f.join('')}</span>`:''}</div>`;
        }).join('');
    }).join('');
    setSub(host, evs.length+' events');
  }catch(e){ host.innerHTML = stateBox('CALENDAR DOWN', e.message); setSub(host,'offline'); }
}
function setSub(bodyEl,txt){
  const p = bodyEl.closest('.ck-panel'); if(!p) return;
  const s = $('.ck-head .sub', p); if(s) s.textContent = txt;
}

/* ============================================================
   5. THE TAPE, made editable
   ============================================================ */
const TKEY='ck_tape_v1';
const TDEF=['SPY','QQQ','IWM','DIA','^VIX','AAPL','NVDA','MSFT','TSLA','AMZN','GOOGL','META','BTC-USD','ES=F','CL=F','GC=F'];
let tape = (()=>{ try{ return JSON.parse(localStorage.getItem(TKEY))||TDEF; }catch(e){ return TDEF; } })();

function installTape(){
  const strip = $('.tape'); if(!strip) return;
  const btn = document.createElement('button');
  btn.id='ckTapeBtn'; btn.textContent='EDIT TAPE';
  btn.setAttribute('aria-haspopup','dialog');
  strip.appendChild(btn);
  btn.onclick = openSheet;
  const trk = $('#tapeTrack');
  if(trk) trk.addEventListener('click', e=>{
    const i = e.target.closest('i'); if(i && i.dataset.sym) loadChart(i.dataset.sym);
  });
}
async function loadTape(){
  const trk = $('#tapeTrack'); if(!trk || !tape.length) return;
  try{
    const d = await get('/v1/yquote?symbols='+encodeURIComponent(tape.join(',')));
    const q = d.quotes||{};
    const cells = tape.map(s=>{
      const x=q[s]; if(!x) return '';
      const dec = Math.abs(x.c)<10?4:2, c=dirC(x.dp);
      return `<i data-sym="${esc(s)}" style="cursor:pointer"><b>${esc(s.replace('^',''))}</b>
        <span class="${c}">${fmt(x.c,dec)}</span>
        <span class="${c}" style="font-size:.62rem;opacity:.88">${(x.dp||0)>=0?'\u25b2':'\u25bc'}${Math.abs(x.dp||0).toFixed(2)}%</span></i>`;
    }).join('');
    trk.innerHTML = cells + cells;   /* doubled so the loop is seamless */
  }catch(e){ /* the existing tape loader keeps whatever it had */ }
}
function openSheet(){
  let sh = $('#ckSheet');
  if(!sh){
    sh = document.createElement('div'); sh.id='ckSheet'; sh.className='ck-sheet';
    sh.setAttribute('role','dialog'); sh.setAttribute('aria-modal','true');
    sh.innerHTML = `<section class="ck-panel">
      <div class="ck-head fd"><span class="tick"></span><span class="lbl">Edit the tape</span>
        <span class="sub"><button id="ckShX">CLOSE \u2715</button></span></div>
      <div class="ck-chips" id="ckChips"></div>
      <div class="ck-add"><input id="ckAdd" placeholder="Add a symbol" spellcheck="false" autocomplete="off">
        <button id="ckAddB">ADD</button></div>
      <p class="ck-adi-note" style="padding:0 13px 14px">Anything with a listing works: stocks, ETFs, indexes like ^VIX, futures like ES=F, crypto like BTC-USD.</p>
    </section>`;
    document.body.appendChild(sh);
    $('#ckShX').onclick = ()=>sh.classList.remove('on');
    sh.addEventListener('click', e=>{ if(e.target===sh) sh.classList.remove('on'); });
    $('#ckChips').addEventListener('click', e=>{
      const b=e.target.closest('button'); if(!b) return;
      tape.splice(+b.dataset.i,1); saveTape();
    });
    const add=()=>{ const v=$('#ckAdd').value.trim().toUpperCase();
      $('#ckAdd').value=''; if(!v||tape.includes(v)) return; tape.push(v); saveTape(); };
    $('#ckAddB').onclick = add;
    $('#ckAdd').addEventListener('keydown', e=>{ if(e.key==='Enter') add(); });
  }
  drawChips(); sh.classList.add('on'); $('#ckAdd').focus();
}
function drawChips(){
  const c = $('#ckChips'); if(!c) return;
  c.innerHTML = tape.map((s,i)=>`<span class="ck-chip">${esc(s)}
    <button data-i="${i}" aria-label="Remove ${esc(s)}">\u2715</button></span>`).join('')
    || '<p class="ck-adi-note">The tape is empty. Add a symbol below.</p>';
}
function saveTape(){ localStorage.setItem(TKEY, JSON.stringify(tape)); drawChips(); loadTape(); }

/* ============================================================
   6. CROSS REFERENCE ENGINE
   Everything on this site was already connected in substance and
   disconnected in navigation. This builds one index across every
   dataset, links terms inline wherever a detail view renders, and
   appends a SEE ALSO rail that crosses datasets rather than
   staying inside one.
   ============================================================ */
const XR = window.XR = {};
const KIND = {
  enc:        {sec:'encyclopedia', input:'#encSearch', label:'ENCYCLOPEDIA'},
  pattern:    {sec:'patterns',     input:'#pSearch',   label:'PATTERN'},
  indicator:  {sec:'indicators',   input:'#indSearch', label:'INDICATOR'},
  strategy:   {sec:'strategies',   input:'#sSearch',   label:'STRATEGY'},
  structure:  {sec:'options',      input:null,         label:'OPTION STRUCTURE'},
  tool:       {sec:'tools',        input:null,         label:'TOOL'}
};
let INDEX = [];

function buildIndex(){
  const push = (kind,name,extra)=>{
    if(!name) return;
    INDEX.push({kind, name:String(name), key:norm(name), tags:(extra||'').toLowerCase()});
  };
  (T.ENCYCLOPEDIA||[]).forEach(e=> push('enc', e.t, (e.cat||'')+' '+(e.tag||'')));
  (T.PATTERNS||[]).forEach(p=> push('pattern', p.n, p.cat));
  (T.INDICATORS||[]).forEach(i=> push('indicator', i.n||i.name, i.cat));
  (T.STRATEGIES||[]).forEach(s=> push('strategy', s.n, (s.fam||'')+' '+(s.alias||'')));
  (T.OPT_STRUCTURES||[]).forEach(o=> push('structure', o.n||o.name, o.cat));
  /* longest first, so "bull call spread" wins over "call" */
  INDEX.sort((a,b)=> b.key.length - a.key.length);
}
const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();

/* route to a section and pre-load its search box, which works
   against the existing app without knowing any of its internals */
XR.goto = function(sec, opt){
  opt = opt||{};
  if(typeof showPage === 'function'){ try{ showPage(sec); }catch(e){ location.hash = '#'+sec; } }
  else location.hash = '#'+sec;
  setTimeout(()=>{
    const cfg = Object.values(KIND).find(k=>k.sec===sec);
    if(opt.q && cfg && cfg.input){
      const inp = $(cfg.input);
      if(inp){ inp.value = opt.q; inp.dispatchEvent(new Event('input',{bubbles:true})); }
    }
    if(opt.filter){
      const btn = $$(`#${sec} .enc-filters button`).find(b=>
        (b.dataset.cat||b.dataset.f||b.dataset.fam) === opt.filter);
      if(btn) btn.click();
    }
    const sec$ = $('#'+sec);
    if(sec$) sec$.scrollIntoView({behavior:SLOW?'auto':'smooth', block:'start'});
  }, 90);
};
XR.open = function(kind, name){
  const cfg = KIND[kind]; if(!cfg) return;
  XR.goto(cfg.sec, {q:name});
};

/* find items across OTHER datasets that share meaningful words */
const STOP = new Set(['the','a','an','of','and','or','to','in','on','for','with','by','is','it',
  'this','that','at','as','from','your','you','be','are','how','what','when','not','no','one','two']);
function related(title, selfKind, limit){
  const words = norm(title).split(' ').filter(w=>w.length>3 && !STOP.has(w));
  if(!words.length) return [];
  const scored = [];
  INDEX.forEach(item=>{
    if(item.kind===selfKind && norm(item.name)===norm(title)) return;
    let sc = 0;
    words.forEach(w=>{
      if(item.key.includes(w)) sc += 3;
      else if(item.tags.includes(w)) sc += 1;
    });
    /* a cross-dataset hit is the point of the feature, so it wins
       ties against another entry in the same list */
    if(item.kind !== selfKind) sc *= 1.35;
    if(sc >= 3) scored.push({item, sc});
  });
  return scored.sort((a,b)=>b.sc-a.sc).slice(0, limit||6).map(x=>x.item);
}

/* linkify known terms inside a rendered detail body, once each */
function linkify(root, selfTitle){
  const used = new Set([norm(selfTitle)]);
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n){
      if(!n.nodeValue || n.nodeValue.length < 4) return NodeFilter.FILTER_REJECT;
      const p = n.parentElement;
      if(!p || p.closest('a,button,code,.xr,.xl,h1,h2,h3,input,textarea')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = []; let n; while((n = walk.nextNode())) nodes.push(n);
  const cands = INDEX.filter(i=>i.key.length>=5).slice(0,400);

  nodes.forEach(node=>{
    let html = null, text = node.nodeValue;
    for(const it of cands){
      if(used.has(it.key)) continue;
      const re = new RegExp('\\b(' + it.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')\\b','i');
      if(!re.test(text)) continue;
      used.add(it.key);
      text = text.replace(re, `\u0001${it.kind}\u0002$1\u0003`);
      html = true;
      if(used.size > 8) break;
    }
    if(!html) return;
    const span = document.createElement('span');
    span.innerHTML = esc(text)
      .replace(/\u0001([a-z]+)\u0002/g,'<a class="xl" data-xk="$1">')
      .replace(/\u0003/g,'</a>');
    node.parentNode.replaceChild(span, node);
  });

  $$('.xl', root).forEach(a=>{
    a.setAttribute('role','button'); a.tabIndex = 0;
    a.title = 'Open in the ' + (KIND[a.dataset.xk]||{}).label;
    const go = ()=> XR.open(a.dataset.xk, a.textContent);
    a.onclick = go;
    a.onkeydown = e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go(); } };
  });
}

function attachRail(root, title, selfKind){
  if($('.xr', root)) return;
  const rel = related(title, selfKind, 7);
  if(!rel.length) return;
  const rail = document.createElement('div');
  rail.className = 'xr';
  rail.innerHTML = `<div class="xr-h"><span class="tick"></span><span>See also</span></div>
    <div class="xr-grid">${rel.map(r=>
      `<button class="xr-b" data-xk="${r.kind}" data-xn="${esc(r.name)}">
        ${esc(r.name)}<i>${(KIND[r.kind]||{}).label||''}</i></button>`).join('')}</div>`;
  root.appendChild(rail);
  rail.addEventListener('click', e=>{
    const b = e.target.closest('.xr-b'); if(b) XR.open(b.dataset.xk, b.dataset.xn);
  });
}

/* Detail views are rendered by the existing app, so rather than
   reaching into its render functions this watches the modal bodies
   and enhances whatever appears. */
const MODALS = [['#encBody','enc'],['#pdBody','pattern'],['#sdBody','strategy']];
function watchModals(){
  MODALS.forEach(([sel,kind])=>{
    const el = $(sel); if(!el) return;
    new MutationObserver(()=>{
      if(!el.children.length || el.dataset.xrDone === el.firstElementChild.textContent.slice(0,40)) return;
      el.dataset.xrDone = el.firstElementChild.textContent.slice(0,40);
      const h = el.querySelector('h2,h3,.enc-t,.pd-t,.sd-t');
      const title = h ? h.textContent.trim() : '';
      if(!title) return;
      try{ linkify(el, title); attachRail(el, title, kind); }catch(e){}
    }).observe(el, {childList:true});
  });
}

/* ============================================================
   7. MOTION
   ============================================================ */
function observeReveals(){
  const io = new IntersectionObserver(es=>{
    es.forEach(e=>{
      if(!e.isIntersecting) return;
      e.target.classList.add('in');
      /* panels inside a revealed block power on in sequence */
      $$('.ck-panel', e.target).forEach((p,i)=>{
        setTimeout(()=>{ p.classList.add('power','lit');
          setTimeout(()=>p.classList.remove('power'), 520); }, SLOW?0:70*i);
      });
      io.unobserve(e.target);
    });
  },{rootMargin:'0px 0px -8% 0px', threshold:.08});
  $$('.reveal:not(.in)').forEach(el=>io.observe(el));
  return io;
}
/* a live number that changed flashes its direction, once */
function watchNumbers(){
  const prev = new WeakMap();
  setInterval(()=>{
    $$('.ck-srow .px, .ck-sect .ch, .ck-q .last').forEach(el=>{
      const v = el.textContent;
      const old = prev.get(el);
      if(old != null && old !== v){
        const up = parseFloat(v.replace(/[^\d.-]/g,'')) > parseFloat(String(old).replace(/[^\d.-]/g,''));
        el.classList.remove('ck-up','ck-dn');
        void el.offsetWidth;
        el.classList.add(up?'ck-up':'ck-dn');
      }
      prev.set(el, v);
    });
  }, 1200);
}
function reticle(){
  if(SLOW || matchMedia('(pointer:coarse)').matches) return;
  const r = document.createElement('div');
  r.id='ckReticle'; r.innerHTML='<i class="h"></i><i class="v"></i>';
  document.body.appendChild(r);
  const h=$('.h',r), v=$('.v',r);
  let raf;
  addEventListener('mousemove', e=>{
    if(raf) return;
    raf = requestAnimationFrame(()=>{
      h.style.top = e.clientY+'px'; v.style.left = e.clientX+'px';
      r.classList.add('on'); raf=null;
    });
  });
  addEventListener('mouseleave', ()=>r.classList.remove('on'));
}

/* ============================================================
   BOOT
   ============================================================ */
async function init(){
  buildIndex();
  buildPreflight();
  buildBoard();
  installTape();
  watchModals();
  reticle();
  watchNumbers();
  observeReveals();

  /* re-run reveals after the app swaps pages */
  addEventListener('hashchange', ()=> setTimeout(observeReveals, 60));

  loadChart('SPY','1M');
  loadBoardData(); loadWire(); loadEcon(); loadTape();

  everyVisible(loadBoardData, 30000);
  everyVisible(loadTape,      30000);
  everyVisible(loadWire,      180000);
  everyVisible(loadEcon,      900000);
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', ()=> boot().then(init));
} else {
  boot().then(init);
}
})();
