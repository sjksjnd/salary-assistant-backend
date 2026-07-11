function normalizeCalculateInput(input) {
  return {
    type: input.type || 'salary',
    monthlySalary: Number(input.monthlySalary) || 0,
    workYears: Number(input.workYears) || 0,
    workMonths: Number(input.workMonths) || 0,
    dailySalary: Number(input.dailySalary) || 0,
    overtimeHours: Number(input.overtimeHours) || 0,
    overtimeType: input.overtimeType || 'normal',
    isTerminated: input.isTerminated || false,
    terminationReason: input.terminationReason || 'other',
    noticeGiven: input.noticeGiven !== false,
    hasContract: input.hasContract !== false,
    contractMonths: Number(input.contractMonths) || 0,
    isProbation: input.isProbation || false,
    monthlyOvertimeHours: Number(input.monthlyOvertimeHours) || 0,
  };
}

function calculateOvertimePay(salary, dailyWage, overtime, overtimeType) {
  const baseDays = 21.75;
  const daily = dailyWage || (salary / baseDays);
  const hourly = daily / 8;
  let overtimePay = 0;
  let detail = null;

  if (overtime <= 0) return { overtimePay: 0, detail: null };

  if (overtimeType === 'weekday') {
    overtimePay = hourly * overtime * 1.5;
    detail = {
      item: '工作日加班费',
      formula: `${overtime}小时 × ${hourly.toFixed(2)}元/小时 × 1.5倍`,
      amount: Math.round(overtimePay * 100) / 100,
      basis: '《劳动法》第44条：工作日加班支付150%工资',
    };
  } else if (overtimeType === 'weekend') {
    overtimePay = hourly * overtime * 2;
    detail = {
      item: '休息日加班费',
      formula: `${overtime}小时 × ${hourly.toFixed(2)}元/小时 × 2倍`,
      amount: Math.round(overtimePay * 100) / 100,
      basis: '《劳动法》第44条：休息日加班支付200%工资',
    };
  } else if (overtimeType === 'holiday') {
    overtimePay = hourly * overtime * 3;
    detail = {
      item: '法定节假日加班费',
      formula: `${overtime}小时 × ${hourly.toFixed(2)}元/小时 × 3倍`,
      amount: Math.round(overtimePay * 100) / 100,
      basis: '《劳动法》第44条：法定假日加班支付300%工资',
    };
  } else {
    overtimePay = hourly * overtime * 1.5;
    detail = {
      item: '加班费（按工作日计算）',
      formula: `${overtime}小时 × ${hourly.toFixed(2)}元/小时 × 1.5倍`,
      amount: Math.round(overtimePay * 100) / 100,
      basis: '《劳动法》第44条',
    };
  }

  return { overtimePay, detail };
}

function calculateSeverance(salary, years, months, isTerminated, terminationReason, noticeGiven) {
  const details = [];
  let total = 0;

  if (!isTerminated) return { total, details };

  const totalMonths = years * 12 + months;
  let compensationMonths = 0;

  if (totalMonths < 6) {
    compensationMonths = 0.5;
  } else if (totalMonths < 12) {
    compensationMonths = 1;
  } else {
    compensationMonths = years + (months >= 6 ? 1 : 0);
  }

  let severancePay = salary * compensationMonths;

  if (terminationReason === 'illegal') {
    severancePay *= 2;
    details.push({
      item: '解除情形参考项（2倍口径）',
      formula: `${salary}元 × ${compensationMonths}个月 × 2倍`,
      amount: Math.round(severancePay * 100) / 100,
      basis: '《劳动合同法》第87条相关规则：特定解除情形可能涉及二倍经济补偿口径',
    });
  } else {
    details.push({
      item: '经济补偿参考项（N）',
      formula: `${salary}元 × ${compensationMonths}个月`,
      amount: Math.round(severancePay * 100) / 100,
      basis: '《劳动合同法》第47条：每满一年支付一个月工资',
    });
  }
  total += severancePay;

  if (!noticeGiven && terminationReason !== 'illegal') {
    const noticePay = salary;
    details.push({
      item: '代通知参考项',
      formula: `${salary}元 × 1个月`,
      amount: noticePay,
      basis: '《劳动合同法》第40条：未提前30日通知支付1个月工资',
    });
    total += noticePay;
  }

  return { total, details };
}

function calculateContractCompensation(salary, hasContract, contractMonths) {
  const details = [];
  let total = 0;

  if (hasContract) return { total, details };

  const payMonths = Math.max(0, Math.min(contractMonths - 1, 11));
  const doubleWage = salary * payMonths;
  if (payMonths > 0) {
    details.push({
      item: '未签劳动合同参考项',
      formula: `${salary}元 × ${payMonths}个月`,
      amount: Math.round(doubleWage * 100) / 100,
      basis: '《劳动合同法》第82条：未签合同支付二倍工资，最多11个月',
    });
    total += doubleWage;
  }

  return { total, details };
}

function calculateMonthlyOvertimeCompensation(salary, dailyWage, monthlyOvertime) {
  const details = [];
  let total = 0;

  if (monthlyOvertime <= 36) return { total, details };

  const baseDays = 21.75;
  const hourly = (dailyWage || (salary / baseDays)) / 8;
  const excessHours = monthlyOvertime - 36;
  const overtimeCompensation = hourly * excessHours * 1.5;
  details.push({
    item: '超时加班参考项',
    formula: `${excessHours}小时 × ${hourly.toFixed(2)}元/小时 × 1.5倍`,
    amount: Math.round(overtimeCompensation * 100) / 100,
    basis: '《劳动法》第41条：每月加班不得超过36小时',
  });
  total += overtimeCompensation;

  return { total, details };
}

function calculateCompensation(input) {
  const params = normalizeCalculateInput(input);
  const {
    type,
    monthlySalary: salary,
    workYears: years,
    workMonths: months,
    dailySalary: dailyWage,
    overtimeHours: overtime,
    overtimeType,
    isTerminated,
    terminationReason,
    noticeGiven,
    hasContract,
    contractMonths,
    monthlyOvertimeHours: monthlyOvertime,
  } = params;

  const details = [];
  let total = 0;

  if (type === 'salary' || type === 'all') {
    const { overtimePay, detail } = calculateOvertimePay(salary, dailyWage, overtime, overtimeType);
    if (detail) details.push(detail);
    total += overtimePay;
  }

  if (type === 'severance' || type === 'all') {
    const result = calculateSeverance(salary, years, months, isTerminated, terminationReason, noticeGiven);
    details.push(...result.details);
    total += result.total;
  }

  if (type === 'contract' || type === 'all') {
    const result = calculateContractCompensation(salary, hasContract, contractMonths);
    details.push(...result.details);
    total += result.total;
  }

  if (type === 'overtime' || type === 'all') {
    const result = calculateMonthlyOvertimeCompensation(salary, dailyWage, monthlyOvertime);
    details.push(...result.details);
    total += result.total;
  }

  return {
    total: Math.round(total * 100) / 100,
    details,
    disclaimer: '本结果仅根据填写信息进行参考测算，只供记录核对参考，不作为个案判断。',
  };
}

function getCompensationItems(type) {
  const items = {
    salary: [
      { key: 'monthlySalary', label: '月工资', type: 'number', required: true },
      { key: 'overtimeHours', label: '加班时长（小时）', type: 'number', required: false },
      { key: 'overtimeType', label: '加班类型', type: 'select', options: [
        { value: 'weekday', label: '工作日加班' },
        { value: 'weekend', label: '休息日加班' },
        { value: 'holiday', label: '法定节假日加班' },
      ]},
    ],
    severance: [
      { key: 'monthlySalary', label: '月工资', type: 'number', required: true },
      { key: 'workYears', label: '工作年限（年）', type: 'number', required: true },
      { key: 'workMonths', label: '工作年限（月）', type: 'number', required: false },
      { key: 'isTerminated', label: '是否被解除合同', type: 'boolean', required: true },
      { key: 'terminationReason', label: '解除原因', type: 'select', options: [
        { value: 'other', label: '其他' },
        { value: 'illegal', label: '解除情况异常' },
      ]},
      { key: 'noticeGiven', label: '是否提前30天通知', type: 'boolean', required: false },
    ],
    contract: [
      { key: 'monthlySalary', label: '月工资', type: 'number', required: true },
      { key: 'hasContract', label: '是否签订劳动合同', type: 'boolean', required: true },
      { key: 'contractMonths', label: '未签合同月数', type: 'number', required: false },
    ],
    overtime: [
      { key: 'monthlySalary', label: '月工资', type: 'number', required: true },
      { key: 'monthlyOvertimeHours', label: '月加班总时长（小时）', type: 'number', required: true },
    ],
  };

  return items[type] || items.salary;
}

function getQuestions() {
  return [
    {
      id: 'Q1',
      text: '你是否已经离职？',
      type: 'radio',
      options: [
        { value: 'yes', label: '是，已经离职' },
        { value: 'no', label: '否，还在上班' },
      ],
    },
    {
      id: 'Q2',
      text: '你在这家公司工作了几年？',
      type: 'digit',
      unit: '年',
      min: 0,
      max: 40,
      placeholder: '请输入工作年数',
      errorMsg: '请输入 0~40 之间的年数',
    },
    {
      id: 'Q3',
      text: '你每个月工资多少？',
      type: 'digit',
      unit: '元',
      min: 0,
      max: 100000,
      placeholder: '请输入税前月工资',
      errorMsg: '请输入 0~100000 之间的金额',
    },
    {
      id: 'Q4',
      text: '是否签订了劳动合同？',
      type: 'radio',
      options: [
        { value: 'yes', label: '是' },
        { value: 'no', label: '否' },
        { value: 'unknown', label: '不清楚' },
      ],
    },
    {
      id: 'Q5',
      text: '离职原因是什么？',
      type: 'radio',
      options: [
        { value: 'company_terminate', label: '公司单方面辞退' },
        { value: 'self_resign', label: '自己主动辞职' },
        { value: 'contract_expire', label: '合同到期未续签' },
        { value: 'forced_termination', label: '被要求离职/情况异常' },
      ],
    },
  ];
}

function inferScenariosFromResult(input, result) {
  const scenarios = new Set();
  const params = normalizeCalculateInput(input || {});
  const text = (result && Array.isArray(result.details) ? result.details : [])
    .map(item => [item.item, item.basis, item.formula].filter(Boolean).join(' '))
    .join(' ');

  if (params.isTerminated || /经济|补偿|解除|赔偿/.test(text)) {
    scenarios.add(params.terminationReason === 'illegal' ? 'unlawful_termination' : 'severance_pay');
  }
  if (!params.hasContract || /未签|二倍/.test(text)) {
    scenarios.add('no_written_contract');
  }
  if (params.overtimeHours > 0 || params.monthlyOvertimeHours > 0 || /加班/.test(text)) {
    scenarios.add('overtime_no_pay');
  }

  return Array.from(scenarios);
}

module.exports = {
  normalizeCalculateInput,
  calculateOvertimePay,
  calculateSeverance,
  calculateContractCompensation,
  calculateMonthlyOvertimeCompensation,
  calculateCompensation,
  getCompensationItems,
  getQuestions,
  inferScenariosFromResult,
};
