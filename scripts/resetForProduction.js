/**
 * Reset system for PRODUCTION deployment
 * Clears all test data while preserving tax configuration
 */

const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(70));
console.log('  FDMS Bridge - Production Reset');
console.log('  Device: RapidR-1 (ID: 41885)');
console.log('='.repeat(70) + '\n');

// Paths
const FDMS_DIR = 'C:\\FDMS';
const STATE_FILE = path.join(FDMS_DIR, 'state.json');
const LOGS_DIR = path.join(FDMS_DIR, 'logs');

// Backup old state
if (fs.existsSync(STATE_FILE)) {
  const backupPath = path.join(FDMS_DIR, `state.json.backup.${Date.now()}`);
  fs.copyFileSync(STATE_FILE, backupPath);
  console.log('✅ Old state backed up to:', backupPath);
  
  // Read old state to preserve tax config
  let oldState = {};
  try {
    oldState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    console.log('⚠️  Could not read old state, starting fresh');
  }
  
  // Create fresh production state
  const productionState = {
    deviceID: 41885,
    deviceSerial: 'RapidR-1',
    environment: 'production',
    receiptCounter: 0,
    receiptGlobalNo: 0,
    fiscalDayNo: 0,
    fiscalDayStatus: 'closed',
    lastReceiptDate: null,
    lastReceiptHash: '',
    processedInvoices: {},
    processedCreditNotes: {},
    failedReceipts: {},
    // Preserve tax config if available
    taxConfig: oldState.taxConfig || {
      vatTaxID: 517,
      vatPercent: 15.5,
      zeroTaxID: 2,
      exemptTaxID: 1
    },
    // Reset fiscal counters
    fiscalCounters: {},
    // Production flag
    isProduction: true,
    resetDate: new Date().toISOString()
  };
  
  fs.writeFileSync(STATE_FILE, JSON.stringify(productionState, null, 2));
  console.log('✅ State reset for production');
  console.log('   Receipt Counter: 0');
  console.log('   Receipt Global No: 0');
  console.log('   Fiscal Day: closed');
  console.log('   Device ID: 41885');
  
} else {
  console.log('⚠️  No existing state.json found');
}

// Clear old logs (optional)
const logFiles = fs.existsSync(LOGS_DIR) 
  ? fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.log'))
  : [];

if (logFiles.length > 0) {
  console.log('\n📋 Old log files found:', logFiles.length);
  logFiles.forEach(f => {
    const logPath = path.join(LOGS_DIR, f);
    const backupName = f.replace('.log', `.backup.${Date.now()}.log`);
    fs.renameSync(logPath, path.join(LOGS_DIR, backupName));
    console.log('   Archived:', f, '→', backupName);
  });
}

// Verify certificate
const certsDir = path.join(__dirname, '..', 'certs');
const p12Path = path.join(certsDir, 'RapidR-1.p12');
const certPath = path.join(certsDir, 'device.crt.pem');

console.log('\n📋 Certificate Check:');
if (fs.existsSync(p12Path)) {
  const stats = fs.statSync(p12Path);
  console.log('✅ P12 Certificate:', p12Path);
  console.log('   Size:', stats.size, 'bytes');
} else {
  console.log('❌ P12 Certificate not found:', p12Path);
}

if (fs.existsSync(certPath)) {
  const certContent = fs.readFileSync(certPath, 'utf8');
  const cnMatch = certContent.match(/CN=([^\n]+)/);
  console.log('✅ PEM Certificate:', certPath);
  if (cnMatch) {
    console.log('   Subject:', cnMatch[0]);
    if (cnMatch[1].includes('41885')) {
      console.log('   ✅ Certificate matches Device ID 41885');
    } else {
      console.log('   ⚠️  Certificate subject may not match device 41885');
    }
  }
} else {
  console.log('❌ PEM Certificate not found:', certPath);
}

console.log('\n' + '='.repeat(70));
console.log('  Production Reset Complete!');
console.log('='.repeat(70));
console.log('\nNext Steps:');
console.log('1. Open fiscal day: node scripts/openFiscalDay.js');
console.log('2. Test connection: node scripts/testConnection.js');
console.log('3. Start service: node index.js');
console.log('\n⚠️  IMPORTANT:');
console.log('   - Old state backed up');
console.log('   - Counters reset to 0');
console.log('   - Ready for production receipts');
console.log('='.repeat(70) + '\n');
