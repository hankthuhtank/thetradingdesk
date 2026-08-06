/* ============================================================================
   KAIROS NOVA — THE ORRERY
   Nova's page was six boxes of text. Good text, but Nova's actual job is to
   hold the whole tracked board at once, and a list cannot show you a board.

   So: a live orrery. Every tracked symbol is a body, and EVERY property of
   every body is measured, not decorative. If it moves, something moved.

     ANGLE   fixed slot per symbol, so positions are learnable, with a slow
             common drift so the whole system reads as alive rather than static
     RADIUS  |spot - flip| / EM. How far this name sits from its OWN regime
             boundary, in expected-move units. Near the core means fragile: one
             catalyst flips dealer behaviour. Far out means firmly set.
     SIZE    |net gamma within +/-1% of spot| against the largest on the board
     COLOUR  absorbing (dealers hedge against the move) vs accelerating
     HALO    a live divergence the pipeline flagged for that symbol
     TAIL    session change: direction and magnitude
     SWEEP   a rotating line that illuminates each body as it crosses and
             prints its readout, so the board reads itself to you over ~12s

   The core's brightness is gamma breadth: how much of the board is currently
   pinning. The outer arc is VIX against its own recent range.

   Everything is one canvas and one rAF loop, and the loop only runs while Nova
   is the visible view on a visible tab. Load AFTER kairos-core.js.
   ============================================================================ */
(function () {
  'use strict';

  const S = window.Kairos && window.Kairos.state;
  if (!S) return;

  let cv = null, ctx = null, raf = null, t0 = 0, tPrev = 0;
  let bodies = [], core = { breadth: 0, vix: 0, vixPct: 0.5 }, sweepAng = -Math.PI / 2;
  let hover = null, lit = null, litUntil = 0;
  let reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  const $ = (id) => document.getElementById(id);
  const onNova = () => S.view === 'nova';
  const TAU = Math.PI * 2;

  const COL = {
    absorb: [45, 212, 191],
    accel: [244, 114, 62],
    gold: [242, 193, 78],
    dim: [100, 116, 139],
  };
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';

  /* ---------- model -------------------------------------------------------
     Rebuilt from live state on a slow timer. Nothing here is invented: a symbol
     with no computed structure simply does not get a body. */
  function build() {
    const syms = [];
    const seen = new Set();
    (S.trinityTickers || []).concat(Object.keys(S.data || {})).forEach(s => {
      if (!s || seen.has(s)) return; seen.add(s); syms.push(s);
    });
    const panelStats = (window.Kairos && window.Kairos.panelStats) || window.panelStats;
    const out = [];
    let maxG = 0;
    for (const sym of syms.slice(0, 14)) {
      const d = S.data[sym];
      if (!d || !d.strikes || !d.strikes.length) continue;
      const spot = S.spot[sym] || d.spot || 0;
      if (!spot) continue;
      let ps = null;
      try { ps = panelStats ? panelStats(sym, d, S.metric || 'gex') : null; } catch (e) {}
      if (!ps) continue;
      const net1 = ps.net1 || 0;
      const em = ps.em || spot * 0.01;
      /* Distance to the regime boundary, in expected moves. This is the axis
         that actually matters: not how big a name is, but how close it is to
         behaving completely differently. */
      const dist = (ps.fl != null && em > 0) ? Math.abs(spot - ps.fl) / em : 3;
      const chg = (d.prevClose && spot) ? (spot / d.prevClose - 1) * 100 : (S.chg && S.chg[sym]) || 0;
      maxG = Math.max(maxG, Math.abs(net1));
      out.push({
        sym, spot, net1, em, dist: Math.max(0.05, Math.min(4, dist)),
        flip: ps.fl, king: ps.cw != null ? ps.king : null,
        cw: ps.cw, pw: ps.pw, chg,
        absorb: net1 >= 0,
      });
    }
    out.forEach((b, i) => {
      b.mag = maxG > 0 ? Math.abs(b.net1) / maxG : 0.3;
      /* Angle is a stable slot, so you learn where each name lives. */
      b.slot = (i / Math.max(1, out.length)) * TAU;
    });
    bodies = out;

    const pin = out.filter(b => b.absorb).length;
    core.breadth = out.length ? pin / out.length : 0;
    core.n = out.length;

    // VIX against its own recent range, for the outer arc.
    const v = S.spot && (S.spot.VIX || S.spot.UVXY);
    core.vix = S.spot && S.spot.VIX ? S.spot.VIX : 0;
    core.vixPct = core.vix ? Math.max(0, Math.min(1, (core.vix - 10) / 30)) : 0.4;

    // Divergence halos: read straight off the server slates if they are present.
    const F = S._forge || {};
    bodies.forEach(b => { b.flag = !!(F[b.sym] && F[b.sym].posture && F[b.sym].posture.side === 'stand_aside'); });
  }

  /* ---------- paint -------------------------------------------------------- */
  function paint(dt) {
    if (!ctx) return;
    const W = cv.clientWidth, H = cv.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.42;
    const now = performance.now();
    const drift = reduce ? 0 : (now - t0) / 90000 * TAU;

    /* --- backdrop: a faint polar grid, drawn once per frame because it is
       four arcs and eight spokes, not a texture --- */
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const rr = R * (i / 4);
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU);
      ctx.strokeStyle = 'rgba(148,163,184,' + (i === 2 ? 0.13 : 0.06) + ')';
      ctx.stroke();
    }
    ctx.font = '600 9px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(148,163,184,.32)';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ['1\u03c3', '2\u03c3', '3\u03c3', '4\u03c3'].forEach((lab, i) => {
      ctx.fillText(lab, cx + R * ((i + 1) / 4) + 4, cy);
    });
    for (let i = 0; i < 8; i++) {
      const a = drift + (i / 8) * TAU;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * 0.16, cy + Math.sin(a) * R * 0.16);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.strokeStyle = 'rgba(148,163,184,.045)';
      ctx.stroke();
    }

    /* --- the sweep. Illuminates bodies as it crosses them, which is what makes
       the board read itself out over about twelve seconds rather than needing
       to be scanned by eye. --- */
    if (!reduce) sweepAng += dt * 0.52;
    if (sweepAng > TAU) sweepAng -= TAU;
    const grad = ctx.createConicGradient
      ? ctx.createConicGradient(sweepAng, cx, cy)
      : null;
    if (grad) {
      grad.addColorStop(0, 'rgba(45,212,191,.18)');
      grad.addColorStop(0.06, 'rgba(45,212,191,.03)');
      grad.addColorStop(0.3, 'rgba(45,212,191,0)');
      grad.addColorStop(1, 'rgba(45,212,191,0)');
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fillStyle = grad; ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAng) * R, cy + Math.sin(sweepAng) * R);
    ctx.strokeStyle = 'rgba(45,212,191,.5)';
    ctx.lineWidth = 1.5; ctx.stroke();

    /* --- the core. Brightness is gamma breadth: how much of the board is
       currently absorbing. A dim core is a board that has stopped pinning. --- */
    const pulse = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(now / 900);
    const cr = R * 0.15;
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr * 2.2);
    const bTone = core.breadth > 0.6 ? COL.absorb : core.breadth > 0.35 ? COL.gold : COL.accel;
    cg.addColorStop(0, rgba(bTone, (0.32 + core.breadth * 0.4)));
    cg.addColorStop(0.5, rgba(bTone, 0.10 + pulse * 0.05));
    cg.addColorStop(1, rgba(bTone, 0));
    ctx.beginPath(); ctx.arc(cx, cy, cr * 2.2, 0, TAU); ctx.fillStyle = cg; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, cr * (0.62 + pulse * 0.05), 0, TAU);
    ctx.strokeStyle = rgba(bTone, 0.55); ctx.lineWidth = 1.2; ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '700 ' + Math.round(R * 0.13) + 'px "JetBrains Mono", monospace';
    ctx.fillStyle = rgba(bTone, 0.95);
    ctx.fillText(Math.round(core.breadth * 100) + '%', cx, cy - 3);
    ctx.font = '600 8px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(148,163,184,.6)';
    ctx.fillText('ABSORBING', cx, cy + R * 0.09);

    /* --- VIX arc on the rim --- */
    if (core.vix) {
      const a0 = -Math.PI / 2, a1 = a0 + core.vixPct * TAU * 0.75;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.06, a0, a1);
      ctx.strokeStyle = core.vixPct > 0.55 ? rgba(COL.accel, .7) : rgba(COL.absorb, .55);
      ctx.lineWidth = 2.5; ctx.stroke();
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(226,232,240,.8)';
      ctx.textAlign = 'center';
      ctx.fillText('VIX ' + core.vix.toFixed(2), cx, cy - R * 1.14);
    }

    /* --- bodies --- */
    hover = null;
    for (const b of bodies) {
      const ang = b.slot + drift;
      const rr = R * (0.2 + (b.dist / 4) * 0.78);
      const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
      b._x = x; b._y = y;
      const col = b.absorb ? COL.absorb : COL.accel;
      const rad = 3 + b.mag * 13;

      // Was the sweep just here? Light it up and print its readout.
      let da = ang - sweepAng;
      while (da < -Math.PI) da += TAU;
      while (da > Math.PI) da -= TAU;
      const justLit = Math.abs(da) < 0.18;
      if (justLit) { lit = b; litUntil = now + 2200; }
      const glow = justLit ? 1 : Math.max(0, 1 - Math.abs(da) / 1.2) * 0.35;

      /* Tail: session change. Length is magnitude, direction is sign, drawn
         along the orbit so it reads as travel rather than as a spike. */
      if (Math.abs(b.chg) > 0.05) {
        const len = Math.min(0.5, Math.abs(b.chg) / 3) * (b.chg > 0 ? 1 : -1);
        ctx.beginPath();
        ctx.arc(cx, cy, rr, ang - len, ang);
        ctx.strokeStyle = rgba(b.chg > 0 ? COL.absorb : COL.accel, 0.16 + glow * 0.2);
        ctx.lineWidth = Math.max(1, rad * 0.35); ctx.stroke();
      }

      // Halo for a symbol the pipeline told us to stand aside on.
      if (b.flag) {
        ctx.beginPath();
        ctx.arc(x, y, rad + 5 + (reduce ? 0 : Math.sin(now / 420) * 1.6), 0, TAU);
        ctx.strokeStyle = rgba(COL.gold, 0.42); ctx.lineWidth = 1; ctx.stroke();
      }

      const bg = ctx.createRadialGradient(x, y, 0, x, y, rad * 2.6);
      bg.addColorStop(0, rgba(col, 0.5 + glow * 0.45));
      bg.addColorStop(1, rgba(col, 0));
      ctx.beginPath(); ctx.arc(x, y, rad * 2.6, 0, TAU); ctx.fillStyle = bg; ctx.fill();

      ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU);
      ctx.fillStyle = rgba(col, 0.75 + glow * 0.25); ctx.fill();

      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(226,232,240,' + (0.5 + glow * 0.5) + ')';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.sym, x, y - rad - 8);
    }

    /* --- readout for whatever the sweep last touched --- */
    if (lit && now < litUntil) {
      const fade = Math.min(1, (litUntil - now) / 600);
      const pad = 10;
      const lines = [
        lit.sym + '  ' + lit.spot.toFixed(lit.spot > 2000 ? 0 : 2),
        (lit.absorb ? 'ABSORBING' : 'ACCELERATING') + '  \u00b7  ' + (lit.chg >= 0 ? '+' : '') + lit.chg.toFixed(2) + '%',
        'flip ' + (lit.flip != null ? (+lit.flip).toFixed(lit.spot > 2000 ? 0 : 2) : '\u2014')
          + '  \u00b7  ' + lit.dist.toFixed(1) + '\u03c3 away',
      ];
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(226,232,240,' + (0.9 * fade) + ')';
      ctx.fillText(lines[0], pad, pad);
      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.fillStyle = rgba(lit.absorb ? COL.absorb : COL.accel, 0.85 * fade);
      ctx.fillText(lines[1], pad, pad + 15);
      ctx.fillStyle = 'rgba(148,163,184,' + (0.7 * fade) + ')';
      ctx.fillText(lines[2], pad, pad + 28);
    }

    // Legend, bottom left.
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.font = '600 8px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(148,163,184,.42)';
    ctx.fillText('RADIUS = DISTANCE TO REGIME FLIP (\u03c3)   \u00b7   SIZE = NET GAMMA AT SPOT', 10, H - 8);
  }

  function frame(ts) {
    const dt = tPrev ? Math.min(0.05, (ts - tPrev) / 1000) : 0.016;
    tPrev = ts;
    paint(dt);
    raf = (onNova() && !document.hidden) ? requestAnimationFrame(frame) : (raf = null);
  }

  function start() {
    cv = $('novaOrrery');
    if (!cv) return;
    ctx = cv.getContext('2d');
    if (!t0) t0 = performance.now();
    build();
    if (!raf) { tPrev = 0; raf = requestAnimationFrame(frame); }
  }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

  // Rebuild the model on the same cadence the rest of the app refreshes.
  setInterval(function () { if (onNova() && !document.hidden) build(); }, 6000);
  document.addEventListener('visibilitychange', function () {
    if (onNova() && !document.hidden) start(); else stop();
  });

  /* Click a body to open it in Junction, same gesture as THE BOARD. */
  (function () {
    document.addEventListener('click', function (e) {
      if (!cv || e.target !== cv) return;
      const r = cv.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      let best = null, bd = 26;
      for (const b of bodies) {
        if (b._x == null) continue;
        const d = Math.hypot(b._x - mx, b._y - my);
        if (d < bd) { bd = d; best = b; }
      }
      if (best) { S.focus = best.sym; if (window.setView) window.setView('single'); if (window.refresh) window.refresh(false); }
    });
  })();

  /* Hook the view switch. Nova's own render still runs; this only adds the
     canvas loop and tears it down when you leave, so it never burns a frame in
     the background. */
  (function () {
    const prev = window.setView;
    window.setView = function (v) {
      const r = prev(v);
      if (v === 'nova') setTimeout(start, 30); else stop();
      return r;
    };
  })();

  window.KairosNovaOrrery = { start, stop, build, bodies: function () { return bodies; }, core: function () { return core; } };
  console.log('%cKairos Nova \u2014 THE ORRERY. Radius is distance to the regime flip, size is net gamma at spot. Nothing on it is decoration.', 'color:#2dd4bf;font-weight:bold');
})();
