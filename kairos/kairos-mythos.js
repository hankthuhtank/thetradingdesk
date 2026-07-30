/* =====================================================================
   KAIROS MYTHOS — market rotation  (v8.6)

   The market's rotating bodies. Classic sectors AND high-conviction themes
   plotted as an industry-standard Relative Rotation Graph — RS-Ratio (x) vs
   RS-Momentum (y) vs SPY. Bodies rotate CLOCKWISE through four phases:

     LEADING    (x>100, y>100)  strong & still accelerating
     WEAKENING  (x>100, y<100)  strong but momentum fading
     LAGGING    (x<100, y<100)  weak & deteriorating
     IMPROVING  (x<100, y>100)  weak but turning up  ← where early rotation shows

   The math (JdK RRG, the de Kempenaer methodology):
     RS      = price / benchmark            (relative strength line)
     RS-Ratio    = 100 + z-score(RS) scaled     (normalised relative strength)
     RS-Momentum = 100 + z-score(ROC of RS-Ratio)
   Computed from daily closes — no new feed.

   BODIES: a sector/theme with a clean, liquid ETF is plotted AS that ETF
   (the tradeable thing = the cleanest signal). A theme WITHOUT a canonical
   ETF (memory, space, quantum, data-center power…) is plotted as a SYNTHETIC
   BASKET: the equal-weight centroid of its member names' own rotation. Those
   are drawn as a hollow ◇ ring and tagged "basket" so it's transparent that
   it's a computed proxy, not a fund you can buy.

   Interaction: click a body → drill into its names and re-plot them. Click a
   name → the full options picture inline. Hover anything → its tail lights up
   and the rest fade, so the graph reads clean instead of as spaghetti.
   Everything is real data; nothing here is a signal.
   ===================================================================== */
'use strict';

/* Sectors (ETF-backed) + themes (mostly synthetic baskets). `etf` is the body
   that gets plotted; when `synth:true` there is no clean ETF so we plot the
   equal-weight centroid of `members`. `cat` groups them for the filter. */
const ORR_SECTORS=[
  // ---- classic SPDR sectors (ETF-backed) ----
  {sym:'XLK', etf:'XLK', name:'Technology',      cat:'sector', members:['NVDA','AAPL','MSFT','AVGO','ORCL','PLTR','AMD','CRM']},
  {sym:'SMH', etf:'SMH', name:'Semiconductors',  cat:'sector', members:['NVDA','AVGO','AMD','TSM','MU','INTC','AMAT','LRCX','MRVL']},
  {sym:'XLC', etf:'XLC', name:'Communication',   cat:'sector', members:['META','GOOGL','NFLX','DIS','T','TMUS','SNAP']},
  {sym:'XLY', etf:'XLY', name:'Consumer Disc.',  cat:'sector', members:['AMZN','TSLA','HD','MCD','CMG','F','NKE','BKNG']},
  {sym:'XLP', etf:'XLP', name:'Staples',         cat:'sector', members:['WMT','COST','PG','KO','PM','PEP','MDLZ']},
  {sym:'XLE', etf:'XLE', name:'Energy',          cat:'sector', members:['XOM','CVX','COP','SLB','EOG','MPC','VLO','OXY']},
  {sym:'XLF', etf:'XLF', name:'Financials',      cat:'sector', members:['JPM','BRK.B','BAC','V','MA','GS','WFC','SCHW']},
  {sym:'XLV', etf:'XLV', name:'Health Care',     cat:'sector', members:['LLY','UNH','JNJ','ABBV','MRK','ISRG','AMGN','PFE']},
  {sym:'XLI', etf:'XLI', name:'Industrials',     cat:'sector', members:['CAT','GE','GEV','RTX','BA','ETN','VRT','DE','HON']},
  {sym:'XLB', etf:'XLB', name:'Materials',       cat:'sector', members:['LIN','FCX','NEM','NUE','STLD','MLM','VMC','APD']},
  {sym:'XLRE',etf:'XLRE',name:'Real Estate',     cat:'sector', members:['EQIX','DLR','PLD','AMT','WELL','O','IRM']},
  {sym:'XLU', etf:'XLU', name:'Utilities',       cat:'sector', members:['NEE','CEG','VST','SO','DUK','AEP']},
  // ---- high-conviction themes ---- (synthetic unless a clean ETF exists)
  {sym:'MEMORY', synth:true, name:'Memory/Storage', cat:'theme', members:['MU','SNDK','WDC','STX']},
  {sym:'SPACE',  synth:true, name:'Space',          cat:'theme', members:['ASTS','RKLB','JOBY','ACHR','RDW','SPCE']},
  {sym:'QUANTUM',synth:true, name:'Quantum',        cat:'theme', members:['IONQ','QBTS','RGTI']},
  {sym:'CYBER',  etf:'CIBR', name:'Cybersecurity',  cat:'theme', members:['CRWD','PANW','FTNT','NET','S']},
  {sym:'FINTECH',synth:true, name:'FinTech/Neobank', cat:'theme', members:['SOFI','HOOD','NU','COIN','AFRM']},
  {sym:'NUCLEAR',synth:true, name:'Nuclear/AI Power',cat:'theme', members:['SMR','OKLO','CEG','VST']},
  {sym:'DCPOWER',synth:true, name:'Data-Center Power',cat:'theme',members:['VRT','ETN','GEV','ANET','CRDO']},
];
const ORR_BENCH='SPY';
const ORR_TAIL=6;            // tail points shown (recent path)
let orrTf=parseInt(localStorage.getItem('kairos_orr_tf'))||5;   // momentum lookback (trading days)
let orrCat=localStorage.getItem('kairos_orr_cat')||'all';       // all | sector | theme
let orrScope=null;          // null = top level; else a sector/theme object (drilled in)
let orrPts=[];              // current plotted bodies {sym,name,tail:[{x,y}],x,y,phase,ret,synth}
let orrRaf=0,orrT=0,orrHover=null,orrLoading=false,orrSel=null;
/* orrPin is the TOUCH equivalent of orrHover: a body the user tapped, which
   stays lit until they tap elsewhere. Desktop hover is transient and needs no
   state; a finger has no hover, so without a pin there was no way to see a
   trail on a phone at all - the tap fell straight through to orrPick and
   drilled into the sector instead.
   orrTrail: 'off' | 'one' | 'all'. 'one' is the original behaviour. */
let orrPin=null;
let orrTrail=(function(){try{return localStorage.getItem('kairos_orr_trail')||'one';}catch(e){return 'one';}})();
let orrTouch=false;   // set true the first time we see a real touch pointer
let orrCloses={};           // sym -> [daily closes]
const orrReduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
/* eased display positions for smooth motion (sym -> {x,y}) */
let orrDisp={};

/* ---- data: reuse the same Tradier daily-history endpoint getTech uses.
   We need ~1 series per symbol; daily bars don't change intraday, so cache
   hard (6h in-memory + localStorage) so Mythos is instant on reload. ---- */
let orrFetchT={};
const ORR_DCACHE='kairos_orr_daily_v1';
(function(){try{const o=JSON.parse(localStorage.getItem(ORR_DCACHE)||'{}');if(o&&o.day===new Date().toISOString().slice(0,10)){orrCloses=o.c||{};Object.keys(orrCloses).forEach(k=>orrFetchT[k]=Date.now()-3600000);}}catch(e){}})();
let orrDSaveT=0;
/* seed the rotation from the server's hourly snapshot — a cold device gets
   the whole universe in one payload instead of ~44 daily-history requests */
window.orrSeed=function(map){
  if(!map)return;let n=0;
  Object.keys(map).forEach(k=>{
    if(!orrCloses[k]||!orrCloses[k].length){orrCloses[k]=map[k];orrFetchT[k]=Date.now();n++;}
  });
  if(n)orrDSave();
  return n;
};
function orrDSave(){const now=Date.now();if(now-orrDSaveT<4000)return;orrDSaveT=now;try{localStorage.setItem(ORR_DCACHE,JSON.stringify({day:new Date().toISOString().slice(0,10),c:orrCloses}));}catch(e){}}
async function orrDaily(sym){
  if(orrCloses[sym]&&Date.now()-(orrFetchT[sym]||0)<6*3600000)return orrCloses[sym];
  if(!(typeof liveOn==='function'?liveOn():(state.tradierToken&&state.tradierToken.length>8)))return orrCloses[sym]||null;
  try{
    const u=underOf(sym);
    const start=new Date(Date.now()-160*86400000).toISOString().slice(0,10);
    const j=await tFetch('/markets/history?symbol='+encodeURIComponent(u)+'&interval=daily&start='+start);
    const days=j.history&&j.history.day;const arr=Array.isArray(days)?days:(days?[days]:[]);
    const closes=arr.map(x=>+x.close).filter(x=>x>0);
    if(closes.length>=50){orrCloses[sym]=closes;orrFetchT[sym]=Date.now();orrDSave();return closes;}
  }catch(e){}
  return orrCloses[sym]||null;
}

/* ---- RRG math ---- */
function orrZWin(a,w){ // rolling z-score of the last value vs trailing window
  const s=a.slice(-w);if(s.length<8)return 0;
  const m=s.reduce((x,y)=>x+y,0)/s.length;
  const v=s.reduce((x,y)=>x+(y-m)*(y-m),0)/Math.max(1,s.length-1);
  const sd=Math.sqrt(v)||1e-9;
  return (a[a.length-1]-m)/sd;
}
/* build RS-Ratio & RS-Momentum SERIES so we can draw a tail */
function orrRRG(closes,bench,tf){
  const n=Math.min(closes.length,bench.length);
  if(n<40)return null;
  const c=closes.slice(-n),b=bench.slice(-n);
  const rs=c.map((v,i)=>v/b[i]);                 // relative strength line
  // RS-Ratio: normalised RS (rolling z -> ~100 centered)
  const win=Math.max(20,tf*4);
  const ratioSer=[];
  for(let i=0;i<rs.length;i++){
    const seg=rs.slice(0,i+1);
    ratioSer.push(100+orrZWin(seg,win)*2.5);
  }
  // RS-Momentum: rate-of-change of the ratio, also normalised
  const momSer=[];
  for(let i=0;i<ratioSer.length;i++){
    if(i<tf){momSer.push(100);continue;}
    const roc=ratioSer[i]-ratioSer[i-tf];
    const seg=ratioSer.slice(0,i+1).map((v,j)=>j>=tf?v-ratioSer[j-tf]:0);
    momSer.push(100+orrZWin(seg,win)*2.5+roc*0.0); // z of ROC
  }
  const tail=[];
  for(let i=Math.max(0,ratioSer.length-ORR_TAIL);i<ratioSer.length;i++)tail.push({x:ratioSer[i],y:momSer[i]});
  const x=ratioSer[ratioSer.length-1],y=momSer[momSer.length-1];
  const ret=c.length>=2?(c[c.length-1]/c[c.length-6>=0?c.length-6:0]-1):0;
  return {x,y,tail,ret};
}
function orrPhase(x,y){
  if(x>=100&&y>=100)return 'Leading';
  if(x>=100&&y<100)return 'Weakening';
  if(x<100&&y<100)return 'Lagging';
  return 'Improving';
}
const ORR_PHASECOL={Leading:'52,211,153',Weakening:'242,193,78',Lagging:'232,121,249',Improving:'34,211,238'};

/* ---- compute the current scope's bodies ---- */
function orrVisibleSectors(){
  return ORR_SECTORS.filter(s=>orrCat==='all'||s.cat===orrCat);
}
/* average a set of member RRG results into one synthetic-basket body */
function orrCentroid(results){
  if(!results.length)return null;
  const n=results.length;
  const x=results.reduce((a,r)=>a+r.x,0)/n;
  const y=results.reduce((a,r)=>a+r.y,0)/n;
  const ret=results.reduce((a,r)=>a+r.ret,0)/n;
  // tail centroid, point-by-point (align on the shortest tail)
  const tl=Math.min(...results.map(r=>r.tail.length));
  const tail=[];
  for(let i=0;i<tl;i++){
    let tx=0,ty=0;results.forEach(r=>{const p=r.tail[r.tail.length-tl+i];tx+=p.x;ty+=p.y;});
    tail.push({x:tx/n,y:ty/n});
  }
  return {x,y,tail,ret};
}
let orrSeeded=false;
async function orrSeedFromServer(){
  if(orrSeeded)return;orrSeeded=true;
  if(!(window.KairosBackend&&window.KairosBackend.enabled&&window.KairosBackend.mythos))return;
  try{const d=await window.KairosBackend.mythos();if(d&&d.c&&window.orrSeed)window.orrSeed(d.c);}catch(e){}
}
async function orrCompute(){
  orrLoading=true;
  /* one payload from the server instead of ~108 daily-history round trips */
  await orrSeedFromServer();
  orrRenderRail(); // paint the loading state immediately
  // --- collect EVERY symbol we'll need up front, then fetch in parallel waves.
  //     Previously each sector/basket fetched serially (~44 round-trips) which
  //     took minutes on first load. Now: one deduped parallel prefetch. ---
  const need=new Set([ORR_BENCH]);
  if(orrScope){orrScope.members.forEach(m=>need.add(m));}
  else{
    orrVisibleSectors().forEach(sec=>{
      if(sec.synth)sec.members.forEach(m=>need.add(m));
      else need.add(sec.etf||sec.sym);
    });
  }
  const syms=[...need];
  for(let i=0;i<syms.length;i+=8){          // 8-wide waves
    await Promise.all(syms.slice(i,i+8).map(s=>orrDaily(s).catch(()=>null)));
  }
  const bench=orrCloses[ORR_BENCH];
  if(!bench){orrLoading=false;orrRenderRail();return;}
  const out=[];
  if(orrScope){
    orrScope.members.forEach(sym=>{
      const c=orrCloses[sym];if(!c)return;
      const r=orrRRG(c,bench,orrTf);if(!r)return;
      out.push({sym,name:sym,x:r.x,y:r.y,tail:r.tail,phase:orrPhase(r.x,r.y),ret:r.ret});
    });
  }else{
    orrVisibleSectors().forEach(sec=>{
      if(sec.synth){
        const rs=[];
        sec.members.forEach(m=>{const c=orrCloses[m];if(!c)return;const r=orrRRG(c,bench,orrTf);if(r)rs.push(r);});
        const cen=orrCentroid(rs);
        if(cen)out.push({sym:sec.sym,name:sec.name,x:cen.x,y:cen.y,tail:cen.tail,phase:orrPhase(cen.x,cen.y),ret:cen.ret,synth:true,n:rs.length});
      }else{
        const c=orrCloses[sec.etf||sec.sym];if(!c)return;
        const r=orrRRG(c,bench,orrTf);if(!r)return;
        out.push({sym:sec.sym,etf:sec.etf,name:sec.name,x:r.x,y:r.y,tail:r.tail,phase:orrPhase(r.x,r.y),ret:r.ret});
      }
    });
  }
  orrPts=out;
  orrLoading=false;
  orrRenderRail();
}

/* ---- canvas render ---- */
function orrCv(){return document.getElementById('orrCanvas');}
function orrStop(){if(orrRaf){cancelAnimationFrame(orrRaf);orrRaf=0;}}
function orrStart(){
  orrStop();
  const wait=document.getElementById('orrWait');
  if(!orrPts.length){if(wait)wait.style.display='';}
  if(orrReduce){orrDraw(0);return;}
  orrT=0;orrRaf=requestAnimationFrame(orrFrame);
}
function orrFrame(ts){const dt=orrT?Math.min(0.05,(ts-orrT)/1000):0.016;orrT=ts;orrDraw(dt);orrRaf=requestAnimationFrame(orrFrame);}

let orrPhase2=0;
/* ═══ SHARED CANVAS GEOMETRY ═══
   orrDraw and the hit-test each used to compute padding independently, both
   hardcoding 42. The moment the drawing padding became responsive, that second
   copy would have put every tap target in the wrong place on a phone - taps
   landing on nothing, or on the wrong body. One formula, one source of truth. */
function orrPad(W){return Math.round(Math.max(20,Math.min(42,W*0.078)));}
function orrGeom(){
  const cv=orrCv();if(!cv)return null;
  const W=cv.clientWidth||700,H=cv.clientHeight||520,PAD=orrPad(W);
  let mx=6;orrPts.forEach(p=>{p.tail.concat([{x:p.x,y:p.y}]).forEach(t=>{mx=Math.max(mx,Math.abs(t.x-100),Math.abs(t.y-100));});});
  mx*=1.15;
  const lo=100-mx,hi=100+mx;
  return {W:W,H:H,PAD:PAD,
    X:v=>PAD+(v-lo)/(hi-lo)*(W-2*PAD),
    Y:v=>PAD+(hi-v)/(hi-lo)*(H-2*PAD)};
}
/* Hit test against the EASED display positions where available, so what you
   tap is what you see mid-animation rather than where the body is headed. */
function orrHitTest(cx,cy,radius){
  const g=orrGeom();if(!g)return null;
  let best=null,bd=radius||22;
  for(const p of orrPts){
    const d=orrDisp[p.sym];
    const bx=d?d.x:g.X(p.x),by=d?d.y:g.Y(p.y);
    const dx=bx-cx,dy=by-cy,dd=Math.sqrt(dx*dx+dy*dy);
    if(dd<bd){bd=dd;best=p.sym;}
  }
  return best;
}

function orrDraw(dt){
  const cv=orrCv();if(!cv)return;
  const ctx=cv.getContext('2d');
  const dpr=Math.min(devicePixelRatio||1,2);
  const W=cv.clientWidth||700,H=cv.clientHeight||520;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  const wait=document.getElementById('orrWait');
  if(!orrPts.length){if(wait)wait.style.display='';return;}
  if(wait)wait.style.display='none';
  orrPhase2+=dt;

  /* Furniture scales with the canvas. At a fixed 42px, a 360px phone lost 23%
     of its width to padding and then drew 10px labels into each other - which
     is exactly what "zoomed out weird" looked like. */
  const NARROW=W<520;
  const SC=NARROW?Math.max(0.72,W/520):1;
  const PAD=orrPad(W);
  const FS=(px,wt)=>(wt||700)+' '+(px*SC).toFixed(1)+'px "JetBrains Mono",monospace';
  // axis bounds: center 100, symmetric, padded to the data
  let mx=6;
  orrPts.forEach(p=>{p.tail.concat([{x:p.x,y:p.y}]).forEach(t=>{mx=Math.max(mx,Math.abs(t.x-100),Math.abs(t.y-100));});});
  mx=mx*1.15;
  const lo=100-mx,hi=100+mx;
  const X=v=>PAD+(v-lo)/(hi-lo)*(W-2*PAD);
  const Y=v=>PAD+(hi-v)/(hi-lo)*(H-2*PAD);
  const cx=X(100),cy=Y(100);

  // quadrant fills
  const quad=(x0,y0,x1,y1,col)=>{ctx.fillStyle='rgba('+col+',.05)';ctx.fillRect(x0,y0,x1-x0,y1-y0);};
  quad(cx,PAD,W-PAD,cy,ORR_PHASECOL.Leading);       // top-right
  quad(cx,cy,W-PAD,H-PAD,ORR_PHASECOL.Weakening);   // bottom-right
  quad(PAD,cy,cx,H-PAD,ORR_PHASECOL.Lagging);       // bottom-left
  quad(PAD,PAD,cx,cy,ORR_PHASECOL.Improving);       // top-left

  // crosshair at benchmark (100,100)
  ctx.strokeStyle='rgba(126,166,214,.28)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(cx,PAD);ctx.lineTo(cx,H-PAD);ctx.moveTo(PAD,cy);ctx.lineTo(W-PAD,cy);ctx.stroke();
  // frame
  ctx.strokeStyle='rgba(126,166,214,.14)';ctx.strokeRect(PAD,PAD,W-2*PAD,H-2*PAD);

  // quadrant labels
  const ql=(txt,x,y,col,align)=>{ctx.font=FS(10);ctx.fillStyle='rgba('+col+',.5)';ctx.textAlign=align;ctx.fillText(txt,x,y);ctx.textAlign='left';};
  /* On a narrow canvas the full words collide with the axis labels, so the
     quadrants shorten to stubs. Still unambiguous - the four colours were
     always the primary cue and the words only the confirmation. */
  const qn=NARROW?['LEAD','WEAK','LAG','IMPR']:['LEADING','WEAKENING','LAGGING','IMPROVING'];
  ql(qn[0],W-PAD-4,PAD+12*SC,ORR_PHASECOL.Leading,'right');
  ql(qn[1],W-PAD-4,H-PAD-5,ORR_PHASECOL.Weakening,'right');
  ql(qn[2],PAD+4,H-PAD-5,ORR_PHASECOL.Lagging,'left');
  ql(qn[3],PAD+4,PAD+12*SC,ORR_PHASECOL.Improving,'left');
  ctx.font=FS(8.5,600);ctx.fillStyle='rgba(126,166,214,.5)';ctx.textAlign='center';
  ctx.fillText(NARROW?'RS →':'RS-RATIO →',W/2,H-PAD+Math.min(16,PAD-6));
  ctx.save();ctx.translate(Math.max(9,PAD-14),H/2);ctx.rotate(-Math.PI/2);
  ctx.fillText(NARROW?'MOMENTUM →':'RS-MOMENTUM →',0,0);ctx.restore();
  ctx.textAlign='left';
  /* Hint text adapts to the input device. It used to say "hover", which is
     advice a phone cannot take. */
  if(!(orrHover||orrPin||orrSel)&&orrPts.length&&PAD>=24&&orrTrail!=='all'){
    ctx.font=FS(8.5,600);ctx.fillStyle='rgba(126,166,214,.4)';ctx.textAlign='center';
    ctx.fillText(orrTouch?'tap a body for its trail · tap again to open'
                        :'hover a body for its rotation trail',W/2,PAD-11);
    ctx.textAlign='left';
  }

  // --- eased display positions: bodies glide instead of snapping ---
  const focus=orrHover||orrPin||orrSel;            // hover (mouse), pin (touch), or drilled selection
  const anyFocus=!!focus;
  for(const p of orrPts){
    const tgtX=X(p.x),tgtY=Y(p.y);
    const d=orrDisp[p.sym]||(orrDisp[p.sym]={x:tgtX,y:tgtY});
    const k=orrReduce?1:Math.min(1,dt*8);
    d.x+=(tgtX-d.x)*k;d.y+=(tgtY-d.y)*k;
  }

  // --- TAILS FIRST, under the bodies. Default: hidden. Only the focused body
  //     shows a bright tail — this is what kills the spaghetti. ---
  for(const p of orrPts){
    if(p.tail.length<2)continue;
    const isFocus=focus===p.sym;
    if(orrTrail==='off')break;                      // OFF: no tails, ever
    if(orrTrail==='one'&&(!anyFocus||!isFocus))continue;  // ONE: only the focused body
    // ALL: every tail draws, the focused one brighter (see alpha below)
    const col=ORR_PHASECOL[p.phase];
    for(let i=1;i<p.tail.length;i++){
      const a=(i/p.tail.length)*(isFocus?0.85:(orrTrail==='all'?0.26:0.85));
      ctx.strokeStyle='rgba('+col+','+a.toFixed(2)+')';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(X(p.tail[i-1].x),Y(p.tail[i-1].y));ctx.lineTo(X(p.tail[i].x),Y(p.tail[i].y));ctx.stroke();
    }
    if(isFocus||orrTrail!=='all')for(let i=0;i<p.tail.length-1;i++){ctx.fillStyle='rgba('+col+',.5)';ctx.beginPath();ctx.arc(X(p.tail[i].x),Y(p.tail[i].y),2*SC,0,7);ctx.fill();}
  }

  // --- BODIES ---
  for(const p of orrPts){
    const col=ORR_PHASECOL[p.phase];
    const d=orrDisp[p.sym];const px=d.x,py=d.y;
    const isFocus=focus===p.sym;
    const dim=anyFocus&&!isFocus;                   // fade the crowd when one is in focus
    const baseA=dim?0.3:1;
    const pulse=isFocus?1:0.7+0.15*Math.sin(orrPhase2*1.8+p.sym.length);
    // glow
    const gr=(isFocus?22:14)*SC;
    const rg=ctx.createRadialGradient(px,py,0,px,py,gr);
    rg.addColorStop(0,'rgba('+col+','+(0.85*pulse*baseA).toFixed(2)+')');rg.addColorStop(1,'rgba('+col+',0)');
    ctx.fillStyle=rg;ctx.beginPath();ctx.arc(px,py,gr,0,7);ctx.fill();
    // core: solid dot for ETF bodies, hollow ◇ ring for synthetic baskets
    ctx.lineWidth=2;
    if(p.synth){
      ctx.strokeStyle='rgba('+col+','+baseA+')';
      ctx.beginPath();
      const r=(isFocus?6:4.5)*SC;
      ctx.moveTo(px,py-r);ctx.lineTo(px+r,py);ctx.lineTo(px,py+r);ctx.lineTo(px-r,py);ctx.closePath();
      ctx.stroke();
      ctx.fillStyle='rgba('+col+','+(0.22*baseA).toFixed(2)+')';ctx.fill();
    }else{
      ctx.fillStyle='rgba('+col+','+baseA+')';
      ctx.beginPath();ctx.arc(px,py,(isFocus?5.5:4)*SC,0,7);ctx.fill();
    }
    /* label. On a narrow canvas only the focused body and the two leading
       quadrants keep a label - otherwise a dozen 10px tickers overlap into an
       unreadable smear, which was most of the "zoomed out weird" complaint. */
    const showLab=!NARROW||isFocus||p.phase==='Leading'||p.phase==='Improving';
    if(showLab){
      ctx.font=FS(isFocus?12:10.5);
      ctx.fillStyle='rgba(233,237,245,'+(dim?0.4:isFocus?1:0.9)+')';
      const lx=px+9*SC;
      // flip the label inboard when the body sits near the right edge
      if(lx+30*SC>W-4){ctx.textAlign='right';ctx.fillText(p.sym,px-8*SC,py+3.5*SC);ctx.textAlign='left';}
      else ctx.fillText(p.sym,lx,py+3.5*SC);
    }
    if(isFocus){
      ctx.font=FS(9,600);ctx.fillStyle='rgba('+col+',.95)';
      const meta=NARROW
        ? p.phase.toUpperCase()+' · '+(p.ret>=0?'+':'')+(p.ret*100).toFixed(1)+'%'
        : p.name+' · '+p.phase.toUpperCase()+' · '+(p.ret>=0?'+':'')+(p.ret*100).toFixed(1)+'% 5d'+(p.synth?' · basket':'');
      const mw=ctx.measureText(meta).width;
      ctx.fillText(meta,Math.min(px+9*SC,Math.max(4,W-mw-6)),py+16*SC);
    }
  }
}

/* ---- rail: sector/stock list, sorted by phase then strength ---- */
function orrRenderRail(){
  const rail=document.getElementById('orrRail');if(!rail)return;
  const order={Leading:0,Weakening:1,Improving:2,Lagging:3};
  const sorted=[...orrPts].sort((a,b)=>(order[a.phase]-order[b.phase])||(b.x-a.x));
  const head=orrScope?('<div class="orr-rail-h">'+orrScope.name.toUpperCase()+' · LEADERS</div>')
                     :'<div class="orr-rail-h">'+(orrCat==='sector'?'SECTORS':orrCat==='theme'?'THEMES':'SECTORS + THEMES')+' · click to drill in</div>';
  // "standing out / dying" callout
  const lead=sorted.filter(p=>p.phase==='Leading');
  const dying=sorted.filter(p=>p.phase==='Weakening'||p.phase==='Lagging');
  const impr=sorted.filter(p=>p.phase==='Improving');
  let callout='';
  if(!orrScope&&orrPts.length){
    const top=sorted[0];
    callout='<div class="orr-callout">'+
      (top?'<div><span class="oc-l" style="color:var(--green)">STANDING OUT</span> '+top.sym+' '+top.name+'</div>':'')+
      (impr.length?'<div><span class="oc-l" style="color:var(--cyan)">TURNING UP</span> '+impr.slice(0,3).map(p=>p.sym).join(' ')+'</div>':'')+
      (dying.length?'<div><span class="oc-l" style="color:#e879f9">FADING</span> '+dying.slice(0,3).map(p=>p.sym).join(' ')+'</div>':'')+
      '</div>';
  }
  rail.innerHTML=head+callout+sorted.map(p=>{
    const col=ORR_PHASECOL[p.phase];
    return '<div class="orr-row'+(orrSel===p.sym||orrPin===p.sym?' sel':'')+'" data-sym="'+p.sym+'">'+
      '<span class="orr-dot" style="background:rgb('+col+')"></span>'+
      '<span class="orr-rsym">'+p.sym+(p.synth?' <span class="orr-basket" title="synthetic basket — equal-weight of members, no ETF">◇</span>':'')+'</span>'+
      '<span class="orr-rname">'+p.name+'</span>'+
      '<span class="orr-rphase" style="color:rgb('+col+')">'+p.phase+'</span>'+
      '<span class="orr-rret" style="color:'+(p.ret>=0?'var(--green)':'var(--red)')+'">'+(p.ret>=0?'+':'')+(p.ret*100).toFixed(1)+'%</span>'+
      '</div>';
  }).join('');
  rail.querySelectorAll('.orr-row').forEach(r=>{
    r.onmouseenter=()=>{orrHover=r.dataset.sym;};
    r.onmouseleave=()=>{orrHover=null;};
    r.onclick=()=>orrPick(r.dataset.sym);
  });
  const meta=document.getElementById('orrMeta');
  if(meta)meta.textContent=orrPts.length+' bodies · '+(orrScope?orrScope.name:(orrCat==='all'?'sectors + themes':orrCat))+' · RS vs '+ORR_BENCH;
}

/* ---- pick: sector -> drill into members; stock -> options picture ---- */
async function orrPick(sym){
  const sec=ORR_SECTORS.find(s=>s.sym===sym);
  if(sec && !orrScope){
    orrScope=sec;orrSel=null;orrPin=null;orrPts=[];orrDisp={};
    document.getElementById('orrBack').style.display='';
    document.getElementById('orrDrill').innerHTML='';
    const wait=document.getElementById('orrWait');if(wait){wait.style.display='';wait.innerHTML='Loading '+sec.name+' leaders\u2026';}
    await orrCompute();
    return;
  }
  // a stock (either a drilled member, or clicking a sector ETF while already scoped)
  orrSel=sym;orrRenderRail();
  orrDrill(sym);
}
function orrBack(){
  orrScope=null;orrSel=null;orrPin=null;orrPts=[];orrDisp={};
  document.getElementById('orrBack').style.display='none';
  document.getElementById('orrDrill').innerHTML='';
  const wait=document.getElementById('orrWait');if(wait){wait.style.display='';wait.innerHTML='Loading the market\u2026';}
  orrCompute();
}

/* ---- drill panel: the options picture, reusing Kairos engines ---- */
async function orrDrill(sym){
  const host=document.getElementById('orrDrill');if(!host)return;
  host.innerHTML='<div class="orr-drill-load">Pulling '+sym+' chain\u2026</div>';
  // make sure we have the chain + tech
  if(!state.data[sym]){
    try{const r=await getSym(sym);if(r){state.data[sym]=r;state.dataAge[sym]=Date.now();}}catch(e){}
  }
  if(!state.tech[sym]){try{await getTech(sym);}catch(e){}}
  const d=state.data[sym];
  if(!d||!d.strikes||!d.strikes.length){host.innerHTML='<div class="orr-drill-load">No option chain for '+sym+'.</div>';return;}
  const spot=d.spot||state.spot[sym]||0;
  const kg=kingOf(d.strikes,'gex'),cw=callWallBand(d.strikes,spot,'gex'),pw=putWallBand(d.strikes,spot,'gex');
  const ps=panelStats(sym,d,'gex');
  const pos=ps.net1>=0;
  // biggest opening prints (Tape engine) — 15-min-ok flow
  let prints=[];
  try{const fl=flowLean(sym);if(fl)prints=fl.prints.slice(0,8);}catch(e){}
  const dp=spot>2000?0:2;
  const stat=(l,v,c,tip)=>'<div class="od-stat"'+(tip?' data-tip="'+tip+'"':'')+'><div class="od-l">'+l+'</div><div class="od-v" style="color:'+(c||'var(--text)')+'">'+v+'</div></div>';
  const regime=pos?'<span style="color:var(--teal)">+GEX · pinning</span>':'<span style="color:#e879f9">−GEX · momentum</span>';
  // mini GEX ladder around spot (top nodes)
  const band=[...d.strikes].filter(s=>Math.abs(s.k-spot)<=spot*0.06).sort((a,b)=>Math.abs(b.gex)-Math.abs(a.gex)).slice(0,10).sort((a,b)=>b.k-a.k);
  const gmax=Math.max(1,...band.map(s=>Math.abs(s.gex)));
  const ladder=band.map(s=>{
    const r=Math.abs(s.gex)/gmax,w=Math.round(r*100);
    const isSpot=Math.abs(s.k-spot)===Math.min(...band.map(z=>Math.abs(z.k-spot)));
    const c=s.gex>=0?'var(--teal)':'#e879f9';
    return '<div class="od-lrow'+(isSpot?' spot':'')+'"><span class="od-lk">'+s.k+(s.k===(kg&&kg.k)?' ★':'')+'</span>'+
      '<span class="od-lbar"><i style="width:'+w+'%;background:'+c+'"></i></span>'+
      '<span class="od-lv" style="color:'+c+'">'+fmt(s.gex)+'</span></div>';
  }).join('');
  const printsHtml=prints.length?('<table class="od-prints"><tr><th>Contract</th><th>Vol/OI</th><th>Prem</th><th>Read</th></tr>'+
    prints.map(p=>{
      const cls=orrClassify(p,spot);
      return '<tr><td><span class="cbadge '+(p.call?'c':'p')+'">'+(p.call?'C':'P')+'</span> '+p.k+' '+p.e.slice(5)+'</td><td>'+p.voi.toFixed(1)+'×</td><td style="color:var(--gold)">'+fmt(p.prem)+'</td><td><span class="od-tag '+cls.cls+'">'+cls.label+'</span></td></tr>';
    }).join('')+'</table>'):'<div class="od-noflow">No qualifying opening prints yet (needs vol ≥70% of OI, ≥$25k premium).</div>';
  host.innerHTML=
    '<div class="od-head"><div class="od-sym">'+sym+' <span class="od-px">$'+(+spot).toFixed(dp)+'</span></div>'+
      '<div class="od-regime">'+regime+' · Crown '+(kg?kg.k:'—')+'</div>'+
      '<button class="btn od-open" data-sym="'+sym+'" style="border-color:var(--border)">Open in Junction →</button></div>'+
    '<div class="od-grid">'+
      '<div class="od-col">'+
        '<div class="od-statrow">'+
          stat('FIELD',pos?'AEGIS':'MAELSTROM',pos?'var(--teal)':'#e879f9','Net ±1% GEX regime')+
          stat('CALL WALL',cw?cw.k:'—','var(--teal)')+
          stat('PUT WALL',pw?pw.k:'—','#c99bff')+
          stat('EM ±',ps.em?(spot>2000?ps.em.toFixed(0):ps.em.toFixed(2)):'—','var(--cyan)','1σ expected move')+
        '</div>'+
        '<div class="od-lh">GEX NEAR SPOT</div>'+ladder+
      '</div>'+
      '<div class="od-col">'+
        '<div class="od-lh">BIGGEST OPENING PRINTS <span style="color:var(--faint)">· hedge / spread / bet</span></div>'+
        printsHtml+
      '</div>'+
    '</div>';
  host.querySelector('.od-open').onclick=e=>{const s=e.target.dataset.sym;state.focus=s;setView('single');};
}

/* ---- honest heuristic classification of a print ----
   We CANNOT see the aggressor side or linked legs from REST, so this is a
   labelled heuristic, not a claim of certainty:
   • deep-OTM put with big OI already there  -> likely HEDGE
   • strike far from spot, round lot, low IV  -> possible SPREAD leg
   • near-money, high vol/OI, elevated IV      -> directional BET
   The tag is a lean, and says so on hover. */
function orrClassify(p,spot){
  const otm=(p.call&&p.k>spot)||(!p.call&&p.k<spot);
  const dist=Math.abs(p.k-spot)/spot;
  if(!p.call && otm && dist>0.05 && p.oi>p.vol)
    return {cls:'hedge',label:'hedge?'};
  if(dist>0.07 && p.voi<1.2)
    return {cls:'spread',label:'spread leg?'};
  if(dist<0.03 && p.voi>=1.2)
    return {cls:'bet',label:'bet'};
  return {cls:'flow',label:otm?'directional':'itm flow'};
}

/* ---- pointer picking on the canvas ----
   Rewritten for touch. The old handler was mousemove + click only, and it also
   carried its own duplicate PAD=42. On a phone there is no mousemove, so
   orrHover stayed null and the synthesized click fell through to orrPick -
   drilling into a sector when all the user wanted was to see a trail. Long
   presses on a bare <canvas> also raise the browser's own image/context menu,
   which is the "opens page settings" behaviour.

   Now: mouse keeps hover-to-preview, click-to-open. Touch gets a two-stage tap
   - first tap PINS the body (trail + readout, no navigation), second tap on the
   same body opens it, tap on empty space clears. Same gesture grammar as any
   map app, and nothing is reachable only by hovering. */
let orrCanvasWired=false;
function orrCanvasInit(){
  const cv=orrCv();if(!cv)return;
  if(orrCanvasWired)return;          // setView('chart') runs on every entry to
  orrCanvasWired=true;               // the view; without this, listeners stacked
  cv.style.cursor='pointer';
  cv.style.touchAction='pan-y';                 // vertical page scroll still works
  cv.style.webkitTapHighlightColor='transparent';
  try{cv.style.webkitTouchCallout='none';}catch(e){}

  const at=(e)=>{const r=cv.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};

  cv.addEventListener('mousemove',e=>{
    if(orrTouch)return;                          // ignore synthetic mouse after touch
    const [mx,my]=at(e);
    const best=orrHitTest(mx,my,22);
    orrHover=best;cv.style.cursor=best?'pointer':'default';
  });
  cv.addEventListener('mouseleave',()=>{orrHover=null;});
  cv.addEventListener('click',()=>{if(!orrTouch&&orrHover)orrPick(orrHover);});

  /* Touch path. pointerdown fires before any synthetic mouse event, so pinning
     here and flagging orrTouch stops the old click handler from also firing. */
  cv.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse')return;
    orrTouch=true;orrHover=null;
    const [mx,my]=at(e);
    const hit=orrHitTest(mx,my,34);              // fingers are wider than cursors
    if(!hit){ if(orrPin){orrPin=null;orrRenderRail();} return; }
    if(orrPin===hit){ orrPin=null; orrPick(hit); return; }   // second tap opens
    orrPin=hit; orrRenderRail();                              // first tap pins
    if(navigator.vibrate){try{navigator.vibrate(8);}catch(x){}}
  },{passive:true});

  // kill the long-press image/context menu on the canvas
  cv.addEventListener('contextmenu',e=>{e.preventDefault();});
}
/* Cycle OFF -> ONE -> ALL. Exposed so the toggle and any keyboard shortcut
   share one code path. */
function orrSetTrail(mode){
  orrTrail=(mode==='off'||mode==='one'||mode==='all')?mode:'one';
  try{localStorage.setItem('kairos_orr_trail',orrTrail);}catch(e){}
  const box=document.getElementById('orrTrailSel');
  if(box)box.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.tr===orrTrail));
}

/* ---- view wiring ---- */
(function(){
  const __sv=setView;
  setView=function(v){
    const cs=document.getElementById('chartSec');
    if(v!=='chart'){orrStop();return __sv(v);}
    // Orrery owns the (renamed) Chart view
    state.view='chart';
    if(window.clearNav)window.clearNav();
    const cb=document.getElementById('btnChart');if(cb)cb.classList.add('active');
    ['trinityWrap','ideasSec','imbSec','tapeSec','arenaSec'].forEach(id=>{const e=document.getElementById(id);if(e)e.classList.add('hidden');});
    if(cs)cs.classList.remove('hidden');
    document.getElementById('presetBar').classList.add('hidden');
    document.getElementById('mtoggle').classList.add('dim');
    document.getElementById('centertoggle').classList.add('dim');
    orrCanvasInit();
    orrStart();
    if(!orrPts.length&&!orrLoading)orrCompute();
  };
  const cb=document.getElementById('btnChart');
  if(cb)cb.onclick=function(){setView('chart');};
  const bk=document.getElementById('orrBack');if(bk)bk.onclick=orrBack;
  const tf=document.getElementById('orrTf');
  if(tf)tf.addEventListener('click',e=>{
    const b=e.target.closest('button[data-tf]');if(!b)return;
    tf.querySelectorAll('button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
    orrTf=parseInt(b.dataset.tf);try{localStorage.setItem('kairos_orr_tf',String(orrTf));}catch(x){}
    orrCloses={};orrFetchT={};orrPts=[];orrDisp={};orrCompute();
  });
  const trl=document.getElementById('orrTrailSel');
  if(trl){
    orrSetTrail(orrTrail);                       // reflect the saved mode on load
    trl.addEventListener('click',e=>{
      const b=e.target.closest('button[data-tr]');if(!b)return;
      orrSetTrail(b.dataset.tr);
    });
  }
  const cat=document.getElementById('orrCatSel');
  if(cat)cat.addEventListener('click',e=>{
    const b=e.target.closest('button[data-cat]');if(!b)return;
    cat.querySelectorAll('button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
    orrCat=b.dataset.cat;try{localStorage.setItem('kairos_orr_cat',orrCat);}catch(x){}
    if(orrScope){orrScope=null;const bkb=document.getElementById('orrBack');if(bkb)bkb.style.display='none';document.getElementById('orrDrill').innerHTML='';}
    orrSel=null;orrPin=null;orrPts=[];orrDisp={};orrCompute();
  });
})();
document.addEventListener('visibilitychange',function(){
  if(state.view!=='chart')return;
  if(document.hidden)orrStop();else orrStart();
});
window.orrSetTrail=orrSetTrail;
window.KairosMythos={ORR_SECTORS,orrCompute,orrSetTrail,orrRRG,orrClassify,orrCentroid,pts:function(){return orrPts;},closes:function(){return orrCloses;}};
window.KairosOrrery=window.KairosMythos; // back-compat alias
console.log('%cKairos Mythos \u2014 the market\u0027s rotating bodies. Sectors + themes, RS vs SPY, four phases, clockwise.','color:#34d399;font-weight:bold');
