// Curated India-listed stocks per theme. Symbols use the ".NS" suffix
// (NSE) expected by Twelve Data. Edit freely — add, remove, reorder.
// "note" is a one-line reason the stock belongs in that theme.

export const STOCK_CATEGORIES = [
  {
    id: "data-center",
    label: "Data Center",
    blurb: "Builders and landlords of India's compute buildout",
    stocks: [
      { symbol: "NXTDIGITAL.NS", name: "NXTDIGITAL", note: "Digital infra & network" },
      { symbol: "STLTECH.NS", name: "Sterlite Technologies", note: "Fibre & data infra" },
      { symbol: "RAILTEL.NS", name: "RailTel Corp", note: "Network backbone" },
      { symbol: "TATACOMM.NS", name: "Tata Communications", note: "Data center operator" },
      { symbol: "ADANIENT.NS", name: "Adani Enterprises", note: "Data center JV pipeline" },
      { symbol: "NTPC.NS", name: "NTPC", note: "Power supply for DC load" },
    ],
  },
  {
    id: "defence",
    label: "Defence",
    blurb: "Domestic defence manufacturing & ordnance",
    stocks: [
      { symbol: "HAL.NS", name: "Hindustan Aeronautics", note: "Aircraft & helicopters" },
      { symbol: "BEL.NS", name: "Bharat Electronics", note: "Defence electronics" },
      { symbol: "BDL.NS", name: "Bharat Dynamics", note: "Missiles & ammunition" },
      { symbol: "MAZDOCK.NS", name: "Mazagon Dock", note: "Warships & submarines" },
      { symbol: "COCHINSHIP.NS", name: "Cochin Shipyard", note: "Naval shipbuilding" },
      { symbol: "SOLARINDS.NS", name: "Solar Industries", note: "Explosives & ammunition" },
    ],
  },
  {
    id: "semiconductor",
    label: "Semiconductor",
    blurb: "India's chip design, ATMP & fab ecosystem",
    stocks: [
      { symbol: "TATAELXSI.NS", name: "Tata Elxsi", note: "Chip design services" },
      { symbol: "DIXON.NS", name: "Dixon Technologies", note: "Electronics & ATMP push" },
      { symbol: "KAYNES.NS", name: "Kaynes Technology", note: "OSAT / semiconductor unit" },
      { symbol: "CGPOWER.NS", name: "CG Power", note: "Semiconductor fab JV" },
      { symbol: "MOSCHIP.NS", name: "Moschip Technologies", note: "Fabless chip design" },
      { symbol: "SPEL.NS", name: "SPEL Semiconductor", note: "Chip packaging" },
    ],
  },
  {
    id: "water-recycle",
    label: "Water Recycling",
    blurb: "Water treatment, reuse & zero-liquid-discharge",
    stocks: [
      { symbol: "VATECH.NS", name: "VA Tech Wabag", note: "Water & wastewater treatment" },
      { symbol: "ION.NS", name: "Ion Exchange", note: "Water treatment & recycling" },
      { symbol: "THERMAX.NS", name: "Thermax", note: "Effluent treatment systems" },
      { symbol: "EIDPARRY.NS", name: "EID Parry", note: "Zero-liquid-discharge plants" },
      { symbol: "WPIL.NS", name: "WPIL", note: "Water pumping systems" },
      { symbol: "JAINIRRIGATION.NS", name: "Jain Irrigation", note: "Water resource management" },
    ],
  },
  {
    id: "mining",
    label: "Mining",
    blurb: "Metals, coal & mineral extraction",
    stocks: [
      { symbol: "NMDC.NS", name: "NMDC", note: "Iron ore mining" },
      { symbol: "COALINDIA.NS", name: "Coal India", note: "Coal mining" },
      { symbol: "VEDL.NS", name: "Vedanta", note: "Diversified metals & mining" },
      { symbol: "HINDZINC.NS", name: "Hindustan Zinc", note: "Zinc & silver mining" },
      { symbol: "NALCO.NS", name: "NALCO", note: "Bauxite & aluminium" },
      { symbol: "MOIL.NS", name: "MOIL", note: "Manganese ore mining" },
    ],
  },
  {
    id: "ai-robotics",
    label: "AI & Robotics",
    blurb: "Automation, robotics & applied-AI plays",
    stocks: [
      { symbol: "TCS.NS", name: "Tata Consultancy Services", note: "Enterprise AI services" },
      { symbol: "PERSISTENT.NS", name: "Persistent Systems", note: "AI/ML engineering" },
      { symbol: "TATAELXSI.NS", name: "Tata Elxsi", note: "Embedded & robotics design" },
      { symbol: "KPITTECH.NS", name: "KPIT Technologies", note: "Autonomous mobility software" },
      { symbol: "HAPPSTMNDS.NS", name: "Happiest Minds", note: "AI-led digital services" },
      { symbol: "SONACOMS.NS", name: "Sona BLW Precision", note: "EV & robotics-grade motors" },
    ],
  },
];
