const { query, queryInsert } = require('../config/database');

async function saveDeduction(userId, month, category, amount, note, recordDate) {
  const result = await queryInsert(
    'INSERT INTO salary_deductions (user_id, month, category, amount, note, record_date) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, month, category, amount, note || null, recordDate]
  );
  const rows = await query('SELECT * FROM salary_deductions WHERE id = ?', [result.insertId]);
  return rows[0];
}

async function getDeductionsByMonth(userId, month) {
  const rows = await query(
    'SELECT * FROM salary_deductions WHERE user_id = ? AND month = ? ORDER BY record_date',
    [userId, month]
  );
  return rows;
}

async function deleteDeduction(userId, id) {
  const result = await query(
    'DELETE FROM salary_deductions WHERE user_id = ? AND id = ?',
    [userId, id]
  );
  return result.affectedRows > 0;
}

async function saveExpense(userId, month, category, amount, note, recordDate) {
  const result = await queryInsert(
    'INSERT INTO salary_expenses (user_id, month, category, amount, note, record_date) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, month, category, amount, note || null, recordDate]
  );
  const rows = await query('SELECT * FROM salary_expenses WHERE id = ?', [result.insertId]);
  return rows[0];
}

async function getExpensesByMonth(userId, month) {
  const rows = await query(
    'SELECT * FROM salary_expenses WHERE user_id = ? AND month = ? ORDER BY record_date',
    [userId, month]
  );
  return rows;
}

async function deleteExpense(userId, id) {
  const result = await query(
    'DELETE FROM salary_expenses WHERE user_id = ? AND id = ?',
    [userId, id]
  );
  return result.affectedRows > 0;
}

async function saveAdvance(userId, month, amount, note, recordDate) {
  const result = await queryInsert(
    'INSERT INTO salary_advances (user_id, month, amount, note, record_date) VALUES (?, ?, ?, ?, ?)',
    [userId, month, amount, note || null, recordDate]
  );
  const rows = await query('SELECT * FROM salary_advances WHERE id = ?', [result.insertId]);
  return rows[0];
}

async function getAdvancesByMonth(userId, month) {
  const rows = await query(
    'SELECT * FROM salary_advances WHERE user_id = ? AND month = ? ORDER BY record_date',
    [userId, month]
  );
  return rows;
}

async function deleteAdvance(userId, id) {
  const result = await query(
    'DELETE FROM salary_advances WHERE user_id = ? AND id = ?',
    [userId, id]
  );
  return result.affectedRows > 0;
}

async function saveBill(userId, month, data) {
  const { grossSalary, actualSalary, totalDeductions, totalExpenses, totalAdvances, remaining, isSettled } = data;
  
  await queryInsert(
    'INSERT INTO salary_bills (user_id, month, gross_salary, actual_salary, total_deductions, total_expenses, total_advances, remaining, is_settled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE gross_salary = VALUES(gross_salary), actual_salary = VALUES(actual_salary), total_deductions = VALUES(total_deductions), total_expenses = VALUES(total_expenses), total_advances = VALUES(total_advances), remaining = VALUES(remaining), is_settled = VALUES(is_settled)',
    [userId, month, grossSalary, actualSalary, totalDeductions, totalExpenses, totalAdvances, remaining, isSettled || false]
  );
  
  const rows = await query('SELECT * FROM salary_bills WHERE user_id = ? AND month = ?', [userId, month]);
  return rows[0];
}

async function getBill(userId, month) {
  const rows = await query(
    'SELECT * FROM salary_bills WHERE user_id = ? AND month = ?',
    [userId, month]
  );
  return rows.length > 0 ? rows[0] : null;
}

async function getBillsByYear(userId, year) {
  const rows = await query(
    'SELECT * FROM salary_bills WHERE user_id = ? AND month LIKE ? ORDER BY month',
    [userId, `${year}-%`]
  );
  return rows;
}

async function getBillBoard(userId, month) {
  const bill = await getBill(userId, month);
  const deductions = await getDeductionsByMonth(userId, month);
  const expenses = await getExpensesByMonth(userId, month);
  const advances = await getAdvancesByMonth(userId, month);
  
  return {
    bill: bill || null,
    deductions,
    expenses,
    advances,
  };
}

module.exports = {
  saveDeduction,
  getDeductionsByMonth,
  deleteDeduction,
  saveExpense,
  getExpensesByMonth,
  deleteExpense,
  saveAdvance,
  getAdvancesByMonth,
  deleteAdvance,
  saveBill,
  getBill,
  getBillsByYear,
  getBillBoard,
};
