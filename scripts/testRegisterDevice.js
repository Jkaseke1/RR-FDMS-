const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');
const fs = require('fs');

async function testRegisterDevice() {
  const deviceId = process.env.FDMS_DEVICE_ID || process.env.DEVICE_ID;
  const activationKey = process.env.FDMS_ACTIVATION_KEY;
  const baseUrl = process.env.FDMS_BASE_URL || process.env.FDMS_URL || 'https://fdmsapi.zimra.co.zw';
  
  // Read CSR
  const csrPath = path.join(__dirname, '..', 'certs', 'device.csr.pem');
  const csrPem = fs.readFileSync(csrPath, 'utf8');
  
  console.log('\n========================================');
  console.log('Testing RegisterDevice API');
  console.log('========================================');
  console.log(`Device ID: ${deviceId}`);
  console.log(`Activation Key: ${activationKey}`);
  console.log(`CSR Length: ${csrPem.length} chars`);
  console.log('========================================\n');

  const payload = {
    deviceID: parseInt(deviceId),
    taxpayerTIN: '2002054676',
    taxpayerVATNo: '220401569',
    taxpayerName: 'Rapid Roots Investment Pvt Ltd',
    deviceSerialNo: 'RapidR-1',
    deviceModelName: 'Server',
    deviceModelVersion: 'v1',
    DeviceModelVersion: 'v1',  // Try capital D
    deviceModelVersionNo: 'v1', // Try with No suffix
    activationKey: activationKey,
    certificateRequest: csrPem
  };

  console.log('Full Payload (without CSR):');
  const payloadCopy = {...payload, certificateRequest: csrPem.substring(0, 100) + '...'};
  console.log(JSON.stringify(payloadCopy, null, 2));

  try {
    const response = await axios.post(
      `${baseUrl}/Public/v1/${deviceId}/RegisterDevice`,
      payload,
      {
        headers: {
          'DeviceModelName': 'Server',
          'DeviceModelVersionNo': 'v1',
          'Content-Type': 'application/json'
        },
        timeout: 30000,
        validateStatus: () => true
      }
    );

    console.log('\n========================================');
    console.log(`Status: ${response.status}`);
    console.log('Headers:', JSON.stringify(response.headers, null, 2));
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('========================================\n');

    if (response.status === 200) {
      console.log('✅ SUCCESS! Device registered!');
      console.log('\nCertificate received:');
      console.log(response.data.certificate?.substring(0, 200) + '...');
    } else {
      console.log('❌ Registration failed');
      console.log('Error details:', response.data);
    }
  } catch (error) {
    console.log('\n❌ Request failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

testRegisterDevice();
