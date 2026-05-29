const https = require('https');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const DEVICE_ID = process.env.FDMS_DEVICE_ID || '35224';

const certPath = path.resolve(process.env.FDMS_CERT_PATH);
const keyPath = path.resolve(process.env.FDMS_KEY_PATH);

// Try submitReceiptRequest wrapper with ALL required fields
const payload = {
  submitReceiptRequest: {
    receipt: {
      receiptType: "FiscalInvoice",
      receiptDate: "2026-05-22T02:15:00",
      receiptGlobalNo: 1,
      receiptCounter: 1,
      receiptCurrency: "USD",
      receiptTotal: 100.44,
      receiptLinesTaxInclusive: true,
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
      receiptPrintForm: "Receipt48",
      receiptDeviceSignature: {
        hash: "Qzi2Qzkz8eMH/8N0upP6OlmE9p8OXSRzjmECLHR6kUw=",
        signature: "a21QZJBdum0XUolAUi+HdBDPb8VsM/ACYrMrx+q8hRJ1tJ64gOvoPacOPERBBEKvUGdqZqB7WqL5Q3D8cPv9XVH8V8Q0ZXb1Y8qF9KfL3M4p7W5Qx8V2b9YqL8zF5Q0p3X1W6R4Y7bF2Q9V8L5M6N3P1R7S4T2U9V6W8X5Y1Z3A4B7C2D5E8F1G4H6I9J2K5L8M1N4O7P0Q3R6S9T2U5V8W1X4Y7Z0A3B6C9D2E5F8G1H4I7J0K3L6M9N2O5P8Q1R4S7T0U3V6W9X2Y5Z8A1B4C7D0E3F6G9H2I5J8K1L4M7N0O3P6Q9R2S5T8U1V4W7X0Y3Z6A9B2C5D8E1F4G7H0I3J6K9L2M5N8O1P4Q7R0S3T6U9V2W5X8Y1Z4="
      }
    }
  }
};

const postData = JSON.stringify(payload);

const options = {
  hostname: 'fdmsapitest.zimra.co.zw',
  port: 443,
  path: `/Device/v1/${DEVICE_ID}/SubmitReceipt`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'DeviceModelName': process.env.FDMS_DEVICE_MODEL_NAME || 'Server',
    'DeviceModelVersion': process.env.FDMS_DEVICE_MODEL_VERSION || 'v1',
    'DeviceModelVersionNo': process.env.FDMS_DEVICE_MODEL_VERSION || 'v1',
    'Content-Length': Buffer.byteLength(postData)
  },
  cert: fs.existsSync(certPath) ? fs.readFileSync(certPath) : undefined,
  key: fs.existsSync(keyPath) ? fs.readFileSync(keyPath) : undefined,
  rejectUnauthorized: false
};

console.log('=== Test: submitReceiptRequest wrapper, complete fields ===');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    try {
      const json = JSON.parse(data);
      console.log('Response:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('Raw:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.write(postData);
req.end();
