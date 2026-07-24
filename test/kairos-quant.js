/* =====================================================================
   KAIROS QUANT  (v2 engine)  —  the sharpened iron

   Everything here amplifies the existing GEX/VEX foundation with the pieces
   the pro desks (SpotGamma, MenthorQ) actually run, all computed client-side
   from the Tradier chain we already fetch — no new paid feed, no server.

   Adds:
     • CHARM (CEX)        — 3rd dealer greek: dΔ/dt. Drives midday drift + EOD pins.
     • Volatility Trigger — where dealer gamma flips long→short (SpotGamma key level).
     • net DEX            — directional dealer delta exposure.
     • Vol regime         — VIX term structure (free CBOE quotes) + IV Rank + skew.
     • Flow classification — quote-rule buy/sell split so "net premium" is
                              bought-vs-sold, not just call-vs-put.
   Design: pure functions, tested in isolation. State is read from `state`,
   the same global the rest of Kairos shares. Nothing here is a signal.
   ===================================================================== */
'use strict';

/* -------- Black-Scholes charm (r=q=0) --------
   Charm = ∂Δ/∂τ (delta decay per year). For a CALL:
     charm_call = φ(d1) · d2 / (2τ)              [with r=q=0, dividing by -T sign handled by caller]
   We return the per-contract charm magnitude; dealer sign is applied by the
   aggregator exactly like gamma/vanna (calls +, puts − under the standard
   dealer-short-calls / long-puts convention Kairos already uses). Charm is
   naturally tiny per-share, so downstream scaling matches GEX (×OI×spot²×0.01
   isn't right for charm; charm scales ×OI×spot, since it's a delta/time). */
function bsCharm(S,K,iv,T){
  if(T<=0||iv<=0||S<=0||K<=0)return 0;
  const st=iv*Math.sqrt(T);
  const d1=(Math.log(S/K)+0.5*iv*iv*T)/st;
  const d2=d1-st;
  const phi=Math.exp(-0.5*d1*d1)/Math.sqrt(2*Math.PI);
  // r=q=0 simplification of charm: -φ(d1)·d2 / (2τ)
  return -phi*d2/(2*T);
}

/* charm exposure across a chain, aggregated by strike, dealer-signed.
   Mirrors the GEX pipeline: call charm +, put charm −, weighted by OI. */
function chainCharm(contracts,spot){
  const by={};
  for(const c of contracts){
    if(!c.iv||c.iv<=0||!c.oi)continue;
    const raw=bsCharm(spot,c.k,c.iv,c.T);
    const signed=(c.call?1:-1)*raw*c.oi*spot; // ×OI×spot => delta-shares/year
    by[c.k]=(by[c.k]||0)+signed;
  }
  return Object.keys(by).map(k=>({k:+k,cex:by[k]})).sort((a,b)=>a.k-b.k);
}

/* -------- net dealer DEX (directional delta exposure) --------
   Σ dealerSign · delta · OI · 100 · spot. Positive = dealers net long delta. */
function chainDEX(contracts,spot){
  let dex=0;
  for(const c of contracts){
    if(!c.dl||!c.oi)continue;
    const dealer=(c.call?-1:1);           // dealer short calls, long puts (standard)
    dex+=dealer*Math.abs(c.dl)*(c.call?1:-1)*c.oi*100*spot;
  }
  return dex;
}

/* -------- Volatility Trigger + Zero-Gamma from a gamma profile --------
   Given a per-spot net-gamma curve [{s, g}], zero-gamma is where g crosses 0.
   The volatility trigger is the *highest* spot at or below current price where
   net gamma is still solidly positive before it rolls negative — i.e. the last
   line of dealer long-gamma support beneath spot. We approximate it as the
   zero-cross nearest to (and at/below) spot. */
function gammaLevels(curve,spot){
  if(!curve||curve.length<3)return {zero:null,trigger:null};
  let zero=null;
  for(let i=1;i<curve.length;i++){
    const a=curve[i-1],b=curve[i];
    if((a.g<=0&&b.g>=0)||(a.g>=0&&b.g<=0)){
      const t=Math.abs(a.g)/(Math.abs(a.g)+Math.abs(b.g)||1);
      const cross=a.s+(b.s-a.s)*t;
      if(zero===null||Math.abs(cross-spot)<Math.abs(zero-spot))zero=cross;
    }
  }
  // trigger: nearest zero-cross at/below spot (dealer support floor)
  let trigger=null;
  for(let i=1;i<curve.length;i++){
    const a=curve[i-1],b=curve[i];
    if((a.g<=0&&b.g>=0)||(a.g>=0&&b.g<=0)){
      const t=Math.abs(a.g)/(Math.abs(a.g)+Math.abs(b.g)||1);
      const cross=a.s+(b.s-a.s)*t;
      if(cross<=spot*1.001&&(trigger===null||cross>trigger))trigger=cross;
    }
  }
  return {zero,trigger};
}

/* -------- flow classification: quote-rule buy/sell split --------
   True tick-level Lee-Ready needs per-print timesales (one call per contract).
   Instead we apply the QUOTE RULE at the aggregate level, which the literature
   shows carries ~75-80% of the signal: split each contract's day volume by
   where its current mid sits within its own bid/ask spread. If the mid has been
   pushed toward the ASK, buyers are lifting offers (aggressive buying); toward
   the BID, sellers are hitting bids. We use the traded price proxy (mid vs the
   bid/ask midpoint) to estimate the buy fraction, bounded to [0.15,0.85] so a
   single stale quote can't claim 100% certainty.
   Returns per-contract {buyFrac} and rolls up bought/sold premium. */
function classifyFlow(contracts){
  const out=[];
  let callBought=0,callSold=0,putBought=0,putSold=0;
  for(const c of contracts){
    if(!c.vol)continue;
    const bid=c.bid||0,ask=c.ask||0,mid=c.mid||((bid+ask)/2);
    let buyFrac=0.5;
    if(ask>bid&&bid>0){
      // where does traded value sit in the spread? (0=bid,1=ask)
      const pos=(mid-bid)/(ask-bid);
      buyFrac=Math.max(0.15,Math.min(0.85,pos));
    }
    const prem=mid*c.vol*100;
    const b=prem*buyFrac,s=prem*(1-buyFrac);
    if(c.call){callBought+=b;callSold+=s;}else{putBought+=b;putSold+=s;}
    out.push({k:c.k,call:c.call,e:c.e,buyFrac,prem});
  }
  const netBought=(callBought+putBought)-(callSold+putSold);
  return {callBought,callSold,putBought,putSold,netBought,perc:out};
}

/* -------- IV Rank / Percentile from a local IV history --------
   We keep a rolling per-symbol ATM-IV series in localStorage (one sample/day,
   ~1 year cap). IV Rank = where today's IV sits in that range [0..100].
   This matures over ~3 months; until then it's flagged "building". */
const QIV_KEY='kairos_ivhist_v1';
const QIV_CAP=260;              // ~1 trading year
function qivLoad(){try{return JSON.parse(localStorage.getItem(QIV_KEY)||'{}');}catch(e){return {};}}
function qivSave(o){try{localStorage.setItem(QIV_KEY,JSON.stringify(o));}catch(e){}}
function qivRecord(sym,iv){
  if(!iv||iv<=0)return;
  const o=qivLoad();const arr=o[sym]=o[sym]||[];
  const today=new Date().toISOString().slice(0,10);
  const last=arr[arr.length-1];
  if(last&&last.d===today){last.iv=iv;}       // update today's sample
  else arr.push({d:today,iv});
  while(arr.length>QIV_CAP)arr.shift();
  qivSave(o);
}
function qivRank(sym,iv){
  const o=qivLoad();const arr=(o[sym]||[]).map(x=>x.iv).filter(x=>x>0);
  if(arr.length<10||!iv)return {rank:null,pctile:null,n:arr.length,lo:null,hi:null};
  const lo=Math.min(...arr),hi=Math.max(...arr);
  const rank=hi>lo?(iv-lo)/(hi-lo)*100:50;
  const below=arr.filter(x=>x<iv).length;
  const pctile=below/arr.length*100;
  return {rank:Math.max(0,Math.min(100,rank)),pctile,n:arr.length,lo,hi};
}

/* -------- 25-delta skew from the nearest expiry --------
   skew = IV(25Δ put) − IV(25Δ call). Positive = puts bid over calls (crash
   hedging demand / downside fear). A risk-reversal proxy. */
function skew25(contracts,spot,dp){
  // nearest expiry only
  if(!contracts||!contracts.length)return null;
  let near=Infinity;contracts.forEach(c=>{if(c.T<near)near=c.T;});
  const exp=contracts.filter(c=>Math.abs(c.T-near)<1e-6&&c.iv>0);
  const findByDelta=(call,target)=>{
    let best=null,bd=1e9;
    exp.forEach(c=>{if(c.call!==call)return;const d=Math.abs(Math.abs(c.dl)-target);if(d<bd){bd=d;best=c;}});
    return best;
  };
  const p25=findByDelta(false,0.25),c25=findByDelta(true,0.25);
  if(!p25||!c25)return null;
  return {skew:(p25.iv-c25.iv)*100,putIv:p25.iv*100,callIv:c25.iv*100,pk:p25.k,ck:c25.k};
}

/* -------- VIX term structure (free CBOE indices via Tradier quotes) --------
   VIX9D / VIX / VIX3M / VIX6M. Ratio VIX/VIX3M > 1 = backwardation (stress).
   Cached ~2 min. Falls back to null gracefully with no token. */
let qvixCache={t:0,data:null};
async function vixTerm(){
  if(qvixCache.data&&Date.now()-qvixCache.t<120000)return qvixCache.data;
  if(!(state.tradierToken&&state.tradierToken.length>8))return null;
  try{
    const j=await tFetch('/markets/quotes?symbols=VIX9D,VIX,VIX3M,VIX6M');
    const q=j.quotes&&j.quotes.quote;const arr=Array.isArray(q)?q:(q?[q]:[]);
    const m={};arr.forEach(x=>{m[x.symbol]=+x.last||+x.close||null;});
    const vix=m.VIX,v3=m.VIX3M;
    const data={vix9d:m.VIX9D,vix,vix3m:v3,vix6m:m.VIX6M,
      ratio:(vix&&v3)?vix/v3:null,
      state:(vix&&v3)?(vix>v3?'backwardation':'contango'):null};
    qvixCache={t:Date.now(),data};
    return data;
  }catch(e){return null;}
}

/* -------- volatility risk premium: IV vs realized --------
   VRP = ATM IV − HV20. Positive (normal) = options richer than realised;
   negative = options cheap vs actual movement (rare, often pre-move). */
function volPremium(atmIv,hv20){
  if(!atmIv||!hv20)return null;
  return {vrp:(atmIv-hv20)*100,ratio:hv20>0?atmIv/hv20:null};
}

window.KairosQuant={
  bsCharm,chainCharm,chainDEX,gammaLevels,classifyFlow,
  qivRecord,qivRank,skew25,vixTerm,volPremium,
  QIV_KEY
};

/* =====================================================================
   AETHER v2 — transparent multi-factor expectancy model

   The old score was a bag of ad-hoc +8/-12 nudges. v2 makes every factor an
   explicit, weighted, *labelled* contribution so the number is auditable and
   the desk-note writes itself from the same factors. Factors, each in [-1,1],
   times a weight, summed and squashed to 0-100:

     REGIME    (0.22) gamma sign & flip alignment — the dominant edge
     POSITION  (0.20) proximity/concentration of the magnet vs spot
     FLOW      (0.20) CLASSIFIED bought/sold lean agreeing with the thesis
     TREND     (0.16) daily MA structure + intraday tape agreement
     VOL       (0.12) IV rank + term-structure regime fit
     SKEW      (0.10) 25Δ skew tailwind/headwind for the direction

   Returns {score, factors:[{key,label,contrib,weight,detail}], edge}. */
function aetherScore(ctx){
  // ctx: {bias(+1/-1), gexPos(bool), flipAlign(-1..1), concFrac, emCoverage(0..1),
  //       flowLean(-1..1), trendAgree(-1..1), intradayAgree(-1..1),
  //       ivRank(0..100|null), vixBackwardation(bool|null), skewTailwind(-1..1|null), rsiExtreme(-1..1)}
  const F=[];
  const push=(key,label,val,weight,detail)=>{val=Math.max(-1,Math.min(1,val));F.push({key,label,contrib:val*weight,val,weight,detail});};

  // REGIME: in +GEX, being on the right side of the flip is the edge; in -GEX,
  // momentum alignment is the edge. flipAlign already encodes side vs flip.
  push('regime', ctx.gexPos?'+GEX mean-revert':'\u2212GEX momentum',
       ctx.flipAlign, 0.22,
       ctx.gexPos?(ctx.flipAlign>0?'on the right side of the gamma flip':'fighting the flip'):
                  (ctx.flipAlign>0?'aligned with the momentum regime':'against the tape'));

  // POSITION: concentration + how much of the move to the magnet the EM covers
  const posScore=Math.min(1,ctx.concFrac*3)*0.6+(ctx.emCoverage||0)*0.4;
  push('position','magnet pull',posScore,0.20,
       Math.round(ctx.concFrac*100)+'% of book at the King'+(ctx.emCoverage?', EM covers '+(ctx.emCoverage*100).toFixed(0)+'% of the path':''));

  // FLOW: classified bought/sold lean, signed to the thesis
  push('flow','classified flow',ctx.flowLean||0,0.20,
       ctx.flowLean==null?'no clean flow read':
       (Math.abs(ctx.flowLean)<0.1?'flow is balanced':
       (ctx.flowLean>0?'net premium bought with you':'net premium sold against you')));

  // TREND: blend daily structure + intraday tape
  const trendScore=((ctx.trendAgree||0)*0.6+(ctx.intradayAgree||0)*0.4);
  push('trend','trend + tape',trendScore,0.16,
       (ctx.trendAgree>0?'daily trend agrees':ctx.trendAgree<0?'daily trend opposes':'daily trend flat')+
       (ctx.intradayAgree>0?', intraday with you':ctx.intradayAgree<0?', intraday against':''));

  // VOL: cheap IV + the right term-structure regime is a tailwind
  let volScore=0,volDetail='vol regime neutral';
  if(ctx.ivRank!=null){
    // long premium wants cheap IV (low rank); mean-revert in +GEX likes calm (contango)
    const ivEdge=(50-ctx.ivRank)/50;                 // +1 = very cheap, -1 = very rich
    volScore=ivEdge*0.7;
    volDetail='IV rank '+Math.round(ctx.ivRank)+(ctx.ivRank<35?' (cheap)':ctx.ivRank>65?' (rich)':'');
    if(ctx.vixBackwardation===true){volScore-=0.3;volDetail+=', term backwardation (stress)';}
    else if(ctx.vixBackwardation===false){volScore+=0.15;volDetail+=', contango';}
  }
  push('vol','vol regime',volScore,0.12,volDetail);

  // SKEW: signed tailwind for the direction
  push('skew','25\u0394 skew',ctx.skewTailwind||0,0.10,
       ctx.skewTailwind==null?'skew n/a':
       (Math.abs(ctx.skewTailwind)<0.1?'skew balanced':ctx.skewTailwind>0?'skew a tailwind':'skew a headwind'));

  // RSI extreme is a small penalty overlay (not a full factor)
  let rsiPen=0;
  if(ctx.rsiExtreme){rsiPen=ctx.rsiExtreme*0.06;}

  const raw=F.reduce((a,f)=>a+f.contrib,0)+rsiPen;   // sum of weighted factors, ~[-1,1]
  // squash: 50 is neutral, ±1 maps toward 0/100 with a gentle curve
  const score=Math.max(0,Math.min(99,Math.round(50+raw*55)));
  return {score,factors:F,raw,edge:F.slice().sort((a,b)=>Math.abs(b.contrib)-Math.abs(a.contrib))[0]};
}

/* deterministic desk-note: turns the factor set into a plain-English read.
   This is the "analyst" — no LLM, no API, fully transparent and free. */
function deskNote(sym,dir,res,extra){
  const strong=res.factors.filter(f=>f.contrib>=0.08).sort((a,b)=>b.contrib-a.contrib);
  const weak=res.factors.filter(f=>f.contrib<=-0.06).sort((a,b)=>a.contrib-b.contrib);
  const parts=[];
  parts.push(sym+' leans '+(dir>0?'long':'short')+' at a '+res.score+'.');
  if(strong.length){
    parts.push('Carrying it: '+strong.slice(0,3).map(f=>f.detail).join('; ')+'.');
  }
  if(weak.length){
    parts.push('Working against: '+weak.slice(0,2).map(f=>f.detail).join('; ')+'.');
  }
  if(extra&&extra.plan)parts.push(extra.plan);
  return parts.join(' ');
}

/* -------- performance journal (localStorage, free, per-device) --------
   Logs each surfaced idea with its score + the setup, timestamped. Later the
   Aether tab can show hit-rate by score bucket once enough have resolved.
   We store the idea and mark it 'open'; a lightweight resolver checks whether
   spot reached target (win) or invalidation (loss) on subsequent snapshots. */
const QJ_KEY='kairos_journal_v1';
const QJ_CAP=500;
function qjLoad(){try{return JSON.parse(localStorage.getItem(QJ_KEY)||'[]');}catch(e){return [];}}
function qjSave(a){try{localStorage.setItem(QJ_KEY,JSON.stringify(a.slice(-QJ_CAP)));}catch(e){}}
function qjLog(idea){
  if(!idea)return;
  const a=qjLoad();
  const today=new Date().toISOString().slice(0,10);
  // one entry per sym+dir+day so we don't spam duplicates each sweep
  const dupe=a.find(x=>x.sym===idea.sym&&x.dir===idea.bias&&x.d===today&&x.status==='open');
  if(dupe){dupe.score=idea.score;dupe.t=Date.now();qjSave(a);return;}
  a.push({sym:idea.sym,dir:idea.bias,score:idea.score,d:today,t:Date.now(),
          entry:idea.entry,target:idea.target?+idea.target:null,invalid:idea.invalid?+idea.invalid:null,
          status:'open',result:null});
  qjSave(a);
}
function qjResolve(sym,spot){
  const a=qjLoad();let changed=false;
  a.forEach(x=>{
    if(x.sym!==sym||x.status!=='open'||!spot)return;
    if(x.target!=null&&((x.dir==='LONG'&&spot>=x.target)||(x.dir==='SHORT'&&spot<=x.target))){x.status='closed';x.result='win';x.tClose=Date.now();changed=true;}
    else if(x.invalid!=null&&((x.dir==='LONG'&&spot<=x.invalid)||(x.dir==='SHORT'&&spot>=x.invalid))){x.status='closed';x.result='loss';x.tClose=Date.now();changed=true;}
  });
  if(changed)qjSave(a);
}
function qjStats(){
  const a=qjLoad();
  const closed=a.filter(x=>x.status==='closed');
  const wins=closed.filter(x=>x.result==='win').length;
  const buckets={};
  ['80+','70-79','60-69','<60'].forEach(b=>buckets[b]={n:0,w:0});
  closed.forEach(x=>{const b=x.score>=80?'80+':x.score>=70?'70-79':x.score>=60?'60-69':'<60';buckets[b].n++;if(x.result==='win')buckets[b].w++;});
  return {total:a.length,open:a.filter(x=>x.status==='open').length,closed:closed.length,
          wins,winRate:closed.length?wins/closed.length*100:null,buckets,recent:a.slice(-40).reverse()};
}

window.KairosQuant.aetherScore=aetherScore;
window.KairosQuant.deskNote=deskNote;
window.KairosQuant.qjLog=qjLog;
window.KairosQuant.qjResolve=qjResolve;
window.KairosQuant.qjStats=qjStats;
window.KairosQuant.QJ_KEY=QJ_KEY;

console.log('%cKairos Quant v2 \u2014 charm, vol-trigger, DEX, flow classification, vol regime, Aether v2 factor model + journal.','color:#22d3ee;font-weight:bold');
