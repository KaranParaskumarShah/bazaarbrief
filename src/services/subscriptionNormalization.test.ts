import { describe, expect, it } from 'vitest';
import { normalizeSubscriptionPayload } from './subscriptionNormalization';

describe('subscription feed normalization', () => {
  it('normalizes category object values and split NII buckets', () => {
    const value = normalizeSubscriptionPayload({ data: { symbol: 'ABC', as_of: '2026-10-22T10:00:00Z', basis: 'exact', total_times: 5.4, categories: { QIB: { times: 8.2 }, NII: { times: 3.1 }, bNII: { times: 4.4 }, sNII: { times: 2.1 }, RII: { times: 2.5 }, EMP: { times: 1.2 } } } });
    expect(value?.qib).toBe(8.2); expect(value?.bigNii).toBe(4.4); expect(value?.smallNii).toBe(2.1);
    expect(value?.retail).toBe(2.5); expect(value?.total).toBe(5.4); expect(value?.subscriptionDetails?.asOf).toBe('2026-10-22T10:00:00Z');
  });
  it('normalizes array category format and preserves lower-bound semantics', () => {
    const value = normalizeSubscriptionPayload({ data: { basis: 'lower_bound', lower_bound_times: 2.6, categories: [{ category: 'QIB', timesSub: '1.5' }, { category: 'RII', timesSub: '3.2' }] } });
    expect(value?.qib).toBe(1.5); expect(value?.retail).toBe(3.2); expect(value?.total).toBe(2.6); expect(value?.basis).toBe('lower_bound');
  });
  it('keeps category shares, times and application counts for the detailed table', () => {
    const value = normalizeSubscriptionPayload({ data: { basis: 'exact', total_times: 2, categories: { QIB: { offered: 1000, bid: 2500, times: 2.5, applications: 11 }, RII: { offered: 5000, bid: 10000, times: 2, applications: 90 } } } });
    expect(value?.subscriptionCategories).toEqual([
      { key: 'QIB', label: 'Qualified institutional buyers (QIB)', offered: 1000, bid: 2500, times: 2.5, applications: 11 },
      { key: 'RII', label: 'Retail individual investors', offered: 5000, bid: 10000, times: 2, applications: 90 },
    ]);
  });
  it('does not turn missing subscription values into zero', () => {
    expect(normalizeSubscriptionPayload({ data: { categories: { QIB: { times: null }, RII: { times: '' } } } })).toBeNull();
  });
});


it('does not invent an observation timestamp when the provider omits one', () => {
  const value = normalizeSubscriptionPayload({ data: { total_times: 2.4, categories: { QIB: { times: 3.2 } } } });
  expect(value?.asOf).toBe('');
  expect(value?.total).toBe(2.4);
});

it('supports a nested subscription detail object and category-level total applications', () => {
  const value = normalizeSubscriptionPayload({ data: { subscription: { basis: 'exact', total_times: 2.4, categories: { TOTAL: { applications: 250 }, QIB: { offeredShares: 100, bidShares: 320, subscriptionTimes: 3.2 } } } } });
  expect(value?.applications).toBe(250);
  expect(value?.subscriptionCategories?.find(row => row.key === 'QIB')).toMatchObject({ offered: 100, bid: 320, times: 3.2 });
});


it('normalizes Xflot-style subscription arrays without fabricating an as-of time', () => {
  const value = normalizeSubscriptionPayload({ subs: [
    { category: 'QIB', timesSub: 3.4 },
    { category: 'Retail', timesSub: 1.2 },
    { category: 'Total', timesSub: 2.1 },
  ] });
  expect(value?.qib).toBe(3.4);
  expect(value?.retail).toBe(1.2);
  expect(value?.total).toBe(2.1);
  expect(value?.asOf).toBe('');
});
