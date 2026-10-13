import {readChunk,writeChunk} from './cache';
export type Adapter<T>={name:string;fetch:()=>Promise<T>};
export type Resolved<T>={data:T;source:string;fetchedAt:string;delayed:boolean;errors:string[]};
/** Tries providers in order. Successful responses replace the full cache chunk; history merging belongs in the dataset adapter. */
export async function resolveDataset<T>(key:string,adapters:Adapter<T>[],ttl:number):Promise<Resolved<T>>{
 const errors:string[]=[];
 for(const adapter of adapters){try{const data=await adapter.fetch();const chunk=await writeChunk(key,data,ttl,adapter.name);return {data,source:adapter.name,fetchedAt:chunk.fetchedAt,delayed:false,errors}}catch(error){errors.push(`${adapter.name}: ${error instanceof Error?error.message:'request failed'}`)}}
 const cached=await readChunk<T>(key);if(cached)return {data:cached.data,source:cached.source,fetchedAt:cached.fetchedAt,delayed:true,errors};
 throw new Error(`All providers failed for ${key}. ${errors.join(' | ')}`);
}
