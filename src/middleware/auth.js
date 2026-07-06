const jwt = require('jsonwebtoken');
const config = require('../config');
const redis = require('../config/redis');
const { success, error, ERROR_CODES } = require('../utils/response');
const logger = require('../utils/logger');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(error(ERROR_CODES.UNAUTHORIZED.code, ERROR_CODES.UNAUTHORIZED.message));
    }

    const token = authHeader.replace('Bearer ', '');

    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json(error(ERROR_CODES.UNAUTHORIZED.code, '登录已过期，请重新登录'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (err) {
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
  const accessToken = jwt.sign({ userId, openid }, config.jwt.secret, { expiresIn: config.jwt.accessExpires });
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

module.exports = { authenticate, generateTokens, invalidateToken };
