const express = require('express');
const router = express.Router();
const legalService = require('../services/legalService');
const { authenticate } = require('../middleware/auth');
const { rateLimiters } = require('../middleware/rateLimiter');
const { success, error } = require('../utils/response');

router.get('/articles', authenticate, async (req, res) => {
  try {
    const { category, scenario, keyword, q, limit } = req.query;
    let articles = [];

    if (q) {
      articles = await legalService.smartSearch(q, parseInt(limit) || 10, req.userId);
    } else if (scenario) {
      articles = await legalService.getSourcesForScenarios(scenario.split(','), req.userId);
    } else if (category) {
      articles = await legalService.getArticlesByCategory(category);
    } else if (keyword) {
      articles = await legalService.searchArticles(keyword, limit);
    } else {
      return res.status(400).json(error(40001, '请提供 category、scenario、keyword 或 q 参数'));
    }

    res.json(success(articles));
  } catch (err) {
    logger.error('Legal articles error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.get('/articles/:source', authenticate, async (req, res) => {
  try {
    const article = await legalService.getArticleBySource(decodeURIComponent(req.params.source));
    if (!article) {
      return res.status(404).json(error(40401, '法条不存在'));
    }
    res.json(success(article));
  } catch (err) {
    logger.error('Legal articles error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.get('/scenarios', authenticate, async (req, res) => {
  try {
    res.json(success(legalService.SCENARIO_SOURCE_MAP));
  } catch (err) {
    logger.error('Legal articles error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.get('/categories', authenticate, async (req, res) => {
  try {
    const categories = await legalService.getAllCategories();
    res.json(success(categories));
  } catch (err) {
    logger.error('Legal articles error:', err);
    res.status(500).json(error(50001, '服务器内部错误'));
  }
});

router.post('/ask', authenticate, rateLimiters.contract, async (req, res) => {
  try {
    const { question, limit } = req.body;
    
    if (!question || !question.trim()) {
      return res.status(400).json(error(40001, '请输入问题'));
    }

    const results = await legalService.smartSearch(question, parseInt(limit) || 5, req.userId);

    const topResult = results.length > 0 ? results[0] : null;
    const answer = topResult ? {
      title: topResult.title,
      source: topResult.source,
      content: topResult.originalText,
      quickAnswer: topResult.quickAnswer,
      category: topResult.category,
      categoryLabel: topResult.categoryLabel,
      matchedKeywords: topResult.matchedKeywords
    } : null;

    res.json(success({
      answer,
      relatedArticles: results,
      totalResults: results.length
    }));
  } catch (err) {
    logger.error('Legal ask error:', err);
    res.status(500).json(error(50001, '查询失败，请稍后重试'));
  }
});

module.exports = router;
