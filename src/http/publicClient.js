const axios = require('axios');

/**
 * Axios instance for Public endpoints - NO mTLS needed
 * Used for: RegisterDevice, VerifyTaxpayerInformation, GetServerCertificate
 */
const publicClient = axios.create({
  baseURL: process.env.FDMS_BASE_URL,
  timeout: 30000, // 30 seconds per spec section 7.4
  headers: {
    'DeviceModelName': process.env.FDMS_DEVICE_MODEL_NAME,
    'DeviceModelVersion': process.env.FDMS_DEVICE_MODEL_VERSION,
    'Content-Type': 'application/json'
  }
});

// Response interceptor to extract FDMS error details
publicClient.interceptors.response.use(
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

module.exports = publicClient;
