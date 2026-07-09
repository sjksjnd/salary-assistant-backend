const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const userService = require('../services/userService');
const { generateTokens, invalidateToken, authenticate } = require('../middleware/auth');
const { rateLimiters } = require('../middleware/rateLimiter');
const { success, error } = require('../utils/response');
const config = require('../config');
const redis = require('../config/redis');
const logger = require('../utils/logger');

router.post('/login', rateLimiters.login, async (req, res) => {
  try {
    const { code, nickname, avatarUrl } = req.body;

    if (!code) {
      return res.status(400).json(error(40001, '缺少登录凭证'));
    }

    let openid, unionid;
    // Dev mode login - only allowed in non-production environments.
    if (code === 'dev' && config.isDev()) {
      openid = 'dev_openid_' + Date.now();
      unionid = null;
      logger.info('[DEV MODE] using dev mode login');

      const mockUser = {
        id: 999999,
        openid,
        nickname: nickname || '开发用户',
        avatar_url: avatarUrl || '',
        phone: null,
        points: 0,
        level: 1,
        exp: 0,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const { accessToken, refreshToken } = await generateTokens(mockUser.id, openid);

      return res.json(success({
        user: {
          id: mockUser.id,
          nickname: mockUser.nickname,
          avatarUrl: mockUser.avatar_url,
          phone: mockUser.phone,
          points: mockUser.points,
          level: mockUser.level,
        },
        accessToken,
        refreshToken,
        isNewUser: true,
      }, '开发模式登录成功'));
    }

    const session = await userService.getWeChatSession(code);
    openid = session.openid;
    unionid = session.unionid;

    let user = await userService.getUserByOpenid(openid);
    const isNewUser = !user;

    if (!user) {
      user = await userService.createUser(openid, unionid, nickname, avatarUrl);
      // Do not log openid / unionid (PII). Log only the internal user id.
      logger.info('[LOGIN] new user registered', { userId: user.id });
    } else if (nickname || avatarUrl) {
      user = await userService.updateUser(user.id, { nickname, avatar_url: avatarUrl });
    }

    await userService.updateLastLogin(user.id);

    const { accessToken, refreshToken } = await generateTokens(user.id, openid);

    res.json(success({
      user: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatar_url,
        phone: user.phone,
        points: user.points,
        level: user.level,
      },
      accessToken,
      refreshToken,
      isNewUser,
    }, isNewUser ? '注册成功' : '登录成功'));
  } catch (err) {
    logger.error('[LOGIN ERROR]', { message: err.message, code: err.code });
    if (err.message.includes('connect ECONNREFUSED') || err.message.includes('ETIMEDOUT')) {
      return res.status(500).json(error(50001, '服务暂时不可用，请稍后重试'));
    }
    if (err.message.includes('WeChat API error')) {
      return res.status(500).json(error(50001, '微信登录失败，请重试'));
    }
    res.status(500).json(error(50001, '登录失败，请重试'));
  }
});

router.post('/update-profile', authenticate, async (req, res) => {
  try {
    const { nickname, avatarUrl } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json(error(40101, '请先登录'));
    }

    const user = await userService.updateUser(userId, { nickname, avatar_url: avatarUrl });

    res.json(success({
      user: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatar_url,
        phone: user.phone,
        points: user.points,
        level: user.level,
      }
    }, '更新成功'));
  } catch (err) {
    logger.error('Update profile error:', err.message);
    res.status(500).json(error(50001, '更新失败'));
  }
});

// PUT /auth/profile - update nickname
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { nickname } = req.body;
    const userId = req.userId;

    if (!nickname || nickname.trim().length === 0) {
      return res.status(400).json(error(40001, '昵称不能为空'));
    }
    if (nickname.length > 20) {
      return res.status(400).json(error(40001, '昵称最多20个字符'));
    }

    const user = await userService.updateUser(userId, { nickname: nickname.trim() });

    res.json(success({
      user: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatar_url,
        phone: user.phone,
        points: user.points,
        level: user.level,
      }
    }, '昵称更新成功'));
  } catch (err) {
    logger.error('Update nickname error:', err.message);
    res.status(500).json(error(50001, '更新失败'));
  }
});

// POST /auth/avatar - upload avatar image
router.post('/avatar', authenticate, async (req, res) => {
  try {
    const userId = req.userId;
    const { avatarUrl } = req.body;

    if (!avatarUrl || typeof avatarUrl !== 'string') {
      return res.status(400).json(error(40001, '请上传头像图片'));
    }

    // Validate avatar URL: only allow https/cloudstorage protocols and reasonable length.
    // Reject javascript:/data: schemes that could be used for stored XSS if ever rendered.
    const MAX_AVATAR_LEN = 2048;
    if (avatarUrl.length > MAX_AVATAR_LEN) {
      return res.status(400).json(error(40001, '头像地址过长'));
    }
    // Allow http(s) URLs and weixin cloud storage file IDs (cloud://).
    if (!/^(https?:\/\/|cloud:\/\/)/i.test(avatarUrl)) {
      return res.status(400).json(error(40001, '头像地址格式不合法'));
    }

    const user = await userService.updateUser(userId, { avatar_url: avatarUrl });

    res.json(success({
      avatarUrl: user.avatar_url
    }, '头像更新成功'));
  } catch (err) {
    logger.error('Upload avatar error:', err.message);
    res.status(500).json(error(50001, '头像上传失败'));
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json(error(40001, '缺少刷新凭证'));
    }

    // Verify the refresh token itself (do NOT rely on authenticate middleware).
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwt.secret);
    } catch (err) {
      return res.status(401).json(error(40101, '刷新凭证无效或已过期'));
    }

    // Reject access tokens being misused as refresh tokens.
    if (decoded.type !== 'refresh') {
      return res.status(401).json(error(40101, '凭证类型错误'));
    }

    const { userId, openid } = decoded;
    if (!userId || !openid) {
      return res.status(401).json(error(40101, '登录已过期'));
    }

    const user = await userService.getUserById(userId);
    if (!user) {
      try { await redis.del(`session:${userId}`); } catch (e) {}
      return res.status(401).json(error(40101, '登录已失效，请重新登录'));
    }

    // Ensure the refresh token matches the one stored in the user's session.
    const storedRefresh = await redis.get(`session:${userId}`);
    if (storedRefresh !== refreshToken) {
      return res.status(401).json(error(40101, '登录已失效，请重新登录'));
    }

    // Rotate: invalidate the old refresh token, then issue a new pair.
    await invalidateToken(refreshToken);
    const { accessToken, refreshToken: newRefreshToken } = await generateTokens(userId, openid);

    res.json(success({ accessToken, refreshToken: newRefreshToken }, '刷新成功'));
  } catch (err) {
    logger.error('Refresh token error:', err.message);
    res.status(500).json(error(50001, '刷新失败'));
  }
});

router.post('/logout', authenticate, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      await invalidateToken(token);
    }
    // Also clear the refresh token session so refresh can no longer rotate.
    if (req.userId) {
      try { await redis.del(`session:${req.userId}`); } catch (e) {}
    }
    res.json(success(null, '退出成功'));
  } catch (err) {
    logger.error('Logout error:', err.message);
    res.json(success(null, '退出成功'));
  }
});

module.exports = router;
