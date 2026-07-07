const configService = require('./configService');

async function calcDailySalary(hourlyRate, standardHours, workedHours, shift) {
  let payAmount = 0;
  
  if (shift === 'night') {
    const nightRate = hourlyRate * 1.5;
    payAmount = workedHours * nightRate;
  } else {
    if (workedHours <= standardHours) {
      payAmount = workedHours * hourlyRate;
    } else {
      const regularPay = standardHours * hourlyRate;
      const overtimeHours = workedHours - standardHours;
      const overtimePay = overtimeHours * hourlyRate * 1.5;
      payAmount = regularPay + overtimePay;
    }
  }
  
  return Math.round(payAmount * 100) / 100;
}

async function calcMonthlySalary(userId, month, settings) {
  const hourlyRate = settings.hourly_rate || 25;
  const standardHours = settings.standard_hours || 8;
  
  let totalSalary = 0;
  const dailyDetails = [];
  
  const [year, monthNum] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const weekday = new Date(year, monthNum - 1, day).getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    
    let workedHours = 0;
    let shift = 'day';
    
    if (!isWeekend) {
      workedHours = standardHours;
    }
    
    const dailyPay = calcDailySalary(hourlyRate, standardHours, workedHours, shift);
    totalSalary += dailyPay;
    
    dailyDetails.push({
      date,
      workedHours,
      shift,
      dailyPay,
      isWeekend,
    });
  }
  
  return {
    totalSalary: Math.round(totalSalary * 100) / 100,
    hourlyRate,
    standardHours,
    daysInMonth,
    dailyDetails,
  };
}

async function calcSeverance(years, monthlySalary, city) {
  const avgSalaryMap = await configService.getConfig('avg_salary') || {};
  const cityAvgSalary = avgSalaryMap[city] || 8000;
  
  const salaryCap = 3 * cityAvgSalary;
  
  let cappedSalary = monthlySalary;
  if (monthlySalary > salaryCap) {
    cappedSalary = salaryCap;
  }
  
  const cappedYears = Math.min(years, 12);
  
  const severance = cappedYears * cappedSalary;
  return {
    amount: Math.round(severance * 100) / 100,
    cappedSalary,
    cappedYears,
    salaryCap,
    cityAvgSalary,
  };
}

async function calcDoubleSalary(months) {
  return Math.max(0, months) * 2;
}

async function calcOvertime(hours, hourlyRate, type) {
  let multiplier = 1.5;
  if (type === 'weekend') multiplier = 2;
  if (type === 'holiday') multiplier = 3;
  
  return Math.round(hours * hourlyRate * multiplier * 100) / 100;
}

async function calcSocialInsurance(monthlySalary, city) {
  const rates = {
    pension: 0.08,
    medical: 0.02,
    unemployment: 0.005,
    housing: 0.12,
  };
  
  const minWageMap = await configService.getConfig('min_wage') || {};
  const cityMinWage = minWageMap[city] || 2000;
  
  const baseSalary = Math.max(monthlySalary, cityMinWage);
  
  const pension = Math.round(baseSalary * rates.pension * 100) / 100;
  const medical = Math.round(baseSalary * rates.medical * 100) / 100;
  const unemployment = Math.round(baseSalary * rates.unemployment * 100) / 100;
  const housing = Math.round(baseSalary * rates.housing * 100) / 100;
  
  return {
    pension,
    medical,
    unemployment,
    housing,
    total: Math.round((pension + medical + unemployment + housing) * 100) / 100,
    baseSalary,
  };
}

async function calcCompensation(options) {
  const {
    workYears = 0,
    monthlySalary = 0,
    overtimeHours = 0,
    overtimeType = 'workday',
    city = '广东',
    hasDoubleSalary = false,
    doubleSalaryMonths = 0,
  } = options;
  
  const severance = await calcSeverance(workYears, monthlySalary, city);
  const overtimePay = await calcOvertime(overtimeHours, monthlySalary / 21.75 / 8, overtimeType);
  const socialInsurance = await calcSocialInsurance(monthlySalary, city);
  
  let total = severance.amount + overtimePay;
  
  if (hasDoubleSalary) {
    total += monthlySalary * doubleSalaryMonths;
  }
  
  return {
    severance,
    overtimePay,
    socialInsurance,
    doubleSalary: hasDoubleSalary ? monthlySalary * doubleSalaryMonths : 0,
    total: Math.round(total * 100) / 100,
  };
}

async function calcDeductibleAmount(baseSalary, deductions) {
  let total = 0;
  for (const deduction of deductions) {
    if (deduction.category === 'social') {
      continue;
    }
    total += deduction.amount || 0;
  }
  return Math.round(total * 100) / 100;
}

async function calcAdvanceBalance(totalSalary, advances) {
  const totalAdvances = advances.reduce((sum, adv) => sum + (adv.amount || 0), 0);
  return Math.round((totalSalary - totalAdvances) * 100) / 100;
}

async function calcFinalPay(options) {
  const {
    baseSalary = 0,
    overtimeHours = 0,
    overtimeType = 'workday',
    deductions = [],
    advances = [],
    city = '广东',
  } = options;
  
  const overtimePay = await calcOvertime(overtimeHours, baseSalary / 21.75 / 8, overtimeType);
  const socialInsurance = await calcSocialInsurance(baseSalary, city);
  const otherDeductions = await calcDeductibleAmount(baseSalary, deductions);
  const advanceBalance = await calcAdvanceBalance(baseSalary + overtimePay, advances);
  
  const totalDeductions = socialInsurance.total + otherDeductions;
  const finalPay = baseSalary + overtimePay - totalDeductions - advances.reduce((sum, adv) => sum + (adv.amount || 0), 0);
  
  return {
    baseSalary,
    overtimePay,
    grossSalary: Math.round((baseSalary + overtimePay) * 100) / 100,
    socialInsurance,
    otherDeductions,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    totalAdvances: advances.reduce((sum, adv) => sum + (adv.amount || 0), 0),
    finalPay: Math.round(finalPay * 100) / 100,
    advanceBalance,
  };
}

module.exports = {
  calcDailySalary,
  calcMonthlySalary,
  calcSeverance,
  calcDoubleSalary,
  calcOvertime,
  calcSocialInsurance,
  calcCompensation,
  calcDeductibleAmount,
  calcAdvanceBalance,
  calcFinalPay,
};
