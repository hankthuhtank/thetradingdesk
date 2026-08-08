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
let orrEnd={};              // sym -> last bar date 'YYYY-MM-DD'
let orrCal=null;            // shared trading calendar (SPY's dates)

/* ---- REPLAY --------------------------------------------------------------
   The full RS-Ratio / RS-Momentum series was always computed and then thrown
   away, so replay costs nothing beyond a playhead. This is also the canonical
   RRG feature rather than an invention: a static plot shows the trail over the
   past n observations, a dynamic one moves it forward one observation at a
   time. */
let orrSet=null;            // {bodies, dates, len} from orrRRGSet
let orrMetaMap={};          // key -> {sym,name,synth,...}
let orrHead=null;           // playhead bar index; null = live
let orrPlaying=false;
let orrSpeed=1;
let orrAcc=0;               // fractional bar accumulator
const ORR_BPS=3;            // base bars per second at 1x
const orrReduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
/* eased display positions for smooth motion (sym -> {x,y}) */
let orrDisp={};

/* ---- data: reuse the same Tradier daily-history endpoint getTech uses.
   We need ~1 series per symbol; daily bars don't change intraday, so cache
   hard (6h in-memory + localStorage) so Mythos is instant on reload. ---- */
let orrFetchT={};
const ORR_DCACHE='kairos_orr_daily_v1';
(function(){try{const o=JSON.parse(localStorage.getItem(ORR_DCACHE)||'{}');if(o&&o.day===new Date().toISOString().slice(0,10)){orrCloses=o.c||{};orrEnd=o.e||{};orrCal=o.cal||null;Object.keys(orrCloses).forEach(k=>orrFetchT[k]=Date.now()-3600000);}}catch(e){}})();
let orrDSaveT=0;
/* seed the rotation from the server's hourly snapshot — a cold device gets
   the whole universe in one payload instead of ~44 daily-history requests */
window.orrSeed=function(map,ends,cal){
  if(!map)return;let n=0;
  Object.keys(map).forEach(k=>{
    if(!orrCloses[k]||!orrCloses[k].length){
      orrCloses[k]=map[k];
      if(ends&&ends[k])orrEnd[k]=ends[k];
      orrFetchT[k]=Date.now();n++;
    }
  });
  if(cal&&cal.length&&(!orrCal||cal.length>orrCal.length))orrCal=cal;
  if(n)orrDSave();
  return n;
};
function orrDSave(){const now=Date.now();if(now-orrDSaveT<4000)return;orrDSaveT=now;try{localStorage.setItem(ORR_DCACHE,JSON.stringify({day:new Date().toISOString().slice(0,10),c:orrCloses,e:orrEnd,cal:orrCal}));}catch(e){}}
async function orrDaily(sym){
  if(orrCloses[sym]&&Date.now()-(orrFetchT[sym]||0)<6*3600000)return orrCloses[sym];
  if(!(typeof liveOn==='function'?liveOn():(state.tradierToken&&state.tradierToken.length>8)))return orrCloses[sym]||null;
  try{
    const u=underOf(sym);
    const start=new Date(Date.now()-160*86400000).toISOString().slice(0,10);
    const j=await tFetch('/markets/history?symbol='+encodeURIComponent(u)+'&interval=daily&start='+start);
    const days=j.history&&j.history.day;const arr=Array.isArray(days)?days:(days?[days]:[]);
    const rows=arr.filter(x=>+x.close>0);
    const closes=rows.map(x=>+x.close);
    if(closes.length>=50){
      orrCloses[sym]=closes;
      orrEnd[sym]=rows[rows.length-1].date;
      /* The benchmark's dates ARE the trading calendar every other series is
         aligned onto, so capture them whenever SPY comes back. */
      if(sym===ORR_BENCH)orrCal=rows.map(x=>x.date);
      orrFetchT[sym]=Date.now();orrDSave();return closes;
    }
  }catch(e){}
  return orrCloses[sym]||null;
}

/* ---- RRG math v9 ---------------------------------------------------------
   Three things changed and the first one is the important one.

   1. CROSS-SECTIONAL NORMALISATION. The old build z-scored each symbol against
      its OWN trailing 20 bars. That is the opposite of what an RRG requires:
      the whole premise is that RS-Ratio values for different securities are
      comparable because they share a benchmark and a scale. A per-security
      z-score means a chronically weak sector that is mildly less weak than its
      own average gets plotted in Leading, and a strong sector consolidating
      gets plotted in Lagging. The quadrants were not measuring what the labels
      said. The z-score is now taken ACROSS THE UNIVERSE at each date, so 100 is
      the field's median on that date by construction.

   2. LONGER TREND WINDOW. tf=5 gave a 20-bar window. Twenty bars of z-score
      makes every body oscillate around 100 at high frequency, which destroys
      the slow clockwise rotation that is the entire signal. The trend leg now
      runs on ~63 bars (one quarter) and momentum stays on the user's tf.

   3. FULL SERIES RETAINED. The old code computed every bar and then discarded
      everything but the last six points. Keeping it costs nothing and is what
      makes replay possible.

   Also removed: `+roc*0.0`, a rate-of-change term computed and then multiplied
   by zero, and the expanding `slice(0,i+1)` inside both loops, which made this
   O(n^2) across ~110 symbols when orrZWin only ever read the last `win` values. */

const ORR_TREND_W=63;      // trend leg of RS-Ratio, about one quarter of sessions
const ORR_Z=2.5;           // 100 +/- ORR_Z*z, unchanged so the scale stays familiar

function orrSMA(a,w){
  const out=new Array(a.length);let s=0;
  for(let i=0;i<a.length;i++){
    s+=a[i];
    if(i>=w)s-=a[i-w];
    out[i]=i>=w-1?s/w:s/(i+1);
  }
  return out;
}
/* z-score COLUMN-wise: at each date, across every body in the plot. This single
   function is what makes quadrant position comparable between XLU and SMH. */
/* z-score COLUMN-wise, but scored against a FIXED REFERENCE SET.

   Fixing the window alone did not make devices agree, because a cross-sectional
   z-score depends on WHICH bodies are in the sample, not only on the window. A
   theme cached on the laptop and not on the phone changed the mean and the
   standard deviation, and therefore moved every other body on the plot.

   So the statistics come from the ELEVEN SECTOR ETFs only. They are always
   fetched, always complete, and identical everywhere. Themes are then placed on
   that same scale rather than contributing to it. A theme appearing or failing
   to load can no longer shift anything else by even a pixel.

   It is also the better definition: "leading" now means leading relative to the
   sector field, a stable reference, instead of relative to whatever mix of
   bodies this particular browser happened to have in cache. */
function orrXZ(rows,refIdx){
  const n=rows.length;if(!n)return[];
  const L=rows[0].length;
  const out=rows.map(()=>new Array(L).fill(0));
  const ref=(refIdx&&refIdx.length>=5)?refIdx:rows.map((_,i)=>i);
  for(let t=0;t<L;t++){
    let m=0,c=0;
    for(const i of ref){const v=rows[i][t];if(isFinite(v)){m+=v;c++;}}
    if(c<2)continue;
    m/=c;
    let s2=0;
    for(const i of ref){const v=rows[i][t];if(isFinite(v))s2+=(v-m)*(v-m);}
    const sd=Math.sqrt(s2/(c-1))||1e-9;
    for(let i=0;i<n;i++){const v=rows[i][t];out[i][t]=isFinite(v)?(v-m)/sd:0;}
  }
  return out;
}

/* Align every series onto the shared trading calendar by DATE, not by index.
   The universe refreshes as a rotating slice, so a symbol pulled three hours
   ago and one pulled just now can end on different days; aligning by array
   position silently compared Tuesday's XLE against Monday's XLU on the same
   tail point. Trailing gaps carry the last close forward and the body is
   flagged so the rail can say so rather than pretend. */
/* FIXED window length. Every device computes over exactly these many calendar
   bars, so the numbers cannot drift with what happens to be cached locally. */
const ORR_WINDOW=150;

function orrAlignSet(map){
  const cal=(orrCal&&orrCal.length)?orrCal:null;
  const keys=Object.keys(map).filter(k=>map[k]&&map[k].length>=ORR_TREND_W+10);
  if(keys.length<2)return null;
  if(!cal){
    // No calendar yet (first load). Fall back to index alignment, as before.
    const n=Math.min.apply(null,keys.map(k=>map[k].length));
    if(n<ORR_TREND_W+10)return null;
    const o={};keys.forEach(k=>o[k]=map[k].slice(-n));
    return {series:o,dates:null,stale:{},dropped:[]};
  }

  /* ---- WHY THIS IS NOT DEVICE-DEPENDENT ANY MORE ------------------------
     Two devices were showing different Mythos plots, and the cause is a direct
     consequence of cross-sectional normalisation: a body's coordinates depend
     on WHICH OTHER BODIES share the plot and on the window they share. The old
     code let both of those vary per device.

       1. The universe was "whatever this browser happens to have cached",
          because orrCloses fills in over time and localStorage differs. A theme
          loaded on the laptop and not on the phone shifted every other body.

       2. The window start was max(first bar) across the set, so ONE symbol with
          a short history dragged the start later FOR EVERYONE and re-scored the
          entire field.

     Both are fixed by inverting the rule. The window is now a fixed 150 calendar
     bars ending at the last session, identical everywhere. A body must cover
     that whole window with REAL data to be plotted; one that cannot is DROPPED
     rather than accommodated, so a straggler can no longer reshape the field.
     The set then converges to the same members on every device as soon as the
     seed lands, instead of depending on fetch order. */
  const idx={};cal.forEach((d,i)=>idx[d]=i);
  const end=cal.length-1;
  const start=Math.max(0,cal.length-ORR_WINDOW);
  if(end-start<ORR_TREND_W+10)return null;

  const rows={},stale={},dropped=[];
  for(const k of keys){
    const c=map[k];
    const e=orrEnd[k];
    const last=(e&&idx[e]!=null)?idx[e]:end;
    stale[k]=end-last;
    const row=new Array(cal.length).fill(null);
    for(let j=0;j<c.length;j++){
      const p=last-(c.length-1-j);
      if(p>=0&&p<cal.length)row[p]=c[j];
    }
    /* first REAL bar, before any carry-forward */
    let first=-1;
    for(let i=0;i<cal.length;i++){if(row[i]!=null){first=i;break;}}
    if(first<0||first>start){dropped.push(k);continue;}   // does not cover the window
    /* carry the last known close across trailing gaps only */
    let prev=null;
    for(let i=0;i<cal.length;i++){
      if(row[i]!=null)prev=row[i];
      else if(prev!=null)row[i]=prev;
    }
    rows[k]=row;
  }
  const ks=Object.keys(rows);
  if(ks.length<2)return null;
  const o={};ks.forEach(k=>o[k]=rows[k].slice(start,end+1));
  return {series:o,dates:cal.slice(start,end+1),stale,dropped};
}

/* Equal-weight index for a synthetic basket, built BEFORE normalisation so the
   basket enters the universe as one ordinary body. The old code averaged the
   members' already-normalised coordinates, and a centroid of z-scores is not
   the z-score of a centroid. */
function orrBasketSeries(members){
  const ser=members.map(m=>orrCloses[m]).filter(a=>a&&a.length>=ORR_TREND_W+10);
  if(ser.length<2)return null;
  const n=Math.min.apply(null,ser.map(a=>a.length));
  const idx=new Array(n).fill(0);
  ser.forEach(a=>{
    const s=a.slice(-n),base=s[0];
    if(base>0)for(let i=0;i<n;i++)idx[i]+=s[i]/base;
  });
  return {closes:idx.map(v=>v/ser.length*100),n:ser.length};
}

/* Build the whole plot at once. Returns the FULL RS-Ratio / RS-Momentum series
   per body, which is what both the live view and replay read from. */
function orrRRGSet(map,bench,tf){
  const withB=Object.assign({__b:bench},map);
  const al=orrAlignSet(withB);
  if(!al)return null;
  const b=al.series.__b;
  if(!b)return null;
  delete al.series.__b;
  const keys=Object.keys(al.series);
  if(keys.length<2)return null;

  // 1) trend measure per body: RS against its own quarter mean, unitless
  const raw=keys.map(k=>{
    const c=al.series[k];
    const rs=c.map((v,i)=>b[i]>0?v/b[i]:0);
    const sm=orrSMA(rs,ORR_TREND_W);
    return rs.map((v,i)=>sm[i]>0?v/sm[i]-1:0);
  });
  /* Indices of the reference bodies: the sector ETFs, which every device has.
     If too few are present (a drill-down into one sector's members, say) the
     whole set is used instead, which is correct there because that scope has no
     stable outside reference to borrow. */
  const refIdx=[];
  keys.forEach((k,i)=>{
    const sec=ORR_SECTORS.filter(s=>s.cat==='sector').some(s=>s.sym===k||s.etf===k);
    if(sec)refIdx.push(i);
  });

  // 2) cross-sectional z at each date -> RS-Ratio
  const ratio=orrXZ(raw,refIdx).map(r=>r.map(z=>100+z*ORR_Z));
  // 3) RS-Momentum is the rate of change of RS-Ratio over tf, normalised alike
  const rawM=ratio.map(r=>r.map((v,i)=>i>=tf?v-r[i-tf]:0));
  const mom=orrXZ(rawM,refIdx).map(r=>r.map(z=>100+z*ORR_Z));

  const bodies={};
  keys.forEach((k,i)=>{bodies[k]={ratio:ratio[i],mom:mom[i],closes:al.series[k],stale:al.stale[k]||0};});
  return {bodies,dates:al.dates,len:ratio[0].length,
    dropped:al.dropped||[],refCount:refIdx.length};
}

/* Read one body at a playhead position. p === null means live (last bar). */
function orrAt(s,p,tailLen){
  const L=s.ratio.length;
  const i=Math.max(0,Math.min(L-1,p==null?L-1:p));
  const tail=[];
  for(let j=Math.max(0,i-tailLen+1);j<=i;j++)tail.push({x:s.ratio[j],y:s.mom[j]});
  const c=s.closes,back=Math.max(0,i-5);
  const ret=c[back]>0?(c[i]/c[back]-1):0;
  return {x:s.ratio[i],y:s.mom[i],tail,ret};
}

/* ---- rotation quality ----------------------------------------------------
   Bodies are SUPPOSED to rotate clockwise. Measuring whether one actually is
   separates "XLE is rotating into Leading" from "XLE is jittering across the
   boundary", which is the most common way an RRG gets misread and something a
   trail alone cannot tell you.

   Signed angular sweep around (100,100). In data space Leading sits at a
   positive angle and Weakening at a negative one, so a clockwise rotation is a
   DECREASING angle: negative sweep. Quality is arc length over path length, so
   a clean arc approaches 1 and a scribble approaches 0. */
function orrRotQuality(tail){
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
  const q=path>0?Math.abs(sweep)*r/path:0;
  return {sweep,r,dir:sweep<-0.10?'cw':sweep>0.10?'ccw':'flat',quality:Math.max(0,Math.min(1,q))};
}

/* Quadrant crossings inside the visible window. Crossings are the tradeable
   event: a move from the left half to the right half is a new uptrend in
   relative performance. Previously one was only visible if you happened to be
   watching at the moment it happened. */
function orrCrossings(set,upto,lookback){
  if(!set||!set.bodies)return[];
  const out=[];
  Object.keys(set.bodies).forEach(k=>{
    const s=set.bodies[k];
    const end=Math.min(s.ratio.length-1,upto==null?s.ratio.length-1:upto);
    const from=Math.max(1,end-lookback);
    let prev=orrPhase(s.ratio[from-1],s.mom[from-1]);
    for(let i=from;i<=end;i++){
      const ph=orrPhase(s.ratio[i],s.mom[i]);
      if(ph!==prev){out.push({sym:k,from:prev,to:ph,i:i});prev=ph;}
    }
  });
  return out.sort((a,b)=>b.i-a.i);
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

let orrSeeded=false;
async function orrSeedFromServer(){
  if(orrSeeded)return;orrSeeded=true;
  if(!(window.KairosBackend&&window.KairosBackend.enabled&&window.KairosBackend.mythos))return;
  try{const d=await window.KairosBackend.mythos();if(d&&d.c&&window.orrSeed)window.orrSeed(d.c,d.e,d.d);}catch(e){}
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
  /* The server seed carries closes but a Worker that has not yet run the dated
     mythosRefresh sends no calendar. One direct benchmark pull fixes the replay
     labels for the whole session, and it only ever happens once. */
  if(!orrCal||!orrCal.length){
    try{delete orrFetchT[ORR_BENCH];await orrDaily(ORR_BENCH);}catch(e){}
  }

  /* Build the price series for every body FIRST, baskets included, then run ONE
     cross-sectional pass over the lot. Doing it in this order is what makes a
     basket comparable to an ETF instead of an average of incomparable numbers. */
  const meta={},src={};
  if(orrScope){
    orrScope.members.forEach(sym=>{
      if(orrCloses[sym]){src[sym]=orrCloses[sym];meta[sym]={sym:sym,name:sym};}
    });
  }else{
    orrVisibleSectors().forEach(sec=>{
      if(sec.synth){
        const bk=orrBasketSeries(sec.members);
        if(bk){
          src[sec.sym]=bk.closes;
          /* A basket has no ticker of its own, so it inherits the calendar
             position of its most recently refreshed member. */
          let best=null;
          sec.members.forEach(m=>{if(orrEnd[m]&&(!best||orrEnd[m]>best))best=orrEnd[m];});
          if(best)orrEnd[sec.sym]=best;
          meta[sec.sym]={sym:sec.sym,name:sec.name,synth:true,n:bk.n};
        }
      }else{
        const key=sec.etf||sec.sym,c=orrCloses[key];
        if(c){
          src[sec.sym]=c;
          if(orrEnd[key])orrEnd[sec.sym]=orrEnd[key];
          meta[sec.sym]={sym:sec.sym,etf:sec.etf,name:sec.name};
        }
      }
    });
  }
  orrSet=orrRRGSet(src,bench,orrTf);
  orrMetaMap=meta;
  orrHead=null;orrPlaying=false;orrAcc=0;
  orrApplyHead();
  orrRenderReplay();
  orrLoading=false;
  orrRenderRail();
}

/* Derive the plotted bodies from the playhead. Called on every replay frame, so
   it stays light: no recomputation, just a slice out of the stored series. */
function orrApplyHead(){
  if(!orrSet||!orrSet.bodies){orrPts=[];return;}
  const out=[];
  Object.keys(orrSet.bodies).forEach(k=>{
    const m=orrMetaMap[k];if(!m)return;
    const a=orrAt(orrSet.bodies[k],orrHead,ORR_TAIL);
    out.push(Object.assign({},m,{
      x:a.x,y:a.y,tail:a.tail,phase:orrPhase(a.x,a.y),ret:a.ret,
      rot:orrRotQuality(a.tail),
      stale:orrSet.bodies[k].stale||0,
    }));
  });
  orrPts=out;
}
function orrHeadIdx(){return orrHead==null?(orrSet?orrSet.len-1:0):orrHead;}
/* Format as MON DD, which is what you actually track a rotation by. "T-45" is
   only meaningful if you are counting sessions in your head, which nobody is. */
const ORR_MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function orrFmtDate(iso){
  if(!iso)return '';
  const p=String(iso).split('-');
  if(p.length<3)return iso;
  return ORR_MON[(+p[1]-1)|0]+' '+(+p[2]);
}
/* If the shared calendar has not arrived yet (first load before the Worker has
   stored one), synthesise it by counting weekdays back from the last session.
   Marked approximate with a leading tilde, because holidays are not in it and
   claiming otherwise would be a quiet lie. */
function orrApproxDate(barsBack){
  const d=new Date();
  let n=0;
  while(n<barsBack){
    d.setDate(d.getDate()-1);
    const w=d.getDay();
    if(w!==0&&w!==6)n++;
  }
  const p=x=>String(x).padStart(2,'0');
  return '~'+ORR_MON[d.getMonth()]+' '+(+p(d.getDate()));
}
function orrHeadDate(){
  if(!orrSet)return '';
  if(orrHead==null)return 'LIVE';
  const i=orrHeadIdx();
  if(orrSet.dates&&orrSet.dates[i])return orrFmtDate(orrSet.dates[i]);
  return orrApproxDate((orrSet.len-1)-i);
}

/* ---- replay controls ---- */
function orrPlayToggle(){
  if(!orrSet)return;
  /* Pressing play while parked at the live edge rewinds first, otherwise play
     would appear to do nothing at all. */
  if(!orrPlaying&&(orrHead==null||orrHead>=orrSet.len-1)){
    orrHead=Math.max(0,orrSet.len-1-Math.min(90,orrSet.len-1));
  }
  orrPlaying=!orrPlaying;
  orrAcc=0;
  if(orrPlaying&&!orrRaf)orrRaf=requestAnimationFrame(orrFrame);
  orrApplyHead();orrRenderRail();orrRenderReplay();
  if(orrReduce&&!orrPlaying)orrDraw(0);
}
function orrSeek(i){
  if(!orrSet)return;
  let h=Math.max(0,Math.min(orrSet.len-1,i|0));
  orrHead=(h>=orrSet.len-1)?null:h;      // snap to live at the right edge
  orrApplyHead();orrRenderRail();orrRenderReplay();
  if(orrReduce)orrDraw(0);
}
function orrGoLive(){
  orrPlaying=false;orrHead=null;orrAcc=0;
  orrApplyHead();orrRenderRail();orrRenderReplay();
  if(orrReduce)orrDraw(0);
}
function orrSetSpeed(s){
  orrSpeed=s;
  try{localStorage.setItem('kairos_orr_speed',String(s));}catch(e){}
  orrRenderReplay();
}
/* Advance the playhead using real elapsed seconds, so playback rate is
   wall-clock consistent regardless of frame rate. */
function orrAdvance(dt){
  if(!orrPlaying||!orrSet)return;
  orrAcc+=dt*ORR_BPS*orrSpeed;
  if(orrAcc<1)return;
  const step=Math.floor(orrAcc);
  orrAcc-=step;
  const h=orrHeadIdx()+step;
  if(h>=orrSet.len-1){
    orrPlaying=false;orrHead=null;      // stop at the live edge, never loop
    orrApplyHead();orrRenderRail();orrRenderReplay();
    return;
  }
  orrHead=h;
  orrApplyHead();
  orrRenderReplay();
  orrRenderRail();
}
function orrRenderReplay(){
  const bar=document.getElementById('orrReplay');if(!bar)return;
  if(!orrSet){bar.style.visibility='hidden';return;}
  bar.style.visibility='';
  const i=orrHeadIdx(),L=Math.max(1,orrSet.len-1);
  const btn=document.getElementById('orrPlay');
  if(btn)btn.textContent=orrPlaying?'\u275a\u275a':'\u25b6';
  const sc=document.getElementById('orrScrub');
  if(sc){sc.max=String(L);if(+sc.value!==i)sc.value=String(i);}
  const lab=document.getElementById('orrWhen');
  if(lab){
    lab.textContent=orrHead==null?'LIVE':orrHeadDate();
    lab.className='orr-when'+(orrHead==null?' live':'');
  }
  const cr=document.getElementById('orrCross');
  if(cr){
    const xs=orrCrossings(orrSet,i,10).slice(0,3);
    cr.innerHTML=xs.length?xs.map(x=>{
      const m=orrMetaMap[x.sym];
      return '<span class="orr-cx"><b>'+(m?m.sym:x.sym)+'</b> '+x.from.slice(0,4)+'\u2192'+
        '<i style="color:rgb('+ORR_PHASECOL[x.to]+')">'+x.to+'</i></span>';
    }).join(''):'<span class="orr-cx dim">no quadrant changes in 10 sessions</span>';
  }
}

/* ---- canvas render ---- */
function orrCv(){return document.getElementById('orrCanvas');}
function orrStop(){if(orrRaf){cancelAnimationFrame(orrRaf);orrRaf=0;}}
function orrStart(){
  orrStop();
  const wait=document.getElementById('orrWait');
  if(!orrPts.length){if(wait)wait.style.display='';}
  /* Reduced motion normally skips the rAF loop entirely. Replay still needs it
     while playing, so honour the preference by easing instantly rather than by
     refusing to animate at all. */
  if(orrReduce&&!orrPlaying){orrDraw(0);return;}
  orrT=0;orrRaf=requestAnimationFrame(orrFrame);
}
function orrFrame(ts){const dt=orrT?Math.min(0.05,(ts-orrT)/1000):0.016;orrT=ts;orrAdvance(dt);orrDraw(dt);orrRaf=requestAnimationFrame(orrFrame);}

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

  /* Scrubbed into the past: a wash and a stamp, so a screenshot can never be
     mistaken for the live field. */
  if(orrHead!=null){
    ctx.save();
    ctx.fillStyle='rgba(242,193,78,.055)';
    ctx.fillRect(0,0,W,H);
    ctx.font='700 '+Math.round(11*SC)+'px "JetBrains Mono",monospace';
    ctx.fillStyle='rgba(242,193,78,.9)';
    ctx.textAlign='left';
    ctx.fillText('\u25c0 REPLAY \u00b7 '+orrHeadDate(),PAD+4,PAD+13*SC);
    ctx.restore();
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
      /* Is this body actually rotating, or just jittering across a boundary?
         Clockwise with a clean arc is a real rotation; flat with a long path is
         noise wearing a trail. */
      (p.rot?('<span class="orr-rrot" title="rotation: '+(p.rot.dir==='cw'?'clockwise':p.rot.dir==='ccw'?'counter-clockwise':'flat')+
        ', arc quality '+Math.round(p.rot.quality*100)+'%">'+
        (p.rot.dir==='cw'?'\u21bb':p.rot.dir==='ccw'?'\u21ba':'\u00b7')+
        '<i style="opacity:'+(0.35+p.rot.quality*0.65).toFixed(2)+'">'+Math.round(p.rot.quality*100)+'</i></span>'):'')+
      (p.stale>0?'<span class="orr-stale" title="last bar is '+p.stale+' session(s) behind the calendar">\u00b7'+p.stale+'d</span>':'')+
      '<span class="orr-rret" style="color:'+(p.ret>=0?'var(--green)':'var(--red)')+'">'+(p.ret>=0?'+':'')+(p.ret*100).toFixed(1)+'%</span>'+
      '</div>';
  }).join('');
  rail.querySelectorAll('.orr-row').forEach(r=>{
    r.onmouseenter=()=>{orrHover=r.dataset.sym;};
    r.onmouseleave=()=>{orrHover=null;};
    r.onclick=()=>orrPick(r.dataset.sym);
  });
  const meta=document.getElementById('orrMeta');
  if(meta){
    /* A body without the full window is held out rather than allowed to reshape
       the field, so name the count instead of just showing fewer bodies. */
    const held=(orrSet&&orrSet.dropped)?orrSet.dropped.length:0;
    meta.textContent=orrPts.length+' bodies'
      +(held?' \u00b7 '+held+' warming':'')
      +' \u00b7 '+(orrScope?orrScope.name:(orrCat==='all'?'sectors + themes':orrCat))
      +' \u00b7 RS vs '+ORR_BENCH;
    meta.title=held?(held+' body/bodies do not yet have the full 150-session window and are held out. Including a partial series would move every other body, because the plot is scored cross-sectionally against the sector field.'):'';
  }
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
  let weakPrints=[],flThresh=null;
  try{
    /* allExp: read the whole book rather than inheriting the global
       0DTE/7d/30d chip, which on a sector member often leaves nothing at all. */
    const fl=flowLean(sym,{allExp:true});
    if(fl){prints=fl.prints.slice(0,8);weakPrints=fl.weak||[];flThresh=fl.thresh;}
  }catch(e){}
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
    }).join('')+'</table>'):(weakPrints.length?
      ('<div class="od-noflow">No prints cleared the opening bar (vol ≥'+Math.round((flThresh?flThresh.open:0.25)*100)+'% of OI). Largest premium on the tape below, tagged as churn rather than new positioning:</div>'+
       '<table class="od-prints"><tr><th>Contract</th><th>Vol/OI</th><th>Prem</th><th>Read</th></tr>'+
       weakPrints.map(p=>'<tr style="opacity:.62"><td><span class="cbadge '+(p.call?'c':'p')+'">'+(p.call?'C':'P')+'</span> '+p.k+' '+p.e.slice(5)+'</td><td>'+p.voi.toFixed(2)+'\u00d7</td><td style="color:var(--gold)">'+fmt(p.prem)+'</td><td><span class="od-tag flow">churn</span></td></tr>').join('')+'</table>')
      :'<div class="od-noflow">No option volume on '+sym+' this session.</div>');
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
    if(window.applyViewExpiry)window.applyViewExpiry('chart');
    if(window.clearNav)window.clearNav();
    const cb=document.getElementById('btnChart');if(cb)cb.classList.add('active');
    ['trinityWrap','ideasSec','imbSec','tapeSec','nexusSec'].forEach(id=>{const e=document.getElementById(id);if(e)e.classList.add('hidden');});
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
  /* ---- replay wiring ---- */
  const rp=document.getElementById('orrReplay');
  if(rp&&!rp._wired){
    rp._wired=true;
    const pb=document.getElementById('orrPlay');if(pb)pb.onclick=orrPlayToggle;
    const lv=document.getElementById('orrLive');if(lv)lv.onclick=orrGoLive;
    const sc=document.getElementById('orrScrub');
    if(sc)sc.oninput=function(e){orrPlaying=false;orrSeek(+e.target.value);};
    const sp=document.getElementById('orrSpeedSel');
    try{orrSpeed=parseFloat(localStorage.getItem('kairos_orr_speed'))||1;}catch(e){}
    if(sp)sp.querySelectorAll('button').forEach(b=>{
      b.classList.toggle('on',parseFloat(b.dataset.sp)===orrSpeed);
      b.onclick=function(){
        orrSetSpeed(parseFloat(b.dataset.sp));
        sp.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
      };
    });
    /* Space plays, arrows step one session, Escape returns to live. Only while
       Mythos is the visible view, so it never steals keys from the ticker box. */
    document.addEventListener('keydown',function(e){
      if(state.view!=='chart')return;
      if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target&&e.target.tagName||''))return;
      if(e.code==='Space'){e.preventDefault();orrPlayToggle();}
      else if(e.key==='ArrowRight'){orrPlaying=false;orrSeek(orrHeadIdx()+1);}
      else if(e.key==='ArrowLeft'){orrPlaying=false;orrSeek(orrHeadIdx()-1);}
      else if(e.key==='Escape'&&orrHead!=null)orrGoLive();
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
window.KairosMythos={ORR_SECTORS,orrCompute,orrSetTrail,orrClassify,orrRRGSet,orrAt,orrRotQuality,orrCrossings,
  orrPlayToggle,orrSeek,orrGoLive,orrSetSpeed,
  pts:function(){return orrPts;},closes:function(){return orrCloses;},
  set:function(){return orrSet;},head:function(){return orrHead;},cal:function(){return orrCal;}};
window.KairosOrrery=window.KairosMythos; // back-compat alias
console.log('%cKairos Mythos \u2014 the market\u0027s rotating bodies. Sectors + themes, RS vs SPY, four phases, clockwise.','color:#34d399;font-weight:bold');
