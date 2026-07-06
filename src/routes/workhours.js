const express = require('express');
const router = express.Router();
const workhourService = require('../services/workhourService');
const calcService = require('../services/calcService');
const userService = require('../services/userService');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../utils/response');

router.post('/', authenticate, async (req, res) => {
  try {
    const { recordDate, hours, shift, payAmount } = req.body;
    
    if (!recordDate || hours === undefined) {
      return res.status(400).json(error(40001, '参数错误'));
    }

    const settings = await userService.getUserSettings(req.userId);
    let calculatedPayAmount = payAmount;
    
    if (!payAmount && settings) {
      calculatedPayAmount = await calcService.calcDailySalary(
        settings.hourly_rate || 25,
        settings.standard_hours || 8,
        hours,
        shift || 'day'
      );
    }

    const record = await workhourService.saveWorkhour(req.userId, recordDate, hours, shift || 'day', calculatedPayAmount);
    res.json(success(record, '保存成功'));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.get('/:recordDate', authenticate, async (req, res) => {
  try {
    const { recordDate } = req.params;
    const record = await workhourService.getWorkhour(req.userId, recordDate);
    
    if (!record) {
      return res.status(404).json(error(40401, '记录不存在'));
    }

    res.json(success(record));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.get('/month/:month', authenticate, async (req, res) => {
  try {
    const { month } = req.params;
    const records = await workhourService.getWorkhoursByMonth(req.userId, month);
    const summary = await workhourService.getMonthlySummary(req.userId, month);
    
    res.json(success({ records, summary }));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.delete('/:recordDate', authenticate, async (req, res) => {
  try {
    const { recordDate } = req.params;
    const deleted = await workhourService.deleteWorkhour(req.userId, recordDate);
    
    if (!deleted) {
      return res.status(404).json(error(40401, '记录不存在'));
    }

    res.json(success(null, '删除成功'));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

router.post('/batch', authenticate, async (req, res) => {
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records)) {
      return res.status(400).json(error(40001, '参数错误'));
    }

    const results = await workhourService.batchSaveWorkhours(req.userId, records);
    res.json(success(results, '批量保存成功'));
  } catch (err) {
    res.status(500).json(error(50001, err.message));
  }
});

module.exports = router;
