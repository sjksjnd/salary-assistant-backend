const CONTRACT_SAMPLE = [
  '劳动合同',
  '',
  '甲方（用人单位）：某某制造有限公司',
  '乙方（劳动者）：张三',
  '',
  '一、合同期限',
  '本合同期限为一年，自2026年1月1日起至2026年12月31日止，试用期为3个月。',
  '',
  '二、工作内容和地点',
  '乙方从事生产操作岗位工作，工作地点为甲方厂区。甲方可根据生产经营需要调整乙方岗位和工作地点。',
  '',
  '三、工作时间',
  '甲方实行综合工时制度，乙方每周工作六天，每天工作10小时。因生产需要加班的，乙方应服从安排。',
  '',
  '四、劳动报酬',
  '乙方月工资为4000元，工资于次月底前发放。甲方可从乙方工资中扣除住宿费、工服费、管理费及其他费用。',
  '',
  '五、社会保险',
  '乙方自愿放弃缴纳社会保险，甲方以现金补贴方式支付。',
  '',
  '六、违约责任',
  '乙方提前离职的，应向甲方支付违约金3000元。甲方有权扣留乙方最后一个月工资作为保证金。',
  '',
  '七、其他',
  '本合同未尽事宜，双方协商解决。'
].join('\n');

const DEFAULT_CONFIGS = {
  contract_sample: {
    text: CONTRACT_SAMPLE,
    content: CONTRACT_SAMPLE,
  },
  app_info: {
    name: '薪工记',
    version: '1.0.0',
    description: '工友工资工时记录与合同工资自查工具',
  },
  contact: {
    hotline: '12333',
    hotlineName: '劳动保障热线',
    workHours: '工作日 9:00-17:00',
  },
  agreement_user: {
    version: '1.0',
    title: '用户服务协议',
    content: '欢迎使用工友守护-薪工记。本应用用于工时记录、工资核对、合同条款自查和常见规则信息整理。应用内容仅供记录核对参考，不替代专业机构意见，也不代办任何争议处理事项。',
  },
  agreement_privacy: {
    version: '1.0',
    title: '隐私政策',
    content: '我们会在提供服务所必需的范围内处理登录信息、工时工资记录和用户主动填写的信息，并采取合理措施保护数据安全。',
  },
  deduction_categories: ['五险一金', '个人所得税', '伙食费', '住宿费', '工服费', '罚款', '其他扣款'],
  expense_categories: ['生活费', '房租', '交通费', '医疗费', '通讯费', '其他开销'],
};

function getDefaultConfig(key) {
  if (!key || !Object.prototype.hasOwnProperty.call(DEFAULT_CONFIGS, key)) {
    return null;
  }
  return DEFAULT_CONFIGS[key];
}

function getAllDefaultConfigs() {
  return { ...DEFAULT_CONFIGS };
}

module.exports = {
  CONTRACT_SAMPLE,
  DEFAULT_CONFIGS,
  getDefaultConfig,
  getAllDefaultConfigs,
};
