function calcDailySalary(hourlyRate, standardHours, hours, shift) {
  let rate = hourlyRate;
  if (shift === 'night') {
    rate = hourlyRate * 1.2;
  }
  const pay = hours * rate;
  return Math.round(pay * 100) / 100;
}

function normalizeRecordInput(input) {
  const recordDate = input.recordDate || input.date;
  let hours = Number(input.hours);
  let shift = input.shift === '夜班' ? 'night' : input.shift === '白班' ? 'day' : (input.shift || 'day');
  let payAmount = input.payAmount !== undefined ? Number(input.payAmount) : (input.wage !== undefined ? Number(input.wage) : null);
  let rate = input.rate !== undefined ? Number(input.rate) : null;

  return { recordDate, hours, shift, payAmount, rate };
}

function validateRecord(recordDate, hours) {
  if (!recordDate || !/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) {
    return { valid: false, message: '日期格式不正确' };
  }
  if (isNaN(hours) || hours < 0.5 || hours > 24) {
    return { valid: false, message: '工时必须在0.5-24之间' };
  }
  return { valid: true };
}

function computePayIfNeeded(payAmount, hours, shift, settings) {
  if (payAmount !== null && !isNaN(payAmount)) {
    return payAmount;
  }
  const hourlyRate = (settings && settings.hourlyRate) || 25;
  const standardHours = (settings && settings.standardHours) || 8;
  return calcDailySalary(hourlyRate, standardHours, hours, shift);
}

function formatRecord(r) {
  return {
    id: r._id,
    date: r.recordDate,
    hours: r.hours,
    shift: r.shift === 'night' ? '夜班' : '白班',
    rate: r.rate || 0,
    payAmount: r.payAmount,
    wage: r.payAmount,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function calculateSummary(records) {
  let daysWorked = 0;
  let totalHours = 0;
  let nightHours = 0;
  let totalPay = 0;

  for (const r of records) {
    daysWorked++;
    totalHours += r.hours;
    if (r.shift === '夜班') nightHours += r.hours;
    totalPay += r.payAmount || 0;
  }

  return {
    daysWorked,
    totalHours: Math.round(totalHours * 10) / 10,
    nightHours: Math.round(nightHours * 10) / 10,
    totalPay: Math.round(totalPay * 100) / 100,
  };
}

function getMonthDateRange(month) {
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${lastDay}`;
  return { startDate, endDate };
}

function validateMonth(month) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return { valid: false, message: '月份格式不正确' };
  }
  return { valid: true };
}

module.exports = {
  calcDailySalary,
  normalizeRecordInput,
  validateRecord,
  computePayIfNeeded,
  formatRecord,
  calculateSummary,
  getMonthDateRange,
  validateMonth,
};
