// Shared, dependency-free IPO normalization used by the Worker and tests.
export function asString(value: unknown): string { return value == null ? '' : String(value).trim(); }
export function firstField(row: any, fields: string[]): unknown { for (const key of fields) if (row?.[key] != null && row[key] !== '') return row[key]; return undefined; }
function parseDate(value: unknown): string {
  const raw = asString(value);
  if (!raw) return '';
  // Preserve date-only values in the source timezone; parse common NSE date formats.
  const dmy = raw.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,}|\d{1,2})[-/ ](\d{4})$/);
  if (dmy) {
    const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const month = /^\d+$/.test(dmy[2]) ? Number(dmy[2]) - 1 : monthNames.indexOf(dmy[2].slice(0,3).toLowerCase());
    const day = Number(dmy[1]);
    if (month >= 0 && month < 12 && day >= 1 && day <= 31) return `${dmy[3]}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0,10) : '';
}
function lifecycleStatus(row: any, requested: 'Open' | 'Upcoming' | 'Closed' | 'Listed'): string {
  const explicit = asString(firstField(row, ['status','issueStatus','ipoStatus','listingStatus'])).toLowerCase();
  if (/withdraw|cancel/.test(explicit)) return /withdraw/.test(explicit) ? 'Withdrawn' : 'Cancelled';
  if (/listed|listing completed|traded/.test(explicit)) return 'Listed';
  if (/^(open|upcoming|closed)$/.test(explicit)) return explicit[0].toUpperCase() + explicit.slice(1);
  if (parseDate(firstField(row, ['listingDate','listing_date','actualListingDate'])) && requested === 'Listed') return 'Listed';
  const open = parseDate(firstField(row, ['issueStartDate','openDate','startDate','issueOpenDate']));
  const close = parseDate(firstField(row, ['issueEndDate','closeDate','endDate','issueCloseDate']));
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  if (open && close) {
    if (today < open) return 'Upcoming';
    if (today <= close) return 'Open';
    // Do not infer listed merely because the subscription closed.
    return requested === 'Listed' ? 'Closed' : 'Closed';
  }
  return requested;
}
export function normalizeNseIpos(raw: any, requested: 'Open' | 'Upcoming' | 'Closed' | 'Listed'): any[] {
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.ipos) ? raw.ipos : [];
  return rows.map((row: any) => {
    const name = asString(firstField(row, ['companyName','company','name','symbol','issuerName','issuer']));
    if (!name) return null;
    const symbol = asString(firstField(row, ['symbol','companySymbol','ticker','securitySymbol','slug'])) || name;
    const openDate = parseDate(firstField(row, ['issueStartDate','openDate','startDate','issueOpenDate']));
    const closeDate = parseDate(firstField(row, ['issueEndDate','closeDate','endDate','issueCloseDate']));
    const priceRaw = firstField(row, ['priceRange','priceBand','issuePrice','price','priceRangeText']);
    const minPrice = Number(firstField(row, ['minPrice','floorPrice','lowerPrice','priceMin']));
    const maxPrice = Number(firstField(row, ['maxPrice','capPrice','upperPrice','priceMax']));
    const price = asString(priceRaw) || (Number.isFinite(minPrice) && Number.isFinite(maxPrice) && minPrice > 0 && maxPrice > 0 ? `₹${minPrice}–₹${maxPrice}` : '');
    const lotRaw = firstField(row, ['lotSize','marketLot','minimumBidQuantity','bidLot']);
    const lotSize = Number(String(lotRaw ?? '').replace(/[^0-9.]/g, ''));
    const issueSizeCr = firstField(row, ['issueSizeCr']);
    const sizeRaw = asString(firstField(row, ['issueSize','issue_size','totalIssueSize','issueAmount','issueSizeAmount','issueSizeCr']));
    const size = issueSizeCr != null && sizeRaw ? `₹${sizeRaw} Cr` : sizeRaw;
    const marketText = `${asString(firstField(row, ['series','market','board','platform']))} ${asString(firstField(row, ['category','issueType','issueCategory']))}`.toLowerCase();
    const market = /sme|emerge|small/.test(marketText) ? 'SME' : 'Mainboard';
    const idSource = asString(firstField(row, ['ipoId','issueId','issueCode','symbol','companySymbol','slug'])) || name;
    const id = idSource.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const listingDate = parseDate(firstField(row, ['listingDate','listing_date','tentativeListingDate'])) || undefined;
    const gmpRaw = firstField(row, ['gmp','GMP','greyMarketPremium','grey_market_premium','premium','lastGmp']);
    const gmpNum = gmpRaw == null || String(gmpRaw).trim() === '' ? undefined : Number(String(gmpRaw).replace(/[₹,\s]/g, '').replace(/(INR|Rs\.?)/ig, ''));
    const subscriptionRaw = firstField(row, ['subscription','subscriptionTimes','totalSubscription','lastSubX']);
    const subscriptionNum = subscriptionRaw == null || String(subscriptionRaw).trim() === '' ? undefined : Number(String(subscriptionRaw).replace(/x$/i,'').replace(/,/g,''));
    const status = lifecycleStatus(row, requested);
    const suppliedGmpPct = firstField(row, ['gmpPct','lastGmpPct']);
    const gmpPct = suppliedGmpPct != null && String(suppliedGmpPct).trim() !== '' && Number.isFinite(Number(suppliedGmpPct)) ? Number(suppliedGmpPct) : (gmpNum !== undefined && Number.isFinite(gmpNum) && Number.isFinite(maxPrice) && maxPrice > 0 ? gmpNum / maxPrice * 100 : undefined);
    const lot = Number.isFinite(lotSize) && lotSize > 0 ? lotSize : 0;
    return { id, name, symbol, market, status, openDate, closeDate, priceBand: price, lotSize: lot, issueSize: size, ...(lot && Number.isFinite(minPrice) && minPrice > 0 ? { minInvestment: lot * minPrice } : {}), listingDate, ...(Number.isFinite(gmpNum) ? { gmp: gmpNum } : {}), ...(Number.isFinite(gmpPct) ? { gmpPct } : {}), ...(Number.isFinite(subscriptionNum) ? { subscription: subscriptionNum } : {}), gmpDisputed: Boolean(firstField(row, ['gmpDisputed']) ?? false), gmpSources: Number.isFinite(Number(firstField(row, ['gmpSources']))) ? Number(firstField(row, ['gmpSources'])) : undefined, gmpSpread: Number.isFinite(Number(firstField(row, ['gmpSpread']))) ? Number(firstField(row, ['gmpSpread'])) : undefined, gmpSource: gmpRaw == null ? undefined : asString(firstField(row, ['gmpSource','sourceName','providerName'])) || ((asString(firstField(row, ['providerName'])) || 'Xflot') + ' (aggregated, unofficial GMP)'), gmpSourceUrl: asString(firstField(row, ['gmpSourceUrl','sourceUrl'])) || (gmpRaw == null ? undefined : 'https://www.xflot.com/api-docs'), gmpObservedAt: asString(firstField(row, ['gmpObservedAt','gmpUpdatedAt','updatedAt'])) || undefined, exchange: asString(firstField(row, ['exchange','exchangeName'])) || undefined, registrar: asString(firstField(row, ['registrar','registrarName'])) || undefined, registrarUrl: asString(firstField(row, ['registrarUrl','registrarLink'])) || undefined, offerDocumentUrl: asString(firstField(row, ['rhpUrl','drhpUrl','offerDocumentUrl','documentUrl'])) || undefined, officialUrl: asString(firstField(row, ['officialUrl','issueUrl','exchangeUrl'])) || undefined, providerDisclaimer: asString(firstField(row, ['providerDisclaimer','disclaimer'])) || undefined, description: asString(firstField(row, ['description','companyOverview','about'])) || undefined, updatedAt: new Date().toISOString() };
  }).filter(Boolean);
}
export function validIpos(rows: any[]): boolean {
  // A partial historical record is still useful. Validate identity and classification,
  // but do not reject it merely because an exchange/provider omits dates, price or size.
  return Array.isArray(rows) && rows.length > 0 && rows.every(x =>
    x && typeof x.id === 'string' && x.id.trim().length > 0 &&
    typeof x.name === 'string' && x.name.trim().length > 0 &&
    typeof x.symbol === 'string' && x.symbol.trim().length > 0 &&
    ['Mainboard', 'SME'].includes(x.market) &&
    ['Open', 'Upcoming', 'Closed', 'Listed', 'Cancelled', 'Withdrawn'].includes(x.status) &&
    (x.openDate == null || typeof x.openDate === 'string') &&
    (x.closeDate == null || typeof x.closeDate === 'string') &&
    (x.priceBand == null || typeof x.priceBand === 'string') &&
    (x.lotSize == null || Number.isFinite(x.lotSize)) &&
    (x.issueSize == null || typeof x.issueSize === 'string') &&
    (x.gmp == null || Number.isFinite(x.gmp)) &&
    (x.subscription == null || Number.isFinite(x.subscription))
  );
}
