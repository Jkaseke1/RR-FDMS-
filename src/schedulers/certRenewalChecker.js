const schedule = require('node-schedule');
const { issueCertificate } = require('../auth/issueCertificate');
const { supabase } = require('../db/supabaseClient');

/**
 * Check certificate expiry daily
 * Auto-renew if within CERT_RENEWAL_DAYS_BEFORE days
 */

/**
 * Check and renew certificate if needed
 */
async function checkAndRenewCertificate(deviceId) {
  console.log('\n🔐 Checking certificate expiry...');

  try {
    const { data: device } = await supabase
      .from('fiscal_devices')
      .select('certificate_valid_till')
      .eq('device_id', deviceId)
      .single();

    if (!device || !device.certificate_valid_till) {
      console.log('⚠️  No certificate expiry date found');
      return;
    }

    const validTill = new Date(device.certificate_valid_till);
    const now = new Date();
    const daysUntilExpiry = Math.floor((validTill - now) / (1000 * 60 * 60 * 24));

    console.log(`   Certificate valid until: ${validTill.toISOString()}`);
    console.log(`   Days until expiry: ${daysUntilExpiry}`);

    const renewalDays = parseInt(process.env.CERT_RENEWAL_DAYS_BEFORE) || 30;

    if (daysUntilExpiry <= renewalDays && daysUntilExpiry > 0) {
      console.log(`⚠️  Certificate expires in ${daysUntilExpiry} days - renewing now`);
      
      try {
        const result = await issueCertificate(deviceId);
        
        console.log('✅ Certificate renewed successfully');
        console.log(`   New expiry: ${result.certificateValidTill}`);

        // Log renewal
        await supabase
          .from('fdms_error_log')
          .insert({
            device_id: deviceId,
            error_code: 'CERT_RENEWED',
            error_message: `Certificate auto-renewed (${daysUntilExpiry} days before expiry)`,
            operation_type: 'certRenewal',
            operation_id: result.operationID,
            extra_data: {
              old_expiry: device.certificate_valid_till,
              new_expiry: result.certificateValidTill
            },
            resolved: true
          });

      } catch (error) {
        console.error('❌ Certificate renewal failed:', error.message);
        
        // Log failure
        await supabase
          .from('fdms_error_log')
          .insert({
            device_id: deviceId,
            error_code: 'CERT_RENEWAL_FAILED',
            error_message: `Certificate renewal failed: ${error.message}`,
            operation_type: 'certRenewal',
            extra_data: {
              days_until_expiry: daysUntilExpiry,
              error: error.message
            }
          });
      }

    } else if (daysUntilExpiry <= 0) {
      console.error('❌ Certificate has EXPIRED!');
      
      // Log critical error
      await supabase
        .from('fdms_error_log')
        .insert({
          device_id: deviceId,
          error_code: 'CERT_EXPIRED',
          error_message: 'Device certificate has expired',
          operation_type: 'certCheck',
          extra_data: {
            expired_on: device.certificate_valid_till,
            days_expired: Math.abs(daysUntilExpiry)
          }
        });

    } else {
      console.log('✅ Certificate is valid');
    }

  } catch (error) {
    console.error('❌ Certificate check failed:', error.message);
  }
}

/**
 * Start certificate renewal checker
 * Runs daily at 01:00
 */
function startCertRenewalChecker(deviceId) {
  console.log('Starting certificate renewal checker...');

  // Run immediately
  checkAndRenewCertificate(deviceId);

  // Schedule daily check at 01:00
  const rule = new schedule.RecurrenceRule();
  rule.hour = 1;
  rule.minute = 0;

  schedule.scheduleJob(rule, () => {
    checkAndRenewCertificate(deviceId);
  });

  console.log('✅ Certificate renewal checker started (runs daily at 01:00)');
}

module.exports = {
  startCertRenewalChecker,
  checkAndRenewCertificate
};
