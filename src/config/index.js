const dotenv = require('dotenv');

dotenv.config();

const env = process.env.NODE_ENV || 'development';

// Security: in production, JWT_SECRET must be set explicitly (>= 32 chars).
// Failing fast at boot is safer than silently using a known default.
if (env === 'production') {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('[FATAL] JWT_SECRET must be set in production with at least 32 characters.');
  }
  if (!process.env.WX_APPID || !process.env.WX_SECRET) {
    throw new Error('[FATAL] WX_APPID and WX_SECRET must be set in production.');
  }
}

const config = {
  env,
  port: parseInt(process.env.PORT, 10) || 3000,

  // Database
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    name: process.env.DB_NAME || 'salary_assistant',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    max: 20, // max connections in pool
    idleTimeoutMillis: 30000,
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    keyPrefix: 'sa:',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_secret_change_me_in_production_at_least_32_chars',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '2h',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },

  // WeChat
  wechat: {
    appid: process.env.WX_APPID || '',
    secret: process.env.WX_SECRET || '',
  },

  // OSS / COS
  oss: {
    bucket: process.env.OSS_BUCKET || '',
    region: process.env.OSS_REGION || 'ap-guangzhou',
    accessKey: process.env.OSS_ACCESS_KEY || '',
    secretKey: process.env.OSS_SECRET_KEY || '',
  },

  // Rate limits (requests per minute)
  rateLimit: {
    global: parseInt(process.env.RATE_LIMIT_GLOBAL, 10) || 100,
    login: parseInt(process.env.RATE_LIMIT_LOGIN, 10) || 5,
    contract: parseInt(process.env.RATE_LIMIT_CONTRACT, 10) || 5,
    calc: parseInt(process.env.RATE_LIMIT_CALC, 10) || 10,
  },

  isDev() {
    return this.env === 'development';
  },
  isProd() {
    return this.env === 'production';
  },
};

module.exports = config;
