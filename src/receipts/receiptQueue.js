const { submitReceipt } = require('./submitReceipt');
const { isRetryable } = require('../errors/fdmsErrorHandler');
const { supabase } = require('../db/supabaseClient');

/**
 * Sequential receipt queue processor
 * Per spec: receipts must be sent in ascending receiptGlobalNo order with NO gaps
 */

let isProcessing = false;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 5000]; // Exponential backoff in ms

/**
 * Process the receipt queue
 * Run every 30 seconds
 */
async function processQueue(deviceId) {
  // Prevent concurrent processing
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  try {
    // Get oldest pending receipt (lowest receipt_global_no)
    const { data: pendingReceipts, error } = await supabase
      .from('fiscal_receipts')
      .select('*')
      .eq('device_id', deviceId)
      .eq('submission_status', 'pending')
      .order('receipt_global_no', { ascending: true })
      .limit(1);

    if (error) {
      console.error('Failed to query pending receipts:', error.message);
      return;
    }

    if (!pendingReceipts || pendingReceipts.length === 0) {
      // Queue is empty
      return;
    }

    const receipt = pendingReceipts[0];

    console.log(`\n📋 Processing receipt queue: ${receipt.invoice_no} (Global #${receipt.receipt_global_no})`);

    // Build receipt object for submission
    const receiptPayload = {
      receiptType: receipt.receipt_type,
      receiptCurrency: receipt.receipt_currency,
      receiptCounter: receipt.receipt_counter,
      receiptGlobalNo: receipt.receipt_global_no,
      invoiceNo: receipt.invoice_no,
      receiptDate: receipt.receipt_date,
      receiptLinesTaxInclusive: receipt.receipt_lines_tax_inclusive,
      receiptLines: receipt.receipt_lines,
      receiptTaxes: receipt.receipt_taxes,
      receiptPayments: receipt.receipt_payments,
      receiptTotal: receipt.receipt_total,
      receiptPrintForm: receipt.receipt_print_form,
      buyerData: receipt.buyer_data,
      creditDebitNote: receipt.credit_debit_note,
      receiptNotes: receipt.receipt_notes
    };

    try {
      // Submit receipt
      await submitReceipt(deviceId, receiptPayload);
      console.log('✅ Receipt processed successfully');

      // Process next receipt (recursive call)
      setTimeout(() => processQueue(deviceId), 100);

    } catch (error) {
      console.error('❌ Receipt submission failed');

      // Check if retryable
      if (isRetryable(error) && receipt.submission_attempts < MAX_RETRIES) {
        const retryDelay = RETRY_DELAYS[receipt.submission_attempts] || 5000;
        console.log(`   Retrying in ${retryDelay}ms (attempt ${receipt.submission_attempts + 1}/${MAX_RETRIES})`);

        // Schedule retry
        setTimeout(() => {
          isProcessing = false;
          processQueue(deviceId);
        }, retryDelay);

      } else {
        // Stop queue - do not skip
        console.error('❌ QUEUE STOPPED - Receipt failed after max retries');
        console.error('   Manual intervention required to resolve receipt:', receipt.invoice_no);
        console.error('   Gap in receipt chain will cause Grey errors');
        
        // Mark as failed
        await supabase
          .from('fiscal_receipts')
          .update({
            submission_status: 'failed',
            last_error: error.message
          })
          .eq('id', receipt.id);
      }
    }

  } finally {
    isProcessing = false;
  }
}

/**
 * Start queue processor
 * Run every 30 seconds
 */
function startQueueProcessor(deviceId) {
  console.log('✅ Receipt queue processor started');
  
  // Initial run
  processQueue(deviceId);

  // Schedule recurring runs
  setInterval(() => {
    processQueue(deviceId);
  }, 30000); // 30 seconds
}

/**
 * Manually retry a failed receipt
 */
async function retryFailedReceipt(deviceId, receiptId) {
  await supabase
    .from('fiscal_receipts')
    .update({
      submission_status: 'pending',
      submission_attempts: 0,
      last_error: null
    })
    .eq('id', receiptId)
    .eq('device_id', deviceId);

  console.log('✅ Receipt marked for retry');
  
  // Trigger immediate processing
  processQueue(deviceId);
}

module.exports = {
  processQueue,
  startQueueProcessor,
  retryFailedReceipt
};
