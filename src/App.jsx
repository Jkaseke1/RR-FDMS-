import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { LayoutDashboard, Receipt, Calendar, AlertCircle, Settings } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Receipts from './pages/Receipts'
import FiscalDays from './pages/FiscalDays'
import Errors from './pages/Errors'
import Admin from './pages/Admin'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">ZIMRA FDMS Dashboard</h1>
                <p className="text-sm text-gray-500">Rapid Roots Investment Pvt Ltd</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">TIN: 2002054676</p>
                  <p className="text-xs text-gray-500">VAT: 220401569</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex gap-6">
            {/* Sidebar */}
            <nav className="w-64 flex-shrink-0">
              <div className="bg-white rounded-lg shadow-sm p-4 space-y-1">
                <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
                <NavItem to="/receipts" icon={Receipt} label="Receipts" />
                <NavItem to="/fiscal-days" icon={Calendar} label="Fiscal Days" />
                <NavItem to="/errors" icon={AlertCircle} label="Errors" />
                <NavItem to="/admin" icon={Settings} label="Admin" />
              </div>
            </nav>
            {/* Main Content */}
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/receipts" element={<Receipts />} />
                <Route path="/fiscal-days" element={<FiscalDays />} />
                <Route path="/errors" element={<Errors />} />
                <Route path="/admin" element={<Admin />} />
              </Routes>
            </main>
          </div>
        </div>
      </div>
    </BrowserRouter>
  )
}

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${
          isActive
            ? 'bg-primary-50 text-primary-700 font-medium'
            : 'text-gray-700 hover:bg-gray-50'
        }`
      }
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </NavLink>
  )
}

export default App
