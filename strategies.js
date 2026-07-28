/* ============================================================
   THE TRADING DESK — STRATEGY PLAYBOOK DATA
   Add an entry:
     {id, n:name, alias, fam:'intraday|swing|position|core',
      grade:'A|B|C|D', gradeNote, hold:[minMinutes,maxMinutes],
      tf, market, risk:1-3, thesis, rules:[], entry, stop, target,
      size, evidence, cite:[{t,u}], fails, trap, claim}

   GRADE = how strong the public evidence is, not how good the trade is.
     A — published, peer-reviewed or working-paper research on real data
     B — published backtest with disclosed rules, not peer-reviewed
     C — broker / industry / vendor data, or strong theory + weak testing
     D — community claim, popular on social, no verifiable testing

   hold[] is in MINUTES and feeds the horizon rail
   (1 trading day = 390 min, 1 week = 1,950, 1 month = 8,190, 1 yr = 98,280)
   ============================================================ */
window.TDESK = window.TDESK || {};

window.TDESK.STRAT_FAMS = [
  ['all',      'All'],
  ['intraday', 'Intraday'],
  ['swing',    'Swing'],
  ['position', 'Position'],
  ['core',     'Long-term core']
];

window.TDESK.STRAT_GRADES = {
  A:['Peer-reviewed / research paper','var(--green)'],
  B:['Published backtest','var(--cyan)'],
  C:['Industry data / weak testing','var(--gold)'],
  D:['Community claim, unverified','var(--red)']
};

window.TDESK.STRATEGIES = [

/* ================= INTRADAY ================= */
{
  id:'orb', n:'Opening Range Breakout', alias:'ORB · Initial Balance break',
  fam:'intraday', grade:'A', hold:[15,390], risk:3,
  tf:'5-min range, 1–5 min execution', market:'SPY · QQQ · ES/NQ · high-RVOL single names',
  gradeNote:'Tested on thousands of US equities across multiple years in published research.',
  thesis:'The first minutes of the session are where overnight news, gaps and institutional repositioning get priced. If that first push is abnormally large relative to the stock\u2019s own history, the imbalance behind it usually isn\u2019t finished — the opening range becomes a decision line the rest of the day trades around.',
  rules:[
    'Mark the high and low of the first 5 minutes (some traders use 15 or 30; the research favours 5).',
    'Only trade names that are actually in play — relative volume well above their own average, usually on a catalyst.',
    'Direction is set by the opening candle: above the range you only take longs, below it only shorts.',
    'Enter on the break of the range in that direction, not on the retest fantasy.',
    'Size from ATR so a 14-day-range stock and a quiet one risk the same dollars.',
    'Flat by the close. This is a session trade, not a swing.'
  ],
  entry:'Break of the 5-minute range in the direction of the opening drive.',
  stop:'Opposite side of the opening range, or an ATR-scaled distance — whichever is tighter.',
  target:'Trail with VWAP or a short EMA and exit at the bell. Fixed 1R–2R targets cap the outlier days that pay for the strategy.',
  size:'Risk a fixed % of account, converted to shares by ATR. Never by "feel".',
  evidence:'This is the rare retail setup with real research behind it. Zarattini, Barbon and Aziz tested a 5-minute ORB across a large US equity universe and found the edge comes almost entirely from restricting it to "stocks in play" — names with abnormal opening volume. A public QuantConnect replication of that work reported a Sharpe above 2 with near-zero beta to the market. Two honest caveats: the headline returns assume leverage and clean fills, and independent reviewers have flagged that the results look strong enough to warrant your own testing before trusting them.',
  cite:[
    {t:'Zarattini, Barbon & Aziz — ORB research (Concretum papers)', u:'https://concretumgroup.com/papers/'},
    {t:'QuantConnect — public replication, ORB for stocks in play', u:'https://www.quantconnect.com/research/18444/opening-range-breakout-for-stocks-in-play/'},
    {t:'Independent paper review — where the results look too clean', u:'https://quantmacro.substack.com/p/paper-review-an-effective-intraday'}
  ],
  fails:'Rangebound, low-volume, no-catalyst mornings. Without the relative-volume filter the unfiltered version has degraded badly — the filter is not an optimisation, it is the strategy.',
  trap:'Trading the opening range on any ticker you happen to have on screen. The edge lives in the selection, not the pattern.',
  claim:'Widely posted on X with 70–80% win-rate claims. The research measures expectancy, not win rate — those are not the same thing.'
},
{
  id:'sweep', n:'Liquidity Sweep + Fair Value Gap', alias:'ICT / Smart Money Concepts',
  fam:'intraday', grade:'D', hold:[20,390], risk:3,
  tf:'5–15 min execution, 1H/4H bias', market:'ES/NQ · FX majors · BTC · index ETFs',
  gradeNote:'Enormously popular, almost entirely untested outside vendor blogs and course material.',
  thesis:'Stops cluster in obvious places — above yesterday\u2019s high, below the overnight low. The argument is that price runs those pockets to fill size, then reverses, and the fast move away leaves an unfilled gap between candle wicks that price returns to before continuing.',
  rules:[
    'Set higher-timeframe direction first, on the 1H or 4H. This is the part most people skip.',
    'Wait for a sweep of a known liquidity pool — prior session high/low, equal highs, the overnight extreme.',
    'Require a displacement candle back through the swept level, not a slow drift.',
    'Mark the three-candle imbalance (fair value gap) left by that move.',
    'Enter on the retrace into that gap, in the direction of your higher-timeframe bias only.',
    'Target the opposing liquidity pool — the next obvious cluster of stops.'
  ],
  entry:'Limit order into the fair value gap after the sweep and displacement.',
  stop:'Beyond the sweep wick. If the wick is huge, the trade is too expensive — pass it.',
  target:'Opposing liquidity. Realistic 2–3R when higher-timeframe bias agrees.',
  size:'Fixed fractional. The stop distance varies wildly here, so size must vary with it.',
  evidence:'Be honest about what this is: there is no peer-reviewed literature supporting smart-money concepts as a standalone edge. What exists is vendor backtests, prop-firm marketing and community screenshots — sources with an obvious interest in the answer. The underlying mechanics are not fake: stop clustering around obvious levels and mean reversion into gaps are both well documented in market-microstructure work. The leap from "imbalances exist" to "this specific entry has an edge" is the part nobody has verified in public.',
  cite:[
    {t:'Overview of the framework and its origins (educational)', u:'https://tradeforgood.com.au/learn/fvg/'},
    {t:'A community backtest — read it as a claim, not a finding', u:'https://medium.com/@QuantumAlgo/i-backtested-2-600-trades-using-smart-money-concepts-heres-what-actually-works-bb3c671098c6'}
  ],
  fails:'Trending sessions with no clean sweeps, and any chart where you can draw a fair value gap every few candles — which is most charts on a low enough timeframe.',
  trap:'The vocabulary is so flexible that every move can be explained after the fact. If a framework can never be wrong in hindsight, it can never be tested — and if it can never be tested, you do not know whether you have an edge or a habit.',
  claim:'One of the most-posted "simple high-probability" setups on X through 2025–2026. Popularity is not evidence.'
},
{
  id:'zdte', n:'0DTE Defined-Risk Premium Selling', alias:'Credit spreads · iron condors · GEX-aware',
  fam:'intraday', grade:'B', hold:[60,390], risk:3,
  tf:'Same-day expiry', market:'SPX / SPXW · XSP · SPY',
  gradeNote:'The premium being harvested is real and measurable. Retail results on 0DTE are documented and bad.',
  thesis:'Implied volatility usually prices a bigger move than the market delivers. Selling a defined-risk spread collects that difference. On same-day expiry the decay is violent in your favour — and just as violent against you, because gamma is at its maximum and there is no time left to recover from being wrong.',
  rules:[
    'Defined risk only. Verticals, condors or butterflies — never a naked short leg.',
    'Wait for the opening auction to settle. The first stretch of the session is the worst pricing of the day.',
    'Place short strikes outside the day\u2019s expected move, and where dealer gamma argues price is likely to be pinned rather than pushed.',
    'Take profit mechanically at 50–80% of the credit. Holding for the last few cents is where the account dies.',
    'Cut losers at a pre-set multiple of the credit. No adjusting, no rolling for a "scratch".',
    'One structure per day, with a hard daily loss limit.'
  ],
  entry:'After the open settles, with IV elevated relative to what the tape is actually delivering.',
  stop:'A fixed multiple of credit received, decided before entry.',
  target:'50–80% of max credit. Mechanical.',
  size:'Max loss on the structure — not the credit — is what you size against. Keep total short-vol exposure small enough that a gap day is survivable.',
  evidence:'Two findings sit side by side. First, the volatility risk premium is real: on the S&P, implied has exceeded realised in the large majority of rolling windows for decades, which is why premium selling works at all. Second, retail traders as a group lose money in 0DTE. Beckmeyer, Branger and Gayda found retail losses averaging around $350,000 a day across the market after daily SPX expiries launched, driven largely by costs — while noting that short positions, unlike long ones, were profitable on average. Bogousslavsky and Muravyev found 0DTE trades underperform other option trades by several percentage points. Cboe researchers have pushed back on parts of the retail-loss literature, so treat the size of the effect as contested, not the direction.',
  cite:[
    {t:'Beckmeyer, Branger & Gayda — Retail Traders Love 0DTE Options… But Should They?', u:'https://papers.ssrn.com/sol3/Delivery.cfm/4404704.pdf?abstractid=4404704&mirid=1'},
    {t:'Bogousslavsky & Muravyev — An Anatomy of Retail Option Trading', u:'https://www.lsu.edu/business/files/event-files/2025-finance-mardi-gras/retail_option_trading_v2.pdf'},
    {t:'Cboe — New Evidence on the Performance of Customer Options Trades', u:'https://cdn.cboe.com/resources/education/research_publications/Retail_Profitability.pdf'}
  ],
  fails:'Trend days and negative-gamma regimes, where dealer hedging amplifies the move instead of dampening it. One breached short strike near the close can erase a month of credits.',
  trap:'A high win rate with an unfavourable payoff is not an edge. Selling a $1.00 credit against $9.00 of risk needs to win about nine times out of ten just to break even — before costs.',
  claim:'Frequently described as the "consistent" way to trade 0DTE versus buying it. The consistency is in the win rate; the risk lives in the tail.'
},
{
  id:'emapull', n:'Trend Pullback to a Short EMA', alias:'9/21 EMA continuation',
  fam:'intraday', grade:'C', hold:[10,240], risk:2,
  tf:'1–5 min', market:'Index futures · liquid ETFs · large-cap single names',
  gradeNote:'The parent idea — trends persist — is well documented. This specific intraday version mostly is not.',
  thesis:'When a session is genuinely trending, pullbacks are supply and demand rebalancing rather than the trend ending. A short moving average gives you a repeatable, unambiguous place to buy that rebalance instead of chasing the extension.',
  rules:[
    'Confirm a real trend first: higher highs and higher lows, price holding one side of VWAP, a directional open.',
    'Wait for a pullback that loses volume as it goes. Heavy-volume pullbacks are distribution, not rest.',
    'Enter on the touch or reclaim of the 9 or 21 EMA in the direction of the trend.',
    'Stop below the pullback swing or the far side of the EMA — whichever is structurally cleaner.',
    'Scale out into the prior extension and trail the rest with the EMA.',
    'Stop taking entries once the trend has already extended several legs.'
  ],
  entry:'Reclaim of the short EMA after a low-volume pullback.',
  stop:'Under the pullback swing low (or above the swing high, short side).',
  target:'Prior extension first, then trail. Most of the money is in the third leg you were tempted to skip.',
  size:'Fixed fractional, ATR-adjusted.',
  evidence:'There is deep academic support for trend persistence across horizons — Moskowitz, Ooi and Pedersen documented time-series momentum across 58 futures markets, positive in every single contract they tested. That work runs on monthly data, not five-minute bars. Treat the intraday version as a plausible child of a real effect rather than a proven strategy, and demand your own sample before sizing up.',
  cite:[
    {t:'Moskowitz, Ooi & Pedersen — Time Series Momentum (JFE)', u:'https://www.sciencedirect.com/science/article/pii/S0304405X11002613'},
    {t:'AQR — Time Series Momentum, summary and data', u:'https://www.aqr.com/Insights/Research/Journal-Article/Time-Series-Momentum'}
  ],
  fails:'Chop. In a range, a short EMA gets touched constantly and every touch looks like a signal — this is how a good trend tool bleeds an account sideways.',
  trap:'Treating the EMA as the setup. The EMA is only a timing tool; the trend is the setup. No trend, no trade, no exceptions.',
  claim:'Shared constantly as a high-win-rate approach. It is high win rate in trends and a slow bleed in everything else — and most sessions are everything else.'
},
{
  id:'rvol', n:'Relative Volume Momentum', alias:'Stocks in play · price action at levels',
  fam:'intraday', grade:'B', hold:[5,180], risk:3,
  tf:'1–5 min', market:'Catalyst-driven single names, small and mid cap',
  gradeNote:'The relative-volume filter is the same one that carries the ORB research.',
  thesis:'Almost all intraday opportunity concentrates in a handful of names each day — the ones with a real catalyst pulling in volume far above their own normal. Everything else is noise with a spread attached.',
  rules:[
    'Screen pre-market for relative volume, gap size and an identifiable catalyst: earnings, guidance, FDA, M&A, index changes.',
    'Build the level map before the bell: pre-market high and low, prior day high and low, VWAP.',
    'Trade the reaction at those levels — breakout with volume expansion, or rejection wick with volume climax.',
    'Stops go on the other side of the level, not at a dollar amount you invented.',
    'Scale out into the next level rather than holding for a home run.',
    'When relative volume decays, the name is done — stop trading it for the day.'
  ],
  entry:'Volume-confirmed break or rejection at a mapped level.',
  stop:'Other side of the level. If that is too far, the trade is not available at a price you can afford.',
  target:'Next mapped level, scaled.',
  size:'Smaller than feels right. These names move fast and spreads widen exactly when you need out.',
  evidence:'The strongest support here is indirect but powerful: the published ORB work found that restricting day trading to high-relative-volume names is what turns a mediocre intraday strategy into a profitable one. The filter carries the result. Set against that, the population-level data on day trading is brutal — in a full-market Taiwan study, day traders lost on average net of fees and predictably profitable traders were a low single-digit share of participants.',
  cite:[
    {t:'QuantifiedStrategies — summary of the stocks-in-play research', u:'https://www.quantifiedstrategies.com/stocks-in-play-trading-strategy-day-trading/'},
    {t:'Barber, Lee, Liu, Odean & Zhang — Learning, Fast or Slow (summary)', u:'https://www.tradicted.com/research/barber-learning-2020/'}
  ],
  fails:'Low-float names where the spread and the halts eat the edge, and any day where nothing has a real catalyst — on those days the correct trade is none.',
  trap:'Confusing volatility with opportunity. A stock moving 20% with a 3% spread is not tradable, it is a slot machine with fees.',
  claim:'Classic and still heavily used. The screening is 90% of it; the entry pattern is the last 10%.'
},

/* ================= SWING / POSITION ================= */
{
  id:'basebreak', n:'Base Breakout Swing', alias:'Tight consolidation after a strong move',
  fam:'swing', grade:'C', hold:[1950,24570], risk:2,
  tf:'Daily chart, weekly context', market:'Momentum leaders · liquid single names · sector ETFs',
  gradeNote:'Strong overlap with the documented momentum factor; the specific base rules are practitioner lore.',
  thesis:'A stock that has already moved hard and then goes quiet is not resting by accident — supply is being absorbed at a higher price. The tighter and shorter that pause, the more it says about who is still willing to sell.',
  rules:[
    'Start with names that have already outperformed — a large move over recent months, not a bounce off the lows.',
    'Require a tight base: depth under roughly 10–20%, ideally shallower, with contracting range and drying volume.',
    'Enter on the breakout from the base, with volume expansion on the break day.',
    'Stop under the base. If that is more than you are willing to risk, the position is too big — not the stop too tight.',
    'Trail with a medium EMA (21 is common) once the trade is working.',
    'Only take these while the broader index is above its 200-day. Breakouts fail in bulk under a falling market.'
  ],
  entry:'Break of base highs on expanding volume.',
  stop:'Below the base low.',
  target:'Trail. Cutting winners at a fixed multiple is how this strategy stops working.',
  size:'Risk-based off the base depth — a deeper base means a smaller position, not a wider mental stop.',
  evidence:'The cross-sectional momentum effect this trades on is one of the most replicated anomalies in finance, documented across decades and markets. The specific base-tightness rules, though, come from practitioner tradition rather than published testing. The market-regime filter is the part with the best support: momentum strategies suffer their worst drawdowns during sharp reversals off market lows.',
  cite:[
    {t:'Time-series and cross-sectional momentum — the evidence base', u:'https://alphaarchitect.com/time-series-momentum-aka-trend-following-the-historical-evidence/'}
  ],
  fails:'Choppy, mean-reverting markets and index drawdowns, where breakouts reverse back into the base within days.',
  trap:'Buying the third or fourth base of an extended run. Late bases fail far more often than early ones, and they look identical on the chart.',
  claim:'Frequently posted as the bridge between day trading and investing. It is genuinely that — with the drawdowns of both.'
},
{
  id:'rsmom', n:'Systematic Relative Strength Portfolio', alias:'Rules-based momentum rotation',
  fam:'position', grade:'A', hold:[8190,98280], risk:2,
  tf:'Monthly rebalance, daily maintenance', market:'Liquid US equities · sector ETFs',
  gradeNote:'One of the most replicated anomalies in the academic literature.',
  thesis:'Assets that have outperformed over the last 3–12 months tend to keep outperforming over the next month or so. It is not a prediction about any single company — it is a statistical tendency you harvest across a basket, or not at all.',
  rules:[
    'Define the universe first: the most liquid several hundred names, or a fixed set of sector ETFs.',
    'Rank by trailing return over a blended lookback — commonly 3, 6 and 12 months, skipping the most recent week or two.',
    'Hold the top slice diversified across roughly 15–25 positions. Concentration turns a statistical edge into a coin flip.',
    'Rebalance on a fixed schedule. Not when you feel like it.',
    'Gate the whole thing on a market filter — only take new long exposure while the index is above its 200-day.',
    'Use wide trailing stops or none at all. Tight stops destroy this strategy specifically.'
  ],
  entry:'Scheduled rebalance into the top-ranked names, market filter permitting.',
  stop:'Position-level trailing stops are optional; the rebalance is the real exit.',
  target:'None. You hold until a name drops out of the ranking.',
  size:'Equal weight, or volatility-scaled so a wild name and a sleepy one contribute similar risk.',
  evidence:'Momentum has survived more out-of-sample testing than almost any other factor. Moskowitz, Ooi and Pedersen found that trailing 12-month returns predicted future returns positively in every one of 58 futures contracts they tested, across equities, bonds, currencies and commodities, with the effect persisting about a year before partially reversing. AQR extended the work back to 1880 across 67 markets. The catch is well documented too: momentum crashes hard and suddenly at market turning points, which is why the trend filter exists.',
  cite:[
    {t:'Moskowitz, Ooi & Pedersen — Time Series Momentum (JFE)', u:'https://www.sciencedirect.com/science/article/pii/S0304405X11002613'},
    {t:'Hurst, Ooi & Pedersen — A Century of Evidence on Trend-Following', u:'https://alphaarchitect.com/time-series-momentum-aka-trend-following-the-historical-evidence/'},
    {t:'Quantpedia — time series momentum, parameters and results', u:'https://quantpedia.com/strategies/time-series-momentum-effect'}
  ],
  fails:'Sharp V-shaped reversals off a bottom, where yesterday\u2019s losers lead and the ranking has you in exactly the wrong basket.',
  trap:'Running it discretionarily. Skipping a rebalance because a name "looks extended" removes the only thing that made it work — the rules.',
  claim:'Quant-style versions circulate widely on X. The published versions and the posted versions rarely use the same risk controls.'
},
{
  id:'quality', n:'Quality Compounders, Held', alias:'Buy-and-hold durable businesses (or LEAPS on them)',
  fam:'core', grade:'C', hold:[98280,982800], risk:1,
  tf:'Years', market:'Large-cap quality equities',
  gradeNote:'Quality as a factor has real support; the discretionary stock-picking version is much harder to verify.',
  thesis:'A small number of businesses compound capital at high rates for a long time. Owning those through cycles — rather than trading around them — captures the whole curve, and most of the return arrives in a handful of years you cannot identify in advance.',
  rules:[
    'Screen for durability first: pricing power, returns on capital that stay high, a balance sheet that survives a bad year.',
    'Add during fear — market-wide drawdowns or company-specific noise that does not touch the thesis.',
    'Write the thesis down, including what would falsify it. Sell on falsification, not on price.',
    'Size so that being wrong about one name is survivable.',
    'If you use LEAPS for leverage, treat the premium as fully at risk and give the thesis more time than you think it needs.',
    'Review on a schedule, not on a headline.'
  ],
  entry:'Scaled in on weakness, over time.',
  stop:'Thesis-based. A price stop on a multi-year hold guarantees you get shaken out of the winners.',
  target:'None. The exit is deterioration of the business, not a number.',
  size:'Position limits per name. Conviction is not a risk-management system.',
  evidence:'Profitability and quality metrics have shown a persistent return premium in factor research. The uncomfortable counterweight: SPIVA data shows roughly 79% of active US large-cap funds underperformed the S&P 500 in 2025, and around 90%+ underperformed over 20 years. These are full-time professionals doing exactly this work. That does not make it impossible — it does mean the honest default for most people is the index, with stock picking as the small satellite.',
  cite:[
    {t:'S&P Dow Jones Indices — SPIVA U.S. Scorecard, year-end 2025', u:'https://www.marketsgroup.org/strategic-insights/spiva-u-s-scorecard'},
    {t:'SPIVA long-horizon results by category', u:'https://www.ifa.com/articles/spiva-report-active-vs-passive'}
  ],
  fails:'Multiple compression. A great business bought at a terrible price can go nowhere for a decade while earnings grow.',
  trap:'Confusing a story you like with a business that compounds. The narrative is free; the cash flows are the test.',
  claim:'Constantly held up on X as the real path to wealth versus day trading. The examples shown are always the survivors.'
},
{
  id:'value', n:'Value With a Margin of Safety', alias:'Buy the discount, wait',
  fam:'core', grade:'B', hold:[98280,982800], risk:1,
  tf:'Years', market:'Equities, occasionally credit',
  gradeNote:'The value premium is heavily documented — and has gone through brutal multi-year droughts.',
  thesis:'Price and value separate when a business is boring, misunderstood or temporarily impaired. Buying meaningfully below a defensible estimate of worth gives you two ways to win — the gap closing, and the business growing — and one cushion if you are wrong.',
  rules:[
    'Estimate value independently before looking at the price. Anchoring is the whole game.',
    'Require a real discount, not a rounding error. The margin of safety is the strategy.',
    'Verify the balance sheet survives the bad case. Cheap plus leveraged is how permanent losses happen.',
    'Diversify across enough names that a couple of value traps do not sink the portfolio.',
    'No leverage, no options in the pure version. Time is the mechanism, and leverage takes time away from you.',
    'Do nothing far more often than you do something.'
  ],
  entry:'Scaled purchases below your estimate of intrinsic value.',
  stop:'None in the pure version — a falling price is the premise, not the alarm.',
  target:'Sell into fair value, or when the thesis breaks.',
  size:'Position limits, always. Value traps are unusually convincing on the way down.',
  evidence:'The value premium is one of the original documented anomalies and shows up across decades and international markets. It also spent much of the 2010s underperforming badly enough that serious people declared it dead before it recovered. That is the real lesson: the edge is real and the drought can be longer than most people\u2019s patience or career.',
  cite:[
    {t:'SPIVA — how professional active management actually fares', u:'https://www.marketsgroup.org/strategic-insights/spiva-u-s-scorecard'}
  ],
  fails:'Structurally declining industries, where cheap keeps getting cheaper because the business really is worth less every year.',
  trap:'Mistaking a low multiple for a discount. The multiple is the question, not the answer.',
  claim:'Still endorsed everywhere as the disciplined path. Inactivity being an edge is genuinely true and almost impossible to sit through.'
},
{
  id:'dca', n:'Scheduled Buying Into Broad Index Funds', alias:'DCA into total-market or S&P 500 ETFs',
  fam:'core', grade:'A', hold:[491400,2948400], risk:1,
  tf:'Decades', market:'Broad low-cost index ETFs',
  gradeNote:'The most thoroughly documented approach on this page, by a wide margin.',
  thesis:'You are not trying to beat anything. You are buying the whole market at a fixed interval, refusing to make timing decisions, and letting decades and low costs do the work that skill cannot reliably do.',
  rules:[
    'Pick one or two broad, low-cost funds. Total market or S&P 500. Stop researching.',
    'Automate a fixed amount on a fixed schedule so no decision is ever required.',
    'Do not stop during declines. Declines are when the schedule is doing its best work.',
    'Reinvest distributions.',
    'Rebalance across stocks and bonds once a year, and otherwise leave it alone.',
    'Measure in decades. Checking the balance weekly is a behavioural cost with no upside.'
  ],
  entry:'The same date every month, regardless of the news.',
  stop:'None.',
  target:'A date, not a price.',
  size:'What you can sustain through a bad year without stopping.',
  evidence:'Two findings worth holding at once. First, this beats most professionals: SPIVA reports about 79% of active US large-cap funds trailed the S&P 500 in 2025, with underperformance rates rising the longer the horizon. Second, a nuance most people get backwards — Vanguard\u2019s research across US, UK and Australian markets found that investing a lump sum immediately beat spreading it out roughly 68% of the time, simply because markets rise more often than they fall. Scheduled buying is the right answer for income you receive over time; it is not automatically superior to investing money you already have.',
  cite:[
    {t:'S&P Dow Jones Indices — SPIVA U.S. Scorecard, year-end 2025', u:'https://www.marketsgroup.org/strategic-insights/spiva-u-s-scorecard'},
    {t:'Vanguard research on cost averaging vs. investing immediately (summary)', u:'https://www.investing.com/analysis/us-dollarcost-averaging-vs-lumpsum-investing-why-safer-strategy-underperforms-200673577'}
  ],
  fails:'It does not fail so much as it tests you — long flat stretches and deep drawdowns where stopping feels like risk management and is actually the only real mistake available.',
  trap:'Interrupting the schedule to wait for a better price. That is market timing wearing a discipline costume.',
  claim:'The most recommended approach anywhere, and the least exciting. Those two facts are related.'
}
];

/* ---- Cross-cutting: what the data says actually decides outcomes ---- */
window.TDESK.STRAT_TRUTHS = [
  ['The base rate is the first fact','In a full-population Taiwan study spanning 1992–2006, day traders lost money on average net of fees, and the reliably profitable group was a low single-digit share of participants. A Brazilian study of everyone who started day trading index futures found that among those who persisted past 300 sessions, 97% lost money.','Assume you are in the majority until your own records say otherwise.'],
  ['Process beats setup','Position sizing, a daily loss limit, one primary setup, and a journal show up in nearly every credible account of consistency — and in the academic work, costs and overtrading explain more of the damage than strategy selection ever does.','The setup is maybe 20% of the outcome.'],
  ['Short-term edges are regime-dependent','Breakout strategies need trends and volume. Premium selling needs the range to hold. Momentum needs no sharp reversal. Every short-horizon edge on this page has a market state where it stops working.','Know which regime you are in, or you are guessing.'],
  ['Social proof is not evidence','Posted win rates are self-selected, unaudited and survivorship-biased. The accounts that blew up do not post the screenshot.','Verify against your own data before sizing up.']
];
