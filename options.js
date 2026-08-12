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

window.TDESK.OPT_TIERS = {
  1: ['Beginner',     'Single leg or fully covered. One decision, defined loss, nothing that can surprise you.'],
  2: ['Intermediate', 'Two or more legs. You need to understand how the legs offset each other before this is safe.'],
  3: ['Advanced',     'Undefined risk, assignment risk, or a shape whose worst case is not obvious from the payoff diagram.']
};

window.TDESK.OPT_PLAYS = {

/* ---------------- DIRECTIONAL ---------------- */
lc:{ tier:1,
  legs:['BUY 1 call, 0.60 to 0.70 delta, 45 to 60 days out'],
  cost:'Debit, about $7.00 per contract ($700)',
  max:'Max loss the $700. Max gain unlimited in theory, realistically a multiple of the debit.',
  be:'Strike plus premium. A $100 strike costing $7.00 breaks even at $107 at expiry, earlier if it moves fast.',
  enter:'Buy the deeper delta, not the cheap one. A 0.65 delta call moves roughly 65 cents per dollar of stock and holds most of its value as intrinsic, so you are paying mostly for the stock move rather than for hope. Go out at least 45 days: theta on a 45-day option is roughly a third of what it is on a 10-day option, which buys you the right to be early. Check IV rank first, because buying a call into elevated IV means you can be right on direction and still lose to the volatility crush.',
  manage:'Take profit in pieces. At +50% on the premium, sell half and you are playing with the house money. Roll the strike up if the stock runs hard and you want to keep exposure while pulling capital out.',
  exit:'Out at 21 days to expiry no matter what. Gamma and theta both accelerate past that point and the trade stops being about your directional read. Hard stop at minus 50% of the premium.',
  size:'1% to 2% of the account per position, because the realistic worst case is the entire debit.'},

lp:{ tier:1,
  legs:['BUY 1 put, 0.60 to 0.70 delta, 45 to 60 days out'],
  cost:'Debit, about $7.00 per contract ($700)',
  max:'Max loss the $700. Max gain the strike minus the premium if the stock goes to zero.',
  be:'Strike minus premium. A $100 put costing $7.00 breaks even at $93.',
  enter:'Same delta and duration logic as a long call, with one asymmetry that matters: puts usually cost more than the equivalent call because of skew. The market charges more for downside protection than for upside participation, so your breakeven sits further away than instinct suggests. Buying puts after a selloff has already begun is the classic error, since IV has expanded and you are paying peak price for the insurance.',
  manage:'If the stock drops fast and IV spikes, a large part of your gain is volatility rather than direction. That part evaporates on any bounce, so take it while it is there.',
  exit:'Out at 21 days. Take profit at +50% to +100%. Stop at minus 50%.',
  size:'1% to 2%. As portfolio insurance rather than a trade, size it against what you are protecting, not against conviction.'},

bcs:{ tier:2,
  legs:['BUY 1 call at 0.60 delta, 30 to 45 days out','SELL 1 call at 0.30 delta, same expiry'],
  cost:'Debit, about $3.20 net ($320)',
  max:'Max loss the $320. Max gain the strike width minus the debit, so a $10 wide spread pays $680.',
  be:'Long strike plus net debit. A 100/110 spread at $3.20 breaks even at $103.20.',
  enter:'This is the long call with the lottery ticket sold off. The short call cuts your cost by roughly a third and cuts your theta bleed sharply, in exchange for a ceiling. Use it when you have a price target rather than a direction: put the short strike at or just past the level you actually expect price to reach, because everything above it is free money you are handing to somebody else. Best when IV is moderate to high, since you are buying one option and selling another and the sale offsets the inflated purchase.',
  manage:'The spread does not reach its full value until near expiry, so being right early feels underwhelming. That is normal and not a reason to close.',
  exit:'Take profit at 50% to 75% of max gain. Close the whole spread as one order, never leg out, because an unhedged short call is a different trade with an entirely different risk profile.',
  size:'2% to 3%. The defined loss makes this one of the few structures where you can size with confidence.'},

bps:{ tier:2,
  legs:['BUY 1 put at 0.60 delta, 30 to 45 days out','SELL 1 put at 0.30 delta, same expiry'],
  cost:'Debit, about $3.50 net ($350)',
  max:'Max loss the $350. Max gain the width minus the debit, $650 on a $10 wide spread.',
  be:'Long strike minus net debit. A 100/90 spread at $3.50 breaks even at $96.50.',
  enter:'The bearish mirror of the bull call spread, and skew works in your favour here: the put you sell is relatively more expensive than the put you buy, so the spread costs less than symmetry suggests. Place the short strike at a real support level, because that is where the decline is most likely to stall.',
  manage:'If the stock gaps down through both strikes early, the spread will still be worth less than max value until expiry approaches. Assignment on the short put is possible if it goes deep in the money, particularly around a dividend.',
  exit:'Take profit at 50% to 75% of max. Close as one order.',
  size:'2% to 3%.'},

/* ---------------- INCOME ---------------- */
csp:{ tier:1,
  legs:['SELL 1 put at 0.20 to 0.30 delta, 30 to 45 days out','Hold the full cash to buy 100 shares'],
  cost:'Credit, about $1.80 received ($180)',
  max:'Max gain the $180. Max loss the strike minus the premium, so $9,320 if a $95 strike goes to zero.',
  be:'Strike minus premium, $93.20 on a $95 strike.',
  enter:'Only sell puts on something you would be genuinely happy to own at that strike, because that is the actual outcome you are underwriting. The 0.20 to 0.30 delta band means roughly a 70% to 80% chance of expiring worthless, which is the whole business model. Never sell a put through an earnings date unless assignment at that strike is the goal, since a gap can put you thousands of dollars underwater on a $180 credit.',
  manage:'At 50% of max profit, buy it back and redeploy. Squeezing the last 50% takes most of the remaining time for a fraction of the return. If the stock drops toward the strike and you still want the shares, let it assign and start selling covered calls against them.',
  exit:'Close at 50% profit, or at 21 days, whichever comes first. Roll down and out if tested and you want to defer, but only for a net credit.',
  size:'Cash-secured means exactly that. If you cannot hold the cash for 100 shares, you are trading a naked put and lying to yourself about it.'},

cc:{ tier:1,
  legs:['OWN 100 shares','SELL 1 call at 0.20 to 0.30 delta, 30 to 45 days out'],
  cost:'Credit, about $1.60 received ($160)',
  max:'Max gain the premium plus any appreciation up to the strike. Max loss the stock going to zero, minus the premium.',
  be:'Your share cost basis minus the premium collected.',
  enter:'The premium is real income, but you are selling your upside to get it. Pick a strike above a level you would be content to sell at, because being called away is not a failure, it is the deal you signed. Do not sell calls through earnings on a stock you want to keep. Avoid selling below your cost basis on a position you are underwater on, since that locks in the loss if it runs back.',
  manage:'Buy back at 50% to 70% of max profit and resell further out. If the stock rips through the strike, you can roll up and out for a credit, but only if the roll genuinely still pays.',
  exit:'Let it expire worthless or get assigned. Both are wins on a position you sized correctly.',
  size:'Per hundred shares owned. This is the most conservative income structure there is, which is why it is the standard first sold option.'},

ic:{ tier:2,
  legs:['SELL 1 put at 0.16 delta','BUY 1 put $5 lower','SELL 1 call at 0.16 delta','BUY 1 call $5 higher','all same expiry, 30 to 45 days out'],
  cost:'Credit, about $1.60 received ($160) on $5 wide wings',
  max:'Max gain the $160. Max loss the width minus the credit, $340.',
  be:'Short put minus credit and short call plus credit, roughly $93.40 to $106.60 on the example.',
  enter:'You are betting the stock stays inside a range, so the trade needs high implied volatility to be worth doing: IV rank above 50 means the market is paying you a wide range for the same risk. The 0.16 delta shorts sit near a one standard deviation move, giving about a 68% chance of the stock finishing between them. Wide, liquid underlyings only, because four legs means four bid-ask spreads and an illiquid chain will eat the entire credit on entry and exit.',
  manage:'At 50% of max profit, close it. The risk-reward gets progressively worse the longer you hold. If one side is tested, you can roll the untested side closer to collect more credit, but understand that this narrows your profit zone on a trade that is already going against you.',
  exit:'50% of max profit, or 21 days to expiry. Do not hold four legs into expiration week hoping the range holds.',
  size:'Risk is defined at $340 per condor, so size by that number and not by the credit.'},

ib:{ tier:2,
  legs:['SELL 1 call at the money','SELL 1 put at the same strike','BUY 1 call $10 higher','BUY 1 put $10 lower','all same expiry, 30 to 45 days out'],
  cost:'Credit, about $4.00 received ($400) on $10 wings',
  max:'Max gain the $400 if it pins the short strike exactly. Max loss the width minus credit, $600.',
  be:'Short strike plus and minus the credit, so $96 to $104.',
  enter:'An iron condor with the two short strikes collapsed onto one, which is why it pays far more and wins far less often. You need a genuine pin thesis: a stock parked at a big open-interest strike, a post-earnings drift into a known level, or a low-realised-volatility regime where price has stopped travelling. Sell it into high IV and take the position off before the move you were betting against has time to happen.',
  manage:'Profit comes fast if price sits still, and the position is at max risk the moment it does not. There is no drifting back. At 25% of max profit you are already being paid well for the time elapsed, and taking it is usually correct.',
  exit:'25% to 35% of max profit is the standard target. Close on any decisive break of a breakeven rather than hoping for a return.',
  size:'Half what you would size an iron condor, because the probability of touching a short strike is close to certain and the wins depend on getting out early.'},

ss:{ tier:3,
  legs:['SELL 1 call at 0.16 delta','SELL 1 put at 0.16 delta','same expiry, 30 to 45 days out','NO protective wings'],
  cost:'Credit, about $3.20 received ($320)',
  max:'Max gain the $320. Max loss is theoretically unlimited on the call side.',
  be:'Roughly $91.80 to $108.20 on the example.',
  enter:'This is the iron condor with the insurance removed, and the insurance is what turns a bad week into a survivable one. Requires margin approval, a large account, and a written plan for what you do at a 2x credit loss before you enter. Never on a single stock through earnings, never on anything that can be acquired, gap on a drug trial, or short squeeze. If you cannot state your maximum loss as a number, you should be trading the iron condor instead.',
  manage:'Defend at 2x the credit received. Roll the tested side out in time for a credit, or close. Many traders roll indefinitely and mistake deferral for management, which is how a $320 credit becomes a five-figure loss.',
  exit:'50% of max profit, or 21 days. Close it at 2x credit loss, without negotiation.',
  size:'If a single position can meaningfully damage the account, it is too big. Most retail accounts should not be here at all.'},

/* ---------------- VOLATILITY ---------------- */
straddle:{ tier:2,
  legs:['BUY 1 call at the money','BUY 1 put at the same strike','same expiry, 30 to 45 days out'],
  cost:'Debit, about $8.50 total ($850)',
  max:'Max loss the $850 if it finishes exactly at the strike. Max gain unlimited on the upside.',
  be:'Strike plus and minus the total debit, so $91.50 and $108.50.',
  enter:'You are buying a move without picking a direction, and the price of that convenience is that the stock has to travel more than 8% just to get you to flat. Only worth it when the expected move priced into the options is smaller than the move you actually expect, which usually means low IV rank ahead of a catalyst the market has not woken up to. Buying a straddle the day before earnings is the classic beginner trap: implied volatility is at its annual peak, and the crush the morning after routinely wipes out more value than the price gap creates.',
  manage:'When one leg has doubled, consider selling it and letting the other ride at zero further cost. Gamma is your friend on a fast move and your enemy on a slow one.',
  exit:'Out well before 21 days. Time decay on two long at-the-money options is the fastest bleed in this entire list.',
  size:'1% to 2%. The most likely single outcome of a straddle is a partial loss.'},

strangle:{ tier:2,
  legs:['BUY 1 call at 0.30 delta','BUY 1 put at 0.30 delta','same expiry, 45 to 60 days out'],
  cost:'Debit, about $4.20 total ($420)',
  max:'Max loss the $420 if it finishes between the strikes. Max gain unlimited above.',
  be:'Call strike plus debit and put strike minus debit, roughly $89.80 and $110.20.',
  enter:'Half the cost of a straddle and it needs a bigger move to pay, which is the trade. Use it when you expect something violent rather than merely significant, and give it more time than a straddle because the strikes are further away and need room to be reached.',
  manage:'Identical to the straddle: sell the winning leg on a sharp move rather than waiting for perfection.',
  exit:'Out before 21 days.',
  size:'1% to 2%.'},

cal:{ tier:2,
  legs:['SELL 1 call at the money, 30 days out','BUY 1 call at the same strike, 60 days out'],
  cost:'Debit, about $1.90 net ($190)',
  max:'Max loss the $190. Max gain depends on where IV sits when the front leg expires, typically two to three times the debit at best.',
  be:'A range around the strike that widens with the back month volatility, not a fixed number.',
  enter:'You are selling fast time and buying slow time, so this profits when the stock sits still and when back-month implied volatility rises. Enter when the front month is expensive relative to the back month, which happens ahead of a known event that falls inside the near expiry. Place the strike where you expect the stock to be, because a calendar is at its most valuable when price pins the strike.',
  manage:'Roll the short leg forward after it expires or decays out, converting the position into a new calendar at a lower cost basis. If the stock runs away from the strike in either direction, the position loses regardless of which way it went.',
  exit:'Close when the front leg has given up most of its value, typically 25% to 50% of the debit as profit.',
  size:'1% to 2%. The vega exposure means an IV collapse can hurt even when price behaves.'},

diag:{ tier:3,
  legs:['SELL 1 call at 0.30 delta, 30 days out','BUY 1 call at a lower strike, 60 to 90 days out'],
  cost:'Debit, varies with the strike gap, about $4.50 net ($450)',
  max:'Loss capped near the debit if managed. Gain depends on where price lands relative to both strikes.',
  be:'Not a single number. Model it before entry rather than estimating.',
  enter:'A calendar with a directional tilt, and the base of what people call the poor mans covered call: the long back-month call stands in for a hundred shares at a fraction of the capital. The long leg should be deep enough in the money, around 0.75 to 0.80 delta, that it behaves like stock. Critical rule: the strike gap between your legs must exceed the debit you paid, or an adverse assignment can lock in a loss you cannot escape.',
  manage:'Sell a new short call each cycle against the long. Roll the long leg out well before it enters its own steep decay.',
  exit:'Close the whole structure if the long leg falls below 0.60 delta, because it has stopped standing in for stock.',
  size:'2% to 3%, and treat the long leg as a stock position for exposure purposes rather than as an option.'},

/* ---------------- ADVANCED ---------------- */
fly:{ tier:3,
  legs:['BUY 1 call $5 below the target','SELL 2 calls at the target','BUY 1 call $5 above the target','all same expiry, 20 to 30 days out'],
  cost:'Debit, about $1.10 net ($110)',
  max:'Max loss the $110. Max gain the wing width minus the debit, $390.',
  be:'Lower strike plus debit and upper strike minus debit, roughly $96.10 to $103.90.',
  enter:'A precision instrument with a superb ratio and a narrow window. You are naming a price and a date, and getting paid three or four to one for being close. Enter closer to expiry than most structures, because the profit peak only sharpens as time runs out. Best around known pin points: large open interest strikes, round numbers, or a post-event drift into a level.',
  manage:'The position is worth very little until the final week, so early paper losses mean little. That patience is also the trap, since there is no time left to recover if you are wrong.',
  exit:'Take anything above 50% of max gain. Waiting for the perfect pin usually converts a good win into a full loss.',
  size:'Under 1%. The low win rate is priced into the payoff, so treat it as many small tickets rather than one large one.'},

bwb:{ tier:3,
  legs:['BUY 1 put $10 below the target','SELL 2 puts at the target','BUY 1 put $25 below the target','all same expiry, 30 to 45 days out'],
  cost:'Often a small credit or near zero debit',
  max:'Gain roughly the width of the narrow wing plus any credit. Loss the wide wing minus the narrow wing minus the credit, which is a substantially larger number.',
  be:'One breakeven on the wide side. The narrow side often has none, which is the entire point.',
  enter:'A butterfly with one wing pushed out, financing the structure so it costs nothing or pays you to enter. The result is a trade with no risk at all in one direction and a real, larger risk in the other. Put the wide wing where you least expect price to go. It is a genuinely good shape, and the reason it belongs at the advanced tier is that the payoff diagram makes the risk look smaller than it is.',
  manage:'Watch the wide side. That is where the loss lives, and it can exceed the credit many times over.',
  exit:'Take 25% to 50% of max gain. Close on any decisive move toward the wide wing rather than negotiating with it.',
  size:'Size against the wide-wing loss, never against the credit received.'},

jade:{ tier:3,
  legs:['SELL 1 put at 0.25 delta','SELL 1 call at 0.25 delta','BUY 1 call $5 above the short call','all same expiry, 30 to 45 days out'],
  cost:'Credit, about $2.90 received ($290)',
  max:'Max gain the credit. Loss is undefined below the short put and defined above, which is the whole design.',
  be:'Short put strike minus the credit, roughly $92.10.',
  enter:'The one rule that makes this a jade lizard rather than a random three-legged position: the total credit must exceed the width of the call spread. Collect $2.90 on a $5 wide spread and you still have upside risk. Collect $5.10 on a $5 wide spread and there is literally no way to lose money if the stock goes up, at any price, forever. That is the entire reason the structure exists. Sell it into elevated IV on something you would not mind owning, because the downside is a cash-secured put wearing a costume.',
  manage:'All the risk is below. Manage the short put exactly as you would manage a cash-secured put: roll down and out for a credit, or take assignment on a name you wanted anyway.',
  exit:'50% of max profit, or 21 days.',
  size:'Size as though you are short the put naked, because below the short strike you are.'},

ratio:{ tier:3,
  legs:['BUY 1 call at 0.50 delta','SELL 2 calls at 0.25 delta','same expiry, 30 to 45 days out'],
  cost:'Small credit or near zero, about $0.40 received',
  max:'Best case at the short strike. Loss unlimited above it, because one of the two short calls is uncovered.',
  be:'One below and one above. The upper breakeven is the number that matters.',
  enter:'You want a measured move to a level and nothing beyond it. Because you sell two and buy one, the structure often costs nothing, and that free entry is exactly what makes it dangerous: the second short call is naked. A gap through the short strike produces losses with no ceiling. Never put this on ahead of earnings, a takeover rumour, or anything with squeeze potential.',
  manage:'Have a hard price level above the short strike at which you buy back a short call, decided before entry rather than during the move.',
  exit:'Close well before expiry. Gamma near the short strike in the final week turns a manageable position into an ungovernable one.',
  size:'The smallest size in this list. If a gap up would meaningfully damage the account, the position is too large.'}
};
