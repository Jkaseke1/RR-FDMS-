require('dotenv').config();
const { getServerCertificate } = require('../src/device/getServerCertificate');
const { supabase } = require('../src/db/supabaseClient');

/**
 * Test connection to FDMS and Supabase
 * Run after npm install to verify setup
 */

async function testConnection() {
  console.log('\n========================================');
  console.log('ZIMRA FDMS Bridge - Connection Test');
  console.log('========================================\n');

  const results = {
    env: false,
    supabase: false,
    fdms: false
  };

  // 1. Check environment variables
  console.log('Step 1: Checking environment variables...');
  const requiredEnv = [
    'FDMS_BASE_URL',
    'FDMS_DEVICE_SERIAL_NO',
    'FDMS_DEVICE_MODEL_NAME',
    'FDMS_DEVICE_MODEL_VERSION',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'CUSTOMER_TIN',
    'CUSTOMER_VAT',
    'CUSTOMER_NAME'
  ];

  const missingEnv = requiredEnv.filter(key => !process.env[key]);

  if (missingEnv.length > 0) {
    console.error('❌ Missing environment variables:');
    missingEnv.forEach(key => console.error(`   - ${key}`));
  } else {
    console.log('✅ All required environment variables present');
    results.env = true;
  }

  console.log('\nEnvironment variables loaded:');
  requiredEnv.forEach(key => {
    const value = process.env[key];
    const display = key.includes('KEY') ? '***' : value;
    console.log(`   ${key}: ${display || '(not set)'}`);
  });

  // 2. Test Supabase connection
  console.log('\n\nStep 2: Testing Supabase connection...');
  try {
    const { data, error } = await supabase
      .from('fiscal_devices')
      .select('count')
      .limit(1);

    if (error) {
      throw error;
    }

    console.log('✅ Supabase connection successful');
    results.supabase = true;
  } catch (error) {
    console.error('❌ Supabase connection failed:', error.message);
  }

  // 3. Test FDMS connection
  console.log('\n\nStep 3: Testing FDMS API connection...');
  try {
    const result = await getServerCertificate();
    
    console.log('✅ FDMS API connection successful');
    console.log(`   Certificate valid until: ${result.certificateValidTill}`);
    console.log(`   Certificates saved to: certs/`);
    results.fdms = true;
  } catch (error) {
    console.error('❌ FDMS API connection failed:', error.message);
  }

  // Summary
  console.log('\n\n========================================');
  console.log('Connection Test Summary');
  console.log('========================================');
  console.log(`Environment Variables: ${results.env ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Supabase Connection:   ${results.supabase ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`FDMS API Connection:   ${results.fdms ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = results.env && results.supabase && results.fdms;

  if (allPassed) {
    console.log('\n✅ All tests passed! System is ready.');
    console.log('\nNext steps:');
    console.log('1. Run database migration in Supabase SQL Editor');
    console.log('2. When you receive Device ID from ZIMRA, run:');
    console.log('   npm run setup [deviceID] [activationKey]');
  } else {
    console.log('\n❌ Some tests failed. Please fix the issues above.');
  }

  console.log('========================================\n');

  process.exit(allPassed ? 0 : 1);
}

// Run test
testConnection().catch(error => {
  console.error('\n❌ Test failed with error:', error);
  process.exit(1);
});
