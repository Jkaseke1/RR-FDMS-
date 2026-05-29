const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');

let deviceClient = null;

/**
 * Create axios instance for Device endpoints - mTLS required
 * Recreate after registerDevice completes to load new certificates
 */
function createDeviceClient() {
  const certPath = path.resolve(process.env.FDMS_CERT_PATH);
  const keyPath = path.resolve(process.env.FDMS_KEY_PATH);
  const caPath = path.resolve(process.env.FDMS_CA_PATH);

  let httpsAgent;

  // Check if certificates exist
  const certExists = fs.existsSync(certPath);
  const keyExists = fs.existsSync(keyPath);
  const caExists = fs.existsSync(caPath);

  if (certExists && keyExists) {
    // Full mTLS with certificates
    httpsAgent = new https.Agent({
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
      ca: caExists ? fs.readFileSync(caPath) : undefined,
      rejectUnauthorized: false // Disable for now - ZIMRA's CA chain issue
    });
  } else {
    // Before registerDevice - no client cert yet
    httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });
  }

  deviceClient = axios.create({
    baseURL: process.env.FDMS_BASE_URL,
    timeout: 30000,
    headers: {
      'DeviceModelName': process.env.FDMS_DEVICE_MODEL_NAME,
      'DeviceModelVersion': process.env.FDMS_DEVICE_MODEL_VERSION,
      'DeviceModelVersionNo': process.env.FDMS_DEVICE_MODEL_VERSION,
      'Content-Type': 'application/json'
    },
    httpsAgent
  });

  // Response interceptor for error handling
  deviceClient.interceptors.response.use(
    response => response,
    error => {
      if (error.response && error.response.data) {
        const fdmsError = {
          status: error.response.status,
          errorCode: error.response.data.errorCode || error.response.data.code,
          operationID: error.response.data.operationID,
          detail: error.response.data.detail || error.response.data.message,
          raw: error.response.data
        };
        error.fdmsError = fdmsError;
      }
      return Promise.reject(error);
    }
  );

  return deviceClient;
}

// Initialize on first require
if (!deviceClient) {
  createDeviceClient();
}

module.exports = {
  getDeviceClient: () => deviceClient,
  createDeviceClient
};
