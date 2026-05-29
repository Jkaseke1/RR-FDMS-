const { getDeviceClient } = require('../http/deviceClient');
const { canCloseDay, transitionTo } = require('./fiscalDayStateMachine');
const { generateFiscalDaySignature } = require('../signatures/fiscalDaySignature');
const { getForCloseDay, reset } = require('../counters/fiscalCounterAggregator');
const { getStatus } = require('../device/getStatus');
const { supabase } = require('../db/supabaseClient');

/**
 * Call POST /Device/v1/{deviceID}/CloseDay
 * Per spec section 4.11
 * Requires mTLS
 * Cannot call if DeviceOperatingMode is Offline
 * FDMS will REJECT if fiscal day contains Grey or Red receipts
 */
async function closeDay(deviceId) {
  console.log(`\n========================================`);
  console.log(`Closing Fiscal Day - Device ${deviceId}`);
  console.log(`========================================\n`);

  try {
    // Step 1: Check if can close day
    const canClose = await canCloseDay(deviceId);
    if (!canClose.allowed) {
      throw new Error(`Cannot close fiscal day: ${canClose.reason}`);
    }

    const { fiscalDayId, fiscalDayNo } = canClose;

    // Step 2: Check for Grey/Red receipts
    console.log('Step 1: Checking for validation errors...');
    const { data: problemReceipts, error: receiptError } = await supabase
      .from('fiscal_receipts')
      .select('id, receipt_global_no, validation_color, invoice_no')
      .eq('device_id', deviceId)
      .eq('fiscal_day_no', fiscalDayNo)
      .in('validation_color', ['Grey', 'Red']);

    if (receiptError) {
      throw new Error(`Failed to check receipts: ${receiptError.message}`);
    }

    if (problemReceipts && problemReceipts.length > 0) {
      console.error('❌ Cannot close fiscal day: Found receipts with validation errors');
      problemReceipts.forEach(r => {
        console.error(`   Receipt ${r.receipt_global_no} (${r.invoice_no}): ${r.validation_color}`);
      });
      throw new Error(`Fiscal day contains ${problemReceipts.length} receipts with Grey/Red validation errors`);
    }

    console.log('✅ No validation errors found');

    // Step 3: Get fiscal day from database
    console.log('\nStep 2: Loading fiscal day data...');
    const { data: fiscalDay, error: dayError } = await supabase
      .from('fiscal_days')
      .select('*')
      .eq('id', fiscalDayId)
      .single();

    if (dayError) {
      throw new Error(`Failed to load fiscal day: ${dayError.message}`);
    }

    // Step 4: Get last receipt counter
    const { data: lastReceipt } = await supabase
      .from('fiscal_receipts')
      .select('receipt_counter')
      .eq('device_id', deviceId)
      .eq('fiscal_day_no', fiscalDayNo)
      .order('receipt_counter', { ascending: false })
      .limit(1)
      .single();

    const receiptCounter = lastReceipt ? lastReceipt.receipt_counter : 0;

    // Step 5: Get fiscal counters (exclude zeros)
    console.log('\nStep 3: Calculating fiscal counters...');
    const counters = await getForCloseDay(fiscalDayId, deviceId);
    console.log(`   Non-zero counters: ${counters.length}`);

    // Step 6: Build fiscal day signature
    console.log('\nStep 4: Generating fiscal day signature...');
    const fiscalDayDate = new Date(fiscalDay.opened_at).toISOString().split('T')[0];
    const signatureData = generateFiscalDaySignature(
      {
        deviceID: deviceId,
        fiscalDayNo,
        fiscalDayDate
      },
      counters
    );

    console.log(`   Hash: ${signatureData.hash.substring(0, 20)}...`);

    // Step 7: POST to CloseDay
    console.log('\nStep 5: Submitting close day request...');
    const deviceClient = getDeviceClient();
    const response = await deviceClient.post(
      `/Device/v1/${deviceId}/CloseDay`,
      {
        fiscalDayNo,
        fiscalDayCounters: counters,
        fiscalDayDeviceSignature: {
          hash: signatureData.hash,
          signature: signatureData.signature
        },
        receiptCounter
      }
    );

    const data = response.data;
    console.log('✅ Close day request submitted');
    console.log(`   Operation ID: ${data.operationID}`);

    // Step 8: Update status to FiscalDayCloseInitiated
    await transitionTo(deviceId, fiscalDayId, 'FiscalDayCloseInitiated');
    await supabase
      .from('fiscal_days')
      .update({
        close_operation_id: data.operationID,
        fiscal_day_device_signature: {
          hash: signatureData.hash,
          signature: signatureData.signature
        }
      })
      .eq('id', fiscalDayId);

    // Step 9: Poll getStatus until FiscalDayClosed or FiscalDayCloseFailed
    console.log('\nStep 6: Waiting for ZIMRA confirmation...');
    let attempts = 0;
    const maxAttempts = 10;
    const pollInterval = 3000; // 3 seconds

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;

      const status = await getStatus(deviceId);
      console.log(`   Attempt ${attempts}/${maxAttempts}: ${status.fiscalDayStatus}`);

      if (status.fiscalDayStatus === 'FiscalDayClosed') {
        // Success!
        console.log('\n✅ Fiscal day closed successfully');
        
        await supabase
          .from('fiscal_days')
          .update({
            status: 'FiscalDayClosed',
            closed_at: new Date().toISOString(),
            fiscal_day_server_signature: status.fiscalDayServerSignature,
            receipt_counter: receiptCounter
          })
          .eq('id', fiscalDayId);

        // Reset counters
        await reset(fiscalDayId);

        console.log('\n========================================');
        console.log('✅ Fiscal Day Closed Successfully');
        console.log(`   Fiscal Day No: ${fiscalDayNo}`);
        console.log(`   Receipts Processed: ${receiptCounter}`);
        console.log('========================================\n');

        return {
          fiscalDayNo,
          receiptCounter,
          operationID: data.operationID,
          serverSignature: status.fiscalDayServerSignature
        };
      }

      if (status.fiscalDayStatus === 'FiscalDayCloseFailed') {
        // Failed
        console.error('\n❌ Fiscal day close failed');
        console.error(`   Error Code: ${status.fiscalDayClosingErrorCode}`);

        await supabase
          .from('fiscal_days')
          .update({
            status: 'FiscalDayCloseFailed',
            closing_error_code: status.fiscalDayClosingErrorCode
          })
          .eq('id', fiscalDayId);

        // Log error
        await supabase
          .from('fdms_error_log')
          .insert({
            device_id: deviceId,
            error_code: status.fiscalDayClosingErrorCode,
            error_message: 'Fiscal day close failed',
            operation_type: 'closeDay',
            fiscal_day_id: fiscalDayId,
            operation_id: data.operationID
          });

        throw new Error(`Fiscal day close failed: ${status.fiscalDayClosingErrorCode}`);
      }
    }

    // Timeout
    throw new Error('Timeout waiting for fiscal day close confirmation');

  } catch (error) {
    console.error('\n❌ Failed to close fiscal day');
    if (error.fdmsError) {
      console.error(`   Error Code: ${error.fdmsError.errorCode}`);
      console.error(`   Detail: ${error.fdmsError.detail}`);
      console.error(`   Operation ID: ${error.fdmsError.operationID}`);
    } else {
      console.error(`   ${error.message}`);
    }
    throw error;
  }
}

module.exports = { closeDay };
