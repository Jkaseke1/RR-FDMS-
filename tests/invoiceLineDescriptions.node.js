const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Exercise the real parser on extracted text without submitting receipts or
// depending on a customer's PDF being present on the test machine.
function parserFor(text) {
  const filename = path.resolve(__dirname, '../src/utils/invoicePdfParser.js');
  const localRequire = createRequire(filename);
  class PDFParse {
    constructor() {
      this.doc = { getPage: async () => ({ getTextContent: async () => ({ items: [] }) }) };
    }
    async load() {}
    async getText() { return { text }; }
    async destroy() {}
  }
  const context = {
    module: { exports: {} }, console: { log() {} },
    require(name) {
      if (name === 'pdf-parse') return { PDFParse };
      if (name === 'fs') return { readFileSync: () => Buffer.alloc(0) };
      return localRequire(name);
    }
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.module.exports.parseInvoicePDF;
}

test('retains all five INV0959 lines including Top Soil & Transport and the exempt item', async () => {
  const parse = parserFor([
    'Fiscal Tax Invoice', 'INV0959', '27-10-2026',
    'LAWN001 Durban Lawn - sqm 290.00 194.59 1,450.00 5.00 12092500 1',
    'COMP001 Compost Organic kg 35.00 0.00 262.50 7.50 31010000 7',
    'TRANS001 Top Soil & Transport 55.00 257.30 1,917.30 34.86 87049090 1',
    'LABO001 Labour Charges 280.00 37.58 280.00 1.00 99001000 1',
    'TRANS001 Transport Charges 4.00 14.88 110.88 27.72 87049090 1',
    'Total (Excl) 3,516.33', 'Tax 504.35', 'Total (Incl) 4,020.68'
  ].join('\n'));
  const result = await parse('fixture.pdf');
  assert.equal(result.lineItems.length, 5);
  const missing = result.lineItems.find(i => i.description === 'Top Soil & Transport');
  assert.equal(missing.quantity, 55);
  assert.equal(missing.totalIncl, 1917.30);
  assert.equal(missing.tax, 257.30);
  assert.equal(result.lineItems.filter(i => i.itemCode === 'TRANS001').length, 2);
  assert.equal(result.lineItems.find(i => i.itemCode === 'COMP001').sageTaxCode, 7);
  assert.equal(Math.round(result.lineItems.reduce((s, i) => s + i.totalIncl, 0) * 100), 402068);
  assert.equal(Math.round(result.lineItems.reduce((s, i) => s + i.tax, 0) * 100), 50435);
  assert.equal(result.totalIncl, 4020.68);
  assert.equal(result.taxRate, 15.5);
});

test('preserves ampersands and commas across legacy extraction layouts', async () => {
  const rows = [
    'TRANS001 Top Soil & Transport, delivery 55.00 257.30 1,917.30 34.86 87049090 1',
    'TRANS001 Top Soil & Transport, delivery 55.00 257.30 1,917.30 34.86 87049090',
    'TRANS001 Top Soil & Transport, delivery 55.00 1,917.30 34.86 87049090 7',
    'TRANS001 Top Soil & Transport, delivery 55.00 1,917.30 34.86 87049090',
    'TRANS001 Top Soil & Transport, delivery 55.00 257.30 34.86 87049090 1,917.30'
  ];
  for (const row of rows) {
    const parse = parserFor('Fiscal Tax Invoice\nINV0959\n' + row);
    const result = await parse('fixture.pdf');
    assert.equal(result.lineItems.length, 1, row);
    assert.equal(result.lineItems[0].description, 'Top Soil & Transport, delivery');
    assert.equal(result.lineItems[0].quantity, 55);
    assert.equal(result.lineItems[0].totalIncl, 1917.30);
  }
});
