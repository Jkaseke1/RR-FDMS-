/**
 * Run All Receipt Tests
 * Tests invoice, debit note, and credit note submissions
 */

const { testInvoiceSubmission } = require('./testInvoice');
const { testDebitNoteSubmission } = require('./testDebitNote');
const { testCreditNoteSubmission } = require('./testCreditNote');

async function runAllTests() {
  console.log('\n');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(10) + 'FDMS RECEIPT TESTING SUITE' + ' '.repeat(22) + '║');
  console.log('║' + ' '.repeat(15) + 'Rapid Roots Investment' + ' '.repeat(21) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log('\n');

  const results = {
    invoice: null,
    debitNote: null,
    creditNote: null
  };

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  // Test 1: Invoice
  console.log('📝 Test 1/3: Invoice Submission');
  console.log('-'.repeat(60));
  try {
    totalTests++;
    results.invoice = await testInvoiceSubmission();
    passedTests++;
    console.log('✅ Invoice test PASSED\n');
  } catch (error) {
    failedTests++;
    console.log('❌ Invoice test FAILED\n');
  }

  // Wait 2 seconds between tests
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Debit Note
  console.log('📝 Test 2/3: Debit Note Submission');
  console.log('-'.repeat(60));
  try {
    totalTests++;
    results.debitNote = await testDebitNoteSubmission();
    passedTests++;
    console.log('✅ Debit Note test PASSED\n');
  } catch (error) {
    failedTests++;
    console.log('❌ Debit Note test FAILED\n');
  }

  // Wait 2 seconds between tests
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: Credit Note
  console.log('📝 Test 3/3: Credit Note Submission');
  console.log('-'.repeat(60));
  try {
    totalTests++;
    results.creditNote = await testCreditNoteSubmission();
    passedTests++;
    console.log('✅ Credit Note test PASSED\n');
  } catch (error) {
    failedTests++;
    console.log('❌ Credit Note test FAILED\n');
  }

  // Print summary
  console.log('\n');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(20) + 'TEST SUMMARY' + ' '.repeat(26) + '║');
  console.log('╠' + '═'.repeat(58) + '╣');
  console.log(`║  Total Tests:    ${totalTests}` + ' '.repeat(44) + '║');
  console.log(`║  Passed:         ${passedTests}` + ' '.repeat(44) + '║');
  console.log(`║  Failed:         ${failedTests}` + ' '.repeat(44) + '║');
  console.log(`║  Success Rate:   ${((passedTests / totalTests) * 100).toFixed(1)}%` + ' '.repeat(41) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log('\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED! Ready for production.');
    console.log('\n');
    
    // Print receipt IDs
    console.log('📋 Receipt IDs:');
    if (results.invoice) {
      console.log(`   Invoice:     ${results.invoice.fdmsReceiptId}`);
    }
    if (results.debitNote) {
      console.log(`   Debit Note:  ${results.debitNote.fdmsReceiptId}`);
    }
    if (results.creditNote) {
      console.log(`   Credit Note: ${results.creditNote.fdmsReceiptId}`);
    }
    console.log('\n');
    
    return true;
  } else {
    console.log('⚠️  SOME TESTS FAILED. Please review errors above.');
    console.log('\n');
    return false;
  }
}

// Run tests if called directly
if (require.main === module) {
  runAllTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed with error:', error.message);
      process.exit(1);
    });
}

module.exports = { runAllTests };
