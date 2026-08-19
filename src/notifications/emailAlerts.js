const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const ALERT_STATE_FILE = path.join(
  process.env.FDMS_BASE_PATH || 'C:\\FDMS',
  'alert-state.json'
);

let transporter;

function isEnabled() {
  return process.env.ALERT_EMAIL_ENABLED === 'true' &&
    Boolean(process.env.ALERT_EMAIL_TO) &&
    Boolean(process.env.ALERT_SMTP_HOST) &&
    Boolean(process.env.ALERT_EMAIL_FROM || process.env.ALERT_SMTP_USER);
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

  state.sent = state.sent || {};
  state.sent[key] = { sentAt: now, message, level };
  saveAlertState(state);

  try {
    await getTransporter().sendMail({
      from: process.env.ALERT_EMAIL_FROM || process.env.ALERT_SMTP_USER,
      to: process.env.ALERT_EMAIL_TO,
      subject: `[FDMS ${deviceID}] ${level}: action required`,
      text: [
        'FDMS Bridge reported an operational error.',
        `Device: ${deviceID}`,
        `Time (UTC): ${new Date().toISOString()}`,
        `Level: ${level}`,
        '',
        message,
        '',
        'Check C:\\FDMS\\logs and the FDMS Bridge service on the server.'
      ].join('\n')
    });
    console.log('[FDMS alert] Error email sent.');
    return { sent: true };
  } catch (error) {
    console.error('[FDMS alert] Email delivery failed:', error.message);
    return { sent: false, reason: error.message };
  }
}

module.exports = { notifyErrorAlert };
