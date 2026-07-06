const Redis = require('ioredis');
const config = require('./index');

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  keyPrefix: config.redis.keyPrefix,
  retryStrategy(times) {
    if (times > 10) return null; // stop retrying after 10 attempts
    return Math.min(times * 200, 2000);
  },
});

redis.on('error', (err) => {
  // Non-fatal: degrade gracefully if Redis is unavailable
  if (config.isDev()) {
    console.warn('[Redis] connection error (degrading):', err.message);
  }
});

redis.on('connect', () => {
  if (config.isDev()) {
    console.log('[Redis] connected');
  }
});

module.exports = redis;
