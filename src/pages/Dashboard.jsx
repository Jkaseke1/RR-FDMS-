import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Receipt, Calendar, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'

export default function Dashboard() {
  const [stats, setStats] = useState({
    receiptsToday: 0,
    receiptsPending: 0,
    receiptsFailed: 0,
    fiscalDayStatus: 'Unknown',
    fiscalDayNo: null,
    certExpiryDays: null,
    lastReceipt: null
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
    
    // Refresh every 30 seconds
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadStats() {
    try {
      const deviceId = import.meta.env.VITE_DEVICE_ID

      // Get today's receipts
      const today = new Date().toISOString().split('T')[0]
      const { data: receiptsToday } = await supabase
        .from('fiscal_receipts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', today)

      // Get pending receipts
      const { data: receiptsPending } = await supabase
        .from('fiscal_receipts')
        .select('id', { count: 'exact', head: true })
        .eq('submission_status', 'pending')

      // Get failed receipts
      const { data: receiptsFailed } = await supabase
        .from('fiscal_receipts')
        .select('id', { count: 'exact', head: true })
        .eq('submission_status', 'failed')

      // Get current fiscal day
      const { data: fiscalDay } = await supabase
        .from('fiscal_days')
        .select('*')
        .order('fiscal_day_no', { ascending: false })
        .limit(1)
        .single()

      // Get device info
      const { data: device } = await supabase
        .from('fiscal_devices')
        .select('certificate_valid_till')
        .limit(1)
        .single()

      // Get last receipt
      const { data: lastReceipt } = await supabase
        .from('fiscal_receipts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      // Calculate cert expiry
      let certExpiryDays = null
      if (device?.certificate_valid_till) {
        const validTill = new Date(device.certificate_valid_till)
        const now = new Date()
        certExpiryDays = Math.floor((validTill - now) / (1000 * 60 * 60 * 24))
      }

      setStats({
        receiptsToday: receiptsToday?.length || 0,
        receiptsPending: receiptsPending?.length || 0,
        receiptsFailed: receiptsFailed?.length || 0,
        fiscalDayStatus: fiscalDay?.status || 'No fiscal day',
        fiscalDayNo: fiscalDay?.fiscal_day_no,
        certExpiryDays,
        lastReceipt
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500">Real-time overview of FDMS operations</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Receipts Today"
          value={stats.receiptsToday}
          icon={Receipt}
          color="blue"
        />
        <StatCard
          title="Pending Queue"
          value={stats.receiptsPending}
          icon={Clock}
          color="yellow"
        />
        <StatCard
          title="Failed Receipts"
          value={stats.receiptsFailed}
          icon={AlertTriangle}
          color={stats.receiptsFailed > 0 ? 'red' : 'green'}
        />
        <StatCard
          title="Fiscal Day"
          value={stats.fiscalDayNo ? `Day ${stats.fiscalDayNo}` : 'Closed'}
          subtitle={stats.fiscalDayStatus}
          icon={Calendar}
          color={stats.fiscalDayStatus === 'FiscalDayOpened' ? 'green' : 'gray'}
        />
      </div>

      {/* Alerts */}
      <div className="space-y-4">
        {stats.certExpiryDays !== null && stats.certExpiryDays <= 30 && (
          <Alert
            type={stats.certExpiryDays <= 7 ? 'error' : 'warning'}
            title="Certificate Expiring Soon"
            message={`Device certificate expires in ${stats.certExpiryDays} days`}
          />
        )}

        {stats.receiptsFailed > 0 && (
          <Alert
            type="error"
            title="Failed Receipts"
            message={`${stats.receiptsFailed} receipt(s) failed submission. Manual intervention required.`}
          />
        )}

        {stats.fiscalDayStatus === 'FiscalDayCloseFailed' && (
          <Alert
            type="error"
            title="Fiscal Day Close Failed"
            message="The fiscal day failed to close. Check error logs for details."
          />
        )}
      </div>

      {/* Last Receipt */}
      {stats.lastReceipt && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Last Receipt</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Invoice No</p>
              <p className="font-medium">{stats.lastReceipt.invoice_no}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Amount</p>
              <p className="font-medium">{stats.lastReceipt.receipt_currency} {stats.lastReceipt.receipt_total}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <StatusBadge status={stats.lastReceipt.submission_status} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Time</p>
              <p className="font-medium">{format(new Date(stats.lastReceipt.created_at), 'HH:mm:ss')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ title, value, subtitle, icon: Icon, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-50 text-gray-600'
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}

function Alert({ type, title, message }) {
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  }

  return (
    <div className={`border-l-4 p-4 rounded ${styles[type]}`}>
      <div className="flex items-start">
        <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
        <div>
          <h4 className="font-semibold">{title}</h4>
          <p className="text-sm mt-1">{message}</p>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    submitted: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
    skipped: 'bg-gray-100 text-gray-800'
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  )
}
