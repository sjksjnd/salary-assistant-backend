const { query, queryInsert } = require('../config/database');

async function saveWorkhour(userId, recordDate, hours, shift, payAmount) {
  await queryInsert(
    'INSERT INTO workhour_records (user_id, record_date, hours, shift, pay_amount) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE hours = VALUES(hours), shift = VALUES(shift), pay_amount = VALUES(pay_amount), updated_at = NOW()',
    [userId, recordDate, hours, shift, payAmount || null]
  );

  const rows = await query('SELECT id, user_id, record_date, hours, shift, pay_amount, created_at, updated_at FROM workhour_records WHERE user_id = ? AND record_date = ?', [userId, recordDate]);
  return rows[0];
}

async function getWorkhour(userId, recordDate) {
  const rows = await query(
    'SELECT id, user_id, record_date, hours, shift, pay_amount, created_at, updated_at FROM workhour_records WHERE user_id = ? AND record_date = ?',
    [userId, recordDate]
  );
  return rows.length > 0 ? rows[0] : null;
}

async function getWorkhoursByMonth(userId, month) {
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
  const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];
  
  const rows = await query(
    'SELECT id, user_id, record_date, hours, shift, pay_amount, created_at, updated_at FROM workhour_records WHERE user_id = ? AND record_date BETWEEN ? AND ? ORDER BY record_date',
    [userId, startDate, endDate]
  );
  return rows;
}

async function getWorkhoursByRange(userId, startDate, endDate) {
  const rows = await query(
    'SELECT id, user_id, record_date, hours, shift, pay_amount, created_at, updated_at FROM workhour_records WHERE user_id = ? AND record_date BETWEEN ? AND ? ORDER BY record_date',
    [userId, startDate, endDate]
  );
  return rows;
}

async function deleteWorkhour(userId, recordDate) {
  const result = await query(
    'DELETE FROM workhour_records WHERE user_id = ? AND record_date = ?',
    [userId, recordDate]
  );
  return result.affectedRows > 0;
}

async function getMonthlySummary(userId, month) {
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
  const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];
  
  const rows = await query(
    `SELECT 
      COUNT(*) as days_worked,
      SUM(hours) as total_hours,
      SUM(CASE WHEN shift = 'night' THEN hours ELSE 0 END) as night_hours,
      SUM(pay_amount) as total_pay
     FROM workhour_records 
     WHERE user_id = ? AND record_date BETWEEN ? AND ?`,
    [userId, startDate, endDate]
  );
  
  return rows[0];
}

async function batchSaveWorkhours(userId, records) {
  if (!records || records.length === 0) return [];

  // Build a single batch INSERT with ON DUPLICATE KEY UPDATE to avoid N+1 queries.
  const placeholders = [];
  const params = [];
  const dates = [];
  for (const r of records) {
    placeholders.push('(?, ?, ?, ?, ?)');
    params.push(userId, r.recordDate || r.date, r.hours, r.shift || 'day', r.payAmount || r.wage || null);
    dates.push(r.recordDate || r.date);
  }

  const sql = `INSERT INTO workhour_records (user_id, record_date, hours, shift, pay_amount) VALUES ${placeholders.join(', ')} ON DUPLICATE KEY UPDATE hours = VALUES(hours), shift = VALUES(shift), pay_amount = VALUES(pay_amount), updated_at = NOW()`;

  await queryInsert(sql, params);

  // Single SELECT to fetch all affected rows (avoids N separate SELECTs).
  const datePlaceholders = dates.map(() => '?').join(', ');
  const rows = await query(
    `SELECT id, user_id, record_date, hours, shift, pay_amount, created_at, updated_at FROM workhour_records WHERE user_id = ? AND record_date IN (${datePlaceholders}) ORDER BY record_date`,
    [userId, ...dates]
  );
  return rows;
}

module.exports = {
  saveWorkhour,
  getWorkhour,
  getWorkhoursByMonth,
  getWorkhoursByRange,
  deleteWorkhour,
  getMonthlySummary,
  batchSaveWorkhours,
};
