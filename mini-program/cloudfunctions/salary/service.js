function validateMonth(month) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return { valid: false, message: '月份格式不正确' };
  }
  return { valid: true };
}

function validateYear(year) {
  if (!year || !/^\d{4}$/.test(year)) {
    return { valid: false, message: '年份格式不正确' };
  }
  return { valid: true };
}

function validateCategory(category) {
  if (!category || category.length > 50) {
    return { valid: false, message: '类别无效' };
  }
  return { valid: true };
}

function validateAmount(amount) {
  const amt = Number(amount);
  if (isNaN(amt) || amt <= 0 || amt > 200000) {
    return { valid: false, message: '金额无效' };
  }
  return { valid: true, amount: amt };
}

function normalizeDeductionInput(input) {
  const { month, category, amount, note = '', date, recordDate } = input;
  const finalDate = recordDate || date;
  return { month, category, amount, note, recordDate: finalDate };
}

function normalizeExpenseInput(input) {
  const { month, category, amount, note = '', date, recordDate } = input;
  const finalDate = recordDate || date;
  return { month, category, amount, note, recordDate: finalDate };
}

function normalizeAdvanceInput(input) {
  const { month, amount, note = '', purpose = '', date, recordDate } = input;
  const finalNote = note || purpose;
  const finalDate = recordDate || date;
  return { month, amount, note: finalNote, recordDate: finalDate };
}

function normalizeBillInput(input) {
  const {
    month,
    grossSalary,
    actualSalary,
    totalDeductions = 0,
    totalExpenses = 0,
    totalAdvances = 0,
    remaining = 0,
    isSettled = false,
  } = input;
  return {
    month,
    grossSalary: Number(grossSalary) || 0,
    actualSalary: Number(actualSalary) || 0,
    totalDeductions: Number(totalDeductions) || 0,
    totalExpenses: Number(totalExpenses) || 0,
    totalAdvances: Number(totalAdvances) || 0,
    remaining: Number(remaining) || 0,
    isSettled: !!isSettled,
  };
}

function formatDeduction(d) {
  return {
    id: d._id,
    month: d.month,
    category: d.category,
    amount: d.amount,
    note: d.note || '',
    date: d.recordDate,
    recordDate: d.recordDate,
    createdAt: d.createdAt,
  };
}

function formatExpense(d) {
  return {
    id: d._id,
    month: d.month,
    category: d.category,
    amount: d.amount,
    note: d.note || '',
    date: d.recordDate,
    recordDate: d.recordDate,
    createdAt: d.createdAt,
  };
}

function formatAdvance(d) {
  return {
    id: d._id,
    month: d.month,
    amount: d.amount,
    note: d.note || '',
    purpose: d.note || '',
    date: d.recordDate,
    recordDate: d.recordDate,
    createdAt: d.createdAt,
  };
}

function formatBill(b) {
  return {
    id: b._id,
    month: b.month,
    grossSalary: b.grossSalary,
    actualSalary: b.actualSalary,
    netSalary: b.actualSalary,
    totalDeductions: b.totalDeductions,
    totalExpenses: b.totalExpenses,
    totalAdvances: b.totalAdvances,
    remaining: b.remaining,
    isSettled: b.isSettled,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

function calculateBoardData(deductions, expenses, advances, workhours, bill) {
  const totalDeductions = deductions.reduce((sum, d) => sum + (d.amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, d) => sum + (d.amount || 0), 0);
  const totalAdvances = advances.reduce((sum, d) => sum + (d.amount || 0), 0);

  let totalHours = workhours.reduce((sum, r) => sum + (r.hours || 0), 0);
  let totalPay = workhours.reduce((sum, r) => sum + (r.payAmount || 0), 0);
  const daysWorked = workhours.length;

  const formattedBill = bill ? formatBill(bill) : null;

  return {
    workSummary: {
      daysWorked,
      totalHours: Math.round(totalHours * 10) / 10,
      totalPay: Math.round(totalPay * 100) / 100,
    },
    totals: {
      grossSalary: formattedBill ? formattedBill.grossSalary : Math.round(totalPay * 100) / 100,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      totalAdvances: Math.round(totalAdvances * 100) / 100,
      netSalary: formattedBill
        ? formattedBill.actualSalary
        : Math.round((totalPay - totalDeductions - totalExpenses - totalAdvances) * 100) / 100,
    },
    bill: formattedBill,
  };
}

module.exports = {
  validateMonth,
  validateYear,
  validateCategory,
  validateAmount,
  normalizeDeductionInput,
  normalizeExpenseInput,
  normalizeAdvanceInput,
  normalizeBillInput,
  formatDeduction,
  formatExpense,
  formatAdvance,
  formatBill,
  calculateBoardData,
};
