import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';

const SNAPSHOT_DATE='25 Sep 2026';
const SEED={
 updatedAt:'2026-09-25T16:00:00+05:30',
 source:'Dated market snapshot — 25 Sep 2026 close',
 market:{
  indices:[
   {name:'NIFTY 50',value:23140.50,change:77.40,pct:0.34},
   {name:'SENSEX',value:73900.35,change:315.00,pct:0.43},
   {name:'BANK NIFTY',value:55380.00,change:120.00,pct:0.22},
   {name:'NIFTY IT',value:28160.90,change:-48.00,pct:-0.17}
  ],
  global:[
   {name:'NASDAQ',value:22104.50,change:0.12,pct:0.12},
   {name:'S&P 500',value:6460.26,change:0.59,pct:0.59},
   {name:'DOW',value:46307.00,change:0.65,pct:0.65}
  ],
  commodities:[
   {name:'USD/INR',value:95.82,unit:'₹',pct:-0.16},
   {name:'GOLD',value:150915,unit:'₹',pct:0.14},
   {name:'SILVER',value:178900,unit:'₹',pct:0.42},
   {name:'BRENT',value:105.50,unit:'$',pct:-1.10},
   {name:'WTI',value:92.80,unit:'$',pct:-1.20},
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
 ipo:[
  {name:'Moneyview',slug:'moneyview-ipo',type:'Mainboard',open:'24 Sep 2026',close:'28 Sep 2026',allotment:'29 Sep 2026',listing:'01 Oct 2026',band:'₹32–₹34',lot:441,min:14994,issue:'₹1,091.68 Cr',fresh:'₹1,091.68 Cr',ofs:'₹0',subscription:'6.01x',gmp:'₹14',sector:'Fintech',revenue:'₹3,351.16 Cr',profit:'Available in offer documents',debt:'See latest filing'},
  {name:'Runwal Enterprises',slug:'runwal-enterprises-ipo',type:'Mainboard',open:'25 Sep 2026',close:'29 Sep 2026',allotment:'30 Sep 2026',listing:'05 Oct 2026',band:'₹290–₹305',lot:49,min:14945,issue:'₹499.83 Cr',fresh:'₹499.83 Cr',ofs:'₹0',subscription:'0.44x',gmp:'₹15',sector:'Real Estate',revenue:'See offer documents',profit:'See offer documents',debt:'See offer documents'},
  {name:'German Green Steel & Power',slug:'german-green-steel-power-ipo',type:'Mainboard',open:'25 Sep 2026',close:'29 Sep 2026',allotment:'30 Sep 2026',listing:'05 Oct 2026',band:'₹132–₹139',lot:107,min:14873,issue:'₹303.90 Cr',fresh:'₹303.90 Cr',ofs:'₹0',subscription:'1.82x',gmp:'₹20',sector:'Steel & Power'},
  {name:'Orient Cables (India)',slug:'orient-cables-ipo',type:'Mainboard',open:'25 Sep 2026',close:'29 Sep 2026',allotment:'30 Sep 2026',listing:'05 Oct 2026',band:'₹258–₹272',lot:55,min:14960,issue:'₹552 Cr',fresh:'See prospectus',ofs:'See prospectus',subscription:'2.06x',gmp:'₹90',sector:'Cables'},
  {name:'Acevector',slug:'acevector-ipo',type:'Mainboard',open:'25 Sep 2026',close:'29 Sep 2026',allotment:'30 Sep 2026',listing:'05 Oct 2026',band:'₹30–₹32',lot:468,min:14976,issue:'₹420 Cr',fresh:'See prospectus',ofs:'See prospectus',subscription:'0.24x',gmp:'₹2',sector:'Consumer'},
  {name:'SRIT India',slug:'srit-india-ipo',type:'Mainboard',open:'28 Sep 2026',close:'30 Sep 2026',allotment:'01 Oct 2026',listing:'06 Oct 2026',band:'₹123–₹130',lot:115,min:14950,issue:'₹218.40 Cr',fresh:'See prospectus',ofs:'See prospectus',subscription:'—',gmp:'—',sector:'Technology'}
 ],
 news:[
  {title:'Sensex gains 315 points; Nifty ends above 23,100 as select financial and auto stocks recover',tag:'MARKET',source:'CNBC TV18',age:'25 Sep'},
  {title:'Moneyview IPO enters Day 2 with subscription at 6.01x',tag:'IPO',source:'Market data snapshot',age:'25 Sep'},
  {title:'Runwal Enterprises IPO opens with ₹499.83 crore issue size',tag:'IPO',source:'Economic Times',age:'25 Sep'},
  {title:'FII outflow remains elevated while DII buying provides support',tag:'FII/DII',source:'Market data snapshot',age:'25 Sep'},
  {title:'Brent crude remains above $100 as global risk keeps markets volatile',tag:'GLOBAL',source:'Market news',age:'25 Sep'}
 ]
};

function money(n,dec=2){return new Intl.NumberFormat('en-IN',{maximumFractionDigits:dec,minimumFractionDigits:dec}).format(n)}
function pct(n){return `${n>=0?'+':''}${n.toFixed(2)}%`}
function useData(){
 const [data,setData]=useState(()=>{try{const x=JSON.parse(localStorage.getItem('bb-data'));return x?.data||SEED}catch{return SEED}});
 const [last,setLast]=useState(()=>{try{return localStorage.getItem('bb-last')||SEED.updatedAt}catch{return SEED.updatedAt}});
 const [loading,setLoading]=useState(false); const [msg,setMsg]=useState('');
 const refresh=async(manual=false)=>{
  setLoading(true);setMsg('');
  try{
   const key=import.meta.env.VITE_TWELVE_DATA_KEY;
   if(!key) throw new Error('No live API key configured; showing the latest dated snapshot.');
   const symbols=['NSE:NIFTY 50','BSE:SENSEX','NSE:NIFTY BANK','NSE:NIFTY IT'];
   const r=await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols.join(','))}&apikey=${key}`);
   if(!r.ok) throw new Error(`Live provider HTTP ${r.status}`); const j=await r.json();
   const arr=Array.isArray(j)?j:Object.values(j||{}).filter(x=>x&&x.close);
   if(!arr.length) throw new Error('Live provider returned no quotes.');
   const next=structuredClone(data); next.market.indices=next.market.indices.map((item,i)=>{const q=arr[i];if(!q?.close)return item;const value=Number(q.close);const prev=Number(q.previous_close||value);return {...item,value,change:value-prev,pct:prev?((value-prev)/prev)*100:item.pct}}); next.updatedAt=new Date().toISOString();next.source='Live browser API response';
   setData(next);setLast(next.updatedAt);localStorage.setItem('bb-data',JSON.stringify({data:next}));localStorage.setItem('bb-last',next.updatedAt);
  }catch(e){setMsg(manual?e.message:'Live feed unavailable; using dated snapshot.')}finally{setLoading(false)}
 };
 useEffect(()=>{const id=setInterval(()=>refresh(false),2*60*60*1000);const vis=()=>{if(document.visibilityState==='visible'){try{const l=localStorage.getItem('bb-last');if(l&&Date.now()-new Date(l).getTime()>2*60*60*1000)refresh(false)}catch{}}};document.addEventListener('visibilitychange',vis);return()=>{clearInterval(id);document.removeEventListener('visibilitychange',vis)}},[]);
 return {data,last,loading,msg,refresh}
}
function Header({state,onNav}){return <><div className="top"><div className="brand" onClick={()=>onNav('/')}>BAZAAR<span>BRIEF</span></div><div className="tag">INDIA'S DAILY MARKET BRIEF</div><button onClick={()=>state.refresh(true)} disabled={state.loading}>{state.loading?'Updating…':'↻ Refresh data'}</button></div><div className="nav"><a onClick={()=>onNav('/')}>Markets</a><a onClick={()=>onNav('/ipo')}>IPO</a><a onClick={()=>onNav('/ipo-calendar')}>IPO Calendar</a><a onClick={()=>onNav('/gmp')}>GMP</a><a onClick={()=>onNav('/ipo-allotment-status')}>Allotment</a><a onClick={()=>onNav('/tools')}>Financial Tools</a></div><div className="status">● {state.data.source} · Updated {new Date(state.last).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})} · Next automatic refresh: 2 hours</div></>}
function Section({title,sub,children,action}){return <section><div className="sectionHead"><div><h2>{title}</h2>{sub&&<p>{sub}</p>}</div>{action}</div>{children}</section>}
function IndexCards({items}){return <div className="indexGrid">{items.map(x=><div className="index" key={x.name}><small>{x.name}</small><strong>{money(x.value)}</strong><span className={x.pct>=0?'up':'down'}>{x.change>=0?'+':''}{money(x.change)} &nbsp; {pct(x.pct)}</span></div>)}</div>}
function Home({data,navigate}){const m=data.market;const gain=[...m.stocks].sort((a,b)=>b.pct-a.pct).slice(0,4),lose=[...m.stocks].sort((a,b)=>a.pct-b.pct).slice(0,4);return <main>
 <div className="hero"><div><div className="eyebrow">SUNDAY · 27 SEP 2026</div><h1>Your morning market brief.</h1><p>Indian markets, IPOs, global cues and practical financial tools — in one place.</p></div><div className="heroCard"><b>Next market session</b><strong>Monday · 28 Sep</strong><span>IPO activity resumes · Moneyview closes</span></div></div>
 <Section title="Indian Market" sub="Latest completed trading session"><IndexCards items={m.indices}/></Section>
 <Section title="5 things moving the market today" sub="A concise dashboard for the next session"><div className="newsGrid">{data.news.slice(0,5).map((n,i)=><article className="news" key={i}><b>{n.tag}</b><h3>{n.title}</h3><small>{n.source} · {n.age}</small></article>)}</div></Section>
 <Section title="Top movers" sub="Snapshot of selected stocks"><div className="two"><div className="panel"><h3>Top Gainers</h3>{gain.map(x=><Row x={x} key={x.symbol}/>)}</div><div className="panel"><h3>Top Losers</h3>{lose.map(x=><Row x={x} key={x.symbol}/>)}</div></div></Section>
 <Section title="FII / DII Activity" sub={`Cash market · ${data.fiiDii.date}`}><div className="two"><div className="flow"><small>FII / FPI NET</small><strong className="down">₹{money(Math.abs(data.fiiDii.fii))} Cr</strong><span>Net selling</span></div><div className="flow"><small>DII NET</small><strong className="up">+₹{money(data.fiiDii.dii)} Cr</strong><span>Net buying</span></div></div></Section>
 <Section title="Global Markets & Commodities"><div className="commodityGrid">{m.global.concat(m.commodities).map(x=><div className="commodity" key={x.name}><small>{x.name}</small><strong>{x.unit||''}{money(x.value,x.name==='USD/INR'?2:2)}</strong><span className={x.pct>=0?'up':'down'}>{pct(x.pct)}</span></div>)}</div></Section>
 <Section title="IPO" sub="Live / upcoming IPO calendar"><div className="ipoGrid">{data.ipo.slice(0,5).map(x=><IPOCard x={x} key={x.slug} navigate={navigate}/>)}</div></Section>
 <Section title="Financial Tools" sub="Evergreen calculators for investors"><div className="tools">{['SIP Calculator','CAGR Calculator','Stock Average','Dividend Calculator','P/E Calculator','IPO Investment','IPO Profit','USD/INR Converter'].map(t=><div key={t} onClick={()=>navigate('/tools')}>{t}<span>→</span></div>)}</div></Section>
 </main>}
function Row({x}){return <div className="row"><div><b>{x.symbol}</b><small>{x.name}</small></div><strong>₹{money(x.price)}</strong><span className={x.pct>=0?'up':'down'}>{pct(x.pct)}</span></div>}
function IPOCard({x,navigate}){return <article className="ipoCard"><div className="ipoTop"><span>{x.type}</span><b>{x.subscription} sub.</b></div><h3>{x.name}</h3><p>{x.band} · Lot {x.lot}</p><div className="ipoMeta"><div><small>Issue</small><b>{x.issue}</b></div><div><small>Close</small><b>{x.close}</b></div><div><small>GMP*</small><b>{x.gmp}</b></div></div><button onClick={()=>navigate('/ipo/'+x.slug)}>View IPO →</button></article>}
function IPOPage({data,slug,navigate}){if(slug){const x=data.find(i=>i.slug===slug)||data[0];return <main><div className="pageTitle"><span>IPO</span><h1>{x.name}</h1><p>{x.type} · GMP is unofficial / market-reported.</p></div><div className="detailGrid">{[['Price band',x.band],['IPO dates',`${x.open} → ${x.close}`],['Lot size',x.lot],['Minimum investment',`₹${money(x.min,0)}`],['Issue size',x.issue],['Fresh issue',x.fresh],['OFS',x.ofs],['Subscription',x.subscription],['Allotment',x.allotment],['Listing',x.listing],['GMP*',x.gmp],['Sector',x.sector]].map(([a,b])=><div className="detail" key={a}><small>{a}</small><strong>{b}</strong></div>)}</div><div className="two"><div className="panel"><h2>Financials</h2><RowText a="Revenue" b={x.revenue||'See offer documents'}/><RowText a="Profit" b={x.profit||'See offer documents'}/><RowText a="Debt" b={x.debt||'See offer documents'}/></div><div className="panel"><h2>Important dates</h2><RowText a="Open" b={x.open}/><RowText a="Close" b={x.close}/><RowText a="Allotment" b={x.allotment}/><RowText a="Listing" b={x.listing}/></div></div><button className="back" onClick={()=>navigate('/ipo')}>← All IPOs</button></main>}
 return <main><div className="pageTitle"><span>IPO</span><h1>Indian IPOs</h1><p>Current, upcoming and recently opened public issues.</p></div><div className="ipoGrid">{data.map(x=><IPOCard x={x} key={x.slug} navigate={navigate}/>)}</div></main>}
function RowText({a,b}){return <div className="rowText"><span>{a}</span><b>{b}</b></div>}
function Calendar({data}){return <main><div className="pageTitle"><span>CALENDAR</span><h1>IPO Calendar</h1><p>Opening, closing, allotment and listing dates.</p></div><div className="tableWrap"><table><thead><tr><th>IPO</th><th>Open</th><th>Close</th><th>Allotment</th><th>Listing</th><th>Price</th><th>Lot</th></tr></thead><tbody>{data.map(x=><tr key={x.slug}><td><b>{x.name}</b><small>{x.type}</small></td><td>{x.open}</td><td>{x.close}</td><td>{x.allotment}</td><td>{x.listing}</td><td>{x.band}</td><td>{x.lot}</td></tr>)}</tbody></table></div></main>}
function GMP({data}){return <main><div className="pageTitle"><span>UNOFFICIAL</span><h1>IPO GMP</h1><p>Grey Market Premium is unofficial and can change rapidly. Do not treat it as a guaranteed listing price.</p></div><div className="tableWrap"><table><thead><tr><th>IPO</th><th>Price band</th><th>GMP</th><th>Subscription</th><th>Close</th></tr></thead><tbody>{data.map(x=><tr key={x.slug}><td><b>{x.name}</b></td><td>{x.band}</td><td className="up">{x.gmp}</td><td>{x.subscription}</td><td>{x.close}</td></tr>)}</tbody></table></div></main>}
function Allotment({data}){return <main><div className="pageTitle"><span>ALLOTMENT</span><h1>IPO Allotment Status</h1><p>Expected basis-of-allotment dates for current IPOs.</p></div><div className="ipoGrid">{data.map(x=><div className="panel" key={x.slug}><h2>{x.name}</h2><RowText a="Allotment" b={x.allotment}/><RowText a="Refund / unblock" b={x.listing==='01 Oct 2026'?'30 Sep 2026':'01 Oct 2026'}/><RowText a="Listing" b={x.listing}/></div>)}</div></main>}
function Tools(){const [n,setN]=useState(100000),[r,setR]=useState(12),[y,setY]=useState(10);const future=n*Math.pow(1+r/100,y);return <main><div className="pageTitle"><span>TOOLS</span><h1>Financial Tools</h1><p>Simple calculators for investors and market learners.</p></div><div className="calc"><h2>CAGR Calculator</h2><label>Initial investment<input type="number" value={n} onChange={e=>setN(+e.target.value)}/></label><label>Annual return %<input type="number" value={r} onChange={e=>setR(+e.target.value)}/></label><label>Years<input type="number" value={y} onChange={e=>setY(+e.target.value)}/></label><div className="result">Estimated value <b>₹{money(future,0)}</b></div></div><div className="toolCards">{['SIP Calculator','Stock Average Calculator','Dividend Calculator','P/E Calculator','EPS Calculator','ROE Calculator','ROCE Calculator','IPO Investment Calculator','IPO Profit Calculator','USD/INR Converter'].map(t=><div key={t}><h3>{t}</h3><p>Interactive calculator module.</p></div>)}</div></main>}
function Footer(){return <footer>BAZAAR BRIEF · Market data is informational and may be delayed. GMP is unofficial / market-reported. Always verify important figures against exchange filings and official IPO documents.</footer>}
function App(){const state=useData();const [path,setPath]=useState(location.pathname.replace(/\/$/,'')||'/');const nav=p=>{history.pushState({},'',p);setPath(p);window.scrollTo({top:0,behavior:'smooth'})};useEffect(()=>{const f=()=>setPath(location.pathname.replace(/\/$/,'')||'/');addEventListener('popstate',f);return()=>removeEventListener('popstate',f)},[]);let content=path==='/ipo'?<IPOPage data={state.data.ipo} navigate={nav}/>:path.startsWith('/ipo/')?<IPOPage data={state.data.ipo} slug={path.split('/')[2]} navigate={nav}/>:path==='/ipo-calendar'?<Calendar data={state.data.ipo}/>:path==='/gmp'?<GMP data={state.data.ipo}/>:path==='/ipo-allotment-status'?<Allotment data={state.data.ipo}/>:path==='/tools'?<Tools/>:<Home data={state.data} navigate={nav}/>;return <><Header state={state} onNav={nav}/>{state.msg&&<div className="notice">{state.msg}</div>}{content}<Footer/></>}

createRoot(document.getElementById('root')).render(<App/>);
