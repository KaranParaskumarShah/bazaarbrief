// Every calculator: { slug, category, title, description, fields, compute }
// compute(values) -> [{ label, value, suffix }]
// fields: { id, label, type: 'number', default, suffix }

const n = (v, fallback = 0) => {
  const parsed = parseFloat(v);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const CALCULATORS = [
  // ── Stock tools ──────────────────────────────────────────────────────
  {
    slug: "cagr-calculator",
    category: "Stock Tools",
    title: "CAGR Calculator",
    description: "Work out the compound annual growth rate of an investment between two dates.",
    fields: [
      { id: "initial", label: "Initial value (₹)", default: 100000 },
      { id: "final", label: "Final value (₹)", default: 250000 },
      { id: "years", label: "Duration (years)", default: 5 },
    ],
    compute: (v) => {
      const cagr = (Math.pow(n(v.final) / n(v.initial, 1), 1 / n(v.years, 1)) - 1) * 100;
      return [{ label: "CAGR", value: cagr.toFixed(2), suffix: "% per year" }];
    },
  },
  {
    slug: "sip-calculator",
    category: "Stock Tools",
    title: "SIP Calculator",
    description: "Project the future value of a monthly SIP at an assumed annual return.",
    fields: [
      { id: "monthly", label: "Monthly investment (₹)", default: 5000 },
      { id: "returnPct", label: "Expected annual return (%)", default: 12 },
      { id: "years", label: "Duration (years)", default: 10 },
    ],
    compute: (v) => {
      const i = n(v.returnPct) / 100 / 12;
      const months = n(v.years) * 12;
      const monthly = n(v.monthly);
      const fv = i === 0 ? monthly * months : monthly * ((Math.pow(1 + i, months) - 1) / i) * (1 + i);
      const invested = monthly * months;
      return [
        { label: "Total invested", value: `₹${invested.toLocaleString("en-IN")}` },
        { label: "Estimated value", value: `₹${fv.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` },
        { label: "Wealth gained", value: `₹${(fv - invested).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` },
      ];
    },
  },
  {
    slug: "stock-average-calculator",
    category: "Stock Tools",
    title: "Stock Average Calculator",
    description: "Find your average buy price across up to three purchase lots.",
    fields: [
      { id: "qty1", label: "Lot 1 — quantity", default: 10 },
      { id: "price1", label: "Lot 1 — price (₹)", default: 100 },
      { id: "qty2", label: "Lot 2 — quantity", default: 10 },
      { id: "price2", label: "Lot 2 — price (₹)", default: 90 },
      { id: "qty3", label: "Lot 3 — quantity (optional)", default: 0 },
      { id: "price3", label: "Lot 3 — price (₹, optional)", default: 0 },
    ],
    compute: (v) => {
      const lots = [[v.qty1, v.price1], [v.qty2, v.price2], [v.qty3, v.price3]];
      let totalQty = 0, totalCost = 0;
      lots.forEach(([q, p]) => { totalQty += n(q); totalCost += n(q) * n(p); });
      const avg = totalQty ? totalCost / totalQty : 0;
      return [
        { label: "Total quantity", value: totalQty.toLocaleString("en-IN"), suffix: "shares" },
        { label: "Total invested", value: `₹${totalCost.toLocaleString("en-IN")}` },
        { label: "Average price", value: `₹${avg.toFixed(2)}` },
      ];
    },
  },
  {
    slug: "dividend-calculator",
    category: "Stock Tools",
    title: "Dividend Yield Calculator",
    description: "Calculate dividend yield and total dividend income from your holding.",
    fields: [
      { id: "dividendPerShare", label: "Annual dividend per share (₹)", default: 8 },
      { id: "price", label: "Current share price (₹)", default: 400 },
      { id: "shares", label: "Shares held", default: 100 },
    ],
    compute: (v) => {
      const yieldPct = (n(v.dividendPerShare) / n(v.price, 1)) * 100;
      const income = n(v.dividendPerShare) * n(v.shares);
      return [
        { label: "Dividend yield", value: yieldPct.toFixed(2), suffix: "%" },
        { label: "Annual dividend income", value: `₹${income.toLocaleString("en-IN")}` },
      ];
    },
  },
  {
    slug: "pe-calculator",
    category: "Stock Tools",
    title: "P/E Ratio Calculator",
    description: "Work out the price-to-earnings ratio from market price and EPS.",
    fields: [
      { id: "price", label: "Market price per share (₹)", default: 500 },
      { id: "eps", label: "Earnings per share (₹)", default: 25 },
    ],
    compute: (v) => [{ label: "P/E ratio", value: (n(v.price) / n(v.eps, 1)).toFixed(2), suffix: "×" }],
  },
  {
    slug: "eps-calculator",
    category: "Stock Tools",
    title: "EPS Calculator",
    description: "Calculate earnings per share from net profit and share count.",
    fields: [
      { id: "netProfit", label: "Net profit (₹)", default: 5000000 },
      { id: "preferredDividends", label: "Preferred dividends (₹)", default: 0 },
      { id: "shares", label: "Weighted avg. shares outstanding", default: 1000000 },
    ],
    compute: (v) => {
      const eps = (n(v.netProfit) - n(v.preferredDividends)) / n(v.shares, 1);
      return [{ label: "EPS", value: `₹${eps.toFixed(2)}`, suffix: "per share" }];
    },
  },
  {
    slug: "roe-calculator",
    category: "Stock Tools",
    title: "ROE Calculator",
    description: "Return on equity — how efficiently a company uses shareholder capital.",
    fields: [
      { id: "netIncome", label: "Net income (₹)", default: 5000000 },
      { id: "equity", label: "Shareholders' equity (₹)", default: 25000000 },
    ],
    compute: (v) => [{ label: "ROE", value: ((n(v.netIncome) / n(v.equity, 1)) * 100).toFixed(2), suffix: "%" }],
  },
  {
    slug: "roce-calculator",
    category: "Stock Tools",
    title: "ROCE Calculator",
    description: "Return on capital employed — profitability relative to total capital used.",
    fields: [
      { id: "ebit", label: "EBIT (₹)", default: 6000000 },
      { id: "capitalEmployed", label: "Capital employed (₹)", default: 30000000 },
    ],
    compute: (v) => [{ label: "ROCE", value: ((n(v.ebit) / n(v.capitalEmployed, 1)) * 100).toFixed(2), suffix: "%" }],
  },
  {
    slug: "market-cap-calculator",
    category: "Stock Tools",
    title: "Market Cap Calculator",
    description: "Calculate market capitalisation from share price and shares outstanding.",
    fields: [
      { id: "price", label: "Share price (₹)", default: 500 },
      { id: "shares", label: "Total shares outstanding", default: 10000000 },
    ],
    compute: (v) => {
      const cap = n(v.price) * n(v.shares);
      return [{ label: "Market cap", value: `₹${(cap / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`, suffix: "Cr" }];
    },
  },
  {
    slug: "profit-growth-calculator",
    category: "Stock Tools",
    title: "Profit Growth Calculator",
    description: "Year-on-year profit growth percentage.",
    fields: [
      { id: "previous", label: "Previous period profit (₹)", default: 4000000 },
      { id: "current", label: "Current period profit (₹)", default: 5000000 },
    ],
    compute: (v) => {
      const growth = ((n(v.current) - n(v.previous)) / Math.abs(n(v.previous, 1))) * 100;
      return [{ label: "Profit growth", value: growth.toFixed(2), suffix: "%" }];
    },
  },

  // ── IPO tools ────────────────────────────────────────────────────────
  {
    slug: "ipo-investment-calculator",
    category: "IPO Tools",
    title: "IPO Investment Calculator",
    description: "How much you need to invest for a given number of lots.",
    fields: [
      { id: "lotSize", label: "Lot size (shares)", default: 40 },
      { id: "price", label: "Price per share (₹, upper band)", default: 250 },
      { id: "lots", label: "Number of lots", default: 1 },
    ],
    compute: (v) => [{ label: "Total investment", value: `₹${(n(v.lotSize) * n(v.price) * n(v.lots)).toLocaleString("en-IN")}` }],
  },
  {
    slug: "ipo-lot-calculator",
    category: "IPO Tools",
    title: "IPO Lot Calculator",
    description: "How many lots your budget can afford.",
    fields: [
      { id: "budget", label: "Your budget (₹)", default: 200000 },
      { id: "lotSize", label: "Lot size (shares)", default: 40 },
      { id: "price", label: "Price per share (₹, upper band)", default: 250 },
    ],
    compute: (v) => {
      const perLot = n(v.lotSize) * n(v.price, 1);
      const maxLots = perLot ? Math.floor(n(v.budget) / perLot) : 0;
      return [
        { label: "Cost per lot", value: `₹${perLot.toLocaleString("en-IN")}` },
        { label: "Max lots affordable", value: maxLots, suffix: "lots" },
        { label: "Amount actually needed", value: `₹${(maxLots * perLot).toLocaleString("en-IN")}` },
      ];
    },
  },
  {
    slug: "ipo-profit-calculator",
    category: "IPO Tools",
    title: "IPO Profit Calculator",
    description: "Estimate listing-day profit from issue price and expected listing price.",
    fields: [
      { id: "issuePrice", label: "Issue price (₹)", default: 250 },
      { id: "listingPrice", label: "Expected listing price (₹)", default: 300 },
      { id: "lotSize", label: "Lot size (shares)", default: 40 },
      { id: "lots", label: "Number of lots", default: 1 },
    ],
    compute: (v) => {
      const shares = n(v.lotSize) * n(v.lots);
      const profit = (n(v.listingPrice) - n(v.issuePrice)) * shares;
      const pct = ((n(v.listingPrice) - n(v.issuePrice)) / n(v.issuePrice, 1)) * 100;
      return [
        { label: "Estimated profit", value: `₹${profit.toLocaleString("en-IN")}` },
        { label: "Gain", value: pct.toFixed(1), suffix: "%" },
      ];
    },
  },
  {
    slug: "ipo-subscription-calculator",
    category: "IPO Tools",
    title: "IPO Subscription Calculator",
    description: "How many times an IPO category has been subscribed.",
    fields: [
      { id: "offered", label: "Shares offered in category", default: 1000000 },
      { id: "applied", label: "Shares applied for", default: 4500000 },
    ],
    compute: (v) => [{ label: "Subscribed", value: (n(v.applied) / n(v.offered, 1)).toFixed(2), suffix: "× " }],
  },
  {
    slug: "ipo-gmp-calculator",
    category: "IPO Tools",
    title: "IPO GMP Calculator",
    description: "Turn a grey-market premium figure into an estimated listing price.",
    fields: [
      { id: "issuePrice", label: "Issue price (₹)", default: 250 },
      { id: "gmp", label: "GMP (₹, unofficial)", default: 35 },
    ],
    compute: (v) => {
      const est = n(v.issuePrice) + n(v.gmp);
      const pct = (n(v.gmp) / n(v.issuePrice, 1)) * 100;
      return [
        { label: "Estimated listing price", value: `₹${est.toFixed(2)}` },
        { label: "Estimated premium", value: pct.toFixed(1), suffix: "%" },
      ];
    },
  },
  {
    slug: "ipo-allotment-probability",
    category: "IPO Tools",
    title: "IPO Allotment Probability Estimator",
    description: "A rough estimate of retail allotment odds — not a prediction. SEBI's actual lottery process, category-wise reservations and lot-based allocation can differ from this simple ratio.",
    fields: [
      { id: "lotsAvailable", label: "Retail lots available", default: 5000 },
      { id: "lotsApplied", label: "Total retail lots applied for", default: 40000 },
    ],
    compute: (v) => {
      const prob = Math.min(100, (n(v.lotsAvailable) / n(v.lotsApplied, 1)) * 100);
      return [{ label: "Rough allotment probability", value: prob.toFixed(1), suffix: "% (estimate only)" }];
    },
  },
];

export const getCalculatorBySlug = (slug) => CALCULATORS.find((c) => c.slug === slug);
