const schedule = require('node-schedule');
const { getConfig } = require('../device/getConfig');
const { issueCertificate } = require('../auth/issueCertificate');
const { supabase } = require('../db/supabaseClient');

/**
 * Refresh configuration every 24 hours
 * Check certificate expiry and VAT status changes
 */

/**
 * Refresh configuration
 */
async function refreshConfig(deviceId) {
  console.log('\n🔄 Refreshing device configuration...');

  try {
    // Get old config for comparison
    const { data: oldConfig } = await supabase
      .from('fiscal_devices')
      .select('vat_number, certificate_valid_till')
      .eq('device_id', deviceId)
      .single();

    // Fetch new config
    const newConfig = await getConfig(deviceId);

    // Check for VAT status change
    if (oldConfig && oldConfig.vat_number !== newConfig.vatNumber) {
      console.log('⚠️  WARNING: VAT status changed!');
      console.log(`   Old: ${oldConfig.vat_number || 'Not registered'}`);
      console.log(`   New: ${newConfig.vatNumber || 'Not registered'}`);
      
      // Check if fiscal day is open
      const { data: openDay } = await supabase
        .from('fiscal_days')
        .select('id')
        .eq('device_id', deviceId)
        .eq('status', 'FiscalDayOpened')
        .single();

      if (openDay) {
        console.log('⚠️  Fiscal day is open - close it before submitting new receipts');
        
        // Log warning
        await supabase
          .from('fdms_error_log')
          .insert({
            device_id: deviceId,
            error_code: 'CONFIG_CHANGE',
            error_message: 'VAT status changed during open fiscal day',
            operation_type: 'configRefresh',
            extra_data: {
              old_vat: oldConfig.vat_number,
              new_vat: newConfig.vatNumber
            }
          });
      }
    }

    // Check certificate expiry
    if (newConfig.certificateValidTill) {
      const validTill = new Date(newConfig.certificateValidTill);
      const now = new Date();
      const daysUntilExpiry = Math.floor((validTill - now) / (1000 * 60 * 60 * 24));

      const renewalDays = parseInt(process.env.CERT_RENEWAL_DAYS_BEFORE) || 30;

      if (daysUntilExpiry <= renewalDays && daysUntilExpiry > 0) {
        console.log(`⚠️  Certificate expires in ${daysUntilExpiry} days - triggering renewal`);
        
        try {
          await issueCertificate(deviceId);
        } catch (error) {
          console.error('Failed to renew certificate:', error.message);
        }
      }
    }

    console.log('✅ Configuration refreshed successfully');

  } catch (error) {
    console.error('❌ Configuration refresh failed:', error.message);
  }
}

/**
 * Start config refresh scheduler
 * Runs every 24 hours
 */
function startConfigRefresh(deviceId) {
  console.log('Starting config refresh scheduler...');

  // Run immediately
  refreshConfig(deviceId);

  // Schedule daily refresh at 02:00
  const rule = new schedule.RecurrenceRule();
  rule.hour = 2;
  rule.minute = 0;

  schedule.scheduleJob(rule, () => {
    refreshConfig(deviceId);
  });

  console.log('✅ Config refresh scheduler started (runs daily at 02:00)');
}

module.exports = {
  startConfigRefresh,
  refreshConfig
};
