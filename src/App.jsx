import { Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

import IpoHub from "./pages/ipo/IpoHub";
import IpoDetail from "./pages/ipo/IpoDetail";
import UpcomingIpo from "./pages/ipo/UpcomingIpo";
import TodayIpo from "./pages/ipo/TodayIpo";
import IpoCalendar from "./pages/ipo/IpoCalendar";
import IpoGmp from "./pages/ipo/IpoGmp";
import IpoAllotmentStatus from "./pages/ipo/IpoAllotmentStatus";

import ToolsHub from "./pages/tools/ToolsHub";
import ToolRouter from "./pages/tools/ToolRouter";

import "./App.css";

export default function App() {
  return (
    <div className="app">
      <NavBar />
      <div className="app__body">
        <Routes>
          <Route path="/" element={<Home />} />

          <Route path="/ipo" element={<IpoHub />} />
          <Route path="/ipo/upcoming-ipo" element={<UpcomingIpo />} />
          <Route path="/ipo/today-ipo" element={<TodayIpo />} />
          <Route path="/ipo/ipo-calendar" element={<IpoCalendar />} />
          <Route path="/ipo/gmp" element={<IpoGmp />} />
          <Route path="/ipo/ipo-allotment-status" element={<IpoAllotmentStatus />} />
          <Route path="/ipo/:slug" element={<IpoDetail />} />

          <Route path="/tools" element={<ToolsHub />} />
          <Route path="/tools/:slug" element={<ToolRouter />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </div>
  );
}
