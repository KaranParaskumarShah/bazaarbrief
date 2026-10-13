import {get,set,del} from 'idb-keyval';
export type CacheChunk<T>={key:string;data:T;fetchedAt:string;ttl:number;version:number;source:string};
const PREFIX='bb:v2:chunk:'; const VERSION=2;
export async function readChunk<T>(key:string):Promise<CacheChunk<T>|undefined>{try{return await get<CacheChunk<T>>(PREFIX+key)}catch{return undefined}}
export async function writeChunk<T>(key:string,data:T,ttl:number,source:string):Promise<CacheChunk<T>>{const chunk:CacheChunk<T>={key,data,fetchedAt:new Date().toISOString(),ttl,version:VERSION,source};await del(PREFIX+key);await set(PREFIX+key,chunk);return chunk}
export async function clearChunk(key:string){await del(PREFIX+key)}
export function isFresh(chunk:CacheChunk<unknown>,now=Date.now()){return now-new Date(chunk.fetchedAt).getTime()<chunk.ttl}
