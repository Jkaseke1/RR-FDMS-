const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');

let userClient = null;

/**
 * Create axios instance for User endpoints - mTLS required
 * Identical to deviceClient but for User API endpoints
 */
function createUserClient() {
  const certPath = path.resolve(process.env.FDMS_CERT_PATH);
  const keyPath = path.resolve(process.env.FDMS_KEY_PATH);
  const caPath = path.resolve(process.env.FDMS_CA_PATH);

  let httpsAgent;

  const certExists = fs.existsSync(certPath);
  const keyExists = fs.existsSync(keyPath);
  const caExists = fs.existsSync(caPath);

  if (certExists && keyExists && caExists) {
    httpsAgent = new https.Agent({
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
      ca: fs.readFileSync(caPath),
      rejectUnauthorized: true
    });
  } else {
    if (caExists) {
      httpsAgent = new https.Agent({
        ca: fs.readFileSync(caPath),
        rejectUnauthorized: true
      });
    } else {
      httpsAgent = new https.Agent({
        rejectUnauthorized: true
      });
    }
  }

  userClient = axios.create({
    baseURL: process.env.FDMS_BASE_URL,
    timeout: 30000,
    headers: {
      'DeviceModelName': process.env.FDMS_DEVICE_MODEL_NAME,
      'DeviceModelVersionNo': process.env.FDMS_DEVICE_MODEL_VERSION,
      'Content-Type': 'application/json'
    },
    httpsAgent
  });

  // Response interceptor for error handling
  userClient.interceptors.response.use(
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

  return userClient;
}

// Initialize on first require
if (!userClient) {
  createUserClient();
}

module.exports = {
  getUserClient: () => userClient,
  createUserClient
};
