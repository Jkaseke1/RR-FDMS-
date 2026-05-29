const publicClient = require('../http/publicClient');
const fs = require('fs');
const path = require('path');

/**
 * Call GET /Public/v1/GetServerCertificate
 * Per spec section 4.11
 * No authentication required
 */
async function getServerCertificate(thumbprint = null) {
  console.log('\nFetching FDMS server certificate...');

  try {
    const url = thumbprint 
      ? `/Public/v1/GetServerCertificate?thumbprint=${thumbprint}`
      : `/Public/v1/GetServerCertificate`;

    const response = await publicClient.get(url);
    const data = response.data;

    console.log('✅ Server certificate retrieved');
    console.log(`   Valid until: ${data.certificateValidTill}`);
    console.log(`   Certificates in chain: ${data.certificate.length}`);

    // Save root CA certificate (first in chain)
    const caPath = path.resolve(process.env.FDMS_CA_PATH);
    const certsDir = path.dirname(caPath);
    
    if (!fs.existsSync(certsDir)) {
      fs.mkdirSync(certsDir, { recursive: true });
    }

    fs.writeFileSync(caPath, data.certificate[0], 'utf8');
    console.log(`   Root CA saved: ${caPath}`);

    // Save full chain
    const chainPath = path.resolve('./certs/fdms-chain.pem');
    const fullChain = data.certificate.join('\n');
    fs.writeFileSync(chainPath, fullChain, 'utf8');
    console.log(`   Full chain saved: ${chainPath}`);

    return {
      certificate: data.certificate,
      certificateValidTill: data.certificateValidTill
    };
  } catch (error) {
    console.error('❌ Failed to get server certificate');
    if (error.fdmsError) {
      console.error(`   Error Code: ${error.fdmsError.errorCode}`);
      console.error(`   Detail: ${error.fdmsError.detail}`);
    } else {
      console.error(`   ${error.message}`);
    }
    throw error;
  }
}

module.exports = { getServerCertificate };
