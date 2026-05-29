const schedule = require('node-schedule');
const { supabase } = require('../db/supabaseClient');

/**
 * Nightly reconciliation - run at 23:00
 * Check for:
 * 1. Receipts stuck in pending status > 1 hour
 * 2. Fiscal days open longer than taxPayerDayMaxHrs
 * 3. Any receipts with Grey status
 * 4. Certificate expiry within 30 days
 */

/**
 * Run nightly reconciliation
 */
async function runReconciliation(deviceId) {
  console.log('\n📊 Running nightly reconciliation...');
  const findings = [];

  try {
    // 1. Check for stuck receipts
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const { data: stuckReceipts } = await supabase
      .from('fiscal_receipts')
      .select('id, invoice_no, receipt_global_no, created_at')
      .eq('device_id', deviceId)
      .eq('submission_status', 'pending')
      .lt('created_at', oneHourAgo.toISOString());

    if (stuckReceipts && stuckReceipts.length > 0) {
      findings.push({
        type: 'STUCK_RECEIPTS',
        count: stuckReceipts.length,
        details: stuckReceipts
      });
      console.log(`⚠️  Found ${stuckReceipts.length} receipts stuck in pending status`);
    }

    // 2. Check for expired fiscal days
    const { data: device } = await supabase
      .from('fiscal_devices')
      .select('tax_payer_day_max_hrs')
      .eq('device_id', deviceId)
      .single();

    if (device) {
      const { data: openDays } = await supabase
        .from('fiscal_days')
        .select('id, fiscal_day_no, opened_at')
        .eq('device_id', deviceId)
        .eq('status', 'FiscalDayOpened');

      if (openDays && openDays.length > 0) {
        const now = new Date();
        const expiredDays = openDays.filter(day => {
          const hoursSinceOpened = (now - new Date(day.opened_at)) / (1000 * 60 * 60);
          return hoursSinceOpened >= device.tax_payer_day_max_hrs;
        });

        if (expiredDays.length > 0) {
          findings.push({
            type: 'EXPIRED_FISCAL_DAYS',
            count: expiredDays.length,
            details: expiredDays
          });
          console.log(`⚠️  Found ${expiredDays.length} expired fiscal days`);
        }
      }
    }

    // 3. Check for Grey receipts
    const { data: greyReceipts } = await supabase
      .from('fiscal_receipts')
      .select('id, invoice_no, receipt_global_no, validation_color')
      .eq('device_id', deviceId)
      .eq('validation_color', 'Grey');

    if (greyReceipts && greyReceipts.length > 0) {
      findings.push({
        type: 'GREY_RECEIPTS',
        count: greyReceipts.length,
        details: greyReceipts
      });
      console.log(`⚠️  Found ${greyReceipts.length} receipts with Grey validation`);
    }

    // 4. Check certificate expiry
    const { data: deviceCert } = await supabase
      .from('fiscal_devices')
      .select('certificate_valid_till')
      .eq('device_id', deviceId)
      .single();

    if (deviceCert && deviceCert.certificate_valid_till) {
      const validTill = new Date(deviceCert.certificate_valid_till);
      const now = new Date();
      const daysUntilExpiry = Math.floor((validTill - now) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
        findings.push({
          type: 'CERT_EXPIRING_SOON',
          days: daysUntilExpiry,
          expiry_date: deviceCert.certificate_valid_till
        });
        console.log(`⚠️  Certificate expires in ${daysUntilExpiry} days`);
      } else if (daysUntilExpiry <= 0) {
        findings.push({
          type: 'CERT_EXPIRED',
          days: Math.abs(daysUntilExpiry),
          expiry_date: deviceCert.certificate_valid_till
        });
        console.log(`❌ Certificate EXPIRED ${Math.abs(daysUntilExpiry)} days ago`);
      }
    }

    // 5. Check for failed receipts
    const { data: failedReceipts } = await supabase
      .from('fiscal_receipts')
      .select('id, invoice_no, receipt_global_no, last_error, submission_attempts')
      .eq('device_id', deviceId)
      .eq('submission_status', 'failed');

    if (failedReceipts && failedReceipts.length > 0) {
      findings.push({
        type: 'FAILED_RECEIPTS',
        count: failedReceipts.length,
        details: failedReceipts
      });
      console.log(`⚠️  Found ${failedReceipts.length} failed receipts`);
    }

    // Log all findings to database
    if (findings.length > 0) {
      await supabase
        .from('fdms_error_log')
        .insert({
          device_id: deviceId,
          error_code: 'NIGHTLY_RECONCILIATION',
          error_message: `Nightly reconciliation found ${findings.length} issues`,
          operation_type: 'reconciliation',
          extra_data: { findings }
        });

      console.log(`\n📋 Reconciliation Summary:`);
      console.log(`   Total issues found: ${findings.length}`);
      findings.forEach(f => {
        console.log(`   - ${f.type}: ${f.count || f.days || 'See details'}`);
      });
    } else {
      console.log('✅ No issues found');
    }

  } catch (error) {
    console.error('❌ Reconciliation failed:', error.message);
  }
}

/**
 * Start nightly reconciliation scheduler
 * Runs daily at 23:00
 */
function startNightlyReconciliation(deviceId) {
  console.log('Starting nightly reconciliation scheduler...');

  // Schedule daily at 23:00
  const rule = new schedule.RecurrenceRule();
  rule.hour = 23;
  rule.minute = 0;

  schedule.scheduleJob(rule, () => {
    runReconciliation(deviceId);
  });

  console.log('✅ Nightly reconciliation scheduler started (runs daily at 23:00)');
}

module.exports = {
  startNightlyReconciliation,
  runReconciliation
};
