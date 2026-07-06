const express = require('express');
const router = express.Router();
const configService = require('../services/configService');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');

router.get('/:key', authenticate, async (req, res) => {
  try {
    const { key } = req.params;
    const value = await configService.getConfig(key);
    if (value === null) {
      return res.status(404).json(error(40401, '配置项不存在'));
    }
    res.json(success({ key, value }));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const configs = await configService.getAllConfigs();
    res.json(success(configs));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { key, value, description } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json(error(40001, '参数错误'));
    }
    await configService.setConfig(key, value, description);
    res.json(success({ key }, '配置更新成功'));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.delete('/:key', authenticate, async (req, res) => {
  try {
    const { key } = req.params;
    const deleted = await configService.deleteConfig(key);
    if (!deleted) {
      return res.status(404).json(error(40401, '配置项不存在'));
    }
    res.json(success(null, '配置删除成功'));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

module.exports = router;
