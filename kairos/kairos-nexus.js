/* ============================================================================
   KAIROS NEXUS v9 — THE SOUNDING
   Rebuilt on TradingView Lightweight Charts v5. Replaces ~1,200 lines of
   hand-rolled chart engine with ~450 against a maintained library.

   WHY THE OLD ONE LOOKED CHEAP
   The old painter drew each recorded column as a vertical createLinearGradient
   with one addColorStop per strike. A linear gradient INTERPOLATES between
   stops, and gamma is not linearly distributed between strikes: it is a sum of
   roughly Gaussian kernels sitting on a discrete ladder. Blending between node
   values produced diamond and banded artefacts that had nothing to do with the
   data. That was not a tuning problem, it was the wrong rendering primitive.

   It got worse on server history, where only the top 24 nodes by |gex| are
   stored, so gradient stops sat 5, 10 or 30 points apart and smeared enormous
   false bands across the gaps.

   THE CONCEPT
   A field recorded in columns through time, sampled at discrete depths, is
   structurally a seismic reflection section: a medium read by soundings, drawn
   as strata. So this draws strata. Each strike gets its own solid band, no
   interpolation, with a hard null seam where the field genuinely cancels. What
   the eye reads as banding is now the actual sampling resolution of the
   instrument, which is honest, and the gaps in server history are visible as
   gaps rather than disguised as smooth gradient.

   Positive exposure (AEGIS, dealers fade, price is held) reads as cold teal.
   Negative (MAELSTROM, dealers chase, moves amplify) reads as ember. Zero is
   the black seam between them.

   Load AFTER kairos-core.js. Requires Lightweight Charts v5 on the page.
   ============================================================================ */
(function () {
  'use strict';

  const S = window.Kairos && window.Kairos.state;
  if (!S) { console.warn('Nexus: Kairos core not present'); return; }

  const NX = {
    REC_MS: 60000,        // one recorded column per minute
    COLS_MEM: 900,        // ~15h of columns held in memory
    BAND_MIN_PX: 1.5,     // a stratum thinner than this is not worth drawing
    FIELD_ALPHA: 0.92,    // ceiling opacity for the strongest stratum
    LADDER_PAD: 0.06,     // how far past the outermost strike the field extends
  };

  /* Recorded field. One entry per symbol, each an array of columns:
     {t, ks[], g[], v[], spot, srv, noVex}. Columns arrive from two places:
     this tab's own recorder, and the server Chronicle, which accumulates 24/5
     whether or not a browser is open. */
  const field = {};
  const fieldT = {}, fieldStamp = {};
  let chart = null, priceSeries = null, undertow = null, fieldPrim = null;
  let curSym = null, bars = [], barsT = 0, metric = 'gex';
  let lines = { king: null, cw: null, pw: null, flip: null };
  let ready = false, libFail = false;

  const $ = (id) => document.getElementById(id);
  const LWC = () => window.LightweightCharts;

  /* ---------- palette -----------------------------------------------------
     Read from the stylesheet so Nexus can never drift from the rest of Kairos.
     Falls back to the shipped values if a var is missing. */
  function cssVar(n, fb) {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
      return v || fb;
    } catch (e) { return fb; }
  }
  const PAL = {
    aegis: [45, 212, 191],      // teal: positive gamma, the field resists
    maelstrom: [244, 114, 62],  // ember: negative gamma, the field pulls
    vegaPos: [56, 189, 248],
    vegaNeg: [232, 121, 249],
  };

  /* ---------- recording ---------------------------------------------------
     Unchanged in spirit from the old build: snapshot the live ladder on a
     timer. The ladder itself is computed in core, so this is only storage. */
  function record() {
    const syms = new Set([S.focus].concat(S.trinityTickers || []));
    const now = Date.now();
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
      const col = { t: now, ks, g, v, spot: S.spot[sym] || d.spot || 0, srv: false, noVex: false };
      (field[sym] = field[sym] || []).push(col);
      if (field[sym].length > NX.COLS_MEM) field[sym].splice(0, field[sym].length - NX.COLS_MEM);
      if (sym === curSym) redraw();
    }
  }
  setInterval(record, 15000);

  /* Server Chronicle. The Worker now stores {k,g,v} per node, so vega is real.
     Older rows predate that and carry no v at all: those columns are flagged
     noVex and are SKIPPED in VEX mode rather than painted as a field of zeros.
     Inventing zeros is what the previous build did, and a chart of fabricated
     nothing is worse than an empty chart. */
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
          t,
          ks: c.nodes.map(n => n.k),
          g: c.nodes.map(n => n.g),
          v: hasV ? c.nodes.map(n => n.v || 0) : null,
          spot: c.spot, srv: true, noVex: !hasV,
        });
        seen.add(t);
      }
      cur.sort((a, b) => a.t - b.t);
      field[sym] = cur.slice(-NX.COLS_MEM);
      redraw();
    } catch (e) {}
  }

  /* ---------- price bars --------------------------------------------------
     Tradier 1-minute history. Reused rather than refetched on every view
     switch; 45s is under the bar interval so nothing is ever missed. */
  async function loadBars(sym) {
    if (Date.now() - barsT < 45000 && curSym === sym && bars.length) return;
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
      /* LWC wants seconds and a strictly ascending, de-duplicated time axis.
         Tradier occasionally repeats a stamp across session boundaries, and a
         duplicate throws rather than degrading, so it is filtered here. */
      const out = []; let last = 0;
      for (const r of rows) {
        const t = Math.floor(new Date(r.time).getTime() / 1000);
        if (!(t > last) || !(+r.close > 0)) continue;
        last = t;
        out.push({ time: t, open: +r.open, high: +r.high, low: +r.low, close: +r.close });
      }
      bars = out; barsT = Date.now();
    } catch (e) {}
  }

  /* ---------- the field primitive ----------------------------------------
     A series primitive drawing at zOrder 'bottom', so candles sit on top of
     the field rather than being lost inside it.

     Each column is a rectangle one recording interval wide. Within it, each
     strike is a solid band spanning the midpoint gaps to its neighbours. No
     gradient, no interpolation, no invented values between soundings. */
  function makeFieldPrimitive() {
    let chartRef = null, seriesRef = null, requestUpdate = null;

    function bandsFor(col) {
      const ks = col.ks, n = ks.length;
      if (!n) return null;
      const vals = (metric === 'vex') ? col.v : col.g;
      if (!vals) return null;
      const edges = new Float64Array(n + 1);
      /* Band edges at the midpoints between strikes. The outermost bands get
         the same half-width as their inner neighbour, so the field ends at the
         ladder rather than trailing off into a value nobody measured. */
      for (let i = 1; i < n; i++) edges[i] = (ks[i - 1] + ks[i]) / 2;
      const w0 = n > 1 ? (ks[1] - ks[0]) / 2 : ks[0] * 0.002;
      const wn = n > 1 ? (ks[n - 1] - ks[n - 2]) / 2 : ks[0] * 0.002;
      edges[0] = ks[0] - w0; edges[n] = ks[n - 1] + wn;
      return { edges, vals, n };
    }

    const renderer = {
      draw(target) {
        const cols = field[curSym];
        if (!cols || !cols.length || !seriesRef || !chartRef) return;
        const ts = chartRef.timeScale();

        target.useBitmapCoordinateSpace(scope => {
          const ctx = scope.context;
          const hr = scope.horizontalPixelRatio, vr = scope.verticalPixelRatio;

          /* One shared scale across every visible column, so a stratum's
             intensity means the same thing at 09:35 and at 15:55. Scaling per
             column would make a quiet morning look identical to a violent
             close, which is the opposite of useful. */
          let peak = 0;
          const vis = [];
          for (let ci = 0; ci < cols.length; ci++) {
            const c = cols[ci];
            if (metric === 'vex' && (c.noVex || !c.v)) continue;   // never fabricate
            const x = ts.timeToCoordinate(Math.floor(c.t / 1000));
            if (x == null) continue;
            const b = bandsFor(c);
            if (!b) continue;
            for (let i = 0; i < b.n; i++) { const a = Math.abs(b.vals[i]); if (a > peak) peak = a; }
            vis.push({ x, b, srv: c.srv });
          }
          if (!peak || !vis.length) return;

          /* Column width from the actual gap between neighbours, so a run of
             server columns recorded five minutes apart draws five minutes wide
             and a gap in the record stays visibly a gap. */
          ctx.save();
          for (let i = 0; i < vis.length; i++) {
            const cur = vis[i], nxt = vis[i + 1];
            const wRaw = nxt ? (nxt.x - cur.x) : (i > 0 ? cur.x - vis[i - 1].x : 6);
            const w = Math.max(1, Math.min(wRaw, 40));
            const x0 = Math.round(cur.x * hr);
            const wpx = Math.max(1, Math.round(w * hr));
            const b = cur.b;

            for (let s = 0; s < b.n; s++) {
              const val = b.vals[s];
              if (!val) continue;
              const yTop = seriesRef.priceToCoordinate(b.edges[s + 1]);
              const yBot = seriesRef.priceToCoordinate(b.edges[s]);
              if (yTop == null || yBot == null) continue;
              const h = Math.abs(yBot - yTop);
              if (h < NX.BAND_MIN_PX) continue;

              /* Square-root ramp. Gamma concentration is heavy-tailed: on a
                 linear ramp the King saturates and everything else is black,
                 which is how the old build lost the whole mid-book. */
              const mag = Math.sqrt(Math.abs(val) / peak);
              let rgb;
              if (metric === 'vex') rgb = val > 0 ? PAL.vegaPos : PAL.vegaNeg;
              else rgb = val > 0 ? PAL.aegis : PAL.maelstrom;
              const a = mag * NX.FIELD_ALPHA * (cur.srv ? 0.82 : 1);
              ctx.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a.toFixed(3) + ')';
              ctx.fillRect(x0, Math.round(Math.min(yTop, yBot) * vr), wpx, Math.max(1, Math.round(h * vr)));
            }
          }
          ctx.restore();
        });
      },
    };

    return {
      attached(p) { chartRef = p.chart; seriesRef = p.series; requestUpdate = p.requestUpdate; },
      detached() { chartRef = seriesRef = requestUpdate = null; },
      updateAllViews() {},
      paneViews() { return [{ renderer: () => renderer, zOrder: () => 'bottom' }]; },
      poke() { if (requestUpdate) requestUpdate(); },
    };
  }

  /* ---------- structure lines --------------------------------------------
     King, call wall, put wall and the gamma flip as native price lines. In the
     old build these were hand-drawn and drifted out of sync with the axis on
     every zoom. */
  function drawLines(sym) {
    if (!priceSeries) return;
    Object.keys(lines).forEach(k => { if (lines[k]) { try { priceSeries.removePriceLine(lines[k]); } catch (e) {} lines[k] = null; } });
    const d = S.data[sym];
    if (!d || !d.strikes || !d.strikes.length) return;
    /* kingOf is on the Kairos export; panelStats is a top-level declaration in
       core, which makes it a global but NOT a member of window.Kairos. Read
       both defensively so a future export change cannot silently blank the
       structure lines. */
    let king = null, cw = null, pw = null, flip = null;
    try {
      const kingOf = (window.Kairos && window.Kairos.kingOf) || window.kingOf;
      const panelStats = (window.Kairos && window.Kairos.panelStats) || window.panelStats;
      king = kingOf ? kingOf(d.strikes, metric) : null;
      const ps = panelStats ? panelStats(sym, d, metric) : null;
      if (ps) { cw = ps.cw; pw = ps.pw; flip = ps.fl; }
    } catch (e) {}
    const add = (price, color, title, style) => {
      if (price == null || !isFinite(price)) return null;
      try {
        return priceSeries.createPriceLine({
          price: +price, color, lineWidth: 1,
          lineStyle: style == null ? 2 : style,
          axisLabelVisible: true, title,
        });
      } catch (e) { return null; }
    };
    if (king) lines.king = add(king.k, cssVar('--gold', '#f2c14e'), 'KING', 0);
    if (cw != null) lines.cw = add(cw, 'rgba(45,212,191,.75)', 'CALL WALL');
    if (pw != null) lines.pw = add(pw, 'rgba(232,121,249,.75)', 'PUT WALL');
    if (flip != null) lines.flip = add(flip, 'rgba(148,163,184,.7)', 'FLIP', 1);
  }

  /* ---------- undertow ----------------------------------------------------
     Net exposure within +/-1% of spot, through time. This is the number that
     actually says what dealers do here, as opposed to the sign of the single
     largest node, and it is the same quantity Aether now gates on. */
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
      out.push({
        time: t, value: net,
        color: net >= 0 ? 'rgba(45,212,191,.62)' : 'rgba(244,114,62,.62)',
      });
    }
    return out;
  }

  /* ---------- chart lifecycle --------------------------------------------- */
  function build() {
    const host = $('nexusStage');
    if (!host) return false;
    const L = LWC();
    if (!L || !L.createChart || !L.CandlestickSeries) { libFail = true; return false; }

    chart = L.createChart(host, {
      layout: {
        background: { color: 'transparent' },
        textColor: cssVar('--muted', '#94a3b8'),
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 10,
        attributionLogo: false,
        panes: { separatorColor: cssVar('--border', '#1e293b'), separatorHoverColor: 'rgba(45,212,191,.25)' },
      },
      grid: {
        vertLines: { color: 'rgba(148,163,184,.05)' },
        horzLines: { color: 'rgba(148,163,184,.05)' },
      },
      rightPriceScale: { borderColor: cssVar('--border', '#1e293b'), scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderColor: cssVar('--border', '#1e293b'), timeVisible: true, secondsVisible: false, rightOffset: 4 },
      crosshair: { mode: 0, vertLine: { color: 'rgba(148,163,184,.4)', labelBackgroundColor: '#0b1220' },
                   horzLine: { color: 'rgba(148,163,184,.4)', labelBackgroundColor: '#0b1220' } },
      localization: { locale: 'en-US' },
      autoSize: true,
    });

    priceSeries = chart.addSeries(L.CandlestickSeries, {
      upColor: 'rgba(226,232,240,.9)', downColor: 'rgba(100,116,139,.9)',
      wickUpColor: 'rgba(226,232,240,.5)', wickDownColor: 'rgba(100,116,139,.5)',
      borderVisible: false, priceLineVisible: false, lastValueVisible: true,
    });

    fieldPrim = makeFieldPrimitive();
    try { priceSeries.attachPrimitive(fieldPrim); } catch (e) { console.warn('Nexus: primitive attach failed', e); }

    /* Second pane for the undertow. Wrapped because pane support is the newest
       part of the v5 API and a failure here should cost the undertow, not the
       whole chart. */
    try {
      undertow = chart.addSeries(L.HistogramSeries, {
        priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false,
        base: 0,
      }, 1);
      const panes = chart.panes();
      if (panes && panes[1] && panes[1].setHeight) panes[1].setHeight(90);
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
    curSym = sym || S.focus;
    if (!ready && !libFail) build();
    if (libFail) {
      const wait = $('nexusWait');
      if (wait) {
        wait.style.display = '';
        wait.innerHTML = 'Chart library did not load.<br><span style="color:var(--faint)">Nexus needs Lightweight Charts. Check the network tab for a blocked CDN request.</span>';
      }
      return;
    }
    hud();
    await loadBars(curSym);
    hydrate(curSym);
    redraw();
    try { chart.timeScale().fitContent(); } catch (e) {}
  }

  /* ---------- HUD ---------------------------------------------------------
     Reads the same numbers as the rest of Kairos, phrased as what the field is
     doing rather than as a list of exposures. */
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
      '<div class="nx-cell"' + (tip ? ' data-tip="' + tip + '"' : '') + '><b>' + l + '</b><span' + (c ? ' style="color:' + c + '"' : '') + '>' + v + '</span></div>';
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
        'Recorded field columns available for this symbol. Server columns accumulate 24/5; local columns only while a tab is open.');
  }
  setInterval(() => { if (S.view === 'arena') hud(); }, 5000);

  /* ---------- view wiring ------------------------------------------------- */
  (function () {
    const prev = window.setView;
    window.setView = function (v) {
      if (window.clearNav) window.clearNav();
      const btn = $('btnArena'), sec = $('nexusSec');
      if (v !== 'arena') { if (btn) btn.classList.remove('active'); if (sec) sec.classList.add('hidden'); return prev(v); }
      S.view = 'arena';
      ['btnTrinity', 'btnSingle', 'btnChart', 'btnIdeas', 'btnImb', 'btnTape'].forEach(id => { const b = $(id); if (b) b.classList.remove('active'); });
      if (btn) btn.classList.add('active');
      ['trinityWrap', 'chartSec', 'ideasSec', 'imbSec', 'tapeSec'].forEach(id => { const e = $(id); if (e) e.classList.add('hidden'); });
      if (sec) sec.classList.remove('hidden');
      const mt = $('mtoggle'); if (mt) mt.classList.remove('dim');
      const ct = $('centertoggle'); if (ct) ct.classList.add('dim');
      const pb = $('presetBar'); if (pb) pb.classList.remove('hidden');
      if (window.renderPresets) window.renderPresets();
      const ti = $('nexusTicker'); if (ti) ti.value = S.focus;
      open(S.focus);
      if (!S.data[S.focus] || Date.now() - (S.dataAge[S.focus] || 0) > 90000) { if (window.refresh) window.refresh(false); }
    };
    const b = $('btnArena');
    if (b) b.onclick = function () { window.setView('arena'); };

    const ti = $('nexusTicker');
    if (ti) ti.onchange = async function () {
      const v = window.cleanSym ? window.cleanSym(ti.value) : ti.value.toUpperCase().trim();
      if (!v) { ti.value = S.focus; return; }
      ti.value = v; S.focus = v; bars = []; barsT = 0;
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
      metric = b2.dataset.m;
      hud(); redraw();
    });

    const fit = $('nexusFit');
    if (fit) fit.onclick = function () { try { chart.timeScale().fitContent(); priceSeries.priceScale().applyOptions({ autoScale: true }); } catch (e) {} };
  })();

  document.addEventListener('visibilitychange', function () {
    if (S.view === 'arena' && !document.hidden) { loadBars(curSym).then(redraw); }
  });
  setInterval(function () {
    if (S.view === 'arena' && !document.hidden) loadBars(curSym).then(redraw);
  }, 60000);

  window.KairosNexus = {
    NX, open, redraw, hud, hydrate,
    field: function () { return field; },
    chart: function () { return chart; },
    metric: function () { return metric; },
  };
  console.log('%cKairos Nexus \u2014 THE SOUNDING. The field as strata: discrete strikes, no interpolation, nothing invented between readings.', 'color:#2dd4bf;font-weight:bold');
})();
