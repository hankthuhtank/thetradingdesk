window.TDESK = window.TDESK || {};

window.TDESK.IND_SERIES = (function () {
  let s = 20250917;
  const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 0.9;
  const drift = (i) => (i < 46 ? 0.3 : i < 92 ? 0.0 : i < 106 ? -0.42 : 0.34);
  const out = [];
  let c = 100;
  for (let i = 0; i < 160; i++) {
    const o = c;
    c = Math.max(40, o + drift(i) + gauss());
    const wick = 0.35 + rnd() * 0.9;
    out.push({
      o: +o.toFixed(2),
      h: +(Math.max(o, c) + wick * rnd()).toFixed(2),
      l: +(Math.min(o, c) - wick * rnd()).toFixed(2),
      c: +c.toFixed(2),
      v: Math.round(900 + rnd() * 700 + Math.abs(c - o) * 460),
    });
  }
  return out;
})();

window.TDESK.IND_CATS = [
  ["level", "Price levels"],
  ["trend", "Trend direction & strength"],
  ["momo", "Momentum"],
  ["vol", "Movement & volatility"],
  ["volu", "Trading activity"],
];

window.TDESK.INDICATORS = [
  {
    n: "Fibonacci Retracement",
    cat: "level",
    viz: "fib",
    split: false,
    badge: "61.8",
    opt: "lab",
    meas: "Percentage markers showing how far price has pulled back within a chosen swing.",
    sets: [
      {
        v: "23.6 · 38.2 · 50 · 61.8 · 78.6",
        t: "common retracement levels",
        p: {
          mode: "std",
        },
        d: "Ratios used to mark pullback depth. The 50% level is a convention, not a Fibonacci ratio.",
      },
      {
        v: "61.8 to 65",
        t: "golden pocket",
        p: {
          mode: "pocket",
        },
        d: "A popular 61.8–65% band. It has no special guarantee of holding.",
      },
      {
        v: "127.2 · 161.8 · 261.8",
        t: "extension targets",
        p: {
          mode: "ext",
        },
        d: "Projects levels beyond the original swing rather than inside the pullback.",
      },
    ],
    use: "Mark possible pullback areas, then compare them with actual price reactions.",
    pairs: "Prior highs and lows, volume, and VWAP.",
    tf: "Any timeframe; choose a clear swing and state its start and end.",
    lag: "The levels are fixed once you choose the swing. Choosing it can involve hindsight.",
    trap: "The ratios do not predict a reversal. Different anchor points produce different levels.",
    origin: "Market-charting application of Fibonacci ratios; anchor selection is subjective.",
    example:
      "A rise from $100 to $120 has a 50% retracement at $110 and a 61.8% retracement near $107.64.",
    related: ["Support & Resistance", "VWAP"],
    source: [
      "Fidelity: Fibonacci Retracement",
      "https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/fibonacci-retracement",
    ],
    diagram:
      "Synthetic sample prices and volume for learning. Changing a setting recalculates the chart; this is not live market data.",
  },
  {
    n: "VWAP and Anchored VWAP",
    cat: "level",
    viz: "vwap",
    split: false,
    badge: "session",
    meas: "An average trading price weighted by volume since a session open or chosen event.",
    sets: [
      {
        v: "Session reset",
        t: "session benchmark",
        p: {
          a: "session",
        },
        d: "Starts at the first displayed sample bar, treated here as the session open.",
      },
      {
        v: "Anchored to the swing low",
        t: "anchor at sample low",
        p: {
          a: "lo",
        },
        d: "Starts the bar-based calculation at the lowest displayed close.",
      },
      {
        v: "Anchored to the swing high",
        t: "anchor at sample high",
        p: {
          a: "hi",
        },
        d: "Starts the calculation at the highest displayed close; it does not identify trapped traders.",
      },
    ],
    use: "Compare current price with a volume-weighted benchmark.",
    pairs: "Relative volume and prior-session levels.",
    tf: "Session VWAP is mainly intraday. An anchor can span many sessions.",
    lag: "It is cumulative and responds more slowly as volume builds.",
    trap: "It is not the average cost of identifiable buyers or trapped traders. Price need not return to it.",
    origin:
      "VWAP is an execution benchmark. Anchored VWAP applies the same idea from a chosen event.",
    example: "100 shares at $10 and 300 at $12 give a VWAP of $11.50.",
    related: ["VWAP", "Volume", "Relative Volume (RVOL)"],
    source: [
      "TradingView: VWAP",
      "https://www.tradingview.com/support/solutions/43000502018-volume-weighted-average-price-vwap/",
    ],
    diagram:
      "Illustration: uses (high + low + close) ÷ 3 for each sample bar, weighted by its volume. The first displayed bar stands in for the open.",
  },
  {
    n: "Volume Profile",
    cat: "level",
    viz: "vprofile",
    split: false,
    badge: "70% VA",
    meas: "A histogram showing how much volume traded at different price levels in a chosen range.",
    sets: [
      {
        v: "Displayed range · 70%",
        t: "70% value area",
        p: {
          n: 100,
          va: 0.7,
        },
        d: "The value area groups about 70% of sampled volume around the busiest price bin.",
      },
      {
        v: "Last 30 bars · 70%",
        t: "recent window",
        p: {
          n: 30,
          va: 0.7,
        },
        d: "Restricts the profile to the last 30 displayed bars.",
      },
      {
        v: "Displayed range · 50%",
        t: "50% value area",
        p: {
          n: 100,
          va: 0.5,
        },
        d: "A narrower area around the busiest bin. The exact calculation can vary by platform.",
      },
    ],
    use: "Locate heavily and lightly traded price areas.",
    pairs: "VWAP and prior highs or lows.",
    tf: "Session, swing, or longer ranges; the selected window matters.",
    lag: "It describes past activity and changes as new volume arrives.",
    trap: "Bin size, data quality, and anchor range change the picture. Heavy volume does not guarantee support.",
    origin:
      "Volume at price differs from Market Profile, which traditionally organises time spent at price.",
    example: "If the $100 bin holds the most volume, it is the point of control for that range.",
    related: ["Volume", "VWAP", "Support & Resistance"],
    source: [
      "TradingView: volume profile",
      "https://www.tradingview.com/support/solutions/43000502040-volume-profile-indicators-basic-concepts/",
    ],
    diagram:
      "Illustration: each sample bar’s volume is placed at its closing price. Real profiles use more detailed volume-at-price data.",
  },
  {
    n: "Pivot Points",
    cat: "level",
    viz: "pivots",
    split: false,
    badge: "classic",
    meas: "Reference levels calculated from a previous period's high, low, and close.",
    sets: [
      {
        v: "Classic floor pivots",
        t: "classic",
        p: {
          m: "classic",
        },
        d: "Pivot = (previous high + low + close) ÷ 3. Further levels use that pivot and range.",
      },
      {
        v: "Fibonacci pivots",
        t: "Fibonacci variant",
        p: {
          m: "fib",
        },
        d: "Adds or subtracts fractions of the previous range from the pivot.",
      },
      {
        v: "Camarilla",
        t: "Camarilla variant",
        p: {
          m: "cam",
        },
        d: "Uses fractions of the previous range around the previous close.",
      },
    ],
    use: "Mark possible decision areas before the next period starts.",
    pairs: "Price reactions, volume, and the opening range.",
    tf: "Daily, weekly, or monthly inputs, chosen to match the trade.",
    lag: "Fixed from the previous period; no new-period information is included.",
    trap: "They are arithmetic reference lines, not guaranteed support or resistance.",
    origin:
      "Floor-trader arithmetic from the pit era. The Camarilla variant is attributed to Nick Scott, 1989.",
    example:
      "High $110, low $90, close $100: classic pivot $100, first resistance $110, first support $90.",
    related: ["Support & Resistance", "Opening Range & Initial Balance"],
    source: [
      "Fidelity: Pivot Points",
      "https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/pivot-points-resistance-support",
    ],
    diagram:
      "Illustration: the 30 bars before the displayed window stand in for the previous session. Only the first two support/resistance levels are drawn.",
  },
  {
    n: "Moving Averages",
    cat: "trend",
    viz: "ma",
    split: false,
    badge: "20/50/200",
    meas: "A rolling average of price. SMA weights bars equally; EMA weights recent bars more heavily.",
    sets: [
      {
        v: "20 / 50 SMA",
        t: "slower SMA pair",
        p: {
          a: 20,
          b: 50,
          ema: false,
        },
        d: "Equal weights; useful for comparing shorter and longer trend context.",
      },
      {
        v: "9 / 21 EMA",
        t: "faster EMA pair",
        p: {
          a: 9,
          b: 21,
          ema: true,
        },
        d: "Recent closes carry more weight. Faster response also means more false changes.",
      },
      {
        v: "10 / 30 EMA",
        t: "alternate EMA pair",
        p: {
          a: 10,
          b: 30,
          ema: true,
        },
        d: "Another smoothing comparison, not an objectively better setting.",
      },
    ],
    use: "Make trend direction and price smoothing easier to see.",
    pairs: "Price structure and ADX for trend context.",
    tf: "Any timeframe. A 20-period line uses 20 bars, not necessarily 20 days.",
    lag: "Smoothing delays the response. Longer settings usually react more slowly.",
    trap: "Crossovers can repeatedly reverse in sideways markets. No setting removes that risk.",
    origin:
      "Older than charting software. The 20/50/200 convention was standardised by institutional research desks and has outlived every attempt to optimise it.",
    example: "Closes $10, $11, and $12 have a three-period SMA of $11.",
    related: ["Support & Resistance", "Volume"],
    source: [
      "Fidelity: Moving Averages",
      "https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/sma",
    ],
    diagram:
      "Synthetic sample prices and volume for learning. Changing a setting recalculates the chart; this is not live market data.",
  },
  {
    n: "MACD",
    cat: "trend",
    viz: "macd",
    split: true,
    badge: "12/26/9",
    meas: "The fast EMA minus the slow EMA. The signal is an EMA of that difference; the histogram is MACD minus signal.",
    sets: [
      {
        v: "12 / 26 / 9",
        t: "common default",
        p: {
          f: 12,
          s: 26,
          g: 9,
        },
        d: "Fast 12-period EMA, slow 26-period EMA, and 9-period signal EMA.",
      },
      {
        v: "5 / 35 / 5",
        t: "alternate comparison",
        p: {
          f: 5,
          s: 35,
          g: 5,
        },
        d: "A 5/35 EMA difference with a 5-period signal. It is not automatically slower or more accurate.",
      },
      {
        v: "8 / 21 / 5",
        t: "faster comparison",
        p: {
          f: 8,
          s: 21,
          g: 5,
        },
        d: "Shorter input windows react differently; the preferred setting depends on the task.",
      },
    ],
    use: "Compare trend momentum and changes in its pace.",
    pairs: "Price structure and a volume measure.",
    tf: "Any timeframe; shorter bars often produce more noise.",
    lag: "It combines moving averages, so it responds after price changes.",
    trap: "A divergence or crossover is a clue, not proof of a reversal.",
    origin: "Gerald Appel, late 1970s. The histogram was added later by Thomas Aspray.",
    example: "Fast EMA $105 minus slow EMA $100 gives MACD 5. A signal of 4 gives histogram 1.",
    related: ["Support & Resistance", "Volume"],
    source: [
      "Fidelity: MACD",
      "https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/macd",
    ],
    diagram:
      "Synthetic sample prices and volume for learning. Changing a setting recalculates the chart; this is not live market data.",
  },
  {
    n: "ADX and DMI",
    cat: "trend",
    viz: "adx",
    split: true,
    badge: "14 · >25",
    meas: "ADX measures trend strength. +DI and −DI describe the balance of upward and downward movement.",
    sets: [
      {
        v: "14 · above 25 trends",
        t: "common reference",
        p: {
          n: 14,
          t: 25,
        },
        d: "Above 25 often suggests stronger trend conditions; below 20 suggests weaker conditions.",
      },
      {
        v: "14 · above 20 trends",
        t: "lower reference",
        p: {
          n: 14,
          t: 20,
        },
        d: "A 20 threshold flags strength sooner, with more borderline cases.",
      },
      {
        v: "7 · above 25",
        t: "shorter lookback",
        p: {
          n: 7,
          t: 25,
        },
        d: "Seven periods react faster but produce a more variable strength reading.",
      },
    ],
    use: "Distinguish stronger trends from less directional conditions.",
    pairs: "Moving averages or price structure for direction.",
    tf: "Any timeframe, using enough history for the smoothing to settle.",
    lag: "Several smoothing steps make it slow to confirm a change.",
    trap: "Rising ADX can accompany a falling market. Falling ADX means weakening trend strength, not a guaranteed reversal.",
    origin: "J. Welles Wilder, New Concepts in Technical Trading Systems, 1978.",
    example: "ADX at 30 with −DI above +DI can describe a strong downward trend.",
    related: ["Support & Resistance", "Average True Range (ATR)"],
    source: [
      "Fidelity: ADX and DMI",
      "https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/adx",
    ],
    diagram:
      "Synthetic sample prices and volume for learning. Changing a setting recalculates the chart; this is not live market data.",
  },
  {
    n: "Supertrend",
    cat: "trend",
    viz: "supertrend",
    split: false,
    badge: "10 · 3",
    meas: "An ATR-based trailing line that switches sides when price closes through its band.",
    sets: [
      {
        v: "ATR 10 · multiplier 3",
        t: "common starting point",
        p: {
          n: 10,
          m: 3,
        },
        d: "ATR length 10 and multiplier 3. Defaults differ across platforms.",
      },
      {
        v: "ATR 10 · multiplier 2",
        t: "tighter band",
        p: {
          n: 10,
          m: 2,
        },
        d: "A smaller multiplier keeps the band closer and may produce more flips.",
      },
      {
        v: "ATR 7 · multiplier 1.5",
        t: "more sensitive",
        p: {
          n: 7,
          m: 1.5,
        },
        d: "Shorter ATR and a smaller multiplier make the line react more quickly.",
      },
    ],
    use: "Visualise trend bias and a possible trailing reference.",
    pairs: "ADX and actual price structure.",
    tf: "Any timeframe; test the sensitivity on the market you use.",
    lag: "It waits for a close beyond a band based on recent volatility.",
    trap: "It can flip repeatedly in a range. A plotted line is not a guaranteed stop execution.",
    origin: "Created by Olivier Seban. Uses ATR-based trailing bands.",
    example: "If the active lower band is $98, a close below it can switch the line above price.",
    related: ["Average True Range (ATR)", "Stop Order"],
    source: [
      "TradingView: Supertrend calculation",
      "https://www.tradingview.com/support/solutions/43000634738-supertrend/",
    ],
    diagram:
      "Synthetic sample prices and volume for learning. Changing a setting recalculates the chart; this is not live market data.",
  },
  {
    n: "Ichimoku Cloud",
    cat: "trend",
    viz: "ichimoku",
    split: false,
    badge: "9/26/52",
    meas: "A group of range-midpoint lines, including a cloud shifted forward on the chart.",
    sets: [
      {
        v: "9 / 26 / 52",
        t: "common default",
        p: {
          a: 9,
          b: 26,
          c: 52,
        },
        d: "Conversion midpoint 9, base midpoint 26, and second cloud midpoint 52; the cloud is shifted 26 bars.",
      },
      {
        v: "7 / 22 / 44",
        t: "alternate periods",
        p: {
          a: 7,
          b: 22,
          c: 44,
        },
        d: "Shortens the windows and uses a 22-bar shift; not a proven improvement.",
      },
      {
        v: "10 / 30 / 60",
        t: "alternate periods",
        p: {
          a: 10,
          b: 30,
          c: 60,
        },
        d: "Longer windows with a 30-bar shift. Compare the effect rather than assuming better results.",
      },
    ],
    use: "Compare price with the cloud and the conversion and base lines.",
    pairs: "Price structure and volume; avoid adding redundant signals.",
    tf: "Any timeframe; 9/26/52 are common starting inputs.",
    lag: "The cloud uses past data even where it is drawn ahead of price.",
    trap: "A forward-shifted drawing is not knowledge of future prices. A thick cloud is not guaranteed protection.",
    origin: "Developed by Goichi Hosoda; the full system contains five lines.",
    example:
      "Price above the cloud suggests upward trend context; inside the cloud suggests a less clear regime.",
    related: ["Support & Resistance", "Volume"],
    source: [
      "TradingView: Ichimoku Cloud",
      "https://www.tradingview.com/support/solutions/43000589152-ichimoku-cloud/",
    ],
    diagram:
      "Illustration: conversion, base, and cloud lines within the sample. The full system also includes a backward-shifted closing-price line.",
  },
  {
    n: "RSI",
    cat: "momo",
    viz: "rsi",
    split: true,
    badge: "14 · 30/70",
    meas: "Relative Strength Index: smoothed recent gains compared with losses on a 0–100 scale.",
    sets: [
      {
        v: "14 · 30 / 70",
        t: "common default",
        p: {
          n: 14,
          lo: 30,
          hi: 70,
        },
        d: "Fourteen periods with 30 and 70 as reference levels, not automatic trade orders.",
      },
      {
        v: "2 · 10 / 90",
        t: "short-term variant",
        p: {
          n: 2,
          lo: 10,
          hi: 90,
        },
        d: "Two periods react sharply. This is a different sensitivity, not a shortcut to reliable profits.",
      },
      {
        v: "14 · 40 / 80",
        t: "uptrend context",
        p: {
          n: 14,
          lo: 40,
          hi: 80,
        },
        d: "A shifted reference range can help compare momentum during stronger upward trends.",
      },
      {
        v: "7 · 30 / 70",
        t: "shorter lookback",
        p: {
          n: 7,
          lo: 30,
          hi: 70,
        },
        d: "Seven periods respond faster and usually produce more extreme readings.",
      },
    ],
    use: "Read momentum strength and changes in its range.",
    pairs: "Price structure and a trend filter.",
    tf: "Any timeframe; shorter periods react faster and are noisier.",
    lag: "It uses smoothing, so it responds to moves already underway.",
    trap: "Above 70 is not automatically a sell, and below 30 is not automatically a buy. Extremes can persist.",
    origin:
      "Wilder, 1978. The 2-period variant from Larry Connors and Cesar Alvarez, Short Term Trading Strategies That Work, 2008.",
    example:
      "RSI 75 means gains have outweighed losses strongly over the calculation window; it does not mean a 75% chance of a rise.",
    related: ["Support & Resistance", "Discipline & The Plan"],
    source: [
      "Fidelity: RSI",
      "https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/RSI",
    ],
    diagram:
      "Synthetic sample prices and volume for learning. Changing a setting recalculates the chart; this is not live market data.",
  },
  {
    n: "Stochastic Oscillator",
    cat: "momo",
    viz: "stoch",
    split: true,
    badge: "14/3/3",
    meas: "Where the close sits within its recent high–low range, with smoothing lines.",
    sets: [
      {
        v: "14 / 3 / 3",
        t: "slow stochastic",
        p: {
          n: 14,
          k: 3,
          d: 3,
        },
        d: "Raw 14-period %K is smoothed over 3 bars; %D averages that smoothed line over 3 bars.",
      },
      {
        v: "5 / 3 / 3",
        t: "shorter lookback",
        p: {
          n: 5,
          k: 3,
          d: 3,
        },
        d: "Uses a five-bar range with the same smoothing. It remains a slow-stochastic formulation.",
      },
      {
        v: "21 / 5 / 5",
        t: "more smoothing",
        p: {
          n: 21,
          k: 5,
          d: 5,
        },
        d: "Longer range and smoothing windows reduce responsiveness.",
      },
    ],
    use: "Compare momentum near the top or bottom of a recent range.",
    pairs: "Price structure and ADX for market context.",
    tf: "Any timeframe; lookback and smoothing change sensitivity.",
    lag: "Smoothing delays the raw reading but reduces noise.",
    trap: "An extreme reading can persist in a trend. A cross alone does not identify a turning point.",
    origin: "George Lane and colleagues at Investment Educators, 1950s.",
    example: "Recent low $90, high $110, close $105: raw %K is 75 before smoothing.",
    related: ["Support & Resistance", "Average True Range (ATR)"],
    source: [
      "Fidelity: Stochastic Oscillator",
      "https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/slow-stochastic",
    ],
    diagram:
      "Synthetic sample prices and volume for learning. Changing a setting recalculates the chart; this is not live market data.",
  },
  {
    n: "Bollinger Bands",
    cat: "vol",
    viz: "bb",
    split: false,
    badge: "20 · 2.0",
    meas: "A moving average with bands above and below it based on the standard deviation of price.",
    sets: [
      {
        v: "20 periods · 2.0 dev",
        t: "common default",
        p: {
          n: 20,
          s: 2,
        },
        d: "A 20-period SMA with bands at two standard deviations.",
      },
      {
        v: "10 periods · 1.9 dev",
        t: "shorter window",
        p: {
          n: 10,
          s: 1.9,
        },
        d: "Bollinger suggests 1.9 deviations with a 10-period average as a starting adjustment.",
      },
      {
        v: "50 periods · 2.1 dev",
        t: "longer window",
        p: {
          n: 50,
          s: 2.1,
        },
        d: "Bollinger suggests 2.1 deviations with a 50-period average as a starting adjustment.",
      },
    ],
    use: "Compare price with its recent range and observe changing band width.",
    pairs: "Volume or a momentum tool that adds different information.",
    tf: "Any timeframe; settings count bars.",
    lag: "The average and volatility estimate both use past prices.",
    trap: "Touching a band is not an automatic reversal. Two deviations do not guarantee that 95% of future prices stay inside.",
    origin:
      "John Bollinger, early 1980s. His 22 rules are published on bollingerbands.com and are worth reading in full.",
    example: "A $100 average and $2 standard deviation give $104 and $96 bands at two deviations.",
    related: ["Volume", "Support & Resistance"],
    source: ["John Bollinger: band rules", "https://www.bollingerbands.com/bollinger-band-rules"],
    diagram:
      "Synthetic sample prices and volume for learning. Changing a setting recalculates the chart; this is not live market data.",
  },
  {
    n: "ATR",
    cat: "vol",
    viz: "atr",
    split: true,
    badge: "14",
    meas: "Average True Range: a smoothed measure of bar range including gaps from the previous close.",
    sets: [
      {
        v: "14 periods",
        t: "common default",
        p: {
          n: 14,
        },
        d: "Wilder-style smoothing of 14 true ranges.",
      },
      {
        v: "20 periods",
        t: "smoother estimate",
        p: {
          n: 20,
        },
        d: "A longer lookback reacts less to one unusual bar.",
      },
      {
        v: "5 periods",
        t: "faster estimate",
        p: {
          n: 5,
        },
        d: "A shorter lookback responds faster and fluctuates more.",
      },
    ],
    use: "Put movement, targets, and proposed stop distances into price units.",
    pairs: "Position sizing and the actual price structure.",
    tf: "Match the bar period to the question. Daily ATR describes daily movement.",
    lag: "It adjusts after ranges change and can remain high after a shock.",
    trap: "It gives no direction and no guaranteed maximum move. No ATR multiple is a universally safe stop.",
    origin: "Wilder, 1978, in the same book as RSI and ADX.",
    example: "High $105, low $102, previous close $100: true range is $5, because the gap counts.",
    related: ["Average True Range (ATR)", "Position Sizing", "Stop Order"],
    source: [
      "Fidelity: ATR",
      "https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/atr",
    ],
    diagram:
      "Synthetic sample prices and volume for learning. Changing a setting recalculates the chart; this is not live market data.",
  },
  {
    n: "Keltner Channels",
    cat: "vol",
    viz: "keltner",
    split: false,
    badge: "20 · 2×ATR",
    meas: "An EMA with bands set a chosen multiple of ATR above and below it.",
    sets: [
      {
        v: "20 EMA · 2.0 × ATR(10)",
        t: "common variant",
        p: {
          e: 20,
          m: 2,
          a: 10,
        },
        d: "20-period EMA with bands at 2 × ATR(10). Check your platform settings.",
      },
      {
        v: "20 EMA · 2.5 × ATR(20)",
        t: "wider variant",
        p: {
          e: 20,
          m: 2.5,
          a: 20,
        },
        d: "20-period EMA with bands at 2.5 × ATR(20). No fixed coverage probability is implied.",
      },
      {
        v: "20 EMA · 1.5 × ATR(10)",
        t: "tighter variant",
        p: {
          e: 20,
          m: 1.5,
          a: 10,
        },
        d: "A smaller multiplier creates more touches, including false breaks.",
      },
    ],
    use: "Compare trend movement with a volatility-scaled channel.",
    pairs: "Price structure; Bollinger Bands when studying a squeeze.",
    tf: "Any timeframe; defaults vary across charting platforms.",
    lag: "It inherits the smoothing of both EMA and ATR.",
    trap: "A channel touch does not guarantee a reversal. A squeeze does not tell you the breakout direction.",
    origin:
      "Chester Keltner, How To Make Money in Commodities, 1960. The ATR version is Linda Bradford Raschke’s from the 1980s, with the EMA centre line credited to Robert Colby.",
    example: "EMA $100 and ATR $2 give $104 and $96 bands at a multiplier of 2.",
    related: ["Average True Range (ATR)", "Support & Resistance"],
    source: [
      "TradingView: Keltner Channels",
      "https://www.tradingview.com/support/solutions/43000502266-keltner-channels-kc/",
    ],
    diagram:
      "Synthetic sample prices and volume for learning. Changing a setting recalculates the chart; this is not live market data.",
  },
  {
    n: "Relative Volume",
    cat: "volu",
    viz: "rvol",
    split: true,
    badge: "20 bars · 1.5×",
    meas: "Current volume divided by a comparable historical average. The comparison method matters.",
    sets: [
      {
        v: "20-bar average · 1.5× gate",
        t: "prior-bar comparison",
        p: {
          n: 20,
          t: 1.5,
        },
        d: "Current volume divided by the previous 20 sample bars; highlight at 1.5×.",
      },
      {
        v: "10-bar average · 2× gate",
        t: "shorter baseline",
        p: {
          n: 10,
          t: 2,
        },
        d: "Uses the previous 10 bars and highlights readings at 2×.",
      },
      {
        v: "50-bar average · 1.5× gate",
        t: "longer baseline",
        p: {
          n: 50,
          t: 1.5,
        },
        d: "Uses the previous 50 bars and highlights readings at 1.5×.",
      },
    ],
    use: "Judge whether participation is unusually high or low.",
    pairs: "Breakouts, gaps, and VWAP, alongside actual price behaviour.",
    tf: "For intraday work, compare the same time of day across sessions.",
    lag: "The current bar is incomplete until it closes. The baseline uses past volume.",
    trap: "This diagram uses prior-bar volume, not same-time-of-day volume. High RVOL alone is not directional.",
    origin: "There is no single universal RVOL formula. Check the baseline and session definition.",
    example: "A bar with 2,000 volume versus a prior-bar average of 1,000 has RVOL of 2.",
    related: ["Relative Volume (RVOL)", "Volume", "VWAP"],
    source: [
      "TradingView: relative volume calculation",
      "https://www.tradingview.com/support/solutions/43000635874-how-do-we-calculate-relative-volume-and-relative-volume-at-time/",
    ],
    diagram:
      "Illustration: current bar ÷ average of prior bars. This sample has no session timestamps, so it cannot show time-of-day RVOL.",
  },
  {
    n: "On-Balance Volume",
    cat: "volu",
    viz: "obv",
    split: true,
    badge: "cumulative",
    meas: "A running total adding volume on an up close and subtracting it on a down close; unchanged closes add nothing.",
    sets: [
      {
        v: "Raw cumulative",
        t: "cumulative line",
        p: {
          n: 0,
        },
        d: "The starting total is arbitrary. Compare the shape of the line, not its absolute value.",
      },
      {
        v: "With a 20-EMA signal",
        t: "optional smoothing",
        p: {
          n: 20,
        },
        d: "A 20-period EMA helps compare OBV with its own recent average.",
      },
    ],
    use: "Compare the direction of volume-weighted closes with price.",
    pairs: "Price structure and relative volume.",
    tf: "Any timeframe with suitable volume data; cumulative OBV does not need a daily reset.",
    lag: "It updates after each bar closes. An optional EMA adds lag.",
    trap: "It assigns all bar volume by the closing direction. It does not directly measure buying versus selling volume.",
    origin: "Joe Granville, Granville’s New Key to Stock Market Profits, 1963.",
    example:
      "An up-close bar with 1,000 volume adds 1,000 to OBV, even if price rose only one cent.",
    related: ["Volume", "Relative Volume (RVOL)", "Support & Resistance"],
    source: [
      "Fidelity: On-Balance Volume",
      "https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/obv",
    ],
    diagram:
      "Synthetic sample prices and volume for learning. Changing a setting recalculates the chart; this is not live market data.",
  },
];
