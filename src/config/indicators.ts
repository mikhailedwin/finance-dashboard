/**
 * Indicator registry — the single source of truth for the dashboard.
 *
 * Both the build-time fetch script (`scripts/fetch-data.ts`) and the UI read from
 * this file, so a series only ever needs to be described once.
 *
 * All series are pulled from FRED (Federal Reserve Bank of St. Louis). Every id
 * here has been verified to return live data from FRED's CSV endpoint.
 */

export type Category =
  | 'growth'
  | 'inflation'
  | 'labor'
  | 'rates'
  | 'consumer'
  | 'housing'
  | 'credit'
  | 'global';

/**
 * Which direction is good for the economy. Drives the improving/deteriorating
 * language in the executive summary — falling inflation reads as an improvement,
 * falling payrolls does not.
 */
export type Polarity = 'higher-is-better' | 'lower-is-better' | 'neutral';

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';

/** How the raw FRED level is turned into the headline number we display. */
export type Transform =
  | 'none'
  /** Percent change from a year ago. */
  | 'yoy'
  /** Absolute change from the prior observation (e.g. jobs added). */
  | 'diff';

export type Format =
  | 'percent'
  | 'index'
  | 'number'
  | 'currency'
  /** Rendered with compact magnitude suffixes (147K, 7.6M). */
  | 'count';

export interface Indicator {
  /** FRED series id. */
  id: string;
  label: string;
  /** Compact label for tiles and legends where space is tight. */
  shortLabel?: string;
  category: Category;
  frequency: Frequency;
  transform: Transform;
  format: Format;
  polarity: Polarity;
  decimals: number;
  /**
   * Multiplier converting the stored FRED value into real-world units, so
   * `count` formatting can be uniform. FRED publishes payrolls in thousands of
   * persons but jobless claims as a raw headcount; without this they would
   * render a thousandfold apart.
   */
  scale?: number;
  /** Plain-English explanation of what this measures and why it matters. */
  description: string;
  source: string;
  /** Surface on the executive summary as a headline KPI tile. */
  headline?: boolean;
  /** Chart a horizontal reference line here (e.g. the Fed's 2% target). */
  referenceLine?: { value: number; label: string };
  /** Chart as bars rather than a line — right for flow/change series. */
  chartType?: 'line' | 'bar' | 'area';
  /** Smooth noisy high-frequency series with an N-period moving average. */
  movingAverage?: number;
}

export const INDICATORS: Indicator[] = [
  // ─────────────────────────── Growth & Output ───────────────────────────
  {
    id: 'A191RL1Q225SBEA',
    label: 'Real GDP Growth',
    shortLabel: 'Real GDP',
    category: 'growth',
    frequency: 'quarterly',
    transform: 'none',
    format: 'percent',
    polarity: 'higher-is-better',
    decimals: 1,
    headline: true,
    chartType: 'bar',
    referenceLine: { value: 0, label: 'Contraction' },
    description:
      'Quarterly change in inflation-adjusted output, annualised. The single broadest measure of whether the economy is expanding or contracting.',
    source: 'U.S. Bureau of Economic Analysis',
  },
  {
    id: 'GDPC1',
    label: 'Real GDP (Level)',
    shortLabel: 'GDP Level',
    category: 'growth',
    frequency: 'quarterly',
    transform: 'yoy',
    format: 'percent',
    polarity: 'higher-is-better',
    decimals: 1,
    description:
      'Total inflation-adjusted output, shown as growth versus the same quarter a year earlier. Smooths out the volatility in the quarterly annualised rate.',
    source: 'U.S. Bureau of Economic Analysis',
  },
  {
    id: 'GDPNOW',
    label: 'GDPNow Nowcast',
    shortLabel: 'GDPNow',
    category: 'growth',
    frequency: 'quarterly',
    transform: 'none',
    format: 'percent',
    polarity: 'higher-is-better',
    decimals: 1,
    chartType: 'bar',
    description:
      "The Atlanta Fed's running estimate of current-quarter GDP growth, updated as data arrives. A real-time read well ahead of the official release.",
    source: 'Federal Reserve Bank of Atlanta',
  },
  {
    id: 'INDPRO',
    label: 'Industrial Production',
    shortLabel: 'Ind. Production',
    category: 'growth',
    frequency: 'monthly',
    transform: 'yoy',
    format: 'percent',
    polarity: 'higher-is-better',
    decimals: 1,
    description:
      'Output of factories, mines and utilities. Cyclically sensitive, so it tends to turn before the broader economy.',
    source: 'Federal Reserve Board',
  },
  {
    id: 'TCU',
    label: 'Capacity Utilisation',
    shortLabel: 'Cap. Util.',
    category: 'growth',
    frequency: 'monthly',
    transform: 'none',
    format: 'percent',
    polarity: 'higher-is-better',
    decimals: 1,
    description:
      'Share of industrial capacity actually in use. Sustained readings above roughly 80% signal a tight economy with inflationary pressure.',
    source: 'Federal Reserve Board',
  },
  {
    id: 'NEWORDER',
    label: 'Core Capital Goods Orders',
    shortLabel: 'Capex Orders',
    category: 'growth',
    frequency: 'monthly',
    transform: 'yoy',
    format: 'percent',
    polarity: 'higher-is-better',
    decimals: 1,
    description:
      'New orders for non-defence capital goods excluding aircraft — the standard proxy for business investment intentions, and a classic leading indicator.',
    source: 'U.S. Census Bureau',
  },
  {
    id: 'DGORDER',
    label: 'Durable Goods Orders',
    shortLabel: 'Durable Goods',
    category: 'growth',
    frequency: 'monthly',
    transform: 'yoy',
    format: 'percent',
    polarity: 'higher-is-better',
    decimals: 1,
    description:
      'New orders for goods designed to last three years or more. Leads production because orders precede output.',
    source: 'U.S. Census Bureau',
  },
  {
    id: 'ISRATIO',
    label: 'Inventories-to-Sales',
    shortLabel: 'Inv/Sales',
    category: 'growth',
    frequency: 'monthly',
    transform: 'none',
    format: 'number',
    polarity: 'lower-is-better',
    decimals: 2,
    description:
      'Months of inventory on hand at the current sales pace. Rising ratios mean goods are piling up, which usually precedes production cuts.',
    source: 'U.S. Census Bureau',
  },
  {
    id: 'MANEMP',
    label: 'Manufacturing Employment',
    shortLabel: 'Mfg. Employment',
    category: 'growth',
    frequency: 'monthly',
    transform: 'yoy',
    format: 'percent',
    polarity: 'higher-is-better',
    decimals: 1,
    description:
      'Payrolls in manufacturing. A cyclical bellwether that historically weakens ahead of broader labour-market downturns.',
    source: 'U.S. Bureau of Labor Statistics',
  },
  {
    id: 'FYFSGDA188S',
    label: 'Federal Deficit (% of GDP)',
    shortLabel: 'Fed. Deficit',
    category: 'growth',
    frequency: 'annual',
    transform: 'none',
    format: 'percent',
    polarity: 'higher-is-better',
    decimals: 1,
    chartType: 'bar',
    referenceLine: { value: 0, label: 'Balanced' },
    description:
      'Federal surplus or deficit as a share of GDP. Negative values are deficits; the scale of fiscal support or drag on the economy.',
    source: 'U.S. Office of Management and Budget',
  },

  // ─────────────────────────── Inflation & Prices ───────────────────────────
  {
    id: 'CPILFESL',
    label: 'Core CPI',
    shortLabel: 'Core CPI',
    category: 'inflation',
    frequency: 'monthly',
    transform: 'yoy',
    format: 'percent',
    polarity: 'lower-is-better',
    decimals: 1,
    headline: true,
    referenceLine: { value: 2, label: 'Fed target' },
    description:
      'Consumer prices excluding food and energy, versus a year earlier. Stripping the volatile components gives a cleaner read on the underlying inflation trend.',
    source: 'U.S. Bureau of Labor Statistics',
  },
  {
    id: 'PCEPILFE',
    label: 'Core PCE',
    shortLabel: 'Core PCE',
    category: 'inflation',
    frequency: 'monthly',
    transform: 'yoy',
    format: 'percent',
    polarity: 'lower-is-better',
    decimals: 1,
    headline: true,
    referenceLine: { value: 2, label: 'Fed target' },
    description:
      "The Federal Reserve's preferred inflation gauge. This is the series the 2% target is actually defined against.",
    source: 'U.S. Bureau of Economic Analysis',
  },
  {
    id: 'CPIAUCSL',
    label: 'Headline CPI',
    shortLabel: 'CPI',
    category: 'inflation',
    frequency: 'monthly',
    transform: 'yoy',
    format: 'percent',
    polarity: 'lower-is-better',
    decimals: 1,
    referenceLine: { value: 2, label: 'Fed target' },
    description:
      'All-items consumer price inflation, including food and energy. The number households actually experience.',
    source: 'U.S. Bureau of Labor Statistics',
  },
  {
    id: 'CUSR0000SAH1',
    label: 'Shelter CPI',
    shortLabel: 'Shelter',
    category: 'inflation',
    frequency: 'monthly',
    transform: 'yoy',
    format: 'percent',
    polarity: 'lower-is-better',
    decimals: 1,
    description:
      'Housing costs, roughly a third of the CPI basket. It lags market rents by a year or more, which makes it the slowest-moving part of core inflation.',
    source: 'U.S. Bureau of Labor Statistics',
  },
  {
    id: 'CPIENGSL',
    label: 'Energy CPI',
    shortLabel: 'Energy',
    category: 'inflation',
    frequency: 'monthly',
    transform: 'yoy',
    format: 'percent',
    polarity: 'lower-is-better',
    decimals: 1,
    description:
      'Energy prices paid by consumers. Highly volatile, and the main reason headline and core inflation diverge.',
    source: 'U.S. Bureau of Labor Statistics',
  },
  {
    id: 'CPIUFDSL',
    label: 'Food CPI',
    shortLabel: 'Food',
    category: 'inflation',
    frequency: 'monthly',
    transform: 'yoy',
    format: 'percent',
    polarity: 'lower-is-better',
    decimals: 1,
    description:
      'Food prices paid by consumers — one of the most visible components of inflation for households.',
    source: 'U.S. Bureau of Labor Statistics',
  },
  {
    id: 'PPIACO',
    label: 'Producer Prices',
    shortLabel: 'PPI',
    category: 'inflation',
    frequency: 'monthly',
    transform: 'yoy',
    format: 'percent',
    polarity: 'lower-is-better',
    decimals: 1,
    description:
      'Prices received by domestic producers. Pipeline pressure that often passes through to consumer prices with a lag.',
    source: 'U.S. Bureau of Labor Statistics',
  },
  {
    id: 'T10YIE',
    label: '10Y Breakeven Inflation',
    shortLabel: '10Y Breakeven',
    category: 'inflation',
    frequency: 'daily',
    transform: 'none',
    format: 'percent',
    polarity: 'neutral',
    decimals: 2,
    referenceLine: { value: 2, label: 'Fed target' },
    description:
      "Inflation the bond market expects over the next decade, implied by the gap between nominal and inflation-protected Treasury yields. The market's verdict on Fed credibility.",
    source: 'Federal Reserve Bank of St. Louis',
  },
  {
    id: 'MICH',
    label: 'Consumer Inflation Expectations',
    shortLabel: 'Infl. Expectations',
    category: 'inflation',
    frequency: 'monthly',
    transform: 'none',
    format: 'percent',
    polarity: 'lower-is-better',
    decimals: 1,
    description:
      'What households expect inflation to be over the coming year. Expectations feed into wage demands, so they can become self-fulfilling.',
    source: 'University of Michigan',
  },
  {
    id: 'CES0500000003',
    label: 'Average Hourly Earnings',
    shortLabel: 'Wages',
    category: 'inflation',
    frequency: 'monthly',
    transform: 'yoy',
    format: 'percent',
    polarity: 'neutral',
    decimals: 1,
    description:
      'Private-sector wage growth. Good for workers, but sustained growth above productivity plus 2% makes the inflation target hard to hit.',
    source: 'U.S. Bureau of Labor Statistics',
  },

  // ─────────────────────────── Labor Market ───────────────────────────
  {
    id: 'UNRATE',
    label: 'Unemployment Rate',
    shortLabel: 'Unemployment',
    category: 'labor',
    frequency: 'monthly',
    transform: 'none',
    format: 'percent',
    polarity: 'lower-is-better',
    decimals: 1,
    headline: true,
    description:
      'Share of the labour force actively looking for work and unable to find it. The most widely followed measure of labour-market health.',
    source: 'U.S. Bureau of Labor Statistics',
  },
  {
    id: 'PAYEMS',
    label: 'Monthly Job Growth',
    shortLabel: 'Payrolls',
    category: 'labor',
    frequency: 'monthly',
    transform: 'diff',
    format: 'count',
    scale: 1000,
    polarity: 'higher-is-better',
    decimals: 0,
    headline: true,
    chartType: 'bar',
    referenceLine: { value: 0, label: 'Job losses' },
    description:
      'Net jobs added to nonfarm payrolls each month. The headline number from the monthly employment report.',
    source: 'U.S. Bureau of Labor Statistics',
  },
  {
    id: 'ICSA',
    label: 'Initial Jobless Claims',
    shortLabel: 'Jobless Claims',
    category: 'labor',
    frequency: 'weekly',
    transform: 'none',
    format: 'count',
    polarity: 'lower-is-better',
    decimals: 0,
    movingAverage: 4,
    description:
      'New filings for unemployment insurance each week, shown as a 4-week average. The highest-frequency read on the labour market available.',
    source: 'U.S. Employment and Training Administration',
  },
  {
    id: 'JTSJOL',
    label: 'Job Openings',
    shortLabel: 'Openings',
    category: 'labor',
    frequency: 'monthly',
    transform: 'none',
    format: 'count',
    scale: 1000,
    polarity: 'higher-is-better',
    decimals: 0,
    description:
      'Unfilled positions employers are actively recruiting for. Falling openings are usually the first sign of cooling labour demand, ahead of actual job losses.',
    source: 'U.S. Bureau of Labor Statistics',
  },
  {
    id: 'SAHMREALTIME',
    label: 'Sahm Rule Indicator',
    shortLabel: 'Sahm Rule',
    category: 'labor',
    frequency: 'monthly',
    transform: 'none',
    format: 'percent',
    polarity: 'lower-is-better',
    decimals: 2,
    referenceLine: { value: 0.5, label: 'Recession trigger' },
    description:
      'How far the 3-month average unemployment rate has risen above its low of the past year. Crossing 0.50 has coincided with the start of every recession since 1970.',
    source: 'Federal Reserve Bank of St. Louis',
  },
  {
    id: 'LNS12300060',
    label: 'Prime-Age Employment Rate',
    shortLabel: 'Prime-Age EPOP',
    category: 'labor',
    frequency: 'monthly',
    transform: 'none',
    format: 'percent',
    polarity: 'higher-is-better',
    decimals: 1,
    description:
      'Share of 25–54 year-olds with a job. Because it excludes students and retirees, it is cleaner than the participation rate for judging labour-market slack.',
    source: 'U.S. Bureau of Labor Statistics',
  },
  {
    id: 'CIVPART',
    label: 'Labour Force Participation',
    shortLabel: 'Participation',
    category: 'labor',
    frequency: 'monthly',
    transform: 'none',
    format: 'percent',
    polarity: 'higher-is-better',
    decimals: 1,
    description:
      'Share of the adult population working or looking for work. Structurally declining as the population ages.',
    source: 'U.S. Bureau of Labor Statistics',
  },
  {
    id: 'AWHMAN',
    label: 'Manufacturing Weekly Hours',
    shortLabel: 'Mfg. Hours',
    category: 'labor',
    frequency: 'monthly',
    transform: 'none',
    format: 'number',
    polarity: 'higher-is-better',
    decimals: 1,
    description:
      'Average hours worked per week in manufacturing. Employers cut hours before they cut staff, making this a genuine leading indicator.',
    source: 'U.S. Bureau of Labor Statistics',
  },

  // ─────────────────────────── Rates & Monetary Policy ───────────────────────────
  {
    id: 'FEDFUNDS',
    label: 'Fed Funds Rate',
    shortLabel: 'Fed Funds',
    category: 'rates',
    frequency: 'monthly',
    transform: 'none',
    format: 'percent',
    polarity: 'neutral',
    decimals: 2,
    headline: true,
    description:
      "The Federal Reserve's policy rate — the primary lever of US monetary policy and the anchor for borrowing costs across the economy.",
    source: 'Federal Reserve Board',
  },
  {
    id: 'T10Y2Y',
    label: '10Y–2Y Yield Spread',
    shortLabel: '10Y–2Y',
    category: 'rates',
    frequency: 'daily',
    transform: 'none',
    format: 'percent',
    polarity: 'higher-is-better',
    decimals: 2,
    headline: true,
    referenceLine: { value: 0, label: 'Inversion' },
    description:
      'Ten-year minus two-year Treasury yield. When it turns negative the curve is inverted — a signal that has preceded every US recession since 1955.',
    source: 'Federal Reserve Bank of St. Louis',
  },
  {
    id: 'T10Y3M',
    label: '10Y–3M Yield Spread',
    shortLabel: '10Y–3M',
    category: 'rates',
    frequency: 'daily',
    transform: 'none',
    format: 'percent',
    polarity: 'higher-is-better',
    decimals: 2,
    referenceLine: { value: 0, label: 'Inversion' },
    description:
      'Ten-year minus three-month Treasury yield. Academic work finds this the single most reliable curve-based recession predictor.',
    source: 'Federal Reserve Bank of St. Louis',
  },
  {
    id: 'DGS10',
    label: '10-Year Treasury Yield',
    shortLabel: '10Y Treasury',
    category: 'rates',
    frequency: 'daily',
    transform: 'none',
    format: 'percent',
    polarity: 'neutral',
    decimals: 2,
    description:
      'Benchmark long-term government borrowing cost. Anchors mortgage rates, corporate borrowing and equity valuations.',
    source: 'Federal Reserve Board',
  },
  {
    id: 'DGS2',
    label: '2-Year Treasury Yield',
    shortLabel: '2Y Treasury',
    category: 'rates',
    frequency: 'daily',
    transform: 'none',
    format: 'percent',
    polarity: 'neutral',
    decimals: 2,
    description:
      "Short-dated government yield, closely tied to where markets expect the Fed's policy rate to go over the next two years.",
    source: 'Federal Reserve Board',
  },
  {
    id: 'DGS3MO',
    label: '3-Month Treasury Yield',
    shortLabel: '3M Treasury',
    category: 'rates',
    frequency: 'daily',
    transform: 'none',
    format: 'percent',
    polarity: 'neutral',
    decimals: 2,
    description:
      'Front-end government yield, effectively tracking the current policy rate. The short leg of the 10Y–3M recession spread.',
    source: 'Federal Reserve Board',
  },
  {
    id: 'SOFR',
    label: 'SOFR',
    shortLabel: 'SOFR',
    category: 'rates',
    frequency: 'daily',
    transform: 'none',
    format: 'percent',
    polarity: 'neutral',
    decimals: 2,
    description:
      'Secured Overnight Financing Rate — the benchmark that replaced LIBOR for US dollar lending. Spikes reveal stress in funding markets.',
    source: 'Federal Reserve Bank of New York',
  },
  {
    id: 'M2SL',
    label: 'Money Supply (M2)',
    shortLabel: 'M2',
    category: 'rates',
    frequency: 'monthly',
    transform: 'yoy',
    format: 'percent',
    polarity: 'neutral',
    decimals: 1,
    referenceLine: { value: 0, label: 'Contraction' },
    description:
      'Growth in the broad money supply. Rapid expansion preceded the 2021–22 inflation surge; outright contraction is historically rare.',
    source: 'Federal Reserve Board',
  },

  // ─────────────────────────── Consumer ───────────────────────────
  {
    id: 'UMCSENT',
    label: 'Consumer Sentiment',
    shortLabel: 'Sentiment',
    category: 'consumer',
    frequency: 'monthly',
    transform: 'none',
    format: 'index',
    polarity: 'higher-is-better',
    decimals: 1,
    headline: true,
    description:
      'University of Michigan survey of how households feel about their finances and the economy. Consumer spending is roughly 70% of GDP, so confidence matters.',
    source: 'University of Michigan',
  },
  {
    id: 'RRSFS',
    label: 'Real Retail Sales',
    shortLabel: 'Retail Sales',
    category: 'consumer',
    frequency: 'monthly',
    transform: 'yoy',
    format: 'percent',
    polarity: 'higher-is-better',
    decimals: 1,
    description:
      'Retail spending adjusted for inflation. Strips out the price effects that can make nominal sales look healthier than they are.',
    source: 'U.S. Census Bureau',
  },
  {
    id: 'RSAFS',
    label: 'Retail Sales (Nominal)',
    shortLabel: 'Nominal Retail',
    category: 'consumer',
    frequency: 'monthly',
    transform: 'yoy',
    format: 'percent',
    polarity: 'higher-is-better',
    decimals: 1,
    description:
      'Total retail and food-services sales in current dollars, before adjusting for inflation.',
    source: 'U.S. Census Bureau',
  },
  {
    id: 'PCEC96',
    label: 'Real Consumer Spending',
    shortLabel: 'Real PCE',
    category: 'consumer',
    frequency: 'monthly',
    transform: 'yoy',
    format: 'percent',
    polarity: 'higher-is-better',
    decimals: 1,
    description:
      'Inflation-adjusted household consumption across goods and services — the largest single component of GDP.',
    source: 'U.S. Bureau of Economic Analysis',
  },
  {
    id: 'DSPIC96',
    label: 'Real Disposable Income',
    shortLabel: 'Real Income',
    category: 'consumer',
    frequency: 'monthly',
    transform: 'yoy',
    format: 'percent',
    polarity: 'higher-is-better',
    decimals: 1,
    description:
      'After-tax household income adjusted for inflation. Real income growth is what makes consumer spending sustainable rather than debt-funded.',
    source: 'U.S. Bureau of Economic Analysis',
  },
  {
    id: 'PSAVERT',
    label: 'Personal Saving Rate',
    shortLabel: 'Saving Rate',
    category: 'consumer',
    frequency: 'monthly',
    transform: 'none',
    format: 'percent',
    polarity: 'neutral',
    decimals: 1,
    description:
      'Share of disposable income households save. Very low readings suggest spending is being funded from savings or credit rather than income.',
    source: 'U.S. Bureau of Economic Analysis',
  },
  {
    id: 'TOTALSA',
    label: 'Vehicle Sales',
    shortLabel: 'Auto Sales',
    category: 'consumer',
    frequency: 'monthly',
    transform: 'none',
    format: 'count',
    scale: 1_000_000,
    polarity: 'higher-is-better',
    decimals: 2,
    description:
      'Annualised vehicle sales in millions of units. Big-ticket, credit-sensitive purchases that respond quickly to interest rates.',
    source: 'U.S. Bureau of Economic Analysis',
  },

  // ─────────────────────────── Housing ───────────────────────────
  {
    id: 'HOUST',
    label: 'Housing Starts',
    shortLabel: 'Housing Starts',
    category: 'housing',
    frequency: 'monthly',
    transform: 'none',
    format: 'count',
    scale: 1000,
    polarity: 'higher-is-better',
    decimals: 2,
    description:
      'New residential construction begun, at an annual rate. Housing is among the most rate-sensitive sectors and typically turns early in the cycle.',
    source: 'U.S. Census Bureau',
  },
  {
    id: 'PERMIT',
    label: 'Building Permits',
    shortLabel: 'Permits',
    category: 'housing',
    frequency: 'monthly',
    transform: 'none',
    format: 'count',
    scale: 1000,
    polarity: 'higher-is-better',
    decimals: 2,
    description:
      'Permits issued for new construction. Because permits precede starts, this is one of the official components of the leading economic index.',
    source: 'U.S. Census Bureau',
  },
  {
    id: 'MORTGAGE30US',
    label: '30-Year Mortgage Rate',
    shortLabel: 'Mortgage Rate',
    category: 'housing',
    frequency: 'weekly',
    transform: 'none',
    format: 'percent',
    polarity: 'lower-is-better',
    decimals: 2,
    description:
      'Average rate on a 30-year fixed mortgage. The main channel through which Fed policy reaches household budgets.',
    source: 'Freddie Mac',
  },
  {
    id: 'CSUSHPINSA',
    label: 'Home Prices (Case-Shiller)',
    shortLabel: 'Home Prices',
    category: 'housing',
    frequency: 'monthly',
    transform: 'yoy',
    format: 'percent',
    polarity: 'neutral',
    decimals: 1,
    description:
      'National house-price growth from the S&P CoreLogic Case-Shiller index. Drives household wealth and, with a long lag, shelter inflation.',
    source: 'S&P Dow Jones Indices',
  },

  // ─────────────────────────── Credit & Financial Conditions ───────────────────────────
  {
    id: 'NFCI',
    label: 'Financial Conditions Index',
    shortLabel: 'Fin. Conditions',
    category: 'credit',
    frequency: 'weekly',
    transform: 'none',
    format: 'number',
    polarity: 'lower-is-better',
    decimals: 2,
    headline: true,
    referenceLine: { value: 0, label: 'Neutral' },
    description:
      'Chicago Fed summary of over 100 measures of risk, credit and leverage. Zero is average by construction; positive means conditions are tighter than normal.',
    source: 'Federal Reserve Bank of Chicago',
  },
  {
    id: 'BAA10Y',
    label: 'Corporate Credit Spread',
    shortLabel: 'Credit Spread',
    category: 'credit',
    frequency: 'daily',
    transform: 'none',
    format: 'percent',
    polarity: 'lower-is-better',
    decimals: 2,
    description:
      'Extra yield investors demand to hold Baa-rated corporate debt over Treasuries. Widening spreads mean the market is pricing rising default risk.',
    source: "Moody's / Federal Reserve Bank of St. Louis",
  },
  {
    id: 'STLFSI4',
    label: 'Financial Stress Index',
    shortLabel: 'Fin. Stress',
    category: 'credit',
    frequency: 'weekly',
    transform: 'none',
    format: 'number',
    polarity: 'lower-is-better',
    decimals: 2,
    referenceLine: { value: 0, label: 'Normal' },
    description:
      'St. Louis Fed measure of stress in financial markets. Zero represents normal conditions; sharp spikes mark genuine crises.',
    source: 'Federal Reserve Bank of St. Louis',
  },
  {
    id: 'DRTSCILM',
    label: 'Bank Lending Standards',
    shortLabel: 'Lending Standards',
    category: 'credit',
    frequency: 'quarterly',
    transform: 'none',
    format: 'percent',
    polarity: 'lower-is-better',
    decimals: 1,
    referenceLine: { value: 0, label: 'Neutral' },
    description:
      'Net share of banks tightening credit standards for large and medium firms. When banks pull back, investment and hiring follow.',
    source: 'Federal Reserve Board (SLOOS)',
  },
  {
    id: 'DRTSCIS',
    label: 'Lending Standards (Small Firms)',
    shortLabel: 'Small Firm Credit',
    category: 'credit',
    frequency: 'quarterly',
    transform: 'none',
    format: 'percent',
    polarity: 'lower-is-better',
    decimals: 1,
    referenceLine: { value: 0, label: 'Neutral' },
    description:
      'Net share of banks tightening standards for small firms, which have fewer alternatives to bank credit than large corporates.',
    source: 'Federal Reserve Board (SLOOS)',
  },
  {
    id: 'RECPROUSM156N',
    label: 'Recession Probability',
    shortLabel: 'Recession Prob.',
    category: 'credit',
    frequency: 'monthly',
    transform: 'none',
    format: 'percent',
    polarity: 'lower-is-better',
    decimals: 1,
    referenceLine: { value: 30, label: 'Elevated' },
    description:
      'New York Fed model estimate of the probability of recession twelve months ahead, derived from the shape of the yield curve.',
    source: 'Federal Reserve Bank of New York',
  },
  {
    id: 'VIXCLS',
    label: 'Volatility Index (VIX)',
    shortLabel: 'VIX',
    category: 'credit',
    frequency: 'daily',
    transform: 'none',
    format: 'index',
    polarity: 'lower-is-better',
    decimals: 1,
    referenceLine: { value: 20, label: 'Long-run average' },
    description:
      "Expected equity volatility over the next 30 days, implied by options prices. Often called the market's fear gauge.",
    source: 'CBOE',
  },

  // ─────────────────────────── Dollar, Markets & Commodities ───────────────────────────
  {
    id: 'DTWEXBGS',
    label: 'US Dollar Index (Broad)',
    shortLabel: 'Dollar Index',
    category: 'global',
    frequency: 'daily',
    transform: 'none',
    format: 'index',
    polarity: 'neutral',
    decimals: 1,
    headline: true,
    description:
      "Trade-weighted value of the dollar against a broad basket of currencies. A stronger dollar dampens import prices but squeezes exporters' competitiveness.",
    source: 'Federal Reserve Board',
  },
  {
    id: 'DEXUSEU',
    label: 'USD / Euro',
    shortLabel: 'EUR/USD',
    category: 'global',
    frequency: 'daily',
    transform: 'none',
    format: 'number',
    polarity: 'neutral',
    decimals: 3,
    description:
      'US dollars per euro. The most heavily traded currency pair in the world.',
    source: 'Federal Reserve Board',
  },
  {
    id: 'DEXJPUS',
    label: 'Yen / USD',
    shortLabel: 'USD/JPY',
    category: 'global',
    frequency: 'daily',
    transform: 'none',
    format: 'number',
    polarity: 'neutral',
    decimals: 1,
    description:
      'Japanese yen per US dollar. Highly sensitive to interest-rate differentials between the two countries.',
    source: 'Federal Reserve Board',
  },
  {
    id: 'DEXCHUS',
    label: 'Yuan / USD',
    shortLabel: 'USD/CNY',
    category: 'global',
    frequency: 'daily',
    transform: 'none',
    format: 'number',
    polarity: 'neutral',
    decimals: 2,
    description:
      'Chinese yuan per US dollar. Managed rather than fully floating, so moves often reflect policy decisions in Beijing.',
    source: 'Federal Reserve Board',
  },
  {
    id: 'SP500',
    label: 'S&P 500',
    shortLabel: 'S&P 500',
    category: 'global',
    frequency: 'daily',
    transform: 'none',
    format: 'index',
    polarity: 'higher-is-better',
    decimals: 0,
    description:
      'Benchmark US equity index. Forward-looking by nature, since prices discount expected future earnings.',
    source: 'S&P Dow Jones Indices',
  },
  {
    id: 'WTISPLC',
    label: 'Crude Oil (WTI)',
    shortLabel: 'Oil (WTI)',
    category: 'global',
    frequency: 'monthly',
    transform: 'none',
    format: 'currency',
    polarity: 'neutral',
    decimals: 2,
    description:
      'West Texas Intermediate spot price per barrel. Feeds directly into headline inflation and acts as a tax on consumers when it spikes.',
    source: 'U.S. Energy Information Administration',
  },
  {
    id: 'GASREGW',
    label: 'Retail Gasoline Price',
    shortLabel: 'Gasoline',
    category: 'global',
    frequency: 'weekly',
    transform: 'none',
    format: 'currency',
    polarity: 'lower-is-better',
    decimals: 2,
    description:
      'Average US pump price per gallon. The most visible price in the economy and a strong driver of consumer sentiment.',
    source: 'U.S. Energy Information Administration',
  },
];

/** Series used to derive recession shading; not charted on its own. */
export const RECESSION_SERIES = 'USREC';

export const CATEGORY_META: Record<
  Category,
  { label: string; blurb: string; order: number }
> = {
  growth: {
    label: 'Growth & Output',
    blurb:
      'How fast the economy is expanding, and whether production and business investment are keeping pace.',
    order: 1,
  },
  inflation: {
    label: 'Inflation & Prices',
    blurb:
      'The pace of price increases across consumers, producers and market expectations.',
    order: 2,
  },
  labor: {
    label: 'Labour Market',
    blurb:
      'Employment, wages and slack — the clearest read on whether growth is reaching households.',
    order: 3,
  },
  rates: {
    label: 'Rates & Monetary Policy',
    blurb:
      'The policy stance, the shape of the yield curve, and the cost of money across maturities.',
    order: 4,
  },
  consumer: {
    label: 'Consumer',
    blurb:
      'Household confidence, income and spending — roughly seventy percent of US economic activity.',
    order: 5,
  },
  housing: {
    label: 'Housing',
    blurb:
      'The most interest-rate-sensitive sector, and historically an early mover in the business cycle.',
    order: 6,
  },
  credit: {
    label: 'Credit & Financial Conditions',
    blurb:
      'Financial stress, credit availability and market-based measures of risk appetite.',
    order: 7,
  },
  global: {
    label: 'Dollar, Markets & Commodities',
    blurb:
      'The external value of the dollar, equity markets and the commodity prices that feed into inflation.',
    order: 8,
  },
};

export const CATEGORIES = (Object.keys(CATEGORY_META) as Category[]).sort(
  (a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order,
);

export const INDICATOR_BY_ID = new Map(INDICATORS.map((i) => [i.id, i]));

export function indicatorsByCategory(category: Category): Indicator[] {
  return INDICATORS.filter((i) => i.category === category);
}

export const HEADLINE_INDICATORS = INDICATORS.filter((i) => i.headline);
