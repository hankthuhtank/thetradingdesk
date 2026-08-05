/* ============================================================
   THE TRADING DESK - THE LEDGER
   Metric dictionary for the company financials explorer.
   Every entry knows: which Finnhub keys might carry it (the API
   is inconsistent about naming across tiers, so each metric lists
   candidates and we take the first that exists), how to format
   it, what it actually means in plain language, why it moves the
   share price, and the bands that turn a number into a read.
   Nothing is ever invented: a metric the API does not return is
   shown as "not reported" and nothing is filled in for it.
   ============================================================ */
window.TDESK = window.TDESK || {};

/* bands: [upperBound, verdict, tone]  tone: good | ok | warn | bad | note
   The last band should use Infinity. Bands describe a typical
   large-cap US company; sector context always overrides them, and
   the UI says so. */
window.TDESK.LEDGER_GROUPS = [
  ['size',   'Size and how it trades', 'Before any ratio means anything, know how big this is and how violently it moves.'],
  ['value',  'What you are paying',    'Valuation is not a verdict. It is the market telling you what growth it already expects, which is the bar the company has to clear.'],
  ['profit', 'What it keeps',          'Two companies with the same revenue can be completely different businesses. Margins are where that shows up.'],
  ['growth', 'Whether it is getting bigger', 'Growth is the numerator of almost every valuation argument. Durability matters more than the rate.'],
  ['health', 'Whether it survives a bad year', 'Leverage decides whether a downturn is a rough quarter or an existential event.'],
  ['return', 'What it pays you',       'Dividends and buybacks are how profit reaches you without you selling anything.']
];

window.TDESK.LEDGER_METRICS = [
/* ---------- size ---------- */
{id:'mcap', n:'Market capitalisation', grp:'size', fmt:'big',
 k:['marketCapitalization'], mult:1e6,
 what:'Share price multiplied by every share outstanding. The price tag on the whole company as the market currently sees it.',
 why:'It is the denominator of your own position. A $20bn company moving 5% is a different event from a $2tn company moving 5%, and the same piece of news will not move both the same way.'},
{id:'ev', n:'Enterprise value', grp:'size', fmt:'big',
 k:['enterpriseValue'], mult:1e6,
 what:'Market cap plus debt, minus cash. What it would actually cost to buy the whole business and take on its obligations.',
 why:'This is the honest price tag. A company with heavy debt is more expensive than its market cap suggests, and a company sitting on a cash pile is cheaper.'},
{id:'beta', n:'Beta', grp:'size', fmt:'x2',
 k:['beta'],
 bands:[[0.8,'Moves less than the market','note'],[1.2,'Moves roughly with the market','ok'],[1.8,'Amplifies the market','warn'],[Infinity,'Violently amplifies the market','bad']],
 what:'How much this stock has historically moved for every 1% move in the broad market. A beta of 1.5 means it has tended to move about 1.5% when the market moves 1%.',
 why:'It is the number you must use to size a hedge, and the reason a "diversified" portfolio of high-beta names is not diversified at all. In a selloff they all fall together, harder.'},
{id:'w52h', n:'52-week high', grp:'size', fmt:'usd', k:['52WeekHigh'],
 what:'The highest price traded in the last year.',
 why:'Distance from the high is a crude but real sentiment gauge, and the high itself tends to act as a level because a lot of people bought there and remember it.'},
{id:'w52l', n:'52-week low', grp:'size', fmt:'usd', k:['52WeekLow'],
 what:'The lowest price traded in the last year.',
 why:'The floor the market has tested most recently. Breaking it changes the character of every chart on every timeframe at once.'},
{id:'vol10', n:'10-day average volume', grp:'size', fmt:'big', k:['10DayAverageTradingVolume'], mult:1e6,
 what:'Typical daily share volume over the last two trading weeks.',
 why:'Liquidity decides whether you can get out at the price you see. It also sets the option chain quality, which is where a good read gets destroyed by a bad spread.'},

/* ---------- valuation ---------- */
{id:'pe', n:'Price to earnings (TTM)', grp:'value', fmt:'x1',
 k:['peTTM','peBasicExclExtraTTM','peExclExtraTTM','peNormalizedAnnual'],
 bands:[[0,'Losing money, so P/E is meaningless here','note'],[12,'Priced for very little growth','good'],[22,'Around the long-run market average','ok'],[40,'Priced for real growth','warn'],[Infinity,'Priced for a great deal to go right','bad']],
 what:'Dollars you pay for every one dollar of annual profit. A P/E of 25 means you are paying $25 for $1 of current earnings.',
 why:'This is the single most direct expression of expectations. Price only rises two ways: earnings grow, or the multiple people will pay for those earnings grows. A high P/E means the second lever is already stretched, so the earnings had better arrive.'},
{id:'ps', n:'Price to sales (TTM)', grp:'value', fmt:'x1',
 k:['psTTM','psAnnual'],
 bands:[[1,'Cheap on revenue','good'],[3,'Ordinary','ok'],[10,'Expensive on revenue','warn'],[Infinity,'Extremely expensive on revenue','bad']],
 what:'What you pay for each dollar of annual revenue, before any costs.',
 why:'The fallback for companies with no profit yet. It is also the honest check on a story stock: revenue is much harder to engineer than earnings.'},
{id:'pb', n:'Price to book', grp:'value', fmt:'x1',
 k:['pbQuarterly','pbAnnual'],
 bands:[[1,'Below the accounting value of its assets','good'],[3,'Ordinary','ok'],[8,'Paying heavily for things not on the balance sheet','warn'],[Infinity,'Book value is telling you nothing here','note']],
 what:'Price against the net assets on the balance sheet.',
 why:'Genuinely useful for banks and asset-heavy businesses. Close to useless for software companies, whose real assets are people and code and never appear in book value.'},
{id:'evebitda', n:'EV to EBITDA', grp:'value', fmt:'x1',
 k:['currentEv/freeCashFlowTTM','evEbitdaTTM','currentEv/ebitdaTTM'],
 bands:[[8,'Cheap on cash earnings','good'],[15,'Ordinary','ok'],[30,'Expensive','warn'],[Infinity,'Priced for perfection','bad']],
 what:'Enterprise value against earnings before interest, tax, depreciation and amortisation. A capital-structure-neutral version of the P/E.',
 why:'It lets you compare two companies with very different debt loads on the same footing, which P/E cannot do.'},
{id:'divy', n:'Dividend yield', grp:'value', fmt:'pct',
 k:['dividendYieldIndicatedAnnual','currentDividendYieldTTM'],
 bands:[[0.01,'Effectively none','note'],[2,'Modest','ok'],[5,'Substantial','good'],[Infinity,'Unusually high, check whether it is sustainable','warn']],
 what:'Annual dividend as a percentage of the share price.',
 why:'A very high yield is usually not generosity. It is the price falling faster than the dividend has been cut yet, which is why it belongs next to the payout ratio.'},

/* ---------- profitability ---------- */
{id:'gm', n:'Gross margin', grp:'profit', fmt:'pct',
 k:['grossMarginTTM','grossMarginAnnual'],
 bands:[[20,'Thin, a volume business','note'],[40,'Ordinary','ok'],[65,'Strong pricing power','good'],[Infinity,'Exceptional, usually software or brand','good']],
 what:'What is left from every sales dollar after the direct cost of making the thing.',
 why:'The clearest read on pricing power there is. A business that can raise prices without losing customers shows it here first, and gross margin is the ceiling every other margin sits under.'},
{id:'om', n:'Operating margin', grp:'profit', fmt:'pct',
 k:['operatingMarginTTM','operatingMarginAnnual'],
 bands:[[0,'Losing money on operations','bad'],[8,'Thin','warn'],[20,'Healthy','ok'],[Infinity,'Very strong','good']],
 what:'What survives after the cost of goods and the whole cost of running the company: staff, research, marketing, overheads.',
 why:'This is the real operating engine, before financing decisions and tax games. Watch its direction more than its level: expanding operating margin on flat revenue is one of the strongest signals in fundamental analysis.'},
{id:'nm', n:'Net margin', grp:'profit', fmt:'pct',
 k:['netProfitMarginTTM','netProfitMarginAnnual'],
 bands:[[0,'Unprofitable','bad'],[5,'Thin','warn'],[15,'Healthy','ok'],[Infinity,'Very profitable','good']],
 what:'What is finally left for shareholders out of every sales dollar, after everything including interest and tax.',
 why:'The bottom line that feeds earnings per share, which feeds the P/E, which feeds the price. Everything above rolls into this one number.'},
{id:'roe', n:'Return on equity', grp:'profit', fmt:'pct',
 k:['roeTTM','roeRfy','roeAnnual'],
 bands:[[0,'Destroying shareholder capital','bad'],[10,'Weak','warn'],[20,'Good','ok'],[Infinity,'Excellent, but check the debt load','good']],
 what:'Profit produced for every dollar of shareholder equity.',
 why:'The compounding rate of the business itself. Be careful though: heavy borrowing inflates ROE without making the company better, so always read it beside debt to equity.'},
{id:'roa', n:'Return on assets', grp:'profit', fmt:'pct',
 k:['roaTTM','roaRfy','roaAnnual'],
 bands:[[0,'Assets are not earning','bad'],[5,'Modest','warn'],[12,'Good','ok'],[Infinity,'Excellent','good']],
 what:'Profit produced for every dollar of everything the company owns.',
 why:'The debt-proof version of ROE. If ROE is high and ROA is low, the returns are coming from leverage rather than from the business.'},
{id:'roi', n:'Return on invested capital', grp:'profit', fmt:'pct',
 k:['roiTTM','roiAnnual','roicTTM'],
 bands:[[0,'Burning capital','bad'],[8,'Probably below its cost of capital','warn'],[15,'Creating value','ok'],[Infinity,'A genuine moat signature','good']],
 what:'Profit against all the capital put to work in the business, debt and equity together.',
 why:'The number that separates a good business from a big one. Sustained returns above the cost of capital is the quantitative fingerprint of a competitive advantage.'},

/* ---------- growth ---------- */
{id:'revg', n:'Revenue growth, TTM year on year', grp:'growth', fmt:'pct',
 k:['revenueGrowthTTMYoy','revenueGrowthQuarterlyYoy','revenueGrowth5Y'],
 bands:[[0,'Shrinking','bad'],[5,'Barely growing','warn'],[15,'Solid','ok'],[Infinity,'Fast','good']],
 what:'How much bigger the top line is than it was a year ago.',
 why:'Revenue is the hardest line to manipulate and the first to break. Decelerating growth is what usually causes a high multiple to collapse, and it collapses well before growth turns negative.'},
{id:'revg5', n:'Revenue growth, 5-year', grp:'growth', fmt:'pct',
 k:['revenueGrowth5Y','revenueGrowth3Y'],
 bands:[[0,'Shrinking over five years','bad'],[5,'Slow','warn'],[15,'Consistent','ok'],[Infinity,'Rapid','good']],
 what:'The annualised growth rate of revenue over the last five years.',
 why:'The durability check. One great year is noise. Five years of compounding is a business, and it is what justifies paying a premium multiple.'},
{id:'epsg', n:'EPS growth, TTM year on year', grp:'growth', fmt:'pct',
 k:['epsGrowthTTMYoy','epsGrowthQuarterlyYoy','epsGrowth5Y'],
 bands:[[0,'Earnings falling','bad'],[5,'Flat','warn'],[20,'Growing well','ok'],[Infinity,'Growing fast','good']],
 what:'Growth in profit per share, which counts both profit growth and any change in the share count.',
 why:'Compare it against revenue growth. EPS growing much faster than revenue means margins expanded or the company bought back stock. Both are real, but only one is the business improving.'},
{id:'epsg5', n:'EPS growth, 5-year', grp:'growth', fmt:'pct',
 k:['epsGrowth5Y','epsGrowth3Y'],
 bands:[[0,'Falling over five years','bad'],[5,'Slow','warn'],[15,'Consistent','ok'],[Infinity,'Rapid','good']],
 what:'The annualised growth in earnings per share over five years.',
 why:'Long-run share price tends to track long-run earnings per share more closely than anything else on this page.'},

/* ---------- health ---------- */
{id:'cr', n:'Current ratio', grp:'health', fmt:'x2',
 k:['currentRatioQuarterly','currentRatioAnnual'],
 bands:[[1,'Short-term obligations exceed short-term assets','bad'],[1.5,'Tight but workable','warn'],[3,'Comfortable','good'],[Infinity,'Very liquid, possibly idle cash','note']],
 what:'Assets that convert to cash within a year against bills due within a year.',
 why:'Companies do not fail because profits fall. They fail because they cannot pay something on the day it is due. Under 1 means it depends on refinancing.'},
{id:'qr', n:'Quick ratio', grp:'health', fmt:'x2',
 k:['quickRatioQuarterly','quickRatioAnnual'],
 bands:[[0.8,'Depends on selling inventory to pay bills','warn'],[1.5,'Adequate','ok'],[Infinity,'Strong','good']],
 what:'The current ratio with inventory stripped out, since inventory is the hardest current asset to turn into cash quickly.',
 why:'The stricter test. For a retailer or a manufacturer, the gap between the current and quick ratio tells you how much of the safety net is unsold product.'},
{id:'de', n:'Debt to equity', grp:'health', fmt:'x2',
 k:['totalDebt/totalEquityQuarterly','totalDebt/totalEquityAnnual','totalDebtToEquityQuarterly'],
 bands:[[0.3,'Lightly levered','good'],[1,'Ordinary','ok'],[2,'Heavily levered','warn'],[Infinity,'Very heavily levered','bad']],
 what:'Borrowed money against shareholder money.',
 why:'Leverage magnifies both directions. It is why a modest revenue decline can wipe out equity value in a levered company while a debt-free peer just has a bad year.'},
{id:'ic', n:'Interest coverage', grp:'health', fmt:'x1',
 k:['netInterestCoverageTTM','netInterestCoverageAnnual'],
 bands:[[1.5,'Interest is nearly eating operating profit','bad'],[4,'Uncomfortable','warn'],[10,'Comfortable','ok'],[Infinity,'Debt service is a non-issue','good']],
 what:'How many times over operating profit covers the interest bill.',
 why:'The most direct measure of whether the debt is a tool or a problem. Under about 2, one bad year turns into a covenant conversation with lenders.'},

/* ---------- shareholder return ---------- */
{id:'payout', n:'Payout ratio', grp:'return', fmt:'pct',
 k:['payoutRatioTTM','payoutRatioAnnual'],
 bands:[[0.01,'Pays no dividend','note'],[40,'Comfortably covered','good'],[70,'Covered, with less room','ok'],[100,'Paying out nearly everything it earns','warn'],[Infinity,'Paying out more than it earns','bad']],
 what:'The share of earnings handed out as dividends.',
 why:'Above 100% the dividend is being funded from cash reserves or borrowing, which is exactly the setup that precedes a cut. Dividend cuts are among the most violent single-day repricings there are.'},
{id:'dps', n:'Dividend per share (TTM)', grp:'return', fmt:'usd',
 k:['dividendPerShareTTM','dividendPerShareAnnual'],
 what:'Cash paid per share over the last twelve months.',
 why:'The absolute number matters for income planning; the growth in this number over years matters far more for total return.'},
{id:'bvps', n:'Book value per share', grp:'return', fmt:'usd',
 k:['bookValuePerShareQuarterly','bookValuePerShareAnnual'],
 what:'Net assets divided by shares outstanding: the accounting value backing each share.',
 why:'A floor concept rather than a target. It matters most for financials and asset-heavy businesses, and least for companies whose value is intangible.'}
];

/* time series worth drawing, with the candidate key names Finnhub
   uses inside metric.series.annual */
window.TDESK.LEDGER_SERIES = [
 {id:'revsh', n:'Revenue per share', k:['salesPerShare'], fmt:'usd',
  note:'Growth per share rather than in total, so buybacks and share issuance are already accounted for.'},
 {id:'eps',  n:'Earnings per share', k:['eps'], fmt:'usd',
  note:'The line the share price tracks most closely over long periods.'},
 {id:'gm',   n:'Gross margin', k:['grossMargin'], fmt:'pctd',
  note:'Direction matters more than level. Compression here shows up in everything below it.'},
 {id:'nm',   n:'Net margin', k:['netMargin'], fmt:'pctd',
  note:'What actually reaches shareholders from each sales dollar.'},
 {id:'roe',  n:'Return on equity', k:['roe'], fmt:'pctd',
  note:'The compounding rate of the business, read alongside the debt trend below.'},
 {id:'de',   n:'Debt to equity', k:['totalDebtToEquity','totalDebtToTotalEquity'], fmt:'x2', inv:true,
  note:'Rising leverage alongside rising ROE means the returns are borrowed, not earned.'},
 {id:'cr',   n:'Current ratio', k:['currentRatio'], fmt:'x2',
  note:'The short-term survival cushion, year by year.'},
 {id:'bv',   n:'Book value per share', k:['bookValue','bookValuePerShare'], fmt:'usd',
  note:'The accounting value building up (or eroding) behind each share.'}
];

/* the education layer: how any of this reaches the share price */
window.TDESK.LEDGER_LESSONS = [
{n:'Price is two numbers multiplied together',
 b:'Share price = earnings per share \u00d7 the multiple people will pay for them. That identity is the whole game. A stock can double because profit doubled, because sentiment doubled the multiple, or some mix. Only one of those is durable, and telling them apart is most of fundamental analysis.',
 t:'When a stock falls on a good earnings report, the multiple contracted faster than earnings grew. The company did fine; the expectations did not.'},
{n:'The market trades the surprise, not the result',
 b:'Analyst estimates are already in the price before the report. What moves the stock is the gap between what was expected and what arrived, plus what management says about next quarter. This is why a company can report record profit and drop 12%.',
 t:'Check the earnings history panel below. A name that habitually beats by a small margin has that pattern priced in, so a merely in-line quarter reads as a miss.'},
{n:'Guidance outweighs the quarter that just ended',
 b:'The reported quarter is history. Forward guidance is the new input for every model on the street. A strong quarter with lowered guidance is usually a red candle, and a weak quarter with raised guidance is usually a green one.',
 t:'This is why the move often happens on the conference call rather than at the press release.'},
{n:'Margin direction beats margin level',
 b:'A company at 30% gross margin improving toward 35% is usually rewarded more than one sitting flat at 60%. Markets price change. Expanding margins on flat revenue means the business got better at converting sales into profit, which compounds.',
 t:'Read the margin series chart for direction first and level second.'},
{n:'Growth decelerating is the multiple killer',
 b:'High multiples are paid for high growth. The damage rarely arrives when growth goes negative; it arrives when growth slows from 40% to 25%, because every future year in the model gets revised at once.',
 t:'Compare TTM revenue growth against the five-year rate. A large gap in either direction is the story.'},
{n:'Leverage decides how bad a bad year gets',
 b:'Debt is fixed and revenue is not. A 20% revenue decline at a debt-free company is an unpleasant year. The same decline at a company with heavy debt and thin interest coverage is a solvency question, and equity is last in line.',
 t:'Read debt to equity beside interest coverage. Either alone can mislead; together they are hard to argue with.'},
{n:'Cash flow is harder to dress up than earnings',
 b:'Net income is an accounting figure shaped by legitimate judgement calls on revenue timing, depreciation, and one-off charges. Cash either arrived or it did not. Persistent gaps between reported profit and cash generation are among the most reliable warning signs available.',
 t:'If profit is rising and cash is not, ask which working-capital line is absorbing the difference.'},
{n:'Sector context overrides every rule of thumb',
 b:'A 15 P/E is expensive for a bank and cheap for a software company. A 45% gross margin is exceptional for a grocer and alarming for a chip designer. Every band on this page is a general starting point, and the comparison that actually matters is against the company\u2019s own history and its direct peers.',
 t:'Use the peers row to check the same metric across the group before drawing any conclusion.'}
];
