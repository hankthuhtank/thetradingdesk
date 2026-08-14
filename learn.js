/* ============================================================================
   THE TRADING DESK · LEARN
   ----------------------------------------------------------------------------
   The site already held everything worth teaching. What it did not hold was an
   answer to the only question a beginner actually has on arrival, which is
   where to start. So this adds two things and nothing else:

     THE TRACK      the eight sessions as a real path, with progress kept on
                    the device, each step opening the section that teaches it
     QUICK FIND     one box across every dataset, because a beginner who hears
                    a word they do not know should not have to guess which
                    shelf it lives on

   Everything else on the page is untouched.
   ============================================================================ */
(function(){
'use strict';
const T=window.TDESK||{};
const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const SLOW=matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();

/* ============================================================================
   1. THE TRACK
   The eight sessions in reference.js are already a real curriculum in a real
   order. They were just sitting on a page nobody reaches first.

   Each step points at the section that actually teaches it, so the path is
   navigation rather than a separate copy of the material.
   ============================================================================ */
const GOES=[
  {to:'encyclopedia', label:'Open the encyclopedia'},
  {to:'encyclopedia', label:'Open the encyclopedia'},
  {to:'tools',        label:'Open the toolkit'},
  {to:'patterns',     label:'Open candlestick patterns'},
  {to:'indicators',   label:'Open the indicators'},
  {to:'strategies',   label:'Open the strategies'},
  {to:'riskdesk',     label:'Open the risk desk'},
  {to:'sessions',     label:'Open the full sessions'}
];
const KEY='tdesk_track_v1';
let DONE=(()=>{ try{ return new Set(JSON.parse(localStorage.getItem(KEY))||[]); }
                catch(e){ return new Set(); } })();
function save(){ try{ localStorage.setItem(KEY,JSON.stringify([...DONE])); }catch(e){} }

function nextStep(){
  const S=T.SESSIONS||[];
  for(let i=0;i<S.length;i++) if(!DONE.has(i)) return i;
  return -1;
}
function drawTrack(){
  const host=$('#trackList'); if(!host) return;
  const S=T.SESSIONS||[];
  if(!S.length){ host.innerHTML=''; return; }
  const nx=nextStep();

  host.innerHTML=S.map((s,i)=>{
    const done=DONE.has(i), isNext=i===nx;
    const g=GOES[i]||GOES[0];
    return `<div class="tstep${done?' done':''}${isNext?' next':''}" data-i="${i}">
      <button class="ts-tick" data-tick="${i}" aria-pressed="${done}"
        aria-label="${done?'Mark step '+(i+1)+' not done':'Mark step '+(i+1)+' done'}">
        <span class="ts-no">${String(i+1).padStart(2,'0')}</span>
        <span class="ts-check">✓</span>
      </button>
      <div class="ts-body">
        <div class="ts-head">
          <h3>${esc(s[0])}</h3>
          ${isNext?'<span class="ts-flag">You are here</span>':''}
        </div>
        <p>${esc(s[1])}</p>
        ${s[2]?`<p class="ts-take">${esc(s[2])}</p>`:''}
        <button class="ts-go" data-open="${g.to}">${esc(g.label)} &rarr;</button>
      </div>
    </div>`;
  }).join('');

  $$('[data-tick]',host).forEach(b=>b.addEventListener('click',()=>{
    const i=+b.dataset.tick;
    if(DONE.has(i)) DONE.delete(i); else DONE.add(i);
    save(); drawTrack();
  }));
  $$('[data-open]',host).forEach(b=>b.addEventListener('click',()=>go(b.dataset.open)));

  const S_len=S.length;
  const c=2*Math.PI*14, pct=DONE.size/S_len;
  const fg=$('.tfp-fg');
  if(fg){ fg.setAttribute('stroke-dasharray',c.toFixed(1));
          fg.setAttribute('stroke-dashoffset',(c*(1-pct)).toFixed(1)); }
  const d=$('#trackDone'); if(d) d.textContent=DONE.size+' of '+S_len;
  const pp=$('#pathProg'); if(pp) pp.textContent=DONE.size+' of '+S_len;
  const go1=$('#trackGo');
  if(go1) go1.textContent = nx<0 ? 'Review the path' : (DONE.size?'Continue: ':'Start: ')+S[nx][0];
}
function go(page){
  if(typeof window.showPage==='function'){ try{ window.showPage(page); return; }catch(e){} }
  location.hash='#'+page;
}

/* ============================================================================
   2. QUICK FIND
   One index over everything, because a beginner who hears "theta" should not
   have to know that theta lives in the encyclopedia rather than the options
   section. Ranked so an exact title beats a body-text mention.
   ============================================================================ */
const SHELF={
  enc:{label:'Encyclopedia', page:'encyclopedia'},
  pat:{label:'Candlestick',  page:'patterns'},
  ind:{label:'Indicator',    page:'indicators'},
  str:{label:'Strategy',     page:'strategies'},
  opt:{label:'Options',      page:'options'}
};
let IDX=[];
function buildIndex(){
  const push=(k,title,sub,body,open)=>{
    if(!title) return;
    IDX.push({k,title,sub:sub||'',hunt:norm([title,sub,body].join(' ')),key:norm(title),open});
  };
  (T.ENCYCLOPEDIA||[]).forEach((e,i)=>push('enc',e.t,e.tag||e.def,[e.def,e.why,e.watch].join(' '),
    ()=>openIn('encyclopedia',()=>window.openEnc&&window.openEnc(i))));
  (T.PATTERNS||[]).forEach((p,i)=>push('pat',p.n,p.read,[p.ctx,p.trap].join(' '),
    ()=>openIn('patterns',()=>window.openPattern&&window.openPattern(i))));
  (T.INDICATORS||[]).forEach(x=>push('ind',x.n,x.meas,x.cat,
    ()=>go('indicators')));
  (T.STRATEGIES||[]).forEach((s,i)=>push('str',s.n,s.alias||s.thesis,s.thesis,
    ()=>openIn('strategies',()=>window.openStrat&&window.openStrat(i))));
  (T.OPT_STRUCTURES||[]).forEach(o=>push('opt',o.n,o.want||o.when,[o.when,o.fails].join(' '),
    ()=>go('options')));
}
/* route to the section, then open the entry once its page is actually showing */
function openIn(page,fn){
  go(page);
  setTimeout(()=>{ try{ fn(); }catch(e){} },260);
}
function score(r,q){
  if(r.key===q) return 100;
  if(r.key.startsWith(q)) return 60;
  if(r.key.includes(q)) return 40;
  if(r.hunt.includes(q)) return 12;
  return 0;
}
function drawFind(q){
  const res=$('#qfRes'), seed=$('#qfSeed');
  if(!res) return;
  const n=norm(q);
  if(!n){ res.innerHTML=''; res.classList.remove('on'); if(seed) seed.style.display=''; return; }
  if(seed) seed.style.display='none';
  const rows=IDX.map(r=>({r,s:score(r,n)})).filter(x=>x.s>0)
    .sort((a,b)=>b.s-a.s||a.r.title.length-b.r.title.length).slice(0,9);
  res.classList.add('on');
  if(!rows.length){
    res.innerHTML=`<div class="qf-none">Nothing matches <b>${esc(q)}</b>.
      Try a single word, like <em>theta</em>, <em>doji</em> or <em>stop</em>.</div>`;
    return;
  }
  res.innerHTML=rows.map((x,i)=>`<button class="qf-hit${i?'':' hot'}" data-i="${i}">
    <span class="qf-t">${esc(x.r.title)}</span>
    <span class="qf-d">${esc(x.r.sub.slice(0,88))}</span>
    <span class="qf-k">${esc(SHELF[x.r.k].label)}</span>
  </button>`).join('');
  $$('.qf-hit',res).forEach(b=>b.addEventListener('click',()=>{
    const hit=rows[+b.dataset.i]; if(hit) hit.r.open();
  }));
  res._rows=rows;
}
function wireFind(){
  const inp=$('#qfIn'), res=$('#qfRes'), seed=$('#qfSeed');
  if(!inp) return;
  let at=0;
  /* a few real starting points, so an empty box is still an invitation */
  if(seed){
    const picks=['Support & Resistance','Doji','Implied Volatility','Position Sizing',
                 'Risk-to-Reward (R)','Long Call'];
    seed.innerHTML='<span class="qf-lbl">Common starting points</span>'
      +picks.map(p=>`<button data-seed="${esc(p)}">${esc(p)}</button>`).join('');
    $$('[data-seed]',seed).forEach(b=>b.addEventListener('click',()=>{
      inp.value=b.dataset.seed; drawFind(inp.value); inp.focus();
    }));
  }
  inp.addEventListener('input',()=>{ at=0; drawFind(inp.value); });
  inp.addEventListener('keydown',e=>{
    const rows=res._rows||[];
    if(e.key==='Enter'&&rows[at]){ e.preventDefault(); rows[at].r.open(); return; }
    if(e.key==='Escape'){ inp.value=''; drawFind(''); inp.blur(); return; }
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault(); if(!rows.length) return;
      at=(at+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length;
      $$('.qf-hit',res).forEach((b,i)=>b.classList.toggle('hot',i===at));
    }
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='/'&&!/input|textarea/i.test(document.activeElement.tagName)){
      e.preventDefault();
      inp.scrollIntoView({behavior:SLOW?'auto':'smooth',block:'center'});
      setTimeout(()=>inp.focus(),SLOW?0:300);
    }
  });
}

/* ============================================================================
   BOOT
   ============================================================================ */
function step(n,fn){ try{ fn(); }catch(e){ console.error('[learn] '+n+':',e); } }
function init(){
  step('index',buildIndex);
  step('track',drawTrack);
  step('find',wireFind);
  const g=$('#trackGo');
  if(g) g.addEventListener('click',()=>{
    const nx=nextStep();
    go((GOES[nx<0?0:nx]||GOES[0]).to);
  });
  const r=$('#trackReset');
  if(r) r.addEventListener('click',()=>{ DONE=new Set(); save(); drawTrack(); });
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
else init();
})();


/* ============================================================================
   THE BOARD
   ----------------------------------------------------------------------------
   The front page had two organising devices arguing with each other: a course
   listed down the page, and then every section listed again underneath. So
   this is one device.

   Each shelf is a tile. A tile opens IN PLACE and shows what is actually
   inside it, pulled from the real datasets, with every item clickable
   straight through to its entry. Nothing is described twice, and nothing is
   listed twice.
   ============================================================================ */
(function(){
'use strict';
const T=window.TDESK||{};
const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const SLOW=matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const C={cy:'#22d3ee',gd:'#f5b942',gr:'#34d399',rd:'#f87171',vi:'#0ea5e9',ln:'rgba(126,166,214,.2)',fa:'#8a94a6'};
const go=p=>{ if(typeof window.showPage==='function'){try{window.showPage(p);return;}catch(e){}} location.hash='#'+p; };
const open=(p,fn)=>{ go(p); setTimeout(()=>{try{fn&&fn();}catch(e){}},260); };


/* ---------------------------------------------------------------------------
   TILE ART
   Flat two-colour line drawings read as clip art. Each figure below gets a
   gradient wash, a soft glow on the element that carries the meaning, and a
   baseline so it sits in a space rather than floating in one.
   --------------------------------------------------------------------------- */
let UID=0;
function defs(id,col){
  return `<defs>
    <linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${col}" stop-opacity=".34"/>
      <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
    </linearGradient>
    <filter id="f${id}" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="3.4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;
}
function grid(w,h){
  return `<g opacity=".5">${[0,1,2,3].map(i=>
    `<line x1="0" y1="${(h/4)*(i+1)}" x2="${w}" y2="${(h/4)*(i+1)}"
      stroke="rgba(126,166,214,.09)" stroke-width="1"/>`).join('')}</g>`;
}

/* one candle from [open, close, high, low] */
function cnd(o,c,h,l,x,w,H,pad,i){
  const y=v=>pad+(100-v)/100*(H-pad*2);
  const up=c>=o, col=up?C.gr:C.rd, t=Math.max(o,c), b=Math.min(o,c);
  const bh=Math.max(3,y(b)-y(t));
  return `<g class="ck" style="--d:${(i||0)*90}ms">
    <line x1="${x+w/2}" y1="${y(h)}" x2="${x+w/2}" y2="${y(l)}"
      stroke="${col}" stroke-width="1.6" stroke-linecap="round" opacity=".85"/>
    <rect x="${x}" y="${y(t)}" width="${w}" height="${bh}" rx="1.5"
      fill="${up?'rgba(52,211,153,.28)':'rgba(248,113,113,.85)'}"
      stroke="${col}" stroke-width="1.6"/>
    <rect x="${x}" y="${y(t)}" width="${w}" height="${bh}" rx="1.5"
      fill="none" stroke="${col}" stroke-width="1.6" opacity=".5" filter="url(#fCK)"/>
  </g>`;
}
function svg(w,h,inner){ return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}"
  preserveAspectRatio="xMidYMid meet" aria-hidden="true">${inner}</svg>`; }

/* ---------------------------------------------------------------------------
   Each shelf declares: how it looks, and what its first few real items are.
   The items come from the datasets, so the board can never advertise
   something the section does not contain.
   --------------------------------------------------------------------------- */
const SHELVES=[
  {id:'patterns', name:'Candlesticks', accent:C.gr, size:'lg',
   line:'What one candle is telling you, and when it is telling you nothing.',
   count:()=>(T.PATTERNS||[]).length+' patterns',
   fig:(w,h)=>{const set=[[40,70,78,30],[66,48,76,40],[48,84,92,42],[72,60,80,52],[58,88,94,50]];
     const n=set.length, cw=Math.min(19,(w-28)/n), gap=(w-cw*n-16)/(n-1);
     return svg(w,h,
       `<defs>
          <filter id="fCK" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3"/></filter>
          <linearGradient id="gCK" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${C.gr}" stop-opacity=".13"/>
            <stop offset="100%" stop-color="${C.gr}" stop-opacity="0"/></linearGradient>
        </defs>
        <rect x="0" y="0" width="${w}" height="${h}" fill="url(#gCK)"/>
        ${grid(w,h)}
        ${set.map((k,i)=>cnd(k[0],k[1],k[2],k[3],8+i*(cw+gap),cw,h,10,i)).join('')}
        <line x1="0" y1="${h-3}" x2="${w}" y2="${h-3}" stroke="${C.ln}" stroke-width="1"/>`);},
   items:()=>(T.PATTERNS||[]).slice(0,8).map((p,i)=>({
     t:p.n, d:p.read, tag:p.side==='bull'?'Bullish':p.side==='bear'?'Bearish':'Neutral',
     run:()=>open('patterns',()=>window.openPattern&&window.openPattern(i))}))},

  {id:'encyclopedia', name:'Encyclopedia', accent:C.gd, size:'md',
   line:'Every term you will hear, in plain English.',
   count:()=>(T.ENCYCLOPEDIA||[]).length+' entries',
   fig:(w,h)=>svg(w,h,
     `<defs><linearGradient id="gEN" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${C.gd}" stop-opacity=".5"/>
        <stop offset="100%" stop-color="${C.gd}" stop-opacity="0"/></linearGradient>
        <filter id="fEN"><feGaussianBlur stdDeviation="2.6"/></filter></defs>
      <rect x="8" y="7" width="${w-16}" height="${h-14}" rx="4" fill="rgba(245,185,66,.05)"
        stroke="rgba(245,185,66,.2)"/>
      ${[0,1,2,3].map(i=>{
        const y=18+i*((h-30)/3), lit=i===1;
        return `<line class="en-l" style="--d:${i*130}ms" x1="16" y1="${y}"
          x2="${lit?w*0.52:w-16}" y2="${y}" stroke="${lit?'url(#gEN)':C.ln}"
          stroke-width="${lit?3.4:2.4}" stroke-linecap="round"/>`
          +(lit?`<circle cx="${w*0.52+7}" cy="${y}" r="2.8" fill="${C.gd}" filter="url(#fEN)"/>`:'');
      }).join('')}`),
   items:()=>{
     const want=['Support & Resistance','Liquidity','Implied Volatility','Position Sizing',
                 'Risk-to-Reward (R)','Slippage','Theta','Gamma Exposure (GEX)'];
     const E=T.ENCYCLOPEDIA||[];
     return want.map(n=>{const i=E.findIndex(e=>e.t===n); return i<0?null:
       ({t:E[i].t, d:E[i].tag||E[i].def, tag:'Term',
         run:()=>open('encyclopedia',()=>window.openEnc&&window.openEnc(i))});}).filter(Boolean);
   }},

  {id:'options', name:'Options', accent:C.cy, size:'md',
   line:'Nineteen structures, and the exact contracts each one buys and sells.',
   count:()=>(T.OPT_STRUCTURES||[]).length+' structures',
   fig:(w,h)=>{const z=h-20, kx=w*0.44;
     return svg(w,h,
       `<defs><linearGradient id="gOP" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${C.gr}" stop-opacity=".42"/>
          <stop offset="100%" stop-color="${C.gr}" stop-opacity="0"/></linearGradient>
          <linearGradient id="gOL" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${C.rd}" stop-opacity="0"/>
            <stop offset="100%" stop-color="${C.rd}" stop-opacity=".28"/></linearGradient>
          <filter id="fOP"><feGaussianBlur stdDeviation="3.2"/></filter></defs>
        ${grid(w,h)}
        <path d="M10 ${z+9} L${kx} ${z+9} L${w-10} ${z} Z" fill="url(#gOL)"/>
        <path d="M${kx} ${z} L${w-10} 11 L${w-10} ${z} Z" fill="url(#gOP)"/>
        <line x1="6" y1="${z}" x2="${w-6}" y2="${z}" stroke="${C.ln}" stroke-dasharray="4 4"/>
        <path class="op-p" d="M10 ${z+9} L${kx} ${z+9} L${w-10} 11" fill="none" stroke="${C.cy}"
          stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
        <path d="M10 ${z+9} L${kx} ${z+9} L${w-10} 11" fill="none" stroke="${C.cy}"
          stroke-width="2.6" opacity=".55" filter="url(#fOP)"/>
        <circle cx="${kx}" cy="${z+9}" r="3.4" fill="${C.cy}"/>`);},
   items:()=>(T.OPT_STRUCTURES||[]).slice(0,8).map(o=>({
     t:o.n, d:o.want||o.when, tag:o.dir||'Structure', run:()=>go('options')}))},

  {id:'indicators', name:'Indicators', accent:C.cy, size:'sm',
   line:'What each one measures, and what it lags.',
   count:()=>(T.INDICATORS||[]).length+' instruments',
   fig:(w,h)=>{
     const S=[44,58,40,66,52,74,60,82,66,78,88,72];
     const pt=(v,i)=>`${9+i/(S.length-1)*(w-18)},${h-9-((v-34)/58)*(h-18)}`;
     const sm=S.map((_,i)=>S.slice(Math.max(0,i-3),i+1).reduce((a,b)=>a+b,0)/Math.min(4,i+1));
     const band=(a,b,col)=>`<rect x="0" y="${h-9-((b-34)/58)*(h-18)}" width="${w}"
       height="${((b-a)/58)*(h-18)}" fill="${col}" opacity=".07"/>`;
     return svg(w,h,
       `<defs><filter id="fIN"><feGaussianBlur stdDeviation="3"/></filter></defs>
        ${band(78,92,C.rd)}${band(34,48,C.gr)}
        <line x1="0" y1="${h-9-((78-34)/58)*(h-18)}" x2="${w}" y2="${h-9-((78-34)/58)*(h-18)}"
          stroke="${C.rd}" stroke-width="1" stroke-dasharray="3 3" opacity=".5"/>
        <line x1="0" y1="${h-9-((48-34)/58)*(h-18)}" x2="${w}" y2="${h-9-((48-34)/58)*(h-18)}"
          stroke="${C.gr}" stroke-width="1" stroke-dasharray="3 3" opacity=".5"/>
        <polyline points="${S.map(pt).join(' ')}" fill="none" stroke="${C.fa}" stroke-width="1.2" opacity=".6"/>
        <polyline class="in-p" points="${sm.map(pt).join(' ')}" fill="none" stroke="${C.cy}"
          stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
        <polyline points="${sm.map(pt).join(' ')}" fill="none" stroke="${C.cy}" stroke-width="2.4"
          opacity=".5" filter="url(#fIN)"/>
        <circle cx="${pt(sm[sm.length-1],sm.length-1).split(',')[0]}"
          cy="${pt(sm[sm.length-1],sm.length-1).split(',')[1]}" r="3.4" fill="${C.cy}"/>`);},
   items:()=>(T.INDICATORS||[]).slice(0,8).map(x=>({
     t:x.n, d:x.meas, tag:x.badge||'Tool', run:()=>go('indicators')}))},

  {id:'strategies', name:'Strategies', accent:C.vi, size:'sm',
   line:'Setups with the evidence, and the way each one fails.',
   count:()=>(T.STRATEGIES||[]).length+' playbooks',
   fig:(w,h)=>{
     const d=`M9 ${h-13} L${w*0.26} ${h*0.6} L${w*0.44} ${h*0.72} L${w*0.68} ${h*0.26} L${w-9} 12`;
     return svg(w,h,
       `<defs><linearGradient id="gST" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${C.vi}" stop-opacity=".3"/>
          <stop offset="100%" stop-color="${C.vi}" stop-opacity="0"/></linearGradient>
          <filter id="fST"><feGaussianBlur stdDeviation="3"/></filter></defs>
        ${grid(w,h)}
        <path d="${d} L${w-9} ${h} L9 ${h} Z" fill="url(#gST)"/>
        <line x1="0" y1="${h*0.72}" x2="${w}" y2="${h*0.72}" stroke="${C.rd}" stroke-width="1"
          stroke-dasharray="3 3" opacity=".55"/>
        <line x1="0" y1="${h*0.26}" x2="${w}" y2="${h*0.26}" stroke="${C.gr}" stroke-width="1"
          stroke-dasharray="3 3" opacity=".55"/>
        <path class="st-p" d="${d}" fill="none" stroke="${C.vi}" stroke-width="2.4"
          stroke-linejoin="round" stroke-linecap="round"/>
        <path d="${d}" fill="none" stroke="${C.vi}" stroke-width="2.4" opacity=".5" filter="url(#fST)"/>
        <circle cx="${w*0.26}" cy="${h*0.6}" r="3.6" fill="${C.gd}"/>
        <circle cx="${w*0.68}" cy="${h*0.26}" r="3.8" fill="${C.gr}"/>`);},
   items:()=>(T.STRATEGIES||[]).slice(0,8).map((s,i)=>({
     t:s.n, d:s.alias||s.thesis, tag:'Grade '+(s.grade||'—'),
     run:()=>open('strategies',()=>window.openStrat&&window.openStrat(i))}))},

  {id:'riskdesk', name:'Risk & Mind', accent:C.gd, size:'sm',
   line:'Sizing, hedging, and the ten ways a working brain breaks a working plan.',
   count:()=>((T.MISTAKES||[]).length+(T.HEDGES||[]).length)+' entries',
   fig:(w,h)=>svg(w,h,
     `<defs><linearGradient id="gRK" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${C.gd}" stop-opacity=".9"/>
        <stop offset="100%" stop-color="${C.gd}" stop-opacity=".28"/></linearGradient>
        <filter id="fRK"><feGaussianBlur stdDeviation="3"/></filter></defs>
      ${[0,1,2,3,4].map(i=>{
        const bw=(w-20)/5-7, bh=(i+1)*((h-22)/5), x=10+i*((w-20)/5), y=h-10-bh;
        const hot=i>2;
        return `<rect class="rk-b" style="--d:${i*90}ms" x="${x}" y="${y}" width="${bw}"
          height="${bh}" rx="2.5" fill="${hot?'url(#gRK)':'rgba(126,166,214,.22)'}"/>`
          +(i===4?`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="2.5"
             fill="${C.gd}" opacity=".5" filter="url(#fRK)"/>`:'');
      }).join('')}
      <line x1="6" y1="${h-9}" x2="${w-6}" y2="${h-9}" stroke="${C.ln}"/>`),
   items:()=>{
     const out=[];
     (T.TIERS||[]).slice(0,3).forEach(t=>out.push({t:t.name,d:t.gist,tag:t.band,run:()=>go('riskdesk')}));
     (T.MISTAKES||[]).slice(0,5).forEach(m=>out.push({t:m.n,d:m.s,tag:'Mistake',run:()=>go('riskdesk')}));
     return out;
   }},

  {id:'tools', name:'Calculators', accent:C.gr, size:'sm',
   line:'Position size, expectancy, payoff and expected move, worked on the page.',
   count:()=>'13 tools',
   fig:(w,h)=>svg(w,h,
     `<defs><filter id="fTL"><feGaussianBlur stdDeviation="3"/></filter></defs>
      <rect x="8" y="6" width="${w-16}" height="${h-12}" rx="5" fill="rgba(52,211,153,.04)"
        stroke="rgba(52,211,153,.18)"/>
      ${[0,1,2].map(r=>[0,1,2].map(c=>{
        const bw=(w-34)/3, bh=(h-30)/3, x=15+c*(bw+3), y=13+r*(bh+3);
        const lit=(r===1&&c===1)||(r===2&&c===2);
        return `<rect class="tl-k" style="--d:${(r*3+c)*55}ms" x="${x}" y="${y}"
          width="${bw}" height="${bh}" rx="2.5"
          fill="${lit?C.gr:'rgba(126,166,214,.16)'}" opacity="${lit?'.95':'1'}"/>`
          +(lit?`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="2.5" fill="${C.gr}"
             opacity=".55" filter="url(#fTL)"/>`:'');
      }).join('')).join('')}`),
   items:()=>[
     {t:'Position size',d:'Account, risk percent, entry and stop become a share count.',tag:'Calc',run:()=>go('tools')},
     {t:'Expectancy',d:'Win rate and average R become a number that says whether to keep going.',tag:'Calc',run:()=>go('tools')},
     {t:'Options payoff',d:'Build any structure and see the shape it makes at expiry.',tag:'Calc',run:()=>go('tools')},
     {t:'Expected move',d:'What the options market says the range is before earnings.',tag:'Calc',run:()=>go('tools')}
   ]}
];

/* Detailed section art — filled shapes with depth, not thin outline glyphs */
const ART={
  patterns:`
    <rect x="3" y="9" width="4" height="8" rx="1" fill="currentColor" opacity=".25"/>
    <path d="M5 4v16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <rect x="3.2" y="9" width="3.6" height="7" rx=".6" fill="currentColor"/>
    <rect x="10" y="6" width="4" height="11" rx="1" fill="currentColor" opacity=".25"/>
    <path d="M12 3v18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <rect x="10.2" y="6" width="3.6" height="10" rx=".6" fill="currentColor"/>
    <rect x="17" y="11" width="4" height="6" rx="1" fill="currentColor" opacity=".25"/>
    <path d="M19 5v16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <rect x="17.2" y="11" width="3.6" height="5.5" rx=".6" fill="currentColor"/>`,
  encyclopedia:`
    <path d="M4 5.5c0-.8.7-1.5 1.5-1.5H12v15.5H5.5A1.5 1.5 0 0 1 4 18V5.5z" fill="currentColor" opacity=".15"/>
    <path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H12v15.5h6.5a1.5 1.5 0 0 0 1.5-1.5V5.5z" fill="currentColor" opacity=".28"/>
    <path d="M4 5.5c0-.8.7-1.5 1.5-1.5H12v15.5H5.5A1.5 1.5 0 0 1 4 18V5.5z" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H12v15.5h6.5a1.5 1.5 0 0 0 1.5-1.5V5.5z" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <path d="M12 4v15.5" stroke="currentColor" stroke-width="1.5"/>
    <path d="M6.5 9h3.5M6.5 12h3M6.5 15h2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".65"/>
    <path d="M14 9h3.5M14 12h3M14 15h2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".65"/>`,
  options:`
    <path d="M3 16c2-6 4-9 5.5-9s2.5 5 4 5 2.5-7 4.5-7 4 5 4 5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M3 20h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>
    <circle cx="8.5" cy="7" r="2" fill="currentColor"/>
    <circle cx="16.5" cy="5" r="2" fill="currentColor" opacity=".7"/>
    <path d="M8.5 9.2v10.5M16.5 7.2v12.5" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2 2" opacity=".4"/>`,
  indicators:`
    <path d="M4 20h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <rect x="5.5" y="11" width="3.2" height="9" rx=".8" fill="currentColor" opacity=".35"/>
    <rect x="10.4" y="6" width="3.2" height="14" rx=".8" fill="currentColor" opacity=".55"/>
    <rect x="15.3" y="13" width="3.2" height="7" rx=".8" fill="currentColor" opacity=".35"/>
    <path d="M7 10.5V20M12 5.5V20M17 12.5V20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="7" cy="10" r="1.8" fill="currentColor"/>
    <circle cx="12" cy="5" r="1.8" fill="currentColor"/>
    <circle cx="17" cy="12" r="1.8" fill="currentColor"/>`,
  strategies:`
    <path d="M3 18h18" stroke="currentColor" stroke-width="1.5" opacity=".4"/>
    <path d="M4 15l4-7 3 4 4-9 5 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M4 15l4-7 3 4 4-9 5 6" stroke="currentColor" stroke-width="5" fill="none" opacity=".12" stroke-linecap="round"/>
    <circle cx="4" cy="15" r="2" fill="currentColor"/>
    <circle cx="8" cy="8" r="2" fill="currentColor"/>
    <circle cx="11" cy="12" r="2" fill="currentColor"/>
    <circle cx="15" cy="3" r="2.2" fill="currentColor"/>
    <circle cx="20" cy="9" r="2" fill="currentColor"/>`,
  riskdesk:`
    <path d="M12 2.8l8 3.8v5.2c0 5.2-3.6 8.8-8 9.8-4.4-1-8-4.6-8-9.8V6.6z" fill="currentColor" opacity=".18"/>
    <path d="M12 2.8l8 3.8v5.2c0 5.2-3.6 8.8-8 9.8-4.4-1-8-4.6-8-9.8V6.6z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/>
    <path d="M8.5 12.2l2.4 2.4 4.6-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  tools:`
    <rect x="4" y="3" width="16" height="18" rx="2.5" fill="currentColor" opacity=".12"/>
    <rect x="4" y="3" width="16" height="18" rx="2.5" stroke="currentColor" stroke-width="1.6" fill="none"/>
    <rect x="6.5" y="5.5" width="11" height="4" rx="1" fill="currentColor" opacity=".25"/>
    <rect x="6.5" y="5.5" width="11" height="4" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/>
    <circle cx="8.2" cy="13.2" r="1.35" fill="currentColor"/>
    <circle cx="12" cy="13.2" r="1.35" fill="currentColor"/>
    <circle cx="15.8" cy="13.2" r="1.35" fill="currentColor"/>
    <circle cx="8.2" cy="17.2" r="1.35" fill="currentColor"/>
    <circle cx="12" cy="17.2" r="1.35" fill="currentColor"/>
    <circle cx="15.8" cy="17.2" r="1.35" fill="currentColor"/>`
};

function board(){
  const rack=$('#rack'); if(!rack) return;
  rack.innerHTML='';
  /* Display order: riskdesk last so it can span full width */
  const order=['patterns','encyclopedia','options','indicators','strategies','tools','riskdesk'];
  const byId=Object.fromEntries(SHELVES.map(s=>[s.id,s]));

  order.forEach((id,idx)=>{
    const s=byId[id]; if(!s) return;
    const items=(s.items()||[]).slice(0,3);
    const names=items.map(it=>it.t).filter(Boolean);
    const examplesHtml=names.length
      ? `<span class="panel-examples"><em>${names.map(n=>esc(n)).join(', ')}</em></span>`
      : '';
    const wide = (id==='riskdesk') ? ' wide' : '';
    const card=document.createElement('button');
    card.type='button';
    card.className='panel'+wide;
    card.style.setProperty('--ac', s.accent);
    card.setAttribute('data-id', s.id);
    card.setAttribute('aria-label', s.name + ' — ' + s.count());
    card.innerHTML=`
      <span class="panel-art" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">${ART[s.id]||ART.tools}</svg>
      </span>
      <span class="panel-body">
        <span class="panel-kicker">${esc(s.count())}</span>
        <span class="panel-title">${esc(s.name)}</span>
        <span class="panel-desc">${esc(s.line)}</span>
        ${examplesHtml}
        <span class="panel-cta">Open ${esc(s.name)} <i>→</i></span>
      </span>`;
    card.addEventListener('click',()=>go(s.id));
    rack.appendChild(card);
  });
}

function board(){
  const rack=$('#rack'); if(!rack) return;
  rack.innerHTML='';

  SHELVES.forEach(s=>{
    const items=(s.items()||[]).slice(0,3);
    const examples=items.map(it=>`<span class="pe-item">${esc(it.t)}</span>`).join('');
    const card=document.createElement('button');
    card.type='button';
    card.className='panel';
    card.style.setProperty('--ac', s.accent);
    card.setAttribute('data-id', s.id);
    card.setAttribute('aria-label', s.name + ' — ' + s.count());
    card.innerHTML=`
      <span class="panel-art" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">${ART[s.id]||ART.tools}</svg>
      </span>
      <span class="panel-body">
        <span class="panel-kicker">${esc(s.count())}</span>
        <span class="panel-title">${esc(s.name)}</span>
        <span class="panel-desc">${esc(s.line)}</span>
        ${examples?`<span class="panel-examples"><span class="pe-label">Examples</span>${examples}</span>`:''}
        <span class="panel-cta">Open ${esc(s.name)} <i>→</i></span>
      </span>`;
    card.addEventListener('click',()=>go(s.id));
    rack.appendChild(card);
  });
}

/* the path, opened from the board instead of listed beside it */
function pathModal(){
  const wrap=$('#pathWrap'), btn=$('#openPath'), x=$('#pathX');
  if(!wrap||!btn) return;
  const show=v=>{ wrap.classList.toggle('on',v); document.body.style.overflow=v?'hidden':''; };
  btn.addEventListener('click',()=>show(true));
  x.addEventListener('click',()=>show(false));
  wrap.addEventListener('click',e=>{ if(e.target===wrap) show(false); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') show(false); });
}

function spawnParticles(){
  const host=$('#heroParticles'); if(!host||SLOW) return;
  host.innerHTML='';
  const n=36;
  for(let i=0;i<n;i++){
    const s=document.createElement('span');
    const x=Math.random()*100;
    const delay=Math.random()*8;
    const dur=6+Math.random()*10;
    const size=1+Math.random()*2.5;
    const gold=Math.random()>.72;
    s.style.left=x+'%';
    s.style.bottom=(-5-Math.random()*20)+'%';
    s.style.width=size+'px';
    s.style.height=size+'px';
    s.style.animationDuration=dur+'s';
    s.style.animationDelay=delay+'s';
    if(gold){ s.style.background='var(--gold)'; s.style.boxShadow='0 0 6px var(--gold)'; }
    else { s.style.boxShadow='0 0 6px var(--cyan)'; }
    host.appendChild(s);
  }
}

function boot(){
  try{ board(); }catch(e){ console.error('[board]',e); }
  try{ pathModal(); }catch(e){ console.error('[path]',e); }
  try{ spawnParticles(); }catch(e){ console.error('[particles]',e); }
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,40));
else setTimeout(boot,40);
})();

/* ============================================================================
   ENCYCLOPEDIA CROSS REFERENCE
   ----------------------------------------------------------------------------
   Seventy-nine entries that constantly refer to each other, with no way to
   follow the reference. Reading "theta" inside the definition of a calendar
   spread and having to close the panel, scroll, and search is where a
   reference stops being usable.

   So: any term with its own entry becomes a link, and the panel keeps a trail
   so you can walk back out the way you came in. openEnc is wrapped rather
   than replaced, which leaves the reading path, the level filter and the
   next-on-path button exactly as they were.
   ============================================================================ */
(function(){
'use strict';
const T=window.TDESK||{};
const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const ENC=T.ENCYCLOPEDIA||[];
if(!ENC.length) return;

const byTitle={}; ENC.forEach((e,i)=>{ byTitle[norm(e.t)]=i; });

/* The text says "IV" where the entry is "Implied Volatility", and "the
   greeks" where the entry is "Greeks". Without aliases the link rate is about
   a third of what it should be. */
const ALIAS={'iv':'implied volatility','implied vol':'implied volatility',
  'dte':'days to expiration','gex':'gamma exposure','oi':'open interest',
  'the greeks':'greeks','atr':'average true range','rsi':'relative strength index',
  'ema':'exponential moving average','sma':'simple moving average',
  'expected move':'expected move','pdt':'pattern day trader'};

/* longest first, so "bull call spread" wins over "call" */
/* Titles carry their own abbreviation: "Implied Volatility (IV)",
   "Risk-to-Reward (R)". Prose never contains that literal string, so the
   match is built on the title WITHOUT the parenthetical, and the abbreviation
   inside it is registered as its own alias. */
const strip=t=>String(t).replace(/\s*\([^)]*\)\s*/g,' ').replace(/\s+/g,' ').trim();
const TERMS=ENC.flatMap((e,i)=>{
    const out=[{i,t:strip(e.t),k:norm(strip(e.t))}];
    const ab=(String(e.t).match(/\(([^)]{2,6})\)/)||[])[1];
    if(ab&&/^[A-Za-z0-9/\- ]+$/.test(ab)) out.push({i,t:ab.trim(),k:norm(ab)});
    return out;
  })
  .concat(Object.keys(ALIAS).map(a=>{
    const i=byTitle[norm(ALIAS[a])];
    return i==null?null:{i,t:a,k:norm(a)};
  }).filter(Boolean))
  .filter(x=>x.k.length>=2)
  .sort((a,b)=>b.k.length-a.k.length);

let TRAIL=[], routing=false;

/* Walk the rendered panel and wrap the first mention of each term. Working on
   text nodes rather than innerHTML means an existing link, heading or button
   can never be rewritten from underneath. */
function linkify(root,selfTitle){
  const used=new Set([norm(selfTitle)]);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
    acceptNode(n){
      if(!n.nodeValue||n.nodeValue.trim().length<4) return NodeFilter.FILTER_REJECT;
      const p=n.parentElement;
      if(!p||p.closest('a,button,code,.xlink,.xtrail,.xalso,.enc-next,h1,h2,h3,h4'))
        return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }});
  const nodes=[]; let n;
  while((n=walker.nextNode())) nodes.push(n);

  nodes.forEach(node=>{
    if(used.size>9) return;
    let text=node.nodeValue, hit=false;
    for(const term of TERMS){
      if(used.has(term.k)) continue;
      const re=new RegExp('\\b('+term.t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')\\b','i');
      if(!re.test(text)) continue;
      used.add(term.k);
      text=text.replace(re,'\u0001'+term.i+'\u0002$1\u0003');
      hit=true;
      if(used.size>9) break;
    }
    if(!hit) return;
    const span=document.createElement('span');
    span.innerHTML=esc(text)
      .replace(/\u0001(\d+)\u0002/g,'<button type="button" class="xlink" data-e="$1">')
      .replace(/\u0003/g,'</button>');
    node.parentNode.replaceChild(span,node);
  });

  $$('.xlink',root).forEach(b=>{
    const i=+b.dataset.e;
    b.title='Open '+(ENC[i]?ENC[i].t:'entry');
    b.addEventListener('click',ev=>{
      ev.preventDefault(); ev.stopPropagation();
      jump(i,selfTitle);
    });
  });
}
function jump(i,from){
  if(from) TRAIL.push(from);
  routing=true; window.openEnc(i); routing=false;
}
function back(){
  const prev=TRAIL.pop();
  if(prev==null) return;
  const i=byTitle[norm(prev)];
  if(i==null) return;
  const keep=TRAIL.slice();
  routing=true; window.openEnc(i); TRAIL=keep; routing=false;
  trail();
}
function trail(){
  const body=$('#encBody'); if(!body) return;
  const old=$('.xtrail',body); if(old) old.remove();
  if(!TRAIL.length) return;
  const bar=document.createElement('div');
  bar.className='xtrail';
  const from=TRAIL[TRAIL.length-1];
  bar.innerHTML=`<button type="button" class="xback">&larr; Back to ${esc(from)}</button>`
    +(TRAIL.length>1?`<span class="xcrumb">${TRAIL.slice(-3).map(esc).join(' › ')}</span>`:'');
  body.insertBefore(bar,body.firstChild);
  $('.xback',bar).addEventListener('click',back);
}

/* related entries, so a dead end still offers somewhere to go */
const STOP=new Set(['the','a','an','of','and','or','to','in','on','for','with','by','is','it',
  'this','that','at','as','from','your','you','be','are','how','what','when','not','than']);
function also(i){
  const e=ENC[i]; if(!e) return [];
  const words=norm(e.t).split(' ').filter(w=>w.length>3&&!STOP.has(w));
  const out=[];
  ENC.forEach((o,j)=>{
    if(j===i) return;
    let sc=0;
    words.forEach(w=>{
      if(norm(o.t).includes(w)) sc+=3;
      else if(norm([o.def,o.why,o.tag].join(' ')).includes(w)) sc+=1;
    });
    if(o.cat===e.cat) sc+=1;
    if(sc>=3) out.push({j,sc});
  });
  if(out.length<3) ENC.forEach((o,j)=>{
    if(j!==i&&o.cat===e.cat&&out.length<6) out.push({j,sc:1});
  });
  const seen=new Set();
  return out.sort((a,b)=>b.sc-a.sc)
    .filter(x=>{ if(seen.has(x.j)) return false; seen.add(x.j); return true; })
    .slice(0,6).map(x=>x.j);
}
function attachAlso(body,i){
  if($('.xalso',body)) return;
  const rel=also(i); if(!rel.length) return;
  const box=document.createElement('div');
  box.className='xalso';
  box.innerHTML=`<div class="h">Related terms</div><div class="g">${
    rel.map(j=>`<button type="button" data-e="${j}">${esc(ENC[j].t)}</button>`).join('')}</div>`;
  body.appendChild(box);
  $$('button',box).forEach(b=>b.addEventListener('click',()=>jump(+b.dataset.e,ENC[i].t)));
}

/* Two ways in, because relying on one is how this silently does nothing.
   Wrapping openEnc is the clean path. If the page exposes it differently,
   the observer below catches the panel being written and enhances it anyway. */
function enhance(i,title){
  const body=$('#encBody'); if(!body) return;
  if(body.dataset.xref===String(i)) return;
  body.dataset.xref=String(i);
  try{ trail(); linkify(body,title); attachAlso(body,i); }
  catch(err){ console.error('[xref]',err); }
}
function observe(){
  const body=$('#encBody'); if(!body) return;
  new MutationObserver(()=>{
    if($('.xlink',body)||$('.xalso',body)) return;      /* already enhanced */
    const bar=$('#enc-bar');
    const t=bar?bar.textContent.replace(/^ENCYCLOPEDIA\s*\/\/\s*/i,'').trim():'';
    if(!t) return;
    const i=byTitle[norm(t)];
    if(i==null) return;
    body.dataset.xref='';
    enhance(i,ENC[i].t);
  }).observe(body,{childList:true});
}
function install(){
  observe();
  const orig=window.openEnc;
  if(typeof orig!=='function') return;
  window.openEnc=function(i){
    if(!routing) TRAIL=[];          /* a fresh open from the grid starts a new walk */
    orig.apply(this,arguments);
    const e=ENC[i]; if(!e) return;
    const b=$('#encBody'); if(b) b.dataset.xref='';
    enhance(i,e.t);
  };
  /* Escape steps back through the trail before it closes the panel */
  document.addEventListener('keydown',ev=>{
    if(ev.key!=='Escape') return;
    const m=$('#m-enc');
    if(m&&m.classList.contains('open')&&TRAIL.length){ ev.stopPropagation(); back(); }
  },true);
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(install,80));
else setTimeout(install,80);
})();
