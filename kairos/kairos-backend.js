/* ============================================================================
   KAIROS BACKEND CLIENT  (frontend shim)  v6.4

   One place for the app to:
     • route live Tradier calls through the Worker proxy (token stays server-side)
     • read the server-accumulated history (regime / IV / field) on load
     • pull the server's Nova analysis + cached ladders via /bootstrap
     • push + read the ideas journal, and publish the plays board
     • publish this device's roster so the Worker can scope Nova to it

   Load AFTER kairos-core.js.
   ============================================================================ */
(function () {
  'use strict';

  // Deployed Worker origin, no trailing slash.
  const BACKEND = 'https://kairos-api.safihelal.workers.dev';

  const api = (path) => BACKEND + path;

  /* Every read gets a timeout. Without one, a request that a browser shield
     silently stalls (rather than rejecting) leaves the caller awaiting forever,
     which is one of the ways a single cold load used to strand Nova for a whole
     session with no error to show for it. */
  async function getJSON(path, ms) {
    const ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), ms || 12000) : null;
    try {
      const r = await fetch(api(path), ctl ? { signal: ctl.signal } : undefined);
      if (!r.ok) throw new Error('backend ' + r.status);
      return await r.json();
    } finally { if (timer) clearTimeout(timer); }
  }

  const KairosBackend = {
    enabled: /^https:\/\/[a-z0-9.-]+/i.test(BACKEND) && !BACKEND.includes('YOUR-SUBDOMAIN'),
    base: BACKEND,

    // ---- live proxy: use in place of a direct Tradier fetch ----
    proxy(tradierPath) { return getJSON('/proxy' + tradierPath); },

    // ---- accumulated history ----
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

    // bootstrap carries the ladders, Nova's analysis, and the plays board.
    // 20s ceiling: it is the largest single response the app asks for.
    bootstrap() { return getJSON('/bootstrap', 20000); },
    getChain(sym) { return getJSON('/chain?sym=' + encodeURIComponent(sym)); },
    mythos() { return getJSON('/mythos'); },

    // ---- roster: the Pantheon tickers, shared server-side ----
    roster() { return getJSON('/roster'); },
    async setRoster(tickers) {
      try {
        const r = await fetch(api('/roster'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tickers: tickers }),
        });
        return r.ok;
      } catch (e) { return false; }
    },

    async publishPlays(html, profile, tab, count) {
      try {
        const r = await fetch(api('/plays'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html, profile, tab, count }) });
        return r.ok;
      } catch (e) { return false; }
    },

    async health() { try { return await getJSON('/health', 8000); } catch (e) { return { ok: false, error: String(e) }; } },
    async diag() { try { return await getJSON('/diag', 15000); } catch (e) { return { ok: false, error: String(e) }; } },

    // ---- hydration: pull server-accumulated history into the app on load ----
    async hydrateRegime(sym) {
      try {
        const d = await this.regime(sym);
        if (!d.series || !d.series.length) return 0;
        const ser = d.series.map(r => ({
          t: r.t, spot: r.spot, cpr: r.cpr, ppr: r.ppr,
          cbought: r.c_bought, csold: r.c_sold, pbought: r.p_bought, psold: r.p_sold,
          ndf: (r.ndf != null ? r.ndf : null),
        }));
        const cur = window.Kairos.state.regSeries[sym] || [];
        const seen = new Set(cur.map(p => p.t));
        ser.forEach(p => { if (!seen.has(p.t)) cur.push(p); });
        cur.sort((a, b) => a.t - b.t);
        window.Kairos.state.regSeries[sym] = cur;
        return cur.length;
      } catch (e) { return 0; }
    },
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
    async fieldColumns(sym, session) {
      try {
        const d = await this.field(sym, session);
        return d.columns || [];
      } catch (e) { return []; }
    },
  };

  window.KairosBackend = KairosBackend;
  if (KairosBackend.enabled) {
    KairosBackend.health().then(h => console.log('%cKairos Backend ' + (h.ok ? 'connected' : 'unreachable') + (h.lastCron ? ' \u00b7 last cron ' + new Date(h.lastCron * 1000).toLocaleTimeString() : ''), 'color:#22d3ee;font-weight:bold'));
  }
})();
