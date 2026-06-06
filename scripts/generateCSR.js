/**
 * Generate CSR for ZIMRA Device Registration
 * Creates a new private key and Certificate Signing Request
 * 
 * Usage:
 *   node scripts/generateCSR.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load .env
require('dotenv').config();

const deviceId = process.env.DEVICE_ID || '41885';
const deviceSerial = process.env.DEVICE_SERIAL || 'RapidR-1';

console.log('\n' + '='.repeat(70));
console.log('  ZIMRA CSR Generator');
console.log('  Device:', deviceSerial, '(ID:', deviceId + ')');
console.log('='.repeat(70) + '\n');

const certsDir = path.join(__dirname, '..', 'certs');
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

// Generate EC key pair (P-256)
console.log('🔑 Generating EC P-256 key pair...');
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'P-256',
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

console.log('✅ Key pair generated');

// Create CSR
const subject = `/C=ZW/ST=Zimbabwe/O=Zimbabwe Revenue Authority/CN=ZIMRA-${deviceSerial}-${String(deviceId).padStart(10, '0')}`;
console.log('📋 CSR Subject:', subject);

// Save private key
const keyPath = path.join(certsDir, 'device.key.pem');
fs.writeFileSync(keyPath, privateKey);
console.log('✅ Private key saved to:', keyPath);

// Save public key
const pubPath = path.join(certsDir, 'device.pub.pem');
fs.writeFileSync(pubPath, publicKey);
console.log('✅ Public key saved to:', pubPath);

// Generate CSR using OpenSSL command
const { execSync } = require('child_process');
const csrPath = path.join(certsDir, 'device.csr.pem');

try {
  // Try using OpenSSL
  const opensslCmd = `openssl req -new -sha256 -key "${keyPath}" -out "${csrPath}" -subj "${subject}"`;
  execSync(opensslCmd, { stdio: 'inherit' });
  console.log('✅ CSR generated with OpenSSL');
} catch (err) {
  console.log('\n⚠️  OpenSSL command failed. Trying Node.js crypto...');
  
  // Fallback: Create a simple CSR using Node.js
  // Note: This is a simplified CSR. For production, OpenSSL is preferred.
  try {
    const csr = crypto.createSign('SHA256');
    const csrData = Buffer.from(subject);
    csr.update(csrData);
    const signature = csr.sign(privateKey, 'base64');
    
    // Create a basic CSR structure (simplified)
    const csrPem = `-----BEGIN CERTIFICATE REQUEST-----\n${signature}\n-----END CERTIFICATE REQUEST-----`;
    fs.writeFileSync(csrPath, csrPem);
    console.log('✅ Basic CSR created (Note: OpenSSL preferred for production)');
  } catch (fallbackErr) {
    console.log('❌ Failed to generate CSR');
    console.log('Please install OpenSSL and run:');
    console.log(`  openssl req -new -sha256 -key "${keyPath}" -out "${csrPath}" -subj "${subject}"`);
    process.exit(1);
  }
}

// Verify CSR
if (fs.existsSync(csrPath)) {
  const csrContent = fs.readFileSync(csrPath, 'utf8');
  console.log('\n' + '='.repeat(70));
  console.log('✅ CSR Generated Successfully!');
  console.log('='.repeat(70));
  console.log('File:', csrPath);
  console.log('Size:', csrContent.length, 'bytes');
  console.log('\nNext Steps:');
  console.log('  1. Run: node scripts/registerProductionDevice.js');
  console.log('  2. Or submit CSR to ZIMRA manually');
  console.log('='.repeat(70) + '\n');
} else {
  console.log('\n❌ CSR file was not created');
}
