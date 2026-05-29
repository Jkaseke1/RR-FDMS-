const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createDeviceClient } = require('../src/http/deviceClient');

async function testGetConfig() {
  const deviceId = 35224;
  
  console.log('\n========================================');
  console.log('Testing GetConfig API');
  console.log('========================================');
  console.log(`Device ID: ${deviceId}`);
  console.log('========================================\n');

  try {
    // Recreate client to load new certificate
    const deviceClient = createDeviceClient();
    
    console.log('Calling GetConfig...');
    const response = await deviceClient.get(`/Device/v1/${deviceId}/GetConfig`);
    
    console.log('\n✅ SUCCESS!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('\n❌ FAILED');
    console.log('Error:', error.message);
    
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Headers:', JSON.stringify(error.response.headers, null, 2));
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.code) {
      console.log('Error Code:', error.code);
    }
  }
}

testGetConfig();
