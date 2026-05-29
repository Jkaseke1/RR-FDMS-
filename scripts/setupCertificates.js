const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');
const { registerDevice } = require('../src/auth/registerDevice');

/**
 * Setup script - run when Device ID arrives from ZIMRA
 * Usage: node scripts/setupCertificates.js [deviceID] [activationKey]
 */

async function setup() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('\n❌ Usage: node scripts/setupCertificates.js [deviceID] [activationKey]');
    console.error('\nExample:');
    console.error('  node scripts/setupCertificates.js 12345 00850463\n');
    process.exit(1);
  }

  const deviceId = parseInt(args[0]);
  const activationKey = args[1];

  if (isNaN(deviceId)) {
    console.error('❌ Device ID must be a number');
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('ZIMRA FDMS Device Setup');
  console.log('========================================');
  console.log(`Device ID: ${deviceId}`);
  console.log(`Activation Key: ${activationKey}`);
  console.log(`Serial No: ${process.env.FDMS_DEVICE_SERIAL_NO}`);
  console.log('========================================\n');

  try {
    // Run device registration
    const result = await registerDevice(deviceId, activationKey);

    // Update .env file with device ID
    console.log('\nUpdating .env file...');
    const envPath = path.resolve('.env');
    let envContent = '';

    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      
      // Update FDMS_DEVICE_ID
      if (envContent.includes('FDMS_DEVICE_ID=')) {
        envContent = envContent.replace(/FDMS_DEVICE_ID=.*/, `FDMS_DEVICE_ID=${deviceId}`);
      } else {
        envContent += `\nFDMS_DEVICE_ID=${deviceId}\n`;
      }

      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('✅ .env file updated');
    } else {
      console.log('⚠️  .env file not found - please add FDMS_DEVICE_ID manually');
    }

    // Success summary
    console.log('\n========================================');
    console.log('✅ Device Setup Complete!');
    console.log('========================================');
    console.log(`Device ID: ${deviceId}`);
    console.log(`Operation ID: ${result.operationID}`);
    console.log(`Certificate: ${process.env.FDMS_CERT_PATH}`);
    console.log('\nYou can now start the bridge:');
    console.log('  npm start');
    console.log('========================================\n');

    process.exit(0);

  } catch (error) {
    console.error('\n========================================');
    console.error('❌ Device Setup Failed');
    console.error('========================================');
    console.error(error.message);
    console.error('========================================\n');
    process.exit(1);
  }
}

// Run setup
setup();
