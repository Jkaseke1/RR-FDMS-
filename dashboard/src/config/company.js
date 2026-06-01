// ============================================================
//  PER-CLIENT CONFIGURATION
//  Edit this single file when deploying for a new client.
//  Values fall back to env vars (VITE_*) if provided at build time.
// ============================================================

const env = import.meta.env || {};

export const COMPANY = {
  // --- Company / taxpayer details ---
  name:       env.VITE_COMPANY_NAME       || 'Rapid Roots Investments (Pvt) Ltd',
  shortName:  env.VITE_COMPANY_SHORT_NAME || 'Rapid Roots',
  address:    env.VITE_COMPANY_ADDRESS    || '59 Glenelg Road, Vainona, Harare, Zimbabwe',
  telephone:  env.VITE_COMPANY_PHONE      || '0777544145 / 0778585874',
  email:      env.VITE_COMPANY_EMAIL      || 'rapidrootszw@gmail.com',

  // --- ZIMRA device registration ---
  deviceId:   env.VITE_DEVICE_ID          || '35224',
  serialNo:   env.VITE_DEVICE_SERIAL      || 'RapidR-1',
  tin:        env.VITE_TIN                || '2002054676',
  vatNo:      env.VITE_VAT                || '220401569',
  model:      env.VITE_DEVICE_MODEL       || 'Server v1',

  // --- Tax configuration ---
  vatRate:    env.VITE_VAT_RATE           || '15.5%',
  taxIds:     env.VITE_TAX_IDS            || '517 — Standard 15.5% · 2 — Zero rated · 1 — Exempt',

  // --- Environment ---
  environment: env.VITE_ENVIRONMENT       || 'TEST',           // TEST or PRODUCTION
  apiEndpoint: env.VITE_FDMS_ENDPOINT     || 'fdmsapitest.zimra.co.zw',
};

export default COMPANY;
