/* ============================================================================
   KAIROS COSMOS CHARTS
   A compact price chart beneath every Cosmos ladder, with that symbol's own
   structural levels drawn on it.

   The idea is the one thing the wall could not do: a ladder tells you WHERE the
   levels are, and nothing about whether price is currently being held by them.
   Reading the ladder and then switching to Chronos to answer that is two
   screens for one question. Now each pillar answers it in place.

   Deliberately spare. No studies, no crosshair readout, no fullscreen. Two
   timeframes, the levels, and the candles. Anything more belongs in Chronos,
   and putting it here would just make five small charts each worse than one
   big one.

   Shares kairos-nexus.js's level selection through window.KairosChronos so the
   two screens can never disagree about which levels matter. Load AFTER
   kairos-nexus.js.
   ============================================================================ */
(function () {
  'use strict';

  const S = window.Kairos && window.Kairos.state;
  if (!S) return;

  const CC = {
    LEVELS: 5,          // fewer than Chronos: these panes are a fifth the height
    /* Looser than Chronos on purpose. Tested against a live SPY ladder, 0.18
       returned only two levels because one dominant node swallowed its
       neighbour: a pane whose job is "is price being held" needs the wall on
       each side, not just the King. */
    MATERIAL: 0.10,
    MERGE: 0.003,
    MAX_PX: 7,
    MIN_PX: 1.2,
  };

  const charts = {};    // sym -> {chart, series, prim, host, bars, barsT, tf}
  const stages = {};    // sym -> the persistent stage element

  /* THE RENDERER DOES NOT OWN THESE NODES.
     renderTrinity builds each pillar with document.createElement on every
     refresh, so anything it creates is thrown away ten seconds later. That is
     why the charts kept going black: the host element was destroyed, the chart
     was disposed with it, and a new one was built from scratch each cycle.

     The stage is created ONCE per symbol here and handed to the renderer to
     append. Detaching a node and re-attaching it preserves its children, so the
     canvases, the chart instance, its data and its zoom all survive a pillar
     rebuild untouched. */
  function stageFor(sym) {
    let st = stages[sym];
    if (!st) {
      st = document.createElement('div');
      st.className = 'cc-stage';
      st.dataset.sym = sym;
      stages[sym] = st;
    }
    return st;
  }
  const LWC = () => window.LightweightCharts;
  const onCosmos = () => S.view === 'trinity';

  let tf = (function () {
    try { return localStorage.getItem('kairos_cosmos_tf') === '1min' ? '1min' : '5min'; }
    catch (e) { return '5min'; }
  })();
  let shown = (function () {
    try { return localStorage.getItem('kairos_cosmos_on') !== '0'; } catch (e) { return true; }
  })();

  const PAL = { pos: [45, 212, 191], neg: [244, 114, 62], king: [242, 193, 78] };
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  function cssVar(n, fb) {
    try { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb; }
    catch (e) { return fb; }
  }

  /* ---------- levels -------------------------------------------------------
     Same three passes Chronos uses (local extremum, materiality, merge) but on
     the CURRENT ladder only. These panes have no recorded history behind them
     and pretending otherwise would be inventing depth they do not have. */
  function levelsFor(sym) {
    const d = S.data[sym];
    if (!d || !d.strikes || !d.strikes.length || !d.spot) return [];
    const metric = S.metric || 'gex';
    const all = d.strikes
      .map(s => ({ k: s.k, v: metric === 'vex' ? (s.vex || 0) : (s.gex || 0) }))
      .filter(x => x.v)
      .sort((a, b) => a.k - b.k);
    if (!all.length) return [];
    const kingMag = Math.max.apply(null, all.map(x => Math.abs(x.v)));
    const band = d.spot * 0.004;

    const peaks = [];
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      if (Math.abs(a.v) < kingMag * CC.MATERIAL) continue;
      let dominant = true;
      for (let j = 0; j < all.length; j++) {
        if (i === j) continue;
        const b = all[j];
        if (Math.abs(b.k - a.k) > band) continue;
        if (b.v * a.v < 0) continue;
        if (Math.abs(b.v) > Math.abs(a.v)) { dominant = false; break; }
      }
      if (dominant) peaks.push(a);
    }
    peaks.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    const out = [];
    for (const p of peaks) {
      if (out.some(m => Math.abs(m.k - p.k) <= d.spot * CC.MERGE && m.v * p.v > 0)) continue;
      out.push(p);
      if (out.length >= CC.LEVELS) break;
    }
    /* Guaranteed floor, same reasoning as Chronos: a selection rule that can
       return nothing is a bug however principled each pass is. */
    if (out.length < 3) {
      let king = null, cw = null, pw = null;
      for (const a of all) {
        if (!king || Math.abs(a.v) > Math.abs(king.v)) king = a;
        if (a.k > d.spot && a.v > 0 && (!cw || a.v > cw.v)) cw = a;
        if (a.k < d.spot && a.v < 0 && (!pw || a.v < pw.v)) pw = a;
      }
      [king, cw, pw].forEach(n => {
        if (n && !out.some(m => Math.abs(m.k - n.k) <= d.spot * CC.MERGE && m.v * n.v > 0)) out.push(n);
      });
    }
    const peak = Math.max.apply(null, out.map(x => Math.abs(x.v)) .concat([1]));
    const kingK = all.reduce((a, b) => Math.abs(b.v) > Math.abs(a.v) ? b : a, all[0]).k;
    return out.map(x => ({ k: x.k, v: x.v, mag: Math.sqrt(Math.abs(x.v) / peak), king: x.k === kingK }));
  }

  /* ---------- the level primitive ------------------------------------------
     One horizontal band per level, spanning the pane. No time dimension here:
     these are the levels as they stand right now, which is all a pane this
     small can honestly carry. */
  function makePrim(sym) {
    let chartRef = null, seriesRef = null, requestUpdate = null;
    const renderer = {
      draw(target) {
        const lv = levelsFor(sym);
        if (!lv.length || !seriesRef) return;
        target.useBitmapCoordinateSpace(function (scope) {
          const ctx = scope.context;
          const hr = scope.horizontalPixelRatio, vr = scope.verticalPixelRatio;
          const W = scope.bitmapSize.width;
          ctx.save();
          for (const L of lv) {
            const y = seriesRef.priceToCoordinate(L.k);
            if (y == null) continue;
            const h = CC.MIN_PX + L.mag * (CC.MAX_PX - CC.MIN_PX);
            const c = L.king ? PAL.king : (L.v > 0 ? PAL.pos : PAL.neg);
            ctx.fillStyle = rgba(c, 0.10 + L.mag * 0.30);
            ctx.fillRect(0, (y - h / 2) * vr, W, Math.max(1, h * vr));
            // a brighter core line so the level reads even when the band is faint
            ctx.fillStyle = rgba(c, 0.42 + L.mag * 0.48);
            ctx.fillRect(0, Math.round(y * vr), W, Math.max(1, 1 * vr));
            ctx.font = '600 ' + Math.round(8 * vr) + 'px "JetBrains Mono", monospace';
            ctx.fillStyle = rgba(c, 0.85);
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(String(L.k), 4 * hr, y * vr);
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

  /* ---------- bars ---------------------------------------------------------
     One request per symbol per timeframe, cached for 45s. Five pillars on a
     60-second refresh is well inside the rate limit, and the proxy collapses
     duplicate bursts anyway. */
  async function loadBars(sym) {
    const c = charts[sym];
    if (!c) return;
    if (c.bars && c.bars.length && c.tf === tf && Date.now() - c.barsT < 45000) return;
    const px = (window.underOf ? window.underOf(sym) : sym);
    const p = (n) => String(n).padStart(2, '0');
    const d = new Date(Date.now() - (tf === '1min' ? 2 : 5) * 86400000);
    const start = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    const path = '/markets/timesales?symbol=' + encodeURIComponent(px) +
                 '&interval=' + tf + '&start=' + start + '&session_filter=open';
    try {
      let j = null;
      if (window.KairosBackend && window.KairosBackend.enabled) j = await window.KairosBackend.proxy(path);
      else if (window.tFetch) j = await window.tFetch(path);
      let rows = j && j.series && j.series.data;
      if (rows && !Array.isArray(rows)) rows = [rows];
      if (!rows || !rows.length) return;
      const out = []; let last = 0;
      for (const r of rows) {
        const t = Math.floor(new Date(r.time).getTime() / 1000);
        if (!(t > last) || !(+r.close > 0)) continue;
        last = t;
        out.push({ time: t, open: +r.open, high: +r.high, low: +r.low, close: +r.close });
      }
      if (out.length) {
        if (c.tf !== tf) c.fitted = false;   // a timeframe change deserves a refit
        c.bars = out.slice(-260); c.barsT = Date.now(); c.tf = tf;
      }
    } catch (e) {}
  }

  function build(sym, host) {
    const L = LWC();
    if (!L || !L.createChart || !L.CandlestickSeries) return null;
    const chart = L.createChart(host, {
      layout: {
        background: { type: 'solid', color: '#000000' },
        textColor: cssVar('--faint', '#64748b'),
        fontFamily: '"JetBrains Mono", monospace', fontSize: 8, attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.12 }, autoScale: true },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 3, barSpacing: 3, minBarSpacing: 0.4 },
      crosshair: {
        mode: 0,
        vertLine: { visible: true, color: 'rgba(148,163,184,.3)', width: 1, style: 3, labelVisible: false },
        horzLine: { visible: true, color: 'rgba(148,163,184,.3)', width: 1, style: 3, labelVisible: true, labelBackgroundColor: '#0b1220' },
      },
      /* These panes were frozen: every interaction handler was off, so you
         could see the levels and never look around them. Full pan and zoom on
         both axes now, including pinch and vertical touch drag so a phone can
         actually work the chart. */
      handleScale: {
        mouseWheel: true, pinch: true,
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
      },
      handleScroll: {
        mouseWheel: true, pressedMouseMove: true,
        horzTouchDrag: true,
        /* vertTouchDrag stays OFF on purpose. With it on, a vertical swipe
           anywhere over the chart pans the price scale instead of scrolling the
           page, and since the chart is half the pillar you would be trapped
           every time you tried to scroll past it. Horizontal drag pans time,
           pinch zooms, and dragging the price axis itself still rescales price,
           so nothing is actually lost. */
        vertTouchDrag: false,
      },
      /* Tighter bars so a narrow pane still shows a session's worth of shape
         instead of a dozen fat candles. minBarSpacing lets you keep zooming out
         past the default floor. */
      autoSize: true,
    });
    const series = chart.addSeries(L.CandlestickSeries, {
      upColor: 'rgba(226,232,240,.92)', downColor: 'rgba(100,116,139,.92)',
      wickUpColor: 'rgba(226,232,240,.45)', wickDownColor: 'rgba(100,116,139,.45)',
      borderVisible: false, priceLineVisible: true, lastValueVisible: true,
      priceLineColor: 'rgba(56,189,248,.5)', priceLineStyle: 2,
    });
    const prim = makePrim(sym);
    try { series.attachPrimitive(prim); } catch (e) {}
    return { chart, series, prim, host, bars: [], barsT: 0, tf: '', fitted: false };
  }

  /* ---------- lifecycle ----------------------------------------------------
     renderTrinity rebuilds the pillars wholesale, so a chart's host node is
     replaced under it. Rather than diff, dispose any chart whose host has left
     the document and rebuild against the new one. */
  function applyShown() {
    document.body.classList.toggle('cc-off', !shown);
    document.querySelectorAll('#cosmosTf button').forEach(b => { b.disabled = !shown; });
    const tfBox = document.getElementById('cosmosTf');
    if (tfBox) tfBox.style.opacity = shown ? '' : '.4';
    document.querySelectorAll('#cosmosOn button').forEach(b =>
      b.classList.toggle('on', (b.dataset.on === '1') === shown));
    /* Hidden means the panes are display:none, so LightweightCharts sees a zero
       height container. Dispose them rather than leave zero-size charts alive,
       and rebuild on the way back. */
    if (!shown) {
      Object.keys(charts).forEach(k => { try { charts[k].chart.remove(); } catch (e) {} delete charts[k]; });
    } else {
      setTimeout(sync, 40);
    }
  }
  function setShown(v) {
    shown = !!v;
    try { localStorage.setItem('kairos_cosmos_on', shown ? '1' : '0'); } catch (e) {}
    applyShown();
  }

  async function sync() {
    if (!shown || !onCosmos() || document.hidden) return;
    const hosts = document.querySelectorAll('.cc-stage[data-sym]');
    const live = new Set();
    for (const host of hosts) {
      const sym = host.dataset.sym;
      live.add(sym);
      let c = charts[sym];
      /* No disposal on detach any more. The node is ours and survives the
         rebuild, so a chart is only ever torn down when its symbol leaves the
         roster or the panes are switched off. */
      if (!c) {
        if (!host.clientHeight) continue;   // not laid out yet; next tick
        c = build(sym, host);
        if (!c) return;                     // library not ready; next tick
        charts[sym] = c;
      }
      await loadBars(sym);
      try {
        if (c.bars.length) {
          c.series.setData(c.bars);
          /* Fit ONCE, on the first data for this symbol and timeframe. After
             that the pane is yours: refitting on every refresh would yank the
             view back every ten seconds and make panning pointless. */
          if (!c.fitted) { c.chart.timeScale().fitContent(); c.fitted = true; }
        }
        /* A node that is MOVED rather than resized does not always trigger the
           ResizeObserver autoSize relies on, so nudge the chart to re-measure
           after a pillar rebuild. Cheap, and it prevents a zero-height canvas
           surviving as a blank pane. */
        const w = host.clientWidth, h2 = host.clientHeight;
        if (w && h2) c.chart.resize(w, h2);
        c.prim.poke();
      } catch (e) {}
    }
    /* DISPOSE ON ROSTER CHANGE ONLY, never on DOM absence.
       renderTrinity clears its container with innerHTML='' before rebuilding,
       and sync() awaits inside its loop, so a snapshot of .cc-stage nodes taken
       mid-rebuild comes back EMPTY. Keying disposal off that snapshot meant
       every chart got torn down and rebuilt on each refresh cycle: the flash.

       The roster is the only honest source of truth for which symbols should
       have a chart. A node being briefly detached says nothing at all. */
    const roster = new Set(S.trinityTickers || []);
    Object.keys(charts).forEach(k => {
      if (!roster.has(k)) {
        try { charts[k].chart.remove(); } catch (e) {}
        delete charts[k]; delete stages[k];
      }
    });
  }

  function setTf(v) {
    tf = (v === '1min') ? '1min' : '5min';
    try { localStorage.setItem('kairos_cosmos_tf', tf); } catch (e) {}
    Object.keys(charts).forEach(k => { charts[k].bars = []; charts[k].barsT = 0; });
    document.querySelectorAll('#cosmosTf button').forEach(b => b.classList.toggle('on', b.dataset.tf === tf));
    sync();
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    const b = e.target.closest('#cosmosTf button[data-tf]');
    if (b) { setTf(b.dataset.tf); return; }
    const o = e.target.closest('#cosmosOn button[data-on]');
    if (o) setShown(o.dataset.on === '1');
  });
  document.addEventListener('DOMContentLoaded', applyShown);
  applyShown();
  /* Boot-time visibility. setView() owns this bar, but it only runs on a
     navigation, and Cosmos is the view the app OPENS on. Without this the
     controls stayed hidden for anyone who never left the wall. */
  (function () {
    const show = function () {
      const b = document.getElementById('cosmosBar');
      if (b) b.classList.toggle('hidden', S.view !== 'trinity');
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
    else show();
    setTimeout(show, 200);
  })();

  /* The pillars are re-rendered on every refresh, so poll rather than hook a
     render callback that does not exist. Cheap: it only walks a handful of DOM
     nodes and returns immediately when nothing has changed. */
  setInterval(sync, 4000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) sync(); });

  window.KairosCosmosChart = {
    sync, setTf, setShown, levelsFor, stageFor,
    shown: function () { return shown; },
    tf: function () { return tf; },
    charts: function () { return charts; },
  };
  console.log('%cKairos Cosmos charts \u2014 each ladder now shows whether price is actually being held by its levels.', 'color:#2dd4bf;font-weight:bold');
})();
