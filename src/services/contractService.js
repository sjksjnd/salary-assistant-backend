const axios = require('axios');
const { query, queryInsert } = require('../config/database');
const configService = require('./configService');
const legalService = require('./legalService');
const config = require('../config');

async function ocrImage(imageBase64) {
  if (config.isDev()) {
    const sampleText = await configService.getConfig('contract_sample');
    return {
      success: true,
      text: sampleText || '劳动合同书\n\n甲方（用人单位）：XX电子科技有限公司\n乙方（劳动者）：张三\n\n根据《中华人民共和国劳动法》、《中华人民共和国劳动合同法》等法律法规，甲乙双方经平等协商一致，签订本合同。\n\n一、合同期限\n本合同为固定期限劳动合同，期限自2026年1月1日起至2028年12月31日止，试用期为六个月。\n\n二、工作内容\n乙方同意在甲方生产部担任操作工岗位，具体工作内容由甲方安排。\n\n三、工作时间和休息休假\n甲方实行标准工时制度，每日工作8小时，每周工作5天。\n\n四、劳动报酬\n乙方月工资为5000元，试用期工资为4000元。工资按月支付，每月15日发放上月工资。\n\n五、社会保险\n甲方依法为乙方缴纳社会保险。\n\n六、劳动保护和劳动条件\n甲方为乙方提供必要的劳动保护用品。\n\n七、合同解除\n双方协商一致可解除合同。\n\n八、其他\n本合同一式两份，甲乙双方各执一份。\n\n甲方（盖章）：XX电子科技有限公司\n乙方（签字）：张三\n日期：2026年1月1日',
    };
  }

  try {
    const response = await axios.post(
      `https://ocr.tencentcloudapi.com/?Action=GeneralBasicOCR`,
      {
        ImageBase64: imageBase64,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const text = response.data.Response.TextDetections
      .map(item => item.DetectedText)
      .join('\n');

    return { success: true, text };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function analyzeContract(text) {
  const rules = await configService.getConfig('contract_rules') || [];
  const issues = [];
  const scenarios = [];

  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      if (text.includes(pattern)) {
        issues.push({
          type: rule.type,
          severity: rule.severity,
          scenario: rule.scenario,
          law: rule.law,
          lawText: rule.lawText,
          suggestion: rule.suggestion,
          matchedPattern: pattern,
        });
        if (rule.scenario) scenarios.push(rule.scenario);
        break;
      }
    }
  }

  // Cross-check rule engine conclusions against the legal knowledge base.
  let legalArticles = [];
  try {
    legalArticles = await legalService.getSourcesForScenarios(scenarios);
  } catch (err) {
    // Non-fatal: keep rule engine results if knowledge base lookup fails.
    console.warn('[contractService] legal knowledge base lookup failed:', err.message);
  }

  const summary = {
    totalIssues: issues.length,
    criticalCount: issues.filter(i => i.severity === 'critical').length,
    highCount: issues.filter(i => i.severity === 'high').length,
    mediumCount: issues.filter(i => i.severity === 'medium').length,
  };

  return { summary, issues, legalArticles };
}

async function saveDetectionRecord(userId, type, description, resultText, resultDetail) {
  const result = await queryInsert(
    'INSERT INTO detection_records (user_id, type, description, result_text, result_detail) VALUES (?, ?, ?, ?, ?)',
    [userId, type, description, resultText, JSON.stringify(resultDetail)]
  );
  const rows = await query('SELECT * FROM detection_records WHERE id = ?', [result.insertId]);
  return rows[0];
}

async function getDetectionRecords(userId, type) {
  let queryText = 'SELECT * FROM detection_records WHERE user_id = ?';
  let params = [userId];

  if (type) {
    queryText += ' AND type = ?';
    params.push(type);
  }

  queryText += ' ORDER BY created_at DESC';

  const rows = await query(queryText, params);
  return rows;
}

async function deleteDetectionRecord(userId, id) {
  const result = await query(
    'DELETE FROM detection_records WHERE user_id = ? AND id = ?',
    [userId, id]
  );
  return result.affectedRows > 0;
}

module.exports = {
  ocrImage,
  analyzeContract,
  saveDetectionRecord,
  getDetectionRecords,
  deleteDetectionRecord,
};
