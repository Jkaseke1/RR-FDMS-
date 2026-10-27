const {
  allocateReceiptDate,
  formatLocalDateTime,
  parseLocalDateTime
} = require('../src/utils/receiptDateAllocator');

describe('receipt date allocator', () => {
  test('advances one second when consecutive receipts arrive in one second', () => {
    const state = {
      fiscalDayOpened: '2026-10-27T06:01:46',
      lastReceiptDate: '2026-10-27T10:55:14'
    };
    const now = new Date(2026, 9, 27, 10, 55, 14, 699);

    expect(allocateReceiptDate(state, now))
      .toBe('2026-10-27T10:55:15');
  });

  test('uses local wall-clock time when it is later than the minimum', () => {
    const state = {
      fiscalDayOpened: '2026-10-27T06:01:46',
      lastReceiptDate: '2026-10-27T10:55:14'
    };
    const now = new Date(2026, 9, 27, 12, 0, 5, 900);

    expect(allocateReceiptDate(state, now))
      .toBe('2026-10-27T12:00:05');
  });

  test('round-trips a timezone-free local timestamp', () => {
    const value = '2026-10-27T12:54:44';

    expect(formatLocalDateTime(parseLocalDateTime(value))).toBe(value);
  });
});
