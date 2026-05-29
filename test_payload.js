const fs = require('fs');

// Test the exact payload structure
const payload = {
  receipt: {
    receiptType: "FiscalInvoice",
    receiptCurrency: "USD",
    receiptCounter: 1,
    receiptGlobalNo: 1,
    invoiceNo: "INV-TEST-001",
    receiptDate: "2026-05-21T13:24:32",
    receiptLinesTaxInclusive: true,
    receiptNotes: null,
    buyerData: null,
    creditDebitNote: null,
    receiptLines: [
      {
        receiptLineType: "Sale",
        receiptLineNo: 1,
        receiptLineHSCode: "10019900",
        receiptLineName: "Test Product",
        receiptLinePrice: 86.96,
        receiptLineQuantity: 1.0,
        receiptLineTotal: 86.96
      }
    ],
    receiptTaxes: [
      {
        taxCode: "A",
        taxPercent: 15.5,
        taxID: 1,
        taxAmount: 13.48,
        salesAmountWithTax: 100.44
      }
    ],
    receiptPayments: [
      {
        moneyTypeCode: "Cash",
        paymentAmount: 100.44
      }
    ],
    receiptTotal: 100.44,
    receiptPrintForm: "Receipt48"
  }
};

console.log('Payload structure:');
console.log(JSON.stringify(payload, null, 2));

// Save to file for inspection
fs.writeFileSync('test_payload.json', JSON.stringify(payload, null, 2));
console.log('\nPayload saved to test_payload.json');
