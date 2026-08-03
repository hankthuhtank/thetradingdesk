/* ============================================================
   THE TRADING DESK - THE INSTRUMENT PANEL
   1. IND_SERIES: a fixed, deterministic sample OHLCV series used
      only to draw the bench diagrams. Generated from a seeded LCG
      so it is byte-identical on every load. A teaching diagram,
      never presented as market data.
   2. INDICATORS: each carries what it measures, the settings that
      are actually standard (with the source for each), what it is
      best used for, what it pairs with, the lag, the trap, and the
      origin. Every `sets` entry drives the live diagram, so the
      settings are explorable rather than merely stated.
   ============================================================ */
window.TDESK = window.TDESK || {};

window.TDESK.IND_SERIES = (function(){
  let s = 20250917;
  const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 0.9;
  const drift = i => i < 46 ? 0.30 : i < 92 ? 0.00 : i < 106 ? -0.42 : 0.34;
  const out = []; let c = 100;
  for (let i = 0; i < 160; i++){
    const o = c;
    c = Math.max(40, o + drift(i) + gauss());
    const wick = 0.35 + rnd() * 0.9;
    out.push({o:+o.toFixed(2),
              h:+(Math.max(o,c) + wick*rnd()).toFixed(2),
              l:+(Math.min(o,c) - wick*rnd()).toFixed(2),
              c:+c.toFixed(2),
              v:Math.round(900 + rnd()*700 + Math.abs(c-o)*460)});
  }
  return out;
})();

/* rack groups, ordered by the question they answer */
window.TDESK.IND_CATS = [
  ['level','Where the levels are'],
  ['trend','Which way it is going'],
  ['momo','How hard it is pushing'],
  ['vol','How wide it is swinging'],
  ['volu','Who actually showed up']
];

window.TDESK.INDICATORS = [

{n:'Fibonacci Retracement', cat:'level', viz:'fib', split:false, badge:'61.8', opt:'lab',
 meas:'A ratio ladder laid across one finished swing, marking how deep a pullback has travelled as a fraction of the move before it.',
 sets:[
  {v:'23.6 · 38.2 · 50 · 61.8 · 78.6', t:'the standard ladder', p:{mode:'std'},
   d:'0.618 is any Fibonacci number divided by the next. 0.382 skips one, 0.236 skips two, 0.786 is the square root of 0.618. The 50% line is not a Fibonacci ratio at all: it came through Dow theory and stayed because the middle of a move is a real decision point.'},
  {v:'61.8 to 65', t:'the golden pocket', p:{mode:'pocket'},
   d:'The narrow band most pullback entries cluster in. Deep enough to shake out weak holders, shallow enough that the swing is still intact if it holds.'},
  {v:'127.2 · 161.8 · 261.8', t:'extensions', p:{mode:'ext'},
   d:'Projection targets past the swing rather than retracements inside it. 1.272 is the square root of 1.618, and 1.618 sits 0.618 of a range above the swing high.'}],
 use:'Organising a pullback inside a trend you already identified. The depth itself is the information: shallow says the trend is defended early, deep says both sides are still arguing. The lab below builds the ladder from your own swing.',
 pairs:'A level you already had. A fib line sitting on a prior high, a volume node, or session VWAP is worth something; the same line in open space is not.',
 tf:'Higher timeframe swings beat intraday ones, for the plain reason that more people are looking at them.',
 lag:'None in the arithmetic, and that is the catch: the swing has to be finished before the ladder exists.',
 trap:'Two traders pick two different swings and get two different ladders, then both call theirs "the level". If you are hunting for the swing that drops a line where you already wanted to buy, you have your answer without the tool.',
 origin:'Ratios from the Fibonacci sequence, applied to markets through R.N. Elliott. Batchelor and Ramyar (Cass Business School, 2006) tested Dow retracement ratios against chance and found no significant difference; the Socionomics Institute read the same data the other way.'},

{n:'VWAP and Anchored VWAP', cat:'level', viz:'vwap', split:false, badge:'session',
 meas:'The volume-weighted average price since a chosen starting point.',
 sets:[
  {v:'Session reset', t:'the institutional benchmark', p:{a:'session'},
   d:'Resets each open. This is the number execution desks are graded against, which is most of why price reacts to it at all.'},
  {v:'Anchored to the swing low', t:'average price of the buyers', p:{a:'lo'},
   d:'Started at a chosen bar instead of the open. From a swing low it tracks the average fill of everyone who bought the move.'},
  {v:'Anchored to the swing high', t:'average price of the trapped', p:{a:'hi'},
   d:'From a high, a gap, or a news bar, it tracks the average price of everyone underwater since that event. Reclaiming it is a real change of state.'}],
 use:'Deciding whether buyers or sellers are winning today without needing an opinion. Above session VWAP, buyers are paying up relative to the average fill.',
 pairs:'Relative volume, because VWAP on a dead day is a line nobody is defending. Anchored VWAP pairs naturally with earnings gaps and failed highs.',
 tf:'Intraday for the session version. Anchored VWAP works on daily and weekly charts as an event-based mean.',
 lag:'None in the value, but it gets progressively harder to move as the session stacks volume behind it.',
 trap:'By the last hour VWAP barely moves, so "it will revert to VWAP" becomes a bet against the entire day\u2019s distribution.',
 origin:'An execution benchmark long before it was a chart line. The anchored variant was popularised by Brian Shannon.'},

{n:'Volume Profile', cat:'level', viz:'vprofile', split:false, badge:'70% VA',
 meas:'Volume distributed across price instead of across time, drawn as a sideways histogram of where business actually got done.',
 sets:[
  {v:'Full range · 70% value area', t:'the standard read', p:{n:110,va:.7},
   d:'The point of control is the single price with the most volume. The value area is the band holding 70% of it, a convention inherited from Market Profile.'},
  {v:'Last 30 bars · 70%', t:'recent acceptance', p:{n:30,va:.7},
   d:'A shorter window shows where the market has agreed recently rather than where it agreed months ago.'},
  {v:'Full range · 50% value area', t:'tighter core', p:{n:110,va:.5},
   d:'Narrows the band to the most contested half of the volume, useful when the 70% area is so wide it covers everything.'}],
 use:'Separating prices the market accepted from prices it rejected. High-volume nodes get revisited; low-volume nodes get travelled through fast, which is why moves accelerate across them.',
 pairs:'VWAP and prior-session levels. Point of control plus VWAP plus a prior high is real confluence, unlike three oscillators agreeing with each other.',
 tf:'Anchored to a session, a swing, or a full range. The anchor matters far more than the chart timeframe.',
 lag:'None. It describes what happened rather than calculating on top of it.',
 trap:'The profile is entirely a function of the range you anchor it to. A session profile and a yearly profile will disagree, and both are right about their own window.',
 origin:'Grew out of Market Profile, developed by J. Peter Steidlmayer with the Chicago Board of Trade from the late 1970s.'},

{n:'Pivot Points', cat:'level', viz:'pivots', split:false, badge:'classic',
 meas:'A central pivot plus stacked support and resistance, computed arithmetically from the prior period\u2019s high, low and close.',
 sets:[
  {v:'Classic floor pivots', t:'the pit-era original', p:{m:'classic'},
   d:'P = (H + L + C) / 3, then R1 = 2P \u2212 L and S1 = 2P \u2212 H. The version most desks and most charting defaults still use.'},
  {v:'Fibonacci pivots', t:'ratio-spaced', p:{m:'fib'},
   d:'Same central pivot, but the levels sit at 38.2%, 61.8% and 100% of the prior range instead of the classic arithmetic.'},
  {v:'Camarilla', t:'tight mean-reversion levels', p:{m:'cam'},
   d:'Bands packed much closer to the close, built for fading moves back into the prior range rather than trading breakouts.'}],
 use:'Marking decision points before the open. R1 and S1 get tested constantly; R3 and S3 are outlier days, which makes them better as targets than entries.',
 pairs:'Opening range and relative volume. A pivot break on 0.6 relative volume is not a break.',
 tf:'Daily pivots from the prior session for intraday work, weekly and monthly for swing context.',
 lag:'None. They are fixed before the open, which is most of the appeal.',
 trap:'Arithmetic, not analysis. A pivot with no structure, no volume node and no prior reaction at it is a line a spreadsheet produced.',
 origin:'Floor-trader arithmetic from the pit era. The Camarilla variant is attributed to Nick Scott, 1989.'},

{n:'Moving Averages', cat:'trend', viz:'ma', split:false, badge:'20/50/200',
 meas:'The average close over a window, redrawn every bar. An SMA weights every bar equally; an EMA leans hard on the most recent ones.',
 sets:[
  {v:'20 / 50 SMA', t:'the institutional convention', p:{a:20,b:50,ema:false},
   d:'Part of the 20/50/200 set everyone watches, which is most of why price reacts at these lines at all. The 200-day is the standard regime filter: Connors gated his whole RSI(2) system on price being above it for longs.'},
  {v:'9 / 21 EMA', t:'intraday and short swing', p:{a:9,b:21,ema:true},
   d:'Fast enough to matter inside a session, still smooth enough to have a slope worth reading. The most common pairing on lower timeframes.'},
  {v:'10 / 30 EMA', t:'position trend filter', p:{a:10,b:30,ema:true},
   d:'A middle setting for multi-week holds, where 9/21 whipsaws too often and 50/200 arrives far too late.'}],
 use:'Defining the regime, not timing the entry. Price above a rising long average is the cleanest written definition of "uptrend" anyone has managed, and it works best as a filter on what you are allowed to do.',
 pairs:'ADX, to confirm there is a trend at all. Volume, to confirm a crossover had participation behind it.',
 tf:'Any, but the window must match the holding period. A 200-period average on a 5-minute chart describes the last two days, not the last year.',
 lag:'Roughly half the window. A 50/200 cross arrives long after the move that caused it.',
 trap:'In a range every crossover is a small loss, and no setting fixes that. It only moves where the bleeding happens.',
 origin:'Older than charting software. The 20/50/200 convention was standardised by institutional research desks and has outlived every attempt to optimise it.'},

{n:'MACD', cat:'trend', viz:'macd', split:true, badge:'12/26/9',
 meas:'The distance between a fast and a slow EMA, a signal line on that distance, and a histogram of the gap between the two.',
 sets:[
  {v:'12 / 26 / 9', t:'Appel\u2019s original', p:{f:12,s:26,g:9},
   d:'Built when the trading week and the data were different, never seriously improved on, and now universal enough that the crossovers are partly self-fulfilling.'},
  {v:'5 / 35 / 5', t:'weekly and position', p:{f:5,s:35,g:5},
   d:'A slower pairing popularised for weekly charts. Far fewer signals, far fewer whipsaws, and a much cleaner histogram.'},
  {v:'8 / 21 / 5', t:'intraday', p:{f:8,s:21,g:5},
   d:'Quicker response for a day session, paid for with more false flips. Only worth it with a separate filter deciding whether to trade at all.'}],
 use:'Reading whether momentum is expanding or contracting inside a trend you already identified. The histogram is the useful part; the crossover is the part people over-trade.',
 pairs:'Structure. A divergence at a prior high or a fib level is worth attention; the same divergence in open space is not.',
 tf:'Daily and above is where it behaves. On a 1-minute chart it is an average of an average of noise.',
 lag:'An average of averages, usually the slowest thing on the chart. By the time the histogram flips, a scalp is finished.',
 trap:'Divergence is a warning, not a trade. A strong trend can print three of them on the way up and never turn once.',
 origin:'Gerald Appel, late 1970s. The histogram was added later by Thomas Aspray.'},

{n:'ADX and DMI', cat:'trend', viz:'adx', split:true, badge:'14 · >25',
 meas:'How strongly price is trending on a 0 to 100 scale, deliberately without saying which way. The +DI and \u2212DI lines carry direction.',
 sets:[
  {v:'14 · above 25 trends', t:'Wilder\u2019s original', p:{n:14,t:25},
   d:'Wilder called a strong trend present above 25 and no trend present below 20, leaving a grey zone between the two.'},
  {v:'14 · above 20 trends', t:'the common working line', p:{n:14,t:20},
   d:'Many chartists use 20 as the key level instead. It fires earlier and catches more of the move, at the cost of more false starts.'},
  {v:'7 · above 25', t:'faster, intraday', p:{n:7,t:25},
   d:'Halving the period cuts the lag and roughly doubles the noise. Useful only with a second filter behind it.'}],
 use:'A permission slip. Above the threshold you may use trend tools; below it you should be using range tools instead. Linda Raschke has described ADX under 16 and falling as a range too quiet to trade, which flips her into breakout mode.',
 pairs:'Any trend-following system, sitting in front of it as the on/off switch. Also Keltner Channels, which Raschke noted flag runaway conditions earlier than ADX does.',
 tf:'Works anywhere, most reliable on daily bars.',
 lag:'Fourteen periods of smoothing on an already smoothed range. It confirms trends and never predicts them.',
 trap:'Falling ADX does not mean reverse. It means the trend is resting, which is exactly what a healthy pullback looks like.',
 origin:'J. Welles Wilder, New Concepts in Technical Trading Systems, 1978.'},

{n:'Supertrend', cat:'trend', viz:'supertrend', split:false, badge:'10 · 3',
 meas:'An ATR-scaled band that rides under price in an uptrend and above it in a downtrend, flipping when price closes through it.',
 sets:[
  {v:'ATR 10 · multiplier 3', t:'the platform default', p:{n:10,m:3},
   d:'Wide enough to survive a normal pullback. Every flip still hands back three times the average range before you are out.'},
  {v:'ATR 10 · multiplier 2', t:'tighter trailing stop', p:{n:10,m:2},
   d:'Keeps you closer to price and exits sooner, at the cost of noticeably more flips in anything not trending hard.'},
  {v:'ATR 7 · multiplier 1.5', t:'scalping', p:{n:7,m:1.5},
   d:'Flips constantly. Only defensible on a strongly trending intraday instrument with a separate regime filter in front of it.'}],
 use:'A trailing stop you can see, and a bias flag. The honest use is the band as an exit line rather than the flip as an entry trigger.',
 pairs:'ADX. Supertrend without a trend filter in front of it is a chop machine, because the period and multiplier are the entire strategy hiding in two innocent inputs.',
 tf:'15-minute and above. Below that the ATR is measuring microstructure noise.',
 lag:'One close plus the ATR multiple, so every flip gives back the width of the band.',
 trap:'In a range it flips over and over, and each flip costs a full band width. Optimising the multiplier on past data is how this one gets curve-fit.',
 origin:'Olivier Seban, 2000s.'},

{n:'Ichimoku Cloud', cat:'trend', viz:'ichimoku', split:false, badge:'9/26/52',
 meas:'Five lines carrying trend, momentum and support in one picture, with the cloud projected twenty-six bars into the future.',
 sets:[
  {v:'9 / 26 / 52', t:'Hosoda\u2019s original', p:{a:9,b:26,c:52},
   d:'The numbers come from a Japanese trading week that included Saturday: 26 was roughly one month of six-day weeks, 52 was two.'},
  {v:'7 / 22 / 44', t:'five-day week adaptation', p:{a:7,b:22,c:44},
   d:'The same logic re-derived for a market that trades five days. Everything shifts slightly earlier without changing the structure.'},
  {v:'10 / 30 / 60', t:'round-number variant', p:{a:10,b:30,c:60},
   d:'A common simplification, popular on 24-hour markets where the original week-based reasoning does not apply at all.'}],
 use:'A one-glance regime read: above the cloud, inside it, or below it. Cloud thickness estimates how much work a reversal would have to do.',
 pairs:'Very little. It was designed as a complete system, and bolting three oscillators onto it defeats the point.',
 tf:'Daily and weekly, as intended. It was never built for a five-minute chart.',
 lag:'Deliberate and structural. Two components are shifted forward and one back, so parts of it describe the past on purpose.',
 trap:'Trading the fast-line cross and ignoring the cloud, which is the part carrying the information.',
 origin:'Goichi Hosoda, writing as Ichimoku Sanjin, published 1969 after roughly thirty years of work.'},

{n:'RSI', cat:'momo', viz:'rsi', split:true, badge:'14 · 30/70',
 meas:'Average gains against average losses over the lookback, scaled 0 to 100.',
 sets:[
  {v:'14 · 30 / 70', t:'Wilder\u2019s original', p:{n:14,lo:30,hi:70},
   d:'The default on every platform. It describes momentum honestly and saturates in trends, which is a feature once you stop reading it as an overbought signal.'},
  {v:'2 · 10 / 90', t:'Connors mean reversion', p:{n:2,lo:10,hi:90},
   d:'Larry Connors shortened RSI to two periods with extreme thresholds and gated it on the 200-day: long only above it, entered under RSI 10 (5 for the aggressive version), exited on a close back above the 5-day average. The version with the most published backtesting behind it.'},
  {v:'14 · 40 / 80', t:'trend-shifted band', p:{n:14,lo:40,hi:80},
   d:'In a strong uptrend the working range shifts up and 40 starts behaving like support. Reading the shift in the range is more useful than the overbought line ever was.'},
  {v:'7 · 30 / 70', t:'faster swing', p:{n:7,lo:30,hi:70},
   d:'Halfway to the Connors setting. More signals, more noise, and the thresholds start needing to move with it.'}],
 use:'Two different jobs depending on the setting. At 14 it describes momentum and its range tells you the regime. At 2 it is a pullback trigger inside a trend, which is a completely different tool wearing the same name.',
 pairs:'A long-term moving average as the gate. Connors ran RSI(2) only above the 200-day for longs and only below it for shorts.',
 tf:'Daily for the classic use. The 2-period version was researched on daily bars of stocks and index ETFs, not intraday charts.',
 lag:'Short, but bounded, so it saturates. Once it prints 80 it can sit near 80 for weeks with nothing wrong.',
 trap:'"Overbought" is the most expensive word in retail trading. RSI at 80 inside a real trend is evidence of strength, and shorting it is how accounts die slowly.',
 origin:'Wilder, 1978. The 2-period variant from Larry Connors and Cesar Alvarez, Short Term Trading Strategies That Work, 2008.'},

{n:'Stochastic Oscillator', cat:'momo', viz:'stoch', split:true, badge:'14/3/3',
 meas:'Where the close sits inside the high-low range of the last N periods, as a percentage, plus a smoothed version of itself.',
 sets:[
  {v:'14 / 3 / 3', t:'slow stochastic, the default', p:{n:14,k:3,d:3},
   d:'%K smoothed by 3, then %D as a 3-period average of that. Slow enough to be readable.'},
  {v:'5 / 3 / 3', t:'fast, intraday', p:{n:5,k:3,d:3},
   d:'Reacts almost immediately and crosses constantly. Only usable on an instrument that genuinely rotates.'},
  {v:'21 / 5 / 5', t:'smoothed swing', p:{n:21,k:5,d:5},
   d:'Far fewer crosses and a much cleaner shape for multi-day range work.'}],
 use:'Ranges, specifically. It measures position inside a recent range, so it earns its keep on instruments that rotate rather than trend.',
 pairs:'ADX below the threshold, or a contracting Bollinger width. Both confirm you are in the conditions this tool was built for.',
 tf:'Any, but the instrument matters more than the timeframe. A ranging stock on a daily chart suits it better than a trending one on any chart.',
 lag:'Minimal on %K, a little more on %D. It is fast, which is another way of saying noisy.',
 trap:'It pins near 100 in a trend and stays there, so every cross down reads as a short into strength. Right tool, wrong chart, expensive lesson.',
 origin:'George Lane and colleagues at Investment Educators, 1950s.'},

{n:'Bollinger Bands', cat:'vol', viz:'bb', split:false, badge:'20 · 2.0',
 meas:'A moving average with bands set a number of standard deviations either side. The width is a direct read on realised volatility.',
 sets:[
  {v:'20 periods · 2.0 dev', t:'Bollinger\u2019s default', p:{n:20,s:2},
   d:'He states plainly that 20 or 21 is optimal for most applications and that periods under ten do not work well. In practice roughly 90% of data falls inside, not the 95% a normal distribution would suggest.'},
  {v:'10 periods · 1.9 dev', t:'his scaling rule, shortened', p:{n:10,s:1.9},
   d:'Bollinger rule 11: shorten the average and you must reduce the deviations, from 2 at 20 periods down to 1.9 at 10, or the bands stop containing price consistently.'},
  {v:'50 periods · 2.1 dev', t:'his scaling rule, lengthened', p:{n:50,s:2.1},
   d:'The same rule in the other direction. Lengthen the average and the deviations rise to 2.1 at 50 periods.'}],
 use:'Reading volatility state rather than direction. A squeeze, meaning historically narrow width, flags a compression that usually resolves into an expansion, without saying which way.',
 pairs:'Keltner Channels. Bollinger Bands sitting entirely inside the Keltner Channel is the standard squeeze definition, and the cleanest use of either.',
 tf:'Any, with the caveat about very short periods. The middle band should describe the intermediate trend rather than be tuned for crossovers.',
 lag:'The bands widen after the move that widened them, so they confirm rather than warn.',
 trap:'Bollinger\u2019s own rule 15 says it plainly: a tag of a band is a tag, not a signal. In a trend, price walks the upper band for days.',
 origin:'John Bollinger, early 1980s. His 22 rules are published on bollingerbands.com and are worth reading in full.'},

{n:'ATR', cat:'vol', viz:'atr', split:true, badge:'14',
 meas:'Average true range: the typical distance price covers in a period, gaps included. A price figure, never a direction.',
 sets:[
  {v:'14 periods', t:'Wilder\u2019s original', p:{n:14},
   d:'The default everywhere, and the one most stop-distance conventions are quoted against.'},
  {v:'20 periods', t:'smoother, for sizing', p:{n:20},
   d:'Less reactive to one violent bar, which is what you want when it is feeding a position-size formula.'},
  {v:'5 periods', t:'fast, for intraday stops', p:{n:5},
   d:'Tracks the current session\u2019s character closely and moves around a lot. Useful for a stop that must respect right now.'}],
 use:'Position sizing and stop distance, which is the only place it belongs. Size = risk budget divided by (ATR multiple \u00d7 point value), so the same dollar risk works across instruments that move very differently.',
 pairs:'Everything with a stop in it. ATR is the unit that makes risk comparable between a $9 stock and a $600 one.',
 tf:'Match it to the holding period. An intraday stop built on a daily ATR is several times too wide.',
 lag:'Fourteen periods of averaging, so it reacts after volatility has already changed.',
 trap:'It says nothing about direction and never will. A stop closer than about one ATR sits inside the noise and gets taken out by the instrument simply breathing.',
 origin:'Wilder, 1978, in the same book as RSI and ADX.'},

{n:'Keltner Channels', cat:'vol', viz:'keltner', split:false, badge:'20 · 2×ATR',
 meas:'An EMA with bands set an ATR multiple away, so the envelope tracks true range rather than standard deviation.',
 sets:[
  {v:'20 EMA · 2.0 × ATR(10)', t:'the modern default', p:{e:20,m:2,a:10},
   d:'The Raschke and Colby version most platforms ship. Smoother than Bollinger, because ATR does not spike the way standard deviation does on one wild bar.'},
  {v:'20 EMA · 2.5 × ATR(20)', t:'Raschke\u2019s own', p:{e:20,m:2.5,a:20},
   d:'She describes setting the channel at 2.5 times the 20-day average range around the 20-period EMA, wide enough to contain roughly 95% of price action.'},
  {v:'20 EMA · 1.5 × ATR(10)', t:'tighter, more touches', p:{e:20,m:1.5,a:10},
   d:'More signals and more noise. Worth it only when the instrument is genuinely range-bound.'}],
 use:'Trend filtering and runaway detection. Raschke used the channel to flag conditions where you must not step in front of the move, and noted it warns earlier than ADX because ADX carries more lag.',
 pairs:'Bollinger Bands, for the squeeze. The 20 EMA centre line doubles as the pullback target in a trend, where the first retest usually finds support.',
 tf:'Any. Intraday work usually wants a larger multiplier, because noise rises as the timeframe drops.',
 lag:'Whatever its EMA and ATR inputs carry, which is less jumpy than the Bollinger equivalent.',
 trap:'Stacking it with Bollinger Bands on aesthetics alone. They answer different questions, and running both without knowing which is which just doubles the lines.',
 origin:'Chester Keltner, How To Make Money in Commodities, 1960. The ATR version is Linda Bradford Raschke\u2019s from the 1980s, with the EMA centre line credited to Robert Colby.'},

{n:'Relative Volume', cat:'volu', viz:'rvol', split:true, badge:'20d · 1.5×',
 meas:'Current volume against the average for the same point in the session across a lookback window. A multiple, not a count.',
 sets:[
  {v:'20-day average · 1.5× gate', t:'the standard scan setting', p:{n:20,t:1.5},
   d:'Twenty sessions is long enough to smooth one event day and short enough to reflect the name\u2019s current character.'},
  {v:'10-day average · 2× gate', t:'reactive', p:{n:10,t:2},
   d:'Adapts faster after a change in regime and demands a higher multiple before calling anything unusual.'},
  {v:'50-day average · 1.5× gate', t:'slower baseline', p:{n:50,t:1.5},
   d:'A steadier reference for names whose volume is naturally lumpy around earnings.'}],
 use:'A participation gate you check before the setup, not after. Under 1 nobody has shown up and most patterns fail quietly. Over 2 something changed.',
 pairs:'Breakouts and gaps specifically, which need participation to hold. Also VWAP, since VWAP on a dead day is a line nobody is defending.',
 tf:'Intraday, where the time-of-day comparison is the whole point. Raw volume cannot tell you anything at 9:45.',
 lag:'None, and the time-of-day normalisation makes it usable from the first minutes of the session.',
 trap:'High relative volume with no direction is a fight, not a trend. Volume confirms what price is doing; it never points.',
 origin:'A scanner-era construction rather than a named indicator, standardised by the intraday screening tools of the 2000s.'},

{n:'On-Balance Volume', cat:'volu', viz:'obv', split:true, badge:'cumulative',
 meas:'A running total that adds the period\u2019s volume on an up close and subtracts it on a down close.',
 sets:[
  {v:'Raw cumulative', t:'as Granville built it', p:{n:0},
   d:'No inputs at all. The starting point is arbitrary, so only the shape of the line means anything.'},
  {v:'With a 20-EMA signal', t:'slope made readable', p:{n:20},
   d:'A signal line turns "is it rising" into something you can see, and filters the small daily wobbles.'}],
 use:'Confirmation of a move you already spotted. Slope should agree with price; OBV grinding to higher highs while price stalls is the accumulation read people keep it for.',
 pairs:'Price structure and relative volume. On its own it is a shape without a scale.',
 tf:'Daily and weekly. Intraday resets make the cumulative total close to meaningless.',
 lag:'None in construction, but the arbitrary starting point means there is no absolute reading to interpret.',
 trap:'It treats a one-cent up close exactly like a three percent one. Divergence here is a hint worth a second look, not evidence worth a position.',
 origin:'Joe Granville, Granville\u2019s New Key to Stock Market Profits, 1963.'}

];
