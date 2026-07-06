const express = require('express');
const router = express.Router();
const legalService = require('../services/legalService');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');

router.get('/articles', authenticate, async (req, res) => {
  try {
    const { category, scenario, keyword } = req.query;
    let articles = [];

    if (scenario) {
      articles = await legalService.getArticlesByScenarios(scenario.split(','));
    } else if (category) {
      articles = await legalService.getArticlesByCategory(category);
    } else if (keyword) {
      articles = await legalService.searchArticles(keyword);
    } else {
      return res.status(400).json(error(40001, '请提供 category、scenario 或 keyword 参数'));
    }

    res.json(success(articles));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
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
    res.status(500).json(error(50001, err.message));
  }
});

router.get('/scenarios', authenticate, async (req, res) => {
  try {
    res.json(success(legalService.SCENARIO_SOURCE_MAP));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

module.exports = router;
