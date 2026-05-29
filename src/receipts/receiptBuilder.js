/**
 * Build complete receipt payload for submitReceipt
 * Per spec section 4.7 Receipt object
 */

/**
 * Build receipt from invoice data
 * @param {Object} invoiceData - Raw invoice data from Sage/ERP
 * @param {Object} fiscalDayInfo - Current fiscal day information
 * @param {string} previousReceiptHash - Hash of previous receipt (null if first)
 * @returns {Object} Complete receipt object
 */
function buildReceipt(invoiceData, fiscalDayInfo, previousReceiptHash = null) {
  // Calculate next receipt numbers
  const receiptCounter = fiscalDayInfo.receiptCounter + 1;
  const receiptGlobalNo = fiscalDayInfo.lastReceiptGlobalNo + 1;

  // Build receipt date (local time, no timezone)
  const receiptDate = new Date().toISOString().split('.')[0]; // YYYY-MM-DDTHH:mm:ss

  // Build receipt lines
  const receiptLines = invoiceData.lines.map((line, index) => ({
    receiptLineNo: index + 1,
    receiptLineType: line.lineType || 'Sale', // Sale or Discount
    receiptLineHSCode: line.hsCode,
    receiptLineName: line.name,
    receiptLinePrice: line.price,
    receiptLineQuantity: line.quantity,
    receiptLineTotal: line.total
  }));

  // Build receipt taxes
  const receiptTaxes = invoiceData.taxes.map(tax => ({
    taxID: tax.taxID,
    taxPercent: tax.taxPercent,
    taxCode: tax.taxCode,
    taxAmount: tax.taxAmount,
    salesAmountWithTax: tax.salesAmountWithTax
  }));

  // Build receipt payments
  const receiptPayments = invoiceData.payments.map(payment => ({
    moneyType: payment.moneyType, // Cash, Card, MobileWallet, etc.
    paymentAmount: payment.amount
  }));

  // Build complete receipt
  const receipt = {
    receiptType: invoiceData.receiptType || 'FiscalInvoice',
    receiptCurrency: invoiceData.currency || 'USD',
    receiptCounter,
    receiptGlobalNo,
    invoiceNo: invoiceData.invoiceNo,
    receiptDate,
    receiptLinesTaxInclusive: invoiceData.taxInclusive !== false, // Default true
    receiptLines,
    receiptTaxes,
    receiptPayments,
    receiptTotal: invoiceData.total,
    receiptPrintForm: invoiceData.printForm || 'Receipt48' // Receipt48 or InvoiceA4
  };

  // Optional: Buyer data
  if (invoiceData.buyer) {
    receipt.buyerData = {
      buyerRegisterName: invoiceData.buyer.name,
      buyerTIN: invoiceData.buyer.tin,
      buyerAddress: invoiceData.buyer.address,
      buyerContacts: invoiceData.buyer.contacts
    };
  }

  // Optional: Credit/Debit note data
  if (invoiceData.creditDebitNote) {
    receipt.creditDebitNote = {
      creditDebitNoteNumber: invoiceData.creditDebitNote.number,
      creditDebitNoteDate: invoiceData.creditDebitNote.date,
      creditDebitNoteReason: invoiceData.creditDebitNote.reason
    };
  }

  // Optional: Receipt notes
  if (invoiceData.notes) {
    receipt.receiptNotes = invoiceData.notes;
  }

  return receipt;
}

/**
 * Validate invoice data has all required fields
 */
function validateInvoiceData(invoiceData) {
  const required = ['invoiceNo', 'lines', 'taxes', 'payments', 'total'];
  const missing = required.filter(field => !invoiceData[field]);

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }

  if (invoiceData.lines.length === 0) {
    throw new Error('Invoice must have at least one line item');
  }

  if (invoiceData.taxes.length === 0) {
    throw new Error('Invoice must have at least one tax');
  }

  if (invoiceData.payments.length === 0) {
    throw new Error('Invoice must have at least one payment');
  }

  return true;
}

module.exports = {
  buildReceipt,
  validateInvoiceData
};
