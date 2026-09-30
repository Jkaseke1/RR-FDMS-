const DEFAULT_TAX_CONFIG = Object.freeze({
  vatTaxID: 515,
  vatPercent: 15.5,
  zeroTaxID: 2,
  exemptTaxID: 1
});

function isTaxActive(tax, now = new Date()) {
  const validFrom = tax.validFrom || tax.taxValidFrom;
  const validTill = tax.validTill || tax.taxValidTill;

  if (validFrom && new Date(validFrom) > now) return false;
  if (validTill && new Date(validTill) < now) return false;
  return true;
}

function chooseTax(taxes, predicate, preferredID, now) {
  const candidates = taxes.filter(tax =>
    isTaxActive(tax, now) && predicate(tax)
  );

  return candidates.find(tax => Number(tax.taxID) === preferredID)
    || candidates[0];
}

function resolveTaxConfig(taxes, options = {}) {
  const configuredVatTaxID = Number(options.vatTaxID)
    || DEFAULT_TAX_CONFIG.vatTaxID;
  const now = options.now || new Date();
  const applicableTaxes = Array.isArray(taxes) ? taxes : [];

  const vatTax = chooseTax(
    applicableTaxes,
    tax => Number(tax.taxPercent) === 15.5,
    configuredVatTaxID,
    now
  );
  const zeroTax = chooseTax(
    applicableTaxes,
    tax => Number(tax.taxPercent) === 0 &&
      !String(tax.taxName || '').toLowerCase().includes('exempt'),
    DEFAULT_TAX_CONFIG.zeroTaxID,
    now
  );
  const exemptTax = chooseTax(
    applicableTaxes,
    tax => tax.taxPercent == null ||
      String(tax.taxName || '').toLowerCase().includes('exempt'),
    DEFAULT_TAX_CONFIG.exemptTaxID,
    now
  );

  return {
    vatTaxID: Number(vatTax?.taxID) || configuredVatTaxID,
    vatPercent: vatTax?.taxPercent == null
      ? DEFAULT_TAX_CONFIG.vatPercent
      : Number(vatTax.taxPercent),
    zeroTaxID: Number(zeroTax?.taxID) || DEFAULT_TAX_CONFIG.zeroTaxID,
    exemptTaxID: Number(exemptTax?.taxID) || DEFAULT_TAX_CONFIG.exemptTaxID,
    usedVatFallback: !vatTax
  };
}

module.exports = {
  DEFAULT_TAX_CONFIG,
  isTaxActive,
  resolveTaxConfig
};
