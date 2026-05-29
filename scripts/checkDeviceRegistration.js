/**
 * Check Device Registration Status
 * Verifies if device is registered with ZIMRA
 */

require('dotenv').config();
const { getDeviceClient } = require('../src/http/deviceClient');
const fs = require('fs');
const path = require('path');

const DEVICE_ID = process.env.FDMS_DEVICE_ID || '35224';
const API_URL = process.env.FDMS_API_URL || process.env.FDMS_BASE_URL || 'https://fdmsapitest.zimra.co.zw';
const CERT_PATH = process.env.FDMS_CERT_PATH || './certs/device.cert.pem';
const KEY_PATH = process.env.FDMS_KEY_PATH || './certs/device.key.pem';

async function checkRegistration() {
    console.log('\n' + '='.repeat(70));
    console.log('🔐 DEVICE REGISTRATION CHECK');
    console.log('='.repeat(70) + '\n');
    
    try {
        // Check certificate files exist
        console.log('📋 Certificate Files:');
        console.log(`   Cert: ${CERT_PATH}`);
        if (fs.existsSync(CERT_PATH)) {
            console.log('      ✅ Found');
        } else {
            console.log('      ❌ NOT FOUND');
            return false;
        }
        
        console.log(`   Key: ${KEY_PATH}`);
        if (fs.existsSync(KEY_PATH)) {
            console.log('      ✅ Found');
        } else {
            console.log('      ❌ NOT FOUND');
            return false;
        }
        console.log('');
        
        // Get device client (uses proper certificate configuration)
        console.log('🔗 Creating Device Client...');
        const deviceClient = getDeviceClient();
        console.log('   ✅ Device client created\n');
        
        // Try different endpoints to check registration
        const endpoints = [
            `/Device/v1/${DEVICE_ID}/GetConfiguration`,
            `/Device/v1/${DEVICE_ID}/GetStatus`,
            `/Device/v1/${DEVICE_ID}/Ping`
        ];
        
        console.log('📡 Testing Device Endpoints:\n');
        
        let foundEndpoint = false;
        
        for (const endpoint of endpoints) {
            try {
                console.log(`   Testing: ${endpoint}`);
                const response = await deviceClient.get(endpoint);
                
                console.log(`      ✅ SUCCESS (${response.status})`);
                console.log(`      Response: ${JSON.stringify(response.data).substring(0, 100)}...\n`);
                foundEndpoint = true;
                
            } catch (error) {
                if (error.response) {
                    console.log(`      ❌ ${error.response.status} - ${error.response.statusText}`);
                    
                    if (error.response.status === 404) {
                        console.log(`      💡 Device not found - may not be registered\n`);
                    } else if (error.response.status === 401 || error.response.status === 403) {
                        console.log(`      💡 Authentication failed - check certificate\n`);
                    } else {
                        console.log(`      Error: ${error.message}\n`);
                    }
                } else {
                    console.log(`      ❌ ${error.message}\n`);
                }
            }
        }
        
        console.log('='.repeat(70));
        
        if (foundEndpoint) {
            console.log('✅ DEVICE IS REGISTERED AND RESPONDING');
            console.log('\n   Device is ready for fiscalization!');
        } else {
            console.log('❌ DEVICE NOT RESPONDING');
            console.log('\n   Possible causes:');
            console.log('   1. Device not registered with ZIMRA');
            console.log('   2. Certificate not valid');
            console.log('   3. Device ID is incorrect');
            console.log('   4. ZIMRA API is down');
            console.log('\n   Next steps:');
            console.log('   1. Contact ZIMRA support');
            console.log('   2. Verify device ID: ' + DEVICE_ID);
            console.log('   3. Check certificate validity');
            console.log('   4. Verify ZIMRA API URL: ' + API_URL);
        }
        
        console.log('='.repeat(70) + '\n');
        
        return foundEndpoint;
        
    } catch (error) {
        console.log(`❌ FATAL ERROR: ${error.message}\n`);
        return false;
    }
}

// Run check
checkRegistration().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
