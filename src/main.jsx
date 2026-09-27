import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';

const TWO_HOURS=2*60*60*1000;
const SNAPSHOT_DATE='26 Sep 2026';

const SEED={
 updatedAt:'2026-09-26T02:39:00+05:30', source:'Latest available market snapshot · 26 Sep 2026',
 market:{
  indices:[
   {name:'NIFTY 50',value:23140.50,change:77.40,pct:0.34,kind:'index'},
   {name:'SENSEX',value:73895.74,change:315.20,pct:0.43,kind:'index'},
   {name:'BANK NIFTY',value:55580.40,change:141.90,pct:0.26,kind:'index'},
   {name:'GIFT NIFTY',value:23237.50,change:49.00,pct:0.21,kind:'gift',note:'Pre-market / futures indicator'},
  ],
  global:[
   {name:'NASDAQ',value:22104.50,change:0,pct:0},
   {name:'S&P 500',value:6460.26,change:0,pct:0},
   {name:'DOW',value:46307.00,change:0,pct:0}
  ],
  commodities:[
   {name:'USD/INR',value:95.80,unit:'₹',pct:-0.15},
   {name:'GOLD',value:4345.50,unit:'$',pct:1.11},
   {name:'SILVER',value:65.39,unit:'$',pct:2.16},
   {name:'BRENT',value:92.49,unit:'$',pct:-2.24},
   {name:'WTI',value:90.60,unit:'$',pct:-2.10},
   {name:'NAT GAS',value:3.12,unit:'$',pct:0.80}
  ],
  stocks:[
   {symbol:'WHIRLPOOL',name:'Whirlpool India',price:918.90,pct:7.67},
   {symbol:'ENGINERS',name:'Engineers India',price:315.65,pct:6.41},
   {symbol:'WELSPUN',name:'Welspun Corp',price:2832,pct:5.21},
   {symbol:'RIL',name:'Reliance Industries',price:1226,pct:0.56},
   {symbol:'HDFCBANK',name:'HDFC Bank',price:735.60,pct:0.92},
   {symbol:'ICICIBANK',name:'ICICI Bank',price:1327,pct:-0.58},
   {symbol:'INFY',name:'Infosys',price:1000,pct:-1.41},
   {symbol:'POLICYBAZR',name:'PB Fintech',price:1166,pct:-3.42}
  ]
 },
 fiiDii:{date:'25 Sep 2026',fii:-3693.93,dii:2838.17},
 ipo:{
  mainboard:[
   {name:'Moneyview Limited',slug:'moneyview-ipo',type:'Mainboard',symbol:'MONEYVIEW',open:'24 Sep 2026',close:'28 Sep 2026',allotment:'29 Sep 2026',listing:'01 Oct 2026',band:'See exchange/offer documents',lot:'—',min:'—',issue:'See offer documents',fresh:'—',ofs:'—',subscription:'0.34x',gmp:'—',sector:'Financial services',source:'NSE IPO dashboard'},
   {name:'A-One Steels India Limited',slug:'a-one-steels-ipo',type:'Mainboard',symbol:'AONESTEEL',open:'24 Sep 2026',close:'28 Sep 2026',allotment:'29 Sep 2026',listing:'01 Oct 2026',band:'See exchange/offer documents',lot:'—',min:'—',issue:'See offer documents',fresh:'—',ofs:'—',subscription:'0.13x',gmp:'—',sector:'Steel',source:'NSE IPO dashboard'},
   {name:'Swastika Infra Limited',slug:'swastika-infra-ipo',type:'Mainboard',symbol:'SWASTIKA',open:'23 Sep 2026',close:'25 Sep 2026',allotment:'29 Sep 2026',listing:'01 Oct 2026',band:'See offer documents',lot:'—',min:'—',issue:'See offer documents',fresh:'—',ofs:'—',subscription:'0.96x',gmp:'—',sector:'Infrastructure',source:'NSE IPO dashboard'},
   {name:'Adroit Industries (India) Limited',slug:'adroit-industries-ipo',type:'Mainboard',symbol:'ADROITIND',open:'23 Sep 2026',close:'25 Sep 2026',allotment:'29 Sep 2026',listing:'01 Oct 2026',band:'₹126–₹134',lot:111,min:14874,issue:'Fresh + OFS',fresh:'Up to 9,897,000 shares',ofs:'Up to 1,350,000 shares',subscription:'5.18x',gmp:'—',sector:'Industrial',source:'NSE issue information'},
   {name:'ArMee Infotech Limited',slug:'armee-infotech-ipo',type:'Mainboard',symbol:'ARMEE',open:'23 Sep 2026',close:'25 Sep 2026',allotment:'29 Sep 2026',listing:'01 Oct 2026',band:'See offer documents',lot:'—',min:'—',issue:'See offer documents',fresh:'—',ofs:'—',subscription:'0.56x',gmp:'—',sector:'Technology',source:'NSE IPO dashboard'}
  ],
  sme:[
   {name:'Green Asia Impex Limited',slug:'green-asia-impex-ipo',type:'SME',symbol:'GREENASIA',open:'24 Sep 2026',close:'28 Sep 2026',allotment:'29 Sep 2026',listing:'01 Oct 2026',band:'₹85–₹90',lot:1600,min:144000,issue:'₹60.10 Cr',fresh:'₹53.10 Cr',ofs:'₹7.00 Cr',subscription:'—',gmp:'—',sector:'Trading / Manufacturing',source:'NSE issue information'},
   {name:'Pooja Logistics Limited',slug:'pooja-logistics-ipo',type:'SME',symbol:'POOJALOGIS',open:'23 Sep 2026',close:'25 Sep 2026',allotment:'29 Sep 2026',listing:'01 Oct 2026',band:'₹109–₹115',lot:1200,min:138000,issue:'Fresh issue',fresh:'38,46,000 shares',ofs:'₹0',subscription:'0.35x',gmp:'—',sector:'Logistics',source:'NSE issue information'},
   {name:'Coreintegra Consulting Services Limited',slug:'coreintegra-ipo',type:'SME',symbol:'COREIN',open:'23 Sep 2026',close:'25 Sep 2026',allotment:'29 Sep 2026',listing:'01 Oct 2026',band:'₹74–₹78',lot:1600,min:124800,issue:'Fresh issue',fresh:'28,19,200 shares',ofs:'₹0',subscription:'0.16x',gmp:'—',sector:'Consulting',source:'NSE issue information'},
  ]
 },
 news:[
  {title:'GIFT Nifty closed the latest session at 23,188.50, while the broader market remains focused on the next NSE open.',tag:'GIFT NIFTY',source:'Market snapshot',age:'26 Sep'},
  {title:'Moneyview and A-One Steels are shown as active issues in the latest NSE IPO dashboard.',tag:'IPO',source:'NSE',age:'25 Sep'},
  {title:'Green Asia Impex is an active SME issue with a ₹85–₹90 price band and 1,600-share lot.',tag:'SME IPO',source:'NSE',age:'25 Sep'},
  {title:'FII net selling and DII net buying remained key institutional-flow signals in the latest cash-market data.',tag:'FII/DII',source:'Market snapshot',age:'25 Sep'},
  {title:'Global cues, crude and currency remain important overnight inputs for the next Indian session.',tag:'GLOBAL',source:'Market brief',age:'26 Sep'}
 ]
 }
};

function clone(x){return JSON.parse(JSON.stringify(x))}
function money(n,dec=2){if(n===null||n===undefined||n===''||Number.isNaN(Number(n)))return '—';return new Intl.NumberFormat('en-IN',{maximumFractionDigits:dec,minimumFractionDigits:dec}).format(Number(n))}
function pct(n){return `${Number(n)>=0?'+':''}${Number(n).toFixed(2)}%`}
function parseNum(v){const n=Number(v);return Number.isFinite(n)?n:0}
function bandHigh(band){const m=String(band||'').match(/([\d,.]+)\s*[–-]\s*([\d,.]+)/);return m?parseNum(m[2].replace(/,/g,'')):0}

function useData(){
 const [data,setData]=useState(()=>{try{return JSON.parse(localStorage.getItem('bb-data'))?.data||clone(SEED)}catch{return clone(SEED)}});
 const [last,setLast]=useState(()=>{try{return localStorage.getItem('bb-last')||SEED.updatedAt}catch{return SEED.updatedAt}});
 const [loading,setLoading]=useState(false),[msg,setMsg]=useState('');
 const refresh=async(manual=false)=>{
  setLoading(true);setMsg('');
  try{
   const key=import.meta.env.VITE_TWELVE_DATA_KEY;
   if(!key) throw new Error('Live provider key is not configured; displaying the latest dated snapshot.');
   const symbols=['NSE:NIFTY 50','BSE:SENSEX','NSE:NIFTY BANK'];
   const r=await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols.join(','))}&apikey=${key}`);
   if(!r.ok)throw new Error(`Live provider returned HTTP ${r.status}.`);
   const j=await r.json();const arr=Array.isArray(j)?j:Object.values(j||{}).filter(x=>x&&x.close);
   if(!arr.length)throw new Error('Live provider returned no usable quotes.');
   const next=clone(data);
   next.market.indices=next.market.indices.map((item,i)=>{const q=arr[i];if(!q?.close)return item;const value=Number(q.close),prev=Number(q.previous_close||value);return {...item,value,change:value-prev,pct:prev?((value-prev)/prev)*100:item.pct}});
   next.updatedAt=new Date().toISOString();next.source='Live browser API response';
   setData(next);setLast(next.updatedAt);localStorage.setItem('bb-data',JSON.stringify({data:next}));localStorage.setItem('bb-last',next.updatedAt);
  }catch(e){setMsg(manual?e.message:'Live feed unavailable; the latest dated snapshot remains visible.')}finally{setLoading(false)}
 };
 useEffect(()=>{const timer=setInterval(()=>refresh(false),TWO_HOURS);const vis=()=>{if(document.visibilityState==='visible'){const l=localStorage.getItem('bb-last');if(l&&Date.now()-new Date(l).getTime()>TWO_HOURS)refresh(false)}};document.addEventListener('visibilitychange',vis);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',vis)}},[]);
 return {data,last,loading,msg,refresh}
}

function Header({state,onNav}){return <><div className="top"><div className="brand" onClick={()=>onNav('/')}>BAZAAR<span>BRIEF</span></div><div className="tag">INDIA'S DAILY MARKET BRIEF</div><button onClick={()=>state.refresh(true)} disabled={state.loading}>{state.loading?'Updating…':'↻ Refresh data'}</button></div><div className="nav"><a onClick={()=>onNav('/')}>Markets</a><a onClick={()=>onNav('/ipo')}>IPO</a><a onClick={()=>onNav('/ipo-calendar')}>IPO Calendar</a><a onClick={()=>onNav('/gmp')}>GMP</a><a onClick={()=>onNav('/ipo-allotment-status')}>Allotment</a><a onClick={()=>onNav('/tools')}>Financial Tools</a></div><div className="status">● {state.data.source} · Updated {new Date(state.last).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})} · Browser refresh interval: 2 hours</div></>}
function Section({title,sub,children}){return <section><div className="sectionHead"><div><h2>{title}</h2>{sub&&<p>{sub}</p>}</div></div>{children}</section>}
function IndexCards({items}){return <div className="indexGrid">{items.map(x=><div className="index" key={x.name}><small>{x.name}</small><strong>{money(x.value)}</strong><span className={x.pct>=0?'up':'down'}>{x.change>=0?'+':''}{money(x.change)} &nbsp; {pct(x.pct)}</span>{x.note&&<em>{x.note}</em>}</div>)}</div>}
function Home({data,navigate}){const m=data.market;const gain=[...m.stocks].sort((a,b)=>b.pct-a.pct).slice(0,4),lose=[...m.stocks].sort((a,b)=>a.pct-b.pct).slice(0,4);return <main>
 <div className="hero"><div><div className="eyebrow">MARKET + IPO + TOOLS</div><h1>Your daily market brief.</h1><p>Indian markets, GIFT Nifty, IPOs, global cues and practical financial tools — in one place.</p></div><div className="heroCard"><b>Next Indian cash session</b><strong>Monday · 28 Sep</strong><span>GIFT Nifty is the overnight / pre-market indicator. It is not the Nifty spot index.</span></div></div>
 <Section title="Indian Market" sub="Latest available completed / overnight snapshot"><IndexCards items={m.indices}/></Section>
 <Section title="5 things moving the market" sub="Quick read before the next session"><div className="newsGrid">{data.news.map((n,i)=><article className="news" key={i}><b>{n.tag}</b><h3>{n.title}</h3><small>{n.source} · {n.age}</small></article>)}</div></Section>
 <Section title="Top movers" sub="Selected-stock snapshot"><div className="two"><div className="panel"><h3>Top Gainers</h3>{gain.map(x=><Row x={x} key={x.symbol}/>)}</div><div className="panel"><h3>Top Losers</h3>{lose.map(x=><Row x={x} key={x.symbol}/>)}</div></div></Section>
 <Section title="FII / DII Activity" sub={`Cash market · ${data.fiiDii.date}`}><div className="two"><div className="flow"><small>FII / FPI NET</small><strong className="down">₹{money(Math.abs(data.fiiDii.fii))} Cr</strong><span>Net selling</span></div><div className="flow"><small>DII NET</small><strong className="up">+₹{money(data.fiiDii.dii)} Cr</strong><span>Net buying</span></div></div></Section>
 <Section title="Global Markets & Commodities"><div className="commodityGrid">{m.global.concat(m.commodities).map(x=><div className="commodity" key={x.name}><small>{x.name}</small><strong>{x.unit||''}{money(x.value)}</strong><span className={x.pct>=0?'up':'down'}>{pct(x.pct)}</span></div>)}</div></Section>
 <Section title="IPO" sub="Mainboard and SME are separated"><div className="ipoSplit"><div><div className="subHead"><h3>Mainboard IPOs</h3><button onClick={()=>navigate('/ipo/mainboard')}>View all →</button></div><div className="ipoGrid">{data.ipo.mainboard.slice(0,3).map(x=><IPOCard x={x} key={x.slug} navigate={navigate}/>)}</div></div><div><div className="subHead"><h3>SME IPOs</h3><button onClick={()=>navigate('/ipo/sme')}>View all →</button></div><div className="ipoGrid">{data.ipo.sme.slice(0,3).map(x=><IPOCard x={x} key={x.slug} navigate={navigate}/>)}</div></div></div></Section>
 <Section title="Financial Tools" sub="Working calculators — not placeholder cards"><div className="tools">{['SIP Calculator','CAGR Calculator','Stock Average','Dividend Calculator','P/E Calculator','EPS Calculator','ROE / ROCE','IPO Investment','IPO Profit','IPO GMP','Allotment Estimate','USD/INR'].map(t=><div key={t} onClick={()=>navigate('/tools/'+slugify(t))}>{t}<span>→</span></div>)}</div></Section>
 </main>}
function Row({x}){return <div className="row"><div><b>{x.symbol}</b><small>{x.name}</small></div><strong>₹{money(x.price)}</strong><span className={x.pct>=0?'up':'down'}>{pct(x.pct)}</span></div>}
function IPOCard({x,navigate}){return <article className="ipoCard"><div className="ipoTop"><span>{x.type}</span><b>{x.subscription} sub.</b></div><h3>{x.name}</h3><p>{x.band} · Lot {x.lot}</p><div className="ipoMeta"><div><small>Issue</small><b>{x.issue}</b></div><div><small>Close</small><b>{x.close}</b></div><div><small>GMP*</small><b>{x.gmp}</b></div></div><button onClick={()=>navigate('/ipo/'+x.type.toLowerCase()+'/'+x.slug)}>View IPO →</button></article>}
function allIPOs(data){return [...data.ipo.mainboard,...data.ipo.sme]}
function IPOPage({data,kind,slug,navigate}){const list=kind==='mainboard'?data.ipo.mainboard:kind==='sme'?data.ipo.sme:allIPOs(data);if(slug){const x=list.find(i=>i.slug===slug)||allIPOs(data).find(i=>i.slug===slug)||list[0];return <main><div className="pageTitle"><span>{x.type.toUpperCase()} IPO</span><h1>{x.name}</h1><p>{x.type} · GMP is unofficial / market-reported and is shown only when a source is available.</p></div><div className="detailGrid">{[['Price band',x.band],['IPO dates',`${x.open} → ${x.close}`],['Lot size',x.lot],['Minimum investment',typeof x.min==='number'?`₹${money(x.min,0)}`:x.min],['Issue size',x.issue],['Fresh issue',x.fresh],['OFS',x.ofs],['Subscription',x.subscription],['Allotment',x.allotment],['Listing',x.listing],['GMP*',x.gmp],['Sector',x.sector]].map(([a,b])=><div className="detail" key={a}><small>{a}</small><strong>{b||'—'}</strong></div>)}</div><div className="two"><div className="panel"><h2>Financials & company information</h2><RowText a="Revenue" b="See latest offer document / exchange filing"/><RowText a="Profit" b="See latest offer document / exchange filing"/><RowText a="Debt" b="See latest offer document / exchange filing"/><RowText a="Source" b={x.source}/></div><div className="panel"><h2>Important dates</h2><RowText a="Open" b={x.open}/><RowText a="Close" b={x.close}/><RowText a="Allotment" b={x.allotment}/><RowText a="Listing" b={x.listing}/></div></div><button className="back" onClick={()=>navigate(kind?`/ipo/${kind}`:'/ipo')}>← Back to {kind||'all IPOs'}</button></main>}
 return <main><div className="pageTitle"><span>{kind?kind.toUpperCase()+' IPO':'IPO'}</span><h1>{kind==='mainboard'?'Mainboard IPOs':kind==='sme'?'SME IPOs':'Indian IPOs'}</h1><p>{kind==='mainboard'?'NSE mainboard public issues.':kind==='sme'?'SME public issues with separate lot-size and application context.':'Mainboard and SME IPOs, separated for easier discovery.'}</p></div><div className="ipoTabs"><button onClick={()=>navigate('/ipo/mainboard')}>Mainboard</button><button onClick={()=>navigate('/ipo/sme')}>SME</button><button onClick={()=>navigate('/ipo')}>All</button></div><div className="ipoGrid">{list.map(x=><IPOCard x={x} key={x.slug} navigate={navigate}/>)}</div></main>}
function RowText({a,b}){return <div className="rowText"><span>{a}</span><b>{b}</b></div>}
function Calendar({data,navigate}){const rows=allIPOs(data);return <main><div className="pageTitle"><span>CALENDAR</span><h1>IPO Calendar</h1><p>Opening, closing, allotment and listing dates for Mainboard and SME.</p></div><div className="ipoTabs"><button onClick={()=>navigate('/ipo/mainboard')}>Mainboard</button><button onClick={()=>navigate('/ipo/sme')}>SME</button></div><div className="tableWrap"><table><thead><tr><th>IPO</th><th>Type</th><th>Open</th><th>Close</th><th>Allotment</th><th>Listing</th><th>Price</th><th>Lot</th></tr></thead><tbody>{rows.map(x=><tr key={x.slug}><td><b>{x.name}</b><small>{x.symbol}</small></td><td>{x.type}</td><td>{x.open}</td><td>{x.close}</td><td>{x.allotment}</td><td>{x.listing}</td><td>{x.band}</td><td>{x.lot}</td></tr>)}</tbody></table></div></main>}
function GMP({data}){const rows=allIPOs(data);return <main><div className="pageTitle"><span>UNOFFICIAL</span><h1>IPO GMP</h1><p>Grey Market Premium is unofficial and market-reported. It can change rapidly and is not a guaranteed listing indicator.</p></div><div className="tableWrap"><table><thead><tr><th>IPO</th><th>Type</th><th>Price band</th><th>GMP</th><th>Subscription</th><th>Close</th></tr></thead><tbody>{rows.map(x=><tr key={x.slug}><td><b>{x.name}</b></td><td>{x.type}</td><td>{x.band}</td><td className={x.gmp!=='—'?'up':''}>{x.gmp}</td><td>{x.subscription}</td><td>{x.close}</td></tr>)}</tbody></table></div></main>}
function Allotment({data}){return <main><div className="pageTitle"><span>ALLOTMENT</span><h1>IPO Allotment Status</h1><p>Expected dates and a direct route to official exchange/registrar checks.</p></div><div className="ipoGrid">{allIPOs(data).map(x=><div className="panel" key={x.slug}><h2>{x.name}</h2><RowText a="Type" b={x.type}/><RowText a="Allotment" b={x.allotment}/><RowText a="Listing" b={x.listing}/><a className="external" href="https://www.nseindia.com/check-trades-bids-verify-ipo-bids" target="_blank" rel="noreferrer">Check official NSE bid/allotment page ↗</a></div>)}</div></main>}

const TOOL_DEFS={
 sip:{title:'SIP Calculator',fields:[['monthly','Monthly investment',5000],['rate','Expected annual return %',12],['years','Investment period (years)',10]],calc:v=>{const p=parseNum(v.monthly),r=parseNum(v.rate)/1200,n=parseNum(v.years)*12,fv=r? p*((Math.pow(1+r,n)-1)/r)*(1+r):p*n,invested=p*n;return [['Invested',`₹${money(invested,0)}`],['Estimated value',`₹${money(fv,0)}`],['Estimated gain',`₹${money(fv-invested,0)}`]]}},
 cagr:{title:'CAGR Calculator',fields:[['initial','Initial value',100000],['final','Final value',250000],['years','Years',5]],calc:v=>{const c=(parseNum(v.initial)>0&&parseNum(v.years)>0)?(Math.pow(parseNum(v.final)/parseNum(v.initial),1/parseNum(v.years))-1)*100:0;return [['CAGR',`${c.toFixed(2)}%`]]}},
 average:{title:'Stock Average Calculator',fields:[['qty1','First quantity',100],['price1','First buy price',100],['qty2','Second quantity',100],['price2','Second buy price',80]],calc:v=>{const q1=parseNum(v.qty1),q2=parseNum(v.qty2),avg=(q1+q2)?(q1*parseNum(v.price1)+q2*parseNum(v.price2))/(q1+q2):0;return [['Total quantity',money(q1+q2,0)],['Average price',`₹${money(avg)}`],['Total cost',`₹${money(q1*parseNum(v.price1)+q2*parseNum(v.price2),0)}`]]}},
 dividend:{title:'Dividend Calculator',fields:[['shares','Shares owned',100],['dividend','Dividend per share',10],['tax','Tax / withholding %',0]],calc:v=>{const gross=parseNum(v.shares)*parseNum(v.dividend),tax=gross*parseNum(v.tax)/100;return [['Gross dividend',`₹${money(gross,2)}`],['Tax',`₹${money(tax,2)}`],['Net dividend',`₹${money(gross-tax,2)}`]]}},
 pe:{title:'P/E Calculator',fields:[['price','Share price',500],['eps','EPS',25]],calc:v=>{const e=parseNum(v.eps);return [['P/E ratio',e?`${(parseNum(v.price)/e).toFixed(2)}x`:'—']]}},
 eps:{title:'EPS Calculator',fields:[['profit','Net profit',10000000],['shares','Weighted average shares',1000000]],calc:v=>{const s=parseNum(v.shares);return [['EPS',s?`₹${money(parseNum(v.profit)/s,2)}`:'—']]}},
 roe:{title:'ROE Calculator',fields:[['profit','Net profit',10000000],['equity','Average shareholders equity',50000000]],calc:v=>{const e=parseNum(v.equity);return [['ROE',e?`${(parseNum(v.profit)/e*100).toFixed(2)}%`:'—']]}},
 roce:{title:'ROCE Calculator',fields:[['ebit','EBIT / Operating profit',12000000],['capital','Capital employed',80000000]],calc:v=>{const c=parseNum(v.capital);return [['ROCE',c?`${(parseNum(v.ebit)/c*100).toFixed(2)}%`:'—']]}},
 marketcap:{title:'Market Cap Calculator',fields:[['price','Share price',500],['shares','Shares outstanding',10000000]],calc:v=>[['Market cap',`₹${money(parseNum(v.price)*parseNum(v.shares)/10000000,2)} Cr`]]},
 profitgrowth:{title:'Profit Growth Calculator',fields:[['old','Previous profit',10000000],['new','Current profit',13000000]],calc:v=>{const o=parseNum(v.old);return [['Profit growth',o?`${((parseNum(v.new)-o)/o*100).toFixed(2)}%`:'—']]}},
 ipoinvestment:{title:'IPO Investment Calculator',fields:[['lot','Shares per lot',100],['price','IPO price per share',500],['lots','Number of lots',1]],calc:v=>{const inv=parseNum(v.lot)*parseNum(v.price)*parseNum(v.lots);return [['Total shares',money(parseNum(v.lot)*parseNum(v.lots),0)],['Investment',`₹${money(inv,0)}`]]}},
 ipoprofit:{title:'IPO Profit Calculator',fields:[['shares','Shares allotted',100],['buy','IPO price',500],['sell','Listing / sale price',650]],calc:v=>{const p=(parseNum(v.sell)-parseNum(v.buy))*parseNum(v.shares);return [['Gross profit',`₹${money(p,0)}`],['Return',parseNum(v.buy)?`${((parseNum(v.sell)-parseNum(v.buy))/parseNum(v.buy)*100).toFixed(2)}%`:'—']]}},
 ipogmp:{title:'IPO GMP Calculator',fields:[['ipo','IPO upper price band',500],['gmp','GMP',80]],calc:v=>{const price=parseNum(v.ipo),g=parseNum(v.gmp);return [['Indicative premium price',`₹${money(price+g)}`],['Indicative premium',price?`${(g/price*100).toFixed(2)}%`:'—']] }},
 allotment:{title:'IPO Allotment Estimate',fields:[['applications','Applications received',100000],['lots','Lots available',5000]],calc:v=>{const a=parseNum(v.applications),l=parseNum(v.lots);const p=a?Math.min(100,l/a*100):0;return [['Simple estimated chance',`${p.toFixed(2)}%`],['Important','This is only a mathematical estimate, not a prediction of actual allotment.']]}},
 usd:{title:'USD / INR Converter',fields:[['usd','USD amount',100],['rate','USD/INR rate',95.80]],calc:v=>[['INR value',`₹${money(parseNum(v.usd)*parseNum(v.rate),2)}`]]}
};
function slugify(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}
function Calculator({def}){const initial=Object.fromEntries(def.fields.map(([k,,v])=>[k,v]));const [v,setV]=useState(initial);const result=def.calc(v);return <div className="calculator"><h2>{def.title}</h2><div className="fieldGrid">{def.fields.map(([key,label,val])=><label key={key}>{label}<input type="number" step="any" value={v[key]} onChange={e=>setV({...v,[key]:e.target.value})}/></label>)}</div><div className="results">{result.map(([a,b])=><div className="resultRow" key={a}><span>{a}</span><strong>{b}</strong></div>)}</div></div>}
function Tools({tool}){const [active,setActive]=useState(tool&&TOOL_DEFS[tool]?tool:'sip');return <main><div className="pageTitle"><span>TOOLS</span><h1>Financial Tools</h1><p>Fully functional browser calculators. Inputs update results instantly.</p></div><div className="toolSelector">{Object.entries(TOOL_DEFS).map(([k,d])=><button className={active===k?'active':''} key={k} onClick={()=>setActive(k)}>{d.title}</button>)}</div><Calculator def={TOOL_DEFS[active]}/><div className="toolNote"><b>Formula transparency:</b> results are calculated in your browser from the inputs shown. IPO allotment is a simple probability-style estimate only; it is not a forecast of actual allotment.</div></main>}
function Footer(){return <footer>BAZAAR BRIEF · Market data may be delayed. GIFT Nifty is a futures/pre-market indicator, not the NIFTY 50 spot index. GMP is unofficial / market-reported. Verify important figures against NSE/BSE and official IPO documents.</footer>}
function App(){const state=useData();const [path,setPath]=useState(location.pathname.replace(/\/$/,'')||'/');const nav=p=>{history.pushState({},'',p);setPath(p);window.scrollTo({top:0,behavior:'smooth'})};useEffect(()=>{const f=()=>setPath(location.pathname.replace(/\/$/,'')||'/');addEventListener('popstate',f);return()=>removeEventListener('popstate',f)},[]);
 let content;
 if(path==='/ipo')content=<IPOPage data={state.data} navigate={nav}/>;
 else if(path==='/ipo/mainboard')content=<IPOPage data={state.data} kind="mainboard" navigate={nav}/>;
 else if(path==='/ipo/sme')content=<IPOPage data={state.data} kind="sme" navigate={nav}/>;
 else if(path.startsWith('/ipo/mainboard/'))content=<IPOPage data={state.data} kind="mainboard" slug={path.split('/')[3]} navigate={nav}/>;
 else if(path.startsWith('/ipo/sme/'))content=<IPOPage data={state.data} kind="sme" slug={path.split('/')[3]} navigate={nav}/>;
 else if(path==='/ipo-calendar')content=<Calendar data={state.data} navigate={nav}/>;
 else if(path==='/gmp')content=<GMP data={state.data}/>;
 else if(path==='/ipo-allotment-status')content=<Allotment data={state.data}/>;
 else if(path.startsWith('/tools/'))content=<Tools tool={path.split('/')[2]}/>;
 else if(path==='/tools')content=<Tools/>;
 else content=<Home data={state.data} navigate={nav}/>;
 return <><Header state={state} onNav={nav}/>{state.msg&&<div className="notice">{state.msg}</div>}{content}<Footer/></>;
}
createRoot(document.getElementById('root')).render(<App/>);
