const express = require('express');
const router = express.Router();
const compensationService = require('../services/compensationService');
const { authenticate } = require('../middleware/auth');
const { rateLimiters } = require('../middleware/rateLimiter');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

// Questions endpoint does not require auth (so users can see the form)
router.get('/questions', async (req, res) => {
  try {
    const questions = await compensationService.getQuestions();
    res.json(success(questions));
  } catch (err) {
    logger.error('Compensation API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.post('/calculate', authenticate, rateLimiters.calc, async (req, res) => {
  try {
    const { answers } = req.body;
    if (!answers) {
      return res.status(400).json(error(40001, '请提供答案'));
    }

    const result = await compensationService.calculateCompensation(answers, req.userId);
    await compensationService.saveCompensationRecord(req.userId, answers, result);

    res.json(success(result));
  } catch (err) {
    logger.error('Compensation API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.get('/evidence', authenticate, async (req, res) => {
  try {
    res.json(success(compensationService.EVIDENCE_LIST));
  } catch (err) {
    logger.error('Compensation API error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

module.exports = router;
