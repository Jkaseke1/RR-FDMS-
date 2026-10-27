function pad(value) {
  return String(value).padStart(2, '0');
}

function formatLocalDateTime(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + 'T' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join(':');
}

function parseLocalDateTime(value) {
  if (!value) return null;

  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/
  );
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function allocateReceiptDate(state, now = new Date()) {
  const fiscalOpened = parseLocalDateTime(state.fiscalDayOpened) || new Date(0);
  const lastDate = parseLocalDateTime(state.lastReceiptDate) || fiscalOpened;
  const minimum = new Date(
    Math.max(fiscalOpened.getTime(), lastDate.getTime()) + 1000
  );
  const chosen = now <= minimum ? minimum : now;

  return formatLocalDateTime(chosen);
}

module.exports = {
  allocateReceiptDate,
  formatLocalDateTime,
  parseLocalDateTime
};
