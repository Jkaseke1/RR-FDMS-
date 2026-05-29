const { supabase } = require('../db/supabaseClient');

/**
 * Manage fiscal counters per spec section 6
 * Accumulated per fiscal day, reset after closeDay
 * 
 * Counter types:
 * - SaleByTax, SaleTaxByTax (FiscalInvoice)
 * - CreditNoteByTax, CreditNoteTaxByTax (CreditNote)
 * - DebitNoteByTax, DebitNoteTaxByTax (DebitNote)
 * - BalanceByMoneyType (all receipt types)
 */

/**
 * Update counters from a receipt
 */
async function updateFromReceipt(receipt, fiscalDayId, deviceId, fiscalDayNo) {
  const updates = [];

  // Process each tax
  for (const tax of receipt.receiptTaxes) {
    const currency = receipt.receiptCurrency;
    const taxId = tax.taxID;
    const taxPercent = tax.taxPercent;
    const salesAmount = tax.salesAmountWithTax || 0;
    const taxAmount = tax.taxAmount || 0;

    // Determine counter types based on receipt type
    let saleCounterType, taxCounterType;

    if (receipt.receiptType === 'FiscalInvoice') {
      saleCounterType = 'SaleByTax';
      taxCounterType = 'SaleTaxByTax';
    } else if (receipt.receiptType === 'CreditNote') {
      saleCounterType = 'CreditNoteByTax';
      taxCounterType = 'CreditNoteTaxByTax';
    } else if (receipt.receiptType === 'DebitNote') {
      saleCounterType = 'DebitNoteByTax';
      taxCounterType = 'DebitNoteTaxByTax';
    }

    // Update sale counter
    updates.push({
      fiscal_day_id: fiscalDayId,
      device_id: deviceId,
      fiscal_day_no: fiscalDayNo,
      fiscal_counter_type: saleCounterType,
      fiscal_counter_currency: currency,
      fiscal_counter_tax_id: taxId,
      fiscal_counter_tax_percent: taxPercent,
      fiscal_counter_value: salesAmount
    });

    // Update tax counter
    updates.push({
      fiscal_day_id: fiscalDayId,
      device_id: deviceId,
      fiscal_day_no: fiscalDayNo,
      fiscal_counter_type: taxCounterType,
      fiscal_counter_currency: currency,
      fiscal_counter_tax_id: taxId,
      fiscal_counter_tax_percent: taxPercent,
      fiscal_counter_value: taxAmount
    });
  }

  // Process each payment for BalanceByMoneyType
  for (const payment of receipt.receiptPayments) {
    const currency = receipt.receiptCurrency;
    const moneyType = payment.moneyType;
    const amount = payment.paymentAmount || 0;

    updates.push({
      fiscal_day_id: fiscalDayId,
      device_id: deviceId,
      fiscal_day_no: fiscalDayNo,
      fiscal_counter_type: 'BalanceByMoneyType',
      fiscal_counter_currency: currency,
      fiscal_counter_money_type: moneyType,
      fiscal_counter_value: amount
    });
  }

  // Upsert all counters (sum values if already exist)
  for (const counter of updates) {
    // Check if counter exists
    const { data: existing } = await supabase
      .from('fiscal_day_counters')
      .select('id, fiscal_counter_value')
      .eq('fiscal_day_id', fiscalDayId)
      .eq('fiscal_counter_type', counter.fiscal_counter_type)
      .eq('fiscal_counter_currency', counter.fiscal_counter_currency)
      .eq('fiscal_counter_tax_id', counter.fiscal_counter_tax_id || null)
      .eq('fiscal_counter_money_type', counter.fiscal_counter_money_type || null)
      .single();

    if (existing) {
      // Update existing counter
      await supabase
        .from('fiscal_day_counters')
        .update({
          fiscal_counter_value: parseFloat(existing.fiscal_counter_value) + parseFloat(counter.fiscal_counter_value),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      // Insert new counter
      await supabase
        .from('fiscal_day_counters')
        .insert(counter);
    }
  }
}

/**
 * Get counters for closeDay (exclude zeros)
 */
async function getForCloseDay(fiscalDayId, deviceId) {
  const { data: counters, error } = await supabase
    .from('fiscal_day_counters')
    .select('*')
    .eq('fiscal_day_id', fiscalDayId)
    .neq('fiscal_counter_value', 0);

  if (error) {
    throw new Error(`Failed to get counters: ${error.message}`);
  }

  // Format for ZIMRA API
  return counters.map(c => ({
    fiscalCounterType: c.fiscal_counter_type,
    fiscalCounterCurrency: c.fiscal_counter_currency,
    fiscalCounterTaxID: c.fiscal_counter_tax_id,
    fiscalCounterTaxPercent: c.fiscal_counter_tax_percent,
    fiscalCounterMoneyType: c.fiscal_counter_money_type,
    fiscalCounterValue: parseFloat(c.fiscal_counter_value)
  }));
}

/**
 * Reset counters after successful closeDay
 */
async function reset(fiscalDayId) {
  const { error } = await supabase
    .from('fiscal_day_counters')
    .delete()
    .eq('fiscal_day_id', fiscalDayId);

  if (error) {
    console.error('⚠️  Failed to reset counters:', error.message);
  } else {
    console.log('✅ Fiscal counters reset');
  }
}

/**
 * Save counters to Supabase
 */
async function saveToSupabase(fiscalDayId, deviceId, fiscalDayNo, counters) {
  const records = counters.map(c => ({
    fiscal_day_id: fiscalDayId,
    device_id: deviceId,
    fiscal_day_no: fiscalDayNo,
    fiscal_counter_type: c.fiscalCounterType,
    fiscal_counter_currency: c.fiscalCounterCurrency,
    fiscal_counter_tax_id: c.fiscalCounterTaxID,
    fiscal_counter_tax_percent: c.fiscalCounterTaxPercent,
    fiscal_counter_money_type: c.fiscalCounterMoneyType,
    fiscal_counter_value: c.fiscalCounterValue
  }));

  const { error } = await supabase
    .from('fiscal_day_counters')
    .insert(records);

  if (error) {
    throw new Error(`Failed to save counters: ${error.message}`);
  }
}

/**
 * Load counters from Supabase (for restart recovery)
 */
async function loadFromSupabase(fiscalDayId) {
  const { data, error } = await supabase
    .from('fiscal_day_counters')
    .select('*')
    .eq('fiscal_day_id', fiscalDayId);

  if (error) {
    throw new Error(`Failed to load counters: ${error.message}`);
  }

  return data;
}

module.exports = {
  updateFromReceipt,
  getForCloseDay,
  reset,
  saveToSupabase,
  loadFromSupabase
};
