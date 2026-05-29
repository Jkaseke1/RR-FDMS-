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

// Try WITHOUT deviceID in body - spec says URL only
const payload = {
  submitReceiptRequest: {
    receipt: {
      receiptType: "FiscalInvoice",
      receiptCurrency: "USD",
      receiptCounter: 1,
      receiptGlobalNo: 1,
      invoiceNo: "INV-TEST-009",
      receiptDate: "2026-05-21T14:05:00",
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
      receiptDeviceSignature: {
        hash: "Qzi2Qzkz8eMH/8N0upP6OlmE9p8OXSRzjmECLHR6kUw=",
        signature: "a21QZJBdum0XUolAUi+HdBDPb8VsM/ACYrMrx+q8hRJ1tJ64gOvoPacOPERBBEKvUGdqZqB7WqL5Q3D8cPv9XVH8V8Q0ZXb1Y8qF9KfL3M4p7W5Qx8V2b9YqL8zF5Q0p3X1W6R4Y7bF2Q9V8L5M6N3P1R7S4T2U9V6W8X5Y1Z3A4B7C2D5E8F1G4H6I9J2K5L8M1N4O7P0Q3R6S9T2U5V8W1X4Y7Z0A3B6C9D2E5F8G1H4I7J0K3L6M9N2O5P8Q1R4S7T0U3V6W9X2Y5Z8A1B4C7D0E3F6G9H2I5J8K1L4M7N0O3P6Q9R2S5T8U1V4W7X0Y3Z6A9B2C5D8E1F4G7H0I3J6K9L2M5N8O1P4Q7R0S3T6U9V2W5X8Y1Z4="
      }
    }
  }
};

async function testPayload() {
  console.log('=== Testing WITHOUT deviceID in body ===');
  
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
