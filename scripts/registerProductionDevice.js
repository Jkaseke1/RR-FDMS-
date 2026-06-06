/**
 * Register Production Device with ZIMRA
 * 
 * This script registers your new production device using:
 * - Device ID (from ZIMRA)
 * - Activation Key (from ZIMRA)
 * - CSR (Certificate Signing Request)
 * 
 * ZIMRA will return a production certificate in response.
 * 
 * Usage:
 *   node scripts/registerProductionDevice.js
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer.trim()));
  });
}

async function registerDevice() {
  console.log('\n' + '='.repeat(70));
  console.log('  ZIMRA Production Device Registration');
  console.log('  Rapid Roots Investments (Pvt) Ltd');
  console.log('='.repeat(70) + '\n');
  
  // Load .env if exists
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
  
  // Get credentials
  const deviceId = await question('Production Device ID: ');
  const activationKey = await question('Activation Key: ');
  const baseUrl = 'https://fdmsapi.zimra.co.zw';
  
  console.log('\nCompany Information:');
  const companyName = await question('Company Name [Rapid Roots Investments (Pvt) Ltd]: ') 
    || 'Rapid Roots Investments (Pvt) Ltd';
  const taxpayerTIN = await question('Taxpayer TIN [2002054676]: ') || '2002054676';
  const taxpayerVAT = await question('VAT Number [220401569]: ') || '220401569';
  const deviceSerial = await question('Device Serial: ');
  
  // Check for CSR file
  const csrPath = path.join(__dirname, '..', 'certs', 'device.csr.pem');
  let csrPem = '';
  
  if (fs.existsSync(csrPath)) {
    csrPem = fs.readFileSync(csrPath, 'utf8');
    console.log(`\n✅ Found CSR file: ${csrPath}`);
    console.log(`   Length: ${csrPem.length} characters`);
  } else {
    console.log('\n⚠️  CSR file not found at: ${csrPath}');
    console.log('You need to generate a CSR first or ZIMRA may provide the certificate directly.');
    
    const hasCert = await question('Do you already have a certificate file (.p12) from ZIMRA? (y/N): ');
    if (hasCert.toLowerCase() === 'y') {
      console.log('\n✅ Great! Just copy your .p12 certificate to certs/ folder and update .env');
      console.log('No need to register device - it\'s already done by ZIMRA.\n');
      rl.close();
      return;
    }
    
    console.log('\n❌ Cannot proceed without CSR or certificate.');
    console.log('Contact ZIMRA for assistance with certificate generation.\n');
    rl.close();
    return;
  }
  
  // Prepare payload
  const payload = {
    deviceID: parseInt(deviceId),
    taxpayerTIN: taxpayerTIN,
    taxpayerVATNo: taxpayerVAT,
    taxpayerName: companyName,
    deviceSerialNo: deviceSerial,
    deviceModelName: 'Server',
    deviceModelVersion: 'v1',
    activationKey: activationKey,
    certificateRequest: csrPem
  };
  
  console.log('\n' + '-'.repeat(70));
  console.log('Registration Payload:');
  console.log('-'.repeat(70));
  console.log(JSON.stringify({
    ...payload,
    certificateRequest: csrPem.substring(0, 100) + '...'
  }, null, 2));
  console.log('-'.repeat(70) + '\n');
  
  const proceed = await question('Proceed with registration? (y/N): ');
  if (proceed.toLowerCase() !== 'y') {
    console.log('\n❌ Registration cancelled.\n');
    rl.close();
    return;
  }
  
  // Submit registration
  console.log('\n📤 Submitting registration to ZIMRA...');
  console.log(`   URL: ${baseUrl}/Public/v1/${deviceId}/RegisterDevice`);
  console.log('   Please wait...\n');
  
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
    
    console.log('='.repeat(70));
    console.log(`Response Status: ${response.status}`);
    console.log('='.repeat(70) + '\n');
    
    if (response.status === 200) {
      console.log('✅ SUCCESS! Device registered with ZIMRA!\n');
      
      // Save certificate if provided
      if (response.data.certificate) {
        const certPath = path.join(__dirname, '..', 'certs', 'device.crt.pem');
        fs.writeFileSync(certPath, response.data.certificate);
        console.log(`✅ Certificate saved to: ${certPath}`);
        console.log(`   Length: ${response.data.certificate.length} characters`);
        
        // Convert to P12 if needed
        console.log('\n⚠️  Note: You may need to convert this certificate to .p12 format');
        console.log('   for use with the FDMS Bridge.\n');
      }
      
      if (response.data.deviceID) {
        console.log('Device Details:');
        console.log(`   Device ID: ${response.data.deviceID}`);
      }
      
      console.log('\n📝 Next Steps:');
      console.log('   1. Save the certificate (if provided)');
      console.log('   2. Convert to .p12 format if needed');
      console.log('   3. Update .env with production credentials');
      console.log('   4. Test connection: node scripts/testConnection.js');
      console.log('   5. Open fiscal day: node scripts/openFiscalDay.js');
      
    } else {
      console.log('❌ Registration failed!\n');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      
      if (response.status === 400) {
        console.log('\n💡 Common causes:');
        console.log('   - Invalid activation key');
        console.log('   - Device already registered');
        console.log('   - Invalid CSR format');
        console.log('   - Mismatched TIN/VAT numbers');
      }
    }
    
  } catch (error) {
    console.log('\n❌ Request failed:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  console.log('\n' + '='.repeat(70) + '\n');
  rl.close();
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});

registerDevice();
