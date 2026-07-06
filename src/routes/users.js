const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');

router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await userService.getUserById(req.userId);
    const settings = await userService.getUserSettings(req.userId);
    
    if (!user) {
      return res.status(404).json(error(40401, '用户不存在'));
    }

    res.json(success({
      user,
      settings: settings || {},
    }));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
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
    res.status(500).json(error(50001, err.message));
  }
});

router.get('/settings', authenticate, async (req, res) => {
  try {
    const settings = await userService.getUserSettings(req.userId);
    res.json(success(settings || {}));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.put('/settings', authenticate, async (req, res) => {
  try {
    const settings = await userService.updateUserSettings(req.userId, req.body);
    
    if (!settings) {
      return res.status(404).json(error(40401, '设置不存在'));
    }

    res.json(success(settings, '设置更新成功'));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.post('/agreements', authenticate, async (req, res) => {
  try {
    const { agreementType, version } = req.body;
    await userService.acceptAgreement(req.userId, agreementType, version);
    res.json(success(null, '已同意协议'));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.get('/agreements', authenticate, async (req, res) => {
  try {
    const hasPrivacy = await userService.hasAcceptedAgreement(req.userId, 'privacy');
    const hasUserAgreement = await userService.hasAcceptedAgreement(req.userId, 'user_agreement');
    res.json(success({ hasPrivacy, hasUserAgreement }));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.get('/export', authenticate, async (req, res) => {
  try {
    const data = await userService.exportUserData(req.userId);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="user_data_${req.userId}.json"`);
    res.json(success(data));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.delete('/me', authenticate, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      await require('../middleware/auth').invalidateToken(token);
    }
    
    await userService.deleteUser(req.userId);
    res.json(success(null, '账号已注销'));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

module.exports = router;
