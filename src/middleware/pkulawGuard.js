const redis = require('../config/redis');
const logger = require('../utils/logger');

const CACHE_TTL = parseInt(process.env.PKULAW_CACHE_TTL, 10) || 3600;
const USER_DAILY_LIMIT = parseInt(process.env.PKULAW_USER_DAILY_LIMIT, 10) || 20;
const GLOBAL_DAILY_LIMIT = parseInt(process.env.PKULAW_GLOBAL_DAILY_LIMIT, 10) || 500;

const KEY_PREFIX = 'pkulaw:';

function cacheKey(toolName, args) {
  const argStr = JSON.stringify(args);
  return `${KEY_PREFIX}cache:${toolName}:${argStr}`;
}

function userDailyKey(userId) {
  const today = new Date().toISOString().slice(0, 10);
  return `${KEY_PREFIX}user:${userId}:${today}`;
}

function globalDailyKey() {
  const today = new Date().toISOString().slice(0, 10);
  return `${KEY_PREFIX}global:${today}`;
}

async function getCached(toolName, args) {
  try {
    const key = cacheKey(toolName, args);
    const raw = await redis.get(key);
    if (raw) {
      logger.info(`[PKULaw] cache hit: ${toolName}`);
      return JSON.parse(raw);
    }
  } catch (err) {
    logger.warn('[PKULaw] cache read error:', err.message);
  }
  return null;
}

async function setCached(toolName, args, data) {
  try {
    const key = cacheKey(toolName, args);
    await redis.setex(key, CACHE_TTL, JSON.stringify(data));
  } catch (err) {
    logger.warn('[PKULaw] cache write error:', err.message);
  }
}

async function checkUserQuota(userId) {
  try {
    const key = userDailyKey(userId);
    const count = await redis.get(key);
    const current = parseInt(count, 10) || 0;
    if (current >= USER_DAILY_LIMIT) {
      return {
        allowed: false,
        reason: `今日查询次数已达上限（${USER_DAILY_LIMIT}次/天）`,
        remaining: 0,
      };
    }
    return {
      allowed: true,
      remaining: USER_DAILY_LIMIT - current,
    };
  } catch (err) {
    logger.warn('[PKULaw] quota check error:', err.message);
    return { allowed: true, remaining: 0 };
  }
}

async function checkGlobalQuota() {
  try {
    const key = globalDailyKey();
    const count = await redis.get(key);
    const current = parseInt(count, 10) || 0;
    if (current >= GLOBAL_DAILY_LIMIT) {
      return {
        allowed: false,
        reason: '系统今日查询量已达上限',
        remaining: 0,
      };
    }
    return {
      allowed: true,
      remaining: GLOBAL_DAILY_LIMIT - current,
    };
  } catch (err) {
    logger.warn('[PKULaw] global quota check error:', err.message);
    return { allowed: true, remaining: 0 };
  }
}

async function incrementUsage(userId) {
  try {
    const userKey = userDailyKey(userId);
    const globalKey = globalDailyKey();

    const [userCount, globalCount] = await Promise.all([
      redis.incr(userKey),
      redis.incr(globalKey),
    ]);

    if (userCount === 1) {
      const secondsUntilMidnight = getSecondsUntilMidnight();
      await redis.expire(userKey, secondsUntilMidnight);
    }
    if (globalCount === 1) {
      const secondsUntilMidnight = getSecondsUntilMidnight();
      await redis.expire(globalKey, secondsUntilMidnight);
    }

    return {
      userCount,
      globalCount,
    };
  } catch (err) {
    logger.warn('[PKULaw] usage increment error:', err.message);
    return { userCount: 0, globalCount: 0 };
  }
}

function getSecondsUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.floor((midnight - now) / 1000);
}

async function withProtection(userId, toolName, args, fn) {
  const cached = await getCached(toolName, args);
  if (cached) {
    return { data: cached, fromCache: true, quota: null };
  }

  const userQuota = await checkUserQuota(userId);
  if (!userQuota.allowed) {
    return { data: null, fromCache: false, quota: userQuota, blocked: true };
  }

  const globalQuota = await checkGlobalQuota();
  if (!globalQuota.allowed) {
    return { data: null, fromCache: false, quota: globalQuota, blocked: true };
  }

  const result = await fn();

  await setCached(toolName, args, result);
  const usage = await incrementUsage(userId);

  return {
    data: result,
    fromCache: false,
    quota: {
      allowed: true,
      remaining: USER_DAILY_LIMIT - usage.userCount,
    },
  };
}

module.exports = {
  getCached,
  setCached,
  checkUserQuota,
  checkGlobalQuota,
  incrementUsage,
  withProtection,
  USER_DAILY_LIMIT,
  GLOBAL_DAILY_LIMIT,
  CACHE_TTL,
};
