const { getDeviceClient } = require('../http/deviceClient');
const { supabase } = require('../db/supabaseClient');

/**
 * Call GET /Device/v1/{deviceID}/GetConfig
 * Per spec section 4.4
 * Requires mTLS authentication
 */
async function getConfig(deviceId) {
  console.log(`\nFetching configuration for device ${deviceId}...`);

  try {
    const deviceClient = getDeviceClient();
    const response = await deviceClient.get(`/Device/v1/${deviceId}/GetConfig`);
    const config = response.data;

    console.log('✅ Configuration retrieved');
    console.log(`   Taxpayer: ${config.taxPayerName}`); // API uses taxPayerName (camelCase with capital P)
    console.log(`   TIN: ${config.taxPayerTIN}`);
    console.log(`   VAT Number: ${config.vatNumber || 'Not VAT registered'}`);
    console.log(`   Operating Mode: ${config.deviceOperatingMode}`);
    console.log(`   Max Day Hours: ${config.taxPayerDayMaxHrs}`);
    console.log(`   Applicable Taxes: ${config.applicableTaxes.length}`);

    // Store ALL config in Supabase fiscal_devices
    const { error: deviceError } = await supabase
      .from('fiscal_devices')
      .upsert({
        device_id: deviceId,
        taxpayer_name: config.taxPayerName, // API uses taxPayerName
        taxpayer_tin: config.taxPayerTIN,
        vat_number: config.vatNumber,
        bp_number: config.bpNumber || null,
        device_serial_no: config.deviceSerialNo,
        device_branch_name: config.deviceBranchName,
        device_branch_address: config.deviceBranchAddress,
        device_branch_contacts: config.deviceBranchContacts,
        device_operating_mode: config.deviceOperatingMode,
        tax_payer_day_max_hrs: config.taxPayerDayMaxHrs,
        taxpayer_day_end_notification_hrs: config.taxpayerDayEndNotificationHrs,
        certificate_valid_till: config.certificateValidTill,
        qr_url: config.qrUrl,
        applicable_taxes: config.applicableTaxes,
        last_config_fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'device_id'
      });

    if (deviceError) {
      console.error('⚠️  Failed to save device config:', deviceError.message);
    }

    // Store each tax in applicable_taxes table
    for (const tax of config.applicableTaxes) {
      const { error: taxError } = await supabase
        .from('applicable_taxes')
        .upsert({
          device_id: deviceId,
          tax_id: tax.taxID,
          tax_percent: tax.taxPercent || 0,
          tax_name: tax.taxName,
          tax_code: tax.taxCode || null,
          tax_valid_from: tax.validFrom || new Date().toISOString(), // API uses validFrom not taxValidFrom
          tax_valid_till: tax.validTill || null,
          synced_at: new Date().toISOString()
        }, {
          onConflict: 'device_id,tax_id'
        });

      if (taxError) {
        console.error(`⚠️  Failed to save tax ${tax.taxID}:`, taxError.message);
      }
    }

    // VAT CHECK
    const isVATRegistered = !!config.vatNumber;
    console.log(`\n   VAT Status: ${isVATRegistered ? 'VAT Registered' : 'NOT VAT Registered'}`);

    // CERTIFICATE EXPIRY CHECK
    if (config.certificateValidTill) {
      const validTill = new Date(config.certificateValidTill);
      const now = new Date();
      const daysUntilExpiry = Math.floor((validTill - now) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry <= 30) {
        console.log(`\n⚠️  WARNING: Device certificate expires in ${daysUntilExpiry} days (${config.certificateValidTill})`);
        console.log('   Renew using issueCertificate before expiry.');
      }
    }

    return config;
  } catch (error) {
    console.error('❌ Failed to get configuration');
    if (error.fdmsError) {
      console.error(`   Error Code: ${error.fdmsError.errorCode}`);
      console.error(`   Detail: ${error.fdmsError.detail}`);
    } else {
      console.error(`   ${error.message}`);
    }
    throw error;
  }
}

module.exports = { getConfig };
