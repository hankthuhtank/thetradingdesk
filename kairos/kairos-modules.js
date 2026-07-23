/* =====================================================================
   KAIROS MODULES — loads after kairos-core.js. Order matters:
   1. ZERO   (0DTE engine · the Ƶero tab in Aether)
   2. NEXUS  (the field · canvas battleground)
   3. SWING  (60–90D engine · the Swing tab in Aether)
   Swing must load last: it overrides renderCards/scoreIdea from core
   and uses zGatesHtml/bsPrice/bsDelta from Zero.
   ===================================================================== */

/* =====================================================================
   KAIROS ZERO — 0DTE / 1DTE engine (v7.4). Lives in the Aether view.

   What it is: a same-day contract selector built on the 0DTE-only dealer
   book. It reads regime (+GEX pin / −GEX momentum), the 0DTE walls/King/
   flip, the live intraday tape (rolling spot samples), opening flow, and
   the session clock — then, when a defined setup lines up, it publishes
   a card: contract, entry (mid), structure stop, T1/T2, premium-modeled
   R:R, the gates it passed, and why. Every fired card is journaled to
   localStorage with a CSV export so the engine can be graded honestly.

   What it is NOT: a signal service. No fills are simulated. Cards track
   real chain mids (~90s) and real spot (~10-20s). Majority of 0DTE
   premium buyers lose; this is structure context to grade YOUR read.
   ===================================================================== */
'use strict';

const Z={
  /* CORE = daily (M–F) expirations. ROSTER adds the names Cboe has put on a
     Mon/Wed/Fri schedule — those are only 0DTE-tradeable on M/W/F, so the
     list is NOT hardcoded by weekday: zQualify() asks Tradier which of these
     actually has an expiry <=1.2 DTE right now and builds UNI from the answer.
     Self-correcting when Cboe adds names, and Tue/Thu the MWF names simply
     drop out on their own. Illiquid ones still die at the zPick spread/OI gate. */
  CORE:['SPXW','SPY','QQQ','IWM'],
  ROSTER:['SPXW','SPY','QQQ','IWM','DIA','NVDA','TSLA','AAPL','AMZN','META','MSFT','GOOGL','AMD','PLTR','COIN','MSTR','NFLX','AVGO'],
  UNI:['SPXW','SPY','QQQ','IWM'],   // live-qualified each session by zQualify()
  MIN_SCORE:60,
  /* 0DTE contract doctrine: CHEAP OTM convexity, on purpose. A same-day thesis
     is a gamma trade — the payoff comes from a fast structure move multiplying
     a small debit, so the picker targets \u0394~0.30 (fades a touch higher, they
     resolve nearer the wall). Bounds \u03940.20\u20130.42 keep it OUT of two traps:
     ITM (\u0394>0.45 pays intrinsic you don't need for a day trade and caps R:R)
     and deep-lotto (\u0394<0.20, where PoP collapses and the tape must be perfect). */
  D_FADE:0.34, D_MOMO:0.30,          // target |delta| — OTM in the trade's direction
  D_LO:0.20, D_HI:0.42,
  MAX_SPREAD:0.10,                   // reject contracts wider than 10% of mid
  MIN_LIQ:150,                       // oi+vol floor
  VOL_W:0.5,                         // 0DTE book = OI + 0.5*volume (same-day positioning proxy; OI alone is prior-day)
  NEAR_WALL:0.22,                    // "at the wall" band, in expected-move units
  MIN_ROOM:0.35,                     // minimum runway to target, in EM units
  DTE_MAX:1.2,
  PREM_STOP:35,                      // advisory hard premium stop (-35%)
  TIME_STOP:45                       // minutes without progress = thesis stale
};

/* ---- Black-Scholes price/delta (r=q=0, matches the rest of the app) ---- */
function nCdf(x){const t=1/(1+0.2316419*Math.abs(x));const d=Math.exp(-x*x/2)/Math.sqrt(2*Math.PI);const p=d*t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return x>=0?1-p:p;}
function bsPrice(S,K,iv,T,call){if(T<=0)return Math.max(call?S-K:K-S,0);if(!iv||iv<=0)iv=0.0001;const st=iv*Math.sqrt(T);const d1=(Math.log(S/K)+0.5*iv*iv*T)/st,d2=d1-st;return call?S*nCdf(d1)-K*nCdf(d2):K*nCdf(-d2)-S*nCdf(-d1);}
function bsDelta(S,K,iv,T,call){if(T<=0||!iv||iv<=0)return call?(S>K?1:0):(S<K?-1:0);const st=iv*Math.sqrt(T);const d1=(Math.log(S/K)+0.5*iv*iv*T)/st;return call?nCdf(d1):nCdf(d1)-1;}

/* ---- session clock (ET). Override hook: state.zClockOverride ---- */
function zPhase(){
  if(state.zClockOverride)return state.zClockOverride;
  let wd='Mon',h=12,m=0;
  try{
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'numeric',weekday:'short',hour12:false}).formatToParts(new Date());
    const g=t=>{const p=parts.find(x=>x.type===t);return p?p.value:'';};
    wd=g('weekday');h=parseInt(g('hour'),10)%24;m=parseInt(g('minute'),10)||0;
  }catch(e){}
  const mins=h*60+m;
  const mk=o=>Object.assign({mins,wd,hm:String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')},o);
  if(wd==='Sat'||wd==='Sun')return mk({label:'weekend — market closed',block:1,closed:1,tag:'CLOSED'});
  if(mins<570)return mk({label:'pre-market — engine arms at 10:00 ET',block:1,closed:mins<540,tag:'PRE'});
  if(mins<600)return mk({label:'opening range forming (9:30–10:00) — 0DTE levels are still being built, no fires',block:1,tag:'OPEN'});
  if(mins<690)return mk({label:'morning trend window (10:00–11:30)',tag:'TREND',momoBonus:6});
  if(mins<810)return mk({label:'lunch chop (11:30–13:30) — fades only, theta drag is at its worst',tag:'LUNCH',fadeOnly:1});
  if(mins<900)return mk({label:'afternoon window (13:30–15:00) — pin-vs-pop hours',tag:'PM',pinBonus:6});
  if(mins<930)return mk({label:'gamma hour (15:00–15:30) — pins strongest, moves violent',tag:'GAMMA',pinBonus:8,warn:'final-hour gamma: spreads widen, premium is nearly all intrinsic'});
  if(mins<960)return mk({label:'final 30 min — no new entries (book-close discipline)',block:1,tag:'CLOSE'});
  return mk({label:'after hours — session done',block:1,closed:1,tag:'CLOSED'});
}

/* ---- universe qualification: who actually has a same-day expiry today? ----
   One /expirations call per roster name (40-min cached by exps()), once per
   session. On Mon/Wed/Fri the MWF single names qualify; Tue/Thu they don't,
   without us hardcoding a calendar. */
let zQualDay='',zQualing=false,zQualNote='';
async function zQualify(force){
  const day=localDate();
  if(!force&&zQualDay===day)return Z.UNI;
  if(zQualing)return Z.UNI;
  if(!liveOn())return Z.UNI;
  zQualing=true;
  try{
    const ok=[],miss=[];
    for(const s of Z.ROSTER){
      try{
        const es=await exps(s);
        if(es&&es.some(e=>dteOf(e)<=Z.DTE_MAX))ok.push(s);else miss.push(s);
      }catch(e){miss.push(s);}
      await new Promise(r=>setTimeout(r,60));
    }
    if(ok.length){
      Z.UNI=ok;zQualDay=day;
      zQualNote=ok.length+' of '+Z.ROSTER.length+' rostered names have an expiry \u2264'+Z.DTE_MAX+' DTE'+(miss.length?' \u00b7 sitting out: '+miss.join(' '):'');
    }
  }finally{zQualing=false;}
  return Z.UNI;
}

/* ---- rolling intraday spot tape (in-memory; fed by every quote poll) ---- */
function zRecord(){
  const now=Date.now();state.zTape=state.zTape||{};
  [...new Set([...Z.UNI,state.focus])].forEach(s=>{
    const px=state.spot[s];if(!px)return;
    const a=state.zTape[s]=state.zTape[s]||[];
    if(a.length){const L=a[a.length-1];if(now-L.t<4000)return;if(L.px===px&&now-L.t<20000)return;}
    a.push({t:now,px});while(a.length>600)a.shift();
  });
}
function zMom(sym,mins){
  const a=(state.zTape||{})[sym];if(!a||a.length<3)return null;
  const now=Date.now(),cut=now-mins*60000;
  if(now-a[0].t<mins*60000*0.6)return null;
  let base=a[0];for(const p of a){if(p.t<=cut)base=p;else break;}
  return (a[a.length-1].px-base.px)/base.px;
}
function zExtremes(sym,sinceMs){
  const a=(state.zTape||{})[sym];if(!a||!a.length)return null;
  let hi=-1e18,lo=1e18,n=0;
  for(const p of a){if(p.t>=sinceMs){if(p.px>hi)hi=p.px;if(p.px<lo)lo=p.px;n++;}}
  return n?{hi,lo}:null;
}

/* ---- the 0DTE-only dealer book ---- */
function zBook(sym){
  const ch=state.chains[sym];if(!ch||!ch.list||!ch.list.length)return null;
  const spot=state.spot[sym]||ch.spot||ch.spotHint||0;if(!spot)return null;
  const dEff=e=>state.zDteOverride!=null?state.zDteOverride:dteOf(e);
  const dates=[...new Set(ch.list.map(c=>c.e))].sort();
  let e0=null;for(const e of dates){if(dEff(e)<=Z.DTE_MAX){e0=e;break;}}
  if(!e0)return{noExp:true,spot};
  const dte=dEff(e0);
  const cs=ch.list.filter(c=>c.e===e0);
  const gmult=100*spot*spot*0.01;
  const per={};let ivw=0,ivn=0;
  for(const c of cs){
    let g=0;
    if(c.iv>0.01&&c.iv<5)g=bsGamma(spot,c.k,c.iv,c.T);
    if(!g)g=c.g0||0;
    if(!g)continue;
    const w=(c.oi||0)+Z.VOL_W*(c.vol||0);
    if(!w)continue;
    const sgn=c.call?1:-1;
    const b=per[c.k]||(per[c.k]={k:c.k,gu:0,ga:0});
    b.gu+=sgn*g*w;b.ga+=g*w;
    if(c.iv>0.01&&c.iv<5&&Math.abs(c.k-spot)<=spot*0.01){const w2=(c.oi||0)+(c.vol||0)+1;ivw+=c.iv*w2;ivn+=w2;}
  }
  let strikes=Object.values(per).map(b=>({k:b.k,gex:dealerAdj(b.gu,b.ga)*gmult,vex:0})).filter(s=>s.gex!==0).sort((a,b)=>b.k-a.k);
  const range=(sym==='SPXW'||sym==='SPX')?320:Math.max(45,Math.min(spot*0.09,600));
  strikes=strikes.filter(s=>Math.abs(s.k-spot)<range);
  if(strikes.length<4)return{thin:true,spot,e0,dte};
  const king=kingOf(strikes,'gex'),cw=callWall(strikes,'gex'),pw=putWall(strikes,'gex');
  const flipO=flipOf(strikes,spot,'gex');
  const net1=strikes.filter(s=>Math.abs(s.k-spot)<=spot*0.01).reduce((a,s)=>a+s.gex,0);
  const tot=strikes.reduce((a,s)=>a+Math.abs(s.gex),0)||1;
  const ivATM=ivn?ivw/ivn:0;
  const em=ivATM>0?spot*ivATM*Math.sqrt(Math.max(dte,0.02)/365):null;
  let cp=0,pp=0;
  for(const c of cs){if(!c.vol)continue;const voi=c.vol/Math.max(c.oi,1);if(voi<FLOW_OPEN)continue;const prem=(c.mid||0)*c.vol*100;if(c.call)cp+=prem;else pp+=prem;}
  const lean=(cp+pp)>0?(cp-pp)/(cp+pp):0;
  return{spot,e0,dte,is0:dte<=0.8,cs,strikes,king,cw,pw,flip:flipO?flipO.k:null,net1,tot,em,ivATM,cp,pp,lean,src:ch.src};
}

/* ---- contract picker: liquid, tight, cheap-OTM delta (see doctrine above) ---- */
function zPick(cs,call,targetD,spot){
  const cands=[];
  for(const c of cs){
    if(c.call!==call)continue;
    const mid=c.mid||(((c.bid||0)+(c.ask||0))/2);
    if(!mid||mid<0.05)continue;
    if(((c.oi||0)+(c.vol||0))<Z.MIN_LIQ)continue;
    let spr=null;
    if(c.bid>0&&c.ask>0&&c.ask>=c.bid){spr=(c.ask-c.bid)/mid;if(spr>Z.MAX_SPREAD)continue;}
    let dl=Math.abs(c.dl||0);
    if(!dl&&c.iv>0.01&&c.iv<5)dl=Math.abs(bsDelta(spot,c.k,c.iv,c.T,call));
    if(!dl||dl<Z.D_LO||dl>Z.D_HI)continue;
    cands.push({c,mid,spr,dl});
  }
  if(!cands.length)return null;
  cands.sort((a,b)=>{const d=Math.abs(a.dl-targetD)-Math.abs(b.dl-targetD);return Math.abs(d)>0.02?d:a.mid-b.mid;});
  const p=cands[0];
  return{k:p.c.k,e:p.c.e,call,T:p.c.T,iv:p.c.iv,oi:p.c.oi||0,vol:p.c.vol||0,mid:p.mid,bid:p.c.bid||0,ask:p.c.ask||0,dl:p.dl,spr:p.spr};
}

/* ---- premium model: BS re-price at target/stop with theta burn to ETA.
   Assumes IV static (0DTE IV usually bleeds into the close — disclosed). ---- */
/* Premium model. The v7.4 build burned theta from pick.T with an 8-minute
   floor: on a 0DTE with ~39 min left and an ETA up to 110 min, pick.T-eta
   went negative, floored, and priced EVERY level as if held to the bell.
   T1 then modelled as a LOSS (the "targets went the wrong way" bug) and the
   stop showed ~-90% because it assumed you sat 20 min instead of stopping
   out fast. Fix: the horizon is the time we actually have (to expiry, and to
   the 15:30 flat rule), ETA can never exceed it, and each level decays by
   the time it plausibly takes to GET there — stops hit fastest. */
function zModel(pick,spot,stop,t1,t2,em,outMin){
  if(!pick||!pick.iv||pick.iv<=0.01)return null;
  const yr=525600;
  const remMin=Math.max(2,pick.T*yr);
  const horizon=Math.max(3,Math.min(remMin,(outMin>0?outMin:remMin)));
  const dist=Math.abs(t2-spot);
  let eta=em?110*dist/em:60;
  eta=Math.max(4,Math.min(eta,horizon*0.7));
  const Tat=m=>Math.max((remMin-m)/yr,2/yr);
  const e=pick.mid;
  const v2=bsPrice(t2,pick.k,pick.iv,Tat(eta),pick.call);
  const v1=bsPrice(t1,pick.k,pick.iv,Tat(eta*0.5),pick.call);
  const vs=bsPrice(stop,pick.k,pick.iv,Tat(eta*0.25),pick.call);
  return{etaMin:Math.round(eta),remMin:Math.round(remMin),t2:v2,t1:v1,stop:vs,
    p2:(v2-e)/e*100,p1:(v1-e)/e*100,ps:(vs-e)/e*100,
    rrP:(v2-e)>0&&(e-vs)>0?(v2-e)/(e-vs):null};
}

/* ---- the engine: gates -> setup -> score -> card ---- */
function zeroRead(sym){
  const gates=[];const G=(n,ok,txt)=>{gates.push({n,ok:!!ok,txt:txt||''});return !!ok;};
  const ph=zPhase();
  const out={sym,gates,phase:ph};
  const live=liveOn();
  if(!G('Live quotes',live,live?'Live':'CBOE is ~15-min delayed — fires disabled without a Tradier token')){out.standby='needs live quotes for 0DTE (delayed data can\u2019t time same-day entries)';return out;}
  const b=zBook(sym);
  if(!b){out.standby='no chain loaded yet — the feed loop pulls it within ~1 min';return out;}
  out.book=b;
  if(b.noExp){out.standby='no expiry \u22641 DTE on the loaded chain';return out;}
  if(b.thin){out.standby='0DTE book too thin to map ('+(b.e0||'')+')';return out;}
  const dp=b.spot>2000?0:2;out.dp=dp;
  const f=v=>(+v).toFixed(dp);
  const pin=b.net1>0;
  const clar=Math.min(1,Math.abs(b.net1)/(0.04*b.tot));
  G('Regime',true,(pin?'+GEX \u00b7 pin/fade day':'\u2212GEX \u00b7 momentum day')+' \u00b7 net\u00b11% '+fmtG(b.net1,b.spot));
  if(!G('Expected move',!!b.em,b.em?('\u00b1'+f(b.em)+' \u00b7 '+(b.ivATM*100).toFixed(0)+'% ATM IV'):'no usable ATM IV on the 0DTE chain')){out.standby='no ATM IV \u2014 cannot scale distances';return out;}
  /* tape */
  const m5=zMom(sym,5),m15=zMom(sym,15);
  const mv15=m15!=null?m15*b.spot:null;
  const tapeReady=m15!=null;
  const dTech=(state.tech&&state.tech[sym]&&state.tech[sym].ok)?(state.tech[sym].ret1||0):null;
  let dir=0,tapeTxt;
  if(tapeReady){
    const trending=Math.abs(mv15)>=0.10*b.em&&m5!=null&&Math.sign(m5||0)===Math.sign(m15);
    dir=trending?Math.sign(m15):0;
    tapeTxt='15m '+(m15>=0?'+':'')+(m15*100).toFixed(2)+'% \u00b7 5m '+(m5!=null?((m5>=0?'+':'')+(m5*100).toFixed(2)+'%'):'\u2014');
  }else{
    dir=dTech!=null?(dTech>0.002?1:dTech<-0.002?-1:0):0;
    tapeTxt='building intraday tape'+(dTech!=null?' \u00b7 day '+(dTech*100).toFixed(2)+'%':'');
  }
  G('Tape',true,tapeTxt);
  /* setup */
  const buf=Math.max(0.10*b.em,0.0012*b.spot);
  const below=b.strikes.filter(s=>s.k<b.spot-buf),above=b.strikes.filter(s=>s.k>b.spot+buf);
  const bigBelow=below.length?below.reduce((a,s)=>Math.abs(s.gex)>Math.abs(a.gex)?s:a):null;
  const bigAbove=above.length?above.reduce((a,s)=>Math.abs(s.gex)>Math.abs(a.gex)?s:a):null;
  const dCW=b.cw?b.cw.k-b.spot:null,dPW=b.pw?b.spot-b.pw.k:null,dKing=b.king?b.king.k-b.spot:null;
  let setup=null,side=0,stop=null,t2=null,why='';
  if(pin){
    if(b.cw&&dCW!=null&&dCW>=-buf&&dCW<=Z.NEAR_WALL*b.em&&(m5==null||m5<=0.0005)){
      setup='WALL FADE';side=-1;stop=b.cw.k+buf;
      t2=(b.king&&b.king.k<b.spot-buf)?b.king.k:(bigBelow?bigBelow.k:b.spot-0.5*b.em);
      why='pressed into the 0DTE call wall '+b.cw.k+' with the push stalling \u2014 in +GEX, dealer hedging sells into strength here';
    }else if(b.pw&&dPW!=null&&dPW>=-buf&&dPW<=Z.NEAR_WALL*b.em&&(m5==null||m5>=-0.0005)){
      setup='WALL FADE';side=1;stop=b.pw.k-buf;
      t2=(b.king&&b.king.k>b.spot+buf)?b.king.k:(bigAbove?bigAbove.k:b.spot+0.5*b.em);
      why='flushed into the 0DTE put wall '+b.pw.k+' with the selling stalling \u2014 in +GEX, dealer hedging buys here';
    }else if(b.king&&dKing!=null&&Math.abs(dKing)>=Z.MIN_ROOM*b.em&&dir!==0&&Math.sign(dKing)===dir){
      setup='KING MAGNET';side=dir;t2=b.king.k;
      const ex=zExtremes(sym,Date.now()-30*60000);
      let refM=side>0?(ex?ex.lo:b.spot-0.3*b.em):(ex?ex.hi:b.spot+0.3*b.em);
      let distM=Math.abs(refM-b.spot)+buf*0.5;
      distM=Math.max(0.18*b.em,Math.min(distM,0.40*b.em));
      stop=side>0?b.spot-distM:b.spot+distM;
      why='spot sits '+(Math.abs(dKing)/b.em).toFixed(2)+' EM off the '+(b.is0?'0DTE':'1DTE')+' King '+b.king.k+' and the tape is rotating toward it \u2014 pin gravity';
    }
  }else if(dir!==0&&tapeReady){
    const crossedFlip=b.flip!=null&&((dir<0&&b.spot<b.flip&&b.spot>b.flip-0.5*b.em)||(dir>0&&b.spot>b.flip&&b.spot<b.flip+0.5*b.em));
    const tgt=dir>0?((b.cw&&b.cw.k>b.spot+buf)?b.cw.k:(bigAbove?bigAbove.k:b.spot+0.8*b.em))
                   :((b.pw&&b.pw.k<b.spot-buf)?b.pw.k:(bigBelow?bigBelow.k:b.spot-0.8*b.em));
    if(Math.abs(tgt-b.spot)>=Z.MIN_ROOM*b.em){
      setup=crossedFlip?'FLIP BREAK':'MOMO RIDE';side=dir;t2=tgt;
      const ex=zExtremes(sym,Date.now()-15*60000);
      let ref=side>0?(ex?ex.lo:b.spot-0.3*b.em):(ex?ex.hi:b.spot+0.3*b.em);
      if(crossedFlip)ref=side>0?Math.max(ref,b.flip):Math.min(ref,b.flip);
      /* momentum stops are the just-broken level, not the whole swing: cap in EM terms */
      let dist=Math.abs(ref-b.spot)+buf;
      dist=Math.max(0.18*b.em,Math.min(dist,0.45*b.em));
      stop=side>0?b.spot-dist:b.spot+dist;
      why=(crossedFlip?('just through the gamma flip '+f(b.flip)+' \u2014 '):'')+'\u2212GEX regime: dealers chase the tape; riding '+(dir>0?'up':'down')+' toward the next node';
    }
  }
  if(!G('Setup',!!setup,setup?setup+' \u00b7 '+(side>0?'LONG':'SHORT'):(pin?'no wall touch, no magnet alignment \u2014 mid-structure chop':'no confirmed directional tape to ride'))){
    out.standby=pin?'+GEX day \u2014 waiting for a wall touch or a magnet rotation':'\u2212GEX day \u2014 waiting for the tape to commit';return out;
  }
  /* time window */
  const isFade=setup==='WALL FADE'||setup==='KING MAGNET';
  const timeOK=!ph.block&&!(ph.fadeOnly&&!isFade);
  if(!G('Time window',timeOK,ph.label)){out.standby=ph.block?ph.label:'lunch window \u2014 momentum fires paused, fades only';out.setup=setup;return out;}
  /* T1 + underlying R:R */
  const lo2=Math.min(b.spot,t2)+buf*0.5,hi2=Math.max(b.spot,t2)-buf*0.5;
  const between=b.strikes.filter(s=>s.k>lo2&&s.k<hi2);
  const t1=between.length?between.reduce((a,s)=>Math.abs(s.gex)>Math.abs(a.gex)?s:a).k:(b.spot+t2)/2;
  const rrU=Math.abs(t2-b.spot)/Math.max(1e-9,Math.abs(b.spot-stop));
  if(!G('R:R',rrU>=1.5,rrU.toFixed(2)+':1 in underlying points')){out.standby='structure R:R '+rrU.toFixed(2)+':1 \u2014 below the 1.5 floor';out.setup=setup;return out;}
  /* contract */
  const pick=zPick(b.cs,side>0,isFade?Z.D_FADE:Z.D_MOMO,b.spot);
  if(!G('Contract',!!pick,pick?(pick.k+(pick.call?'C':'P')+' \u0394'+pick.dl.toFixed(2)+(pick.spr!=null?' \u00b7 spread '+(pick.spr*100).toFixed(1)+'%':' \u00b7 spread n/a')+' \u00b7 OI '+pick.oi.toLocaleString()):'no contract passes liquidity + \u0394 0.35\u20130.62 + spread \u226410% filters')){
    out.standby='no tradeable contract on the 0DTE chain right now';out.setup=setup;return out;
  }
  const model=zModel(pick,b.spot,stop,t1,t2,b.em,930-ph.mins);
  /* The structure R:R gate above is in underlying points, which flatters a
     0DTE: theta can eat a "1.66:1" move whole. This gate makes the contract
     itself clear the bar — T1 has to actually pay, and premium R:R has to
     beat 1.20 after decay. */
  let mtxt='no usable IV to price the contract';
  if(model){
    const rrTxt=model.rrP!=null?model.rrP.toFixed(2)+':1':'\u2014';
    mtxt='T1 '+(model.p1>=0?'+':'')+model.p1.toFixed(0)+'% \u00b7 T2 '+(model.p2>=0?'+':'')+model.p2.toFixed(0)+'% \u00b7 stop '+model.ps.toFixed(0)+'% \u00b7 prem R:R '+rrTxt;
  }
  if(!G('Premium model',!!(model&&model.p1>0&&model.rrP!=null&&model.rrP>=1.2),mtxt)){
    let sb='cannot model premium without IV';
    if(model){
      sb='theta eats it \u2014 premium R:R '+(model.rrP!=null?model.rrP.toFixed(2)+':1':'negative')+' is under the 1.20 floor';
      if(model.p1<=0)sb+=' and T1 models as a loss';
    }
    out.standby=sb;out.setup=setup;return out;
  }
  /* score */
  const drivers=[pin?'+GEX pin':'\u2212GEX momo'];
  let score=35+Math.round(10*clar);
  if(dir!==0&&side===dir){score+=15;drivers.push('tape aligned');}
  else if(isFade&&m5!=null&&Math.abs(m5)<=0.0008){score+=8;drivers.push('stall at the level');}
  if(setup==='WALL FADE'){score+=15;drivers.push('at the wall');}
  else if(setup==='FLIP BREAK'){score+=15;drivers.push('through the flip');}
  else if(setup==='KING MAGNET'){score+=Math.round(15*Math.min(1,Math.abs(dKing)/b.em));drivers.push('magnet room');}
  else score+=10;
  if((side>0&&b.lean>0.15)||(side<0&&b.lean<-0.15)){score+=8;drivers.push('0DTE flow confirms');}
  else if((side>0&&b.lean<-0.15)||(side<0&&b.lean>0.15)){score-=8;drivers.push('0DTE flow diverges');}
  score+=rrU>=2?8:4;
  if(isFade&&ph.pinBonus)score+=ph.pinBonus;
  if(!isFade&&ph.momoBonus)score+=ph.momoBonus;
  if(pick.spr!=null&&pick.spr>0.06)score-=4;
  if(!b.is0){score-=4;drivers.push('1DTE book');}
  score=Math.max(0,Math.min(95,Math.round(score)));
  if(!G('Score',score>=Z.MIN_SCORE,score+' / fire floor '+Z.MIN_SCORE)){out.standby='setup found but score '+score+' is under the '+Z.MIN_SCORE+' floor';out.setup=setup;return out;}
  Object.assign(out,{fire:true,setup,side,stop,t1,t2,rrU,pick,model,score,drivers:drivers.slice(0,5),why,pin});
  return out;
}

/* ---- journal (localStorage) + live cards ---- */
let zLog=(function(){try{const j=JSON.parse(localStorage.getItem('kairos_zero_log')||'null');if(j&&j.v===1&&j.days)return j;}catch(e){}return{v:1,days:{}};})();
let zLastSave=0;
function zSaveLog(force){
  const now=Date.now();if(!force&&now-zLastSave<20000)return;zLastSave=now;
  const keys=Object.keys(zLog.days).sort();while(keys.length>7)delete zLog.days[keys.shift()];
  try{localStorage.setItem('kairos_zero_log',JSON.stringify(zLog));}catch(e){}
}
state.zCards={};
(function(){const day=zLog.days[localDate()];if(day)day.forEach(c=>{(state.zCards[c.sym]=state.zCards[c.sym]||[]).push(c);});})();

function zFire(sym,r){
  const b=r.book,ph=r.phase;
  const c={sym,firedAt:Date.now(),hm:ph.hm,phTag:ph.tag||'',
    setup:r.setup,side:r.side,score:r.score,
    e:r.pick.e,k:r.pick.k,call:r.pick.call,dlv:+r.pick.dl.toFixed(2),
    entry:+r.pick.mid.toFixed(2),spr:r.pick.spr!=null?+(r.pick.spr*100).toFixed(1):null,
    spotAt:+b.spot.toFixed(2),stop:+(+r.stop).toFixed(r.dp),t1:+(+r.t1).toFixed(r.dp),t2:+(+r.t2).toFixed(r.dp),
    rrU:+r.rrU.toFixed(2),
    est:r.model?{p1:Math.round(r.model.p1),p2:Math.round(r.model.p2),ps:Math.round(r.model.ps),rrP:r.model.rrP?+r.model.rrP.toFixed(2):null,eta:r.model.etaMin}:null,
    drivers:r.drivers,why:r.why,is0:!!b.is0,
    status:'LIVE',last:+r.pick.mid.toFixed(2),peak:+r.pick.mid.toFixed(2),t1Hit:0};
  const d2=localDate();(zLog.days[d2]=zLog.days[d2]||[]).push(c);
  (state.zCards[sym]=state.zCards[sym]||[]).push(c);
  zSaveLog(true);
  return c;
}
function zStatusTick(){
  const day=zLog.days[localDate()];if(!day||!day.length)return;
  const ph=zPhase();let changed=false;
  for(const c of day){
    if(c.status!=='LIVE')continue;
    const spot=state.spot[c.sym];
    if(spot){
      const ex=zExtremes(c.sym,c.firedAt)||{hi:spot,lo:spot};
      const hi=Math.max(ex.hi,spot),lo=Math.min(ex.lo,spot);
      if(c.side>0){
        if(lo<=c.stop){c.status='STOPPED';c.endT=Date.now();changed=true;}
        else if(hi>=c.t2){c.status='TARGET';c.endT=Date.now();changed=true;}
        else if(!c.t1Hit&&hi>=c.t1){c.t1Hit=Date.now();changed=true;}
      }else{
        if(hi>=c.stop){c.status='STOPPED';c.endT=Date.now();changed=true;}
        else if(lo<=c.t2){c.status='TARGET';c.endT=Date.now();changed=true;}
        else if(!c.t1Hit&&lo<=c.t1){c.t1Hit=Date.now();changed=true;}
      }
    }
    if(c.status==='LIVE'&&(ph.closed||ph.mins>=960)){c.status='EXPIRED';c.endT=Date.now();changed=true;}
    if(c.status==='LIVE'){
      const ch=state.chains[c.sym];
      if(ch&&ch.list){
        const hit=ch.list.find(x=>x.e===c.e&&x.k===c.k&&x.call===c.call);
        if(hit&&hit.mid){c.last=+hit.mid.toFixed(2);if(hit.mid>(c.peak||0)){c.peak=+hit.mid.toFixed(2);}changed=true;}
      }
    }
  }
  if(changed)zSaveLog(false);
}
function zExportCsv(){
  const rows=[['date','fired_et','sym','setup','side','contract','entry_mid','stop_und','t1','t2','rr_und','score','status','t1_hit','last_mid','peak_mid','phase']];
  Object.keys(zLog.days).sort().forEach(d2=>{zLog.days[d2].forEach(c=>{
    rows.push([d2,c.hm,c.sym,c.setup,c.side>0?'LONG':'SHORT',c.sym+' '+c.k+(c.call?'C':'P')+' '+c.e,c.entry,c.stop,c.t1,c.t2,c.rrU,c.score,c.status,c.t1Hit?'y':'',c.last||'',c.peak||'',c.phTag]);
  });});
  const csv=rows.map(r=>r.join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='kairos-zero-journal.csv';a.click();URL.revokeObjectURL(a.href);
}

/* ---- render ---- */
function zVisible(){return state.view==='ideas'&&state.zTab==='zero'&&!document.hidden;}
function zCount(){let n=0;Object.keys(zLog.days).forEach(d2=>n+=zLog.days[d2].length);return n;}
function zStatusRibbon(c){
  const m={LIVE:['live','LIVE'],STOPPED:['stop','STOPPED \u2014 structure broke'],TARGET:['tgt','TARGET HIT'],EXPIRED:['exp','EXPIRED AT THE BELL']};
  const x=m[c.status]||m.LIVE;
  let extra='';
  if(c.status==='LIVE'&&Date.now()-c.firedAt>Z.TIME_STOP*60000&&!c.t1Hit)extra=' \u00b7 \u23f1 time stop \u2014 thesis is stale ('+Z.TIME_STOP+'m, no T1)';
  return '<div class="zribbon '+x[0]+'">'+x[1]+extra+'</div>';
}
function zMapBar(c){
  const pts=[c.stop,c.spotAt,c.t1,c.t2];
  const lo=Math.min(...pts),hi=Math.max(...pts),W=v=>((v-lo)/((hi-lo)||1)*100);
  const mk=(v,cls,lab)=>'<span class="zmk '+cls+'" style="left:'+W(v).toFixed(1)+'%" title="'+lab+' '+v+'"></span>';
  return '<div class="zmap"><div class="zbar"></div>'+mk(c.stop,'mstop','stop')+mk(c.spotAt,'ment','entry')+mk(c.t1,'mt1','T1')+mk(c.t2,'mt2','T2')+'</div>';
}
function zGatesHtml(gates){
  return '<div class="zgates">'+gates.map(g=>'<div class="zg '+(g.ok?'ok':'no')+'"><span>'+(g.ok?'\u2713':'\u2717')+'</span><b>'+g.n+'</b><i>'+g.txt+'</i></div>').join('')+'</div>';
}
function zCardHtml(c){
  const sideTag='<span class="tag '+(c.side>0?'long':'short')+'">'+(c.side>0?'LONG':'SHORT')+'</span>';
  const pk=c.peak&&c.entry?((c.peak-c.entry)/c.entry*100):0;
  const est=c.est||null;
  const d$=p=>'$'+Math.max(0,c.entry*(1+p/100)).toFixed(2);
  const cCell=p=>est?('<b class="'+(p>=0?'up':'dn')+'">'+d$(p)+'</b> <i>('+(p>=0?'+':'')+p+'%)</i>'):'<i>\u2014</i>';
  const spec='<div class="zspec">'+
    '<div><span>CONTRACT</span><b>'+c.sym+' '+String(c.e).slice(5)+' <em style="color:'+(c.call?'var(--green)':'var(--red)')+'">'+c.k+(c.call?'C':'P')+'</em> \u00b7 \u0394'+c.dlv+(c.spr!=null?' <i>\u00b7 spread '+c.spr+'%</i>':'')+'</b></div>'+
    '<div><span>FIRED</span><b>'+c.hm+' ET'+(est?' <i>\u00b7 ~'+est.eta+'m runway</i>':'')+' <i>\u00b7 '+(c.is0?'0DTE':'1DTE')+'</i></b></div>'+
    '<div><span>MARKS</span><b>last $'+(c.last!=null?c.last:'\u2014')+' <i>\u00b7 peak '+(pk>0?'+':'')+pk.toFixed(0)+'%</i></b></div>'+
    '</div>';
  const lvls='<table class="zlvls">'+
    '<tr><th>LEVEL</th><th>UNDERLYING</th><th>CONTRACT (EST)</th></tr>'+
    '<tr class="le"><td>ENTRY</td><td>'+c.spotAt+'</td><td><b>~$'+c.entry+'</b> <i>mid</i></td></tr>'+
    '<tr class="ls"><td>STOP</td><td>'+c.stop+'</td><td>'+cCell(est?est.ps:0)+'</td></tr>'+
    '<tr class="l1"><td>T1</td><td>'+c.t1+'</td><td>'+cCell(est?est.p1:0)+'</td></tr>'+
    '<tr class="l2"><td>T2</td><td>'+c.t2+'</td><td>'+cCell(est?est.p2:0)+'</td></tr>'+
    '<tr class="lr"><td>R:R</td><td>'+c.rrU+':1</td><td>'+(est&&est.rrP!=null?est.rrP.toFixed(2)+':1':'\u2014')+'</td></tr>'+
    '</table>';
  return '<div class="zcard">'+zStatusRibbon(c)+
    '<div class="zhead"><div><span class="card-sym">'+c.sym+'</span>'+sideTag+'<span class="zsetup">'+c.setup+'</span></div><div class="score">'+c.score+'</div></div>'+
    spec+zMapBar(c)+lvls+
    (c.gates?zGatesHtml(c.gates):'')+
    '<div style="display:flex;gap:5px;flex-wrap:wrap;margin:6px 0 3px">'+(c.drivers||[]).map(x=>'<span class="drv">'+x+'</span>').join('')+'</div>'+
    '<div class="zwhy">'+c.why+'</div>'+
    '<div class="zfoot">limit at mid, never market \u00b7 hard stop \u2212'+Z.PREM_STOP+'% premium or the structure stop \u2014 whichever first \u00b7 out by 15:30 ET</div>'+
    '</div>';
}
function zStandbyHtml(sym,r){
  const b=r.book;
  const mini=b&&b.king?('<div class="zrow mono" style="color:var(--muted)">spot '+(+b.spot).toFixed(b.spot>2000?0:2)+' \u00b7 King '+b.king.k+' \u00b7 CW '+(b.cw?b.cw.k:'\u2014')+' \u00b7 PW '+(b.pw?b.pw.k:'\u2014')+(b.flip?' \u00b7 flip '+(+b.flip).toFixed(b.spot>2000?0:1):'')+(b.em?' \u00b7 EM \u00b1'+(+b.em).toFixed(b.spot>2000?0:2):'')+'</div>'):'';
  return '<div class="zcard zstandby">'+
    '<div class="zhead"><div><span class="card-sym">'+sym+'</span><span class="zsetup">STANDING BY</span></div></div>'+
    mini+(r.gates&&r.gates.length?zGatesHtml(r.gates):'')+
    '<div class="zwhy">'+(r.standby||'evaluating\u2026')+'</div></div>';
}
function zRender(){
  const wrap=document.getElementById('zeroWrap');if(!wrap)return;
  const ph=zPhase();
  zRecord();zStatusTick();
  const clock=document.getElementById('zeroClock');
  if(clock)clock.textContent=ph.hm+' ET \u00b7 '+(ph.tag||'');
  let ages=[];Z.UNI.forEach(s=>{if(state.dataAge[s])ages.push(Date.now()-state.dataAge[s]);});
  const age=ages.length?Math.round(Math.min(...ages)/1000):null;
  let h='<div class="zstrip">'+
    '<span class="zchip '+(ph.block?'blk':'go')+'">'+ph.label+'</span>'+
    (ph.warn?'<span class="zchip warn">'+ph.warn+'</span>':'')+
    (age!=null?'<span class="zchip">chains ~'+age+'s old \u00b7 quotes ~10-20s</span>':'')+
    '<span class="zchip" data-tip="Rostered names are checked against Tradier\u2019s expiration list each session — the Mon/Wed/Fri single names qualify only on the days they actually list a same-day contract.">universe: '+Z.UNI.join(' ')+'</span>'+
    (zQualNote?'<span class="zchip">'+zQualNote+'</span>':'')+
    '<button class="zbtn" onclick="zExportCsv()">Export journal ('+zCount()+')</button>'+
    '</div>';
  const cards=[];
  for(const sym of Z.UNI){
    const list=state.zCards[sym]||[];
    const liveCard=list.find(c=>c.status==='LIVE');
    if(liveCard){cards.push({html:zCardHtml(liveCard),score:liveCard.score+1000});}
    else{
      const r=zeroRead(sym);
      if(r.fire){
        const recent=list.length&&Date.now()-list[list.length-1].firedAt<10*60000;
        if(!recent){const c=zFire(sym,{...r,gates:r.gates});cards.push({html:zCardHtml(c),score:c.score+1000});}
        else cards.push({html:zStandbyHtml(sym,{...r,standby:'setup valid but a card fired <10 min ago \u2014 cooling down'}),score:r.score||0});
      }
      else cards.push({html:zStandbyHtml(sym,r),score:0});
    }
    list.filter(c=>c.status!=='LIVE').slice(-2).reverse().forEach(c=>cards.push({html:zCardHtml(c),score:500}));
  }
  cards.sort((a,b)=>b.score-a.score);
  h+='<div class="zgrid">'+cards.map(c=>c.html).join('')+'</div>';
  h+='<div class="zhon"><span class="nfa-min">NFA</span> <b>RISK PROTOCOL</b> \u2014 0DTE is the highest-gamma, highest-theta contract on the board: positions can go +100%/\u2212100% in minutes. Risk \u22640.5\u20131% of the account per card and size off max loss (the full premium), not off the stop. Hard stop \u2212'+Z.PREM_STOP+'% premium or the structure stop; '+Z.TIME_STOP+'-minute time stop if T1 hasn\u2019t printed; never add to a loser; two stops = done for the day; flat by 15:30 ET. This engine sees dealer structure and tape \u2014 it does NOT see the econ calendar (10:00/14:00 releases) or headlines. Cards are context to grade your own read, not signals. No backtest exists yet \u2014 paper trade it and grade the journal first.</div>';
  wrap.innerHTML=h;
}

/* ---- feed loop: keep the universe fresh while the tab is open ---- */
let zFeeding=false,zLastFeed=0,zLastQ=0;
async function zFeed(force){
  if(zFeeding||state.refreshing)return;
  const ph=zPhase();
  if(!force&&(ph.closed||!zVisible()||Date.now()-zLastFeed<70000))return;
  zFeeding=true;zLastFeed=Date.now();
  try{
    await zQualify(false);
    if(liveOn()){
      try{const qs=await fetchQuotes(Z.UNI);Z.UNI.forEach(s=>{const u=underOf(s);if(qs[u])state.spot[s]=qs[u];});}catch(e){}
    }
    for(const s of Z.UNI){
      if(state.refreshing)break;
      const ch=state.chains[s];
      if(ch&&ch.t&&Date.now()-ch.t<85000)continue;
      try{const r=await getSym(s,3,false);if(r){state.data[s]=r;state.dataAge[s]=Date.now();}}catch(e){}
      await new Promise(r2=>setTimeout(r2,80));
    }
    zRecord();
    for(const s of Z.UNI){try{await getTech(s);}catch(e){}}
  }finally{zFeeding=false;}
  if(zVisible())zRender();
}
setInterval(function(){
  zRecord();zStatusTick();
  if(zVisible())zRender();
},15000);
setInterval(function(){zFeed(false);},30000);
setInterval(async function(){
  if(!zVisible()||state.refreshing)return;
  if(!liveOn())return;
  const ph=zPhase();if(ph.closed)return;
  if(Date.now()-zLastQ<18000)return;zLastQ=Date.now();
  try{const qs=await fetchQuotes(Z.UNI);Z.UNI.forEach(s=>{const u=underOf(s);if(qs[u])state.spot[s]=qs[u];});zRecord();}catch(e){}
},20000);

/* ---- tab wiring + refresh hook ---- */
state.zTab='swing';
function zSetTab(t){
  state.zTab=t;
  const _ms=document.getElementById('swModeSel');if(_ms)_ms.classList.toggle('hidden',t==='zero');
  document.querySelectorAll('#aetherTabs button').forEach(b=>b.classList.toggle('on',b.dataset.a===t));
  const cardsEl=document.getElementById('cards'),zw=document.getElementById('zeroWrap'),ck=document.getElementById('zeroClock');
  if(cardsEl)cardsEl.classList.toggle('hidden',t!=='swing');
  if(zw)zw.classList.toggle('hidden',t!=='zero');
  if(ck)ck.classList.toggle('hidden',t!=='zero');
  if(t==='zero'){zRender();zFeed(true);}
  else if(typeof renderCards==='function')renderCards();
}
(function(){
  const tabs=document.getElementById('aetherTabs');
  if(tabs)tabs.querySelectorAll('button').forEach(bt=>{bt.onclick=function(){zSetTab(bt.dataset.a);};});
})();
(function(){
  const __r=refresh;
  refresh=async function(force){
    const out=await __r(force);
    try{zRecord();if(zVisible()){zStatusTick();zRender();}else zStatusTick();}catch(e){console.warn('zero',e);}
    return out;
  };
})();
window.KairosZero={Z,zPhase,zBook,zeroRead,zPick,zModel,zMom,zRecord,zFire,zStatusTick,zExportCsv,zRender,zSetTab,bsPrice,bsDelta,nCdf,log:function(){return zLog;}};
console.log('%cKairos Zero armed \u2014 0DTE/1DTE engine on the 0DTE-only dealer book. Long premium only, defined risk, journaled fires. Context, not signals.','color:#22d3ee;font-weight:bold');



/* =====================================================================
   KAIROS NEXUS v4 — THE CHRONICLE  (v8.0)

   What changed from v3 and why:

   v3 fixed the axes — exposure on price, time to the tape — but froze the
   clock: a 30-minute window, no memory. v4 gives Nexus a memory and makes
   it a real chart:

     THE CHRONICLE  the field now varies over TIME. Every ~60s (and on
                    every chain refresh) the full strike ladder's GEX+VEX
                    is recorded as a column. Past columns render as the
                    field AS IT WAS — walls visibly building and decaying.
                    Columns persist to IndexedDB (~30 sessions kept), so a
                    reload keeps the day. Before the first recorded column
                    the plot shows tape only — no field is invented.
     THE WINDOW     30M / 1H / 2H / DAY / 5D chips. Drag to pan, wheel to
                    zoom, double-click to snap back live. 5D pulls deep
                    1-min history (Tradier serves 20 days of 1-min bars).
     TRADING TIME   overnight/weekend gaps compress to a thin seam instead
                    of 17 hours of dead pixels. Same mapping for tape,
                    field and grid.
     CANDLES        timesales OHLC is now kept, not discarded. Optional
                    1-min candle layer under the trace (auto-hides when
                    bars go sub-3px).
     THE LENS       hover inspector — NY clock time, price, nearest bar,
                    and the recorded exposure of the nearest strike at
                    that moment. Read the field like a chart.

   Honesty rules unchanged: recorded columns are the same re-priced
   Black-Scholes field the ladder shows, captured at real times, only
   while a Kairos tab is open. OI inside them is still OCC prior-close.
   The Reach, Standard, particles and key levels are CURRENT-state
   objects: they draw only at the live edge, and key levels dim when you
   pan into the past. Nothing here is a signal.
   ===================================================================== */
'use strict';
const AR={SPAN:30*60000,FWD:18,NOWF:0.62,MINR:0.04,MAXP:150,TOPB:4,TOPN:11,
          PADL:44,PADR:118,PADY:22,
          WINMIN:5,WINMAX:2400,COLS_MEM:2800,KEEP_DAYS:7,DEEP_DAYS:9,
          GAPMS:20*60000,GAPW:4*60000,REC_MS:60000};
let aRaf=0,aT=0,aTweenSpot=null,aParts=[],aBursts=[],aShake=0,aHudT=0,aStamp='',aSeen={},aPrevReg=null,aRegFlash=0;
let aTrail={},aHistT={},aBloom=null,aScan=0;
let aWin=Math.max(AR.WINMIN,Math.min(AR.WINMAX,parseInt(localStorage.getItem('kairos_nx_win'))||30));
let aPan=0,aCandle=localStorage.getItem('kairos_nx_candle')==='1';
let aCandleInt=parseInt(localStorage.getItem('kairos_nx_candleint'))||0; /* 0=auto, else minutes */
let aMouse=null,aDrag=null,aVM=null,aDeepT={};
let aField={},aFieldStamp={},aFieldT={},aFCv=null,aFKey='';
let aRecon={},aReconKey={},aReconBusy={},aTracks=[];
let aYC=null,aYH=null,aSceneClk=0,aEdgeF=null;
let aYManual=false,aYCenterM=null,aYHalfM=null,aFocusSym=null;
let aDB=null,aDBLoaded={};
const aReduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const aBlurOK=(function(){try{const c=document.createElement('canvas').getContext('2d');c.filter='blur(2px)';return c.filter==='blur(2px)';}catch(e){return false;}})();

function aCv(){return document.getElementById('arenaCanvas');}
function aStop(){if(aRaf){cancelAnimationFrame(aRaf);aRaf=0;}}
function aStart(){aStop();aT=0;if(aFocusSym!==state.focus){aYManual=false;aYCenterM=null;aYHalfM=null;aPan=0;}aFocusSym=state.focus;aHist(state.focus,aWin>420);aDBLoad(state.focus);aHydrateField(state.focus);setTimeout(function(){aReconBuild(state.focus);},1500);if(aReduce){aDraw(0);aHud(true);return;}aRaf=requestAnimationFrame(aFrame);}
/* pull the server-side field Chronicle (accumulated 24/5) into aField so the
   history is populated even if this browser never recorded it — and so REPLAY
   has a full session to scrub through. Merges with any local columns. */
async function aHydrateField(sym){
  if(!sym||!window.KairosBackend||!window.KairosBackend.enabled)return;
  try{
    const cols=await window.KairosBackend.fieldColumns(sym);
    if(!cols||!cols.length)return;
    const cur=aField[sym]||[];const seen=new Set(cur.map(c=>c.t));
    for(const c of cols){
      const t=c.t*1000; // server stores unix seconds
      if(seen.has(t))continue;
      // server nodes: [{k,g}] -> the field expects {t, ks[], g[], v[], spot, r}
      const ks=c.nodes.map(n=>n.k), g=c.nodes.map(n=>n.g), v=c.nodes.map(()=>0);
      cur.push({t,ks,g,v,spot:c.spot,r:false,srv:true});
      seen.add(t);
    }
    cur.sort((a,b)=>a.t-b.t);
    aField[sym]=cur.slice(-AR.COLS_MEM);
    aFKey='';  // force field-canvas rebuild
  }catch(e){}
}
function aFrame(ts){
  if(aFocusSym!==null&&aFocusSym!==state.focus){aStart();return;}
  const dt=aT?Math.min(0.05,(ts-aT)/1000):0.016;aT=ts;
  aDraw(dt);
  if(ts-aHudT>420){aHudT=ts;aHud(false);}
  aRaf=requestAnimationFrame(aFrame);
}
function aSpanMs(){return Math.max(AR.WINMIN,Math.min(AR.WINMAX,aWin))*60000;}

/* ---- real intraday history ----
   v4: keeps full OHLC per bar (v3 threw away everything but close), MERGES
   new pulls into the existing trail instead of clobbering it (so a deep
   multi-day pull survives the 2-minute shallow refresh), and can fetch
   AR.DEEP_DAYS calendar days back — Tradier serves 20 days of 1-min bars. */
function aNY(d){
  try{
    const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d);
    const g=t=>{const x=p.find(v=>v.type===t);return x?x.value:'00';};
    return g('year')+'-'+g('month')+'-'+g('day')+' '+(g('hour')==='24'?'00':g('hour'))+':'+g('minute');
  }catch(e){return '';}
}
function aClk(t){
  try{return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',hour12:false}).format(new Date(t));}
  catch(e){return '';}
}
function aDayLab(t){
  try{return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short'}).format(new Date(t));}
  catch(e){return '';}
}
async function aHist(sym,deep){
  if(!sym)return;
  if(!liveOn())return;
  const key=sym+(deep?'|d':'');
  if(aHistT[key]&&Date.now()-aHistT[key]<(deep?600000:120000))return;
  aHistT[key]=Date.now();
  const u=underOf(sym);
  try{
    const s=aNY(new Date(Date.now()-(deep?AR.DEEP_DAYS*86400000:9*3600000))),e=aNY(new Date());
    if(!s||!e)return;
    const j=await tFetch('/markets/timesales?symbol='+encodeURIComponent(u)+'&interval=1min&start='+encodeURIComponent(s)+'&end='+encodeURIComponent(e)+'&session_filter=open');
    let dd=j&&j.series&&j.series.data;if(!dd)return;
    if(!Array.isArray(dd))dd=[dd];
    const map=new Map((aTrail[sym]||[]).map(b=>[b.t,b]));
    for(const b of dd){
      const t=b.timestamp?b.timestamp*1000:0,px=+(b.close||b.price||0);
      if(!(t&&px>0))continue;
      map.set(t,{t,px,o:+b.open||null,h:+b.high||null,l:+b.low||null});
    }
    if(map.size)aTrail[sym]=[...map.values()].sort((a,b)=>a.t-b.t).slice(-6000);
  }catch(e){}
}
/* ---- candle aggregation: roll the 1-min trail into N-minute OHLC ----
   Bars align to wall-clock boundaries (e.g. :00/:05/:10 for 5-min) so they
   match any external chart. Auto mode picks the smallest interval whose bars
   render >=4px wide for the current window, so CANDLE always shows candles. */
const NX_INTS=[1,5,10,30,60];
function aAutoInt(pxPerMin){
  for(const m of NX_INTS){if(pxPerMin*m>=4)return m;}
  return 60;
}
function aCandles(sym,intMin){
  const src=(aTrail[sym]||[]);
  if(!src.length)return [];
  if(intMin<=1)return src.filter(b=>b.o!=null);
  const ms=intMin*60000,buk=new Map();
  for(const b of src){
    if(b.px==null)continue;
    const key=Math.floor(b.t/ms)*ms;
    let g=buk.get(key);
    const o=b.o!=null?b.o:b.px,h=b.h!=null?b.h:b.px,l=b.l!=null?b.l:b.px;
    if(!g){buk.set(key,{t:key,o,h,l,px:b.px,_last:b.t});}
    else{g.h=Math.max(g.h,h);g.l=Math.min(g.l,l);if(b.t>=g._last){g.px=b.px;g._last=b.t;}}
  }
  return [...buk.values()].sort((a,b)=>a.t-b.t);
}
function aPath(sym){
  const h=aTrail[sym]||[],l=(state.zTape||{})[sym]||[];
  const all=h.concat(l).sort((a,b)=>a.t-b.t);
  const out=[];
  for(const p of all){if(!out.length||p.t-out[out.length-1].t>1500)out.push(p);}
  const sp=state.spot[sym],now=Date.now();
  if(sp&&out.length&&now-out[out.length-1].t>1500&&now-out[out.length-1].t<5*60000)out.push({t:now,px:sp});
  else if(sp&&!out.length)out.push({t:now,px:sp});
  return out;
}

/* ---- TRADING TIME: session-gap compression ----
   A monotonic map t <-> tt. Real trading time passes 1:1; any gap longer
   than GAPMS (overnight, weekend, halt) is compressed to GAPW of visual
   time. Built from the actual bar timestamps, so it never invents a
   session that didn't trade. Tape, field, grid and mouse all share it. */
function aTTBuild(sym){
  const p=aPath(sym);
  const segs=[];let s=null;
  for(const b of p){
    if(!s||b.t-s.t1>AR.GAPMS){s={t0:b.t,t1:b.t};segs.push(s);}
    else if(b.t>s.t1)s.t1=b.t;
  }
  if(!segs.length){const n=Date.now();segs.push({t0:n-aSpanMs(),t1:n});}
  let acc=0;
  for(let i=0;i<segs.length;i++){
    segs[i].tt0=acc+(i?AR.GAPW:0);
    acc=segs[i].tt0+(segs[i].t1-segs[i].t0);
  }
  const fwd=t=>{
    if(t<=segs[0].t0)return segs[0].tt0-(segs[0].t0-t);
    for(let i=0;i<segs.length;i++){
      const g=segs[i];
      if(t<=g.t1)return g.tt0+Math.max(0,t-g.t0);
      const nx=segs[i+1];
      if(!nx||t<nx.t0)return g.tt0+(g.t1-g.t0)+(nx?Math.min(AR.GAPW,AR.GAPW*(t-g.t1)/Math.max(1,nx.t0-g.t1)):(t-g.t1));
    }
    const L=segs[segs.length-1];return L.tt0+(t-L.t0);
  };
  const inv=tt=>{
    if(tt<=segs[0].tt0)return segs[0].t0-(segs[0].tt0-tt);
    for(let i=0;i<segs.length;i++){
      const g=segs[i],w=g.t1-g.t0;
      if(tt<=g.tt0+w)return g.t0+(tt-g.tt0);
      const nx=segs[i+1];
      if(!nx||tt<nx.tt0)return g.t1+(nx?(tt-g.tt0-w)/AR.GAPW*Math.max(1,nx.t0-g.t1):(tt-g.tt0-w));
    }
    const L=segs[segs.length-1];return L.t0+(tt-L.tt0);
  };
  return{segs,fwd,inv,first:segs[0].t0};
}

/* ---- THE CHRONICLE: field history recorder + IndexedDB ----
   Every REC_MS (and immediately on a fresh chain stamp) the FULL ladder —
   every strike's GEX and VEX plus spot — is captured for the focus and
   Triad symbols. Float32 columns: a SPY column is ~2 KB, a 5-expiry SPX
   column ~6 KB. In-memory ring of COLS_MEM columns per symbol; every
   column also lands in IndexedDB (store 'cols'), pruned past KEEP_DAYS
   sessions. Recording runs whenever the tab is open, whatever view is up,
   so the Chronicle builds while you work the Triad. */
function aDBOpen(){
  return new Promise(res=>{
    try{
      const rq=indexedDB.open('kairos-nexus',1);
      rq.onupgradeneeded=e=>{
        const db=e.target.result;
        const st=db.createObjectStore('cols',{keyPath:'id',autoIncrement:true});
        st.createIndex('sd',['sym','day']);st.createIndex('day','day');
      };
      rq.onsuccess=e=>res(e.target.result);
      rq.onerror=()=>res(null);rq.onblocked=()=>res(null);
    }catch(e){res(null);}
  });
}
(async function(){
  aDB=await aDBOpen();
  if(!aDB)return;
  try{ /* prune sessions older than KEEP_DAYS (day keys are YYYY-MM-DD → lexicographic) */
    const cut=(function(){const d=new Date(Date.now()-AR.KEEP_DAYS*86400000);const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());})();
    const ix=aDB.transaction('cols','readwrite').objectStore('cols').index('day');
    ix.openCursor(IDBKeyRange.upperBound(cut,true)).onsuccess=e=>{const c=e.target.result;if(c){c.delete();c.continue();}};
  }catch(e){}
  aDBLoad(state.focus);
})();
function aDBLoad(sym){
  if(!aDB||!sym||aDBLoaded[sym])return;
  aDBLoaded[sym]=1;
  try{
    const days=[];for(let i=0;i<7;i++){const d=new Date(Date.now()-i*86400000);const p=n=>String(n).padStart(2,'0');days.push(d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()));}
    const st=aDB.transaction('cols','readonly').objectStore('cols').index('sd');
    const got=[];let pend=days.length;
    days.forEach(day=>{
      st.getAll(IDBKeyRange.only([sym,day])).onsuccess=e=>{
        (e.target.result||[]).forEach(r=>got.push(r));
        if(--pend===0){
          const cur=aField[sym]||[],seen=new Set(cur.map(c=>c.t));
          for(const r of got)if(!seen.has(r.t))cur.push({t:r.t,ks:r.ks,g:r.g,v:r.v,spot:r.spot});
          cur.sort((a,b)=>a.t-b.t);
          aField[sym]=cur.slice(-AR.COLS_MEM);
          aFKey='';
        }
      };
    });
  }catch(e){}
}
function aDBPut(sym,col){
  if(!aDB)return;
  try{
    const day=(function(){const d=new Date(col.t);const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());})();
    aDB.transaction('cols','readwrite').objectStore('cols').put({sym,day,t:col.t,ks:col.ks,g:col.g,v:col.v,spot:col.spot});
  }catch(e){}
}
/* ---- THE ECHO: reconstructed field for today's session ----
   OI is OCC prior-settlement and does NOT change intraday — the standing
   book was the same at 09:31 as it is now. So the field at any earlier
   minute today is computable: the same bsGamma/bsVanna x OI x dealer-sign
   pipeline core runs live, evaluated at that minute's real 1-min spot with
   T rolled back. Stated plainly: IV is the current snapshot (intraday IV
   drift is not replayed) and the basis is OI (past-time volume is
   unknowable). Reconstructed columns render dimmer, are tagged .recon in
   the Lens, and are NEVER persisted — recorded columns always win where
   both exist. Prior days: recorded columns only. Built in 12ms idle slices. */
function aReconBuild(sym){
  const d=state.data[sym];
  if(!d||!d.contracts||!d.contracts.length||!d.strikes||!d.strikes.length)return;
  if(aReconBusy[sym])return;
  const cfg=sym+'|'+state.expiry+'|'+state.dealerMode+'|'+(d.chStamp||0);
  if(aReconKey[sym]===cfg&&(aRecon[sym]||[]).length)return;
  const TT=aTTBuild(sym),seg=TT.segs[TT.segs.length-1];
  const bars=(aTrail[sym]||[]).filter(b=>b.t>=seg.t0);
  if(bars.length<5)return;
  aReconBusy[sym]=1;
  const ksArr=[...new Set(d.strikes.map(x=>x.k))].sort((a,b)=>a-b);
  const idx=new Map(ksArr.map((k,i)=>[k,i]));
  const cons=d.contracts.filter(c=>idx.has(c.k)&&c.oi&&c.iv>0.01&&c.iv<5);
  if(!cons.length){aReconBusy[sym]=0;return;}
  const ref=d.chStamp||Date.now(),YR=365*86400000;
  const step=Math.max(1,Math.round(bars.length/200));
  const ksF=Float32Array.from(ksArr),out=[];
  let bi=0;
  const chunk=()=>{
    const t1=performance.now();
    for(;bi<bars.length&&performance.now()-t1<12;bi+=step){
      const b=bars[bi],S=b.px;
      if(!(S>0))continue;
      const gmult=100*S*S*0.01,vmult=100*S*0.01,n=ksArr.length;
      const gu=new Float64Array(n),ga=new Float64Array(n),vu=new Float64Array(n),va=new Float64Array(n);
      for(const c of cons){
        const T=Math.max(1e-6,c.T+(ref-b.t)/YR);
        const g=bsGamma(S,c.k,c.iv,T),van=bsVanna(S,c.k,c.iv,T);
        const i=idx.get(c.k),sg=c.call?1:-1;
        gu[i]+=sg*g*c.oi;ga[i]+=g*c.oi;vu[i]+=sg*van*c.oi;va[i]+=van*c.oi;
      }
      const g32=new Float32Array(n),v32=new Float32Array(n);
      for(let i=0;i<n;i++){g32[i]=dealerAdj(gu[i],ga[i])*gmult;v32[i]=dealerAdj(vu[i],va[i])*vmult;}
      out.push({t:b.t,ks:ksF,g:g32,v:v32,spot:S,r:1});
    }
    if(bi<bars.length)setTimeout(chunk,0);
    else{aRecon[sym]=out;aReconKey[sym]=cfg;aReconBusy[sym]=0;aFKey='';}
  };
  setTimeout(chunk,0);
}
function aRec(){
  if(document.hidden)return;
  const syms=new Set([state.focus].concat(state.trinityTickers||[]));
  const now=Date.now();
  for(const sym of syms){
    const d=state.data[sym];
    if(!d||!d.strikes||!d.strikes.length)continue;
    const stamp=state.dataAge[sym]||0;
    const fresh=stamp!==(aFieldStamp[sym]||0);
    if(!fresh&&now-(aFieldT[sym]||0)<AR.REC_MS-3000)continue;
    aFieldStamp[sym]=stamp;aFieldT[sym]=now;
    const n=d.strikes.length,ks=new Float32Array(n),g=new Float32Array(n),v=new Float32Array(n);
    const sorted=[...d.strikes].sort((a,b)=>a.k-b.k);
    for(let i=0;i<n;i++){ks[i]=sorted[i].k;g[i]=sorted[i].gex||0;v[i]=sorted[i].vex||0;}
    const col={t:now,ks,g,v,spot:state.spot[sym]||d.spot||0};
    (aField[sym]=aField[sym]||[]).push(col);
    if(aField[sym].length>AR.COLS_MEM)aField[sym].splice(0,aField[sym].length-AR.COLS_MEM);
    aDBPut(sym,col);
    if(sym===state.focus)aFKey='';
  }
  if(state.data[state.focus])aReconBuild(state.focus);
}
setInterval(aRec,15000);

/* ---- scene ---- */
function aScene(){
  const sym=state.focus,d=state.data[sym];
  if(!d||!d.strikes||!d.strikes.length)return null;
  const metric=state.metric,spot=state.spot[sym]||d.spot;
  if(!spot)return null;
  const ps=panelStats(sym,d,metric);
  const kg=kingOf(d.strikes,metric),cw=callWallBand(d.strikes,spot,metric),pw=putWallBand(d.strikes,spot,metric);
  let maxAbs=1;
  for(const s of d.strikes){const a=Math.abs(mval(s,metric));if(a>maxAbs)maxAbs=a;}
  const full=aPath(sym),now=Date.now();
  const last=full.length?full[full.length-1].t:now;
  const live=(now-last)<=5*60000;
  const anchor=live?now:last;                 /* closed market: anchor to the last real bar */
  const TT=aTTBuild(sym);
  let span=aSpanMs();
  const ttAnchor=TT.fwd(anchor),ttFirst=TT.fwd(TT.first);
  /* DATA-FIT: the trading-time width of everything we actually have. Early in a
     session (or before history lands) the requested window (e.g. DAY=390m) is
     far wider than the data, which crushed the tape into a right-edge sliver.
     When not panned, shrink the span to fit the data (plus a little breathing
     room on the right), but never below a sane floor so a handful of ticks
     still reads. This is what makes the chart populate from history. */
  const dataTT=Math.max(0,ttAnchor-ttFirst);
  if(aPan<30000&&dataTT>0){
    const floor=Math.min(span,20*60000);           // at least ~20 min of view
    const fit=Math.max(floor,dataTT*1.08);          // fit data + 8% right margin
    span=Math.min(span,fit);                        // never wider than requested
  }
  const maxPan=Math.max(0,ttAnchor-ttFirst-span*0.25);
  if(aPan>maxPan)aPan=maxPan;if(aPan<0)aPan=0;
  const isNow=aPan<30000;
  const ttHi=ttAnchor-aPan,ttLo=ttHi-span;
  const t0=TT.inv(ttLo),tEnd=TT.inv(ttHi);
  const path=full.filter(p=>p.t>=t0-90000&&p.t<=tEnd+90000);
  let bestT=null;
  for(const c of (d.contracts||[])){if(bestT===null||c.T<bestT)bestT=c.T;}
  const dteMin=bestT?Math.max(1,bestT*525600):null;
  /* y-range: live short windows center on spot; wide/panned windows fit the visible tape */
  let mn=Infinity,mx=-Infinity;
  for(const p of path){if(p.px<mn)mn=p.px;if(p.px>mx)mx=p.px;if(p.l&&p.l<mn)mn=p.l;if(p.h&&p.h>mx)mx=p.h;}
  const wide=!isNow||span>90*60000;
  let center=(wide&&isFinite(mn)&&mx>mn)?(mn+mx)/2:spot;
  let half=Math.max(ps.em?ps.em*1.25:spot*0.008,spot*0.005);
  if(isFinite(mn)&&mx>mn)half=Math.max(half,(center-mn)*1.15,(mx-center)*1.15);
  if(isNow){
    [kg,cw,pw].forEach(n2=>{if(n2&&Math.abs(n2.k-spot)<spot*0.03)half=Math.max(half,Math.abs(n2.k-center)*1.12);});
    if(ps.fl!=null&&Math.abs(ps.fl-spot)<spot*0.03)half=Math.max(half,Math.abs(ps.fl-center)*1.1);
  }
  /* tween the y-range — recentering (spot<->path, threshold crossings) glides
     instead of snapping, which was most of the "buggy" feel while scrolling */
  const nowClk=Date.now();
  const tdt=aSceneClk?Math.min(0.2,(nowClk-aSceneClk)/1000):0;aSceneClk=nowClk;
  if(aYManual&&aYCenterM!=null){aYC=aYCenterM;aYH=Math.max(spot*0.0012,aYHalfM);}
  else if(aYC===null||aYH===null||aReduce){aYC=center;aYH=half;}
  else{const kk=Math.min(1,tdt*4.5);aYC+=(center-aYC)*kk;aYH+=(half-aYH)*kk;}
  const lo=aYC-aYH,hi=aYC+aYH;
  const ranks=[];
  for(const s of d.strikes){
    if(s.k<lo||s.k>hi)continue;
    const v=mval(s,metric),r=Math.abs(v)/maxAbs;
    if(r<AR.MINR)continue;
    ranks.push({k:s.k,v,r,king:!!(kg&&s.k===kg.k),dl:deltaOf(sym,s.k,v,maxAbs,metric)});
  }
  ranks.sort((a,b)=>b.r-a.r);
  return{sym,d,metric,spot,ps,kg,cw,pw,maxAbs,lo,hi,ranks,path,tEnd,t0,live,dteMin,
         TT,span,ttLo,ttHi,isNow,anchor};
}

/* ---- time-at-price (real minutes the path spent per bucket, this window) ---- */
function aProfile(sc,BK){
  const h=new Array(BK).fill(0),p=sc.path;
  if(p.length<2)return h;
  const span=(sc.hi-sc.lo)||1;
  for(let i=1;i<p.length;i++){
    const dtm=Math.min(120000,p[i].t-p[i-1].t);
    const b=Math.floor((p[i].px-sc.lo)/span*BK);
    if(b>=0&&b<BK)h[b]+=dtm;
  }
  return h;
}
/* ±1σ implied by ATM IV m minutes forward */
function aSigma(sc,m){
  if(!sc.ps.em||!sc.dteMin)return 0;
  return sc.ps.em*Math.sqrt(Math.max(0,Math.min(1,m/sc.dteMin)));
}

/* ---- CHRONICLE paint: historical field columns on an offscreen canvas ----
   Rebuilt only when the viewport or the newest column changes — never per
   frame. Intensity is normalised against the max |exposure| across every
   visible column AND the live ladder, so you can watch a wall build or
   bleed out in absolute terms across the day. */
function aFieldPaint(sc,pw2,ph,xOfT,edgeX,plotL){
  const t0=sc.t0,t1=sc.tEnd;
  const rec=[],rc=[];
  for(const c of (aField[sc.sym]||[]))if(c.t>=t0-AR.REC_MS*2&&c.t<=t1+1000)rec.push(c);
  for(const c of (aRecon[sc.sym]||[]))if(c.t>=t0-AR.REC_MS*2&&c.t<=t1+1000)rc.push(c);
  /* recorded columns win; reconstructed fill only where nothing was recorded */
  const vis=rec.slice();
  let ri=0;
  for(const c of rc){
    while(ri<rec.length&&rec[ri].t<c.t-75000)ri++;
    if(ri<rec.length&&Math.abs(rec[ri].t-c.t)<75000)continue;
    if(ri>0&&Math.abs(rec[ri-1].t-c.t)<75000)continue;
    vis.push(c);
  }
  vis.sort((a,b)=>a.t-b.t);
  const liveB=sc.isNow?Math.floor(Date.now()/5000):0;
  const key=sc.sym+'|'+sc.metric+'|'+sc.lo.toFixed(3)+'|'+sc.hi.toFixed(3)+'|'+sc.ttLo.toFixed(0)+'|'+sc.span+'|'+pw2+'x'+ph+'|'+(vis.length?vis[vis.length-1].t:0)+'|'+rec.length+'.'+rc.length+'|'+(state.dataAge[sc.sym]||0)+'|'+liveB;
  if(aFCv&&aFKey===key)return aFCv;
  if(aDrag&&aFCv&&Date.now()-(aFieldPaint._t||0)<90)return aFCv;  /* don't rebuild 60fps mid-drag */
  aFieldPaint._t=Date.now();
  aFKey=key;
  if(!aFCv)aFCv=document.createElement('canvas');
  if(aFCv.width!==pw2||aFCv.height!==ph){aFCv.width=pw2;aFCv.height=ph;}
  const fx=aFCv.getContext('2d');
  fx.clearRect(0,0,pw2,ph);
  const TEAL='45,212,191',MAG='192,84,247';
  let gMax=sc.maxAbs;
  const pick=c=>sc.metric==='vex'?c.v:c.g;
  for(const c of vis){const a=pick(c);for(let i=0;i<a.length;i++){const x=Math.abs(a[i]);if(x>gMax)gMax=x;}}
  /* structure tracks + net series for the sub-pane, one pass per rebuild */
  aTracks=vis.map(c=>{
    const vals=pick(c);
    let king=null,ka=0,cw=null,cv=-Infinity,pw=null,pv=Infinity,net=0;
    const sp=c.spot||sc.spot;
    for(let i=0;i<c.ks.length;i++){
      const v=vals[i],k=c.ks[i],av=Math.abs(v);
      if(av>ka){ka=av;king=k;}
      if(v>cv){cv=v;cw=k;}
      if(v<pv){pv=v;pw=k;}
      if(sp&&Math.abs(k-sp)<=sp*0.01)net+=v;
    }
    return{t:c.t,king,cw:cv>0?cw:null,pw:pv<0?pw:null,net,r:!!c.r};
  });
  const strip=(x0,x1,ks,vals,mul)=>{
    if(x1-x0<0.5)return;
    const fg=fx.createLinearGradient(0,0,0,ph);
    let started=false;
    for(let i=0;i<ks.length;i++){
      if(ks[i]<sc.lo||ks[i]>sc.hi)continue;
      const pos=Math.max(0,Math.min(1,(sc.hi-ks[i])/((sc.hi-sc.lo)||1)));
      const val=vals[i],r=Math.abs(val)/gMax;
      // gentler alpha curve (sqrt) so mid-strength nodes are visible without the
      // whole field turning into a solid slab; lower floor keeps empties dark.
      const a=(0.04+Math.sqrt(r)*0.52)*(mul||1);
      fg.addColorStop(pos,'rgba('+(val>=0?TEAL:MAG)+','+a.toFixed(3)+')');
      started=true;
      /* zero-crossing seam: the field genuinely cancels there */
      for(let j=i+1;j<ks.length;j++){
        if(ks[j]<sc.lo||ks[j]>sc.hi)continue;
        if(val*vals[j]<0){
          const p2=Math.max(0,Math.min(1,(sc.hi-(ks[i]+ks[j])/2)/((sc.hi-sc.lo)||1)));
          fg.addColorStop(Math.min(1,Math.max(0,p2)),'rgba(9,11,18,0.015)');
        }
        break;
      }
    }
    if(!started)return;
    fx.fillStyle=fg;fx.fillRect(x0,0,x1-x0,ph);
  };
  for(let i=0;i<vis.length;i++){
    const c=vis[i];
    const x0=Math.max(0,xOfT(c.t)-plotL);
    const nxT=i<vis.length-1?vis[i+1].t:sc.tEnd;
    const x1=Math.min(edgeX-plotL,xOfT(Math.min(nxT,sc.tEnd))-plotL);
    /* overlap each strip 0.75px into the next so adjacent columns blend instead
       of showing hard vertical seams — this is most of what read as "blocky". */
    strip(x0,x1+0.75,c.ks,pick(c),c.r?0.86:1);
  }
  /* live edge: from the newest column to the edge, the CURRENT ladder */
  const liveFrom=vis.length?Math.max(0,xOfT(vis[vis.length-1].t)-plotL):null;
  if(sc.isNow){
    const band=[...sc.d.strikes].sort((a,b)=>a.k-b.k);
    const ks=band.map(s=>s.k),vals=band.map(s=>mval(s,sc.metric));
    strip(liveFrom==null?0:liveFrom,edgeX-plotL,ks,vals,1);
    if(liveFrom==null&&!vis.length){
      /* no history at all yet (first minutes of a fresh install): the whole
         window shows the current field — same as v3 — but dimmed left of
         the live edge so it reads as assumed, not recorded */
      const dg=fx.createLinearGradient(0,0,edgeX-plotL,0);
      dg.addColorStop(0,'rgba(5,7,12,.55)');dg.addColorStop(1,'rgba(5,7,12,0)');
      fx.fillStyle=dg;fx.fillRect(0,0,edgeX-plotL,ph);
    }
  }
  return aFCv;
}

/* ---- draw ---- */
function aDraw(dt){
  const cv=aCv();if(!cv)return;
  const ctx=cv.getContext('2d');
  const dpr=Math.min(devicePixelRatio||1,2);
  const W=cv.clientWidth||900,H=cv.clientHeight||480;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  const sc=aScene();
  const wait=document.getElementById('arenaWait');
  if(!sc){if(wait)wait.classList.remove('hidden');return;}
  if(wait)wait.classList.add('hidden');

  const TEAL='45,212,191',MAG='192,84,247',CYAN='34,211,238',GOLD='242,193,78';
  const pos=sc.ps.net1>=0;
  if(aPrevReg!==null&&aPrevReg!==pos)aRegFlash=1;
  aPrevReg=pos;aRegFlash=Math.max(0,aRegFlash-dt*0.7);
  if(aTweenSpot===null)aTweenSpot=sc.spot;
  const gap=sc.spot-aTweenSpot;
  if(sc.ps.em&&Math.abs(gap)>sc.ps.em*0.1)aShake=Math.min(1,aShake+Math.abs(gap)/(sc.ps.em||1)*0.4);
  aTweenSpot+=gap*Math.min(1,dt*3.2);
  aShake=Math.max(0,aShake-dt*1.5);

  const plotL=AR.PADL,plotR=W-AR.PADR;
  /* live: reserve the right block for the Reach. Panned: the past gets the whole
     plot — TWEENED, so crossing the live threshold slides instead of jumping. */
  const edgeTarget=sc.isNow?AR.NOWF:1;
  if(aEdgeF===null||aReduce)aEdgeF=edgeTarget;
  else{aEdgeF+=(edgeTarget-aEdgeF)*Math.min(1,dt*6);if(Math.abs(aEdgeF-edgeTarget)<0.004)aEdgeF=edgeTarget;}
  const nowX=plotL+(plotR-plotL)*aEdgeF;
  const edgeX=nowX;
  /* sub-pane: net exposure through time (skipped on very short canvases) */
  const SUBH=H>=430?86:0,AXH=SUBH?26:0;
  const mainB=H-AR.PADY-SUBH-AXH;
  const pxPerTT=(edgeX-plotL)/sc.span;
  const xOf=t=>plotL+(sc.TT.fwd(t)-sc.ttLo)*pxPerTT;
  const xFwd=m=>nowX+(m/AR.FWD)*(plotR-nowX);
  const yOf=p=>AR.PADY+(sc.hi-p)/((sc.hi-sc.lo)||1)*(mainB-AR.PADY);
  const spotY=yOf(aTweenSpot);
  aVM={plotL,plotR,edgeX,ttLo:sc.ttLo,ttHi:sc.ttHi,span:sc.span,TT:sc.TT,anchor:sc.anchor,first:sc.TT.first,W,H,plotH:mainB-AR.PADY,padY:AR.PADY,yLo:sc.lo,yHi:sc.hi};

  ctx.save();
  if(aShake>0.01&&sc.isNow)ctx.translate((Math.random()-0.5)*aShake*6,(Math.random()-0.5)*aShake*4);

  /* --- backdrop --- */
  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#080a11');bg.addColorStop(.55,'#06080e');bg.addColorStop(1,'#04050a');
  ctx.fillStyle=bg;ctx.fillRect(-12,-12,W+24,H+24);

  /* --- THE CHRONICLE: the field through time --- */
  const fcv=aFieldPaint(sc,Math.max(2,Math.round(edgeX-plotL)),Math.max(2,Math.round(mainB-AR.PADY)),xOf,edgeX,plotL);
  if(fcv)ctx.drawImage(fcv,plotL,AR.PADY,edgeX-plotL,mainB-AR.PADY);
  /* depth: the past is dimmer than the live edge */
  const dim=ctx.createLinearGradient(plotL,0,edgeX,0);
  dim.addColorStop(0,'rgba(5,7,12,.45)');dim.addColorStop(1,'rgba(5,7,12,0)');
  ctx.fillStyle=dim;ctx.fillRect(plotL,AR.PADY,edgeX-plotL,mainB-AR.PADY);
  if(sc.isNow){
    const vig=ctx.createRadialGradient(nowX,spotY,8,nowX,spotY,Math.max(W,H)*0.75);
    vig.addColorStop(0,'rgba('+(pos?TEAL:MAG)+','+(0.05+aRegFlash*0.18).toFixed(3)+')');
    vig.addColorStop(1,'rgba('+(pos?TEAL:MAG)+',0)');
    ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);
  }

  /* --- session seams (compressed gaps) --- */
  for(let i=1;i<sc.TT.segs.length;i++){
    const g=sc.TT.segs[i];
    const x=xOf(g.t0);
    if(x<plotL-4||x>edgeX+4)continue;
    ctx.strokeStyle='rgba(126,166,214,.16)';ctx.setLineDash([2,5]);
    ctx.beginPath();ctx.moveTo(x+.5,AR.PADY);ctx.lineTo(x+.5,mainB);ctx.stroke();ctx.setLineDash([]);
    aLab(ctx,aDayLab(g.t0),x+3,AR.PADY+11,'rgba(126,166,214,.6)','left',8.5);
  }

  /* --- time grid: -Nm ticks when tight, NY clock when wide --- */
  const spanMin=sc.span/60000;
  const step=(spanMin<=30?10:spanMin<=60?15:spanMin<=180?30:spanMin<=420?60:120)*60000;
  const clock=spanMin>45;
  ctx.strokeStyle='rgba(126,166,214,.05)';ctx.lineWidth=1;
  let lastTickX=-999;
  for(let t=Math.floor(sc.tEnd/step)*step;t>=sc.t0;t-=step){
    const x=xOf(t);
    if(x<plotL+2||x>edgeX-2)continue;
    if(Math.abs(x-lastTickX)<34)continue;
    lastTickX=x;
    ctx.beginPath();ctx.moveTo(x+.5,AR.PADY);ctx.lineTo(x+.5,mainB);ctx.stroke();
    aLab(ctx,clock?aClk(t):('-'+Math.round((sc.tEnd-t)/60000)+'m'),x+3,mainB+13,'rgba(96,106,124,.8)','left',9);
  }
  ctx.strokeStyle='rgba(34,211,238,.22)';ctx.beginPath();
  ctx.moveTo(nowX+.5,AR.PADY);ctx.lineTo(nowX+.5,SUBH?H-AR.PADY:mainB);ctx.stroke();
  aLab(ctx,sc.isNow?(sc.live?'NOW':'CLOSE'):aClk(sc.tEnd),nowX-4,mainB+13,'rgba('+CYAN+',.85)','right',9);
  if(sc.isNow)aLab(ctx,'+'+AR.FWD+'m',plotR-2,mainB+13,'rgba(96,106,124,.8)','right',9);

  /* --- time @ price, left margin (window-scoped) --- */
  const BK=52,prof=aProfile(sc,BK),pmax=Math.max(...prof,1),bh=(mainB-AR.PADY)/BK;
  for(let i=0;i<BK;i++){
    if(!prof[i])continue;
    const inten=prof[i]/pmax,y=AR.PADY+(BK-1-i)*bh,len=inten*(AR.PADL-12);
    ctx.fillStyle='rgba(200,140,70,'+(0.22+inten*0.5).toFixed(3)+')';
    ctx.fillRect(AR.PADL-4-len,y+.5,len,Math.max(1,bh-1));
  }
  aLab(ctx,'TIME @ PRICE',4,AR.PADY-8,'rgba(200,140,70,.7)','left',8);

  /* --- PRICE GRID: clean round levels (1/2/2.5/5 steps), like a real chart.
     Numbers live on the right; the GEX ridgeline sits just outside them so you
     read price AND see the walls at once. --- */
  const rowsTgt=Math.max(4,Math.min(10,Math.round((mainB-AR.PADY)/58)));
  const {ticks:pTicks}=aPriceTicks(sc.lo,sc.hi,rowsTgt);
  const pdp=sc.spot>=1000?0:sc.spot>=100?1:2;
  for(const pv of pTicks){
    const y=yOf(pv);
    if(y<AR.PADY+2||y>mainB-2)continue;
    ctx.strokeStyle='rgba(126,166,214,.055)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(plotL,y+.5);ctx.lineTo(plotR,y+.5);ctx.stroke();
    aLab(ctx,pv.toFixed(pdp),plotR-5,y+3.5,'rgba(196,208,226,.6)','right',9.5);
  }

  /* --- key levels: CURRENT structure. Dimmed + dashed when viewing the past --- */
  const lvA=sc.isNow?1:0.45,labYs=[];
  const line=(p,col,txt,w)=>{
    if(p==null||p<sc.lo||p>sc.hi)return;
    const y=yOf(p);
    ctx.strokeStyle='rgba('+col+','+(0.6*lvA).toFixed(2)+')';ctx.lineWidth=w||1;
    if(!sc.isNow)ctx.setLineDash([4,4]);
    ctx.beginPath();ctx.moveTo(plotL,y+.5);ctx.lineTo(plotR,y+.5);ctx.stroke();ctx.setLineDash([]);
    let ly=y-6;                              /* dodge overlapping labels */
    if(labYs.some(e=>Math.abs(ly-e)<12))ly=y+14;
    if(labYs.some(e=>Math.abs(ly-e)<12))ly=y+26;
    labYs.push(ly);
    // dark backing so the label reads over the field
    ctx.font='700 10px "JetBrains Mono",monospace';
    const tw=ctx.measureText(txt).width;
    ctx.fillStyle='rgba(6,8,14,.72)';
    aRound(ctx,plotL+3,ly-9,tw+8,13,3);ctx.fill();
    aLab(ctx,txt+(sc.isNow?'':' (now)'),plotL+7,ly,'rgba('+col+','+lvA.toFixed(2)+')','left',10);
  };
  line(sc.cw?sc.cw.k:null,TEAL,'CALL WALL '+(sc.cw?sc.cw.k:''),1.5);
  line(sc.pw?sc.pw.k:null,MAG,'PUT WALL '+(sc.pw?sc.pw.k:''),1.5);
  line(sc.ps.fl,GOLD,'THE RIFT '+(sc.ps.fl!=null?(+sc.ps.fl).toFixed(sc.spot>2000?0:1):''),1.2);
  if(sc.kg){const kv=mval(sc.kg,sc.metric);line(sc.kg.k,kv>=0?GOLD:'216,60,255','\u2605 CROWN '+sc.kg.k,2);}

  /* --- STRUCTURE TRACKS: where Crown / Call Wall / Put Wall actually SAT
     through time, stepped from Chronicle columns. Walls migrating is the
     whole story — now you can see them walk. --- */
  if(aTracks.length>1){
    const seg2=(y,x0,x1,col,al)=>{if(y<sc.lo||y>sc.hi||x1-x0<0.5)return;
      const yy=yOf(y);ctx.strokeStyle='rgba('+col+','+al+')';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(x0,yy+.5);ctx.lineTo(x1,yy+.5);ctx.stroke();};
    for(let i=0;i<aTracks.length;i++){
      const tk=aTracks[i];
      const x0=Math.max(plotL,xOf(tk.t)),x1=Math.min(edgeX,xOf(i<aTracks.length-1?aTracks[i+1].t:sc.tEnd));
      const al=tk.r?'0.22':'0.32';
      if(tk.king!=null)seg2(tk.king,x0,x1,GOLD,al);
      if(tk.cw!=null&&tk.cw!==tk.king)seg2(tk.cw,x0,x1,TEAL,al);
      if(tk.pw!=null&&tk.pw!==tk.king)seg2(tk.pw,x0,x1,MAG,al);
    }
  }

  /* --- CANDLES: real OHLC at the chosen interval (auto widens on wide windows) --- */
  const pxPerMin=pxPerTT*60000;
  const candleInt=aCandleInt||aAutoInt(pxPerMin);
  let candlesDrawn=false;
  if(aCandle){
    const bars=aCandles(sc.sym,candleInt);
    const bw=pxPerMin*candleInt;
    if(bw>=2.4&&bars.length){
      candlesDrawn=true;
      const w=Math.max(1.5,bw*0.66);
      for(const b of bars){
        const x=xOf(b.t+candleInt*30000);  /* center the bar in its slot */
        if(x<plotL-w||x>edgeX+w)continue;
        const up=b.px>=b.o,c=up?TEAL:MAG;
        ctx.strokeStyle='rgba('+c+',.6)';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(x+.5,yOf(b.h));ctx.lineTo(x+.5,yOf(b.l));ctx.stroke();
        const yO=yOf(b.o),yC=yOf(b.px);
        ctx.fillStyle='rgba('+c+',.5)';ctx.strokeStyle='rgba('+c+',.85)';
        const bh=Math.max(1,Math.abs(yC-yO));
        ctx.fillRect(x-w/2,Math.min(yO,yC),w,bh);
        ctx.strokeRect(x-w/2+.5,Math.min(yO,yC)+.5,w-1,bh-1);
      }
    }
  }

  /* ================= additive layer ================= */
  ctx.globalCompositeOperation='lighter';

  /* --- THE REACH: forward EM cone — live edge only --- */
  if(sc.isNow&&sc.ps.em&&sc.dteMin){
    const N=26;
    for(const [mult,alpha] of [[2,0.05],[1,0.09]]){
      ctx.beginPath();
      for(let i=0;i<=N;i++){const m=AR.FWD*i/N;ctx.lineTo(xFwd(m),yOf(sc.spot+aSigma(sc,m)*mult));}
      for(let i=N;i>=0;i--){const m=AR.FWD*i/N;ctx.lineTo(xFwd(m),yOf(sc.spot-aSigma(sc,m)*mult));}
      ctx.closePath();ctx.fillStyle='rgba('+CYAN+','+alpha+')';ctx.fill();
    }
    ctx.strokeStyle='rgba('+CYAN+',.28)';ctx.lineWidth=1;
    [1,-1].forEach(sg=>{
      ctx.beginPath();
      for(let i=0;i<=N;i++){const m=AR.FWD*i/N;const x=xFwd(m),y=yOf(sc.spot+sg*aSigma(sc,m));i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
      ctx.stroke();
    });
    aLab(ctx,'THE REACH \u00b71\u03c3',xFwd(AR.FWD*0.5),yOf(sc.spot+aSigma(sc,AR.FWD))-7,'rgba('+CYAN+',.6)','center',8.5);
  }

  /* --- tracer fire from the top nodes — live edge only --- */
  if(!aReduce&&sc.isNow){
    for(const rk of sc.ranks.slice(0,AR.TOPB)){
      if(Math.random()>rk.r*0.26)continue;
      const ry=yOf(rk.k),hold=rk.v>=0;
      aParts.push({hold,p:0,sp:0.75+rk.r*1.2,r:rk.r,king:rk.king,
        x0:hold?plotL+Math.random()*(nowX-plotL):nowX,y0:hold?ry:spotY,
        x1:nowX,y1:hold?spotY:ry+(ry<spotY?-46:46)});
    }
    if(aParts.length>AR.MAXP)aParts.splice(0,aParts.length-AR.MAXP);
    for(let i=aParts.length-1;i>=0;i--){const q=aParts[i];q.p+=q.sp*dt;if(q.p>=1)aParts.splice(i,1);}
    for(const q of aParts){
      const x=q.x0+(q.x1-q.x0)*q.p,y=q.y0+(q.y1-q.y0)*q.p;
      const a=Math.sin(q.p*Math.PI)*(0.28+q.r*0.5);
      const c=q.king?(q.hold?GOLD:'216,60,255'):(q.hold?TEAL:MAG);
      ctx.strokeStyle='rgba('+c+','+a.toFixed(3)+')';ctx.lineWidth=1+q.r*1.3;
      ctx.beginPath();ctx.moveTo(x-(q.x1-q.x0)*0.045,y-(q.y1-q.y0)*0.045);ctx.lineTo(x,y);ctx.stroke();
    }
  }

  /* --- THE FRONT --- */
  const P=sc.path;
  if(P.length>1){
    const thin=candlesDrawn;
    for(let i=1;i<P.length;i++){
      if(P[i].t-P[i-1].t>AR.GAPMS)continue;      /* don't draw across a session seam */
      const a=Math.max(0.14,1-(sc.ttHi-sc.TT.fwd(P[i].t))/sc.span);
      const x0=xOf(P[i-1].t),y0=yOf(P[i-1].px),x1=xOf(P[i].t),y1=yOf(P[i].px);
      if(x1<plotL-2||x0>edgeX+2)continue;
      if(!thin){
        ctx.strokeStyle='rgba('+CYAN+','+(a*0.20).toFixed(3)+')';ctx.lineWidth=5+a*5;
        ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
      }
      ctx.strokeStyle='rgba(255,255,255,'+(a*(thin?0.4:0.62)).toFixed(3)+')';ctx.lineWidth=thin?1:1+a*1.3;
      ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
    }
  }

  /* --- bursts --- */
  for(let i=aBursts.length-1;i>=0;i--){
    const b=aBursts[i];b.t+=dt*1.7;
    if(b.t>=1){aBursts.splice(i,1);continue;}
    ctx.strokeStyle='rgba('+b.col+','+((1-b.t)*0.45).toFixed(3)+')';ctx.lineWidth=2*(1-b.t);
    ctx.beginPath();ctx.arc(b.x,b.y,6+b.t*64,0,Math.PI*2);ctx.stroke();
  }

  /* --- the standard — live edge only --- */
  if(sc.isNow){
    const halo=ctx.createRadialGradient(nowX,spotY,0,nowX,spotY,24);
    halo.addColorStop(0,'rgba('+CYAN+',.85)');halo.addColorStop(.5,'rgba('+CYAN+',.22)');halo.addColorStop(1,'rgba('+CYAN+',0)');
    ctx.fillStyle=halo;ctx.beginPath();ctx.arc(nowX,spotY,24,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.96)';ctx.beginPath();ctx.arc(nowX,spotY,3.2,0,Math.PI*2);ctx.fill();
  }
  ctx.globalCompositeOperation='source-over';

  /* --- THE UNDERTOW: net ±1% exposure through time (sub-pane) ---
     Same number as the FIELD/NET stat, per Chronicle column. Teal above
     zero = Aegis regime then; magenta below = Maelstrom. Dimmer bars are
     reconstructed, brighter are recorded. --- */
  if(SUBH){
    const sy0=mainB+AXH,sy1=H-AR.PADY;
    ctx.fillStyle='rgba(5,7,12,.55)';ctx.fillRect(plotL,sy0,plotR-plotL,sy1-sy0);
    ctx.strokeStyle='rgba(126,166,214,.10)';ctx.strokeRect(plotL+.5,sy0+.5,plotR-plotL-1,sy1-sy0-1);
    const zy=(sy0+sy1)/2;
    let nmax=1;
    for(const tk of aTracks)if(Math.abs(tk.net)>nmax)nmax=Math.abs(tk.net);
    if(sc.isNow&&Math.abs(sc.ps.net1)>nmax)nmax=Math.abs(sc.ps.net1);
    ctx.strokeStyle='rgba(126,166,214,.18)';ctx.setLineDash([2,4]);
    ctx.beginPath();ctx.moveTo(plotL,zy+.5);ctx.lineTo(edgeX,zy+.5);ctx.stroke();ctx.setLineDash([]);
    const amp=(sy1-sy0)/2-4;
    for(let i=0;i<aTracks.length;i++){
      const tk=aTracks[i];
      const x0=Math.max(plotL,xOf(tk.t)),x1=Math.min(edgeX,xOf(i<aTracks.length-1?aTracks[i+1].t:sc.tEnd));
      if(x1-x0<0.5)continue;
      const hgt=tk.net/nmax*amp;
      ctx.fillStyle='rgba('+(tk.net>=0?TEAL:MAG)+','+(tk.r?'0.30':'0.48')+')';
      ctx.fillRect(x0,Math.min(zy,zy-hgt),x1-x0,Math.max(1,Math.abs(hgt)));
    }
    if(sc.isNow){ /* live tip: the current net at the edge */
      const hgt=sc.ps.net1/nmax*amp;
      ctx.fillStyle='rgba('+(sc.ps.net1>=0?TEAL:MAG)+',.9)';
      ctx.fillRect(edgeX-2,Math.min(zy,zy-hgt),2.5,Math.max(1.5,Math.abs(hgt)));
    }
    aLab(ctx,'NET ±1% · '+metricLabel(sc.metric).toUpperCase()+' · THROUGH TIME',plotL+5,sy0+11,'rgba(126,166,214,.6)','left',8);
    aLab(ctx,'±'+fmt(nmax),edgeX-4,sy0+11,'rgba(126,166,214,.55)','right',8);
  }

  /* --- bloom --- */
  if(aBlurOK&&!aReduce){
    if(!aBloom)aBloom=document.createElement('canvas');
    if(aBloom.width!==Math.round(W/3)||aBloom.height!==Math.round(H/3)){aBloom.width=Math.round(W/3);aBloom.height=Math.round(H/3);}
    const bx=aBloom.getContext('2d');
    bx.clearRect(0,0,aBloom.width,aBloom.height);
    bx.drawImage(cv,0,0,aBloom.width,aBloom.height);
    ctx.save();ctx.filter='blur(6px)';ctx.globalCompositeOperation='lighter';ctx.globalAlpha=0.38;
    ctx.drawImage(aBloom,0,0,W,H);ctx.restore();
  }

  /* --- RIDGELINE: readable strikes, right margin (current ladder) --- */
  ctx.fillStyle='rgba(5,7,12,.86)';ctx.fillRect(plotR,0,W-plotR,H);
  ctx.strokeStyle='rgba(126,166,214,.12)';ctx.beginPath();ctx.moveTo(plotR+.5,AR.PADY);ctx.lineTo(plotR+.5,H-AR.PADY);ctx.stroke();
  const bx0=plotR+6,bw2=Math.max(20,(W-plotR)-46);
  let lastLabY=-99;
  for(const rk of sc.ranks.slice(0,AR.TOPN)){
    const y=yOf(rk.k);if(y<AR.PADY||y>mainB)continue;
    const c=rk.king?(rk.v>=0?GOLD:'216,60,255'):(rk.v>=0?TEAL:MAG);
    // strength bar, brighter
    ctx.fillStyle='rgba('+c+','+(0.5+rk.r*0.45).toFixed(2)+')';
    aRound(ctx,bx0,y-2.5,Math.max(3,rk.r*bw2),5,2);ctx.fill();
    // strike label for EVERY node (dodge vertical collisions)
    if(Math.abs(y-lastLabY)>=11){
      lastLabY=y;
      aLab(ctx,(rk.king?'\u2605':'')+rk.k,W-6,y+3.5,'rgba('+c+',.98)','right',rk.king?11:10);
    }
  }
  aLab(ctx,'|'+metricLabel(sc.metric).toUpperCase()+'|',bx0,AR.PADY-8,'rgba(150,180,214,.8)','left',9);

  /* --- price pill — live edge only --- */
  if(sc.isNow){
    const lab='$'+aTweenSpot.toFixed(2);
    ctx.font='700 12px "JetBrains Mono",monospace';
    const tw=ctx.measureText(lab).width;
    ctx.fillStyle='rgba('+CYAN+',.97)';
    aRound(ctx,nowX+11,spotY-9,tw+13,18,4);ctx.fill();
    ctx.fillStyle='#04121a';ctx.fillText(lab,nowX+17.5,spotY+4);
  }

  /* --- THE LENS: hover inspector --- */
  if(aMouse&&aMouse.x>plotL&&aMouse.x<edgeX&&aMouse.y>AR.PADY&&aMouse.y<mainB&&!aDrag){
    const tt=sc.ttLo+(aMouse.x-plotL)/pxPerTT,tm=sc.TT.inv(tt);
    const py=sc.hi-(aMouse.y-AR.PADY)/(mainB-AR.PADY)*(sc.hi-sc.lo);
    ctx.strokeStyle='rgba(255,255,255,.14)';ctx.setLineDash([3,4]);
    ctx.beginPath();ctx.moveTo(aMouse.x+.5,AR.PADY);ctx.lineTo(aMouse.x+.5,SUBH?H-AR.PADY:mainB);ctx.stroke();ctx.setLineDash([]);
    let bar=null,bd=1e18;
    for(const b of sc.path){const d2=Math.abs(b.t-tm);if(d2<bd){bd=d2;bar=b;}}
    let col=null,cd=1e18;
    for(const c of (aField[sc.sym]||[])){if(c.t>tm)break;const d2=tm-c.t;if(d2<cd){cd=d2;col=c;}}
    for(const c of (aRecon[sc.sym]||[])){if(c.t>tm)break;const d2=tm-c.t;if(d2<cd){cd=d2;col=c;}}
    let fLine='';
    if(col&&cd<10*60000){
      let bi=-1,bk=1e18;
      for(let i=0;i<col.ks.length;i++){const d2=Math.abs(col.ks[i]-py);if(d2<bk){bk=d2;bi=i;}}
      if(bi>=0){const vv=(sc.metric==='vex'?col.v:col.g)[bi];fLine=col.ks[bi]+' '+metricLabel(sc.metric).toLowerCase()+' '+mdisp(vv,sc.spot)+(col.r?' · recon':'');}
    }
    const rows=[aClk(tm)+' \u00b7 '+aDayLab(tm),'$'+py.toFixed(sc.spot>2000?1:2)+(bar&&bd<120000?' \u00b7 close $'+(+bar.px).toFixed(2):'')];
    if(fLine)rows.push(fLine);
    ctx.font='600 10px "JetBrains Mono",monospace';
    let mw=0;for(const r of rows)mw=Math.max(mw,ctx.measureText(r).width);
    const bxx=Math.min(aMouse.x+12,W-mw-22),byy=Math.max(AR.PADY+4,Math.min(aMouse.y-10,mainB-16*rows.length-10));
    ctx.fillStyle='rgba(5,7,12,.92)';aRound(ctx,bxx,byy,mw+14,16*rows.length+8,4);ctx.fill();
    ctx.strokeStyle='rgba(126,166,214,.25)';aRound(ctx,bxx,byy,mw+14,16*rows.length+8,4);ctx.stroke();
    rows.forEach((r,i)=>aLab(ctx,r,bxx+7,byy+15+i*16,i===0?'rgba('+CYAN+',.9)':'rgba(230,236,246,.92)','left',10));
  }

  /* --- FX --- */
  if(!aReduce){
    aScan=(aScan+dt*14)%4;
    ctx.fillStyle='rgba(0,0,0,.10)';
    for(let y=aScan;y<H;y+=4)ctx.fillRect(0,y,plotR,1);
  }
  const ev=ctx.createRadialGradient(W/2,H/2,H*0.4,W/2,H/2,H*0.95);
  ev.addColorStop(0,'rgba(0,0,0,0)');ev.addColorStop(1,'rgba(0,0,0,.5)');
  ctx.fillStyle=ev;ctx.fillRect(0,0,plotR,H);
  ctx.restore();
}

/* ---- clean price-axis steps (1/2/2.5/5 x 10^n), like a real chart ---- */
function aNiceStep(range,target){
  const raw=range/Math.max(1,target),mag=Math.pow(10,Math.floor(Math.log10(raw)));
  const n=raw/mag;
  const step=n<1.5?1:n<3?2:n<4?2.5:n<7?5:10;
  return step*mag;
}
function aPriceTicks(lo,hi,target){
  const step=aNiceStep(hi-lo,target||7),out=[];
  let v=Math.ceil(lo/step)*step;
  for(;v<=hi+1e-9;v+=step)out.push(+v.toFixed(6));
  return {ticks:out,step};
}
function aLab(ctx,t,x,y,col,align,size){
  ctx.font='600 '+(size||9)+'px "JetBrains Mono",monospace';
  ctx.fillStyle=col;ctx.textAlign=align||'left';ctx.fillText(t,x,y);ctx.textAlign='left';
}
function aRound(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}

/* ---- THE WINDOW: chips + pan/zoom interactions ---- */
function aSetWin(m){
  aWin=Math.max(AR.WINMIN,Math.min(AR.WINMAX,m));
  try{localStorage.setItem('kairos_nx_win',String(Math.round(aWin)));}catch(e){}
  aFKey='';aChips();
  if(aWin>420)aHist(state.focus,true);
}
function aGoLive(){aPan=0;aFKey='';aChips();}
function aChips(){
  const el=document.getElementById('nxWins');if(!el)return;
  const wins=[['30M',30],['1H',60],['2H',120],['DAY',390],['5D',1950]];
  el.innerHTML=wins.map(w=>'<button data-w="'+w[1]+'"'+(Math.abs(aWin-w[1])<w[1]*0.25?' class="on"':'')+'>'+w[0]+'</button>').join('')+
    '<button data-w="candle"'+(aCandle?' class="on"':'')+' data-tip="Real OHLC candles from Tradier timesales, aggregated to the chosen interval.">CANDLE</button>'+
    (aCandle?['auto',1,5,10,30,60].map(function(iv){
        var lab=iv==='auto'?'AUTO':(iv<60?iv+'m':'1h');
        var on=(iv==='auto'&&!aCandleInt)||(iv===aCandleInt);
        return '<button data-ci="'+iv+'"'+(on?' class="on ciBtn"':' class="ciBtn"')+' data-tip="'+(iv==='auto'?'Pick the finest interval that stays readable for this window':iv+'-minute candles')+'">'+lab+'</button>';
      }).join(''):'')+
    (aPan>30000?'<button data-w="live" class="livebtn" data-tip="Snap back to the live edge (double-click the canvas does the same)">\u25c9 LIVE</button>':'')+
    (aYManual?'<button data-w="yfit" class="livebtn" data-tip="Auto-fit the price axis again. Drag up/down pans price; Shift+wheel (or wheel over the strikes) zooms it.">\u2921 FIT Y</button>':'');
}
(function(){
  const stage=document.querySelector('.a-stage');
  if(!stage)return;
  const row=document.createElement('div');
  row.id='nxWins';row.className='nx-wins mtoggle';
  const top=document.querySelector('.a-top');
  if(top){const lg=top.querySelector('.a-legend');top.insertBefore(row,lg||null);}
  row.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    const w=b.dataset.w;
    if(w==='live'){aGoLive();return;}
    if(w==='yfit'){aYFit();return;}
    if(b.dataset.ci!==undefined){
      var civ=b.dataset.ci;aCandleInt=(civ==='auto')?0:parseInt(civ);
      try{localStorage.setItem('kairos_nx_candleint',String(aCandleInt));}catch(x){}
      aChips();return;
    }
    if(w==='candle'){aCandle=!aCandle;try{localStorage.setItem('kairos_nx_candle',aCandle?'1':'0');}catch(x){}aChips();return;}
    aSetWin(+w);
  });
  aChips();
  const cv=aCv();if(!cv)return;
  cv.style.touchAction='none';cv.style.cursor='crosshair';
  cv.addEventListener('pointerdown',e=>{
    aDrag={x:e.clientX,y:e.clientY,pan:aPan,back:aPan>30000,yeng:false,ycen0:(aYCenterM!=null?aYCenterM:aYC)};cv.setPointerCapture(e.pointerId);cv.style.cursor='grabbing';
  });
  cv.addEventListener('pointermove',e=>{
    const r=cv.getBoundingClientRect();
    aMouse={x:e.clientX-r.left,y:e.clientY-r.top};
    if(aDrag&&aVM){
      const dx=e.clientX-aDrag.x;
      aPan=aDrag.pan+dx/((aVM.edgeX-aVM.plotL)/aVM.span);
      const maxPan=Math.max(0,aVM.TT.fwd(aVM.anchor)-aVM.TT.fwd(aVM.first)-aVM.span*0.25);
      const prevBack=aDrag.back===true;
      aPan=Math.max(0,Math.min(maxPan,aPan));
      aFKey='';
      const nowBack=aPan>30000;
      if(nowBack!==prevBack){aDrag.back=nowBack;aChips();}
      if(aPan>=maxPan*0.92&&aVM.span+aPan>7*3600000)aHist(state.focus,true);
      /* --- Y pan: drag up/down to move the price window, field stays put --- */
      const dy=e.clientY-aDrag.y;
      if(!aDrag.yeng&&Math.abs(dy)>4){
        aDrag.yeng=true;
        if(aYCenterM==null){aYCenterM=aYC;aYHalfM=aYH;aDrag.ycen0=aYC;}
        aYManual=true;aChips();
      }
      if(aDrag.yeng&&aVM.plotH>0){
        aYCenterM=aDrag.ycen0+dy/aVM.plotH*(2*aYHalfM);
      }
    }
  });
  const up=e=>{if(aDrag){aDrag=null;cv.style.cursor='crosshair';}};
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv.addEventListener('pointerleave',()=>{aMouse=null;});
  /* --- mobile pinch: two-finger spread/squeeze zooms the time window.
     Registered after the pan handlers, so when the second finger lands we
     cancel the in-flight drag and the gesture becomes a clean zoom. --- */
  const aPtrs=new Map();let aPinch=null;
  cv.addEventListener('pointerdown',e=>{
    aPtrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(aPtrs.size===2){
      aDrag=null;cv.style.cursor='crosshair';
      const p=[...aPtrs.values()];
      const vert=Math.abs(p[0].y-p[1].y)>Math.abs(p[0].x-p[1].x);
      aPinch={d0:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)||1,w0:aWin,vert,h0:(aYHalfM!=null?aYHalfM:aYH)};
    }
  });
  cv.addEventListener('pointermove',e=>{
    if(!aPtrs.has(e.pointerId))return;
    aPtrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(aPinch&&aPtrs.size===2){
      const p=[...aPtrs.values()];
      const d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)||1;
      if(aPinch.vert){
        /* vertical pinch = price-axis zoom (mobile Shift+wheel) */
        if(aYCenterM==null){aYCenterM=aYC;aYHalfM=aYH;}
        aYManual=true;
        aYHalfM=Math.max(1e-4,(aPinch.h0||aYH)*(aPinch.d0/d));
      }else{
        const w=Math.max(AR.WINMIN,Math.min(AR.WINMAX,aPinch.w0*(aPinch.d0/d)));
        if(Math.abs(w-aWin)>0.5){aWin=w;aFKey='';aChips();}
      }
    }
  });
  const aPtrGone=e=>{aPtrs.delete(e.pointerId);if(aPtrs.size<2)aPinch=null;};
  cv.addEventListener('pointerup',aPtrGone);cv.addEventListener('pointercancel',aPtrGone);
  cv.addEventListener('dblclick',()=>{aGoLive();aSetWin(30);aYFit();});
  cv.addEventListener('wheel',e=>{
    if(!aVM)return;
    e.preventDefault();
    const r=cv.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
    /* Y-zoom: hold Shift, or scroll over the strike ridgeline on the right */
    if(e.shiftKey||mx>aVM.plotR){
      if(aYCenterM==null){aYCenterM=aYC;aYHalfM=aYH;}
      aYManual=true;
      const yf=Math.max(0,Math.min(1,(my-aVM.padY)/(aVM.plotH||1)));
      const priceAt=(aYCenterM+aYHalfM)-yf*(2*aYHalfM);
      aYHalfM=Math.max(1e-4,aYHalfM*(e.deltaY>0?1.14:1/1.14));
      aYCenterM=priceAt+aYHalfM*(2*yf-1);
      aChips();
      return;
    }
    const frac=Math.max(0,Math.min(1,(mx-aVM.plotL)/(aVM.edgeX-aVM.plotL)));
    const ttCur=aVM.ttLo+frac*aVM.span;
    const f=e.deltaY>0?1.14:1/1.14;
    const old=aWin;
    aWin=Math.max(AR.WINMIN,Math.min(AR.WINMAX,aWin*f));
    if(aWin===old)return;
    const span2=aSpanMs();
    const ttAnchor=aVM.TT.fwd(aVM.anchor);
    aPan=Math.max(0,ttAnchor-(ttCur+(1-frac)*span2));
    try{localStorage.setItem('kairos_nx_win',String(Math.round(aWin)));}catch(x){}
    aFKey='';aChips();
    if(aWin>420)aHist(state.focus,true);
  },{passive:false});
})();

/* ---- HUD ---- */
function aHud(){
  const sc=aScene(),hud=document.getElementById('arenaHud'),meta=document.getElementById('arenaMeta');
  if(!hud)return;
  if(!sc){hud.innerHTML='';if(meta)meta.textContent='';return;}
  const st2=sc.sym+'|'+sc.metric+'|'+(state.dataAge[sc.sym]||0);
  if(st2!==aStamp)aStamp=st2;
  const dp=sc.spot>2000?0:2,pos=sc.ps.net1>=0;
  const mins=sc.path.length>1?Math.round((sc.tEnd-sc.path[0].t)/60000):0;
  const cols=(aField[sc.sym]||[]).length,rcn=(aRecon[sc.sym]||[]).length;
  const back=sc.isNow?'':' \u00b7 viewing '+aClk(sc.tEnd);
  const wlab=sc.span>=390*60000?(sc.span/60000/390).toFixed(sc.span>=780*60000?1:0)+'D':Math.round(sc.span/60000)+'m';
  if(meta)meta.textContent='$'+(+sc.spot).toFixed(2)+' \u00b7 '+sc.d.source+' \u00b7 '+metricLabel(sc.metric).toLowerCase()+' field \u00b7 '+wlab+' window \u00b7 '+cols+' rec'+(rcn?' + '+rcn+' recon':'')+back+(sc.live?'':' \u00b7 last session');
  let hi=-Infinity,lo=Infinity;
  for(const p of sc.path){if(p.px>hi)hi=p.px;if(p.px<lo)lo=p.px;}
  const st=(l,v,c,tip)=>'<div class="stat"'+(tip?' data-tip="'+tip+'"':'')+'><div class="sl">'+l+'</div><div class="sv" style="color:'+(c||'var(--text)')+'">'+v+'</div></div>';
  hud.innerHTML=
    st('FIELD',pos?'AEGIS':'MAELSTROM',pos?'var(--teal)':'#e879f9','Net '+metricLabel(sc.metric)+' within \u00b11%. Aegis: dealers fade moves, price is held. Maelstrom: dealers chase, moves accelerate.')+
    st('CROWN',sc.kg?sc.kg.k:'\u2014',(sc.kg&&mval(sc.kg,sc.metric)<0)?'#e879f9':'var(--gold)','King \u2014 largest |exposure| node.')+
    st('CALL WALL',sc.cw?sc.cw.k:'\u2014','var(--teal)','Largest positive node above spot.')+
    st('PUT WALL',sc.pw?sc.pw.k:'\u2014','#c99bff','Largest negative node below spot.')+
    st('THE RIFT',sc.ps.fl!=null?(+sc.ps.fl).toFixed(sc.spot>2000?0:1):'\u2014','var(--cyan)','Zero-gamma flip from the repriced profile.')+
    st('WIN RANGE',isFinite(hi)&&hi>lo?(hi-lo).toFixed(dp):'\u2014','var(--text)','High-low of the real path in the current window ('+wlab+').')+
    st('NET \u00b11%',mdisp(sc.ps.net1,sc.spot),pos?'var(--teal)':'#e879f9','Drives the field colour.')+
    st('REACH +'+AR.FWD+'m',sc.ps.em&&sc.dteMin?'\u00b1'+aSigma(sc,AR.FWD).toFixed(dp):'\u2014','var(--cyan)','\u00b11\u03c3 implied by ATM IV over the next '+AR.FWD+' minutes.');
}

/* ---- view wiring ---- */
(function(){
  const __sv=setView;
  setView=function(v){
    const ab=document.getElementById('btnArena'),as=document.getElementById('arenaSec');
    if(v!=='arena'){if(ab)ab.classList.remove('active');if(as)as.classList.add('hidden');aStop();return __sv(v);}
    state.view='arena';
    ['btnTrinity','btnSingle','btnChart','btnIdeas','btnImb','btnTape'].forEach(id=>{const b=document.getElementById(id);if(b)b.classList.remove('active');});
    if(ab)ab.classList.add('active');
    ['trinityWrap','chartSec','ideasSec','imbSec','tapeSec'].forEach(id=>{const e=document.getElementById(id);if(e)e.classList.add('hidden');});
    if(as)as.classList.remove('hidden');
    document.getElementById('mtoggle').classList.remove('dim');
    document.getElementById('centertoggle').classList.add('dim');
    document.getElementById('presetBar').classList.remove('hidden');
    renderPresets();
    const ti=document.getElementById('arenaTicker');if(ti)ti.value=state.focus;
    aHud(true);aStart();
    if(!state.data[state.focus]||Date.now()-(state.dataAge[state.focus]||0)>90000)refresh(false);
  };
  const b=document.getElementById('btnArena');
  if(b)b.onclick=function(){setView('arena');};
  const ti=document.getElementById('arenaTicker');
  if(ti)ti.onchange=async function(){
    const v=cleanSym(ti.value);
    if(!v){ti.value=state.focus;return;}
    ti.value=v;state.focus=v;
    aFocusReset(v);
    renderPresets();
    if(!state.data[v]){
      document.getElementById('spin').classList.remove('hidden');
      try{const r=await getSym(v);if(r){state.data[v]=r;state.dataAge[v]=Date.now();}}catch(e){}
      document.getElementById('spin').classList.add('hidden');
    }
    aHud(true);
  };
})();
document.addEventListener('visibilitychange',function(){
  if(state.view!=='arena')return;
  if(document.hidden)aStop();else aStart();
});
setInterval(function(){if(state.view==='arena'&&!document.hidden)aHist(state.focus,aWin>420);},120000);

/* =====================================================================
   EDITABLE PRESET CHIPS
   ===================================================================== */
(function(){
  const KEY='kairos_presets';
  try{
    const saved=JSON.parse(localStorage.getItem(KEY)||'null');
    if(Array.isArray(saved)&&saved.length){PRESETS.length=0;saved.forEach(t=>PRESETS.push(t));}
  }catch(e){}
  function save(){
    /* Per-device roster: this list is intentionally LOCAL to this browser, so
       each device (desktop, phone, tablet) keeps its own watchlist. */
    try{localStorage.setItem(KEY,JSON.stringify(PRESETS));}catch(e){}
  }
  function syncTickerList(){
    const dl=document.getElementById('tickerList');
    if(!dl)return;
    /* the roster tabs, deduped, feed every ticker dropdown; free-typing still works */
    dl.innerHTML=PRESETS.map(t=>'<option value="'+t+'"></option>').join('');
  }
  window.__kairosSyncTickerList=syncTickerList;
  renderPresets=function(){
    const bar=document.getElementById('presetBar');
    syncTickerList();
    if(!bar)return;
    bar.innerHTML=PRESETS.map(t=>'<button class="pchip'+(t===state.focus?' on':'')+'" data-t="'+t+'">'+t+
      '<span class="px" data-x="'+t+'" title="Remove '+t+'">\u00d7</span></button>').join('')+
      '<button class="pchip padd" id="presetAdd" title="Add a ticker">+</button>';
  };
  function addPreset(){
    const v=cleanSym(window.prompt('Add ticker to the tab row:','')||'');
    if(!v)return;
    if(PRESETS.includes(v)){pickPreset(v);return;}
    PRESETS.push(v);save();renderPresets();pickPreset(v);
  }
  function delPreset(t){
    const i=PRESETS.indexOf(t);
    if(i<0||PRESETS.length<=1)return;
    PRESETS.splice(i,1);save();
    if(state.focus===t)pickPreset(PRESETS[Math.max(0,i-1)]);else renderPresets();
  }
  const bar=document.getElementById('presetBar');
  if(bar)bar.addEventListener('click',function(e){
    const x=e.target.closest('.px');
    if(x){e.stopPropagation();e.preventDefault();delPreset(x.dataset.x);return;}
    const a=e.target.closest('#presetAdd');
    if(a){e.stopPropagation();e.preventDefault();addPreset();return;}
  },true);
  renderPresets();
})();

window.KairosArena={AR,aScene,aStart,aStop,aDraw,aHud,aPath,aProfile,aHist,aSigma,aTTBuild,aRec,aReconBuild,aSetWin,aGoLive,
  parts:function(){return aParts;},trail:function(){return aTrail;},
  field:function(){return aField;},recon:function(){return aRecon;},tracks:function(){return aTracks;},db:function(){return aDB;},
  win:function(){return aWin;},pan:function(){return aPan;},
  presets:function(){return PRESETS;},bloomOK:function(){return aBlurOK;},
  reset:function(){aTweenSpot=null;aParts=[];aBursts=[];aSeen={};aFKey='';}};
console.log('%cKairos Nexus \u2014 THE CHRONICLE. The field now remembers: pan, zoom, and read the day.','color:#2dd4bf;font-weight:bold');



/* =====================================================================
   KAIROS SWING — the Aether "Swing" tab, rebuilt (v7.8)

   WHAT WAS WRONG
   The old Swing cards recommended "~ATM call, 30–45 DTE" and stopped there.
   Two real problems:

   1) 30–45 DTE is the option SELLER'S window. It is chosen precisely because
      theta acceleration is steepest there — roughly half an ATM option's
      extrinsic value erodes in the final 30 days, versus ~15–20% between 90
      and 60 DTE. Telling a premium BUYER to enter at 30–45 DTE walks him
      straight into the theta cliff. Buyers want 60–90 DTE and out by ~21 DTE.
   2) "~ATM" ignores that extrinsic value is what theta eats. A 0.70Δ ITM
      contract is mostly intrinsic, so it bleeds far less per day and tracks
      the underlying ~70c on the dollar. That is the standard directional
      structure; ATM maximises the thing you are paying to lose.

   WHAT THIS DOES
     DURATION   60–90 DTE, target ~75. Exit rule at 21 DTE, before the cliff.
     STRIKE     Δ 0.55–0.82, target 0.70 — ITM, intrinsic-heavy, low bleed.
     MISPRICING IV vs REALISED vol (HV20/HV60) from 140 days of daily bars we
                already pull. IV/HV > 1.30 = paying up; < 0.92 = cheap. Plus an
                IV journal in localStorage that matures into a real IV rank.
     EVENT      ATM IV per expiry. Front-month IV inverted above the back is
                the market pricing an event (usually earnings) — disclosed,
                because a long 75-DTE contract eats the post-event IV crush.
     GREEKS     theta/day as % of premium (the number that justifies duration),
                vega, and what a 5-vol crush costs.
     LEVELS     ATR-based stop / structural invalidation, King as T1 magnet,
                wall as T2. Premium modelled by re-pricing at the hold horizon.

   Nothing is simulated. Every number traces to the live chain, the daily bars,
   or the dealer book. Structure is context, not a signal.
   ===================================================================== */
'use strict';
const SW_CORE={
  DTE_LO:55, DTE_HI:100, DTE_TGT:75,   // buyers live here; sellers live at 30-45
  EXIT_DTE:21,                          // close before theta accelerates
  D_LO:0.55, D_HI:0.82, D_TGT:0.70,     // ITM: intrinsic-heavy, low theta drag
  MAX_SPREAD:0.07,                      // deep ITM is thinner — but 7% is the ceiling
  MIN_OI:200,
  MIN_SCORE:58,
  HOLD:21,                              // calendar days modelled to T2
  IV_RICH:1.30, IV_CHEAP:0.92,          // IV / realised vol
  TERM_INV:1.08,                        // front/back ATM IV ratio implying an event
  MIN_RR:1.5, MIN_RRP:1.2,
  VOL_SHOCK:5,                          // vol points for the crush disclosure
  LABEL:'INVESTOR', DESC:'deep-ITM \u00b7 probability + staying power \u00b7 costs more per contract, on purpose'
};
/* AGILE — the small/mid-account profile. Cheaper debit per contract, so a
   position is sizeable on a small account and the R:R reads properly.
   Research basis: for a BUYER, 45-70 DTE keeps you off the worst of the theta
   cliff (the 30-45 window is the seller's edge), while \u03940.35-0.50 (slightly
   OTM to ATM) costs a fraction of a 0.70\u0394 contract and still carries real
   directional delta. We deliberately do NOT go below ~0.30\u0394: far-OTM "lottos"
   look cheap but their probability of profit collapses and the theta burn is
   proportionally brutal. Wider spread ceiling because OTM books are thinner. */
const SW_AGILE={
  /* DEGEN — cheap convexity, eyes open. \u03940.18\u20130.35 at 25\u201350 DTE sits
     deliberately NEARER the theta window than the investor book: the contract
     is cheap precisely because the clock and the odds lean against it, and a
     structure move has to come reasonably fast. The engine pays for that
     honestly: R:R \u2265 2.5 demanded, the CHEAPEST contract inside the \u0394 band
     wins (not the closest to target), IV screened vs realised, and out by
     7 DTE win or lose. Sized like the premium can go to zero \u2014 it can. */
  DTE_LO:25, DTE_HI:50, DTE_TGT:35,
  EXIT_DTE:7,
  D_LO:0.18, D_HI:0.35, D_TGT:0.25,
  MAX_SPREAD:0.14,
  MIN_OI:150,
  MIN_SCORE:58,
  HOLD:10,
  IV_RICH:1.25, IV_CHEAP:0.92,
  TERM_INV:1.08,
  MIN_RR:2.5, MIN_RRP:2.0,
  VOL_SHOCK:5,
  LABEL:'DEGEN', DESC:'cheap OTM convexity \u00b7 strict exits \u00b7 premium can go to zero'
};
let SW=Object.assign({},localStorage.getItem('kairos_sw_mode')==='agile'?SW_AGILE:SW_CORE);
function swSetMode(mode){
  const src=mode==='agile'?SW_AGILE:SW_CORE;
  Object.keys(SW).forEach(k=>delete SW[k]);
  Object.assign(SW,src);
  try{localStorage.setItem('kairos_sw_mode',mode);}catch(e){}
}
window.swSetMode=swSetMode;

/* ---- greeks the app didn't have yet (r=q=0, matches everything else) ---- */
function nPdf(x){return Math.exp(-0.5*x*x)/Math.sqrt(2*Math.PI);}
function bsD1(S,K,iv,T){return (Math.log(S/K)+0.5*iv*iv*T)/(iv*Math.sqrt(T));}
function bsVega(S,K,iv,T){if(T<=0||iv<=0||S<=0||K<=0)return 0;return S*nPdf(bsD1(S,K,iv,T))*Math.sqrt(T)/100;}
function bsThetaDay(S,K,iv,T){if(T<=0||iv<=0||S<=0||K<=0)return 0;return -(S*nPdf(bsD1(S,K,iv,T))*iv/(2*Math.sqrt(T)))/365;}

/* ---- IV journal: no vendor gives us 52w IV, so we accrue our own ----
   Honest until it matures: rank is withheld below 20 sessions. */
const SW_IVK='kairos_iv';
let swIv=(function(){try{const j=JSON.parse(localStorage.getItem(SW_IVK)||'null');if(j&&j.v===1&&j.s)return j;}catch(e){}return{v:1,s:{}};})();
let swIvSave=0;
function sIvRecord(sym,iv){
  if(!iv||iv<=0.01||iv>5)return;
  const d=localDate(),m=swIv.s[sym]=swIv.s[sym]||{};
  if(m[d]!=null)return;
  m[d]=+iv.toFixed(4);
  const ks=Object.keys(m).sort();
  while(ks.length>260)delete m[ks.shift()];
  const now=Date.now();
  if(now-swIvSave>15000){swIvSave=now;try{localStorage.setItem(SW_IVK,JSON.stringify(swIv));}catch(e){}}
}
function sIvRank(sym,iv){
  const m=swIv.s[sym]||{},h=Object.values(m);
  if(h.length<20)return{n:h.length,rank:null};
  const mn=Math.min(...h),mx=Math.max(...h);
  return{n:h.length,rank:mx>mn?Math.max(0,Math.min(100,(iv-mn)/(mx-mn)*100)):null};
}

/* ---- term structure: ATM IV per expiry. An IV step-down between two
   adjacent expiries means the market is pricing an event before the earlier
   one — almost always earnings. We infer it; we do not read an earnings date. */
function sTerm(sym){
  const ch=state.chains[sym];if(!ch||!ch.list||!ch.list.length)return null;
  const spot=state.spot[sym]||ch.spot||ch.spotHint||0;if(!spot)return null;
  const by={};
  for(const c of ch.list){
    if(!c.iv||c.iv<=0.01||c.iv>=5)continue;
    if(Math.abs(c.k-spot)>spot*0.025)continue;
    const w=(c.oi||0)+1;
    const b=by[c.e]||(by[c.e]={w:0,s:0});
    b.s+=c.iv*w;b.w+=w;
  }
  const rows=Object.keys(by).sort().map(e=>({e,dte:dteOf(e),iv:by[e].s/by[e].w})).filter(r=>r.iv>0);
  if(rows.length<2)return{rows,inverted:false};
  for(let i=0;i<rows.length-1;i++){
    if(rows[i].iv>rows[i+1].iv*SW.TERM_INV)
      return{rows,inverted:true,front:rows[i],back:rows[i+1],ratio:rows[i].iv/rows[i+1].iv};
  }
  return{rows,inverted:false};
}

/* ---- contract picker: duration first, then delta, then liquidity ---- */
function sPick(sym,call){
  const ch=(state.swChains||{})[sym];
  if(!ch||!ch.list||!ch.list.length)return{noExp:true,pending:true};
  const spot=state.spot[sym]||0;if(!spot)return null;
  const exps={};
  for(const c of ch.list){const d=dteOf(c.e);if(d>=SW.DTE_LO&&d<=SW.DTE_HI)exps[c.e]=d;}
  const dates=Object.keys(exps).sort((a,b)=>Math.abs(exps[a]-SW.DTE_TGT)-Math.abs(exps[b]-SW.DTE_TGT));
  if(!dates.length)return{noExp:true,have:[...new Set(ch.list.map(c=>Math.round(dteOf(c.e))))].sort((a,b)=>a-b)};
  for(const e of dates){
    const cands=[];
    for(const c of ch.list){
      if(c.e!==e||c.call!==call)continue;
      const mid=c.mid||(((c.bid||0)+(c.ask||0))/2);
      if(!mid||mid<0.10)continue;
      if((c.oi||0)<SW.MIN_OI)continue;
      let spr=null;
      if(c.bid>0&&c.ask>0&&c.ask>=c.bid){spr=(c.ask-c.bid)/mid;if(spr>SW.MAX_SPREAD)continue;}
      let dl=Math.abs(c.dl||0);
      if(!dl&&c.iv>0.01&&c.iv<5)dl=Math.abs(bsDelta(spot,c.k,c.iv,c.T,call));
      if(!dl||dl<SW.D_LO||dl>SW.D_HI)continue;
      const intr=Math.max(0,call?spot-c.k:c.k-spot);
      cands.push({c,mid,spr,dl,intr,ext:Math.max(0,mid-intr)});
    }
    if(!cands.length)continue;
    cands.sort((a,b)=>{const d=Math.abs(a.dl-SW.D_TGT)-Math.abs(b.dl-SW.D_TGT);return (SW.LABEL==='DEGEN'&&Math.abs(d)<=0.05)?a.mid-b.mid:d;});
    const p=cands[0];
    return{k:p.c.k,e:p.c.e,call,T:p.c.T,dte:exps[e],iv:p.c.iv,oi:p.c.oi||0,vol:p.c.vol||0,
      mid:p.mid,bid:p.c.bid||0,ask:p.c.ask||0,dl:p.dl,spr:p.spr,intr:p.intr,ext:p.ext,
      extPct:p.mid>0?p.ext/p.mid*100:0,
      vega:bsVega(spot,p.c.k,p.c.iv,p.c.T),
      thDay:bsThetaDay(spot,p.c.k,p.c.iv,p.c.T)};
  }
  return null;
}

/* ---- premium model: reprice at the hold horizon. Same discipline as Zero —
   the stop is modelled with less decay because stops resolve first. ---- */
function sModel(pick,spot,stop,t1,t2){
  if(!pick||!pick.iv||pick.iv<=0.01)return null;
  const hold=Math.min(SW.HOLD,Math.max(3,pick.dte-SW.EXIT_DTE));
  const Tat=d=>Math.max(pick.T-d/365,SW.EXIT_DTE/365*0.35);
  const e=pick.mid;
  const v2=bsPrice(t2,pick.k,pick.iv,Tat(hold),pick.call);
  const v1=bsPrice(t1,pick.k,pick.iv,Tat(hold*0.5),pick.call);
  const vs=bsPrice(stop,pick.k,pick.iv,Tat(hold*0.3),pick.call);
  /* what a VOL_SHOCK-point IV drop costs at the same spot — long premium is long vega */
  const vShock=bsPrice(spot,pick.k,Math.max(0.02,pick.iv-SW.VOL_SHOCK/100),pick.T,pick.call);
  return{hold,t2:v2,t1:v1,stop:vs,
    p2:(v2-e)/e*100,p1:(v1-e)/e*100,ps:(vs-e)/e*100,
    crushPct:(vShock-e)/e*100,
    thPctDay:e>0?pick.thDay/e*100:0,
    rrP:(v2-e)>0&&(e-vs)>0?(v2-e)/(e-vs):null};
}

/* ---- budget structure: a debit spread for smaller accounts ----
   The 0.70-delta single is the cleanest expression of the thesis, but it is
   the EXPENSIVE one. Selling a second leg at the T2 node finances it: the
   structure itself says the move stalls there, so the cap gives up little
   thesis while cutting the debit 30-60%. Both legs price off the same live
   75D chain -- no invented marks. Suppressed when the saving is not real. */
function sSpread(sym,pick,t2){
  const ch=(state.swChains||{})[sym];
  if(!ch||!ch.list||!pick)return null;
  const cands=[];
  for(const c of ch.list){
    if(c.e!==pick.e||c.call!==pick.call)continue;
    if(pick.call?(c.k<=pick.k):(c.k>=pick.k))continue;   // wing must be beyond the long leg
    const mid=c.mid||(((c.bid||0)+(c.ask||0))/2);
    if(!mid||mid<0.05)continue;
    if((c.oi||0)<100)continue;
    if(!(c.bid>0))continue;                              // must actually be sellable
    cands.push({k:c.k,mid});
  }
  if(!cands.length)return null;
  cands.sort((a,b)=>Math.abs(a.k-t2)-Math.abs(b.k-t2));  // sell where the move stalls
  const sh=cands[0];
  const debit=pick.mid-sh.mid,width=Math.abs(sh.k-pick.k);
  if(debit<=0.05||width<=0)return null;
  const maxP=width-debit;
  if(maxP<=0)return null;
  const save=1-debit/pick.mid;
  if(save<0.25)return null;                              // not meaningfully cheaper
  return{shortK:sh.k,debit,width,maxP,save,rr:maxP/debit,
    be:pick.call?pick.k+debit:pick.k-debit};
}

/* ---- the engine ---- */
function swingRead(sym){
  const gates=[];const G=(n,ok,txt)=>{gates.push({n,ok:!!ok,txt:txt||''});return !!ok;};
  const out={sym,gates};
  const d=state.data[sym];
  if(!d||!d.strikes||!d.strikes.length){out.standby='no chain loaded yet';return out;}
  const tech=state.tech[sym];
  const spot=d.spot;
  const dp=spot>2000?0:2;out.dp=dp;
  const ps=panelStats(sym,d,'gex');
  const kg=kingOf(d.strikes,'gex'),cw=callWallBand(d.strikes,spot,'gex'),pw=putWallBand(d.strikes,spot,'gex');
  if(!G('Daily data',!!(tech&&tech.ok),tech&&tech.ok?(tech.bars+' daily bars'+(tech.proxy?' \u00b7 SPY proxy':'')):'no daily history \u2014 needs a Tradier token')){
    out.standby='waiting on daily bars for trend + realised vol';return out;
  }
  if(!G('Realised vol',!!(tech.hv20&&tech.atrPct),tech.hv20?('HV20 '+(tech.hv20*100).toFixed(0)+'% \u00b7 HV60 '+(tech.hv60?(tech.hv60*100).toFixed(0)+'%':'\u2014')+' \u00b7 ATR '+(tech.atrPct*100).toFixed(2)+'%'):'not enough history')){
    out.standby='cannot judge mispricing without realised vol';return out;
  }
  const atr=tech.atrPct*spot;
  /* --- bias: the same structure the map shows, made explicit --- */
  const tot=d.strikes.reduce((a,s)=>a+Math.abs(s.gex),0)||1;
  const conc=kg?Math.abs(kg.gex)/tot:0;
  const pin=kg&&kg.gex>0;
  const sBias=pin?(kg.k>spot?1:kg.k<spot?-1:0):0;
  let tBias=0;
  if(tech.close>tech.sma20&&tech.sma20>tech.sma50)tBias=1;
  else if(tech.close<tech.sma20&&tech.sma20<tech.sma50)tBias=-1;
  const ret1=tech.ret1||0;
  const intraday=ret1>0.002?1:ret1<-0.002?-1:0;
  const belowFlip=ps.fl!=null&&spot<ps.fl;
  let bias=0,setup=null,why='';
  if(pin){
    if(sBias!==0&&!(tBias!==0&&tBias!==sBias)&&!(sBias>0&&ret1<=-0.009&&belowFlip)&&!(sBias<0&&ret1>=0.009&&!belowFlip)){
      bias=sBias;setup='KING MAGNET';
      why='+GEX regime: dealers fade moves, so price is drawn back toward the '+kg.k+' King, and the daily trend agrees. Structure and trend pointing the same way is the whole bar for a swing.';
    }
  }else{
    const mo=intraday!==0?intraday:tBias;
    if(mo!==0){bias=mo;setup='MOMO RIDE';
      why='\u2212GEX regime: dealers chase rather than fade, so moves extend. Riding the '+(mo>0?'up':'down')+' tape toward the next node instead of fading it.';}
  }
  G('Regime',true,(pin?'+GEX \u00b7 mean-revert to King':'\u2212GEX \u00b7 momentum')+' \u00b7 net\u00b11% '+fmtG(ps.net1,spot)+' \u00b7 King '+(kg?kg.k:'\u2014')+' ('+Math.round(conc*100)+'% of book)');
  G('Daily trend',tBias!==0,tBias>0?'close > 20MA > 50MA':tBias<0?'close < 20MA < 50MA':'MAs tangled \u2014 no daily trend');
  if(!G('Setup',!!setup,setup?setup+' \u00b7 '+(bias>0?'LONG':'SHORT'):(pin?'structure and daily trend disagree, or price is breaking against the King':'no directional tape to ride'))){
    out.standby=pin?'+GEX day \u2014 King and daily trend must agree before a swing qualifies':'\u2212GEX day \u2014 waiting for the tape to pick a side';
    return out;
  }
  /* --- levels: ATR-scaled, structural invalidation preferred --- */
  let stop;
  if(ps.fl!=null&&((bias>0&&ps.fl<spot&&spot-ps.fl<=2.2*atr)||(bias<0&&ps.fl>spot&&ps.fl-spot<=2.2*atr))){
    stop=bias>0?ps.fl-0.25*atr:ps.fl+0.25*atr;
  }else stop=bias>0?spot-1.6*atr:spot+1.6*atr;
  let t1=bias>0?spot+2*atr:spot-2*atr;
  if(kg&&((bias>0&&kg.k>spot+0.4*atr)||(bias<0&&kg.k<spot-0.4*atr))&&Math.abs(kg.k-spot)<=4.5*atr)t1=kg.k;
  const wall=bias>0?cw:pw;
  let t2=bias>0?Math.max(t1+1.4*atr,spot+3.2*atr):Math.min(t1-1.4*atr,spot-3.2*atr);
  if(wall&&((bias>0&&wall.k>t1+0.3*atr)||(bias<0&&wall.k<t1-0.3*atr))&&Math.abs(wall.k-spot)<=7*atr)t2=wall.k;
  const rrU=Math.abs(t2-spot)/Math.max(1e-9,Math.abs(spot-stop));
  if(!G('R:R',rrU>=SW.MIN_RR,rrU.toFixed(2)+':1 in underlying \u00b7 stop '+(+stop).toFixed(dp)+' \u00b7 T2 '+(+t2).toFixed(dp)+' \u00b7 ATR '+atr.toFixed(dp))){
    out.standby='structure R:R '+rrU.toFixed(2)+':1 \u2014 under the '+SW.MIN_RR+' floor';out.setup=setup;return out;
  }
  /* --- contract --- */
  const pick=sPick(sym,bias>0);
  if(pick&&pick.noExp){
    if(pick.pending){
      G('Contract',false,'pulling the '+SW.DTE_TGT+'D expiry \u2014 the map only caches the front months');
      out.standby='fetching the '+SW.DTE_LO+'\u2013'+SW.DTE_HI+' DTE chain for '+sym+' (runs every ~3 min)';
    }else{
      G('Contract',false,'nothing listed in the '+SW.DTE_LO+'\u2013'+SW.DTE_HI+' DTE buy window \u00b7 listed: '+(pick.have||[]).slice(0,7).join(', ')+'d');
      out.standby=sym+' lists no expiry in the '+SW.DTE_LO+'\u2013'+SW.DTE_HI+' DTE window right now';
    }
    out.setup=setup;return out;
  }
  if(!G('Contract',!!pick,pick?(pick.k+(pick.call?'C':'P')+' '+pick.e+' \u00b7 '+Math.round(pick.dte)+'D \u00b7 \u0394'+pick.dl.toFixed(2)+' \u00b7 '+pick.extPct.toFixed(0)+'% extrinsic \u00b7 spread '+(pick.spr!=null?(pick.spr*100).toFixed(1)+'%':'n/a')+' \u00b7 OI '+pick.oi.toLocaleString()):'nothing passes \u0394 '+SW.D_LO+'\u2013'+SW.D_HI+' + OI \u2265'+SW.MIN_OI+' + spread \u2264'+(SW.MAX_SPREAD*100).toFixed(0)+'% in the '+SW.DTE_LO+'\u2013'+SW.DTE_HI+'D window')){
    out.standby='no clean ITM contract in the buy window \u2014 deep ITM is often thin, and a wide spread is a guaranteed loss on entry';
    out.setup=setup;return out;
  }
  sIvRecord(sym,pick.iv);
  /* --- mispricing: IV vs what the stock actually does --- */
  const hv=tech.hv20,hvL=tech.hv60;
  const ivhv=hv>0?pick.iv/hv:null;
  const rank=sIvRank(sym,pick.iv);
  const rich=ivhv!=null&&ivhv>SW.IV_RICH, cheap=ivhv!=null&&ivhv<SW.IV_CHEAP;
  G('Mispricing',!rich,
    'IV '+(pick.iv*100).toFixed(0)+'% vs HV20 '+(hv*100).toFixed(0)+'% = '+(ivhv!=null?ivhv.toFixed(2)+'\u00d7':'\u2014')+
    (cheap?' \u00b7 cheap vs realised':rich?' \u00b7 paying up vs realised':' \u00b7 fair')+
    (rank.rank!=null?' \u00b7 IV rank '+Math.round(rank.rank)+' ('+rank.n+'d)':' \u00b7 IV rank building ('+rank.n+'/20d)'));
  const term=sTerm(sym);
  if(term){
    let etxt='term structure normal \u2014 no event premium in the front month';
    if(term.inverted)etxt='front IV '+(term.front.iv*100).toFixed(0)+'% > back '+(term.back.iv*100).toFixed(0)+'% ('+term.ratio.toFixed(2)+'\u00d7) \u2014 an event is priced before '+term.back.e+'; a '+Math.round(pick.dte)+'D contract holds through the IV crush';
    G('Event risk',!term.inverted,etxt);
  }
  const model=sModel(pick,spot,stop,t1,t2);
  let mtxt='no usable IV to price the contract';
  if(model){
    mtxt='T1 '+(model.p1>=0?'+':'')+model.p1.toFixed(0)+'% \u00b7 T2 '+(model.p2>=0?'+':'')+model.p2.toFixed(0)+'% \u00b7 stop '+model.ps.toFixed(0)+'% \u00b7 prem R:R '+(model.rrP!=null?model.rrP.toFixed(2)+':1':'\u2014')+' over ~'+model.hold+'d';
  }
  if(!G('Premium model',!!(model&&model.p1>0&&model.rrP!=null&&model.rrP>=SW.MIN_RRP),mtxt)){
    let sb='cannot model premium without IV';
    if(model){sb='after '+model.hold+' days of decay the premium R:R is '+(model.rrP!=null?model.rrP.toFixed(2)+':1':'negative')+' \u2014 under the '+SW.MIN_RRP+' floor';if(model.p1<=0)sb+=' and T1 models as a loss';}
    out.standby=sb;out.setup=setup;return out;
  }
  /* --- score --- */
  const drivers=[pin?'+GEX pin':'\u2212GEX momo'];
  let score=32;
  if(ps.fl!=null){
    const above=spot>ps.fl;
    if((bias>0&&above)||(bias<0&&!above)){score+=14;drivers.push((above?'above':'below')+' flip');}
    else score-=8;
  }
  if(tBias===bias){score+=13;drivers.push(bias>0?'daily uptrend':'daily downtrend');}
  score+=Math.round(10*Math.min(1,conc*3));
  if(conc>0.18)drivers.push('dominant King');
  if(intraday===bias){score+=6;drivers.push(bias>0?'intraday \u2191':'intraday \u2193');}
  else if(intraday!==0){score-=10;drivers.push('vs today\u2019s tape');}
  if(cheap){score+=10;drivers.push('IV cheap vs realised');}
  else if(rich){score-=10;drivers.push('IV rich vs realised');}
  if(rank.rank!=null){
    if(rank.rank<30){score+=5;drivers.push('low IV rank');}
    else if(rank.rank>70){score-=5;drivers.push('high IV rank');}
  }
  if(term&&term.inverted){score-=8;drivers.push('event priced');}
  if(bias>0&&tech.rsi>72)score-=9;
  else if(bias<0&&tech.rsi<28)score-=9;
  else score+=5;
  if(ps.vel!=null&&ps.vel>2){score+=4;drivers.push('King building');}
  const fl=flowLean(sym);let flowNote=null;
  if(fl){
    const t=fl.callPrem+fl.putPrem;
    if(t>0){
      const lean=fl.net/t;
      if((bias>0&&lean>0.15)||(bias<0&&lean<-0.15)){score+=8;drivers.push('flow confirms');flowNote='confirms';}
      else if((bias>0&&lean<-0.15)||(bias<0&&lean>0.15)){score-=8;drivers.push('flow diverges');flowNote='diverges';}
    }
  }
  score+=rrU>=2.5?6:3;
  if(pick.spr!=null&&pick.spr>0.04)score-=3;
  score=Math.max(0,Math.min(95,Math.round(score)));
  if(!G('Score',score>=SW.MIN_SCORE,score+' / floor '+SW.MIN_SCORE)){
    out.standby='setup is real but score '+score+' is under the '+SW.MIN_SCORE+' bar';out.setup=setup;return out;
  }
  Object.assign(out,{fire:true,setup,bias,side:bias,stop,t1,t2,rrU,pick,model,score,tech,ps,kg,atr,
    spread:sSpread(sym,pick,t2),
    ivhv,rank,term,rich,cheap,flow:flowNote,drivers:drivers.slice(0,6),why,pin,spot});
  return out;
}

/* ---- targeted chain feed ----
   The map caches only the front months (getSym pulls 3–5 expiries), so the
   60–90 DTE buy window is simply not in state.chains. Rather than widen that
   fetch — which would inflate every request and change what the GEX map means
   — pull ONE expiry near the 75D target per name into a dedicated cache.
   /expirations is 40-min cached, so this costs ~1 chain call per name per 3 min. */
state.swChains=state.swChains||{};
let swFeeding=false,swLast=0;
async function swFeed(force){
  if(swFeeding||state.refreshing)return;
  if(!force&&Date.now()-swLast<180000)return;
  if(!liveOn())return;
  swFeeding=true;swLast=Date.now();
  try{
    for(const sym of TICKS){
      const cur=state.swChains[sym];
      if(cur&&Date.now()-cur.t<180000)continue;
      try{
        const dates=await exps(sym);
        const today=localDate();
        const fut=dates.filter(d=>d>=today).map(d=>({d,dte:dteOf(d)})).filter(x=>x.dte>=SW.DTE_LO&&x.dte<=SW.DTE_HI);
        if(!fut.length){state.swChains[sym]={list:[],t:Date.now(),none:true};continue;}
        fut.sort((a,b)=>Math.abs(a.dte-SW.DTE_TGT)-Math.abs(b.dte-SW.DTE_TGT));
        const e=fut[0].d;
        const j=await tFetch('/markets/options/chains?symbol='+encodeURIComponent(underOf(sym))+'&expiration='+e+'&greeks=true');
        const o=(j.options&&j.options.option)?j.options.option:[];
        const arr=Array.isArray(o)?o:(o?[o]:[]);
        const T=Math.max(dteOf(e),0.02)/365,list=[];
        for(const opt of arr){
          const k=+(opt.strike||0);if(!k)continue;
          const gr=opt.greeks||{};
          const iv=+(gr.mid_iv||gr.smv_vol||0);
          const bid=+(opt.bid||0),ask=+(opt.ask||0);
          const mid=(bid+ask)/2||+(opt.last||0);
          list.push({e,k,call:(opt.option_type||'').toLowerCase()==='call',T,
            oi:+(opt.open_interest||0),vol:+(opt.volume||0),
            iv:(iv>0.01&&iv<5)?iv:0,mid,bid,ask,dl:+(gr.delta||0)});
        }
        if(list.length)state.swChains[sym]={list,t:Date.now(),e};
      }catch(err){}
      await new Promise(r=>setTimeout(r,90));
    }
  }finally{swFeeding=false;}
  if(typeof renderLedger==='function')renderLedger();
if(state.view==='ideas'&&state.zTab!=='zero')renderCards();
}
setTimeout(function(){swFeed(true);},4000);
setInterval(function(){if(!document.hidden)swFeed(false);},60000);

/* ---- one source of truth ----
   ideasSweep re-runs scoreIdea every 30s and writes state.ideas, which the
   deep-dive modal reads. Left alone it would keep republishing the old
   "~ATM, 30–45 DTE" line and fight this engine. Point it here instead. */
function sIdeaOf(r){
  if(!r||!r.fire)return null;
  return{sym:r.sym,score:r.score,t:Date.now(),bias:r.bias>0?'LONG':'SHORT',
    momentum:!r.pin,flow:r.flow,
    line:r.sym+' '+r.pick.k+(r.pick.call?'C':'P')+' '+r.pick.e+' \u00b7 '+Math.round(r.pick.dte)+'D \u00b7 \u0394'+r.pick.dl.toFixed(2)+' \u00b7 '+r.pick.extPct.toFixed(0)+'% extrinsic',
    target:(+r.t1).toFixed(r.dp),invalid:(+r.stop).toFixed(r.dp),
    drivers:r.drivers,
    meta:'King '+(r.kg?r.kg.k:'\u2014')+' \u00b7 IV '+(r.pick.iv*100).toFixed(0)+'% vs HV20 '+(r.tech.hv20*100).toFixed(0)+'% \u00b7 theta '+r.model.thPctDay.toFixed(2)+'%/day \u00b7 RSI '+Math.round(r.tech.rsi)};
}
scoreIdea=function(sym){
  try{return sIdeaOf(swingRead(sym));}catch(e){return null;}
};

/* ---- card: same shape as Zero, because that presentation works ---- */
function sCardHtml(r){
  const c=r.pick,m=r.model,dp=r.dp;
  const sideTag='<span class="tag '+(r.bias>0?'long':'short')+'">'+(r.bias>0?'LONG':'SHORT')+'</span>';
  const d$=p=>'$'+Math.max(0,c.mid*(1+p/100)).toFixed(2);
  const cCell=p=>'<b class="'+(p>=0?'up':'dn')+'">'+d$(p)+'</b> <i>('+(p>=0?'+':'')+p.toFixed(0)+'%)</i>';
  const spec='<div class="zspec">'+
    '<div><span>CONTRACT</span><b>'+r.sym+' '+c.e+' <em style="color:'+(c.call?'var(--green)':'var(--red)')+'">'+c.k+(c.call?'C':'P')+'</em> \u00b7 \u0394'+c.dl.toFixed(2)+(c.spr!=null?' <i>\u00b7 spread '+(c.spr*100).toFixed(1)+'%</i>':'')+'</b></div>'+
    '<div><span>DURATION</span><b>'+Math.round(c.dte)+' DTE <i>\u00b7 exit by '+SW.EXIT_DTE+' DTE, before theta accelerates</i></b></div>'+
    '<div><span>STRUCTURE</span><b>'+c.extPct.toFixed(0)+'% extrinsic <i>\u00b7 $'+c.intr.toFixed(2)+' intrinsic \u00b7 theta '+m.thPctDay.toFixed(2)+'%/day</i></b></div>'+
    '<div><span>VOL</span><b>IV '+(c.iv*100).toFixed(0)+'% <i>\u00b7 '+(r.ivhv!=null?r.ivhv.toFixed(2)+'\u00d7 realised':'\u2014')+' \u00b7 \u2212'+SW.VOL_SHOCK+' vol = '+m.crushPct.toFixed(0)+'%</i></b></div>'+
    '</div>';
  const lvls='<table class="zlvls">'+
    '<tr><th>LEVEL</th><th>UNDERLYING</th><th>CONTRACT (EST)</th></tr>'+
    '<tr class="le"><td>ENTRY</td><td>'+(+r.spot).toFixed(dp)+'</td><td><b>~$'+c.mid.toFixed(2)+'</b> <i>mid</i></td></tr>'+
    '<tr class="ls"><td>STOP</td><td>'+(+r.stop).toFixed(dp)+'</td><td>'+cCell(m.ps)+'</td></tr>'+
    '<tr class="l1"><td>T1</td><td>'+(+r.t1).toFixed(dp)+'</td><td>'+cCell(m.p1)+'</td></tr>'+
    '<tr class="l2"><td>T2</td><td>'+(+r.t2).toFixed(dp)+'</td><td>'+cCell(m.p2)+'</td></tr>'+
    '<tr class="lr"><td>R:R</td><td>'+r.rrU.toFixed(2)+':1</td><td>'+(m.rrP!=null?m.rrP.toFixed(2)+':1':'\u2014')+'</td></tr>'+
    '</table>';
  const bud=r.spread?('<div class="sspread"><b>BUDGET</b> \u00b7 same thesis, smaller debit: '+c.k+'/'+r.spread.shortK+(c.call?'C':'P')+' vertical ~$'+r.spread.debit.toFixed(2)+' <i>('+Math.round(r.spread.save*100)+'% cheaper than the single)</i> \u00b7 max +'+Math.round(r.spread.maxP/r.spread.debit*100)+'% capped at '+r.spread.shortK+' \u00b7 BE '+(+r.spread.be).toFixed(dp)+'</div>'):'';
  const rib=r.cheap?'<div class="zribbon live">IV CHEAP VS REALISED</div>'
          :r.rich?'<div class="zribbon stop">PAYING UP VS REALISED</div>'
          :'<div class="zribbon tgt">'+(r.pin?'+GEX \u00b7 MEAN REVERT':'\u2212GEX \u00b7 MOMENTUM')+'</div>';
  const open=state.ideaOpen==='SW:'+r.sym;
  /* compact thumbnail head — SYM SIDE / strike+exp / Entry · Time · R:R */
  const clk=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  const thumb='<div class="thumb-contract" style="margin-top:4px">'+c.k+(c.call?'C':'P')+' '+c.e+'</div>'+
    '<div class="thumb-grid"><div><span class="tl">Contract</span><span class="tv">~$'+c.mid.toFixed(2)+'</span></div>'+
    '<div><span class="tl">DTE</span><span class="tv">'+Math.round(c.dte)+'</span></div>'+
    '<div><span class="tl">R:R</span><span class="tv" style="color:'+(r.rrU>=2?'var(--green)':'var(--gold)')+'">'+r.rrU.toFixed(1)+':1</span></div></div>';
  const body=open?(spec+lvls+bud+zGatesHtml(r.gates)+
    '<div style="display:flex;gap:5px;flex-wrap:wrap;margin:6px 0 3px">'+(r.drivers||[]).map(x=>'<span class="drv'+(/rich|diverges|event|vs today/.test(x)?' warn':'')+'">'+x+'</span>').join('')+'</div>'+
    '<div class="zwhy">'+r.why+'</div>'+
    '<div class="zfoot">limit at mid, never market \u00b7 '+Math.round(c.dte)+'D contract, close by '+SW.EXIT_DTE+' DTE \u00b7 stop on a DAILY close beyond '+(+r.stop).toFixed(dp)+', not an intraday wick \u00b7 size off max loss (full premium)</div>'):'';
  const lgRec=encodeURIComponent(JSON.stringify({
    sym:r.sym, contract:c.e+' '+c.k+(c.call?'C':'P'), dir:r.bias>0?'LONG':'SHORT',
    entry:+(+r.entry||0).toFixed(dp)||null, stop:+(+r.stop||0).toFixed(dp)||null,
    t1:r.t1!=null?+(+r.t1).toFixed(dp):null, t2:r.t2!=null?+(+r.t2).toFixed(dp):null,
    rr:r.rr||null, score:r.score, mode:SW.LABEL
  }));
  const took=(window.KairosLedger&&window.KairosLedger.lgHas(r.sym,c.e+' '+c.k+(c.call?'C':'P')));
  const takeBox='<label class="lg-take'+(took?' on':'')+'" data-lgtake="'+lgRec+'" title="Log this contract in your ledger — it files itself into Winners or Losers when you mark it.">'+
    '<span class="lg-cb">'+(took?'\u2713':'')+'</span>took it</label>';
  return '<div class="zcard scard idea-thumb'+(open?' open':'')+'" data-swsym="'+r.sym+'">'+rib+
    '<div class="zhead"><div><span class="card-sym">'+r.sym+'</span>'+sideTag+'<span class="zsetup">'+r.setup+'</span></div><div style="display:flex;align-items:center;gap:8px">'+takeBox+'<div class="score">'+r.score+'</div></div></div>'+
    thumb+body+
    '</div>';
}
function sStandbyHtml(r){
  const open=state.ideaOpen==='SW:'+r.sym;
  const spotTxt=r.dp!=null&&state.data[r.sym]?('spot '+(+state.data[r.sym].spot).toFixed(r.dp)):'';
  const head='<div class="zhead"><div><span class="card-sym">'+r.sym+'</span><span class="zsetup">STANDING BY</span></div></div>'+
    '<div class="thumb-standby">'+spotTxt+(r.setup?' \u00b7 '+r.setup:'')+'</div>';
  const body=open?((r.gates&&r.gates.length?zGatesHtml(r.gates):'')+'<div class="zwhy">'+(r.standby||'evaluating\u2026')+'</div>'):'';
  return '<div class="zcard scard zstandby idea-thumb'+(open?' open':'')+'" data-swsym="'+r.sym+'">'+head+body+'</div>';
}

/* ---- render: replaces the old renderCards ---- */
renderCards=function(){
  if(typeof renderAetherPulse==='function')renderAetherPulse();
  const el=document.getElementById('cards');if(!el)return;
  /* Zero owns the Aether view while its tab is active. The old body set
     el.className='zgrid', which WIPED the 'hidden' class zSetTab had put on
     #cards -- so every refresh bled the swing deck straight into the Zero
     tab. Guard first; below, classList is used so 'hidden' survives. */
  if(state.zTab==='zero'){el.classList.add('hidden');return;}
  el.classList.remove('hidden');
  const reads=[];
  for(const sym of TICKS){
    if(!state.data[sym])continue;
    let r=null;
    try{r=swingRead(sym);}catch(e){console.warn('swing',sym,e);continue;}
    reads.push(r);
    state.ideas[sym]=sIdeaOf(r);
  }
  const fired=reads.filter(r=>r.fire).sort((a,b)=>b.score-a.score);
  const idle=reads.filter(r=>!r.fire).sort((a,b)=>(b.setup?1:0)-(a.setup?1:0));
  if(!reads.length){
    el.classList.add('cards');el.classList.remove('zgrid');
    el.innerHTML='<div style="color:var(--muted);font-size:.78rem;line-height:1.6">Scanning the watchlist\u2026 the first pass takes about a minute.</div>';
    return;
  }
  el.classList.add('zgrid');el.classList.remove('cards');
  function swDoctrineHtml(){
  const inv=SW.LABEL==='INVESTOR';
  return '<details class="zhon-d" style="grid-column:1/-1"><summary><span class="nfa-min">NFA</span> <b>'+SW.LABEL+' DOCTRINE</b> \u2014 how contracts are chosen</summary><div class="zhon">'+
    (inv
     ?'Duration '+SW.DTE_LO+'\u2013'+SW.DTE_HI+' DTE and \u0394'+SW.D_LO+'\u2013'+SW.D_HI+' ITM, on purpose: extrinsic is the only part theta can eat, so an intrinsic-heavy contract tracks the underlying \u2248'+Math.round(SW.D_TGT*100)+'c on the dollar and bleeds slowly. It costs more per contract \u2014 that IS the trade: paying for probability and staying power. Exit by '+SW.EXIT_DTE+' DTE. IV is judged against the stock\u2019s own realised vol; every card shows what a \u2212'+SW.VOL_SHOCK+'-vol crush costs.'
     :'Small debit, big asymmetry \u2014 eyes open. \u0394'+SW.D_LO+'\u2013'+SW.D_HI+' (target '+SW.D_TGT+') at '+SW.DTE_LO+'\u2013'+SW.DTE_HI+' DTE sits deliberately nearer the theta window: the contract is cheap because the clock and the odds lean against it. The engine pays for that honestly: R:R \u2265 '+SW.MIN_RR+' demanded, the CHEAPEST contract inside the \u0394 band wins, IV screened vs realised so you\u2019re not buying a crush, and out by '+SW.EXIT_DTE+' DTE win or lose. Size like the premium can go to zero \u2014 it can.')
    +' <b>Not modelled:</b> the econ calendar, headlines, dividends. Context to grade your own read, not signals.</div></details>';
}
/* engine status strip: how many evaluated, how many fired, and WHICH gates
     are holding the rest back — so a quiet board reads as a decision, not a bug. */
  const gateFails={};
  reads.forEach(r=>{if(!r.fire&&r.gates)r.gates.forEach(g=>{if(!g.ok)gateFails[g.n]=(gateFails[g.n]||0)+1;});});
  const topFails=Object.entries(gateFails).sort((a,b)=>b[1]-a[1]).slice(0,3)
    .map(([n,x])=>n+' \u00d7'+x).join(' \u00b7 ');
  const engStatus='<div class="eng-status" style="grid-column:1/-1">SWING ENGINE \u00b7 '+reads.length+' evaluated \u00b7 '+
    (fired.length?('<b style="color:var(--gold)">'+fired.length+' fired</b>'):'<b>0 fired</b>')+
    (topFails?' \u00b7 holding back: '+topFails:'')+
    ' \u00b7 profile <b style="color:var(--teal)">'+SW.LABEL+'</b></div>';
  el.innerHTML=engStatus+fired.map(sCardHtml).join('')+idle.map(sStandbyHtml).join('')+
    swDoctrineHtml();
};
if(state.view==='ideas'&&state.zTab!=='zero')renderCards();
/* swing thumbnails expand/collapse on click (delegated; swing sets innerHTML directly) */
(function(){
  const el=document.getElementById('cards');
  if(el)el.addEventListener('click',function(e){
    const card=e.target.closest('.scard[data-swsym]');
    if(!card)return;
    const sym=card.dataset.swsym;
    state.ideaOpen=(state.ideaOpen==='SW:'+sym)?null:('SW:'+sym);
    renderCards();
  });
})();
window.KairosSwing={SW,swingRead,sPick,sModel,sSpread,sTerm,sIvRank,sIvRecord,bsVega,bsThetaDay,
  ivLog:function(){return swIv;}};
console.log('%cKairos Swing \u2014 60\u201390 DTE, \u03940.55\u20130.82 ITM, IV vs realised. The 30\u201345 DTE window belongs to sellers.','color:#f2c14e;font-weight:bold');

/* =====================================================================
   KAIROS LEDGER — taken-trade tracking for Aether
   Tick a card to log the contract you actually took. The ledger then tracks
   it as OPEN until you mark it a win or a loss, and files it into the right
   tab. Entries keep for 7 days, then age out. Local to this device.
   Nothing here is advice or a recommendation — it is a record of what YOU
   chose to do, kept so the engine's hit-rate can be graded honestly.
   ===================================================================== */
const LG_KEY='kairos_ledger_v1';
const LG_KEEP_DAYS=7;
function lgLoad(){try{return JSON.parse(localStorage.getItem(LG_KEY)||'[]');}catch(e){return [];}}
function lgSave(a){
  const cut=Date.now()-LG_KEEP_DAYS*86400000;
  try{localStorage.setItem(LG_KEY,JSON.stringify(a.filter(x=>x.t>=cut).slice(-300)));}catch(e){}
}
function lgSession(){ // US/Eastern trading day
  try{return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  catch(e){return new Date().toISOString().slice(0,10);}
}
function lgId(sym,contract){return sym+'|'+contract+'|'+lgSession();}
function lgHas(sym,contract){const id=lgId(sym,contract);return lgLoad().some(x=>x.id===id);}
function lgAdd(rec){
  const a=lgLoad();
  const id=lgId(rec.sym,rec.contract);
  if(a.some(x=>x.id===id))return false;
  a.push({id,sym:rec.sym,contract:rec.contract,dir:rec.dir||'',entry:rec.entry??null,
          stop:rec.stop??null,t1:rec.t1??null,t2:rec.t2??null,rr:rec.rr??null,
          score:rec.score??null,mode:rec.mode||'',d:lgSession(),t:Date.now(),
          status:'open',result:null});
  lgSave(a);return true;
}
function lgMark(id,result){
  const a=lgLoad();const x=a.find(z=>z.id===id);if(!x)return;
  if(result===null){x.status='open';x.result=null;delete x.tClose;}
  else{x.status='closed';x.result=result;x.tClose=Date.now();}
  lgSave(a);
}
function lgRemove(id){lgSave(lgLoad().filter(x=>x.id!==id));}
function lgStats(){
  const a=lgLoad();
  const open=a.filter(x=>x.status==='open');
  const win=a.filter(x=>x.result==='win');
  const loss=a.filter(x=>x.result==='loss');
  const closed=win.length+loss.length;
  return{all:a,open,win,loss,closed,rate:closed?win.length/closed*100:null};
}
window.KairosLedger={lgLoad,lgAdd,lgMark,lgRemove,lgStats,lgHas,lgId,lgSession};

/* ---- ledger UI ---- */
let lgTab=localStorage.getItem('kairos_lg_tab')||'open';
function lgRowHtml(x){
  const cls=x.result==='win'?'lg-win':x.result==='loss'?'lg-loss':'lg-open';
  return '<div class="lg-row '+cls+'">'+
    '<span class="lg-sym">'+x.sym+'</span>'+
    '<span class="lg-con mono">'+x.contract+'</span>'+
    (x.dir?'<span class="lg-dir '+(x.dir==='LONG'?'up':'dn')+'">'+x.dir+'</span>':'')+
    '<span class="lg-meta">'+(x.entry!=null?'entry '+x.entry:'')+(x.rr?' \u00b7 R:R '+x.rr:'')+(x.mode?' \u00b7 '+x.mode:'')+'</span>'+
    '<span class="lg-date">'+x.d+'</span>'+
    '<span class="lg-acts">'+
      (x.status==='open'
        ? '<button class="lg-b win" data-lgwin="'+x.id+'">WIN</button><button class="lg-b loss" data-lgloss="'+x.id+'">LOSS</button>'
        : '<button class="lg-b undo" data-lgundo="'+x.id+'">undo</button>')+
      '<button class="lg-b del" data-lgdel="'+x.id+'" title="Remove">\u00d7</button>'+
    '</span></div>';
}
function renderLedger(){
  const host=document.getElementById('ledgerBox');if(!host)return;
  const s=lgStats();
  const list=lgTab==='win'?s.win:lgTab==='loss'?s.loss:s.open;
  const tab=(k,label,n)=>'<button class="lg-tab'+(lgTab===k?' on':'')+'" data-lgtab="'+k+'">'+label+' <i>'+n+'</i></button>';
  host.innerHTML=
    '<div class="lg-head">'+
      '<span class="lg-title">TRADE LEDGER</span>'+
      tab('open','OPEN',s.open.length)+tab('win','WINNERS',s.win.length)+tab('loss','LOSERS',s.loss.length)+
      (s.rate!=null?'<span class="lg-rate">hit rate <b style="color:'+(s.rate>=50?'var(--green)':'var(--gold)')+'">'+s.rate.toFixed(0)+'%</b> <i>('+s.win.length+'/'+s.closed+')</i></span>':'')+
      '<span class="lg-note">your record \u00b7 kept 7 days \u00b7 this device</span>'+
    '</div>'+
    (list.length?list.map(lgRowHtml).join('')
      :'<div class="lg-empty">'+(lgTab==='open'?'Tick a card\u2019s checkbox to log a contract you actually took.':'Nothing filed here yet.')+'</div>');
}
window.renderLedger=renderLedger;
(function(){
  document.addEventListener('click',function(e){
    const t=e.target;
    const tb=t.closest('[data-lgtab]');
    if(tb){lgTab=tb.dataset.lgtab;try{localStorage.setItem('kairos_lg_tab',lgTab);}catch(x){}renderLedger();return;}
    const w=t.closest('[data-lgwin]');if(w){lgMark(w.dataset.lgwin,'win');renderLedger();return;}
    const l=t.closest('[data-lgloss]');if(l){lgMark(l.dataset.lgloss,'loss');renderLedger();return;}
    const u=t.closest('[data-lgundo]');if(u){lgMark(u.dataset.lgundo,null);renderLedger();return;}
    const d=t.closest('[data-lgdel]');if(d){lgRemove(d.dataset.lgdel);renderLedger();return;}
    // the "took it" checkbox on a card
    const cb=t.closest('[data-lgtake]');
    if(cb){
      try{
        const rec=JSON.parse(decodeURIComponent(cb.dataset.lgtake));
        if(lgHas(rec.sym,rec.contract)){/* untick = remove today's entry */lgRemove(lgId(rec.sym,rec.contract));}
        else lgAdd(rec);
        renderLedger();
        if(typeof renderCards==='function')renderCards();
      }catch(x){}
      e.stopPropagation();
    }
  },true);
})();
console.log('%cKairos Ledger \u2014 tick what you took; winners and losers file themselves. Your record, not advice.','color:#34d399;font-weight:bold');

/* ---- swing contract-profile toggle (CORE / AGILE) ---- */
(function(){
  const sel=document.getElementById('swModeSel');
  if(!sel)return;
  const cur=localStorage.getItem('kairos_sw_mode')==='agile'?'agile':'core';
  sel.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.swm===cur));
  sel.addEventListener('click',function(e){
    const b=e.target.closest('button[data-swm]');if(!b)return;
    sel.querySelectorAll('button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
    swSetMode(b.dataset.swm);
    if(typeof renderCards==='function')renderCards();
  });
})();
if(typeof renderLedger==='function')renderLedger();
