/* ============================================================
   THE TRADING DESK - THE OPTIONS FLOOR
   Structures are defined by their legs so the Lab can build and
   price every one of them from live inputs. Strike offsets are a
   percentage from spot, which keeps a structure the same shape
   whether you point it at a $9 stock or a 6,000 index.
     t: 'c' call, 'p' put      s: +1 long, -1 short
     k: strike as % from spot  x: expiry multiplier (1 = near, 2 = far)
   sh: shares held alongside the legs, so a covered call is priced as
       the stock-plus-short-call it actually is rather than a naked call
   ============================================================ */
window.TDESK = window.TDESK || {};

window.TDESK.OPT_CATS = [
  ['dir',  'Directional',  'You have a view on where it goes, and you want the leverage without the loss that comes with being wrong twice.'],
  ['inc',  'Income',       'You are selling somebody else time and volatility. Wins are small and frequent; the losses are the whole job.'],
  ['vol',  'Volatility',   'No directional view at all. You are betting on the size of the move, or on the size of the move being wrong.'],
  ['adv',  'Advanced',     'Structures that trade one specific risk for another. Every one of them exists because a simpler structure had a flaw somebody wanted gone.']
];

window.TDESK.OPT_STRUCTURES = [

/* ---------------- DIRECTIONAL ---------------- */
{id:'lc', n:'Long Call', cat:'dir', dir:'Bullish', risk:'Defined', lvl:2,
 legs:[{t:'c',s:1,k:0}],
 want:'Up, and soon. Every day you are right but early costs you money.',
 when:'A strong directional read with a catalyst inside the expiry, and implied volatility that is not already elevated.',
 fails:'Sideways. The stock can finish exactly where you predicted and you still lose, because time was never free.',
 trap:'Buying cheap far-out-of-the-money calls because the payoff table looks exciting. The most likely outcome of a 0.10 delta call is zero, and it is the most likely outcome by a wide margin.'},

{id:'lp', n:'Long Put', cat:'dir', dir:'Bearish', risk:'Defined', lvl:2,
 legs:[{t:'p',s:1,k:0}],
 want:'Down, and soon. Same clock as a long call, running against you daily.',
 when:'A bearish read, or as insurance on shares you own and intend to keep.',
 fails:'A slow drift down that never arrives before expiry, or a volatility collapse that shrinks the premium faster than price falls.',
 trap:'Buying puts after the drop has started. Implied volatility spikes on the way down, so protection costs the most exactly when you finally want it.'},

{id:'bcs', n:'Bull Call Spread', cat:'dir', dir:'Bullish', risk:'Defined', lvl:3,
 legs:[{t:'c',s:1,k:0},{t:'c',s:-1,k:6}],
 want:'Up to the short strike, no further. Past it you stop earning.',
 when:'You are bullish but the premium is rich, or you want a known cost and a known ceiling instead of an open-ended bet.',
 fails:'A move so large it blows through the short strike, where you watch the rest of the run without you.',
 trap:'Setting the short strike too close because it makes the trade nearly free. You have then sold the entire move you were trying to buy.'},

{id:'bps', n:'Bear Put Spread', cat:'dir', dir:'Bearish', risk:'Defined', lvl:3,
 legs:[{t:'p',s:1,k:0},{t:'p',s:-1,k:-6}],
 want:'Down to the short strike. The mirror of the bull call spread.',
 when:'Bearish with elevated volatility, where an outright put is too expensive to justify.',
 fails:'A crash straight through your short strike, which caps you well above the move you called correctly.',
 trap:'Treating it as a crash hedge. It is a measured-move trade, and a real crash is exactly where it stops paying.'},

{id:'bull-put', n:'Bull Put Spread', cat:'dir', dir:'Bullish', risk:'Defined', lvl:3,
 legs:[{t:'p',s:-1,k:-5},{t:'p',s:1,k:-11}],
 want:'Anything except a real drop. Up, flat, or slightly down all pay the same.',
 when:'Bullish-to-neutral with high implied volatility, so you are selling expensive premium rather than buying it.',
 fails:'A hard drop through the short strike. Your maximum loss is several times the credit you collected, which is the arrangement you agreed to.',
 trap:'The win rate flatters you. Winning eight of ten trades means nothing if the two losses are five times the size of a win, and that is the default geometry here.'},

{id:'bear-call', n:'Bear Call Spread', cat:'dir', dir:'Bearish', risk:'Defined', lvl:3,
 legs:[{t:'c',s:-1,k:5},{t:'c',s:1,k:11}],
 want:'Anything except a rally. Flat and down both pay in full.',
 when:'Bearish-to-neutral into resistance, with rich premium to sell.',
 fails:'A grinding rally through the short strike, and rallies grind more often than they crash.',
 trap:'Selling calls above a level you have not actually checked. The short strike needs to sit above real resistance, not above a round number that feels far away.'},

/* ---------------- INCOME ---------------- */
{id:'csp', n:'Cash-Secured Put', cat:'inc', dir:'Bullish', risk:'Defined by the strike', lvl:2,
 legs:[{t:'p',s:-1,k:-6}],
 want:'Flat or up. If it drops below your strike you buy the shares, which you should have wanted anyway.',
 when:'You are willing to own the stock at the strike price and you have the cash sitting there to do it.',
 fails:'A collapse well below the strike. You own shares at a price that made sense last week and does not now.',
 trap:'Selling puts on something you would never actually want to own, purely because the premium is fat. Fat premium is the market telling you the risk is real.'},

{id:'cc', n:'Covered Call', cat:'inc', dir:'Neutral to mildly bullish', risk:'Capped upside', lvl:2,
 sh:100,
 legs:[{t:'c',s:-1,k:6}],
 want:'Flat, or up to your short strike. You are renting out the upside you were not counting on.',
 when:'You hold 100 shares, you are not expecting a violent move up, and you want the shares to pay you something while you wait.',
 fails:'The stock gaps far above the strike. You keep the premium and lose the entire move above it.',
 trap:'Selling calls on a position you are emotionally attached to. When it runs and gets called away, most people chase it back at a higher price, which converts a small win into a real loss.'},

{id:'ic', n:'Iron Condor', cat:'inc', dir:'Neutral', risk:'Defined', lvl:3,
 legs:[{t:'p',s:1,k:-13},{t:'p',s:-1,k:-7},{t:'c',s:-1,k:7},{t:'c',s:1,k:13}],
 want:'Nothing. Literally nothing. You profit if price stays inside your two short strikes and volatility falls.',
 when:'High implied volatility relative to its own recent range, in something that has been rotating rather than trending.',
 fails:'A trend. Any real move in either direction takes it out, and the loss is far larger than the credit.',
 trap:'It looks like free money because it wins most of the time. The distribution is brutally asymmetric: many small wins, occasional large losses. Manage it early, take profit at half the credit, and never let it run into expiry untouched.'},

{id:'ib', n:'Iron Butterfly', cat:'inc', dir:'Neutral', risk:'Defined', lvl:3,
 legs:[{t:'p',s:1,k:-9},{t:'p',s:-1,k:0},{t:'c',s:-1,k:0},{t:'c',s:1,k:9}],
 want:'Price to finish exactly where it is now. A condor with the two short strikes collapsed onto the money.',
 when:'You want a larger credit than a condor and you have a genuine reason to think price is pinned.',
 fails:'Any move at all. The profit zone is a needle compared to a condor.',
 trap:'Taking the bigger credit without pricing the much narrower window. You are paid more because you are far more likely to be wrong.'},

{id:'ss', n:'Short Strangle', cat:'inc', dir:'Neutral', risk:'UNDEFINED', lvl:3,
 legs:[{t:'p',s:-1,k:-8},{t:'c',s:-1,k:8}],
 want:'Price to stay between your strikes while volatility bleeds out.',
 when:'Rarely, and only with the account and the discipline to manage it actively. This is an iron condor without the insurance.',
 fails:'A gap. Loss on the call side is theoretically unlimited, and the put side runs to zero.',
 trap:'This structure is why brokers have levels. The buying power it ties up is large and it can go against you faster than you can react. If a defined-risk condor would express the same view, use the condor.'},

/* ---------------- VOLATILITY ---------------- */
{id:'straddle', n:'Long Straddle', cat:'vol', dir:'Big move, either way', risk:'Defined', lvl:2,
 legs:[{t:'c',s:1,k:0},{t:'p',s:1,k:0}],
 want:'A large move in either direction, larger than the market has priced in.',
 when:'You expect volatility to expand and you believe the current implied volatility is too low for what is coming.',
 fails:'The move arrives but was already priced. Post-event volatility collapse can lose you money on a move you called correctly, in the right direction.',
 trap:'Buying straddles into earnings. Implied volatility is at its annual high the day before and crushes the morning after. You need a move bigger than the one everybody already agreed on.'},

{id:'strangle', n:'Long Strangle', cat:'vol', dir:'Big move, either way', risk:'Defined', lvl:2,
 legs:[{t:'p',s:1,k:-6},{t:'c',s:1,k:6}],
 want:'An even bigger move than a straddle needs, for a lower entry cost.',
 when:'Same conditions as a straddle, when you want the cheaper version and accept a wider dead zone.',
 fails:'Anything moderate. The gap between the two strikes is a zone where both legs decay to nothing.',
 trap:'Choosing it over a straddle purely on price. Cheaper here means a materially lower probability of ever paying out.'},

{id:'cal', n:'Calendar Spread', cat:'vol', dir:'Neutral, near term', risk:'Defined', lvl:3,
 legs:[{t:'c',s:-1,k:0,x:1},{t:'c',s:1,k:0,x:2}],
 want:'Price to sit near the strike while the near expiry decays faster than the far one.',
 when:'Near-term implied volatility is high relative to further-out expiries, and you expect quiet followed by movement.',
 fails:'A move away from the strike in either direction, or the volatility term structure moving against you.',
 trap:'The only structure here where volatility matters more than direction. Rising volatility helps a calendar and falling volatility hurts it, which is the opposite of most income trades and catches people who assume all short premium works the same way.'},

{id:'diag', n:'Diagonal Spread', cat:'vol', dir:'Mildly directional', risk:'Defined', lvl:3,
 legs:[{t:'c',s:-1,k:5,x:1},{t:'c',s:1,k:0,x:2}],
 want:'A slow drift toward your short strike while the near leg decays.',
 when:'You want a calendar with a directional lean, or a long-dated call financed by repeatedly selling short-dated ones.',
 fails:'A fast move through the short strike before the long leg has gained enough to cover it.',
 trap:'Rolling the short leg mechanically without re-checking the thesis. A diagonal managed on autopilot slowly turns into a position nobody chose.'},

/* ---------------- ADVANCED ---------------- */
{id:'fly', n:'Long Butterfly', cat:'adv', dir:'Pinned', risk:'Defined', lvl:3,
 legs:[{t:'c',s:1,k:-6},{t:'c',s:-1,k:0},{t:'c',s:-1,k:0},{t:'c',s:1,k:6}],
 want:'Price to land on the middle strike at expiry. The highest reward-to-risk ratio on this page, and the lowest probability.',
 when:'You have a specific price target and a specific date, which is a much stronger claim than "I think it goes up".',
 fails:'Almost everything. The profit peak is a single point and the wings are wide.',
 trap:'It looks irresistible on the payoff diagram because the ratio can be ten to one. That ratio is the market pricing how unlikely the outcome is.'},

{id:'bwb', n:'Broken Wing Butterfly', cat:'adv', dir:'Directional lean', risk:'Defined, uneven', lvl:3,
 legs:[{t:'p',s:1,k:-14},{t:'p',s:-1,k:-7},{t:'p',s:-1,k:-7},{t:'p',s:1,k:3}],
 want:'A drift toward the body, with one wing pushed out so the structure can often be opened for a credit.',
 when:'You want a butterfly with no cost to put on, and you accept that the risk is now lopsided toward one side.',
 fails:'A move into the wide wing, where the loss is significantly larger than the narrow side.',
 trap:'The credit makes it feel risk-free. Look at the wide side before you open it, because that is where the entire risk of the structure now lives.'},

{id:'jade', n:'Jade Lizard', cat:'adv', dir:'Neutral to bullish', risk:'Undefined below', lvl:3,
 legs:[{t:'p',s:-1,k:-7},{t:'c',s:-1,k:6},{t:'c',s:1,k:12}],
 want:'Flat to up, with the total credit exceeding the width of the call spread so there is no upside risk at all.',
 when:'High implied volatility with a bullish lean, when you specifically want the upside risk eliminated.',
 fails:'A drop. The short put is naked below and carries the entire risk of the position.',
 trap:'The clever construction distracts from what it is: a cash-secured put with a financed call spread stapled on. Size it as the short put it fundamentally is.'},

{id:'ratio', n:'Ratio Spread', cat:'adv', dir:'Measured move', risk:'UNDEFINED', lvl:3,
 legs:[{t:'c',s:1,k:0},{t:'c',s:-1,k:7},{t:'c',s:-1,k:7}],
 want:'A move up to the short strikes and no further, often financed to a credit or zero cost.',
 when:'Rarely, and only when you can articulate why the move stops where it stops.',
 fails:'The move continues. Past the short strikes you are net short options and the loss accelerates without limit.',
 trap:'It behaves like a free bull spread right up until it does not. The extra short leg is what pays for the structure and it is also what can hurt you the most.'}

];

/* the lessons that decide whether any of the above works */
window.TDESK.OPT_LESSONS = [
{id:'price', n:'What you are actually paying for',
 b:'An option price has exactly two parts. Intrinsic value is the part that is already real: how far in the money it sits. Extrinsic value is everything else, and it is entirely a bet on time and movement. A $5 call that is $2 in the money carries $3 of extrinsic, and that $3 is guaranteed to reach zero on expiry day.',
 t:'When you buy an option you are buying intrinsic at fair value and extrinsic at whatever the market charges for uncertainty. Only one of the two can survive to expiry.'},
{id:'theta', n:'Time decay is not linear',
 b:'Extrinsic value does not bleed evenly. It drains slowly at first and then steepens sharply inside the last two or three weeks, and fastest of all at the money. That curve is the reason 30 to 45 days is the common window for directional buying and the reason premium sellers cluster inside 45 days.',
 t:'Buying a weekly and buying a quarterly are not the same trade at different sizes. They are different bets on completely different parts of the decay curve.'},
{id:'iv', n:'The crush that beats a correct call',
 b:'Implied volatility is the market\u2019s price for uncertainty, and it rises into known events and collapses immediately after them. Buy a call the day before earnings, watch the stock rise 4% the next morning, and still lose money, because the uncertainty you paid for no longer exists.',
 t:'What matters is IV rank, meaning where implied volatility sits inside its own one-year range, not the raw number. High rank favours selling, low rank favours buying. Check it before you decide whether to be a buyer or a seller at all.'},
{id:'defined', n:'Defined risk is not a beginner setting',
 b:'A spread caps your loss at a number you know before you click. That is not a training wheel, it is the structural reason spreads survive a bad week. Beckmeyer, Branger and Gayda found the median single-leg retail 0DTE position had negative margin-adjusted returns while median put and call spreads came out around positive 3%.',
 t:'The same directional read, expressed through a spread instead of a naked long, changed the sign of the median outcome in the data. Structure did that, not skill.'},
{id:'liq', n:'The spread you pay twice',
 b:'The gap between bid and ask is a cost you pay entering and again exiting. On a contract marked at $1.00 with a 10-cent spread, you are 10% down the instant you fill, and you owe it again on the way out. Open interest under a few hundred contracts is where that gap gets wide and where a good trade quietly becomes a bad one.',
 t:'Use limit orders, always, and start at the mid. A market order on an illiquid option is a donation with a confirmation screen.'},
{id:'assign', n:'Assignment, and when it actually happens',
 b:'Short American-style options can be assigned any day, but early assignment is rare and predictable: it happens when there is almost no extrinsic value left, and most often on short calls the day before a dividend goes ex. Index options like SPX are European and settle in cash, so assignment risk does not exist there at all.',
 t:'If you are short a leg with pennies of extrinsic remaining and a dividend is coming, close it. That is the one scenario worth watching for, and the rest of the anxiety about assignment is misplaced.'},
{id:'exp', n:'Expiration week is a different instrument',
 b:'Gamma rises sharply as expiry approaches, which means delta swings violently for small moves in the underlying. A position that behaved gently all month can go from flat to fully directional in minutes. This is what makes 0DTE feel like a slot machine: you are trading almost pure gamma with almost no time value left to cushion anything.',
 t:'Pin risk is the specific nightmare: finishing right at your short strike, not knowing whether you were assigned until the weekend. Close short legs that are near the money rather than carrying them into the close.'},
{id:'size', n:'Sizing options is not sizing stock',
 b:'One contract controls 100 shares, so a $3 premium is $300 of real risk and controls maybe $18,000 of stock. When you buy a long option outright with no stop, your position size is the entire premium, because the whole premium can go to zero and frequently does.',
 t:'For a long option, risk budget divided by premium per contract gives you your contract count. That is the arithmetic. Anything that requires a bigger number than that arithmetic allows is a trade you cannot afford.'}
];
