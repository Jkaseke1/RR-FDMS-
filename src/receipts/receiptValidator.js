const { supabase } = require('../db/supabaseClient');

/**
 * Validate receipt before submission per spec section 4.7
 * Throw for Red errors (block submission)
 * Warn for Yellow errors (allow but flag)
 */

class ReceiptValidationError extends Error {
  constructor(code, message, severity = 'Red') {
    super(message);
    this.code = code;
    this.severity = severity;
  }
}

/**
 * Main validation function
 */
async function validateReceipt(receipt, fiscalDayInfo, deviceConfig) {
  const errors = [];
  const warnings = [];

  try {
    // RCPT010: Currency must be valid ISO 4217
    if (!isValidCurrency(receipt.receiptCurrency)) {
      errors.push(new ReceiptValidationError('RCPT010', `Invalid currency: ${receipt.receiptCurrency}`));
    }

    // RCPT011: Receipt counter must be sequential
    if (receipt.receiptCounter !== fiscalDayInfo.receiptCounter + 1) {
      errors.push(new ReceiptValidationError('RCPT011', `Receipt counter must be ${fiscalDayInfo.receiptCounter + 1}, got ${receipt.receiptCounter}`));
    }

    // RCPT012: Receipt global number must be sequential
    const expectedGlobalNo = fiscalDayInfo.lastReceiptGlobalNo + 1;
    if (receipt.receiptGlobalNo !== expectedGlobalNo && receipt.receiptGlobalNo !== 1) {
      errors.push(new ReceiptValidationError('RCPT012', `Receipt global number must be ${expectedGlobalNo}, got ${receipt.receiptGlobalNo}`));
    }

    // RCPT013: Invoice number must be unique
    const { data: duplicate } = await supabase
      .from('fiscal_receipts')
      .select('id')
      .eq('device_id', deviceConfig.device_id)
      .eq('invoice_no', receipt.invoiceNo)
      .single();

    if (duplicate) {
      errors.push(new ReceiptValidationError('RCPT013', `Duplicate invoice number: ${receipt.invoiceNo}`));
    }

    // RCPT014: Receipt date must be > fiscalDayOpened
    const receiptDate = new Date(receipt.receiptDate);
    const fiscalDayOpened = new Date(fiscalDayInfo.opened_at);
    if (receiptDate <= fiscalDayOpened) {
      errors.push(new ReceiptValidationError('RCPT014', 'Receipt date must be after fiscal day opened'));
    }

    // RCPT015: Credit/Debit note required for CreditNote/DebitNote
    if ((receipt.receiptType === 'CreditNote' || receipt.receiptType === 'DebitNote') && !receipt.creditDebitNote) {
      errors.push(new ReceiptValidationError('RCPT015', 'Credit/debit note data required'));
    }

    // RCPT032: Credit/debit note must reference original receipt
    if (receipt.creditDebitNote) {
      const cdn = receipt.creditDebitNote;
      const hasReceiptID = cdn.receiptID !== undefined && cdn.receiptID !== null;
      const hasDeviceRef = cdn.deviceID !== undefined &&
                           cdn.receiptGlobalNo !== undefined &&
                           cdn.fiscalDayNo !== undefined;
      if (!hasReceiptID && !hasDeviceRef) {
        errors.push(new ReceiptValidationError('RCPT032', 'Credit/debit note must reference original receipt (receiptID or deviceID+receiptGlobalNo+fiscalDayNo)'));
      }
    }

    // RCPT016: At least one receipt line required
    if (!receipt.receiptLines || receipt.receiptLines.length === 0) {
      errors.push(new ReceiptValidationError('RCPT016', 'At least one receipt line required'));
    }

    // RCPT017: At least one receipt tax required
    if (!receipt.receiptTaxes || receipt.receiptTaxes.length === 0) {
      errors.push(new ReceiptValidationError('RCPT017', 'At least one receipt tax required'));
    }

    // RCPT018: At least one receipt payment required
    if (!receipt.receiptPayments || receipt.receiptPayments.length === 0) {
      errors.push(new ReceiptValidationError('RCPT018', 'At least one receipt payment required'));
    }

    // RCPT019: If tax inclusive, receiptTotal = sum(lineTotal)
    if (receipt.receiptLinesTaxInclusive) {
      const lineSum = receipt.receiptLines.reduce((sum, line) => sum + line.receiptLineTotal, 0);
      if (Math.abs(lineSum - receipt.receiptTotal) > 0.01) {
        errors.push(new ReceiptValidationError('RCPT019', `Receipt total ${receipt.receiptTotal} does not match sum of lines ${lineSum}`));
      }
    }

    // RCPT021: If tax percent > 0 and taxpayer not VAT registered
    if (!deviceConfig.vat_number) {
      const hasVAT = receipt.receiptTaxes.some(t => t.taxPercent > 0);
      if (hasVAT) {
        errors.push(new ReceiptValidationError('RCPT021', 'Taxpayer not VAT registered but VAT applied'));
      }
    }

    // RCPT022: Line price validation
    for (const line of receipt.receiptLines) {
      if (receipt.receiptType === 'FiscalInvoice' || receipt.receiptType === 'DebitNote') {
        if (line.receiptLineType === 'Sale' && line.receiptLinePrice <= 0) {
          errors.push(new ReceiptValidationError('RCPT022', `Line ${line.receiptLineNo}: Sale price must be > 0`));
        }
        if (line.receiptLineType === 'Discount' && line.receiptLinePrice >= 0) {
          errors.push(new ReceiptValidationError('RCPT022', `Line ${line.receiptLineNo}: Discount price must be < 0`));
        }
      }
      if (receipt.receiptType === 'CreditNote') {
        if (line.receiptLineType === 'Sale' && line.receiptLinePrice >= 0) {
          errors.push(new ReceiptValidationError('RCPT022', `Line ${line.receiptLineNo}: Credit note sale price must be < 0`));
        }
      }
    }

    // RCPT023: Quantity > 0
    for (const line of receipt.receiptLines) {
      if (line.receiptLineQuantity <= 0) {
        errors.push(new ReceiptValidationError('RCPT023', `Line ${line.receiptLineNo}: Quantity must be > 0`));
      }
    }

    // RCPT024: If price provided, total = price * quantity
    for (const line of receipt.receiptLines) {
      if (line.receiptLinePrice !== undefined) {
        const expectedTotal = line.receiptLinePrice * line.receiptLineQuantity;
        if (Math.abs(expectedTotal - line.receiptLineTotal) > 0.01) {
          errors.push(new ReceiptValidationError('RCPT024', `Line ${line.receiptLineNo}: Total ${line.receiptLineTotal} does not match price * quantity ${expectedTotal}`));
        }
      }
    }

    // RCPT025: Tax ID must be in applicableTaxes
    for (const tax of receipt.receiptTaxes) {
      const validTax = deviceConfig.applicable_taxes.find(t => t.taxID === tax.taxID);
      if (!validTax) {
        errors.push(new ReceiptValidationError('RCPT025', `Invalid tax ID: ${tax.taxID}`));
      } else {
        // Check date is within tax valid period
        const receiptDate = new Date(receipt.receiptDate);
        const validFrom = new Date(validTax.taxValidFrom);
        const validTill = validTax.taxValidTill ? new Date(validTax.taxValidTill) : null;
        
        if (receiptDate < validFrom || (validTill && receiptDate > validTill)) {
          errors.push(new ReceiptValidationError('RCPT025', `Tax ${tax.taxID} not valid on ${receipt.receiptDate}`));
        }
      }
    }

    // RCPT028: Payment amount validation
    for (const payment of receipt.receiptPayments) {
      if (receipt.receiptType === 'FiscalInvoice' || receipt.receiptType === 'DebitNote') {
        if (payment.paymentAmount < 0) {
          errors.push(new ReceiptValidationError('RCPT028', 'Payment amount must be >= 0 for Invoice/Debit'));
        }
      }
      if (receipt.receiptType === 'CreditNote') {
        if (payment.paymentAmount > 0) {
          errors.push(new ReceiptValidationError('RCPT028', 'Payment amount must be <= 0 for Credit Note'));
        }
      }
    }

    // RCPT029: Credit/debit note must be null for FiscalInvoice
    if (receipt.receiptType === 'FiscalInvoice' && receipt.creditDebitNote) {
      errors.push(new ReceiptValidationError('RCPT029', 'Credit/debit note must be null for Fiscal Invoice'));
    }

    // RCPT031: Receipt date in future (Yellow warning)
    const now = new Date();
    if (receiptDate > now) {
      warnings.push(new ReceiptValidationError('RCPT031', 'Receipt date is in the future', 'Yellow'));
    }

    // RCPT034: Receipt notes required for CreditNote/DebitNote
    if ((receipt.receiptType === 'CreditNote' || receipt.receiptType === 'DebitNote') && !receipt.receiptNotes) {
      errors.push(new ReceiptValidationError('RCPT034', 'Receipt notes required for Credit/Debit Note'));
    }

    // RCPT038: receiptTotal = sum(salesAmountWithTax)
    const salesSum = receipt.receiptTaxes.reduce((sum, tax) => sum + (tax.salesAmountWithTax || 0), 0);
    if (Math.abs(salesSum - receipt.receiptTotal) > 0.01) {
      errors.push(new ReceiptValidationError('RCPT038', `Receipt total ${receipt.receiptTotal} does not match sum of sales ${salesSum}`));
    }

    // RCPT039: receiptTotal = sum(paymentAmount)
    const paymentSum = receipt.receiptPayments.reduce((sum, p) => sum + p.paymentAmount, 0);
    if (Math.abs(paymentSum - receipt.receiptTotal) > 0.01) {
      errors.push(new ReceiptValidationError('RCPT039', `Receipt total ${receipt.receiptTotal} does not match sum of payments ${paymentSum}`));
    }

    // RCPT040: Receipt total sign validation
    if (receipt.receiptType === 'FiscalInvoice' || receipt.receiptType === 'DebitNote') {
      if (receipt.receiptTotal < 0) {
        errors.push(new ReceiptValidationError('RCPT040', 'Receipt total must be >= 0 for Invoice/Debit'));
      }
    }
    if (receipt.receiptType === 'CreditNote') {
      if (receipt.receiptTotal > 0) {
        errors.push(new ReceiptValidationError('RCPT040', 'Receipt total must be <= 0 for Credit Note'));
      }
    }

    // RCPT041: Receipt date within fiscal day max hours (Yellow warning)
    const hoursSinceOpened = (receiptDate - fiscalDayOpened) / (1000 * 60 * 60);
    if (hoursSinceOpened > deviceConfig.tax_payer_day_max_hrs) {
      warnings.push(new ReceiptValidationError('RCPT041', 'Receipt date exceeds fiscal day max hours', 'Yellow'));
    }

    // RCPT043: If buyer data sent, name and TIN required
    if (receipt.buyerData) {
      if (!receipt.buyerData.buyerRegisterName || !receipt.buyerData.buyerTIN) {
        errors.push(new ReceiptValidationError('RCPT043', 'Buyer name and TIN required'));
      }
    }

    // RCPT047: If VAT payer, HS code required
    if (deviceConfig.vat_number) {
      for (const line of receipt.receiptLines) {
        if (!line.receiptLineHSCode) {
          errors.push(new ReceiptValidationError('RCPT047', `Line ${line.receiptLineNo}: HS code required for VAT payer`));
        }
      }
    }

    // RCPT048: HS code format validation
    for (const line of receipt.receiptLines) {
      if (line.receiptLineHSCode) {
        const hsCode = String(line.receiptLineHSCode);
        const taxForLine = receipt.receiptTaxes.find(t => t.taxPercent === 0);
        
        if (taxForLine) {
          // Exempt: must be 8 digits
          if (hsCode.length !== 8) {
            errors.push(new ReceiptValidationError('RCPT048', `Line ${line.receiptLineNo}: Exempt HS code must be 8 digits`));
          }
        } else {
          // Non-exempt: 4 or 8 digits
          if (hsCode.length !== 4 && hsCode.length !== 8) {
            errors.push(new ReceiptValidationError('RCPT048', `Line ${line.receiptLineNo}: HS code must be 4 or 8 digits`));
          }
        }
      }
    }

    // Throw if any Red errors
    if (errors.length > 0) {
      const errorMessages = errors.map(e => `${e.code}: ${e.message}`).join('\n');
      throw new Error(`Receipt validation failed:\n${errorMessages}`);
    }

    // Log warnings
    if (warnings.length > 0) {
      console.log('⚠️  Receipt validation warnings:');
      warnings.forEach(w => console.log(`   ${w.code}: ${w.message}`));
    }

    return {
      valid: true,
      warnings,
      validationColor: warnings.length > 0 ? 'Yellow' : 'Green'
    };

  } catch (error) {
    throw error;
  }
}

/**
 * Validate currency code
 */
function isValidCurrency(currency) {
  const validCurrencies = ['USD', 'ZWL', 'ZWG', 'ZIG', 'ZAR', 'GBP', 'EUR'];
  return validCurrencies.includes(currency);
}

module.exports = {
  validateReceipt,
  ReceiptValidationError
};
