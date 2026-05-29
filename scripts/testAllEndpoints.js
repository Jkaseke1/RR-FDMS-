/**
 * Test All ZIMRA Endpoints
 * Checks which endpoints are reachable and working
 */

require('dotenv').config();
const { getDeviceClient } = require('../src/http/deviceClient');

const DEVICE_ID = process.env.FDMS_DEVICE_ID || '35224';

async function testAllEndpoints() {
    console.log('\n' + '='.repeat(70));
    console.log('🔍 TESTING ALL ZIMRA ENDPOINTS');
    console.log('='.repeat(70) + '\n');
    
    const deviceClient = getDeviceClient();
    
    // Endpoints organized by purpose
    const endpoints = {
        'Device Status': [
            { method: 'GET', path: `/Device/v1/${DEVICE_ID}/GetStatus`, description: 'Get device status' },
            { method: 'GET', path: `/Device/v1/${DEVICE_ID}/GetConfiguration`, description: 'Get device config' }
        ],
        'Fiscal Day': [
            { method: 'POST', path: `/Device/v1/${DEVICE_ID}/OpenDay`, description: 'Open fiscal day' },
            { method: 'POST', path: `/Device/v1/${DEVICE_ID}/CloseDay`, description: 'Close fiscal day' }
        ],
        'Receipt Submission': [
            { method: 'POST', path: `/Device/v1/${DEVICE_ID}/SubmitReceipt`, description: 'Submit receipt to ZIMRA' }
        ],
        'Health Check': [
            { method: 'GET', path: `/Device/v1/${DEVICE_ID}/Ping`, description: 'Ping device' },
            { method: 'POST', path: `/Device/v1/${DEVICE_ID}/Ping`, description: 'Ping device (POST)' }
        ]
    };
    
    let results = {};
    
    for (const [category, categoryEndpoints] of Object.entries(endpoints)) {
        console.log(`📋 ${category}:`);
        console.log('-'.repeat(70));
        
        results[category] = [];
        
        for (const endpoint of categoryEndpoints) {
            try {
                let response;
                
                if (endpoint.method === 'GET') {
                    response = await deviceClient.get(endpoint.path);
                } else if (endpoint.method === 'POST') {
                    response = await deviceClient.post(endpoint.path, {});
                }
                
                console.log(`   ✅ ${endpoint.method} ${endpoint.path}`);
                console.log(`      ${endpoint.description}`);
                console.log(`      Status: ${response.status}\n`);
                
                results[category].push({
                    endpoint: endpoint.path,
                    method: endpoint.method,
                    status: 'OK',
                    code: response.status
                });
                
            } catch (error) {
                const status = error.response?.status || 'ERROR';
                const statusText = error.response?.statusText || error.message;
                
                console.log(`   ❌ ${endpoint.method} ${endpoint.path}`);
                console.log(`      ${endpoint.description}`);
                console.log(`      Status: ${status} - ${statusText}\n`);
                
                results[category].push({
                    endpoint: endpoint.path,
                    method: endpoint.method,
                    status: 'FAILED',
                    code: status
                });
            }
        }
    }
    
    // Summary
    console.log('='.repeat(70));
    console.log('📊 SUMMARY\n');
    
    let totalOK = 0;
    let totalFailed = 0;
    
    for (const [category, categoryResults] of Object.entries(results)) {
        const ok = categoryResults.filter(r => r.status === 'OK').length;
        const failed = categoryResults.filter(r => r.status === 'FAILED').length;
        
        totalOK += ok;
        totalFailed += failed;
        
        console.log(`${category}: ${ok}/${categoryResults.length} working`);
    }
    
    console.log(`\nTotal: ${totalOK} working, ${totalFailed} failed`);
    console.log('='.repeat(70) + '\n');
    
    if (totalOK >= 2) {
        console.log('✅ ENOUGH ENDPOINTS WORKING FOR FISCALIZATION\n');
        return true;
    } else {
        console.log('⚠️  LIMITED ENDPOINT AVAILABILITY\n');
        return false;
    }
}

// Run test
testAllEndpoints().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
