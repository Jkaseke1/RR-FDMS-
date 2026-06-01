/**
 * resetForNewClient.js
 * ---------------------------------------------------------------
 * Prepares a fresh copy of the FDMS Bridge for a NEW client.
 * It clears all client-specific runtime data so you start clean:
 *   - C:\FDMS\state.json        (counters, fiscal day, processed invoices)
 *   - C:\FDMS\logs\*.log         (old log files)
 *   - certs\*                    (old device certificates)
 *
 * It does NOT touch source code or templates.
 *
 * Usage:
 *   node scripts/resetForNewClient.js          (dry run - shows what it will do)
 *   node scripts/resetForNewClient.js --confirm (actually performs the reset)
 * ---------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');

const CONFIRM = process.argv.includes('--confirm');

const FDMS_DIR   = process.env.FDMS_DIR || 'C:\\FDMS';
const STATE_FILE = path.join(FDMS_DIR, 'state.json');
const LOGS_DIR   = path.join(FDMS_DIR, 'logs');
const CERTS_DIR  = path.join(__dirname, '..', 'certs');

function log(msg) { console.log(msg); }

function deleteFile(file) {
  if (!fs.existsSync(file)) { log(`  (skip) not found: ${file}`); return; }
  if (CONFIRM) { fs.unlinkSync(file); log(`  DELETED: ${file}`); }
  else         { log(`  would delete: ${file}`); }
}

function emptyDir(dir, ext) {
  if (!fs.existsSync(dir)) { log(`  (skip) not found: ${dir}`); return; }
  const files = fs.readdirSync(dir).filter(f => !ext || f.endsWith(ext));
  if (files.length === 0) { log(`  (empty) ${dir}`); return; }
  for (const f of files) {
    const full = path.join(dir, f);
    if (CONFIRM) { fs.unlinkSync(full); log(`  DELETED: ${full}`); }
    else         { log(`  would delete: ${full}`); }
  }
}

log('\n========================================');
log('  FDMS Bridge - Reset For New Client');
log('========================================');
log(CONFIRM ? 'MODE: LIVE (changes will be made)\n' : 'MODE: DRY RUN (no changes - add --confirm to apply)\n');

log('1) Counter / fiscal-day state:');
deleteFile(STATE_FILE);

log('\n2) Old log files:');
emptyDir(LOGS_DIR, '.log');

log('\n3) Old device certificates:');
emptyDir(CERTS_DIR);

log('\n----------------------------------------');
if (CONFIRM) {
  log('Reset complete. Next steps:');
} else {
  log('Dry run finished. Re-run with --confirm to apply. Then:');
}
log('  1. Copy .env.template -> .env and fill in new client values');
log('  2. Copy dashboard/.env.template -> dashboard/.env (or edit dashboard/src/config/company.js)');
log('  3. Register the device:  npm run setup');
log('  4. Open fiscal day:      npm run openday');
log('  5. Match the PDF invoice template in src/utils/invoicePdfParser.js');
log('  6. Test:                 npm run pdf:process');
log('========================================\n');
