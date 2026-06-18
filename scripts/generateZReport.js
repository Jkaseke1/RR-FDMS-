require('dotenv').config();
const fs = require('fs');
const path = require('path');

const STATE_FILE = process.env.STATE_FILE_PATH || 'C:\\FDMS\\state.json';

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error('State file not found: ' + STATE_FILE);
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function generateZReport() {
  const state = loadState();
  const deviceID = process.env.FDMS_DEVICE_ID;
  const deviceSerial = state.deviceSerial || 'Unknown';
  
  console.log('================================================');
  console.log('              Z REPORT');
  console.log('================================================');
  console.log('');
  console.log(`Fiscal day No: ${state.fiscalDayNo}`);
  console.log(`Fiscal day opened: ${state.fiscalDayOpened}`);
  console.log(`Fiscal day status: ${state.fiscalDayStatus}`);
  console.log(`Device Serial No: ${deviceSerial}`);
  console.log(`Device Id: ${deviceID}`);
  console.log('================================================');
  console.log('Daily totals');
  console.log('================================================');
  
  // Process each currency
  const currencies = Object.keys(state.fiscalCounters || {});
  
  if (currencies.length === 0) {
    console.log('No transactions recorded for this fiscal day.');
    return;
  }
  
  currencies.forEach(currency => {
    const counters = state.fiscalCounters[currency];
    
    console.log('');
    console.log(currency);
    console.log('------------------------------------------------');
    console.log('Total net sales');
    
    const netAmount = (counters.salesAmountWithTax || 0) - (counters.taxAmount || 0);
    console.log(`  Net, VAT ${counters.taxPercent || 15.5}%: ${netAmount.toFixed(2)}`);
    console.log(`Total net amount: ${netAmount.toFixed(2)}`);
    
    console.log('------------------------------------------------');
    console.log('Total taxes');
    console.log(`  Tax, VAT ${counters.taxPercent || 15.5}%: ${(counters.taxAmount || 0).toFixed(2)}`);
    console.log(`Total tax amount: ${(counters.taxAmount || 0).toFixed(2)}`);
    
    console.log('------------------------------------------------');
    console.log('Total gross sales');
    console.log(`  Total, VAT ${counters.taxPercent || 15.5}%: ${(counters.salesAmountWithTax || 0).toFixed(2)}`);
    console.log(`Total gross amount: ${(counters.salesAmountWithTax || 0).toFixed(2)}`);
    
    console.log('------------------------------------------------');
    console.log('Documents');
    console.log(`  Invoices: ${state.receiptCounter || 0} receipts, ${(counters.salesAmountWithTax || 0).toFixed(2)}`);
    console.log(`  Total documents: ${state.receiptCounter || 0}, ${(counters.salesAmountWithTax || 0).toFixed(2)}`);
    console.log('================================================');
  });
  
  console.log('');
  console.log('Receipt Counter: ' + state.receiptCounter);
  console.log('Global Receipt No: ' + state.receiptGlobalNo);
  console.log('');
  console.log('================================================');
  console.log('End of Z Report');
  console.log('================================================');
}

try {
  generateZReport();
} catch (error) {
  console.error('Error generating Z-Report:', error.message);
  process.exit(1);
}
