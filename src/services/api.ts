import { z } from 'zod';
import { resolveDataset } from './fallbackChain';
import type { IndexQuote, Ipo, NewsItem, FiiDii } from '../types';

const IndexSchema = z.array(z.object({ symbol:z.string(), name:z.string(), value:z.number(), change:z.number(), changePct:z.number(), updatedAt:z.string(), source:z.string() }));
const IpoSchema = z.array(z.object({ id:z.string(), name:z.string(), symbol:z.string(), market:z.enum(['Mainboard','SME']), status:z.enum(['Open','Upcoming','Closed','Listed']), openDate:z.string(), closeDate:z.string(), priceBand:z.string(), lotSize:z.number(), issueSize:z.string(), gmp:z.number().optional(), subscription:z.number().optional(), listingDate:z.string().optional(), description:z.string().optional() }));
const NewsSchema = z.array(z.object({ id:z.string(), title:z.string(), summary:z.string(), source:z.string(), category:z.enum(['IPO','Markets','Economy','Commodities']), publishedAt:z.string(), url:z.string().url() }));
const FiiSchema = z.array(z.object({ date:z.string(), fii:z.number(), dii:z.number() }));
const base = (import.meta.env.VITE_DATA_BASE_URL || '').replace(/\/$/, '');
async function getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  if (!base) throw new Error('Live data service is not configured. Set VITE_DATA_BASE_URL.');
  const response = await fetch(`${base}${path}`, { headers: { accept:'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Live data service returned HTTP ${response.status}`);
  return schema.parse(await response.json());
}
const live = <T,>(key:string,path:string,schema:z.ZodType<T>,ttl:number) => resolveDataset<T>(key,[{name:'BazaarBrief scheduled live feed',fetch:()=>getJson(path,schema)}],ttl);
export const getIndices = () => live<IndexQuote[]>('indices','/api/indices',IndexSchema,60_000);
export const getIpos = () => live<Ipo[]>('ipos','/api/ipos',IpoSchema,600_000);
export const getNews = () => live<NewsItem[]>('news','/api/news',NewsSchema,900_000);
export const getFiiDii = () => live<FiiDii[]>('fii_dii','/api/fii-dii',FiiSchema,1_800_000);
export const getHistory = () => live<{time:string;value:number}[]>('history','/api/history',z.array(z.object({time:z.string(),value:z.number()})),60_000);
