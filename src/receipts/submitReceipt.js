const { getDeviceClient } = require('../http/deviceClient');
const { canSubmitReceipt } = require('../fiscalDay/fiscalDayStateMachine');
const { validateReceipt } = require('./receiptValidator');
const { generateReceiptSignature } = require('../signatures/receiptSignature');
const { generateQRData } = require('../signatures/qrCodeGenerator');
const { updateFromReceipt } = require('../counters/fiscalCounterAggregator');
const { logError } = require('../errors/fdmsErrorHandler');
const { supabase } = require('../db/supabaseClient');

/**
 * Call POST /Device/v1/{deviceID}/SubmitReceipt
 * Per spec section 4.7
 * Requires mTLS
 * Cannot call if DeviceOperatingMode is Offline
 */
async function submitReceipt(deviceId, receipt) {
  console.log(`\nSubmitting receipt: ${receipt.invoiceNo}`);

  try {
    // Step 1: Check if can submit receipt
    const canSubmit = await canSubmitReceipt(deviceId);
    if (!canSubmit.allowed) {
      throw new Error(`Cannot submit receipt: ${canSubmit.reason}`);
    }

    const { fiscalDayId, fiscalDayNo } = canSubmit;

    // Step 2: Get fiscal day info
    const { data: fiscalDay } = await supabase
      .from('fiscal_days')
      .select('*')
      .eq('id', fiscalDayId)
      .single();

    // Step 3: Get device config
    const { data: deviceConfig } = await supabase
      .from('fiscal_devices')
      .select('*')
      .eq('device_id', deviceId)
      .single();

    // Step 4: Check fiscal day not expired
    const hoursSinceOpened = (new Date() - new Date(fiscalDay.opened_at)) / (1000 * 60 * 60);
    if (hoursSinceOpened >= deviceConfig.tax_payer_day_max_hrs) {
      throw new Error(`Fiscal day has expired (${hoursSinceOpened.toFixed(1)} hours since opened, max ${deviceConfig.tax_payer_day_max_hrs})`);
    }

    // Step 5: Validate receipt
    console.log('   Validating receipt...');
    const validation = await validateReceipt(receipt, fiscalDay, deviceConfig);
    console.log(`   Validation: ${validation.validationColor}`);

    // Step 6: Get previous receipt hash
    const { data: previousReceipt } = await supabase
      .from('fiscal_receipts')
      .select('receipt_hash')
      .eq('device_id', deviceId)
      .eq('fiscal_day_no', fiscalDayNo)
      .order('receipt_global_no', { ascending: false })
      .limit(1)
      .single();

    const previousReceiptHash = previousReceipt ? previousReceipt.receipt_hash : null;

    // Step 7: Generate receipt signature
    console.log('   Generating signature...');
    const receiptWithDeviceId = { ...receipt, deviceID: deviceId };
    const signature = generateReceiptSignature(receiptWithDeviceId, previousReceiptHash);

    // Step 8: Generate QR code
    console.log('   Generating QR code...');
    const qrCode = generateQRData(
      deviceConfig.qr_url,
      deviceId,
      receipt.receiptDate,
      receipt.receiptGlobalNo,
      signature.signature
    );

    // Step 9: Build complete receipt payload
    const receiptPayload = {
      ...receipt,
      receiptDeviceSignature: {
        hash: signature.hash,
        signature: signature.signature
      }
    };

    // Step 10: Save to database (status='pending')
    console.log('   Saving to database...');
    const { data: savedReceipt, error: saveError } = await supabase
      .from('fiscal_receipts')
      .insert({
        device_id: deviceId,
        fiscal_day_id: fiscalDayId,
        fiscal_day_no: fiscalDayNo,
        receipt_type: receipt.receiptType,
        receipt_counter: receipt.receiptCounter,
        receipt_global_no: receipt.receiptGlobalNo,
        invoice_no: receipt.invoiceNo,
        receipt_currency: receipt.receiptCurrency,
        receipt_date: receipt.receiptDate,
        receipt_total: receipt.receiptTotal,
        receipt_lines_tax_inclusive: receipt.receiptLinesTaxInclusive,
        receipt_print_form: receipt.receiptPrintForm,
        receipt_lines: receipt.receiptLines,
        receipt_taxes: receipt.receiptTaxes,
        receipt_payments: receipt.receiptPayments,
        buyer_data: receipt.buyerData,
        credit_debit_note: receipt.creditDebitNote,
        receipt_notes: receipt.receiptNotes,
        receipt_hash: signature.hash,
        device_signature: signature.signature,
        previous_receipt_hash: previousReceiptHash,
        qr_code: qrCode,
        submission_status: 'pending',
        validation_color: validation.validationColor,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (saveError) {
      throw new Error(`Failed to save receipt: ${saveError.message}`);
    }

    // Step 11: Submit to ZIMRA
    console.log('   Submitting to ZIMRA...');
    const deviceClient = getDeviceClient();
    
    // Build correct ZIMRA payload format - ZIMRA requires submitReceiptRequest wrapper
    const zimraPayload = {
      submitReceiptRequest: {
        receipt: receiptPayload
      }
    };
    
    const response = await deviceClient.post(
      `/Device/v1/${deviceId}/SubmitReceipt`,
      zimraPayload
    );

    const data = response.data;
    console.log('✅ Receipt submitted successfully');
    console.log(`   Receipt ID: ${data.receiptID}`);
    console.log(`   Operation ID: ${data.operationID}`);

    // Step 12: Update database with ZIMRA response
    await supabase
      .from('fiscal_receipts')
      .update({
        receipt_id: data.receiptID,
        server_signature: data.receiptServerSignature,
        server_date: data.serverDate,
        submission_status: 'submitted',
        operation_id: data.operationID,
        updated_at: new Date().toISOString()
      })
      .eq('id', savedReceipt.id);

    // Step 13: Update fiscal day counters
    await updateFromReceipt(receipt, fiscalDayId, deviceId, fiscalDayNo);

    // Step 14: Update fiscal day receipt counter and last global number
    await supabase
      .from('fiscal_days')
      .update({
        receipt_counter: receipt.receiptCounter,
        last_receipt_global_no: receipt.receiptGlobalNo,
        updated_at: new Date().toISOString()
      })
      .eq('id', fiscalDayId);

    return {
      receiptId: savedReceipt.id,
      fdmsReceiptId: data.receiptID,
      receiptGlobalNo: receipt.receiptGlobalNo,
      qrCode,
      operationID: data.operationID
    };

  } catch (error) {
    console.error('❌ Receipt submission failed');
    
    // Log error
    await logError(deviceId, 'submitReceipt', error, {
      invoiceNo: receipt.invoiceNo,
      receiptGlobalNo: receipt.receiptGlobalNo
    });

    // Update submission status if receipt was saved
    if (receipt.receiptGlobalNo) {
      await supabase
        .from('fiscal_receipts')
        .update({
          submission_status: 'failed',
          last_error: error.message,
          submission_attempts: supabase.raw('submission_attempts + 1')
        })
        .eq('device_id', deviceId)
        .eq('receipt_global_no', receipt.receiptGlobalNo);
    }

    if (error.fdmsError) {
      console.error(`   Error Code: ${error.fdmsError.errorCode}`);
      console.error(`   Detail: ${error.fdmsError.detail}`);
    } else {
      console.error(`   ${error.message}`);
    }

    throw error;
  }
}

module.exports = { submitReceipt };
