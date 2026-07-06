const mysql = require('mysql2/promise');
const config = require('./index');
const logger = require('../utils/logger');

// Create connection pool
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  waitForConnections: true,
  connectionLimit: config.db.max,
  queueLimit: 0,
  charset: 'utf8mb4',
});

/**
 * Execute a parameterized query (prevents SQL injection)
 * MySQL uses ? as placeholder (not $1, $2)
 * @param {string} sql - SQL with ? placeholders
 * @param {Array} params - Parameter values
 * @returns {Promise<Object>} mysql2 result [rows, fields]
 */
async function query(sql, params) {
  const start = Date.now();
  try {
    const [rows] = await pool.execute(sql, params || []);
    const duration = Date.now() - start;
    if (config.isDev() && duration > 100) {
      logger.warn(`Slow query (${duration}ms): ${sql.substring(0, 80)}`);
    }
    return rows;
  } catch (err) {
    logger.error('DB query error:', { sql: sql.substring(0, 120), error: err.message });
    throw err;
  }
}

/**
 * Execute a query that returns insertId (for INSERT)
 * @param {string} sql - SQL with ? placeholders
 * @param {Array} params - Parameter values
 * @returns {Promise<Object>} { insertId, affectedRows }
 */
async function queryInsert(sql, params) {
  const start = Date.now();
  try {
    const [result] = await pool.execute(sql, params || []);
    const duration = Date.now() - start;
    if (config.isDev() && duration > 100) {
      logger.warn(`Slow insert (${duration}ms): ${sql.substring(0, 80)}`);
    }
    return result;
  } catch (err) {
    logger.error('DB insert error:', { sql: sql.substring(0, 120), error: err.message });
    throw err;
  }
}

/**
 * Get a client for transactions
 * @returns {Promise<Object>} mysql2 connection
 */
async function getClient() {
  return pool.getConnection();
}

/**
 * Run a function inside a transaction
 * @param {Function} fn - async fn(client) => result
 * @returns {Promise<any>} fn result
 */
async function withTransaction(fn) {
  const conn = await getClient();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, queryInsert, getClient, withTransaction };
