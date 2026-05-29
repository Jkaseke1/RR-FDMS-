/**
 * Test Invoice Submission
 * Tests standard invoice submission to ZIMRA
 */

const { submitReceipt } = require('../src/receipts/submitReceipt');

const DEVICE_ID = '35224';

// Sample invoice data
const testInvoice = {
  receiptType: 0, // 0 = Invoice
  receiptCurrency: 'USD',
  receiptCounter: 1,
  receiptGlobalNo: 'RR-2024-0001',
  receiptDate: new Date().toISOString(),
  receiptLinesTaxInclusive: true,
  receiptPrintForm: 0,
  invoiceNo: 'INV-TEST-001',
  
  // Buyer information
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
  receiptNotes: 'Payment terms: 30 days. Thank you for your business.',
  
  // Line items
  receiptLines: [
    {
      receiptLineType: 0, // 0 = Sale
      receiptLineNo: 1,
      receiptLineHSCode: '12345678',
      receiptLineName: 'Test Product A',
      receiptLinePrice: 100.00,
      receiptLineQuantity: 2,
      receiptLineTotal: 200.00,
      taxPercent: 15.5,
      taxID: 1
    },
    {
      receiptLineType: 0,
      receiptLineNo: 2,
      receiptLineHSCode: '87654321',
      receiptLineName: 'Test Product B',
      receiptLinePrice: 50.00,
      receiptLineQuantity: 3,
      receiptLineTotal: 150.00,
      taxPercent: 15.5,
      taxID: 1
    }
  ],
  
  // Payment information
  receiptPayments: [
    {
      moneyTypeCode: 'CASH',
      paymentAmount: 404.25
    }
  ],
  
  // Tax summary
  receiptTaxes: [
    {
      taxID: 1,
      taxPercent: 15.5,
      taxAmount: 54.25,
      salesAmountWithTax: 404.25
    }
  ],
  
  // Total
  receiptTotal: 404.25
};

async function testInvoiceSubmission() {
  console.log('='.repeat(60));
  console.log('🧪 TEST: Invoice Submission');
  console.log('='.repeat(60));
  console.log();
  
  console.log('📄 Invoice Details:');
  console.log(`   Invoice No: ${testInvoice.invoiceNo}`);
  console.log(`   Global No: ${testInvoice.receiptGlobalNo}`);
  console.log(`   Customer: ${testInvoice.buyerData.buyerRegisterName}`);
  console.log(`   Total: ${testInvoice.receiptCurrency} ${testInvoice.receiptTotal}`);
  console.log(`   Items: ${testInvoice.receiptLines.length}`);
  console.log();
  
  try {
    const result = await submitReceipt(DEVICE_ID, testInvoice);
    
    console.log();
    console.log('✅ SUCCESS: Invoice submitted successfully!');
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
    console.log('❌ FAILED: Invoice submission failed');
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
  testInvoiceSubmission()
    .then(() => {
      console.log('\n✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed');
      process.exit(1);
    });
}

module.exports = { testInvoiceSubmission, testInvoice };
