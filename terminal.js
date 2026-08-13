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
         trail:'one',head:null,playing:false,speed:1,dates:null};
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
    ROT.closes=res.closes||{}; ROT.dates=res.dates||null;
    if(!ROT.closes[ROT_BENCH]) throw new Error('No history came back for the benchmark, '+ROT_BENCH+'.');
    rotBuild(); rotPaint();
    setBar('#rotPlot',(ROT.drill?rotName(ROT.drill)+' \u00b7 ':'')+rotPts.length+' bodies');
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
  ROT.head=null; rotDisp={};
  ROT.head=null;   /* a new set means a new timeline, so snap back to live */
}
function rotName(k){
  const g=ROT_GROUPS.find(x=>x.sym===k||x.etf===k);
  return g?g.name:k;
}
/* ── Mythos static axis (tanh warp) ─────────────────────────────
   Ported from kairos-mythos.js. The ruler is a constant — it does not
   depend on the current frame's data. That is why trails hold still and
   why nothing can ever leave the plot.

   tanh maps the whole real line into (-1, 1):
     • extreme values compress instead of rescaling the middle
     • a given RS-Ratio always maps to the same fraction of the axis
     • identical on every device, every playhead

   ROT_K controls the bend (raise → pull toward centre, lower → push out).
   ROT_FILL leaves a permanent gutter so saturated bodies never sit on the edge.
*/
const ROT_K=4.0;
const ROT_FILL=0.82;
function rotWarp(d){
  if(!isFinite(d)) return 0;
  return Math.tanh(d/ROT_K)*ROT_FILL;
}
/* ============================================================
   THE ROTATION · renderer
   Ported from Mythos rather than approximated. The two things
   that make it feel the way it does, neither of which survives
   in an SVG implementation:

   1. EASED DISPLAY POSITIONS. Every body keeps its own drawn
      position and glides toward its target each frame. Setting
      coordinates directly, however often, is a slideshow: the
      body is always exactly where the data says, so nothing ever
      appears to travel. Scrubbing works for the same reason.

   2. ONE PROJECTION, SHARED WITH THE HIT TEST. A second copy of
      the maths is how tap targets end up somewhere other than
      what you can see.

   Canvas rather than SVG because sixty frames a second across
   twenty bodies with glows and trails is a repaint problem, not
   a DOM problem.
   ============================================================ */
const ROT_BPS=3;                 /* bars per second at 1x */
let rotDisp={}, rotPhaseT=0, rotRaf=0, rotLastT=0, rotAcc=0;
let rotPts=[], rotFocus=null, rotPin=null;
const rotTouch=matchMedia('(pointer:coarse)').matches;

function rotCv(){ return $('#rotCanvas'); }
function rotPad(W){ return Math.round(Math.max(20,Math.min(42,W*0.078))); }
function rotProject(W,H,PAD){
  const halfW=(W-2*PAD)/2, halfH=(H-2*PAD)/2;
  const cxp=PAD+halfW, cyp=PAD+halfH;
  /* bodies inset 3% so a marker and its label always clear the frame; tails
     run the full width because they fit by construction */
  return {
    X:v=>cxp+rotWarp(v-100)*halfW*0.97, Y:v=>cyp-rotWarp(v-100)*halfH*0.97,
    TX:v=>cxp+rotWarp(v-100)*halfW,     TY:v=>cyp-rotWarp(v-100)*halfH
  };
}
function rotHeadIdx(){
  if(!ROT.set)return 0;
  return ROT.head==null?ROT.set.len-1:Math.max(ROT.set.minIdx,Math.min(ROT.set.len-1,Math.round(ROT.head)));
}
/* recompute the point list at the current playhead */
function rotApplyHead(){
  const set=ROT.set; if(!set){rotPts=[];return;}
  const i=rotHeadIdx();
  rotPts=Object.keys(set.bodies).map(k=>{
    const a=rotAt(set.bodies[k],ROT.tail,i);
    const g=ROT_GROUPS.find(x=>x.sym===k||x.etf===k);
    return {sym:k, name:g?g.name:k, synth:!!(g&&g.synth), x:a.x, y:a.y,
            tail:a.tail, ret:a.ret, phase:rotPhase(a.x,a.y), q:rotQuality(a.tail)};
  });
}
function rotDraw(dt){
  const cv=rotCv(); if(!cv)return;
  const ctx=cv.getContext('2d');
  const dpr=Math.min(devicePixelRatio||1,2);
  const W=cv.clientWidth||700, H=cv.clientHeight||480;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){
    cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  if(!rotPts.length)return;
  rotPhaseT+=dt;

  /* furniture scales with the canvas. At a fixed padding a 360px phone loses a
     quarter of its width to margin and then draws 10px labels into each other. */
  const NARROW=W<520, SC=NARROW?Math.max(.72,W/520):1, PAD=rotPad(W);
  const FS=(px,wt)=>(wt||700)+' '+(px*SC).toFixed(1)+'px "IBM Plex Mono",monospace';
  const pr=rotProject(W,H,PAD);
  const X=pr.X,Y=pr.Y,TX=pr.TX,TY=pr.TY;
  const cx=X(100),cy=Y(100);

  const quad=(x0,y0,x1,y1,c)=>{ctx.fillStyle='rgba('+c+',.05)';ctx.fillRect(x0,y0,x1-x0,y1-y0);};
  quad(cx,PAD,W-PAD,cy,PHASE_COL.Leading);
  quad(cx,cy,W-PAD,H-PAD,PHASE_COL.Weakening);
  quad(PAD,cy,cx,H-PAD,PHASE_COL.Lagging);
  quad(PAD,PAD,cx,cy,PHASE_COL.Improving);

  ctx.strokeStyle='rgba(126,166,214,.28)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(cx,PAD);ctx.lineTo(cx,H-PAD);ctx.moveTo(PAD,cy);ctx.lineTo(W-PAD,cy);ctx.stroke();
  ctx.strokeStyle='rgba(126,166,214,.14)';ctx.strokeRect(PAD,PAD,W-2*PAD,H-2*PAD);

  const ql=(t,x,y,c,al)=>{ctx.font=FS(10);ctx.fillStyle='rgba('+c+',.5)';ctx.textAlign=al;ctx.fillText(t,x,y);ctx.textAlign='left';};
  const qn=NARROW?['LEAD','WEAK','LAG','IMPR']:['LEADING','WEAKENING','LAGGING','IMPROVING'];
  ql(qn[0],W-PAD-4,PAD+12*SC,PHASE_COL.Leading,'right');
  ql(qn[1],W-PAD-4,H-PAD-5,PHASE_COL.Weakening,'right');
  ql(qn[2],PAD+4,H-PAD-5,PHASE_COL.Lagging,'left');
  ql(qn[3],PAD+4,PAD+12*SC,PHASE_COL.Improving,'left');
  ctx.font=FS(8.5,600);ctx.fillStyle='rgba(126,166,214,.5)';ctx.textAlign='center';
  ctx.fillText(NARROW?'RS \u2192':'RS-RATIO \u2192',W/2,H-PAD+Math.min(16,PAD-6));
  ctx.save();ctx.translate(Math.max(9,PAD-14),H/2);ctx.rotate(-Math.PI/2);
  ctx.fillText(NARROW?'MOMENTUM \u2192':'RS-MOMENTUM \u2192',0,0);ctx.restore();
  ctx.textAlign='left';

  const focus=rotFocus||rotPin, anyFocus=!!focus;
  if(!anyFocus&&PAD>=24&&ROT.trail!=='all'){
    ctx.font=FS(8.5,600);ctx.fillStyle='rgba(126,166,214,.4)';ctx.textAlign='center';
    ctx.fillText(rotTouch?'tap a body for its trail \u00b7 tap again to open'
                        :'hover a body for its rotation trail',W/2,PAD-11);
    ctx.textAlign='left';
  }

  /* eased display positions: bodies glide rather than snap */
  for(const p of rotPts){
    const tx=X(p.x),ty=Y(p.y);
    const d=rotDisp[p.sym]||(rotDisp[p.sym]={x:tx,y:ty});
    const k=SLOW?1:Math.min(1,dt*8);
    d.x+=(tx-d.x)*k; d.y+=(ty-d.y)*k;
  }

  /* tails under the bodies, clipped to the frame */
  ctx.save();ctx.beginPath();ctx.rect(PAD,PAD,W-2*PAD,H-2*PAD);ctx.clip();
  if(ROT.trail!=='off') for(const p of rotPts){
    if(p.tail.length<2)continue;
    const isF=focus===p.sym;
    if(ROT.trail==='one'&&(!anyFocus||!isF))continue;
    const col=PHASE_COL[p.phase];
    for(let i=1;i<p.tail.length;i++){
      const a=(i/p.tail.length)*(isF?.85:(ROT.trail==='all'?.26:.85));
      ctx.strokeStyle='rgba('+col+','+a.toFixed(2)+')';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(TX(p.tail[i-1].x),TY(p.tail[i-1].y));
      ctx.lineTo(TX(p.tail[i].x),TY(p.tail[i].y));ctx.stroke();
    }
    if(isF||ROT.trail!=='all') for(let i=0;i<p.tail.length-1;i++){
      ctx.fillStyle='rgba('+col+',.5)';ctx.beginPath();
      ctx.arc(TX(p.tail[i].x),TY(p.tail[i].y),2*SC,0,7);ctx.fill();
    }
  }
  /* scrubbed into the past: a wash and a stamp, so a screenshot can never be
     mistaken for the current field */
  if(ROT.head!=null&&rotHeadIdx()<ROT.set.len-1){
    ctx.fillStyle='rgba(245,185,66,.055)';ctx.fillRect(0,0,W,H);
    ctx.font='700 '+Math.round(11*SC)+'px "IBM Plex Mono",monospace';
    ctx.fillStyle='rgba(245,185,66,.9)';
    ctx.fillText('\u25c0 REPLAY \u00b7 '+(rotDateAt(rotHeadIdx())||((ROT.set.len-1-rotHeadIdx())+' back')),PAD+4,PAD+13*SC);
  }
  ctx.restore();

  for(const p of rotPts){
    const col=PHASE_COL[p.phase], d=rotDisp[p.sym], px=d.x, py=d.y;
    const isF=focus===p.sym, dim=anyFocus&&!isF, baseA=dim?.3:1;
    const pulse=isF?1:.7+.15*Math.sin(rotPhaseT*1.8+p.sym.length);
    const gr=(isF?22:14)*SC;
    const rg=ctx.createRadialGradient(px,py,0,px,py,gr);
    rg.addColorStop(0,'rgba('+col+','+(.85*pulse*baseA).toFixed(2)+')');
    rg.addColorStop(1,'rgba('+col+',0)');
    ctx.fillStyle=rg;ctx.beginPath();ctx.arc(px,py,gr,0,7);ctx.fill();
    ctx.lineWidth=2;
    if(p.synth){
      /* a hollow diamond marks a synthetic basket, so it is never mistaken
         for something you can actually buy */
      ctx.strokeStyle='rgba('+col+','+baseA+')';ctx.beginPath();
      const r=(isF?6:4.5)*SC;
      ctx.moveTo(px,py-r);ctx.lineTo(px+r,py);ctx.lineTo(px,py+r);ctx.lineTo(px-r,py);
      ctx.closePath();ctx.stroke();
      ctx.fillStyle='rgba('+col+','+(.22*baseA).toFixed(2)+')';ctx.fill();
    }else{
      ctx.fillStyle='rgba('+col+','+baseA+')';
      ctx.beginPath();ctx.arc(px,py,(isF?5.5:4)*SC,0,7);ctx.fill();
    }
    const showLab=!NARROW||isF||p.phase==='Leading'||p.phase==='Improving';
    if(showLab){
      ctx.font=FS(isF?12:10.5);
      ctx.fillStyle='rgba(233,237,245,'+(dim?.4:isF?1:.9)+')';
      const lx=px+9*SC;
      if(lx+30*SC>W-4){ctx.textAlign='right';ctx.fillText(p.sym,px-8*SC,py+3.5*SC);ctx.textAlign='left';}
      else ctx.fillText(p.sym,lx,py+3.5*SC);
    }
    if(isF){
      ctx.font=FS(9,600);ctx.fillStyle='rgba('+col+',.95)';
      const meta=NARROW?p.phase.toUpperCase()+' \u00b7 '+(p.ret>=0?'+':'')+(p.ret*100).toFixed(1)+'%'
        :p.name+' \u00b7 '+p.phase.toUpperCase()+' \u00b7 '+(p.ret>=0?'+':'')+(p.ret*100).toFixed(1)+'% 5d'+(p.synth?' \u00b7 basket':'');
      const mw=ctx.measureText(meta).width;
      ctx.fillText(meta,Math.min(px+9*SC,Math.max(4,W-mw-6)),py+16*SC);
    }
  }
}
/* the loop runs continuously: the pulse and the easing both need it, and an
   idle canvas costs nothing measurable */
function rotFrame(ts){
  const dt=rotLastT?Math.min(.05,(ts-rotLastT)/1000):.016;
  rotLastT=ts;
  rotAdvance(dt); rotDraw(dt);
  rotRaf=requestAnimationFrame(rotFrame);
}
function rotLoop(){
  if(rotRaf)return;
  rotLastT=0;
  if(SLOW){ rotDraw(0); return; }
  rotRaf=requestAnimationFrame(rotFrame);
}
/* advance on real elapsed seconds, so playback is wall-clock consistent
   whatever the frame rate */
function rotAdvance(dt){
  if(!ROT.playing||!ROT.set)return;
  rotAcc+=dt*ROT_BPS*(ROT.speed||1);
  if(rotAcc<1)return;
  const step=Math.floor(rotAcc); rotAcc-=step;
  const h=rotHeadIdx()+step;
  if(h>=ROT.set.len-1){
    ROT.playing=false; ROT.head=null;      /* stop at the edge, never loop */
    rotApplyHead(); rotRail(); rotBar();
    return;
  }
  ROT.head=h; rotApplyHead(); rotRail(); rotBar();
}
function rotToggle(){
  if(!ROT.set)return;
  if(!ROT.playing&&(ROT.head==null||rotHeadIdx()>=ROT.set.len-1)) ROT.head=ROT.set.minIdx;
  ROT.playing=!ROT.playing; rotAcc=0; rotApplyHead(); rotBar(); rotLoop();
  if(SLOW&&!ROT.playing)rotDraw(0);
}
function rotStop(){ ROT.playing=false; rotBar(); }
function rotNow(){ ROT.playing=false; ROT.head=null; rotAcc=0; rotApplyHead(); rotRail(); rotBar(); if(SLOW)rotDraw(0); }
/* Name the session. "14 sessions back" makes you do arithmetic against a
   calendar you do not have open; a date is the thing you were going to work
   out anyway. The closes feed carries its own dates, so they line up exactly
   with the bars being drawn. */
const RDF=new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'});
function rotDateAt(i){
  const ds=ROT.dates;
  if(!ds||!ds.length||!ROT.set) return null;
  /* the set is aligned from the right, so index from the end of the dates */
  const off=ds.length-ROT.set.len;
  const d=ds[Math.max(0,Math.min(ds.length-1,off+i))];
  if(!d) return null;
  try{ return RDF.format(new Date(d+'T12:00:00Z')); }catch(e){ return d; }
}
function rotBar(){
  const b=$('#rotPlay'); if(b)b.textContent=ROT.playing?'\u275a\u275a':'\u25b6';
  const s=$('#rotScrub');
  if(s&&ROT.set){ s.min=String(ROT.set.minIdx); s.max=String(ROT.set.len-1); s.value=String(rotHeadIdx()); }
  const d=$('#rotDate');
  if(d&&ROT.set){
    const i=rotHeadIdx(), lastBar=i>=ROT.set.len-1;
    const nice=rotDateAt(i);
    d.textContent=nice?(lastBar?'Latest \u00b7 '+nice:nice):(lastBar?'Latest close':(ROT.set.len-1-i)+' back');
    d.classList.toggle('past',!lastBar);
  }
}
/* hit test against the EASED positions, so what you click is what you see */
function rotHit(mx,my){
  const cv=rotCv(); if(!cv||!rotPts.length)return null;
  const W=cv.clientWidth,H=cv.clientHeight,PAD=rotPad(W);
  const pr=rotProject(W,H,PAD);
  let best=null,bd=1e9;
  for(const p of rotPts){
    const d=rotDisp[p.sym]||{x:pr.X(p.x),y:pr.Y(p.y)};
    const dist=Math.hypot(d.x-mx,d.y-my);
    if(dist<bd){bd=dist;best=p;}
  }
  return bd<=22?best:null;
}
function rotRail(){
  const host=$('#rotList'); if(!host)return;
  const order={Leading:0,Weakening:1,Improving:2,Lagging:3};
  const rows=rotPts.slice().sort((a,b)=>(order[a.phase]-order[b.phase])||(b.x-a.x));
  host.innerHTML=rows.map(p=>`<button class="rot-li${(rotFocus||rotPin)===p.sym?' on':''}"
      data-k="${esc(p.sym)}" style="--c:rgb(${PHASE_COL[p.phase]})">
      <span class="d"></span><span class="s">${esc(p.sym)}${p.synth?' \u25c7':''}</span>
      <span class="p">${p.phase}</span></button>`).join('');
  $$('.rot-li',host).forEach(b=>{
    b.onmouseenter=()=>{rotFocus=b.dataset.k;rotSay(rotPts.find(p=>p.sym===rotFocus));};
    b.onmouseleave=()=>{rotFocus=null;rotSay(null);};
    b.onclick=()=>rotClick(b.dataset.k);
  });
}
function rotSay(p){
  const el=$('#rotRead'); if(!el)return;
  if(!p){
    el.innerHTML=`<span class="k">The map</span><span class="v">Relative rotation</span>
      <p>Each body is measured against SPY, then scored across the sector field so a utility and a semiconductor basket are comparable. Right of centre is outperforming, above centre is accelerating. Money tends to travel clockwise.</p>
      <small>A hollow diamond is a synthetic basket rather than a fund you can buy.</small>`;
    return;
  }
  const q=p.q;
  const spin=q?(q.dir==='cw'?'Rotating clockwise, the normal direction.'
    :q.dir==='ccw'?'Rotating counter-clockwise, which usually marks a failed move.'
    :'Barely rotating. Drift rather than a real move.'):'';
  const clean=q?(q.quality>.55?'The path is a clean arc, so the rotation is real.'
    :q.quality>.28?'The path is uneven. Treat it as a lean, not a signal.'
    :'The path is a scribble: jitter across a boundary, not rotation.'):'';
  el.innerHTML=`<span class="k" style="color:rgb(${PHASE_COL[p.phase]})">${p.phase}</span>
    <span class="v">${esc(p.sym)} <em>${esc(p.name)}</em></span>
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
  if(!ROT.drill&&g&&g.members&&g.members.length>2){
    rotStop(); ROT.drill=k; ROT.head=null; rotDisp={};
    setBar('#rotPlot','loading '+(g.name||k));
    rotLoad(); return;
  }
  toChart(g&&g.etf?g.etf:k);
}
function rotBackOut(){ rotStop(); ROT.drill=null; ROT.head=null; rotDisp={}; rotLoad(); }

/* build the shell once, then let the loop own the pixels */
/* the single repaint entry point: build the shell if needed, recompute the
   points at the playhead, refresh the rail and let the loop draw */
function rotPaint(){
  rotShell(); rotApplyHead(); rotRail(); rotBar(); rotLoop();
  if(SLOW) rotDraw(0);
}
function rotShell(){
  const host=$('#rotPlot'); if(!host)return;
  if($('#rotCanvas'))return;
  host.innerHTML=`<div class="rot-wrap">
    <div class="rot-main">
      <canvas id="rotCanvas" role="img" aria-label="Relative rotation map"></canvas>
      <div class="rot-trail" id="rotTrail" role="group" aria-label="Trail mode">
        <span class="lbl">Trails</span>
        <button data-trail="off">Off</button>
        <button data-trail="one" class="on">One</button>
        <button data-trail="all">All</button>
      </div>
      <div class="rot-scrub" id="rotReplay">
        <button class="rot-play" id="rotPlay" aria-label="Play the rotation">\u25b6</button>
        <input type="range" id="rotScrub" min="0" max="1" value="1" aria-label="Replay position">
        <span class="rot-date" id="rotDate">Latest close</span>
        <button class="rot-now" id="rotNowB">Now</button>
      </div>
    </div>
    <div class="rot-side">
      <div class="rot-read" id="rotRead"></div>
      <div class="rot-list" id="rotList"></div>
    </div>
  </div>`;
  try{ const sv=localStorage.getItem('tdesk_rot_trail'); if(sv)ROT.trail=sv; }catch(e){}
  $$('#rotTrail button').forEach(b=>b.classList.toggle('on',b.dataset.trail===ROT.trail));
  const cv=$('#rotCanvas');
  cv.addEventListener('mousemove',e=>{
    const r=cv.getBoundingClientRect();
    const h=rotHit(e.clientX-r.left,e.clientY-r.top);
    const k=h?h.sym:null;
    if(k!==rotFocus){ rotFocus=k; rotSay(h); rotRail(); }
    cv.style.cursor=h?'pointer':'default';
  });
  cv.addEventListener('mouseleave',()=>{ rotFocus=null; rotSay(null); rotRail(); });
  cv.addEventListener('click',e=>{
    const r=cv.getBoundingClientRect();
    const h=rotHit(e.clientX-r.left,e.clientY-r.top);
    if(!h)return;
    /* touch: first tap pins and shows the trail, second opens it */
    if(rotTouch&&rotPin!==h.sym){ rotPin=h.sym; rotSay(h); rotRail(); return; }
    rotClick(h.sym);
  });
  $$('#rotTrail button').forEach(b=>b.addEventListener('click',()=>{
    ROT.trail=b.dataset.trail;
    $$('#rotTrail button').forEach(x=>x.classList.toggle('on',x===b));
    try{localStorage.setItem('tdesk_rot_trail',ROT.trail);}catch(e){}
    if(SLOW)rotDraw(0);
  }));
  $('#rotPlay').addEventListener('click',rotToggle);
  $('#rotNowB').addEventListener('click',rotNow);
  const sc=$('#rotScrub');
  sc.addEventListener('input',()=>{
    ROT.playing=false; ROT.head=+sc.value; rotAcc=0;
    rotApplyHead(); rotRail(); rotBar();
    if(SLOW)rotDraw(0);
  });
  rotSay(null);
  rotLoop();
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
/* The read is tried through our own Worker first, then straight from Kairos.
   The relay exists so the site has one API origin, but it is one more thing
   that can hold a stale error, and Kairos already serves this route with open
   CORS. A second path costs one failed request and removes the relay as a
   single point of failure. */
let READ_CACHE=null, READ_AT=0;
async function marketRead(){
  if(READ_CACHE&&Date.now()-READ_AT<12e4) return READ_CACHE;
  try{
    const r=await get('/v1/read');
    if(r&&r.symbols){ READ_CACHE=r; READ_AT=Date.now(); return r; }
  }catch(e){}
  try{
    const u='https://kairos-api.safihelal.workers.dev/public/state?t='+Math.floor(Date.now()/6e4);
    const res=await fetch(u);
    const d=await res.json().catch(()=>null);
    if(res.ok&&d&&d.symbols){ READ_CACHE=d; READ_AT=Date.now(); return d; }
    READ_CACHE=null;
    return {error:true,message:(d&&d.message)||('Kairos returned '+res.status)};
  }catch(e){ return {error:true,message:'Kairos unreachable: '+String(e.message||e)}; }
}

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
  let vix=null, gamma=null, breadth=null, tnx=null, tape=null, risk=null;
  try{
    const q=(await get('/v1/yquote?symbols=^VIX,^VIX9D,^VIX3M,^TNX,^FVX,ES=F,NQ=F,RTY=F,YM=F,SPY,QQQ,IWM,DIA,GLD,TLT,HYG,UUP,XLP,XLY')).quotes||{};
    const g=s=>q[s]&&q[s].c!=null?q[s].c:null;
    const d=s=>q[s]&&q[s].dp!=null?q[s].dp:null;
    const spot=g('^VIX');
    if(spot) vix={spot, v9d:g('^VIX9D'), v3m:g('^VIX3M'), chg:d('^VIX')};
    tnx=g('^TNX');
    window.__rdQ=q;
    tape=[['SPY','S&P 500'],['QQQ','Nasdaq 100'],['IWM','Russell 2000'],['DIA','Dow 30'],
          ['GLD','Gold'],['TLT','20Y Treasuries']]
      .map(([s,n])=>({s,n,c:g(s),dp:d(s)})).filter(x=>x.c!=null);
    /* Risk appetite, read off relationships rather than asserted: small caps
       against large, high yield credit against treasuries, and the dollar.
       Each leg is a comparison the market itself is making. */
    const legs=[];
    if(d('IWM')!=null&&d('SPY')!=null)
      legs.push({k:'Small vs large', v:d('IWM')-d('SPY'), on:'Small caps leading', off:'Large caps leading'});
    if(d('HYG')!=null&&d('TLT')!=null)
      legs.push({k:'Credit vs duration', v:d('HYG')-d('TLT'), on:'Credit bid', off:'Duration bid'});
    if(d('UUP')!=null)
      legs.push({k:'Dollar', v:-d('UUP'), on:'Dollar easing', off:'Dollar firming'});
    if(legs.length) risk={legs, score:legs.filter(l=>l.v>0).length, of:legs.length};
  }catch(e){}
  gamma=await marketRead();
  try{
    const d=await get('/v1/strength'); const rows=d.rows||[];
    if(rows.length) breadth={rows, adv:rows.filter(r=>r.m1>0).length, tot:rows.length,
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
  if(gamma&&!gamma.error&&gamma.symbols&&gamma.symbols.SPY)
    clauses.push('with dealers positioned to '+(gamma.symbols.SPY.gammaSign==='short'?'amplify':'damp')+' moves');
  const headline=clauses.length?clauses.join(', ').replace(/^./,c=>c.toUpperCase())+'.':'';

  const cards=[];

  /* ---- FUTURES FIRST ----
     Most people reading this at 8am are looking at ES and NQ, not SPY. The
     futures print overnight and through the whole session, so they are the
     first thing that tells you what kind of day is being set up. */
  /* ES and NQ for the tape, then the two commodities that actually move
     equity sentiment: gold when people want out of paper, crude because it
     runs straight into the inflation print everyone is trading around. */
  const FUT=[['ES=F','ES','S&P 500'],['NQ=F','NQ','Nasdaq 100'],
             ['GC=F','GOLD','Gold'],['CL=F','CRUDE','WTI Crude']];
  let futBand='';
  const fq=s=>{const x=(window.__rdQ||{})[s];return x&&x.dp!=null?x.dp:null;};
  if(window.__rdQ){
    const rows=FUT.map(([s,k,n])=>({k,n,c:(window.__rdQ[s]||{}).c,dp:fq(s)}))
                  .filter(x=>x.c!=null);
    if(rows.length){
      /* the divergence that matters: growth against the broad tape. When NQ
         and ES disagree, the day is a rotation rather than a direction. */
      const es=fq('ES=F'), nq=fq('NQ=F'), rty=fq('RTY=F');
      let dv='';
      if(es!=null&&nq!=null){
        const gap=nq-es;
        const say=Math.abs(gap)<.15?['In line','Growth and the broad tape are moving together, so today is a direction rather than a rotation.']
          :gap>0?['Nasdaq leading','Growth is being bought harder than the broad tape. Momentum names lead, laggards get ignored.']
          :['Nasdaq lagging','The broad tape is holding up better than growth. That is rotation out of duration, and it usually punishes chasing.'];
        const br=(rty!=null&&es!=null)?(rty-es):null;
        dv=`<div class="rd-div">
          <span class="k">NQ against ES</span>
          <b class="${dirC(gap)}">${(gap>=0?'+':'')+gap.toFixed(2)}%</b>
          <span class="t">${say[0]}</span>
          <p>${say[1]}</p>
          ${br!=null?`<span class="rd-sub">Russell against ES: ${(br>=0?'+':'')+br.toFixed(2)}%. ${br>0?'Small caps joining, which broadens the move.':'Small caps lagging, so the move is narrow.'}</span>`:''}
        </div>`;
      }
      futBand=`<div class="rd-fut">
        <div class="rd-futrow">${rows.map(x=>`
          <div class="rd-f ${dirC(x.dp)}">
            <span class="s">${esc(x.k)}</span><span class="n">${esc(x.n)}</span>
            <span class="p">${fmt(x.c,2)}</span><span class="d">${pctf(x.dp)}</span>
          </div>`).join('')}</div>
        ${dv}</div>`;
    }
  }

  let band='';
  if(tape&&tape.length){
    band=`<div class="rd-tape">${tape.map(x=>`
      <button class="rd-tk" data-sym="${esc(x.s)}">
        <span class="s">${esc(x.s)}</span>
        <span class="n">${esc(x.n)}</span>
        <span class="p">${fmt(x.c,2)}</span>
        <span class="d ${dirC(x.dp)}">${pctf(x.dp)}</span>
      </button>`).join('')}</div>`;
  }

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

  if(gamma&&!gamma.error&&gamma.symbols&&Object.keys(gamma.symbols).length){
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
        <p>Dealers hedge the options they sell, and that hedging is mechanical rather than discretionary. Short gamma amplifies a move; long gamma damps it. When the read is published it appears here as a direction and a distance, never as a price level.</p>
        <span class="rd-sub">Published one session behind and in buckets, by design.</span></div>
    </div>`);
  }

  /* ---- BREADTH, expanded ----
     Breadth survives every regime, so it earns the space. Three horizons
     instead of one: what is working today, over a month, and over a quarter.
     When they disagree the market is turning, and that disagreement is the
     whole signal. */
  if(breadth&&breadth.rows){
    const R=breadth.rows;
    const pc=f=>Math.round(R.filter(f).length/R.length*100);
    const d1=pc(r=>r.m1>0), d3=pc(r=>r.m3>0), d6=pc(r=>r.m6>0);
    const say=d1>=70?['Broad','Most of the market is participating. Moves built on this tend to hold.']
      :d1>=45?['Mixed','Roughly half is working. No strong message either way.']
      :d1>=25?['Narrow','A minority is carrying the index, which is fragile.']
      :['Very narrow','Almost nothing is participating.'];
    const trend=(d1-d3)>12?['Broadening','More is working now than a quarter ago. Participation is spreading, which is what durable moves look like from the inside.']
      :(d1-d3)<-12?['Narrowing','Less is working now than a quarter ago. The index can keep rising on this, but on fewer and fewer shoulders.']
      :['Steady','Participation is about where it was a quarter ago.'];
    const bar=(lab,v)=>`<div class="bd-row"><span class="bd-k">${lab}</span>
      <span class="bd-track"><i style="width:${v}%;background:${v>=60?'var(--green)':v>=35?'var(--gold)':'var(--red)'}"></i></span>
      <span class="bd-v">${v}%</span></div>`;
    cards.push(`<div class="rd-card">
      <div class="rd-h"><span class="rd-t">Breadth</span>
        <span class="rd-v">${breadth.adv}<em>/${breadth.tot}</em></span></div>
      <div class="bd-bars">${bar('Today',d1)}${bar('1 month',d3)}${bar('3 months',d6)}</div>
      <div class="rd-row"><b>${say[0]}</b><p>${say[1]}</p></div>
      <div class="rd-row"><b>${trend[0]}</b><p>${trend[1]}</p></div>
      <div class="rd-lead">
        <span class="k">Leading</span>
        <span class="g">${breadth.top.map(s=>`<em class="up" data-sym="${esc(s)}">${esc(s)}</em>`).join('')}</span>
        <span class="k">Lagging</span>
        <span class="g">${breadth.bot.map(s=>`<em class="dn" data-sym="${esc(s)}">${esc(s)}</em>`).join('')}</span>
      </div>
    </div>`);
  }

  /* ---- WHAT MONEY IS BUYING ----
     Rates and the old risk legs were portfolio-manager framing. This asks the
     question a trader is actually asking: which side is money going into right
     now, and does that agree with what the index is doing. */
  try{
    const q4=(await get('/v1/yquote?symbols=XLY,XLP,IWM,SPY,TLT,SMH')).quotes||{};
    const g=s=>q4[s]&&q4[s].dp!=null?q4[s].dp:null;
    const pairs=[
      {a:'SMH',b:'SPY',k:'Chips vs market',on:'Semis leading',off:'Semis lagging',
       w:'Semiconductors are the highest-beta expression of risk here. When they lead, the tape has an engine.'},
      {a:'XLY',b:'XLP',k:'Offense vs defense',on:'Offense',off:'Defense',
       w:'Discretionary against staples. What people buy says more than what they say.'},
      {a:'IWM',b:'SPY',k:'Small vs large',on:'Broadening',off:'Narrow',
       w:'Small caps joining means the move has legs beyond a handful of megacaps.'},
      {a:'SPY',b:'TLT',k:'Stocks vs bonds',on:'Into equities',off:'Into safety',
       w:'Money flowing to duration is money leaving risk.'}
    ].map(p=>Object.assign({},p,{v:(g(p.a)!=null&&g(p.b)!=null)?g(p.a)-g(p.b):null}))
     .filter(p=>p.v!=null);
    if(pairs.length){
      const on=pairs.filter(p=>p.v>0).length;
      const tone=on===pairs.length?['Fully risk on','Every pair leans the same way. Rare, and worth respecting while it lasts.']
        :on===0?['Fully risk off','Every pair is defensive at once. That is coordinated, not noise.']
        :on>pairs.length/2?['Leaning risk on','More pairs favour risk than not, but it is not unanimous.']
        :['Leaning defensive','More pairs favour safety. Rallies into this tend to get sold.'];
      cards.push(`<div class="rd-card">
        <div class="rd-h"><span class="rd-t">What money is buying</span>
          <span class="rd-v">${on}<em>/${pairs.length}</em></span></div>
        <div class="rd-row"><b>${tone[0]}</b><p>${tone[1]}</p></div>
        <div class="rd-legs">${pairs.map(p=>`
          <div class="rd-leg ${p.v>0?'on':'off'}" title="${esc(p.w)}">
            <span class="k">${esc(p.k)}</span>
            <span class="v">${esc(p.v>0?p.on:p.off)}</span>
            <span class="n">${(p.v>=0?'+':'')+p.v.toFixed(2)}%</span>
          </div>`).join('')}</div>
        ${tnx?`<p class="rd-note">US 10-year at ${fmt(tnx,2)}%. Rising yields pressure long-duration growth first.</p>`:''}
      </div>`);
    }
  }catch(e){}


  host.innerHTML=(headline?`<p class="rd-lede">${esc(headline)}</p>`:'')
    +futBand+band+`<div class="rd-grid">${cards.join('')}</div>`;
  $$('.rd-tk',host).forEach(b=>b.addEventListener('click',()=>toChart(b.dataset.sym)));
  $$('em[data-sym]',host).forEach(em=>em.addEventListener('click',()=>toChart(em.dataset.sym)));
  setBar('#dkRead', vix?'current':'partial');
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
    loadSnapshot(C.sym); loadRegime(C.sym); loadGex(C.sym); loadLevels(C.sym);
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
    const d=await marketRead();
    if(d&&d.error) throw new Error(d.message||'The read is not published yet.');
    const x=d&&d.symbols?d.symbols[sym]:null;
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
   LEVELS
   The prices that actually matter for this symbol, derived rather
   than drawn by eye. Every level here is a number the market has
   already reacted to, or a number a large number of participants
   are watching for the same reason.

     PIVOTS      yesterday's range folded into support and
                 resistance the whole futures world uses
     SWINGS      the most recent high and low that price turned at
     AVERAGES    the 20, 50 and 200 day, which is where systematic
                 money changes behaviour
     RANGE       the yearly high and low, and the midpoint

   Each is scored by distance from spot, so what is close sorts to
   the top: a level ten percent away is trivia today.
   ============================================================ */
function swings(bars,look){
  /* a swing point is a bar whose high is the highest, or low the lowest, of
     the window either side of it. Anything less strict finds noise. */
  const hi=[],lo=[];
  for(let i=look;i<bars.length-look;i++){
    let isH=true,isL=true;
    for(let j=i-look;j<=i+look;j++){
      if(j===i)continue;
      if(bars[j].h>=bars[i].h)isH=false;
      if(bars[j].l<=bars[i].l)isL=false;
      if(!isH&&!isL)break;
    }
    if(isH)hi.push({p:bars[i].h,i});
    if(isL)lo.push({p:bars[i].l,i});
  }
  return {hi:hi.slice(-4).reverse(),lo:lo.slice(-4).reverse()};
}
async function loadLevels(sym){
  const host=$('#dkLevels'); if(!host||!sym) return;
  host.innerHTML='<div class="dk-skel"></div><div class="dk-skel"></div>';
  setBar('#dkLevels','reading');
  try{
    const d=await get(`/v1/candles?symbol=${encodeURIComponent(sym)}&range=1y&interval=1d`);
    const bars=d.bars||[];
    if(bars.length<60) throw new Error('Not enough daily history to derive levels.');
    const last=d.price!=null?d.price:bars[bars.length-1].c;
    const prev=bars[bars.length-2]||bars[bars.length-1];

    const L=[];
    /* classic floor-trader pivots off the prior session */
    const P=(prev.h+prev.l+prev.c)/3;
    L.push({p:P,       k:'Pivot',      w:'The session pivot. Above it the day is being bought, below it sold. It is watched because everyone computes it the same way.'});
    L.push({p:2*P-prev.l, k:'R1',      w:'First resistance from the prior range. Ordinary sessions stall near here.'});
    L.push({p:2*P-prev.h, k:'S1',      w:'First support from the prior range.'});
    L.push({p:prev.h,  k:'Prior high', w:'Yesterday\\u2019s high. Taking it out is the simplest definition of a trend day.'});
    L.push({p:prev.l,  k:'Prior low',  w:'Yesterday\\u2019s low. Losing it flips the short-term read.'});

    /* moving averages: where systematic money changes behaviour */
    const c=bars.map(b=>b.c);
    [[20,'20-day'],[50,'50-day'],[200,'200-day']].forEach(([n,lab])=>{
      const v=sma(c,n); if(v==null)return;
      L.push({p:v,k:lab+' average',
        w:'Where a large amount of systematic money changes behaviour. It matters because it is crowded, not because the maths is special.'});
    });

    /* swings: prices this symbol actually turned at */
    const sw=swings(bars,5);
    sw.hi.slice(0,2).forEach(x=>L.push({p:x.p,k:'Swing high',
      w:'A price this symbol reversed at. Sellers were waiting there once, which is the only reason to expect them again.'}));
    sw.lo.slice(0,2).forEach(x=>L.push({p:x.p,k:'Swing low',
      w:'A price this symbol turned up from. Buyers stepped in there once.'}));

    /* the year */
    const hi=Math.max(...bars.map(b=>b.h)), lo=Math.min(...bars.map(b=>b.l));
    L.push({p:hi,k:'52-week high',w:'No overhead supply above it, which is why breaks of it can run.'});
    L.push({p:lo,k:'52-week low', w:'The lowest price anyone has paid this year.'});
    L.push({p:(hi+lo)/2,k:'Yearly midpoint',w:'Splits the year in half. Useful as a bias line, not as a trade.'});

    /* nearest first: a level ten percent away is trivia today */
    L.forEach(x=>{ x.d=(x.p-last)/last*100; x.ad=Math.abs(x.d); });
    const near=L.filter(x=>isFinite(x.p)&&x.ad<25).sort((a,b)=>a.ad-b.ad).slice(0,9);
    const above=near.filter(x=>x.d>0).length, below=near.length-above;

    /* A ladder rather than a list. Price is a vertical axis, so drawing the
       levels on one lets you see the shape of the map at a glance: where the
       clusters are, how far the nearest wall sits, and whether you are pinned
       between two of them or running in open space. */
    const span=Math.max(...near.map(x=>x.ad))*1.12;
    const pos=v=>50-((v-last)/last*100)/span*50;
    const clus=near.slice().sort((a,b)=>b.p-a.p);
    host.innerHTML=`<div class="lv-wrap">
      <div class="lv-rail">
        ${clus.map((x,i)=>`<div class="lv-mk ${x.d>0?'up':'dn'}" style="top:${pos(x.p).toFixed(2)}%"
            title="${esc(x.w)}">
            <span class="lv-tick"></span>
            <span class="lv-lab"><b>${fmt(x.p,2)}</b><em>${esc(x.k)}</em></span>
            <span class="lv-pct">${x.d>0?'+':''}${x.d.toFixed(2)}%</span>
          </div>`).join('')}
        <div class="lv-spot" style="top:50%">
          <span class="lv-spotlab">${fmt(last,2)}</span>
        </div>
      </div>
      <div class="lv-foot">
        <span><b>${below}</b> below</span>
        <span><b>${above}</b> above</span>
        <span class="lv-near">Nearest ${near[0]?esc(near[0].k)+' at '+fmt(near[0].p,2):'\u2014'}</span>
      </div>
    </div>`;
    setBar('#dkLevels',esc(sym));
  }catch(e){
    host.innerHTML=stateBox('NO LEVELS',e.message);
    setBar('#dkLevels','offline');
  }
}

/* ============================================================
   THE WEEK
   Economic releases and earnings on the same five-day grid,
   because they compete for the same attention: a CPI print and a
   megacap report both decide what a Tuesday looks like, and
   reading them in two separate scrolling lists loses that.

   Each day is a column. Macro sits on top, earnings underneath,
   and the day you are in is marked. Nothing scrolls sideways.
   ============================================================ */
const WK_DAY=['Mon','Tue','Wed','Thu','Fri'];
function weekDays(){
  const now=new Date();
  const et=new Date(now.toLocaleString('en-US',{timeZone:'America/New_York'}));
  const dow=et.getDay();                      /* 0 Sun to 6 Sat */
  const back=dow===0?6:dow-1;                 /* wind back to Monday */
  const mon=new Date(et); mon.setDate(et.getDate()-back);
  const out=[];
  for(let i=0;i<5;i++){
    const d=new Date(mon); d.setDate(mon.getDate()+i);
    out.push({iso:d.toISOString().slice(0,10), dom:d.getDate(),
              label:WK_DAY[i], isToday:i===Math.min(4,Math.max(0,back))&&dow>=1&&dow<=5});
  }
  return out;
}
async function loadWeek(){
  const host=$('#dkWeek'); if(!host) return;
  const days=weekDays();
  const byDay={}; days.forEach(d=>byDay[d.iso]={macro:[],earn:[]});

  let macroErr=null, earnErr=null, schedOnly=false;
  try{
    const d=await get('/v1/econ?days=8');
    schedOnly=String(d.src||'').indexOf('official-schedule')>-1;
    (d.events||[]).forEach(e=>{ if(byDay[e.date]) byDay[e.date].macro.push(e); });
  }catch(e){ macroErr=e.message; }

  /* earnings come from the existing Finnhub-backed calendar the page already
     loads, so this costs no extra upstream call */
  try{
    if(typeof window.fetchEarnings==='function'){
      const {list}=await window.fetchEarnings();
      (list||[]).forEach(e=>{ if(byDay[e.date]) byDay[e.date].earn.push(e); });
    } else earnErr='The earnings calendar is not loaded on this page.';
  }catch(e){ earnErr=(e&&e.nokey)?'No market-data key is configured.':'Earnings unavailable right now.'; }

  const cols=days.map(d=>{
    const m=byDay[d.iso].macro.sort((a,b)=>b.impact-a.impact).slice(0,4);
    const er=byDay[d.iso].earn
      .sort((a,b)=>(b.epsEstimate!=null?1:0)-(a.epsEstimate!=null?1:0))
      .slice(0,5);
    const more=byDay[d.iso].earn.length-er.length;
    return `<div class="wk-col${d.isToday?' today':''}">
      <div class="wk-dh"><span class="dw">${d.label}</span><span class="dn">${d.dom}</span></div>
      <div class="wk-sec">
        <span class="wk-lbl">Macro</span>
        ${m.length?m.map(e=>`<div class="wk-ev i${e.impact}" title="${esc(e.event)}">
            <span class="tm">${esc((e.time||'').slice(0,5)||'\u2014')}</span>
            <span class="nm">${esc(e.event)}</span>
            ${e.actual?`<span class="ac">${esc(e.actual)}</span>`:''}
          </div>`).join('')
          :`<div class="wk-quiet">${macroErr?esc(macroErr):'Nothing scheduled'}</div>`}
      </div>
      <div class="wk-sec">
        <span class="wk-lbl">Earnings</span>
        ${er.length?er.map(e=>`<div class="wk-er ${e.hour==='bmo'?'bmo':e.hour==='amc'?'amc':''}">
            <button data-sym="${esc(e.symbol)}">${esc(e.symbol)}</button>
            ${e.epsEstimate!=null?`<span class="es">est ${fmt(e.epsEstimate,2)}</span>`:''}
          </div>`).join('')+(more>0?`<div class="wk-more">+${more} more</div>`:'')
          :`<div class="wk-quiet">${earnErr?esc(earnErr):'No notable reports'}</div>`}
      </div>
    </div>`;
  }).join('');

  host.innerHTML=`<div class="wk-week">${cols}</div>
    <div class="wk-foot">
      <span><i class="k3"></i> Market moving</span>
      <span><i class="k2"></i> Worth watching</span>
      <span><i class="bmo"></i> Before open</span>
      <span><i class="amc"></i> After close</span>
      ${schedOnly?'<span class="wk-src">Consensus figures were unavailable, so macro shows the official release schedule.</span>':''}
    </div>`;
  $$('.wk-er button',host).forEach(b=>b.addEventListener('click',()=>toChart(b.dataset.sym)));
  setBar('#dkWeek', days[0].iso.slice(5)+' to '+days[4].iso.slice(5));
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
    rotStop(); ROT.scope=b.dataset.scope; ROT.drill=null; rotDisp={}; rotBuild(); rotPaint();
  }));
  $$('#rotTf button').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    $$('#rotTf button').forEach(x=>x.classList.toggle('on',x===b));
    rotStop(); ROT.tf=ROT_TF[b.dataset.rtf]||5; rotBuild(); rotPaint();
  }));
  const back=$('#rotBack'); if(back)back.addEventListener('click',rotBackOut);
  });

  const lab=$('#tkNow'); if(lab) lab.textContent='NVDA';
  step('chart',()=>loadChart('NVDA','6M'));
  step('read',loadRead);
  step('week',loadWeek);

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
  everyVisible(loadWeek,900000);
  everyVisible(()=>loadChart(),120000);
  addEventListener('hashchange',()=>setTimeout(reveals,60));
  /* the canvas resizes itself inside the draw loop, so resize only needs to
     nudge a repaint when motion is disabled */
  let rz; addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(ROT.set&&SLOW)rotDraw(0);},240);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();
