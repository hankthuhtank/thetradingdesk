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
  D_FADE:0.48, D_MOMO:0.42,          // target |delta| (research: 0.45-0.55 ATM-ish beats OTM lottos on theta drag)
  D_LO:0.35, D_HI:0.62,
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
  if(!(state.tradierToken&&state.tradierToken.length>8))return Z.UNI;
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
  const range=(sym==='SPXW'||sym==='SPX')?280:45;
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

/* ---- contract picker: liquid, tight, ATM-ish delta ---- */
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
  cands.sort((a,b)=>Math.abs(a.dl-targetD)-Math.abs(b.dl-targetD));
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
  const live=state.tradierToken&&state.tradierToken.length>8;
  if(!G('Live quotes',live,live?'Tradier live':'CBOE is ~15-min delayed — fires disabled without a Tradier token')){out.standby='needs live quotes for 0DTE (delayed data can\u2019t time same-day entries)';return out;}
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
  h+='<div class="zhon"><b>RISK PROTOCOL</b> \u2014 0DTE is the highest-gamma, highest-theta contract on the board: positions can go +100%/\u2212100% in minutes. Risk \u22640.5\u20131% of the account per card and size off max loss (the full premium), not off the stop. Hard stop \u2212'+Z.PREM_STOP+'% premium or the structure stop; '+Z.TIME_STOP+'-minute time stop if T1 hasn\u2019t printed; never add to a loser; two stops = done for the day; flat by 15:30 ET. This engine sees dealer structure and tape \u2014 it does NOT see the econ calendar (10:00/14:00 releases) or headlines. Cards are context to grade your own read, not signals. No backtest exists yet \u2014 paper trade it and grade the journal first.</div>';
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
    if(state.tradierToken&&state.tradierToken.length>8){
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
  if(!(state.tradierToken&&state.tradierToken.length>8))return;
  const ph=zPhase();if(ph.closed)return;
  if(Date.now()-zLastQ<18000)return;zLastQ=Date.now();
  try{const qs=await fetchQuotes(Z.UNI);Z.UNI.forEach(s=>{const u=underOf(s);if(qs[u])state.spot[s]=qs[u];});zRecord();}catch(e){}
},20000);

/* ---- tab wiring + refresh hook ---- */
state.zTab='swing';
function zSetTab(t){
  state.zTab=t;
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
   KAIROS ARENA v3 — THE FIELD  (v7.7)

   What changed from v2 and why:

   v2 drew every strike as a full-width band with repeating texture —
   sawtooth for negative, battlement notches for positive. That was the
   error. A strike's exposure is ONE number; it does not vary along the
   time axis. Smearing repeated sprites across 30 minutes of X manufactured
   visual complexity out of nothing and buried the only thing that actually
   moves: price. Twenty stacked zigzags is noise, not terrain.

   v3 puts exposure where it belongs — on the PRICE axis — as a single
   continuous field, and hands the time axis back to the tape.

     THE FIELD    one vertical gradient across the strike ladder. Colour and
                  opacity ARE the exposure; it fades to black through the
                  zero crossing because that is where the field genuinely
                  cancels. No repetition, no sprites, no dashes.
     AEGIS   (+)  positive exposure — dealers fade moves, price is held.
     MAELSTROM(−) negative exposure — dealers chase, price accelerates.
     THE CROWN    King node.  RAMPARTS  Call/Put wall.  THE RIFT  flip.
     THE FRONT    the real price path, now ending at 62% width.
     THE REACH    forward EM cone from the Standard to the right edge —
                  ±1σ/±2σ implied by ATM IV over the time left to expiry.
                  Real distribution, not a forecast.
     RIDGELINE    right margin: |exposure| per strike as a bar + a legible
                  strike label. This is what the tiny digits should have been.

   Bloom/scanlines/shake are FX. Every position is a number on the ladder.
   ===================================================================== */
'use strict';
const AR={SPAN:30*60000,FWD:18,NOWF:0.62,MINR:0.04,MAXP:150,TOPB:4,TOPN:11,
          PADL:44,PADR:118,PADY:22};
let aRaf=0,aT=0,aTweenSpot=null,aParts=[],aBursts=[],aShake=0,aHudT=0,aStamp='',aSeen={},aPrevReg=null,aRegFlash=0;
let aTrail={},aHistT={},aBloom=null,aScan=0;
const aReduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const aBlurOK=(function(){try{const c=document.createElement('canvas').getContext('2d');c.filter='blur(2px)';return c.filter==='blur(2px)';}catch(e){return false;}})();

function aCv(){return document.getElementById('arenaCanvas');}
function aStop(){if(aRaf){cancelAnimationFrame(aRaf);aRaf=0;}}
function aStart(){aStop();aT=0;aHist(state.focus);if(aReduce){aDraw(0);aHud(true);return;}aRaf=requestAnimationFrame(aFrame);}
function aFrame(ts){
  const dt=aT?Math.min(0.05,(ts-aT)/1000):0.016;aT=ts;
  aDraw(dt);
  if(ts-aHudT>420){aHudT=ts;aHud(false);}
  aRaf=requestAnimationFrame(aFrame);
}

/* ---- real intraday history ----
   v2 asked for a 50-minute window ending now. After the bell that window is
   empty, so the front collapsed to whatever the live tape had (~1 minute).
   v3 pulls the whole RTH session and lets the scene anchor to the newest bar,
   so a closed market shows the last 30 minutes of real tape. */
function aNY(d){
  try{
    const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d);
    const g=t=>{const x=p.find(v=>v.type===t);return x?x.value:'00';};
    return g('year')+'-'+g('month')+'-'+g('day')+' '+(g('hour')==='24'?'00':g('hour'))+':'+g('minute');
  }catch(e){return '';}
}
async function aHist(sym){
  if(!sym)return;
  if(!(state.tradierToken&&state.tradierToken.length>8))return;
  if(aHistT[sym]&&Date.now()-aHistT[sym]<120000)return;
  aHistT[sym]=Date.now();
  const u=underOf(sym);
  try{
    const s=aNY(new Date(Date.now()-9*3600000)),e=aNY(new Date());
    if(!s||!e)return;
    const j=await tFetch('/markets/timesales?symbol='+encodeURIComponent(u)+'&interval=1min&start='+encodeURIComponent(s)+'&end='+encodeURIComponent(e)+'&session_filter=open');
    let dd=j&&j.series&&j.series.data;if(!dd)return;
    if(!Array.isArray(dd))dd=[dd];
    const out=[];
    for(const b of dd){
      const t=b.timestamp?b.timestamp*1000:0,px=+(b.close||b.price||0);
      if(t&&px>0)out.push({t,px});
    }
    if(out.length)aTrail[sym]=out.slice(-420);
  }catch(e){}
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

/* ---- scene ---- */
function aScene(){
  const sym=state.focus,d=state.data[sym];
  if(!d||!d.strikes||!d.strikes.length)return null;
  const metric=state.metric,spot=state.spot[sym]||d.spot;
  if(!spot)return null;
  const ps=panelStats(sym,d,metric);
  const kg=kingOf(d.strikes,metric),cw=callWall(d.strikes,metric),pw=putWall(d.strikes,metric);
  let maxAbs=1;
  for(const s of d.strikes){const a=Math.abs(mval(s,metric));if(a>maxAbs)maxAbs=a;}
  const full=aPath(sym),now=Date.now();
  const last=full.length?full[full.length-1].t:now;
  const live=(now-last)<=5*60000;
  const tEnd=live?now:last;                  /* closed market: anchor to the last real bar */
  const t0=tEnd-AR.SPAN;
  const path=full.filter(p=>p.t>=t0);
  let bestT=null;
  for(const c of (d.contracts||[])){if(bestT===null||c.T<bestT)bestT=c.T;}
  const dteMin=bestT?Math.max(1,bestT*525600):null;
  let half=Math.max(ps.em?ps.em*1.25:spot*0.008,spot*0.005);
  if(path.length){
    let mn=Infinity,mx=-Infinity;
    for(const p of path){if(p.px<mn)mn=p.px;if(p.px>mx)mx=p.px;}
    half=Math.max(half,Math.abs(spot-mn)*1.2,Math.abs(mx-spot)*1.2);
  }
  [kg,cw,pw].forEach(n=>{if(n&&Math.abs(n.k-spot)<spot*0.03)half=Math.max(half,Math.abs(n.k-spot)*1.12);});
  if(ps.fl!=null&&Math.abs(ps.fl-spot)<spot*0.03)half=Math.max(half,Math.abs(ps.fl-spot)*1.1);
  const lo=spot-half,hi=spot+half;
  const ranks=[];
  for(const s of d.strikes){
    if(s.k<lo||s.k>hi)continue;
    const v=mval(s,metric),r=Math.abs(v)/maxAbs;
    if(r<AR.MINR)continue;
    ranks.push({k:s.k,v,r,king:!!(kg&&s.k===kg.k),dl:deltaOf(sym,s.k,v,maxAbs,metric)});
  }
  ranks.sort((a,b)=>b.r-a.r);
  return{sym,d,metric,spot,ps,kg,cw,pw,maxAbs,lo,hi,ranks,path,tEnd,t0,live,dteMin};
}

/* ---- time-at-price (real minutes the path spent per bucket) ---- */
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
  const nowX=plotL+(plotR-plotL)*AR.NOWF;
  const xOf=t=>plotL+(t-sc.t0)/AR.SPAN*(nowX-plotL);
  const xFwd=m=>nowX+(m/AR.FWD)*(plotR-nowX);
  const yOf=p=>AR.PADY+(sc.hi-p)/((sc.hi-sc.lo)||1)*(H-2*AR.PADY);
  const spotY=yOf(aTweenSpot);

  ctx.save();
  if(aShake>0.01)ctx.translate((Math.random()-0.5)*aShake*6,(Math.random()-0.5)*aShake*4);

  /* --- backdrop --- */
  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#080a11');bg.addColorStop(.55,'#06080e');bg.addColorStop(1,'#04050a');
  ctx.fillStyle=bg;ctx.fillRect(-12,-12,W+24,H+24);

  /* --- THE FIELD: one continuous gradient across the ladder ---
     Colour and alpha ARE the exposure. It fades through black at the zero
     crossing because that is where the field genuinely cancels. */
  const band=[...sc.d.strikes].filter(s=>s.k>=sc.lo&&s.k<=sc.hi);
  if(band.length){
    const posOf=k=>Math.max(0,Math.min(1,(sc.hi-k)/((sc.hi-sc.lo)||1)));
    const fg=ctx.createLinearGradient(0,AR.PADY,0,H-AR.PADY);
    for(let i=0;i<band.length;i++){
      const v=mval(band[i],sc.metric),r=Math.abs(v)/sc.maxAbs;
      fg.addColorStop(posOf(band[i].k),'rgba('+(v>=0?TEAL:MAG)+','+(0.04+r*0.44).toFixed(3)+')');
      if(i<band.length-1){
        const v2=mval(band[i+1],sc.metric);
        if(v*v2<0)fg.addColorStop((posOf(band[i].k)+posOf(band[i+1].k))/2,'rgba(9,11,18,0.02)');
      }
    }
    ctx.fillStyle=fg;ctx.fillRect(plotL,AR.PADY,plotR-plotL,H-2*AR.PADY);
  }
  /* depth: the past is dimmer than the live edge */
  const dim=ctx.createLinearGradient(plotL,0,nowX,0);
  dim.addColorStop(0,'rgba(5,7,12,.62)');dim.addColorStop(1,'rgba(5,7,12,0)');
  ctx.fillStyle=dim;ctx.fillRect(plotL,AR.PADY,nowX-plotL,H-2*AR.PADY);
  const vig=ctx.createRadialGradient(nowX,spotY,8,nowX,spotY,Math.max(W,H)*0.75);
  vig.addColorStop(0,'rgba('+(pos?TEAL:MAG)+','+(0.05+aRegFlash*0.18).toFixed(3)+')');
  vig.addColorStop(1,'rgba('+(pos?TEAL:MAG)+',0)');
  ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);

  /* --- time grid --- */
  ctx.strokeStyle='rgba(126,166,214,.05)';ctx.lineWidth=1;
  for(let m=30;m>0;m-=10){
    const x=xOf(sc.tEnd-m*60000);
    ctx.beginPath();ctx.moveTo(x+.5,AR.PADY);ctx.lineTo(x+.5,H-AR.PADY);ctx.stroke();
    aLab(ctx,'-'+m+'m',x+3,H-AR.PADY+13,'rgba(96,106,124,.8)','left',9);
  }
  ctx.strokeStyle='rgba(34,211,238,.22)';ctx.beginPath();
  ctx.moveTo(nowX+.5,AR.PADY);ctx.lineTo(nowX+.5,H-AR.PADY);ctx.stroke();
  aLab(ctx,sc.live?'NOW':'CLOSE',nowX+4,H-AR.PADY+13,'rgba('+CYAN+',.85)','left',9);
  aLab(ctx,'+'+AR.FWD+'m',plotR-2,H-AR.PADY+13,'rgba(96,106,124,.8)','right',9);

  /* --- time @ price, left margin --- */
  const BK=52,prof=aProfile(sc,BK),pmax=Math.max(...prof,1),bh=(H-2*AR.PADY)/BK;
  for(let i=0;i<BK;i++){
    if(!prof[i])continue;
    const inten=prof[i]/pmax,y=AR.PADY+(BK-1-i)*bh,len=inten*(AR.PADL-12);
    ctx.fillStyle='rgba(200,140,70,'+(0.22+inten*0.5).toFixed(3)+')';
    ctx.fillRect(AR.PADL-4-len,y+.5,len,Math.max(1,bh-1));
  }
  aLab(ctx,'TIME @ PRICE',4,AR.PADY-8,'rgba(200,140,70,.7)','left',8);

  /* --- key levels: four lines, not twenty --- */
  const line=(p,col,txt,w)=>{
    if(p==null||p<sc.lo||p>sc.hi)return;
    const y=yOf(p);
    ctx.strokeStyle='rgba('+col+',.42)';ctx.lineWidth=w||1;
    ctx.beginPath();ctx.moveTo(plotL,y+.5);ctx.lineTo(plotR,y+.5);ctx.stroke();
    aLab(ctx,txt,plotL+5,y-6,'rgba('+col+',.92)','left',9);
  };
  line(sc.cw?sc.cw.k:null,TEAL,'CALL WALL '+(sc.cw?sc.cw.k:''),1.5);
  line(sc.pw?sc.pw.k:null,MAG,'PUT WALL '+(sc.pw?sc.pw.k:''),1.5);
  line(sc.ps.fl,GOLD,'THE RIFT '+(sc.ps.fl!=null?(+sc.ps.fl).toFixed(sc.spot>2000?0:1):''),1.2);
  if(sc.kg){const kv=mval(sc.kg,sc.metric);line(sc.kg.k,kv>=0?GOLD:'216,60,255','\u2605 CROWN '+sc.kg.k,2);}

  /* ================= additive layer ================= */
  ctx.globalCompositeOperation='lighter';

  /* --- THE REACH: forward EM cone (real implied distribution) --- */
  if(sc.ps.em&&sc.dteMin){
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

  /* --- tracer fire from the top nodes --- */
  if(!aReduce){
    for(const rk of sc.ranks.slice(0,AR.TOPB)){
      if(Math.random()>rk.r*0.26)continue;
      const ry=yOf(rk.k),hold=rk.v>=0;
      aParts.push({hold,p:0,sp:0.75+rk.r*1.2,r:rk.r,king:rk.king,
        x0:hold?plotL+Math.random()*(nowX-plotL):nowX,y0:hold?ry:spotY,
        x1:nowX,y1:hold?spotY:ry+(ry<spotY?-46:46)});
    }
    if(aParts.length>AR.MAXP)aParts.splice(0,aParts.length-AR.MAXP);
    for(let i=aParts.length-1;i>=0;i--){const q=aParts[i];q.p+=q.sp*dt;if(q.p>=1)aParts.splice(i,1);}
  }
  for(const q of aParts){
    const x=q.x0+(q.x1-q.x0)*q.p,y=q.y0+(q.y1-q.y0)*q.p;
    const a=Math.sin(q.p*Math.PI)*(0.28+q.r*0.5);
    const c=q.king?(q.hold?GOLD:'216,60,255'):(q.hold?TEAL:MAG);
    ctx.strokeStyle='rgba('+c+','+a.toFixed(3)+')';ctx.lineWidth=1+q.r*1.3;
    ctx.beginPath();ctx.moveTo(x-(q.x1-q.x0)*0.045,y-(q.y1-q.y0)*0.045);ctx.lineTo(x,y);ctx.stroke();
  }

  /* --- THE FRONT --- */
  const P=sc.path;
  if(P.length>1){
    for(let i=1;i<P.length;i++){
      const a=Math.max(0.06,1-(sc.tEnd-P[i].t)/AR.SPAN);
      const x0=xOf(P[i-1].t),y0=yOf(P[i-1].px),x1=xOf(P[i].t),y1=yOf(P[i].px);
      ctx.strokeStyle='rgba('+CYAN+','+(a*0.20).toFixed(3)+')';ctx.lineWidth=5+a*5;
      ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,'+(a*0.62).toFixed(3)+')';ctx.lineWidth=1+a*1.3;
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

  /* --- the standard --- */
  const halo=ctx.createRadialGradient(nowX,spotY,0,nowX,spotY,24);
  halo.addColorStop(0,'rgba('+CYAN+',.85)');halo.addColorStop(.5,'rgba('+CYAN+',.22)');halo.addColorStop(1,'rgba('+CYAN+',0)');
  ctx.fillStyle=halo;ctx.beginPath();ctx.arc(nowX,spotY,24,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.96)';ctx.beginPath();ctx.arc(nowX,spotY,3.2,0,Math.PI*2);ctx.fill();
  ctx.globalCompositeOperation='source-over';

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

  /* --- RIDGELINE: readable strikes, right margin --- */
  ctx.fillStyle='rgba(5,7,12,.86)';ctx.fillRect(plotR,0,W-plotR,H);
  ctx.strokeStyle='rgba(126,166,214,.12)';ctx.beginPath();ctx.moveTo(plotR+.5,AR.PADY);ctx.lineTo(plotR+.5,H-AR.PADY);ctx.stroke();
  const bx0=plotR+8,bw=52;
  for(const rk of sc.ranks.slice(0,AR.TOPN)){
    const y=yOf(rk.k),c=rk.king?(rk.v>=0?GOLD:'216,60,255'):(rk.v>=0?TEAL:MAG);
    ctx.fillStyle='rgba('+c+',.8)';
    aRound(ctx,bx0,y-2,Math.max(2,rk.r*bw),4,2);ctx.fill();
    aLab(ctx,(rk.king?'\u2605':'')+rk.k,W-6,y+4,'rgba('+c+',.96)','right',11);
  }
  aLab(ctx,'|'+metricLabel(sc.metric).toUpperCase()+'|',bx0,AR.PADY-8,'rgba(126,166,214,.55)','left',8);

  /* --- price pill (right of the standard, clear of the edge) --- */
  const lab='$'+aTweenSpot.toFixed(2);
  ctx.font='700 12px "JetBrains Mono",monospace';
  const tw=ctx.measureText(lab).width;
  ctx.fillStyle='rgba('+CYAN+',.97)';
  aRound(ctx,nowX+11,spotY-9,tw+13,18,4);ctx.fill();
  ctx.fillStyle='#04121a';ctx.fillText(lab,nowX+17.5,spotY+4);

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

function aLab(ctx,t,x,y,col,align,size){
  ctx.font='600 '+(size||9)+'px "JetBrains Mono",monospace';
  ctx.fillStyle=col;ctx.textAlign=align||'left';ctx.fillText(t,x,y);ctx.textAlign='left';
}
function aRound(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}

/* ---- HUD ---- */
function aHud(){
  const sc=aScene(),hud=document.getElementById('arenaHud'),meta=document.getElementById('arenaMeta');
  if(!hud)return;
  if(!sc){hud.innerHTML='';if(meta)meta.textContent='';return;}
  const st2=sc.sym+'|'+sc.metric+'|'+(state.dataAge[sc.sym]||0);
  if(st2!==aStamp)aStamp=st2;
  const dp=sc.spot>2000?0:2,pos=sc.ps.net1>=0;
  const mins=sc.path.length>1?Math.round((sc.tEnd-sc.path[0].t)/60000):0;
  if(meta)meta.textContent='$'+(+sc.spot).toFixed(2)+' \u00b7 '+sc.d.source+' \u00b7 '+metricLabel(sc.metric).toLowerCase()+' field \u00b7 '+mins+'m of front'+(sc.live?'':' \u00b7 last session');
  let hi=-Infinity,lo=Infinity;
  for(const p of sc.path){if(p.px>hi)hi=p.px;if(p.px<lo)lo=p.px;}
  const st=(l,v,c,tip)=>'<div class="stat"'+(tip?' data-tip="'+tip+'"':'')+'><div class="sl">'+l+'</div><div class="sv" style="color:'+(c||'var(--text)')+'">'+v+'</div></div>';
  hud.innerHTML=
    st('FIELD',pos?'AEGIS':'MAELSTROM',pos?'var(--teal)':'#e879f9','Net '+metricLabel(sc.metric)+' within \u00b11%. Aegis: dealers fade moves, price is held. Maelstrom: dealers chase, moves accelerate.')+
    st('CROWN',sc.kg?sc.kg.k:'\u2014',(sc.kg&&mval(sc.kg,sc.metric)<0)?'#e879f9':'var(--gold)','King \u2014 largest |exposure| node.')+
    st('CALL WALL',sc.cw?sc.cw.k:'\u2014','var(--teal)','Largest positive node above spot.')+
    st('PUT WALL',sc.pw?sc.pw.k:'\u2014','#c99bff','Largest negative node below spot.')+
    st('THE RIFT',sc.ps.fl!=null?(+sc.ps.fl).toFixed(sc.spot>2000?0:1):'\u2014','var(--cyan)','Zero-gamma flip from the repriced profile.')+
    st('30m RANGE',isFinite(hi)&&hi>lo?(hi-lo).toFixed(dp):'\u2014','var(--text)','High-low of the real path on screen.')+
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
    ti.value=v;state.focus=v;aTweenSpot=null;aParts=[];aSeen={};delete aHistT[v];
    renderPresets();aHist(v);
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
setInterval(function(){if(state.view==='arena'&&!document.hidden)aHist(state.focus);},120000);

/* =====================================================================
   EDITABLE PRESET CHIPS
   ===================================================================== */
(function(){
  const KEY='kairos_presets';
  try{
    const saved=JSON.parse(localStorage.getItem(KEY)||'null');
    if(Array.isArray(saved)&&saved.length){PRESETS.length=0;saved.forEach(t=>PRESETS.push(t));}
  }catch(e){}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(PRESETS));}catch(e){}}
  renderPresets=function(){
    const bar=document.getElementById('presetBar');
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

window.KairosArena={AR,aScene,aStart,aStop,aDraw,aHud,aPath,aProfile,aHist,aSigma,
  parts:function(){return aParts;},trail:function(){return aTrail;},
  presets:function(){return PRESETS;},bloomOK:function(){return aBlurOK;},
  reset:function(){aTweenSpot=null;aParts=[];aBursts=[];aSeen={};}};
console.log('%cKairos Nexus \u2014 THE FIELD. Exposure lives on the price axis; time belongs to the tape.','color:#2dd4bf;font-weight:bold');



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
const SW={
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
  VOL_SHOCK:5                           // vol points for the crush disclosure
};

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
    cands.sort((a,b)=>Math.abs(a.dl-SW.D_TGT)-Math.abs(b.dl-SW.D_TGT));
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
  const kg=kingOf(d.strikes,'gex'),cw=callWall(d.strikes,'gex'),pw=putWall(d.strikes,'gex');
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
  if(!(state.tradierToken&&state.tradierToken.length>8))return;
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
  return '<div class="zcard scard">'+rib+
    '<div class="zhead"><div><span class="card-sym">'+r.sym+'</span>'+sideTag+'<span class="zsetup">'+r.setup+'</span></div><div class="score">'+r.score+'</div></div>'+
    spec+lvls+bud+zGatesHtml(r.gates)+
    '<div style="display:flex;gap:5px;flex-wrap:wrap;margin:6px 0 3px">'+(r.drivers||[]).map(x=>'<span class="drv'+(/rich|diverges|event|vs today/.test(x)?' warn':'')+'">'+x+'</span>').join('')+'</div>'+
    '<div class="zwhy">'+r.why+'</div>'+
    '<div class="zfoot">limit at mid, never market \u00b7 '+Math.round(c.dte)+'D contract, close by '+SW.EXIT_DTE+' DTE \u00b7 stop on a DAILY close beyond '+(+r.stop).toFixed(dp)+', not an intraday wick \u00b7 size off max loss (full premium)</div>'+
    '</div>';
}
function sStandbyHtml(r){
  const mini=r.dp!=null&&state.data[r.sym]?('<div class="zrow mono" style="color:var(--muted)">spot '+(+state.data[r.sym].spot).toFixed(r.dp)+(r.setup?' \u00b7 '+r.setup:'')+'</div>'):'';
  return '<div class="zcard scard zstandby">'+
    '<div class="zhead"><div><span class="card-sym">'+r.sym+'</span><span class="zsetup">STANDING BY</span></div></div>'+
    mini+(r.gates&&r.gates.length?zGatesHtml(r.gates):'')+
    '<div class="zwhy">'+(r.standby||'evaluating\u2026')+'</div></div>';
}

/* ---- render: replaces the old renderCards ---- */
renderCards=function(){
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
  el.innerHTML=fired.map(sCardHtml).join('')+idle.map(sStandbyHtml).join('')+
    '<div class="zhon" style="grid-column:1/-1"><b>SWING DOCTRINE</b> \u2014 duration is '+SW.DTE_LO+'\u2013'+SW.DTE_HI+' DTE on purpose. 30\u201345 DTE is the option <b>seller\u2019s</b> window: roughly half of an ATM option\u2019s extrinsic value burns in the final 30 days, versus ~15\u201320% between 90 and 60 DTE. A buyer entering at 30\u201345 DTE is buying the theta cliff. Strikes are \u0394'+SW.D_LO+'\u2013'+SW.D_HI+' (ITM) because extrinsic value is the only part theta can eat \u2014 a 0.70\u0394 contract is mostly intrinsic, tracks the underlying ~70c on the dollar, and bleeds far less than ATM. Long premium is <b>long vega</b>: every card shows what a \u2212'+SW.VOL_SHOCK+'-vol move costs. IV is judged against the stock\u2019s own realised vol (HV20) rather than raw IV, and the IV rank matures as this browser accrues sessions. Prefer a smaller debit? When a fired card shows a <b>BUDGET</b> line, the same long leg is paired with a short leg sold at the T2 node \u2014 the structure already says the move stalls there, so the cap costs little thesis while the debit drops sharply. <b>Not modelled:</b> the econ calendar, headlines, or dividends \u2014 and term-structure inversion only <i>infers</i> an event, it does not read an earnings date. Context to grade your own read, not signals.</div>';
};
if(state.view==='ideas'&&state.zTab!=='zero')renderCards();
window.KairosSwing={SW,swingRead,sPick,sModel,sSpread,sTerm,sIvRank,sIvRecord,bsVega,bsThetaDay,
  ivLog:function(){return swIv;}};
console.log('%cKairos Swing \u2014 60\u201390 DTE, \u03940.55\u20130.82 ITM, IV vs realised. The 30\u201345 DTE window belongs to sellers.','color:#f2c14e;font-weight:bold');
