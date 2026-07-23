
/* =====================================================================
   Kairos v7.3 — dealer exposure terminal (GEX + VEX + Flow). Single file.

   v7.3 — accuracy pass (Imbalance walls + Ideas bias):
   • Imbalance floor/ceiling are now the gamma-weighted Call Wall / Put Wall
     (OI × Γ), the industry-standard method. Gamma is highest ATM/near-expiry
     and decays with distance, so a far-OTM tail hedge (e.g. a 720 put) can no
     longer masquerade as the floor — raw-OI weighting was the bug.
   • Ideas engine is now intraday-aware. It previously had NO same-day price
     input, so a positive-gamma bull structure + up daily-MA produced longs on
     every red day. Now: today's move feeds the score; a −GEX (momentum) name
     follows the live tape (short on red, long on green) instead of the lagging
     daily MA; and a +GEX long into a hard red day below the gamma flip — the
     negative-gamma flush — is rejected outright.

   v7.2 — bug fixes (no calculation changes to GEX/VEX):
   • Triad ticker slots are now written by fixed slot index, not indexOf(old).
     indexOf found the FIRST duplicate, so once two slots shared a ticker the
     second was permanently stranded ("can't make them different"). Editing a
     slot to a ticker already shown swaps the two instead of duplicating.
   • One-time repair resets a corrupted saved Triad (e.g. TSLA,SPY,QQQ) back to
     SPXW,SPY,QQQ; saved lists are de-duped on load.
   • Imbalance WK Floor/Ceiling are found WITHIN the visible band, so a far-OTM
     put wall (e.g. 540, ~28% below spot) can no longer hijack the readout.
   • Center toggle defaults to King (original Triad behavior); Spot on demand.
   • History is now a rolling multi-day store (last 3 trading days, prior days
     downsampled, quota-safe writes) instead of a single blob wiped each night.
     Δ chips remain intraday because OI resets every session.

   v7.1 — smoothness + focus pass (no calculation changes to GEX/VEX):
   • CEX removed end-to-end: toggle, per-strike math, profile grid,
     history snapshots, modal, help. ~33% less Black-Scholes work/rebuild.
   • ⚡ flow tags dropped from map rows — Δ% chips (vs ~12 min ago) stay.
     Flow Tape view and flow-into-Ideas scoring are unchanged.
   • Spot visibility: exactly one spot row (nearest strike), cyan glow
     frame, cyan strike text, live price pill in Triad + Single grid,
     Spot line added to the Chart key-levels rail.
   • Triad-wipe bug fixed: changing the ticker in Single view no longer
     rewrites the saved Triad; loader self-heals any collapsed saved list.
   • Pending-refresh queue: refreshes requested mid-flight run right after
     instead of being dropped — tab hops always load.
   • Panels never rebuild while a ticker box has focus / combobox is open.
   • Scroll restore is synchronous (no 40ms flash-to-top). Tape repaints
     only when its chain actually changes (~90s), scroll preserved.
   • Mobile: Triad stays 3-across (skinny by design); the nav row is now
     one clean horizontal scroll instead of wrapping into a jumble.
   • Background Ideas sweep: 5 min unless the Ideas view is open (110s),
     and it never runs while a visible-panel refresh is in flight.
   ===================================================================== */
const TICKS=['SPXW','SPY','QQQ','IWM','NVDA','AAPL','MSFT','META','TSLA','AMZN','GOOGL'];
const CHAIN_TTL=90000;
const HIST_SAVE_MS=60000;
const HIST_MAX_DAYS=3;        // trading days of node history kept in localStorage
const HIST_PRIOR_CAP=90;      // snapshots kept per symbol for NON-today days (downsampled)
const HIST_TODAY_CAP=260;     // full-resolution snapshots for the current session
const REG_SERIES_CAP=400;     // intraday net-premium/spot samples for the Regime chart (in-memory)
const DELTA_WINDOW=720;
const DELTA_MATERIAL=0.08;
const DELTA_MIN=8;
const FLOW_OPEN=0.7;        // vol/oi ratio to call a node "opening" (being rebuilt today)
const FLOW_MIN_PREM=25000;  // $ premium floor for a tape print to matter

function cleanSym(s){s=String(s||'').trim().toUpperCase();return /^[A-Z0-9.\-\/]{1,12}$/.test(s)?s:'';}
function underOf(sym){return (sym==='SPXW'||sym==='SPX')?'SPX':sym;}

const state={
  data:{}, chains:{}, spot:{}, multi:{}, focus:'SPY', view:'trinity',
  metric:(localStorage.getItem('kairos_metric')||'gex'),
  centerOn:(localStorage.getItem('kairos_center')||'king'),
  dealerMode:'standard', customShort:0.7, expiry:'all',
  pollSec:Math.max(10,parseInt(localStorage.getItem('kairos_poll'))||10),
  calcMode:'live', unit:'pt',
  sizeBasis:localStorage.getItem('kairos_basis')||'oi',
  tradierToken:(localStorage.getItem('kairos_tok')||'').trim(),
  tradierEnv:localStorage.getItem('kairos_env')||'production',
  trinityTickers:(localStorage.getItem('kairos_ticks')||'SPXW,SPY,QQQ').split(',').map(cleanSym).filter(Boolean),
  expCache:{}, history:{}, prevG:{}, dataAge:{}, ideas:{}, tech:{},
  scrolled:{}, refreshing:false, pendingRefresh:false, pendingForce:false,
  lastHistSave:0, firstLoadFailed:false, singleLoading:false
};
if(!state.trinityTickers.length)state.trinityTickers=['SPXW','SPY','QQQ'];
// de-dupe: a duplicate here is what let the old indexOf bug strand two slots
state.trinityTickers=[...new Set(state.trinityTickers)];
// self-heal: an older bug could collapse the saved Triad to one ticker — pad back to 3
if(state.trinityTickers.length<3){
  ['SPXW','SPY','QQQ'].forEach(t=>{if(state.trinityTickers.length<3&&!state.trinityTickers.includes(t))state.trinityTickers.push(t);});
  localStorage.setItem('kairos_ticks',state.trinityTickers.join(','));
}
state.trinityTickers=state.trinityTickers.slice(0,3);
// one-time repair: earlier builds could persist a corrupted Triad (e.g. TSLA,SPY,QQQ).
// reset to the canonical default ONCE, then respect the user's choices going forward.
if(!localStorage.getItem('kairos_ticks_ok')){
  state.trinityTickers=['SPXW','SPY','QQQ'];
  localStorage.setItem('kairos_ticks','SPXW,SPY,QQQ');
  localStorage.setItem('kairos_ticks_ok','1');
}
if(!['gex','vex'].includes(state.metric))state.metric='gex';
if(!['spot','king'].includes(state.centerOn))state.centerOn='king';
state.histAll={};
state.regSeries={};
state.tapeSort={col:'prem',dir:-1};
state.ideaOpen=null;
try{
  const raw=JSON.parse(localStorage.getItem('kairos_hist')||'null');
  const today=new Date().toDateString();
  if(raw&&raw.v===7&&raw.days){
    state.histAll=raw.days;
    state.history=state.histAll[today]||{};
  }else if(raw&&raw.v===6&&raw.d===today){       // migrate the old single-day format
    state.history=raw.h||{};
    state.histAll={[today]:state.history};
  }
}catch(e){}

/* ---- metric plumbing ---- */
function metricKey(m){return m==='vex'?'v':'g';}
function metricLabel(m){return m==='vex'?'Vanna':'Gamma';}
function mval(s,metric){metric=metric||state.metric;return metric==='vex'?(s.vex||0):(s.gex||0);}
function fmtG(v,spot){return fmt(state.unit==='pt'&&spot?v/(spot*0.01):v);}
function mdisp(v,spot){return state.metric==='gex'?fmtG(v,spot):fmt(v);}
function fmt(v){
  const a=Math.abs(v);
  if(a<1e3)return Math.round(v)+'';
  const k=v/1e3;
  const decimals=Math.abs(k)<100?1:0;
  return k.toLocaleString('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:decimals})+'K';
}
function dealerAdj(u,a){return state.dealerMode==='shortall'?-a:state.dealerMode==='custom'?a*(1-2*state.customShort):u;}

function kingOf(s,metric){let m=0,k=null;(s||[]).forEach(x=>{const v=Math.abs(mval(x,metric));if(v>m){m=v;k=x}});return k;}
function callWall(s,metric){let m=0,w=null;(s||[]).forEach(x=>{const v=mval(x,metric);if(v>m){m=v;w=x}});return w;}
function putWall(s,metric){let m=0,w=null;(s||[]).forEach(x=>{const v=mval(x,metric);if(v<m){m=v;w=x}});return w;}
/* Band-aware walls: Call Wall = largest POSITIVE node ABOVE spot within band;
   Put Wall = most-negative node BELOW spot within band. This is the industry
   convention and stops a far-OTM tail node (e.g. a 360 put hedge ~10% under a
   $397 spot) from masquerading as the actionable floor. Band defaults to ~6%
   which comfortably covers the near-money structure that actually pins price. */
function callWallBand(s,spot,metric,pct){
  const b=spot*(pct||0.06);let m=0,w=null;
  (s||[]).forEach(x=>{if(x.k<spot||x.k>spot+b)return;const v=mval(x,metric);if(v>m){m=v;w=x;}});
  if(!w){ // fallback: nearest positive node above spot at any distance
    let bd=1e18;(s||[]).forEach(x=>{if(x.k<spot)return;const v=mval(x,metric);if(v>0&&x.k-spot<bd){bd=x.k-spot;w=x;}});
  }
  return w;
}
function putWallBand(s,spot,metric,pct){
  const b=spot*(pct||0.06);let m=0,w=null;
  (s||[]).forEach(x=>{if(x.k>spot||x.k<spot-b)return;const v=mval(x,metric);if(v<m){m=v;w=x;}});
  if(!w){ // fallback: nearest negative node below spot at any distance
    let bd=1e18;(s||[]).forEach(x=>{if(x.k>spot)return;const v=mval(x,metric);if(v<0&&spot-x.k<bd){bd=spot-x.k;w=x;}});
  }
  return w;
}
function flipOf(s,spot,metric){const a=[...(s||[])].sort((x,y)=>x.k-y.k);let f=null,b=1e18;for(let i=0;i<a.length-1;i++){const g0=mval(a[i],metric),g1=mval(a[i+1],metric);if(g0*g1<=0){const m=(a[i].k+a[i+1].k)/2;const d=spot?Math.abs(m-spot):i;if(d<b){b=d;f={k:m};}}}return f;}

function localDate(){const d=new Date();const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());}
const _nyOff={};
function nyOffset(dstr){
  if(_nyOff[dstr])return _nyOff[dstr];
  let off='-05:00';
  try{
    const probe=new Date(dstr+'T12:00:00Z');
    const s=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',timeZoneName:'shortOffset'}).format(probe);
    const m=s.match(/GMT([+-]\d+)/);
    if(m){const h=parseInt(m[1],10);off=(h<0?'-':'+')+String(Math.abs(h)).padStart(2,'0')+':00';}
  }catch(e){}
  return _nyOff[dstr]=off;
}
function dteOf(dstr){return Math.max(0,(new Date(dstr+'T16:00:00'+nyOffset(dstr))-Date.now())/86400000);}
function prevBiz(d){const x=new Date(d);do{x.setDate(x.getDate()-1);}while(x.getDay()===0||x.getDay()===6);return x;}
function sessionInfo(){
  const now=new Date();
  const fmtNY=dt=>dt.toLocaleDateString('en-US',{timeZone:'America/New_York',weekday:'short',month:'short',day:'numeric'});
  const nyStr=now.toLocaleDateString('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
  const parts=nyStr.split('/');
  const nyDate=new Date(+parts[2],+parts[0]-1,+parts[1]);
  const dow=nyDate.getDay();
  const sess=(dow===0||dow===6)?prevBiz(new Date(nyDate.getTime()+86400000)):nyDate;
  return {sess:fmtNY(sess),oi:fmtNY(prevBiz(sess))};
}
/* Black-Scholes second-order Greeks (r=q=0). Raw gamma/vanna are identical
   for calls and puts at a strike — dealer SIGN comes from position only. */
function bsGamma(S,K,iv,T){if(T<=0||iv<=0||S<=0||K<=0)return 0;const st=iv*Math.sqrt(T);const d1=(Math.log(S/K)+0.5*iv*iv*T)/st;return Math.exp(-0.5*d1*d1)/(S*st*Math.sqrt(2*Math.PI));}
function bsVanna(S,K,iv,T){if(T<=0||iv<=0||S<=0||K<=0)return 0;const st=iv*Math.sqrt(T);const d1=(Math.log(S/K)+0.5*iv*iv*T)/st;const d2=d1-st;return -Math.exp(-0.5*d1*d1)/Math.sqrt(2*Math.PI)*d2/iv;}

function ensureProfile(sym,d){
  if(!d)return null;
  if(d.profile)return d.profile;
  if(!d.contracts||!d.contracts.length)return null;
  const key=(+d.spot).toPrecision(4)+'|'+state.expiry+'|'+state.dealerMode+'|'+(d.chStamp||0);
  const pc=state._profCache=state._profCache||{};
  if(pc[sym]&&pc[sym].key===key){d.profile=pc[sym].p;return d.profile;}
  const p=exposureProfile(d.contracts,d.spot);
  pc[sym]={key,p};d.profile=p;
  return p;
}
function panelStats(sym,d,metric){
  metric=metric||state.metric;
  const near=(d.strikes||[]).filter(s=>Math.abs(s.k-d.spot)<=d.spot*0.01);
  const net1=near.reduce((a,s)=>a+mval(s,metric),0);
  let em=null;
  if(d.contracts&&d.contracts.length){
    let best=null;
    for(const c of d.contracts){
      const dd=Math.abs(c.k-d.spot);
      if(!best||c.T<best.T-1e-9||(Math.abs(c.T-best.T)<1e-9&&dd<best.dd))best={T:c.T,dd,iv:c.iv};
    }
    if(best)em=d.spot*best.iv*Math.sqrt(best.T);
  }
  const prof=ensureProfile(sym,d);
  const fl=prof?(metric==='vex'?prof.flipV:prof.flipG):null;
  let vel=null;
  const hist=state.history[sym]||[];
  if(hist.length>1){
    const now=hist[hist.length-1],cut=now.t-900,mk=metricKey(metric);
    let old=null;for(const h of hist){if(h.t<=cut)old=h;}
    const an=now[mk]||[],ao=old?(old[mk]||[]):[];
    if(ao.length&&an.length){const a=Math.abs(ao[0].val),b=Math.abs(an[0].val);if(a>0)vel=(b-a)/a*100;}
  }
  return{net1,em,fl,vel};
}
function histValue(sym,k,secsAgo,metric){
  metric=metric||state.metric;const mk=metricKey(metric);
  const h=state.history[sym];if(!h||h.length<2)return null;
  const now=h[h.length-1].t,cut=now-secsAgo;
  let chosen=null;
  for(const snap of h){if(snap.t<=cut)chosen=snap;}
  if(!chosen)chosen=h[0];
  const arr=chosen[mk]||[];
  const hit=arr.find(x=>x.k===k);
  return hit?hit.val:null;
}
function deltaOf(sym,k,cur,maxAbs,metric){
  metric=metric||state.metric;
  if(maxAbs&&Math.abs(cur)<DELTA_MATERIAL*maxAbs)return null;
  let base=histValue(sym,k,DELTA_WINDOW,metric);
  if(base===null&&metric==='gex'){const pg=state.prevG&&state.prevG[sym];base=pg?pg[k]:undefined;}
  if(base===undefined||base===null||Math.abs(base)<Math.max(1e3,0.05*(maxAbs||0)))return null;
  return (cur-base)/Math.abs(base)*100;
}
function deltaChip(dl){
  if(dl===null||!isFinite(dl)||Math.abs(dl)<DELTA_MIN)return '';
  const c=dl>=0?'var(--teal)':'#e879f9';
  return `<span class="dchip" style="color:${c};font-weight:700" data-tip="Change vs ~12 min ago — growing nodes are being built, shrinking nodes are unwinding">${dl>=0?'\u25b2':'\u25bc'}${Math.abs(dl)>=100?Math.round(Math.abs(dl)):Math.abs(dl).toFixed(1)}%</span>`;
}
/* ---- opening-flow lean: real vol/OI/premium, opening inferred from vol>=70% OI ---- */
function flowLean(sym){
  const ch=state.chains[sym];if(!ch||!ch.list||!ch.list.length)return null;
  const spot=state.spot[sym]||ch.spot||ch.spotHint||0;if(!spot)return null;
  let callPrem=0,putPrem=0;const prints=[];
  for(const c of ch.list.filter(expiryFilt)){
    if(!c.vol)continue;
    const voi=c.vol/Math.max(c.oi,1);
    if(voi<FLOW_OPEN)continue;                 // churn, not new positioning
    const prem=(c.mid||0)*c.vol*100;
    if(c.call)callPrem+=prem;else putPrem+=prem;
    if(prem>=FLOW_MIN_PREM)prints.push({k:c.k,call:c.call,e:c.e,vol:c.vol,oi:c.oi,voi,prem,iv:c.iv});
  }
  prints.sort((a,b)=>b.prem-a.prem);
  return{callPrem,putPrem,net:callPrem-putPrem,prints:prints.slice(0,30),spot};
}
/* ---- daily technicals (Tradier history, cached 10 min) ---- */
async function getTech(sym){
  const c=state.tech[sym];
  if(c&&Date.now()-c.t<600000)return c;
  if(!liveOn())return state.tech[sym]={t:Date.now(),ok:false};
  const tryFetch=async u=>{
    const start=new Date(Date.now()-140*86400000).toISOString().slice(0,10);
    const j=await tFetch('/markets/history?symbol='+encodeURIComponent(u)+'&interval=daily&start='+start);
    const days=j.history&&j.history.day;const arr=Array.isArray(days)?days:(days?[days]:[]);
    return arr.map(x=>({c:+x.close,h:+x.high,l:+x.low})).filter(x=>x.c>0&&x.h>0&&x.l>0);
  };
  let bars=null;
  const u=underOf(sym);
  let proxy=false;
  try{bars=await tryFetch(u);}catch(e){}
  if((!bars||bars.length<40)&&u==='SPX'){try{bars=await tryFetch('SPY');proxy=true;}catch(e){}}
  if(!bars||bars.length<40)return state.tech[sym]={t:Date.now(),ok:false};
  const closes=bars.map(b=>b.c);
  const sma=n=>closes.slice(-n).reduce((a,b)=>a+b,0)/n;
  const w=closes.slice(-60);
  let g=0,l=0;
  for(let i=1;i<=14;i++){const d2=w[i]-w[i-1];if(d2>0)g+=d2;else l-=d2;}
  let ag=g/14,al=l/14;
  for(let i=15;i<w.length;i++){const d2=w[i]-w[i-1];ag=(ag*13+Math.max(d2,0))/14;al=(al*13+Math.max(-d2,0))/14;}
  const rsi=al===0?100:100-100/(1+ag/al);
  const n=closes.length,last=closes[n-1];
  const prevClose=n>=2?closes[n-2]:last;
  const ret1=prevClose?last/prevClose-1:0;                 // today's move (last daily bar is today's, partial intraday)
  const ret5=n>=6&&closes[n-6]?last/closes[n-6]-1:0;       // ~1-week momentum
  /* realized vol + ATR. Both are kept UNITLESS (annualised sigma, ATR as a %
     of price) so the SPY-proxy fallback for SPX stays valid — a SPY ATR in
     points would be nonsense on an SPX ladder. */
  const lr=[];
  for(let i=1;i<closes.length;i++){if(closes[i-1]>0)lr.push(Math.log(closes[i]/closes[i-1]));}
  const hvOf=w=>{
    const a=lr.slice(-w);
    if(a.length<Math.floor(w*0.7))return null;
    const m=a.reduce((x,y)=>x+y,0)/a.length;
    const v=a.reduce((x,y)=>x+(y-m)*(y-m),0)/Math.max(1,a.length-1);
    return Math.sqrt(v*252);
  };
  const tr=[];
  for(let i=1;i<bars.length;i++){
    const pc=bars[i-1].c;
    tr.push(Math.max(bars[i].h-bars[i].l,Math.abs(bars[i].h-pc),Math.abs(bars[i].l-pc)));
  }
  let atr=null;
  if(tr.length>=15){
    atr=tr.slice(0,14).reduce((a,b)=>a+b,0)/14;
    for(let i=14;i<tr.length;i++)atr=(atr*13+tr[i])/14;
  }
  return state.tech[sym]={t:Date.now(),ok:true,close:last,prevClose,ret1,ret5,sma5:sma(5),sma20:sma(20),sma50:sma(50),rsi,
    hv20:hvOf(20),hv60:hvOf(60),atrPct:(atr&&last)?atr/last:null,proxy,bars:closes.length};
}
/* ---- composite idea: GEX structure x technicals x opening flow ---- */
function scoreIdea(sym,d,tech){
  if(!d||!d.strikes||!d.strikes.length)return null;
  const kg=kingOf(d.strikes,'gex');if(!kg)return null;
  const ps=panelStats(sym,d,'gex');
  const spot=d.spot;
  const tot=d.strikes.reduce((a,s)=>a+Math.abs(s.gex),0)||1;
  const conc=Math.abs(kg.gex)/tot;
  let sBias=0;
  if(kg.gex>0)sBias=kg.k>spot?1:kg.k<spot?-1:0;
  let tBias=0;
  if(tech&&tech.ok){
    if(tech.close>tech.sma20&&tech.sma20>tech.sma50)tBias=1;
    else if(tech.close<tech.sma20&&tech.sma20<tech.sma50)tBias=-1;
  }
  // intraday direction from today's move (the last daily bar is today's partial candle)
  const ret1=tech&&tech.ok?(tech.ret1||0):0;
  const intraday=ret1>0.002?1:ret1<-0.002?-1:0;
  const hardRed=ret1<=-0.009, hardGrn=ret1>=0.009;   // ~ +/-0.9% = a real trend day
  const belowFlip=ps.fl!=null&&spot<ps.fl;           // spot under the zero-gamma flip = negative-gamma regime
  let bias=0;
  if(kg.gex>0){
    // POSITIVE gamma -> dealers fade moves; price mean-reverts toward the King (dip-buy / rip-sell).
    if(sBias===0)return null;
    if(tBias!==0&&tBias!==sBias)return null;          // structure & daily trend must agree
    bias=sBias;
    // don't buy a dip that's actively breaking down: a long into a hard red day while spot is
    // UNDER the gamma flip is the negative-gamma flush scenario -- skip it (mirror for shorts).
    if(bias>0&&hardRed&&belowFlip)return null;
    if(bias<0&&hardGrn&&!belowFlip)return null;
  }else{
    // NEGATIVE gamma -> moves amplify; follow the CURRENT tape, not the lagging daily MA.
    const mo=intraday!==0?intraday:tBias;
    if(mo===0)return null;
    bias=mo;
  }
  const target=kg.gex>0?kg.k:null;

  // ===== AETHER v2: transparent factor model (falls back to legacy if quant absent) =====
  const Q=window.KairosQuant;
  let v2=null,deskNoteText=null;
  if(Q&&Q.aetherScore){
    // --- assemble factor inputs from real signals ---
    const flipAlign=ps.fl!=null?((bias>0)===(spot>ps.fl)?1:-1)*(kg.gex>0?1:1):0;
    const emCoverage=(ps.em&&target)?Math.min(1,ps.em/Math.max(1e-9,Math.abs(target-spot))):0;
    // classified flow lean (bought vs sold), signed to thesis
    let flowLean=null;
    if(d.contracts&&d.contracts.length){
      try{const fc=Q.classifyFlow(d.contracts.filter(expiryFilt));
        const tot=fc.callBought+fc.callSold+fc.putBought+fc.putSold;
        if(tot>0){
          // net bullish premium = calls bought + puts sold; bearish = puts bought + calls sold
          const bull=(fc.callBought+fc.putSold),bear=(fc.putBought+fc.callSold);
          const lean=(bull-bear)/tot;
          flowLean=bias>0?lean:-lean;
        }
      }catch(e){}
    }
    const trendAgree=tBias===0?0:(tBias===bias?1:-1);
    const intradayAgree=intraday===0?0:(intraday===bias?1:-1);
    // IV rank
    let ivRank=null;
    try{let atm=null,bd=1e18;(d.contracts||[]).forEach(c=>{const dd=Math.abs(c.k-spot);if(c.iv>0&&dd<bd){bd=dd;atm=c.iv;}});
      if(atm){const r=Q.qivRank(sym,atm);ivRank=r.rank;}}catch(e){}
    // skew tailwind: a long wants call demand (negative skew), a short wants put demand (positive skew)
    let skewTailwind=null;
    try{const sk=Q.skew25(d.contracts,spot,dp0());if(sk){const s=sk.skew/10;skewTailwind=bias>0?-s:s;skewTailwind=Math.max(-1,Math.min(1,skewTailwind));}}catch(e){}
    // vix regime
    let vixBack=null;const vt=state._vixTerm;if(vt&&vt.state)vixBack=(vt.state==='backwardation');
    // rsi extreme overlay
    let rsiExtreme=0;
    if(tech&&tech.ok){if(bias>0&&tech.rsi>72)rsiExtreme=-1;else if(bias<0&&tech.rsi<28)rsiExtreme=-1;}
    v2=Q.aetherScore({bias,gexPos:kg.gex>0,flipAlign,concFrac:conc,emCoverage,
      flowLean,trendAgree,intradayAgree,ivRank,vixBackwardation:vixBack,skewTailwind,rsiExtreme});
  }

  function dp0(){return spot>2000?0:1;}
  let score,driversV2=null;
  if(v2){
    score=v2.score;
    // human-readable drivers straight from the strongest factors
    driversV2=v2.factors.filter(f=>Math.abs(f.contrib)>=0.05).sort((a,b)=>Math.abs(b.contrib)-Math.abs(a.contrib))
      .slice(0,5).map(f=>({txt:f.label,pos:f.contrib>=0,detail:f.detail}));
  }else{
    // ---- legacy scoring fallback (unchanged) ----
    const drivers=[];score=30;
    if(ps.fl!=null){const above=spot>ps.fl;if((bias>0&&above)||(bias<0&&!above)){score+=15;drivers.push((above?'above':'below')+' flip');}else score-=8;}
    if(ps.em&&kg.gex>0){const r=Math.min(1,ps.em/Math.max(1e-9,Math.abs(kg.k-spot)));score+=Math.round(15*r);if(r>=0.9)drivers.push('King inside EM');}
    score+=Math.round(10*Math.min(1,conc*3));if(conc>0.18)drivers.push('dominant King');
    if(tBias===bias&&tBias!==0){score+=12;drivers.push(bias>0?'daily uptrend':'daily downtrend');}else if(tech&&tech.ok)score+=4;
    if(intraday!==0){if(intraday===bias){score+=8;drivers.push(bias>0?'intraday \u2191':'intraday \u2193');}else{score-=12;drivers.push('vs today\u2019s tape');}}
    if(tech&&tech.ok){if(bias>0&&tech.rsi>72)score-=10;else if(bias<0&&tech.rsi<28)score-=10;else score+=5;}
    if(ps.vel!=null&&ps.vel>2){score+=5;drivers.push('King building');}
    driversV2=drivers.map(t=>({txt:t,pos:!/vs today|diverges/.test(t)}));
  }
  score=Math.max(0,Math.min(99,Math.round(score)));
  if(score<55)return null;
  const dp=spot>2000?0:1;
  const invalid=ps.fl!=null?(+ps.fl).toFixed(dp):null;
  const contractK=(function(){let best=kg.k,bd=1e18;(d.strikes||[]).forEach(s=>{const dd=Math.abs(s.k-spot);if(dd<bd){bd=dd;best=s.k;}});return best;})();
  const rr=(function(){if(!target||!invalid)return null;const rew=Math.abs((+target)-spot),rsk=Math.abs(spot-(+invalid));return rsk>0?+(rew/rsk).toFixed(2):null;})();
  // flow note for the thumbnail badge
  let flowNote=null;
  if(v2){const ff=v2.factors.find(f=>f.key==='flow');if(ff&&Math.abs(ff.val)>0.1)flowNote=ff.val>0?'confirms':'diverges';}
  const idea={
    sym,score,t:Date.now(),
    bias:bias>0?'LONG':'SHORT',
    momentum:kg.gex<0,flow:flowNote,
    target:target?(+target).toFixed(dp):null,
    invalid,
    entry:+spot.toFixed(dp),
    optType:bias>0?'C':'P',
    contractK,rr,
    factors:driversV2,
    v2:!!v2,
    line:kg.gex>0
      ?`${sym} ~ATM ${bias>0?'call':'put'} \u00b7 target King ${(+kg.k).toFixed(dp)}`
      :`${sym} ${bias>0?'call':'put'} \u2014 momentum regime (\u2212GEX), ${bias>0?'up':'down'} tape`,
    drivers:driversV2.map(f=>f.txt).slice(0,5),
    meta:`King ${kg.k} \u00b7 ${Math.round(conc*100)}% of book${ps.em?` \u00b7 EM \u00b1${ps.em.toFixed(dp)}`:''}${tech&&tech.ok?` \u00b7 RSI ${Math.round(tech.rsi)}`:''}`
  };
  // desk-note + journal (v2 only)
  if(v2&&Q.deskNote){
    const planTxt=target?`Plan: target the King ${(+target).toFixed(dp)}${invalid?`, invalid ${bias>0?'below':'above'} ${invalid}`:''}${rr?` (${rr}:1)`:''}.`:'';
    idea.desk=Q.deskNote(sym,bias,v2,{plan:planTxt});
    try{Q.qjLog(idea);}catch(e){}
    if(backendOn()&&window.KairosBackend.logIdea)window.KairosBackend.logIdea(idea);
  }
  return idea;
}
let sweeping=false;
async function ideasSweep(force){
  if(sweeping||document.hidden||state.refreshing)return; // never compete with a visible-panel refresh
  const now=Date.now();
  const gap=state.view==='ideas'?110000:300000; // full-watchlist sweep every 5 min unless Ideas is open
  if(!force&&state.lastSweep&&now-state.lastSweep<gap)return;
  sweeping=true;state.lastSweep=now;
  try{
    if(liveOn()){
      try{const qs=await fetchQuotes(TICKS);TICKS.forEach(s=>{const u=underOf(s);if(qs[u])state.spot[s]=qs[u];});}catch(e){}
    }
    for(const sym of TICKS){
      try{
        let d=state.data[sym];
        if(!d||!state.dataAge[sym]||Date.now()-state.dataAge[sym]>90000){
          const old=state.data[sym];
          const r=await getSym(sym,3,false);
          if(r){
            if(old&&old.strikes){const m={};old.strikes.forEach(s=>m[s.k]=s.gex);state.prevG[sym]=m;}
            state.data[sym]=r;state.dataAge[sym]=Date.now();d=r;
          }
        }
        if(!d)continue;
        const tech=await getTech(sym);
        state.ideas[sym]=scoreIdea(sym,d,tech);
      }catch(e){}
      await new Promise(r2=>setTimeout(r2,60));
    }
  }finally{sweeping=false;}
  if(state.view==='ideas')renderCards();
}
setInterval(()=>ideasSweep(false),30000);
setTimeout(()=>ideasSweep(true),15000); // let the visible panels land first

/* ---- per-metric exposure profile across ±7% spot grid ---- */
function exposureProfile(contracts,spot){
  if(!contracts||!contracts.length||!spot)return null;
  const n=48,lo=spot*0.93,hi=spot*1.07,pts=[];
  for(let i=0;i<=n;i++){
    const s=lo+(hi-lo)*i/n;
    let gu=0,ga=0,vu=0,va=0;
    for(const c of contracts){
      const sg=c.call?1:-1;
      const gg=bsGamma(s,c.k,c.iv,c.T)*c.oi;
      const vv=bsVanna(s,c.k,c.iv,c.T)*c.oi;
      gu+=sg*gg;ga+=gg;vu+=sg*vv;va+=vv;
    }
    pts.push({s,
      g:dealerAdj(gu,ga)*100*s*s*0.01,
      v:dealerAdj(vu,va)*100*s*0.01});
  }
  const flipFor=key=>{let f=null,b=1e18;for(let i=0;i<pts.length-1;i++){if(pts[i][key]*pts[i+1][key]<0){const x=pts[i].s+(pts[i+1].s-pts[i].s)*(-pts[i][key])/(pts[i+1][key]-pts[i][key]);if(Math.abs(x-spot)<b){b=Math.abs(x-spot);f=x;}}}return f;};
  const idx=Math.max(0,Math.min(n,Math.round((spot-lo)/(hi-lo)*n)));
  return{pts,
    flipG:flipFor('g'),flipV:flipFor('v'),
    netG:pts[idx]?pts[idx].g:0,netV:pts[idx]?pts[idx].v:0};
}
function base(){return state.tradierEnv==='production'?'https://api.tradier.com/v1':'https://sandbox.tradier.com/v1';}
function hdr(){return{'Authorization':'Bearer '+state.tradierToken,'Accept':'application/json'};}
/* Backend proxy: when the Cloudflare Worker is wired, every Tradier call goes
   through it so the token lives server-side and never touches the browser.
   Falls back to a direct call if the backend isn't configured. */
function backendOn(){return !!(window.KairosBackend&&window.KairosBackend.enabled);}
function liveOn(){return backendOn()||(state.tradierToken&&state.tradierToken.length>8);}
window.liveOn=liveOn;window.backendOn=backendOn;

const rl={stamps:[]};
async function tFetch(path){
  const now=Date.now();
  rl.stamps=rl.stamps.filter(t=>now-t<60000);
  rl.stamps.push(now);
  if(rl.stamps.length>110){
    const wait=60000-(now-rl.stamps[0])+200;
    if(wait>0)await new Promise(r=>setTimeout(r,wait));
  }
  if(backendOn()){
    const r=await fetch(window.KairosBackend.base+'/proxy'+path,{cache:'no-store'});
    if(!r.ok)throw new Error(r.status+' '+(await r.text()).slice(0,80));
    return r.json();
  }
  const r=await fetch(base()+path,{headers:hdr(),cache:'no-store'});
  if(!r.ok)throw new Error(r.status+' '+(await r.text()).slice(0,80));
  return r.json();
}
async function exps(sym){
  const u=underOf(sym);
  if(state.expCache[u]&&Date.now()-state.expCache[u].t<40*60*1000)return state.expCache[u].d;
  const j=await tFetch('/markets/options/expirations?symbol='+encodeURIComponent(u)+'&includeAllRoots=true');
  const d=(j.expirations&&j.expirations.date)?j.expirations.date:[];
  state.expCache[u]={d,t:Date.now()};
  return d;
}
async function fetchQuotes(syms){
  const uniq=[...new Set(syms.map(underOf))].filter(Boolean);
  if(!uniq.length)return{};
  const j=await tFetch('/markets/quotes?symbols='+encodeURIComponent(uniq.join(',')));
  let q=j.quotes&&j.quotes.quote;if(!q)return{};
  if(!Array.isArray(q))q=[q];
  const out={};
  const ext=marketPhase()!=='rth';   // outside regular hours, prefer the extended print
  q.forEach(x=>{
    if(!x.symbol)return;
    const rth=+(x.last||x.close||0);
    const xh=+(x.extended_hours_price||0);
    // during pre/post/overnight, show the extended-hours print if it's fresher
    const p=(ext&&xh>0)?xh:rth;
    if(p>0){
      const sym=String(x.symbol).toUpperCase();
      out[sym]=p;
      // stash extended-hours meta for the header badge
      if(ext&&xh>0){state._xh=state._xh||{};state._xh[sym]={px:xh,chg:+x.extended_hours_change||0,prev:rth};}
    }
  });
  return out;
}
/* which trading phase are we in (US/Eastern)? drives after-hours pricing/label */
function marketPhase(){
  try{
    const f=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false});
    const pp=Object.fromEntries(f.formatToParts(new Date()).map(x=>[x.type,x.value]));
    const wd=pp.weekday,hh=+pp.hour,mm=+pp.minute,t=hh*60+mm;
    if(wd==='Sat'||wd==='Sun')return 'closed';
    if(t>=9*60+30&&t<=16*60)return 'rth';
    if(t>=4*60&&t<9*60+30)return 'pre';
    if(t>16*60&&t<20*60)return 'post';
    return 'overnight';
  }catch(e){return 'rth';}
}
window.marketPhase=marketPhase;
async function fetchChainsTradier(sym,maxExp){
  const under=underOf(sym);
  const dates=await exps(sym);
  const today=localDate();
  let near=dates.filter(d=>d>=today).slice(0,maxExp);
  if(!near.length)near=dates.filter(d=>d>=today).slice(0,1);
  if(!near.length)throw new Error('no expirations');
  const agg={};let total=0,bestD=1e9,spotHint=0;
  await Promise.allSettled(near.map(async e=>{
    const j=await tFetch('/markets/options/chains?symbol='+encodeURIComponent(under)+'&expiration='+e+'&greeks=true');
    const o=(j.options&&j.options.option)?j.options.option:[];
    const arr=Array.isArray(o)?o:(o?[o]:[]);
    total+=arr.length;
    const T=Math.max(dteOf(e),0.02)/365;
    arr.forEach(opt=>{
      const k=+(opt.strike||0),oi=+(opt.open_interest||0),vol=+(opt.volume||0);
      if(!k||(!oi&&!vol))return;
      const gr=opt.greeks||{};
      const g0=+(gr.gamma||0),iv=+(gr.mid_iv||gr.smv_vol||0);
      const call=(opt.option_type||'').toLowerCase()==='call';
      const dlRaw=+(gr.delta||0);
      const dl=Math.abs(dlRaw);
      const bid=+(opt.bid||0),ask=+(opt.ask||0);
      const mid=(bid+ask)/2||+(opt.last||0);
      if(call&&oi&&Math.abs(dl-0.5)<bestD){bestD=Math.abs(dl-0.5);spotHint=k;}
      const ck=e+'|'+k+'|'+(call?'C':'P');
      const c=agg[ck]||(agg[ck]={e,k,call,T,oi:0,vol:0,ivw:0,ivn:0,g0w:0,g0n:0,mid:0,bid:0,ask:0,dlw:0,dln:0});
      c.oi+=oi;c.vol+=vol;c.mid=mid||c.mid;
      if(bid)c.bid=bid;if(ask)c.ask=ask;
      const w2=oi||1;
      if(dlRaw){c.dlw+=dlRaw*w2;c.dln+=w2;}
      if(iv>0.01&&iv<5){c.ivw+=iv*w2;c.ivn+=w2;}
      if(g0>0){c.g0w+=g0*w2;c.g0n+=w2;}
    });
  }));
  const list=Object.values(agg).map(c=>({e:c.e,k:c.k,call:c.call,T:c.T,oi:c.oi,vol:c.vol,iv:c.ivn?c.ivw/c.ivn:0,g0:c.g0n?c.g0w/c.g0n:0,mid:c.mid,bid:c.bid||0,ask:c.ask||0,dl:c.dln?c.dlw/c.dln:0}));
  if(!list.length)throw new Error('empty chains');
  return{list,dates:near,rawCount:total,spotHint,spot:0,src:state.tradierEnv==='production'?'tradier-live':'tradier-sandbox',maxExp};
}
async function fetchChainsCBOE(sym){
  let cs=sym;if(sym==='SPX'||sym==='SPXW')cs='_SPX';
  const url='https://cdn.cboe.com/api/global/delayed_quotes/options/'+encodeURIComponent(cs)+'.json';
  const proxies=[url,'https://api.allorigins.win/raw?url='+encodeURIComponent(url)];
  let j=null;
  for(const u of proxies){
    try{const c=new AbortController();const t=setTimeout(()=>c.abort(),8000);const r=await fetch(u,{signal:c.signal,cache:'no-store'});clearTimeout(t);if(r.ok){j=await r.json();break;}}catch(e){}
  }
  if(!j)throw new Error('CBOE unreachable');
  const data=j.data||j,opts=data.options||[],spot=+(data.current_price||0);
  if(!spot)throw new Error('CBOE no spot');
  const now=Date.now();
  const list=[];const seen={};
  opts.forEach(o=>{
    let k=+(o.strike||0),oi=+(o.open_interest||0),g0=+(o.gamma||0),call=null,e=null,T=0;
    const vol=+(o.volume||0),iv=+(o.iv||0);
    const mid=((+(o.bid||0))+(+(o.ask||0)))/2||+(o.last_trade_price||0);
    const m=String(o.option||'').match(/(\d{6})([CP])(\d{8})$/);
    if(m){
      if(!k)k=parseInt(m[3],10)/1000;
      call=m[2]==='C';
      e='20'+m[1].slice(0,2)+'-'+m[1].slice(2,4)+'-'+m[1].slice(4,6);
      const ex=new Date(e+'T16:00:00'+nyOffset(e));
      T=Math.max((ex-now)/86400000,0.02)/365;
      if((ex-now)/86400000<-0.1)return;
    }
    if(call===null)call=String(o.option_type||'').toLowerCase()==='call';
    if(!k||!e)return;
    if(!oi&&!vol)return;
    list.push({e,k,call,T,oi,vol,iv:(iv>0.01&&iv<5)?iv:0,g0:g0>0?g0:0,mid,bid:+(o.bid||0),ask:+(o.ask||0),dl:+(o.delta||0)});
    seen[e]=1;
  });
  if(!list.length)throw new Error('CBOE empty');
  return{list,dates:Object.keys(seen).sort(),rawCount:opts.length,spotHint:0,spot,src:'cboe',maxExp:99};
}
function expiryFilt(c){
  const dd=dteOf(c.e);
  if(state.expiry==='0dte')return dd<=0.8;
  if(state.expiry==='7d')return dd<=7.2;
  if(state.expiry==='30d')return dd<=30.2;
  return true;
}

/* ---- shared aggregator: builds GEX + VEX per strike in one pass ---- */
function buildFromChains(sym){
  const ch=state.chains[sym];
  if(!ch||!ch.list||!ch.list.length)return null;
  const spot=state.spot[sym]||ch.spot||ch.spotHint||0;
  if(!spot)return null;
  const cs=ch.list.filter(expiryFilt);
  if(!cs.length)return null;
  const gmult=100*spot*spot*0.01, vmult=100*spot*0.01;
  const per={};const contracts=[];
  for(const c of cs){
    let g=c.g0;
    if(state.calcMode==='live'&&c.iv>0.01&&c.iv<5){const gb=bsGamma(spot,c.k,c.iv,c.T);if(gb>0)g=gb;}
    let van=0;
    if(c.iv>0.01&&c.iv<5)van=bsVanna(spot,c.k,c.iv,c.T);
    if(!g&&!van)continue;
    const sgn=c.call?1:-1;
    const pe=per[c.e]||(per[c.e]={});
    const b=pe[c.k]||(pe[c.k]={k:c.k,gu:0,ga:0,guv:0,gav:0,vu:0,va:0,vuv:0,vva:0,oi:0,vol:0});
    b.gu+=sgn*g*c.oi;  b.ga+=g*c.oi;    b.guv+=sgn*g*c.vol;   b.gav+=g*c.vol;
    b.vu+=sgn*van*c.oi;b.va+=van*c.oi;  b.vuv+=sgn*van*c.vol; b.vva+=van*c.vol;
    b.oi+=c.oi;b.vol+=c.vol;
    if(c.oi&&c.iv>0.01&&c.iv<5)contracts.push({k:c.k,oi:c.oi,iv:c.iv,T:c.T,call:c.call});
  }
  const bv=state.sizeBasis==='vol';
  const gval=s=>dealerAdj(bv?s.guv:s.gu, bv?s.gav:s.ga)*gmult;
  const vval=s=>dealerAdj(bv?s.vuv:s.vu, bv?s.vva:s.va)*vmult;
  const byExp={},allBy={};
  const dates=Object.keys(per).sort();
  const FIELDS=['gu','ga','guv','gav','vu','va','vuv','vva','oi','vol'];
  dates.forEach(e=>{
    const listE=Object.values(per[e]).map(s=>({k:s.k,gex:gval(s),vex:vval(s),oi:s.oi,vol:s.vol}))
      .filter(s=>s.gex!==0||s.vex!==0).sort((a,b)=>b.k-a.k);
    byExp[e]=listE;
    Object.values(per[e]).forEach(s=>{
      const t=allBy[s.k]||(allBy[s.k]={k:s.k,gu:0,ga:0,guv:0,gav:0,vu:0,va:0,vuv:0,vva:0,oi:0,vol:0});
      FIELDS.forEach(f=>t[f]+=s[f]);
    });
  });
  let strikes=Object.values(allBy).map(s=>({k:s.k,gex:gval(s),vex:vval(s),oi:s.oi,vol:s.vol})).sort((a,b)=>b.k-a.k);
  const range=nxBand(sym,spot);
  strikes=strikes.filter(s=>Math.abs(s.k-spot)<range);
  state.multi[sym]={byExp,spot,dates:dates.filter(e=>byExp[e]&&byExp[e].length)};
  return{spot,source:ch.src,strikes,rawCount:ch.rawCount,contracts,chStamp:ch.t};
}
function buildImbalance(sym){
  const ch=state.chains[sym];
  if(!ch||!ch.list||!ch.list.length)return null;
  const spot=state.spot[sym]||ch.spot||ch.spotHint||0;
  if(!spot)return null;
  const cs=ch.list.filter(expiryFilt);
  if(!cs.length)return null;
  const by={};
  for(const c of cs){
    if(!c.oi&&!c.vol)continue;
    const b=by[c.k]||(by[c.k]={k:c.k,cv:0,pv:0,coi:0,poi:0,cpr:0,ppr:0,cg:0,pg:0});
    const prem=(c.mid||0)*c.vol*100;
    // gamma-weighted OI = the dealer hedging load at this strike. gamma is highest
    // ATM/near-expiry and decays away from spot, so a far-OTM tail hedge (e.g. a 720
    // put) contributes almost nothing — this is the industry Call Wall / Put Wall input,
    // not raw OI (which lets tail strikes masquerade as the floor/ceiling).
    let g=0;
    if(c.iv>0.01&&c.iv<5)g=bsGamma(spot,c.k,c.iv,c.T);
    if(!g)g=c.g0||0;
    const gw=g*c.oi;
    if(c.call){b.cv+=c.vol;b.coi+=c.oi;b.cpr+=prem;b.cg+=gw;}
    else{b.pv+=c.vol;b.poi+=c.oi;b.ppr+=prem;b.pg+=gw;}
  }
  const strikes=Object.values(by).sort((a,b)=>b.k-a.k);
  return{spot,source:ch.src,strikes};
}
async function getSym(sym,maxExp,force){
  sym=cleanSym(sym);if(!sym)return null;
  const need=maxExp||(state.expiry==='30d'?8:5);
  const ch=state.chains[sym];
  const fresh=!force&&ch&&ch.list&&ch.list.length&&(Date.now()-ch.t<CHAIN_TTL)&&ch.maxExp>=need;
  if(!fresh){
    let got=null;
    if(liveOn()){
      try{got=await fetchChainsTradier(sym,need);}catch(e){console.warn('Tradier',sym,e.message);}
    }
    if(!got){try{got=await fetchChainsCBOE(sym);}catch(e){console.warn('CBOE',sym,e.message);}}
    if(got){got.t=Date.now();state.chains[sym]=got;if(got.spot)state.spot[sym]=got.spot;}
    else if(!ch)return null;
  }
  const c2=state.chains[sym];if(!c2)return null;
  if(!state.spot[sym]){
    if(c2.spot)state.spot[sym]=c2.spot;
    else if(liveOn()){
      try{const q=await fetchQuotes([sym]);const u=underOf(sym);if(q[u])state.spot[sym]=q[u];}catch(e){}
    }
    if(!state.spot[sym]&&c2.spotHint)state.spot[sym]=c2.spotHint;
  }
  return buildFromChains(sym);
}
function rowStyle(s,maxAbs){
  const v=mval(s);
  const ratio=Math.abs(v)/maxAbs;
  if(ratio<0.10)return 'background:rgba(99,102,241,0.06);';
  if(ratio<0.32){
    const a=0.08+(ratio-0.10)/0.22*0.18;
    return v>=0?`background:rgba(45,212,191,${a});`:`background:rgba(147,51,234,${a});`;
  }
  const a=0.30+Math.min(0.58,(ratio-0.32)/0.68*0.58);
  return v>=0?`background:rgba(45,212,191,${a});`:`background:rgba(147,51,234,${a});`;
}
function centerIn(wrap,el2){
  if(!wrap||!el2)return;
  const r=el2.getBoundingClientRect(),wr=wrap.getBoundingClientRect();
  wrap.scrollTop=Math.max(0,wrap.scrollTop+(r.top-wr.top)-(wrap.clientHeight/2-r.height/2));
}
function skeletonPanel(sym,label){
  const p=document.createElement('div');p.className='panel'+(state.view==='single'?' single-mode':'');
  p.dataset.sym=sym;
  const rows=Array.from({length:22},()=>'<div class="skelrow"></div>').join('');
  p.innerHTML=`<div class="p-head"><div class="p-left"><span style="font-weight:700">${sym}</span><span class="badge-src demo">${label||'loading'}</span></div></div><div class="strikes">${rows}</div>`;
  return p;
}
function kingCls(){return state.metric==='vex'?'vexk':'';}
function pillCls(){return state.metric==='vex'?'vex':'';}

function renderTrinity(){
  const el=document.getElementById('trinity');
  // never yank the DOM out from under a typing user
  const ae=document.activeElement;
  if(comboFor||(ae&&ae.classList&&ae.classList.contains('ticker-sel')&&el.contains(ae)))return;
  const prevScroll={};
  el.querySelectorAll('.panel[data-key]').forEach(pn=>{
    const w=pn.querySelector('.strikes,.sgrid-wrap');
    if(w)prevScroll[pn.dataset.key]={top:w.scrollTop,left:w.scrollLeft};
  });
  el.innerHTML='';
  el.style.gridTemplateColumns=state.view==='single'?'1fr':'';
  const list=state.view==='single'?[state.focus]:state.trinityTickers;
  const mlab=state.metric==='vex'?'Vanna King':'King';

  list.forEach((sym,slotIdx)=>{
    const key=sym+'|'+(state.view==='single'?'s':'t');
    const d=state.data[sym]||((state.warmData||{})[sym]);
    if(state.view==='single'&&state.singleLoading&&(!state.multi[sym]||(state.multi[sym].dates||[]).length<8)){
      const p=skeletonPanel(sym,'loading 9 expiries');p.dataset.key=key;el.appendChild(p);return;
    }
    if(!d){
      const p=document.createElement('div');p.className='panel'+(state.view==='single'?' single-mode':'');p.dataset.key=key;
      const rows=state.firstLoadFailed
        ?`<div class="err-chip">No data source reachable for ${sym}. ${state.tradierToken?'Check the Tradier token in Settings — CBOE fallback also failed.':'Add a free Tradier token in Settings for live data, or wait for the CBOE retry.'}</div>`
        :Array.from({length:22},()=>'<div class="skelrow"></div>').join('');
      p.innerHTML=`<div class="p-head"><div class="p-left"><span style="font-weight:700">${sym}</span><span class="badge-src demo">${state.firstLoadFailed?'offline':'loading'}</span></div></div><div class="strikes">${rows}</div>`;
      el.appendChild(p);
      return;
    }
    if(d.warm){
      const p=document.createElement('div');p.className='panel'+(state.view==='single'?' single-mode':'');p.dataset.key=key;
      const mx=Math.max(1,...d.strikes.map(s=>Math.abs(s.gex)));
      const rows=d.strikes.slice().sort((a,b)=>b.k-a.k).map(s=>{
        const wPct=Math.max(3,Math.abs(s.gex)/mx*100);
        const pos=s.gex>=0;
        return '<div style="display:flex;align-items:center;gap:8px;padding:2.5px 10px;font-family:\'JetBrains Mono\';font-size:.72rem">'+
          '<span style="width:56px;flex-shrink:0;color:var(--text)">'+s.k+'</span>'+
          '<div style="flex:1"><div style="height:7px;border-radius:3px;width:'+wPct.toFixed(1)+'%;background:linear-gradient(90deg,'+(pos?'rgba(52,211,153,.8),rgba(52,211,153,.2)':'rgba(192,132,252,.8),rgba(192,132,252,.2)')+')"></div></div></div>';
      }).join('');
      const ageM=d.t?Math.max(0,Math.round((Date.now()-d.t)/60000)):null;
      p.innerHTML='<div class="p-head"><div class="p-left"><span style="font-weight:700">'+sym+'</span>'+
        '<span class="badge-src demo" data-tip="Painted instantly from the last server field snapshot'+(ageM!=null?' ('+ageM+'m old)':'')+' while the full live chain loads \u2014 top nodes only, live ladder lands in seconds.">warming</span></div>'+
        '<div style="font-family:\'JetBrains Mono\';font-size:.78rem;color:var(--muted)">$'+(+d.spot).toFixed(2)+'</div></div>'+
        '<div class="strikes">'+rows+'</div>';
      el.appendChild(p);return;
    }
    const kg=kingOf(d.strikes);
    const cw=callWallBand(d.strikes,d.spot),pw=putWallBand(d.strikes,d.spot);
    const maxAbs=Math.max(...(d.strikes||[]).map(x=>Math.abs(mval(x))),1);
    const srcMap={'tradier-live':'live','tradier-sandbox':'sandbox','cboe':'cboe','demo':'demo'};
    const srcTxt={'tradier-live':'Live','tradier-sandbox':'Sandbox','cboe':'CBOE','demo':'Demo'};
    const age=state.dataAge[sym]?Date.now()-state.dataAge[sym]:0;
    const staleB=age>3*state.pollSec*1000?`<span class="badge-src stale" data-tip="No successful update for ${Math.round(age/1000)}s — showing the last good snapshot">stale</span>`:'';

    const p=document.createElement('div');
    p.className='panel'+(state.view==='single'?' single-mode':'');
    p.dataset.sym=sym;p.dataset.key=key;

    if(state.view==='single' && state.multi[sym] && state.multi[sym].dates && state.multi[sym].dates.length){
      const m=state.multi[sym];
      /* --- Junction header strip: weekly walls (nearest expiry) + biggest nodes chart-wide --- */
      const hdrDp=(sym==='SPXW'||sym==='SPX')?0:2;
      const wkExp=m.dates[0]; // soonest expiry = the M-F cycle we're in
      let wkCW=null,wkCWv=0,wkPW=null,wkPWv=0;
      (m.byExp[wkExp]||[]).forEach(s=>{const v=mval(s);
        if(s.k>=m.spot&&v>wkCWv){wkCWv=v;wkCW=s.k;}
        if(s.k<=m.spot&&v<wkPWv){wkPWv=v;wkPW=s.k;}
      });
      // biggest nodes across the WHOLE chain (aggregate by strike)
      const agg={};
      m.dates.forEach(e2=>(m.byExp[e2]||[]).forEach(s=>{agg[s.k]=(agg[s.k]||0)+mval(s);}));
      const bigNodes=Object.keys(agg).map(k=>({k:+k,v:agg[k]})).sort((a,b)=>Math.abs(b.v)-Math.abs(a.v)).slice(0,3);
      const wkLabel=wkExp?wkExp.slice(5).replace('-','/'):'\u2014';
      const nodeChip=n=>`<span class="hn-node ${n.v>=0?'pos':'neg'}">${n.k} <i>${mdisp(n.v,m.spot)}</i></span>`;
      const headStrip=`<div class="p-mid">
        ${(function(){
          const xh=(state._xh||{})[underOf(sym)]||(state._xh||{})[sym];
          if(!xh||marketPhase()==='rth')return '';
          const ph={pre:'PRE-MARKET',post:'AFTER HOURS',overnight:'OVERNIGHT',closed:'LAST'}[marketPhase()]||'EXTENDED';
          const chg=xh.chg||0, pct=xh.prev?((xh.px-xh.prev)/xh.prev*100):0;
          const up=chg>=0;
          return `<div class="hm-block" data-tip="Extended-hours print from the ${ph.toLowerCase()} session, versus the regular-session close. Options chains still reflect the last regular session.">
            <div class="hm-lab">${ph}</div>
            <div class="hm-xh"><b style="color:${up?'var(--green)':'var(--red)'}">$${xh.px.toFixed(2)}</b>
              <i style="color:${up?'var(--green)':'var(--red)'}">${up?'\u25b2':'\u25bc'} ${Math.abs(pct).toFixed(2)}%</i>
              <s style="text-decoration:none;color:var(--muted)">close ${(xh.prev||0).toFixed(2)}</s></div>
          </div>`;
        })()}
        <div class="hm-block" data-tip="Call & put walls computed from just the nearest expiry (${wkExp||'—'}) — the weekly cycle you're trading now.">
          <div class="hm-lab">WEEKLY ${wkLabel}</div>
          <div class="hm-walls"><span class="hw-c">CW ${wkCW!=null?wkCW.toFixed(hdrDp):'\u2014'}</span><span class="hw-p">PW ${wkPW!=null?wkPW.toFixed(hdrDp):'\u2014'}</span></div>
        </div>
        <div class="hm-block" data-tip="The three largest ${metricLabel(state.metric)} nodes across the ENTIRE chain (all expiries aggregated) — the structural magnets.">
          <div class="hm-lab">BIGGEST NODES</div>
          <div class="hm-nodes">${bigNodes.map(nodeChip).join('')}</div>
        </div>
      </div>`;
      p.innerHTML=`
        <div class="p-head">
          <div class="p-left">
            <input class="ticker-sel" list="tickerList" data-old="${sym}" value="${sym}" style="width:86px" autocomplete="off" data-tip="Type any optionable ticker — or pick from your roster">
            <span class="price mono">$${(d.spot||0).toFixed(2)}</span>
            <span class="badge-src ${srcMap[d.source]||'demo'}">${srcTxt[d.source]||d.source}</span>${staleB}
          </div>
          ${headStrip}
          <div class="king-pill ${pillCls()}${kg&&mval(kg)<0?' kneg':''}" data-tip="Biggest absolute ${metricLabel(state.metric)} node — the magnet for that force. Strike first: that is the level price is drawn to. Exposure size is secondary.">★ ${mlab} ${kg?kg.k:'\u2014'}${kg?` <i style="font-style:normal;opacity:.66;font-weight:600">${mdisp(mval(kg),d.spot)}</i>`:''}</div>
        </div>
        <div class="sgrid-wrap"></div>`;
      el.appendChild(p);
      p.querySelector('.ticker-sel').onchange=e=>{
        const old=e.target.dataset.old,neu=cleanSym(e.target.value);
        if(!neu){e.target.value=old;return;}
        if(neu===old)return;
        // single view: change focus only — never touch the saved Triad set
        state.focus=neu;state.singleLoading=true;refresh(false);
      };
      const wrap=p.querySelector('.sgrid-wrap');
      /* Junction DISPLAY band — wider than the calc band so tall-priced names
         (MSFT, META, SPXW) show their full structure. Display-only: it does NOT
         touch wall/King math (that stays on nxBand). We also force-include the
         King strike so it can never be clipped off the visible ladder. */
      const dispRange=(sym==='SPXW'||sym==='SPX')?520:Math.max(70,Math.min(m.spot*0.16,1000));
      // find the King strike across all expiries first, so we can guarantee its row
      let _gMax=0,_gKk=null;
      m.dates.forEach(e2=>(m.byExp[e2]||[]).forEach(s=>{const a=Math.abs(mval(s));if(a>_gMax){_gMax=a;_gKk=s.k;}}));
      const ks=new Set();
      m.dates.forEach(e2=>(m.byExp[e2]||[]).forEach(s=>{if(Math.abs(s.k-m.spot)<dispRange)ks.add(s.k);}));
      if(_gKk!=null)ks.add(_gKk); // never clip the King
      const ladder=[...ks].sort((a,b)=>b-a);
      const cell={};let gMax=1,gK=null;
      m.dates.forEach(e2=>{cell[e2]={};(m.byExp[e2]||[]).forEach(s=>{const v=mval(s);cell[e2][s.k]=v;const a=Math.abs(v);if(a>gMax){gMax=a;gK=e2+'|'+s.k;}});});
      const gKk=gK?+gK.split('|')[1]:null;
      let spotK=null,bs=1e18;ladder.forEach(k=>{const dd=Math.abs(k-m.spot);if(dd<bs){bs=dd;spotK=k;}});
      const shade=v=>{
        const r=Math.abs(v)/gMax;
        if(r<0.02)return'';
        const a=r<0.30?(0.07+r/0.30*0.18):(0.28+Math.min(0.6,(r-0.30)/0.70*0.6));
        return v>=0?`background:rgba(45,212,191,${a.toFixed(2)})`:`background:rgba(147,51,234,${a.toFixed(2)})`;
      };
      const kcls=kingCls();
      let h='<table class="sgrid"><thead><tr><th class="sk">Strike</th>'+m.dates.map(e2=>`<th>${e2}</th>`).join('')+'</tr></thead><tbody>';
      ladder.forEach(k=>{
        const rowSum=m.dates.reduce((a,e2)=>a+(cell[e2][k]||0),0);
        const dlR=deltaOf(sym,k,rowSum,gMax);
        const arrow=(dlR!==null&&isFinite(dlR)&&Math.abs(dlR)>=DELTA_MIN)?(dlR>=0?' <span style="color:var(--teal)">\u25b4'+Math.abs(dlR).toFixed(0)+'%</span>':' <span style="color:#e879f9">\u25be'+Math.abs(dlR).toFixed(0)+'%</span>'):'';
        const isKingRow=gKk!==null&&k===gKk;
        h+=`<tr class="${k===spotK?'spotrow ':''}${isKingRow?'kingrow':''}"><td class="sk" title="${dlR!==null&&isFinite(dlR)?'\u0394 '+dlR.toFixed(1)+'% vs ~12 min ago (net across shown expiries)':''}">${k}${k===spotK?' \u25b6 <span class="spotpx">$'+m.spot.toFixed(2)+'</span>':''}${arrow}</td>`;
        m.dates.forEach(e2=>{
          const v=cell[e2][k];
          if(v===undefined||Math.abs(v)<1){h+='<td class="zero">\u2014</td>';return;}
          const king=(e2+'|'+k)===gK;
          h+=`<td class="${king?('kcell '+kcls+(v<0?' kneg':'')):''}" style="${king?'':shade(v)+';color:'+(v>=0?'var(--teal)':'#e879f9')}" title="${sym} ${k} \u00b7 ${e2} \u00b7 ${mdisp(v,m.spot)}">${mdisp(v,m.spot)}${king?' \u2605':''}</td>`;
        });
        h+='</tr>';
      });
      h+='</tbody></table>';
      wrap.innerHTML=h;
      if(state.scrolled[key]&&prevScroll[key]){wrap.scrollTop=prevScroll[key].top;wrap.scrollLeft=prevScroll[key].left||0;}
      else{
        const sr=wrap.querySelector('.spotrow'),kr=wrap.querySelector('.kingrow');
        const tgt=state.centerOn==='king'?(kr||sr):(sr||kr);
        if(tgt)centerIn(wrap,tgt);state.scrolled[key]=true;
      }
      return;
    }

    // Triad list
    p.innerHTML=`
      <div class="p-head">
        <div class="p-left">
          <input class="ticker-sel" list="tickerList" data-old="${sym}" value="${sym}" style="width:86px" autocomplete="off" data-tip="Type any optionable ticker — or pick from your roster">
          <span class="price mono">$${(d.spot||0).toFixed(2)}</span>${staleB}
        </div>
        <div class="king-pill ${pillCls()}${kg&&mval(kg)<0?' kneg':''}" data-tip="Biggest absolute ${metricLabel(state.metric)} node — the magnet for that force. Strike first: that is the level price is drawn to. Exposure size is secondary.">★ ${mlab} ${kg?kg.k:'\u2014'}${kg?` <i style="font-style:normal;opacity:.66;font-weight:600">${mdisp(mval(kg),d.spot)}</i>`:''}</div>
      </div>
      <div class="strikes"></div>`;
    el.appendChild(p);
    p.querySelector('.ticker-sel').onchange=e=>{
      const old=e.target.dataset.old,neu=cleanSym(e.target.value);
      if(!neu){e.target.value=old;return;}
      if(neu===old)return;
      // write to THIS panel's fixed slot — never indexOf (indexOf finds the first
      // duplicate and permanently strands the second slot on the same ticker)
      const dupAt=state.trinityTickers.indexOf(neu);
      if(dupAt>=0&&dupAt!==slotIdx)state.trinityTickers[dupAt]=old; // swap instead of duplicate
      state.trinityTickers[slotIdx]=neu;
      localStorage.setItem('kairos_ticks',state.trinityTickers.join(','));
      state.focus=neu;refresh(false);
    };
    const listEl=p.querySelector('.strikes');
    const kcls=kingCls();
    let kingRow=null,spotRow=null;
    // exactly one spot row: the strike nearest to live price
    let spotK3=null,bd3=1e18;
    (d.strikes||[]).forEach(s=>{const dd3=Math.abs(s.k-d.spot);if(dd3<bd3){bd3=dd3;spotK3=s.k;}});
    (d.strikes||[]).forEach(s=>{
      const v=mval(s);
      const row=document.createElement('div');row.className='srow';
      const isSpot=s.k===spotK3;
      if(isSpot){row.classList.add('spot');spotRow=row;}
      if(s===kg){row.classList.add('king');if(kcls)row.classList.add(kcls);if(mval(kg)<0)row.classList.add('kneg');kingRow=row;}
      else{row.style.cssText=rowStyle(s,maxAbs);if(s===cw||s===pw)row.classList.add('wall');}
      let mid=s.star||s===kg?'<span class="star">★</span>':'';
      if(isSpot)mid+=`<span class="spotpx">$${(d.spot||0).toFixed(2)}</span>`;
      if(s===cw&&s!==kg)mid+='<span class="wtag cw" data-tip="Largest positive node above spot (ceiling)">CW</span>';
      if(s===pw&&s!==kg)mid+='<span class="wtag pw" data-tip="Largest negative node below spot (support)">PW</span>';
      row.title=`${sym} ${s.k} \u2014 ${metricLabel(state.metric)} ${mdisp(v,d.spot)} \u00b7 OI ${(s.oi||0).toLocaleString()} \u00b7 vol ${(s.vol||0).toLocaleString()} \u00b7 ${(Math.abs(v)/(maxAbs||1)*100).toFixed(0)}% of King`;
      const dl=deltaOf(sym,s.k,v,maxAbs);
      row.innerHTML=`
        <div class="strike">${s.k}</div>
        <div class="mid">${mid}${deltaChip(dl)}</div>
        <div class="gex" style="color:${v>=0?'var(--teal)':'#e879f9'}">${mdisp(v,d.spot)}</div>`;
      row.onclick=()=>{state.focus=sym;openDeep(sym);updateChart(sym);};
      listEl.appendChild(row);
    });
    if(state.scrolled[key]&&prevScroll[key])listEl.scrollTop=prevScroll[key].top;
    else{const tgt=state.centerOn==='king'?(kingRow||spotRow):(spotRow||kingRow);if(tgt)centerIn(listEl,tgt);state.scrolled[key]=true;}
  });
}

function recordSnapshots(){
  const t=Math.floor(Date.now()/1000);
  Object.keys(state.data).forEach(sym=>{
    const d=state.data[sym];if(!d||!d.strikes||!d.strikes.length)return;
    const topFor=metric=>[...d.strikes].sort((a,b)=>Math.abs(mval(b,metric))-Math.abs(mval(a,metric))).slice(0,12).map(s=>({k:s.k,val:Math.round(mval(s,metric))}));
    (state.history[sym]=state.history[sym]||[]).push({t,g:topFor('gex'),v:topFor('vex')});
    if(state.history[sym].length>HIST_TODAY_CAP)state.history[sym].shift();
    /* Regime intraday series: net call/put premium + CLASSIFIED bought/sold
       (quote-rule) + spot. In-memory, resets each session. */
    const imb=buildImbalance(sym);
    if(imb&&imb.strikes){
      let cpr=0,ppr=0;imb.strikes.forEach(s=>{cpr+=s.cpr||0;ppr+=s.ppr||0;});
      // classified flow (bought vs sold) via the quant engine, if present
      let cbought=null,csold=null,pbought=null,psold=null;
      if(window.KairosQuant&&d.contracts&&d.contracts.length){
        try{const fc=window.KairosQuant.classifyFlow(d.contracts.filter(expiryFilt));
          cbought=fc.callBought;csold=fc.callSold;pbought=fc.putBought;psold=fc.putSold;}catch(e){}
      }
      const ser=(state.regSeries[sym]=state.regSeries[sym]||[]);
      ser.push({t,cpr,ppr,spot:d.spot||state.spot[sym]||0,cbought,csold,pbought,psold});
      if(ser.length>REG_SERIES_CAP)ser.shift();
    }
    /* record ATM IV once/tick for IV Rank maturation (localStorage, ~1yr) */
    if(window.KairosQuant&&d.contracts&&d.contracts.length){
      try{
        const spot=d.spot||state.spot[sym]||0;let atm=null,bd=1e18;
        d.contracts.forEach(c=>{const dd=Math.abs(c.k-spot);if(c.iv>0&&dd<bd){bd=dd;atm=c.iv;}});
        if(atm)window.KairosQuant.qivRecord(sym,atm);
      }catch(e){}
    }
  });
  persistHistory(false);
}
function downsampleSnaps(arr,maxN){
  if(!arr||arr.length<=maxN)return arr;
  const step=Math.ceil(arr.length/maxN),out=[];
  for(let i=0;i<arr.length;i+=step)out.push(arr[i]);
  const last=arr[arr.length-1];
  if(out[out.length-1]!==last)out.push(last); // always keep the freshest snapshot
  return out;
}
function persistHistory(force){
  const now=Date.now();
  if(!force&&now-state.lastHistSave<HIST_SAVE_MS)return;
  state.lastHistSave=now;
  const today=new Date().toDateString();
  state.histAll=state.histAll||{};
  state.histAll[today]=state.history;
  // keep only the last N trading days (oldest dropped)
  let keys=Object.keys(state.histAll).sort((a,b)=>new Date(a)-new Date(b));
  while(keys.length>HIST_MAX_DAYS){delete state.histAll[keys.shift()];}
  // downsample every non-today day so the blob stays inside the ~5MB localStorage budget
  keys.forEach(k=>{
    if(k===today)return;
    const day=state.histAll[k];
    Object.keys(day).forEach(sym=>{day[sym]=downsampleSnaps(day[sym],HIST_PRIOR_CAP);});
  });
  const write=()=>localStorage.setItem('kairos_hist',JSON.stringify({v:7,days:state.histAll}));
  try{write();}
  catch(e){ // quota exceeded — shed the oldest days until it fits, keep today
    let ks=Object.keys(state.histAll).sort((a,b)=>new Date(a)-new Date(b));
    while(ks.length>1){
      delete state.histAll[ks.shift()];
      try{write();return;}catch(e2){}
    }
  }
}
function airPockets(d){
  const arr=[...(d.strikes||[])].sort((a,b)=>a.k-b.k);
  if(arr.length<6)return[];
  const max=Math.max(...arr.map(s=>Math.abs(s.gex)),1);
  const minSpan=d.spot*0.002;
  const zones=[];let start=null,prev=null;
  for(let i=0;i<arr.length;i++){
    const weak=Math.abs(arr[i].gex)/max<0.06;
    if(weak&&start===null)start=arr[i].k;
    if(!weak&&start!==null){
      if(prev!==null&&prev-start>=minSpan)zones.push({lo:start,hi:prev});
      start=null;
    }
    prev=arr[i].k;
  }
  if(start!==null&&prev-start>=minSpan)zones.push({lo:start,hi:prev});
  return zones.sort((a,b)=>Math.abs((a.lo+a.hi)/2-d.spot)-Math.abs((b.lo+b.hi)/2-d.spot)).slice(0,3);
}
function flipFor(sym,d){
  const p=ensureProfile(sym,d);
  const fl=p?(state.metric==='vex'?p.flipV:p.flipG):null;
  if(fl)return{price:fl,how:'BS profile'};
  const f=flipOf(d.strikes,d.spot);
  return f?{price:f.k,how:'approx'}:null;
}
let tvLoaded='';
function loadTV(sym){
  const w=document.getElementById('tvChart');
  if(!w)return; // Orrery owns the chart view now
  if(!w||tvLoaded===sym)return;
  w.innerHTML='';
  const holder=document.createElement('div');holder.className='tradingview-widget-container';holder.style.height='100%';
  const inner=document.createElement('div');inner.className='tradingview-widget-container__widget';inner.style.height='100%';
  holder.appendChild(inner);w.appendChild(holder);
  const sc=document.createElement('script');
  sc.src='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  sc.async=true;
  sc.innerHTML=JSON.stringify({autosize:true,symbol:underOf(sym),interval:'5',theme:'dark',style:'1',locale:'en',backgroundColor:'#05060a',gridColor:'#12161e',hide_side_toolbar:false,allow_symbol_change:true,withdateranges:true,studies:['STD;VWAP'],support_host:'https://www.tradingview.com'});
  holder.appendChild(sc);
  tvLoaded=sym;
}
function updateChart(sym){
  if(!document.getElementById('tvChart'))return; // Orrery owns the chart view now
  const d=state.data[sym]; if(!d) return;
  const ct=document.getElementById('chartTicker');
  if(ct&&ct.value!==sym&&document.activeElement!==ct)ct.value=sym;
  document.getElementById('chartFocus').textContent=metricLabel(state.metric).toUpperCase()+' levels';
  if(state.view==='chart')loadTV(sym);
  const kg=kingOf(d.strikes), cw=callWallBand(d.strikes,d.spot), pw=putWallBand(d.strikes,d.spot), fl=flipFor(sym,d);
  const used=new Set();
  let html=lvl('spot','Spot',(d.spot||0).toFixed(2),'live');
  const add=(type,label,s,val)=>{if(!s||used.has(s.k))return;used.add(s.k);html+=lvl(type,label,s.k,val);};
  add('king',metricLabel(state.metric)+' King',kg,kg?mdisp(mval(kg),d.spot):'');
  add('call','Call Wall',cw,cw?mdisp(mval(cw),d.spot):'');
  add('put','Put Wall',pw,pw?mdisp(mval(pw),d.spot):'');
  if(fl) html+=lvl('flip','Zero '+metricLabel(state.metric)+' Flip',(+fl.price).toFixed(1),fl.how);
  let gN=0;
  for(const g of [...(d.strikes||[])].sort((a,b)=>Math.abs(mval(b))-Math.abs(mval(a)))){
    if(gN>=2)break;
    if(used.has(g.k))continue;
    used.add(g.k);gN++;
    html+=lvl('gate','Gatekeeper '+gN,g.k,mdisp(mval(g),d.spot));
  }
  if(state.metric==='gex')airPockets(d).forEach(z=>html+=lvl('gate','Air Pocket',z.lo.toFixed(d.spot>2000?0:1)+'\u2013'+z.hi.toFixed(d.spot>2000?0:1),'low friction'));
  document.getElementById('lvlList').innerHTML=html||'<div style="color:var(--muted);font-size:.76rem">No levels yet \u2014 waiting on first refresh</div>';
  const mA=Math.max(...(d.strikes||[]).map(x=>Math.abs(mval(x))),1);
  const mv=(d.strikes||[]).map(s=>({k:s.k,g:mval(s),dl:deltaOf(sym,s.k,mval(s),mA)}))
    .filter(x=>x.dl!==null&&isFinite(x.dl)&&Math.abs(x.dl)>=DELTA_MIN)
    .sort((a,b)=>Math.abs(b.dl)-Math.abs(a.dl)).slice(0,6);
  document.getElementById('movers').innerHTML=mv.length
    ?mv.map(x=>`<div class="lvl"><div class="lvl-l"><span class="dot ${x.g>=0?'call':'put'}"></span>${x.k}</div><div class="lvl-v" style="color:${x.dl>=0?'var(--teal)':'#e879f9'}">${x.dl>=0?'\u25b2':'\u25bc'}${Math.abs(x.dl).toFixed(1)}% <span style="color:var(--muted);font-weight:400">${mdisp(x.g,d.spot)}</span></div></div>`).join('')
    :'<div style="color:var(--muted);font-size:.72rem">No material node moved \u2265'+DELTA_MIN+'% in the last ~12 min</div>';
}
function lvl(type,label,price,gex){
  return `<div class="lvl${type==='spot'?' spotlvl':''}"><div class="lvl-l"><div class="dot ${type}"></div>${label}</div><div><span class="lvl-v">${price}</span> <span style="color:var(--muted);font-size:.68rem">${gex}</span></div></div>`;
}

/* nearest listed expiry for a symbol, formatted M/D — for the idea thumbnail contract */
function nearestExpLabel(sym){
  const ch=state.chains[sym];
  if(!ch||!ch.list||!ch.list.length)return '';
  let soonest=null;
  for(const c of ch.list){if(c.e&&(soonest===null||c.e<soonest))soonest=c.e;}
  if(!soonest)return '';
  const parts=soonest.split('-'); // YYYY-MM-DD
  if(parts.length===3)return (+parts[1])+'/'+(+parts[2]);
  return soonest;
}
function renderAetherPulse(){
  const el=document.getElementById('aetherPulse');if(!el)return;
  const Q=window.KairosQuant;
  let parts=[];
  // vol regime (VIX term structure)
  const vt=state._vixTerm;
  if(vt&&vt.vix){
    const st=vt.state==='backwardation';
    parts.push(`<span class="ap-block" data-tip="VIX term structure. Backwardation (VIX>VIX3M) = near-term stress priced in; contango = calm. Ratio ${vt.ratio?vt.ratio.toFixed(2):'—'}."><span class="ap-l">VOL REGIME</span><b style="color:${st?'var(--red)':'var(--green)'}">${st?'BACKWARDATION':'CONTANGO'}</b> <i>VIX ${vt.vix.toFixed(1)}${vt.vix3m?' / 3M '+vt.vix3m.toFixed(1):''}</i></span>`);
  }
  // journal hit-rate
  if(Q&&Q.qjStats){
    const js=Q.qjStats();
    if(js.closed>=1){
      const wr=js.winRate!=null?js.winRate.toFixed(0):'—';
      const b80=js.buckets['80+'],b70=js.buckets['70-79'];
      const bkt=(b)=>b&&b.n?`${b.w}/${b.n}`:'0/0';
      parts.push(`<span class="ap-block" data-tip="Track record of surfaced ideas that have since hit their target (win) or invalidation (loss). Stored locally on this device. 80+: ${bkt(b80)}, 70-79: ${bkt(b70)}."><span class="ap-l">HIT RATE</span><b style="color:${js.winRate>=50?'var(--green)':'var(--gold)'}">${wr}%</b> <i>${js.wins}/${js.closed} resolved${js.open?', '+js.open+' open':''}</i></span>`);
    }else if(js.open>0){
      parts.push(`<span class="ap-block"><span class="ap-l">JOURNAL</span><i>${js.open} ideas tracking \u2014 hit-rate builds as they resolve</i></span>`);
    }
  }
  el.innerHTML=parts.length?parts.join(''):'';
  el.style.display=parts.length?'':'none';
}
function renderCards(){
  renderAetherPulse();
  const el=document.getElementById('cards');el.innerHTML='';
  const ideas=Object.values(state.ideas||{}).filter(Boolean).sort((a,b)=>b.score-a.score);
  const scanned=Object.keys(state.ideas||{}).length;
  if(!ideas.length){
    el.innerHTML=`<div style="color:var(--muted);font-size:.78rem;line-height:1.6">${scanned?`Scanned ${scanned} tickers \u2014 nothing clears the 55-score bar right now. A play needs GEX structure and the daily trend pointing the same way.`:'Scanning the full watchlist\u2026 first pass takes about a minute.'}</div>`;
    return;
  }
  ideas.forEach(i=>{
    const c=document.createElement('div');c.className='card idea-thumb';
    const expanded=state.ideaOpen===i.sym;
    const flowTag=i.flow==='confirms'?'<span class="drv">flow \u2713</span>':i.flow==='diverges'?'<span class="drv warn">flow \u2717</span>':'';
    const clk=new Date(i.t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    const exp=nearestExpLabel(i.sym);
    const contract=(i.contractK!=null?i.contractK:'')+i.optType+(exp?' '+exp:'');
    const rrTxt=i.rr!=null?i.rr+' : 1':'\u2014';
    // --- compact thumbnail (always shown) ---
    let h=`<div class="thumb-head">
        <div class="thumb-sym">${i.sym} <span class="tag ${i.bias.toLowerCase()}">${i.bias}</span>${i.momentum?'<span class="tag short">\u2212GEX</span>':''}</div>
        <div class="score">${i.score}</div>
      </div>
      <div class="thumb-contract">${contract}</div>
      <div class="thumb-grid">
        <div><span class="tl">Entry</span><span class="tv">${i.entry??'\u2014'}</span></div>
        <div><span class="tl">Time</span><span class="tv">${clk}</span></div>
        <div><span class="tl">R/R</span><span class="tv" style="color:${i.rr>=1.5?'var(--green)':i.rr!=null?'var(--gold)':'var(--muted)'}">${rrTxt}</span></div>
      </div>`;
    // --- expanded detail (on click) ---
    if(expanded){
      // v2 factors: green = supporting, red = working against; with hover detail
      const factorHtml=(i.factors&&i.factors.length&&typeof i.factors[0]==='object')
        ? i.factors.map(f=>`<span class="drv ${f.pos?'fpos':'fneg'}" title="${(f.detail||'').replace(/"/g,'')}">${f.pos?'+':'\u2212'} ${f.txt}</span>`).join('')
        : (i.drivers||[]).map(x=>`<span class="drv">${x}</span>`).join('');
      h+=`<div class="thumb-detail">
        ${i.desk?`<div class="desk-note">${i.desk}</div>`:`<div class="card-line">${i.line}</div>`}
        ${i.target||i.invalid?`<div class="card-line" style="color:var(--muted)">${i.target?`target <b style="color:var(--gold)">${i.target}</b>`:''}${i.invalid?` \u00b7 invalid ${i.bias==='LONG'?'below':'above'} <b style="color:var(--cyan)">${i.invalid}</b>`:''}</div>`:''}
        <div class="factor-row">${factorHtml}</div>
        <div class="card-meta">${i.meta}</div>
        <button class="btn thumb-deep" data-sym="${i.sym}" style="border-color:var(--border);margin-top:8px;font-size:.68rem">Open full analysis \u2192</button>
      </div>`;
    }
    c.innerHTML=h;
    c.classList.toggle('open',expanded);
    c.onclick=(e)=>{
      if(e.target.closest('.thumb-deep')){state.focus=i.sym;openDeep(i.sym);return;}
      state.ideaOpen=(state.ideaOpen===i.sym)?null:i.sym;
      renderCards();
    };
    el.appendChild(c);
  });
  const note=document.createElement('div');
  note.style.cssText='grid-column:1/-1;color:var(--muted);font-size:.68rem;margin-top:2px';
  note.textContent=`${ideas.length} of ${scanned} scanned tickers qualify \u00b7 GEX regime \u00d7 daily trend \u00d7 intraday tape \u00d7 opening flow \u00b7 re-scans every ~2 min \u00b7 context, not signals`;
  el.appendChild(note);
}

/* ---- Imbalance view (re-renders every tick on purpose: spot pill tracks live price; ~35 rows is negligible) ---- */
function renderImb(sym){
  const d=buildImbalance(sym);
  const bars=document.getElementById('imbBars'),stats=document.getElementById('imbStats');
  const ti=document.getElementById('imbTicker');if(ti&&ti.value!==sym&&document.activeElement!==ti)ti.value=sym;
  const spot=d?d.spot:(state.spot[sym]||0);
  document.getElementById('imbMeta').textContent=d?`$${spot.toFixed(2)} \u00b7 ${d.source}`:'';
  if(!d||!d.strikes||!d.strikes.length){
    stats.innerHTML='';
    bars.innerHTML=`<div class="err-chip">No flow data yet for ${sym} \u2014 it loads on the next refresh (or check the ticker).</div>`;
    document.getElementById('imbNote').textContent='';
    return;
  }
  const rows=d.strikes.filter(s=>(s.cv||0)+(s.pv||0)+(s.coi||0)+(s.poi||0)>0);
  if(!rows.length){bars.innerHTML='<div class="err-chip">Chain loaded but no volume/OI fields \u2014 refresh once to repopulate.</div>';stats.innerHTML='';return;}
  const tot=f=>rows.reduce((a,s)=>a+(s[f]||0),0);
  const cv=tot('cv'),pv=tot('pv'),cpr=tot('cpr'),ppr=tot('ppr');
  const ratio=pv?cv/pv:null,prr=ppr?cpr/ppr:null;
  const blend=((ratio||1)+(prr||1))/2;
  const sent=blend>1.15?'Bullish':blend<0.87?'Bearish':'Neutral';
  const sc=sent==='Bullish'?'var(--green)':sent==='Bearish'?'var(--red)':'var(--muted)';
  // window first, then find floor/ceiling WITHIN the visible band so a far-OTM
  // put wall (e.g. 540, ~28% below spot) can't hijack the readout
  let idx=0,bs=1e18;rows.forEach((s,i)=>{const dd=Math.abs(s.k-spot);if(dd<bs){bs=dd;idx=i;}});
  const HALF=30;
  const upIdx=Math.max(0,idx-HALF), dnIdx=Math.min(rows.length-1,idx+HALF);
  const win=rows.slice(upIdx,dnIdx+1);
  const spotK2=rows[idx].k;
  let ceil=null,flr=null,mc=0,mp=0;
  win.forEach(s=>{
    if(s.k>=spot&&(s.cg||0)>mc){mc=s.cg;ceil=s.k;}   // call wall = peak call-side gamma above spot
    if(s.k<=spot&&(s.pg||0)>mp){mp=s.pg;flr=s.k;}     // put wall  = peak put-side gamma below spot
  });
  // v2: classified bought/sold (quote rule) — the buy/sell split we said we couldn't derive
  let classifiedStat='';
  if(window.KairosQuant&&d&&d.contracts&&d.contracts.length){
    try{
      const fc=window.KairosQuant.classifyFlow(d.contracts.filter(c=>{
        if(state.expiry==='all')return true;const idx=(state.multi[sym]&&state.multi[sym].dates)?state.multi[sym].dates.indexOf(c.e):-1;return true;
      }));
      const bull=fc.callBought+fc.putSold,bear=fc.putBought+fc.callSold,tot=bull+bear;
      const lean=tot>0?(bull-bear)/tot*100:0;
      classifiedStat=`<div class="stat"><div class="sl" data-tip="Quote-rule classification: (calls bought + puts sold) vs (puts bought + calls sold). Bullish premium flow when positive. ~75-80% accurate vs true tick data.">NET FLOW (classified)</div><div class="sv" style="color:${lean>=0?'var(--green)':'var(--red)'}">${lean>=0?'+':''}${lean.toFixed(0)}% ${lean>=5?'bought':lean<=-5?'sold':'flat'}</div></div>`;
    }catch(e){}
  }
  stats.innerHTML=`
    <div class="stat"><div class="sl">CALL VOL</div><div class="sv" style="color:var(--green)">${cv.toLocaleString()}</div></div>
    <div class="stat"><div class="sl">PUT VOL</div><div class="sv" style="color:var(--red)">${pv.toLocaleString()}</div></div>
    <div class="stat"><div class="sl" data-tip="Call volume \u00f7 put volume across the loaded chain. Above 1 = call-dominant tape.">C/P RATIO</div><div class="sv" style="color:var(--gold)">${ratio?ratio.toFixed(2):'\u2014'}</div></div>
    <div class="stat"><div class="sl" data-tip="Blend of the volume ratio and the premium ratio (call dollars vs put dollars traded).">SENTIMENT</div><div class="sv" style="color:${sc}">${sent}</div></div>
    ${classifiedStat}
    <div class="stat"><div class="sl" data-tip="Call premium traded minus put premium traded today">NET PREMIUM</div><div class="sv" style="color:${cpr-ppr>=0?'var(--green)':'var(--red)'}">${fmt(cpr-ppr)}</div></div>
    <div class="stat"><div class="sl" data-tip="Call Wall \u2014 strike above spot with the highest call-side GAMMA (OI\u00d7\u0393), the industry-standard ceiling. Gamma-weighted so a far-OTM call OI can't hijack it; this is where dealer short-call hedging caps rallies.">CALL WALL</div><div class="sv mono" style="color:var(--gold)">${ceil??'\u2014'}</div></div>
    <div class="stat"><div class="sl" data-tip="Put Wall \u2014 strike below spot with the highest put-side GAMMA (OI\u00d7\u0393), the industry-standard floor. Gamma-weighted so a far-OTM put hedge (e.g. 720) is suppressed; this is where dealer hedging supports price.">PUT WALL</div><div class="sv mono" style="color:var(--cyan)">${flr??'\u2014'}</div></div>`;
  const mx=Math.max(...win.map(s=>Math.max(s.cv||0,s.pv||0)),1);
  const mo=Math.max(...win.map(s=>Math.max(s.coi||0,s.poi||0)),1);
  bars.innerHTML=win.map(s=>{
    const cwid=Math.round((s.cv||0)/mx*100),pwid=Math.round((s.pv||0)/mx*100);
    const co=Math.round((s.coi||0)/mo*100),po=Math.round((s.poi||0)/mo*100);
    const mark=s.k===ceil?' <span class="dpill up">CW</span>':s.k===flr?' <span class="dpill dn">PW</span>':'';
    return `<div class="imb-row ${s.k===spotK2?'spotrow2':''}" title="${sym} ${s.k} \u00b7 calls ${((s.cv||0)).toLocaleString()} vol / ${((s.coi||0)).toLocaleString()} OI \u00b7 puts ${((s.pv||0)).toLocaleString()} vol / ${((s.poi||0)).toLocaleString()} OI">
      <div class="side l"><i style="width:${co}%"></i><b style="width:${cwid}%"></b></div>
      <div class="klabel">${s.k}${s.k===spotK2?`<span class="spotpx">$${spot.toFixed(2)}</span>`:''}${mark}</div>
      <div class="side r"><i style="width:${po}%"></i><b style="width:${pwid}%"></b></div>
    </div>`;
  }).join('');
  document.getElementById('imbNote').textContent='Flow classification: Tradier gives total volume per contract, not the aggressor side \u2014 so the NET FLOW split above is inferred with the quote rule (where each contract\u2019s mid sits in its bid/ask spread), the same microstructure method pro tools use, ~75-80% accurate vs true tick data. Treat it as a lean, not gospel.';
  renderRegimeChart(sym);
}

/* ---- Regime intraday chart: net call $ / net put $ / spot ----
   Flowseeker-style: filled area bands for call/put premium on the left axis,
   price as a bright line on the right axis. Recorded live in-memory. */
function renderRegimeChart(sym){
  const host=document.getElementById('regChart'),meta=document.getElementById('regChartMeta');
  if(!host)return;
  const ser=(state.regSeries[sym]||[]).filter(p=>p&&isFinite(p.cpr)&&isFinite(p.ppr));
  if(ser.length<2){
    host.innerHTML='<div style="height:220px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:.68rem;border:1px dashed var(--border);border-radius:8px">Recording flow\u2026 the through-day chart fills in as the session ticks (a few minutes).</div>';
    if(meta)meta.textContent='';
    return;
  }
  const W=host.clientWidth||900,H=Math.max(240,Math.min(320,Math.round((host.clientWidth||900)*0.28)));
  const PL=66,PR=68,PT=16,PB=24;
  const IW=W-PL-PR,IH=H-PT-PB;
  /* defensive: server hydration + live recording can interleave — sort & dedupe
     by timestamp so the line can never loop back on itself. */
  ser.sort((a,b)=>a.t-b.t);
  for(let i=ser.length-1;i>0;i--)if(ser[i].t===ser[i-1].t)ser.splice(i-1,1);
  const t0=ser[0].t,t1=ser[ser.length-1].t,tspan=Math.max(1,t1-t0);
  /* FLOW BANDS (the Flowseeker layout): each premium series is normalised to
     its OWN range inside its OWN band — calls ride the top ~38% of the chart,
     puts hang from the bottom ~38% — so both read as evolving curves with
     visible session shape, instead of two solid slabs from zero. Cumulative
     premium only ever grows; normalising per-band is what makes it legible. */
  const cVals=ser.map(p=>p.cpr),pVals=ser.map(p=>p.ppr);
  const cMin=Math.min(...cVals),cMax=Math.max(...cVals);
  const pMin=Math.min(...pVals),pMax=Math.max(...pVals);
  const BAND=IH*0.38;
  const yC=v=>PT+((cMax>cMin)?(cMax-v)/(cMax-cMin):0.5)*BAND;
  const yPut=v=>PT+IH-BAND+((pMax>pMin)?(v-pMin)/(pMax-pMin):0.5)*BAND;
  const sMin=Math.min(...ser.map(p=>p.spot)),sMax=Math.max(...ser.map(p=>p.spot));
  const sMid=(sMin+sMax)/2;
  const sRange=Math.max(sMax-sMin,sMid*0.0005);
  const sPad=sRange*0.22;
  const sLo=sMin-sPad,sHi=sMax+sPad;
  const x=t=>PL+(t-t0)/tspan*IW;
  const yS=v=>PT+(sHi-v)/((sHi-sLo)||1)*IH;
  const fmtK=v=>{const a=Math.abs(v);return (v<0?'-':'')+'$'+(a>=1e9?(a/1e9).toFixed(2)+'B':a>=1e6?(a/1e6).toFixed(2)+'M':a>=1e3?(a/1e3).toFixed(0)+'K':a.toFixed(0));};
  const clk=t=>{try{return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',hour12:false}).format(new Date(t*1000));}catch(e){return '';}};
  const dp=sHi>=1000?0:sHi>=100?1:2;
  const smooth=(pts)=>{
    if(pts.length<2)return pts.length?('M'+pts[0][0].toFixed(1)+' '+pts[0][1].toFixed(1)):'';
    let d='M'+pts[0][0].toFixed(1)+' '+pts[0][1].toFixed(1);
    for(let i=0;i<pts.length-1;i++){
      const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||pts[i+1];
      const c1x=p1[0]+(p2[0]-p0[0])/6,c1y=p1[1]+(p2[1]-p0[1])/6;
      const c2x=p2[0]-(p3[0]-p1[0])/6,c2y=p2[1]-(p3[1]-p1[1])/6;
      d+=' C'+c1x.toFixed(1)+' '+c1y.toFixed(1)+' '+c2x.toFixed(1)+' '+c2y.toFixed(1)+' '+p2[0].toFixed(1)+' '+p2[1].toFixed(1);
    }
    return d;
  };
  const pts=(key,fn)=>ser.map(p=>[x(p.t),fn(p[key])]);
  const areaOf=(key,fn,base)=>{const P=pts(key,fn);return smooth(P)+' L'+P[P.length-1][0].toFixed(1)+' '+base.toFixed(1)+' L'+P[0][0].toFixed(1)+' '+base.toFixed(1)+' Z';};
  let g='<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" style="display:block" preserveAspectRatio="none">';
  g+='<defs>'+
    '<linearGradient id="regG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--green)" stop-opacity=".22"/><stop offset="1" stop-color="var(--green)" stop-opacity="0"/></linearGradient>'+
    '<linearGradient id="regR" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="var(--red)" stop-opacity=".22"/><stop offset="1" stop-color="var(--red)" stop-opacity="0"/></linearGradient>'+
    '<filter id="regGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'+
    '</defs>';
  // faint band separators
  [PT+BAND,PT+IH-BAND].forEach(y=>{g+='<line x1="'+PL+'" y1="'+y.toFixed(1)+'" x2="'+(W-PR)+'" y2="'+y.toFixed(1)+'" stroke="rgba(126,166,214,.07)" stroke-dasharray="2 5"/>';});
  // band scale labels (left)
  g+='<text x="'+(PL-8)+'" y="'+(PT+9)+'" fill="rgba(52,211,153,.6)" font-size="8.5" text-anchor="end" font-family="JetBrains Mono">'+fmtK(cMax)+'</text>';
  g+='<text x="'+(PL-8)+'" y="'+(PT+BAND+3).toFixed(1)+'" fill="rgba(52,211,153,.35)" font-size="8.5" text-anchor="end" font-family="JetBrains Mono">'+fmtK(cMin)+'</text>';
  g+='<text x="'+(PL-8)+'" y="'+(PT+IH-BAND+3).toFixed(1)+'" fill="rgba(248,113,113,.35)" font-size="8.5" text-anchor="end" font-family="JetBrains Mono">'+fmtK(pMin)+'</text>';
  g+='<text x="'+(PL-8)+'" y="'+(PT+IH).toFixed(1)+'" fill="rgba(248,113,113,.6)" font-size="8.5" text-anchor="end" font-family="JetBrains Mono">'+fmtK(pMax)+'</text>';
  // price axis: 5 clean ticks (right side, cyan = the hero axis)
  [0,0.25,0.5,0.75,1].forEach(f=>{const v=sHi-f*(sHi-sLo);g+='<text x="'+(W-PR+8)+'" y="'+(yS(v)+3).toFixed(1)+'" fill="rgba(124,196,236,.9)" font-size="9.5" text-anchor="start" font-family="JetBrains Mono">'+v.toFixed(dp)+'</text>';});
  [0,0.33,0.66,1].forEach(f=>{const t=t0+tspan*f;g+='<text x="'+x(t).toFixed(1)+'" y="'+(H-8)+'" fill="rgba(110,122,140,.8)" font-size="9" text-anchor="middle" font-family="JetBrains Mono">'+clk(t)+'</text>';});
  // premium curves — context, each in its own band
  g+='<path d="'+areaOf('cpr',yC,PT+BAND)+'" fill="url(#regG)"/>';
  g+='<path d="'+areaOf('ppr',yPut,PT+IH-BAND)+'" fill="url(#regR)"/>';
  g+='<path d="'+smooth(pts('cpr',yC))+'" fill="none" stroke="var(--green)" stroke-width="1.6" stroke-opacity=".8"/>';
  g+='<path d="'+smooth(pts('ppr',yPut))+'" fill="none" stroke="var(--red)" stroke-width="1.6" stroke-opacity=".8"/>';
  // SPOT — the hero. Drawn LAST (on top), bright solid cyan + glow + white core.
  const spotPath=smooth(pts('spot',yS));
  g+='<path d="'+spotPath+'" fill="none" stroke="#22d3ee" stroke-width="3" stroke-opacity=".9" filter="url(#regGlow)"/>';
  g+='<path d="'+spotPath+'" fill="none" stroke="#eafcff" stroke-width="1.2"/>';
  const last=ser[ser.length-1];
  const lx=x(last.t),lyS=yS(last.spot);
  // animated live head (flow pulse) — pure SVG SMIL so it animates without JS
  g+='<circle cx="'+lx.toFixed(1)+'" cy="'+lyS.toFixed(1)+'" r="3.6" fill="#eafcff"><animate attributeName="r" values="3.6;6.5;3.6" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.5;1" dur="1.8s" repeatCount="indefinite"/></circle>';
  // price pill
  g+='<rect x="'+(lx+7).toFixed(1)+'" y="'+(lyS-8).toFixed(1)+'" width="54" height="16" rx="3" fill="#0a141c" stroke="#22d3ee" stroke-opacity=".6"/>';
  g+='<text x="'+(lx+11).toFixed(1)+'" y="'+(lyS+3.5).toFixed(1)+'" fill="#22d3ee" font-size="9.5" font-family="JetBrains Mono" font-weight="700">'+last.spot.toFixed(dp)+'</text>';
  // crosshair layer (driven by the pointer handlers below — no re-render)
  g+='<g id="regXh" style="display:none">'+
     '<line id="regXhV" x1="0" x2="0" y1="'+PT+'" y2="'+(PT+IH)+'" stroke="rgba(234,252,255,.4)" stroke-width="1" stroke-dasharray="2 3"/>'+
     '<circle id="regXhC" r="3.5" fill="var(--green)" stroke="#08120d" stroke-width="1.5"/>'+
     '<circle id="regXhP" r="3.5" fill="var(--red)" stroke="#120808" stroke-width="1.5"/>'+
     '<circle id="regXhS" r="4.5" fill="#eafcff" stroke="#0a141c" stroke-width="1.5"/>'+
     '</g>';
  g+='</svg>';
  host.innerHTML=g;
  /* ---- Nexus-grade inspection: hover / touch scrubs the session. Readout
     shows time, spot, NET CALL $, NET PUT $, NET at that sample, plus the
     change SINCE THE PRIOR SAMPLE — how flow was building, tick by tick. ---- */
  host.style.position='relative';
  const tip=document.createElement('div');tip.className='reg-tip';tip.style.display='none';host.appendChild(tip);
  const svgEl=host.querySelector('svg');
  if(svgEl){
    svgEl.style.touchAction='pan-y';
    const xhG=svgEl.querySelector('#regXh'),xhV=svgEl.querySelector('#regXhV'),
          xhC=svgEl.querySelector('#regXhC'),xhP=svgEl.querySelector('#regXhP'),xhS=svgEl.querySelector('#regXhS');
    const fmtD=v=>(v>=0?'+':'\u2212')+fmtK(Math.abs(v));
    const hide=()=>{xhG.style.display='none';tip.style.display='none';};
    const scrub=ev=>{
      const r=svgEl.getBoundingClientRect();
      const fx=(ev.clientX-r.left)/(r.width||1)*W;
      if(fx<PL||fx>W-PR){hide();return;}
      const tt=t0+(fx-PL)/IW*tspan;
      let lo=0,hi=ser.length-1;
      while(hi-lo>1){const m2=(lo+hi)>>1;if(ser[m2].t<tt)lo=m2;else hi=m2;}
      const i=(Math.abs(ser[lo].t-tt)<=Math.abs(ser[hi].t-tt))?lo:hi;
      const p=ser[i],prev=ser[Math.max(0,i-1)];
      const px=x(p.t);
      xhG.style.display='';
      xhV.setAttribute('x1',px.toFixed(1));xhV.setAttribute('x2',px.toFixed(1));
      xhC.setAttribute('cx',px.toFixed(1));xhC.setAttribute('cy',yC(p.cpr).toFixed(1));
      xhP.setAttribute('cx',px.toFixed(1));xhP.setAttribute('cy',yPut(p.ppr).toFixed(1));
      xhS.setAttribute('cx',px.toFixed(1));xhS.setAttribute('cy',yS(p.spot).toFixed(1));
      const net=p.cpr-p.ppr;
      tip.innerHTML='<b>'+clk(p.t)+'</b> \u00b7 <span style="color:#7cc4ec">'+(+p.spot).toFixed(dp)+'</span>'+
        '<span class="rt-row"><i style="color:var(--green)">CALLS</i> '+fmtK(p.cpr)+(i>0?' <em>'+fmtD(p.cpr-prev.cpr)+'</em>':'')+'</span>'+
        '<span class="rt-row"><i style="color:var(--red)">PUTS</i> '+fmtK(p.ppr)+(i>0?' <em>'+fmtD(p.ppr-prev.ppr)+'</em>':'')+'</span>'+
        '<span class="rt-row"><i style="color:'+(net>=0?'var(--green)':'var(--red)')+'">NET</i> '+fmtK(net)+'</span>';
      tip.style.display='';
      const pxScreen=px/W*(r.width||1);
      const tw=tip.offsetWidth||150;
      tip.style.left=Math.max(4,Math.min((r.width||300)-tw-4,pxScreen+12))+'px';
      tip.style.top='6px';
    };
    svgEl.addEventListener('pointermove',scrub);
    svgEl.addEventListener('pointerdown',scrub);
    svgEl.addEventListener('pointerleave',hide);
  }
  if(meta){
    const net=last.cpr-last.ppr;
    meta.innerHTML='NCP <b style="color:var(--green)">'+fmtK(last.cpr)+'</b> \u00b7 NPP <b style="color:var(--red)">'+fmtK(last.ppr)+'</b> \u00b7 NET <b style="color:'+(net>=0?'var(--green)':'var(--red)')+'">'+fmtK(net)+'</b> \u00b7 '+ser.length+' samples';
  }
}

/* ---- Flow Tape view — repaints only when its chain actually changes (~90s) or filter/symbol switches ---- */
function renderTape(sym){
  const fl=flowLean(sym);
  const ti=document.getElementById('tapeTicker');if(ti&&ti.value!==sym&&document.activeElement!==ti)ti.value=sym;
  const stats=document.getElementById('tapeStats'),body=document.getElementById('tapeBody'),meta=document.getElementById('tapeMeta');
  const spot=fl?fl.spot:(state.spot[sym]||0);
  meta.textContent=spot?`$${spot.toFixed(2)}`:'';
  const ch=state.chains[sym];
  const stamp=sym+'|'+((ch&&ch.t)||0)+'|'+state.expiry;
  if(state._tapeStamp===stamp)return;
  state._tapeStamp=stamp;
  if(!fl||!fl.prints.length){
    stats.innerHTML='';
    body.innerHTML=`<div class="err-chip">No qualifying opening prints for ${sym} yet \u2014 needs a contract's volume today to run \u2265${Math.round(FLOW_OPEN*100)}% of its open interest with \u2265$${(FLOW_MIN_PREM/1000)}k premium. Loads on refresh; quietest early in the session.</div>`;
    document.getElementById('tapeNote').textContent='';
    return;
  }
  const t=fl.callPrem+fl.putPrem;
  const lean=t?fl.net/t:0;
  const sTxt=lean>0.15?'Call-heavy':lean<-0.15?'Put-heavy':'Balanced';
  const sc=lean>0.15?'var(--green)':lean<-0.15?'var(--red)':'var(--muted)';
  stats.innerHTML=`
    <div class="stat"><div class="sl" data-tip="Premium in call contracts opening today (vol \u2265 70% of OI)">CALL OPENING $</div><div class="sv" style="color:var(--green)">${fmt(fl.callPrem)}</div></div>
    <div class="stat"><div class="sl" data-tip="Premium in put contracts opening today">PUT OPENING $</div><div class="sv" style="color:var(--red)">${fmt(fl.putPrem)}</div></div>
    <div class="stat"><div class="sl" data-tip="Call opening $ minus put opening $. Puts can be hedges, so read directionally, not literally.">NET LEAN</div><div class="sv" style="color:${sc}">${sTxt}</div></div>
    <div class="stat"><div class="sl">OPENING PRINTS</div><div class="sv">${fl.prints.length}</div></div>`;
  const oldWrap=body.querySelector('.tape-wrap');const keepScroll=oldWrap?oldWrap.scrollTop:0;
  const ts=state.tapeSort;
  const prints=[...fl.prints].sort((a,b)=>{
    let va,vb;
    if(ts.col==='k'){va=a.k;vb=b.k;}
    else if(ts.col==='voi'){va=a.voi;vb=b.voi;}
    else if(ts.col==='iv'){va=a.iv||0;vb=b.iv||0;}
    else if(ts.col==='vol'){va=a.vol;vb=b.vol;}
    else if(ts.col==='oi'){va=a.oi;vb=b.oi;}
    else{va=a.prem;vb=b.prem;} // default premium
    return ts.dir>0?va-vb:vb-va;
  });
  const arr=c=>ts.col===c?(ts.dir>0?' ▴':' ▾'):'';
  const th=(c,lab,tip)=>`<th data-tcol="${c}" class="tsort${ts.col===c?' on':''}"${tip?' data-tip="'+tip+'"':''}>${lab}${arr(c)}</th>`;
  body.innerHTML='<div class="tape-wrap"><table><thead><tr>'+
    th('k','Contract')+th('e','Exp')+th('vol','Vol')+th('oi','OI')+th('voi','Vol/OI')+th('iv','IV')+th('prem','Premium')+
    '</tr></thead><tbody>'+
    prints.map(p=>{
      const otm=(p.call&&p.k>spot)||(!p.call&&p.k<spot);
      return `<tr><td><span class="cbadge ${p.call?'c':'p'}">${p.call?'C':'P'}</span> ${p.k}${otm?'':' <span style="color:var(--muted)">itm</span>'}</td><td>${p.e.slice(5)}</td><td>${p.vol.toLocaleString()}</td><td>${p.oi.toLocaleString()}</td><td style="color:${p.voi>=1?'var(--gold)':'var(--muted)'}">${p.voi.toFixed(1)}\u00d7</td><td>${p.iv?(p.iv*100).toFixed(0)+'%':'\u2014'}</td><td style="color:var(--gold)">${fmt(p.prem)}</td></tr>`;
    }).join('')+
    '</tbody></table></div>';
  const newWrap=body.querySelector('.tape-wrap');if(newWrap&&keepScroll)newWrap.scrollTop=keepScroll;
  body.querySelectorAll('th[data-tcol]').forEach(h=>{h.onclick=()=>{
    const c=h.dataset.tcol;
    if(state.tapeSort.col===c)state.tapeSort.dir*=-1;
    else state.tapeSort={col:c,dir:c==='k'?1:-1};
    state._tapeStamp='';renderTape(sym); // force re-render past the stamp gate
  };});
  document.getElementById('tapeNote').innerHTML='Opening = today\u2019s volume \u2265 '+Math.round(FLOW_OPEN*100)+'% of standing OI (new positioning, not churn). Premium = mid \u00d7 volume \u00d7 100 (real dollars). <b>Honest limits:</b> Tradier REST gives total contract volume, not per-trade aggressor side \u2014 so this is <b>not</b> tick-level buy/sell or sweep detection, and puts may be hedges rather than bearish bets. What it captures cleanly: where fresh option dollars are opening today, which walls are being built vs. stale, and a directional lean that feeds the Ideas score.';
}

function openDeep(sym){
  const d=state.data[sym];if(!d)return;
  const M=metricLabel(state.metric);
  document.getElementById('mTitle').textContent=sym+' \u00b7 '+M+' Deep Analysis';
  const kg=kingOf(d.strikes),cw=callWallBand(d.strikes,d.spot),pw=putWallBand(d.strikes,d.spot),fl=flipFor(sym,d);
  const pr=ensureProfile(sym,d);
  const dp=d.spot>2000?0:1;
  const distK=kg?((kg.k-d.spot)/d.spot*100):null;
  const above=fl?d.spot>+fl.price:null;
  const net=pr?(state.metric==='vex'?pr.netV:pr.netG):null;
  const regTxt=state.metric==='gex'?(net>=0?'+GEX \u00b7 pinning':'\u2212GEX \u00b7 momentum')
    :(net>=0?'+VEX \u00b7 vol-drift bid':'\u2212VEX \u00b7 vol-chase');
  // confluence across metrics
  const gk=kingOf(d.strikes,'gex'),vk=kingOf(d.strikes,'vex');
  const ksArr=[gk,vk].filter(Boolean).map(x=>x.k);
  let confLine='';
  if(ksArr.length>=2){
    const spread=Math.max(...ksArr)-Math.min(...ksArr);
    const tol=d.spot*0.004;
    confLine=spread<=tol
      ?`<span style="color:var(--gold);font-weight:700">\u25c6 tight confluence \u2014 super-magnet zone</span>`
      :`<span style="color:var(--muted)">spread ${spread.toFixed(dp)} pts across metrics</span>`;
  }
  document.getElementById('mGex').innerHTML=`
    <div style="font-size:.85rem;line-height:1.9">
      Spot <b class="mono">$${(d.spot||0).toFixed(2)}</b>
      ${net!=null?`<span class="regime ${net>=0?'pos':'neg'}" style="margin-left:8px">${regTxt}</span>`:''}<br>
      ${M} King <b style="color:var(--gold)">${kg?kg.k:'\u2014'}</b>${distK!=null?` <span style="color:var(--muted)">(${distK>=0?'+':''}${distK.toFixed(2)}% away \u00b7 ${mdisp(mval(kg),d.spot)})</span>`:''}<br>
      Flip <b style="color:var(--cyan)">${fl?(+fl.price).toFixed(dp):'\u2014'}</b>${above!=null?` <span style="color:var(--muted)">spot ${above?'above':'below'}</span>`:''}<br>
      Range <b class="mono">${pw?pw.k:'\u2014'}</b> <span style="color:var(--muted)">put wall</span> \u2192 <b class="mono">${cw?cw.k:'\u2014'}</b> <span style="color:var(--muted)">call wall</span>
    </div>
    <div class="conf-box" style="margin-top:8px">
      <div style="display:flex;justify-content:space-between"><span>\u0393 Gamma King</span><b style="color:var(--gold)">${gk?gk.k:'\u2014'}</b></div>
      <div style="display:flex;justify-content:space-between"><span>Vanna King</span><b style="color:var(--cyan)">${vk?vk.k:'\u2014'}</b></div>
      <div style="text-align:center;margin-top:4px;font-size:.7rem">${confLine}</div>
    </div>`;
  const prof=document.getElementById('prof');
  prof.innerHTML=`<canvas id="pc" style="width:100%;height:130px"></canvas>`;
  const cvn=document.getElementById('pc');
  const dpr=Math.max(1,window.devicePixelRatio||1);
  cvn.width=400*dpr;cvn.height=130*dpr;
  const ctx=cvn.getContext('2d');ctx.scale(dpr,dpr);
  ctx.fillStyle='#0a0c12';ctx.fillRect(0,0,400,130);
  const key=metricKey(state.metric);
  const flipVal=state.metric==='vex'?pr&&pr.flipV:pr&&pr.flipG;
  if(pr&&pr.pts&&pr.pts.length){
    const mx=Math.max(...pr.pts.map(p=>Math.abs(p[key])),1);
    ctx.strokeStyle='#2a3140';ctx.beginPath();ctx.moveTo(0,65);ctx.lineTo(400,65);ctx.stroke();
    const lo=pr.pts[0].s,hi=pr.pts[pr.pts.length-1].s,xOf=s=>((s-lo)/(hi-lo)*390+5);
    ctx.beginPath();
    pr.pts.forEach((p,i)=>{const x=xOf(p.s),y=65-(p[key]/mx)*55;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
    ctx.strokeStyle=state.metric==='vex'?'#22d3ee':'#00e5ff';ctx.lineWidth=1.6;ctx.stroke();ctx.lineWidth=1;
    ctx.setLineDash([3,3]);
    ctx.strokeStyle='#e8ecf4';ctx.beginPath();ctx.moveTo(xOf(d.spot),0);ctx.lineTo(xOf(d.spot),130);ctx.stroke();
    if(flipVal){ctx.strokeStyle='#f2c14e';ctx.beginPath();ctx.moveTo(xOf(flipVal),0);ctx.lineTo(xOf(flipVal),130);ctx.stroke();}
    ctx.setLineDash([]);
  }
  const idea=(state.ideas||{})[sym];
  document.getElementById('mRecs').innerHTML=idea
    ?`<div class="rec" style="border-left-color:${idea.bias==='LONG'?'var(--green)':'var(--red)'}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <b>${idea.bias} \u00b7 score ${idea.score}</b>
          ${idea.flow?`<span style="font-size:.66rem;color:${idea.flow==='confirms'?'var(--green)':'var(--red)'}">flow ${idea.flow}</span>`:''}
        </div>
        <div class="mono" style="font-size:.82rem">${idea.line}</div>
        ${idea.target||idea.invalid?`<div style="font-size:.72rem;color:var(--muted);margin-top:3px">${idea.target?`target <b style="color:var(--gold)">${idea.target}</b>`:''}${idea.invalid?` \u00b7 invalid ${idea.bias==='LONG'?'below':'above'} <b style="color:var(--cyan)">${idea.invalid}</b>`:''}</div>`:''}
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px">${(idea.drivers||[]).map(x=>`<span class="drv">${x}</span>`).join('')}</div>
      </div>`
    :`<div class="rec"><div style="font-size:.78rem;color:var(--muted);line-height:1.55">No edge right now \u2014 GEX structure and the daily trend don\u2019t agree. Ideas always score off gamma + trend + flow; the metric toggle only changes the map you\u2019re reading.</div></div>`;
  const top=[...(d.strikes||[])].sort((a,b)=>Math.abs(mval(b))-Math.abs(mval(a))).slice(0,5);
  const mxA=top.length?Math.abs(mval(top[0])):1;
  document.getElementById('mNodes').innerHTML=top.map((n,i)=>{
    const v=mval(n);const r=Math.abs(v)/mxA;
    return `<div style="display:flex;align-items:center;gap:8px;font-size:.76rem;padding:4px 0;border-bottom:1px solid #1a1f2b">
      <span class="mono" style="width:52px;font-weight:700;${i===0?(v>=0?'color:var(--gold)':'color:#e879f9'):''}">${n.k}${i===0?' \u2605':''}</span>
      <span class="mono" style="width:78px;color:${v>=0?'var(--teal)':'#e879f9'}">${mdisp(v,d.spot)}</span>
      <span style="flex:1;height:4px;border-radius:2px;background:#161a24;overflow:hidden"><span style="display:block;height:100%;width:${Math.round(r*100)}%;background:${i===0?(v>=0?'var(--gold)':'#c026ff'):v>=0?'var(--teal)':'var(--barney)'}"></span></span>
    </div>`;
  }).join('');
  document.getElementById('modal').classList.add('open');
}

/* WARM PAINT: on a cold load, pull the last server field snapshot for each
   visible symbol and draw a provisional ladder in well under a second, so the
   screen is never blank while multi-MB chains stream in. Real data replaces it
   the moment it lands (state.data wins over state.warmData in renderTrinity). */
async function warmPaint(){
  if(!(window.KairosBackend&&window.KairosBackend.enabled))return;
  state.warmData=state.warmData||{};
  const list=(state.view==='single'?[state.focus]:state.trinityTickers).slice(0,6);
  await Promise.all(list.map(async sym=>{
    if(state.data[sym]||state.warmData[sym])return;
    try{
      const cols=await window.KairosBackend.fieldColumns(sym);
      if(!cols||!cols.length)return;
      const col=cols[cols.length-1];
      if(state.data[sym]||!col.nodes||!col.nodes.length)return;
      state.warmData[sym]={sym,spot:col.spot,strikes:col.nodes.map(n=>({k:n.k,gex:n.g})),warm:true,t:col.t*1000};
      if(state.view==='trinity'||state.view==='single')renderTrinity();
    }catch(e){}
  }));
}
setTimeout(warmPaint,0);
async function refresh(force){
  if(state.refreshing){state.pendingRefresh=true;if(force)state.pendingForce=true;return;} // queue it — never drop a tab-hop refresh
  state.refreshing=true;
  const spin=document.getElementById('spin');const btn=document.getElementById('btnRefresh');
  spin.classList.remove('hidden');btn.disabled=true;
  try{
    const ticks=(state.view==='single'||state.view==='chart'||state.view==='imb'||state.view==='tape')
      ?[state.focus]
      :[...new Set([...state.trinityTickers.slice(0,3),state.focus])];
    if(liveOn()){
      try{const qs=await fetchQuotes(ticks);ticks.forEach(s=>{const u=underOf(s);if(qs[u])state.spot[s]=qs[u];});}catch(e){console.warn('quotes',e.message);}
    }
    const results={};
    /* Fetch the panels CONCURRENTLY. This used to be a sequential await-loop, so
       a heavy index chain (SPXW) blocked SPY/QQQ behind it and the first panel
       always lagged. Total time is now max(one chain), not the sum. */
    await Promise.all(ticks.map(async s=>{
      const deep=(state.view==='single'&&s===state.focus)?9:undefined;
      const old=state.data[s];
      let r=null;
      try{r=await getSym(s,deep,force);}catch(e){console.warn('getSym',s,e&&e.message);}
      if(r){
        if(old&&old.strikes){const m={};old.strikes.forEach(x=>{m[x.k]=x.gex;});state.prevG[s]=m;}
        state.data[s]=r;state.dataAge[s]=Date.now();results[s]=r;
      }
    }));
    state.firstLoadFailed=Object.keys(results).length===0&&Object.keys(state.data).length===0;
    recordSnapshots();
    // Backend: hydrate server-accumulated history once per symbol (regime + IV),
    // so the Regime chart and IV Rank are pre-filled from data collected 24/5.
    if(backendOn()){
      state._hydrated=state._hydrated||{};
      Object.keys(results).forEach(s=>{
        if(state._hydrated[s])return;state._hydrated[s]=1;
        window.KairosBackend.hydrateRegime(s);
        window.KairosBackend.hydrateIV(s);
      });
    }
    // v2: refresh vol term structure (cached) + resolve journal against latest spot
    if(window.KairosQuant){
      window.KairosQuant.vixTerm().then(vt=>{if(vt)state._vixTerm=vt;}).catch(()=>{});
      try{Object.keys(results).forEach(s=>{const sp=results[s].spot;if(sp)window.KairosQuant.qjResolve(s,sp);});}catch(e){}
    }
    const sources=Object.values(results).map(d=>d.source);
    const phase=marketPhase();
    const phaseLabel={pre:'PRE-MARKET',post:'AFTER HOURS',overnight:'OVERNIGHT',closed:'CLOSED'}[phase];
    let b='';
    if(sources.some(s=>s==='tradier-live')){
      b=phase==='rth'?`<span class="live">● LIVE</span>`:`<span class="live" style="color:var(--gold)">● ${phaseLabel}</span>`;
    }
    else if(sources.some(s=>s==='tradier-sandbox'))b=`● TRADIER SANDBOX — delayed data`;
    else if(sources.some(s=>s==='cboe'))b=`● CBOE DELAYED (~15 min)${state.tradierToken?'':' — add a free Tradier token in Settings for live data'}`;
    else b=`● NO DATA — all sources failed (token? network?)`;
    const si=sessionInfo();
    if(sources.some(s=>s==='tradier-live'))b+=` <span style="color:var(--muted)">\u00b7 Session <b style="color:var(--text)">${si.sess}</b> \u00b7 OI as-of <b style="color:var(--text)">${si.oi}</b>${phase!=='rth'?' \u00b7 <b style="color:var(--gold)">extended-hours pricing</b>':''}</span>`;
    const vt=state._vixTerm;
    if(vt&&vt.vix){const bk=vt.state==='backwardation';
      b+=` <span style="color:var(--muted)">\u00b7</span> <span class="mono" data-tip="CBOE vol term structure, refreshed ~2 min. Contango (VIX below VIX3M) = calm regime; backwardation = near-term stress bid over the back months. 9D vs 3M shows where the pressure sits on the curve.">VIX <b style="color:${bk?'var(--red)':'var(--text)'}">${vt.vix.toFixed(1)}</b>${vt.vix9d?` <i style="color:var(--muted);font-style:normal">9D ${vt.vix9d.toFixed(1)}</i>`:''}${vt.vix3m?` <i style="color:var(--muted);font-style:normal">3M ${vt.vix3m.toFixed(1)}</i>`:''} <b style="font-size:.6rem;color:${bk?'var(--red)':'var(--green)'}">${bk?'BACKWARDATION':'CONTANGO'}</b></span>`;}
    document.getElementById('bannerText').innerHTML=b;
    const se=document.getElementById('sessInfo');if(se)se.innerHTML='';
    const lu=document.getElementById('lastUp');if(lu)lu.textContent='';
    if(state.view==='single')state.singleLoading=false;
    if(state.view==='trinity'||state.view==='single')renderTrinity();
    if(state.view==='ideas')renderCards();
    if(state.view==='chart')updateChart(state.focus);
    if(state.view==='imb')renderImb(state.focus);
    if(state.view==='tape')renderTape(state.focus);
    if(['single','chart','imb','tape'].includes(state.view))renderPresets();
  }finally{
    spin.classList.add('hidden');btn.disabled=false;state.refreshing=false;
    if(state.pendingRefresh){
      state.pendingRefresh=false;const f=!!state.pendingForce;state.pendingForce=false;
      setTimeout(()=>refresh(f),60);
    }
  }
}

document.getElementById('closeM').onclick=()=>document.getElementById('modal').classList.remove('open');
document.getElementById('modal').onclick=e=>{if(e.target.id==='modal')e.target.classList.remove('open');};
document.getElementById('btnHelp').onclick=()=>document.getElementById('helpModal').classList.add('open');
document.getElementById('closeHelp').onclick=()=>document.getElementById('helpModal').classList.remove('open');
document.getElementById('helpModal').onclick=e=>{if(e.target.id==='helpModal')e.target.classList.remove('open');};
document.getElementById('btnSettings').onclick=()=>{
  document.getElementById('tok').value=state.tradierToken;
  document.getElementById('poll').value=state.pollSec;
  document.getElementById('sizeBasis').value=state.sizeBasis;
  document.getElementById('settings').classList.toggle('open');
};
document.getElementById('save').onclick=()=>{
  state.tradierToken=document.getElementById('tok').value.trim();
  state.pollSec=Math.max(10,parseInt(document.getElementById('poll').value)||10);
  state.sizeBasis=document.getElementById('sizeBasis').value;
  localStorage.setItem('kairos_basis',state.sizeBasis);
  localStorage.setItem('kairos_tok',state.tradierToken);
  localStorage.setItem('kairos_poll',String(state.pollSec));
  document.getElementById('settings').classList.remove('open');
  refresh(true);
};
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    document.querySelectorAll('.modal-bg.open').forEach(m=>m.classList.remove('open'));
    document.getElementById('settings').classList.remove('open');
    closeCombo();
  }
});
document.addEventListener('click',e=>{
  const s=document.getElementById('settings');
  if(!s.classList.contains('open'))return;
  if(s.contains(e.target)||e.target.closest('#btnSettings'))return;
  s.classList.remove('open');
});
document.getElementById('btnRefresh').onclick=()=>refresh(true);
document.getElementById('expiryFilter').onchange=e=>{state.expiry=e.target.value;refresh(false);};

/* ---- metric toggle ---- */
function setMetric(m){
  if(state.metric===m)return;
  state.metric=m;localStorage.setItem('kairos_metric',m);
  document.querySelectorAll('#mtoggle button').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  if(state.view==='trinity'||state.view==='single')renderTrinity();
  else if(state.view==='chart')updateChart(state.focus);
  if(document.getElementById('modal').classList.contains('open'))openDeep(state.focus);
}
document.querySelectorAll('#mtoggle button').forEach(b=>{b.dataset.m=b.textContent.toLowerCase();b.onclick=()=>setMetric(b.dataset.m);});
document.querySelectorAll('#mtoggle button').forEach(b=>b.classList.toggle('on',b.dataset.m===state.metric));

/* ---- center toggle (spot vs king) ---- */
function setCenter(c){
  if(state.centerOn===c)return;
  state.centerOn=c;localStorage.setItem('kairos_center',c);
  document.querySelectorAll('#centertoggle button').forEach(b=>b.classList.toggle('on',b.dataset.c===c));
  state.scrolled={}; // force a fresh re-center on next render
  if(state.view==='trinity'||state.view==='single')renderTrinity();
}
document.querySelectorAll('#centertoggle button').forEach(b=>b.onclick=()=>setCenter(b.dataset.c));
document.querySelectorAll('#centertoggle button').forEach(b=>b.classList.toggle('on',b.dataset.c===state.centerOn));

/* ---- preset ticker chips (single-focus views) ---- */
function nxBand(sym,spot){
  if(sym==='SPXW'||sym==='SPX')return 320;
  return Math.max(45,Math.min(spot*0.09,600));
}
const PRESETS=['SPXW','SPY','QQQ','IWM','NVDA','TSLA','AAPL','MSFT','META','AMZN','GOOGL'];
function renderPresets(){
  const bar=document.getElementById('presetBar');
  bar.innerHTML=PRESETS.map(t=>`<button class="pchip${t===state.focus?' on':''}" data-t="${t}">${t}</button>`).join('');
}
async function pickPreset(t){
  t=cleanSym(t);if(!t||t===state.focus)return;
  state.focus=t;
  if(window.__kairosArenaFocus)window.__kairosArenaFocus(t);
  if(state.view==='single')state.singleLoading=true;
  ['chartTicker','imbTicker','tapeTicker'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=t;});
  if(state.view==='chart')tvLoaded='';
  renderPresets();
  await refresh(false);
  if(state.view==='chart'){loadTV(t);updateChart(t);}
  else if(state.view==='imb')renderImb(t);
  else if(state.view==='tape')renderTape(t);
}
document.getElementById('presetBar').addEventListener('click',e=>{const c=e.target.closest('.pchip');if(c)pickPreset(c.dataset.t);});

function setView(v){
  state.view=v;
  ['btnTrinity','btnSingle','btnChart','btnIdeas','btnImb','btnTape'].forEach(id=>document.getElementById(id).classList.remove('active'));
  const bmap={trinity:'btnTrinity',single:'btnSingle',chart:'btnChart',ideas:'btnIdeas',imb:'btnImb',tape:'btnTape'};
  document.getElementById(bmap[v]).classList.add('active');
  document.getElementById('trinityWrap').classList.toggle('hidden',v!=='trinity'&&v!=='single');
  document.getElementById('chartSec').classList.toggle('hidden',v!=='chart');
  document.getElementById('ideasSec').classList.toggle('hidden',v!=='ideas');
  document.getElementById('imbSec').classList.toggle('hidden',v!=='imb');
  document.getElementById('tapeSec').classList.toggle('hidden',v!=='tape');
  document.getElementById('mtoggle').classList.toggle('dim',v==='ideas'||v==='imb'||v==='tape');
  const showPresets=['single','chart','imb','tape'].includes(v);
  document.getElementById('presetBar').classList.toggle('hidden',!showPresets);
  document.getElementById('centertoggle').classList.toggle('dim',!(v==='trinity'||v==='single'));
  if(showPresets)renderPresets();
  if(v==='single'){
    const m=state.multi[state.focus];
    state.singleLoading=!(m&&m.dates&&m.dates.length>=8);
  }
  if(v==='trinity'||v==='single')renderTrinity();
  if(v==='trinity'){
    // coming back to Triad: the poll only fed the focused ticker while you were away — refetch stale panels now
    const stale=state.trinityTickers.some(s=>!state.dataAge[s]||Date.now()-state.dataAge[s]>state.pollSec*1500);
    if(stale)refresh(false);
  }
  if(v==='single'&&state.singleLoading)refresh(false);
  if(v==='ideas'){renderCards();ideasSweep(false);}
  if(v==='chart'){loadTV(state.focus);updateChart(state.focus);if(!state.data[state.focus])refresh(false);}
  if(v==='imb'){renderImb(state.focus);if(!state.chains[state.focus]||Date.now()-(state.chains[state.focus].t||0)>CHAIN_TTL)refresh(false);}
  if(v==='tape'){renderTape(state.focus);if(!state.chains[state.focus]||Date.now()-(state.chains[state.focus].t||0)>CHAIN_TTL)refresh(false);}
}
document.getElementById('btnTrinity').onclick=()=>setView('trinity');
document.getElementById('btnSingle').onclick=()=>setView('single');
document.getElementById('btnChart').onclick=()=>setView('chart');
document.getElementById('btnIdeas').onclick=()=>setView('ideas');
document.getElementById('btnImb').onclick=()=>setView('imb');
document.getElementById('btnTape').onclick=()=>setView('tape');

const chartSel=document.getElementById('chartTicker');
if(chartSel)chartSel.onchange=async()=>{
  const v=cleanSym(chartSel.value);
  if(!v){chartSel.value=state.focus;return;}
  chartSel.value=v;state.focus=v;tvLoaded='';
  if(!state.data[v]){
    document.getElementById('spin').classList.remove('hidden');
    try{const r=await getSym(v);if(r){state.data[v]=r;state.dataAge[v]=Date.now();}}catch(e){}
    document.getElementById('spin').classList.add('hidden');
  }
  updateChart(v);
};
document.getElementById('imbTicker').onchange=async()=>{
  const el=document.getElementById('imbTicker');
  const v=cleanSym(el.value);if(!v){el.value=state.focus;return;}
  el.value=v;state.focus=v;
  if(!state.chains[v]){
    document.getElementById('spin').classList.remove('hidden');
    try{const r=await getSym(v);if(r){state.data[v]=r;state.dataAge[v]=Date.now();}}catch(e){}
    document.getElementById('spin').classList.add('hidden');
  }
  renderImb(v);
};
document.getElementById('tapeTicker').onchange=async()=>{
  const el=document.getElementById('tapeTicker');
  const v=cleanSym(el.value);if(!v){el.value=state.focus;return;}
  el.value=v;state.focus=v;
  if(!state.chains[v]){
    document.getElementById('spin').classList.remove('hidden');
    try{const r=await getSym(v);if(r){state.data[v]=r;state.dataAge[v]=Date.now();}}catch(e){}
    document.getElementById('spin').classList.add('hidden');
  }
  renderTape(v);
};

/* ---- custom ticker combobox ---- */
const comboPop=document.createElement('div');comboPop.className='combo-pop';comboPop.style.display='none';document.body.appendChild(comboPop);
let comboFor=null, comboIdx=-1;
function comboItems(input){
  const filt=cleanSym(input.value);
  const arr=filt?TICKS.filter(t=>t.includes(filt)):TICKS.slice();
  return arr.length?arr:TICKS.slice();
}
function openCombo(input){
  comboFor=input;comboIdx=-1;
  const items=comboItems(input);
  comboPop.innerHTML=items.map((t,i)=>`<div class="combo-item" data-v="${t}">${t}</div>`).join('')+'<div class="combo-hint">type any symbol · Enter</div>';
  const r=input.getBoundingClientRect();
  comboPop.style.left=Math.round(r.left)+'px';
  comboPop.style.top=Math.round(r.bottom+3)+'px';
  comboPop.style.minWidth=Math.max(r.width,120)+'px';
  comboPop.style.display='block';
}
function closeCombo(){comboPop.style.display='none';comboFor=null;comboIdx=-1;}
function pickCombo(v){
  if(!comboFor)return;
  const inp=comboFor;inp.value=v;closeCombo();
  inp.dispatchEvent(new Event('change',{bubbles:true}));
}
document.addEventListener('focusin',e=>{if(e.target.classList&&e.target.classList.contains('ticker-sel'))openCombo(e.target);});
document.addEventListener('input',e=>{if(e.target.classList&&e.target.classList.contains('ticker-sel')&&comboFor===e.target)openCombo(e.target);});
document.addEventListener('keydown',e=>{
  if(!comboFor||comboPop.style.display==='none')return;
  const items=[...comboPop.querySelectorAll('.combo-item')];
  if(e.key==='ArrowDown'){e.preventDefault();comboIdx=Math.min(items.length-1,comboIdx+1);}
  else if(e.key==='ArrowUp'){e.preventDefault();comboIdx=Math.max(0,comboIdx-1);}
  else if(e.key==='Enter'){
    e.preventDefault();
    if(comboIdx>=0&&items[comboIdx])pickCombo(items[comboIdx].dataset.v);
    else{const inp=comboFor;closeCombo();inp.dispatchEvent(new Event('change',{bubbles:true}));inp.blur();}
    return;
  }else return;
  items.forEach((it,i)=>it.classList.toggle('on',i===comboIdx));
  if(items[comboIdx])items[comboIdx].scrollIntoView({block:'nearest'});
});
comboPop.addEventListener('mousedown',e=>{
  const it=e.target.closest('.combo-item');if(!it)return;
  e.preventDefault();pickCombo(it.dataset.v);
});
document.addEventListener('mousedown',e=>{
  if(comboFor&&e.target!==comboFor&&!comboPop.contains(e.target))closeCombo();
});
window.addEventListener('scroll',()=>{if(comboFor)openCombo(comboFor);},true);

function copyText(t){
  if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(t).catch(()=>copyFallback(t));
  return copyFallback(t);
}
function copyFallback(t){
  return new Promise(res=>{
    const ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0';
    document.body.appendChild(ta);ta.select();
    try{document.execCommand('copy');}catch(e){}
    ta.remove();res();
  });
}
(function(){const _bp=document.getElementById('btnPine');if(!_bp)return;_bp.onclick=()=>{
  const d=state.data[state.focus];if(!d||!d.strikes||!d.strikes.length)return;
  const M=metricLabel(state.metric).toUpperCase();
  const nodes=[...d.strikes].sort((a,b)=>Math.abs(mval(b))-Math.abs(mval(a))).slice(0,9);
  const max=Math.abs(mval(nodes[0]))||1;
  let p='//@version=5\nindicator("Kairos '+M+' \u2014 '+state.focus+' '+new Date().toLocaleString().replace(/"/g,'')+'", overlay=true)\n';
  nodes.forEach((n,i)=>{
    const v=mval(n);const r=Math.abs(v)/max;
    const w=r>=0.72?4:r>=0.42?3:r>=0.18?2:1;
    const col=i===0?(v>=0?'color.yellow':'color.fuchsia'):(v>=0?'color.new(color.teal,'+Math.round(60-55*r)+')':'color.new(color.purple,'+Math.round(60-55*r)+')');
    p+='hline('+n.k+', title="'+(i===0?'KING ':i<3?'G'+i+' ':'')+mdisp(v,d.spot)+'", color='+col+', linewidth='+w+')\n';
  });
  const fl=flipFor(state.focus,d);
  if(fl)p+='hline('+(+fl.price).toFixed(2)+', title="FLIP", color=color.aqua, linestyle=hline.style_dashed, linewidth=2)\n';
  copyText(p).then(()=>{
    const b=document.getElementById('btnPine');const t=b.textContent;b.textContent='Copied \u2713';
    setTimeout(()=>b.textContent=t,1600);
  });
};
})();

document.addEventListener('visibilitychange',()=>{
  if(document.hidden){clearTimeout(state._t);persistHistory(true);}
  else{refresh(false).finally(schedule);}
});
window.addEventListener('beforeunload',()=>persistHistory(true));

/* startup banner: decide on a 0ms timer so kairos-backend.js (loaded AFTER
   core) has registered — this used to race it and flash "Delayed CBOE mode"
   even when the live backend was connected. */
setTimeout(function(){
  if(state.tradierToken)return;
  var bt=document.getElementById('bannerText');if(!bt)return;
  if(window.KairosBackend&&window.KairosBackend.enabled)bt.innerHTML='<span class="live">\u25cf</span> connecting \u2014 live via Kairos backend\u2026';
  else bt.innerHTML='Delayed CBOE mode \u2014 add a free Tradier token in <b>Settings</b> for live data';
},0);

renderTrinity();renderCards();
refresh(false).finally(schedule);
function schedule(){clearTimeout(state._t);if(document.hidden)return;state._t=setTimeout(async()=>{await refresh(false);schedule();},state.pollSec*1000);}
window.Kairos={state,refresh,getSym,kingOf,buildFromChains,buildImbalance,flowLean,exposureProfile};
console.log('%cKairos v11.0 \u2014 instant warm-paint from server cache, Regime crosshair inspection, pinch zoom, engine status, subtle NFA.','color:#f2c14e;font-weight:bold');
