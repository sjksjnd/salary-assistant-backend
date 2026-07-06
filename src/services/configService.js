const { query, queryInsert } = require('../config/database');
const redis = require('../config/redis');

const CACHE_TTL = 300;

async function getConfig(key) {
  const cacheKey = `config:${key}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const rows = await query('SELECT value FROM config_items WHERE `key` = ?', [key]);
    if (rows.length === 0) {
      return null;
    }

    const value = rows[0].value;
    await redis.set(cacheKey, JSON.stringify(value), 'EX', CACHE_TTL);
    return value;
  } catch (err) {
    const rows = await query('SELECT value FROM config_items WHERE `key` = ?', [key]);
    return rows.length > 0 ? rows[0].value : null;
  }
}

async function setConfig(key, value, description) {
  await queryInsert(
    'INSERT INTO config_items (`key`, value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), description = VALUES(description)',
    [key, JSON.stringify(value), description]
  );
  await redis.del(`config:${key}`);
  return true;
}

async function getAllConfigs() {
  const rows = await query('SELECT `key`, value, description FROM config_items');
  return rows;
}

async function deleteConfig(key) {
  const result = await query('DELETE FROM config_items WHERE `key` = ?', [key]);
  await redis.del(`config:${key}`);
  return result.affectedRows > 0;
}

module.exports = { getConfig, setConfig, getAllConfigs, deleteConfig };
