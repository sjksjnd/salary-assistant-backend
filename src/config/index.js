const dotenv = require('dotenv');

dotenv.config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  // Database
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'salary_assistant',
    user: process.env.DB_USER || 'postgres',
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
