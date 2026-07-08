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
    // Return value directly so the frontend can read data.text / data.content / data.value.
    // Keep `key` in the response for metadata but make `value` a top-level field too.
    res.json(success({ key, value, text: value, content: value }));
  } catch (err) {
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const configs = await configService.getAllConfigs();
    res.json(success(configs));
  } catch (err) {
    logger.error('Config API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
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
    logger.error('Config API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
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
    logger.error('Config API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

module.exports = router;
