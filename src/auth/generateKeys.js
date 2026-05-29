const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Generate ECC secp256r1 key pair and CSR using openssl
 * Per spec section 4.2 and 12
 */
async function generateKeys(deviceId) {
  const certsDir = path.resolve('./certs');
  
  // Ensure certs directory exists
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
  }

  const keyPath = path.join(certsDir, 'device.key.pem');
  const csrPath = path.join(certsDir, 'device.csr.pem');

  // Pad device ID to 10 digits
  const deviceIdPadded = String(deviceId).padStart(10, '0');
  
  // CSR CN format EXACTLY per spec:
  // ZIMRA-{FDMS_DEVICE_SERIAL_NO}-{deviceId zero padded to 10 digits}
  const subjectCN = `ZIMRA-${process.env.FDMS_DEVICE_SERIAL_NO}-${deviceIdPadded}`;

  // CSR Subject fields per spec
  const subject = `/C=ZW/O=Zimbabwe Revenue Authority/ST=Zimbabwe/CN=${subjectCN}`;

  try {
    console.log('Generating ECC secp256r1 private key...');
    
    // Generate ECC private key (secp256r1 / prime256v1)
    execSync(
      `openssl ecparam -name prime256v1 -genkey -noout -out "${keyPath}"`,
      { stdio: 'inherit' }
    );

    console.log('Generating CSR...');
    
    // Generate CSR
    execSync(
      `openssl req -new -key "${keyPath}" -out "${csrPath}" -subj "${subject}"`,
      { stdio: 'inherit' }
    );

    // Read CSR content
    const csrPem = fs.readFileSync(csrPath, 'utf8');

    console.log('✅ Key pair and CSR generated successfully');
    console.log(`   Private Key: ${keyPath}`);
    console.log(`   CSR: ${csrPath}`);
    console.log(`   Subject CN: ${subjectCN}`);

    return {
      keyPath,
      csrPath,
      csrPem,
      subjectCN
    };
  } catch (error) {
    console.error('❌ Failed to generate keys:', error.message);
    throw error;
  }
}

module.exports = { generateKeys };
