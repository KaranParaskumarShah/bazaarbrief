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
