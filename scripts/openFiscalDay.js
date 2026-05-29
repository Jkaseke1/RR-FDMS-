/**
 * Open Fiscal Day Script
 * Opens a new fiscal day with proper counter initialization
 */

require('dotenv').config();
const { openDay } = require('../src/fiscalDay/openDay');

const DEVICE_ID = process.env.FDMS_DEVICE_ID || '35224';

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║         OPEN FISCAL DAY - ZIMRA FDMS Bridge           ║');
  console.log('║           Rapid Roots Investment Pvt Ltd              ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    console.log(`📅 Opening fiscal day for device ${DEVICE_ID}...\n`);
    
    const result = await openDay(DEVICE_ID);
    
    console.log('\n✅ FISCAL DAY OPENED SUCCESSFULLY!\n');
    console.log('═'.repeat(60));
    console.log('📋 Fiscal Day Details:');
    console.log('═'.repeat(60));
    console.log(`   Fiscal Day Number:  ${result.fiscalDayNo}`);
    console.log(`   Opened At:          ${result.openedAt}`);
    console.log(`   Max Hours:          ${result.maxHours} hours`);
    console.log(`   Operation ID:       ${result.operationID}`);
    console.log(`   Database ID:        ${result.fiscalDayId}`);
    console.log('═'.repeat(60));
    
    console.log('\n📊 Counter Initialization:');
    console.log('═'.repeat(60));
    console.log('   ✅ Receipt Counter:        0');
    console.log('   ✅ Fiscal Counters:        Ready (auto-initialized on first receipt)');
    console.log('   ✅ Tax Counters:           Ready (per tax type)');
    console.log('   ✅ Payment Counters:       Ready (per money type)');
    console.log('═'.repeat(60));
    
    console.log('\n📝 Counter Types (Auto-initialized):');
    console.log('   • SaleByTax           - Sales amount by tax type');
    console.log('   • SaleTaxByTax        - Tax amount by tax type');
    console.log('   • CreditNoteByTax     - Credit note amounts');
    console.log('   • CreditNoteTaxByTax  - Credit note tax amounts');
    console.log('   • DebitNoteByTax      - Debit note amounts');
    console.log('   • DebitNoteTaxByTax   - Debit note tax amounts');
    console.log('   • BalanceByMoneyType  - Payment balances by type');
    
    console.log('\n💡 How Counters Work:');
    console.log('   1. Counters start at 0 when fiscal day opens');
    console.log('   2. Each receipt submission updates relevant counters');
    console.log('   3. Counters accumulate throughout the fiscal day');
    console.log('   4. Counters are included in Z-Report when closing day');
    console.log('   5. Counters reset to 0 after successful day closure');
    
    console.log('\n🎯 Next Steps:');
    console.log('   1. Submit receipts using: npm run test:receipts');
    console.log('   2. Monitor counters in database: fiscal_day_counters table');
    console.log('   3. Close fiscal day using: npm run close-fiscal-day');
    
    console.log('\n✅ Ready to submit receipts!\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ FAILED TO OPEN FISCAL DAY\n');
    console.error('═'.repeat(60));
    console.error('Error Details:');
    console.error('═'.repeat(60));
    console.error(`   Message: ${error.message}`);
    
    if (error.fdmsError) {
      console.error(`   FDMS Error Code: ${error.fdmsError.errorCode}`);
      console.error(`   Detail: ${error.fdmsError.detail}`);
      console.error(`   Operation ID: ${error.fdmsError.operationID}`);
    }
    
    console.error('═'.repeat(60));
    
    console.error('\n💡 Common Issues:');
    console.error('   • Fiscal day already open - Close it first');
    console.error('   • Device offline - Check device status');
    console.error('   • Network error - Check internet connection');
    console.error('   • Certificate error - Check certificate validity');
    
    console.error('\n');
    process.exit(1);
  }
}

main();
