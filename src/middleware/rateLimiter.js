const redis = require('../config/redis');
const config = require('../config');
const { error, ERROR_CODES } = require('../utils/response');

/**
 * Create a rate limiter middleware backed by Redis.
 * Sliding-window style using INCR + EXPIRE.
 * @param {number} limit - max requests per window
 * @param {number} windowSeconds - time window in seconds
 * @returns {Function} Express middleware
 */
function createRateLimiter(limit, windowSeconds = 60) {
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
      // If Redis fails, allow the request through (fail-open)
      next();
    }
  };
}

const rateLimiters = {
  global: createRateLimiter(config.rateLimit.global),
  login: createRateLimiter(config.rateLimit.login),
  contract: createRateLimiter(config.rateLimit.contract),
  calc: createRateLimiter(config.rateLimit.calc),
};

module.exports = { createRateLimiter, rateLimiters };
