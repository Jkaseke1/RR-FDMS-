const { getDeviceClient, createDeviceClient } = require('../http/deviceClient');
const { generateKeys } = require('./generateKeys');
const { supabase } = require('../db/supabaseClient');
const fs = require('fs');
const path = require('path');

/**
 * Call POST /Device/v1/{deviceID}/IssueCertificate
 * Per spec section 4.3 - certificate renewal
 * Use when certificate is within CERT_RENEWAL_DAYS_BEFORE days of expiry
 * Requires mTLS authentication
 */
async function issueCertificate(deviceId) {
  console.log(`\nRenewing certificate for device ${deviceId}...`);

  try {
    // Generate new CSR
    console.log('Step 1: Generating new CSR...');
    const { csrPem } = await generateKeys(deviceId);

    // Call IssueCertificate
    console.log('Step 2: Requesting new certificate from ZIMRA...');
    const deviceClient = getDeviceClient();
    const response = await deviceClient.post(
      `/Device/v1/${deviceId}/IssueCertificate`,
      {
        certificateRequest: csrPem
      }
    );

    const data = response.data;
    console.log('✅ New certificate issued');
    console.log(`   Operation ID: ${data.operationID}`);

    // Save new certificate
    console.log('Step 3: Saving new certificate...');
    const certPath = path.resolve(process.env.FDMS_CERT_PATH);
    fs.writeFileSync(certPath, data.certificate, 'utf8');
    console.log(`   Certificate saved: ${certPath}`);

    // Update database
    console.log('Step 4: Updating database...');
    const { error } = await supabase
      .from('fiscal_devices')
      .update({
        certificate_pem: data.certificate,
        certificate_valid_till: data.certificateValidTill,
        updated_at: new Date().toISOString()
      })
      .eq('device_id', deviceId);

    if (error) {
      console.error('⚠️  Failed to update database:', error.message);
    }

    // Recreate device client with new certificate
    createDeviceClient();

    console.log('✅ Certificate renewal complete');
    console.log(`   Valid until: ${data.certificateValidTill}`);

    return {
      certificate: data.certificate,
      certificateValidTill: data.certificateValidTill,
      operationID: data.operationID
    };
  } catch (error) {
    console.error('❌ Certificate renewal failed');
    if (error.fdmsError) {
      console.error(`   Error Code: ${error.fdmsError.errorCode}`);
      console.error(`   Detail: ${error.fdmsError.detail}`);
    } else {
      console.error(`   ${error.message}`);
    }
    throw error;
  }
}

module.exports = { issueCertificate };
