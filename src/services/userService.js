const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { query, queryInsert, withTransaction } = require('../config/database');
const config = require('../config');

async function getWeChatSession(code) {
  try {
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${config.wechat.appid}&secret=${config.wechat.secret}&js_code=${code}&grant_type=authorization_code`;
    const https = require('https');
    const agent = new https.Agent({
      rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
    });
    const response = await axios.get(url, { httpsAgent: agent });
    const { errcode, errmsg, openid, session_key, unionid } = response.data;

    if (errcode) {
      throw new Error(`WeChat API error: ${errmsg} (${errcode})`);
    }

    return { openid, session_key, unionid };
  } catch (err) {
    throw new Error(`Failed to get WeChat session: ${err.message}`);
  }
}

async function getUserByOpenid(openid) {
  const rows = await query('SELECT * FROM users WHERE openid = ?', [openid]);
  return rows.length > 0 ? rows[0] : null;
}

async function getUserById(userId) {
  const rows = await query('SELECT id, nickname, avatar_url, phone, points, level, exp, status, created_at FROM users WHERE id = ?', [userId]);
  return rows.length > 0 ? rows[0] : null;
}

async function createUser(openid, unionid, nickname, avatarUrl) {
  const inviteCode = generateInviteCode();
  const result = await queryInsert(
    'INSERT INTO users (openid, unionid, nickname, avatar_url, invite_code) VALUES (?, ?, ?, ?, ?)',
    [openid, unionid || null, nickname || '用户', avatarUrl || null, inviteCode]
  );

  const rows = await query('SELECT * FROM users WHERE id = ?', [result.insertId]);
  const user = rows[0];

  await queryInsert(
    'INSERT INTO user_settings (user_id) VALUES (?)',
    [user.id]
  );

  return user;
}

async function updateUser(userId, data) {
  const fields = [];
  const params = [];

  if (data.nickname !== undefined) {
    fields.push('nickname = ?');
    params.push(data.nickname);
  }
  if (data.avatar_url !== undefined) {
    fields.push('avatar_url = ?');
    params.push(data.avatar_url);
  }
  if (data.phone !== undefined) {
    fields.push('phone = ?');
    params.push(data.phone);
  }

  params.push(userId);
  await query(
    `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
    params
  );

  const rows = await query('SELECT id, nickname, avatar_url, phone, points, level, exp, status, created_at FROM users WHERE id = ?', [userId]);
  return rows.length > 0 ? rows[0] : null;
}

async function updateLastLogin(userId) {
  await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [userId]);
}

async function getUserSettings(userId) {
  const rows = await query('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
  return rows.length > 0 ? rows[0] : null;
}

async function updateUserSettings(userId, data) {
  const fields = [];
  const params = [];

  if (data.hourly_rate !== undefined) {
    fields.push('hourly_rate = ?');
    params.push(data.hourly_rate);
  }
  if (data.night_rate !== undefined) {
    fields.push('night_rate = ?');
    params.push(data.night_rate);
  }
  if (data.standard_hours !== undefined) {
    fields.push('standard_hours = ?');
    params.push(data.standard_hours);
  }
  if (data.factory_name !== undefined) {
    fields.push('factory_name = ?');
    params.push(data.factory_name);
  }
  if (data.factory_city !== undefined) {
    fields.push('factory_city = ?');
    params.push(data.factory_city);
  }
  if (data.reminder_enabled !== undefined) {
    fields.push('reminder_enabled = ?');
    params.push(data.reminder_enabled);
  }
  if (data.reminder_time !== undefined) {
    fields.push('reminder_time = ?');
    params.push(data.reminder_time);
  }
  if (data.font_scale !== undefined) {
    fields.push('font_scale = ?');
    params.push(data.font_scale);
  }

  params.push(userId);
  await query(
    `UPDATE user_settings SET ${fields.join(', ')}, updated_at = NOW() WHERE user_id = ?`,
    params
  );

  const rows = await query('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
  return rows.length > 0 ? rows[0] : null;
}

async function acceptAgreement(userId, agreementType, version) {
  await queryInsert(
    'INSERT INTO user_agreements (user_id, agreement_type, version) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE version = VALUES(version), accepted_at = NOW()',
    [userId, agreementType, version]
  );
  return true;
}

async function hasAcceptedAgreement(userId, agreementType) {
  const rows = await query(
    'SELECT 1 FROM user_agreements WHERE user_id = ? AND agreement_type = ?',
    [userId, agreementType]
  );
  return rows.length > 0;
}

function generateInviteCode() {
  return 'INV' + uuidv4().substring(0, 8).toUpperCase();
}

async function exportUserData(userId) {
  const user = await getUserById(userId);
  const settings = await getUserSettings(userId);

  const workhours = await query(
    'SELECT record_date, hours, shift, pay_amount FROM workhour_records WHERE user_id = ? ORDER BY record_date',
    [userId]
  );

  const deductions = await query(
    'SELECT month, category, amount, note, record_date FROM salary_deductions WHERE user_id = ? ORDER BY month',
    [userId]
  );

  const expenses = await query(
    'SELECT month, category, amount, note, record_date FROM salary_expenses WHERE user_id = ? ORDER BY month',
    [userId]
  );

  const advances = await query(
    'SELECT month, amount, note, record_date FROM salary_advances WHERE user_id = ? ORDER BY month',
    [userId]
  );

  const bills = await query(
    'SELECT month, gross_salary, actual_salary, total_deductions, total_expenses, total_advances, remaining, is_settled, archived_at FROM salary_bills WHERE user_id = ? ORDER BY month',
    [userId]
  );

  return {
    user,
    settings,
    workhours,
    deductions,
    expenses,
    advances,
    bills,
  };
}

async function deleteUser(userId) {
  return withTransaction(async (conn) => {
    await conn.query('DELETE FROM detection_records WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM salary_bills WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM salary_advances WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM salary_expenses WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM salary_deductions WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM workhour_records WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM user_settings WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM user_agreements WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM users WHERE id = ?', [userId]);
    return true;
  });
}

module.exports = {
  getWeChatSession,
  getUserByOpenid,
  getUserById,
  createUser,
  updateUser,
  updateLastLogin,
  getUserSettings,
  updateUserSettings,
  acceptAgreement,
  hasAcceptedAgreement,
  exportUserData,
  deleteUser,
};
