import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, BarChart3, AlertTriangle, Settings, RefreshCw, Activity
} from 'lucide-react';
import Overview from './pages/Overview';
import Receipts from './pages/Receipts';
import ZReports from './pages/ZReports';
import Errors from './pages/Errors';
import Device from './pages/Device';
import Logs from './pages/Logs';
import { COMPANY } from './config/company';

function Sidebar() {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Overview' },
    { path: '/receipts', icon: FileText, label: 'Receipts' },
    { path: '/z-reports', icon: BarChart3, label: 'Z Reports' },
    { path: '/errors', icon: AlertTriangle, label: 'Errors' },
    { path: '/logs', icon: Activity, label: 'Live Activity' },
    { path: '/device', icon: Settings, label: 'Device' },
  ];

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-gray-100">
        <h1 className="text-sm font-bold text-gray-900">ZIMRA FDMS Bridge</h1>
        <p className="text-xs text-blue-600 font-medium mt-0.5">{COMPANY.shortName}</p>
      </div>
      <nav className="flex-1 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex items-center gap-3 px-5 py-2.5 text-sm transition-colors
                ${isActive
                  ? 'text-blue-600 bg-blue-50/50 border-l-[3px] border-blue-600 font-medium'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-l-[3px] border-transparent'
                }
              `}
            >
              <Icon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2.5 : 2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function Header() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-bold text-gray-800">ZIMRA FDMS Bridge</h2>
        <span className="text-gray-300">·</span>
        <span className="text-sm text-blue-600 font-medium">{COMPANY.shortName}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium border ${COMPANY.environment === 'PRODUCTION' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
          {COMPANY.environment} ENVIRONMENT
        </span>
        <span className="text-xs text-gray-400">Updated {timeStr}</span>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-[#f5f3ef]">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 p-6 overflow-auto">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/receipts" element={<Receipts />} />
              <Route path="/z-reports" element={<ZReports />} />
              <Route path="/errors" element={<Errors />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/device" element={<Device />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
