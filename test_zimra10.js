const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config();

const DEVICE_ID = process.env.FDMS_DEVICE_ID || '35224';

const certPath = path.resolve(process.env.FDMS_CERT_PATH);
const keyPath = path.resolve(process.env.FDMS_KEY_PATH);

let httpsAgent;
if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  httpsAgent = new https.Agent({
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
    rejectUnauthorized: false
  });
} else {
  httpsAgent = new https.Agent({
    rejectUnauthorized: false
  });
}

// Generate a proper signature using the private key
function generateSignature() {
  try {
    if (fs.existsSync(keyPath)) {
      const privateKey = fs.readFileSync(keyPath);
      const data = "test_signature_data_for_zimra";
      const sign = crypto.createSign('SHA256');
      sign.update(data);
      sign.end();
      const signature = sign.sign(privateKey);
      const hash = crypto.createHash('sha256').update(data).digest();
      return {
        hash: Array.from(hash),
        signature: Array.from(signature)
      };
    }
  } catch (e) {
    console.log('Could not sign with key:', e.message);
  }
  
  // Fallback: random bytes as arrays
  return {
    hash: Array.from(crypto.randomBytes(32)),
    signature: Array.from(crypto.randomBytes(256))
  };
}

const sigData = generateSignature();

const payload = {
  deviceID: parseInt(DEVICE_ID),
  receipt: {
    receiptType: "FiscalInvoice",
    receiptCurrency: "USD",
    receiptCounter: 1,
    receiptGlobalNo: 1,
    invoiceNo: "INV-TEST-011",
    receiptDate: "2026-05-21T14:15:00",
    receiptLinesTaxInclusive: true,
    receiptNotes: null,
    buyerData: null,
    creditDebitNote: null,
    receiptLines: [
      {
        receiptLineType: "Sale",
        receiptLineNo: 1,
        receiptLineHSCode: "10019900",
        receiptLineName: "Test Product",
        receiptLinePrice: 86.96,
        receiptLineQuantity: 1.0,
        receiptLineTotal: 86.96,
        taxID: 1
      }
    ],
    receiptTaxes: [
      {
        taxCode: "A",
        taxPercent: 15.5,
        taxID: 1,
        taxAmount: 13.48,
        salesAmountWithTax: 100.44
      }
    ],
    receiptPayments: [
      {
        moneyTypeCode: "Cash",
        paymentAmount: 100.44
      }
    ],
    receiptTotal: 100.44,
    receiptPrintForm: "Receipt48",
    receiptDeviceSignature: sigData
  }
};

async function testPayload() {
  console.log('=== Testing with byte array signature ===');
  
  try {
    const response = await axios.post(
      `${process.env.FDMS_BASE_URL}/Device/v1/${DEVICE_ID}/SubmitReceipt`,
      payload,
      {
        headers: {
          'DeviceModelName': process.env.FDMS_DEVICE_MODEL_NAME,
          'DeviceModelVersion': process.env.FDMS_DEVICE_MODEL_VERSION,
          'DeviceModelVersionNo': process.env.FDMS_DEVICE_MODEL_VERSION,
          'Content-Type': 'application/json'
        },
        httpsAgent
      }
    );
    console.log('✅ SUCCESS:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ ERROR:', error.response?.status || error.message);
    console.log('Error Data:', JSON.stringify(error.response?.data, null, 2));
  }
}

testPayload().catch(console.error);
