const Redis = require('ioredis');
const config = require('./index');

const logger = require('../utils/logger');

let redis;
let isMemoryMode = false;

function createMemoryStore() {
  const store = new Map();
  const ttlMap = new Map();

  function cleanupExpired() {
    const now = Date.now();
    for (const [key, expireAt] of ttlMap.entries()) {
      if (expireAt <= now) {
        store.delete(key);
        ttlMap.delete(key);
      }
    }
  }

  return {
    async get(key) {
      cleanupExpired();
      const v = store.get(key);
      return v === undefined ? null : v;
    },
    async set(key, value, mode, duration) {
      cleanupExpired();
      store.set(key, value);
      if (mode === 'EX' && duration) {
        ttlMap.set(key, Date.now() + duration * 1000);
      }
      return 'OK';
    },
    async setex(key, seconds, value) {
      cleanupExpired();
      store.set(key, value);
      ttlMap.set(key, Date.now() + seconds * 1000);
      return 'OK';
    },
    async incr(key) {
      cleanupExpired();
      const current = Number(store.get(key) || 0);
      const next = current + 1;
      store.set(key, next);
      if (!ttlMap.has(key)) {
        ttlMap.set(key, Date.now() + 60 * 1000);
      }
      return next;
    },
    async expire(key, seconds) {
      cleanupExpired();
      if (store.has(key)) {
        ttlMap.set(key, Date.now() + seconds * 1000);
        return 1;
      }
      return 0;
    },
    async del(key) {
      cleanupExpired();
      const existed = store.has(key);
      store.delete(key);
      ttlMap.delete(key);
      return existed ? 1 : 0;
    },
    on() {
      // no-op for memory mode
    },
    quit() {
      store.clear();
      ttlMap.clear();
    },
    status: 'ready',
    _isMemory: true,
  };
}

if (config.redis.host && config.redis.host !== 'localhost') {
  redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    keyPrefix: config.redis.keyPrefix,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 5) return null;
      return Math.min(times * 200, 2000);
    },
  });

  redis.on('error', (err) => {
    logger.warn('[Redis] connection error:', err.message);
  });

  redis.on('connect', () => {
    logger.info('[Redis] connected');
  });

  redis.connect().catch((err) => {
    logger.warn('[Redis] initial connect failed, falling back to memory mode:', err.message);
    isMemoryMode = true;
    redis = createMemoryStore();
  });
} else {
  logger.info('[Redis] no REDIS_HOST configured, using in-memory store');
  isMemoryMode = true;
  redis = createMemoryStore();
}

module.exports = redis;
module.exports.isMemoryMode = () => isMemoryMode;
