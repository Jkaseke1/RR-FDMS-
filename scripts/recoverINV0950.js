require('dotenv').config();
const path = require('path');
const { recoverINV0950CreditNote } = require('../src/integrations/pdfFiscalizationService');

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--submit')) {
  console.error('Usage: node scripts/recoverINV0950.js [--submit]');
  process.exit(1);
}
const source = path.join(process.env.FDMS_BASE_PATH || 'C:\\FDMS',
  'recovery', 'Credit Note_20261028_112431.pdf');
recoverINV0950CreditNote(source, args[0] === '--submit').then(() => {
  console.log(args[0] === '--submit'
    ? 'Keep service stopped. Send the accepted credit note details to ZIMRA for manual closure of day 68.'
    : 'Dry run only: no receipt submitted and no counters changed.');
  process.exit(0);
}).catch(error => {
  console.error(error.message);
  process.exit(1);
});
