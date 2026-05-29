const { getDeviceClient } = require('../http/deviceClient');
const { getConfig } = require('../device/getConfig');
const { canOpenDay, getCurrentStatus } = require('./fiscalDayStateMachine');
const { supabase } = require('../db/supabaseClient');

/**
 * Call POST /Device/v1/{deviceID}/OpenDay
 * Per spec section 4.6
 * Requires mTLS
 * Cannot call if DeviceOperatingMode is Offline
 * Can only open if current status is FiscalDayClosed
 */
async function openDay(deviceId) {
  console.log(`\n========================================`);
  console.log(`Opening Fiscal Day - Device ${deviceId}`);
  console.log(`========================================\n`);

  try {
    // Step 1: Check if can open day
    const canOpen = await canOpenDay(deviceId);
    if (!canOpen.allowed) {
      throw new Error(`Cannot open fiscal day: ${canOpen.reason}`);
    }

    // Step 2: Get configuration first (per spec requirement 9.2)
    console.log('Step 1: Fetching latest configuration...');
    const config = await getConfig(deviceId);

    // Step 3: Check operating mode
    if (config.deviceOperatingMode === 'Offline') {
      throw new Error('Cannot open fiscal day: Device is in Offline mode');
    }

    // Step 4: Determine next fiscal day number
    const currentDay = await getCurrentStatus(deviceId);
    const nextFiscalDayNo = currentDay ? currentDay.fiscal_day_no + 1 : 1;

    // Step 5: Prepare fiscalDayOpened timestamp (local time, no timezone)
    const now = new Date();
    const fiscalDayOpened = now.toISOString().split('.')[0]; // YYYY-MM-DDTHH:mm:ss

    console.log(`Step 2: Opening fiscal day ${nextFiscalDayNo}...`);
    console.log(`   Opened at: ${fiscalDayOpened}`);

    // Step 6: Call OpenDay API
    const deviceClient = getDeviceClient();
    const response = await deviceClient.post(
      `/Device/v1/${deviceId}/OpenDay`,
      {
        fiscalDayOpened,
        fiscalDayNo: nextFiscalDayNo
      }
    );

    const data = response.data;
    console.log('✅ Fiscal day opened successfully');
    console.log(`   Fiscal Day No: ${data.fiscalDayNo}`);
    console.log(`   Operation ID: ${data.operationID}`);

    // Step 7: Store in Supabase
    console.log('\nStep 3: Saving fiscal day to database...');
    const { data: fiscalDay, error } = await supabase
      .from('fiscal_days')
      .insert({
        device_id: deviceId,
        fiscal_day_no: data.fiscalDayNo,
        status: 'FiscalDayOpened',
        opened_at: now.toISOString(),
        open_operation_id: data.operationID,
        receipt_counter: 0,
        last_receipt_global_no: currentDay ? currentDay.last_receipt_global_no : 0,
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('⚠️  Failed to save fiscal day:', error.message);
      throw error;
    }

    console.log('✅ Fiscal day saved to database');

    console.log('\n========================================');
    console.log('✅ Fiscal Day Opened Successfully');
    console.log(`   Fiscal Day No: ${data.fiscalDayNo}`);
    console.log(`   Max Hours: ${config.taxPayerDayMaxHrs}`);
    console.log(`   VAT Status: ${config.vatNumber ? 'VAT Registered' : 'Not VAT Registered'}`);
    console.log('========================================\n');

    return {
      fiscalDayId: fiscalDay.id,
      fiscalDayNo: data.fiscalDayNo,
      operationID: data.operationID,
      openedAt: fiscalDayOpened,
      maxHours: config.taxPayerDayMaxHrs
    };
  } catch (error) {
    console.error('\n❌ Failed to open fiscal day');
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

module.exports = { openDay };
