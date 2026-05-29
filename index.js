require('dotenv').config();
const { getServerCertificate } = require('./src/device/getServerCertificate');
const { getConfig } = require('./src/device/getConfig');
const { getStatus } = require('./src/device/getStatus');
const { startPingScheduler } = require('./src/schedulers/pingScheduler');
const { startConfigRefresh } = require('./src/schedulers/configRefresh');
const { startCertRenewalChecker } = require('./src/schedulers/certRenewalChecker');
const { startNightlyReconciliation } = require('./src/schedulers/nightlyReconciliation');
const { startQueueProcessor } = require('./src/receipts/receiptQueue');
const { supabase } = require('./src/db/supabaseClient');

/**
 * ZIMRA FDMS Bridge - Main Entry Point
 * Rapid Roots Investment Pvt Ltd
 */

async function main() {
  console.log('\n========================================');
  console.log('ZIMRA FDMS Bridge v1.0.0');
  console.log('Rapid Roots Investment Pvt Ltd');
  console.log('========================================\n');

  try {
    // Step 1: Load and validate environment
    console.log('Step 1: Validating environment...');
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
    }

    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   FDMS URL: ${process.env.FDMS_BASE_URL}`);
    console.log(`   Device Serial: ${process.env.FDMS_DEVICE_SERIAL_NO}`);

    // Step 2: Test Supabase connection
    console.log('\nStep 2: Testing Supabase connection...');
    const { error: dbError } = await supabase
      .from('fiscal_devices')
      .select('count')
      .limit(1);

    if (dbError) {
      throw new Error(`Supabase connection failed: ${dbError.message}`);
    }
    console.log('✅ Supabase connected');

    // Step 3: Get FDMS server certificate
    console.log('\nStep 3: Fetching FDMS server certificate...');
    await getServerCertificate();

    // Step 4: Check if device is registered
    const deviceId = process.env.FDMS_DEVICE_ID;

    if (!deviceId) {
      console.log('\n========================================');
      console.log('⚠️  Device Not Registered');
      console.log('========================================');
      console.log('\nDevice ID is not set. To register your device, run:');
      console.log('\n  npm run setup [deviceID] [activationKey]');
      console.log('\nExample:');
      console.log('  npm run setup 12345 00850463');
      console.log('\nOnce registered, restart the bridge with:');
      console.log('  npm start');
      console.log('========================================\n');
      
      // Keep process running for manual setup
      console.log('Bridge is running in setup mode...');
      console.log('Press Ctrl+C to exit\n');
      
      // Keep alive
      setInterval(() => {}, 1000);
      return;
    }

    // Device is registered - start full operations
    console.log(`\nStep 4: Initializing device ${deviceId}...`);

    // Step 5: Get device configuration
    console.log('\nStep 5: Fetching device configuration...');
    const config = await getConfig(parseInt(deviceId));

    // Step 6: Get device status
    console.log('\nStep 6: Checking device status...');
    const status = await getStatus(parseInt(deviceId));

    console.log('\n========================================');
    console.log('Device Status');
    console.log('========================================');
    console.log(`Taxpayer: ${config.taxpayerName}`);
    console.log(`TIN: ${config.taxpayerTIN}`);
    console.log(`VAT: ${config.vatNumber || 'Not registered'}`);
    console.log(`Operating Mode: ${config.deviceOperatingMode}`);
    console.log(`Fiscal Day Status: ${status.fiscalDayStatus}`);
    console.log(`Last Fiscal Day: ${status.lastFiscalDayNo || 'None'}`);
    console.log(`Last Receipt: ${status.lastReceiptGlobalNo || 'None'}`);
    console.log('========================================\n');

    // Step 7: Start schedulers
    console.log('Step 7: Starting schedulers...\n');

    // Ping scheduler (dynamic frequency)
    startPingScheduler(parseInt(deviceId));

    // Config refresh (daily at 02:00)
    startConfigRefresh(parseInt(deviceId));

    // Certificate renewal checker (daily at 01:00)
    startCertRenewalChecker(parseInt(deviceId));

    // Nightly reconciliation (daily at 23:00)
    startNightlyReconciliation(parseInt(deviceId));

    // Step 8: Start receipt queue processor
    console.log('\nStep 8: Starting receipt queue processor...');
    startQueueProcessor(parseInt(deviceId));

    // Success
    console.log('\n========================================');
    console.log('✅ ZIMRA FDMS Bridge Started Successfully');
    console.log('========================================');
    console.log('\nServices running:');
    console.log('  ✅ Ping scheduler (dynamic frequency)');
    console.log('  ✅ Config refresh (daily 02:00)');
    console.log('  ✅ Certificate renewal checker (daily 01:00)');
    console.log('  ✅ Nightly reconciliation (daily 23:00)');
    console.log('  ✅ Receipt queue processor (every 30s)');
    console.log('\nPress Ctrl+C to stop');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n========================================');
    console.error('❌ Bridge Startup Failed');
    console.error('========================================');
    console.error(error.message);
    console.error('========================================\n');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n========================================');
  console.log('Shutting down ZIMRA FDMS Bridge...');
  console.log('========================================\n');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n========================================');
  console.log('Shutting down ZIMRA FDMS Bridge...');
  console.log('========================================\n');
  process.exit(0);
});

// Start the bridge
main();
