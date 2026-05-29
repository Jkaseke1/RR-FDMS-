import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Play, Square, RefreshCw, Settings, Key, Calendar, FileText, Database } from 'lucide-react'

export default function Admin() {
  const [device, setDevice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    loadDeviceInfo()
  }, [])

  async function loadDeviceInfo() {
    try {
      const { data } = await supabase
        .from('fiscal_devices')
        .select('*')
        .limit(1)
        .single()

      setDevice(data)
    } catch (error) {
      console.error('Error loading device:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(action, params = {}) {
    setActionLoading(true)
    try {
      const response = await fetch(`http://localhost:3001/api/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      })
      
      const result = await response.json()
      alert(JSON.stringify(result, null, 2))
      loadDeviceInfo()
    } catch (error) {
      alert(`Error: ${error.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Backend Administration</h2>
        <p className="text-gray-500">Control and monitor backend operations</p>
      </div>

      {/* Device Status */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Settings className="w-5 h-5 mr-2" />
          Device Information
        </h3>
        {device ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoItem label="Device ID" value={device.device_id || 'Not registered'} />
            <InfoItem label="Serial No" value={device.device_serial_no} />
            <InfoItem label="Model" value={`${device.device_model_name} v${device.device_model_version}`} />
            <InfoItem label="Operating Mode" value={device.device_operating_mode} />
            <InfoItem label="Taxpayer" value={device.taxpayer_name} />
            <InfoItem label="TIN" value={device.taxpayer_tin} />
            <InfoItem label="VAT" value={device.vat_number || 'Not registered'} />
            <InfoItem label="Certificate Expiry" value={device.certificate_valid_till ? new Date(device.certificate_valid_till).toLocaleDateString() : 'N/A'} />
          </div>
        ) : (
          <p className="text-gray-500">No device registered</p>
        )}
      </div>

      {/* Fiscal Day Operations */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Calendar className="w-5 h-5 mr-2" />
          Fiscal Day Operations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ActionButton
            icon={Play}
            label="Open Fiscal Day"
            description="Start a new fiscal day"
            onClick={() => handleAction('openDay', { deviceId: device?.device_id })}
            disabled={!device?.device_id || actionLoading}
            color="green"
          />
          <ActionButton
            icon={Square}
            label="Close Fiscal Day"
            description="Close current fiscal day"
            onClick={() => handleAction('closeDay', { deviceId: device?.device_id })}
            disabled={!device?.device_id || actionLoading}
            color="red"
          />
        </div>
      </div>

      {/* Device Operations */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Settings className="w-5 h-5 mr-2" />
          Device Operations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ActionButton
            icon={RefreshCw}
            label="Fetch Config"
            description="Get latest device configuration"
            onClick={() => handleAction('getConfig', { deviceId: device?.device_id })}
            disabled={!device?.device_id || actionLoading}
          />
          <ActionButton
            icon={Database}
            label="Get Status"
            description="Check device status"
            onClick={() => handleAction('getStatus', { deviceId: device?.device_id })}
            disabled={!device?.device_id || actionLoading}
          />
          <ActionButton
            icon={RefreshCw}
            label="Ping ZIMRA"
            description="Send ping to FDMS"
            onClick={() => handleAction('ping', { deviceId: device?.device_id })}
            disabled={!device?.device_id || actionLoading}
          />
        </div>
      </div>

      {/* Certificate Operations */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Key className="w-5 h-5 mr-2" />
          Certificate Management
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ActionButton
            icon={RefreshCw}
            label="Renew Certificate"
            description="Request new certificate from ZIMRA"
            onClick={() => handleAction('renewCertificate', { deviceId: device?.device_id })}
            disabled={!device?.device_id || actionLoading}
            color="yellow"
          />
          <ActionButton
            icon={FileText}
            label="Get Server Certificate"
            description="Download ZIMRA server certificate"
            onClick={() => handleAction('getServerCertificate')}
            disabled={actionLoading}
          />
        </div>
      </div>

      {/* Queue Operations */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          Receipt Queue
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ActionButton
            icon={Play}
            label="Process Queue"
            description="Manually trigger queue processing"
            onClick={() => handleAction('processQueue', { deviceId: device?.device_id })}
            disabled={!device?.device_id || actionLoading}
            color="blue"
          />
          <ActionButton
            icon={RefreshCw}
            label="Retry Failed Receipts"
            description="Retry all failed receipts"
            onClick={() => handleAction('retryFailed', { deviceId: device?.device_id })}
            disabled={!device?.device_id || actionLoading}
          />
        </div>
      </div>

      {/* Database Operations */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Database className="w-5 h-5 mr-2" />
          Database Operations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ActionButton
            icon={RefreshCw}
            label="Run Reconciliation"
            description="Check for stuck receipts and issues"
            onClick={() => handleAction('reconcile', { deviceId: device?.device_id })}
            disabled={!device?.device_id || actionLoading}
          />
          <ActionButton
            icon={Database}
            label="Reset Counters"
            description="Reset fiscal counters (use with caution)"
            onClick={() => {
              if (confirm('Are you sure? This will reset all fiscal counters!')) {
                handleAction('resetCounters', { deviceId: device?.device_id })
              }
            }}
            disabled={!device?.device_id || actionLoading}
            color="red"
          />
        </div>
      </div>
    </div>
  )
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="font-medium text-gray-900">{value || 'N/A'}</p>
    </div>
  )
}

function ActionButton({ icon: Icon, label, description, onClick, disabled, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    green: 'bg-green-600 hover:bg-green-700',
    red: 'bg-red-600 hover:bg-red-700',
    yellow: 'bg-yellow-600 hover:bg-yellow-700'
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-4 rounded-lg text-white ${colors[color]} disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left`}
    >
      <div className="flex items-start">
        <Icon className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">{label}</p>
          <p className="text-sm opacity-90 mt-1">{description}</p>
        </div>
      </div>
    </button>
  )
}
