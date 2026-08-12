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
/* Read one body at a playhead position. The playhead is a FLOAT, so replay
   interpolates between two sessions rather than snapping from one to the
   next. That single change is the difference between a slideshow and motion. */
function rotAt(s,tailLen,head){
  const L=s.ratio.length;
  const h=head==null?L-1:Math.max(0,Math.min(L-1,head));
  const i=Math.floor(h), f=h-i, j=Math.min(L-1,i+1);
  const lerp=(a,b)=>a+(b-a)*f;
  const tail=[];
  for(let k=Math.max(0,i-tailLen+1);k<=i;k++) tail.push({x:s.ratio[k],y:s.mom[k]});
  tail.push({x:lerp(s.ratio[i],s.ratio[j]), y:lerp(s.mom[i],s.mom[j])});
  const c=s.closes, back=Math.max(0,i-5);
  return {x:lerp(s.ratio[i],s.ratio[j]), y:lerp(s.mom[i],s.mom[j]), tail,
          ret:c[back]>0?(c[i]/c[back]-1):0};
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
let ROT={set:null,closes:{},scope:'all',drill:null,tf:5,tail:ROT_TAIL,
         trail:'one',focus:null,head:null,playing:false};
const ROT_TF={fast:3,normal:5,slow:10};

async function rotLoad(){
  const host=$('#rotPlot'); if(!host) return;
  const need=new Set([ROT_BENCH]);
  if(ROT.drill){
    /* drilled in: the benchmark, the sector ETFs that anchor the scale, and
       only THIS group's members. Queueing every group's members here was
       about a hundred symbols for a view that shows eight. */
    ROT_GROUPS.filter(g=>g.cat==='sector'&&g.etf).forEach(g=>need.add(g.etf));
    const grp=ROT_GROUPS.find(g=>g.sym===ROT.drill);
    if(grp) grp.members.forEach(m=>need.add(m));
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
    const res=await get('/v1/closes?symbols='+encodeURIComponent(syms.join(',')));
    ROT.closes=res.closes||{};
    if(!ROT.closes[ROT_BENCH]) throw new Error('No history came back for the benchmark, '+ROT_BENCH+'.');
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
  ROT.head=null;   /* a new set means a new timeline, so snap back to live */
}
function rotName(k){
  const g=ROT_GROUPS.find(x=>x.sym===k||x.etf===k);
  return g?g.name:k;
}
/* Extent of what is on screen at this playhead, with a floor so a quiet
   field still fills the plot. Extra pad keeps tails inside the box. */
function rotBounds(set,head){
  let mx=2.4, my=2.4;
  Object.keys(set.bodies).forEach(k=>{
    const a=rotAt(set.bodies[k],ROT.tail,head);
    a.tail.concat([{x:a.x,y:a.y}]).forEach(p=>{
      const dx=Math.abs(p.x-100), dy=Math.abs(p.y-100);
      if(dx>mx) mx=dx; if(dy>my) my=dy;
    });
  });
  return {rx:mx*1.18, ry:my*1.18};
}
function rotMakeScale(set){
  const {W,H,P}=set.dims, rx=set.rx, ry=set.ry;
  set.scale={
    W,H,
    sx:v=>(P+((v-100+rx)/(2*rx))*(W-P*2)).toFixed(1),
    sy:v=>(H-P-((v-100+ry)/(2*ry))*(H-P*2)).toFixed(1)
  };
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
  const L=set.len;
  if(ROT.head==null) ROT.head=L-1;
  ROT.head=Math.max(set.minIdx,Math.min(L-1,ROT.head));

  const pts=keys.map(k=>{ const a=rotAt(set.bodies[k],ROT.tail,ROT.head);
    return {k,x:a.x,y:a.y,tail:a.tail,ret:a.ret,phase:rotPhase(a.x,a.y),q:rotQuality(a.tail)}; });

  /* Scale to the current playhead so the field stays readable. Scale is
     snapped (not eased) in rotStep so tails do not visually slide. */
  const W=620,H=460,P=36;
  set.dims={W,H,P};
  const tgt=rotBounds(set,ROT.head);
  set.rx=tgt.rx; set.ry=tgt.ry;
  rotMakeScale(set);
  const sx=set.scale.sx, sy=set.scale.sy;

  /* Markers are sized in viewBox units, and the SVG stretches to its
     container, so a fixed radius looked like a beach ball on a wide screen.
     Everything below scales down as the field gets crowded and is drawn with
     vector-effect so strokes stay hairline at any width. */
  /* A rotation map is read by POSITION, so a marker only has to be findable,
     not big: past a certain size it hides the very neighbours you are
     comparing it against. */
  /* Markers are kept small so position (not size) carries the information.
     Intermediate tail dots were removed: they were only written on full redraw
     and never updated in rotStep, which left orphan circles behind during replay. */
  const dense=Math.min(1,14/Math.max(8,keys.length));
  const R=2.4+dense*0.9, HALO=R*1.7, FS=(6.5+dense*1.2).toFixed(1);

  const bodies=pts.map((p,i)=>{
    const col=PHASE_COL[p.phase];
    const dim=ROT.focus&&ROT.focus!==p.k;
    const showTail=ROT.trail==='all'||!ROT.focus||ROT.focus===p.k;
    const path=p.tail.map((t,j)=>`${j?'L':'M'}${sx(t.x)} ${sy(t.y)}`).join(' ');
    return `<g class="rot-b${dim?' dim':''}" data-k="${esc(p.k)}" data-i="${i}" tabindex="0" role="button"
        aria-label="${esc(rotName(p.k))}, ${p.phase}" style="--c:rgb(${col});--d:${i*32}ms">
      ${showTail?`<path class="tail" d="${path}" stroke="rgba(${col},.5)" fill="none"
        stroke-width="1.15" vector-effect="non-scaling-stroke"/>`:''}
      <circle class="halo" cx="${sx(p.x)}" cy="${sy(p.y)}" r="${HALO.toFixed(1)}" fill="rgba(${col},.14)"/>
      <circle class="core" cx="${sx(p.x)}" cy="${sy(p.y)}" r="${R.toFixed(1)}" fill="rgb(${col})"/>
      <text x="${sx(p.x)}" y="${(+sy(p.y)-HALO-2).toFixed(1)}" text-anchor="middle"
        font-size="${FS}">${esc(p.k)}</text>
    </g>`;
  }).join('');

  const dateLab = ROT.head>=L-1 ? 'Latest close' : (L-1-ROT.head)+' sessions back';

  host.innerHTML=`<div class="rot-wrap">
    <div class="rot-main">
      <svg class="rot-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"
           role="img" aria-label="Relative rotation map">
        <rect x="${W/2}" y="${P}" width="${W/2-P}" height="${H/2-P}" fill="rgb(52,211,153)" opacity=".05"/>
        <rect x="${W/2}" y="${H/2}" width="${W/2-P}" height="${H/2-P}" fill="rgb(242,193,78)" opacity=".05"/>
        <rect x="${P}" y="${H/2}" width="${W/2-P}" height="${H/2-P}" fill="rgb(232,121,249)" opacity=".05"/>
        <rect x="${P}" y="${P}" width="${W/2-P}" height="${H/2-P}" fill="rgb(34,211,238)" opacity=".05"/>
        <line x1="${P}" y1="${H/2}" x2="${W-P}" y2="${H/2}" stroke="rgba(126,166,214,.28)" vector-effect="non-scaling-stroke"/>
        <line x1="${W/2}" y1="${P}" x2="${W/2}" y2="${H-P}" stroke="rgba(126,166,214,.28)" vector-effect="non-scaling-stroke"/>
        <text class="rot-q" x="${W-P-6}" y="${P+13}" text-anchor="end" fill="rgb(52,211,153)">LEADING</text>
        <text class="rot-q" x="${W-P-6}" y="${H-P-6}" text-anchor="end" fill="rgb(242,193,78)">WEAKENING</text>
        <text class="rot-q" x="${P+6}" y="${H-P-6}" fill="rgb(232,121,249)">LAGGING</text>
        <text class="rot-q" x="${P+6}" y="${P+13}" fill="rgb(34,211,238)">IMPROVING</text>
        <text class="rot-ax" x="${W-P}" y="${H/2+14}" text-anchor="end">RS-RATIO \u2192</text>
        <text class="rot-ax" x="${W/2+8}" y="${P-8}">\u2191 RS-MOMENTUM</text>
        <g class="rot-bodies">${bodies}</g>
      </svg>
      <div class="rot-scrub">
        <button class="rot-play" id="rotPlay" aria-label="Play the rotation">${ROT.playing?'\u25a0':'\u25b6'}</button>
        <input type="range" id="rotHead" min="${set.minIdx}" max="${L-1}" step="0.1" value="${ROT.head}"
               aria-label="Replay position">
        <span class="rot-date" id="rotDate">${dateLab}</span>
        <button class="rot-now" id="rotNow">Now</button>
      </div>
    </div>
    <div class="rot-side">
      <div class="rot-read" id="rotRead"></div>
      <div class="rot-list" id="rotList"></div>
    </div>
  </div>`;

  rotSay(ROT.focus?pts.find(p=>p.k===ROT.focus):null);
  $('#rotList').innerHTML=pts.slice().sort((a,b)=>(b.x-100)-(a.x-100))
    .map(p=>`<button class="rot-li${ROT.focus===p.k?' on':''}" data-k="${esc(p.k)}"
      style="--c:rgb(${PHASE_COL[p.phase]})">
      <span class="d"></span><span class="s">${esc(p.k)}</span>
      <span class="p">${p.phase}</span></button>`).join('');

  const byK={}; pts.forEach(p=>byK[p.k]=p);
  const hook=el=>{
    const k=el.dataset.k;
    el.addEventListener('mouseenter',()=>{ROT.focus=k;rotSay(byK[k]);rotDim();});
    el.addEventListener('mouseleave',()=>{ROT.focus=null;rotSay(null);rotDim();});
    el.addEventListener('focus',()=>{ROT.focus=k;rotSay(byK[k]);rotDim();});
    el.addEventListener('click',()=>rotClick(k));
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();rotClick(k);}});
  };
  $$('.rot-b',host).forEach(hook);
  $$('.rot-li',host).forEach(hook);

  /* replay */
  const head=$('#rotHead');
  /* Dragging moves the existing nodes rather than rebuilding the plot, so the
     field animates under the cursor instead of redrawing once per notch. */
  head.addEventListener('input',()=>{ ROT.head=+head.value; rotStop(); rotStep(); });
  $('#rotNow').addEventListener('click',()=>{ ROT.head=L-1; rotStop(); rotStep(); });
  $('#rotPlay').addEventListener('click',rotToggle);

  setBar('#rotPlot',(ROT.drill?rotName(ROT.drill)+' \u00b7 ':'')+keys.length+' bodies');
  const back=$('#rotBack'); if(back) back.style.display=ROT.drill?'':'none';
}
/* dim everything except the focused body, without a full redraw */
function rotDim(){
  $$('.rot-b').forEach(g=>g.classList.toggle('dim',!!ROT.focus&&g.dataset.k!==ROT.focus));
  $$('.rot-li').forEach(b=>b.classList.toggle('on',ROT.focus===b.dataset.k));
}
/* the side panel: what the hovered body actually means */
function rotSay(p){
  const el=$('#rotRead'); if(!el)return;
  if(!p){
    el.innerHTML=`<span class="k">The map</span><span class="v">Relative rotation</span>
      <p>Each body is measured against SPY, then scored across the sector field so a utility and a semiconductor basket are comparable. Right of centre is outperforming, above centre is accelerating. The trail is the last six sessions, and money tends to travel clockwise.</p>
      <small>Hover a body to read it. Click a sector to open its constituents.</small>`;
    return;
  }
  const q=p.q;
  const spin=q?(q.dir==='cw'?'Rotating clockwise, the normal direction.'
    :q.dir==='ccw'?'Rotating counter-clockwise, which is unusual and often marks a failed move.'
    :'Barely rotating. This is drift rather than a real move.'):'';
  const clean=q?(q.quality>0.55?'The path is a clean arc, so the rotation is real.'
    :q.quality>0.28?'The path is uneven. Treat it as a lean, not a signal.'
    :'The path is a scribble. That is jitter across a boundary, not rotation.'):'';
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
/* dim everything except the focused body, without a full redraw */
function rotDim(){
  $$('.rot-b').forEach(g=>g.classList.toggle('dim',!!ROT.focus&&g.dataset.k!==ROT.focus));
  $$('.rot-li').forEach(b=>b.classList.toggle('on',ROT.focus===b.dataset.k));
}
/* click a group to open its constituents; click anything else to chart it */
function rotClick(k){
  const g=ROT_GROUPS.find(x=>x.sym===k);
  if(!ROT.drill && g && g.members && g.members.length>2){
    rotStop(); ROT.drill=k; ROT.head=null;
    const host=$('#rotPlot');
    if(host) host.innerHTML='<div class="dk-skel"></div><div class="dk-skel"></div><div class="dk-skel"></div>';
    rotLoad(); return;
  }
  /* a group charts its ETF where one exists, since a synthetic basket has no
     ticker of its own */
  toChart(g && g.etf ? g.etf : k);
}

/* leave a drill-down and return to the full field */
function rotBackOut(){ rotStop(); ROT.drill=null; ROT.head=null; rotLoad(); }

/* ---- replay ----------------------------------------------------------
   A setInterval that redrew a whole frame every 110ms is a slideshow. This runs
   on requestAnimationFrame and advances a FRACTIONAL playhead by elapsed
   time, so bodies travel between sessions instead of teleporting. It also
   moves the existing SVG nodes rather than rebuilding them, which is what
   keeps sixty frames a second affordable. */
let rotRaf=null, rotLast=0;
const ROT_SPEED=3.2;              /* sessions per second */
function rotToggle(){ ROT.playing?rotStop():rotStart(); }
function rotStart(){
  if(!ROT.set)return;
  const L=ROT.set.len;
  if(ROT.head>=L-1) ROT.head=ROT.set.minIdx;
  ROT.playing=true;
  const btn=$('#rotPlay'); if(btn) btn.textContent='\u25a0';
  rotLast=performance.now();
  const frame=now=>{
    if(!ROT.playing)return;
    const dt=Math.min(.1,(now-rotLast)/1000); rotLast=now;
    ROT.head+=dt*ROT_SPEED;
    if(ROT.head>=L-1){ ROT.head=L-1; rotStep(); rotStop(); return; }
    rotStep();
    rotRaf=requestAnimationFrame(frame);
  };
  rotRaf=requestAnimationFrame(frame);
}
function rotStop(){
  ROT.playing=false;
  if(rotRaf){cancelAnimationFrame(rotRaf);rotRaf=null;}
  const btn=$('#rotPlay'); if(btn) btn.textContent='\u25b6';
}
/* One frame. The axis scale is computed once per SET, not per frame, because
   a rescaling axis makes every body drift even when it has not moved. */
function rotStep(){
  const set=ROT.set; if(!set||!set.scale)return;
  const L=set.len;
  /* Snap scale to the current playhead (no easing). Easing made tails
     appear to drift; locking to full history crushed everything into the
     centre. Snapping keeps the field readable and the paths stable. */
  const tgt=rotBounds(set,ROT.head);
  set.rx=tgt.rx; set.ry=tgt.ry;
  rotMakeScale(set);
  const {sx,sy}=set.scale;
  Object.keys(set.bodies).forEach(k=>{
    const g=document.querySelector('.rot-b[data-k="'+CSS.escape(k)+'"]'); if(!g)return;
    const a=rotAt(set.bodies[k],ROT.tail,ROT.head);
    const ph=rotPhase(a.x,a.y), col=PHASE_COL[ph];
    const cx=sx(a.x), cy=sy(a.y);
    const core=g.querySelector('.core'), halo=g.querySelector('.halo'),
          txt=g.querySelector('text'), tl=g.querySelector('.tail');
    if(core){core.setAttribute('cx',cx);core.setAttribute('cy',cy);core.setAttribute('fill','rgb('+col+')');}
    if(halo){halo.setAttribute('cx',cx);halo.setAttribute('cy',cy);halo.setAttribute('fill','rgba('+col+',.14)');}
    if(txt){txt.setAttribute('x',cx);txt.setAttribute('y',(+cy-(+halo.getAttribute('r'))-2).toFixed(1));
            txt.setAttribute('fill','rgb('+col+')');}
    if(tl){tl.setAttribute('d',a.tail.map((p,j)=>(j?'L':'M')+sx(p.x)+' '+sy(p.y)).join(' '));
           tl.setAttribute('stroke','rgba('+col+',.5)');}
    g.style.setProperty('--c','rgb('+col+')');
  });
  const hd=$('#rotHead'); if(hd) hd.value=ROT.head;
  const dt=$('#rotDate');
  if(dt) dt.textContent = ROT.head>=L-1?'Latest close':Math.round(L-1-ROT.head)+' sessions back';
}

/* ============================================================
   THE READ
   Market conditions, not market prices. Three questions: how
   nervous is the options market, are dealers amplifying moves or
   damping them, and is the move broad or narrow.

   The VIX half is public data and comes straight from the quote
   feed. The gamma half comes from Kairos through a deliberately
   coarse channel: prior close, buckets, never a level. Enough to
   teach what dealer positioning does to a tape, not enough to
   trade off, which is the point.
   ============================================================ */
const GAMMA_SAY={
  short:['Dealers are short gamma','They hedge in the direction of the move, which amplifies it. Trends extend, dips get sold harder, and ranges break more often than they hold.'],
  long: ['Dealers are long gamma','They hedge against the move, which damps it. Rallies get sold and dips get bought mechanically, so price compresses and reverts toward the middle.']
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

  /* VIX comes straight from the quote feed rather than through Kairos. The
     whole term structure is public data, so routing it through the private
     channel made the panel depend on a cron that has nothing to do with it. */
  let vix=null, gamma=null, breadth=null, tnx=null;
  try{
    const q=(await get('/v1/yquote?symbols=^VIX,^VIX9D,^VIX3M,^TNX')).quotes||{};
    const g=s=>q[s]&&q[s].c!=null?q[s].c:null;
    const spot=g('^VIX');
    if(spot) vix={spot, v9d:g('^VIX9D'), v3m:g('^VIX3M'), chg:q['^VIX']?q['^VIX'].dp:null};
    tnx=g('^TNX');
  }catch(e){}
  try{ const r=await get('/v1/read'); if(r&&r.symbols) gamma=r; }catch(e){}
  try{
    const d=await get('/v1/strength'); const rows=d.rows||[];
    if(rows.length) breadth={adv:rows.filter(r=>r.m1>0).length, tot:rows.length,
      top:rows.slice(0,3).map(r=>r.symbol), bot:rows.slice(-3).map(r=>r.symbol)};
  }catch(e){}

  if(!vix&&!breadth&&!gamma){
    host.innerHTML=stateBox('THE READ IS OFFLINE','No condition feed is reachable right now.');
    setBar('#dkRead','offline'); return;
  }

  /* the headline: one sentence, assembled only from what is actually true */
  const clauses=[];
  if(vix){
    clauses.push(vix.spot<14?'volatility is priced cheap'
      :vix.spot<20?'volatility is priced normally'
      :vix.spot<28?'volatility is bid':'volatility is being paid for aggressively');
    if(vix.v3m) clauses.push(vix.spot>vix.v3m
      ?'the curve is inverted, which is the shape stress makes'
      :'the curve is in its normal shape');
  }
  if(breadth){
    const p=breadth.adv/breadth.tot;
    clauses.push((clauses.length?'and ':'')+(p>=.7?'participation is broad'
      :p>=.45?'participation is mixed'
      :p>=.25?'a minority of the market is carrying it'
      :'almost nothing is participating'));
  }
  if(gamma&&gamma.symbols&&gamma.symbols.SPY)
    clauses.push('with dealers positioned to '+(gamma.symbols.SPY.gammaSign==='short'?'amplify':'damp')+' moves');
  const headline=clauses.length?clauses.join(', ').replace(/^./,c=>c.toUpperCase())+'.':'';

  const cards=[];

  if(vix){
    const v=vix.spot;
    const band=v<14?['Calm','The options market is pricing small daily moves. Protection is cheap, and so is complacency.']
      :v<20?['Normal','Ordinary two-way risk. Nothing in the volatility surface is shouting.']
      :v<28?['Elevated','The market is paying up for protection. Size should come down before conviction does.']
      :['Stressed','Fear is being bought aggressively. Historically these readings mark the middle of a move, not the end.'];
    const inv=vix.v3m&&v>vix.v3m;
    const front=vix.v9d&&v?vix.v9d/v:null;
    const pts=[['9D',vix.v9d],['30D',v],['3M',vix.v3m]].filter(x=>x[1]!=null);
    let curve='';
    if(pts.length>=2){
      const vals=pts.map(p=>p[1]);
      const lo=Math.min(...vals)*.94, hi=Math.max(...vals)*1.06;
      const W=210,H=58, px=i=>10+(i/(pts.length-1))*(W-20), py=x=>H-10-((x-lo)/(hi-lo))*(H-24);
      curve=`<svg class="vx-curve" viewBox="0 0 ${W} ${H}" role="img" aria-label="VIX term structure">
        <path d="${pts.map((p,i)=>(i?'L':'M')+px(i).toFixed(1)+' '+py(p[1]).toFixed(1)).join(' ')}"
          fill="none" stroke="${inv?'var(--red)':'var(--cyan)'}" stroke-width="2"/>
        ${pts.map((p,i)=>`<circle cx="${px(i).toFixed(1)}" cy="${py(p[1]).toFixed(1)}" r="3"
          fill="${inv?'var(--red)':'var(--cyan)'}"/>
          <text x="${px(i).toFixed(1)}" y="${H-1}" text-anchor="middle" class="vx-lab">${p[0]}</text>
          <text x="${px(i).toFixed(1)}" y="${(py(p[1])-7).toFixed(1)}" text-anchor="middle" class="vx-val">${fmt(p[1],1)}</text>`).join('')}
      </svg>`;
    }
    cards.push(`<div class="rd-card">
      <div class="rd-h"><span class="rd-t">Volatility</span>
        <span class="rd-v ${dirC(vix.chg)}">${fmt(v,2)}</span></div>
      <div class="rd-scale"><i style="left:${Math.max(0,Math.min(100,(v/45)*100)).toFixed(1)}%"></i>
        <span>10</span><span>20</span><span>30</span><span>45</span></div>
      <div class="rd-row"><b>${band[0]}</b><p>${band[1]}</p></div>
      ${curve}
      <div class="rd-row"><b>${inv?'Backwardation':'Contango'}</b>
        <p>${inv?'Near-term volatility costs more than far-term, which happens when something is wrong right now. This is the shape that marks stress.'
                :'Far-term volatility costs more than near-term, the normal shape. The market expects today to be calmer than next quarter.'}</p>
        ${front?`<span class="rd-sub">Front pressure ${front.toFixed(2)}, nine-day against thirty-day.</span>`:''}</div>
    </div>`);
  }

  if(gamma&&gamma.symbols&&Object.keys(gamma.symbols).length){
    cards.push(`<div class="rd-card">
      <div class="rd-h"><span class="rd-t">Dealer positioning</span>
        <span class="rd-tag">prior close</span></div>
      ${Object.keys(gamma.symbols).map(s=>{
        const x=gamma.symbols[s], g=GAMMA_SAY[x.gammaSign]||['',''];
        const f=x.flipBucket?FLIP_SAY[x.flipBucket]:null, c=x.concentration?CONC_SAY[x.concentration]:null;
        return `<div class="rd-sym">
          <div class="rd-sh"><b>${esc(s)}</b>
            <span class="rd-pill ${x.gammaSign}">${x.gammaSign==='short'?'SHORT GAMMA':'LONG GAMMA'}</span>
            ${x.dayCount>1?`<span class="rd-days">${x.dayCount} sessions</span>`:''}</div>
          <p>${g[1]}</p>
          <div class="rd-mini">${f?`<span><b>${f[0]}</b>${f[1]}</span>`:''}${c?`<span><b>${c[0]} book</b>${c[1]}</span>`:''}</div>
        </div>`;}).join('')}
      <p class="rd-note">Deliberately coarse and one session behind. The point is the mechanism, not a level to trade against.</p>
    </div>`);
  } else {
    cards.push(`<div class="rd-card">
      <div class="rd-h"><span class="rd-t">Dealer positioning</span><span class="rd-tag">waiting</span></div>
      <div class="rd-row"><b>Not published yet</b>
        <p>Dealers hedge the options they sell, and that hedging is mechanical rather than discretionary. Short gamma amplifies a move; long gamma damps it. When the read is live it appears here as a direction and a distance, never as a price level.</p>
        <span class="rd-sub">Published one session behind and in buckets, by design.</span></div>
    </div>`);
  }

  if(breadth){
    const pct=breadth.adv/breadth.tot*100;
    const say=pct>=70?['Broad','Most of the market is participating. Moves built on this tend to hold.']
      :pct>=45?['Mixed','Roughly half the market is working. No strong message either way.']
      :pct>=25?['Narrow','A minority is carrying the index. That is fragile, because it depends on a handful of names.']
      :['Very narrow','Almost nothing is participating. An index holding up on this is being held up by a few names.'];
    cards.push(`<div class="rd-card">
      <div class="rd-h"><span class="rd-t">Breadth</span>
        <span class="rd-v">${breadth.adv}<em>/${breadth.tot}</em></span></div>
      <div class="rd-bar"><i style="width:${pct.toFixed(0)}%"></i></div>
      <div class="rd-row"><b>${say[0]}</b><p>${say[1]}</p>
        <span class="rd-sub">Groups outperforming SPY over the last month.</span></div>
      <div class="rd-lead">
        <span class="k">Leading</span>
        <span class="g">${breadth.top.map(s=>`<em class="up" data-sym="${esc(s)}">${esc(s)}</em>`).join('')}</span>
        <span class="k">Lagging</span>
        <span class="g">${breadth.bot.map(s=>`<em class="dn" data-sym="${esc(s)}">${esc(s)}</em>`).join('')}</span>
      </div>
      ${tnx?`<p class="rd-note">US 10-year at ${fmt(tnx,2)}%. Rising yields pressure long-duration growth first.</p>`:''}
    </div>`);
  }

  host.innerHTML=(headline?`<p class="rd-lede">${esc(headline)}</p>`:'')
    +`<div class="rd-grid">${cards.join('')}</div>`;
  $$('em[data-sym]',host).forEach(em=>em.addEventListener('click',()=>toChart(em.dataset.sym)));
  setBar('#dkRead', vix?'live':'partial');
}

/* ============================================================
   THE TERMINAL: chart, snapshot, calendar
   ============================================================ */
/* Intraday ranges are capped by the provider: one-minute bars only go back a
   week, five-minute a month. Asking for more silently returns less, so each
   timeframe pairs an interval with the longest range that actually honours it. */
const TF={
  '1m':{range:'1d', interval:'1m'},  '5m':{range:'5d', interval:'5m'},
  '15m':{range:'1mo',interval:'15m'},'1h':{range:'3mo',interval:'60m'},
  '1D':{range:'1d', interval:'5m'},  '5D':{range:'5d', interval:'30m'},
  '1M':{range:'1mo',interval:'1h'},  '3M':{range:'3mo',interval:'1d'},
  '6M':{range:'6mo',interval:'1d'},  'YTD':{range:'ytd',interval:'1d'},
  '1Y':{range:'1y', interval:'1d'},  '5Y':{range:'5y', interval:'1wk'}};
let chart,sMain,sVol,sMa20,sMa50;
const C={sym:'NVDA',tf:'6M',type:'candles',vol:true,ma:false,bars:[],meta:null};

/* Everything in the workspace is visible at once now, so charting a symbol
   just reloads the panels and scrolls the workspace into view. */

/* ---- the watch strip ----------------------------------------------------
   The quick list is the user's, not mine. It starts on companies rather than
   index funds, because the panels beside it (fundamentals, analyst split)
   only mean something for an operating business. */
const WKEY='tdesk_watch_v1';
const WDEF=['NVDA','AAPL','TSLA','MSFT','AMZN'];
let WATCH=(()=>{ try{ const v=JSON.parse(localStorage.getItem(WKEY)); return Array.isArray(v)&&v.length?v:WDEF.slice(); }
                 catch(e){ return WDEF.slice(); } })();
function drawWatch(){
  const host=$('#tkQuick'); if(!host)return;
  host.innerHTML=WATCH.map(s=>`<span class="tk-chip${C.sym===s?' on':''}">
      <button class="go" data-sym="${esc(s)}">${esc(s)}</button>
      <button class="x" data-drop="${esc(s)}" aria-label="Remove ${esc(s)}" title="Remove">\u2715</button>
    </span>`).join('')
    +`<button class="tk-add" id="tkAdd" title="Add the charted symbol">+ ${esc(C.sym||'add')}</button>`;
  $$('.go',host).forEach(b=>b.addEventListener('click',()=>toChart(b.dataset.sym)));
  $$('.x',host).forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    WATCH=WATCH.filter(x=>x!==b.dataset.drop); saveWatch();
  }));
  const add=$('#tkAdd');
  if(add) add.addEventListener('click',()=>{
    const s=(C.sym||'').toUpperCase();
    if(!s||WATCH.includes(s))return;
    WATCH.push(s); if(WATCH.length>10)WATCH.shift();
    saveWatch();
  });
}
function saveWatch(){ try{ localStorage.setItem(WKEY,JSON.stringify(WATCH)); }catch(e){} drawWatch(); }

function toChart(sym){
  const s=String(sym||'').toUpperCase();
  const lab=$('#tkNow'); if(lab) lab.textContent=s;
  /* the panels fade out together and back in as the new symbol lands, so a
     ticker change reads as one movement rather than four separate flickers */
  const work=$('#dkWork');
  if(work&&!SLOW){ work.classList.add('swap'); setTimeout(()=>work.classList.remove('swap'),420); }
  loadChart(s);
  const anchor=$('#dkWork');
  if(anchor&&Math.abs(anchor.getBoundingClientRect().top)>window.innerHeight*.6)
    anchor.scrollIntoView({behavior:SLOW?'auto':'smooth',block:'start'});
}
window.deskChart=toChart;

function chartMsg(on,t,d){
  const m=$('#dkMsg'); if(!m)return;
  m.classList.toggle('on',!!on);
  if(!on)return;
  const a=$('.t',m), b=$('.d',m);
  if(a)a.textContent=t||''; if(b)b.textContent=d||'';
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
    chartMsg(false); paintChart(); writeQuote(); drawWatch();
    loadSnapshot(C.sym); loadRegime(C.sym); loadGex(C.sym);
  }catch(e){
    if(my!==seq)return;
    chartMsg(true,'NO DATA',e.message);
  }
}
function wireSymbol(){
  const inp=$('#tkSym'),box=$('#tkSug'); if(!inp)return;
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
  document.addEventListener('click',e=>{if(!e.target.closest('.tk-box'))close();});
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


/* ============================================================
   REGIME
   What kind of market this one ticker is in right now, read off
   its own daily bars rather than off an opinion. Four questions,
   each with a plain answer:

     TREND      where price sits against its own averages
     MOMENTUM   whether that trend is accelerating or tiring
     VOLATILITY how wide the daily range is against its own normal
     LOCATION   where in the yearly range it is trading

   Nothing here needs options data, so it works for every symbol
   the chart can draw, not just the two the gamma read covers.
   ============================================================ */
function sma(a,n){ if(a.length<n)return null; let s=0; for(let i=a.length-n;i<a.length;i++)s+=a[i]; return s/n; }
function rsi(c,n){
  if(c.length<n+1)return null;
  let g=0,l=0;
  for(let i=c.length-n;i<c.length;i++){ const d=c[i]-c[i-1]; if(d>0)g+=d; else l-=d; }
  if(l===0)return 100;
  return 100-100/(1+(g/n)/(l/n));
}
async function loadRegime(sym){
  const host=$('#dkRegime'); if(!host||!sym) return;
  host.innerHTML='<div class="dk-skel"></div><div class="dk-skel"></div>';
  setBar('#dkRegime','reading');
  try{
    const d=await get(`/v1/candles?symbol=${encodeURIComponent(sym)}&range=1y&interval=1d`);
    const bars=d.bars||[];
    if(bars.length<60) throw new Error('Not enough daily history to read a regime.');
    const c=bars.map(b=>b.c), last=c[c.length-1];
    const s20=sma(c,20), s50=sma(c,50), s200=c.length>=200?sma(c,200):null;
    const r=rsi(c,14);

    /* true range against its own median, so "wide" means wide for THIS
       symbol rather than wide in dollars */
    const tr=[];
    for(let i=1;i<bars.length;i++){
      const b=bars[i],p=bars[i-1];
      tr.push(Math.max(b.h-b.l,Math.abs(b.h-p.c),Math.abs(b.l-p.c))/b.c*100);
    }
    const recent=tr.slice(-14).reduce((a,b)=>a+b,0)/14;
    const sorted=tr.slice().sort((a,b)=>a-b);
    const pctile=sorted.filter(v=>v<recent).length/sorted.length*100;

    const hi=Math.max(...c), lo=Math.min(...c);
    const loc=(last-lo)/(hi-lo)*100;

    const rows=[];
    /* trend */
    const above=[s20&&last>s20,s50&&last>s50,s200&&last>s200].filter(Boolean).length;
    const tset=[s20,s50,s200].filter(x=>x!=null).length;
    const stack=(s20&&s50&&s20>s50)&&(!s200||s50>s200);
    /* index 5 is the one-line version shown in the panel; index 2 is the full
       explanation, which moves to the tooltip */
    rows.push(['Trend',
      above===tset&&stack?'Strong uptrend':above===tset?'Uptrend':above===0?'Downtrend':'Mixed',
      above===tset&&stack?'Price is above every average and the averages are stacked in order, which is what a healthy trend looks like.'
      :above===tset?'Price is above its averages but they are not cleanly stacked, so the trend is real but not yet orderly.'
      :above===0?'Price is below every average. Buying here is fighting the direction of the tape.'
      :`Price is above ${above} of ${tset} averages. The timeframes disagree, which usually means a transition.`,
      above===tset?'up':above===0?'dn':'', null,
      above===tset&&stack?'Above every average, stacked in order.'
      :above===tset?'Above its averages, not yet cleanly stacked.'
      :above===0?'Below every average.'
      :`Above ${above} of ${tset} averages. Timeframes disagree.`]);
    /* momentum */
    rows.push(['Momentum',
      r>70?'Overbought':r>55?'Firm':r>45?'Neutral':r>30?'Soft':'Oversold',
      r>70?'RSI above 70. In a strong trend this can persist for weeks, so treat it as fuel rather than a sell signal on its own.'
      :r>55?'Buyers have the upper hand without the move being stretched.'
      :r>45?'Neither side is in control. Range rules apply rather than trend rules.'
      :r>30?'Sellers have the upper hand. Bounces are more likely to fail than to hold.'
      :'RSI below 30. Stretched to the downside, which marks capitulation as often as it marks a bottom.',
      r>55?'up':r<45?'dn':'', fmt(r,0),
      r>70?'Stretched, though it can persist in a trend.'
      :r>55?'Buyers have the upper hand.'
      :r>45?'Neither side in control. Range rules apply.'
      :r>30?'Sellers have the upper hand.'
      :'Stretched to the downside.']);
    /* volatility */
    rows.push(['Volatility',
      pctile>75?'Elevated':pctile>40?'Normal':'Compressed',
      pctile>75?'Daily ranges are wider than usual for this name, so stops need more room and size needs to come down.'
      :pctile>40?'Ranges are about average. Normal position sizing applies.'
      :'Ranges are unusually tight. Compression like this tends to resolve into an expansion, though it does not say which way.',
      pctile>75?'dn':'', pctile.toFixed(0)+'%',
      pctile>75?'Wider than usual. Wider stops, smaller size.'
      :pctile>40?'About average. Normal sizing applies.'
      :'Unusually tight. Compression tends to resolve into expansion.']);
    /* location */
    rows.push(['Location',
      loc>85?'At highs':loc>60?'Upper range':loc>40?'Mid range':loc>15?'Lower range':'At lows',
      loc>85?'Trading near the top of its yearly range. There is no overhead supply, which is why breakouts run.'
      :loc>60?'In the upper half of the year. Buyers have been in control over the longer view.'
      :loc>40?'Sitting in the middle of the year, where the least information lives.'
      :loc>15?'In the lower half of the year. Every rally has to work through trapped supply above.'
      :'Near the bottom of its yearly range. Cheap relative to the year, and that is exactly what a downtrend looks like from inside it.',
      loc>60?'up':loc<40?'dn':'', loc.toFixed(0)+'%',
      loc>85?'Near the top of the year. No overhead supply.'
      :loc>60?'Upper half of the year.'
      :loc>40?'Mid range, where the least information lives.'
      :loc>15?'Lower half. Rallies work through supply above.'
      :'Near the low of the year.']);

    /* Four readings, each one line. The long explanation moves to a tooltip:
       the panel has to be scannable at a glance, and anything that needs
       scrolling is not a glance. */
    host.innerHTML=`<div class="rg-grid">${rows.map(x=>`
        <div class="rg-row" title="${esc(x[2])}">
          <span class="k">${esc(x[0])}</span>
          <span class="v ${x[3]||''}">${esc(x[1])}</span>
          ${x[4]?`<span class="n">${esc(x[4])}</span>`:'<span class="n"></span>'}
          <p>${esc(x[5]||x[2])}</p>
        </div>`).join('')}</div>`;
    setBar('#dkRegime',esc(sym));
  }catch(e){
    host.innerHTML=stateBox('NO REGIME',e.message);
    setBar('#dkRegime','offline');
  }
}


/* ============================================================
   DEALER FLOW
   What dealer hedging is doing to THIS symbol.

   A note on what is deliberately absent. Call and put walls are
   strike-level numbers, and a strike level is a tradeable
   artifact rather than an explanation: publishing it hands over
   the instrument instead of teaching the mechanism. So this shows
   the direction of hedging, how far the regime is from flipping,
   and how clustered the book is, all in buckets and one session
   behind. That is enough to understand why a tape behaves the way
   it does, and not enough to trade off, which is the point.

   Coverage is SPY and QQQ. Everything else gets the explainer,
   because inventing a reading for a symbol we do not compute
   would be worse than saying so.
   ============================================================ */
let GEXCACHE=null;
async function loadGex(sym){
  const host=$('#dkGex'); if(!host||!sym) return;
  setBar('#dkGex','reading');
  try{
    if(!GEXCACHE) GEXCACHE=await get('/v1/read');
    const d=GEXCACHE, x=d&&d.symbols?d.symbols[sym]:null;
    if(!x){
      const covered=d&&d.symbols?Object.keys(d.symbols):[];
      host.innerHTML=`<div class="gx-none">
        <b>No dealer read for ${esc(sym)}</b>
        <p>Dealers hedge the options they sell, and that hedging is mechanical rather than discretionary. When they are short gamma they buy strength and sell weakness, which amplifies whatever the tape is already doing. When they are long gamma they do the opposite and moves get damped.</p>
        <p>This desk computes that read for the index products only.${covered.length?' Currently '+covered.map(esc).join(' and ')+'.':''}</p>
        ${covered.length?`<div class="gx-jump">${covered.map(s=>`<button data-sym="${esc(s)}">Read ${esc(s)}</button>`).join('')}</div>`:''}
      </div>`;
      $$('.gx-jump button',host).forEach(b=>b.addEventListener('click',()=>toChart(b.dataset.sym)));
      setBar('#dkGex','not covered'); return;
    }
    const g=GAMMA_SAY[x.gammaSign]||['',''];
    const f=x.flipBucket?FLIP_SAY[x.flipBucket]:null;
    const c=x.concentration?CONC_SAY[x.concentration]:null;
    const dial=x.gammaSign==='short'?'dn':'up';
    host.innerHTML=`
      <div class="gx-head ${dial}">
        <span class="gx-k">Hedging direction</span>
        <b>${x.gammaSign==='short'?'Amplifying':'Damping'}</b>
        <span class="gx-pill ${x.gammaSign}">${x.gammaSign==='short'?'SHORT GAMMA':'LONG GAMMA'}</span>
        ${x.dayCount>1?`<span class="gx-days">${x.dayCount} sessions running</span>`:''}
      </div>
      <p class="gx-say">${g[1]}</p>
      <div class="gx-rows">
        ${f?`<div class="gx-r"><span class="k">Distance to the flip</span>
          <span class="v">${f[0]}</span><p>${f[1]}</p></div>`:''}
        ${c?`<div class="gx-r"><span class="k">Book concentration</span>
          <span class="v">${c[0]}</span><p>${c[1]}</p></div>`:''}
      </div>
      <p class="gx-note">Published one session behind and in buckets rather than levels. Strike-level detail is deliberately withheld: this is here to explain why a tape behaves as it does, not to hand over a level to trade against.</p>`;
    setBar('#dkGex',(d.session||'')+' close');
  }catch(e){
    host.innerHTML=`<div class="gx-none"><b>Dealer read unavailable</b>
      <p>${esc(e.message)}</p></div>`;
    setBar('#dkGex','offline');
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


/* scroll progress on the nav edge, and the section eyebrows arriving */
function ambience(){
  if(SLOW) { $$('.tsec').forEach(e=>e.classList.add('in')); return; }
  let raf;
  const nav=$('#nav');
  addEventListener('scroll',()=>{
    if(raf)return;
    raf=requestAnimationFrame(()=>{
      const h=document.documentElement;
      const p=h.scrollTop/Math.max(1,h.scrollHeight-h.clientHeight)*100;
      if(nav) nav.style.setProperty('--sp',p.toFixed(1)+'%');
      raf=null;
    });
  },{passive:true});
  const io=new IntersectionObserver(es=>{
    es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  },{rootMargin:'0px 0px -8% 0px'});
  $$('.tsec').forEach(el=>io.observe(el));
}

/* ============================================================
   BOOT
   ============================================================ */
/* Each step is isolated. Panels are independent by nature, so one throwing
   must never stop the others: that turns a single typo into a blank page with
   nothing to diagnose from. Failures are logged with the step that caused
   them, which is the difference between a five-minute fix and an afternoon. */
function step(name,fn){
  try{ fn(); }
  catch(e){ console.error('[terminal] '+name+' failed:', e); }
}
function init(){
  step('xref',installXref); step('symbol',wireSymbol); step('tape',wireTape);
  step('options',watchOptions); step('strategies',enhanceStrats);
  step('reveals',reveals); step('ambience',ambience); step('watch',drawWatch);
  if(!SLOW) watchNumbers();

  step('controls',()=>{
  $$('#dkTf button').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    if(b.dataset.tf){$$('#dkTf [data-tf]').forEach(x=>x.classList.toggle('on',x===b));loadChart(C.sym,b.dataset.tf);}
    else if(b.dataset.type){$$('#dkTf [data-type]').forEach(x=>x.classList.toggle('on',x===b));C.type=b.dataset.type;paintChart();}
    else if(b.dataset.tog){C[b.dataset.tog]=!C[b.dataset.tog];b.classList.toggle('on',C[b.dataset.tog]);paintChart();}
  }));
  $$('#rotScope button').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    $$('#rotScope button').forEach(x=>x.classList.toggle('on',x===b));
    rotStop(); ROT.scope=b.dataset.scope; ROT.drill=null; rotBuild(); rotDraw();
  }));
  $$('#rotTf button').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    $$('#rotTf button').forEach(x=>x.classList.toggle('on',x===b));
    rotStop(); ROT.tf=ROT_TF[b.dataset.rtf]||5; rotBuild(); rotDraw();
  }));
  const back=$('#rotBack'); if(back)back.addEventListener('click',rotBackOut);
  });

  const lab=$('#tkNow'); if(lab) lab.textContent='NVDA';
  step('chart',()=>loadChart('NVDA','6M'));
  step('read',loadRead);
  step('econ',loadEcon);

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

  everyVisible(loadRead,900000);
  everyVisible(loadEcon,900000);
  everyVisible(()=>loadChart(),120000);
  addEventListener('hashchange',()=>setTimeout(reveals,60));
  let rz; addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(ROT.set)rotDraw();},240);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();
