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
   THE FRONT DESK
   ----------------------------------------------------------------------------
   Three additions, all aimed at the same problem: a grid of icon-plus-text
   cards tells you a section exists but nothing about what is inside it.

     ANATOMY   the signature. Every other page assumes you can read one
               candle, so the front page teaches that first and lets you take
               it apart by hand.
     LEVEL     a newcomer's real question is not "what is here" but "what is
               here for me", so that is the first control on the page.
     PREVIEWS  each section card draws a piece of its own content instead of
               showing a generic glyph.
   ============================================================================ */
(function(){
'use strict';
const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const SLOW=matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const T=window.TDESK||{};
const C={cy:'#22d3ee',gd:'#f5b942',gr:'#34d399',rd:'#f87171',vi:'#a78bfa',
         ln:'rgba(126,166,214,.18)',fa:'#8a94a6'};

/* ---------------------------------------------------------------------------
   ANATOMY
   --------------------------------------------------------------------------- */
const PARTS={
  body:['The body','The distance between the open and the close. A long body means one side won the session outright. A short one means they argued to a draw.'],
  wick:['The wicks','Every price that was touched and then given back. A long wick is a rejected price: buyers or sellers pushed there and could not hold it.'],
  open:['The open','The first trade of the period. On its own it means little, but where the close finishes relative to it is the whole story.'],
  close:['The close','The last trade of the period, and the only price most participants act on. A close near the high says buyers finished in control.'],
  high:['The high','The furthest price travelled up before sellers took it back.'],
  low:['The low','The furthest price travelled down before buyers stepped in.']
};
function anatomy(){
  const svg=$('#anatSvg'), read=$('#anatRead');
  if(!svg||!read) return;
  const O=36,Cl=74,H=92,L=20;
  const y=v=>26+(100-v)/100*182;
  const cx=168,w=62;
  const gl=(x1,y1,x2,y2)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
     stroke="${C.ln}" stroke-width="1" stroke-dasharray="3 4"/>`;
  svg.innerHTML=`
    ${gl(46,y(H),320,y(H))}${gl(46,y(Cl),320,y(Cl))}${gl(46,y(O),320,y(O))}${gl(46,y(L),320,y(L))}
    <line x1="${cx+w/2}" y1="${y(H)}" x2="${cx+w/2}" y2="${y(L)}" stroke="${C.gr}" stroke-width="2.5"/>
    <rect x="${cx}" y="${y(Cl)}" width="${w}" height="${y(O)-y(Cl)}" fill="rgba(52,211,153,.16)"
      stroke="${C.gr}" stroke-width="2.5"/>
    <g class="ah" data-p="high" tabindex="0"><rect x="322" y="${y(H)-11}" width="36" height="22" fill="transparent"/>
      <text class="ahl" x="326" y="${y(H)+4}">HIGH</text></g>
    <g class="ah" data-p="close" tabindex="0"><rect x="322" y="${y(Cl)-11}" width="46" height="22" fill="transparent"/>
      <text class="ahl" x="326" y="${y(Cl)+4}">CLOSE</text></g>
    <g class="ah" data-p="open" tabindex="0"><rect x="322" y="${y(O)-11}" width="44" height="22" fill="transparent"/>
      <text class="ahl" x="326" y="${y(O)+4}">OPEN</text></g>
    <g class="ah" data-p="low" tabindex="0"><rect x="322" y="${y(L)-11}" width="32" height="22" fill="transparent"/>
      <text class="ahl" x="326" y="${y(L)+4}">LOW</text></g>
    <g class="ah" data-p="body" tabindex="0">
      <rect x="${cx-72}" y="${y(Cl)}" width="70" height="${y(O)-y(Cl)}" fill="transparent"/>
      <line x1="${cx-6}" y1="${y(Cl)}" x2="${cx-30}" y2="${y(Cl)}" stroke="${C.ln}"/>
      <line x1="${cx-6}" y1="${y(O)}"  x2="${cx-30}" y2="${y(O)}"  stroke="${C.ln}"/>
      <line x1="${cx-30}" y1="${y(Cl)}" x2="${cx-30}" y2="${y(O)}" stroke="${C.ln}"/>
      <text class="ahl" x="${cx-38}" y="${(y(Cl)+y(O))/2+4}" text-anchor="end">BODY</text></g>
    <g class="ah" data-p="wick" tabindex="0">
      <rect x="${cx+w/2-16}" y="${y(H)}" width="32" height="${y(Cl)-y(H)}" fill="transparent"/>
      <line x1="${cx-30}" y1="${y(H)+16}" x2="${cx+w/2-3}" y2="${y(H)+16}" stroke="${C.ln}"/>
      <text class="ahl" x="${cx-38}" y="${y(H)+20}" text-anchor="end">WICK</text></g>`;

  const show=k=>{
    const p=PARTS[k]; if(!p) return;
    $$('.ah',svg).forEach(g=>g.classList.toggle('on',g.dataset.p===k));
    read.innerHTML=`<b>${esc(p[0])}</b><p>${esc(p[1])}</p>`;
  };
  $$('.ah',svg).forEach(g=>{
    const k=g.dataset.p;
    g.addEventListener('mouseenter',()=>show(k));
    g.addEventListener('click',()=>show(k));
    g.addEventListener('focus',()=>show(k));
  });
  read.innerHTML='<b>Four prices, one mark</b><p>Every chart on this site is built from this. '
    +'Hover or tap any label to take it apart.</p>';
  /* cycle once on arrival so it reads as interactive rather than static */
  if(!SLOW){
    const seq=['body','wick','close'];
    seq.forEach((k,i)=>setTimeout(()=>{ if(!read.dataset.touched) show(k); },900+i*1100));
    read.addEventListener('mouseenter',()=>read.dataset.touched='1');
    svg.addEventListener('mouseenter',()=>read.dataset.touched='1');
  }
}

/* ---------------------------------------------------------------------------
   LEVEL
   The encyclopedia already carries a real level split in ENC_CATS, so the
   picker points at something that exists rather than inventing a taxonomy.
   --------------------------------------------------------------------------- */
const LEVELS={
  lvl1:{say:'Start with the vocabulary and one candle at a time. Everything else can wait, and skipping this is why most people quit in month three.',
        go:'encyclopedia', steps:[0,1,2,3]},
  lvl2:{say:'You know the words. What decides the next year is sizing, a written plan, and reading indicators as confluence rather than instructions.',
        go:'indicators', steps:[4,5,6]},
  lvl3:{say:'Structure, options mechanics and dealer flow. The material here assumes you already know why a stop matters.',
        go:'options', steps:[5,6,7]}
};
function levels(){
  const box=$('.lvpick'), say=$('#lvSay');
  if(!box) return;
  const KEY='tdesk_level_v1';
  let cur=null;
  try{ cur=localStorage.getItem(KEY); }catch(e){}
  const paint=()=>{
    $$('.lvb',box).forEach(b=>b.classList.toggle('on',b.dataset.lv===cur));
    if(cur&&LEVELS[cur]){
      say.innerHTML=esc(LEVELS[cur].say)
        +` <button class="lv-go" data-go="${LEVELS[cur].go}">Take me there &rarr;</button>`;
      const g=$('.lv-go',say);
      if(g) g.addEventListener('click',()=>{
        if(typeof window.showPage==='function') window.showPage(LEVELS[cur].go);
        else location.hash='#'+LEVELS[cur].go;
      });
      document.body.dataset.level=cur;
      /* the track dims steps that are not for this level, without hiding them */
      $$('.tstep').forEach((el,i)=>
        el.classList.toggle('off-level',!LEVELS[cur].steps.includes(i)));
    } else {
      say.textContent='Not sure? Beginner is the honest answer more often than people think.';
      delete document.body.dataset.level;
      $$('.tstep').forEach(el=>el.classList.remove('off-level'));
    }
  };
  $$('.lvb',box).forEach(b=>b.addEventListener('click',()=>{
    cur = cur===b.dataset.lv ? null : b.dataset.lv;
    try{ cur?localStorage.setItem(KEY,cur):localStorage.removeItem(KEY); }catch(e){}
    paint();
  }));
  paint();
}

/* ---------------------------------------------------------------------------
   PREVIEWS
   Each card draws a piece of its own content. A card showing three real
   candles says more about the patterns section than any icon can.
   --------------------------------------------------------------------------- */
function cand(o,c,h,l,x,w,H,pad){
  const y=v=>pad+(100-v)/100*(H-pad*2);
  const up=c>=o, col=up?C.gr:C.rd;
  const t=Math.max(o,c), b=Math.min(o,c);
  return `<line x1="${x+w/2}" y1="${y(h)}" x2="${x+w/2}" y2="${y(l)}" stroke="${col}" stroke-width="1.4"/>
    <rect x="${x}" y="${y(t)}" width="${w}" height="${Math.max(2,y(b)-y(t))}"
      fill="${up?'rgba(52,211,153,.2)':col}" stroke="${col}" stroke-width="1.4"/>`;
}
const PREV={
  patterns(W,H){
    const set=[[44,70,78,34],[62,50,72,42],[52,84,90,46]];
    const w=13,gap=9,x0=(W-(w*3+gap*2))/2;
    return set.map((k,i)=>cand(k[0],k[1],k[2],k[3],x0+i*(w+gap),w,H,8)).join('');
  },
  indicators(W,H){
    const S=[48,56,50,64,58,72,66,78,70,84];
    const pt=(v,i)=>`${8+i/(S.length-1)*(W-16)},${H-8-((v-44)/44)*(H-16)}`;
    const sm=S.map((_,i)=>S.slice(Math.max(0,i-3),i+1).reduce((a,b)=>a+b,0)/Math.min(4,i+1));
    return `<polyline points="${S.map(pt).join(' ')}" fill="none" stroke="${C.fa}" stroke-width="1.2"/>
      <polyline points="${sm.map(pt).join(' ')}" fill="none" stroke="${C.cy}" stroke-width="2"/>`;
  },
  options(W,H){
    const pad=8, zero=H-pad-16;
    return `<line x1="${pad}" y1="${zero}" x2="${W-pad}" y2="${zero}" stroke="${C.ln}"/>
      <path d="M${pad} ${zero+10} L${W*0.42} ${zero+10} L${W-pad} ${pad}" fill="none"
        stroke="${C.gd}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M${W*0.42} ${zero+10} L${W-pad} ${pad} L${W-pad} ${zero+10} Z"
        fill="${C.gr}" opacity=".14"/>`;
  },
  encyclopedia(W,H){
    return [0,1,2,3].map(i=>`<line x1="8" y1="${12+i*13}" x2="${i===1?W*0.55:W-8}" y2="${12+i*13}"
      stroke="${i===1?C.gd:C.ln}" stroke-width="2.4" stroke-linecap="round"/>`).join('');
  },
  strategies(W,H){
    return `<path d="M8 ${H-14} L${W*0.3} ${H*0.55} L${W*0.52} ${H*0.68} L${W*0.74} ${H*0.24} L${W-8} 14"
      fill="none" stroke="${C.cy}" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="${W*0.3}" cy="${H*0.55}" r="3.4" fill="${C.gd}"/>
      <circle cx="${W*0.74}" cy="${H*0.24}" r="3.4" fill="${C.gr}"/>`;
  },
  riskdesk(W,H){
    return [0,1,2,3,4].map(i=>`<rect x="${8+i*((W-16)/5)}" y="${H-10-(i+1)*((H-20)/5)}"
      width="${(W-16)/5-6}" height="${(i+1)*((H-20)/5)}"
      fill="${i>2?C.gd:C.ln}" opacity="${i>2?'.85':'1'}" rx="1.5"/>`).join('');
  },
  tools(W,H){
    return `<rect x="8" y="10" width="${W-16}" height="${H-20}" fill="none" stroke="${C.ln}" rx="3"/>
      ${[0,1,2].map(r=>[0,1,2].map(c=>`<rect x="${16+c*((W-32)/3)}" y="${18+r*((H-36)/3)}"
        width="${(W-32)/3-6}" height="${(H-36)/3-6}" rx="2"
        fill="${r===1&&c===1?C.cy:C.ln}" opacity="${r===1&&c===1?'.9':'.55'}"/>`).join('')).join('')}`;
  },
  sessions(W,H){
    return [0,1,2,3].map(i=>`<circle cx="${16+i*((W-32)/3)}" cy="${H/2}" r="5"
        fill="${i<2?C.cy:'none'}" stroke="${C.cy}" stroke-width="1.6"/>`
      +(i<3?`<line x1="${21+i*((W-32)/3)}" y1="${H/2}" x2="${11+(i+1)*((W-32)/3)}" y2="${H/2}"
        stroke="${i<1?C.cy:C.ln}" stroke-width="1.6"/>`:'')).join('');
  }
};
function previews(){
  $$('.portal').forEach(card=>{
    const href=(card.getAttribute('href')||'').replace('#','');
    const fn=PREV[href]; if(!fn) return;
    if(card.querySelector('.pfig')) return;
    const W=card.classList.contains('wide')?150:132, H=56;
    const fig=document.createElement('span');
    fig.className='pfig';
    fig.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
      ${fn(W,H)}</svg>`;
    card.appendChild(fig);
  });
}

function boot(){
  try{ anatomy(); }catch(e){ console.error('[desk] anatomy',e); }
  try{ levels();  }catch(e){ console.error('[desk] levels',e); }
  try{ previews();}catch(e){ console.error('[desk] previews',e); }
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,60));
else setTimeout(boot,60);
})();
