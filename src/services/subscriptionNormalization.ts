/** Normalizes the public ipos.markets subscription API into a stable, nullable model. */
export type NormalizedSubscription = {
  qib?: number; nii?: number; smallNii?: number; bigNii?: number; retail?: number;
  employee?: number; shareholder?: number; total?: number; applications?: number;
  asOf: string; basis: 'exact' | 'lower_bound' | 'bids_only' | 'unknown';
  subscriptionCategories?: Array<{ key: string; label: string; offered?: number; bid?: number; times?: number; applications?: number }>;
  subscriptionDetails?: { qib: number; nii: number; retail: number; total: number; asOf: string; employee?: number; smallNii?: number; bigNii?: number };
};

const asText = (value: unknown) => value == null ? '' : String(value).trim();
const keyText = (value: unknown) => asText(value).toLowerCase().replace(/[^a-z0-9]/g, '');
function first(value: any, keys: string[]): unknown {
  for (const key of keys) if (value?.[key] !== undefined && value?.[key] !== null && String(value[key]).trim() !== '') return value[key];
  return undefined;
}
function numberOrUndefined(value: unknown): number | undefined {
  if (value == null || String(value).trim() === '') return undefined;
  const parsed = Number(String(value).replace(/[,x×\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}
function categoryValue(categories: any, aliases: string[]): any {
  const wanted = new Set(aliases.map(keyText));
  const findIn = (source: any): any => {
    if (Array.isArray(source)) {
      return source.find((item: any) => wanted.has(keyText(item?.category ?? item?.name ?? item?.type ?? item?.key ?? item?.label)));
    }
    if (source && typeof source === 'object') {
      const key = Object.keys(source).find(name => wanted.has(keyText(name)));
      return key ? source[key] : undefined;
    }
    return undefined;
  };
  const direct = findIn(categories);
  if (direct !== undefined) return direct;
  // Some feeds nest sNII/bNII under the parent NII category.
  const parents = Array.isArray(categories) ? categories : categories && typeof categories === 'object' ? Object.values(categories) : [];
  for (const parent of parents) {
    for (const nestedKey of ['sub_categories', 'subCategories', 'subcategories', 'breakdown', 'sub_categories_data']) {
      const nested = findIn(parent?.[nestedKey]);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}
function categoryNumber(value: any, fields: string[]): number | undefined {
  if (typeof value === 'number' || typeof value === 'string') return numberOrUndefined(value);
  return value && typeof value === 'object' ? numberOrUndefined(first(value, fields)) : undefined;
}

export function normalizeSubscriptionPayload(body: any): NormalizedSubscription | null {
  let data = body?.data ?? body?.issue ?? body?.ipo ?? body;
  if (data && !Array.isArray(data) && typeof data === 'object') {
    data = data.subscriptionData ?? data.subscription_data ?? data.detail ?? data;
    if (data?.subscription && typeof data.subscription === 'object' && !Array.isArray(data.subscription) && (data.subscription.categories || data.subscription.total_times != null || data.subscription.totalTimes != null)) {
      data = data.subscription;
    }
  }
  const categories = data?.categories ?? data?.category ?? data?.subscription_categories ?? data?.subscriptionByCategory ?? data?.subscriptionsByCategory ?? data?.subscriptions ?? data?.subs ?? data?.subscription ?? {}; 
  const timesFields = ['times', 'times_sub', 'times_subscribed', 'timesSub', 'subscription', 'multiple', 'subscription_times', 'timesSubscribed', 'times_subscribed_x', 'value'];
  const pick = (aliases: string[]) => categoryValue(categories, aliases);
  const rootTimes = (keys: string[]) => numberOrUndefined(first(data, keys));
  const qib = categoryNumber(pick(['QIB']), timesFields) ?? rootTimes(['qibSubscription', 'qib_subscription', 'qib_times', 'qibTimes']);
  const nii = categoryNumber(pick(['NII', 'NII total', 'HNI']), timesFields) ?? rootTimes(['niiSubscription', 'nii_subscription', 'nii_times', 'niiTimes']);
  const smallNii = categoryNumber(pick(['sNII', 'Small NII', 'Small HNI', 'SHNI', 'Small HNI (₹2L-₹10L)']), timesFields) ?? rootTimes(['smallNiiSubscription', 'small_nii_subscription', 'sniiSubscription', 'sNiiSubscription', 'snii_times', 'sNiiTimes', 'shniSubscription']);
  const bigNii = categoryNumber(pick(['bNII', 'Big NII', 'Big HNI', 'BHNI', 'Big HNI (>₹10L)']), timesFields) ?? rootTimes(['bigNiiSubscription', 'big_nii_subscription', 'bniiSubscription', 'bNiiSubscription', 'bnii_times', 'bNiiTimes', 'bhniSubscription']);
  const retail = categoryNumber(pick(['RII', 'RII/retail', 'Retail']), timesFields) ?? rootTimes(['retailSubscription', 'retail_subscription', 'retail_times', 'retailTimes', 'riiSubscription', 'rii_times']);
  const employee = categoryNumber(pick(['EMP', 'Employee']), timesFields) ?? rootTimes(['employeeSubscription', 'employee_subscription', 'employee_times']);
  const shareholder = categoryNumber(pick(['SH', 'Shareholder', 'Shareholders']), timesFields) ?? rootTimes(['shareholderSubscription', 'shareholder_subscription', 'shareholder_times']);
  const applicationFields = ['applications', 'application_count', 'applicationCount', 'applicationsCount', 'numberOfApplications', 'totalApplications'];
  const qibApplications = categoryNumber(pick(['QIB']), applicationFields) ?? rootTimes(['qibApplications', 'qib_applications', 'qibApplicationCount', 'qib_application_count']);
  const niiApplications = categoryNumber(pick(['NII', 'NII total', 'HNI']), applicationFields) ?? rootTimes(['niiApplications', 'nii_applications', 'niiApplicationCount', 'nii_application_count']);
  const smallNiiApplications = categoryNumber(pick(['sNII', 'Small NII', 'Small HNI', 'SHNI']), applicationFields) ?? rootTimes(['smallNiiApplications', 'small_nii_applications', 'sniiApplications', 'sNiiApplications', 'shniApplications']);
  const bigNiiApplications = categoryNumber(pick(['bNII', 'Big NII', 'Big HNI', 'BHNI']), applicationFields) ?? rootTimes(['bigNiiApplications', 'big_nii_applications', 'bniiApplications', 'bNiiApplications', 'bhniApplications']);
  const retailApplications = categoryNumber(pick(['RII', 'RII/retail', 'Retail']), applicationFields) ?? rootTimes(['retailApplications', 'retail_applications', 'riiApplications', 'rii_applications']);
  const employeeApplications = categoryNumber(pick(['EMP', 'Employee']), applicationFields) ?? rootTimes(['employeeApplications', 'employee_applications']);
  const shareholderApplications = categoryNumber(pick(['SH', 'Shareholder', 'Shareholders']), applicationFields) ?? rootTimes(['shareholderApplications', 'shareholder_applications']);
  const totalFromCategory = categoryNumber(pick(['TOTAL', 'Overall', 'Total subscription']), timesFields);
  const exactTotal = numberOrUndefined(first(data, ['total_times', 'totalTimes', 'totalSubscription', 'total_subscription', 'overallSubscription', 'overall_subscription']));
  const lowerBound = numberOrUndefined(first(data, ['lower_bound_times', 'lowerBoundTimes']));
  const total = exactTotal ?? totalFromCategory ?? lowerBound;
  let applications = numberOrUndefined(first(data, ['applications', 'totalApplications', 'application_count', 'total_applications', 'totalApplicationsCount', 'applicationCount']));
  // Do not stamp a retrieval-time value as the provider's observation time.
  // If the source omits as-of metadata, keep it unknown instead of implying freshness.
  const asOf = asText(first(data, ['as_of', 'asOf', 'updatedAt', 'updated_at', 'observed_at', 'last_updated']));
  const rawBasis = asText(first(data, ['basis', 'total_basis', 'subscription_basis']));
  const basis: NormalizedSubscription['basis'] = rawBasis === 'exact' || rawBasis === 'lower_bound' || rawBasis === 'bids_only' ? rawBasis : exactTotal !== undefined ? 'exact' : lowerBound !== undefined ? 'lower_bound' : 'unknown';
  const labels: Record<string, string> = { qib: 'Qualified institutional buyers (QIB)', nii: 'Non-institutional investors (NII)', rii: 'Retail individual investors', retail: 'Retail individual investors', emp: 'Employees', employee: 'Employees', ph: 'Policyholders', sh: 'Shareholders', shareholder: 'Shareholders', total: 'Total', overall: 'Total', bnii: 'Big NII (bNII)', bignii: 'Big NII (bNII)', snii: 'Small NII (sNII)', smallnii: 'Small NII (sNII)' };
  const categoryEntries: Array<[string, any]> = Array.isArray(categories)
    ? categories.map((item: any) => [asText(item?.category ?? item?.name ?? item?.type ?? item?.key), item])
    : categories && typeof categories === 'object' ? Object.entries(categories) : [];
  const subscriptionCategories = categoryEntries.map(([rawKey, item]) => {
    const key = keyText(rawKey);
    const offered = numberOrUndefined(first(item, ['offered', 'shares_offered', 'sharesOffered', 'offeredShares', 'reserved', 'reservedShares']));
    const bid = numberOrUndefined(first(item, ['bid', 'shares_bid', 'sharesBid', 'bidShares', 'shares_applied', 'sharesApplied', 'bids', 'sharesBidFor']));
    const applicationsCount = numberOrUndefined(first(item, ['applications', 'application_count', 'applicationCount', 'applicationsCount', 'numberOfApplications']));
    const reportedTimes = numberOrUndefined(first(item, ['times', 'times_value', 'timesSub', 'times_sub', 'times_subscribed', 'subscriptionTimes', 'subscription_times', 'timesSubscribed', 'times_value', 'subscription', 'multiple']));
    const times = reportedTimes ?? (offered !== undefined && offered > 0 && bid !== undefined ? bid / offered : undefined);
    return { key: rawKey, label: labels[key] || rawKey, ...(offered !== undefined ? { offered } : {}), ...(bid !== undefined ? { bid } : {}), ...(times !== undefined ? { times } : {}), ...(applicationsCount !== undefined ? { applications: applicationsCount } : {}) };
  }).filter(item => item.offered !== undefined || item.bid !== undefined || item.times !== undefined || item.applications !== undefined);
  // Add explicit split categories when the provider supplies flat fields instead of a categories object.
  const appendFlat = (key: string, label: string, times: number | undefined, applicationsCount?: number) => {
    const existing = subscriptionCategories.find(item => keyText(item.key) === keyText(key));
    if (existing) {
      if (existing.times === undefined && times !== undefined) existing.times = times;
      if (existing.applications === undefined && applicationsCount !== undefined) existing.applications = applicationsCount;
    } else if (times !== undefined || applicationsCount !== undefined) {
      subscriptionCategories.push({ key, label, ...(times !== undefined ? { times } : {}), ...(applicationsCount !== undefined ? { applications: applicationsCount } : {}) });
    }
  };
  appendFlat('QIB', 'Qualified institutional buyers (QIB)', qib, qibApplications);
  appendFlat('NII', 'Non-institutional investors (NII)', nii, niiApplications);
  appendFlat('bNII', 'Big NII (bNII)', bigNii, bigNiiApplications);
  appendFlat('sNII', 'Small NII (sNII)', smallNii, smallNiiApplications);
  appendFlat('RII', 'Retail individual investors', retail, retailApplications);
  appendFlat('EMP', 'Employees', employee, employeeApplications);
  appendFlat('SH', 'Shareholders', shareholder, shareholderApplications);
  if (applications === undefined) {
    const totalCategory = subscriptionCategories.find(item => ['total', 'overall'].includes(keyText(item.key)));
    if (totalCategory?.applications !== undefined) applications = totalCategory.applications;
  }
  const hasValue = [qib, nii, smallNii, bigNii, retail, employee, shareholder, total, applications].some(value => value !== undefined) || subscriptionCategories.length > 0;
  if (!hasValue) return null;
  const subscriptionDetails = qib !== undefined && nii !== undefined && retail !== undefined && total !== undefined
    ? { qib, nii, retail, total, asOf, ...(employee !== undefined ? { employee } : {}), ...(smallNii !== undefined ? { smallNii } : {}), ...(bigNii !== undefined ? { bigNii } : {}) }
    : undefined;
  return { qib, nii, smallNii, bigNii, retail, employee, shareholder, total, applications, asOf, basis, ...(subscriptionCategories.length ? { subscriptionCategories } : {}), subscriptionDetails };
}
