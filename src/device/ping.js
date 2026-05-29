const { getDeviceClient } = require('../http/deviceClient');
const { supabase } = require('../db/supabaseClient');

/**
 * Call POST /Device/v1/{deviceID}/Ping
 * Per spec section 4.13
 * Requires mTLS authentication
 * Must be called regularly when device is on
 */
async function ping(deviceId) {
  try {
    const deviceClient = getDeviceClient();
    const response = await deviceClient.post(`/Device/v1/${deviceId}/Ping`);
    const data = response.data;

    // Log ping to database
    await supabase
      .from('fdms_ping_log')
      .insert({
        device_id: deviceId,
        reporting_frequency_minutes: data.reportingFrequency,
        success: true,
        operation_id: data.operationID,
        pinged_at: new Date().toISOString()
      });

    // Update device reporting frequency
    if (data.reportingFrequency) {
      await supabase
        .from('fiscal_devices')
        .update({
          reporting_frequency_minutes: data.reportingFrequency,
          updated_at: new Date().toISOString()
        })
        .eq('device_id', deviceId);
    }

    console.log(`✅ Ping successful - Next ping in ${data.reportingFrequency} minutes`);

    return {
      reportingFrequency: data.reportingFrequency,
      operationID: data.operationID
    };
  } catch (error) {
    // Log failed ping
    await supabase
      .from('fdms_ping_log')
      .insert({
        device_id: deviceId,
        success: false,
        error_message: error.message,
        pinged_at: new Date().toISOString()
      });

    console.error('❌ Ping failed:', error.message);
    throw error;
  }
}

module.exports = { ping };
