window.TDESK = window.TDESK || {};

window.TDESK.ENC_CATS = [
  ["lvl1", "● Start here"],
  ["lvl2", "●● Building"],
  ["lvl3", "●●● Advanced"],
  ["structure", "Market Structure"],
  ["options", "Options"],
  ["futures", "Futures"],
  ["greeks", "The Greeks"],
  ["orders", "Order Types"],
  ["risk", "Risk & Money"],
  ["psych", "Psychology"],
  ["modern", "Today’s Market"],
  ["all", "Everything"],
];

window.TDESK.ENC_PATH = {
  lvl1: [
    "Stock & ETF",
    "Long & Short",
    "Bid / Ask / Spread",
    "Liquidity",
    "Volume",
    "Support & Resistance",
    "Market vs. Limit",
    "Stop Order",
    "Slippage",
    "Call & Put",
    "Strike & Expiration",
    "Premium",
    "Moneyness (ITM / ATM / OTM)",
    "Assignment & Exercise",
    "Position Sizing",
    "Risk-to-Reward (R)",
    "Drawdown",
    "Discipline & The Plan",
    "FOMO",
    "Revenge Trading",
  ],
  lvl2: [
    "VWAP",
    "Relative Volume (RVOL)",
    "Average True Range (ATR)",
    "Opening Range & Initial Balance",
    "Gaps & Gap Fill",
    "Bracket & OCO Orders",
    "Trailing Stop",
    "Time in Force",
    "Intrinsic & Extrinsic Value",
    "Implied Volatility (IV)",
    "Expected Move",
    "The Options Chain",
    "Open Interest",
    "Delta",
    "Theta",
    "Futures Contract",
    "Multiplier & Tick Value",
    "Expectancy",
    "Margin & The Margin Call",
    "Pattern Day Trader Rule",
    "Loss Aversion",
    "Confirmation Bias",
  ],
  lvl3: [
    "Liquidity Sweep",
    "Fair Value Gap (Imbalance)",
    "Level 2 & Time and Sales",
    "Float & The Short Squeeze",
    "IV Rank & IV Percentile",
    "Credit vs. Debit Spreads",
    "Iron Condor",
    "Volatility Skew",
    "Volatility Risk Premium",
    "IV Crush",
    "Pin Risk",
    "Gamma",
    "Vega",
    "Vanna & Charm",
    "0DTE Options",
    "Gamma Exposure (GEX)",
    "Zero-Gamma Flip",
    "Call Wall & Put Wall",
    "OPEX & Triple Witching",
    "Gamma Squeeze",
    "Contango & Backwardation",
    "Correlation Risk",
    "Risk of Ruin",
    "Volatility ETPs",
  ],
};

window.TDESK.ENC_PATH_INTRO = {
  lvl1: [
    "Start here",
    "Read these in order: what you trade, how orders work, option basics, and how to limit risk. Each term includes a small example.",
  ],
  lvl2: [
    "Build on the basics",
    "Learn the tools, contract details, and simple calculations used to plan and review a trade.",
  ],
  lvl3: [
    "Explore advanced mechanics",
    "Study spreads, volatility, and models of market positioning. Use the related terms whenever a concept is unfamiliar.",
  ],
};

window.TDESK.ENCYCLOPEDIA = [
  {
    t: "Bid / Ask / Spread",
    cat: "structure",
    tag: "market basics",
    def: "The bid is the best advertised buying price. The ask is the best advertised selling price. The spread is the gap between them.",
    why: "Buying at the ask and immediately selling at the bid costs you the spread, even if the price stays still.",
    watch:
      "A limit order can get a better price, but it might not fill. Quotes can change before your order arrives.",
    example:
      "Bid $10.00, ask $10.10: buying then immediately selling 100 shares loses $10 before fees.",
    related: ["Liquidity", "Market vs. Limit", "Slippage"],
    aliases: ["quote", "bid-ask"],
  },
  {
    t: "Liquidity",
    cat: "structure",
    tag: "market basics",
    def: "How easily you can buy or sell without pushing the price far away.",
    why: "A busy market with tight spreads usually makes entering and exiting easier.",
    watch:
      "Liquidity can disappear during news or a halt. A stop order cannot guarantee an exit price.",
    example: "Selling 100 shares may be easy. Selling 100,000 at the same price may not be.",
    related: ["Bid / Ask / Spread", "Volume", "Slippage"],
    aliases: [],
  },
  {
    t: "Volume",
    cat: "structure",
    tag: "market basics",
    def: "How many shares or contracts traded during a period.",
    why: "It shows activity. Compare it with the asset's usual activity to judge whether a move has broad participation.",
    watch:
      "Every trade has a buyer and a seller. High volume alone does not tell you who will win next.",
    example:
      "A stock trades 2 million shares today versus its usual 1 million: activity is twice normal.",
    related: ["Relative Volume (RVOL)", "Open Interest", "Liquidity"],
    aliases: [],
  },
  {
    t: "Support & Resistance",
    cat: "structure",
    tag: "market basics",
    def: "Support is an area where buying has slowed past declines. Resistance is an area where selling has slowed past rises.",
    why: "These areas help you plan where your idea might work or fail.",
    watch:
      "Levels can break. Repeated tests can either confirm interest or use up available orders.",
    example:
      "A stock bounced near $50 several times. You mark a support zone around $50, not an exact promise.",
    related: ["Gaps & Gap Fill", "Stop Order", "Position Sizing"],
    aliases: [],
  },
  {
    t: "VWAP",
    cat: "structure",
    tag: "market basics",
    def: "Volume-weighted average price: an average trading price that gives more weight to prices with more volume.",
    why: "It is a session benchmark. Above VWAP means price is above that average, not that a rise is guaranteed.",
    watch:
      "Session VWAP resets each session. Many charts estimate it from bars; it does not reveal anyone's actual cost basis.",
    example: "100 shares at $10 and 300 at $12 give VWAP of $11.50.",
    related: ["Volume", "Relative Volume (RVOL)", "Support & Resistance"],
    aliases: [],
  },
  {
    t: "Relative Volume (RVOL)",
    cat: "structure",
    tag: "market basics",
    def: "Current volume divided by typical volume for a comparable period.",
    why: "It helps distinguish an unusually busy market from a quiet one.",
    watch:
      "For intraday comparisons, match the time of day. High activity does not guarantee a profitable move.",
    example: "200,000 shares by 10 a.m. versus a usual 100,000 by 10 a.m. gives RVOL of 2.",
    related: ["Volume", "Liquidity", "Opening Range & Initial Balance"],
    aliases: [],
  },
  {
    t: "Average True Range (ATR)",
    cat: "structure",
    tag: "market basics",
    def: "An average of recent price ranges, including gaps from the previous close. It measures movement size, not direction.",
    why: "It helps put a stop distance or target in context with recent movement.",
    watch: "ATR can jump after a large move. A stop based on ATR can still slip or be hit.",
    example:
      "Daily ATR of $2 means recent daily true ranges average about $2. It is not a $2 price forecast.",
    related: ["Position Sizing", "Stop Order", "Gaps & Gap Fill"],
    aliases: [],
  },
  {
    t: "Opening Range & Initial Balance",
    cat: "structure",
    tag: "market basics",
    def: "The opening range is the high and low over a chosen opening window. Initial balance commonly means the first hour.",
    why: "It gives you a defined area to compare later prices against.",
    watch: "State the window and session. A move outside the range can quickly reverse.",
    example:
      "For a 15-minute opening range, mark the highest and lowest prices from 9:30 to 9:45 a.m. Eastern.",
    related: ["Volume", "Relative Volume (RVOL)", "Support & Resistance"],
    aliases: [],
  },
  {
    t: "Liquidity Sweep",
    cat: "structure",
    tag: "market basics",
    def: "A move through a prior high or low that may trigger stops and other waiting orders.",
    why: "It helps describe a brief break of a level followed by a return inside it.",
    watch:
      "A chart cannot prove someone deliberately hunted stops. The break may continue instead of reversing.",
    example: "Price breaks a $50 high, reaches $50.20, then falls back below $50.",
    related: ["Support & Resistance", "Stop Order", "Slippage"],
    aliases: [],
  },
  {
    t: "Fair Value Gap (Imbalance)",
    cat: "structure",
    tag: "market basics",
    def: "In this charting method, a three-candle pattern where the first and third candles' ranges do not overlap.",
    why: "Some traders mark that area as a possible place for price to revisit.",
    watch:
      "This is a chart pattern, not proof of fair value or unfilled orders. Price may never return.",
    example: "Candle one's high is $10; candle three's low is $11. The marked gap is $10 to $11.",
    related: ["Gaps & Gap Fill", "Support & Resistance", "Volume"],
    aliases: [],
  },
  {
    t: "Gaps & Gap Fill",
    cat: "structure",
    tag: "market basics",
    def: "A gap is a jump between traded price ranges, often between yesterday's close and today's open. A fill means price returns through the gap.",
    why: "Gaps can change planned entries, stops, and risk before you can react.",
    watch:
      "There is no rule that every gap must fill. News can permanently change the price range.",
    example: "Yesterday closed at $50; today opens at $55. A return to $50 fills that opening gap.",
    related: ["Slippage", "Stop Order", "Circuit Breakers & Halts"],
    aliases: [],
  },
  {
    t: "Level 2 & Time and Sales",
    cat: "structure",
    tag: "market basics",
    def: "Level 2 shows displayed orders at different prices. Time and sales shows completed trades.",
    why: "Together they show advertised liquidity and transactions that actually happened.",
    watch:
      "Orders can be cancelled, hidden, or split across venues. Neither display shows everyone's intent.",
    example:
      "A bid for 1,000 shares appears in Level 2. A 500-share trade prints in time and sales.",
    related: ["Liquidity", "Bid / Ask / Spread", "Dark Pools"],
    aliases: [],
  },
  {
    t: "Float & The Short Squeeze",
    cat: "structure",
    tag: "market basics",
    def: "Float is the stock available for public trading. A short squeeze happens when short sellers buying back shares help drive price higher.",
    why: "A small float and crowded short position can make price moves harder to exit.",
    watch:
      "A squeeze is possible, not inevitable. A short stock position has theoretically unlimited loss as price rises.",
    example:
      "A trader sells borrowed shares at $20, then must buy them back at $30, adding buying pressure.",
    related: ["Long & Short", "Liquidity", "Gamma Squeeze"],
    aliases: [],
  },
  {
    t: "Market vs. Limit",
    cat: "orders",
    tag: "placing orders",
    def: "A market order seeks the next available execution. A limit order sets the most you will pay to buy or least you will accept to sell.",
    why: "Choose between price control and a greater chance of immediate execution.",
    watch:
      "Market orders do not guarantee price. Limit orders do not guarantee a fill, even when price touches the limit.",
    example: "A $10 buy limit can fill at $10 or lower. A market buy may fill above $10.",
    related: ["Bid / Ask / Spread", "Slippage", "Marketable Limit Order"],
    aliases: [],
  },
  {
    t: "Stop Order",
    cat: "orders",
    tag: "placing orders",
    def: "An order that becomes a market order after its stop price is triggered. A stop-limit becomes a limit order instead.",
    why: "It can automate an exit if price moves against you.",
    watch: "A stop is a trigger, not a guaranteed loss limit. A stop-limit can remain unfilled.",
    example:
      "A sell stop at $48 triggers when the stop condition is met. In a gap it may fill well below $48.",
    related: ["Market vs. Limit", "Slippage", "Trailing Stop"],
    aliases: [],
  },
  {
    t: "Slippage",
    cat: "orders",
    tag: "placing orders",
    def: "The difference between your expected execution price and your actual fill.",
    why: "It changes the real cost and risk of a trade.",
    watch:
      "Slippage can be favourable too. Fast markets, large orders, and thin liquidity increase uncertainty.",
    example: "You expect to sell 100 shares at $50 but fill at $49.80: $20 of adverse slippage.",
    related: ["Liquidity", "Market vs. Limit", "Stop Order"],
    aliases: [],
  },
  {
    t: "Marketable Limit Order",
    cat: "orders",
    tag: "placing orders",
    def: "A limit order priced so it can trade against the current opposite quote.",
    why: "It seeks a prompt fill while keeping a worst acceptable price.",
    watch: "The market can move away before the order arrives. It can fill partly or not at all.",
    example:
      "With an ask of $10.05, a buy limit of $10.10 can fill at available prices up to $10.10.",
    related: ["Market vs. Limit", "Bid / Ask / Spread", "Liquidity"],
    aliases: [],
  },
  {
    t: "Bracket & OCO Orders",
    cat: "orders",
    tag: "placing orders",
    def: "A bracket links an entry with planned profit and loss exits. OCO means one exit cancels the other.",
    why: "They can help automate a trading plan.",
    watch:
      "Broker handling varies. Gaps, partial fills, or cancellation delays can affect the result.",
    example:
      "Buy at $50 with a $55 profit limit and a $48 stop. If one exit executes, the other is cancelled.",
    related: ["Stop Order", "Market vs. Limit", "Position Sizing"],
    aliases: [],
  },
  {
    t: "Trailing Stop",
    cat: "orders",
    tag: "placing orders",
    def: "A stop that follows a favourable price move by a chosen dollar amount or percentage.",
    why: "It can tighten an exit as a position gains value.",
    watch:
      "A normal pullback can trigger it. The fill price is not guaranteed, and overnight handling varies by broker.",
    example:
      "A $2 trailing sell stop moves from $48 to $53 if its reference price rises from $50 to $55.",
    related: ["Stop Order", "Average True Range (ATR)", "Slippage"],
    aliases: [],
  },
  {
    t: "Time in Force",
    cat: "orders",
    tag: "placing orders",
    def: "How long an order remains active, such as day-only or good-till-cancelled (GTC).",
    why: "It prevents old orders from staying live longer than you intended.",
    watch:
      "GTC does not necessarily mean forever or all sessions. Check extended-hours eligibility and expiry rules.",
    example:
      "A day order usually expires at the session's end. A GTC order stays active under the broker's time limit.",
    related: ["Market vs. Limit", "Overnight & 24-Hour Trading", "Bracket & OCO Orders"],
    aliases: [],
  },
  {
    t: "Call & Put",
    cat: "options",
    tag: "option mechanics",
    def: "A call gives its buyer the right to buy at a set price. A put gives its buyer the right to sell at a set price.",
    why: "Calls and puts are the two building blocks of options strategies.",
    watch:
      "A buyer pays a premium. A seller takes an obligation. Buying a put and selling a call are different positions.",
    example:
      "A $100 call lets its owner buy shares at $100 under the contract's terms. A $100 put lets them sell at $100.",
    related: ["Premium", "Strike & Expiration", "Assignment & Exercise", "Long & Short"],
    aliases: [],
  },
  {
    t: "Strike & Expiration",
    cat: "options",
    tag: "option mechanics",
    def: "The strike is the contract's buy or sell price. Expiration is when the option's rights end.",
    why: "Both affect what the option can be worth and how long your idea has to work.",
    watch:
      "Last trading time, exercise deadline, and settlement time can differ. Check the exact contract.",
    example:
      "A June $100 call has a $100 strike and a specified June expiry. The premium is a separate price.",
    related: ["Call & Put", "Premium", "Moneyness (ITM / ATM / OTM)"],
    aliases: [],
  },
  {
    t: "Intrinsic & Extrinsic Value",
    cat: "options",
    tag: "option mechanics",
    def: "Intrinsic value is what exercising would be worth now. Extrinsic value is the option price above that amount.",
    why: "It separates current exercise value from what buyers pay for remaining possibilities.",
    watch:
      "At expiration, extrinsic value is zero. Before expiration it changes with time, volatility, and other pricing inputs.",
    example: "Stock $105, call strike $100, premium $7: $5 intrinsic plus $2 extrinsic.",
    related: ["Premium", "Moneyness (ITM / ATM / OTM)", "Theta", "Implied Volatility (IV)"],
    aliases: [],
  },
  {
    t: "Implied Volatility (IV)",
    cat: "options",
    tag: "option mechanics",
    def: "The movement level implied by an option's market price in a pricing model. It is usually shown as an annual percentage.",
    why: "Higher IV generally raises call and put prices when other inputs stay the same.",
    watch:
      "IV describes size, not direction. Actual moves can be larger, and IV differs across strikes and expirations.",
    example:
      "On a $100 stock, 20% annual IV gives an approximate one-year one-standard-deviation move of $20 in a simple model.",
    related: ["Expected Move", "IV Crush", "Vega"],
    aliases: ["IV", "volatility"],
  },
  {
    t: "IV Rank & IV Percentile",
    cat: "options",
    tag: "option mechanics",
    def: "IV rank locates today's IV between its past low and high. IV percentile measures how often past IV was lower.",
    why: "Both compare current option pricing with that asset's own history.",
    watch:
      "Vendors use different windows and IV measures. High rank does not automatically make selling profitable.",
    example:
      "Past IV ranged from 20 to 60. Current IV of 40 has rank 50. Percentile depends on all observations, not just those extremes.",
    related: ["Implied Volatility (IV)", "Volatility Skew", "Volatility Risk Premium"],
    aliases: [],
  },
  {
    t: "Expected Move",
    cat: "options",
    tag: "option mechanics",
    def: "An estimate of how far price might move over a stated period, often inferred from options.",
    why: "It provides a scale for comparing a target with the movement already priced in.",
    watch:
      "It is a model estimate, not a boundary or guaranteed 68% range. Providers may use a different calculation.",
    example: "At $100 and 20% IV, a 30-day estimate is $100 × 0.20 × √(30/365), about $5.73.",
    related: ["Implied Volatility (IV)", "Strike & Expiration", "Position Sizing"],
    aliases: [],
  },
  {
    t: "Assignment & Exercise",
    cat: "options",
    tag: "option mechanics",
    def: "Exercise is the buyer using the option's right. Assignment is a seller being required to fulfil it.",
    why: "A stock option can turn into a share position requiring much more cash.",
    watch:
      "American-style options can be exercised early. European-style options wait until expiry. Settlement may be shares or cash; verify the product.",
    example:
      "A standard $100 put assigned to its seller generally requires buying 100 shares for $10,000.",
    related: ["Call & Put", "Strike & Expiration", "Pin Risk"],
    aliases: ["assigned", "exercised"],
  },
  {
    t: "The Options Chain",
    cat: "options",
    tag: "option mechanics",
    def: "A table of options grouped by expiration and strike, showing calls, puts, prices, and other contract data.",
    why: "It is where you compare the contract you want with nearby alternatives.",
    watch:
      "The last traded price can be stale. A displayed midpoint is not a guaranteed execution price.",
    example:
      "Choose an expiry, find the $100 strike, then check the call's bid, ask, volume, and contract details.",
    related: ["Bid / Ask / Spread", "Open Interest", "Strike & Expiration"],
    aliases: [],
  },
  {
    t: "Open Interest",
    cat: "options",
    tag: "option mechanics",
    def: "The number of option or futures contracts still open after clearing, usually reported daily.",
    why: "It shows outstanding positions, which is different from today's trading activity.",
    watch:
      "It does not reveal whether traders are bullish, bearish, hedged, or dealers. Check the bid and ask for execution quality.",
    example:
      "An option has 1,000 open contracts but trades 300 times today. Its volume is 300; open interest need not rise by 300.",
    related: ["Volume", "The Options Chain", "Gamma Exposure (GEX)"],
    aliases: [],
  },
  {
    t: "Credit vs. Debit Spreads",
    cat: "options",
    tag: "option mechanics",
    def: "A spread combines options. A debit spread costs money to open; a credit spread pays money to open.",
    why: "Combining bought and sold options can limit both the possible gain and loss.",
    watch:
      "Defined expiry risk assumes the full position stays intact. Assignment, fees, or closing only one leg can change exposure.",
    example:
      "Buy a $100 call and sell a $105 call for a $2 debit: maximum expiry gain $300 and loss $200 per standard spread.",
    related: ["Call & Put", "Premium", "Assignment & Exercise"],
    aliases: [],
  },
  {
    t: "Iron Condor",
    cat: "options",
    tag: "option mechanics",
    def: "A short put spread below price plus a short call spread above price, usually with the same expiry.",
    why: "It collects a credit in exchange for taking risk if price moves too far either way.",
    watch:
      "A high win rate can hide large losses. The four legs add execution costs and assignment considerations.",
    example:
      "Sell 95/90 puts and 105/110 calls for $2 total credit: max gain $200; max expiry loss $300 per standard condor.",
    related: ["Credit vs. Debit Spreads", "Implied Volatility (IV)", "Pin Risk"],
    aliases: [],
  },
  {
    t: "Covered Call",
    cat: "options",
    tag: "option mechanics",
    def: "Owning shares and selling calls against them, usually one standard call per 100 shares.",
    why: "The premium offsets a little downside in exchange for giving up gains above the strike.",
    watch:
      "It does not protect against a large stock decline. Shares can be called away, including before expiry.",
    example:
      "Own at $100, sell a $105 call for $2: maximum expiry gain is $700 per 100 shares; loss can reach $9,800.",
    related: ["Call & Put", "Assignment & Exercise", "Cash-Secured Put"],
    aliases: [],
  },
  {
    t: "Cash-Secured Put",
    cat: "options",
    tag: "option mechanics",
    def: "Selling a put while holding enough cash to buy the shares if assigned.",
    why: "It commits you to buying at the strike even if the market later falls much lower.",
    watch:
      "Being willing to own it today does not remove future downside. The credit is compensation for that risk.",
    example:
      "Sell a $95 put for $2: max gain $200; loss $9,300 if the stock goes to zero, before fees.",
    related: ["Call & Put", "Assignment & Exercise", "Covered Call"],
    aliases: [],
  },
  {
    t: "LEAPS",
    cat: "options",
    tag: "option mechanics",
    def: "Long-dated options with expirations initially more than a year away.",
    why: "They give a position more time, but also put more premium at risk.",
    watch:
      "They still expire. Volatility, rates, dividends, and the underlying price can move their value substantially.",
    example:
      "A call expiring in 18 months gives more time than a one-month call at the same strike.",
    related: ["Strike & Expiration", "Theta", "Vega", "Rho"],
    aliases: [],
  },
  {
    t: "Volatility Skew",
    cat: "options",
    tag: "option mechanics",
    def: "Different implied volatilities at different strikes within the same expiry.",
    why: "It means options equally far from the stock price can carry different movement assumptions.",
    watch:
      "Downside skew is common in equities but not universal. Equal distance from price does not mean equal premium.",
    example: "A lower-strike put might have 35% IV while a higher-strike call has 25% IV.",
    related: ["Implied Volatility (IV)", "The Options Chain", "Credit vs. Debit Spreads"],
    aliases: [],
  },
  {
    t: "Volatility Risk Premium",
    cat: "options",
    tag: "option mechanics",
    def: "The difference between volatility priced into options and volatility later realised; implied volatility has often exceeded realised volatility on average.",
    why: "It helps explain why option sellers may earn compensation for taking risk.",
    watch:
      "An average tendency is not guaranteed profit. Large moves, costs, and hedging losses can overwhelm collected premium.",
    example:
      "Options price in 25% volatility; the market later realises 18%. That is a positive difference for that period.",
    related: ["Implied Volatility (IV)", "IV Rank & IV Percentile", "Risk of Ruin"],
    aliases: [],
  },
  {
    t: "IV Crush",
    cat: "options",
    tag: "option mechanics",
    def: "A sharp fall in implied volatility, often after an event removes uncertainty.",
    why: "A bought option can lose value even if the stock moves in the expected direction.",
    watch: "Not every event produces a crush, and the size varies by strike and expiry.",
    example:
      "A call gains $1 from a stock rise but loses $2 from a drop in volatility: it is down overall.",
    related: ["Implied Volatility (IV)", "Vega", "Intrinsic & Extrinsic Value"],
    aliases: [],
  },
  {
    t: "Pin Risk",
    cat: "options",
    tag: "option mechanics",
    def: "Uncertainty about exercise and assignment when an option finishes near its strike.",
    why: "One leg of a spread may become shares while the other expires, leaving an unexpected position.",
    watch:
      "The closing quote alone does not settle assignment. Check broker deadlines and account capacity before expiry.",
    example:
      "A short $100 call ends near $100; later price changes or exercise instructions can leave you short shares.",
    related: ["Assignment & Exercise", "Strike & Expiration", "Credit vs. Debit Spreads"],
    aliases: [],
  },
  {
    t: "0DTE Options",
    cat: "modern",
    tag: "market mechanics",
    def: "Options expiring on the same day they are traded. DTE means days to expiration.",
    why: "There is almost no time left for a position to recover from a wrong move.",
    watch:
      "Near-the-money delta can change very fast. A long option can lose its entire premium within minutes.",
    example: "A call bought at 10 a.m. on its expiry day is a 0DTE option.",
    related: ["Gamma", "Theta", "Pin Risk"],
    aliases: ["zero days", "days to expiration"],
  },
  {
    t: "Delta",
    cat: "greeks",
    tag: "option sensitivity",
    def: "An estimate of how much an option's price changes for a $1 move in the underlying, with other inputs held still.",
    why: "It gives a first estimate of directional exposure.",
    watch:
      "Delta changes. Its absolute value is sometimes used as a rough probability proxy; it is not the chance of making a profit.",
    example:
      "A call with 0.50 delta may gain about $0.50 per share, or $50 per standard contract, on a small $1 stock rise.",
    related: ["Gamma", "Call & Put", "Position Sizing"],
    aliases: [],
  },
  {
    t: "Gamma",
    cat: "greeks",
    tag: "option sensitivity",
    def: "How much delta changes for a $1 move in the underlying.",
    why: "It tells you how quickly a position's directional exposure can change.",
    watch:
      "Gamma is typically highest near the strike close to expiry. Short options have negative gamma.",
    example:
      "If delta is 0.50 and gamma is 0.05, a small $1 rise brings delta to about 0.55, all else equal.",
    related: ["Delta", "0DTE Options", "Gamma Exposure (GEX)"],
    aliases: [],
  },
  {
    t: "Theta",
    cat: "greeks",
    tag: "option sensitivity",
    def: "An estimate of how an option's price changes as one day passes, with other inputs held still.",
    why: "It describes the effect of time passing; it is not a daily bill or promised income.",
    watch:
      "Theta changes with price, IV, and remaining time. Near-the-money decay often speeds up near expiry.",
    example:
      "Theta of −0.04 suggests about $4 of daily decay per standard long contract at the current inputs.",
    related: ["Intrinsic & Extrinsic Value", "Strike & Expiration", "0DTE Options"],
    aliases: [],
  },
  {
    t: "Vega",
    cat: "greeks",
    tag: "option sensitivity",
    def: "An estimate of the price change for a one-percentage-point change in implied volatility.",
    why: "It explains why changing volatility can outweigh getting direction right.",
    watch:
      "Bought options generally have positive vega. A multi-leg position can have different net exposure.",
    example:
      "Vega of 0.10 means a rise from 30% to 31% IV adds about $10 per standard long contract, all else equal.",
    related: ["Implied Volatility (IV)", "IV Crush", "LEAPS"],
    aliases: [],
  },
  {
    t: "Vanna & Charm",
    cat: "greeks",
    tag: "option sensitivity",
    def: "Vanna measures how delta changes with volatility. Charm measures how delta changes as time passes.",
    why: "They help model why a hedge might need adjusting even without a stock-price move.",
    watch:
      "The resulting trades depend on actual positions and hedges. These measures do not guarantee rallies or price pinning.",
    example: "If IV falls, an option's delta can change even when the stock stays at $100.",
    related: ["Delta", "Vega", "Gamma Exposure (GEX)"],
    aliases: [],
  },
  {
    t: "Rho",
    cat: "greeks",
    tag: "option sensitivity",
    def: "An estimate of how an option's price changes when interest rates move one percentage point.",
    why: "It matters more for long-dated options than very short ones.",
    watch:
      "Plain call rho is generally positive and put rho negative. Other inputs and multi-leg positions can alter the total result.",
    example:
      "Rho of 0.20 means a one-point rate rise adds about $20 to a standard long call under the model.",
    related: ["LEAPS", "Call & Put", "Vega"],
    aliases: [],
  },
  {
    t: "Futures Contract",
    cat: "futures",
    tag: "contract mechanics",
    def: "A standardised contract with a specified asset, size, expiry, and settlement method.",
    why: "It creates leveraged exposure: a small posted margin can support a much larger position.",
    watch:
      "Margin is not the most you can lose. Some contracts involve delivery; others settle in cash.",
    example: "One E-mini S&P 500 futures contract gains or loses $50 for a one-point index move.",
    related: ["Multiplier & Tick Value", "Rollover", "Margin & The Margin Call"],
    aliases: [],
  },
  {
    t: "Multiplier & Tick Value",
    cat: "futures",
    tag: "contract mechanics",
    def: "The multiplier converts a price move into money. A tick is the smallest allowed price change; tick value is its cash amount.",
    why: "You need both to translate a planned stop into dollar risk.",
    watch:
      "Specifications differ by product. MES is one-tenth of ES; do not assume every micro future has identical scaling.",
    example:
      "ES: $50 per point × 0.25-point tick = $12.50 per tick. Eight ticks equal $100 per contract.",
    related: ["Futures Contract", "Position Sizing", "Slippage"],
    aliases: [],
  },
  {
    t: "Contango & Backwardation",
    cat: "futures",
    tag: "contract mechanics",
    def: "Contango means later futures are priced above nearer contracts. Backwardation means later contracts are priced below nearer ones.",
    why: "The curve affects returns when a futures position is repeatedly rolled.",
    watch:
      "Contango can hurt a long rolling position, but it is not a fixed fee or a guarantee of loss. Curves change.",
    example: "Near future $70, later future $72: that pair is in contango.",
    related: ["Futures Contract", "Rollover", "Volatility ETPs"],
    aliases: [],
  },
  {
    t: "Rollover",
    cat: "futures",
    tag: "contract mechanics",
    def: "Closing an expiring contract and opening another expiry to keep similar exposure.",
    why: "It avoids unintentionally holding a contract into settlement or delivery.",
    watch:
      "Rolling does not erase a loss. Check liquidity, last trading time, and any delivery notice deadline.",
    example:
      "Sell the expiring June future and buy September. That is two trades with their own prices and costs.",
    related: ["Futures Contract", "Contango & Backwardation", "Liquidity"],
    aliases: [],
  },
  {
    t: "Position Sizing",
    cat: "risk",
    tag: "managing risk",
    def: "Choosing the number of shares or contracts based on how much you can afford to lose.",
    why: "It connects your risk budget to the price distance or full loss of the position.",
    watch:
      "Stop-based sizing assumes an exit near the stop. Gaps can create larger losses; long-option premium can be lost entirely.",
    example:
      "A $100 budget and $2 stop distance allow 50 shares before costs. A $300 long option exceeds that budget.",
    related: ["Stop Order", "Risk-to-Reward (R)", "Correlation Risk"],
    aliases: [],
  },
  {
    t: "Risk-to-Reward (R)",
    cat: "risk",
    tag: "managing risk",
    def: "R is the amount planned at risk. Profit or loss expressed in R compares trades of different sizes.",
    why: "It helps compare the typical win with the typical loss.",
    watch:
      "A target is not an achieved return. A large proposed reward means little without the chance of reaching it.",
    example: "Risk $100 and make $200: +2R. Lose $100: −1R. The risk-to-reward ratio is 1:2.",
    related: ["Position Sizing", "Expectancy", "Slippage"],
    aliases: ["reward to risk"],
  },
  {
    t: "Expectancy",
    cat: "risk",
    tag: "managing risk",
    def: "Average expected profit or loss per trade: win rate × average win minus loss rate × average loss, after costs.",
    why: "Win rate alone cannot tell you whether a strategy makes money.",
    watch:
      "A small or biased sample can mislead. Positive past expectancy does not guarantee future results.",
    example:
      "Win 40% at $200 and lose 60% at $100: 0.4 × $200 − 0.6 × $100 = $20 per trade before costs.",
    related: ["Risk-to-Reward (R)", "Survivorship Bias", "Risk of Ruin"],
    aliases: [],
  },
  {
    t: "Drawdown",
    cat: "risk",
    tag: "managing risk",
    def: "The fall in account value from a previous peak, measured in dollars or percent.",
    why: "It shows how far an account has fallen and how much recovery is needed.",
    watch:
      "A past maximum drawdown is not a limit on future losses. Open losses count when measuring account equity.",
    example:
      "An account falls from $10,000 to $8,000: a 20% drawdown. It needs a 25% gain to return.",
    related: ["Position Sizing", "Risk of Ruin", "Sharpe Ratio"],
    aliases: [],
  },
  {
    t: "Correlation Risk",
    cat: "risk",
    tag: "managing risk",
    def: "The risk that several positions move together, making your total exposure larger than it looks.",
    why: "Different tickers can still be the same underlying bet.",
    watch:
      "Relationships change, especially during stress. A hedge can fail or protect less than expected.",
    example: "Five technology stocks may all fall after the same sector news.",
    related: ["Position Sizing", "Drawdown", "Stock & ETF"],
    aliases: [],
  },
  {
    t: "Risk of Ruin",
    cat: "risk",
    tag: "managing risk",
    def: "The chance of losing enough money that you can no longer continue with your approach.",
    why: "It links position size, losing streaks, and the size of rare losses.",
    watch:
      "That is a severe loss, not mathematically zero. Model results depend on assumptions that can fail.",
    example:
      "Losing 10% of remaining capital ten times leaves about 35% of the original account, before fees.",
    related: ["Position Sizing", "Expectancy", "Drawdown"],
    aliases: [],
  },
  {
    t: "Sharpe Ratio",
    cat: "risk",
    tag: "managing risk",
    def: "Return above the risk-free rate divided by the volatility of those returns, using matching periods.",
    why: "It compares excess return with the amount of fluctuation taken to earn it.",
    watch:
      "It treats upward and downward variation alike and can hide rare losses. Compare the period and drawdown too.",
    example:
      "A 10% annual excess return divided by 20% annual volatility gives a Sharpe ratio of 0.5.",
    related: ["Drawdown", "Expectancy", "Volatility Risk Premium"],
    aliases: [],
  },
  {
    t: "Margin & The Margin Call",
    cat: "risk",
    tag: "managing risk",
    def: "For securities, margin involves borrowing against account assets. For futures, it is a performance deposit. A margin call asks for more funds or less exposure.",
    why: "Leverage magnifies gains and losses. Required collateral can rise while your position loses value.",
    watch:
      "A broker may liquidate without waiting for you. Margin requirements are not the most you can lose.",
    example:
      "A $10,000 share position funded with $5,000 of your money loses 20% of that equity after a $1,000 price decline, before interest.",
    related: ["Futures Contract", "Position Sizing", "Pattern Day Trader Rule"],
    aliases: [],
  },
  {
    t: "Pattern Day Trader Rule",
    cat: "risk",
    tag: "managing risk",
    def: "US day-trading margin rules are transitioning from the PDT trade-count system to intraday risk-based margin. Your broker's adoption determines which applies.",
    why: "Under the new framework, there is no PDT trade count or $25,000 day-trading minimum. Brokers can impose stricter limits.",
    watch:
      "FINRA's new rules took effect June 4, 2026; firms may transition through October 20, 2027. Ask your broker which framework applies.",
    example:
      "Under the old framework, four or more day trades in five business days can trigger PDT if they exceed 6% of the account’s total trades in that period.",
    related: ["Margin & The Margin Call", "Position Sizing", "Time in Force"],
    source: [
      "FINRA: day-trading margin rules",
      "https://www.finra.org/investors/insights/intraday-margin-requirements",
    ],
    aliases: ["PDT", "day trading", "intraday margin", "$25,000"],
  },
  {
    t: "Revenge Trading",
    cat: "psych",
    tag: "decision habits",
    def: "Taking an unplanned trade to win back a loss quickly.",
    why: "It can turn one controlled loss into a series of larger, poorly planned risks.",
    watch:
      "A personal pause rule or loss limit can help. No fixed number of losses is the right cutoff for every strategy.",
    example: "After losing $100, you double size on a trade that does not meet your entry rules.",
    related: ["Discipline & The Plan", "Position Sizing", "Loss Aversion"],
    aliases: [],
  },
  {
    t: "FOMO",
    cat: "psych",
    tag: "decision habits",
    def: "Fear of missing out: entering mainly because a move is happening without you.",
    why: "It can push you into a trade before you have an entry, exit, or risk budget.",
    watch:
      "A fast-rising price is not itself a reason to buy or sell. Check your plan before acting.",
    example:
      "You buy a sharp rise because everyone is posting gains, without knowing where you would exit.",
    related: ["Discipline & The Plan", "Revenge Trading", "Position Sizing"],
    aliases: ["fear of missing out"],
  },
  {
    t: "Discipline & The Plan",
    cat: "psych",
    tag: "decision habits",
    def: "Following written conditions for entering, sizing, managing, and exiting a trade.",
    why: "It makes decisions reviewable instead of relying on how you feel in the moment.",
    watch:
      "Following a plan does not make an unprofitable strategy profitable. Review results after costs.",
    example:
      "Your plan names the setup, entry condition, maximum risk, and reason to exit before the order.",
    related: ["Position Sizing", "Expectancy", "Confirmation Bias"],
    aliases: [],
  },
  {
    t: "Loss Aversion",
    cat: "psych",
    tag: "decision habits",
    def: "The tendency for a loss to feel more painful than an equal gain feels rewarding.",
    why: "It can encourage holding a losing trade simply to avoid realising the loss.",
    watch:
      "The strength of this bias varies by person and situation. An unrealised loss still reduces your account value.",
    example: "You move a planned stop because selling would make the loss feel final.",
    related: ["Discipline & The Plan", "Drawdown", "Revenge Trading"],
    aliases: [],
  },
  {
    t: "Confirmation Bias",
    cat: "psych",
    tag: "decision habits",
    def: "Giving more weight to information that supports what you already believe.",
    why: "It can turn research into a search for reassurance.",
    watch:
      "Write down what would disprove the idea before entry. Check that evidence as deliberately as supporting evidence.",
    example:
      "After buying, you read only bullish posts and dismiss a material negative development.",
    related: ["Discipline & The Plan", "Recency Bias", "Survivorship Bias"],
    aliases: [],
  },
  {
    t: "Recency Bias",
    cat: "psych",
    tag: "decision habits",
    def: "Giving recent events too much weight when judging what is likely next.",
    why: "A short winning or losing streak can distort your view of a strategy.",
    watch: "Recent conditions can matter, but a few outcomes cannot establish a lasting edge.",
    example: "Three wins make you increase size even though your plan has not changed.",
    related: ["Expectancy", "Discipline & The Plan", "Position Sizing"],
    aliases: [],
  },
  {
    t: "Survivorship Bias",
    cat: "psych",
    tag: "decision habits",
    def: "Studying only the winners or survivors while leaving out failures.",
    why: "It can make a strategy or market look much easier than it was.",
    watch: "Include failed assets, realistic costs, and the information available at the time.",
    example:
      "A backtest uses only today's index members and excludes companies that failed or were removed.",
    related: ["Expectancy", "Sharpe Ratio", "Confirmation Bias"],
    aliases: [],
  },
  {
    t: "Gamma Exposure (GEX)",
    cat: "modern",
    tag: "market mechanics",
    def: "An estimate of aggregate option gamma, often used to model dealers' possible hedging activity.",
    why: "It explores how hedging might dampen or amplify price moves under assumed positions.",
    watch:
      "Positions and hedges are not fully observable. Positive and negative gamma describe a model, not guaranteed price behaviour.",
    example:
      "A dealer short gamma may need to buy as price rises and sell as it falls to stay delta-neutral.",
    related: ["Gamma", "Delta", "Open Interest", "Zero-Gamma Flip"],
    aliases: [],
  },
  {
    t: "Payment For Order Flow (PFOF)",
    cat: "modern",
    tag: "market mechanics",
    def: "Payments a broker receives for routing customer orders to another firm for execution.",
    why: "It creates a potential conflict between routing revenue and execution quality.",
    watch:
      "Commission-free does not mean cost-free. Compare execution prices, spreads, and broker disclosures.",
    example:
      "A broker routes a retail order to a wholesaler and receives a payment for that order.",
    related: ["Bid / Ask / Spread", "Market vs. Limit", "Slippage"],
    aliases: [],
  },
  {
    t: "Dark Pools",
    cat: "modern",
    tag: "market mechanics",
    def: "Trading venues that do not display their full order book publicly before trades occur.",
    why: "They let participants seek liquidity without showing an order to the whole market.",
    watch:
      "Off-exchange trading is broader than dark pools. A trade print alone does not reveal intent or future direction.",
    example:
      "A large share transaction is executed away from a displayed exchange order book and later reported.",
    related: ["Level 2 & Time and Sales", "Volume", "Liquidity"],
    aliases: [],
  },
  {
    t: "Prediction Markets",
    cat: "modern",
    tag: "market mechanics",
    def: "Markets in contracts whose payout depends on a specified real-world outcome.",
    why: "Their prices can provide a rough view of participants' event expectations.",
    watch:
      "Price is not an objective probability. Liquidity, fees, settlement wording, and participant limits matter.",
    example:
      "A contract costs $0.60 and pays $1 if an event occurs: its price suggests roughly 60% odds before costs.",
    related: ["Liquidity", "Bid / Ask / Spread", "Expectancy"],
    aliases: [],
  },
  {
    t: "Prop Firms & Funded Accounts",
    cat: "modern",
    tag: "market mechanics",
    def: "Traditional prop firms trade their own capital. Retail funded-account businesses often sell evaluations under strict rules.",
    why: "The label alone does not tell you whether trading uses real money or a simulator.",
    watch:
      "Fees are real money at risk. Read payout terms, drawdown calculations, account type, and termination rules.",
    example:
      "A paid challenge may require reaching a profit target without breaching a trailing drawdown limit.",
    related: ["Drawdown", "Discipline & The Plan", "Position Sizing"],
    aliases: [],
  },
  {
    t: "Algorithmic & HFT Flow",
    cat: "modern",
    tag: "market mechanics",
    def: "Algorithmic trading uses programmed rules. High-frequency trading is a fast subset involving very short decision times.",
    why: "Automated execution and quoting affect liquidity and short-term price behaviour.",
    watch:
      "A chart cannot identify every algorithm or its purpose. Not every sudden move is deliberate stop hunting.",
    example:
      "A fund splits a large order into smaller timed orders rather than sending it all at once.",
    related: ["Liquidity", "Level 2 & Time and Sales", "Slippage"],
    aliases: [],
  },
  {
    t: "Zero-Gamma Flip",
    cat: "modern",
    tag: "market mechanics",
    def: "A modelled price where estimated aggregate dealer gamma changes sign.",
    why: "It can help describe a possible change in hedging behaviour within that model.",
    watch:
      "The sign pattern is not universal; models can have multiple flips. Vendor assumptions and positions can change the level.",
    example:
      "A model estimates positive gamma above $100 and negative gamma below $100. Its flip is near $100.",
    related: ["Gamma Exposure (GEX)", "Gamma", "Open Interest"],
    aliases: [],
  },
  {
    t: "Call Wall & Put Wall",
    cat: "modern",
    tag: "market mechanics",
    def: "Vendor-defined strikes with large estimated call or put positioning, often measured by gamma or open interest.",
    why: "They highlight concentrations worth comparing with actual price behaviour.",
    watch:
      "Definitions differ. A wall is not a guaranteed ceiling or floor, and open interest does not identify the position owner.",
    example:
      "A model marks $110 as a call wall because estimated call exposure is concentrated there.",
    related: ["Gamma Exposure (GEX)", "Open Interest", "Support & Resistance"],
    aliases: [],
  },
  {
    t: "OPEX & Triple Witching",
    cat: "modern",
    tag: "market mechanics",
    def: "OPEX means options expiration. Quarterly triple witching combines stock-option, index-option, and index-futures expirations.",
    why: "Expiring and rolling positions can change trading volume and hedging needs.",
    watch:
      "Check each product's calendar and settlement time. Expiration does not guarantee a large move or a price pin.",
    example:
      "The third Fridays of March, June, September, and December are common quarterly expiration dates; holidays can alter schedules.",
    related: ["Strike & Expiration", "Rollover", "Pin Risk"],
    aliases: [],
  },
  {
    t: "Gamma Squeeze",
    cat: "modern",
    tag: "market mechanics",
    def: "A possible feedback loop where option hedging adds buying as price rises, helping it rise further.",
    why: "It explains one way options activity can contribute to an unusually sharp move.",
    watch:
      "Call buying alone does not prove a squeeze. Actual dealer inventory, other hedges, and liquidity matter.",
    example: "A dealer short calls buys more shares as the calls' delta rises, adding demand.",
    related: ["Gamma", "Delta", "Float & The Short Squeeze"],
    aliases: [],
  },
  {
    t: "Leveraged & Inverse ETFs",
    cat: "modern",
    tag: "market mechanics",
    def: "Funds that commonly target a multiple or the opposite of an index's daily return.",
    why: "Returns over several days depend on the path, not simply the multiple of the total index return.",
    watch:
      "Compounding can help in trends and hurt in choppy markets. Read the objective and reset period for the exact fund.",
    example:
      "An index rises 10%, then falls 9.09% to flat. A 2× daily fund gains 20%, then loses 18.18%, ending about 1.82% down before fees.",
    related: ["Stock & ETF", "Correlation Risk", "Drawdown"],
    aliases: [],
  },
  {
    t: "Volatility ETPs",
    cat: "modern",
    tag: "market mechanics",
    def: "Exchange-traded products linked to volatility, often through VIX futures rather than the VIX index itself.",
    why: "They provide exposure to a futures strategy whose return can differ greatly from the VIX.",
    watch:
      "Roll effects, fees, leverage, and daily resets can cause large losses. Long holding periods are especially sensitive to the futures curve.",
    example:
      "The VIX rises 10%; a VIX-futures product need not rise 10%, because its contracts and exposure differ.",
    related: ["Contango & Backwardation", "Rollover", "Leveraged & Inverse ETFs"],
    aliases: [],
  },
  {
    t: "Overnight & 24-Hour Trading",
    cat: "modern",
    tag: "market mechanics",
    def: "Trading outside the regular US stock session, with access depending on the broker, venue, and security.",
    why: "News and price changes can happen while the regular exchange session is closed.",
    watch:
      "Spreads may be wider and liquidity thinner. Order types and stop eligibility vary by session; access is not universal.",
    example:
      "An eligible stock trades at 10 p.m. on a broker's overnight venue, ahead of the next regular session.",
    related: ["Liquidity", "Time in Force", "Gaps & Gap Fill"],
    aliases: [],
  },
  {
    t: "Circuit Breakers & Halts",
    cat: "structure",
    tag: "market basics",
    def: "Rules or events that temporarily pause trading in a security or across a market.",
    why: "You may be unable to enter or exit during a pause.",
    watch:
      "A stop cannot execute while trading is halted. Reopening prices and fills can be far from your plan.",
    example: "A stock is halted pending news and later reopens at a much different price.",
    related: ["Stop Order", "Gaps & Gap Fill", "Liquidity"],
    aliases: [],
  },
  {
    t: "Stock & ETF",
    cat: "structure",
    def: "A stock is an ownership share in a company. An ETF is a fund whose shares trade on an exchange, usually holding a basket of assets.",
    why: "They are common assets behind charts and stock options.",
    example:
      "Buying a share of a company is a stock investment. Buying an index ETF buys a share of a fund tracking that index.",
    watch:
      "An ETF can still be concentrated, leveraged, or complex. A basket does not automatically mean low risk.",
    related: ["Long & Short", "Volume", "Leveraged & Inverse ETFs"],
    tag: "market basics",
    aliases: ["shares", "exchange-traded fund"],
  },
  {
    t: "Long & Short",
    cat: "structure",
    def: "Long generally means you bought and hold an asset or contract. Short means you sold an asset you borrowed, or sold an option to open an obligation.",
    why: "The words describe your position, not just your opinion about direction.",
    example:
      "A long put is a bought option that generally benefits from a fall. A short put is a sold option that generally benefits from flat or rising prices.",
    watch:
      "Short stock and uncovered short calls can have unlimited loss. Short puts have large downside risk even though stock cannot fall below zero.",
    related: ["Call & Put", "Assignment & Exercise", "Float & The Short Squeeze"],
    tag: "market basics",
    aliases: ["bullish", "bearish", "buy to open", "sell to open"],
  },
  {
    t: "Premium",
    cat: "options",
    def: "The price paid by an option buyer and received by its seller, separate from the strike price.",
    why: "Most standard US stock-option quotes are per share, so multiply by 100 for a contract.",
    example: "A $3 quote costs $300 for one standard 100-share contract, plus fees.",
    watch:
      "Adjusted contracts can have different deliverables or multipliers. A low premium does not mean a low-risk trade.",
    related: ["Call & Put", "Strike & Expiration", "Intrinsic & Extrinsic Value"],
    tag: "option mechanics",
    aliases: ["contract cost", "option price"],
  },
  {
    t: "Moneyness (ITM / ATM / OTM)",
    cat: "options",
    def: "In the money (ITM) means positive intrinsic value. At the money (ATM) means near the strike. Out of the money (OTM) means no intrinsic value.",
    why: "It compares the stock price with the strike, not your profit with your cost.",
    example: "Stock $105: a $100 call is ITM and a $100 put is OTM. At $100, both are near ATM.",
    watch:
      "ITM does not mean profitable. A $100 call bought for $7 loses $200 if the stock expires at $105.",
    related: ["Call & Put", "Strike & Expiration", "Intrinsic & Extrinsic Value", "Premium"],
    tag: "option mechanics",
    aliases: ["in the money", "at the money", "out of the money"],
  },
];
