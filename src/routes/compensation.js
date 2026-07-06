const express = require('express');
const router = express.Router();
const compensationService = require('../services/compensationService');
const { authenticate } = require('../middleware/auth');
const { rateLimiters } = require('../middleware/rateLimiter');
const { success, error } = require('../utils/response');

router.get('/questions', authenticate, async (req, res) => {
  try {
    const questions = await compensationService.getQuestions();
    res.json(success(questions));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.post('/calculate', authenticate, rateLimiters.calc, async (req, res) => {
  try {
    const { answers } = req.body;
    if (!answers) {
      return res.status(400).json(error(40001, '请提供答案'));
    }

    const result = await compensationService.calculateCompensation(answers);
    await compensationService.saveCompensationRecord(req.userId, answers, result);

    res.json(success(result));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.get('/evidence', authenticate, async (req, res) => {
  try {
    res.json(success(compensationService.EVIDENCE_LIST));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

module.exports = router;
