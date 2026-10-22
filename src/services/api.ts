import { z } from 'zod';
import { resolveDataset } from './fallbackChain';

const IndexSchema = z.array(z.object({ symbol:z.string(), name:z.string(), value:z.number(), change:z.number(), changePct:z.number(), updatedAt:z.string(), source:z.string() }));
const IpoSchema = z.array(z.object({ id:z.string(), name:z.string(), symbol:z.string(), detailSlug:z.string().optional(), market:z.enum(['Mainboard','SME']), status:z.enum(['Open','Upcoming','Closed','Listed','Cancelled','Withdrawn']), openDate:z.string().default(''), closeDate:z.string().default(''), priceBand:z.string().default(''), lotSize:z.number().default(0), issueSize:z.string().default(''), gmp:z.number().optional(), subscription:z.number().optional(), listingDate:z.string().optional(), description:z.string().optional(), exchange:z.string().optional(), registrar:z.string().optional(), registrarUrl:z.string().optional(), offerDocumentUrl:z.string().optional(), officialUrl:z.string().optional(), gmpSource:z.string().optional(), gmpSourceUrl:z.string().optional(), gmpObservedAt:z.string().optional(), updatedAt:z.string().optional(), gmpPct:z.number().optional(), minInvestment:z.number().optional(), faceValue:z.number().optional(), freshIssue:z.string().optional(), offerForSale:z.string().optional(), allotmentDate:z.string().optional(), refundDate:z.string().optional(), dematDate:z.string().optional(), actualListingPrice:z.number().optional(), listingGainPct:z.number().optional(), companyLogo:z.string().optional(), issueObjectives:z.string().optional(), financialHighlights:z.string().optional(), source:z.string().optional(), providerDisclaimer:z.string().optional(), gmpDisputed:z.boolean().optional(), gmpSources:z.number().optional(), gmpSpread:z.number().optional(), retailReservation:z.string().optional(), qibReservation:z.string().optional(), niiReservation:z.string().optional(), employeeReservation:z.string().optional(), shareholderReservation:z.string().optional(), qibSubscription:z.number().optional(), niiSubscription:z.number().optional(), retailSubscription:z.number().optional(), employeeSubscription:z.number().optional(), shareholderSubscription:z.number().optional(), totalApplications:z.number().optional(), promoterHoldingPreIssue:z.string().optional(), promoterHoldingPostIssue:z.string().optional(), leadManager:z.string().optional(), registrarName:z.string().optional(), listingPriceNse:z.number().optional(), listingPriceBse:z.number().optional(), listingGainNsePct:z.number().optional(), listingGainBsePct:z.number().optional(), issueType:z.string().optional(), lotSizeText:z.string().optional(), financials:z.array(z.object({period:z.string(),revenue:z.number().optional(),profit:z.number().optional(),assets:z.number().optional(),borrowings:z.number().optional()})).optional(), subscriptionHistory:z.array(z.object({date:z.string(),qib:z.number().optional(),nii:z.number().optional(),retail:z.number().optional(),total:z.number().optional()})).optional(), investorReservations:z.array(z.object({category:z.string(),shares:z.string().optional(),percentage:z.number().optional()})).optional(), sourceFields:z.record(z.string()).optional(), gmpHistory:z.array(z.object({date:z.string(),gmp:z.number(),gmpPct:z.number().optional(),instantPercent:z.number().optional(),source:z.string().optional(),unofficial:z.boolean().optional()})).optional(), issueBreakup:z.object({freshIssue:z.string(),ofs:z.string(),totalIssue:z.string()}).optional(), quotaAllocation:z.object({qibPercent:z.number(),niiPercent:z.number(),retailPercent:z.number()}).optional(), subscriptionDetails:z.object({qib:z.number(),nii:z.number(),retail:z.number(),total:z.number(),asOf:z.string(),employee:z.number().optional(),smallNii:z.number().optional(),bigNii:z.number().optional()}).optional(), registrarDetails:z.object({name:z.string(),url:z.string(),checkStatusUrl:z.string()}).optional(), leadManagers:z.array(z.string()).optional(), industry:z.string().optional(), expectedListingPrice:z.number().optional(), dataFreshness:z.enum(['fresh','stale','unknown']).optional() }));
const NewsSchema = z.array(z.object({ id:z.string(), title:z.string(), summary:z.string(), source:z.string(), category:z.enum(['IPO','Markets','Economy','Commodities']), publishedAt:z.string(), url:z.string().url() }));
const FiiSchema = z.array(z.object({ date:z.string(), fii:z.number(), dii:z.number() }));
const base = (import.meta.env.VITE_DATA_BASE_URL || '').replace(/\/$/, '');
async function getJson<S extends z.ZodTypeAny>(path: string, schema: S): Promise<z.output<S>> {
  // Same-origin by default: the frontend and API are deployed by the same Worker.
  // VITE_DATA_BASE_URL remains available for local development or a separately hosted API.
  const endpoint = base ? `${base}${path}` : path;
  const response = await fetch(endpoint, { headers: { accept:'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Live data service returned HTTP ${response.status}`);
  return schema.parse(await response.json());
}
// Infer the dataset type from the schema's parsed output. This is important
// when Zod transforms/defaults input fields (e.g. optional openDate -> string).
// The API payload is validated as unknown and the parsed output is what gets cached.
const live = <S extends z.ZodTypeAny>(key:string,path:string,schema:S,ttl:number) =>
  resolveDataset<z.output<S>>(key,[{name:'BazaarBrief scheduled live feed',fetch:()=>getJson(path,schema)}],ttl);
export const getIndices = () => live('indices','/api/indices',IndexSchema,60_000);
export const getIpos = () => live('ipos','/api/ipos',IpoSchema,600_000);
const IpoRefreshStatusSchema = z.object({
  dataset: z.string().optional(), persistentCacheEnabled: z.boolean(),
  lastSuccessfulRefreshAt: z.string().optional(), recordCount: z.number().optional(),
  source: z.string().optional(), provider: z.string().optional(),
  lastAttemptAt: z.string().optional(), lastAttemptResult: z.string().optional(),
  lastAttemptSucceeded: z.boolean().optional(), schedule: z.string().optional(),
}).passthrough();
export const getIpoRefreshStatus = () => getJson('/api/ipos/refresh-status', IpoRefreshStatusSchema);
export const getNews = () => live('news','/api/news',NewsSchema,900_000);
export const getFiiDii = () => live('fii_dii','/api/fii-dii',FiiSchema,1_800_000);
export const getHistory = () => live('history','/api/history',z.array(z.object({time:z.string(),value:z.number()})),60_000);
