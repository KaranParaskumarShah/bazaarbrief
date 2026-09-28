// ─────────────────────────────────────────────────────────────────────────
// SAMPLE IPO DATA
// ─────────────────────────────────────────────────────────────────────────
// These are placeholder companies with placeholder numbers, wired up so
// every IPO page, filter and calculator works end to end. There is no free
// public API for Indian IPO data (price band, GMP, subscription figures,
// allotment) — this is normally sourced from the RHP/DRHP filed with SEBI,
// exchange circulars (NSE/BSE), and registrar data, then kept current by
// hand or with a paid data vendor.
//
// Before publishing: replace every entry below with verified figures from
// the company's RHP and the NSE/BSE IPO circulars. Do not publish GMP or
// financial figures you haven't sourced yourself — GMP in particular moves
// daily and is always unofficial, grey-market chatter, never exchange data.
// ─────────────────────────────────────────────────────────────────────────

export const IPOS = [
  {
    slug: "orbit-data-systems-ipo",
    companyName: "Orbit Data Systems Ltd",
    sector: "Data Center Infrastructure",
    exchange: "NSE, BSE",
    status: "open", // upcoming | open | closed | listed
    priceBand: { min: 412, max: 434 },
    lotSize: 34,
    issueSize: 1850, // Rs Cr
    freshIssue: 1200, // Rs Cr
    ofs: 650, // Rs Cr
    openDate: "2026-09-24",
    closeDate: "2026-09-29",
    allotmentDate: "2026-09-30",
    refundDate: "2026-10-01",
    demalDate: "2026-10-01",
    listingDate: "2026-10-03",
    gmp: { value: 58, asOf: "2026-09-27", note: "Unofficial, market-reported — not an exchange figure" },
    financials: [
      { year: "FY24", revenueCr: 612, profitCr: 74, debtCr: 340 },
      { year: "FY25", revenueCr: 891, profitCr: 118, debtCr: 410 },
      { year: "FY26 (H1)", revenueCr: 540, profitCr: 81, debtCr: 455 },
    ],
    promoters: [
      { name: "R. Kulkarni", holdingPct: 28.4 },
      { name: "Orbit Family Trust", holdingPct: 19.1 },
    ],
    objectsOfIssue: [
      "Repayment / prepayment of certain borrowings",
      "Funding capex for two new data center campuses",
      "General corporate purposes",
    ],
    subscription: {
      asOf: "2026-09-27 (Day 3, 5:00 PM)",
      qibTimes: 12.4,
      niiTimes: 6.8,
      retailTimes: 3.2,
      totalTimes: 8.1,
    },
    registrar: { name: "Kfin Technologies", allotmentUrl: "https://kfintech.com/ipostatus/" },
    documents: [
      { label: "Red Herring Prospectus (RHP)", url: "#" },
      { label: "NSE IPO circular", url: "#" },
    ],
    news: [
      {
        date: "2026-09-27",
        title: "Orbit Data Systems IPO subscribed 8.1x on Day 3",
        summary: "Institutional demand led the book; retail portion crossed 3x by the final hour.",
      },
      {
        date: "2026-09-24",
        title: "Orbit Data Systems IPO opens for subscription",
        summary: "Price band fixed at ₹412–434, issue to raise up to ₹1,850 crore.",
      },
    ],
  },
  {
    slug: "meridian-defence-systems-ipo",
    companyName: "Meridian Defence Systems Ltd",
    sector: "Defence Manufacturing",
    exchange: "NSE, BSE",
    status: "upcoming",
    priceBand: { min: 268, max: 282 },
    lotSize: 53,
    issueSize: 960,
    freshIssue: 960,
    ofs: 0,
    openDate: "2026-10-06",
    closeDate: "2026-10-09",
    allotmentDate: "2026-10-10",
    refundDate: "2026-10-13",
    demalDate: "2026-10-13",
    listingDate: "2026-10-14",
    gmp: { value: 34, asOf: "2026-09-27", note: "Unofficial, market-reported — not an exchange figure" },
    financials: [
      { year: "FY24", revenueCr: 310, profitCr: 41, debtCr: 95 },
      { year: "FY25", revenueCr: 428, profitCr: 63, debtCr: 110 },
      { year: "FY26 (H1)", revenueCr: 260, profitCr: 39, debtCr: 118 },
    ],
    promoters: [{ name: "Meridian Holdings Pvt Ltd", holdingPct: 61.2 }],
    objectsOfIssue: [
      "Setting up a new ammunition assembly line",
      "Working capital requirements",
      "General corporate purposes",
    ],
    subscription: { asOf: "Not yet open", qibTimes: null, niiTimes: null, retailTimes: null, totalTimes: null },
    registrar: { name: "Link Intime India", allotmentUrl: "https://linkintime.co.in/mipo/ipoallotment.html" },
    documents: [
      { label: "Draft Red Herring Prospectus (DRHP)", url: "#" },
      { label: "NSE IPO circular", url: "#" },
    ],
    news: [
      {
        date: "2026-09-20",
        title: "Meridian Defence Systems sets price band at ₹268–282",
        summary: "IPO to open October 6, aiming to raise ₹960 crore via fresh issue.",
      },
    ],
  },
  {
    slug: "northline-fintech-ipo",
    companyName: "Northline Fintech Ltd",
    sector: "AI & Robotics-led Fintech",
    exchange: "NSE, BSE",
    status: "listed",
    priceBand: { min: 145, max: 152 },
    lotSize: 98,
    issueSize: 640,
    freshIssue: 400,
    ofs: 240,
    openDate: "2026-09-08",
    closeDate: "2026-09-10",
    allotmentDate: "2026-09-11",
    refundDate: "2026-09-12",
    demalDate: "2026-09-12",
    listingDate: "2026-09-15",
    listingPrice: 178,
    gmp: { value: 26, asOf: "2026-09-14", note: "Unofficial, market-reported — not an exchange figure" },
    financials: [
      { year: "FY24", revenueCr: 210, profitCr: 18, debtCr: 40 },
      { year: "FY25", revenueCr: 305, profitCr: 34, debtCr: 52 },
    ],
    promoters: [{ name: "A. Verghese", holdingPct: 33.8 }],
    objectsOfIssue: ["Offer for sale by existing investors", "Technology platform investment", "General corporate purposes"],
    subscription: { asOf: "Final (closed)", qibTimes: 24.6, niiTimes: 15.2, retailTimes: 4.9, totalTimes: 17.3 },
    registrar: { name: "Kfin Technologies", allotmentUrl: "https://kfintech.com/ipostatus/" },
    documents: [
      { label: "Red Herring Prospectus (RHP)", url: "#" },
      { label: "Listing day circular", url: "#" },
    ],
    news: [
      {
        date: "2026-09-15",
        title: "Northline Fintech lists at 17% premium",
        summary: "Shares opened at ₹178 against the ₹152 issue price, valuing the company at ~₹4,200 crore.",
      },
    ],
  },
];

export const getIpoBySlug = (slug) => IPOS.find((i) => i.slug === slug);

export const isOpenToday = (ipo, today = new Date()) => {
  const open = new Date(ipo.openDate);
  const close = new Date(ipo.closeDate);
  return today >= open && today <= close;
};

export const isUpcoming = (ipo, today = new Date()) => new Date(ipo.openDate) > today;

export const isClosed = (ipo, today = new Date()) =>
  new Date(ipo.closeDate) < today && ipo.status !== "listed";
