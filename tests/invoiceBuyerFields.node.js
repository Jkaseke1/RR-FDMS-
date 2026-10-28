const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractBuyerFields } = require('../src/utils/invoiceBuyerFields');

function item(str, x, y, width = 90) {
  return { str, transform: [1, 0, 0, 1, x, y], width };
}
function form() {
  return [
    item('Rapid Roots Investments (Pvt) Ltd', 18, 720),
    item('VAT Number', 20, 652), item('220401569', 101, 651.6),
    item('Lanbec', 388, 782), item('LANB001U', 388, 766),
    item('CUSTOMER NAME:', 285, 782), item('ACCOUNT', 285, 766),
    item('CUSTOMER HSE NO.', 285, 753), item('STREET', 285, 738),
    item('REGION', 285, 720), item('CITY', 285, 702),
    item('VAT Number:', 285, 687), item('TIN Number:', 285, 669)
  ];
}

test('empty buyer fields stay empty despite interleaved supplier identifiers', () => {
  const fields = extractBuyerFields(form());
  assert.equal(fields.name, 'Lanbec');
  assert.equal(fields.account, 'LANB001U');
  for (const field of ['tin', 'vat', 'house', 'street', 'region', 'city']) {
    assert.equal(fields[field], null);
  }
});

test('reads real buyer identifiers and address regardless of PDF extraction order', () => {
  const items = form().concat([
    item('220230024', 388, 687), item('2000766749', 388, 669),
    item('57 Glenelg', 388, 753), item('Vainona', 388, 738),
    item('Harare', 388, 720), item('Harare', 388, 702)
  ]).reverse();
  const fields = extractBuyerFields(items);
  assert.equal(fields.vat, '220230024');
  assert.equal(fields.tin, '2000766749');
  assert.equal(fields.house, '57 Glenelg');
  assert.equal(fields.city, 'Harare');
});

test('preserves explicitly printed TIN without inventing a buyer VAT number', () => {
  const items = form().map(i => i.str === 'TIN Number:'
    ? { ...i, str: 'TIN Number: 2222222222' } : i);
  const fields = extractBuyerFields(items);
  assert.equal(fields.tin, '2222222222');
  assert.equal(fields.vat, null);
});

test('does not misidentify incomplete forms or invoice tables as a customer form', () => {
  assert.equal(extractBuyerFields([item('CUSTOMER NAME:', 285, 782)]), null);
  assert.equal(extractBuyerFields([item('Account Date Order No', 18, 400)]), null);
});
