const HOLIDAY_DATES = {
  2026: [
    '2026-01-01',
    '2026-02-08',
    '2026-02-09',
    '2026-02-10',
    '2026-02-11',
    '2026-02-12',
    '2026-02-13',
    '2026-02-14',
    '2026-04-04',
    '2026-04-05',
    '2026-04-06',
    '2026-05-01',
    '2026-05-02',
    '2026-05-03',
    '2026-06-19',
    '2026-06-20',
    '2026-06-21',
    '2026-09-25',
    '2026-09-26',
    '2026-09-27',
    '2026-10-01',
    '2026-10-02',
    '2026-10-03',
    '2026-10-04',
    '2026-10-05',
    '2026-10-06',
    '2026-10-07'
  ]
};

function getYear(dateStr) {
  const year = String(dateStr || '').slice(0, 4);
  return /^\d{4}$/.test(year) ? year : '';
}

function getConfiguredDates(year) {
  if (typeof wx === 'undefined' || !wx.getStorageSync) return [];
  try {
    const dates = wx.getStorageSync('holiday_dates_' + year);
    return Array.isArray(dates) ? dates : [];
  } catch (e) {
    return [];
  }
}

function getHolidayDates(year) {
  const localDates = HOLIDAY_DATES[year] || [];
  const configuredDates = getConfiguredDates(year);
  return Array.from(new Set(localDates.concat(configuredDates)));
}

function isLegalHoliday(dateStr) {
  const year = getYear(dateStr);
  if (!year) return false;
  return getHolidayDates(year).indexOf(dateStr) !== -1;
}

module.exports = {
  getHolidayDates,
  isLegalHoliday
};
