const jwt = require('jsonwebtoken');
const config = require('../config');
const redis = require('../config/redis');
const { error, ERROR_CODES } = require('../utils/response');
const logger = require('../utils/logger');

function parseCsvEnv(name) {
  return (process.env[name] || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(error(ERROR_CODES.UNAUTHORIZED.code, ERROR_CODES.UNAUTHORIZED.message));
    }

    const token = authHeader.replace('Bearer ', '');

    // Check token blacklist. If Redis is unavailable, fail-open (allow the request)
    // rather than blocking all authenticated traffic. The JWT signature is still
    // verified below, so only revoked tokens would slip through temporarily.
    try {
      const isBlacklisted = await redis.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return res.status(401).json(error(ERROR_CODES.UNAUTHORIZED.code, '登录已过期，请重新登录'));
      }
    } catch (redisErr) {
      // Redis down: log and continue. A revoked token may briefly work, but
      // blocking all auth traffic is worse for availability.
      logger.warn('Redis blacklist check failed, failing open:', redisErr.message);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      return res.status(401).json(error(ERROR_CODES.UNAUTHORIZED.code, ERROR_CODES.UNAUTHORIZED.message));
    }

    if (decoded.type && decoded.type !== 'access') {
      return res.status(401).json(error(ERROR_CODES.UNAUTHORIZED.code, ERROR_CODES.UNAUTHORIZED.message));
    }
    if (!decoded.userId || !decoded.openid) {
      return res.status(401).json(error(ERROR_CODES.UNAUTHORIZED.code, ERROR_CODES.UNAUTHORIZED.message));
    }

    req.userId = decoded.userId;
    req.openid = decoded.openid;
    next();
  } catch (err) {
    logger.error('Auth middleware error:', err);
    return res.status(500).json(error(ERROR_CODES.SERVER_ERROR.code, ERROR_CODES.SERVER_ERROR.message));
  }
}

async function generateTokens(userId, openid) {
  const accessToken = jwt.sign({ userId, openid, type: 'access' }, config.jwt.secret, { expiresIn: config.jwt.accessExpires });
  const refreshToken = jwt.sign({ userId, openid, type: 'refresh' }, config.jwt.secret, { expiresIn: config.jwt.refreshExpires });

  await redis.set(`session:${userId}`, refreshToken, 'EX', 7 * 24 * 60 * 60);

  return { accessToken, refreshToken };
}

async function invalidateToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwt.secret, { ignoreExpiration: true });
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
    if (expiresIn > 0) {
      await redis.set(`blacklist:${token}`, '1', 'EX', expiresIn);
    }
  } catch (err) {
    logger.warn('Invalidate token failed:', err.message);
  }
}

function requireAdmin(req, res, next) {
  const adminUserIds = parseCsvEnv('ADMIN_USER_IDS');
  const adminOpenids = parseCsvEnv('ADMIN_OPENIDS');

  // Keep local development usable when no explicit admin list exists.
  if (config.isDev() && adminUserIds.length === 0 && adminOpenids.length === 0) {
    return next();
  }

  const userId = String(req.userId || '');
  const openid = String(req.openid || '');
  if (adminUserIds.includes(userId) || adminOpenids.includes(openid)) {
    return next();
  }

  return res.status(403).json(error(ERROR_CODES.FORBIDDEN.code, ERROR_CODES.FORBIDDEN.message));
}

module.exports = { authenticate, requireAdmin, generateTokens, invalidateToken };
