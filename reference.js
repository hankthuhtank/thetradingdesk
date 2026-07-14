/* ============================================================
   THE TRADING DESK — REFERENCE DATA
   Futures specs, the learning path, and the live-heatmap basket.
   Everything here is static reference; edit freely.
   ============================================================ */
window.TDESK = window.TDESK || {};

/* ---- Futures contract specs (for the Futures Spec Sheet tool) ---- */
window.TDESK.FUTURES = [
  {sym:'ES', name:'E-mini S&P 500',    grp:'Index',  mult:'$50 / pt',   tick:'0.25 = $12.50', micro:'MES ($5/pt)',  hrs:'Sun 6pm\u2013Fri 5pm ET'},
  {sym:'NQ', name:'E-mini Nasdaq 100', grp:'Index',  mult:'$20 / pt',   tick:'0.25 = $5.00',  micro:'MNQ ($2/pt)',  hrs:'Sun 6pm\u2013Fri 5pm ET'},
  {sym:'YM', name:'E-mini Dow',        grp:'Index',  mult:'$5 / pt',    tick:'1 = $5.00',     micro:'MYM ($0.50/pt)',hrs:'Sun 6pm\u2013Fri 5pm ET'},
  {sym:'RTY',name:'E-mini Russell 2000',grp:'Index', mult:'$50 / pt',   tick:'0.10 = $5.00',  micro:'M2K ($5/pt)',  hrs:'Sun 6pm\u2013Fri 5pm ET'},
  {sym:'CL', name:'Crude Oil (WTI)',   grp:'Energy', mult:'$1000 / pt', tick:'0.01 = $10.00', micro:'MCL ($100/pt)',hrs:'Sun 6pm\u2013Fri 5pm ET'},
  {sym:'NG', name:'Natural Gas',       grp:'Energy', mult:'$10000 / pt',tick:'0.001 = $10.00',micro:'\u2014',        hrs:'Sun 6pm\u2013Fri 5pm ET'},
  {sym:'GC', name:'Gold',              grp:'Metal',  mult:'$100 / oz',  tick:'0.10 = $10.00', micro:'MGC ($10/oz)', hrs:'Sun 6pm\u2013Fri 5pm ET'},
  {sym:'SI', name:'Silver',            grp:'Metal',  mult:'$5000 / pt', tick:'0.005 = $25.00',micro:'SIL (1000oz)', hrs:'Sun 6pm\u2013Fri 5pm ET'},
  {sym:'ZB', name:'30-Year T-Bond',    grp:'Rates',  mult:'$1000 / pt', tick:'1/32 = $31.25', micro:'\u2014',        hrs:'Sun 6pm\u2013Fri 5pm ET'},
  {sym:'6E', name:'Euro FX',           grp:'FX',     mult:'$125000',    tick:'0.00005 = $6.25',micro:'M6E',         hrs:'Sun 6pm\u2013Fri 5pm ET'},
  {sym:'ZC', name:'Corn',              grp:'Ag',     mult:'$50 / pt',   tick:'1/4\u00a2 = $12.50',micro:'\u2014',      hrs:'Sun 7pm\u2013Fri, day breaks'},
  {sym:'BTC',name:'Bitcoin Futures',   grp:'Crypto', mult:'$5 / pt',    tick:'5 = $25.00',    micro:'MBT ($0.10/pt)',hrs:'Sun 6pm\u2013Fri 5pm ET'}
];

/* ---- Live heatmap basket: sector SPDR ETFs (Finnhub quotes) ---- */
window.TDESK.SECTORS = [
  {sym:'XLK', name:'Technology'},
  {sym:'XLF', name:'Financials'},
  {sym:'XLY', name:'Consumer Disc.'},
  {sym:'XLC', name:'Communications'},
  {sym:'XLV', name:'Health Care'},
  {sym:'XLI', name:'Industrials'},
  {sym:'XLP', name:'Cons. Staples'},
  {sym:'XLE', name:'Energy'},
  {sym:'XLU', name:'Utilities'},
  {sym:'XLB', name:'Materials'},
  {sym:'XLRE',name:'Real Estate'},
  {sym:'GLD', name:'Gold'}
];

/* ---- The learning path (a real sequence — order matters) ---- */
window.TDESK.SESSIONS = [
  ['Investing vs. Trading','The real gap between buy-and-hold and short-term trading \u2014 pace, risk, mindset, and which actually fits your goals. Most people lose because they\u2019re playing one game with the other\u2019s rules.','Know which game you\u2019re playing before a dollar moves.'],
  ['What Are Assets?','Stocks, options, futures, forex, and crypto in plain language \u2014 what each instrument really is, how it moves, the leverage hiding inside it, and the risk baked into each one.','Never trade an instrument you can\u2019t explain to someone else.'],
  ['Getting Started','Capital, brokers, and setup \u2014 how much to start with, which platforms fit where you are, funding safely, building your layout, and why months of demo come before dollar one.','Paper first. The market charges full price for skipped steps.'],
  ['Chart Reading','Candlesticks decoded \u2014 open, high, low, close, what red and green actually say about the fight underneath, support and resistance as the spine of everything, and volume as the lie detector.','Support, resistance, volume. Everything else is commentary.'],
  ['Indicators','Moving averages, RSI, MACD, Bollinger Bands \u2014 what each one measures, what it lags, and how to use them as confluence instead of commands.','Indicators describe the past. Structure frames the future.'],
  ['Strategies & Financials','How real strategies get built from repeatable edges \u2014 plus reading earnings, balance sheets, and valuation simply enough to know what moves your market.','A strategy you can\u2019t explain is a coin flip with extra steps.'],
  ['Risk & Psychology','Position sizing as 80% of risk management, stops that don\u2019t move, daily loss limits, and the greed\u2013fear loop that empties accounts faster than any bad strategy.','The market tests your rules daily. Journaling is how you pass.'],
  ['Taxes & Your Plan','The tax basics worth knowing, the records worth keeping, the resources worth trusting \u2014 then everything assembled into your own written trading plan.','If the plan isn\u2019t written down, it doesn\u2019t exist.']
];
