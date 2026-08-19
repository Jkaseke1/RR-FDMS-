const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const ALERT_STATE_FILE = path.join(
  process.env.FDMS_BASE_PATH || 'C:\\FDMS',
  'alert-state.json'
);

let transporter;

function provider() {
  return (process.env.ALERT_EMAIL_PROVIDER || 'smtp').toLowerCase();
}

function isEnabled() {
  if (process.env.ALERT_EMAIL_ENABLED !== 'true' ||
      !process.env.ALERT_EMAIL_TO ||
      !process.env.ALERT_EMAIL_FROM) {
    return false;
  }

  if (provider() === 'microsoft-graph') {
    return Boolean(process.env.ALERT_M365_TENANT_ID) &&
      Boolean(process.env.ALERT_M365_CLIENT_ID) &&
      Boolean(process.env.ALERT_M365_CLIENT_SECRET);
  }

  return Boolean(process.env.ALERT_SMTP_HOST) &&
    Boolean(process.env.ALERT_SMTP_USER);
}

function loadAlertState() {
  try {
    return JSON.parse(fs.readFileSync(ALERT_STATE_FILE, 'utf8'));
  } catch (_) {
    return { sent: {} };
  }
}

function saveAlertState(state) {
  try {
    fs.writeFileSync(ALERT_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    // Alert delivery must never prevent fiscalization.
    console.error('[FDMS alert] Could not save alert state:', error.message);
  }
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.ALERT_SMTP_HOST,
      port: Number(process.env.ALERT_SMTP_PORT || 587),
      secure: process.env.ALERT_SMTP_SECURE === 'true',
      auth: process.env.ALERT_SMTP_USER
        ? {
            user: process.env.ALERT_SMTP_USER,
            pass: process.env.ALERT_SMTP_PASS
          }
        : undefined
    });
  }
  return transporter;
}

function alertText(message, level, deviceID) {
  return [
    'FDMS Bridge reported an operational error.',
    `Device: ${deviceID}`,
    `Time (UTC): ${new Date().toISOString()}`,
    `Level: ${level}`,
    '',
    message,
    '',
    'Check C:\\FDMS\\logs and the FDMS Bridge service on the server.'
  ].join('\n');
}

async function sendWithMicrosoftGraph(subject, text) {
  const tokenBody = new URLSearchParams({
    client_id: process.env.ALERT_M365_CLIENT_ID,
    client_secret: process.env.ALERT_M365_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });
  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(process.env.ALERT_M365_TENANT_ID)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody
    }
  );
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(`Microsoft Graph token request failed: ${tokenData.error_description || tokenResponse.status}`);
  }

  const toRecipients = process.env.ALERT_EMAIL_TO.split(',')
    .map(address => address.trim())
    .filter(Boolean)
    .map(address => ({ emailAddress: { address } }));
  const sendResponse = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(process.env.ALERT_EMAIL_FROM)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'Text', content: text },
          toRecipients
        },
        saveToSentItems: true
      })
    }
  );
  if (!sendResponse.ok) {
    throw new Error(`Microsoft Graph send failed: ${await sendResponse.text()}`);
  }
}

/**
 * Email an operational error once per configured cooldown window.  The
 * persisted state survives service restarts, preventing repeated scheduler
 * errors from generating a mailbox flood.
 */
async function notifyErrorAlert(message, level = 'ERROR') {
  if (!isEnabled()) {
    return { sent: false, reason: 'email alerts are not configured' };
  }

  const deviceID = process.env.FDMS_DEVICE_ID || process.env.DEVICE_ID || 'unknown';
  const key = crypto.createHash('sha256')
    .update(`${deviceID}|${level}|${message}`)
    .digest('hex');
  const cooldownMs = Math.max(
    1,
    Number(process.env.ALERT_EMAIL_COOLDOWN_MINUTES || 60)
  ) * 60 * 1000;
  const state = loadAlertState();
  const previous = state.sent?.[key];
  const now = Date.now();

  if (previous && now - previous.sentAt < cooldownMs) {
    return { sent: false, reason: 'duplicate alert suppressed' };
  }

  try {
    const subject = `[FDMS ${deviceID}] ${level}: action required`;
    const text = alertText(message, level, deviceID);
    if (provider() === 'microsoft-graph') {
      await sendWithMicrosoftGraph(subject, text);
    } else {
      await getTransporter().sendMail({
        from: process.env.ALERT_EMAIL_FROM,
        to: process.env.ALERT_EMAIL_TO,
        subject,
        text
      });
    }
    state.sent = state.sent || {};
    state.sent[key] = { sentAt: now, message, level };
    saveAlertState(state);
    console.log('[FDMS alert] Error email sent.');
    return { sent: true };
  } catch (error) {
    console.error('[FDMS alert] Email delivery failed:', error.message);
    return { sent: false, reason: error.message };
  }
}

module.exports = { notifyErrorAlert };
