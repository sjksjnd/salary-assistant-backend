const { queryInsert } = require('../config/database');
const calcService = require('./calcService');
const legalService = require('./legalService');
const pkulawService = require('./pkulawService');
const logger = require('../utils/logger');

const SCENARIO_KEYWORDS = {
  severance_pay: '经济补偿 劳动合同法第47条',
  unlawful_termination: '违法解除 赔偿金 劳动合同法第87条',
  no_written_contract: '未签订劳动合同 双倍工资 劳动合同法第82条',
};

const QUESTIONS = [
  {
    id: 'Q1',
    question: '你是否已经离职？',
    type: 'choice',
    options: [
      { value: 'yes', label: '是，已经离职' },
      { value: 'no', label: '否，还在上班' },
    ],
  },
  {
    id: 'Q2',
    question: '你在这家公司工作了几年？',
    type: 'number',
    min: 0,
    max: 40,
    unit: '年',
  },
  {
    id: 'Q3',
    question: '你每个月工资多少？（税前）',
    type: 'number',
    min: 0,
    max: 100000,
    unit: '元',
  },
  {
    id: 'Q4',
    question: '是否签订了劳动合同？',
    type: 'choice',
    options: [
      { value: 'yes', label: '是，已签订' },
      { value: 'no', label: '否，未签订' },
      { value: 'unknown', label: '不清楚' },
    ],
  },
  {
    id: 'Q5',
    question: '离职原因是什么？',
    type: 'choice',
    options: [
      { value: 'fired', label: '公司单方面辞退' },
      { value: 'resigned', label: '自己主动辞职' },
      { value: 'expired', label: '合同到期未续签' },
      { value: 'forced', label: '被迫离职（公司违法）' },
    ],
  },
];

const EVIDENCE_LIST = [
  { id: 1, name: '劳动合同', icon: '📄', important: 'critical' },
  { id: 2, name: '工资流水', icon: '💰', important: 'critical' },
  { id: 3, name: '考勤记录', icon: '📅', important: 'high' },
  { id: 4, name: '工作证', icon: '🆔', important: 'medium' },
  { id: 5, name: '社保缴纳记录', icon: '📋', important: 'high' },
  { id: 6, name: '解除劳动关系证明', icon: '✉️', important: 'critical' },
];

async function getQuestions() {
  return QUESTIONS;
}

async function calculateCompensation(answers, userId) {
  const { Q1, Q2, Q3, Q4, Q5 } = answers;

  const workYears = parseFloat(Q2) || 0;
  const monthlySalary = parseFloat(Q3) || 0;

  let compensation = {
    total: 0,
    items: [],
    evidence: [],
    legalArticles: [],
  };
  const scenarios = [];

  if (Q1 === 'yes') {
    if (Q5 === 'fired' || Q5 === 'expired' || Q5 === 'forced') {
      const severance = await calcService.calcSeverance(workYears, monthlySalary, '广东');
      compensation.items.push({
        name: '经济补偿金',
        amount: severance.amount,
        description: `工作 ${severance.cappedYears} 年 × ${severance.cappedSalary} 元/月`,
      });
      compensation.total += severance.amount;
      scenarios.push('severance_pay');
    }

    if (Q5 === 'forced') {
      const doubleSalary = monthlySalary * workYears;
      compensation.items.push({
        name: '违法解除赔偿金',
        amount: doubleSalary,
        description: '公司违法解除，应支付双倍经济补偿金',
      });
      compensation.total += doubleSalary;
      scenarios.push('unlawful_termination');
    }
  }

  if (Q4 === 'no') {
    const months = Math.min(workYears * 12, 11);
    const doubleSalary = monthlySalary * months;
    compensation.items.push({
      name: '未签合同双倍工资',
      amount: doubleSalary,
      description: `未签合同 ${months} 个月 × ${monthlySalary} 元`,
    });
    compensation.total += doubleSalary;
    scenarios.push('no_written_contract');
  }

  try {
    if (pkulawService.isEnabled() && scenarios.length > 0) {
      const scenarioKeywords = scenarios
        .map(s => SCENARIO_KEYWORDS[s] || s)
        .join(' ');

      try {
        const articles = await pkulawService.keywordSearch(scenarioKeywords, Math.min(scenarios.length * 2, 10), userId);
        compensation.legalArticles = articles.map(article => ({
          ...article,
          fromPkulaw: true
        }));
      } catch (err) {
        logger.warn('PKULaw search failed for compensation:', err.message);
        compensation.legalArticles = await legalService.getSourcesForScenarios(scenarios, userId);
      }

      if (compensation.legalArticles.length === 0) {
        compensation.legalArticles = await legalService.getSourcesForScenarios(scenarios, userId);
      }
    } else {
      compensation.legalArticles = await legalService.getSourcesForScenarios(scenarios, userId);
    }
  } catch (err) {
    logger.warn('[compensationService] legal lookup failed:', err.message);
    compensation.legalArticles = [];
  }

  compensation.total = Math.round(compensation.total * 100) / 100;
  compensation.evidence = EVIDENCE_LIST;

  return compensation;
}

async function saveCompensationRecord(userId, answers, result) {
  const resultText = `补偿金额约 ${result.total} 元`;
  await queryInsert(
    'INSERT INTO detection_records (user_id, type, description, result_text, result_detail) VALUES (?, ?, ?, ?, ?)',
    [userId, 'compensation', '补偿估算', resultText, JSON.stringify({ answers, result })]
  );
}

module.exports = {
  QUESTIONS,
  EVIDENCE_LIST,
  getQuestions,
  calculateCompensation,
  saveCompensationRecord,
};
