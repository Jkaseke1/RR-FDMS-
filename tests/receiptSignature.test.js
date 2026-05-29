const {
  formatTaxPercent,
  toCents,
  buildTaxString,
  buildReceiptHashInput,
  generateReceiptHash
} = require('../src/signatures/receiptSignature');

describe('Receipt Signature Tests', () => {

  describe('formatTaxPercent', () => {
    test('15 to 15.00', () => {
      expect(formatTaxPercent(15)).toBe('15.00');
    });
    test('14.5 to 14.50', () => {
      expect(formatTaxPercent(14.5)).toBe('14.50');
    });
    test('15.5 to 15.50', () => {
      expect(formatTaxPercent(15.5)).toBe('15.50');
    });
    test('0 to 0.00', () => {
      expect(formatTaxPercent(0)).toBe('0.00');
    });
    test('null to empty string', () => {
      expect(formatTaxPercent(null)).toBe('');
    });
    test('undefined to empty string', () => {
      expect(formatTaxPercent(undefined)).toBe('');
    });
  });

  describe('toCents', () => {
    test('500.00 to 50000', () => {
      expect(toCents(500.00)).toBe(50000);
    });
    test('12.34 to 1234', () => {
      expect(toCents(12.34)).toBe(1234);
    });
    test('0.05 to 5', () => {
      expect(toCents(0.05)).toBe(5);
    });
    test('9450.00 to 945000', () => {
      expect(toCents(9450.00)).toBe(945000);
    });
    test('-9450.00 to -945000', () => {
      expect(toCents(-9450.00)).toBe(-945000);
    });
    test('-40.35 to -4035', () => {
      expect(toCents(-40.35)).toBe(-4035);
    });
  });

  describe('buildTaxString', () => {
    test('sorts by taxID then taxCode', () => {
      const taxes = [
        { taxID: 3, taxCode: 'D', taxPercent: 15,
          taxAmount: 300, salesAmountWithTax: 2300 },
        { taxID: 1, taxCode: 'A', taxPercent: null,
          taxAmount: 0, salesAmountWithTax: 2500 },
        { taxID: 3, taxCode: 'C', taxPercent: 15,
          taxAmount: 150, salesAmountWithTax: 1150 },
        { taxID: 2, taxCode: 'B', taxPercent: 0,
          taxAmount: 0, salesAmountWithTax: 3500 }
      ];
      const result = buildTaxString(taxes);
      expect(result).toBe(
        'A0250000B0.000350000C15.0015000115000D15.0030000230000'
      );
    });

    test('exempt tax has empty percent string', () => {
      const taxes = [
        { taxID: 1, taxCode: 'A', taxPercent: null,
          taxAmount: 0, salesAmountWithTax: 100 }
      ];
      expect(buildTaxString(taxes)).toBe('A010000');
    });

    test('zero rated tax has 0.00 percent', () => {
      const taxes = [
        { taxID: 1, taxCode: 'B', taxPercent: 0,
          taxAmount: 0, salesAmountWithTax: 100 }
      ];
      expect(buildTaxString(taxes)).toBe('B0.00010000');
    });

    test('15.5 percent tax formatted correctly', () => {
      const taxes = [
        { taxID: 1, taxCode: 'A', taxPercent: 15.5,
          taxAmount: 289.87, salesAmountWithTax: 2160 }
      ];
      expect(buildTaxString(taxes)).toBe(
        'A15.5028987216000'
      );
    });
  });

  describe('buildReceiptHashInput', () => {
    test('builds correct string structure', () => {
      const receipt = {
        deviceID: 35224,
        receiptType: 'FiscalInvoice',
        receiptCurrency: 'USD',
        receiptGlobalNo: 1,
        receiptDate: '2026-05-21T10:30:00',
        receiptTotal: 2160.00,
        receiptTaxes: [{
          taxID: 1,
          taxCode: 'A',
          taxPercent: 15.5,
          taxAmount: 289.87,
          salesAmountWithTax: 2160.00
        }]
      };
      const input = buildReceiptHashInput(receipt, null);
      expect(input).toContain('35224');
      expect(input).toContain('FISCALINVOICE');
      expect(input).toContain('USD');
      expect(input).toContain('2026-05-21T10:30:00');
      expect(input).toContain('216000');
      expect(input).toContain('A15.50');
      expect(input.startsWith('35224FISCALINVOICEUSD1')).toBe(true);
    });

    test('omits previousHash when null', () => {
      const receipt = {
        deviceID: 1,
        receiptType: 'FiscalInvoice',
        receiptCurrency: 'USD',
        receiptGlobalNo: 1,
        receiptDate: '2026-01-01T00:00:00',
        receiptTotal: 100,
        receiptTaxes: []
      };
      const withNull = buildReceiptHashInput(receipt, null);
      const withUndefined = buildReceiptHashInput(
        receipt, undefined
      );
      expect(withNull).toBe(withUndefined);
      expect(withNull).not.toContain('hash');
    });

    test('appends previousHash when provided', () => {
      const receipt = {
        deviceID: 1,
        receiptType: 'FiscalInvoice',
        receiptCurrency: 'USD',
        receiptGlobalNo: 2,
        receiptDate: '2026-01-01T00:00:00',
        receiptTotal: 100,
        receiptTaxes: []
      };
      const prevHash = 'abc123==';
      const input = buildReceiptHashInput(receipt, prevHash);
      expect(input.endsWith('abc123==')).toBe(true);
    });

    test('receiptDate timezone stripped', () => {
      const receipt = {
        deviceID: 1,
        receiptType: 'FiscalInvoice',
        receiptCurrency: 'USD',
        receiptGlobalNo: 1,
        receiptDate: '2026-01-01T10:00:00.000Z',
        receiptTotal: 100,
        receiptTaxes: []
      };
      const input = buildReceiptHashInput(receipt, null);
      expect(input).toContain('2026-01-01T10:00:00');
      expect(input).not.toContain('.000');
      expect(input).not.toContain('Z');
    });
  });

  describe('generateReceiptHash', () => {
    test('returns base64 SHA256', () => {
      const hash = generateReceiptHash('test input');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(40);
      const decoded = Buffer.from(hash, 'base64');
      expect(decoded.length).toBe(32);
    });

    test('same input gives same hash', () => {
      const h1 = generateReceiptHash('same input');
      const h2 = generateReceiptHash('same input');
      expect(h1).toBe(h2);
    });

    test('different input gives different hash', () => {
      const h1 = generateReceiptHash('input one');
      const h2 = generateReceiptHash('input two');
      expect(h1).not.toBe(h2);
    });
  });

});
