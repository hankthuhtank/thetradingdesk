/* ============================================================
   THE TRADING DESK · DESK RUNTIME
   Loads last, after the inline app script. Everything here adds
   to what already exists; the modals it touches are wrapped and
   called through, never rewritten.

     1  the Compass, a rotation map rather than a list
     2  the Stage, where chart and calendar trade places
     3  the Snapshot, fundamentals in miniature
     4  encyclopedia cross-referencing with a back trail
     5  option entry playbooks
     6  strategy section hierarchy, dealer flow pulled out
     7  motion

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
const fmt  = (n,d=2)=> n==null||isNaN(n) ? '\u2014' : Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const pctf = n => n==null||isNaN(n) ? '\u2014' : (n>=0?'+':'')+Number(n).toFixed(2)+'%';
const dirC = n => n==null ? '' : n>0 ? 'up' : n<0 ? 'dn' : '';
const big  = n => {
  if(n==null||isNaN(n)) return '\u2014';
  const a=Math.abs(n);
  if(a>=1e12) return (n/1e12).toFixed(2)+'T';
  if(a>=1e9)  return (n/1e9).toFixed(2)+'B';
  if(a>=1e6)  return (n/1e6).toFixed(2)+'M';
  if(a>=1e3)  return (n/1e3).toFixed(1)+'K';
  return fmt(n);
};
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
const stateBox=(t,d)=>`<div class="dk-state"><div class="t">${esc(t)}</div><div class="d">${esc(d)}</div></div>`;
function setBar(sel,txt){
  const p=$(sel); if(!p) return;
  const pan=p.closest('.dk-panel'); if(!pan) return;
  const s=$('.dk-bar .s',pan); if(s) s.textContent=txt;
}

/* ============================================================
   1. THE COMPASS
   A ranked list told you the order and nothing else. What
   actually matters is direction of travel: something can be
   strong and fading, or weak and turning. So this is a map.

     x  established strength, the six and twelve month legs
     y  momentum, the one and three month legs

   Four quadrants fall out of that, and they are the read:
     LEADING    strong and still gaining
     WEAKENING  strong but losing its grip
     LAGGING    weak and still sinking
     IMPROVING  weak but turning up

   In a normal cycle money travels clockwise through those, which
   is why the improving corner is where positions get built and
   the weakening corner is where they get trimmed.
   ============================================================ */
let CMP=[];
const QC={lead:'#34d399',weak:'#f5b942',lag:'#f87171',improve:'#22d3ee'};
const QN={lead:'Leading',weak:'Weakening',lag:'Lagging',improve:'Improving'};
const QT={
  lead:'Strong and still gaining. Where trends are already paying.',
  weak:'Still strong on the long horizons, but momentum has rolled over. Where trims happen.',
  lag:'Weak and still sinking. Looks cheap, usually early.',
  improve:'Weak on the long view, but turning up. Where positions get built.'
};
async function loadCompass(){
  const host=$('#dkCompass'); if(!host) return;
  try{
    const d=await get('/v1/strength');
    CMP=d.rows||[];
    if(!CMP.length) throw new Error('Strength feed returned nothing.');
    drawCompass();
    setBar('#dkCompass',CMP.length+' tracked');
  }catch(e){
    host.innerHTML=stateBox('STRENGTH UNAVAILABLE',e.message);
    setBar('#dkCompass','offline');
  }
}
function drawCompass(){
  const host=$('#dkCompass'); if(!host||!CMP.length) return;
  const pts=CMP.map(r=>({sym:r.symbol,name:r.name,x:(r.m6*.5+r.m12*.5),y:(r.m1*.5+r.m3*.5)}));
  /* scale to the data, so a quiet quarter still fills the plot
     instead of collapsing every marker onto the origin */
  const mx=Math.max(4,...pts.map(p=>Math.abs(p.x)))*1.18;
  const my=Math.max(4,...pts.map(p=>Math.abs(p.y)))*1.18;
  const W=380,H=310,P=28;
  const sx=v=>P+((v+mx)/(2*mx))*(W-P*2);
  const sy=v=>H-P-((v+my)/(2*my))*(H-P*2);
  const quad=p=>p.x>=0?(p.y>=0?'lead':'weak'):(p.y>=0?'improve':'lag');

  const dots=pts.map((p,i)=>{
    const q=quad(p),cx=sx(p.x),cy=sy(p.y);
    return `<g class="cmp-pt" data-i="${i}" data-sym="${esc(p.sym)}" tabindex="0" role="button"
        aria-label="${esc(p.sym)}, ${esc(p.name)}, ${QN[q]}" style="--qc:${QC[q]};--d:${(i*45)}ms">
      <circle class="halo" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="14"/>
      <circle class="core" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5.5"/>
      <text x="${cx.toFixed(1)}" y="${(cy-11).toFixed(1)}" text-anchor="middle">${esc(p.sym)}</text>
    </g>`;
  }).join('');

  host.innerHTML=`<div class="cmp-wrap">
    <svg class="cmp-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sector rotation map">
      <rect x="${W/2}" y="${P}" width="${W/2-P}" height="${H/2-P}" fill="#34d399" opacity=".05"/>
      <rect x="${W/2}" y="${H/2}" width="${W/2-P}" height="${H/2-P}" fill="#f5b942" opacity=".05"/>
      <rect x="${P}" y="${H/2}" width="${W/2-P}" height="${H/2-P}" fill="#f87171" opacity=".05"/>
      <rect x="${P}" y="${P}" width="${W/2-P}" height="${H/2-P}" fill="#22d3ee" opacity=".05"/>
      <line x1="${P}" y1="${H/2}" x2="${W-P}" y2="${H/2}" stroke="rgba(126,166,214,.3)"/>
      <line x1="${W/2}" y1="${P}" x2="${W/2}" y2="${H-P}" stroke="rgba(126,166,214,.3)"/>
      <text class="cmp-q" x="${W-P-4}" y="${P+12}" text-anchor="end" fill="#34d399">LEADING</text>
      <text class="cmp-q" x="${W-P-4}" y="${H-P-4}" text-anchor="end" fill="#f5b942">WEAKENING</text>
      <text class="cmp-q" x="${P+4}" y="${H-P-4}" fill="#f87171">LAGGING</text>
      <text class="cmp-q" x="${P+4}" y="${P+12}" fill="#22d3ee">IMPROVING</text>
      <text class="cmp-ax" x="${W-P}" y="${H/2+14}" text-anchor="end">STRENGTH \u2192</text>
      <text class="cmp-ax" x="${W/2+7}" y="${P-4}">\u2191 MOMENTUM</text>
      <g class="cmp-pts">${dots}</g>
    </svg>
    <div class="cmp-side">
      <div class="cmp-read" id="cmpRead">
        <span class="k">The map</span>
        <span class="v">Sector rotation</span>
        <p>Right of the vertical line is outrunning SPY over six and twelve months. Above the horizontal is outrunning it over one and three. Money tends to travel clockwise. Hover any marker, click to chart it.</p>
      </div>
      <div class="cmp-rank">${CMP.slice(0,5).map((r,i)=>
        `<button class="cmp-r" data-sym="${esc(r.symbol)}" data-i="${i}">
          <span class="n">${String(i+1).padStart(2,'0')}</span>
          <span class="s">${esc(r.symbol)}</span>
          <span class="v ${dirC(r.score)}">${r.score>=0?'+':''}${r.score.toFixed(1)}</span></button>`).join('')}
      </div>
    </div>
  </div>`;

  const read=$('#cmpRead');
  const show=i=>{
    const p=pts[i],q=quad(p),r=CMP[i];
    read.innerHTML=`<span class="k" style="color:${QC[q]}">${QN[q]}</span>
      <span class="v">${esc(p.sym)} <em>${esc(p.name)}</em></span>
      <p>${QT[q]}</p>
      <div class="cmp-legs">
        <span>1M <b class="${dirC(r.m1)}">${pctf(r.m1)}</b></span>
        <span>3M <b class="${dirC(r.m3)}">${pctf(r.m3)}</b></span>
        <span>6M <b class="${dirC(r.m6)}">${pctf(r.m6)}</b></span>
        <span>12M <b class="${dirC(r.m12)}">${pctf(r.m12)}</b></span>
      </div>
      <small>All figures relative to SPY over the same window.</small>`;
  };
  $$('.cmp-pt',host).forEach(g=>{
    const i=+g.dataset.i;
    g.addEventListener('mouseenter',()=>show(i));
    g.addEventListener('focus',()=>show(i));
    g.addEventListener('click',()=>toChart(g.dataset.sym));
    g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toChart(g.dataset.sym);}});
  });
  $$('.cmp-r',host).forEach(b=>{
    b.addEventListener('mouseenter',()=>show(+b.dataset.i));
    b.addEventListener('click',()=>toChart(b.dataset.sym));
  });
}
function toChart(sym){
  loadChart(sym);
  swapTo('chart');
  const s=$('#dkStage'); if(s) s.scrollIntoView({behavior:SLOW?'auto':'smooth',block:'center'});
}

/* ============================================================
   2. THE STAGE
   Chart, calendar and snapshot share one area. Whichever is
   selected takes the large panel; the other two sit beside it
   as headers you can click to promote. That is how the chart
   gets to be big without permanently owning the section.
   ============================================================ */
let STAGE='chart';
function swapTo(k){
  if(STAGE===k) return;
  STAGE=k;
  $$('#dkStage [data-stage]').forEach(el=>{
    const on=el.dataset.stage===k;
    el.classList.toggle('is-big',on);
    el.classList.toggle('is-pill',!on);
    el.setAttribute('aria-expanded',on?'true':'false');
  });
  if(k==='chart'&&chart) setTimeout(()=>{try{chart.timeScale().fitContent();}catch(e){}},280);
}
function wireStage(){
  $$('#dkStage [data-stage]').forEach(el=>{
    el.classList.add(el.dataset.stage===STAGE?'is-big':'is-pill');
    const bar=$('.dk-bar',el);
    if(bar) bar.addEventListener('click',e=>{
      if(e.target.closest('input,.dk-sym,#dkTf')) return;
      swapTo(el.dataset.stage);
    });
  });
}

/* ============================================================
   3. THE CHART
   ============================================================ */
const TF={'1D':{range:'1d',interval:'5m'},'5D':{range:'5d',interval:'30m'},
  '1M':{range:'1mo',interval:'1h'},'3M':{range:'3mo',interval:'1d'},
  '6M':{range:'6mo',interval:'1d'},'YTD':{range:'ytd',interval:'1d'},
  '1Y':{range:'1y',interval:'1d'},'5Y':{range:'5y',interval:'1wk'}};
let chart,sMain,sVol,sMa20,sMa50;
const C={sym:'SPY',tf:'3M',type:'area',vol:false,ma:false,bars:[],meta:null};

function chartMsg(on,t,d){
  const m=$('#dkMsg'); if(!m) return;
  m.classList.toggle('on',!!on);
  if(on){$('.t',m).textContent=t||'';$('.d',m).textContent=d||'';}
}
function paintChart(){
  const LWC=window.LightweightCharts,host=$('#dkCanvas');
  if(!host) return;
  if(!LWC){chartMsg(true,'CHART LIBRARY MISSING','Lightweight Charts did not load from the CDN.');return;}
  if(!C.bars.length) return;
  if(!chart){
    chart=LWC.createChart(host,{
      layout:{background:{color:'transparent'},textColor:'#8a94a6',
        fontFamily:"'IBM Plex Mono', monospace",fontSize:10,attributionLogo:false},
      grid:{vertLines:{color:'rgba(126,166,214,.05)'},horzLines:{color:'rgba(126,166,214,.05)'}},
      rightPriceScale:{borderColor:'rgba(126,166,214,.12)',scaleMargins:{top:.1,bottom:.24}},
      timeScale:{borderColor:'rgba(126,166,214,.12)',rightOffset:3,timeVisible:true,secondsVisible:false},
      crosshair:{mode:LWC.CrosshairMode.Normal,
        vertLine:{color:'#22d3ee',width:1,style:2,labelBackgroundColor:'#0e7490'},
        horzLine:{color:'#22d3ee',width:1,style:2,labelBackgroundColor:'#0e7490'}},
      autoSize:true});
    chart.subscribeCrosshairMove(onCross);
  }
  [sMain,sVol,sMa20,sMa50].forEach(s=>{if(s){try{chart.removeSeries(s);}catch(e){}}});
  sMain=sVol=sMa20=sMa50=null;
  const b=C.bars;
  if(C.type==='candles'){
    sMain=chart.addSeries(LWC.CandlestickSeries,{upColor:'#34d399',downColor:'#f87171',
      borderUpColor:'#34d399',borderDownColor:'#f87171',
      wickUpColor:'rgba(52,211,153,.7)',wickDownColor:'rgba(248,113,113,.7)'});
    sMain.setData(b.map(x=>({time:x.t,open:x.o,high:x.h,low:x.l,close:x.c})));
  } else if(C.type==='line'){
    sMain=chart.addSeries(LWC.LineSeries,{color:'#22d3ee',lineWidth:2});
    sMain.setData(b.map(x=>({time:x.t,value:x.c})));
  } else {
    const up=b[b.length-1].c>=b[0].c;
    sMain=chart.addSeries(LWC.AreaSeries,{lineColor:up?'#34d399':'#f87171',lineWidth:2,
      topColor:up?'rgba(52,211,153,.28)':'rgba(248,113,113,.28)',bottomColor:'rgba(13,17,23,0)'});
    sMain.setData(b.map(x=>({time:x.t,value:x.c})));
  }
  if(C.vol&&b.some(x=>x.v)){
    sVol=chart.addSeries(LWC.HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'vol'});
    sVol.setData(b.map(x=>({time:x.t,value:x.v,color:x.c>=x.o?'rgba(52,211,153,.3)':'rgba(248,113,113,.3)'})));
    chart.priceScale('vol').applyOptions({scaleMargins:{top:.84,bottom:0}});
  }
  if(C.ma){
    const ma=n=>{const o=[];let s=0;for(let i=0;i<b.length;i++){s+=b[i].c;if(i>=n)s-=b[i-n].c;
      if(i>=n-1)o.push({time:b[i].t,value:+(s/n).toFixed(4)});}return o;};
    if(b.length>20){sMa20=chart.addSeries(LWC.LineSeries,{color:'#f5b942',lineWidth:1,
      priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});sMa20.setData(ma(20));}
    if(b.length>50){sMa50=chart.addSeries(LWC.LineSeries,{color:'#8a94a6',lineWidth:1,
      priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});sMa50.setData(ma(50));}
  }
  chart.timeScale().fitContent();
}
function onCross(p){
  const box=$('#dkOhlc'); if(!box) return;
  if(!p||!p.time||!sMain||!p.seriesData){writeQuote();return;}
  const d=p.seriesData.get(sMain); if(!d){writeQuote();return;}
  box.innerHTML=d.open!=null
    ? `<span>O <b>${fmt(d.open)}</b></span><span>H <b>${fmt(d.high)}</b></span><span>L <b>${fmt(d.low)}</b></span><span>C <b>${fmt(d.close)}</b></span>`
    : `<span>PRICE <b>${fmt(d.value)}</b></span>`;
}
function writeQuote(){
  const m=C.meta; if(!m) return;
  const chg=(m.price!=null&&m.prevClose)?m.price-m.prevClose:null;
  const cp=m.prevClose?(chg/m.prevClose)*100:null;
  const nm=$('#dkQName'),la=$('#dkQLast'),ch=$('#dkQChg'),oh=$('#dkOhlc');
  if(nm) nm.innerHTML=`${esc(m.name)}<em>${esc(m.symbol)}</em>`;
  if(la) la.textContent=fmt(m.price,(m.price!=null&&m.price<10)?4:2);
  if(ch){ch.className='chg '+dirC(chg);
    ch.textContent=chg==null?'\u2014':`${chg>=0?'+':''}${fmt(chg)}  ${pctf(cp)}`;}
  if(oh) oh.innerHTML=`<span>PREV <b>${fmt(m.prevClose)}</b></span>`
    +(m.dayLow!=null?`<span>DAY <b>${fmt(m.dayLow)} to ${fmt(m.dayHigh)}</b></span>`:'')
    +(m.fiftyTwoLow!=null?`<span>52W <b>${fmt(m.fiftyTwoLow)} to ${fmt(m.fiftyTwoHigh)}</b></span>`:'');
}
let seq=0;
async function loadChart(sym,tf){
  const my=++seq;
  C.sym=(sym||C.sym).toUpperCase(); C.tf=tf||C.tf;
  const cfg=TF[C.tf];
  chartMsg(true,'LOADING',`${C.sym} \u00b7 ${C.tf}`);
  try{
    const d=await get(`/v1/candles?symbol=${encodeURIComponent(C.sym)}&range=${cfg.range}&interval=${cfg.interval}`);
    if(my!==seq) return;
    C.bars=d.bars; C.meta=d;
    chartMsg(false); paintChart(); writeQuote(); loadSnapshot(C.sym);
  }catch(e){
    if(my!==seq) return;
    chartMsg(true,'NO DATA',e.message+'. If this is the first run, the Worker still needs the new endpoints deployed.');
  }
}
window.deskChart=loadChart;

function wireSymbol(){
  const inp=$('#dkSym'),box=$('#dkSug'); if(!inp) return;
  let rows=[],at=-1,timer;
  const close=()=>{box.classList.remove('on');box.innerHTML='';rows=[];at=-1;};
  const pick=i=>{const r=rows[i];if(!r)return;inp.value='';inp.blur();close();loadChart(r.symbol);};
  inp.addEventListener('click',e=>e.stopPropagation());
  inp.addEventListener('input',()=>{
    clearTimeout(timer);
    const q=inp.value.trim(); if(!q){close();return;}
    timer=setTimeout(async()=>{
      try{
        const d=await get('/v1/ysearch?q='+encodeURIComponent(q));
        rows=d.results||[]; if(!rows.length){close();return;} at=0;
        box.innerHTML=rows.map((r,i)=>`<button data-i="${i}" class="${i?'':'hot'}">
          <span class="sy">${esc(r.symbol)}</span><span class="nm">${esc(r.name)}</span></button>`).join('');
        box.classList.add('on');
      }catch(e){close();}
    },220);
  });
  box.addEventListener('click',e=>{e.stopPropagation();const b=e.target.closest('button');if(b)pick(+b.dataset.i);});
  inp.addEventListener('keydown',e=>{
    e.stopPropagation();
    if(e.key==='Enter'){e.preventDefault();
      if(rows.length&&at>=0)pick(at);
      else if(inp.value.trim()){loadChart(inp.value.trim());inp.value='';close();}}
    else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!rows.length)return;
      at=(at+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length;
      $$('button',box).forEach((x,i)=>x.classList.toggle('hot',i===at));
      const h=$('.hot',box); if(h)h.scrollIntoView({block:'nearest'});}
    else if(e.key==='Escape'){close();inp.blur();}
  });
  document.addEventListener('click',e=>{if(!e.target.closest('.dk-sym'))close();});
}

/* ============================================================
   4. THE SNAPSHOT
   The Ledger in miniature. Not every metric, just the ones that
   answer the first questions anyone asks about a company: what
   it does, what it is worth, whether it is profitable, whether
   it is growing, how leveraged it is, and what the street says.
   ============================================================ */
let snapSym=null;
async function loadSnapshot(sym){
  const host=$('#dkSnap'); if(!host||!sym) return;
  if(snapSym===sym) return;
  snapSym=sym;
  if(/[\^=]/.test(sym)||sym.indexOf('-')>-1){
    host.innerHTML=stateBox('NO COMPANY FILE',
      sym+' is an index, future or currency pair rather than a listed company. Chart a ticker to see its fundamentals here.');
    setBar('#dkSnap','n/a'); return;
  }
  host.innerHTML='<div class="dk-skel"></div><div class="dk-skel"></div><div class="dk-skel"></div>';
  setBar('#dkSnap','loading');
  try{
    const d=await get('/v1/company?symbol='+encodeURIComponent(sym));
    const p=d.profile||{}, m=(d.metric&&d.metric.metric)||{}, rec=(d.rec&&d.rec[0])||null;
    const rows=[
      ['Market cap', p.marketCapitalization?'$'+big(p.marketCapitalization*1e6):null,'What the whole company is priced at'],
      ['P/E', m.peTTM!=null?fmt(m.peTTM,1):null,'Paid per dollar of annual profit'],
      ['Net margin', m.netProfitMarginTTM!=null?fmt(m.netProfitMarginTTM,1)+'%':null,'Kept from every revenue dollar'],
      ['Revenue growth', m.revenueGrowthTTMYoy!=null?pctf(m.revenueGrowthTTMYoy):null,'Sales versus a year ago'],
      ['Debt / equity', m['totalDebt/totalEquityQuarterly']!=null?fmt(m['totalDebt/totalEquityQuarterly'],2):null,'Borrowed against owned'],
      ['52 week range', (m['52WeekLow']!=null&&m['52WeekHigh']!=null)?fmt(m['52WeekLow'])+' to '+fmt(m['52WeekHigh']):null,'Where it has traded this year']
    ].filter(r=>r[1]!=null);
    if(!rows.length&&!p.name) throw new Error('No fundamentals are published for '+sym+'.');

    let street='';
    if(rec){
      const tot=(rec.strongBuy||0)+(rec.buy||0)+(rec.hold||0)+(rec.sell||0)+(rec.strongSell||0);
      if(tot){
        const bull=((rec.strongBuy||0)+(rec.buy||0))/tot*100;
        const bear=((rec.sell||0)+(rec.strongSell||0))/tot*100;
        const hold=100-bull-bear;
        street=`<div class="snap-street"><span class="k">Analyst split</span>
          <span class="bar"><i class="b" style="width:${bull.toFixed(0)}%"></i><i class="h" style="width:${hold.toFixed(0)}%"></i><i class="s" style="width:${bear.toFixed(0)}%"></i></span>
          <span class="lg"><b class="up">${bull.toFixed(0)}% buy</b> \u00b7 ${hold.toFixed(0)}% hold \u00b7 <b class="dn">${bear.toFixed(0)}% sell</b></span></div>`;
      }
    }
    host.innerHTML=`<div class="snap-id"><b>${esc(p.name||sym)}</b>
        <span>${esc(p.finnhubIndustry||'')}${p.exchange?' \u00b7 '+esc(String(p.exchange).split(' ')[0]):''}</span></div>
      <div class="snap-grid">${rows.map(r=>`<div class="snap-m">
        <span class="k">${esc(r[0])}</span><span class="v">${esc(r[1])}</span>
        <span class="h">${esc(r[2])}</span></div>`).join('')}</div>
      ${street}
      <button class="snap-go" id="snapGo">Open the full file on ${esc(sym)} \u2192</button>`;
    const go=$('#snapGo');
    if(go) go.addEventListener('click',()=>{
      goSection('ledger');
      setTimeout(()=>{
        const i=$('#ldSearch')||$('#ledgerSearch')||$('#ld-sym')||$('#ledger input[type="search"]')||$('#ledger input[type="text"]');
        if(i){ i.value=sym; i.focus();
          i.dispatchEvent(new Event('input',{bubbles:true}));
          i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true})); }
      },280);
    });
    setBar('#dkSnap',esc(sym));
  }catch(e){
    host.innerHTML=stateBox('NO FUNDAMENTALS',e.message);
    setBar('#dkSnap','offline');
  }
}

/* ============================================================
   5. THE ECONOMIC CALENDAR
   ============================================================ */
const DAYF=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'});
async function loadEcon(){
  const host=$('#dkEcon'); if(!host) return;
  try{
    const d=await get('/v1/econ?days=8'), evs=d.events||[];
    const by={}; evs.forEach(e=>(by[e.date]=by[e.date]||[]).push(e));
    const today=new Date().toISOString().slice(0,10);
    const schedOnly=String(d.src||'').indexOf('official-schedule')>-1;
    host.innerHTML=(schedOnly?`<p class="dk-srcnote">Consensus and actual figures were unavailable, so this is the official release schedule from the agencies that publish the data.</p>`:'')
      +Object.keys(by).sort().map(day=>{
        const rows=by[day].sort((a,b)=>b.impact-a.impact||String(a.time).localeCompare(String(b.time)));
        return `<div class="dk-day ${day===today?'today':''}">${day===today?'Today \u00b7 ':''}${esc(DAYF.format(new Date(day+'T12:00:00Z')))}</div>`
          +rows.map(e=>{
            const f=[];
            if(e.actual)    f.push(`<span class="act">ACTUAL <b>${esc(e.actual)}</b></span>`);
            if(e.consensus) f.push(`<span>EST <b>${esc(e.consensus)}</b></span>`);
            if(e.previous)  f.push(`<span>PRIOR <b>${esc(e.previous)}</b></span>`);
            return `<div class="dk-ev i${e.impact}"><span class="tm">${esc(e.time||'\u2014')}</span>
              <span class="nm">${esc(e.event)}</span>${f.length?`<span class="fig">${f.join('')}</span>`:''}</div>`;
          }).join('');
      }).join('');
    setBar('#dkEcon',evs.length+' releases');
  }catch(e){
    host.innerHTML=stateBox('CALENDAR UNAVAILABLE',e.message);
    setBar('#dkEcon','offline');
  }
}

/* ============================================================
   6. CROSS REFERENCING
   ============================================================ */
const ENC=T.ENCYCLOPEDIA||[],PAT=T.PATTERNS||[],IND=T.INDICATORS||[],STR=T.STRATEGIES||[];
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const byTitle={}; ENC.forEach((e,i)=>{byTitle[norm(e.t)]=i;});
const ALIAS={'iv':'implied volatility','implied vol':'implied volatility','dte':'days to expiration',
  'gex':'gamma exposure','oi':'open interest','the greeks':'greeks','atr':'average true range',
  'rsi':'relative strength index','ema':'exponential moving average','sma':'simple moving average',
  'em':'expected move','pdt':'pattern day trader'};
const TERMS=ENC.map((e,i)=>({i,t:e.t,k:norm(e.t)}))
  .concat(Object.keys(ALIAS).map(a=>{const i=byTitle[norm(ALIAS[a])];return i==null?null:{i,t:a,k:norm(a)};}).filter(Boolean))
  .filter(x=>x.k.length>=2).sort((a,b)=>b.k.length-a.k.length);
let TRAIL=[],inXref=false;

function linkTerms(root,selfTitle){
  const used=new Set([norm(selfTitle)]);
  $$('.enc-row .v, .pd-row .v',root).forEach(cell=>{
    const w=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT,{acceptNode(n){
      if(!n.nodeValue||n.nodeValue.trim().length<4) return NodeFilter.FILTER_REJECT;
      if(n.parentElement&&n.parentElement.closest('button,a,.xr')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;}});
    const nodes=[];let n;while((n=w.nextNode()))nodes.push(n);
    nodes.forEach(node=>{
      let text=node.nodeValue,hit=false;
      for(const term of TERMS){
        if(used.has(term.k))continue;
        const re=new RegExp('\\b('+term.t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')\\b','i');
        if(!re.test(text))continue;
        used.add(term.k); text=text.replace(re,'\u0001'+term.i+'\u0002$1\u0003'); hit=true;
        if(used.size>7)break;
      }
      if(!hit)return;
      const span=document.createElement('span');
      span.innerHTML=esc(text).replace(/\u0001(\d+)\u0002/g,'<button type="button" class="xr" data-enc="$1">').replace(/\u0003/g,'</button>');
      node.parentNode.replaceChild(span,node);
    });
  });
  $$('.xr',root).forEach(b=>{
    b.title='Open this entry';
    b.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();jumpEnc(+b.dataset.enc,selfTitle);});
  });
}
function jumpEnc(i,from){ if(from)TRAIL.push(from); inXref=true; window.openEnc(i); inXref=false; }
function goBack(){
  const prev=TRAIL.pop(); if(prev==null)return;
  const i=byTitle[norm(prev)]; if(i==null)return;
  inXref=true; const keep=TRAIL.slice(); window.openEnc(i); TRAIL=keep; renderTrail(); inXref=false;
}
function renderTrail(){
  const body=$('#encBody'); if(!body)return;
  const old=$('.xr-trail',body); if(old)old.remove();
  if(!TRAIL.length)return;
  const bar=document.createElement('div'); bar.className='xr-trail';
  bar.innerHTML=`<button type="button" class="xr-back" id="xrBack">\u2190 Back to ${esc(TRAIL[TRAIL.length-1])}</button>
    <span class="xr-crumbs">${TRAIL.length>1?TRAIL.slice(-3).map(esc).join(' <b>\u203a</b> '):''}</span>`;
  body.insertBefore(bar,body.firstChild);
  $('#xrBack',bar).addEventListener('click',goBack);
}
const STOP=new Set(['the','a','an','of','and','or','to','in','on','for','with','by','is','it','this','that',
  'at','as','from','your','you','be','are','how','what','when','not','no','one','two','its','than']);
function alsoFor(title,cat){
  const words=norm(title).split(' ').filter(w=>w.length>3&&!STOP.has(w));
  const out=[];
  const consider=(kind,name,tags,run)=>{
    if(norm(name)===norm(title))return; let sc=0;
    words.forEach(w=>{if(norm(name).includes(w))sc+=3;else if(norm(tags||'').includes(w))sc+=1;});
    if(kind!=='enc')sc*=1.4; if(sc>=3)out.push({kind,name,sc,run});
  };
  ENC.forEach((e,i)=>consider('enc',e.t,(e.cat||'')+' '+(e.tag||''),()=>jumpEnc(i,title)));
  PAT.forEach((p,i)=>consider('pattern',p.n,p.cat,()=>{closeAll();window.openPattern(i);}));
  IND.forEach(x=>consider('indicator',x.n||x.name,x.cat,()=>{closeAll();goSection('indicators');}));
  STR.forEach((s,i)=>consider('strategy',s.n,(s.fam||'')+' '+(s.alias||''),()=>{closeAll();window.openStrat(i);}));
  if(out.length<3&&cat) ENC.forEach((e,i)=>{
    if(e.cat===cat&&norm(e.t)!==norm(title)&&out.length<6) out.push({kind:'enc',name:e.t,sc:1,run:()=>jumpEnc(i,title)});
  });
  const seen=new Set();
  return out.sort((a,b)=>b.sc-a.sc).filter(x=>{const k=x.kind+norm(x.name);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,6);
}
const KL={enc:'Encyclopedia',pattern:'Pattern',indicator:'Indicator',strategy:'Strategy'};
function attachAlso(root,title,cat){
  if($('.xr-also',root))return;
  const rel=alsoFor(title,cat); if(!rel.length)return;
  const box=document.createElement('div'); box.className='xr-also';
  box.innerHTML='<div class="h">See also</div><div class="g"></div>';
  const g=$('.g',box);
  rel.forEach(r=>{const b=document.createElement('button');b.type='button';
    b.innerHTML=`${esc(r.name)}<i>${KL[r.kind]}</i>`;b.addEventListener('click',r.run);g.appendChild(b);});
  root.appendChild(box);
}
function closeAll(){ $$('.modal.open').forEach(m=>{try{window.closeModal(m.id);}catch(e){}}); }
function goSection(id){
  if(typeof window.showPage==='function'){try{window.showPage(id);return;}catch(e){}}
  location.hash='#'+id;
}
function installXref(){
  const _e=window.openEnc;
  if(typeof _e==='function') window.openEnc=function(i){
    if(!inXref)TRAIL=[];
    _e.apply(this,arguments);
    const e=ENC[i]; if(!e)return; const b=$('#encBody'); if(!b)return;
    try{renderTrail();linkTerms(b,e.t);attachAlso(b,e.t,e.cat);}catch(err){}
  };
  const _p=window.openPattern;
  if(typeof _p==='function') window.openPattern=function(i){
    _p.apply(this,arguments);
    const p=PAT[i]; if(!p)return; const b=$('#pdBody'); if(!b)return;
    try{linkTerms(b,p.n);attachAlso(b,p.n,null);}catch(err){}
  };
  const _s=window.openStrat;
  if(typeof _s==='function') window.openStrat=function(i){
    _s.apply(this,arguments);
    const s=STR[i]; if(!s)return; const b=$('#sdBody'); if(!b)return;
    try{attachAlso(b,s.n,null);}catch(err){}
  };
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    const m=$('#m-enc');
    if(m&&m.classList.contains('open')&&TRAIL.length){e.stopPropagation();goBack();}
  },true);
}

/* ============================================================
   7. OPTION ENTRY PLAYBOOKS
   The structures module explains the shape. This bolts the
   how-to onto the same panel: the exact legs in the order you
   would enter them, what it costs, what manages it, what closes
   it, and who it is actually appropriate for.
   ============================================================ */
const PLAYS=T.OPT_PLAYS||{}, TIERS=T.OPT_TIERS||{};
function playHost(){
  return $('#optRead')||$('#optDetail')||$('#osBody')||$('#optBody')||$('#opt-detail');
}
function injectPlay(){
  const host=playHost();
  const id=(window.OPT&&window.OPT.id)||null;
  if(!host||!id) return;
  const p=PLAYS[id]; if(!p) return;
  if(host.dataset.play===id) return;
  host.dataset.play=id;
  const old=$('.play',host); if(old) old.remove();
  const t=TIERS[p.tier]||['',''];
  const box=document.createElement('div');
  box.className='play';
  box.innerHTML=`
    <div class="play-h"><span class="ph">How you actually put it on</span>
      <span class="tier t${p.tier}">${esc(t[0])}</span></div>
    <p class="play-tier">${esc(t[1])}</p>
    <ol class="play-legs">${p.legs.map(l=>{
      const k=/^BUY/i.test(l)?'buy':/^SELL/i.test(l)?'sell':/^OWN|^Hold/i.test(l)?'own':'note';
      return `<li class="lg-${k}">${esc(l)}</li>`;}).join('')}</ol>
    <div class="play-nums">
      <div><span class="k">On the example</span><span class="v">${esc(p.cost)}</span></div>
      <div><span class="k">Best and worst</span><span class="v">${esc(p.max)}</span></div>
      <div><span class="k">Breakeven</span><span class="v">${esc(p.be)}</span></div>
    </div>
    <div class="play-steps">
      <div class="ps"><span class="n">1</span><div><b>Before you click</b><p>${esc(p.enter)}</p></div></div>
      <div class="ps"><span class="n">2</span><div><b>While it is open</b><p>${esc(p.manage)}</p></div></div>
      <div class="ps"><span class="n">3</span><div><b>How it ends</b><p>${esc(p.exit)}</p></div></div>
      <div class="ps"><span class="n">4</span><div><b>Position size</b><p>${esc(p.size)}</p></div></div>
    </div>
    <p class="play-foot">Every figure is priced on the same imaginary $100 stock so the structures can be compared side by side. Real premiums move with implied volatility, so treat them as proportions rather than quotes.</p>`;
  host.appendChild(box);
}
function watchOptions(){
  const host=playHost(); if(!host) return;
  new MutationObserver(()=>{ try{ host.dataset.play=''; injectPlay(); }catch(e){} }).observe(host,{childList:true});
  setTimeout(injectPlay,500);
}

/* ============================================================
   8. STRATEGY SECTION HIERARCHY
   The group headers sat at almost the same weight as the cards
   beneath them, so the page read as one long run of tiles. This
   promotes each header into a real divider, numbers them, and
   pulls dealer flow into its own band at the end, because its
   mechanism is structurally different from everything above it.
   ============================================================ */
function enhanceStrats(){
  const grid=$('#sGrid'); if(!grid) return;
  const apply=()=>{
    const groups=$$('.sgroup',grid);
    let n=0;
    groups.forEach(g=>{
      const label=(($('.sgh b',g)||{}).textContent||'').toLowerCase();
      const isGex=label.indexOf('dealer')>-1;
      if(!g.dataset.dk){
        g.dataset.dk='1';
        const h=$('.sgh',g);
        if(h && !$('.sgh-i',h)){
          const i=document.createElement('span');
          i.className='sgh-i';
          i.textContent=isGex?'\u2726':String(++n).padStart(2,'0');
          h.insertBefore(i,h.firstChild);
        }
      } else if(!isGex){ n++; }
      if(isGex && !g.classList.contains('sgroup-gex')){
        g.classList.add('sgroup-gex');
        grid.appendChild(g);          /* dealer flow sits last, on its own band */
      }
    });
  };
  apply();
  new MutationObserver(apply).observe(grid,{childList:true});
}

/* ============================================================
   9. MOTION
   ============================================================ */
function reveals(){
  const io=new IntersectionObserver(es=>{
    es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});
  },{rootMargin:'0px 0px -6% 0px',threshold:.06});
  $$('.reveal:not(.in)').forEach(el=>io.observe(el));
}
function watchNumbers(){
  const prev=new WeakMap();
  setInterval(()=>{
    $$('.dk-cq .last, .idx-row .v, .cmp-r .v').forEach(el=>{
      const v=el.textContent,old=prev.get(el);
      if(old!=null&&old!==v){
        const up=parseFloat(String(v).replace(/[^\d.-]/g,''))>parseFloat(String(old).replace(/[^\d.-]/g,''));
        el.classList.remove('dk-up','dk-dn'); void el.offsetWidth; el.classList.add(up?'dk-up':'dk-dn');
      }
      prev.set(el,v);
    });
  },1500);
}
function wireTape(){
  const trk=$('#tapeTrack'); if(!trk) return;
  const tag=()=>$$('#tapeTrack i').forEach(i=>{
    const b=$('b',i); if(b&&!i.dataset.sym) i.dataset.sym=b.textContent.trim();
  });
  tag(); new MutationObserver(tag).observe(trk,{childList:true});
  trk.addEventListener('click',e=>{
    const i=e.target.closest('i'); if(i&&i.dataset.sym) toChart(i.dataset.sym);
  });
}

/* ============================================================
   BOOT
   ============================================================ */
function init(){
  installXref(); wireSymbol(); wireStage(); wireTape();
  watchOptions(); enhanceStrats(); reveals();
  if(!SLOW) watchNumbers();

  $$('#dkTf button').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    if(b.dataset.tf){$$('#dkTf [data-tf]').forEach(x=>x.classList.toggle('on',x===b));loadChart(C.sym,b.dataset.tf);}
    else if(b.dataset.type){$$('#dkTf [data-type]').forEach(x=>x.classList.toggle('on',x===b));C.type=b.dataset.type;paintChart();}
    else if(b.dataset.tog){C[b.dataset.tog]=!C[b.dataset.tog];b.classList.toggle('on',C[b.dataset.tog]);paintChart();}
  }));

  loadChart('SPY','3M'); loadEcon(); loadCompass();
  everyVisible(loadEcon,900000);
  everyVisible(loadCompass,900000);
  everyVisible(()=>loadChart(),120000);
  addEventListener('hashchange',()=>setTimeout(reveals,60));
  let rz; addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(CMP.length)drawCompass();},220);});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
else init();
})();
