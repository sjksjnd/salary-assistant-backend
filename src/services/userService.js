const axios = require('axios');
const fs = require('fs');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
const { query, queryInsert, withTransaction } = require('../config/database');
const config = require('../config');
const logger = require('../utils/logger');

let wechatHttpsAgent;
let insecureWechatHttpsAgent;

function isExplicitFalse(value) {
  return ['false', '0', 'no', 'off'].includes(String(value || '').trim().toLowerCase());
}

function getWeChatHttpsAgent() {
  if (wechatHttpsAgent !== undefined) {
    return wechatHttpsAgent;
  }

  const caPath = process.env.WECHAT_CA_CERT_PATH;
  const rejectUnauthorized = !isExplicitFalse(process.env.WECHAT_TLS_REJECT_UNAUTHORIZED);
  logger.info('[WeChat TLS] outbound TLS config', {
    hasCustomCA: !!caPath,
    rejectUnauthorized,
  });

  if (!caPath && rejectUnauthorized) {
    wechatHttpsAgent = null;
    return wechatHttpsAgent;
  }

  const options = { rejectUnauthorized };
  if (caPath) {
    options.ca = fs.readFileSync(caPath);
  }

  wechatHttpsAgent = new https.Agent(options);
  return wechatHttpsAgent;
}

function getInsecureWeChatHttpsAgent() {
  if (!insecureWechatHttpsAgent) {
    insecureWechatHttpsAgent = new https.Agent({ rejectUnauthorized: false });
  }
  return insecureWechatHttpsAgent;
}

function isSelfSignedCertificateError(err) {
  return err && (
    err.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    err.code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
    /self-signed certificate/i.test(err.message || '')
  );
}

async function requestWeChatSession(url, code, httpsAgent) {
  return axios.get(url, {
    params: {
      appid: config.wechat.appid,
      secret: config.wechat.secret,
      js_code: code,
      grant_type: 'authorization_code',
    },
    ...(httpsAgent ? { httpsAgent } : {}),
    timeout: 10000,
  });
}

function logWeChatUpstreamError(err) {
  if (!err || !err.response) return;
  logger.warn('[WeChat API] jscode2session upstream error', {
    status: err.response.status,
    statusText: err.response.statusText,
    data: err.response.data,
  });
}

async function getWeChatSession(code) {
  try {
    // WeChat jscode2session expects query params; callers must not log the full
    // axios error object because config.params contains the app secret.
    const url = 'https://api.weixin.qq.com/sns/jscode2session';
    const httpsAgent = getWeChatHttpsAgent();
    let response;
    try {
      response = await requestWeChatSession(url, code, httpsAgent);
    } catch (err) {
      if (isSelfSignedCertificateError(err) && process.env.WECHAT_TLS_REJECT_UNAUTHORIZED !== 'true') {
        logger.warn('[WeChat TLS] self-signed certificate detected, retrying jscode2session with TLS verification disabled for this request');
        response = await requestWeChatSession(url, code, getInsecureWeChatHttpsAgent());
      } else {
        throw err;
      }
    }
    const { errcode, errmsg, openid, session_key, unionid } = response.data;

    if (errcode) {
      throw new Error(`WeChat API error: ${errmsg} (${errcode})`);
    }

    return { openid, session_key, unionid };
  } catch (err) {
    logWeChatUpstreamError(err);
    // Preserve original error code for upstream classification (ECONNREFUSED etc.)
    const wrapped = new Error(`Failed to get WeChat session: ${err.message}`);
    if (err.code) wrapped.code = err.code;
    throw wrapped;
  }
}

async function getUserByOpenid(openid) {
  const rows = await query('SELECT id, openid, unionid, nickname, avatar_url, phone, points, level, exp, invite_code, status, last_login_at, created_at, updated_at FROM users WHERE openid = ?', [openid]);
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

  const rows = await query('SELECT id, openid, unionid, nickname, avatar_url, phone, points, level, exp, invite_code, status, last_login_at, created_at, updated_at FROM users WHERE id = ?', [result.insertId]);
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
  const rows = await query('SELECT id, user_id, hourly_rate, night_rate, standard_hours, factory_name, factory_city, reminder_enabled, reminder_time, font_scale, updated_at FROM user_settings WHERE user_id = ?', [userId]);
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

  const rows = await query('SELECT id, user_id, hourly_rate, night_rate, standard_hours, factory_name, factory_city, reminder_enabled, reminder_time, font_scale, updated_at FROM user_settings WHERE user_id = ?', [userId]);
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
