const redis = require('../config/redis');
const config = require('../config');
const { error, ERROR_CODES } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Create a rate limiter middleware backed by Redis.
 * Uses fixed-window counting via INCR + EXPIRE (not a true sliding window).
 * @param {number} limit - max requests per window
 * @param {number} windowSeconds - time window in seconds
 * @param {object} [options]
 * @param {boolean} [options.failOpen=true] - when Redis fails, allow (true) or deny (false) the request.
 *        Sensitive endpoints (login) should set failOpen=false to prevent brute force via Redis outages.
 * @returns {Function} Express middleware
 */
function createRateLimiter(limit, windowSeconds = 60, options = {}) {
  const failOpen = options.failOpen !== false;
  return async function rateLimiter(req, res, next) {
    const key = `rate:${req.ip}:${req.path}`;
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }

      if (count > limit) {
        res.setHeader('Retry-After', windowSeconds);
        return res.status(429).json(error(ERROR_CODES.RATE_LIMITED.code, ERROR_CODES.RATE_LIMITED.message));
      }

      next();
    } catch (err) {
      // Redis unavailable: log and apply fail-open/fail-closed policy.
      logger.warn('Rate limiter Redis error:', err.message);
      if (failOpen) {
        return next();
      }
      return res.status(429).json(error(ERROR_CODES.RATE_LIMITED.code, '服务繁忙，请稍后重试'));
    }
  };
}

const rateLimiters = {
  global: createRateLimiter(config.rateLimit.global),
  // Login is a sensitive anti-abuse endpoint: fail-closed so Redis outages do not disable brute-force protection.
  login: createRateLimiter(config.rateLimit.login, 60, { failOpen: false }),
  contract: createRateLimiter(config.rateLimit.contract),
  calc: createRateLimiter(config.rateLimit.calc),
};

module.exports = { createRateLimiter, rateLimiters };
