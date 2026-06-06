const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');

/**
 * Detailed diagnostic script to check device status
 */

async function diagnoseDevice() {
  const deviceId = process.argv[2] || process.env.FDMS_DEVICE_ID || process.env.DEVICE_ID;
  const activationKey = process.argv[3] || process.env.FDMS_ACTIVATION_KEY;
  const serialNo = process.env.FDMS_DEVICE_SERIAL_NO || process.env.DEVICE_SERIAL || 'RapidR-1';
  const baseUrl = process.env.FDMS_BASE_URL || process.env.FDMS_URL;
  const modelName = process.env.FDMS_DEVICE_MODEL_NAME || 'Server';
  const modelVersion = process.env.FDMS_DEVICE_MODEL_VERSION || 'v1';

  console.log('\n========================================');
  console.log('ZIMRA Device Diagnostic');
  console.log('========================================');
  console.log(`Device ID: ${deviceId}`);
  console.log(`Activation Key: ${activationKey}`);
  console.log(`Serial No: ${serialNo}`);
  console.log(`Model: ${modelName} v${modelVersion}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log('========================================\n');

  // Test 1: VerifyTaxpayerInformation endpoint
  console.log('Test 1: VerifyTaxpayerInformation');
  console.log('Endpoint: POST /Public/v1/{deviceID}/VerifyTaxpayerInformation');
  console.log('---');

  try {
    const response = await axios.post(
      `${baseUrl}/Public/v1/${deviceId}/VerifyTaxpayerInformation`,
      {
        activationKey: activationKey,
        deviceSerialNo: serialNo
      },
      {
        headers: {
          'DeviceModelName': modelName,
          'DeviceModelVersionNo': modelVersion,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
        validateStatus: () => true // Accept all status codes
      }
    );

    console.log(`Status: ${response.status}`);
    console.log(`Headers:`, JSON.stringify(response.headers, null, 2));
    console.log(`Response:`, JSON.stringify(response.data, null, 2));

    if (response.status === 200) {
      console.log('\n✅ SUCCESS! Device is active and ready!');
      console.log('\nYou can now run:');
      console.log(`  npm run setup ${deviceId} ${activationKey}`);
    } else if (response.status === 422) {
      console.log('\n❌ VALIDATION ERROR');
      const errorCode = response.data?.errorCode || response.data?.code;
      const errorDetail = response.data?.detail || response.data?.message;
      
      console.log(`Error Code: ${errorCode}`);
      console.log(`Detail: ${errorDetail}`);
      
      if (errorCode === 'DEV01') {
        console.log('\n📋 Diagnosis:');
        console.log('   - Device exists in ZIMRA portal');
        console.log('   - Device status is "New" (not "Active")');
        console.log('   - ZIMRA needs to activate the device');
        console.log('\n📞 Action: Contact ZIMRA to activate device ' + deviceId);
      } else if (errorCode === 'DEV02') {
        console.log('\n📋 Diagnosis:');
        console.log('   - Activation key is incorrect');
        console.log('   - Check the activation key from ZIMRA portal');
      } else if (errorCode === 'DEV03') {
        console.log('\n📋 Diagnosis:');
        console.log('   - Serial number mismatch');
        console.log('   - Expected: ' + response.data?.expectedSerialNo);
        console.log('   - Provided: ' + serialNo);
      }
    } else if (response.status === 404) {
      console.log('\n❌ ENDPOINT NOT FOUND');
      console.log('The API endpoint might have changed or the URL is incorrect');
    } else {
      console.log(`\n⚠️  Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.log(`\n❌ Request failed: ${error.message}`);
    if (error.code) {
      console.log(`Error code: ${error.code}`);
    }
  }

  // Test 2: Alternative endpoint paths
  console.log('\n========================================');
  console.log('Test 2: Trying alternative endpoint paths');
  console.log('========================================\n');

  const alternativePaths = [
    `/Device/v1/VerifyTaxpayer`,
    `/Device/v1/${deviceId}/VerifyTaxpayer`,
    `/api/Device/v1/${deviceId}/VerifyTaxpayerInformation`,
    `/Public/v1/VerifyTaxpayerInformation`
  ];

  for (const altPath of alternativePaths) {
    try {
      console.log(`Trying: ${altPath}`);
      const response = await axios.post(
        `${baseUrl}${altPath}`,
        {
          deviceID: parseInt(deviceId),
          activationKey: activationKey,
          deviceSerialNo: serialNo
        },
        {
          headers: {
            'DeviceModelName': modelName,
            'DeviceModelVersionNo': modelVersion,
            'Content-Type': 'application/json'
          },
          timeout: 10000,
          validateStatus: () => true
        }
      );

      if (response.status !== 404) {
        console.log(`  ✅ Found! Status: ${response.status}`);
        console.log(`  Response:`, JSON.stringify(response.data, null, 2));
      } else {
        console.log(`  ❌ 404 Not Found`);
      }
    } catch (error) {
      console.log(`  ⚠️  ${error.message}`);
    }
  }

  console.log('\n========================================');
  console.log('Diagnostic Complete');
  console.log('========================================\n');
}

diagnoseDevice().catch(error => {
  console.error('\n❌ Diagnostic failed:', error.message);
  process.exit(1);
});
