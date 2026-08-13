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
