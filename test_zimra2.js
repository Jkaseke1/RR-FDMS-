const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');

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

// Correct payload with submitReceiptRequest wrapper AND taxID in receiptLines
const correctPayload = {
  submitReceiptRequest: {
    receipt: {
      receiptType: "FiscalInvoice",
      receiptCurrency: "USD",
      receiptCounter: 1,
      receiptGlobalNo: 1,
      invoiceNo: "INV-TEST-003",
      receiptDate: "2026-05-21T13:35:00",
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
      receiptPrintForm: "Receipt48"
    }
  }
};

async function testCorrectPayload() {
  console.log('=== Testing CORRECT payload structure ===');
  console.log('Payload:', JSON.stringify(correctPayload, null, 2));
  
  try {
    const response = await axios.post(
      `${process.env.FDMS_BASE_URL}/Device/v1/${DEVICE_ID}/SubmitReceipt`,
      correctPayload,
      {
        headers: {
          'DeviceModelName': process.env.FDMS_DEVICE_MODEL_NAME,
          'DeviceModelVersion': process.env.FDMS_DEVICE_MODEL_VERSION,
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

testCorrectPayload().catch(console.error);
