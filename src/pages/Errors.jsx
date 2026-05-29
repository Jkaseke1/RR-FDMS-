import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { AlertTriangle, CheckCircle, RefreshCw, Filter } from 'lucide-react'
import { format } from 'date-fns'

export default function Errors() {
  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('unresolved')

  useEffect(() => {
    loadErrors()
  }, [filter])

  async function loadErrors() {
    setLoading(true)
    try {
      let query = supabase
        .from('fdms_error_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (filter === 'unresolved') {
        query = query.eq('resolved', false)
      } else if (filter === 'resolved') {
        query = query.eq('resolved', true)
      }

      const { data, error } = await query

      if (error) throw error
      setErrors(data || [])
    } catch (error) {
      console.error('Error loading errors:', error)
    } finally {
      setLoading(false)
    }
  }

  async function markResolved(errorId) {
    try {
      const { error } = await supabase
        .from('fdms_error_log')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString()
        })
        .eq('id', errorId)

      if (error) throw error
      
      loadErrors()
    } catch (error) {
      console.error('Error marking as resolved:', error)
      alert('Failed to mark error as resolved')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Error Log</h2>
          <p className="text-gray-500">Monitor and resolve system errors</p>
        </div>
        <button
          onClick={loadErrors}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center space-x-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Errors</option>
            <option value="unresolved">Unresolved Only</option>
            <option value="resolved">Resolved Only</option>
          </select>
        </div>
      </div>

      {/* Errors List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : errors.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-500">No errors found</p>
          </div>
        ) : (
          errors.map((error) => (
            <div
              key={error.id}
              className={`bg-white rounded-lg shadow-sm p-6 border-l-4 ${
                error.resolved ? 'border-green-500' : 'border-red-500'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className={`w-5 h-5 ${error.resolved ? 'text-green-500' : 'text-red-500'}`} />
                    <h3 className="text-lg font-semibold text-gray-900">
                      {error.error_code || 'Unknown Error'}
                    </h3>
                    {error.resolved && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Resolved
                      </span>
                    )}
                  </div>
                  
                  <p className="mt-2 text-gray-700">{error.error_message}</p>
                  
                  {error.error_detail && (
                    <p className="mt-1 text-sm text-gray-500">{error.error_detail}</p>
                  )}

                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Operation</p>
                      <p className="font-medium">{error.operation_type || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Operation ID</p>
                      <p className="font-medium">{error.operation_id || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">HTTP Status</p>
                      <p className="font-medium">{error.http_status || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Occurred</p>
                      <p className="font-medium">{format(new Date(error.created_at), 'MMM dd, HH:mm')}</p>
                    </div>
                  </div>

                  {error.extra_data && (
                    <details className="mt-4">
                      <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                        View Details
                      </summary>
                      <pre className="mt-2 p-4 bg-gray-50 rounded text-xs overflow-x-auto">
                        {JSON.stringify(error.extra_data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>

                {!error.resolved && (
                  <button
                    onClick={() => markResolved(error.id)}
                    className="ml-4 flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Mark Resolved</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="text-sm text-gray-500 text-center">
        Showing {errors.length} error(s)
      </div>
    </div>
  )
}
