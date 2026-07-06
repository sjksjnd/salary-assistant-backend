const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const { generateTokens, invalidateToken } = require('../middleware/auth');
const { rateLimiters } = require('../middleware/rateLimiter');
const { success, error } = require('../utils/response');
const config = require('../config');

router.post('/login', rateLimiters.login, async (req, res) => {
  try {
    const { code, nickname, avatarUrl } = req.body;

    if (!code) {
      return res.status(400).json(error(40001, '缺少登录凭证'));
    }

    let openid, unionid;
    if (config.isDev() && code === 'dev') {
      openid = 'dev_openid_' + Date.now();
      unionid = null;
    } else {
      const session = await userService.getWeChatSession(code);
      openid = session.openid;
      unionid = session.unionid;
    }

    let user = await userService.getUserByOpenid(openid);
    const isNewUser = !user;

    if (!user) {
      user = await userService.createUser(openid, unionid, nickname, avatarUrl);
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
    console.error('Login error:', err);
    res.status(500).json(error(50001, '登录失败，请重试'));
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json(error(40001, '缺少刷新凭证'));
    }

    await invalidateToken(refreshToken);

    const { userId, openid } = req.user || {};
    if (!userId || !openid) {
      return res.status(401).json(error(40101, '登录已过期'));
    }

    const { accessToken, refreshToken: newRefreshToken } = await generateTokens(userId, openid);

    res.json(success({ accessToken, refreshToken: newRefreshToken }, '刷新成功'));
  } catch (err) {
    res.status(401).json(error(40101, '刷新失败'));
  }
});

router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      await invalidateToken(token);
    }
    res.json(success(null, '退出成功'));
  } catch (err) {
    res.json(success(null, '退出成功'));
  }
});

module.exports = router;
