/* ============================================================
   THE TRADING DESK · TERMINAL
   Every live panel on the site, in one file. Loads last.

     THE WIRE       news, fastest source available
     THE READ       VIX, dealer gamma regime, breadth
     THE TERMINAL   one ticker: chart, snapshot, technicals
     THE ROTATION   sectors and themes, with tails
     LIBRARY        cross-referencing across every dataset

   Every number comes from a live feed. When a feed is down the
   panel says so. A plausible wrong number is worse than a blank.
   ============================================================ */
(function(){
'use strict';

const API  = (typeof TDESK_API==='string' && TDESK_API) || 'https://tdesk-data.safihelal.workers.dev';
const T    = window.TDESK||{};
const $    = (s,r)=>(r||document).querySelector(s);
const $$   = (s,r)=>[...(r||document).querySelectorAll(s)];
const SLOW = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc  = s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt  = (n,d=2)=> n==null||isNaN(n)?'\u2014':Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const pctf = n=> n==null||isNaN(n)?'\u2014':(n>=0?'+':'')+Number(n).toFixed(2)+'%';
const dirC = n=> n==null?'':n>0?'up':n<0?'dn':'';
const big  = n=>{ if(n==null||isNaN(n))return '\u2014'; const a=Math.abs(n);
  return a>=1e12?(n/1e12).toFixed(2)+'T':a>=1e9?(n/1e9).toFixed(2)+'B':a>=1e6?(n/1e6).toFixed(2)+'M':a>=1e3?(n/1e3).toFixed(1)+'K':fmt(n); };
async function get(p){
  const r=await fetch(API.replace(/\/$/,'')+p);
  const d=await r.json().catch(()=>null);
  if(!r.ok||(d&&d.error)) throw new Error((d&&(d.message||d.error))||('Feed returned '+r.status));
  return d;
}
function everyVisible(fn,ms){
  setInterval(()=>{if(!document.hidden)fn();},ms);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)fn();});
}
const stateBox=(t,d)=>`<div class="dk-state"><div class="t">${esc(t)}</div><div class="d">${esc(d)}</div></div>`;
function setBar(sel,txt){
  const p=$(sel); if(!p)return;
  const pan=p.closest('.dk-panel'); if(!pan)return;
  const s=$('.dk-bar .s',pan); if(s)s.textContent=txt;
}

/* ============================================================
   THE ROTATION
   Ported from the Mythos engine. Same maths, same reference set,
   so the numbers agree with the terminal they came from.

   The one idea that makes an RRG work: position is scored
   CROSS-SECTIONALLY, against the eleven sector ETFs only. Themes
   are placed on that scale rather than contributing to it, so a
   theme failing to load cannot shift anything else by a pixel.
   ============================================================ */
const ROT_GROUPS = [
  {sym:'XLK', etf:'XLK', name:'Technology',     cat:'sector', members:['NVDA','AAPL','MSFT','AVGO','ORCL','PLTR','AMD','CRM']},
  {sym:'SMH', etf:'SMH', name:'Semiconductors', cat:'sector', members:['NVDA','AVGO','AMD','TSM','MU','INTC','AMAT','LRCX','MRVL']},
  {sym:'XLC', etf:'XLC', name:'Communication',  cat:'sector', members:['META','GOOGL','NFLX','DIS','T','TMUS']},
  {sym:'XLY', etf:'XLY', name:'Consumer Disc.', cat:'sector', members:['AMZN','TSLA','HD','MCD','CMG','F','NKE','BKNG']},
  {sym:'XLP', etf:'XLP', name:'Staples',        cat:'sector', members:['WMT','COST','PG','KO','PM','PEP','MDLZ']},
  {sym:'XLE', etf:'XLE', name:'Energy',         cat:'sector', members:['XOM','CVX','COP','SLB','EOG','MPC','VLO','OXY']},
  {sym:'XLF', etf:'XLF', name:'Financials',     cat:'sector', members:['JPM','BAC','V','MA','GS','WFC','SCHW']},
  {sym:'XLV', etf:'XLV', name:'Health Care',    cat:'sector', members:['LLY','UNH','JNJ','ABBV','MRK','ISRG','AMGN','PFE']},
  {sym:'XLI', etf:'XLI', name:'Industrials',    cat:'sector', members:['CAT','GE','RTX','BA','ETN','DE','HON']},
  {sym:'XLB', etf:'XLB', name:'Materials',      cat:'sector', members:['LIN','FCX','NEM','NUE','STLD','MLM','VMC','APD']},
  {sym:'XLRE',etf:'XLRE',name:'Real Estate',    cat:'sector', members:['EQIX','DLR','PLD','AMT','WELL','O','IRM']},
  {sym:'XLU', etf:'XLU', name:'Utilities',      cat:'sector', members:['NEE','CEG','VST','SO','DUK','AEP']},
  {sym:'MEMORY', synth:true, name:'Memory / Storage', cat:'theme', members:['MU','WDC','STX']},
  {sym:'SPACE',  synth:true, name:'Space',            cat:'theme', members:['ASTS','RKLB','JOBY','ACHR','RDW']},
  {sym:'QUANTUM',synth:true, name:'Quantum',          cat:'theme', members:['IONQ','QBTS','RGTI']},
  {sym:'CYBER',  etf:'CIBR',  name:'Cybersecurity',   cat:'theme', members:['CRWD','PANW','FTNT','NET','S']},
  {sym:'FINTECH',synth:true, name:'FinTech',          cat:'theme', members:['SOFI','HOOD','NU','COIN','AFRM']},
  {sym:'NUCLEAR',synth:true, name:'Nuclear / AI Power',cat:'theme',members:['SMR','OKLO','CEG','VST']},
  {sym:'DCPOWER',synth:true, name:'Data-Center Power',cat:'theme', members:['VRT','ETN','GEV','ANET','CRDO']}
];
const ROT_TREND_W = 63;    /* trend leg of RS-Ratio, about one quarter */
const ROT_Z       = 2.5;   /* 100 +/- Z*z, so the scale reads like a classic RRG */
const ROT_TAIL    = 6;     /* tail points drawn */
const ROT_BENCH   = 'SPY';
const PHASE_COL   = {Leading:'52,211,153', Weakening:'242,193,78',
                     Lagging:'232,121,249', Improving:'34,211,238'};
const PHASE_SAY = {
  Leading:'Strong and still gaining. Trends here are already paying.',
  Weakening:'Still strong on the long view, but momentum has rolled over. Where trims happen.',
  Lagging:'Weak and still sinking. Looks cheap, usually early.',
  Improving:'Weak on the long view, but turning up. Where positions get built.'
};

function rotSMA(a,w){
  const out=new Array(a.length); let s=0;
  for(let i=0;i<a.length;i++){ s+=a[i]; if(i>=w)s-=a[i-w]; out[i]=i>=w-1?s/w:s/(i+1); }
  return out;
}
/* z-score COLUMN-wise at each date, scored against a fixed reference set.
   This is the function that makes XLU and SMH comparable at all. */
function rotXZ(rows,refIdx){
  const n=rows.length; if(!n)return [];
  const L=rows[0].length;
  const out=rows.map(()=>new Array(L).fill(0));
  const ref=(refIdx&&refIdx.length>=5)?refIdx:rows.map((_,i)=>i);
  for(let t=0;t<L;t++){
    let m=0,c=0;
    for(const i of ref){const v=rows[i][t]; if(isFinite(v)){m+=v;c++;}}
    if(c<2)continue;
    m/=c;
    let s2=0;
    for(const i of ref){const v=rows[i][t]; if(isFinite(v))s2+=(v-m)*(v-m);}
    const sd=Math.sqrt(s2/(c-1))||1e-9;
    for(let i=0;i<n;i++){const v=rows[i][t]; out[i][t]=isFinite(v)?(v-m)/sd:0;}
  }
  return out;
}
/* Align every series by LENGTH from the right. The site pulls all series in
   one batch on the same request, so they end on the same session; aligning
   from the right is therefore safe here in a way it would not be in Kairos,
   where the universe refreshes as a rotating slice. */
function rotAlign(map){
  const keys=Object.keys(map).filter(k=>map[k]&&map[k].length>=ROT_TREND_W+12);
  if(keys.length<2)return null;
  const n=Math.min.apply(null,keys.map(k=>map[k].length));
  if(n<ROT_TREND_W+12)return null;
  const o={}; keys.forEach(k=>o[k]=map[k].slice(-n));
  return {series:o,len:n};
}
/* A synthetic basket: an equal-weight index of its members, rebased so every
   member contributes the same amount regardless of share price. */
function rotBasket(members,closes){
  const ser=members.map(m=>closes[m]).filter(a=>a&&a.length>=ROT_TREND_W+12);
  if(ser.length<2)return null;
  const n=Math.min.apply(null,ser.map(a=>a.length));
  const idx=new Array(n).fill(0);
  ser.forEach(a=>{
    const s=a.slice(-n),base=s[0];
    if(base>0)for(let i=0;i<n;i++)idx[i]+=s[i]/base;
  });
  return idx.map(v=>v/ser.length*100);
}
function rotSet(map,bench,tf){
  const withB=Object.assign({__b:bench},map);
  const al=rotAlign(withB);
  if(!al)return null;
  const b=al.series.__b; if(!b)return null;
  delete al.series.__b;
  const keys=Object.keys(al.series);
  if(keys.length<2)return null;

  /* 1. trend measure per body: RS against its own quarter mean, unitless */
  const raw=keys.map(k=>{
    const c=al.series[k];
    const rs=c.map((v,i)=>b[i]>0?v/b[i]:0);
    const sm=rotSMA(rs,ROT_TREND_W);
    return rs.map((v,i)=>sm[i]>0?v/sm[i]-1:0);
  });
  /* the reference set is the sector ETFs only, so themes are placed on the
     scale rather than moving it */
  const refIdx=[];
  keys.forEach((k,i)=>{
    if(ROT_GROUPS.some(g=>g.cat==='sector'&&(g.sym===k||g.etf===k))) refIdx.push(i);
  });
  /* 2. cross-sectional z at each date becomes RS-Ratio */
  const ratio=rotXZ(raw,refIdx).map(r=>r.map(z=>100+z*ROT_Z));
  /* 3. RS-Momentum is the rate of change of RS-Ratio, normalised the same way */
  const rawM=ratio.map(r=>r.map((v,i)=>i>=tf?v-r[i-tf]:0));
  const mom=rotXZ(rawM,refIdx).map(r=>r.map(z=>100+z*ROT_Z));

  const bodies={};
  keys.forEach((k,i)=>{ bodies[k]={ratio:ratio[i],mom:mom[i],closes:al.series[k]}; });
  return {bodies,len:ratio[0].length,minIdx:ROT_TREND_W+tf,refCount:refIdx.length};
}
function rotAt(s,tailLen){
  const L=s.ratio.length, i=L-1, tail=[];
  for(let j=Math.max(0,i-tailLen+1);j<=i;j++) tail.push({x:s.ratio[j],y:s.mom[j]});
  const c=s.closes, back=Math.max(0,i-5);
  return {x:s.ratio[i], y:s.mom[i], tail, ret:c[back]>0?(c[i]/c[back]-1):0};
}
function rotPhase(x,y){
  if(x>=100&&y>=100)return 'Leading';
  if(x>=100&&y<100) return 'Weakening';
  if(x<100&&y<100)  return 'Lagging';
  return 'Improving';
}
/* Bodies are supposed to rotate clockwise. Measuring whether one actually is
   separates a real rotation from jitter across a boundary, which is the most
   common way an RRG gets misread and something a trail alone cannot tell you. */
function rotQuality(tail){
  if(!tail||tail.length<4)return null;
  let sweep=0,path=0,rsum=0;
  for(let i=1;i<tail.length;i++){
    const a=tail[i-1],b=tail[i];
    let d=Math.atan2(b.y-100,b.x-100)-Math.atan2(a.y-100,a.x-100);
    while(d>Math.PI)d-=2*Math.PI;
    while(d<-Math.PI)d+=2*Math.PI;
    sweep+=d;
    path+=Math.hypot(b.x-a.x,b.y-a.y);
    rsum+=Math.hypot(b.x-100,b.y-100);
  }
  const r=rsum/(tail.length-1);
  return {sweep, r, dir:sweep<-0.10?'cw':sweep>0.10?'ccw':'flat',
          quality:Math.max(0,Math.min(1,path>0?Math.abs(sweep)*r/path:0))};
}

/* ---- data: one batched pull of daily closes ---- */
let ROT={set:null,closes:{},scope:'all',drill:null,tf:5,trail:'one',hover:null};
const ROT_TF={fast:3,normal:5,slow:10};

async function rotLoad(){
  const host=$('#rotPlot'); if(!host) return;
  const need=new Set([ROT_BENCH]);
  if(ROT.drill){
    /* drilled in: the benchmark, the sector ETFs that anchor the scale, and
       only THIS group's members. Queueing every group's members here was
       about a hundred symbols for a view that shows eight. */
    ROT_GROUPS.filter(g=>g.cat==='sector'&&g.etf).forEach(g=>need.add(g.etf));
    const d=ROT_GROUPS.find(g=>g.sym===ROT.drill);
    if(d) d.members.forEach(m=>need.add(m));
  } else {
    ROT_GROUPS.forEach(g=>{
      if(g.etf) need.add(g.etf);
      else if(g.synth) g.members.forEach(m=>need.add(m));
    });
  }
  const syms=[...need];
  try{
    /* One request for the whole universe. A year of daily closes is enough
       for the 63-session trend leg, the momentum lookback and the tail. */
    const d=await get('/v1/closes?symbols='+encodeURIComponent(syms.join(',')));
    ROT.closes=d.closes||{};
    if(!out[ROT_BENCH]) throw new Error('No benchmark history for '+ROT_BENCH+'.');
    rotBuild(); rotDraw();
  }catch(e){
    host.innerHTML=stateBox('ROTATION UNAVAILABLE',e.message);
    setBar('#rotPlot','offline');
  }
}
function rotBuild(){
  const map={};
  if(ROT.drill){
    /* drilled into one group: its members become the bodies. The reference set
       falls back to the whole scope here, which is correct, because inside one
       sector there is no stable outside reference to borrow. */
    const g=ROT_GROUPS.find(x=>x.sym===ROT.drill);
    (g?g.members:[]).forEach(m=>{ if(ROT.closes[m]) map[m]=ROT.closes[m]; });
  } else {
    ROT_GROUPS.filter(g=>ROT.scope==='all'||g.cat===ROT.scope).forEach(g=>{
      if(g.etf && ROT.closes[g.etf]) map[g.sym]=ROT.closes[g.etf];
      else if(g.synth){ const b=rotBasket(g.members,ROT.closes); if(b)map[g.sym]=b; }
    });
  }
  ROT.set=rotSet(map,ROT.closes[ROT_BENCH],ROT.tf);
}
function rotName(k){
  const g=ROT_GROUPS.find(x=>x.sym===k||x.etf===k);
  return g?g.name:k;
}
function rotDraw(){
  const host=$('#rotPlot'); if(!host) return;
  const set=ROT.set;
  if(!set||!set.bodies||!Object.keys(set.bodies).length){
    host.innerHTML=stateBox('NOT ENOUGH HISTORY',
      'At least two bodies need a full quarter of daily bars before the plot means anything.');
    return;
  }
  const keys=Object.keys(set.bodies);
  const pts=keys.map(k=>{ const a=rotAt(set.bodies[k],ROT_TAIL);
    return {k,x:a.x,y:a.y,tail:a.tail,ret:a.ret,phase:rotPhase(a.x,a.y),q:rotQuality(a.tail)}; });

  /* scale to the data with a symmetric pad, so the centre cross stays at
     100/100 and the quadrants keep their meaning */
  const allX=pts.flatMap(p=>p.tail.map(t=>t.x)).concat(pts.map(p=>p.x));
  const allY=pts.flatMap(p=>p.tail.map(t=>t.y)).concat(pts.map(p=>p.y));
  const rx=Math.max(3,...allX.map(v=>Math.abs(v-100)))*1.2;
  const ry=Math.max(3,...allY.map(v=>Math.abs(v-100)))*1.2;
  const W=560,H=420,P=34;
  const sx=v=>P+((v-100+rx)/(2*rx))*(W-P*2);
  const sy=v=>H-P-((v-100+ry)/(2*ry))*(H-P*2);

  const bodies=pts.map((p,i)=>{
    const col=PHASE_COL[p.phase];
    const path=p.tail.map((t,j)=>`${j?'L':'M'}${sx(t.x).toFixed(1)} ${sy(t.y).toFixed(1)}`).join(' ');
    const dots=p.tail.slice(0,-1).map(t=>
      `<circle cx="${sx(t.x).toFixed(1)}" cy="${sy(t.y).toFixed(1)}" r="1.8" fill="rgba(${col},.45)"/>`).join('');
    return `<g class="rot-b" data-k="${esc(p.k)}" data-i="${i}" tabindex="0" role="button"
        aria-label="${esc(rotName(p.k))}, ${p.phase}" style="--c:rgb(${col});--d:${i*40}ms">
      <path class="tail" d="${path}" stroke="rgba(${col},.55)" fill="none" stroke-width="1.4"/>
      ${dots}
      <circle class="halo" cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="15" fill="rgba(${col},.13)"/>
      <circle class="core" cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="6" fill="rgb(${col})"/>
      <text x="${sx(p.x).toFixed(1)}" y="${(sy(p.y)-13).toFixed(1)}" text-anchor="middle">${esc(p.k)}</text>
    </g>`;
  }).join('');

  host.innerHTML=`<div class="rot-wrap">
    <svg class="rot-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Relative rotation map">
      <rect x="${W/2}" y="${P}" width="${W/2-P}" height="${H/2-P}" fill="rgb(52,211,153)" opacity=".045"/>
      <rect x="${W/2}" y="${H/2}" width="${W/2-P}" height="${H/2-P}" fill="rgb(242,193,78)" opacity=".045"/>
      <rect x="${P}" y="${H/2}" width="${W/2-P}" height="${H/2-P}" fill="rgb(232,121,249)" opacity=".045"/>
      <rect x="${P}" y="${P}" width="${W/2-P}" height="${H/2-P}" fill="rgb(34,211,238)" opacity=".045"/>
      <line x1="${P}" y1="${H/2}" x2="${W-P}" y2="${H/2}" stroke="rgba(126,166,214,.3)"/>
      <line x1="${W/2}" y1="${P}" x2="${W/2}" y2="${H-P}" stroke="rgba(126,166,214,.3)"/>
      <text class="rot-q" x="${W-P-5}" y="${P+13}" text-anchor="end" fill="rgb(52,211,153)">LEADING</text>
      <text class="rot-q" x="${W-P-5}" y="${H-P-5}" text-anchor="end" fill="rgb(242,193,78)">WEAKENING</text>
      <text class="rot-q" x="${P+5}" y="${H-P-5}" fill="rgb(232,121,249)">LAGGING</text>
      <text class="rot-q" x="${P+5}" y="${P+13}" fill="rgb(34,211,238)">IMPROVING</text>
      <text class="rot-ax" x="${W-P}" y="${H/2+15}" text-anchor="end">RS-RATIO \u2192</text>
      <text class="rot-ax" x="${W/2+8}" y="${P-6}">\u2191 RS-MOMENTUM</text>
      <g class="rot-bodies">${bodies}</g>
    </svg>
    <div class="rot-side">
      <div class="rot-read" id="rotRead"></div>
      <div class="rot-list" id="rotList"></div>
    </div>
  </div>`;

  rotSay(null);
  $('#rotList').innerHTML=pts.slice()
    .sort((a,b)=>(b.x-100)-(a.x-100))
    .map(p=>`<button class="rot-li" data-k="${esc(p.k)}" style="--c:rgb(${PHASE_COL[p.phase]})">
      <span class="d"></span><span class="s">${esc(p.k)}</span>
      <span class="p">${p.phase}</span></button>`).join('');

  const byK={}; pts.forEach(p=>byK[p.k]=p);
  const hook=el=>{
    const k=el.dataset.k;
    el.addEventListener('mouseenter',()=>rotSay(byK[k]));
    el.addEventListener('focus',()=>rotSay(byK[k]));
    el.addEventListener('click',()=>rotClick(k));
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();rotClick(k);}});
  };
  $$('.rot-b',host).forEach(hook);
  $$('.rot-li',host).forEach(hook);
  setBar('#rotPlot', (ROT.drill?rotName(ROT.drill)+' \u00b7 ':'')+keys.length+' bodies');
  const back=$('#rotBack'); if(back) back.style.display=ROT.drill?'':'none';
}
function rotSay(p){
  const el=$('#rotRead'); if(!el)return;
  if(!p){
    el.innerHTML=`<span class="k">The map</span><span class="v">Relative rotation</span>
      <p>Each body is measured against SPY, then scored across the sector field so a utility and a semiconductor basket are comparable. Right of centre is outperforming, above centre is accelerating. The trail is the last six sessions, and money tends to travel clockwise.</p>
      <small>Hover a body to read it. Click a sector to open its constituents.</small>`;
    return;
  }
  const q=p.q;
  const spin=q ? (q.dir==='cw'?'Rotating clockwise, the normal direction.'
              : q.dir==='ccw'?'Rotating counter-clockwise, which is unusual and often means a failed move.'
              : 'Barely rotating. This is drift rather than a real move.') : '';
  const clean=q ? (q.quality>0.55?'The path is a clean arc, so the rotation is real.'
              : q.quality>0.28?'The path is uneven. Treat it as a lean, not a signal.'
              : 'The path is a scribble. This is jitter across a boundary, not rotation.') : '';
  el.innerHTML=`<span class="k" style="color:rgb(${PHASE_COL[p.phase]})">${p.phase}</span>
    <span class="v">${esc(p.k)} <em>${esc(rotName(p.k))}</em></span>
    <p>${PHASE_SAY[p.phase]}</p>
    <div class="rot-nums">
      <span>RS-Ratio <b>${p.x.toFixed(1)}</b></span>
      <span>RS-Mom <b>${p.y.toFixed(1)}</b></span>
      <span>5-day <b class="${dirC(p.ret)}">${pctf(p.ret*100)}</b></span>
      <span>Quality <b>${q?(q.quality*100).toFixed(0)+'%':'\u2014'}</b></span>
    </div>
    <small>${spin} ${clean}</small>`;
}
function rotClick(k){
  const g=ROT_GROUPS.find(x=>x.sym===k);
  if(!ROT.drill && g && g.members && g.members.length>2){
    ROT.drill=k;
    const host=$('#rotPlot');
    if(host) host.innerHTML='<div class="dk-skel"></div><div class="dk-skel"></div><div class="dk-skel"></div>';
    rotLoad();
    return;
  }
  /* nothing to open, or already drilled in: chart it. A group charts its
     ETF where one exists, since a synthetic basket has no ticker. */
  toChart(g && g.etf ? g.etf : k);
}
function rotBackOut(){ ROT.drill=null; rotLoad(); }

/* ============================================================
   THE READ
   Market conditions, not market prices. Three questions: how
   nervous is the options market, are dealers amplifying moves
   or damping them, and is the move broad or narrow.

   The gamma half comes from Kairos through a deliberately coarse
   channel: prior close, three buckets, never a level. That is
   enough to teach what dealer positioning does to a tape, and
   not enough to trade off, which is the point.
   ============================================================ */
const GAMMA_SAY={
  short:['Dealers are short gamma','They hedge in the direction of the move, which amplifies it. Trends extend, dips get sold harder, and ranges break more often than they hold.'],
  long: ['Dealers are long gamma','They hedge against the move, which damps it. Rallies get sold and dips get bought mechanically, so price tends to compress and revert toward the middle.']
};
const FLIP_SAY={
  near:['Close to the flip','Small moves could change the regime, so today can behave one way in the morning and the other by the afternoon.'],
  mid: ['Some room to the flip','A normal session could reach it, but the current regime is the base case.'],
  far: ['Far from the flip','Today is very likely to behave the way it is behaving now, all session.']
};
const CONC_SAY={
  tight: ['Tight','A few strikes hold most of the positioning, so price tends to get pinned and pushed around by them.'],
  normal:['Normal','Positioning is spread out enough that no single level dominates.'],
  loose: ['Loose','Nothing much is holding price in place, so it can travel without meeting resistance from hedging.']
};
async function loadRead(){
  const host=$('#dkRead'); if(!host) return;
  let read=null;
  try{ read=await get('/v1/read'); }catch(e){ read=null; }

  let breadth=null;
  try{
    const d=await get('/v1/strength');
    const rows=d.rows||[];
    const adv=rows.filter(r=>r.m1>0).length;
    breadth={adv,tot:rows.length};
  }catch(e){}

  if(!read && !breadth){
    host.innerHTML=stateBox('THE READ IS OFFLINE','Neither the volatility feed nor the rotation feed is reachable right now.');
    setBar('#dkRead','offline'); return;
  }

  const cards=[];

  /* --- VIX --- */
  if(read && read.vix){
    const v=read.vix;
    const band = v.spot<14?['Calm','The options market is pricing small daily moves. Complacency is cheap and protection is cheap with it.']
      : v.spot<20?['Normal','Ordinary two-way risk. Nothing in the volatility surface is shouting.']
      : v.spot<28?['Elevated','The market is paying up for protection. Position sizes should come down before conviction does.']
      : ['Stressed','Fear is being paid for aggressively. Historically these readings mark the middle of a move, not the end.'];
    const term = v.termState==='backwardation'
      ? ['Backwardation','Near-term volatility costs more than far-term, which happens when something is wrong right now. This is the shape that marks stress.']
      : ['Contango','Far-term volatility costs more than near-term, the normal shape. The market expects today to be calmer than next quarter.'];
    cards.push(`<div class="rd-card">
      <div class="rd-h"><span class="rd-t">Volatility</span>
        <span class="rd-v">${fmt(v.spot,2)}</span></div>
      <div class="rd-scale"><i style="left:${Math.max(0,Math.min(100,(v.spot/45)*100)).toFixed(1)}%"></i>
        <span>10</span><span>20</span><span>30</span><span>45</span></div>
      <div class="rd-row"><b>${band[0]}</b><p>${band[1]}</p></div>
      <div class="rd-row"><b>${term[0]}</b><p>${term[1]}</p>
        <span class="rd-sub">VIX ${fmt(v.spot,2)} against 3-month ${v.vix3m?fmt(v.vix3m,2):'\u2014'}</span></div>
    </div>`);
  }

  /* --- dealer gamma --- */
  if(read && read.symbols && Object.keys(read.symbols).length){
    const syms=Object.keys(read.symbols);
    cards.push(`<div class="rd-card">
      <div class="rd-h"><span class="rd-t">Dealer positioning</span>
        <span class="rd-tag">prior close</span></div>
      ${syms.map(s=>{
        const x=read.symbols[s];
        const g=GAMMA_SAY[x.gammaSign]||['Unknown',''];
        const f=x.flipBucket?FLIP_SAY[x.flipBucket]:null;
        const c=x.concentration?CONC_SAY[x.concentration]:null;
        return `<div class="rd-sym">
          <div class="rd-sh"><b>${esc(s)}</b>
            <span class="rd-pill ${x.gammaSign}">${x.gammaSign==='short'?'SHORT GAMMA':'LONG GAMMA'}</span>
            ${x.dayCount>1?`<span class="rd-days">${x.dayCount} sessions</span>`:''}</div>
          <p>${g[1]}</p>
          <div class="rd-mini">
            ${f?`<span><b>${f[0]}</b>${f[1]}</span>`:''}
            ${c?`<span><b>${c[0]} book</b>${c[1]}</span>`:''}
          </div>
        </div>`;
      }).join('')}
      <p class="rd-note">Deliberately coarse and one session behind. The point is the mechanism, not a level to trade against.</p>
    </div>`);
  }

  /* --- breadth --- */
  if(breadth && breadth.tot){
    const pct=breadth.adv/breadth.tot*100;
    const say = pct>=70?['Broad','Most of the market is participating. Moves built on this tend to hold.']
      : pct>=45?['Mixed','Roughly half the market is working. No strong message either way.']
      : pct>=25?['Narrow','A minority is carrying the index. That is fragile, because it depends on a handful of names.']
      : ['Very narrow','Almost nothing is participating. An index holding up on this is being held up by a few names.'];
    cards.push(`<div class="rd-card">
      <div class="rd-h"><span class="rd-t">Breadth</span>
        <span class="rd-v">${breadth.adv}<em>/${breadth.tot}</em></span></div>
      <div class="rd-bar"><i style="width:${pct.toFixed(0)}%"></i></div>
      <div class="rd-row"><b>${say[0]}</b><p>${say[1]}</p>
        <span class="rd-sub">Groups outperforming SPY over the last month.</span></div>
    </div>`);
  }

  host.innerHTML=`<div class="rd-grid">${cards.join('')}</div>`;
  setBar('#dkRead', read&&read.session?read.session:'live');
}

/* ============================================================
   THE WIRE
   ============================================================ */
const ago=ts=>{ if(!ts)return'';
  const m=Math.floor((Date.now()-ts)/60000);
  return m<1?'now':m<60?m+'m':m<1440?Math.floor(m/60)+'h':Math.floor(m/1440)+'d'; };
async function loadWire(){
  const host=$('#dkWire'); if(!host) return;
  try{
    const d=await get('/v1/news'), it=d.items||[];
    host.innerHTML=it.slice(0,40).map(n=>
      `<a class="wi" href="${esc(n.url)}" target="_blank" rel="noopener">
        <div class="wi-h">${esc(n.title)}</div>
        <div class="wi-m"><span class="src">${esc(n.source)}</span><span>${ago(n.ts)}</span>
          ${(n.syms||[]).slice(0,3).map(s=>`<em data-sym="${esc(s)}">${esc(s)}</em>`).join('')}</div>
      </a>`).join('');
    setBar('#dkWire', it.length+' live');
    host.addEventListener('click',e=>{
      const t=e.target.closest('em[data-sym]');
      if(t){ e.preventDefault(); toChart(t.dataset.sym); }
    });
  }catch(e){
    host.innerHTML=stateBox('WIRE DOWN',e.message);
    setBar('#dkWire','offline');
  }
}

/* ============================================================
   THE TERMINAL: chart, snapshot, calendar
   ============================================================ */
const TF={'1D':{range:'1d',interval:'5m'},'5D':{range:'5d',interval:'30m'},
  '1M':{range:'1mo',interval:'1h'},'3M':{range:'3mo',interval:'1d'},
  '6M':{range:'6mo',interval:'1d'},'YTD':{range:'ytd',interval:'1d'},
  '1Y':{range:'1y',interval:'1d'},'5Y':{range:'5y',interval:'1wk'}};
let chart,sMain,sVol,sMa20,sMa50;
const C={sym:'NVDA',tf:'6M',type:'area',vol:false,ma:false,bars:[],meta:null};
let STAGE='chart';

function swapTo(k){
  if(STAGE===k)return;
  STAGE=k;
  $$('#dkStage [data-stage]').forEach(el=>{
    const on=el.dataset.stage===k;
    el.classList.toggle('is-big',on); el.classList.toggle('is-pill',!on);
    el.setAttribute('aria-expanded',on?'true':'false');
  });
  if(k==='chart'&&chart) setTimeout(()=>{try{chart.timeScale().fitContent();}catch(e){}},280);
}
function toChart(sym){
  loadChart(sym); swapTo('chart');
  const s=$('#dkStage'); if(s) s.scrollIntoView({behavior:SLOW?'auto':'smooth',block:'center'});
}
window.deskChart=toChart;

function chartMsg(on,t,d){
  const m=$('#dkMsg'); if(!m)return;
  m.classList.toggle('on',!!on);
  if(on){$('.t',m).textContent=t||'';$('.d',m).textContent=d||'';}
}
function paintChart(){
  const LWC=window.LightweightCharts,host=$('#dkCanvas');
  if(!host)return;
  if(!LWC){chartMsg(true,'CHART LIBRARY MISSING','Lightweight Charts did not load from the CDN.');return;}
  if(!C.bars.length)return;
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
  const box=$('#dkOhlc'); if(!box)return;
  if(!p||!p.time||!sMain||!p.seriesData){writeQuote();return;}
  const d=p.seriesData.get(sMain); if(!d){writeQuote();return;}
  box.innerHTML=d.open!=null
    ?`<span>O <b>${fmt(d.open)}</b></span><span>H <b>${fmt(d.high)}</b></span><span>L <b>${fmt(d.low)}</b></span><span>C <b>${fmt(d.close)}</b></span>`
    :`<span>PRICE <b>${fmt(d.value)}</b></span>`;
}
function writeQuote(){
  const m=C.meta; if(!m)return;
  const chg=(m.price!=null&&m.prevClose)?m.price-m.prevClose:null;
  const cp=m.prevClose?(chg/m.prevClose)*100:null;
  const nm=$('#dkQName'),la=$('#dkQLast'),ch=$('#dkQChg'),oh=$('#dkOhlc');
  if(nm)nm.innerHTML=`${esc(m.name)}<em>${esc(m.symbol)}</em>`;
  if(la)la.textContent=fmt(m.price,(m.price!=null&&m.price<10)?4:2);
  if(ch){ch.className='chg '+dirC(chg);
    ch.textContent=chg==null?'\u2014':`${chg>=0?'+':''}${fmt(chg)}  ${pctf(cp)}`;}
  if(oh)oh.innerHTML=`<span>PREV <b>${fmt(m.prevClose)}</b></span>`
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
    if(my!==seq)return;
    C.bars=d.bars; C.meta=d;
    chartMsg(false); paintChart(); writeQuote(); loadSnapshot(C.sym);
  }catch(e){
    if(my!==seq)return;
    chartMsg(true,'NO DATA',e.message);
  }
}
function wireSymbol(){
  const inp=$('#dkSym'),box=$('#dkSug'); if(!inp)return;
  let rows=[],at=-1,timer;
  const close=()=>{box.classList.remove('on');box.innerHTML='';rows=[];at=-1;};
  const pick=i=>{const r=rows[i];if(!r)return;inp.value='';inp.blur();close();toChart(r.symbol);};
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
      else if(inp.value.trim()){toChart(inp.value.trim());inp.value='';close();}}
    else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!rows.length)return;
      at=(at+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length;
      $$('button',box).forEach((x,i)=>x.classList.toggle('hot',i===at));
      const h=$('.hot',box); if(h)h.scrollIntoView({block:'nearest'});}
    else if(e.key==='Escape'){close();inp.blur();}
  });
  document.addEventListener('click',e=>{if(!e.target.closest('.dk-sym'))close();});
}

/* ---- the snapshot ---- */
let snapSym=null;
async function loadSnapshot(sym){
  const host=$('#dkSnap'); if(!host||!sym)return;
  if(snapSym===sym)return;
  snapSym=sym;
  /* ETFs, indices, futures and crypto have no company file. Saying so is
     better than rendering one lonely metric and calling it a snapshot. */
  if(/[\^=]/.test(sym)||sym.indexOf('-')>-1){
    host.innerHTML=stateBox('NOT A COMPANY',
      sym+' is an index, fund or pair. Chart an individual stock to see fundamentals here.');
    setBar('#dkSnap','n/a'); return;
  }
  host.innerHTML='<div class="dk-skel"></div><div class="dk-skel"></div><div class="dk-skel"></div>';
  setBar('#dkSnap','loading');
  try{
    const d=await get('/v1/company?symbol='+encodeURIComponent(sym));
    const p=d.profile||{},m=(d.metric&&d.metric.metric)||{},rec=(d.rec&&d.rec[0])||null;
    const rows=[
      ['Market cap',p.marketCapitalization?'$'+big(p.marketCapitalization*1e6):null,'What the whole company is priced at'],
      ['P/E',m.peTTM!=null?fmt(m.peTTM,1):null,'Paid per dollar of annual profit'],
      ['Net margin',m.netProfitMarginTTM!=null?fmt(m.netProfitMarginTTM,1)+'%':null,'Kept from every revenue dollar'],
      ['Revenue growth',m.revenueGrowthTTMYoy!=null?pctf(m.revenueGrowthTTMYoy):null,'Sales versus a year ago'],
      ['Debt / equity',m['totalDebt/totalEquityQuarterly']!=null?fmt(m['totalDebt/totalEquityQuarterly'],2):null,'Borrowed against owned'],
      ['52 week range',(m['52WeekLow']!=null&&m['52WeekHigh']!=null)?fmt(m['52WeekLow'])+' to '+fmt(m['52WeekHigh']):null,'Where it has traded this year']
    ].filter(r=>r[1]!=null);
    if(rows.length<2&&!p.name) throw new Error('No fundamentals are published for '+sym+'.');

    let street='';
    if(rec){
      const tot=(rec.strongBuy||0)+(rec.buy||0)+(rec.hold||0)+(rec.sell||0)+(rec.strongSell||0);
      if(tot){
        const bull=((rec.strongBuy||0)+(rec.buy||0))/tot*100;
        const bear=((rec.sell||0)+(rec.strongSell||0))/tot*100;
        street=`<div class="snap-street"><span class="k">Analyst split</span>
          <span class="bar"><i class="b" style="width:${bull.toFixed(0)}%"></i><i class="h" style="width:${(100-bull-bear).toFixed(0)}%"></i><i class="s" style="width:${bear.toFixed(0)}%"></i></span>
          <span class="lg"><b class="up">${bull.toFixed(0)}% buy</b> \u00b7 ${(100-bull-bear).toFixed(0)}% hold \u00b7 <b class="dn">${bear.toFixed(0)}% sell</b></span></div>`;
      }
    }
    host.innerHTML=`<div class="snap-id"><b>${esc(p.name||sym)}</b>
      <span>${esc(p.finnhubIndustry||'')}${p.exchange?' \u00b7 '+esc(String(p.exchange).split(' ')[0]):''}</span></div>
      <div class="snap-grid">${rows.map(r=>`<div class="snap-m">
        <span class="k">${esc(r[0])}</span><span class="v">${esc(r[1])}</span>
        <span class="h">${esc(r[2])}</span></div>`).join('')}</div>${street}
      <button class="snap-go" id="snapGo">Open the full file on ${esc(sym)} \u2192</button>`;
    const go=$('#snapGo');
    if(go)go.addEventListener('click',()=>{
      goSection('ledger');
      setTimeout(()=>{
        const i=$('#ldSearch')||$('#ledgerSearch')||$('#ledger input[type="search"]')||$('#ledger input[type="text"]');
        if(i){i.value=sym;i.focus();
          i.dispatchEvent(new Event('input',{bubbles:true}));
          i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));}
      },280);
    });
    setBar('#dkSnap',esc(sym));
  }catch(e){
    host.innerHTML=stateBox('NO FUNDAMENTALS',e.message);
    setBar('#dkSnap','offline');
  }
}

/* ---- the economic calendar ---- */
const DAYF=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'});
async function loadEcon(){
  const host=$('#dkEcon'); if(!host)return;
  try{
    const d=await get('/v1/econ?days=8'),evs=d.events||[];
    const by={}; evs.forEach(e=>(by[e.date]=by[e.date]||[]).push(e));
    const today=new Date().toISOString().slice(0,10);
    const sched=String(d.src||'').indexOf('official-schedule')>-1;
    host.innerHTML=(sched?`<p class="dk-srcnote">Consensus and actual figures were unavailable, so this is the official release schedule from the agencies that publish the data.</p>`:'')
      +Object.keys(by).sort().map(day=>{
        const rows=by[day].sort((a,b)=>b.impact-a.impact||String(a.time).localeCompare(String(b.time)));
        return `<div class="dk-day ${day===today?'today':''}">${day===today?'Today \u00b7 ':''}${esc(DAYF.format(new Date(day+'T12:00:00Z')))}</div>`
          +rows.map(e=>{
            const f=[];
            if(e.actual)f.push(`<span class="act">ACTUAL <b>${esc(e.actual)}</b></span>`);
            if(e.consensus)f.push(`<span>EST <b>${esc(e.consensus)}</b></span>`);
            if(e.previous)f.push(`<span>PRIOR <b>${esc(e.previous)}</b></span>`);
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
   CROSS REFERENCING
   A term inside an entry opens that entry directly, and the
   modal keeps a trail so you can walk back out the way you came.
   The three detail modals are wrapped and called through, so
   their own render logic is untouched.
   ============================================================ */
const ENC=T.ENCYCLOPEDIA||[],PAT=T.PATTERNS||[],IND=T.INDICATORS||[],STR=T.STRATEGIES||[];
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const byTitle={}; ENC.forEach((e,i)=>{byTitle[norm(e.t)]=i;});
/* the text says "the greeks" where the entry is "Greeks", and "IV" where the
   entry is "Implied Volatility". Without aliases the link rate is about a
   third of what it should be. */
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
      if(!n.nodeValue||n.nodeValue.trim().length<4)return NodeFilter.FILTER_REJECT;
      if(n.parentElement&&n.parentElement.closest('button,a,.xr'))return NodeFilter.FILTER_REJECT;
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
    /* crossing libraries is the point of the feature, so a hit in another
       dataset beats one more entry in the same list */
    if(kind!=='enc')sc*=1.4; if(sc>=3)out.push({kind,name,sc,run});
  };
  ENC.forEach((e,i)=>consider('enc',e.t,(e.cat||'')+' '+(e.tag||''),()=>jumpEnc(i,title)));
  PAT.forEach((p,i)=>consider('pattern',p.n,p.cat,()=>{closeAll();window.openPattern(i);}));
  IND.forEach(x=>consider('indicator',x.n||x.name,x.cat,()=>{closeAll();goSection('indicators');}));
  STR.forEach((s,i)=>consider('strategy',s.n,(s.fam||'')+' '+(s.alias||''),()=>{closeAll();window.openStrat(i);}));
  if(out.length<3&&cat)ENC.forEach((e,i)=>{
    if(e.cat===cat&&norm(e.t)!==norm(title)&&out.length<6)out.push({kind:'enc',name:e.t,sc:1,run:()=>jumpEnc(i,title)});
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
  if(typeof _e==='function')window.openEnc=function(i){
    if(!inXref)TRAIL=[];
    _e.apply(this,arguments);
    const e=ENC[i];if(!e)return;const b=$('#encBody');if(!b)return;
    try{renderTrail();linkTerms(b,e.t);attachAlso(b,e.t,e.cat);}catch(err){}
  };
  const _p=window.openPattern;
  if(typeof _p==='function')window.openPattern=function(i){
    _p.apply(this,arguments);
    const p=PAT[i];if(!p)return;const b=$('#pdBody');if(!b)return;
    try{linkTerms(b,p.n);attachAlso(b,p.n,null);}catch(err){}
  };
  const _s=window.openStrat;
  if(typeof _s==='function')window.openStrat=function(i){
    _s.apply(this,arguments);
    const s=STR[i];if(!s)return;const b=$('#sdBody');if(!b)return;
    try{attachAlso(b,s.n,null);}catch(err){}
  };
  /* Escape walks back one step before it closes, which is what a trail implies */
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    const m=$('#m-enc');
    if(m&&m.classList.contains('open')&&TRAIL.length){e.stopPropagation();goBack();}
  },true);
}

/* ============================================================
   OPTION ENTRY PLAYBOOKS
   The structures module explains the shape. This bolts the
   how-to onto the same panel: the exact legs in entry order,
   what it costs, what manages it, what closes it, and who it is
   actually appropriate for.
   ============================================================ */
const PLAYS=T.OPT_PLAYS||{},TIERS=T.OPT_TIERS||{};
function injectPlay(){
  const host=$('#optRead')||$('#optDetail')||$('#osBody')||$('#optBody')||$('#opt-detail');
  const id=(window.OPT&&window.OPT.id)||null;
  if(!host||!id)return;
  const p=PLAYS[id]; if(!p)return;
  if(host.dataset.play===id)return;
  host.dataset.play=id;
  const old=$('.play',host); if(old)old.remove();
  const t=TIERS[p.tier]||['',''];
  const box=document.createElement('div');
  box.className='play';
  box.innerHTML=`<div class="play-h"><span class="ph">How you actually put it on</span>
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
    <p class="play-foot">Every figure is priced on the same imaginary $100 stock so the structures compare side by side. Real premiums move with implied volatility, so treat them as proportions rather than quotes.</p>`;
  host.appendChild(box);
}
function watchOptions(){
  /* the structure panel is re-rendered by the existing app, so rather than
     reaching into its render function this watches the container and
     re-attaches whenever the contents change */
  const host=$('#optRead')||$('#optDetail')||$('#osBody')||$('#optBody')||$('#opt-detail');
  if(!host)return;
  new MutationObserver(()=>{try{host.dataset.play='';injectPlay();}catch(e){}}).observe(host,{childList:true});
  setTimeout(injectPlay,500);
}

/* ============================================================
   STRATEGY SECTION HIERARCHY
   The group headers sat at almost the same weight as the cards
   beneath them, so the page read as one long run of tiles. This
   promotes each into a real divider and pulls dealer flow into
   its own band at the end, because its mechanism is structural
   rather than behavioural.
   ============================================================ */
function enhanceStrats(){
  const grid=$('#sGrid'); if(!grid)return;
  const apply=()=>{
    let n=0;
    $$('.sgroup',grid).forEach(g=>{
      const label=(($('.sgh b',g)||{}).textContent||'').toLowerCase();
      const isGex=label.indexOf('dealer')>-1;
      if(!g.dataset.dk){
        g.dataset.dk='1';
        const h=$('.sgh',g);
        if(h&&!$('.sgh-i',h)){
          const i=document.createElement('span');
          i.className='sgh-i'; i.textContent=isGex?'\u2726':String(++n).padStart(2,'0');
          h.insertBefore(i,h.firstChild);
        }
      } else if(!isGex){ n++; }
      if(isGex&&!g.classList.contains('sgroup-gex')){
        g.classList.add('sgroup-gex');
        grid.appendChild(g);
      }
    });
  };
  apply();
  new MutationObserver(apply).observe(grid,{childList:true});
}

/* ============================================================
   MOTION
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
    $$('.dk-cq .last, .idx-row .v').forEach(el=>{
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
  const trk=$('#tapeTrack'); if(!trk)return;
  const tag=()=>$$('#tapeTrack i').forEach(i=>{
    const b=$('b',i); if(b&&!i.dataset.sym)i.dataset.sym=b.textContent.trim();
  });
  tag(); new MutationObserver(tag).observe(trk,{childList:true});
  trk.addEventListener('click',e=>{
    const i=e.target.closest('i'); if(i&&i.dataset.sym)toChart(i.dataset.sym);
  });
}

/* ============================================================
   BOOT
   ============================================================ */
function init(){
  installXref(); wireSymbol(); wireTape(); watchOptions(); enhanceStrats(); reveals();
  if(!SLOW) watchNumbers();

  $$('#dkStage [data-stage]').forEach(el=>{
    el.classList.add(el.dataset.stage===STAGE?'is-big':'is-pill');
    const bar=$('.dk-bar',el);
    if(bar)bar.addEventListener('click',e=>{
      if(e.target.closest('input,.dk-sym,#dkTf'))return;
      swapTo(el.dataset.stage);
    });
  });
  $$('#dkTf button').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    if(b.dataset.tf){$$('#dkTf [data-tf]').forEach(x=>x.classList.toggle('on',x===b));loadChart(C.sym,b.dataset.tf);}
    else if(b.dataset.type){$$('#dkTf [data-type]').forEach(x=>x.classList.toggle('on',x===b));C.type=b.dataset.type;paintChart();}
    else if(b.dataset.tog){C[b.dataset.tog]=!C[b.dataset.tog];b.classList.toggle('on',C[b.dataset.tog]);paintChart();}
  }));
  $$('#rotScope button').forEach(b=>b.addEventListener('click',()=>{
    $$('#rotScope button').forEach(x=>x.classList.toggle('on',x===b));
    ROT.scope=b.dataset.scope; ROT.drill=null; rotBuild(); rotDraw();
  }));
  $$('#rotTf button').forEach(b=>b.addEventListener('click',()=>{
    $$('#rotTf button').forEach(x=>x.classList.toggle('on',x===b));
    ROT.tf=ROT_TF[b.dataset.rtf]||5; rotBuild(); rotDraw();
  }));
  const back=$('#rotBack'); if(back)back.addEventListener('click',rotBackOut);

  loadChart('NVDA','6M');
  loadWire(); loadRead(); loadEcon();

  /* The Rotation pulls a year of closes for forty symbols, so it waits until
     it is actually about to be seen rather than competing with the panels
     above it for the first paint. */
  const rotHost=$('#rotPlot');
  if(rotHost){
    if(SLOW || !('IntersectionObserver' in window)) rotLoad();
    else {
      const ro=new IntersectionObserver(es=>{
        if(es.some(e=>e.isIntersecting)){ ro.disconnect(); rotLoad(); }
      },{rootMargin:'400px 0px'});
      ro.observe(rotHost);
    }
  }

  everyVisible(loadWire,60000);
  everyVisible(loadRead,900000);
  everyVisible(loadEcon,900000);
  everyVisible(()=>loadChart(),120000);
  addEventListener('hashchange',()=>setTimeout(reveals,60));
  let rz; addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(ROT.set)rotDraw();},240);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();
