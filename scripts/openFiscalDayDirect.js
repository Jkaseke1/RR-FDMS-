/**
 * Open Fiscal Day - Direct API Call (No Supabase Required)
 * 
 * Usage: node scripts/openFiscalDayDirect.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const DEVICE_ID = process.env.FDMS_DEVICE_ID || process.env.DEVICE_ID || '41885';

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data, headers: res.headers });
        }
      });
    });
    
    req.on('error', (err) => reject(err));
    
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    
    req.end();
  });
}

async function openFiscalDay() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║         OPEN FISCAL DAY - Direct API Call              ║');
  console.log('║           Rapid Roots Investment Pvt Ltd              ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  const certPath = path.resolve('certs/device.crt.pem');
  const keyPath = path.resolve('certs/device.key.pem');
  const caPath = path.resolve('certs/fdms-root-ca.pem');
  
  // Step 1: Check current status first
  console.log('Step 1: Checking device status...');
  
  const statusOptions = {
    hostname: 'fdmsapi.zimra.co.zw',
    port: 443,
    path: `/Device/v1/${DEVICE_ID}/GetConfig`,
    method: 'GET',
    headers: {
      'DeviceModelName': 'Server',
      'DeviceModelVersion': 'v1',
      'Content-Type': 'application/json'
    },
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
    ca: fs.readFileSync(caPath),
    rejectUnauthorized: false,
    timeout: 30000
  };
  
  try {
    const statusResult = await makeRequest(statusOptions);
    
    if (statusResult.statusCode === 200) {
      console.log('✅ Device online');
      console.log(`   Company: ${statusResult.data.taxPayerName}`);
      console.log(`   TIN: ${statusResult.data.taxPayerTIN}`);
      console.log(`   VAT: ${statusResult.data.vatNumber}`);
      console.log(`   Mode: ${statusResult.data.deviceOperatingMode}`);
      console.log(`   Max Day Hours: ${statusResult.data.taxPayerDayMaxHrs}`);
    } else {
      console.log('❌ Failed to get device status:', statusResult.statusCode);
      console.log('Response:', JSON.stringify(statusResult.data, null, 2));
      process.exit(1);
    }
    
    const statePath = 'C:\\FDMS\\state.json';
    let state = {};
    if (fs.existsSync(statePath)) {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    }

    const getStatusOptions = {
      ...statusOptions,
      path: `/Device/v1/${DEVICE_ID}/GetStatus`
    };
    const fiscalStatusResult = await makeRequest(getStatusOptions);

    if (fiscalStatusResult.statusCode !== 200) {
      console.log('❌ Failed to get fiscal day status:', fiscalStatusResult.statusCode);
      console.log('Response:', JSON.stringify(fiscalStatusResult.data, null, 2));
      process.exit(1);
    }

    const fiscalStatus = fiscalStatusResult.data;
    console.log(`   Fiscal Day Status: ${fiscalStatus.fiscalDayStatus}`);
    console.log(`   Last Fiscal Day:   ${fiscalStatus.lastFiscalDayNo}`);
    console.log(`   Last Global No:    ${fiscalStatus.lastReceiptGlobalNo}`);

    if (fiscalStatus.fiscalDayStatus === 'FiscalDayOpened') {
      state.fiscalDayNo = fiscalStatus.lastFiscalDayNo;
      state.fiscalDayStatus = 'FiscalDayOpened';
      if (Number.isFinite(Number(fiscalStatus.lastReceiptGlobalNo))) {
        state.receiptGlobalNo = Number(fiscalStatus.lastReceiptGlobalNo);
      }
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

      console.log('\n✅ Fiscal day is already open on ZIMRA. Local state synced.');
      console.log(`   Fiscal Day Number: ${state.fiscalDayNo}`);
      return;
    }

    if (fiscalStatus.fiscalDayStatus !== 'FiscalDayClosed') {
      console.log('\n❌ Cannot open fiscal day while ZIMRA status is:', fiscalStatus.fiscalDayStatus);
      if (fiscalStatus.fiscalDayClosingErrorCode) {
        console.log('Closing Error:', fiscalStatus.fiscalDayClosingErrorCode);
      }
      process.exit(1);
    }

    state.fiscalDayNo = Number(fiscalStatus.lastFiscalDayNo) || 0;
    state.fiscalDayStatus = 'FiscalDayClosed';
    if (Number.isFinite(Number(fiscalStatus.lastReceiptGlobalNo))) {
      state.receiptGlobalNo = Number(fiscalStatus.lastReceiptGlobalNo);
    }
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

    // Step 2: Open fiscal day
    console.log('\nStep 2: Opening fiscal day...');

    const now = new Date();
    const fiscalDayOpened = now.toISOString().split('.')[0]; // YYYY-MM-DDTHH:mm:ss
    const fiscalDayNo = state.fiscalDayNo + 1;
    
    const openOptions = {
      hostname: 'fdmsapi.zimra.co.zw',
      port: 443,
      path: `/Device/v1/${DEVICE_ID}/OpenDay`,
      method: 'POST',
      headers: {
        'DeviceModelName': 'Server',
        'DeviceModelVersion': 'v1',
        'Content-Type': 'application/json'
      },
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
      ca: fs.readFileSync(caPath),
      rejectUnauthorized: false,
      timeout: 30000
    };
    
    const openResult = await makeRequest(openOptions, {
      fiscalDayOpened,
      fiscalDayNo
    });
    
    if (openResult.statusCode === 200) {
      console.log('\n✅ FISCAL DAY OPENED SUCCESSFULLY!\n');
      console.log('═'.repeat(60));
      console.log('📋 Fiscal Day Details:');
      console.log('═'.repeat(60));
      console.log(`   Fiscal Day Number:  ${openResult.data.fiscalDayNo}`);
      console.log(`   Opened At:          ${fiscalDayOpened}`);
      console.log(`   Operation ID:       ${openResult.data.operationID}`);
      console.log('═'.repeat(60));
      
      // Update state.json
      state.fiscalDayNo = openResult.data.fiscalDayNo;
      state.fiscalDayStatus = 'FiscalDayOpened';
      state.fiscalDayOpened = fiscalDayOpened;
      state.lastReceiptDate = fiscalDayOpened;
      
      // Reset counters for new fiscal day
      state.receiptCounter = 0;
      // Note: receiptGlobalNo continues incrementing - do NOT reset
      state.fiscalCounters = {};
      // The receipt hash chain resets every fiscal day: the FIRST receipt of
      // a new day must carry NO previous hash, or ZIMRA's signature check
      // fails with error 202. In online mode ZIMRA auto-closes the day, so
      // closeFiscalDay() (which also clears this) never runs — clear it here.
      state.lastReceiptHash = null;
      delete state.processingBlocked;
      delete state.processingBlockedReason;
      delete state.processingBlockedAt;
      delete state.processingBlockedReceipt;
      delete state.autoCloseBlockedFiscalDayNo;
      delete state.autoCloseBlockedReason;
      delete state.autoCloseBlockedAt;
      delete state.autoCloseBlockedOperationID;
      
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
      console.log('\n✅ State updated');
      
      console.log('\n🎯 Next Steps:');
      console.log('   1. Start service: node index.js');
      console.log('   2. Process invoices from Sage');
      console.log('   3. Close fiscal day at end of business\n');
      
    } else if (openResult.statusCode === 400 && openResult.data.errors) {
      console.log('\n⚠️  Fiscal day may already be open or other issue');
      console.log('Status:', openResult.statusCode);
      console.log('Response:', JSON.stringify(openResult.data, null, 2));
      
      // Try to get current status
      console.log('\nChecking current fiscal day status...');
      
    } else {
      console.log('\n❌ Failed to open fiscal day');
      console.log('Status:', openResult.statusCode);
      console.log('Response:', JSON.stringify(openResult.data, null, 2));
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code) {
      console.error('   Code:', error.code);
    }
    process.exit(1);
  }
}

openFiscalDay();
