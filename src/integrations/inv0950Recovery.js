const assert = require('node:assert/strict');

function validateRecovery(state, pdf, deviceId) {
  assert.equal(String(deviceId), '41885', 'Unexpected device');
  assert.equal(state.fiscalDayNo, 68, 'Expected fiscal day 68');
  assert.equal(state.fiscalDayStatus, 'FiscalDayOpened');
  assert.equal(state.receiptGlobalNo, 271, 'Expected local global 271');
  assert.equal(state.receiptCounter, 16, 'Expected receipt counter 16');
  assert.equal(state.processingBlocked, true, 'Original block must remain active');
  assert.equal(state.processingBlockedReceipt?.invoiceNo, 'INV0950');
  assert.equal(state.processingBlockedReceipt?.receiptId, 467326274);
  const original = state.processedInvoices?.INV0950;
  assert.equal(original?.zimraReceiptId, 467326274);
  assert.equal(original.globalNo, 271);
  assert.equal(original.fiscalDayNo, 68);
  assert.equal(original.currency, 'USD');
  assert.equal(state.lastReceiptHash, 'Xbtl3qcSB2umyu2lHKIALDBWCximB9B1K4zAiTrQQpg=',
    'Receipt chain differs from the accepted INV0950 hash');
  assert.ok(!state.processedInvoices.CRN0129, 'CRN0129 already recorded; do not resubmit');
  assert.equal(pdf.documentType, 'credit_note');
  assert.equal(pdf.creditNoteNumber, 'CRN0129');
  assert.equal(pdf.originalInvoiceNumber, 'INV0950');
  assert.equal(pdf.currency, 'USD');
  assert.equal(pdf.customerTIN, null, 'Unexpected buyer TIN; review buyer details');
  assert.equal(pdf.totalIncl, 420);
  assert.equal(pdf.totalExcl, 363.64);
  assert.equal(pdf.taxAmount, 56.36);
  assert.equal(pdf.lineItems.length, 1);
  const line = pdf.lineItems[0];
  assert.equal(line.itemCode, 'LAWN001');
  assert.equal(String(line.hsCode), '12092500');
  assert.equal(line.quantity, 120);
  assert.equal(line.priceIncl, 3.5);
  assert.equal(line.totalIncl, 420);
  assert.equal(line.tax, 56.36);
  assert.equal(line.sageTaxCode, 1);
  assert.equal(original.receiptTaxes.length, 1);
  assert.equal(original.receiptTaxes[0].salesAmountWithTax, 420);
  assert.equal(original.receiptTaxes[0].taxAmount, 56.36);
  assert.equal(original.receiptTaxes[0].taxID, 515);
}

function validateStatus(status) {
  assert.equal(status.fiscalDayStatus, 'FiscalDayOpened');
  assert.equal(status.lastFiscalDayNo, 68, 'ZIMRA fiscal day changed');
  // ZIMRA confirmed receipt 271 and instructed the supplier to use 272,
  // despite GetStatus continuing to report 270 for the flagged receipt.
  assert.ok([270, 271].includes(status.lastReceiptGlobalNo),
    'Unexpected ZIMRA global number; obtain a fresh reconciliation');
}

module.exports = { validateRecovery, validateStatus };
