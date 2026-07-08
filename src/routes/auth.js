const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const { generateTokens, invalidateToken, authenticate } = require('../middleware/auth');
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
    if (code === 'dev') {
      openid = 'dev_openid_' + Date.now();
      unionid = null;
      console.log('[DEV MODE] 使用开发模式登录');

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
      console.log('[LOGIN] 新用户注册:', openid);
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
    console.error('[LOGIN ERROR]', { message: err.message, stack: err.stack });
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
    console.error('Update profile error:', err);
    res.status(500).json(error(50001, '更新失败'));
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
