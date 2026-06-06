const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { getConfig } = require('../src/device/getConfig');

async function syncConfig() {
  const deviceId = process.env.FDMS_DEVICE_ID || process.env.DEVICE_ID;
  
  console.log('\n========================================');
  console.log('Syncing Device Configuration');
  console.log('========================================\n');

  try {
    await getConfig(deviceId);
    
    console.log('\n========================================');
    console.log('✅ Configuration Synced Successfully');
    console.log('========================================\n');
  } catch (error) {
    console.log('\n========================================');
    console.log('❌ Configuration Sync Failed');
    console.log('========================================');
    console.error(error.message);
    process.exit(1);
  }
}

syncConfig();
