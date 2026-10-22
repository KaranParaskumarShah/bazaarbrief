import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ArrowUpRight, SlidersHorizontal, CalendarDays, Building2, Layers3, RefreshCw, ExternalLink } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { getIpos, getIpoRefreshStatus } from '../services/api';
import SectionTitle from '../components/SectionTitle';
import type { Ipo } from '../types';

const money = (value?: number) => value == null || !Number.isFinite(value) ? 'TBD' : `₹${new Intl.NumberFormat('en-IN',{maximumFractionDigits:0}).format(value)}`;
const date = (value?: string) => { if (!value) return 'TBD'; const d = new Date(`${value.slice(0,10)}T00:00:00+05:30`); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',timeZone:'Asia/Kolkata'}); };
const issueCap = (ipo: Ipo) => { const nums = ipo.priceBand?.replace(/,/g,'').match(/[0-9]+(?:\.[0-9]+)?/g)?.map(Number) || []; return nums.length ? nums[nums.length-1] : undefined; };
type QuickFilter = 'All'|'Mainboard Only'|'SME Only'|'Open Now'|'High GMP (>30%)';
export default function Ipo(){
 const {data,isLoading,error,refetch}=useQuery({queryKey:['ipos'],queryFn:getIpos});
 const {data:refreshStatus}=useQuery({queryKey:['ipo-refresh-status'],queryFn:getIpoRefreshStatus,staleTime:60_000,retry:1});
 const location=useLocation(); const isGmpPage=location.pathname==='/ipo/gmp';
 const [params,setParams]=useSearchParams(); const [q,setQ]=useState(params.get('q')||''); const [market,setMarket]=useState('All'); const [quick,setQuick]=useState<QuickFilter>('All'); const [sort,setSort]=useState('openDate');
 const all=data?.data||[];
 const rows=useMemo(()=>all.filter((x:Ipo)=>{
  if(isGmpPage && x.gmp==null) return false;
  if (params.get('status') && params.get('status')!=='All' && x.status!==params.get('status')) return false;
  if (market!=='All'&&x.market!==market) return false;
  if (quick==='Mainboard Only'&&x.market!=='Mainboard') return false;
  if (quick==='SME Only'&&x.market!=='SME') return false;
  if (quick==='Open Now'&&x.status!=='Open') return false;
  if (quick==='High GMP (>30%)'&&(x.gmpPct==null||x.gmpPct<=30)) return false;
  return `${x.name} ${x.symbol} ${x.exchange||''}`.toLowerCase().includes(q.toLowerCase());
 }).sort((a,b)=>{ if((isGmpPage && sort==='openDate') || sort==='gmp') return (b.gmpPct??-Infinity)-(a.gmpPct??-Infinity); if(sort==='issueSize') return (Number(b.issueSize?.replace(/[^0-9.]/g,''))||0)-(Number(a.issueSize?.replace(/[^0-9.]/g,''))||0); return (a.openDate||'9999').localeCompare(b.openDate||'9999'); }),[all,params,market,quick,q,sort,isGmpPage]);
 const counts={open:all.filter(x=>x.status==='Open').length,upcoming:all.filter(x=>x.status==='Upcoming').length,closed:all.filter(x=>x.status==='Closed').length,listed:all.filter(x=>x.status==='Listed').length,gmp:all.filter(x=>x.gmp!==undefined).length};
 const quickFilters:QuickFilter[]=['All','Mainboard Only','SME Only','Open Now','High GMP (>30%)'];
 return <div className="page-stack ipo-market-page">
  <section className="ipo-page-heading"><div><span className="eyebrow"><Layers3 size={13}/> BAZAARBRIEF / IPO INTELLIGENCE</span><h1>{isGmpPage?'Grey market premium tracker':'IPO market monitor'}<span className="title-dot">.</span></h1><p>{isGmpPage?'Compare reported unofficial GMP values and implied premium across available IPOs.':'A single view of public issues, pricing, demand and reported grey-market signals.'}</p></div><div className="ipo-feed-health"><span className="pulse-dot"/><div><b>{refreshStatus?.persistentCacheEnabled===false?'Storage needs setup':'Shared market snapshot'}</b><small>{refreshStatus?.lastSuccessfulRefreshAt?`Updated ${new Date(refreshStatus.lastSuccessfulRefreshAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST`:'Refresh timestamp unavailable'}</small></div><button className="icon-btn" onClick={()=>void refetch()} aria-label="Refresh IPO snapshot"><RefreshCw size={15}/></button></div></section>
  <section className="ipo-kpi-strip">
   {[['OPEN NOW',counts.open,'Open'],['UPCOMING',counts.upcoming,'Upcoming'],['CLOSED',counts.closed,'Closed'],['LISTED',counts.listed,'Listed'],['WITH GMP',counts.gmp,'All']].map(([label,value,status])=><button className={`ipo-kpi ${params.get('status')===status?'is-active':''}`} key={String(label)} onClick={()=>setParams(status==='All'?{}:{status:String(status)})}><span>{label}</span><b>{value}</b><small>{label==='WITH GMP'?'reported values only':'issues in snapshot'}</small></button>)}
  </section>
  <section className="panel ipo-grid-panel"><div className="ipo-grid-title"><SectionTitle eyebrow={isGmpPage?'GREY MARKET SIGNALS':'PRIMARY MARKET'} title={isGmpPage?'Reported GMP monitor':'Public issue pipeline'} description={isGmpPage?'Only issues with a reported GMP are shown; values are unofficial and may be delayed.':'Select an issue to inspect available dates, pricing, subscription, GMP and official documents.'}/><span className="ipo-record-count">{rows.length} / {all.length} issues</span></div>
   <div className="ipo-filter-toolbar"><label className="searchbox filter-search"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search company, ticker or exchange" aria-label="Search IPOs"/></label><label className="select-wrap"><Building2 size={15}/><select value={market} onChange={e=>setMarket(e.target.value)} aria-label="Filter market"><option value="All">All boards</option><option value="Mainboard">Mainboard</option><option value="SME">SME</option></select></label><label className="select-wrap"><SlidersHorizontal size={15}/><select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort IPOs"><option value="openDate">Sort: opening date</option><option value="gmp">Sort: GMP %</option><option value="issueSize">Sort: issue size</option></select></label></div>
   <div className="ipo-filter-chips">{quickFilters.map(f=><button key={f} onClick={()=>setQuick(f)} className={`ipo-filter-chip ${quick===f?'active':''}`}>{f==='Open Now'&&<span className="pulse-dot"/>}{f}</button>)}</div>
   {isLoading?<div className="ipo-loading-grid">{Array.from({length:5},(_,i)=><div key={i} className="ipo-skeleton-row"/>)}</div>:error?<div className="ipo-empty-state"><b>{isGmpPage?'GMP feed unavailable':'IPO feed unavailable'}</b><p>The shared Worker snapshot could not be loaded. Existing cached records are not replaced with sample data.</p><button className="primary-button" onClick={()=>void refetch()}>Retry feed</button></div>:<div className="ipo-table-wrap"><table className="ipo-terminal-table"><thead><tr><th>COMPANY / ISSUE</th><th>STATUS</th><th>ISSUE WINDOW</th><th>PRICE BAND</th><th>LOT / MIN. CAPITAL</th><th>ISSUE SIZE</th><th>SUBSCRIPTION</th><th>GMP / EST. PREMIUM</th><th>DETAILS</th></tr></thead><tbody>{rows.map(ipo=><tr key={ipo.id}>
    <td><Link className="ipo-company-link" to={`/ipo/${ipo.id}`}><span className="ipo-monogram">{ipo.name.slice(0,1).toUpperCase()}</span><span className="ipo-company-meta"><b>{ipo.name}</b><small>{ipo.market} <i>·</i> {ipo.symbol}</small></span></Link></td>
    <td><span className={`ipo-status-pill ${ipo.status.toLowerCase()}`}><i/>{ipo.status==='Open'?'OPEN NOW':ipo.status.toUpperCase()}</span></td>
    <td><span className="ipo-date-range"><b>{date(ipo.openDate)}</b><small>to {date(ipo.closeDate)}</small></span></td>
    <td><b className="numeric-cell">{ipo.priceBand||'Awaiting filing'}</b><small className="ipo-subtext">Cap {issueCap(ipo)?money(issueCap(ipo)): 'not supplied'}</small></td>
    <td><b className="numeric-cell">{ipo.lotSize>0?ipo.lotSize.toLocaleString('en-IN'):'Awaiting filing'}</b><small className="ipo-subtext">{money(ipo.minInvestment)}</small></td>
    <td><b className="numeric-cell">{ipo.issueSize||'Awaiting filing'}</b><small className="ipo-subtext">{ipo.issueType||ipo.market}</small></td>
    <td>{ipo.subscription==null?<span className="muted-value">Not reported</span>:<div className="subscription-meter"><b>{ipo.subscription.toLocaleString('en-IN',{maximumFractionDigits:2})}×</b><span><i style={{width:`${Math.max(3,Math.min(100,ipo.subscription/10*100))}%`}}/></span></div>}</td>
    <td>{ipo.gmp==null?<span className="muted-value">Unavailable</span>:<><b className={`numeric-cell ${ipo.gmp>=0?'positive':'negative'}`}>{ipo.gmp>=0?'+':''}{money(ipo.gmp)}</b><span className={`ipo-gmp-chip ${(ipo.gmpPct??0)>=0?'up':'down'}`}>{ipo.gmpPct==null?'Percent n/a':`${ipo.gmpPct>=0?'+':''}${ipo.gmpPct.toLocaleString('en-IN',{maximumFractionDigits:1})}%`}</span><small className="ipo-subtext">Unofficial · {ipo.gmpSource||'source not supplied'}</small></>}</td>
    <td><div className="ipo-row-actions"><Link to={`/ipo/${ipo.id}`} className="ipo-open-detail" aria-label={`Open ${ipo.name} details`}><ArrowUpRight size={16}/></Link>{ipo.offerDocumentUrl&&<a className="ipo-open-detail" href={ipo.offerDocumentUrl} target="_blank" rel="noopener noreferrer nofollow" aria-label={`Offer document for ${ipo.name}`}><ExternalLink size={14}/></a>}</div></td>
   </tr>)}</tbody></table>{!rows.length&&<div className="ipo-empty-state"><b>{isGmpPage?'No reported GMP records':'No matching IPOs'}</b><p>{isGmpPage?'The current provider has not supplied GMP values for the available issues.':'Try another status, board or search term.'}</p><button className="secondary-button" onClick={()=>{setQ('');setMarket('All');setQuick('All');setParams({})}}>Clear filters</button></div>}</div>}
   <footer className="ipo-grid-footer"><span><CalendarDays size={13}/> Refresh cadence: 15 minutes; provider updates may be delayed.</span><span>{data?.data[0]?.providerDisclaimer||'GMP is unofficial and may be inaccurate. Verify all figures with official documents.'}</span></footer>
  </section>
  <div className="callout"><b>Before applying</b><span>Verify the RHP/DRHP, price band, lot size, dates, financial statements and registrar details with the issuer and exchange. BazaarBrief is informational, not investment advice.</span><a href="https://www.sebi.gov.in/" target="_blank" rel="noopener noreferrer nofollow">SEBI filings <ExternalLink size={13}/></a></div>
 </div>;
}
