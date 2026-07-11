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

const syncedYears = {};

function getYear(dateStr) {
  const year = String(dateStr || '').slice(0, 4);
  return /^\d{4}$/.test(year) ? year : '';
}

function normalizeYear(year) {
  const value = String(year || '').slice(0, 4);
  return /^\d{4}$/.test(value) ? value : '';
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
  const normalizedYear = normalizeYear(year);
  const localDates = HOLIDAY_DATES[normalizedYear] || [];
  const configuredDates = getConfiguredDates(normalizedYear);
  return Array.from(new Set(localDates.concat(configuredDates)));
}

function isLegalHoliday(dateStr) {
  const year = getYear(dateStr);
  if (!year) return false;
  return getHolidayDates(year).indexOf(dateStr) !== -1;
}

function extractDates(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.dates)) return data.dates;
  if (data && Array.isArray(data.holidays)) return data.holidays;
  return [];
}

function syncHolidayDates(year) {
  const normalizedYear = normalizeYear(year);
  if (!normalizedYear) return Promise.resolve([]);
  if (syncedYears[normalizedYear]) return Promise.resolve(getHolidayDates(normalizedYear));
  if (typeof wx === 'undefined' || !wx.cloud || !wx.cloud.callFunction) {
    syncedYears[normalizedYear] = true;
    return Promise.resolve(getHolidayDates(normalizedYear));
  }

  return new Promise(resolve => {
    wx.cloud.callFunction({
      name: 'config',
      data: { action: 'get', key: 'holiday_dates_' + normalizedYear },
      success(res) {
        const result = res.result || {};
        if (result.code === 0 || result.code === 200) {
          const dates = extractDates(result.data)
            .map(item => String(item || '').trim())
            .filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item));
          if (dates.length) {
            try {
              wx.setStorageSync('holiday_dates_' + normalizedYear, dates);
            } catch (e) {}
          }
        }
        syncedYears[normalizedYear] = true;
        resolve(getHolidayDates(normalizedYear));
      },
      fail() {
        syncedYears[normalizedYear] = true;
        resolve(getHolidayDates(normalizedYear));
      }
    });
  });
}

function syncHolidayDatesForMonth(month) {
  return syncHolidayDates(normalizeYear(month));
}

module.exports = {
  getHolidayDates,
  isLegalHoliday,
  syncHolidayDates,
  syncHolidayDatesForMonth
};
