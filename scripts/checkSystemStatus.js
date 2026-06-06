/**
 * Check Complete System Status
 * Verifies device, fiscal day, and overall system health
 */

require('dotenv').config();
const { getDeviceClient } = require('../src/http/deviceClient');
const { supabase } = require('../src/db/supabaseClient');

const DEVICE_ID = process.env.FDMS_DEVICE_ID || process.env.DEVICE_ID;

async function checkSystemStatus() {
    console.log('\n' + '='.repeat(70));
    console.log('🔍 COMPLETE SYSTEM STATUS CHECK');
    console.log('='.repeat(70) + '\n');
    
    let allGood = true;
    
    try {
        // 1. Check Configuration
        console.log('📋 CONFIGURATION');
        console.log('-'.repeat(70));
        console.log(`   Device ID: ${DEVICE_ID}`);
        console.log(`   ZIMRA API URL: ${process.env.FDMS_API_URL || 'NOT SET'}`);
        console.log(`   Certificate: ${process.env.FDMS_CERT_PATH || 'NOT SET'}`);
        console.log(`   Supabase: ${process.env.SUPABASE_URL ? '✅ SET' : '❌ NOT SET'}`);
        console.log('');
        
        // 2. Check Device Connection
        console.log('🔗 DEVICE CONNECTION');
        console.log('-'.repeat(70));
        try {
            const deviceClient = getDeviceClient();
            console.log('   ✅ Device client initialized');
            
            const response = await deviceClient.get(`/Device/v1/${DEVICE_ID}/GetConfiguration`);
            
            if (response.data && response.data.data) {
                const config = response.data.data;
                console.log('   ✅ Device is ONLINE\n');
                console.log('   Device Info:');
                console.log(`      Taxpayer: ${config.taxpayerName || 'N/A'}`);
                console.log(`      TIN: ${config.taxpayerTIN || 'N/A'}`);
                console.log(`      Operating Mode: ${config.operatingMode || 'N/A'}`);
                console.log('');
            } else {
                console.log('   ❌ Unexpected response format\n');
                allGood = false;
            }
        } catch (error) {
            console.log(`   ❌ Device connection failed: ${error.message}\n`);
            allGood = false;
        }
        
        // 3. Check Fiscal Day
        console.log('📅 FISCAL DAY STATUS');
        console.log('-'.repeat(70));
        try {
            const { data: fiscalDays, error } = await supabase
                .from('fiscal_days')
                .select('*')
                .eq('device_id', DEVICE_ID)
                .order('created_at', { ascending: false })
                .limit(1);
            
            if (error) {
                console.log(`   ❌ Error fetching fiscal day: ${error.message}\n`);
                allGood = false;
            } else if (fiscalDays && fiscalDays.length > 0) {
                const fiscalDay = fiscalDays[0];
                console.log('   ✅ Fiscal day found\n');
                console.log('   Latest Fiscal Day:');
                console.log(`      ID: ${fiscalDay.id}`);
                console.log(`      Fiscal Day No: ${fiscalDay.fiscal_day_no}`);
                console.log(`      Status: ${fiscalDay.status}`);
                console.log(`      Opened At: ${new Date(fiscalDay.opened_at).toLocaleString()}`);
                
                if (fiscalDay.status === 'open') {
                    console.log('      ✅ FISCAL DAY IS OPEN\n');
                } else {
                    console.log(`      ⚠️  FISCAL DAY IS ${fiscalDay.status.toUpperCase()}\n`);
                    allGood = false;
                }
            } else {
                console.log('   ⚠️  No fiscal day found\n');
                console.log('   💡 Run: npm run open-fiscal-day\n');
                allGood = false;
            }
        } catch (error) {
            console.log(`   ❌ Database error: ${error.message}\n`);
            allGood = false;
        }
        
        // 4. Check FDMS Folders
        console.log('📁 FDMS FOLDERS');
        console.log('-'.repeat(70));
        const fs = require('fs');
        const path = require('path');
        const FDMS_BASE = process.env.FDMS_BASE_PATH || 'C:\\FDMS';
        
        const folders = {
            unsigned: path.join(FDMS_BASE, 'unsigned'),
            signed: path.join(FDMS_BASE, 'signed'),
            failed: path.join(FDMS_BASE, 'failed'),
            logs: path.join(FDMS_BASE, 'logs')
        };
        
        let folderCount = 0;
        for (const [name, folderPath] of Object.entries(folders)) {
            if (fs.existsSync(folderPath)) {
                const files = fs.readdirSync(folderPath).length;
                console.log(`   ✅ ${name}: ${files} file(s)`);
                folderCount++;
            } else {
                console.log(`   ❌ ${name}: NOT FOUND`);
            }
        }
        console.log('');
        
        if (folderCount < 4) {
            console.log('   💡 Run: npm run fdms:setup\n');
            allGood = false;
        }
        
    } catch (error) {
        console.log(`❌ FATAL ERROR: ${error.message}\n`);
        allGood = false;
    }
    
    // Summary
    console.log('='.repeat(70));
    if (allGood) {
        console.log('✅ ALL SYSTEMS READY - Ready to fiscalize PDFs!');
        console.log('\n   Next: npm run pdf:watch');
    } else {
        console.log('⚠️  SOME ISSUES FOUND - See above for details');
        console.log('\n   Recommended:');
        console.log('   1. npm run open-fiscal-day');
        console.log('   2. npm run device:status');
        console.log('   3. npm run pdf:watch');
    }
    console.log('='.repeat(70) + '\n');
    
    return allGood;
}

// Run check
checkSystemStatus().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
