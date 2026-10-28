const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateRecovery, validateStatus } = require('../src/integrations/inv0950Recovery');

function fixture() {
  return {
    state: {
      fiscalDayNo: 68, fiscalDayStatus: 'FiscalDayOpened', receiptGlobalNo: 271,
      receiptCounter: 16, processingBlocked: true,
      lastReceiptHash: 'Xbtl3qcSB2umyu2lHKIALDBWCximB9B1K4zAiTrQQpg=',
      processingBlockedReceipt: { invoiceNo: 'INV0950', receiptId: 467326274 },
      processedInvoices: { INV0950: {
        zimraReceiptId: 467326274, globalNo: 271, fiscalDayNo: 68, currency: 'USD',
        receiptTaxes: [{ taxID: 515, salesAmountWithTax: 420, taxAmount: 56.36 }]
      } }
    },
    pdf: {
      documentType: 'credit_note', creditNoteNumber: 'CRN0129', originalInvoiceNumber: 'INV0950',
      currency: 'USD', customerTIN: null, totalIncl: 420, totalExcl: 363.64, taxAmount: 56.36,
      lineItems: [{ itemCode: 'LAWN001', hsCode: '12092500', quantity: 120,
        priceIncl: 3.5, totalIncl: 420, tax: 56.36, sageTaxCode: 1 }]
    }
  };
}

test('allows only the documented reversal and preserves the active block', () => {
  const { state, pdf } = fixture();
  const before = JSON.stringify(state);
  validateRecovery(state, pdf, '41885');
  assert.equal(JSON.stringify(state), before);
});

test('refuses changed documents, totals, customer TIN, or item quantities', () => {
  for (const mutate of [
    p => { p.creditNoteNumber = 'CRN0130'; },
    p => { p.originalInvoiceNumber = 'INV0960'; },
    p => { p.totalIncl = 421; },
    p => { p.customerTIN = '2002054676'; },
    p => { p.lineItems[0].quantity = 121; }
  ]) {
    const { state, pdf } = fixture();
    mutate(pdf);
    assert.throws(() => validateRecovery(state, pdf, '41885'));
  }
});

test('refuses already-recorded credit notes and changed counters or receipt chain', () => {
  for (const mutate of [
    s => { s.processedInvoices.CRN0129 = { zimraReceiptId: 123 }; },
    s => { s.receiptGlobalNo = 270; },
    s => { s.receiptCounter = 17; },
    s => { s.lastReceiptHash = 'different'; },
    s => { s.processingBlocked = false; },
    s => { s.processedInvoices.INV0950.zimraReceiptId = 123; }
  ]) {
    const { state, pdf } = fixture();
    mutate(state);
    assert.throws(() => validateRecovery(state, pdf, '41885'));
  }
});

test('allows the documented GetStatus discrepancy only for opened day 68', () => {
  for (const n of [270, 271]) {
    validateStatus({ fiscalDayStatus: 'FiscalDayOpened', lastFiscalDayNo: 68, lastReceiptGlobalNo: n });
  }
  for (const status of [
    { fiscalDayStatus: 'FiscalDayClosed', lastFiscalDayNo: 68, lastReceiptGlobalNo: 271 },
    { fiscalDayStatus: 'FiscalDayOpened', lastFiscalDayNo: 69, lastReceiptGlobalNo: 271 },
    { fiscalDayStatus: 'FiscalDayOpened', lastFiscalDayNo: 68, lastReceiptGlobalNo: 272 }
  ]) assert.throws(() => validateStatus(status));
});
