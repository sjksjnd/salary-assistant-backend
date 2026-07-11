function normalizeDetectInput(input) {
  const type = input.type || 'labor';
  const content = input.content || '';
  const fileUrl = input.fileUrl || '';
  return { type, content, fileUrl };
}

function validateDetectInput(content, fileUrl) {
  if (!content && !fileUrl) {
    return { valid: false, message: '请提供合同内容' };
  }
  return { valid: true };
}

function performChecks(type, content) {
  const issues = [];
  const text = content || '';

  const checks = [
    {
      keyword: '试用期',
      pattern: /试用期.{0,10}(?:超过|大于|长于)\s*\d+\s*个月/,
      issue: '试用期可能超过法定期限',
      level: 'high',
      suggestion: '劳动合同期限不满3年的，试用期不得超过2个月；3年以上的，试用期不得超过6个月。',
    },
    {
      keyword: '工资',
      pattern: /(?:工资|薪资|薪酬).{0,20}(?:次月|月底|次月底).{0,10}发放/,
      issue: '工资发放周期可能过长',
      level: 'medium',
      suggestion: '工资应当按月支付，且支付日期不应晚于次月15日。',
    },
    {
      keyword: '加班费',
      pattern: /(?:加班费|加班工资).{0,20}(?:不含|不计|不包含)/,
      issue: '可能存在加班费约定不明确',
      level: 'high',
      suggestion: '加班费应按法定标准支付：工作日1.5倍，休息日2倍，法定节假日3倍。',
    },
    {
      keyword: '押金',
      pattern: /(?:押金|保证金|扣押|扣留).{0,10}(?:工资|证件|身份证)/,
      issue: '押金或扣押条款需重点核对',
      level: 'high',
      suggestion: '用人单位不得扣押劳动者的身份证、工资等，不得以任何形式收取押金。',
    },
    {
      keyword: '违约金',
      pattern: /违约金.{0,30}(?:提前|离职|辞职|解除)/,
      issue: '可能存在不合理的违约金条款',
      level: 'high',
      suggestion: '除培训服务期和竞业限制外，用人单位不得与劳动者约定违约金。',
    },
    {
      keyword: '社保',
      pattern: /(?:不缴|不交|自愿放弃).{0,10}(?:社保|保险|公积金)/,
      issue: '社保缴纳约定需重点核对',
      level: 'high',
      suggestion: '缴纳社会保险是用人单位的法定义务，不能通过约定免除。',
    },
    {
      keyword: '工时',
      pattern: /(?:每周|每月).{0,10}工作.{0,10}(?:小时|h)/,
      issue: '工时可能超出法定标准',
      level: 'medium',
      suggestion: '国家实行劳动者每日工作时间不超过8小时、平均每周工作时间不超过44小时的工时制度。',
    },
    {
      keyword: '合同期限',
      pattern: /连续.{0,10}签订.{0,10}(?:二次|两次|2次)/,
      issue: '可能存在连续签订固定期限合同的问题',
      level: 'medium',
      suggestion: '连续订立二次固定期限劳动合同后，劳动者有权要求订立无固定期限劳动合同。',
    },
  ];

  for (const check of checks) {
    if (check.pattern.test(text)) {
      issues.push({
        type: check.keyword,
        issue: check.issue,
        level: check.level,
        suggestion: check.suggestion,
      });
    }
  }

  if (!/合同期限|固定期限|无固定期限|以完成一定工作任务/.test(text) && text.length > 100) {
    issues.push({
      type: '合同期限',
      issue: '未明确合同期限类型',
      level: 'medium',
      suggestion: '劳动合同分为固定期限、无固定期限和以完成一定工作任务为期限三种，应明确约定。',
    });
  }

  if (!/劳动报酬|工资|薪资|薪酬/.test(text) && text.length > 100) {
    issues.push({
      type: '劳动报酬',
      issue: '未明确约定劳动报酬',
      level: 'high',
      suggestion: '劳动合同必须明确约定工资标准、支付方式和支付时间。',
    });
  }

  return issues;
}

function calculateRiskLevel(issuesLength) {
  if (issuesLength === 0) return 'safe';
  if (issuesLength <= 3) return 'medium';
  return 'high';
}

function generateSummary(issuesLength) {
  if (issuesLength === 0) return '未发现明显需核对事项';
  return `发现 ${issuesLength} 个待核对事项`;
}

function generateResultText(issuesLength) {
  return `发现 ${issuesLength} 个待核对事项`;
}

function formatDescription(content) {
  if (!content) return '';
  return content.substring(0, 50) + (content.length > 50 ? '...' : '');
}

function parseResultDetail(resultDetail) {
  try {
    return JSON.parse(resultDetail || '[]');
  } catch (e) {
    return [];
  }
}

function formatRecordList(record) {
  return {
    id: record._id,
    type: record.type,
    description: record.description,
    resultText: record.resultText,
    createdAt: record.createdAt,
  };
}

function formatRecordDetail(record) {
  return {
    id: record._id,
    type: record.type,
    description: record.description,
    resultText: record.resultText,
    resultDetail: parseResultDetail(record.resultDetail),
    createdAt: record.createdAt,
  };
}

function normalizeRecordsInput(input) {
  const type = input.type;
  const page = input.page || 1;
  const pageSize = Math.min(input.pageSize || 20, 50);
  const skip = (page - 1) * pageSize;
  return { type, page, pageSize, skip, limit: pageSize };
}

function inferScenariosFromIssues(issues) {
  const scenarios = new Set();
  for (const issue of issues || []) {
    const text = [issue.type, issue.issue, issue.suggestion].filter(Boolean).join(' ');
    if (/试用期/.test(text)) scenarios.add('probation_over_limit');
    if (/工资|薪资|薪酬|劳动报酬/.test(text)) scenarios.add('wage_clause');
    if (/加班|工时|工作时间/.test(text)) scenarios.add('overtime_no_pay');
    if (/押金|保证金|扣押|扣留|违约金/.test(text)) scenarios.add('illegal_penalty');
    if (/社保|保险|公积金/.test(text)) scenarios.add('no_social_security');
    if (/合同期限|固定期限|无固定期限/.test(text)) scenarios.add('contract_term');
  }
  return Array.from(scenarios);
}

module.exports = {
  normalizeDetectInput,
  validateDetectInput,
  performChecks,
  calculateRiskLevel,
  generateSummary,
  generateResultText,
  formatDescription,
  parseResultDetail,
  formatRecordList,
  formatRecordDetail,
  normalizeRecordsInput,
  inferScenariosFromIssues,
};
