import { useMarketData } from './hooks/useMarketData';
import Masthead from './components/Masthead';
import TickerStrip from './components/TickerStrip';
import MarketIndexStrip from './components/MarketIndexStrip';
import MarketSnapshot from './components/MarketSnapshot';
import GainersLosers from './components/GainersLosers';
import SectorPerformance from './components/SectorPerformance';
import InstitutionalActivity from './components/InstitutionalActivity';
import CommoditiesBoard from './components/CommoditiesBoard';
import IPOSection from './components/IPOSection';
import NewsSection from './components/NewsSection';
import ToolLinks from './components/ToolLinks';
import IPOPage from './pages/IPOPage';
import IPOCalendarPage from './pages/IPOCalendarPage';
import GmpPage from './pages/GmpPage';
import AllotmentPage from './pages/AllotmentPage';
import ToolsPage from './pages/ToolsPage';
import './App.css';

export default function App(){
 const state=useMarketData(); const data=state.data; const path=window.location.pathname.replace(/\/$/,'')||'/';
 const seoTitle = path.startsWith('/ipo/') ? `IPO Details — ${path.split('/')[2]?.replace(/-/g,' ') || 'Indian IPO'}` : path==='/ipo' ? 'Indian IPOs — Bazaar Brief' : path==='/ipo-calendar' ? 'IPO Calendar — Bazaar Brief' : path==='/gmp' ? 'IPO GMP — Bazaar Brief' : path==='/ipo-allotment-status' ? 'IPO Allotment Status — Bazaar Brief' : path==='/tools' ? 'Financial Tools — Bazaar Brief' : 'Bazaar Brief — Indian Markets, IPOs & Financial Tools';
 document.title = seoTitle;
 if(path==='/tools') return <><Masthead updatedAt={state.lastUpdated} cacheAge={state.cacheAge} loading={state.loading} onRefresh={state.refresh}/><ToolsPage/><Footer/></>;
 if(path==='/ipo-calendar') return <><Masthead updatedAt={state.lastUpdated} cacheAge={state.cacheAge} loading={state.loading} onRefresh={state.refresh}/><IPOCalendarPage data={data?.ipo}/><Footer/></>;
 if(path==='/gmp') return <><Masthead updatedAt={state.lastUpdated} cacheAge={state.cacheAge} loading={state.loading} onRefresh={state.refresh}/><GmpPage data={data?.ipo}/><Footer/></>;
 if(path==='/ipo-allotment-status') return <><Masthead updatedAt={state.lastUpdated} cacheAge={state.cacheAge} loading={state.loading} onRefresh={state.refresh}/><AllotmentPage data={data?.ipo}/><Footer/></>;
 if(path==='/ipo' || path.startsWith('/ipo/')) return <><Masthead updatedAt={state.lastUpdated} cacheAge={state.cacheAge} loading={state.loading} onRefresh={state.refresh}/><IPOPage data={data?.ipo} detailSlug={path.split('/')[2]}/><Footer/></>;
 const market=data?.market||{};
 const ticker=[['USD/INR',market.fx?.price?`₹${market.fx.price.toFixed(2)}`:'—'],['Gold',market.gold?.price?`$${market.gold.price.toFixed(1)}`:'—'],['Brent',market.brent?.price?`$${market.brent.price.toFixed(2)}`:'—'],['IPO','Calendar + GMP']];
 return <div className="app"><TickerStrip items={ticker.map(([label,value])=>({label,value}))}/><Masthead updatedAt={state.lastUpdated} cacheAge={state.cacheAge} loading={state.loading} onRefresh={state.refresh}/><main className="app__main">
   {state.error && <div className="error-banner">Live data request failed: {state.error}. The browser will retry automatically on the 2-hour refresh cycle.</div>}
   <MarketIndexStrip market={market}/><MarketSnapshot data={market}/><GainersLosers rows={market.quotes?.rows || []}/><SectorPerformance rows={market.quotes?.rows || []}/><IPOSection data={data?.ipo}/><InstitutionalActivity data={data?.fiiDii}/><CommoditiesBoard data={market}/><NewsSection data={data?.news}/><ToolLinks/>
 </main><Footer/></div>
}
function Footer(){return <footer className="app__footer"><p>bazaarbrief.in · Market data is informational and may be delayed. GMP is unofficial/market-reported. Verify important figures with exchange filings and official IPO documents. Not investment advice.</p></footer>}
