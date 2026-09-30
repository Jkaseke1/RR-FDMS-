const {
  DEFAULT_TAX_CONFIG,
  resolveTaxConfig
} = require('../src/integrations/taxConfigResolver');

describe('tax config resolver', () => {
  test('uses the safe device VAT tax when GetConfig is empty', () => {
    expect(resolveTaxConfig([])).toMatchObject({
      vatTaxID: 515,
      vatPercent: 15.5,
      usedVatFallback: true
    });
  });

  test('prefers the configured active VAT tax', () => {
    const taxes = [
      { taxID: 517, taxPercent: 15.5 },
      { taxID: 515, taxPercent: 15.5 }
    ];

    expect(resolveTaxConfig(taxes, { vatTaxID: 515 })).toMatchObject({
      vatTaxID: 515,
      usedVatFallback: false
    });
  });

  test('ignores expired VAT taxes', () => {
    const taxes = [
      {
        taxID: 517,
        taxPercent: 15.5,
        validTill: '2026-01-01T00:00:00Z'
      },
      {
        taxID: 515,
        taxPercent: 15.5,
        validTill: '2027-01-01T00:00:00Z'
      }
    ];

    expect(resolveTaxConfig(taxes, {
      now: new Date('2026-09-30T00:00:00Z')
    })).toMatchObject({
      vatTaxID: 515,
      usedVatFallback: false
    });
  });

  test('keeps standard zero and exempt fallbacks', () => {
    expect(resolveTaxConfig([])).toMatchObject({
      zeroTaxID: DEFAULT_TAX_CONFIG.zeroTaxID,
      exemptTaxID: DEFAULT_TAX_CONFIG.exemptTaxID
    });
  });
});
