import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Download, RefreshCw, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'

export default function Receipts() {
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    loadReceipts()
  }, [statusFilter])

  async function loadReceipts() {
    setLoading(true)
    try {
      let query = supabase
        .from('fiscal_receipts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (statusFilter !== 'all') {
        query = query.eq('submission_status', statusFilter)
      }

      const { data, error } = await query

      if (error) throw error
      setReceipts(data || [])
    } catch (error) {
      console.error('Error loading receipts:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredReceipts = receipts.filter(receipt =>
    receipt.invoice_no.toLowerCase().includes(search.toLowerCase()) ||
    receipt.receipt_global_no.toString().includes(search)
  )

  async function retryReceipt(receiptId) {
    try {
      const { error } = await supabase
        .from('fiscal_receipts')
        .update({
          submission_status: 'pending',
          submission_attempts: 0,
          last_error: null
        })
        .eq('id', receiptId)

      if (error) throw error
      
      alert('Receipt marked for retry. The queue processor will attempt submission.')
      loadReceipts()
    } catch (error) {
      console.error('Error retrying receipt:', error)
      alert('Failed to retry receipt')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Receipts</h2>
          <p className="text-gray-500">View and manage submitted receipts</p>
        </div>
        <button
          onClick={loadReceipts}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by invoice number or global number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No receipts found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice No
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Global No
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReceipts.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {receipt.invoice_no}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {receipt.receipt_global_no}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {receipt.receipt_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {receipt.receipt_currency} {receipt.receipt_total.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={receipt.submission_status} color={receipt.validation_color} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(receipt.created_at), 'MMM dd, HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      {receipt.qr_code && (
                        <a
                          href={receipt.qr_code}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-900"
                          title="View QR Code"
                        >
                          <ExternalLink className="w-4 h-4 inline" />
                        </a>
                      )}
                      {receipt.submission_status === 'failed' && (
                        <button
                          onClick={() => retryReceipt(receipt.id)}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="Retry submission"
                        >
                          <RefreshCw className="w-4 h-4 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-sm text-gray-500 text-center">
        Showing {filteredReceipts.length} of {receipts.length} receipts
      </div>
    </div>
  )
}

function StatusBadge({ status, color }) {
  const statusStyles = {
    submitted: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
    skipped: 'bg-gray-100 text-gray-800'
  }

  const colorStyles = {
    Green: 'border-green-500',
    Yellow: 'border-yellow-500',
    Red: 'border-red-500',
    Grey: 'border-gray-500'
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border-2 ${statusStyles[status]} ${color ? colorStyles[color] : ''}`}>
      {status}
      {color && color !== 'Green' && ` (${color})`}
    </span>
  )
}
