export type IndexQuote={symbol:string;name:string;value:number;change:number;changePct:number;updatedAt:string;source:string};
export type Ipo={id:string;name:string;symbol:string;market:'Mainboard'|'SME';status:'Open'|'Upcoming'|'Closed'|'Listed';openDate:string;closeDate:string;priceBand:string;lotSize:number;issueSize:string;gmp?:number;listingDate?:string;subscription?:number;description?:string};
export type NewsItem={id:string;title:string;summary:string;source:string;category:'IPO'|'Markets'|'Economy'|'Commodities';publishedAt:string;url:string};
export type FiiDii={date:string;fii:number;dii:number};
export type MarketDataset<T>={data:T;fetchedAt:string;source:string;delayed:boolean};