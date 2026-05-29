/**
 * Invoice Mapper
 * Maps invoices from your POS/ERP format to ZIMRA format
 */

const { supabase } = require('../db/supabaseClient');

/**
 * Map your invoice to ZIMRA format
 * @param {Object} yourInvoice - Invoice in your format
 * @param {Object} options - Mapping options
 * @returns {Object} - Invoice in ZIMRA format
 */
async function mapToZimraFormat(yourInvoice, options = {}) {
  console.log('📝 Mapping invoice to ZIMRA format...');
  
  try {
    // Step 1: Determine receipt type
    const receiptType = mapReceiptType(yourInvoice.invoice_type || 'invoice');
    
    // Step 2: Get next receipt counter and global number
    const { receiptCounter, receiptGlobalNo } = await getNextReceiptNumber(options.deviceId);
    
    // Step 3: Map buyer data
    const buyerData = mapBuyerData(yourInvoice.customer || {});
    
    // Step 4: Map line items
    const receiptLines = await mapLineItems(yourInvoice.items || yourInvoice.line_items || []);
    
    // Step 5: Map payment
    const receiptPayments = await mapPayments(yourInvoice.payment || yourInvoice.payments || []);
    
    // Step 6: Calculate taxes
    const receiptTaxes = calculateTaxes(receiptLines);
    
    // Step 7: Build ZIMRA receipt
    const zimraReceipt = {
      receiptType,
      receiptCurrency: yourInvoice.currency || 'USD',
      receiptCounter,
      receiptGlobalNo,
      receiptDate: formatDate(yourInvoice.invoice_date || new Date()),
      receiptLinesTaxInclusive: yourInvoice.tax_inclusive !== false, // Default true
      receiptPrintForm: 0, // 0 = A4 portrait
      invoiceNo: yourInvoice.invoice_number || yourInvoice.invoice_id,
      
      buyerData,
      receiptLines,
      receiptPayments,
      receiptTaxes,
      
      receiptTotal: parseFloat(yourInvoice.total_amount || calculateTotal(receiptLines)),
      receiptNotes: yourInvoice.notes || yourInvoice.remarks || ''
    };
    
    // Step 8: Add credit/debit note specific fields
    if (receiptType === 1 || receiptType === 2) {
      zimraReceipt.creditDebitNote = {
        originalInvoiceNo: yourInvoice.original_invoice_id || yourInvoice.original_invoice_number,
        receiptDeviceNo: options.deviceId,
        reason: yourInvoice.reason || (receiptType === 1 ? 'Debit note' : 'Credit note')
      };
    }
    
    console.log('✅ Invoice mapped successfully');
    return zimraReceipt;
    
  } catch (error) {
    console.error('❌ Failed to map invoice:', error.message);
    throw new Error(`Invoice mapping failed: ${error.message}`);
  }
}

/**
 * Map receipt type
 */
function mapReceiptType(invoiceType) {
  const typeMap = {
    'invoice': 0,
    'fiscal_invoice': 0,
    'debit_note': 1,
    'debit': 1,
    'credit_note': 2,
    'credit': 2,
    'refund': 2
  };
  
  const type = typeMap[invoiceType.toLowerCase()];
  if (type === undefined) {
    throw new Error(`Unknown invoice type: ${invoiceType}`);
  }
  
  return type;
}

/**
 * Get next receipt counter and global number
 */
async function getNextReceiptNumber(deviceId) {
  // Get current fiscal day
  const { data: fiscalDay } = await supabase
    .from('fiscal_days')
    .select('*')
    .eq('device_id', deviceId)
    .eq('status', 'FiscalDayOpened')
    .single();
  
  if (!fiscalDay) {
    throw new Error('No fiscal day is open. Please open a fiscal day first.');
  }
  
  const receiptCounter = (fiscalDay.receipt_counter || 0) + 1;
  const receiptGlobalNo = `RR-${new Date().getFullYear()}-${String(receiptCounter).padStart(4, '0')}`;
  
  return { receiptCounter, receiptGlobalNo };
}

/**
 * Map buyer/customer data
 */
function mapBuyerData(customer) {
  return {
    buyerRegisterName: customer.name || customer.customer_name || 'Walk-in Customer',
    buyerTIN: customer.tin || customer.tax_id || '',
    buyerAddress: customer.address || '',
    buyerContacts: {
      phoneNo: customer.phone || customer.phone_number || '',
      email: customer.email || ''
    }
  };
}

/**
 * Map line items
 */
async function mapLineItems(items) {
  const mappedLines = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Get tax mapping
    const taxMapping = await getTaxMapping(item.tax_code || item.tax_type || 'VAT');
    
    const line = {
      receiptLineType: 0, // 0 = Sale
      receiptLineNo: i + 1,
      receiptLineHSCode: item.hs_code || item.product_code || '00000000',
      receiptLineName: item.product_name || item.name || item.description,
      receiptLinePrice: parseFloat(item.unit_price || item.price),
      receiptLineQuantity: parseFloat(item.quantity || item.qty || 1),
      receiptLineTotal: parseFloat(item.line_total || (item.unit_price * item.quantity)),
      taxPercent: taxMapping.zimra_tax_percent,
      taxID: taxMapping.zimra_tax_id
    };
    
    mappedLines.push(line);
  }
  
  return mappedLines;
}

/**
 * Get tax code mapping
 */
async function getTaxMapping(yourTaxCode) {
  const { data: mapping } = await supabase
    .from('tax_code_mapping')
    .select('*')
    .eq('your_tax_code', yourTaxCode.toUpperCase())
    .eq('is_active', true)
    .single();
  
  if (!mapping) {
    // Use default VAT if not found
    console.warn(`⚠️  Tax code '${yourTaxCode}' not found, using default VAT`);
    return {
      zimra_tax_id: 1,
      zimra_tax_percent: 15.5
    };
  }
  
  return mapping;
}

/**
 * Map payments
 */
async function mapPayments(payments) {
  // Handle single payment object or array
  const paymentArray = Array.isArray(payments) ? payments : [payments];
  
  const mappedPayments = [];
  
  for (const payment of paymentArray) {
    // Get payment method mapping
    const paymentMapping = await getPaymentMapping(
      payment.method || payment.payment_method || payment.type || 'cash'
    );
    
    mappedPayments.push({
      moneyTypeCode: paymentMapping.zimra_money_type,
      paymentAmount: parseFloat(payment.amount || payment.payment_amount || 0)
    });
  }
  
  return mappedPayments;
}

/**
 * Get payment method mapping
 */
async function getPaymentMapping(yourPaymentCode) {
  const { data: mapping } = await supabase
    .from('payment_method_mapping')
    .select('*')
    .eq('your_payment_code', yourPaymentCode.toLowerCase())
    .eq('is_active', true)
    .single();
  
  if (!mapping) {
    // Use default CASH if not found
    console.warn(`⚠️  Payment method '${yourPaymentCode}' not found, using default CASH`);
    return {
      zimra_money_type: 'CASH'
    };
  }
  
  return mapping;
}

/**
 * Calculate taxes from line items
 */
function calculateTaxes(receiptLines) {
  const taxMap = new Map();
  
  for (const line of receiptLines) {
    const key = `${line.taxID}-${line.taxPercent}`;
    
    if (!taxMap.has(key)) {
      taxMap.set(key, {
        taxID: line.taxID,
        taxPercent: line.taxPercent,
        salesAmountWithTax: 0,
        taxAmount: 0
      });
    }
    
    const tax = taxMap.get(key);
    const lineTotal = line.receiptLineTotal;
    const taxAmount = lineTotal * (line.taxPercent / (100 + line.taxPercent));
    
    tax.salesAmountWithTax += lineTotal;
    tax.taxAmount += taxAmount;
  }
  
  return Array.from(taxMap.values()).map(tax => ({
    ...tax,
    salesAmountWithTax: parseFloat(tax.salesAmountWithTax.toFixed(2)),
    taxAmount: parseFloat(tax.taxAmount.toFixed(2))
  }));
}

/**
 * Calculate total from line items
 */
function calculateTotal(receiptLines) {
  return receiptLines.reduce((sum, line) => sum + line.receiptLineTotal, 0);
}

/**
 * Format date to ZIMRA format
 */
function formatDate(date) {
  const d = new Date(date);
  return d.toISOString().split('.')[0]; // YYYY-MM-DDTHH:mm:ss
}

/**
 * Validate your invoice before mapping
 */
function validateInvoice(invoice) {
  const errors = [];
  
  if (!invoice.invoice_number && !invoice.invoice_id) {
    errors.push('Invoice number is required');
  }
  
  if (!invoice.items && !invoice.line_items) {
    errors.push('Invoice items are required');
  }
  
  if (!invoice.total_amount) {
    errors.push('Total amount is required');
  }
  
  if (!invoice.payment && !invoice.payments) {
    errors.push('Payment information is required');
  }
  
  if (errors.length > 0) {
    throw new Error(`Invoice validation failed: ${errors.join(', ')}`);
  }
  
  return true;
}

module.exports = {
  mapToZimraFormat,
  validateInvoice,
  mapReceiptType,
  mapBuyerData,
  mapLineItems,
  mapPayments,
  calculateTaxes
};
