/**
 * PDF Fiscalization Service
 * Watches FDMS\unsigned folder for PDFs
 * Fiscalizes them and moves to FDMS\signed or FDMS\failed
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { submitReceipt } = require('../receipts/submitReceipt');
const { parseInvoicePDF } = require('../utils/invoicePdfParser');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Paths
const FDMS_BASE = process.env.FDMS_BASE_PATH || 'C:\\FDMS';
const UNSIGNED_DIR = path.join(FDMS_BASE, 'unsigned');
const SIGNED_DIR = path.join(FDMS_BASE, 'signed');
const FAILED_DIR = path.join(FDMS_BASE, 'failed');
const LOGS_DIR = path.join(FDMS_BASE, 'logs');

const DEVICE_ID = process.env.FDMS_DEVICE_ID || process.env.DEVICE_ID;
const POLL_INTERVAL = parseInt(process.env.FISCALIZATION_POLL_INTERVAL || '10000');

// State file for counters
const STATE_FILE = path.join(
  process.env.FDMS_BASE_PATH || 'C:\\FDMS',
  'state.json'
);

function loadState() {
  let state;
  if (fs.existsSync(STATE_FILE)) {
    try {
      state = JSON.parse(
        fs.readFileSync(STATE_FILE, 'utf8')
      );
    } catch(e) {
      state = { receiptCounter: 0, receiptGlobalNo: 0 };
    }
  } else {
    state = { receiptCounter: 0, receiptGlobalNo: 0 };
  }
  if (!state.processedInvoices) {
    state.processedInvoices = {};
  }
  // Migrate old array format if needed
  if (Array.isArray(state.processedInvoices)) {
    state.processedInvoices = {};
  }
  if (!state.fiscalDayNo) {
    state.fiscalDayNo = 1;
  }
  if (!state.fiscalCounters) {
    state.fiscalCounters = {};
  }

  // Migrate old flat fiscalCounters (pre per-currency) to new structure
  const fc = state.fiscalCounters;
  if (fc.salesAmountWithTax !== undefined &&
      !fc.USD && !fc.ZWL && !fc.ZWG) {
    const oldCurrency = fc.currency || 'USD';
    state.fiscalCounters = {
      [oldCurrency]: {
        salesAmountWithTax: fc.salesAmountWithTax || 0,
        taxAmount: fc.taxAmount || 0,
        paymentAmount: fc.paymentAmount || 0,
        taxPercent: fc.taxPercent || 15.5
      }
    };
    log('Migrated flat fiscalCounters to per-currency structure for ' + oldCurrency, 'INFO');
  }
  return state;
}

function saveState(state) {
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify(state, null, 2)
  );
}

// Sage Tax Code to ZIMRA Tax ID Mapping
// Zimbabwe VAT Rate: 15.5%
const TAX_CODE_MAPPING = {
    1: { zimraTaxId: 515, rate: 15.5, description: 'Output Tax (VAT)' },
    2: { zimraTaxId: 515, rate: 15.5, description: 'Output Tax Adjustment' },
    3: { zimraTaxId: 515, rate: 15.5, description: 'Input Tax' },
    4: { zimraTaxId: 515, rate: 15.5, description: 'Input Tax Capital' },
    5: { zimraTaxId: 515, rate: 15.5, description: 'Input Tax Adjustment' },
    6: { zimraTaxId: 2,   rate: 0.00, description: 'Zero Rate' },
    7: { zimraTaxId: 1,   rate: null, description: 'Exempt' }
};

/**
 * Initialize directories
 */
function initializeDirs() {
    const dirs = [UNSIGNED_DIR, SIGNED_DIR, FAILED_DIR, LOGS_DIR];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`✅ Created directory: ${dir}`);
        }
    });
}

/**
 * Log message to file and console
 */
function log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);
    
    const logFile = path.join(LOGS_DIR, `fiscalization-${new Date().toISOString().split('T')[0]}.log`);
    fs.appendFileSync(logFile, logMessage + '\n');
}

async function syncTaxConfig() {
  try {
    const { getDeviceClient } =
      require('../http/deviceClient');
    const client = getDeviceClient();
    const response = await client.get(
      '/Device/v1/' + DEVICE_ID + '/GetConfig'
    );
    const taxes = response.data?.applicableTaxes
      || [];

    const vatTax = taxes.find(t =>
      t.taxPercent === 15.5
    );
    const zeroTax = taxes.find(t =>
      t.taxPercent === 0
    );
    const exemptTax = taxes.find(t =>
      !t.taxPercent && t.taxName
        .toLowerCase().includes('exempt')
    );

    const state = loadState();
    state.taxConfig = {
      vatTaxID:     vatTax?.taxID    || 517,
      vatPercent:   vatTax?.taxPercent || 15.5,
      zeroTaxID:    zeroTax?.taxID   || 2,
      exemptTaxID:  exemptTax?.taxID || 1
    };
    saveState(state);

    log('Tax config synced: VAT taxID=' +
      state.taxConfig.vatTaxID +
      ' Zero taxID=' + state.taxConfig.zeroTaxID +
      ' Exempt taxID=' + state.taxConfig.exemptTaxID, 'INFO');

    return state.taxConfig;
  } catch (err) {
    log('Tax config sync failed: ' +
      err.message + ' — using defaults', 'WARN');
    return {
      vatTaxID:    517,
      vatPercent:  15.5,
      zeroTaxID:   2,
      exemptTaxID: 1
    };
  }
}

/**
 * Extract invoice data from PDF filename
 * Sage format: Invoice_YYYYMMDD_HHMMSS.pdf
 */
function parseFilename(filename) {
    // Match Sage format: Invoice_20260521_130051.pdf
    const match = filename.match(/Invoice_(\d{8})_(\d{6})/i);
    if (!match) {
        return null;
    }
    
    const dateStr = match[1]; // YYYYMMDD
    const timeStr = match[2]; // HHMMSS
    
    return {
        date: dateStr,
        time: timeStr,
        timestamp: `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)} ${timeStr.substring(0,2)}:${timeStr.substring(2,4)}:${timeStr.substring(4,6)}`
    };
}

/**
 * Get qrUrl from ZIMRA device config
 */
async function getQrUrlFromZIMRA() {
  try {
    const { getDeviceClient } =
      require('../http/deviceClient');
    const client = getDeviceClient();
    const response = await client.get(
      `/Device/v1/${DEVICE_ID}/GetConfig`
    );
    return response.data?.qrUrl ||
      process.env.FDMS_BASE_URL ||
      process.env.FDMS_URL;
  } catch (err) {
    log('Could not get qrUrl from ZIMRA config: '
      + err.message, 'WARN');
    return process.env.FDMS_BASE_URL ||
      process.env.FDMS_URL;
  }
}

/**
 * Build QR code value per ZIMRA spec section 11
 */
function buildQrCodeValue(
  qrUrl,
  deviceId,
  receiptDate,
  receiptGlobalNo,
  deviceSignature
) {
  // deviceID padded to 10 digits
  const deviceIdPadded = String(deviceId)
    .padStart(10, '0');

  // receiptDate as ddMMyyyy
  const dateParts = receiptDate.split('T')[0]
    .split('-');
  const dateFormatted =
    dateParts[2] + dateParts[1] + dateParts[0];

  // receiptGlobalNo padded to 10 digits
  const globalNoPadded = String(receiptGlobalNo)
    .padStart(10, '0');

  // receiptQrData: first 16 chars of MD5 hash
  // of device signature in HEX format
  const sigBuffer = Buffer.from(
    deviceSignature, 'base64'
  );
  const md5Hex = crypto.createHash('md5')
    .update(sigBuffer)
    .digest('hex')
    .toUpperCase();
  const receiptQrData = md5Hex.substring(0, 16);

  // Ensure qrUrl ends with /
  const baseUrl = qrUrl.endsWith('/')
    ? qrUrl
    : qrUrl + '/';

  return baseUrl + deviceIdPadded + dateFormatted
    + globalNoPadded + receiptQrData;
}

/**
 * Stamp ZIMRA fiscalization data onto existing invoice PDF
 */
async function stampReceiptOnPDF(
  inputPath,
  outputPath,
  zimraData
) {
  const existingPdfBytes = fs.readFileSync(inputPath);
  const { PDFDocument, rgb, StandardFonts } =
    require('pdf-lib');
  const QRCode = require('qrcode');

  const pdfDoc = await PDFDocument.load(
    existingPdfBytes
  );

  const pages = pdfDoc.getPages();
  const page = pages[pages.length - 1];
  const { width, height } = page.getSize();

  // Generate QR code
  const qrBuffer = await QRCode.toBuffer(
    zimraData.qrCodeValue, {
    type: 'png',
    width: 150,
    margin: 1,
    errorCorrectionLevel: 'M'
  });

  const qrImage = await pdfDoc.embedPng(qrBuffer);
  const font = await pdfDoc.embedFont(
    StandardFonts.Helvetica
  );
  const boldFont = await pdfDoc.embedFont(
    StandardFonts.HelveticaBold
  );

  // Box dimensions
  const boxWidth = 220;
  const boxHeight = 120;
  const boxX = width - boxWidth - 15;
  const boxY = 15;

  // QR code size and position (right side of box)
  const qrSize = 95;
  const qrX = boxX + boxWidth - qrSize - 8;
  const qrY = boxY + (boxHeight - qrSize) / 2;

  // Text area (left side of box)
  const textX = boxX + 8;
  const textAreaWidth = boxWidth - qrSize - 24;

  // White background
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    color: rgb(1, 1, 1),
    opacity: 1
  });

  // Green border
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    borderColor: rgb(0, 0.55, 0.1),
    borderWidth: 1.5,
    opacity: 0
  });

  // Vertical divider between text and QR
  page.drawLine({
    start: { x: qrX - 6, y: boxY + 8 },
    end: { x: qrX - 6, y: boxY + boxHeight - 8 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8)
  });

  // Draw QR code on right side
  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize
  });

  // Text on left side - vertically centered
  // Calculate starting Y from top of box
  const lineHeight = 13;
  const totalLines = 7;
  const totalTextHeight = totalLines * lineHeight;
  let textY = boxY + boxHeight - 16;

  // FISCALIZED in green bold
  page.drawText('FISCALIZED', {
    x: textX,
    y: textY,
    size: 10,
    font: boldFont,
    color: rgb(0, 0.55, 0.1)
  });

  textY -= 14;
  // Divider line under heading
  page.drawLine({
    start: { x: textX, y: textY + 2 },
    end: { x: qrX - 10, y: textY + 2 },
    thickness: 0.5,
    color: rgb(0, 0.55, 0.1)
  });

  textY -= 4;

  // Receipt ID
  page.drawText('Receipt ID:', {
    x: textX,
    y: textY,
    size: 7,
    font: boldFont,
    color: rgb(0.3, 0.3, 0.3)
  });
  page.drawText(String(zimraData.receiptId), {
    x: textX,
    y: textY - 9,
    size: 8,
    font: font,
    color: rgb(0, 0, 0)
  });

  textY -= 22;

  // Invoice No
  page.drawText('Invoice No:', {
    x: textX,
    y: textY,
    size: 7,
    font: boldFont,
    color: rgb(0.3, 0.3, 0.3)
  });
  page.drawText(String(zimraData.invoiceNo), {
    x: textX,
    y: textY - 9,
    size: 8,
    font: font,
    color: rgb(0, 0, 0)
  });

  textY -= 22;

  // Global No and Date on same row
  page.drawText('Global No:', {
    x: textX,
    y: textY,
    size: 7,
    font: boldFont,
    color: rgb(0.3, 0.3, 0.3)
  });
  page.drawText(String(zimraData.globalNo), {
    x: textX,
    y: textY - 9,
    size: 8,
    font: font,
    color: rgb(0, 0, 0)
  });

  textY -= 22;

  // Verification code
  const sigBuffer = Buffer.from(
    zimraData.signature || '', 'base64'
  );
  const md5Hex = require('crypto')
    .createHash('md5')
    .update(sigBuffer)
    .digest('hex')
    .toUpperCase();
  const qrDataRaw = md5Hex.substring(0, 16);
  const verifyCode = qrDataRaw
    .match(/.{1,4}/g).join('-');

  page.drawText('Code:', {
    x: textX,
    y: textY,
    size: 7,
    font: boldFont,
    color: rgb(0.3, 0.3, 0.3)
  });
  page.drawText(verifyCode, {
    x: textX,
    y: textY - 9,
    size: 7,
    font: font,
    color: rgb(0, 0, 0)
  });

  // Save
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  log('Stamped QR on invoice: ' + outputPath, 'SUCCESS');
}

/**
 * Fiscalize a single PDF
 */
async function fiscalizePDF(filename, taxConfig) {
  const inputPath = path.join(UNSIGNED_DIR, filename);

  if (!fs.existsSync(inputPath)) {
    log('File no longer exists: ' + filename, 'WARN');
    return false;
  }

  // Track counter state so a rejected receipt can be rolled back. ZIMRA only
  // records receipts it accepts; a failed submission must NOT consume a
  // receiptCounter/receiptGlobalNo, or the next receipt creates a sequence gap.
  let countersIncremented = false;
  let receiptAccepted = false;

  try {
    log('='.repeat(60), 'INFO');
    log('FISCALIZING: ' + filename, 'INFO');
    log('='.repeat(60), 'INFO');

    // Parse PDF
    log('Parsing PDF...', 'INFO');
    const pdfData = await parseInvoicePDF(inputPath);

    if (!pdfData) {
      throw new Error('Failed to parse PDF');
    }

    if (!pdfData.invoiceNumber) {
      throw new Error('Invoice number not found in PDF');
    }

    // Extract amounts
    const totalIncl = pdfData.totalIncl || 0;
    const totalExcl = pdfData.totalExcl || 0;
    const taxAmount = pdfData.taxAmount || 0;
    const taxPercent = pdfData.taxRate || 15.5;

    log('Invoice: ' + pdfData.invoiceNumber, 'INFO');
    log('Customer: ' + (pdfData.customerName || 'Walk-in'), 'INFO');
    log('TIN: ' + (pdfData.customerTIN || 'None'), 'INFO');
    log('Total Excl: $' + totalExcl, 'INFO');
    log('Tax (' + taxPercent + '%): $' + taxAmount, 'INFO');
    log('Total Incl: $' + totalIncl, 'INFO');
    log('Lines: ' + pdfData.lineItems.length, 'INFO');

    // Validate amounts
    if (!totalIncl || totalIncl <= 0) {
      throw new Error('Invalid amount: $' + totalIncl);
    }

    // Guard: never submit a receipt with no parseable line items.
    // An empty receipt triggers ZIMRA 162 (no receipt lines) / 172
    // (no taxes) / 202 (signature) and blocks the fiscal day from closing.
    // This runs BEFORE counters are incremented so no global number is wasted.
    if (!pdfData.lineItems || pdfData.lineItems.length === 0) {
      throw new Error(
        'No line items parsed from PDF — refusing to submit empty receipt ' +
        '(would trigger ZIMRA 162/172). Check the PDF parser for this invoice format.'
      );
    }

    // Load state FIRST to check last receipt date
    const state = loadState();

    // Invoice date: must be current time, >= 1 sec after last receipt
    // ZIMRA requirement: no two receipts can share same timestamp;
    // must be in strict chronological order with 1-second gaps
    let invoiceDate = new Date();
    const lastDate = state.lastReceiptDate
      ? new Date(state.lastReceiptDate)
      : new Date(0);
    if (invoiceDate <= lastDate) {
      invoiceDate = new Date(lastDate.getTime() + 1000);
    }
    invoiceDate = invoiceDate.toISOString()
      .replace('Z', '')
      .split('.')[0];

    // Increment counters
    state.receiptCounter += 1;
    state.receiptGlobalNo += 1;
    saveState(state);
    countersIncremented = true;

    log('Receipt counter: ' + state.receiptCounter, 'INFO');
    log('Global No: ' + state.receiptGlobalNo, 'INFO');

    // Duplicate invoice check — handled after receiptLines/receiptTaxes built

    // Build buyer data
    const buyerData = pdfData.customerTIN
      ? {
          buyerRegisterName: pdfData.customerName,
          buyerTIN: pdfData.customerTIN,
          VATNumber: pdfData.customerVAT || null,
          buyerContacts: null,
          buyerAddress: {
            province: pdfData.customerProvince || 'Harare',
            city: pdfData.customerCity || 'Harare',
            street: pdfData.customerStreet || pdfData.customerHseNo || 'N/A',
            houseNo: 'N/A'
          }
        }
      : null;

    // Credit note flag — determines sign of amounts and receipt type
    const isCreditNote = pdfData.documentType === 'credit_note';
    const sign = isCreditNote ? -1 : 1;
    let currency = pdfData.currency || 'USD';
    // ZIMRA accepts ZWG directly (not ZWL or ZIG)
    // Keep ZWG as-is for submission

    // Credit notes must match original invoice currency stored in ZIMRA
    if (isCreditNote && pdfData.originalInvoiceNumber) {
      const original = state.processedInvoices[pdfData.originalInvoiceNumber];
      if (original && original.currency) {
        currency = original.currency;
        log('Credit note using original invoice currency: ' + currency, 'INFO');
      }
    }

    if (isCreditNote) {
      log('Processing CREDIT NOTE: ' + pdfData.creditNoteNumber, 'INFO');
      log('Original Invoice: ' + pdfData.originalInvoiceNumber, 'INFO');
      log('Currency: ' + currency, 'INFO');
    }

    // ── Build ZIMRA-compliant taxes & lines ──────────────────────────
    // ZIMRA recalculates tax from the tax-INCLUSIVE sales total and cross-
    // validates every figure (errors 262/272/372/382). To satisfy all of
    // them at once we anchor on the inclusive line totals and DERIVE tax as
    //   tax = round(salesWithTax * rate / (100 + rate))
    // We never send Sage's printed per-line tax, whose rounding ZIMRA rejects.
    const vatRate = taxConfig.vatPercent || taxPercent || 15.5;

    const categoryOf = (item) => {
      const code = item.sageTaxCode || (item.tax > 0 ? 1 : 6);
      if (code === 1) return 'A';
      if (code === 6) return 'B';
      if (code === 7) return 'C';
      return item.tax > 0 ? 'A' : 'B';
    };

    // Tax-table metadata sourced from the ZIMRA-synced config so per-line
    // and tax-table taxIDs always agree (prevents error 252).
    const CATEGORY_META = {
      A: { taxID: taxConfig.vatTaxID,    taxPercent: vatRate, rate: vatRate },
      B: { taxID: taxConfig.zeroTaxID,   taxPercent: 0,       rate: 0 },
      C: { taxID: taxConfig.exemptTaxID, taxPercent: null,    rate: 0 }
    };

    const groups = { A: [], B: [], C: [] };
    pdfData.lineItems.forEach(item => {
      groups[categoryOf(item)].push(item);
    });

    const receiptTaxes = [];
    const receiptLines = [];
    let lineNo = 0;
    let receiptTotalAbs = 0;
    let computedTaxAbs = 0;

    for (const code of ['A', 'B', 'C']) {
      const items = groups[code];
      if (items.length === 0) continue;
      const meta = CATEGORY_META[code];

      // Anchor: tax-inclusive sales total for this category
      const salesWithTaxAbs = Math.round(
        items.reduce((s, i) => s + Math.abs(i.totalIncl), 0) * 100
      ) / 100;

      // Tax derived exactly the way ZIMRA recalculates it
      const taxAbs = meta.rate > 0
        ? Math.round((salesWithTaxAbs * meta.rate / (100 + meta.rate)) * 100) / 100
        : 0;
      const netAbs = Math.round((salesWithTaxAbs - taxAbs) * 100) / 100;

      receiptTaxes.push({
        taxCode: code,
        taxPercent: meta.taxPercent,
        taxID: meta.taxID,
        taxAmount: taxAbs * sign,
        salesAmountWithTax: salesWithTaxAbs * sign
      });

      receiptTotalAbs = Math.round((receiptTotalAbs + salesWithTaxAbs) * 100) / 100;
      computedTaxAbs = Math.round((computedTaxAbs + taxAbs) * 100) / 100;

      // Exclusive line totals must sum EXACTLY to netAbs (error 372).
      const lineExclAbs = items.map(i => {
        const inclAbs = Math.round(Math.abs(i.totalIncl) * 100) / 100;
        return meta.rate > 0
          ? Math.round((inclAbs * 100 / (100 + meta.rate)) * 100) / 100
          : inclAbs;
      });
      const exclSum = Math.round(lineExclAbs.reduce((s, v) => s + v, 0) * 100) / 100;
      const residue = Math.round((netAbs - exclSum) * 100) / 100;
      if (residue !== 0 && lineExclAbs.length > 0) {
        let maxIdx = 0;
        for (let i = 1; i < lineExclAbs.length; i++) {
          if (lineExclAbs[i] > lineExclAbs[maxIdx]) maxIdx = i;
        }
        lineExclAbs[maxIdx] = Math.round((lineExclAbs[maxIdx] + residue) * 100) / 100;
      }

      items.forEach((item, i) => {
        lineNo += 1;
        const lineExcl = lineExclAbs[i] * sign;
        const linePrice = item.quantity > 0
          ? Math.round((lineExclAbs[i] / item.quantity) * 1000000) / 1000000 * sign
          : lineExcl;
        receiptLines.push({
          receiptLineType: 'Sale',
          receiptLineNo: lineNo,
          receiptLineHSCode: item.hsCode || '10019900',
          receiptLineName: item.description,
          receiptLinePrice: linePrice,
          receiptLineQuantity: item.quantity,
          receiptLineTotal: lineExcl,
          taxCode: code,
          taxPercent: meta.taxPercent,
          taxID: meta.taxID
        });
      });
    }

    // Duplicate check — use credit note number for credit notes
    const dupKey = isCreditNote
      ? pdfData.creditNoteNumber
      : pdfData.invoiceNumber;
    const existingReceipt =
      state.processedInvoices[dupKey];

    if (existingReceipt) {
      log('REPRINT detected: ' + dupKey +
        ' (Original Receipt ID: ' +
        existingReceipt.zimraReceiptId + ')',
        'INFO'
      );

      // Roll back counter increments —
      // reprints do not consume new counters
      state.receiptCounter -= 1;
      state.receiptGlobalNo -= 1;
      saveState(state);

      // Re-stamp with original QR data only
      // No resubmission to ZIMRA needed —
      // the original receipt is already on record
      const outputPath = path.join(
        SIGNED_DIR, 'FISCALIZED_' + filename
      );

      await stampReceiptOnPDF(
        inputPath,
        outputPath,
        {
          receiptId:   existingReceipt.zimraReceiptId,
          deviceId:    DEVICE_ID,
          globalNo:    existingReceipt.globalNo,
          invoiceNo:   isCreditNote ? pdfData.creditNoteNumber : pdfData.invoiceNumber,
          total:       pdfData.totalIncl,
          date:        existingReceipt.receiptDate
            || pdfData.invoiceDate,
          qrCodeValue: existingReceipt.qrCodeValue,
          signature:   existingReceipt.signature
        }
      );

      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }

      log('Reprint stamped with original QR: '
        + outputPath, 'SUCCESS');
      return true;
    }

    // Verify totals
    const linesTotalExcl = Math.round(
      receiptLines.reduce(
        (s, l) => s + l.receiptLineTotal, 0
      ) * 100
    ) / 100;
    const taxesTotal = Math.round(
      receiptTaxes.reduce(
        (s, t) => s + t.taxAmount, 0
      ) * 100
    ) / 100;
    const computedTotal = Math.round(
      (linesTotalExcl + taxesTotal) * 100
    ) / 100;
    // Anchor the receipt total to the sum of tax-inclusive category sales
    // so it always equals sum(salesAmountWithTax) (error 382 check).
    const signedTotalIncl = Math.round(receiptTotalAbs * 100) / 100 * sign;

    log('Lines excl: $' + linesTotalExcl, 'INFO');
    log('Tax total: $' + taxesTotal, 'INFO');
    log('Computed total: $' + computedTotal, 'INFO');
    log('PDF total: $' + totalIncl, 'INFO');
    if (isCreditNote) {
      log('Credit note signed total: $' + signedTotalIncl, 'INFO');
    }

    // Generate device signature
    const { generateReceiptSignature } = require('../signatures/receiptSignature');

    const receiptForSigning = {
      deviceID: parseInt(DEVICE_ID),
      receiptType: isCreditNote ? 'CreditNote' : 'FiscalInvoice',
      receiptCurrency: currency,
      receiptGlobalNo: state.receiptGlobalNo,
      receiptDate: invoiceDate,
      receiptTotal: signedTotalIncl,
      receiptTaxes: receiptTaxes
    };

    log('Generating signature...', 'INFO');
    const sig = generateReceiptSignature(
      receiptForSigning,
      state.lastReceiptHash || null
    );
    log('Hash input: ' + sig.hashInput, 'INFO');
    log('Hash: ' + sig.hash, 'INFO');
    log('Signature generated ✅', 'INFO');

    // Build credit/debit note data if applicable
    // ZIMRA spec: creditDebitNote requires receiptID of original receipt
    // OR deviceID + receiptGlobalNo + fiscalDayNo
    let creditDebitNote = null;
    if (isCreditNote) {
      const originalInvoice = pdfData.originalInvoiceNumber
        ? state.processedInvoices[pdfData.originalInvoiceNumber]
        : null;

      if (originalInvoice && originalInvoice.zimraReceiptId) {
        log('Linked credit note to original receipt ID: '
          + originalInvoice.zimraReceiptId, 'INFO');
      } else if (pdfData.originalInvoiceNumber) {
        log('Original invoice ' + pdfData.originalInvoiceNumber
          + ' not found in state — credit note may fail RCPT032',
          'WARN');
      }

      creditDebitNote = {
        receiptID: originalInvoice?.zimraReceiptId || undefined,
        deviceID: originalInvoice ? parseInt(DEVICE_ID) : undefined,
        receiptGlobalNo: originalInvoice?.globalNo || undefined,
        fiscalDayNo: originalInvoice
          ? (state.fiscalDayNo || 1)
          : undefined,
        creditDebitNoteNumber: pdfData.creditNoteNumber,
        creditDebitNoteDate: invoiceDate,
        creditDebitNoteReason: pdfData.originalInvoiceNumber
          ? 'Credit note for ' + pdfData.originalInvoiceNumber
          : 'Credit note'
      };

      // Remove undefined fields to keep payload clean
      Object.keys(creditDebitNote).forEach(key => {
        if (creditDebitNote[key] === undefined) {
          delete creditDebitNote[key];
        }
      });
    }

    const receiptNotes = isCreditNote
      ? 'Credit note reference: ' + pdfData.creditNoteNumber +
        (pdfData.originalInvoiceNumber
          ? ' | Original invoice: ' + pdfData.originalInvoiceNumber
          : '')
      : null;

    // Build final ZIMRA receipt
    // receiptLinesTaxInclusive: false because receiptLineTotal values EXCLUDE tax
    const zimraReceipt = {
      receiptType: isCreditNote ? 'CreditNote' : 'FiscalInvoice',
      receiptCurrency: currency,
      receiptCounter: state.receiptCounter,
      receiptGlobalNo: state.receiptGlobalNo,
      invoiceNo: isCreditNote ? pdfData.creditNoteNumber : pdfData.invoiceNumber,
      receiptDate: invoiceDate,
      receiptLinesTaxInclusive: false,
      receiptNotes: receiptNotes,
      buyerData: buyerData,
      creditDebitNote: creditDebitNote,
      receiptLines: receiptLines,
      receiptTaxes: receiptTaxes,
      receiptPayments: [{
        moneyTypeCode: 'Cash',
        paymentAmount: signedTotalIncl
      }],
      receiptTotal: signedTotalIncl,
      receiptPrintForm: 'Receipt48',
      receiptDeviceSignature: {
        hash: sig.hash,
        signature: sig.signature
      }
    };

    // Submit to ZIMRA
    // Body is { receipt: zimraReceipt } ONLY
    // deviceID is in URL path only
    // NO submitReceiptRequest wrapper
    log('Submitting to ZIMRA...', 'INFO');
    log('URL: /Device/v1/' + DEVICE_ID + '/SubmitReceipt', 'INFO');
    log('Payload: ' + JSON.stringify({ receipt: zimraReceipt }, null, 2), 'INFO');

    const { getDeviceClient } = require('../http/deviceClient');
    const deviceClient = getDeviceClient();

    const response = await deviceClient.post(
      `/Device/v1/${DEVICE_ID}/SubmitReceipt`,
      { receipt: zimraReceipt }
    );

    // ZIMRA accepted the receipt (the POST did not throw). From here on the
    // global number IS consumed on ZIMRA and must never be rolled back.
    receiptAccepted = true;

    const responseData = response.data;
    const zimraReceiptId = responseData?.receiptID || responseData?.receiptId || 'UNKNOWN';
    const serverDate = responseData?.serverDate || new Date().toISOString();

    log('✅ ZIMRA SUCCESS!', 'SUCCESS');
    log('Receipt ID: ' + zimraReceiptId, 'SUCCESS');
    log('Server Date: ' + serverDate, 'SUCCESS');

    // A 200 response can still carry validation errors/warnings. These are
    // NOT rejections, but ZIMRA flags such receipts (Red/Yellow) and they
    // block the fiscal day from closing. Surface them so they are not a
    // silent blind spot only visible in the ZIMRA portal.
    const acceptedErrors = responseData?.rcptErrors || responseData?.validationErrors;
    if (Array.isArray(acceptedErrors) && acceptedErrors.length > 0) {
      log('⚠️ Receipt ACCEPTED BUT FLAGGED by ZIMRA (invoice ' +
        (isCreditNote ? pdfData.creditNoteNumber : pdfData.invoiceNumber) +
        ', receiptID ' + zimraReceiptId + '):', 'WARN');
      for (const err of acceptedErrors) {
        const code = err.rcptErrorCode || err.errorCode || 'UNKNOWN';
        const msg = err.rcptErrorMsg || err.message || JSON.stringify(err);
        log('  [' + code + '] ' + msg, 'WARN');
      }
    }
    const acceptedWarnings = responseData?.rcptWarnings;
    if (Array.isArray(acceptedWarnings) && acceptedWarnings.length > 0) {
      for (const warn of acceptedWarnings) {
        const code = warn.rcptErrorCode || warn.errorCode || 'WARN';
        const msg = warn.rcptErrorMsg || warn.message || JSON.stringify(warn);
        log('  (warning) [' + code + '] ' + msg, 'WARN');
      }
    }

    // Log counters and verification info
    log('Receipt Counter: ' + state.receiptCounter, 'SUCCESS');
    log('Global No: ' + state.receiptGlobalNo, 'SUCCESS');

    // Build QR code value per ZIMRA spec
    const qrUrl = await getQrUrlFromZIMRA();
    const qrCodeValue = buildQrCodeValue(
      qrUrl,
      parseInt(DEVICE_ID),
      invoiceDate,
      state.receiptGlobalNo,
      sig.signature
    );
    log('QR Code Value: ' + qrCodeValue, 'INFO');

    // Store full receipt data keyed by invoice/credit note number
    const stateKey = isCreditNote
      ? pdfData.creditNoteNumber
      : pdfData.invoiceNumber;
    state.processedInvoices[stateKey] = {
      zimraReceiptId: zimraReceiptId,
      globalNo:       state.receiptGlobalNo,
      counter:        state.receiptCounter,
      currency:       currency,
      receiptDate:    invoiceDate,
      previousHash:   state.lastReceiptHash || null,
      receiptTaxes:   receiptTaxes,
      qrCodeValue:    qrCodeValue,
      signature:      sig.signature,
      fiscalizedAt:   new Date().toISOString()
        .split('T')[0]
    };

    // Track maximum receipt date seen (for chronological reference)
    // Note: invoices may be processed out of order; we track the
    // latest date seen, not the last submitted date
    const currentMaxDate = state.lastReceiptDate
      ? new Date(state.lastReceiptDate)
      : new Date(0);
    const thisDate = new Date(invoiceDate);
    if (thisDate > currentMaxDate) {
      state.lastReceiptDate = invoiceDate;
    }
    saveState(state);

    // Update fiscal counters per ZIMRA spec section 6
    // Now tracked PER CURRENCY so USD and ZWL don't mix
    const state2 = loadState();
    if (!state2.fiscalCounters[currency]) {
      state2.fiscalCounters[currency] = {
        salesAmountWithTax: 0,
        taxAmount: 0,
        paymentAmount: 0,
        taxPercent: taxPercent
      };
    }
    const currCounters = state2.fiscalCounters[currency];

    // SaleByTax uses salesAmountWithTax (total incl)
    // Credit notes DECREMENT counters; invoices INCREMENT
    // Use the ZIMRA-computed figures (not Sage's printed ones) so the
    // day's fiscal counters match the sum of submitted receipts and
    // CloseDay reconciliation passes.
    const counterDelta = isCreditNote ? -receiptTotalAbs : receiptTotalAbs;
    const taxDelta = isCreditNote ? -computedTaxAbs : computedTaxAbs;

    currCounters.salesAmountWithTax =
      Math.round(
        (currCounters.salesAmountWithTax +
         counterDelta) * 100
      ) / 100;

    // SaleTaxByTax uses taxAmount
    currCounters.taxAmount =
      Math.round(
        (currCounters.taxAmount +
         taxDelta) * 100
      ) / 100;

    // BalanceByMoneyType uses paymentAmount
    currCounters.paymentAmount =
      Math.round(
        (currCounters.paymentAmount +
         counterDelta) * 100
      ) / 100;

    currCounters.taxPercent = taxPercent;
    state2.lastReceiptHash = sig.hash;
    saveState(state2);
    log('Fiscal counters [' + currency + ']: sales=' + currCounters.salesAmountWithTax +
        ' tax=' + currCounters.taxAmount + ' payment=' + currCounters.paymentAmount, 'INFO');

    const docLabel = isCreditNote ? 'Credit Note' : 'Invoice';
    const docNumber = isCreditNote ? pdfData.creditNoteNumber : pdfData.invoiceNumber;
    log(docLabel + ' ' + docNumber + ' recorded.', 'SUCCESS');

    // Log to Supabase fiscal_receipts table
    try {
      const { error: dbError } = await supabase
        .from('fiscal_receipts')
        .insert({
          device_id:                    parseInt(DEVICE_ID),
          fiscal_day_no:                state2.fiscalDayNo || 1,
          receipt_id:                   zimraReceiptId,
          receipt_type:                 isCreditNote ? 'CreditNote' : 'FiscalInvoice',
          receipt_counter:              state.receiptCounter,
          receipt_global_no:            state.receiptGlobalNo,
          invoice_no:                   isCreditNote ? pdfData.creditNoteNumber : pdfData.invoiceNumber,
          receipt_currency:             currency,
          receipt_date:                 invoiceDate,
          receipt_total:                signedTotalIncl,
          receipt_lines_tax_inclusive:  false,
          receipt_print_form:           'Receipt48',
          receipt_lines:                receiptLines,
          receipt_taxes:                receiptTaxes,
          receipt_payments:             [{
            moneyTypeCode: 'Cash',
            paymentAmount: signedTotalIncl
          }],
          buyer_data:                   buyerData,
          credit_debit_note:            creditDebitNote,
          receipt_notes:                receiptNotes,
          receipt_hash:                 sig.hash,
          device_signature:             sig.signature,
          previous_receipt_hash:        state.lastReceiptHash || null,
          qr_code:                      qrCodeValue,
          submission_status:            'submitted',
          submission_attempts:          1,
          server_date:                  serverDate
        });

      if (dbError) {
        log('Supabase log failed: ' + dbError.message, 'WARN');
      } else {
        log('Supabase receipt logged ✅', 'SUCCESS');
      }
    } catch (dbErr) {
      log('Supabase exception: ' + dbErr.message, 'WARN');
    }

    // Stamp QR code on original invoice/credit note PDF
    const outputPath = path.join(SIGNED_DIR, 'FISCALIZED_' + filename);
    try {
      await stampReceiptOnPDF(
        inputPath,
        outputPath,
        {
          receiptId: zimraReceiptId,
          deviceId: DEVICE_ID,
          globalNo: state.receiptGlobalNo,
          invoiceNo: isCreditNote ? pdfData.creditNoteNumber : pdfData.invoiceNumber,
          total: totalIncl,
          date: invoiceDate,
          qrCodeValue: qrCodeValue,
          qrUrl: qrUrl,
          signature: sig.signature
        }
      );
      // Delete original unsigned PDF
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
        log('Deleted unsigned PDF: ' + inputPath, 'INFO');
      }
    } catch (stampErr) {
      log('Stamp failed: ' + stampErr.message + '. Moving without stamp.', 'WARN');
      if (fs.existsSync(inputPath)) {
        fs.renameSync(inputPath, outputPath);
        log('Moved to signed: ' + outputPath, 'SUCCESS');
      }
    }

    log('='.repeat(60), 'INFO');
    return true;

  } catch (error) {
    log('❌ FAILED: ' + error.message, 'ERROR');

    if (error.response?.data) {
      const zimraData = error.response.data;
      log('ZIMRA Response: ' + JSON.stringify(zimraData), 'ERROR');

      // Explicitly log each rcptError for readability
      if (zimraData.rcptErrors && Array.isArray(zimraData.rcptErrors)) {
        log('--- ZIMRA VALIDATION ERRORS ---', 'ERROR');
        for (const err of zimraData.rcptErrors) {
          const code = err.rcptErrorCode || 'UNKNOWN';
          const msg = err.rcptErrorMsg || err.message || JSON.stringify(err);
          log('  [' + code + '] ' + msg, 'ERROR');
        }
        log('--- END VALIDATION ERRORS ---', 'ERROR');
      }

      // Also log rcptWarnings if present
      if (zimraData.rcptWarnings && Array.isArray(zimraData.rcptWarnings)) {
        log('--- ZIMRA WARNINGS ---', 'WARN');
        for (const warn of zimraData.rcptWarnings) {
          const code = warn.rcptErrorCode || 'WARN';
          const msg = warn.rcptErrorMsg || warn.message || JSON.stringify(warn);
          log('  [' + code + '] ' + msg, 'WARN');
        }
        log('--- END WARNINGS ---', 'WARN');
      }
    }

    // If ZIMRA never accepted this receipt, undo the counter increment so the
    // next receipt reuses this global number (prevents a sequence gap that
    // ZIMRA would reject). Skipped when counters were never incremented (e.g.
    // parse errors) or when the receipt was already accepted by ZIMRA.
    if (countersIncremented && !receiptAccepted) {
      try {
        const s = loadState();
        if (s.receiptCounter > 0) s.receiptCounter -= 1;
        if (s.receiptGlobalNo > 0) s.receiptGlobalNo -= 1;
        saveState(s);
        log('Rolled back counters (rejected receipt): counter=' +
          s.receiptCounter + ' globalNo=' + s.receiptGlobalNo, 'WARN');
      } catch (rbErr) {
        log('Counter rollback failed: ' + rbErr.message, 'ERROR');
      }
    }

    const failedPath = path.join(FAILED_DIR, 'FAILED_' + filename);
    if (fs.existsSync(inputPath)) {
      fs.renameSync(inputPath, failedPath);
      log('Moved to failed: ' + failedPath, 'ERROR');
    }

    log('='.repeat(60), 'INFO');
    return false;
  }
}

/**
 * Close fiscal day per ZIMRA spec section 13
 */
async function closeFiscalDay() {
  try {
    log('='.repeat(60), 'INFO');
    log('CLOSING FISCAL DAY', 'INFO');
    log('='.repeat(60), 'INFO');

    const state = loadState();
    const fc = state.fiscalCounters;
    // ZIMRA's CloseDay signature uses the date the fiscal day was OPENED
    // (not today's date). A day opened late at night and closed after
    // midnight must still report its opening date, or the server-side
    // signature check fails. Fall back to lastReceiptDate, then today.
    const fiscalDayDate =
      (state.fiscalDayOpened || state.lastReceiptDate ||
        new Date().toISOString()).split('T')[0];

    const fiscalCounters = [];

    // Iterate over each currency in fiscalCounters
    // Now structured as: { USD: {...}, ZWL: {...} }
    const currencies = Object.keys(fc)
      .filter(c => ['USD', 'ZWL', 'ZWG', 'ZAR', 'GBP', 'EUR'].includes(c));

    for (const counterCurrency of currencies) {
      const curr = fc[counterCurrency];

      log('Building counters for currency: ' + counterCurrency +
          ' sales=' + (curr.salesAmountWithTax || 0) +
          ' tax=' + (curr.taxAmount || 0) +
          ' payment=' + (curr.paymentAmount || 0), 'INFO');

      // SaleByTax — total sales incl tax
      if (curr.salesAmountWithTax !== undefined &&
          Math.abs(curr.salesAmountWithTax) > 0.001) {
        fiscalCounters.push({
          fiscalCounterType: 'SaleByTax',
          fiscalCounterCurrency: counterCurrency,
          fiscalCounterTaxPercent: curr.taxPercent,
          fiscalCounterTaxID: state.taxConfig?.vatTaxID || 517,
          fiscalCounterValue: Math.round(
            curr.salesAmountWithTax * 100
          ) / 100
        });
      }

      // SaleTaxByTax — tax amount only
      if (curr.taxAmount !== undefined &&
          Math.abs(curr.taxAmount) > 0.001) {
        fiscalCounters.push({
          fiscalCounterType: 'SaleTaxByTax',
          fiscalCounterCurrency: counterCurrency,
          fiscalCounterTaxPercent: curr.taxPercent,
          fiscalCounterTaxID: state.taxConfig?.vatTaxID || 517,
          fiscalCounterValue: Math.round(
            curr.taxAmount * 100
          ) / 100
        });
      }

      // BalanceByMoneyType — payment amount
      if (curr.paymentAmount !== undefined &&
          Math.abs(curr.paymentAmount) > 0.001) {
        fiscalCounters.push({
          fiscalCounterType: 'BalanceByMoneyType',
          fiscalCounterCurrency: counterCurrency,
          fiscalCounterMoneyType: 'Cash',
          fiscalCounterValue: Math.round(
            curr.paymentAmount * 100
          ) / 100
        });
      }
    }

    // Sort per spec section 13.3:
    // fiscalCounterType ASC
    // fiscalCounterCurrency alpha
    // fiscalCounterTaxID ASC or moneyType ASC
    fiscalCounters.sort((a, b) => {
      if (a.fiscalCounterType !==
          b.fiscalCounterType) {
        return a.fiscalCounterType
          .localeCompare(b.fiscalCounterType);
      }
      if (a.fiscalCounterCurrency !==
          b.fiscalCounterCurrency) {
        return a.fiscalCounterCurrency
          .localeCompare(b.fiscalCounterCurrency);
      }
      // Within same type+currency, sort by taxID or moneyType
      const aTax = a.fiscalCounterTaxID;
      const bTax = b.fiscalCounterTaxID;
      if (aTax !== undefined && bTax !== undefined) {
        return aTax - bTax;
      }
      const aMoney = a.fiscalCounterMoneyType || '';
      const bMoney = b.fiscalCounterMoneyType || '';
      return aMoney.localeCompare(bMoney);
    });

    // Generate the fiscal day signature (hash + signature) per spec 13.3.1.
    // ZIMRA's CloseDay requires BOTH fiscalDayDeviceSignature and
    // receiptCounter; omitting them returns HTTP 400 (missing required
    // properties: receiptCounter). The signer builds the same sorted counter
    // hash string and signs it with the device private key (FDMS_KEY_PATH).
    const { generateFiscalDaySignature } =
      require('../signatures/fiscalDaySignature');
    const daySig = generateFiscalDaySignature(
      {
        deviceID: parseInt(DEVICE_ID),
        fiscalDayNo: state.fiscalDayNo,
        fiscalDayDate: fiscalDayDate
      },
      fiscalCounters
    );
    log('CloseDay hash input: ' + daySig.hashInput, 'INFO');

    // receiptCounter = number of receipts issued during this fiscal day
    // (the per-day counter; it resets to 0 on each OpenDay).
    const receiptCounter = state.receiptCounter || 0;
    log('CloseDay receiptCounter: ' + receiptCounter, 'INFO');

    // Submit close fiscal day
    const { getDeviceClient } =
      require('../http/deviceClient');
    const deviceClient = getDeviceClient();

    const response = await deviceClient.post(
      `/Device/v1/${DEVICE_ID}/CloseDay`,
      {
        fiscalDayNo: state.fiscalDayNo,
        fiscalDayCounters: fiscalCounters,
        fiscalDayDeviceSignature: {
          hash: daySig.hash,
          signature: daySig.signature
        },
        receiptCounter: receiptCounter
      }
    );

    log('✅ Fiscal day closed', 'SUCCESS');
    log('Response: ' +
      JSON.stringify(response.data, null, 2),
      'SUCCESS'
    );

    // Reset counters for next day
    state.fiscalDayNo += 1;
    state.fiscalCounters = {};
    state.lastReceiptHash = null;
    saveState(state);

    // Schedule auto open for next morning
    const reopenTime =
      process.env.FISCAL_DAY_OPEN_TIME || '06:00';
    const [openHour, openMinute] =
      reopenTime.split(':').map(Number);

    log('Next fiscal day will auto open at: ' +
      reopenTime, 'INFO');

    // One-time check for next day open
    const reopenCheck = setInterval(async () => {
      const now = new Date();
      if (now.getHours() === openHour &&
          now.getMinutes() === openMinute) {

        clearInterval(reopenCheck);
        log('Auto opening new fiscal day...', 'INFO');

        const status = await getFiscalDayStatus();
        if (status?.fiscalDayStatus ===
            'FiscalDayClosed') {
          await openFiscalDay();
        }
      }
    }, 60000);

    return true;
  } catch (error) {
    log('❌ CloseFiscalDay failed: ' +
      error.message, 'ERROR');
    if (error.response?.data) {
      log('ZIMRA Error: ' +
        JSON.stringify(error.response.data),
        'ERROR'
      );
    }
    return false;
  }
}

/**
 * Get fiscal day status from ZIMRA
 */
async function getFiscalDayStatus() {
  try {
    const { getDeviceClient } =
      require('../http/deviceClient');
    const client = getDeviceClient();
    const response = await client.get(
      `/Device/v1/${DEVICE_ID}/GetStatus`
    );
    return response.data;
  } catch (err) {
    log('Could not get fiscal day status: ' +
      err.message, 'WARN');
    return null;
  }
}

/**
 * Open fiscal day with ZIMRA
 */
async function openFiscalDay() {
  try {
    log('Opening fiscal day...', 'INFO');
    const state = loadState();
    const now = new Date();
    const fiscalDayOpened =
      now.toISOString().split('.')[0];

    const { getDeviceClient } =
      require('../http/deviceClient');
    const client = getDeviceClient();
    const response = await client.post(
      `/Device/v1/${DEVICE_ID}/OpenDay`,
      {
        fiscalDayOpened,
        fiscalDayNo: state.fiscalDayNo
      }
    );

    // Reset per-day state. The hash chain resets each fiscal day, so the
    // first receipt of the new day must omit the previous hash (prevents
    // ZIMRA error 202). receiptGlobalNo intentionally continues.
    state.fiscalDayNo = response.data.fiscalDayNo;
    state.fiscalDayStatus = 'FiscalDayOpened';
    state.fiscalDayOpened = fiscalDayOpened;
    state.lastReceiptDate = fiscalDayOpened;
    state.receiptCounter = 0;
    state.fiscalCounters = {};
    state.lastReceiptHash = null;
    saveState(state);

    log('Fiscal day opened: ' +
      response.data.fiscalDayNo, 'SUCCESS');
    return true;
  } catch (err) {
    log('Failed to open fiscal day: ' +
      err.message, 'ERROR');
    return false;
  }
}

/**
 * Ensure fiscal day is open before processing
 */
async function ensureFiscalDayOpen() {
  const status = await getFiscalDayStatus();
  if (!status) return false;
  if (status.fiscalDayStatus === 'FiscalDayOpened') {
    return true;
  }
  if (status.fiscalDayStatus === 'FiscalDayClosed') {
    return await openFiscalDay();
  }
  return false;
}

/**
 * Schedule periodic check for fiscal day status
 * In online mode, ZIMRA auto-closes days after 24 hours
 * This function checks every hour and auto-opens new days when needed
 */
function scheduleAutoOpenDay() {
  const checkTime = process.env.FISCAL_DAY_CHECK_TIME || '06:00';
  const [checkHour, checkMinute] = checkTime.split(':').map(Number);

  log('Auto-open check scheduled at: ' + checkTime + ' (Online Mode)', 'INFO');
  log('Note: ZIMRA auto-closes days after 24 hours in online mode', 'INFO');

  // Check every hour if fiscal day needs to be opened
  setInterval(async () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Only check at the scheduled time
    if (currentHour === checkHour && currentMinute >= checkMinute && currentMinute < checkMinute + 5) {
      log('Auto-open check triggered at ' + now.toLocaleTimeString(), 'INFO');

      const status = await getFiscalDayStatus();

      if (status?.fiscalDayStatus === 'FiscalDayClosed') {
        log('Previous fiscal day closed by ZIMRA. Opening new day...', 'INFO');
        const opened = await openFiscalDay();
        if (opened) {
          log('New fiscal day auto-opened ✅', 'SUCCESS');
        } else {
          log('Auto-open failed. Please open manually with: node scripts/openFiscalDayDirect.js', 'ERROR');
        }
      } else if (status?.fiscalDayStatus === 'FiscalDayOpened') {
        log('Fiscal day already open (Day #' + status.lastFiscalDayNo + ')', 'INFO');
      }
    }
  }, 60000); // check every minute
}

/**
 * Watch unsigned folder for new PDFs
 */
const processingFiles = new Set();

async function watchFolder() {
  log('PDF FISCALIZATION SERVICE STARTED (PID: ' +
    process.pid + ')', 'INFO');
  log('Watching: ' + UNSIGNED_DIR, 'INFO');
  log('Interval: ' + POLL_INTERVAL + 'ms', 'INFO');

  // Check and open fiscal day on startup
  log('Checking fiscal day status...', 'INFO');
  const dayReady = await ensureFiscalDayOpen();
  if (dayReady) {
    log('Fiscal day ready ✅', 'SUCCESS');
  } else {
    log('WARNING: Fiscal day not ready. ' +
      'Invoices will not be fiscalized until ' +
      'fiscal day is open.', 'WARN');
  }

  // Sync tax config from ZIMRA
  const taxConfig = await syncTaxConfig();
  log('Using VAT taxID: ' + taxConfig.vatTaxID,
    'INFO');

  // Schedule auto-open check (online mode: ZIMRA closes days automatically)
  scheduleAutoOpenDay();

  setInterval(async () => {
    try {
      if (!fs.existsSync(UNSIGNED_DIR)) {
        log('Scan: unsigned dir missing', 'WARN');
        return;
      }

      let files = fs.readdirSync(UNSIGNED_DIR)
        .filter(f => f.toLowerCase().endsWith('.pdf'));

      if (files.length === 0) {
        log('Scan: 0 PDF files found', 'INFO');
        return;
      }

      // Sort PDFs by invoice date (ascending) to prevent RCPT030
      // Invoices must be submitted in chronological order per ZIMRA spec
      const fileDates = [];
      for (const file of files) {
        if (processingFiles.has(file)) continue;
        try {
          const pdfData = await parseInvoicePDF(
            path.join(UNSIGNED_DIR, file)
          );
          const dt = pdfData.invoiceDate
            ? new Date(pdfData.invoiceDate)
            : new Date(8640000000000000); // Max date if unparsable
          fileDates.push({ file, date: dt, invoiceNo: pdfData.invoiceNumber || pdfData.creditNoteNumber || file });
        } catch (parseErr) {
          log('Parse error for ' + file + ': ' + parseErr.message, 'WARN');
          fileDates.push({ file, date: new Date(8640000000000000), invoiceNo: file });
        }
      }

      fileDates.sort((a, b) => a.date - b.date);
      files = fileDates.map(fd => fd.file);

      log('Scan: ' + files.length +
        ' PDF file(s) found, sorted by date', 'INFO');
      for (const fd of fileDates) {
        log('  ' + fd.invoiceNo + ' (' + fd.date.toISOString().split('T')[0] + ') -> ' + fd.file, 'INFO');
      }

      for (const file of files) {
        if (processingFiles.has(file)) continue;
        processingFiles.add(file);
        try {
              await fiscalizePDF(file, taxConfig);
        } catch (err) {
          log('Error: ' + err.message, 'ERROR');
        } finally {
          processingFiles.delete(file);
        }
      }
    } catch (err) {
      log('Folder error: ' + err.message, 'ERROR');
    }
  }, POLL_INTERVAL);
}

/**
 * Process single PDF and exit
 */
async function processSinglePDF(filename) {
    try {
        log(`\n${'='.repeat(60)}`, 'INFO');
        log(`PDF FISCALIZATION SERVICE (ONE-TIME)`, 'INFO');
        log(`${'='.repeat(60)}\n`, 'INFO');

        const taxConfig = await syncTaxConfig();
        log('Using VAT taxID: ' + taxConfig.vatTaxID,
          'INFO');

        const success = await fiscalizePDF(filename, taxConfig);
        
        process.exit(success ? 0 : 1);
        
    } catch (error) {
        log(`Fatal error: ${error.message}`, 'ERROR');
        process.exit(1);
    }
}

module.exports = {
    initializeDirs,
    watchFolder,
    processSinglePDF,
    closeFiscalDay,
    openFiscalDay,
    getFiscalDayStatus,
    ensureFiscalDayOpen,
    log
};

// Run if called directly
if (require.main === module) {
    initializeDirs();
    
    const mode = process.argv[2];
    const filename = process.argv[3];
    
    if (mode === 'once' && filename) {
        processSinglePDF(filename);
    } else {
        watchFolder();
    }
}
