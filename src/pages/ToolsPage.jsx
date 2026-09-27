import { useMemo, useState } from 'react';
import './Pages.css';

const tools = [
  { id:'sip', name:'SIP Calculator', fields:[['investment','Monthly investment','10000'],['rate','Expected annual return %','12'],['years','Years','10']] },
  { id:'cagr', name:'CAGR Calculator', fields:[['start','Starting value','100000'],['end','Ending value','250000'],['years','Years','5']] },
  { id:'average', name:'Stock Average Calculator', fields:[['qty1','First quantity','10'],['price1','First buy price','100'],['qty2','Second quantity','10'],['price2','Second buy price','80']] },
  { id:'dividend', name:'Dividend Calculator', fields:[['shares','Shares','100'],['dividend','Dividend per share','5']] },
  { id:'pe', name:'P/E Calculator', fields:[['price','Share price','500'],['eps','EPS','25']] },
  { id:'eps', name:'EPS Calculator', fields:[['profit','Net profit','1000000'],['shares','Shares outstanding','100000']] },
  { id:'roe', name:'ROE Calculator', fields:[['profit','Net profit','1000000'],['equity','Shareholders equity','5000000']] },
  { id:'roce', name:'ROCE Calculator', fields:[['ebit','EBIT','1000000'],['capital','Capital employed','5000000']] },
  { id:'marketcap', name:'Market Cap Calculator', fields:[['price','Share price','500'],['shares','Shares outstanding','1000000']] },
  { id:'growth', name:'Profit Growth Calculator', fields:[['oldProfit','Previous profit','1000000'],['newProfit','Current profit','1250000']] },
  { id:'ipo', name:'IPO Investment Calculator', fields:[['price','IPO price','100'],['lots','Lots','1'],['lotSize','Shares per lot','150']] },
  { id:'ipoProfit', name:'IPO Profit Calculator', fields:[['buy','Issue price','100'],['sell','Expected sale price','130'],['lotSize','Shares per lot','150'],['lots','Lots','1']] },
  { id:'gmp', name:'IPO GMP Calculator', fields:[['issue','Issue price','100'],['gmp','GMP','25']] },
  { id:'usd',name:'USD / INR Converter', fields:[['usd','USD amount','100'],['rate','USD/INR rate','88']] },
];
export default function ToolsPage(){
 const [selected,setSelected]=useState('sip'); const [values,setValues]=useState(Object.fromEntries(tools[0].fields.map(([k,,v])=>[k,v])));
 const tool=tools.find(x=>x.id===selected);
 const result=useMemo(()=>calculate(selected,values),[selected,values]);
 const choose=(id)=>{const t=tools.find(x=>x.id===id);setSelected(id);setValues(Object.fromEntries(t.fields.map(([k,,v])=>[k,v])))};
 return <div className="page"><div className="page__hero"><span>BAZAAR BRIEF · TOOLS</span><h1>Financial tools built for everyday market questions.</h1><p>Fast calculators for SIPs, valuation ratios, IPO sizing and portfolio math. Results are estimates, not investment advice.</p></div><div className="tool-layout"><aside>{tools.map(t=><button className={t.id===selected?'active':''} onClick={()=>choose(t.id)} key={t.id}>{t.name}</button>)}</aside><main className="tool-card"><h2>{tool.name}</h2>{tool.fields.map(([key,label,defaultValue])=><label key={key}>{label}<input type="number" value={values[key]??defaultValue} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))}/></label>)}<div className="tool-result"><span>Estimated result</span><strong className="num">{result}</strong></div></main></div></div>
}
function n(v){return Number(v)||0}
function calculate(id,v){switch(id){case'sip':{const m=n(v.investment),r=n(v.rate)/1200,y=n(v.years)*12;const fv=r?m*((Math.pow(1+r,y)-1)/r)*(1+r):m*y;return `₹${Math.round(fv).toLocaleString('en-IN')}`;}case'cagr':return n(v.start)>0&&n(v.years)>0?`${((Math.pow(n(v.end)/n(v.start),1/n(v.years))-1)*100).toFixed(2)}%`: '—';case'average':{const q=n(v.qty1)+n(v.qty2);return q?`₹${((n(v.qty1)*n(v.price1)+n(v.qty2)*n(v.price2))/q).toFixed(2)}`:'—';}case'dividend':return `₹${(n(v.shares)*n(v.dividend)).toLocaleString('en-IN')}`;case'pe':return n(v.eps)?`${(n(v.price)/n(v.eps)).toFixed(2)}×`:'—';case'eps':return n(v.shares)?`₹${(n(v.profit)/n(v.shares)).toFixed(2)}`:'—';case'roe':return n(v.equity)?`${(n(v.profit)/n(v.equity)*100).toFixed(2)}%`:'—';case'roce':return n(v.capital)?`${(n(v.ebit)/n(v.capital)*100).toFixed(2)}%`:'—';case'marketcap':return `₹${(n(v.price)*n(v.shares)).toLocaleString('en-IN')}`;case'growth':return n(v.oldProfit)?`${((n(v.newProfit)-n(v.oldProfit))/n(v.oldProfit)*100).toFixed(2)}%`:'—';case'ipo':return `₹${(n(v.price)*n(v.lots)*n(v.lotSize)).toLocaleString('en-IN')}`;case'ipoProfit':return `₹${((n(v.sell)-n(v.buy))*n(v.lotSize)*n(v.lots)).toLocaleString('en-IN')}`;case'gmp':return n(v.issue)?`₹${(n(v.issue)+n(v.gmp)).toFixed(2)} implied price`:'—';case'usd':return `₹${(n(v.usd)*n(v.rate)).toLocaleString('en-IN',{maximumFractionDigits:2})}`;default:return'—'}}
