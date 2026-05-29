const publicClient = require('../http/publicClient');
const { supabase } = require('../db/supabaseClient');

/**
 * Call POST /Public/v1/{deviceID}/VerifyTaxpayerInformation
 * Per spec section 4.1 - use before registerDevice to confirm correct taxpayer
 */
async function verifyTaxpayer(deviceId, activationKey, deviceSerialNo) {
  console.log(`\nVerifying taxpayer for device ${deviceId}...`);

  try {
    const response = await publicClient.post(
      `/Public/v1/${deviceId}/VerifyTaxpayerInformation`,
      {
        activationKey,
        deviceSerialNo
      }
    );

    const data = response.data;

    console.log('✅ Taxpayer verification successful');
    console.log(`   Taxpayer Name: ${data.taxPayerName}`);
    console.log(`   TIN: ${data.taxPayerTIN}`);
    console.log(`   VAT Number: ${data.vatNumber || 'Not VAT registered'}`);
    console.log(`   Branch: ${data.deviceBranchName}`);

    // Save to Supabase fiscal_devices
    const { error } = await supabase
      .from('fiscal_devices')
      .upsert({
        device_id: deviceId,
        device_serial_no: deviceSerialNo,
        activation_key: activationKey,
        taxpayer_name: data.taxPayerName,
        taxpayer_tin: data.taxPayerTIN,
        vat_number: data.vatNumber,
        device_branch_name: data.deviceBranchName,
        device_branch_address: data.deviceBranchAddress,
        device_branch_contacts: data.deviceBranchContacts,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'device_id'
      });

    if (error) {
      console.error('⚠️  Failed to save to Supabase:', error.message);
    }

    return data;
  } catch (error) {
    console.error('❌ Taxpayer verification failed');
    if (error.fdmsError) {
      console.error(`   Error Code: ${error.fdmsError.errorCode}`);
      console.error(`   Detail: ${error.fdmsError.detail}`);
    } else {
      console.error(`   ${error.message}`);
    }
    throw error;
  }
}

module.exports = { verifyTaxpayer };
