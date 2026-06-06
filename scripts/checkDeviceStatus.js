/**
 * Check ZIMRA Device Status
 * Verifies device is registered and can communicate with ZIMRA
 */

require('dotenv').config();
const { getDeviceClient } = require('../src/http/deviceClient');

const DEVICE_ID = process.env.FDMS_DEVICE_ID || process.env.DEVICE_ID;

async function checkDeviceStatus() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 ZIMRA DEVICE STATUS CHECK');
    console.log('='.repeat(60) + '\n');
    
    try {
        // Check environment variables
        console.log('📋 Configuration:');
        console.log(`   Device ID: ${DEVICE_ID}`);
        console.log(`   ZIMRA API URL: ${process.env.FDMS_API_URL || 'NOT SET'}`);
        console.log(`   Certificate Path: ${process.env.FDMS_CERT_PATH || 'NOT SET'}`);
        console.log(`   Certificate Password: ${process.env.FDMS_CERT_PASSWORD ? '***SET***' : 'NOT SET'}`);
        console.log('');
        
        // Try to get device client
        console.log('🔗 Connecting to ZIMRA...');
        const deviceClient = getDeviceClient();
        console.log('   ✅ Device client initialized');
        console.log('');
        
        // Try to get device configuration
        console.log('📡 Fetching device configuration...');
        try {
            const response = await deviceClient.get(`/Device/v1/${DEVICE_ID}/GetConfiguration`);
            
            if (response.data && response.data.data) {
                const config = response.data.data;
                
                console.log('   ✅ Device configuration retrieved!\n');
                console.log('📊 Device Information:');
                console.log(`   Taxpayer Name: ${config.taxpayerName || 'N/A'}`);
                console.log(`   TIN: ${config.taxpayerTIN || 'N/A'}`);
                console.log(`   VAT Number: ${config.taxpayerVATNumber || 'N/A'}`);
                console.log(`   Operating Mode: ${config.operatingMode || 'N/A'}`);
                console.log(`   Max Day Hours: ${config.maxDayHours || 'N/A'}`);
                console.log(`   VAT Status: ${config.vatStatus || 'N/A'}`);
                console.log('');
                
                console.log('✅ DEVICE IS ONLINE AND RESPONDING');
                console.log('');
                
                return true;
            } else {
                console.log('   ❌ Unexpected response format');
                console.log(`   Response: ${JSON.stringify(response.data)}`);
                return false;
            }
        } catch (apiError) {
            console.log('   ❌ Failed to get configuration');
            console.log(`   Error: ${apiError.message}`);
            
            if (apiError.response) {
                console.log(`   Status: ${apiError.response.status}`);
                console.log(`   Data: ${JSON.stringify(apiError.response.data)}`);
            }
            
            return false;
        }
        
    } catch (error) {
        console.log('❌ ERROR:');
        console.log(`   ${error.message}`);
        console.log('');
        
        if (error.code === 'ENOTFOUND') {
            console.log('   💡 Cannot resolve ZIMRA API URL');
            console.log('   Check: FDMS_API_URL in .env');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('   💡 Connection refused by ZIMRA');
            console.log('   Check: Network connectivity, firewall, VPN');
        } else if (error.code === 'CERT_HAS_EXPIRED') {
            console.log('   💡 Device certificate has expired');
            console.log('   Check: FDMS_CERT_PATH and certificate validity');
        }
        
        return false;
    }
}

// Run check
checkDeviceStatus().then(success => {
    console.log('='.repeat(60));
    if (success) {
        console.log('✅ Device is ready for fiscalization!');
    } else {
        console.log('❌ Device check failed - see errors above');
    }
    console.log('='.repeat(60) + '\n');
    
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
