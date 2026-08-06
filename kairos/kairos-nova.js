/* ============================================================================
   KAIROS NOVA — THE RANGE
   ============================================================================
   The radar was a mistake and it deserved to be called one. It duplicated the
   little sweep already sitting in the hero, it was a sci-fi cliché rather than
   a design, and worst of all it got EMPTIER as the board grew: four dots on a
   huge disc, carrying two numbers each. A visual that holds less information
   the more data you give it is backwards.

   THE RANGE is the opposite. Every tracked symbol gets its own ridge, and each
   ridge is that symbol's ENTIRE dealer exposure profile: the full ladder,
   drawn as terrain. Stacked back to front, they read as a mountain range seen
   from a valley floor.

   This is a ridgeline plot, which is a real and respected form for exactly this
   problem: many distributions that share an axis and need comparing at a
   glance. It gets BETTER with more symbols, it carries the whole ladder instead
   of a summary of it, and it makes the things that matter physically obvious:

     PEAKS pointing up (teal)   strikes that ABSORB. Walls. Price gets held.
     PEAKS pointing down (ember) strikes that ACCELERATE. Trapdoors.
     THE SPINE (centre)          spot. Every ridge is aligned on its own spot,
                                 so the x-axis is % distance and the shapes are
                                 directly comparable across names.
     THE FLIP TICK               where dealer behaviour inverts for that name.
     THE HORIZON GLOW            the aggregate profile of the whole board.

   Read it in one look: is the terrain above you or below you, and how far to
   the nearest ridge in either direction.

   Everything animates from real values with eased interpolation, so a wall
   being built physically rises out of the ground. One canvas, one rAF loop,
   and the loop only runs while Nova is the visible view on a visible tab.
   ============================================================================ */
(function () {
  'use strict';

  const S = window.Kairos && window.Kairos.state;
  if (!S) return;

  const SPAN = 0.035;      // +/- 3.5% of spot across the width
  const BINS = 120;        // resolution of each ridge
  const EASE = 0.12;       // how fast a ridge morphs toward new data

  let cv = null, ctx = null, raf = null, tPrev = 0, t0 = 0;
  let rows = [], agg = new Float32Array(BINS), aggT = new Float32Array(BINS);
  let hoverX = null, hoverRow = null;
  let reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  const $ = (id) => document.getElementById(id);
  const onNova = () => S.view === 'nova';
  const ABSORB = [45, 212, 191], ACCEL = [244, 114, 62], GOLD = [242, 193, 78];
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';

  /* ---------- model -------------------------------------------------------
     One profile per symbol. Each bin is the net exposure of every strike that
     falls inside it, so the ridge IS the ladder rather than a summary of it.
     Nothing is smoothed across empty bins: a gap in the chain stays a gap. */
  function build() {
    const seen = new Set(), syms = [];
    (S.trinityTickers || []).concat(Object.keys(S.data || {})).forEach(s => {
      if (s && !seen.has(s)) { seen.add(s); syms.push(s); }
    });
    const panelStats = (window.Kairos && window.Kairos.panelStats) || window.panelStats;
    const metric = S.metric || 'gex';
    const next = [];

    for (const sym of syms.slice(0, 12)) {
      const d = S.data[sym];
      if (!d || !d.strikes || !d.strikes.length) continue;
      const spot = S.spot[sym] || d.spot || 0;
      if (!spot) continue;

      const raw = new Float32Array(BINS);
      let peak = 0;
      for (const s of d.strikes) {
        const rel = (s.k - spot) / spot;
        if (Math.abs(rel) > SPAN) continue;
        const bin = Math.round((rel / SPAN + 1) / 2 * (BINS - 1));
        if (bin < 0 || bin >= BINS) continue;
        const v = metric === 'vex' ? (s.vex || 0) : (s.gex || 0);
        raw[bin] += v;
      }
      for (let i = 0; i < BINS; i++) peak = Math.max(peak, Math.abs(raw[i]));
      if (!peak) continue;

      let ps = null;
      try { ps = panelStats ? panelStats(sym, d, metric) : null; } catch (e) {}
      const flipRel = (ps && ps.fl != null) ? (ps.fl - spot) / spot : null;

      // King, for the marker.
      let kk = null, ka = 0;
      for (const s of d.strikes) {
        const v = Math.abs(metric === 'vex' ? (s.vex || 0) : (s.gex || 0));
        if (v > ka && Math.abs((s.k - spot) / spot) <= SPAN) { ka = v; kk = s.k; }
      }

      const prev = rows.find(r => r.sym === sym);
      next.push({
        sym, spot, peak, raw,
        cur: prev ? prev.cur : new Float32Array(BINS),
        flipRel: flipRel != null && Math.abs(flipRel) <= SPAN ? flipRel : null,
        kingRel: kk != null ? (kk - spot) / spot : null,
        net1: ps ? (ps.net1 || 0) : 0,
        chg: (d.prevClose && spot) ? (spot / d.prevClose - 1) * 100 : 0,
      });
    }
    rows = next;

    // Aggregate terrain: the whole board's shape, normalised per symbol first
    // so a big index does not simply erase every single name.
    aggT = new Float32Array(BINS);
    for (const r of rows) for (let i = 0; i < BINS; i++) aggT[i] += r.raw[i] / r.peak;
    if (rows.length) for (let i = 0; i < BINS; i++) aggT[i] /= rows.length;
  }

  /* ---------- paint -------------------------------------------------------- */
  function paint(dt) {
    if (!ctx || !cv) return;
    const W = cv.clientWidth, H = cv.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const now = performance.now();
    if (!t0) t0 = now;

    const padL = 62, padR = 20, padT = 26, padB = 30;
    const plotW = W - padL - padR;
    const n = Math.max(1, rows.length);
    /* Rows overlap on purpose: a ridgeline reads as terrain because the peaks
       cross into the band above. Overlap grows as rows get thin. */
    const lane = (H - padT - padB) / n;
    const amp = Math.min(lane * 2.1, 84);
    const xAt = (i) => padL + (i / (BINS - 1)) * plotW;
    const spineX = padL + plotW / 2;

    // ---- percentage guides. Four ticks, no grid: the ridges are the content.
    ctx.font = '600 8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    [-3, -1.5, 0, 1.5, 3].forEach(p => {
      const x = padL + ((p / 100 / SPAN + 1) / 2) * plotW;
      ctx.beginPath(); ctx.moveTo(x, padT - 6); ctx.lineTo(x, H - padB + 4);
      ctx.strokeStyle = p === 0 ? 'rgba(226,232,240,.22)' : 'rgba(148,163,184,.055)';
      ctx.lineWidth = p === 0 ? 1 : 1; ctx.stroke();
      ctx.fillStyle = p === 0 ? 'rgba(226,232,240,.55)' : 'rgba(148,163,184,.3)';
      ctx.fillText(p === 0 ? 'SPOT' : (p > 0 ? '+' : '') + p + '%', x, H - padB + 8);
    });

    // ---- horizon: the whole board's aggregate shape, sitting behind everything
    ctx.beginPath();
    ctx.moveTo(padL, padT + 4);
    for (let i = 0; i < BINS; i++) {
      agg[i] += (aggT[i] - agg[i]) * (reduce ? 1 : 0.06);
      ctx.lineTo(xAt(i), padT + 4 - agg[i] * 26);
    }
    ctx.lineTo(W - padR, padT + 4);
    ctx.closePath();
    ctx.fillStyle = 'rgba(45,212,191,.05)';
    ctx.fill();

    /* ---- the ridges, back to front so nearer rows occlude further ones ---- */
    hoverRow = null;
    for (let r = rows.length - 1; r >= 0; r--) {
      const row = rows[r];
      const baseY = padT + lane * (r + 0.92);
      const depth = 1 - (r / Math.max(1, rows.length)) * 0.35;   // haze with distance

      // ease each bin toward its target so a wall physically rises
      for (let i = 0; i < BINS; i++) {
        const target = row.raw[i] / row.peak;
        row.cur[i] += (target - row.cur[i]) * (reduce ? 1 : EASE);
      }

      /* Occlusion: fill the band under this ridge with the page background so
         the ridge behind is genuinely hidden rather than showing through. That
         opacity is what makes it read as depth instead of as a tangle. */
      ctx.beginPath();
      ctx.moveTo(padL, baseY);
      for (let i = 0; i < BINS; i++) ctx.lineTo(xAt(i), baseY - row.cur[i] * amp);
      ctx.lineTo(W - padR, baseY);
      ctx.lineTo(W - padR, baseY + lane);
      ctx.lineTo(padL, baseY + lane);
      ctx.closePath();
      ctx.fillStyle = '#04070c';
      ctx.fill();

      // positive lobes (absorbing) and negative lobes (accelerating), separately
      for (const sign of [1, -1]) {
        const col = sign > 0 ? ABSORB : ACCEL;
        ctx.beginPath();
        ctx.moveTo(padL, baseY);
        for (let i = 0; i < BINS; i++) {
          const v = row.cur[i];
          const use = (sign > 0 ? Math.max(0, v) : Math.min(0, v));
          ctx.lineTo(xAt(i), baseY - use * amp);
        }
        ctx.lineTo(W - padR, baseY);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, baseY - amp * sign, 0, baseY);
        g.addColorStop(0, rgba(col, 0.34 * depth));
        g.addColorStop(1, rgba(col, 0.02));
        ctx.fillStyle = g;
        ctx.fill();
      }

      // the crest, drawn per segment so its colour follows the sign underneath
      for (let i = 1; i < BINS; i++) {
        const v0 = row.cur[i - 1], v1 = row.cur[i];
        const col = (v0 + v1) >= 0 ? ABSORB : ACCEL;
        const strength = Math.min(1, Math.abs((v0 + v1) / 2) * 2.4);
        ctx.beginPath();
        ctx.moveTo(xAt(i - 1), baseY - v0 * amp);
        ctx.lineTo(xAt(i), baseY - v1 * amp);
        ctx.strokeStyle = rgba(col, (0.28 + strength * 0.7) * depth);
        ctx.lineWidth = 1 + strength * 1.3;
        ctx.stroke();
      }

      // King marker: a hairline dropped from the crest to the floor
      if (row.kingRel != null) {
        const x = padL + ((row.kingRel / SPAN + 1) / 2) * plotW;
        const bi = Math.round((row.kingRel / SPAN + 1) / 2 * (BINS - 1));
        const y = baseY - (row.cur[Math.max(0, Math.min(BINS - 1, bi))] || 0) * amp;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, baseY);
        ctx.strokeStyle = rgba(GOLD, 0.45 * depth); ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = rgba(GOLD, 0.9 * depth); ctx.fill();
      }

      // flip tick on the floor: where this name's regime inverts
      if (row.flipRel != null) {
        const x = padL + ((row.flipRel / SPAN + 1) / 2) * plotW;
        ctx.beginPath(); ctx.moveTo(x, baseY - 4); ctx.lineTo(x, baseY + 4);
        ctx.strokeStyle = 'rgba(148,163,184,.7)'; ctx.lineWidth = 1.5; ctx.stroke();
      }

      // label
      const tone = row.net1 >= 0 ? ABSORB : ACCEL;
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillStyle = rgba(tone, 0.92);
      ctx.fillText(row.sym, padL - 10, baseY - 5);
      ctx.font = '600 8px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(148,163,184,.5)';
      ctx.fillText(row.spot.toFixed(row.spot > 2000 ? 0 : 2), padL - 10, baseY + 6);

      row._baseY = baseY;
      if (hoverX != null && hoverX >= padL && hoverX <= W - padR) {
        if (hoverX >= padL) hoverRow = hoverRow || null;
      }
    }

    /* ---- scan line. One slow pass every eight seconds, and it brightens the
       crest it is crossing rather than drawing a beam over the top. ---- */
    if (!reduce) {
      const p = ((now - t0) % 8000) / 8000;
      const sx = padL + p * plotW;
      const g = ctx.createLinearGradient(sx - 40, 0, sx + 6, 0);
      g.addColorStop(0, 'rgba(45,212,191,0)');
      g.addColorStop(1, 'rgba(45,212,191,.10)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 40, padT - 8, 46, H - padT - padB + 12);
    }

    // crosshair readout
    if (hoverX != null && hoverX > padL && hoverX < W - padR) {
      const rel = ((hoverX - padL) / plotW * 2 - 1) * SPAN;
      ctx.beginPath(); ctx.moveTo(hoverX, padT - 8); ctx.lineTo(hoverX, H - padB);
      ctx.strokeStyle = 'rgba(226,232,240,.28)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(226,232,240,.85)';
      ctx.fillText((rel >= 0 ? '+' : '') + (rel * 100).toFixed(2) + '% from spot', hoverX + 6, padT - 4);
    }
  }

  function frame(ts) {
    const dt = tPrev ? Math.min(0.05, (ts - tPrev) / 1000) : 0.016;
    tPrev = ts;
    paint(dt);
    if (onNova() && !document.hidden) raf = requestAnimationFrame(frame); else raf = null;
  }

  function start() {
    cv = $('novaRange');
    if (!cv) return;
    ctx = cv.getContext('2d');
    build();
    if (!raf) { tPrev = 0; raf = requestAnimationFrame(frame); }
  }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

  setInterval(function () { if (onNova() && !document.hidden) build(); }, 6000);
  document.addEventListener('visibilitychange', function () {
    if (onNova() && !document.hidden) start(); else stop();
  });
  document.addEventListener('mousemove', function (e) {
    if (!cv || e.target !== cv) { hoverX = null; return; }
    hoverX = e.clientX - cv.getBoundingClientRect().left;
  });
  document.addEventListener('mouseleave', function () { hoverX = null; });
  document.addEventListener('click', function (e) {
    if (!cv || e.target !== cv) return;
    const r = cv.getBoundingClientRect(), my = e.clientY - r.top;
    let best = null, bd = 1e9;
    for (const row of rows) {
      if (row._baseY == null) continue;
      const d = Math.abs(row._baseY - my);
      if (d < bd) { bd = d; best = row; }
    }
    if (best && bd < 60) {
      S.focus = best.sym;
      if (window.setView) window.setView('single');
      if (window.refresh) window.refresh(false);
    }
  });

  (function () {
    const prev = window.setView;
    window.setView = function (v) {
      const r = prev(v);
      if (v === 'nova') setTimeout(start, 30); else stop();
      return r;
    };
  })();

  window.KairosNovaRange = { start, stop, build, rows: function () { return rows; } };
  console.log('%cKairos Nova \u2014 THE RANGE. Every symbol\u2019s whole exposure ladder as terrain, aligned on its own spot.', 'color:#2dd4bf;font-weight:bold');
})();
