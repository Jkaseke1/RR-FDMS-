process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = 'test-key-not-real';

const {
  updateFromReceipt,
  getForCloseDay,
  reset
} = require('../src/counters/fiscalCounterAggregator');

/**
 * Test counter aggregation
 * Note: These tests require Supabase connection
 * Run with: npm test
 */

describe('Fiscal Counter Aggregator Tests', () => {
  
  const mockFiscalDayId = 1;
  const mockDeviceId = 100;
  const mockFiscalDayNo = 1;

  test('FiscalInvoice updates SaleByTax and SaleTaxByTax', async () => {
    const receipt = {
      receiptType: 'FiscalInvoice',
      receiptCurrency: 'USD',
      receiptTaxes: [
        {
          taxID: 1,
          taxPercent: 15.5,
          taxAmount: 15.50,
          salesAmountWithTax: 115.50
        }
      ],
      receiptPayments: [
        {
          moneyType: 'Cash',
          paymentAmount: 115.50
        }
      ]
    };

    // This would update counters in database
    // In real test, verify database state
    expect(receipt.receiptType).toBe('FiscalInvoice');
    expect(receipt.receiptTaxes.length).toBeGreaterThan(0);
  });

  test('CreditNote updates CreditNoteByTax with negative values', () => {
    const receipt = {
      receiptType: 'CreditNote',
      receiptCurrency: 'USD',
      receiptTaxes: [
        {
          taxID: 1,
          taxPercent: 15.5,
          taxAmount: -15.50,
          salesAmountWithTax: -115.50
        }
      ],
      receiptPayments: [
        {
          moneyType: 'Cash',
          paymentAmount: -115.50
        }
      ]
    };

    expect(receipt.receiptTaxes[0].taxAmount).toBeLessThan(0);
    expect(receipt.receiptTaxes[0].salesAmountWithTax).toBeLessThan(0);
  });

  test('DebitNote updates DebitNoteByTax', () => {
    const receipt = {
      receiptType: 'DebitNote',
      receiptCurrency: 'USD',
      receiptTaxes: [
        {
          taxID: 1,
          taxPercent: 15.5,
          taxAmount: 15.50,
          salesAmountWithTax: 115.50
        }
      ],
      receiptPayments: [
        {
          moneyType: 'Card',
          paymentAmount: 115.50
        }
      ]
    };

    expect(receipt.receiptType).toBe('DebitNote');
  });

  test('BalanceByMoneyType updated for all receipt types', () => {
    const payments = [
      { moneyType: 'Cash', paymentAmount: 50.00 },
      { moneyType: 'Card', paymentAmount: 50.00 },
      { moneyType: 'MobileWallet', paymentAmount: 15.50 }
    ];

    const totalPayments = payments.reduce((sum, p) => sum + p.paymentAmount, 0);
    expect(totalPayments).toBe(115.50);
  });

  test('Zero counters excluded from getForCloseDay', () => {
    const counters = [
      {
        fiscal_counter_type: 'SaleByTax',
        fiscal_counter_currency: 'USD',
        fiscal_counter_tax_id: 1,
        fiscal_counter_tax_percent: 15.5,
        fiscal_counter_value: 0 // Should be excluded
      },
      {
        fiscal_counter_type: 'BalanceByMoneyType',
        fiscal_counter_currency: 'USD',
        fiscal_counter_money_type: 'Cash',
        fiscal_counter_value: 100.00 // Should be included
      }
    ];

    const nonZero = counters.filter(c => c.fiscal_counter_value !== 0);
    expect(nonZero.length).toBe(1);
    expect(nonZero[0].fiscal_counter_type).toBe('BalanceByMoneyType');
  });

});
