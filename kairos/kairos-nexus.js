/* ============================================================================
   KAIROS NEXUS v10 — THE LADDER
   Lightweight Charts v5. Exposure drawn as horizontal levels through time.

   WHY THIS CHANGED AGAIN
   v9 drew each recorded minute as a vertical column of strata. It was honest
   about the data and cheap to reason about, but it read wrong: nobody thinks
   about a gamma book as a column at 14:32. They think about it as LEVELS that
   sit at prices and get stronger or weaker as the session runs. Vertical
   columns force you to mentally transpose the entire picture, and the result
   looked like noise standing next to the tape rather than structure sitting
   underneath it.

   So: one horizontal ribbon per material strike, running left to right across
   the recorded window, its THICKNESS proportional to how much exposure sits
   there at that minute. A level that builds thickens. A level that drains
   narrows to nothing. Price runs across them, and you can see directly whether
   it is being held up by a wall or falling through a hole.

   It is also about a hundred times cheaper to render. v9 rebuilt a Float64Array
   per column and touched every strike of every column on every single frame
   (900 columns x 200 strikes = 180,000 iterations per paint, on every crosshair
   move), which is what made Nexus lag the entire tab. This version precomputes
   the level model once per data change, converts ~220 x-coordinates and ~34
   y-coordinates per frame, and then does nothing but fillRect.

   Load AFTER kairos-core.js. Requires Lightweight Charts v5 on the page.
   ============================================================================ */
(function () {
  'use strict';

  const S = window.Kairos && window.Kairos.state;
  if (!S) { console.warn('Nexus: Kairos core not present'); return; }

  const NX = {
    REC_MS: 60000,        // one recorded column per minute
    COLS_MEM: 900,        // columns held in memory
    LEVELS: 9,            // SIGNIFICANT levels only — see pickLevels()
    SAMPLES: 220,         // time samples after downsampling
    MAX_PX: 11,           // thickness of the strongest level, CSS px
    MIN_PX: 1.6,          // thinner than this is not worth a row of pixels
    MATERIAL: 0.14,       // a level must reach this fraction of the King
    MERGE: 0.004,         // peaks closer than this (as % of spot) are one level
  };

  const field = {};
  const fieldT = {}, fieldStamp = {};
  let chart = null, priceSeries = null, undertow = null, fieldPrim = null;
  let curSym = null, bars = [], barsT = 0, metric = 'gex';
  let lines = {};
  let ready = false, libFail = false, opening = false;

  const $ = (id) => document.getElementById(id);
  const LWC = () => window.LightweightCharts;
  const onNexus = () => S.view === 'arena';

  const PAL = {
    gex: { pos: [45, 212, 191], neg: [244, 114, 62] },
    vex: { pos: [56, 189, 248], neg: [232, 121, 249] },
    king: [242, 193, 78],
  };

  function cssVar(n, fb) {
    try { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb; }
    catch (e) { return fb; }
  }

  /* ---------- recording ---------------------------------------------------- */
  function record() {
    const syms = new Set([S.focus].concat(S.trinityTickers || []));
    const now = Date.now();
    let touched = false;
    for (const sym of syms) {
      const d = S.data[sym];
      if (!d || !d.strikes || !d.strikes.length) continue;
      const stamp = S.dataAge[sym] || 0;
      const fresh = stamp !== (fieldStamp[sym] || 0);
      if (!fresh && now - (fieldT[sym] || 0) < NX.REC_MS - 3000) continue;
      fieldStamp[sym] = stamp; fieldT[sym] = now;
      const sorted = d.strikes.slice().sort((a, b) => a.k - b.k);
      const n = sorted.length;
      const ks = new Float32Array(n), g = new Float32Array(n), v = new Float32Array(n);
      for (let i = 0; i < n; i++) { ks[i] = sorted[i].k; g[i] = sorted[i].gex || 0; v[i] = sorted[i].vex || 0; }
      (field[sym] = field[sym] || []).push({ t: now, ks, g, v, spot: S.spot[sym] || d.spot || 0, srv: false, noVex: false });
      if (field[sym].length > NX.COLS_MEM) field[sym].splice(0, field[sym].length - NX.COLS_MEM);
      if (sym === curSym) touched = true;
    }
    /* Only repaint when this symbol changed AND Nexus is actually on screen.
       v9 called setData every fifteen seconds regardless of view, which is a
       large part of why the tab got slower the longer it stayed open. */
    if (touched && onNexus()) redraw();
  }
  setInterval(record, 15000);

  /* Server Chronicle. Columns written before the vega rollout carry {k,g} only
     and are flagged noVex: in VEX mode they are SKIPPED, never painted as zero.
     Inventing zeros is what the pre-v9 build did, and a chart of fabricated
     nothing is worse than an honest gap. */
  async function hydrate(sym) {
    if (!sym || !window.KairosBackend || !window.KairosBackend.enabled) return;
    try {
      const cols = await window.KairosBackend.fieldColumns(sym);
      if (!cols || !cols.length) return;
      const cur = field[sym] || [], seen = new Set(cur.map(c => c.t));
      for (const c of cols) {
        const t = c.t * 1000;
        if (seen.has(t) || !c.nodes || !c.nodes.length) continue;
        const hasV = c.nodes[0].v != null;
        cur.push({
          t, ks: c.nodes.map(n => n.k), g: c.nodes.map(n => n.g),
          v: hasV ? c.nodes.map(n => n.v || 0) : null,
          spot: c.spot, srv: true, noVex: !hasV,
        });
        seen.add(t);
      }
      cur.sort((a, b) => a.t - b.t);
      field[sym] = cur.slice(-NX.COLS_MEM);
      if (sym === curSym && onNexus()) { cache.key = ''; redraw(); }
    } catch (e) {}
  }

  /* ---------- price bars --------------------------------------------------- */
  async function loadBars(sym) {
    if (!sym) return;
    if (curSym === sym && bars.length && Date.now() - barsT < 45000) return;
    const p = (n) => String(n).padStart(2, '0');
    const d = new Date(Date.now() - 5 * 86400000);
    const start = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    const path = '/markets/timesales?symbol=' + encodeURIComponent(sym) +
                 '&interval=1min&start=' + start + '&session_filter=open';
    try {
      let j = null;
      if (window.KairosBackend && window.KairosBackend.enabled) j = await window.KairosBackend.proxy(path);
      else if (window.tFetch) j = await window.tFetch(path);
      let rows = j && j.series && j.series.data;
      if (rows && !Array.isArray(rows)) rows = [rows];
      if (!rows || !rows.length) return;
      /* LWC needs a strictly ascending, de-duplicated time axis and THROWS
         rather than degrading on a repeat, which Tradier occasionally emits
         across session boundaries. */
      const out = []; let last = 0;
      for (const r of rows) {
        const t = Math.floor(new Date(r.time).getTime() / 1000);
        if (!(t > last) || !(+r.close > 0)) continue;
        last = t;
        out.push({ time: t, open: +r.open, high: +r.high, low: +r.low, close: +r.close });
      }
      if (out.length) { bars = out; barsT = Date.now(); }
    } catch (e) {}
  }

  /* ---------- level model --------------------------------------------------
     Collapse the recorded columns into ~34 horizontal levels across ~220 time
     samples. Computed once per data change and cached, so the render path never
     allocates and never touches a raw column. */
  let cache = { key: '', levels: [], times: [], peak: 0, kingK: null };

  function buildLevels() {
    const cols = field[curSym] || [];
    const key = curSym + '|' + metric + '|' + cols.length + '|' + (cols.length ? cols[cols.length - 1].t : 0);
    if (cache.key === key) return cache;
    const empty = { key, levels: [], times: [], peak: 0, kingK: null };

    const usable = cols.filter(c => !(metric === 'vex' && (c.noVex || !c.v)));
    if (!usable.length) { cache = empty; return cache; }

    // Downsample time, anchored at the newest bar so the live edge stays exact.
    const stride = Math.max(1, Math.ceil(usable.length / NX.SAMPLES));
    const picked = [];
    for (let i = usable.length - 1; i >= 0; i -= stride) picked.push(usable[i]);
    picked.reverse();

    /* Rank strikes by PEAK magnitude across the window, not by current value.
       A wall that dominated the morning and has since been torn down is exactly
       the thing worth being able to see. */
    const peakBy = new Map();
    for (const c of picked) {
      const vals = metric === 'vex' ? c.v : c.g;
      if (!vals) continue;
      for (let i = 0; i < c.ks.length; i++) {
        const a = Math.abs(vals[i]);
        if (!a) continue;
        const k = c.ks[i];
        if (a > (peakBy.get(k) || 0)) peakBy.set(k, a);
      }
    }
    if (!peakBy.size) { cache = empty; return cache; }

    /* SIGNIFICANT LEVELS ONLY.
       Taking the top 34 strikes by magnitude drew practically the whole ladder,
       which is how you end up with a wall of lines that says nothing. Support
       and resistance are not "every strike with exposure", they are the LOCAL
       PEAKS in the exposure profile: the strikes that dominate their own
       neighbourhood and that price therefore actually reacts to.

       Three passes:
         1. Local extremum. A strike qualifies only if it is the largest of its
            sign within a +/-0.4% price band. That kills the shoulders of a big
            node, which were being drawn as separate levels.
         2. Materiality. It must reach 14% of the King. Anything smaller does
            not hold price and is noise on the chart.
         3. Merge. Peaks within 0.4% of each other collapse to the larger.
       Positive and negative are ranked separately so a large put wall is never
       hidden by a cluster of positive nodes sitting next to it. */
    const signed = new Map();
    for (const c of picked) {
      const vals = metric === 'vex' ? c.v : c.g;
      if (!vals) continue;
      for (let i = 0; i < c.ks.length; i++) {
        const k = c.ks[i], v = vals[i];
        if (!v) continue;
        const cur = signed.get(k);
        if (!cur || Math.abs(v) > Math.abs(cur)) signed.set(k, v);
      }
    }
    const all = Array.from(signed.entries()).map(p => ({ k: p[0], v: p[1] })).sort((a, b) => a.k - b.k);
    const kingMag = Math.max.apply(null, all.map(x => Math.abs(x.v)));
    const spotRef = picked[picked.length - 1].spot || all[Math.floor(all.length / 2)].k;
    const band = spotRef * 0.004;

    const peaks = [];
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      if (Math.abs(a.v) < kingMag * NX.MATERIAL) continue;
      let dominant = true;
      for (let j = 0; j < all.length; j++) {
        if (i === j) continue;
        const b = all[j];
        if (Math.abs(b.k - a.k) > band) continue;
        if (b.v * a.v < 0) continue;                    // opposite sign is its own level
        if (Math.abs(b.v) > Math.abs(a.v)) { dominant = false; break; }
      }
      if (dominant) peaks.push(a);
    }
    // Merge survivors that are still within the band, keeping the larger.
    peaks.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    const merged = [];
    for (const p of peaks) {
      if (merged.some(m => Math.abs(m.k - p.k) <= spotRef * NX.MERGE && m.v * p.v > 0)) continue;
      merged.push(p);
      if (merged.length >= NX.LEVELS) break;
    }
    if (!merged.length) { cache = empty; return cache; }

    const keep = merged.map(p => [p.k, peakBy.get(p.k) || Math.abs(p.v)]);
    const peak = Math.max.apply(null, keep.map(p => p[1]));
    const keepIdx = new Map();
    keep.forEach(function (pair, i) { keepIdx.set(pair[0], i); });

    const times = picked.map(c => Math.floor(c.t / 1000));
    const levels = keep.map(pair => ({
      k: pair[0],
      vals: new Float32Array(picked.length),
      srv: new Uint8Array(picked.length),
    }));

    for (let ci = 0; ci < picked.length; ci++) {
      const c = picked[ci];
      const vals = metric === 'vex' ? c.v : c.g;
      if (!vals) continue;
      const isSrv = c.srv ? 1 : 0;
      for (let i = 0; i < c.ks.length; i++) {
        const idx = keepIdx.get(c.ks[i]);
        if (idx === undefined) continue;
        levels[idx].vals[ci] = vals[i];
        levels[idx].srv[ci] = isSrv;
      }
    }

    // Current King, so it can be tinted gold rather than lost in the field.
    let kingK = null, kingA = 0;
    const lastC = picked[picked.length - 1];
    const lastV = metric === 'vex' ? lastC.v : lastC.g;
    if (lastV) for (let i = 0; i < lastC.ks.length; i++) {
      const a = Math.abs(lastV[i]);
      if (a > kingA) { kingA = a; kingK = lastC.ks[i]; }
    }

    cache = { key, levels, times, peak, kingK };
    return cache;
  }

  /* ---------- the field primitive ------------------------------------------ */
  function makeFieldPrimitive() {
    let chartRef = null, seriesRef = null, requestUpdate = null;

    const renderer = {
      draw(target) {
        const m = buildLevels();
        if (!m.levels.length || !seriesRef || !chartRef) return;
        const ts = chartRef.timeScale();

        target.useBitmapCoordinateSpace(function (scope) {
          const ctx = scope.context;
          const hr = scope.horizontalPixelRatio, vr = scope.verticalPixelRatio;

          /* Coordinates converted ONCE per frame and shared by every level:
             ~220 x-conversions plus ~34 y-conversions, then nothing but rects. */
          const xs = new Float64Array(m.times.length);
          let firstX = -1, lastX = -1;
          for (let i = 0; i < m.times.length; i++) {
            const x = ts.timeToCoordinate(m.times[i]);
            xs[i] = (x == null) ? NaN : x;
            if (x != null) { if (firstX < 0) firstX = i; lastX = i; }
          }
          if (firstX < 0) return;

          /* Segment width from the real spacing between samples, so a break in
             the record stays a visible break instead of being bridged. */
          const span = (lastX > firstX) ? (xs[lastX] - xs[firstX]) / (lastX - firstX) : 6;
          const segW = Math.max(1, Math.min(span * 1.04, 26));
          const pal = PAL[metric] || PAL.gex;

          /* CONTINUOUS ribbons, not isolated dashes. Open interest is fixed for
             the whole session, so a level does not cease to exist between two
             soundings. Drawing it as a connected band whose thickness swells and
             narrows is both the honest reading and the legible one; the old
             per-sample rectangles left the levels looking like scattered
             fragments whenever recording was sparse. */
          ctx.save();
          for (let li = 0; li < m.levels.length; li++) {
            const lv = m.levels[li];
            const y = seriesRef.priceToCoordinate(lv.k);
            if (y == null) continue;
            const isKing = (m.kingK != null && lv.k === m.kingK);

            // Collect this level's live samples, and its strongest reading.
            const pts = [];
            let strongest = 0, lastSign = 0;
            for (let i = firstX; i <= lastX; i++) {
              const v = lv.vals[i];
              if (!v || !isFinite(xs[i])) continue;
              const mag = Math.sqrt(Math.abs(v) / m.peak);
              pts.push({ x: xs[i], h: NX.MIN_PX + mag * (NX.MAX_PX - NX.MIN_PX), v, srv: lv.srv[i] });
              if (mag > strongest) { strongest = mag; }
              lastSign = v > 0 ? 1 : -1;
            }
            if (!pts.length) continue;

            const rgb = isKing ? PAL.king : (lastSign > 0 ? pal.pos : pal.neg);
            const alpha = (0.22 + strongest * 0.66);
            ctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha.toFixed(3) + ')';

            if (pts.length === 1) {
              const p = pts[0];
              ctx.fillRect(Math.round((p.x - segW / 2) * hr), Math.round((y - p.h / 2) * vr),
                Math.max(1, Math.round(segW * hr)), Math.max(1, Math.round(p.h * vr)));
            } else {
              ctx.beginPath();
              ctx.moveTo((pts[0].x - segW / 2) * hr, (y - pts[0].h / 2) * vr);
              for (let i = 0; i < pts.length; i++) ctx.lineTo(pts[i].x * hr, (y - pts[i].h / 2) * vr);
              ctx.lineTo((pts[pts.length - 1].x + segW / 2) * hr, (y - pts[pts.length - 1].h / 2) * vr);
              ctx.lineTo((pts[pts.length - 1].x + segW / 2) * hr, (y + pts[pts.length - 1].h / 2) * vr);
              for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x * hr, (y + pts[i].h / 2) * vr);
              ctx.lineTo((pts[0].x - segW / 2) * hr, (y + pts[0].h / 2) * vr);
              ctx.closePath();
              ctx.fill();
            }

            /* Strike label at the right edge. With nine levels there is room to
               name them, and a level you cannot read the price of is only half
               a level. */
            const lastP = pts[pts.length - 1];
            ctx.font = '600 ' + Math.round(9 * vr) + 'px "JetBrains Mono", monospace';
            ctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + Math.min(1, alpha + 0.25).toFixed(3) + ')';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(lv.k), (lastP.x + segW / 2 + 4) * hr, y * vr);
          }
          ctx.restore();
        });
      },
    };

    return {
      attached(p) { chartRef = p.chart; seriesRef = p.series; requestUpdate = p.requestUpdate; },
      detached() { chartRef = seriesRef = requestUpdate = null; },
      updateAllViews() {},
      paneViews() { return [{ renderer: function () { return renderer; }, zOrder: function () { return 'bottom'; } }]; },
      poke() { if (requestUpdate) requestUpdate(); },
    };
  }

  /* ---------- structure lines ---------------------------------------------- */
  function drawLines(sym) {
    if (!priceSeries) return;
    Object.keys(lines).forEach(k => { try { priceSeries.removePriceLine(lines[k]); } catch (e) {} });
    lines = {};
    const d = S.data[sym];
    if (!d || !d.strikes || !d.strikes.length) return;
    let king = null, cw = null, pw = null, flip = null;
    try {
      const kingOf = (window.Kairos && window.Kairos.kingOf) || window.kingOf;
      const panelStats = (window.Kairos && window.Kairos.panelStats) || window.panelStats;
      king = kingOf ? kingOf(d.strikes, metric) : null;
      const ps = panelStats ? panelStats(sym, d, metric) : null;
      if (ps) { cw = ps.cw; pw = ps.pw; flip = ps.fl; }
    } catch (e) {}
    const add = (price, color, title, style) => {
      if (price == null || !isFinite(price)) return;
      try {
        lines[title] = priceSeries.createPriceLine({
          price: +price, color, lineWidth: 1,
          lineStyle: style == null ? 2 : style, axisLabelVisible: true, title,
        });
      } catch (e) {}
    };
    if (king) add(king.k, cssVar('--gold', '#f2c14e'), 'KING', 0);
    if (cw != null) add(cw, 'rgba(45,212,191,.7)', 'CALL WALL');
    if (pw != null) add(pw, 'rgba(232,121,249,.7)', 'PUT WALL');
    if (flip != null) add(flip, 'rgba(148,163,184,.65)', 'FLIP', 1);
  }

  /* ---------- undertow ------------------------------------------------------
     Net exposure within +/-1% of spot through time. This is the number that
     says what dealers do HERE, rather than the sign of the largest node
     somewhere else, and it is the same quantity Aether now gates on. */
  function undertowData() {
    const cols = field[curSym];
    if (!cols || !cols.length) return [];
    const out = []; let last = 0;
    for (const c of cols) {
      if (metric === 'vex' && (c.noVex || !c.v)) continue;
      const vals = metric === 'vex' ? c.v : c.g;
      if (!vals || !c.spot) continue;
      const t = Math.floor(c.t / 1000);
      if (!(t > last)) continue;
      last = t;
      let net = 0;
      for (let i = 0; i < c.ks.length; i++) if (Math.abs(c.ks[i] - c.spot) <= c.spot * 0.01) net += vals[i];
      out.push({ time: t, value: net, color: net >= 0 ? 'rgba(45,212,191,.6)' : 'rgba(244,114,62,.6)' });
    }
    return out;
  }

  /* ---------- chart lifecycle ----------------------------------------------- */
  function build() {
    const host = $('nexusStage');
    if (!host) return false;
    const L = LWC();
    if (!L || !L.createChart || !L.CandlestickSeries) { libFail = true; return false; }

    chart = L.createChart(host, {
      layout: {
        background: { color: 'transparent' },
        textColor: cssVar('--muted', '#94a3b8'),
        fontFamily: '"JetBrains Mono", monospace', fontSize: 10, attributionLogo: false,
        panes: { separatorColor: cssVar('--border', '#1e293b'), separatorHoverColor: 'rgba(45,212,191,.25)' },
      },
      grid: { vertLines: { color: 'rgba(148,163,184,.045)' }, horzLines: { color: 'rgba(148,163,184,.045)' } },
      rightPriceScale: { borderColor: cssVar('--border', '#1e293b'), scaleMargins: { top: 0.06, bottom: 0.06 } },
      timeScale: { borderColor: cssVar('--border', '#1e293b'), timeVisible: true, secondsVisible: false, rightOffset: 6 },
      crosshair: {
        mode: 0,
        vertLine: { color: 'rgba(148,163,184,.35)', labelBackgroundColor: '#0b1220' },
        horzLine: { color: 'rgba(148,163,184,.35)', labelBackgroundColor: '#0b1220' },
      },
      localization: { locale: 'en-US' },
      autoSize: true,
    });

    priceSeries = chart.addSeries(L.CandlestickSeries, {
      upColor: 'rgba(226,232,240,.92)', downColor: 'rgba(100,116,139,.92)',
      wickUpColor: 'rgba(226,232,240,.5)', wickDownColor: 'rgba(100,116,139,.5)',
      borderVisible: false, priceLineVisible: false, lastValueVisible: true,
    });

    fieldPrim = makeFieldPrimitive();
    try { priceSeries.attachPrimitive(fieldPrim); } catch (e) { console.warn('Nexus: primitive attach failed', e); }

    /* Panes are the newest part of the v5 API, so a failure here should cost
       the undertow rather than the entire chart. */
    try {
      undertow = chart.addSeries(L.HistogramSeries, {
        priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false, base: 0,
      }, 1);
      const panes = chart.panes();
      if (panes && panes[1] && panes[1].setHeight) panes[1].setHeight(78);
    } catch (e) { undertow = null; }

    ready = true;
    return true;
  }

  function redraw() {
    if (!ready || !chart) return;
    try {
      if (bars.length) priceSeries.setData(bars);
      if (undertow) undertow.setData(undertowData());
      drawLines(curSym);
      if (fieldPrim) fieldPrim.poke();
    } catch (e) {}
    const wait = $('nexusWait');
    if (wait) wait.style.display = bars.length ? 'none' : '';
  }

  async function open(sym) {
    const next = sym || S.focus;
    const changed = next !== curSym;
    curSym = next;
    if (changed) { bars = []; barsT = 0; cache.key = ''; }
    const ti = $('nexusTicker'); if (ti && ti.value !== curSym) ti.value = curSym;

    if (!ready && !libFail) build();
    if (libFail) {
      const wait = $('nexusWait');
      if (wait) {
        wait.style.display = '';
        wait.innerHTML = 'Chart library did not load.<br><span style="color:var(--faint)">Nexus needs Lightweight Charts. Check the network tab for a blocked request.</span>';
      }
      return;
    }
    hud();
    /* Guard against overlapping opens. Clicking through four tickers used to
       fire four concurrent bar fetches that resolved out of order and repainted
       over each other, which read as the chart freezing. */
    if (opening) return;
    opening = true;
    try {
      await loadBars(curSym);
      redraw();
      if (changed) { try { chart.timeScale().fitContent(); } catch (e) {} }
      hydrate(curSym);
    } finally { opening = false; }
  }

  /* Focus hook. pickPreset() calls this whenever a ticker chip is clicked,
     which is how the rail drives every other view. v9 never registered it, so
     the chips silently did nothing while Nexus was open. */
  window.__kairosArenaFocus = function (t) {
    const ti = $('nexusTicker'); if (ti) ti.value = t;
    if (onNexus()) open(t);
    else { curSym = t; bars = []; barsT = 0; cache.key = ''; }
  };

  /* ---------- HUD ----------------------------------------------------------- */
  function hud() {
    const el = $('nexusHud');
    if (!el) return;
    const d = S.data[curSym];
    if (!d || !d.strikes) { el.innerHTML = ''; return; }
    let ps = null, king = null;
    try {
      const kingOf = (window.Kairos && window.Kairos.kingOf) || window.kingOf;
      const panelStats = (window.Kairos && window.Kairos.panelStats) || window.panelStats;
      ps = panelStats ? panelStats(curSym, d, metric) : null;
      king = kingOf ? kingOf(d.strikes, metric) : null;
    } catch (e) {}
    const spot = S.spot[curSym] || d.spot || 0;
    const dp = spot > 2000 ? 0 : 1;
    const net1 = ps && ps.net1 != null ? ps.net1 : null;
    const regime = net1 == null ? null : (net1 > 0 ? 'AEGIS' : 'MAELSTROM');
    const cell = (l, v, c, tip) =>
      '<div class="nx-cell"' + (tip ? ' data-tip="' + tip + '"' : '') + '><b>' + l + '</b><span' +
      (c ? ' style="color:' + c + '"' : '') + '>' + v + '</span></div>';
    const cols = (field[curSym] || []).length;
    el.innerHTML =
      cell('REGIME @ SPOT', regime || '\u2014',
        regime === 'AEGIS' ? 'var(--teal)' : regime === 'MAELSTROM' ? '#f4723e' : '',
        'Net exposure within \u00b11% of spot. Positive: dealers fade moves and price is held. Negative: dealers chase and moves amplify. This is the local book, not the sign of the largest node.') +
      cell('KING', king ? (+king.k).toFixed(dp) : '\u2014', 'var(--gold)', 'The single largest node on this metric.') +
      cell('FLIP', ps && ps.fl != null ? (+ps.fl).toFixed(dp) : '\u2014', 'var(--muted)',
        'Zero-gamma level, from a full Black-Scholes re-price across a \u00b17% spot grid rather than per-strike sign changes.') +
      cell('EM \u00b11\u03c3', ps && ps.em ? '\u00b1' + ps.em.toFixed(dp) : '\u2014', 'var(--cyan)', 'One session, implied by ATM IV.') +
      cell('SOUNDINGS', cols ? String(cols) : '0', cols ? 'var(--text)' : 'var(--faint)',
        'Recorded field columns for this symbol. Server columns accumulate 24/5; local columns only while a tab is open.');
  }
  setInterval(function () { if (onNexus()) hud(); }, 6000);

  /* ---------- fullscreen ----------------------------------------------------- */
  function toggleFull() {
    const sec = $('nexusSec');
    if (!sec) return;
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    /* iOS Safari has no element fullscreen, so fall back to a fixed-position
       class that fills the viewport. Same result, no API. */
    if (sec.requestFullscreen) sec.requestFullscreen().catch(function () { sec.classList.add('nx-faux'); syncFullBtn(); });
    else { sec.classList.toggle('nx-faux'); syncFullBtn(); }
  }
  function syncFullBtn() {
    const b = $('nexusFull');
    const on = !!document.fullscreenElement || (($('nexusSec') || {}).classList || { contains: () => false }).contains('nx-faux');
    if (b) b.textContent = on ? 'EXIT' : 'FULL';
    setTimeout(function () { try { chart.timeScale().fitContent(); } catch (e) {} }, 140);
  }
  document.addEventListener('fullscreenchange', syncFullBtn);

  /* ---------- view wiring ----------------------------------------------------- */
  (function () {
    const prev = window.setView;
    window.setView = function (v) {
      if (window.clearNav) window.clearNav();
      const btn = $('btnArena'), sec = $('nexusSec');
      if (v !== 'arena') { if (btn) btn.classList.remove('active'); if (sec) sec.classList.add('hidden'); return prev(v); }
      S.view = 'arena';
      ['btnTrinity', 'btnSingle', 'btnChart', 'btnIdeas', 'btnImb', 'btnTape', 'btnNova'].forEach(id => { const b = $(id); if (b) b.classList.remove('active'); });
      if (btn) btn.classList.add('active');
      /* novaSec belongs on this list. Core's setView owns hiding it, and the
         arena branch never reaches core's setView, so opening Nova and then
         Nexus left the entire Nova deck stacked underneath the chart. */
      ['trinityWrap', 'chartSec', 'ideasSec', 'imbSec', 'tapeSec', 'novaSec'].forEach(id => { const e = $(id); if (e) e.classList.add('hidden'); });
      if (sec) sec.classList.remove('hidden');
      const mt = $('mtoggle'); if (mt) mt.classList.remove('dim');
      const ct = $('centertoggle'); if (ct) ct.classList.add('dim');
      const pb = $('presetBar'); if (pb) pb.classList.remove('hidden');
      if (window.renderPresets) window.renderPresets();
      open(S.focus);
      if (!S.data[S.focus] || Date.now() - (S.dataAge[S.focus] || 0) > 90000) { if (window.refresh) window.refresh(false); }
    };
    const b = $('btnArena');
    if (b) b.onclick = function () { window.setView('arena'); };

    const ti = $('nexusTicker');
    if (ti) ti.onchange = async function () {
      const v = window.cleanSym ? window.cleanSym(ti.value) : String(ti.value || '').toUpperCase().trim();
      if (!v) { ti.value = curSym || S.focus; return; }
      ti.value = v; S.focus = v;
      if (window.renderPresets) window.renderPresets();
      if (!S.data[v] && window.getSym) {
        const sp = $('spin'); if (sp) sp.classList.remove('hidden');
        try { const r = await window.getSym(v); if (r) { S.data[v] = r; S.dataAge[v] = Date.now(); } } catch (e) {}
        if (sp) sp.classList.add('hidden');
      }
      open(v);
    };

    const ms = $('nexusMetric');
    if (ms) ms.addEventListener('click', e => {
      const b2 = e.target.closest('button[data-m]'); if (!b2) return;
      ms.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b2.classList.add('on');
      metric = b2.dataset.m; cache.key = '';
      hud(); redraw();
    });

    const fit = $('nexusFit');
    if (fit) fit.onclick = function () {
      try { chart.timeScale().fitContent(); priceSeries.priceScale().applyOptions({ autoScale: true }); } catch (e) {}
    };
    const fs = $('nexusFull');
    if (fs) fs.onclick = toggleFull;
    const nt = $('nexusNoteToggle');
    if (nt) nt.onclick = function () {
      const n = $('nexusNote'); if (!n) return;
      n.classList.toggle('open');
      nt.textContent = n.classList.contains('open') ? 'HIDE' : 'HOW TO READ';
    };
  })();

  document.addEventListener('visibilitychange', function () {
    if (onNexus() && !document.hidden) loadBars(curSym).then(redraw);
  });
  setInterval(function () {
    if (onNexus() && !document.hidden) loadBars(curSym).then(redraw);
  }, 60000);

  window.KairosNexus = {
    NX, open, redraw, hud, hydrate, toggleFull,
    field: function () { return field; },
    chart: function () { return chart; },
    levels: function () { return buildLevels(); },
    metric: function () { return metric; },
  };
  console.log('%cKairos Nexus \u2014 THE LADDER. Exposure as horizontal levels through time: thickness is strength, and price runs across them.', 'color:#2dd4bf;font-weight:bold');
})();
