import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Calendar, PlayCircle, StopCircle, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

export default function FiscalDays() {
  const [fiscalDays, setFiscalDays] = useState([])
  const [currentDay, setCurrentDay] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFiscalDays()
  }, [])

  async function loadFiscalDays() {
    setLoading(true)
    try {
      // Get all fiscal days
      const { data: days, error } = await supabase
        .from('fiscal_days')
        .select('*')
        .order('fiscal_day_no', { ascending: false })
        .limit(20)

      if (error) throw error

      setFiscalDays(days || [])
      setCurrentDay(days?.find(d => d.status === 'FiscalDayOpened') || null)
    } catch (error) {
      console.error('Error loading fiscal days:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Fiscal Days</h2>
          <p className="text-gray-500">Manage fiscal day lifecycle</p>
        </div>
        <button
          onClick={loadFiscalDays}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Current Fiscal Day */}
      {currentDay ? (
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Current Fiscal Day</h3>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Fiscal Day No</p>
                  <p className="text-2xl font-bold text-gray-900">{currentDay.fiscal_day_no}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <StatusBadge status={currentDay.status} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Opened At</p>
                  <p className="font-medium">{format(new Date(currentDay.opened_at), 'MMM dd, HH:mm')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Receipt Counter</p>
                  <p className="font-medium">{currentDay.receipt_counter || 0}</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => alert('Close day functionality - call closeDay API')}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <StopCircle className="w-4 h-4" />
              <span>Close Day</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-gray-300">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">No Fiscal Day Open</h3>
              <p className="text-gray-500 mt-2">Open a new fiscal day to start processing receipts</p>
            </div>
            <button
              onClick={() => alert('Open day functionality - call openDay API')}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Open Day</span>
            </button>
          </div>
        </div>
      )}

      {/* Fiscal Day History */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Fiscal Day History</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Day No
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Opened
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Closed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Receipts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Receipt No
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {fiscalDays.map((day) => (
                  <tr key={day.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {day.fiscal_day_no}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={day.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {day.opened_at ? format(new Date(day.opened_at), 'MMM dd, HH:mm') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {day.closed_at ? format(new Date(day.closed_at), 'MMM dd, HH:mm') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {day.receipt_counter || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {day.last_receipt_global_no || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    FiscalDayOpened: 'bg-green-100 text-green-800',
    FiscalDayClosed: 'bg-gray-100 text-gray-800',
    FiscalDayCloseInitiated: 'bg-yellow-100 text-yellow-800',
    FiscalDayCloseFailed: 'bg-red-100 text-red-800'
  }

  const labels = {
    FiscalDayOpened: 'Open',
    FiscalDayClosed: 'Closed',
    FiscalDayCloseInitiated: 'Closing...',
    FiscalDayCloseFailed: 'Close Failed'
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status] || status}
    </span>
  )
}
