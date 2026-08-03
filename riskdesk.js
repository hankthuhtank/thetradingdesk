/* ============================================================
   THE TRADING DESK - THE RISK DESK
   Scaling by account size, hedging, contract selection, and the
   psychology. Everything here is static reference text plus the
   numbers that drive the ladder calculator.
   Note on currency: the PDT rule referenced by older material is
   gone. The SEC approved FINRA's amendments to Rule 4210 on
   14 Apr 2026 and the change took effect 4 Jun 2026, removing the
   $25,000 minimum equity requirement and the pattern-day-trader
   designation entirely, replaced by risk-based intraday margin.
   ============================================================ */
window.TDESK = window.TDESK || {};

/* ---- THE CAPITAL LADDER ----------------------------------- */
window.TDESK.TIERS = [
{id:'t1', name:'The Tuition Years', lo:0, hi:2500, band:'$0 \u2013 $2,500',
 gist:'This account is not a business yet. It is a simulator with real consequences, and the only job it has is to teach you execution without ending you.',
 lanes:{
  invest:{risk:1, pos:2, hold:'Months to years',
   focus:'One broad-market index fund and a fixed monthly contribution. Nothing else.',
   rules:[
    'Automate the buy. A recurring purchase you never touch beats every timing decision you will make at this size.',
    'One position, maybe two. Diversification at $2,000 is a fantasy: you own fractions, and fees and spreads eat the benefit.',
    'The contribution is the strategy. At this balance your monthly deposit moves the account more than any return you can generate.',
    'Track the deposits separately from the returns, or you will confuse "I added money" with "I made money" for years.'],
   notyet:['Individual stock picking beyond one or two names you can actually explain','Margin of any kind','Anything with a ticker you found on social media'],
   edge:'Time. It is the only edge available to you at this size and it is a genuinely large one.'},
  fast:{risk:2, pos:1, hold:'Minutes to days',
   focus:'One instrument, one setup, one time of day. Defined risk only.',
   rules:[
    'Maximum 2% of the account on any single trade. At $1,000 that is $20. If $20 feels too small to bother with, you are here to gamble, and this page cannot help with that.',
    'One position at a time. Not two, not "one is a hedge". Managing correlated positions is a separate skill you have not built yet.',
    'Three trades a day maximum, then the platform closes. The old PDT rule that capped this for you was eliminated on 4 June 2026, so the cap is now yours to enforce.',
    'Buy defined risk. Beckmeyer, Branger and Gayda found the median single-leg retail 0DTE position had negative margin-adjusted returns, while median put and call spreads came out around +3%.',
    'Write down entry, stop and target before you click. If you cannot fill in all three, the trade does not exist.'],
   notyet:['Selling naked anything','0DTE with more than one contract','Averaging down, ever','Trading the open before you have watched 50 of them'],
   edge:'None yet, and pretending otherwise is what the tuition pays for. Your goal is a hundred trades executed to plan, not a number.'}}},

{id:'t2', name:'The Proving Ground', lo:2500, hi:10000, band:'$2,500 \u2013 $10,000',
 gist:'Enough capital that discipline produces a visible result, and enough that a bad week actually hurts. This is where most accounts are lost, and where a real process gets built if one ever will.',
 lanes:{
  invest:{risk:5, pos:6, hold:'Months to years',
   focus:'A core index position plus a small satellite of names you genuinely researched.',
   rules:[
    'Core and satellite: keep 70 to 80% in the broad index and cap the whole satellite sleeve at 20 to 30%.',
    'No single satellite position above 5% of the account. That is roughly $250 to $500 here.',
    'Write a one-paragraph thesis per name before buying, including what would prove you wrong. Reread it when it drops 20%.',
    'Rebalance on a schedule, not on a feeling. Twice a year is plenty.',
    'Know the tax treatment before you enter, not in April.'],
   notyet:['Concentrated bets above 10% of the account','Leverage on the core','Selling the index to fund a satellite idea'],
   edge:'Patience plus a low fee drag, which reliably beats most active retail attempts over a decade.'},
  fast:{risk:1.5, pos:2, hold:'Minutes to weeks',
   focus:'Two setups you can define in one sentence each, traded on liquid instruments only.',
   rules:[
    'Risk 1 to 1.5% per trade. At $5,000 that is $50 to $75 of actual loss, not $75 of notional.',
    'Daily stop: three losses or 3% of the account, whichever comes first. Then you are done for the day, no exceptions and no "one more to get it back".',
    'Weekly stop at 6%. Hitting it means you go back to paper for the rest of the week.',
    'Two positions maximum, and never two that move together. Two tech calls is one trade in two tickets.',
    'Journal every trade with a screenshot and one line on whether you followed the plan. Grade the process, not the outcome.',
    'Size from the stop, not the account. Position size = risk dollars / distance to stop.'],
   notyet:['Adding size after a winning streak, which is when overconfidence is highest','Undefined-risk short options','Holding a 0DTE position through the last thirty minutes hoping'],
   edge:'Execution consistency. If your journal shows you followed the plan on 90% of trades, you have something worth scaling. If not, more capital only loses faster.'}}},

{id:'t3', name:'The Working Account', lo:10000, hi:50000, band:'$10,000 \u2013 $50,000',
 gist:'Large enough for real position sizing and real diversification. Also large enough that a single undisciplined week can undo a year, which is the whole reason the rules tighten here rather than loosen.',
 lanes:{
  invest:{risk:5, pos:12, hold:'Years',
   focus:'A properly allocated portfolio with an asset-allocation target you wrote down.',
   rules:[
    'Set an allocation across equities, bonds and cash, then rebalance to it. The allocation decision explains most of your return variance, not the stock picks.',
    'Cap any single name at 5% and any single sector at 25%.',
    'Now protective puts start to make sense: hedging a $30,000 portfolio costs real money but is no longer a rounding error in the wrong direction.',
    'Harvest losses deliberately in December, and know the wash-sale rule before you do.',
    'Keep six months of expenses outside this account. A portfolio you might have to liquidate is not a portfolio, it is a savings account with volatility.'],
   notyet:['Concentrating more than 20% in one theme, however obvious it looks','Using margin to increase equity exposure'],
   edge:'Allocation discipline and tax efficiency, both of which compound quietly.'},
  fast:{risk:1, pos:3, hold:'Minutes to weeks',
   focus:'A defined playbook of two or three setups with recorded expectancy for each.',
   rules:[
    'Risk 1% per trade, hard. At $25,000 that is $250. Note it goes down as a percentage as the account grows, not up.',
    'Total open risk capped at 3% across all positions. Not three positions at 1% each plus "a small one".',
    'Daily stop 2%, weekly stop 5%, monthly stop 8%. Hit the monthly and you halve size for the following month.',
    'Track expectancy per setup: (win rate \u00d7 average win) \u2212 (loss rate \u00d7 average loss). A setup below zero over 30 trades gets cut regardless of how good it feels.',
    'Scale size on evidence, not on feeling. Increase risk per trade only after a documented 50-trade sample.',
    'Take a week off after a 5% drawdown. Tilt costs more than any single trade ever will.'],
   notyet:['Risking more than 2% on a "high conviction" idea, because conviction is not a risk parameter','Trading a new instrument at full size'],
   edge:'A measured, positive expectancy on a defined setup, plus the discipline to size it consistently.'}}},

{id:'t4', name:'The Real Desk', lo:50000, hi:250000, band:'$50,000 \u2013 $250,000',
 gist:'The account is now a meaningful part of your net worth. Survival mathematics dominates: at this size, avoiding a 40% drawdown matters more than any winning idea you have.',
 lanes:{
  invest:{risk:4, pos:20, hold:'Years to decades',
   focus:'A full portfolio with a written policy statement and a hedging plan for the drawdowns you know are coming.',
   rules:[
    'Write an investment policy statement: target allocation, rebalancing bands, and what you will do in a 30% drawdown. Write the last part while calm.',
    'Cap single names at 4% and consider collars on any concentrated position you cannot sell for tax reasons.',
    'A standing hedge on the core is now defensible. Size it to the loss you cannot tolerate, not to the loss you expect.',
    'Separate accounts for separate jobs. Retirement money does not fund trading ideas.',
    'Review costs annually. At this size a 0.5% fee difference is real money every year.'],
   notyet:['Treating the portfolio as collateral for speculation','Skipping the rebalance because the winners are winning'],
   edge:'Structure, tax awareness and the ability to not sell at the bottom, which is worth more than any alpha you will find.'},
  fast:{risk:0.75, pos:4, hold:'Minutes to weeks',
   focus:'A small number of high-quality setups, sized properly, with liquidity as a hard filter.',
   rules:[
    'Risk 0.5 to 0.75% per trade. At $100,000 that is $500 to $750, which is plenty of position for anything liquid.',
    'Liquidity becomes a real constraint. Check open interest and spread before strike selection, not after: a 10% spread is a 10% loss you pay on entry.',
    'Total portfolio heat capped at 3%, and correlated positions count as one for that purpose.',
    'Keep a written kill switch: the drawdown at which you stop trading entirely and review. Decide it now, in writing.',
    'Consider whether the trading sleeve should be a fixed dollar allocation rather than the whole account. Most people at this level ring-fence it.'],
   notyet:['Increasing size to chase a flat month','Any strategy you cannot explain to a sceptical accountant'],
   edge:'Process maturity plus size discipline. The mistake here is not lack of skill, it is letting a good year convince you to double risk.'}}},

{id:'t5', name:'The Portfolio', lo:250000, hi:100000000, band:'$250,000 and up',
 gist:'Capital preservation is the mandate. The arithmetic is brutal at this level: recovering a large drawdown requires returns you are unlikely to produce twice.',
 lanes:{
  invest:{risk:3, pos:25, hold:'Decades',
   focus:'Allocation, tax location, and a hedging programme. Manager selection if you are not doing it yourself.',
   rules:[
    'Asset location matters as much as allocation: put tax-inefficient assets in tax-advantaged accounts.',
    'A systematic hedging programme, sized and budgeted annually, beats a panic hedge bought after the drop.',
    'Cap single names at 3% unless it is a position you built and understand deeply, and even then know your concentration risk honestly.',
    'Estate and beneficiary paperwork is part of risk management. Most people at this level have not done it.',
    'Get a professional opinion on tax and structure. At this size the fee is small against the mistakes it prevents.'],
   notyet:['Chasing yield in instruments you cannot price','Confusing a bull market with skill'],
   edge:'Time, structure and the discipline to keep costs and taxes low. Nothing exotic is required.'},
  fast:{risk:0.5, pos:5, hold:'Minutes to weeks',
   focus:'A ring-fenced trading allocation with institution-style risk controls.',
   rules:[
    'Ring-fence the trading capital as a fixed dollar allocation. Risk 0.5% of the sleeve, not of net worth.',
    'Hard portfolio heat limit, hard daily loss limit, hard monthly review. Written, and enforced by someone other than the version of you that is losing.',
    'Market impact is now yours to manage. Work orders, respect spreads, and stop pretending fills are free.',
    'Consider whether you are being paid for the time. Compare the sleeve honestly against an index over three years before deciding to continue.'],
   notyet:['Scaling risk percentage back up because the dollar amounts feel small','Running the trading sleeve without a written mandate'],
   edge:'Risk management as an actual system. At this level the returns come from not blowing up, repeatedly, for years.'}}}
];

/* ---- HEDGING --------------------------------------------- */
window.TDESK.HEDGES = [
{n:'Protective Put', when:'You own the shares, you want to keep owning them, and you cannot afford the drawdown.',
 how:'Buy one put per 100 shares, typically 3 to 6 months out and 5 to 10% below spot. Longer expiries cost more upfront but decay far more slowly per day.',
 cost:'A real, recurring drag. Running a rolling hedge permanently is roughly like paying an insurance premium every quarter, and over a long bull market that premium is the whole cost of sleeping well.',
 pick:'Delta around 0.20 to 0.30 for a balance of cost and coverage. Check that the strike sits below real support rather than at a round number.',
 trap:'Buying the hedge after the drop, when implied volatility has already doubled and the protection costs three times what it did a week earlier.'},

{n:'Collar', when:'You hold a concentrated position you cannot or will not sell, often for tax reasons.',
 how:'Buy the protective put and sell a call above spot to fund it. Choose strikes so the credit roughly offsets the debit, which is the zero-cost collar.',
 cost:'Cash-neutral at entry, but you have sold your upside above the call strike. That is the actual price, and it is not small in a strong year.',
 pick:'Put around 0.25 delta, call around 0.25 delta on the other side. Match expiries. Watch the assignment risk on the short call near dividends.',
 trap:'Setting the call strike too close because it funds a nicer put. You will get called away in exactly the scenario you were hoping for.'},

{n:'Index Put Against a Portfolio', when:'You hold many correlated names and want one hedge instead of twenty.',
 how:'Hedge with index puts sized by beta. Contracts = (portfolio value \u00d7 portfolio beta) / (index level \u00d7 100). The calculator below does this arithmetic.',
 cost:'Cheaper than hedging each name and usually more liquid, at the cost of basis risk: your names can fall while the index does not.',
 pick:'SPX for tax treatment under \u00a71256 and cash settlement, SPY for smaller size and easier granularity. Three months out is a common starting point.',
 trap:'Forgetting the beta step and buying a dollar-for-dollar notional hedge, which over-hedges a low-beta portfolio and under-hedges a high-beta one.'},

{n:'Put Spread', when:'You want a defined amount of protection cheaply and accept it runs out below a level.',
 how:'Buy a put, sell a further-out-of-the-money put against it. The short leg pays for a chunk of the long leg.',
 cost:'Much cheaper than an outright put, but the protection stops at the short strike. In a genuine crash, that is exactly where you needed it to continue.',
 pick:'Long leg near the level you fear, short leg at the point you consider a tail scenario. Keep the spread wide enough to matter.',
 trap:'Buying a narrow spread that pays out $5 in a crash. Cheap protection that cannot cover the event is not protection, it is a receipt.'},

{n:'Cash', when:'Always available, permanently underrated.',
 how:'Reduce the position. There is no premium, no expiry, no greeks and no assignment risk.',
 cost:'Opportunity cost and possibly capital gains tax. Nothing else.',
 pick:'No contract selection required, which is the point.',
 trap:'Constructing an elaborate options hedge to avoid admitting the position is simply too large. If the hedge is complicated, the position was the problem.'}
];

window.TDESK.CONTRACTS = [
 ['Days to expiry','30 to 45 DTE for directional swings: enough time to be right, before theta decay steepens sharply in the final two weeks. Under 7 DTE you are trading gamma, not direction, and the trade becomes a timing bet with a ticking clock.'],
 ['Delta','0.40 to 0.60 for a directional trade you want to behave like stock. Under 0.20 you are buying a lottery ticket whose most likely outcome is zero. Above 0.70 you are paying for intrinsic value you could get more cheaply with shares.'],
 ['Implied volatility vs realised','Compare IV to the underlying\u2019s recent historical volatility. IV well above HV means you are paying a premium for movement that has not been happening; IV below HV means the option is cheap relative to how the thing actually moves.'],
 ['IV rank','Where current IV sits in its own one-year range. High IV rank favours selling premium, low IV rank favours buying it. This matters more than the absolute IV number.'],
 ['Open interest and volume','At least 100 contracts of open interest as a floor, 500 or more preferred. Thin strikes are a trap you only notice when you try to exit.'],
 ['Spread as a percent of mark','Under 5% is workable, over 10% is a flag. A 10% spread means you start every trade 10% down, and you pay it again on the way out.'],
 ['Earnings and events','Check the earnings date against the expiry before anything else. Holding through earnings converts a technical trade into a binary bet, and the implied volatility crush afterwards can lose you money even when direction was right.'],
 ['Strike versus structure','Place the strike relative to a real level, not a round number. A call whose breakeven sits above known resistance needs the market to do two hard things instead of one.']
];

/* ---- PSYCHOLOGY ------------------------------------------ */
window.TDESK.MISTAKES = [
{n:'Loss aversion', s:'Cutting winners early, holding losers forever',
 w:'Kahneman and Tversky showed losses are felt roughly twice as strongly as equivalent gains. The result at the screen is that a small profit feels urgent to protect and a growing loss feels like something you can still fix by waiting.',
 f:'Predefine the exit on both sides before entry, and let the loser hit its stop without a renegotiation. If you would not enter here at this price today, you are not holding, you are hoping.'},
{n:'Revenge trading', s:'Sizing up immediately after a loss',
 w:'The loss creates an urge to make it back on the same instrument that took it, usually within the same session. Size goes up precisely when judgement is worst.',
 f:'A hard daily loss limit that closes the platform. The limit must be a number you set while calm, not a feeling you consult while losing.'},
{n:'Outcome bias', s:'Judging the decision by the result',
 w:'A rule-breaking trade that wins teaches the wrong lesson far more effectively than a rule-breaking trade that loses. This is how discipline erodes during good months.',
 f:'Grade the process separately from the profit and loss. A journal column that just says "followed plan: yes or no" catches this faster than any equity curve.'},
{n:'Overconfidence after a streak', s:'Doubling size at the worst possible time',
 w:'Wins feel like evidence of skill even when the sample is far too small to say anything. Risk per trade quietly creeps up until one normal losing streak does unusual damage.',
 f:'Fix risk as a percentage in writing and only change it on a documented 50-trade sample, never after a good week.'},
{n:'Confirmation bias', s:'Only reading the takes that agree with you',
 w:'Once a position is on, your search becomes an argument for it. The strongest counter-evidence gets filtered out at the exact moment it is most valuable.',
 f:'Write the strongest case against your own position before you enter, and name specifically what would make you exit.'},
{n:'Recency bias', s:'Assuming the last regime is the next one',
 w:'Whatever has worked for the last two months feels permanent. Strategies get adopted at the end of the conditions that made them work.',
 f:'Know which regime your setup needs and check the regime before the setup. That is what the trend and volatility instruments are actually for.'},
{n:'The sunk cost trap', s:'Averaging down to justify the first entry',
 w:'Adding to a loser converts an admission of being wrong into a story about a better average price. The position grows exactly as the thesis weakens.',
 f:'Only add to positions that are working, and only if the plan said so before entry. "It is cheaper now" is a description, not a reason.'},
{n:'Lottery preference', s:'Reaching for the cheap, far, fast option',
 w:'Beckmeyer, Branger and Gayda described exactly this in the 0DTE data: a documented preference for lottery-like payoffs, with the aggregate result being large retail losses, roughly 60% of which came from transaction costs rather than direction.',
 f:'Buy delta you would be willing to hold. If the position only pays on a move that has happened three times this year, price it as the ticket it is and size it that way.'},
{n:'Narrative over evidence', s:'Trading the story instead of the level',
 w:'A compelling reason for a move makes a position feel safer than it is. The story is the last thing to arrive and the first thing to be revised.',
 f:'Structure first, story second. If the level fails, the story does not save the trade.'},
{n:'No written plan', s:'Improvising, then calling it discretion',
 w:'Without a written plan there is no way to tell a discretionary decision from a mistake, which makes improvement impossible: every review becomes a debate about what you meant to do.',
 f:'One page: instruments, setups, risk per trade, daily and weekly limits, and the conditions under which you stop. If it is not written down, it does not exist.'}
];

/* Short attributed quotes. Each is a brief fragment used for
   identification and comment, with the source named. */
window.TDESK.QUOTES = [
 {q:'Anything can happen.', a:'Mark Douglas', s:'Trading in the Zone', n:'The first of his five fundamental truths. The rest, paraphrased: you do not need to predict the next move to make money, wins and losses arrive in random order within an edge, an edge is only a probability, and every moment in the market is genuinely new.'},
 {q:'Losers average losers.', a:'Paul Tudor Jones', s:'reportedly taped above his desk', n:'Three words that close the sunk-cost trap. Adding to a loser is the single most common way a manageable loss becomes an account event.'},
 {q:'Everybody gets what they want out of the market.', a:'Ed Seykota', s:'Market Wizards', n:'Uncomfortable, and mostly true. Traders who want excitement get excitement. Traders who want to be right get to be right, expensively.'},
 {q:'Markets are never wrong; opinions often are.', a:'Jesse Livermore', s:'attributed', n:'The market is not an argument you can win. Your position is a claim, and price is the only referee.'},
 {q:'Risk comes from not knowing what you are doing.', a:'Warren Buffett', s:'attributed', n:'A direct answer to anyone who confuses volatility with risk. The instrument is not the danger; unfamiliarity with it is.'},
 {q:'Know what you own, and know why you own it.', a:'Peter Lynch', s:'attributed', n:'The cheapest filter in existence. If the thesis will not fit in a paragraph, the position should not fit in the account.'},
 {q:'I always place my stop beyond some technical barrier.', a:'Bruce Kovner', s:'Market Wizards', n:'Stops belong where the idea is proven wrong, not where the loss becomes uncomfortable. Those are almost never the same price.'},
 {q:'He who lives by the crystal ball will eat shattered glass.', a:'Ray Dalio', s:'Principles', n:'Forecasting is the most confident-sounding and least reliable part of this business. Position sizing survives being wrong; predictions do not.'},
 {q:'Do not try to buy at the bottom and sell at the top.', a:'Bernard Baruch', s:'attributed', n:'The middle of the move is where the money is and where the certainty is highest. The extremes are where the stories are.'}
];
