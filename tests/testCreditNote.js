/**
 * Test Credit Note Submission
 * Tests credit note (refund/return) submission to ZIMRA
 */

const { submitReceipt } = require('../src/receipts/submitReceipt');

const DEVICE_ID = '35224';

// Sample credit note data
const testCreditNote = {
  receiptType: 2, // 2 = Credit Note
  receiptCurrency: 'USD',
  receiptCounter: 3,
  receiptGlobalNo: 'RR-2024-0003',
  receiptDate: new Date().toISOString(),
  receiptLinesTaxInclusive: true,
  receiptPrintForm: 0,
  invoiceNo: 'CN-TEST-001',
  
  // Credit/Debit note specific fields
  creditDebitNote: {
    originalInvoiceNo: 'INV-TEST-001', // Reference to original invoice
    receiptDeviceNo: DEVICE_ID,
    reason: 'Product return - customer not satisfied with quality'
  },
  
  // Buyer information (same as original invoice)
  buyerData: {
    buyerRegisterName: 'Test Customer Ltd',
    buyerTIN: '1234567890',
    buyerAddress: '123 Test Street, Harare',
    buyerContacts: {
      phoneNo: '+263771234567',
      email: 'customer@testcompany.co.zw'
    }
  },
  
  // Receipt notes
  receiptNotes: 'Credit Note: Product return - refund issued',
  
  // Line items (returned items - negative amounts)
  receiptLines: [
    {
      receiptLineType: 0,
      receiptLineNo: 1,
      receiptLineHSCode: '87654321',
      receiptLineName: 'Test Product B (Returned)',
      receiptLinePrice: -50.00, // Negative for credit
      receiptLineQuantity: 3,
      receiptLineTotal: -150.00, // Negative total
      taxPercent: 15.5,
      taxID: 1
    }
  ],
  
  // Payment information (refund)
  receiptPayments: [
    {
      moneyTypeCode: 'CASH',
      paymentAmount: -173.25 // Negative for refund
    }
  ],
  
  // Tax summary (negative for refund)
  receiptTaxes: [
    {
      taxID: 1,
      taxPercent: 15.5,
      taxAmount: -23.25, // Negative tax
      salesAmountWithTax: -173.25
    }
  ],
  
  // Total (negative for credit)
  receiptTotal: -173.25
};

async function testCreditNoteSubmission() {
  console.log('='.repeat(60));
  console.log('🧪 TEST: Credit Note Submission');
  console.log('='.repeat(60));
  console.log();
  
  console.log('📄 Credit Note Details:');
  console.log(`   Credit Note No: ${testCreditNote.invoiceNo}`);
  console.log(`   Global No: ${testCreditNote.receiptGlobalNo}`);
  console.log(`   Original Invoice: ${testCreditNote.creditDebitNote.originalInvoiceNo}`);
  console.log(`   Reason: ${testCreditNote.creditDebitNote.reason}`);
  console.log(`   Customer: ${testCreditNote.buyerData.buyerRegisterName}`);
  console.log(`   Refund Amount: ${testCreditNote.receiptCurrency} ${Math.abs(testCreditNote.receiptTotal)}`);
  console.log(`   Items: ${testCreditNote.receiptLines.length}`);
  console.log();
  
  try {
    const result = await submitReceipt(DEVICE_ID, testCreditNote);
    
    console.log();
    console.log('✅ SUCCESS: Credit Note submitted successfully!');
    console.log('='.repeat(60));
    console.log('📋 Result:');
    console.log(`   Receipt ID: ${result.fdmsReceiptId}`);
    console.log(`   Global No: ${result.receiptGlobalNo}`);
    console.log(`   Operation ID: ${result.operationID}`);
    console.log(`   QR Code: ${result.qrCode.substring(0, 50)}...`);
    console.log('='.repeat(60));
    
    return result;
    
  } catch (error) {
    console.log();
    console.log('❌ FAILED: Credit Note submission failed');
    console.log('='.repeat(60));
    console.log('Error Details:');
    console.log(`   Message: ${error.message}`);
    if (error.fdmsError) {
      console.log(`   FDMS Error Code: ${error.fdmsError.errorCode}`);
      console.log(`   Detail: ${error.fdmsError.detail}`);
    }
    console.log('='.repeat(60));
    
    throw error;
  }
}

// Run test if called directly
if (require.main === module) {
  testCreditNoteSubmission()
    .then(() => {
      console.log('\n✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed');
      process.exit(1);
    });
}

module.exports = { testCreditNoteSubmission, testCreditNote };
