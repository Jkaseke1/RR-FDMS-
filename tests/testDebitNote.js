/**
 * Test Debit Note Submission
 * Tests debit note (price increase/correction) submission to ZIMRA
 */

const { submitReceipt } = require('../src/receipts/submitReceipt');

const DEVICE_ID = '35224';

// Sample debit note data
const testDebitNote = {
  receiptType: 1, // 1 = Debit Note
  receiptCurrency: 'USD',
  receiptCounter: 2,
  receiptGlobalNo: 'RR-2024-0002',
  receiptDate: new Date().toISOString(),
  receiptLinesTaxInclusive: true,
  receiptPrintForm: 0,
  invoiceNo: 'DN-TEST-001',
  
  // Credit/Debit note specific fields
  creditDebitNote: {
    originalInvoiceNo: 'INV-TEST-001', // Reference to original invoice
    receiptDeviceNo: DEVICE_ID,
    reason: 'Price correction - additional charges applied'
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
  receiptNotes: 'Debit Note: Additional charges for delivery and handling',
  
  // Line items (additional charges)
  receiptLines: [
    {
      receiptLineType: 0,
      receiptLineNo: 1,
      receiptLineHSCode: '99999999',
      receiptLineName: 'Delivery Charge',
      receiptLinePrice: 50.00,
      receiptLineQuantity: 1,
      receiptLineTotal: 50.00,
      taxPercent: 15.5,
      taxID: 1
    },
    {
      receiptLineType: 0,
      receiptLineNo: 2,
      receiptLineHSCode: '99999998',
      receiptLineName: 'Handling Fee',
      receiptLinePrice: 25.00,
      receiptLineQuantity: 1,
      receiptLineTotal: 25.00,
      taxPercent: 15.5,
      taxID: 1
    }
  ],
  
  // Payment information
  receiptPayments: [
    {
      moneyTypeCode: 'CASH',
      paymentAmount: 86.63
    }
  ],
  
  // Tax summary
  receiptTaxes: [
    {
      taxID: 1,
      taxPercent: 15.5,
      taxAmount: 11.63,
      salesAmountWithTax: 86.63
    }
  ],
  
  // Total (additional amount)
  receiptTotal: 86.63
};

async function testDebitNoteSubmission() {
  console.log('='.repeat(60));
  console.log('🧪 TEST: Debit Note Submission');
  console.log('='.repeat(60));
  console.log();
  
  console.log('📄 Debit Note Details:');
  console.log(`   Debit Note No: ${testDebitNote.invoiceNo}`);
  console.log(`   Global No: ${testDebitNote.receiptGlobalNo}`);
  console.log(`   Original Invoice: ${testDebitNote.creditDebitNote.originalInvoiceNo}`);
  console.log(`   Reason: ${testDebitNote.creditDebitNote.reason}`);
  console.log(`   Customer: ${testDebitNote.buyerData.buyerRegisterName}`);
  console.log(`   Additional Amount: ${testDebitNote.receiptCurrency} ${testDebitNote.receiptTotal}`);
  console.log(`   Items: ${testDebitNote.receiptLines.length}`);
  console.log();
  
  try {
    const result = await submitReceipt(DEVICE_ID, testDebitNote);
    
    console.log();
    console.log('✅ SUCCESS: Debit Note submitted successfully!');
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
    console.log('❌ FAILED: Debit Note submission failed');
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
  testDebitNoteSubmission()
    .then(() => {
      console.log('\n✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed');
      process.exit(1);
    });
}

module.exports = { testDebitNoteSubmission, testDebitNote };
