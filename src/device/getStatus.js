const { getDeviceClient } = require('../http/deviceClient');
const { supabase } = require('../db/supabaseClient');

/**
 * Call GET /Device/v1/{deviceID}/GetStatus
 * Per spec section 4.5
 * Requires mTLS authentication
 * Cannot be called if DeviceOperatingMode is Offline
 */
async function getStatus(deviceId) {
  console.log(`\nFetching status for device ${deviceId}...`);

  try {
    const deviceClient = getDeviceClient();
    const response = await deviceClient.get(`/Device/v1/${deviceId}/GetStatus`);
    const status = response.data;

    console.log('✅ Status retrieved');
    console.log(`   Fiscal Day Status: ${status.fiscalDayStatus}`);
    console.log(`   Last Fiscal Day No: ${status.lastFiscalDayNo}`);
    console.log(`   Last Receipt Global No: ${status.lastReceiptGlobalNo}`);

    if (status.fiscalDayClosed) {
      console.log(`   Fiscal Day Closed: ${status.fiscalDayClosed}`);
    }

    if (status.fiscalDayClosingErrorCode) {
      console.log(`   ⚠️  Closing Error: ${status.fiscalDayClosingErrorCode}`);
    }

    // Update fiscal_days table status from response
    if (status.lastFiscalDayNo) {
      const { error } = await supabase
        .from('fiscal_days')
        .update({
          status: status.fiscalDayStatus,
          fiscal_day_server_signature: status.fiscalDayServerSignature,
          closing_error_code: status.fiscalDayClosingErrorCode,
          updated_at: new Date().toISOString()
        })
        .eq('device_id', deviceId)
        .eq('fiscal_day_no', status.lastFiscalDayNo);

      if (error) {
        console.error('⚠️  Failed to update fiscal day status:', error.message);
      }
    }

    return status;
  } catch (error) {
    console.error('❌ Failed to get status');
    if (error.fdmsError) {
      console.error(`   Error Code: ${error.fdmsError.errorCode}`);
      console.error(`   Detail: ${error.fdmsError.detail}`);
    } else {
      console.error(`   ${error.message}`);
    }
    throw error;
  }
}

module.exports = { getStatus };
