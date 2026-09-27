// Current seed snapshot used only until a newer live response is available.
// Snapshot date: 25 Sep 2026 (latest completed Indian trading session before
// the Sunday 27 Sep 2026 build). Values are explicitly dated in the UI.
export const initialMarketData = {
  ok: true,
  updatedAt: '2026-09-25T16:10:00+05:30',
  dataStatus: 'seed',
  snapshotLabel: 'Latest available market close',
  market: {
    fx: { symbol: 'USD/INR', price: 95.81, currency: 'INR', asOf: '2026-09-25T16:10:00+05:30', provider: 'Moneycontrol market close' },
    quotes: {
      configured: true,
      provider: 'Seeded market-close snapshot',
      rows: [
        { symbol: 'NIFTY:NSE', name: 'NIFTY 50', price: 23140.50, change: 77.40, changePercent: 0.34, currency: 'INR', asOf: '2026-09-25T16:10:00+05:30' },
        { symbol: 'SENSEX:BSE', name: 'SENSEX', price: 73895.74, change: 315.20, changePercent: 0.43, currency: 'INR', asOf: '2026-09-25T16:10:00+05:30' },
        { symbol: 'NIFTY BANK:NSE', name: 'NIFTY BANK', price: 56606.55, change: 134.60, changePercent: 0.24, currency: 'INR', asOf: '2026-09-25T16:10:00+05:30' },
        { symbol: 'IXIC', name: 'NASDAQ', price: 27068.72, change: 129.35, changePercent: 0.48, currency: 'USD', asOf: '2026-09-25T16:00:00-04:00' },
        { symbol: 'SPX', name: 'S&P 500', price: 7743.41, change: 39.28, changePercent: 0.51, currency: 'USD', asOf: '2026-09-25T16:00:00-04:00' },
        { symbol: 'DJI', name: 'Dow Jones', price: 51828.62, change: 478.64, changePercent: 0.93, currency: 'USD', asOf: '2026-09-25T16:00:00-04:00' },
        { symbol: 'RELIANCE:NSE', name: 'Reliance Industries', price: 1226.00, change: 6.80, changePercent: 0.56, currency: 'INR', asOf: '2026-09-25T16:10:00+05:30' },
        { symbol: 'HDFCBANK:NSE', name: 'HDFC Bank', price: 735.60, change: 6.71, changePercent: 0.92, currency: 'INR', asOf: '2026-09-25T16:10:00+05:30' },
        { symbol: 'ICICIBANK:NSE', name: 'ICICI Bank', price: 1327.00, change: -7.71, changePercent: -0.58, currency: 'INR', asOf: '2026-09-25T16:10:00+05:30' },
        { symbol: 'INFY:NSE', name: 'Infosys', price: 1000.00, change: -14.30, changePercent: -1.41, currency: 'INR', asOf: '2026-09-25T16:10:00+05:30' },
        { symbol: 'TCS:NSE', name: 'TCS', price: null, changePercent: null, currency: 'INR', asOf: '2026-09-25T16:10:00+05:30' },
      ],
    },
    gold: { symbol: 'Gold', price: 4319, currency: 'USD', asOf: '2026-09-26T00:00:00Z', provider: 'Market report snapshot' },
    silver: { symbol: 'Silver', price: null, currency: 'USD', asOf: '2026-09-25T16:10:00+05:30', provider: 'No verified seed quote' },
    brent: { symbol: 'Brent Crude', price: 105.00, currency: 'USD', asOf: '2026-09-25T08:00:00+05:30', provider: 'Market report snapshot' },
    wti: { symbol: 'WTI Crude', price: null, currency: 'USD', asOf: null, provider: 'No verified seed quote' },
    copper: { symbol: 'Copper', price: null, currency: 'USD', asOf: null, provider: 'No verified seed quote' },
  },
  fiiDii: {
    configured: true,
    provider: 'NSE provisional cash-market snapshot via published market data',
    unit: '₹ Cr',
    lastUpdated: '2026-09-25',
    rows: [
      { date: '2026-09-25', fiiNet: -3693.93, diiNet: 2838.17 },
      { date: '2026-09-24', fiiNet: -5027.36, diiNet: 4301.18 },
      { date: '2026-09-23', fiiNet: 1617.45, diiNet: 2341.46 },
      { date: '2026-09-22', fiiNet: -3809.99, diiNet: 4120.07 },
      { date: '2026-09-21', fiiNet: -576.20, diiNet: 2797.27 },
      { date: '2026-09-18', fiiNet: 599.54, diiNet: 1019.69 },
      { date: '2026-09-17', fiiNet: -3208.76, diiNet: 3617.75 },
    ],
  },
  ipo: {
    configured: true,
    provider: 'Published Indian IPO snapshot',
    rows: [
      { company: 'Moneyview Limited', name: 'Moneyview Limited', type: 'Mainboard', exchange: 'NSE, BSE', open_date: '2026-09-24', close_date: '2026-09-28', price_band: '₹32–₹34', priceRange: '₹32–₹34', lot_size: 441, min_investment: '₹14,994', issue_size: '₹1,091.68 Cr', fresh_issue: '₹750 Cr', ofs: '₹341.68 Cr', gmp: { value: '₹14', percent: '41.2%', updated_at: '2026-09-25 16:13 IST' }, allotment_date: '2026-09-29', listing_date: '2026-10-01', registrar: 'MUFG Intime India Pvt. Ltd.' },
      { company: 'Runwal Enterprises', name: 'Runwal Enterprises', type: 'Mainboard', exchange: 'NSE, BSE', open_date: '2026-09-25', close_date: '2026-09-29', price_band: '₹290–₹305', priceRange: '₹290–₹305', lot_size: 49, min_investment: '₹14,945', issue_size: '₹500 Cr', fresh_issue: '₹500 Cr', ofs: 'Nil', gmp: { value: '₹15', percent: '4.75%', updated_at: '2026-09-27' }, allotment_date: '2026-09-30', listing_date: '2026-10-05', registrar: 'MUFG Intime India Pvt. Ltd.', revenue: '₹1,850.79 Cr', profit: '₹185.76 Cr' },
      { company: 'Orient Cables (India)', name: 'Orient Cables (India)', type: 'Mainboard', exchange: 'NSE, BSE', open_date: '2026-09-25', close_date: '2026-09-29', price_band: '₹258–₹272', lot_size: 55, issue_size: '₹552 Cr', gmp: { value: '₹90', percent: '33.09%', updated_at: '2026-09-27' } },
      { company: 'A-One Steels India', name: 'A-One Steels India', type: 'Mainboard', exchange: 'NSE, BSE', open_date: '2026-09-24', close_date: '2026-09-28', price_band: '₹385–₹405', lot_size: 37, issue_size: '₹405 Cr', gmp: { value: '₹56', percent: '13.83%', updated_at: '2026-09-27' } },
      { company: 'Green Asia Impex', name: 'Green Asia Impex', type: 'SME', exchange: 'NSE SME', open_date: '2026-09-24', close_date: '2026-09-28', price_band: '₹85–₹90', lot_size: 1600, issue_size: '₹60 Cr', gmp: { value: '₹0', percent: '0%', updated_at: '2026-09-27' } },
      { company: 'Peshwa Wheat', name: 'Peshwa Wheat', type: 'SME', exchange: 'NSE SME', open_date: '2026-09-24', close_date: '2026-09-28', price_band: '₹95–₹101', lot_size: 1200, issue_size: '₹54 Cr', gmp: { value: '₹0', percent: '0%', updated_at: '2026-09-27' } },
    ],
  },
  news: {
    configured: true,
    provider: 'Seeded recent market headlines; replaced by live news feed when available',
    rows: [
      { title: 'Indian equities rebound as Nifty ends at 23,140.50 and Sensex at 73,895.74', site: 'Business Standard', publishedDate: 'Sep 25, 2026', url: 'https://www.business-standard.com/markets/news/stock-market-live-updates-september-25-sensex-today-nifty50-gift-nifty-crude-oil-prices-nse-share-price-126092500092_1.html' },
      { title: 'Sensex gains 315 points; Nifty closes above 23,100', site: 'India Today', publishedDate: 'Sep 25, 2026', url: 'https://www.indiatoday.in/business/market/story/market-closing-sensex-ends-315-points-higher-nifty-above-23100-axis-bank-up-3-3002758-2026-09-25' },
      { title: 'Runwal Enterprises IPO opens with ₹290–₹305 price band', site: 'Economic Times', publishedDate: 'Sep 25, 2026', url: 'https://m.economictimes.com/markets/ipos/fpos/runwal-enterprises-ipo-opens-today-check-gmp-and-key-details-should-you-subscribe/amp_articleshow/134473268.cms' },
      { title: 'Moneyview IPO: ₹1,091.68 crore issue, dates and key details', site: 'IPO Platform', publishedDate: 'Sep 26, 2026', url: 'https://www.ipoplatform.com/ipo/moneyview-ipo/4604' },
      { title: 'FII/DII cash activity for 25 September 2026', site: 'Moneycontrol', publishedDate: 'Sep 25, 2026', url: 'https://www.moneycontrol.com/mc/?classic=true' },
    ],
  },
  sourceNotes: {
    market: 'Seed snapshot compiled from published 25 Sep 2026 market closes; live provider replaces it when configured.',
    fx: 'Published 25 Sep 2026 USD/INR close.',
    ipo: 'Published IPO calendar/details available at build time.',
    news: 'Recent published headlines available at build time.',
    fiiDii: 'Published 25 Sep 2026 provisional cash-market figures.',
  },
};
