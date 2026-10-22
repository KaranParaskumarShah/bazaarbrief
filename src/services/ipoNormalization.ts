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
    const priceText = asString(priceRaw);
    const priceNumbers = priceText.replace(/,/g, '').match(/[0-9]+(?:\.[0-9]+)?/g)?.map(Number).filter(Number.isFinite) || [];
    const explicitMaxPrice = Number(firstField(row, ['maxPrice','capPrice','upperPrice','priceMax']));
    // If the provider supplies only a display price band (e.g. ₹1,065–₹1,119),
    // use its upper bound for the clearly-labelled GMP/cap percentage calculation.
    const maxPrice = Number.isFinite(explicitMaxPrice) && explicitMaxPrice > 0 ? explicitMaxPrice : (priceNumbers.length >= 2 ? priceNumbers[priceNumbers.length - 1] : NaN);
    const price = priceText || (Number.isFinite(minPrice) && Number.isFinite(maxPrice) && minPrice > 0 && maxPrice > 0 ? `₹${minPrice}–₹${maxPrice}` : '');
    const lotRaw = firstField(row, ['lotSize','marketLot','minimumBidQuantity','bidLot']);
    const lotSize = Number(String(lotRaw ?? '').replace(/[^0-9.]/g, ''));
    const issueSizeCr = firstField(row, ['issueSizeCr']);
    const sizeRaw = asString(firstField(row, ['issueSize','issue_size','totalIssueSize','issueAmount','issueSizeAmount','issueSizeCr']));
    const issueSizeCrText = asString(issueSizeCr).replace(/^[₹\s]+|\s*Cr$/gi, '').trim();
    const issueSizeCrNumber = Number(issueSizeCrText.replace(/,/g, ''));
    const size = issueSizeCr != null && issueSizeCrText !== ''
      ? Number.isFinite(issueSizeCrNumber)
        ? `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(issueSizeCrNumber)} Cr`
        : `₹${issueSizeCrText} Cr`
      : sizeRaw;
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
    return { id, name, symbol, detailSlug: asString(firstField(row, ['slug','ipoSlug','issueSlug','detailSlug'])) || undefined, market, status, openDate, closeDate, priceBand: price, lotSize: lot, issueSize: size, ...(lot && Number.isFinite(maxPrice) && maxPrice > 0 ? { minInvestment: lot * maxPrice } : {}), listingDate, ...(Number.isFinite(gmpNum) ? { gmp: gmpNum } : {}), ...(Number.isFinite(gmpPct) ? { gmpPct } : {}), ...(Number.isFinite(subscriptionNum) ? { subscription: subscriptionNum } : {}), gmpDisputed: Boolean(firstField(row, ['gmpDisputed']) ?? false), gmpSources: Number.isFinite(Number(firstField(row, ['gmpSources']))) ? Number(firstField(row, ['gmpSources'])) : undefined, gmpSpread: Number.isFinite(Number(firstField(row, ['gmpSpread']))) ? Number(firstField(row, ['gmpSpread'])) : undefined, gmpSource: gmpRaw == null ? undefined : asString(firstField(row, ['gmpSource','sourceName','providerName'])) || ((asString(firstField(row, ['providerName'])) || 'Xflot') + ' (aggregated, unofficial GMP)'), gmpSourceUrl: asString(firstField(row, ['gmpSourceUrl','sourceUrl'])) || (gmpRaw == null ? undefined : 'https://www.xflot.com/api-docs'), gmpObservedAt: asString(firstField(row, ['gmpObservedAt','gmpUpdatedAt','updatedAt'])) || undefined, exchange: asString(firstField(row, ['exchange','exchangeName'])) || undefined, registrar: asString(firstField(row, ['registrar','registrarName'])) || undefined, registrarUrl: asString(firstField(row, ['registrarUrl','registrarLink'])) || undefined, offerDocumentUrl: asString(firstField(row, ['rhpUrl','drhpUrl','offerDocumentUrl','documentUrl'])) || undefined, officialUrl: asString(firstField(row, ['officialUrl','issueUrl','exchangeUrl'])) || undefined, providerDisclaimer: asString(firstField(row, ['providerDisclaimer','disclaimer'])) || undefined, description: asString(firstField(row, ['description','companyOverview','about','overview','companyDescription'])) || undefined, issueObjectives: asString(firstField(row, ['issueObjectives','objectives','objectsOfIssue','useOfProceeds'])) || undefined, financialHighlights: asString(firstField(row, ['financialHighlights','financialSummary','financialsSummary'])) || undefined, freshIssue: asString(firstField(row, ['freshIssue','freshIssueSize','freshIssueAmount'])) || undefined, offerForSale: asString(firstField(row, ['offerForSale','ofs','offerForSaleSize','ofsAmount'])) || undefined, faceValue: Number.isFinite(Number(firstField(row, ['faceValue','face_value']))) ? Number(firstField(row, ['faceValue','face_value'])) : undefined, minInvestment: Number.isFinite(Number(firstField(row, ['minInvestment','minimumInvestment','retailMinInvestment']))) ? Number(firstField(row, ['minInvestment','minimumInvestment','retailMinInvestment'])) : (lot && Number.isFinite(maxPrice) && maxPrice > 0 ? lot * maxPrice : undefined), allotmentDate: parseDate(firstField(row, ['allotmentDate','basisOfAllotmentDate'])) || undefined, refundDate: parseDate(firstField(row, ['refundDate','refundInitiationDate'])) || undefined, dematDate: parseDate(firstField(row, ['dematDate','dematCreditDate'])) || undefined, actualListingPrice: Number.isFinite(Number(firstField(row, ['actualListingPrice','listingPrice','listingPriceNse']))) ? Number(firstField(row, ['actualListingPrice','listingPrice','listingPriceNse'])) : undefined, listingGainPct: Number.isFinite(Number(firstField(row, ['listingGainPct','listingGainPercent','listingGainNsePct']))) ? Number(firstField(row, ['listingGainPct','listingGainPercent','listingGainNsePct'])) : undefined, retailReservation: asString(firstField(row, ['retailReservation','retailPortion','retailShares'])) || undefined, qibReservation: asString(firstField(row, ['qibReservation','qibPortion','qibShares'])) || undefined, niiReservation: asString(firstField(row, ['niiReservation','niiPortion','niiShares','hniPortion'])) || undefined, employeeReservation: asString(firstField(row, ['employeeReservation','employeePortion'])) || undefined, shareholderReservation: asString(firstField(row, ['shareholderReservation','shareholderPortion'])) || undefined, qibSubscription: Number.isFinite(Number(firstField(row, ['qibSubscription','qibSubscriptionTimes','qib']))) ? Number(firstField(row, ['qibSubscription','qibSubscriptionTimes','qib'])) : undefined, niiSubscription: Number.isFinite(Number(firstField(row, ['niiSubscription','niiSubscriptionTimes','nii','hniSubscription']))) ? Number(firstField(row, ['niiSubscription','niiSubscriptionTimes','nii','hniSubscription'])) : undefined, retailSubscription: Number.isFinite(Number(firstField(row, ['retailSubscription','retailSubscriptionTimes','retail']))) ? Number(firstField(row, ['retailSubscription','retailSubscriptionTimes','retail'])) : undefined, employeeSubscription: Number.isFinite(Number(firstField(row, ['employeeSubscription','employeeSubscriptionTimes']))) ? Number(firstField(row, ['employeeSubscription','employeeSubscriptionTimes'])) : undefined, shareholderSubscription: Number.isFinite(Number(firstField(row, ['shareholderSubscription','shareholderSubscriptionTimes']))) ? Number(firstField(row, ['shareholderSubscription','shareholderSubscriptionTimes'])) : undefined, totalApplications: Number.isFinite(Number(firstField(row, ['totalApplications','applicationCount','applications']))) ? Number(firstField(row, ['totalApplications','applicationCount','applications'])) : undefined, promoterHoldingPreIssue: asString(firstField(row, ['promoterHoldingPreIssue','preIssuePromoterHolding'])) || undefined, promoterHoldingPostIssue: asString(firstField(row, ['promoterHoldingPostIssue','postIssuePromoterHolding'])) || undefined, leadManager: asString(firstField(row, ['leadManager','bookRunningLeadManager','brlm'])) || undefined, registrarName: asString(firstField(row, ['registrarName','registrar'])) || undefined, issueType: asString(firstField(row, ['issueType','issueCategory','typeOfIssue'])) || undefined, lotSizeText: asString(firstField(row, ['lotSizeText','marketLotText'])) || undefined, listingPriceNse: Number.isFinite(Number(firstField(row, ['listingPriceNse','nseListingPrice']))) ? Number(firstField(row, ['listingPriceNse','nseListingPrice'])) : undefined, listingPriceBse: Number.isFinite(Number(firstField(row, ['listingPriceBse','bseListingPrice']))) ? Number(firstField(row, ['listingPriceBse','bseListingPrice'])) : undefined, listingGainNsePct: Number.isFinite(Number(firstField(row, ['listingGainNsePct','nseListingGainPct']))) ? Number(firstField(row, ['listingGainNsePct','nseListingGainPct'])) : undefined, listingGainBsePct: Number.isFinite(Number(firstField(row, ['listingGainBsePct','bseListingGainPct']))) ? Number(firstField(row, ['listingGainBsePct','bseListingGainPct'])) : undefined, financials: Array.isArray(firstField(row, ['financials','financialHighlightsData','financialData'])) ? (firstField(row, ['financials','financialHighlightsData','financialData']) as any[]).map((f:any)=>({period:asString(firstField(f,['period','year','financialYear']))||'Period not supplied',...(Number.isFinite(Number(firstField(f,['revenue','totalIncome','income'])))?{revenue:Number(firstField(f,['revenue','totalIncome','income']))}:{}),...(Number.isFinite(Number(firstField(f,['profit','netProfit','profitAfterTax','pat'])))?{profit:Number(firstField(f,['profit','netProfit','profitAfterTax','pat']))}:{}),...(Number.isFinite(Number(firstField(f,['assets','totalAssets'])))?{assets:Number(firstField(f,['assets','totalAssets']))}:{}),...(Number.isFinite(Number(firstField(f,['borrowings','totalBorrowings','debt'])))?{borrowings:Number(firstField(f,['borrowings','totalBorrowings','debt']))}:{})})) : undefined, subscriptionHistory: Array.isArray(firstField(row, ['subscriptionHistory','subscriptionByDay','dailySubscription'])) ? (firstField(row, ['subscriptionHistory','subscriptionByDay','dailySubscription']) as any[]).map((f:any)=>({date:asString(firstField(f,['date','day','asOn']))||'Date not supplied',...(Number.isFinite(Number(firstField(f,['qib','QIB'])))?{qib:Number(firstField(f,['qib','QIB']))}:{}),...(Number.isFinite(Number(firstField(f,['nii','NII','hni'])))?{nii:Number(firstField(f,['nii','NII','hni']))}:{}),...(Number.isFinite(Number(firstField(f,['retail','RII'])))?{retail:Number(firstField(f,['retail','RII']))}:{}),...(Number.isFinite(Number(firstField(f,['total','subscription','overall'])))?{total:Number(firstField(f,['total','subscription','overall']))}:{})})) : undefined, investorReservations: Array.isArray(firstField(row, ['investorReservations','reservationCategories','quotas'])) ? (firstField(row, ['investorReservations','reservationCategories','quotas']) as any[]).map((f:any)=>({category:asString(firstField(f,['category','name','investorType']))||'Category',...(firstField(f,['shares','reservedShares','quantity'])!=null?{shares:asString(firstField(f,['shares','reservedShares','quantity']))}:{}),...(Number.isFinite(Number(firstField(f,['percentage','percent','reservationPct'])))?{percentage:Number(firstField(f,['percentage','percent','reservationPct']))}:{})})) : undefined, issueBreakup: { freshIssue: asString(firstField(row,['freshIssue','freshIssueSize','freshIssueAmount'])) || '', ofs: asString(firstField(row,['offerForSale','ofs','offerForSaleSize','ofsAmount'])) || '', totalIssue: size }, quotaAllocation: (()=>{const q=firstField(row,['qibPercent','qibReservationPercent']),n=firstField(row,['niiPercent','niiReservationPercent']),r=firstField(row,['retailPercent','retailReservationPercent']);if(q==null||n==null||r==null)return undefined;return {qibPercent:Number(q),niiPercent:Number(n),retailPercent:Number(r)}})(), registrarDetails: (asString(firstField(row,['registrarName','registrar'])) || asString(firstField(row,['registrar']))) ? { name: asString(firstField(row,['registrarName','registrar'])), url: asString(firstField(row,['registrarUrl','registrarLink'])), checkStatusUrl: asString(firstField(row,['registrarStatusUrl','checkStatusUrl','allotmentUrl'])) } : undefined, leadManagers: (()=>{const value=firstField(row,['leadManagers','leadManager','bookRunningLeadManager','brlm']);return Array.isArray(value)?value.map(asString).filter(Boolean):(asString(value)?asString(value).split(/[,;|]/).map(x=>x.trim()).filter(Boolean):undefined)})(), industry: asString(firstField(row,['industry','sector','industrySector'])) || undefined, subscriptionDetails: (()=>{const raw=firstField(row,['subscriptionDetails','subscriptionBreakdown','subscription']);if(raw&&typeof raw==='object') {const qib=Number((raw as any).qib),nii=Number((raw as any).nii),retail=Number((raw as any).retail),total=Number((raw as any).total);if([qib,nii,retail,total].every(Number.isFinite))return {qib,nii,retail,total,asOf:asString((raw as any).asOf)||asString(firstField(row,['subscriptionAsOf','updatedAt']))||''};}return undefined;})(), expectedListingPrice: Number.isFinite(Number(firstField(row,['expectedListingPrice','estimatedListingPrice'])))?Number(firstField(row,['expectedListingPrice','estimatedListingPrice'])):undefined, updatedAt: new Date().toISOString() };
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
