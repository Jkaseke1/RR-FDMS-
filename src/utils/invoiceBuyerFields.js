// Read the customer form by position: PDF text order can interleave supplier
// identifiers with empty buyer labels from the opposite column.
function extractBuyerFields(items) {
  const textItems = items.filter(item => typeof item.str === 'string' && item.str.trim());
  const nameLabel = textItems.find(item => /^CUSTOMER\s+NAME\s*:/i.test(item.str.trim()));
  if (!nameLabel) return null;
  const labels = {
    name: /^CUSTOMER\s+NAME\s*:\s*(.*)$/i,
    account: /^ACCOUNT\s*:?(?:\s+(.*))?$/i,
    house: /^CUSTOMER\s+HSE\s+NO\.?\s*:?(?:\s+(.*))?$/i,
    street: /^STREET\s*:?(?:\s+(.*))?$/i,
    region: /^REGION\s*:?(?:\s+(.*))?$/i,
    city: /^CITY\s*:?(?:\s+(.*))?$/i,
    vat: /^VAT\s+Number\s*:\s*(.*)$/i,
    tin: /^TIN\s+Number\s*:\s*(.*)$/i
  };
  const fields = {};
  for (const [key, pattern] of Object.entries(labels)) {
    const label = textItems.find(item =>
      Math.abs(item.transform[4] - nameLabel.transform[4]) <= 6 &&
      item.transform[5] <= nameLabel.transform[5] + 3 && pattern.test(item.str.trim()));
    if (!label) continue;
    const inline = label.str.trim().match(pattern)[1]?.trim();
    fields[key] = inline || textItems.filter(item => item !== label &&
      Math.abs(item.transform[5] - label.transform[5]) <= 3 &&
      item.transform[4] >= label.transform[4] + label.width - 1)
      .sort((a, b) => a.transform[4] - b.transform[4])
      .map(item => item.str.trim()).join(' ') || null;
  }
  // Only override legacy parsing when the complete customer form is recognized.
  if (!Object.keys(labels).every(key => Object.hasOwn(fields, key))) return null;
  fields.tin = /^\d{10}$/.test(fields.tin || '') ? fields.tin : null;
  fields.vat = /^\d{9}$/.test(fields.vat || '') ? fields.vat : null;
  return fields;
}

module.exports = { extractBuyerFields };
