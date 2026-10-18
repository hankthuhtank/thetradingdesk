window.TDESK = window.TDESK || {};

window.TDESK.OPT_CATS = [
  ["dir", "Directional", "Positions built around a rise or fall. Timing and premium still matter."],
  [
    "inc",
    "Premium selling",
    "Collect a credit and take an obligation. A small credit can carry a large loss.",
  ],
  [
    "vol",
    "Movement & time",
    "Positions sensitive to move size, volatility, or the difference between expirations.",
  ],
  [
    "adv",
    "Advanced",
    "More complex payoffs, uneven risk, or uncovered options. Learn the individual legs first.",
  ],
];

window.TDESK.OPT_INTRO = [
  {
    n: "An option is a contract with a deadline",
    b: "It gives the buyer a right involving another asset, such as a stock. That asset is the underlying. The buyer pays a premium; the contract ends at expiration.",
    example: "You can buy a contract linked to a $100 stock without buying the shares themselves.",
    related: ["Stock & ETF", "Call & Put", "Premium"],
  },
  {
    n: "A call is a right to buy. A put is a right to sell.",
    b: "The agreed price is the strike. Bought calls generally benefit from a rise; bought puts generally benefit from a fall. Price, time, and volatility all affect their value.",
    example: "A $100 call gives a right to buy at $100. A $100 put gives a right to sell at $100.",
    related: ["Call & Put", "Strike & Expiration", "Long & Short"],
  },
  {
    n: "A $3 quote usually means $300 per contract",
    b: "A standard US stock option usually represents 100 shares. Quotes are per share: premium × 100 × contract count, plus fees. Adjusted contracts can differ.",
    example:
      "Two standard contracts quoted at $3 cost $600 before fees. The $100 strike is separate from this cost.",
    related: ["Premium", "The Options Chain", "Intrinsic & Extrinsic Value"],
  },
  {
    n: "Buying a right and selling an obligation are different",
    b: "Buy to open creates a long option. Sell to open creates a short option. A bought put is still long an option, even though it generally benefits from a price fall.",
    example:
      "If assigned on a standard short $100 put, you generally must buy 100 shares for $10,000.",
    related: ["Long & Short", "Assignment & Exercise", "Margin & The Margin Call"],
  },
  {
    n: "You can close the option before expiration",
    b: "A buyer can sell to close. A seller can buy to close. You do not have to exercise to realise a gain or loss, provided the market lets you close at an acceptable price.",
    example: "Buy a call for $3, sell it for $4: a $100 gain per standard contract before fees.",
    related: ["Bid / Ask / Spread", "Assignment & Exercise", "Pin Risk"],
  },
  {
    n: "Start with the cost and the worst outcome",
    b: "Name the underlying, call or put, strike, expiry, contract size, and full loss before placing an order. Learn in a practice account before putting money behind a new structure.",
    example:
      "A $300 bought option can lose the entire $300. Selling an option may expose you to far more than its premium.",
    related: ["Position Sizing", "Discipline & The Plan", "Moneyness (ITM / ATM / OTM)"],
  },
];

window.TDESK.OPT_STRUCTURES = [
  {
    id: "lc",
    n: "Long Call",
    cat: "dir",
    dir: "Bullish",
    risk: "Premium paid",
    lvl: 1,
    legs: [
      {
        t: "c",
        s: 1,
        k: 0,
      },
    ],
    want: "A rise large enough to cover the call's cost by expiry.",
    when: "Study how a bought call responds to price, time, and IV.",
    fails: "Price falls, stays flat, or rises too little to cover the premium.",
    trap: "A correct direction is not enough. A cheap out-of-the-money call can lose its full premium.",
    related: ["Call & Put", "Premium", "Theta"],
  },
  {
    id: "lp",
    n: "Long Put",
    cat: "dir",
    dir: "Bearish",
    risk: "Premium paid",
    lvl: 1,
    legs: [
      {
        t: "p",
        s: 1,
        k: 0,
      },
    ],
    want: "A fall large enough to cover the put's cost by expiry.",
    when: "Study a bearish position or protection for shares.",
    fails: "Price rises, or the decline is too small or too late.",
    trap: "Buying after a selloff may mean paying elevated IV. A bounce or IV drop can reduce the put's value.",
    related: ["Call & Put", "IV Crush", "Premium"],
  },
  {
    id: "bcs",
    n: "Bull Call Spread",
    cat: "dir",
    dir: "Bullish",
    risk: "Defined expiry loss",
    lvl: 2,
    legs: [
      {
        t: "c",
        s: 1,
        k: 0,
      },
      {
        t: "c",
        s: -1,
        k: 6,
      },
    ],
    want: "A rise toward or above the higher, sold call strike.",
    when: "Compare a capped bullish spread with buying a call alone.",
    fails:
      "A flat or falling stock can lose the debit. A larger rise does not increase profit beyond the cap.",
    trap: "Passing the short strike is the best expiry region, not a failure. You exchanged extra upside for lower cost.",
    related: ["Credit vs. Debit Spreads", "Strike & Expiration", "Assignment & Exercise"],
  },
  {
    id: "bps",
    n: "Bear Put Spread",
    cat: "dir",
    dir: "Bearish",
    risk: "Defined expiry loss",
    lvl: 2,
    legs: [
      {
        t: "p",
        s: 1,
        k: 0,
      },
      {
        t: "p",
        s: -1,
        k: -6,
      },
    ],
    want: "A fall toward or below the lower, sold put strike.",
    when: "Compare a capped bearish spread with buying a put alone.",
    fails:
      "A flat or rising stock can lose the debit. Further declines beyond the short strike add no profit.",
    trap: "It limits the value of crash protection. Passing the short strike reaches the expiry profit cap.",
    related: ["Credit vs. Debit Spreads", "Strike & Expiration", "Assignment & Exercise"],
  },
  {
    id: "bull-put",
    n: "Bull Put Spread",
    cat: "dir",
    dir: "Bullish",
    risk: "Defined expiry loss",
    lvl: 2,
    legs: [
      {
        t: "p",
        s: -1,
        k: -5,
      },
      {
        t: "p",
        s: 1,
        k: -11,
      },
    ],
    want: "Price above the sold put's strike at expiry.",
    when: "Study a bullish-to-neutral credit spread with a protective lower put.",
    fails: "A fall through both strikes reaches the maximum expiry loss.",
    trap: "A high chance of a small gain does not make the expected return positive.",
    related: ["Credit vs. Debit Spreads", "Strike & Expiration", "Assignment & Exercise"],
  },
  {
    id: "bear-call",
    n: "Bear Call Spread",
    cat: "dir",
    dir: "Bearish",
    risk: "Defined expiry loss",
    lvl: 2,
    legs: [
      {
        t: "c",
        s: -1,
        k: 5,
      },
      {
        t: "c",
        s: 1,
        k: 11,
      },
    ],
    want: "Price below the sold call's strike at expiry.",
    when: "Study a bearish-to-neutral credit spread with a protective higher call.",
    fails: "A rise through both strikes reaches the maximum expiry loss.",
    trap: "A resistance level is not protection; the bought call is what caps the spread's expiry loss.",
    related: ["Credit vs. Debit Spreads", "Strike & Expiration", "Assignment & Exercise"],
  },
  {
    id: "csp",
    n: "Cash-Secured Put",
    cat: "inc",
    dir: "Bullish",
    risk: "Large downside",
    lvl: 1,
    legs: [
      {
        t: "p",
        s: -1,
        k: -6,
      },
    ],
    want: "Price above the put strike, or assignment at a price you can fund.",
    when: "Study selling a put with the full share-purchase cash available.",
    fails: "The stock falls far below the strike and you must buy at the higher agreed price.",
    trap: "The premium is small compared with the possible share loss. Cash collateral does not remove downside.",
    related: ["Cash-Secured Put", "Assignment & Exercise", "Position Sizing"],
  },
  {
    id: "cc",
    n: "Covered Call",
    cat: "inc",
    dir: "Neutral to mildly bullish",
    risk: "Stock downside",
    lvl: 1,
    sh: 100,
    legs: [
      {
        t: "c",
        s: -1,
        k: 6,
      },
    ],
    want: "Keep the premium and accept a sale of your shares at the strike.",
    when: "Study exchanging potential share upside for an option credit.",
    fails:
      "A stock decline can create a large loss. A rally above the strike gives no further expiry gain.",
    trap: "It is still a stock-risk position. Being called away can occur at a loss relative to your share cost.",
    related: ["Covered Call", "Assignment & Exercise", "Stock & ETF"],
  },
  {
    id: "ic",
    n: "Iron Condor",
    cat: "inc",
    dir: "Neutral",
    risk: "Defined expiry loss",
    lvl: 2,
    legs: [
      {
        t: "p",
        s: 1,
        k: -13,
      },
      {
        t: "p",
        s: -1,
        k: -7,
      },
      {
        t: "c",
        s: -1,
        k: 7,
      },
      {
        t: "c",
        s: 1,
        k: 13,
      },
    ],
    want: "Price between the two sold strikes at expiry.",
    when: "Study combining a put credit spread and a call credit spread.",
    fails: "A large move either way can reach the maximum expiry loss.",
    trap: "The protection limits expiry risk only while the complete position is intact; assignment can leave shares.",
    related: ["Iron Condor", "Credit vs. Debit Spreads", "Pin Risk"],
  },
  {
    id: "ib",
    n: "Iron Butterfly",
    cat: "inc",
    dir: "Neutral",
    risk: "Defined expiry loss",
    lvl: 2,
    legs: [
      {
        t: "p",
        s: 1,
        k: -9,
      },
      {
        t: "p",
        s: -1,
        k: 0,
      },
      {
        t: "c",
        s: -1,
        k: 0,
      },
      {
        t: "c",
        s: 1,
        k: 9,
      },
    ],
    want: "Price near the shared sold strike at expiry.",
    when: "Study a higher-credit, narrower-range alternative to an iron condor.",
    fails: "Moving far enough from the middle strike creates a loss.",
    trap: "The maximum gain needs an exact expiry price. A move away can still be profitable within the breakevens.",
    related: ["Credit vs. Debit Spreads", "Strike & Expiration", "Assignment & Exercise"],
  },
  {
    id: "ss",
    n: "Short Strangle",
    cat: "inc",
    dir: "Neutral",
    risk: "Unlimited upside loss",
    lvl: 3,
    legs: [
      {
        t: "p",
        s: -1,
        k: -8,
      },
      {
        t: "c",
        s: -1,
        k: 8,
      },
    ],
    want: "Price between the sold put and call strikes at expiry.",
    when: "Study the risk that protective wings remove from a condor.",
    fails: "A large rise creates unlimited call-side loss; a fall creates large put-side loss.",
    trap: "Margin and a stop order do not cap the worst-case loss.",
    related: ["Long & Short", "Margin & The Margin Call", "Gamma"],
  },
  {
    id: "straddle",
    n: "Long Straddle",
    cat: "vol",
    dir: "Big move, either way",
    risk: "Premium paid",
    lvl: 2,
    legs: [
      {
        t: "c",
        s: 1,
        k: 0,
      },
      {
        t: "p",
        s: 1,
        k: 0,
      },
    ],
    want: "A large enough move in either direction to cover both bought options.",
    when: "Compare a non-directional long-volatility position with buying one option.",
    fails: "A small move leaves both premiums partly or fully lost.",
    trap: "An earnings move can be smaller than the amount already priced in. IV can also fall after the event.",
    related: ["Credit vs. Debit Spreads", "Strike & Expiration", "Assignment & Exercise"],
  },
  {
    id: "strangle",
    n: "Long Strangle",
    cat: "vol",
    dir: "Big move, either way",
    risk: "Premium paid",
    lvl: 2,
    legs: [
      {
        t: "p",
        s: 1,
        k: -6,
      },
      {
        t: "c",
        s: 1,
        k: 6,
      },
    ],
    want: "A large move beyond the two out-of-the-money strikes and the total cost.",
    when: "Compare a lower-cost but wider-breakeven alternative to a straddle.",
    fails: "A modest move may leave both options worthless at expiry.",
    trap: "Lower cost alone does not mean better value; the required move is usually larger.",
    related: ["Credit vs. Debit Spreads", "Strike & Expiration", "Assignment & Exercise"],
  },
  {
    id: "cal",
    n: "Calendar Spread",
    cat: "vol",
    dir: "Neutral, near term",
    risk: "Debit + assignment risk",
    lvl: 3,
    legs: [
      {
        t: "c",
        s: -1,
        k: 0,
        x: 1,
      },
      {
        t: "c",
        s: 1,
        k: 0,
        x: 2,
      },
    ],
    want: "Price near a shared strike as the nearer option expires.",
    when: "Study selling a nearer option and buying the same strike further out.",
    fails: "A large move away or an adverse change in the two expirations' IV can reduce value.",
    trap: "The long leg still has time value at the first expiry. There is no fixed final-payoff peak at that date.",
    related: ["Theta", "Vega", "Assignment & Exercise"],
  },
  {
    id: "diag",
    n: "Diagonal Spread",
    cat: "vol",
    dir: "Mildly directional",
    risk: "Complex assignment risk",
    lvl: 3,
    legs: [
      {
        t: "c",
        s: -1,
        k: 5,
        x: 1,
      },
      {
        t: "c",
        s: 1,
        k: 0,
        x: 2,
      },
    ],
    want: "A favourable move toward the sold strike as the near option decays.",
    when: "Study a spread with different strikes and expirations.",
    fails: "Adverse price moves, IV changes, or short-leg assignment can disrupt the position.",
    trap: "A long call is not 100 shares. Assignment can create a share obligation while the long option remains open.",
    related: ["LEAPS", "Delta", "Assignment & Exercise"],
  },
  {
    id: "fly",
    n: "Long Butterfly",
    cat: "adv",
    dir: "Pinned",
    risk: "Defined expiry loss",
    lvl: 2,
    legs: [
      {
        t: "c",
        s: 1,
        k: -6,
      },
      {
        t: "c",
        s: -1,
        k: 0,
      },
      {
        t: "c",
        s: -1,
        k: 0,
      },
      {
        t: "c",
        s: 1,
        k: 6,
      },
    ],
    want: "Price near the middle strike at expiry.",
    when: "Study a defined-risk position with a narrow profit area.",
    fails: "Price outside the outer strikes loses the debit at expiry.",
    trap: "A high payoff ratio does not give a high probability of reaching it.",
    related: ["Credit vs. Debit Spreads", "Strike & Expiration", "Assignment & Exercise"],
  },
  {
    id: "bwb",
    n: "Broken Wing Butterfly",
    cat: "adv",
    dir: "Directional lean",
    risk: "Defined, uneven",
    lvl: 3,
    legs: [
      {
        t: "p",
        s: 1,
        k: -15,
      },
      {
        t: "p",
        s: -1,
        k: -5,
      },
      {
        t: "p",
        s: -1,
        k: -5,
      },
      {
        t: "p",
        s: 1,
        k: 0,
      },
    ],
    want: "Price near the middle strike, with unequal wing widths.",
    when: "Study how moving one protective strike changes a butterfly's risk.",
    fails: "A move into the wider wing can create the larger expiry loss.",
    trap: "A credit entry is not guaranteed. The direction with no expiry loss depends on strikes and actual premium.",
    related: ["Credit vs. Debit Spreads", "Strike & Expiration", "Assignment & Exercise"],
  },
  {
    id: "jade",
    n: "Jade Lizard",
    cat: "adv",
    dir: "Neutral to bullish",
    risk: "Large downside",
    lvl: 3,
    legs: [
      {
        t: "p",
        s: -1,
        k: -7,
      },
      {
        t: "c",
        s: -1,
        k: 6,
      },
      {
        t: "c",
        s: 1,
        k: 12,
      },
    ],
    want: "Price between the sold put and call strikes at expiry.",
    when: "Study a short put combined with a call credit spread.",
    fails:
      "A fall creates large put losses. A rise can also lose if the total credit is less than the call-spread width.",
    trap: "No upside expiry loss requires credit at least equal to the call-spread width, before fees. The model may not meet that condition.",
    related: ["Cash-Secured Put", "Credit vs. Debit Spreads", "Assignment & Exercise"],
  },
  {
    id: "ratio",
    n: "Ratio Spread",
    cat: "adv",
    dir: "Measured move",
    risk: "Unlimited upside loss",
    lvl: 3,
    legs: [
      {
        t: "c",
        s: 1,
        k: 0,
      },
      {
        t: "c",
        s: -1,
        k: 7,
      },
      {
        t: "c",
        s: -1,
        k: 7,
      },
    ],
    want: "A measured rise toward the two sold call strikes.",
    when: "Study why an extra sold call changes a bull spread into an uncovered position.",
    fails: "A strong rise leaves one net uncovered call and unlimited upside loss.",
    trap: "A credit at entry does not mean a safe trade. The second sold call funds the premium and adds the main risk.",
    related: ["Long & Short", "Gamma", "Margin & The Margin Call"],
  },
];

window.TDESK.OPT_LESSONS = [
  {
    id: "price",
    n: "Price: intrinsic plus extrinsic value",
    b: "A $100 call on a $105 stock has $5 of intrinsic value. If its premium is $7, the remaining $2 is extrinsic value: what the market pays above immediate exercise value.",
    t: "At expiry, extrinsic value is zero. Before expiry, an option can be sold for more or less than its eventual expiry payoff.",
    related: ["Intrinsic & Extrinsic Value", "Premium"],
  },
  {
    id: "theta",
    n: "Time: the clock keeps changing",
    b: "Theta estimates one day of price change from time alone. Near-the-money decay often accelerates near expiry, but it varies by strike, IV, and remaining time.",
    t: "There is no universally best number of days to buy or sell. Choose a horizon that matches the idea and compare the full premium at risk.",
    related: ["Theta", "Strike & Expiration"],
  },
  {
    id: "iv",
    n: "Volatility: the stock can move your way and you still lose",
    b: "A fall in IV can reduce a bought option’s value. After earnings, a favourable stock move may be too small to offset the uncertainty premium that disappears.",
    t: "IV rank adds historical context; it does not automatically tell you to buy low or sell high.",
    related: ["Implied Volatility (IV)", "IV Crush", "Vega"],
  },
  {
    id: "defined",
    n: "Risk: a spread has conditions",
    b: "A same-expiry vertical spread combines a bought and sold option. With both legs intact, its expiry loss can be calculated from the strike width and net premium.",
    t: "Assignment, exercise, fees, or closing one leg can create different exposure. Defined expiry risk is not a guarantee about every account outcome.",
    related: ["Credit vs. Debit Spreads", "Assignment & Exercise"],
  },
  {
    id: "liq",
    n: "Execution: the spread is a real cost",
    b: "If you buy at $1.05 and immediately sell at a $0.95 bid, you lose $0.10 per share: $10 per standard contract, before fees. You do not pay two full spreads for that unchanged round trip.",
    t: "A limit order controls the worst acceptable price, but may not fill. Volume and open interest alone do not guarantee liquidity.",
    related: ["Bid / Ask / Spread", "Liquidity", "Market vs. Limit"],
  },
  {
    id: "assign",
    n: "Exercise: know whether you could end up with shares",
    b: "American-style options can be exercised before expiry. Short calls near an ex-dividend date and deep-in-the-money puts deserve attention, but assignment is never limited to one scenario.",
    t: "European-style products do not allow early exercise. Cash settlement, exercise timing, and final-settlement risk still need checking.",
    related: ["Assignment & Exercise", "Pin Risk"],
  },
  {
    id: "exp",
    n: "Expiration: small moves can change exposure quickly",
    b: "Gamma can become very large near the strike close to expiry. A spread can also leave a share position if only one leg is exercised or assigned.",
    t: "An expiry breakeven is not the price required to sell the option at a profit earlier. Earlier prices still include time value.",
    related: ["Gamma", "0DTE Options", "Pin Risk"],
  },
  {
    id: "size",
    n: "Sizing: calculate the dollars before the contracts",
    b: "For a bought option, full premium × multiplier is the option loss at risk. For a standard $5-wide credit spread sold for $2, maximum intact expiry loss is ($5 − $2) × 100 = $300.",
    t: "Fees and execution costs add to losses. Stops and margin do not replace a calculation of the full exposure.",
    related: ["Position Sizing", "Premium", "Margin & The Margin Call"],
  },
];

window.TDESK.OPT_TIERS = {
  1: ["Foundation", "A simpler construction to study first. Simpler does not mean low risk."],
  2: [
    "Spreads & combinations",
    "Understand every leg, its expiry payoff, and any assignment obligation.",
  ],
  3: [
    "Advanced",
    "Different expirations, uneven wings, or uncovered positions require extra care.",
  ],
};

window.TDESK.OPT_PLAYS = {
  lc: {
    tier: 1,
    legs: ["BUY 1 call at $100"],
    cost: "$3 debit = $300 paid",
    max: "Max loss $300; theoretical gain uncapped.",
    be: "$103 at expiry.",
    math: "(max(stock − $100, 0) − $3) × 100",
    enter:
      "Check the bid and ask of every leg, contract multiplier, expiry, and total debit or credit.",
    manage:
      "Review the full position as price, time, and IV change. A roll closes one trade and opens another; it does not erase a loss.",
    exit: "Choose an exit plan before entry. For multiple legs, understand the exposure left behind if only part of the position closes.",
    size: "Use the full possible loss and any share obligation to check affordability. The credit received is not the risk budget.",
    source: [
      "OIC: options strategies",
      "https://www.optionseducation.org/strategies/all-strategies",
    ],
  },
  lp: {
    tier: 1,
    legs: ["BUY 1 put at $100"],
    cost: "$3 debit = $300 paid",
    max: "Max loss $300; max gain $9,700 if stock is zero.",
    be: "$97 at expiry.",
    math: "(max($100 − stock, 0) − $3) × 100",
    enter:
      "Check the bid and ask of every leg, contract multiplier, expiry, and total debit or credit.",
    manage:
      "Review the full position as price, time, and IV change. A roll closes one trade and opens another; it does not erase a loss.",
    exit: "Choose an exit plan before entry. For multiple legs, understand the exposure left behind if only part of the position closes.",
    size: "Use the full possible loss and any share obligation to check affordability. The credit received is not the risk budget.",
    source: [
      "OIC: options strategies",
      "https://www.optionseducation.org/strategies/all-strategies",
    ],
  },
  bcs: {
    tier: 2,
    legs: ["BUY 1 call at $100", "SELL 1 call at $105"],
    cost: "$2 net debit = $200 paid",
    max: "Max loss $200; max gain $300.",
    be: "$102 at expiry.",
    math: "($5 width − $2 debit) × 100 = $300 max gain",
    enter:
      "Check the bid and ask of every leg, contract multiplier, expiry, and total debit or credit.",
    manage:
      "Review the full position as price, time, and IV change. A roll closes one trade and opens another; it does not erase a loss.",
    exit: "Choose an exit plan before entry. For multiple legs, understand the exposure left behind if only part of the position closes.",
    size: "Use the full possible loss and any share obligation to check affordability. The credit received is not the risk budget.",
    source: [
      "OIC: options strategies",
      "https://www.optionseducation.org/strategies/all-strategies",
    ],
  },
  bps: {
    tier: 2,
    legs: ["BUY 1 put at $100", "SELL 1 put at $95"],
    cost: "$2 net debit = $200 paid",
    max: "Max loss $200; max gain $300.",
    be: "$98 at expiry.",
    math: "($5 width − $2 debit) × 100 = $300 max gain",
    enter:
      "Check the bid and ask of every leg, contract multiplier, expiry, and total debit or credit.",
    manage:
      "Review the full position as price, time, and IV change. A roll closes one trade and opens another; it does not erase a loss.",
    exit: "Choose an exit plan before entry. For multiple legs, understand the exposure left behind if only part of the position closes.",
    size: "Use the full possible loss and any share obligation to check affordability. The credit received is not the risk budget.",
    source: [
      "OIC: options strategies",
      "https://www.optionseducation.org/strategies/all-strategies",
    ],
  },
  "bull-put": {
    tier: 2,
    legs: ["SELL 1 put at $95", "BUY 1 put at $90"],
    cost: "$2 net credit = $200 received",
    max: "Max gain $200; max loss $300.",
    be: "$93 at expiry.",
    math: "($5 width − $2 credit) × 100 = $300 max loss",
    enter:
      "Check the bid and ask of every leg, contract multiplier, expiry, and total debit or credit.",
    manage:
      "Review the full position as price, time, and IV change. A roll closes one trade and opens another; it does not erase a loss.",
    exit: "Choose an exit plan before entry. For multiple legs, understand the exposure left behind if only part of the position closes.",
    size: "Use the full possible loss and any share obligation to check affordability. The credit received is not the risk budget.",
    source: [
      "OIC: options strategies",
      "https://www.optionseducation.org/strategies/all-strategies",
    ],
  },
  "bear-call": {
    tier: 2,
    legs: ["SELL 1 call at $105", "BUY 1 call at $110"],
    cost: "$2 net credit = $200 received",
    max: "Max gain $200; max loss $300.",
    be: "$107 at expiry.",
    math: "($5 width − $2 credit) × 100 = $300 max loss",
    enter:
      "Check the bid and ask of every leg, contract multiplier, expiry, and total debit or credit.",
    manage:
      "Review the full position as price, time, and IV change. A roll closes one trade and opens another; it does not erase a loss.",
    exit: "Choose an exit plan before entry. For multiple legs, understand the exposure left behind if only part of the position closes.",
    size: "Use the full possible loss and any share obligation to check affordability. The credit received is not the risk budget.",
    source: [
      "OIC: options strategies",
      "https://www.optionseducation.org/strategies/all-strategies",
    ],
  },
  csp: {
    tier: 1,
    legs: ["SELL 1 put at $95", "HOLD $9,500 cash for assignment"],
    cost: "$2 credit = $200 received",
    max: "Max gain $200; max loss $9,300 if stock is zero.",
    be: "$93 at expiry.",
    math: "($95 strike − $2 premium) × 100 = $9,300 max loss",
    enter:
      "Check the bid and ask of every leg, contract multiplier, expiry, and total debit or credit.",
    manage:
      "Review the full position as price, time, and IV change. A roll closes one trade and opens another; it does not erase a loss.",
    exit: "Choose an exit plan before entry. For multiple legs, understand the exposure left behind if only part of the position closes.",
    size: "Include the stock falling to zero, not just the option credit. Check cash or share requirements for assignment.",
    source: [
      "OIC: options strategies",
      "https://www.optionseducation.org/strategies/all-strategies",
    ],
  },
  cc: {
    tier: 1,
    legs: ["OWN 100 shares bought at $100", "SELL 1 call at $105"],
    cost: "$2 option credit = $200; shares cost $10,000",
    max: "Max gain $700; max loss $9,800 if stock is zero.",
    be: "$98 including the share cost and premium.",
    math: "($105 strike − $100 share cost + $2 credit) × 100 = $700 max gain",
    enter:
      "Check the bid and ask of every leg, contract multiplier, expiry, and total debit or credit.",
    manage:
      "Review the full position as price, time, and IV change. A roll closes one trade and opens another; it does not erase a loss.",
    exit: "Choose an exit plan before entry. For multiple legs, understand the exposure left behind if only part of the position closes.",
    size: "Include the stock falling to zero, not just the option credit. Check cash or share requirements for assignment.",
    source: [
      "OIC: options strategies",
      "https://www.optionseducation.org/strategies/all-strategies",
    ],
  },
  ic: {
    tier: 2,
    legs: ["BUY 1 put at $90", "SELL 1 put at $95", "SELL 1 call at $105", "BUY 1 call at $110"],
    cost: "$2 total net credit = $200 received",
    max: "Max gain $200; max loss $300.",
    be: "$93 and $107 at expiry.",
    math: "($5 wing width − $2 credit) × 100 = $300 max loss",
    enter:
      "Check the bid and ask of every leg, contract multiplier, expiry, and total debit or credit.",
    manage:
      "Review the full position as price, time, and IV change. A roll closes one trade and opens another; it does not erase a loss.",
    exit: "Choose an exit plan before entry. For multiple legs, understand the exposure left behind if only part of the position closes.",
    size: "Use the full possible loss and any share obligation to check affordability. The credit received is not the risk budget.",
    source: [
      "OIC: options strategies",
      "https://www.optionseducation.org/strategies/all-strategies",
    ],
  },
  ib: {
    tier: 2,
    legs: ["BUY 1 put at $90", "SELL 1 put at $100", "SELL 1 call at $100", "BUY 1 call at $110"],
    cost: "$4 total credit = $400 received",
    max: "Max gain $400 at $100; max loss $600.",
    be: "$96 and $104 at expiry.",
    math: "($10 wing width − $4 credit) × 100 = $600 max loss",
    enter:
      "Check the bid and ask of every leg, contract multiplier, expiry, and total debit or credit.",
    manage:
      "Review the full position as price, time, and IV change. A roll closes one trade and opens another; it does not erase a loss.",
    exit: "Choose an exit plan before entry. For multiple legs, understand the exposure left behind if only part of the position closes.",
    size: "Use the full possible loss and any share obligation to check affordability. The credit received is not the risk budget.",
    source: [
      "OIC: options strategies",
      "https://www.optionseducation.org/strategies/all-strategies",
    ],
  },
  ss: {
    tier: 3,
    legs: ["SELL 1 put at $95", "SELL 1 call at $105"],
    cost: "$3 total credit = $300 received",
    max: "Max gain $300; unlimited upside loss; $9,200 loss at zero.",
    be: "$92 and $108 at expiry.",
    math: "Below $95: ($95 − stock − $3) × 100 is the loss; above $105: (stock − $105 − $3) × 100",
    enter:
      "Check the bid and ask of every leg, contract multiplier, expiry, and total debit or credit.",
    manage:
      "Review the full position as price, time, and IV change. A roll closes one trade and opens another; it does not erase a loss.",
    exit: "Choose an exit plan before entry. For multiple legs, understand the exposure left behind if only part of the position closes.",
    size: "Loss is not capped above. No stop order or margin deposit turns this into a defined-loss position.",
    source: [
      "OIC: options strategies",
      "https://www.optionseducation.org/strategies/all-strategies",
    ],
  },
  straddle: {
    tier: 2,
    legs: ["BUY 1 call at $100", "BUY 1 put at $100"],
    cost: "$8 total debit = $800 paid",
    max: "Max loss $800 at $100; upside gain uncapped; gain $9,200 at zero.",
    be: "$92 and $108 at expiry.",
    math: "(|stock − $100| − $8) × 100",
    enter:
      "Check the bid and ask of every leg, contract multiplier, expiry, and total debit or credit.",
    manage:
      "Review the full position as price, time, and IV change. A roll closes one trade and opens another; it does not erase a loss.",
    exit: "Choose an exit plan before entry. For multiple legs, understand the exposure left behind if only part of the position closes.",
    size: "Use the full possible loss and any share obligation to check affordability. The credit received is not the risk budget.",
    source: [
      "OIC: options strategies",
      "https://www.optionseducation.org/strategies/all-strategies",
    ],
  },
  strangle: {
    tier: 2,
    legs: ["BUY 1 put at $95", "BUY 1 call at $105"],
    cost: "$4 total debit = $400 paid",
    max: "Max loss $400 between strikes; upside gain uncapped.",
    be: "$91 and $109 at expiry.",
    math: "(max($95 − stock, 0) + max(stock − $105, 0) − $4) × 100",
    enter:
      "Check the bid and ask of every leg, contract multiplier, expiry, and total debit or credit.",
    manage:
      "Review the full position as price, time, and IV change. A roll closes one trade and opens another; it does not erase a loss.",
    exit: "Choose an exit plan before entry. For multiple legs, understand the exposure left behind if only part of the position closes.",
    size: "Use the full possible loss and any share obligation to check affordability. The credit received is not the risk budget.",
    source: [
      "OIC: options strategies",
      "https://www.optionseducation.org/strategies/all-strategies",
    ],
  },
  cal: {
    tier: 3,
    legs: ["SELL 1 call at $100 · nearer expiry", "BUY 1 call at $100 · later expiry"],
    cost: "Assume a $2 net debit = $200 paid",
    max: "Debit is the basic risk reference if properly managed; assignment can create additional account exposure.",
    be: "No fixed first-expiry breakevens; the later option retains time value.",
    math: "At the first expiry: (remaining long-call value − short-call intrinsic value) × 100 − $200",
    enter:
      "Check the bid and ask of every leg, contract multiplier, expiry, and total debit or credit.",
    manage:
      "Monitor the near expiry and short-call assignment. Exercising the longer call can forfeit its remaining time value.",
    exit: "Choose an exit plan before entry. For multiple legs, understand the exposure left behind if only part of the position closes.",
    size: "Use the full possible loss and any share obligation to check affordability. The credit received is not the risk budget.",
    source: [
      "OIC: options strategies",
      "https://www.optionseducation.org/strategies/all-strategies",
    ],
  },
  diag: {
    tier: 3,
    legs: ["SELL 1 call at $105 · nearer expiry", "BUY 1 call at $100 · later expiry"],
    cost: "Assume a $4 net debit = $400 paid",
    max: "Outcome depends on both expirations and IV; short assignment can leave a share obligation.",
    be: "Model the first-expiry value; there is no single fixed expiry-payoff diagram.",
    math: "At the first expiry, subtract the short payoff and original debit from the remaining long-call value",
    enter:
      "Check the bid and ask of every leg, contract multiplier, expiry, and total debit or credit.",
    manage:
      "Monitor the near expiry and short-call assignment. Exercising the longer call can forfeit its remaining time value.",
    exit: "Choose an exit plan before entry. For multiple legs, understand the exposure left behind if only part of the position closes.",
    size: "Use the full possible loss and any share obligation to check affordability. The credit received is not the risk budget.",
    source: [
      "OIC: options strategies",
      "https://www.optionseducation.org/strategies/all-strategies",
    ],
  },
  fly: {
    tier: 2,
    legs: ["BUY 1 call at $95", "SELL 2 calls at $100", "BUY 1 call at $105"],
    cost: "$1 total debit = $100 paid",
    max: "Max loss $100; max gain $400 at $100.",
    be: "$96 and $104 at expiry.",
    math: "($5 wing width − $1 debit) × 100 = $400 max gain",
    enter:
      "Check the bid and ask of every leg, contract multiplier, expiry, and total debit or credit.",
    manage:
      "Review the full position as price, time, and IV change. A roll closes one trade and opens another; it does not erase a loss.",
    exit: "Choose an exit plan before entry. For multiple legs, understand the exposure left behind if only part of the position closes.",
    size: "Use the full possible loss and any share obligation to check affordability. The credit received is not the risk budget.",
    source: [
      "OIC: options strategies",
      "https://www.optionseducation.org/strategies/all-strategies",
    ],
  },
  bwb: {
    tier: 3,
    legs: ["BUY 1 put at $85", "SELL 2 puts at $95", "BUY 1 put at $100"],
    cost: "Assume a $0.50 net debit = $50 paid",
    max: "Max gain $450 at $95; max loss $550 at or below $85.",
    be: "$90.50 and $99.50 at expiry.",
    math: "Lower wing $10, upper wing $5: max loss ($10 − $5 + $0.50) × 100 = $550",
    enter:
      "Check the bid and ask of every leg, contract multiplier, expiry, and total debit or credit.",
    manage:
      "Review the full position as price, time, and IV change. A roll closes one trade and opens another; it does not erase a loss.",
    exit: "Choose an exit plan before entry. For multiple legs, understand the exposure left behind if only part of the position closes.",
    size: "Use the full possible loss and any share obligation to check affordability. The credit received is not the risk budget.",
    source: [
      "OIC: options strategies",
      "https://www.optionseducation.org/strategies/all-strategies",
    ],
  },
  jade: {
    tier: 3,
    legs: ["SELL 1 put at $95", "SELL 1 call at $105", "BUY 1 call at $110"],
    cost: "Assume $5.20 total credit = $520 received",
    max: "Max gain $520; loss $8,980 at zero; $20 gain above $110 before fees.",
    be: "$89.80 at expiry; no upper breakeven in this example.",
    math: "Upside expiry result ($5.20 credit − $5 call width) × 100 = $20; a smaller credit can leave upside loss",
    enter:
      "Check the bid and ask of every leg, contract multiplier, expiry, and total debit or credit.",
    manage:
      "Review the full position as price, time, and IV change. A roll closes one trade and opens another; it does not erase a loss.",
    exit: "Choose an exit plan before entry. For multiple legs, understand the exposure left behind if only part of the position closes.",
    size: "Include the stock falling to zero, not just the option credit. Check cash or share requirements for assignment.",
    source: [
      "OIC: options strategies",
      "https://www.optionseducation.org/strategies/all-strategies",
    ],
  },
  ratio: {
    tier: 3,
    legs: ["BUY 1 call at $100", "SELL 2 calls at $105"],
    cost: "Assume $0.50 total credit = $50 received",
    max: "Max gain $550 at $105; unlimited upside loss.",
    be: "$110.50 at expiry; below $100 keeps the $50 credit.",
    math: "Upper breakeven: 2 × $105 − $100 + $0.50 = $110.50",
    enter:
      "Check the bid and ask of every leg, contract multiplier, expiry, and total debit or credit.",
    manage:
      "Review the full position as price, time, and IV change. A roll closes one trade and opens another; it does not erase a loss.",
    exit: "Choose an exit plan before entry. For multiple legs, understand the exposure left behind if only part of the position closes.",
    size: "Loss is not capped above. No stop order or margin deposit turns this into a defined-loss position.",
    source: [
      "OIC: options strategies",
      "https://www.optionseducation.org/strategies/all-strategies",
    ],
  },
};
