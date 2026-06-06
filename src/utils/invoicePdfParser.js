const { PDFParse } = require('pdf-parse');
const fs = require('fs');
const HS_CODE_MAP = require('../config/hsCodes');

async function parseInvoicePDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const uint8 = new Uint8Array(dataBuffer);
  const parser = new PDFParse(uint8);
  await parser.load();
  const parseResult = await parser.getText();
  const text = parseResult.text;

  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  console.log('=== PDF LINES ===');
  lines.forEach((l, i) => console.log(i + ': [' + l + ']'));
  console.log('=== END PDF LINES ===');

  const isCopy = lines[0] && lines[0].match(/^Copy\s+Fiscal/i);
  if (isCopy) {
    console.log('NOTE: This is a Copy invoice');
  }

  // ── DOCUMENT TYPE ───────────────────────────────
  // Detect if this is a Credit Note or Invoice
  let documentType = 'invoice';
  const fullText = text.toLowerCase();
  if (fullText.includes('tax credit note') ||
      fullText.includes('credit note') ||
      fullText.includes('crn')) {
    documentType = 'credit_note';
    console.log('NOTE: This is a Credit Note');
  }

  // ── CURRENCY DETECTION ──────────────────────────
  // Look for currency indicators in the PDF
  let currency = 'USD'; // default
  if (fullText.includes('zig') || fullText.includes('z$') ||
      fullText.includes('zimbabwe gold') ||
      fullText.includes('zwl') ||
      fullText.includes('rtgs')) {
    currency = 'ZWL';
  }
  if (fullText.includes('zwg')) {
    currency = 'ZWG';
  }
  // Check for explicit currency labels
  for (const line of lines) {
    const currencyMatch = line.match(/Currency\s*[:\-]?\s*(USD|ZIG|ZWL|ZWG|ZAR|GBP|EUR)/i);
    if (currencyMatch) {
      const detected = currencyMatch[1].toUpperCase();
      currency = detected === 'ZIG' ? 'ZWL' : detected;
      break;
    }
  }
  console.log('Detected currency: ' + currency);

  const parseAmount = (str) => {
    if (!str) return 0;
    return parseFloat(str.replace(/,/g, '')) || 0;
  };

  function getHsCode(itemCode, description) {
    const descLower = (description || '').toLowerCase();
    const descMap = HS_CODE_MAP.DESCRIPTION_MAP || {};

    for (const keyword of Object.keys(descMap)) {
      if (descLower.includes(keyword)) {
        console.log(
          'HS Code mapped: ' + itemCode +
          ' (' + description + ') -> ' +
          descMap[keyword] +
          ' [keyword: ' + keyword + ']'
        );
        return descMap[keyword];
      }
    }

    console.log(
      'HS Code not mapped: ' + itemCode +
      ' (' + description + ') ' +
      '— must come from PDF'
    );
    return null;
  }

  // ── INVOICE / CREDIT NOTE NUMBER ───────────────
  // Invoice: "HAWK001U INV0575   592     08-05-2026"
  // Credit Note: "Our Reference  CRN0032"
  let invoiceNumber = null;
  let creditNoteNumber = null;
  let originalInvoiceNumber = null;

  for (const line of lines) {
    // Credit note number: CRN####
    const crnMatch = line.match(/\b(CRN\d{4,})\b/);
    if (crnMatch) {
      creditNoteNumber = crnMatch[1];
      console.log('Credit Note Number found: ' + creditNoteNumber);
    }
    // Invoice number: INV####
    const invMatch = line.match(/\b(INV\d{4,})\b/);
    if (invMatch) {
      invoiceNumber = invMatch[1];
    }
  }

  // For credit notes, the "Delivery Note" or "Our Reference" may contain
  // the original invoice number. Also scan for explicit references.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // "Delivery Note INV0479" or "Original Invoice INV0479"
    const refMatch = line.match(/(?:Delivery\s+Note|Original\s+Invoice|Ref(?:erence)?)\s*[:\-]?\s*(INV\d{4,})/i);
    if (refMatch) {
      originalInvoiceNumber = refMatch[1];
      console.log('Original Invoice Reference: ' + originalInvoiceNumber);
      break;
    }
    // If Delivery Note line has the INV on the next line
    if (line.match(/Delivery\s+Note/i) || line.match(/Our\s+Reference/i)) {
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const nextLine = lines[j].trim();
        const nextInv = nextLine.match(/\b(INV\d{4,})\b/);
        if (nextInv) {
          originalInvoiceNumber = nextInv[1];
          console.log('Original Invoice Reference (next line): ' + originalInvoiceNumber);
          break;
        }
      }
      if (originalInvoiceNumber) break;
    }
  }

  // ── INVOICE / CREDIT NOTE DATE ──────────────────
  // Format: DD-MM-YYYY, DD/MM/YYYY, D/M/YYYY, D-MM-YYYY etc.
  let invoiceDate = null;
  for (const line of lines) {
    // Match dates with 1-2 digit day/month and 4-digit year
    const m = line.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/);
    if (m) {
      const p = m[1].split(/[\/\-]/);
      const day = p[0].padStart(2, '0');
      const month = p[1].padStart(2, '0');
      invoiceDate = `${p[2]}-${month}-${day}T00:00:00`;
      break;
    }
  }

  // ── CUSTOMER NAME ───────────────────────────────
  // "CUSTOMER NAME: " empty after colon
  // Next line: "HAWK001U" account code — skip
  // Line after: "Hawkhope Investments" actual name
  // ALSO: some PDFs have name BEFORE the label (two-column layout)
  let customerName = null;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^CUSTOMER\s+NAME\s*:/i)) {
      const inline = lines[i]
        .replace(/^CUSTOMER\s+NAME\s*:\s*/i, '')
        .trim();
      if (inline.length > 2) {
        customerName = inline;
        break;
      }
      // Scan FORWARD for name after label
      for (let j = i + 1;
           j < Math.min(i + 5, lines.length); j++) {
        const c = lines[j].trim();
        if (c.length > 5 &&
            c.match(/[a-z]/) &&
            !c.match(/^(ACCOUNT|HSE|STREET|REGION|CITY)/i)) {
          customerName = c;
          break;
        }
      }
      // If still not found, scan BACKWARD (name may be before label)
      // Two-column layout can have name 15+ lines before label
      if (!customerName) {
        for (let j = i - 1;
             j >= Math.max(0, i - 25); j--) {
          const c = lines[j].trim();
          // Skip table headers, labels, account codes, dates, amounts
          if (c.match(/^(Item\s+Code|Description|Quantity|Unit\s+Price|Disc\s*%|Tax|Total|Page|ACCOUNT|HSE|STREET|REGION|CITY|VAT|TIN|Number|Email)/i)) continue;
          if (c.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) continue;
          if (c.match(/^\d+\.?\d*$/)) continue;  // plain numbers
          if (c.match(/^[A-Z0-9]{5,}$/)) continue;  // account codes
          if (c.match(/^Email:/i)) continue;
          // Skip common Zimbabwe city names / countries / labels that
          // appear in two-column layouts before the actual customer name
          if (c.match(/^(Zimbabwe|Harare|Gweru|Bulawayo|Mutare|Masvingo|Kwekwe|Kadoma|Chegutu|Chinhoyi|Marondera|Bindura|Kariba|Victoria\s+Falls|Telephone|Email|Page|TIN|VAT|Unit|N\/A|Hatfield|Avondale|Borrowdale|Mount\s+Pleasant|Mt\s+Pleasant|Eastlea|Highfield|Kuwadzana|Budiriro|Glen\s+View|Waterfalls|Mbare|Delivery\s+Method|Tax\s+Registration|Received\s+by|Date|Signed|Rounding|Discount|Total\s*\(Excl\)|Total\s*\(Incl\)|Bank\s+Details|Payee)$/i)) continue;
          // Skip single-word all-caps (account codes like ROO, MSU)
          if (c.match(/^[A-Z]{2,8}$/)) continue;
          // Skip lines starting with a digit (house numbers like "46 St Patricks Rd")
          if (c.match(/^\d/)) continue;
          // Skip house numbers like "No 1 Senga Road", "No 25 Borrowdale Rd"
          if (c.match(/^No\s+\d+/i)) continue;
          // Require at least one space (real names are multi-word)
          if (c.length > 5 && c.match(/[a-z]/) && c.match(/\s/)) {
            customerName = c;
            break;
          }
          // Fallback: single word with mixed case and > 8 chars (e.g. "Microsoft")
          if (c.length > 8 && c.match(/[a-z]/) && !c.match(/^[A-Z]/)) {
            customerName = c;
            break;
          }
        }
      }
      break;
    }
  }

  // ── CUSTOMER TIN AND VAT ────────────────────────
  // PDF layout has labels then values on following lines:
  // [VAT Number:]
  // [TIN Number:]
  // [220230024]   <- VAT value (9 digits)
  // [2000766749]  <- TIN value (10 digits)
  let customerTIN = null;
  let customerVAT = null;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^TIN\s+Number\s*:/i)) {
      const inline = lines[i]
        .replace(/^TIN\s+Number\s*:\s*/i, '')
        .trim();
      // ZIMRA requires exactly 10 digits for TIN
      if (inline.match(/^\d{10}$/)) {
        customerTIN = inline;
      } else {
        // In interleaved layouts (VAT Number: then TIN Number: then values),
        // the TIN value comes AFTER the VAT value. Prefer 10-digit numbers.
        // First pass: look for 10-digit TIN only
        for (let j = i + 1;
             j < Math.min(i + 8, lines.length); j++) {
          const next = lines[j].trim();
          if (next.match(/^\d{10}$/)) {
            customerTIN = next;
            break;
          }
        }
      }
    }
    if (lines[i].match(/^VAT\s+Number\s*:/i)) {
      const inline = lines[i]
        .replace(/^VAT\s+Number\s*:\s*/i, '')
        .trim();
      if (inline.match(/^\d{9}$/)) {
        customerVAT = inline;
      } else {
        // Scan ahead for next 9-digit number
        for (let j = i + 1;
             j < Math.min(i + 6, lines.length); j++) {
          const next = lines[j].trim();
          if (next.match(/^\d{9}$/)) {
            customerVAT = next;
            break;
          }
        }
      }
    }
  }

  // ── CUSTOMER ADDRESS ────────────────────────────
  let customerHseNo = 'N/A';
  let customerStreet = 'Harare';
  let customerRegion = 'Harare';
  let customerCity = 'Harare';

  // Detect two-column form layout: labels on separate lines without values
  const hasHseLabel = lines.some(
    l => l.trim().match(/^CUSTOMER\s+HSE\s+NO\.?\s*$/i)
  );
  const hasStreetLabel = lines.some(
    l => l.trim().match(/^STREET\s*$/i)
  );
  const hasRegionLabel = lines.some(
    l => l.trim().match(/^REGION\s*$/i)
  );
  const hasCityLabel = lines.some(
    l => l.trim().match(/^CITY\s*$/i)
  );
  const hasStandaloneLabels = hasHseLabel &&
    hasStreetLabel &&
    hasRegionLabel &&
    hasCityLabel;

  if (hasStandaloneLabels && customerName) {
    // Two-column form: values can be BEFORE or AFTER the labels
    // First try: values after customer name in the document
    let valueLines = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(customerName)) {
        for (let j = i + 1;
             j <= i + 6 && j < lines.length; j++) {
          const line = lines[j].trim();
          if (line.match(
            /^(ACCOUNT|CUSTOMER\s+NAME|CUSTOMER\s+HSE|STREET|REGION|CITY|Item\s+Code|Page|\d+\s+of|Delivery\s+Method|Tax\s+Registration|Currency|Unit|Received\s+by|Date|Signed|Rounding|Discount|Total|Bank\s+Details|Payee)/i
          )) continue;
          if (line.match(/^[A-Z0-9]+$/)) continue;
          if (line.match(/\bINV\d+/)) continue;
          if (line.match(/\b\d{2}-\d{2}-\d{4}\b/)) continue;
          if (line.length > 0 && !line.match(/^\d+\.?\d*$/)) {
            valueLines.push(line);
          }
        }
        break;
      }
    }

    // If no values found after name, scan BACKWARD from first standalone label
    // (values appear before labels in some layouts)
    if (valueLines.length === 0) {
      let firstLabelIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/^CUSTOMER\s+NAME\s*:?\s*$/i)) {
          firstLabelIdx = i;
          break;
        }
      }
      if (firstLabelIdx > 0) {
        // Scan backward, collect last 4 valid lines before label block
        const candidates = [];
        for (let j = firstLabelIdx - 1;
             j >= 0 && candidates.length < 6; j--) {
          const line = lines[j].trim();
          if (line.length === 0) continue;
          if (line.match(/^(Account\s+Date|Item\s+Code|Page|Email)/i)) continue;
          if (line.match(/^\d+\s+of\s+\d+$/i)) continue;
          if (line.match(/^-+$/)) continue;
          if (line === customerName) continue;
          if (line.match(/^[A-Z0-9]{3,8}$/)) continue; // account codes
          candidates.unshift(line);  // prepend to maintain order
        }
        // Last 4 candidates are address values
        valueLines = candidates.slice(-4);
      }
    }

    // Map by position: HSE, STREET, REGION, CITY
    if (valueLines.length >= 1) customerHseNo = valueLines[0];
    if (valueLines.length >= 2) customerStreet = valueLines[1];
    if (valueLines.length >= 3) customerRegion = valueLines[2];
    if (valueLines.length >= 4) customerCity = valueLines[3];
  } else {
    // Single-column: address lines after customer name
    if (customerName) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(customerName)) {
          const addrLines = [];
          for (let j = i + 1;
               j <= i + 3 && j < lines.length; j++) {
            const line = lines[j].trim();
            if (line.match(
              /^(ACCOUNT|HSE|STREET|REGION|CITY|Item\s+Code|Page|\d+\s+of)/i
            )) continue;
            if (line.match(/^[A-Z0-9]+$/)) continue;
            if (line.match(/\bINV\d+/)) continue;
            if (line.match(/\b\d{2}-\d{2}-\d{4}\b/)) continue;
            if (line.length > 3 && !line.match(/^\d+\.?\d*$/))
              addrLines.push(line);
          }
          if (addrLines.length >= 1) {
            customerStreet = addrLines[0];
          }
          if (addrLines.length >= 2) {
            customerCity = addrLines[1];
          }
          break;
        }
      }
    }
  }

  // Label-based extraction for inline values
  // (overrides if values are on the same line as labels)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hseMatch = line.match(/^CUSTOMER\s+HSE\s+NO\.?\s+(.+)$/i);
    if (hseMatch && hseMatch[1].trim().length > 0) {
      customerHseNo = hseMatch[1].trim();
    }
    const streetMatch = line.match(/^STREET\s+(.+)$/i);
    if (streetMatch && streetMatch[1].trim().length > 0) {
      customerStreet = streetMatch[1].trim();
    }
    if (line.match(/^REGION\s+/i)) {
      const inline = line.replace(/^REGION\s+/i, '').trim();
      if (inline.length > 0 &&
          !inline.match(/\d{2}-\d{2}-\d{4}/) &&
          !inline.match(/INV\d+/)) {
        customerRegion = inline;
      }
    }
    if (line.match(/^CITY\s+/i)) {
      const inline = line.replace(/^CITY\s+/i, '').trim();
      if (inline.length > 1 &&
          inline.length < 40 &&
          inline.match(/^[A-Za-z\s]+$/) &&
          !inline.match(/\d/) &&
          !inline.match(/^(CITY|REGION|STREET)/i)) {
        customerCity = inline;
      }
    }
  }

  // ── LINE ITEMS ──────────────────────────────────
  // PDF text extraction order (not same as visual columns):
  // With HSCode:    "LAWN002 Kikuyu Lawn - sqm 640.00 300.61 2,240.00   3.50    12092500"
  // Without HSCode: "1000>900 Compost 50lt Bag 1.00 0.00 480.00 480.00"
  // Format: ItemCode Description Qty Tax TotalIncl Price HSCode
  const lineItems = [];

  for (const line of lines) {
    // FORMAT E: with Tax Code column at END (Sage tax codes 1,6,7)
    // PDF extraction order: Code Desc Qty Tax TotalIncl Price HSCode TaxCode
    // Example: LAWN002 Kikuyu Lawn - sqm 10.00 4.70 35.00 3.50    12092500 1
    const mE = line.match(
      /^([A-Z][A-Z0-9]+)\s+([\w\s\-\.\/']+?)\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(\d{8})\s+(\d+)\s*$/
    );
    if (mE) {
      const qty = parseAmount(mE[3]);
      const lineTax = parseAmount(mE[4]);
      const lineTotalIncl = parseAmount(mE[5]);
      const priceIncl = parseAmount(mE[6]);
      const sageTaxCode = parseInt(mE[8], 10);
      const lineTotalExcl = Math.round(
        (lineTotalIncl - lineTax) * 100
      ) / 100;
      const priceExcl = qty > 0
        ? Math.round(
            (lineTotalExcl / qty) * 10000
          ) / 10000
        : 0;
      const priceInclCalc = qty > 0
        ? Math.round(
            (lineTotalIncl / qty) * 10000
          ) / 10000
        : 0;

      if (qty > 0 && lineTotalIncl !== 0) {
        lineItems.push({
          itemCode: mE[1].trim(),
          description: mE[2].trim(),
          hsCode: mE[7].trim(),
          quantity: qty,
          priceIncl: priceInclCalc,
          priceExcl,
          tax: lineTax,
          sageTaxCode,
          totalIncl: lineTotalIncl,
          totalExcl: lineTotalExcl
        });
      }
      continue;
    }

    // FORMAT H: Credit Note with Tax Code but NO tax value (exempt/zero items)
    // Code Desc Qty TotalIncl Price HSCode TaxCode
    // Example: COMP001 Compost Organic kg 10.00 1,000.00 100.00 31010000 7
    const mH = line.match(
      /^([A-Z][A-Z0-9]+)\s+([\w\s\-\.\/']+?)\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(\d{8})\s+(\d+)\s*$/
    );
    if (mH) {
      const qty = parseAmount(mH[3]);
      const lineTotalIncl = parseAmount(mH[4]);
      const priceIncl = parseAmount(mH[5]);
      const sageTaxCode = parseInt(mH[7], 10);
      const lineTotalExcl = lineTotalIncl; // No tax
      const priceExcl = qty > 0
        ? Math.round(
            (lineTotalExcl / qty) * 10000
          ) / 10000
        : 0;
      const priceInclCalc = qty > 0
        ? Math.round(
            (lineTotalIncl / qty) * 10000
          ) / 10000
        : 0;

      if (qty > 0 && lineTotalIncl !== 0) {
        lineItems.push({
          itemCode: mH[1].trim(),
          description: mH[2].trim(),
          hsCode: mH[6].trim(),
          quantity: qty,
          priceIncl: priceInclCalc,
          priceExcl,
          tax: 0,
          sageTaxCode,
          totalIncl: lineTotalIncl,
          totalExcl: lineTotalExcl
        });
      }
      continue;
    }

    // FORMAT A: with 8-digit HS code and tax
    // Code Desc Qty Tax TotalIncl Price HSCode
    const mA = line.match(
      /^([A-Z][A-Z0-9]+)\s+([\w\s\-\.\/']+?)\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(\d{8})\s*$/
    );
    if (mA) {
      const qty = parseAmount(mA[3]);
      const lineTax = parseAmount(mA[4]);
      const lineTotalIncl = parseAmount(mA[5]);
      const priceIncl = parseAmount(mA[6]);
      const lineTotalExcl = Math.round(
        (lineTotalIncl - lineTax) * 100
      ) / 100;
      const priceExcl = qty > 0
        ? Math.round(
            (lineTotalExcl / qty) * 10000
          ) / 10000
        : 0;
      const priceInclCalc = qty > 0
        ? Math.round(
            (lineTotalIncl / qty) * 10000
          ) / 10000
        : 0;

      if (qty > 0 && lineTotalIncl !== 0) {
        lineItems.push({
          itemCode: mA[1].trim(),
          description: mA[2].trim(),
          hsCode: mA[7].trim(),
          quantity: qty,
          priceIncl: priceInclCalc,
          priceExcl,
          tax: lineTax,
          totalIncl: lineTotalIncl,
          totalExcl: lineTotalExcl
        });
      }
      continue;
    }

    // FORMAT A2: with 8-digit HS code but NO tax value
    // Code Desc Qty TotalIncl Price HSCode (zero-rated/exempt)
    const mA2 = line.match(
      /^([A-Z][A-Z0-9]+)\s+([\w\s\-\.\/']+?)\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(\d{8})\s*$/
    );
    if (mA2) {
      const qty = parseAmount(mA2[3]);
      const lineTotalIncl = parseAmount(mA2[4]);
      const priceIncl = parseAmount(mA2[5]);
      const lineTotalExcl = lineTotalIncl;  // No tax
      const priceExcl = qty > 0
        ? Math.round(
            (lineTotalExcl / qty) * 10000
          ) / 10000
        : 0;
      const priceInclCalc = qty > 0
        ? Math.round(
            (lineTotalIncl / qty) * 10000
          ) / 10000
        : 0;

      if (qty > 0 && lineTotalIncl !== 0) {
        lineItems.push({
          itemCode: mA2[1].trim(),
          description: mA2[2].trim(),
          hsCode: mA2[6].trim(),
          quantity: qty,
          priceIncl: priceInclCalc,
          priceExcl,
          tax: 0,
          sageTaxCode: 6,
          totalIncl: lineTotalIncl,
          totalExcl: lineTotalExcl
        });
      }
      continue;
    }

    // FORMAT C: ZWG layout — HS Code in middle, Total at end
    // Code Desc Qty Tax Price HSCode TotalIncl
    // Example: LAWN002 Kikuyu Lawn - sqm 23.00 432.12 140.00 12092500 3,220.00
    const mC = line.match(
      /^([A-Z][A-Z0-9]+)\s+([\w\s\-\.\/']+?)\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(\d{8})\s+(-?[\d,]+\.?\d*)\s*$/
    );
    if (mC) {
      const qty = parseAmount(mC[3]);
      const lineTax = parseAmount(mC[4]);
      const priceIncl = parseAmount(mC[5]);
      const lineTotalIncl = parseAmount(mC[7]);
      const lineTotalExcl = Math.round(
        (lineTotalIncl - lineTax) * 100
      ) / 100;
      const priceExcl = qty > 0
        ? Math.round(
            (lineTotalExcl / qty) * 10000
          ) / 10000
        : 0;
      const priceInclCalc = qty > 0
        ? Math.round(
            (lineTotalIncl / qty) * 10000
          ) / 10000
        : 0;

      if (qty > 0 && lineTotalIncl !== 0) {
        lineItems.push({
          itemCode: mC[1].trim(),
          description: mC[2].trim(),
          hsCode: mC[6].trim(),
          quantity: qty,
          priceIncl: priceInclCalc,
          priceExcl,
          tax: lineTax,
          sageTaxCode: lineTax > 0 ? 1 : 6,
          totalIncl: lineTotalIncl,
          totalExcl: lineTotalExcl
        });
      }
      continue;
    }

    // FORMAT F: ZWG layout with Tax Code (TaxCode between Tax and Price)
    // Code Desc Qty Tax TaxCode Price HSCode TotalIncl
    // Example: LAWN002 Kikuyu Lawn - sqm 23.00 432.12 1 140.00 12092500 3,220.00
    const mF = line.match(
      /^([A-Z][A-Z0-9]+)\s+([\w\s\-\.\/']+?)\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(\d+)\s+(-?[\d,]+\.?\d*)\s+(\d{8})\s+(-?[\d,]+\.?\d*)\s*$/
    );
    if (mF) {
      const qty = parseAmount(mF[3]);
      const sageTaxCode = parseInt(mF[5], 10);
      const lineTax = parseAmount(mF[4]);
      const priceIncl = parseAmount(mF[6]);
      const lineTotalIncl = parseAmount(mF[8]);
      const lineTotalExcl = Math.round(
        (lineTotalIncl - lineTax) * 100
      ) / 100;
      const priceExcl = qty > 0
        ? Math.round(
            (lineTotalExcl / qty) * 10000
          ) / 10000
        : 0;
      const priceInclCalc = qty > 0
        ? Math.round(
            (lineTotalIncl / qty) * 10000
          ) / 10000
        : 0;

      if (qty > 0 && lineTotalIncl !== 0) {
        lineItems.push({
          itemCode: mF[1].trim(),
          description: mF[2].trim(),
          hsCode: mF[7].trim(),
          quantity: qty,
          priceIncl: priceInclCalc,
          priceExcl,
          tax: lineTax,
          sageTaxCode,
          totalIncl: lineTotalIncl,
          totalExcl: lineTotalExcl
        });
      }
      continue;
    }

    // FORMAT F2: ZWG layout with Tax Code (TaxCode between Qty and Tax)
    // Code Desc Qty TaxCode Tax Price HSCode TotalIncl
    // Example: LAWN002 Kikuyu Lawn - sqm 23.00 1 432.12 140.00 12092500 3,220.00
    const mF2 = line.match(
      /^([A-Z][A-Z0-9]+)\s+([\w\s\-\.\/']+?)\s+(-?[\d,]+\.?\d*)\s+(\d+)\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(\d{8})\s+(-?[\d,]+\.?\d*)\s*$/
    );
    if (mF2) {
      const qty = parseAmount(mF2[3]);
      const sageTaxCode = parseInt(mF2[4], 10);
      const lineTax = parseAmount(mF2[5]);
      const priceIncl = parseAmount(mF2[6]);
      const lineTotalIncl = parseAmount(mF2[8]);
      const lineTotalExcl = Math.round(
        (lineTotalIncl - lineTax) * 100
      ) / 100;
      const priceExcl = qty > 0
        ? Math.round(
            (lineTotalExcl / qty) * 10000
          ) / 10000
        : 0;
      const priceInclCalc = qty > 0
        ? Math.round(
            (lineTotalIncl / qty) * 10000
          ) / 10000
        : 0;

      if (qty > 0 && lineTotalIncl !== 0) {
        lineItems.push({
          itemCode: mF2[1].trim(),
          description: mF2[2].trim(),
          hsCode: mF2[7].trim(),
          quantity: qty,
          priceIncl: priceInclCalc,
          priceExcl,
          tax: lineTax,
          sageTaxCode,
          totalIncl: lineTotalIncl,
          totalExcl: lineTotalExcl
        });
      }
      continue;
    }

    // FORMAT G: ZWG layout with Tax Code at END
    // Code Desc Qty Tax Price HSCode TotalIncl TaxCode
    // Example: LAWN002 Kikuyu Lawn - sqm 23.00 432.12 140.00 12092500 3,220.00 1
    const mG = line.match(
      /^([A-Z][A-Z0-9]+)\s+([\w\s\-\.\/']+?)\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(\d{8})\s+(-?[\d,]+\.?\d*)\s+(\d+)\s*$/
    );
    if (mG) {
      const qty = parseAmount(mG[3]);
      const lineTax = parseAmount(mG[4]);
      const priceIncl = parseAmount(mG[5]);
      const lineTotalIncl = parseAmount(mG[7]);
      const sageTaxCode = parseInt(mG[8], 10);
      const lineTotalExcl = Math.round(
        (lineTotalIncl - lineTax) * 100
      ) / 100;
      const priceExcl = qty > 0
        ? Math.round(
            (lineTotalExcl / qty) * 10000
          ) / 10000
        : 0;
      const priceInclCalc = qty > 0
        ? Math.round(
            (lineTotalIncl / qty) * 10000
          ) / 10000
        : 0;

      if (qty > 0 && lineTotalIncl !== 0) {
        lineItems.push({
          itemCode: mG[1].trim(),
          description: mG[2].trim(),
          hsCode: mG[6].trim(),
          quantity: qty,
          priceIncl: priceInclCalc,
          priceExcl,
          tax: lineTax,
          sageTaxCode,
          totalIncl: lineTotalIncl,
          totalExcl: lineTotalExcl
        });
      }
      continue;
    }

    // FORMAT B: without HS code — 4, 5, or 6 numeric columns
    // Handles both service lines (4 nums) and product lines (6 nums)
    const mB = line.match(
      /^([A-Z0-9>]+)\s+([\w\s\-\.\/'&,]+?)\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s*(-?[\d,]+\.?\d*)?\s*(-?[\d,]+\.?\d*)?\s*$/
    );
    if (mB && !line.match(/\d{8}/)) {
      const code = mB[1].trim();
      const desc = mB[2].trim();

      // Skip header/total lines
      if (code.match(
        /^(Total|Tax|Discount|BANK|NMB|Page|Payee|Received)/i
      )) continue;
      if (desc.match(
        /^(Excl|Incl|Details|Bank)/i
      )) continue;

      // Parse numerics — layout varies by line type
      // 4-col service: Qty Tax TotalIncl TotalIncl(repeat)
      // 5-col product: Qty Tax TotalIncl Price (no HSCode)
      // 6-col product: Qty Disc Tax TotalIncl Price (no HSCode)
      const n1 = parseAmount(mB[3]);   // always Qty
      const n2 = parseAmount(mB[4]);   // Tax or Disc%
      const n3 = parseAmount(mB[5]);   // TotalIncl
      const n4 = mB[6] ? parseAmount(mB[6]) : null;
      const n5 = mB[7] ? parseAmount(mB[7]) : null;

      let qty, lineTax, lineTotalIncl;

      if (n4 === null) {
        // Only 3 numbers after code+desc — not a valid line
        continue;
      } else if (n5 === null) {
        // 4 numbers: Qty Tax TotalIncl Price(=TotalIncl for qty=1)
        qty = n1;
        lineTax = n2;
        lineTotalIncl = n3;
        // n4 is priceIncl (ignored — we derive from totalIncl/qty)
      } else {
        // 5 numbers: Qty Disc Tax TotalIncl Price
        qty = n1;
        lineTax = n3;
        lineTotalIncl = n4;
        // n5 is priceIncl (ignored — we derive)
      }

      const lineTotalExcl = Math.round(
        (lineTotalIncl - lineTax) * 100
      ) / 100;

      // 4dp price — fixes ZIMRA RCPT024
      // (price * qty must = lineTotal within rounding)
      const priceExcl = qty > 0
        ? Math.round(
            (lineTotalExcl / qty) * 10000
          ) / 10000
        : 0;
      const priceIncl = qty > 0
        ? Math.round(
            (lineTotalIncl / qty) * 10000
          ) / 10000
        : 0;

      const mappedHsCode = getHsCode(code, desc);

      if (!mappedHsCode) {
        console.log(
          'SKIPPING line item — no HS code: ' +
          code + ' ' + desc
        );
        continue;
      }

      if (qty > 0 && lineTotalIncl !== 0 &&
          code.length >= 3) {
        lineItems.push({
          itemCode: code,
          description: desc,
          hsCode: mappedHsCode,
          quantity: qty,
          priceIncl,
          priceExcl,
          tax: lineTax,
          sageTaxCode: lineTax > 0 ? 1 : 6,
          totalIncl: lineTotalIncl,
          totalExcl: lineTotalExcl
        });
      }
    }
  }

  // ── TOTALS ──────────────────────────────────────
  // PDF layout — amounts on separate lines:
  // "Total (Excl)"
  // "Tax"
  // "Discount 0.00"
  // "289.87"       tax amount
  // "1,870.13"     total excl
  // "BANK DETAILS: Total (Incl) 2,160.00"
  // "Total (Incl) 2,160.00"

  let totalExcl = 0;
  let taxAmount = 0;
  let totalIncl = 0;

  // Total Incl — use last occurrence
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(
      /Total\s*\(Incl\)\s+(-?[\d,]+\.?\d*)/i
    );
    if (m) {
      totalIncl = parseAmount(m[1]);
      break;
    }
  }

  // Total Excl block — find standalone numbers
  // after "Total (Excl)" label
  for (let i = 0; i < lines.length; i++) {
    // Inline: "Total (Excl)  1,870.13"
    const inlineExcl = lines[i].match(
      /^Total\s*\(Excl\)\s+(-?[\d,]+\.?\d*)/i
    );
    if (inlineExcl) {
      totalExcl = parseAmount(inlineExcl[1]);
    }

    // Block: "Total (Excl)" alone then numbers follow
    if (lines[i].match(/^Total\s*\(Excl\)\s*$/i)) {
      const nums = [];
      for (let j = i + 1;
           j < Math.min(i + 8, lines.length); j++) {
        if (lines[j].match(/^Tax\s*$/i)) continue;
        if (lines[j].match(/^Discount/i)) continue;
        if (lines[j].match(/^Total/i)) break;
        if (lines[j].match(/^BANK/i)) break;
        const nm = lines[j].match(/^(-?[\d,]+\.\d{2})$/);
        if (nm) nums.push(parseAmount(nm[1]));
      }
      if (nums.length >= 2) {
        nums.sort((a, b) => a - b);
        taxAmount = nums[0];
        totalExcl = nums[1];
      } else if (nums.length === 1 && totalIncl > 0) {
        if (nums[0] < totalIncl * 0.3) {
          taxAmount = nums[0];
          totalExcl = Math.round(
            (totalIncl - taxAmount) * 100
          ) / 100;
        } else {
          totalExcl = nums[0];
          taxAmount = Math.round(
            (totalIncl - totalExcl) * 100
          ) / 100;
        }
      }
      break;
    }

    // Inline tax: "Tax  289.87"
    const inlineTax = lines[i].match(
      /^Tax\s+(-?[\d,]+\.?\d+)$/i
    );
    if (inlineTax) {
      taxAmount = parseAmount(inlineTax[1]);
    }
  }

  // Use line items if totals still missing
  if (totalIncl === 0 && lineItems.length > 0) {
    totalIncl = Math.round(
      lineItems.reduce((s, i) => s + i.totalIncl, 0)
      * 100
    ) / 100;
  }
  if (totalExcl === 0 && lineItems.length > 0) {
    totalExcl = Math.round(
      lineItems.reduce((s, i) => s + i.totalExcl, 0)
      * 100
    ) / 100;
  }
  if (taxAmount === 0 && lineItems.length > 0) {
    taxAmount = Math.round(
      lineItems.reduce((s, i) => s + i.tax, 0)
      * 100
    ) / 100;
  }

  // Calculate tax rate from actual amounts
  let taxRate = 15.5;
  if (totalExcl > 0 && taxAmount > 0) {
    const calc = (taxAmount / totalExcl) * 100;
    taxRate = Math.round(calc * 2) / 2;
  }

  // ── CITY FALLBACK ───────────────────────────────
  const ZW_CITIES = [
    'Harare', 'Bulawayo', 'Gweru', 'Mutare', 'Masvingo',
    'Kwekwe', 'Kadoma', 'Chinhoyi', 'Bindura', 'Marondera',
    'Zvishavane', 'Chegutu', 'Rusape', 'Kariba', 'Victoria Falls',
    'Hwange', 'Beitbridge', 'Chiredzi', 'Gokwe', 'Chitungwiza'
  ];

  if (!customerCity || customerCity === 'Harare') {
    // Build scan text from name/street/hse only;
    // exclude customerRegion which defaults to 'Harare'
    const scanText = [
      customerName,
      customerStreet,
      customerHseNo === 'N/A' ? '' : customerHseNo
    ].filter(Boolean).join(' ');

    // Sort cities by length descending so longer names
    // (e.g. 'Victoria Falls') match before shorter ones
    const sortedCities = [...ZW_CITIES].sort(
      (a, b) => b.length - a.length
    );

    for (const city of sortedCities) {
      if (scanText.toLowerCase().includes(city.toLowerCase())) {
        customerCity = city;
        break;
      }
    }
  }

  const result = {
    documentType,
    currency,
    invoiceNumber,
    creditNoteNumber,
    originalInvoiceNumber,
    invoiceDate,
    customerName,
    customerTIN,
    customerVAT,
    customerHseNo,
    customerStreet,
    customerRegion,
    customerCity,
    customerProvince: customerRegion.toLowerCase() !== 'harare'
      ? customerRegion
      : (customerCity.toLowerCase() !== 'harare'
          ? customerCity
          : 'Harare'),
    totalExcl,
    taxAmount,
    totalIncl,
    taxRate,
    lineItems
  };

  console.log('=== PARSED RESULT ===');
  console.log(JSON.stringify(result, null, 2));
  console.log('=== END PARSED ===');

  return result;
}

module.exports = { parseInvoicePDF };
