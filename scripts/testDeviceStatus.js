const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');

/**
 * Test script to check device status without certificate
 * This will attempt to call the API and see what error we get
 */

async function testDeviceStatus() {
  const deviceId = process.argv[2] || process.env.FDMS_DEVICE_ID || 35224;
  const baseUrl = process.env.FDMS_BASE_URL || 'https://fdmsapitest.zimra.co.zw';

  console.log('\n========================================');
  console.log('ZIMRA Device Status Check');
  console.log('========================================');
  console.log(`Device ID: ${deviceId}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log('========================================\n');

  // Test 1: Check if API is reachable
  console.log('Test 1: Checking API connectivity...');
  try {
    const response = await axios.get(`${baseUrl}/`, {
      timeout: 5000,
      validateStatus: () => true // Accept any status
    });
    console.log(`✅ API is reachable (Status: ${response.status})`);
  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      console.log('❌ Cannot resolve DNS for ZIMRA API');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('❌ Connection refused by ZIMRA API');
    } else {
      console.log(`⚠️  API connection issue: ${error.message}`);
    }
  }

  // Test 2: Try to call verifyTaxpayer endpoint (no cert needed)
  console.log('\nTest 2: Checking device activation status...');
  try {
    const response = await axios.post(
      `${baseUrl}/Device/v1/VerifyTaxpayer`,
      {
        deviceID: parseInt(deviceId)
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000,
        validateStatus: () => true
      }
    );

    console.log(`Response Status: ${response.status}`);
    console.log(`Response Data:`, JSON.stringify(response.data, null, 2));

    if (response.status === 200) {
      console.log('\n✅ Device is ACTIVE and ready for registration!');
      console.log('\nYou can now run:');
      console.log(`  npm run setup ${deviceId} [activationKey]`);
    } else if (response.status === 422) {
      const errorCode = response.data?.errorCode || response.data?.code;
      const errorDetail = response.data?.errorDetail || response.data?.detail || response.data?.message;
      
      console.log(`\n❌ Device Status: ${errorCode}`);
      console.log(`   Detail: ${errorDetail}`);
      
      if (errorCode === 'DEV01') {
        console.log('\n📞 Action Required:');
        console.log('   Contact ZIMRA to activate device ' + deviceId);
        console.log('   The device has been approved but not yet activated in their system.');
      }
    } else {
      console.log(`\n⚠️  Unexpected response status: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Error checking device: ${error.message}`);
  }

  // Test 3: Try to ping (will fail without cert, but shows if endpoint exists)
  console.log('\nTest 3: Checking ping endpoint (without certificate)...');
  try {
    const response = await axios.post(
      `${baseUrl}/Device/v1/${deviceId}/Ping`,
      {},
      {
        timeout: 5000,
        validateStatus: () => true
      }
    );
    
    console.log(`Response Status: ${response.status}`);
    if (response.status === 401 || response.status === 403) {
      console.log('✅ Ping endpoint exists (requires certificate as expected)');
    } else {
      console.log(`Response:`, JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || error.code === 'CERT_HAS_EXPIRED') {
      console.log('✅ Ping endpoint exists (certificate validation failed as expected)');
    } else {
      console.log(`⚠️  ${error.message}`);
    }
  }

  console.log('\n========================================');
  console.log('Status Check Complete');
  console.log('========================================\n');
}

testDeviceStatus().catch(error => {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
});
