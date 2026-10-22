import { describe, expect, it } from 'vitest';
import { normalizeNseIpos, validIpos } from './ipoNormalization';

describe('IPO normalization', () => {
  it('keeps historical records with missing lot size, price and issue size', () => {
    const [ipo] = normalizeNseIpos([{ companyName: 'Example Industries', symbol: 'EXAMPLE', listingDate: '2026-10-01' }], 'Listed');
    expect(ipo.name).toBe('Example Industries');
    expect(ipo.market).toBe('Mainboard');
    expect(ipo.lotSize).toBe(0);
    expect(ipo.priceBand).toBe('');
    expect(ipo.issueSize).toBe('');
    expect(ipo.status).toBe('Listed');
  });

  it('normalizes SME and maps supplied GMP without inventing it', () => {
    const [ipo] = normalizeNseIpos([{ companyName: 'Small Co', symbol: 'SMALL', board: 'NSE Emerge', issueStartDate: '01-Oct-2026', issueEndDate: '20-Oct-2026', lotSize: '1,200', gmp: '₹45', gmpSource: 'Permitted Provider' }], 'Open');
    expect(ipo.market).toBe('SME');
    expect(ipo.lotSize).toBe(1200);
    expect(ipo.gmp).toBe(45);
    expect(ipo.gmpSource).toBe('Permitted Provider');
  });

  it('calculates GMP percentage from the upper price-band value when the provider only supplies a price range', () => {
    const [ipo] = normalizeNseIpos([{ companyName: 'Percent Co', priceRange: '₹100–₹120', lastGmp: 24 }], 'Upcoming');
    expect(ipo.gmpPct).toBe(20);
  });

  it('does not set GMP when the source omits it', () => {
    const [ipo] = normalizeNseIpos([{ companyName: 'No GMP Co', symbol: 'NOGMP' }], 'Upcoming');
    expect(ipo.gmp).toBeUndefined();
  });

  it('normalizes the documented Xflot API shape and field names', () => {
    const [ipo] = normalizeNseIpos({ ipos: [{
      slug: 'sample-ipo', name: 'Sample Limited', board: 'SME', status: 'OPEN',
      priceMin: 95, priceMax: 102, lotSize: 120, issueSizeCr: 84,
      openDate: '2026-10-18T00:00:00.000Z', closeDate: '2026-10-21T00:00:00.000Z',
      lastGmp: 15, lastGmpPct: 14.7, lastSubX: 2.5, gmpSources: 3,
      gmpSpread: 4, gmpDisputed: true,
    }] }, 'Upcoming');
    expect(ipo.id).toBe('sample-ipo');
    expect(ipo.market).toBe('SME');
    expect(ipo.status).toBe('Open');
    expect(ipo.priceBand).toBe('₹95–₹102');
    expect(ipo.issueSize).toBe('₹84 Cr');
    expect(ipo.gmp).toBe(15);
    expect(ipo.gmpPct).toBe(14.7);
    expect(ipo.subscription).toBe(2.5);
    expect(ipo.gmpDisputed).toBe(true);
  });

  it('accepts valid partial historical records without current-issue fields', () => {
    const [ipo] = normalizeNseIpos([{ companyName: 'Legacy Limited', symbol: 'LEGACY', status: 'LISTED' }], 'Listed');
    expect(validIpos([ipo])).toBe(true);
    expect(ipo.openDate).toBe('');
    expect(ipo.closeDate).toBe('');
    expect(ipo.priceBand).toBe('');
    expect(ipo.issueSize).toBe('');
  });

  it('preserves explicit cancellation status', () => {
    const [ipo] = normalizeNseIpos([{ companyName: 'Cancelled Co', symbol: 'CANCEL', status: 'Cancelled' }], 'Upcoming');
    expect(ipo.status).toBe('Cancelled');
  });
});

it('calculates minimum retail investment from lot size times upper price-band cap', () => {
  const [ipo] = normalizeNseIpos([{ companyName: 'Cap Price Limited', symbol: 'CAPPRICE', priceRange: '₹1,065–₹1,119', lotSize: 14 }], 'Upcoming');
  expect(ipo.minInvestment).toBe(15666);
});

it('normalizes structured issue breakup and registrar metadata when supplied', () => {
  const [ipo] = normalizeNseIpos([{ companyName: 'Metadata Limited', symbol: 'META', issueSize: '₹500 Cr', freshIssue: '₹300 Cr', offerForSale: '₹200 Cr', registrarName: 'Example Registrar', registrarUrl: 'https://example.com', registrarStatusUrl: 'https://example.com/status', leadManagers: ['Manager A', 'Manager B'], industry: 'Technology' }], 'Upcoming');
  expect(ipo.issueBreakup).toEqual({ freshIssue: '₹300 Cr', ofs: '₹200 Cr', totalIssue: '₹500 Cr' });
  expect(ipo.registrarDetails).toEqual({ name: 'Example Registrar', url: 'https://example.com', checkStatusUrl: 'https://example.com/status' });
  expect(ipo.leadManagers).toEqual(['Manager A', 'Manager B']);
  expect(ipo.industry).toBe('Technology');
});


it('does not double-format issue size when both issueSize and issueSizeCr are present', () => {
  const [ipo] = normalizeNseIpos([{ companyName: 'Mixed Size Limited', issueSize: '₹1,450 Cr', issueSizeCr: 1450 }], 'Upcoming');
  expect(ipo.issueSize).toBe('₹1,450 Cr');
});

it('preserves the provider detail slug separately from the exchange symbol', () => {
  const [ipo] = normalizeNseIpos([{ name: 'Slug Limited', symbol: 'SLUG', slug: 'slug-limited-ipo' }], 'Upcoming');
  expect(ipo.symbol).toBe('SLUG');
  expect(ipo.detailSlug).toBe('slug-limited-ipo');
});
