const express = require('express');
const router = express.Router();
const contractService = require('../services/contractService');
const { authenticate } = require('../middleware/auth');
const { rateLimiters } = require('../middleware/rateLimiter');
const { success, error } = require('../utils/response');

router.post('/ocr', authenticate, rateLimiters.contract, async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json(error(40001, '请上传图片'));
    }

    const ocrResult = await contractService.ocrImage(image);
    
    if (!ocrResult.success) {
      return res.status(500).json(error(50001, 'OCR识别失败'));
    }

    res.json(success({ text: ocrResult.text }, '识别成功'));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.post('/analyze', authenticate, rateLimiters.contract, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json(error(40001, '请提供合同文本'));
    }

    const analysis = await contractService.analyzeContract(text);

    await contractService.saveDetectionRecord(
      req.userId,
      'contract',
      '合同体检',
      `发现 ${analysis.summary.totalIssues} 个问题`,
      analysis
    );

    res.json(success(analysis));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.get('/records', authenticate, async (req, res) => {
  try {
    const { type } = req.query;
    const records = await contractService.getDetectionRecords(req.userId, type);
    res.json(success(records));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.delete('/records/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await contractService.deleteDetectionRecord(req.userId, id);
    if (!deleted) return res.status(404).json(error(40401, '记录不存在'));
    res.json(success(null, '删除成功'));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

module.exports = router;
