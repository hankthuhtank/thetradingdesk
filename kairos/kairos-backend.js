/* ============================================================================
   KAIROS BACKEND CLIENT  (frontend shim)

   Drop this into the Kairos site (load it AFTER kairos-core.js) and set your
   Worker URL below. It gives the app one place to:
     • route live Tradier calls through the Worker proxy (token stays server-side)
     • read the server-accumulated history (regime / IV / field) on load
     • push + read the ideas journal server-side

   This is Phase-2 wiring — deploy the Worker first, confirm /health responds,
   THEN we point kairos-core/modules at these functions. Nothing here changes
   behavior until it's called; it's safe to include early.
   ============================================================================ */
(function () {
  'use strict';

  // Your deployed Worker origin (no trailing slash). After `wrangler deploy`
  // this is either the workers.dev URL or your custom route.
  const BACKEND = 'https://kairos-api.safihelal.workers.dev';

  const api = (path) => BACKEND + path;

  async function getJSON(path) {
    const r = await fetch(api(path));
    if (!r.ok) throw new Error('backend ' + r.status);
    return r.json();
  }

  const KairosBackend = {
    enabled: /^https:\/\/[a-z0-9.-]+/i.test(BACKEND) && !BACKEND.includes('YOUR-SUBDOMAIN'),
    base: BACKEND,

    // ---- live proxy: use in place of a direct Tradier fetch ----
    // e.g. proxy('/markets/quotes?symbols=SPY')
    proxy(tradierPath) { return getJSON('/proxy' + tradierPath); },

    // ---- accumulated history (replaces localStorage reads) ----
    regime(sym, session) { return getJSON('/history/regime?sym=' + encodeURIComponent(sym) + (session ? '&session=' + session : '')); },
    ivHistory(sym) { return getJSON('/history/iv?sym=' + encodeURIComponent(sym)); },
    field(sym, session) { return getJSON('/history/field?sym=' + encodeURIComponent(sym) + (session ? '&session=' + session : '')); },

    // ---- journal ----
    journalStats() { return getJSON('/journal'); },
    async logIdea(idea) {
      try {
        const r = await fetch(api('/journal'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sym: idea.sym, dir: idea.bias, score: idea.score, entry: idea.entry, target: idea.target != null ? +idea.target : null, invalid: idea.invalid != null ? +idea.invalid : null }),
        });
        return r.ok;
      } catch (e) { return false; }
    },

    async health() { try { return await getJSON('/health'); } catch (e) { return { ok: false, error: String(e) }; } },

    // ---- hydration: pull server-accumulated history into the app on load ----
    // Regime flow series -> state.regSeries[sym] (so the chart is pre-filled).
    async hydrateRegime(sym) {
      try {
        const d = await this.regime(sym);
        if (!d.series || !d.series.length) return 0;
        const ser = d.series.map(r => ({
          t: r.t, spot: r.spot, cpr: r.cpr, ppr: r.ppr,
          cbought: r.c_bought, csold: r.c_sold, pbought: r.p_bought, psold: r.p_sold,
        }));
        window.Kairos.state.regSeries[sym] = ser;
        return ser.length;
      } catch (e) { return 0; }
    },
    // IV history -> seed KairosQuant's localStorage IV series (merge, dedupe by day).
    async hydrateIV(sym) {
      try {
        const d = await this.ivHistory(sym);
        if (!d.history || !window.KairosQuant) return 0;
        const KEY = window.KairosQuant.QIV_KEY;
        let store = {}; try { store = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
        const arr = store[sym] || [];
        const seen = new Set(arr.map(x => x.d));
        d.history.forEach(r => { if (!seen.has(r.d)) { arr.push({ d: r.d, iv: r.iv }); seen.add(r.d); } });
        arr.sort((a, b) => a.d < b.d ? -1 : 1);
        store[sym] = arr.slice(-260);
        localStorage.setItem(KEY, JSON.stringify(store));
        return arr.length;
      } catch (e) { return 0; }
    },
    // Field Chronicle -> the replay buffer (server-side snapshots, survives closed tabs).
    async fieldColumns(sym, session) {
      try {
        const d = await this.field(sym, session);
        return d.columns || [];
      } catch (e) { return []; }
    },
  };

  window.KairosBackend = KairosBackend;
  if (KairosBackend.enabled) {
    KairosBackend.health().then(h => console.log('%cKairos Backend ' + (h.ok ? 'connected' : 'unreachable') + (h.lastCron ? ' · last cron ' + new Date(h.lastCron * 1000).toLocaleTimeString() : ''), 'color:#22d3ee;font-weight:bold'));
  }
})();
