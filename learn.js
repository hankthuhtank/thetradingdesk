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
const C={cy:'#22d3ee',gd:'#f5b942',gr:'#34d399',rd:'#f87171',vi:'#a78bfa',ln:'rgba(126,166,214,.2)',fa:'#8a94a6'};
const go=p=>{ if(typeof window.showPage==='function'){try{window.showPage(p);return;}catch(e){}} location.hash='#'+p; };
const open=(p,fn)=>{ go(p); setTimeout(()=>{try{fn&&fn();}catch(e){}},260); };

/* one candle from [open, close, high, low] */
function cnd(o,c,h,l,x,w,H,pad){
  const y=v=>pad+(100-v)/100*(H-pad*2);
  const up=c>=o, col=up?C.gr:C.rd, t=Math.max(o,c), b=Math.min(o,c);
  return `<line x1="${x+w/2}" y1="${y(h)}" x2="${x+w/2}" y2="${y(l)}" stroke="${col}" stroke-width="1.5"/>
    <rect x="${x}" y="${y(t)}" width="${w}" height="${Math.max(2,y(b)-y(t))}"
      fill="${up?'rgba(52,211,153,.22)':col}" stroke="${col}" stroke-width="1.5"/>`;
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
   fig:(w,h)=>{const set=[[42,72,80,32],[64,50,74,42],[50,86,92,44],[70,58,78,50]];
     const cw=Math.min(20,(w-30)/4), gap=(w-cw*4-16)/3;
     return svg(w,h,set.map((k,i)=>cnd(k[0],k[1],k[2],k[3],8+i*(cw+gap),cw,h,10)).join(''));},
   items:()=>(T.PATTERNS||[]).slice(0,8).map((p,i)=>({
     t:p.n, d:p.read, tag:p.side==='bull'?'Bullish':p.side==='bear'?'Bearish':'Neutral',
     run:()=>open('patterns',()=>window.openPattern&&window.openPattern(i))}))},

  {id:'encyclopedia', name:'Encyclopedia', accent:C.gd, size:'md',
   line:'Every term you will hear, in plain English.',
   count:()=>(T.ENCYCLOPEDIA||[]).length+' entries',
   fig:(w,h)=>svg(w,h,[0,1,2,3].map(i=>`<line x1="10" y1="${13+i*13}"
     x2="${i===1?w*0.5:w-10}" y2="${13+i*13}" stroke="${i===1?C.gd:C.ln}"
     stroke-width="2.6" stroke-linecap="round"/>`).join('')),
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
   fig:(w,h)=>{const z=h-16;
     return svg(w,h,`<line x1="10" y1="${z}" x2="${w-10}" y2="${z}" stroke="${C.ln}"/>
       <path d="M${w*0.42} ${z} L${w-10} 12 L${w-10} ${z} Z" fill="${C.gr}" opacity=".15"/>
       <path d="M10 ${z+8} L${w*0.42} ${z+8} L${w-10} 12" fill="none" stroke="${C.cy}"
         stroke-width="2.2" stroke-linejoin="round"/>`);},
   items:()=>{
     const P=T.OPT_PLAYS||{};
     return (T.OPT_STRUCTURES||[]).slice(0,8).map(o=>({
       t:o.n, d:(P[o.id]&&P[o.id].legs)?P[o.id].legs.join(' · '):(o.want||o.when),
       tag:o.dir||'Structure', mono:!!(P[o.id]&&P[o.id].legs),
       run:()=>go('options')}));
   }},

  {id:'indicators', name:'Indicators', accent:C.cy, size:'sm',
   line:'What each one measures, and what it lags.',
   count:()=>(T.INDICATORS||[]).length+' instruments',
   fig:(w,h)=>{const S=[46,54,48,62,56,70,64,76,70,82];
     const pt=(v,i)=>`${10+i/(S.length-1)*(w-20)},${h-10-((v-42)/44)*(h-20)}`;
     const sm=S.map((_,i)=>S.slice(Math.max(0,i-3),i+1).reduce((a,b)=>a+b,0)/Math.min(4,i+1));
     return svg(w,h,`<polyline points="${S.map(pt).join(' ')}" fill="none" stroke="${C.fa}" stroke-width="1.3"/>
       <polyline points="${sm.map(pt).join(' ')}" fill="none" stroke="${C.cy}" stroke-width="2.2"/>`);},
   items:()=>(T.INDICATORS||[]).slice(0,8).map(x=>({
     t:x.n, d:x.meas, tag:x.badge||'Tool', run:()=>go('indicators')}))},

  {id:'strategies', name:'Strategies', accent:C.vi, size:'sm',
   line:'Setups with the evidence, and the way each one fails.',
   count:()=>(T.STRATEGIES||[]).length+' playbooks',
   fig:(w,h)=>svg(w,h,`<path d="M10 ${h-14} L${w*0.3} ${h*0.54} L${w*0.5} ${h*0.66} L${w*0.72} ${h*0.24} L${w-10} 12"
     fill="none" stroke="${C.vi}" stroke-width="2.2" stroke-linejoin="round"/>
     <circle cx="${w*0.3}" cy="${h*0.54}" r="3.6" fill="${C.gd}"/>
     <circle cx="${w*0.72}" cy="${h*0.24}" r="3.6" fill="${C.gr}"/>`),
   items:()=>(T.STRATEGIES||[]).slice(0,8).map((s,i)=>({
     t:s.n, d:s.alias||s.thesis, tag:'Grade '+(s.grade||'—'),
     run:()=>open('strategies',()=>window.openStrat&&window.openStrat(i))}))},

  {id:'riskdesk', name:'Risk & Mind', accent:C.gd, size:'sm',
   line:'Sizing, hedging, and the ten ways a working brain breaks a working plan.',
   count:()=>((T.MISTAKES||[]).length+(T.HEDGES||[]).length)+' entries',
   fig:(w,h)=>svg(w,h,[0,1,2,3,4].map(i=>`<rect x="${10+i*((w-20)/5)}"
     y="${h-10-(i+1)*((h-22)/5)}" width="${(w-20)/5-7}" height="${(i+1)*((h-22)/5)}"
     rx="2" fill="${i>2?C.gd:C.ln}"/>`).join('')),
   items:()=>{
     const out=[];
     (T.TIERS||[]).slice(0,3).forEach(t=>out.push({t:t.name,d:t.gist,tag:t.band,run:()=>go('riskdesk')}));
     (T.MISTAKES||[]).slice(0,5).forEach(m=>out.push({t:m.n,d:m.s,tag:'Mistake',run:()=>go('riskdesk')}));
     return out;
   }},

  {id:'tools', name:'Calculators', accent:C.gr, size:'sm',
   line:'Position size, expectancy, payoff and expected move, worked on the page.',
   count:()=>'13 tools',
   fig:(w,h)=>svg(w,h,[0,1,2].map(r=>[0,1,2].map(c=>`<rect x="${12+c*((w-24)/3)}"
     y="${10+r*((h-20)/3)}" width="${(w-24)/3-7}" height="${(h-20)/3-7}" rx="2"
     fill="${r===1&&c===1?C.gr:C.ln}" opacity="${r===1&&c===1?'.9':'.5'}"/>`).join('')).join('')),
   items:()=>[
     {t:'Position size',d:'Account, risk percent, entry and stop become a share count.',tag:'Calc',run:()=>go('tools')},
     {t:'Expectancy',d:'Win rate and average R become a number that says whether to keep going.',tag:'Calc',run:()=>go('tools')},
     {t:'Options payoff',d:'Build any structure and see the shape it makes at expiry.',tag:'Calc',run:()=>go('tools')},
     {t:'Expected move',d:'What the options market says the range is before earnings.',tag:'Calc',run:()=>go('tools')}
   ]}
];

let OPEN=null;
function board(){
  const host=$('#board'); if(!host) return;
  host.innerHTML=SHELVES.map(s=>`
    <article class="sh sh-${s.size}" data-id="${s.id}" style="--ac:${s.accent}">
      <button class="sh-face" aria-expanded="false">
        <span class="sh-fig"></span>
        <span class="sh-txt">
          <span class="sh-top"><b>${esc(s.name)}</b><em>${esc(s.count())}</em></span>
          <span class="sh-line">${esc(s.line)}</span>
        </span>
        <span class="sh-cue">Browse<i>+</i></span>
      </button>
      <div class="sh-open" hidden></div>
    </article>`).join('');

  /* figures are drawn after layout so each one fits its own tile */
  SHELVES.forEach(s=>{
    const el=$(`.sh[data-id="${s.id}"] .sh-fig`,host); if(!el) return;
    const w=Math.max(120,el.clientWidth||180), h=s.size==='lg'?92:64;
    el.innerHTML=s.fig(w,h);
  });

  $$('.sh',host).forEach(card=>{
    const s=SHELVES.find(x=>x.id===card.dataset.id);
    const face=$('.sh-face',card), pane=$('.sh-open',card);
    face.addEventListener('click',()=>{
      const isOpen=card.classList.contains('on');
      $$('.sh',host).forEach(o=>{
        o.classList.remove('on');
        const f=$('.sh-face',o), p=$('.sh-open',o);
        f.setAttribute('aria-expanded','false'); p.hidden=true;
      });
      if(isOpen){ OPEN=null; return; }
      OPEN=s.id;
      card.classList.add('on');
      face.setAttribute('aria-expanded','true');
      pane.hidden=false;
      if(!pane.dataset.built){
        const items=s.items()||[];
        pane.innerHTML=`<div class="sh-items">${items.map((it,i)=>`
            <button class="sh-item" data-i="${i}">
              <span class="si-t">${esc(it.t)}</span>
              <span class="si-d${it.mono?' mono':''}">${esc(it.d||'')}</span>
              <span class="si-g">${esc(it.tag||'')}</span>
            </button>`).join('')}</div>
          <button class="sh-all">Open all ${esc(s.count())} &rarr;</button>`;
        $$('.sh-item',pane).forEach(b=>b.addEventListener('click',()=>{
          const it=items[+b.dataset.i]; if(it&&it.run) it.run();
        }));
        $('.sh-all',pane).addEventListener('click',()=>go(s.id));
        pane.dataset.built='1';
      }
      if(!SLOW&&card.scrollIntoView) card.scrollIntoView({behavior:'smooth',block:'nearest'});
    });
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

let rz;
addEventListener('resize',()=>{ clearTimeout(rz); rz=setTimeout(()=>{
  SHELVES.forEach(s=>{
    const el=$(`.sh[data-id="${s.id}"] .sh-fig`); if(!el) return;
    const w=Math.max(120,el.clientWidth||180), h=s.size==='lg'?92:64;
    el.innerHTML=s.fig(w,h);
  });
},220); });

function boot(){
  try{ board(); }catch(e){ console.error('[board]',e); }
  try{ pathModal(); }catch(e){ console.error('[path]',e); }
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,40));
else setTimeout(boot,40);
})();
