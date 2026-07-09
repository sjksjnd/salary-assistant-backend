const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

// Map camelCase settings keys (frontend) to snake_case (DB columns).
// Only fields with a backend column are mapped; others stay local-only.
const SETTINGS_KEY_MAP = {
  fontScale: 'font_scale',
  notifyEnabled: 'reminder_enabled',
  notifyTime: 'reminder_time',
  hourlyRate: 'hourly_rate',
  nightRate: 'night_rate',
  standardHours: 'standard_hours',
  factoryName: 'factory_name',
  factoryCity: 'factory_city',
};

function mapSettingsToSnakeCase(body) {
  const mapped = {};
  for (const [camel, snake] of Object.entries(SETTINGS_KEY_MAP)) {
    if (body[camel] !== undefined) mapped[snake] = body[camel];
    if (body[snake] !== undefined) mapped[snake] = body[snake];
  }
  return mapped;
}

function mapSettingsToCamelCase(settings) {
  if (!settings) return {};
  const result = {};
  for (const [camel, snake] of Object.entries(SETTINGS_KEY_MAP)) {
    if (settings[snake] !== undefined) result[camel] = settings[snake];
  }
  return result;
}

router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await userService.getUserById(req.userId);
    const settings = await userService.getUserSettings(req.userId);

    if (!user) {
      return res.status(404).json(error(40401, '用户不存在'));
    }

    res.json(success({
      user,
      settings: mapSettingsToCamelCase(settings),
    }));
  } catch (err) {
    logger.error('Users API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.put('/profile', authenticate, async (req, res) => {
  try {
    const { nickname, phone } = req.body;
    const user = await userService.updateUser(req.userId, { nickname, phone });
    
    if (!user) {
      return res.status(404).json(error(40401, '用户不存在'));
    }

    res.json(success({ nickname: user.nickname, phone: user.phone }, '更新成功'));
  } catch (err) {
    logger.error('Users API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.get('/settings', authenticate, async (req, res) => {
  try {
    const settings = await userService.getUserSettings(req.userId);
    res.json(success(mapSettingsToCamelCase(settings)));
  } catch (err) {
    logger.error('Users API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.put('/settings', authenticate, async (req, res) => {
  try {
    const mapped = mapSettingsToSnakeCase(req.body);
    if (Object.keys(mapped).length === 0) {
      return res.status(400).json(error(40001, '没有可更新的设置字段'));
    }
    const settings = await userService.updateUserSettings(req.userId, mapped);

    if (!settings) {
      return res.status(404).json(error(40401, '设置不存在'));
    }

    res.json(success(mapSettingsToCamelCase(settings), '设置更新成功'));
  } catch (err) {
    logger.error('Users API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.post('/agreements', authenticate, async (req, res) => {
  try {
    const { agreementType, version } = req.body;
    await userService.acceptAgreement(req.userId, agreementType, version);
    res.json(success(null, '已同意协议'));
  } catch (err) {
    logger.error('Users API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.get('/agreements', authenticate, async (req, res) => {
  try {
    const hasPrivacy = await userService.hasAcceptedAgreement(req.userId, 'privacy');
    const hasUserAgreement = await userService.hasAcceptedAgreement(req.userId, 'user_agreement');
    res.json(success({ hasPrivacy, hasUserAgreement }));
  } catch (err) {
    logger.error('Users API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.get('/export', authenticate, async (req, res) => {
  try {
    const data = await userService.exportUserData(req.userId);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="user_data_${req.userId}.json"`);
    res.json(success(data));
  } catch (err) {
    logger.error('Users API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.delete('/me', authenticate, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      await require('../middleware/auth').invalidateToken(token);
    }
    try { await require('../config/redis').del(`session:${req.userId}`); } catch (e) {}
    
    await userService.deleteUser(req.userId);
    res.json(success(null, '账号已注销'));
  } catch (err) {
    logger.error('Users API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

module.exports = router;
