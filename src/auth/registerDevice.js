const publicClient = require('../http/publicClient');
const { verifyTaxpayer } = require('./verifyTaxpayer');
const { generateKeys } = require('./generateKeys');
const { getConfig } = require('../device/getConfig');
const { supabase } = require('../db/supabaseClient');
const fs = require('fs');
const path = require('path');

/**
 * Call POST /Public/v1/{deviceID}/RegisterDevice
 * Per spec section 4.2
 */
async function registerDevice(deviceId, activationKey) {
  console.log(`\n========================================`);
  console.log(`ZIMRA Device Registration - Device ${deviceId}`);
  console.log(`========================================\n`);

  try {
    // Step 1: Verify taxpayer first
    console.log('Step 1: Verifying taxpayer information...');
    const taxpayerInfo = await verifyTaxpayer(
      deviceId,
      activationKey,
      process.env.FDMS_DEVICE_SERIAL_NO
    );

    // Step 2: Generate ECC key pair and CSR
    console.log('\nStep 2: Generating ECC key pair and CSR...');
    const { csrPem, subjectCN } = await generateKeys(deviceId);

    // Step 3: Register device with ZIMRA
    console.log('\nStep 3: Registering device with ZIMRA...');
    const response = await publicClient.post(
      `/Public/v1/${deviceId}/RegisterDevice`,
      {
        deviceID: parseInt(deviceId),
        taxpayerTIN: taxpayerInfo.taxPayerTIN,
        taxpayerVATNo: taxpayerInfo.vatNumber,
        taxpayerName: taxpayerInfo.taxPayerName,
        deviceSerialNo: process.env.FDMS_DEVICE_SERIAL_NO,
        activationKey,
        certificateRequest: csrPem
      }
    );

    const data = response.data;
    console.log('✅ Device registered successfully');
    console.log(`   Operation ID: ${data.operationID}`);

    // Step 4: Save certificate
    console.log('\nStep 4: Saving device certificate...');
    const certPath = path.resolve(process.env.FDMS_CERT_PATH);
    fs.writeFileSync(certPath, data.certificate, 'utf8');
    console.log(`   Certificate saved: ${certPath}`);

    // Step 5: Save to Supabase
    console.log('\nStep 5: Saving device details to database...');
    const { error } = await supabase
      .from('fiscal_devices')
      .upsert({
        device_id: deviceId,
        device_serial_no: process.env.FDMS_DEVICE_SERIAL_NO,
        activation_key: activationKey,
        certificate_pem: data.certificate,
        certificate_subject_cn: subjectCN,
        taxpayer_name: taxpayerInfo.taxPayerName,
        taxpayer_tin: taxpayerInfo.taxPayerTIN,
        vat_number: taxpayerInfo.vatNumber,
        device_branch_name: taxpayerInfo.deviceBranchName,
        device_branch_address: taxpayerInfo.deviceBranchAddress,
        device_branch_contacts: taxpayerInfo.deviceBranchContacts,
        registration_operation_id: data.operationID,
        registered_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'device_id'
      });

    if (error) {
      console.error('⚠️  Failed to save to database:', error.message);
    } else {
      console.log('✅ Device details saved to database');
    }

    // Step 6: Fetch configuration
    console.log('\nStep 6: Fetching device configuration...');
    // Recreate device client with new certificate
    const { createDeviceClient } = require('../http/deviceClient');
    createDeviceClient();
    
    await getConfig(deviceId);

    console.log('\n========================================');
    console.log('✅ Device Registration Complete');
    console.log('========================================\n');

    return {
      deviceId,
      operationID: data.operationID,
      certificate: data.certificate
    };
  } catch (error) {
    console.error('\n❌ Device registration failed');
    if (error.fdmsError) {
      console.error(`   Error Code: ${error.fdmsError.errorCode}`);
      console.error(`   Detail: ${error.fdmsError.detail}`);
      console.error(`   Operation ID: ${error.fdmsError.operationID}`);
    } else {
      console.error(`   ${error.message}`);
    }
    throw error;
  }
}

module.exports = { registerDevice };
