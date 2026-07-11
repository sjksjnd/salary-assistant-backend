const cloud = require('wx-server-sdk');
const { ensureCollections } = require('./db');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const COLLECTIONS = [
  'users',
  'user_settings',
  'user_agreements',
  'workhour_records',
  'salary_deductions',
  'salary_expenses',
  'salary_advances',
  'salary_bills',
  'detection_records',
  'legal_articles',
  'config_items',
];

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

const LEGAL_ARTICLES = [
  {
    category: 'contract',
    source: '《劳动合同法》第10条',
    title: '订立书面劳动合同',
    originalText: '建立劳动关系，应当订立书面劳动合同。已建立劳动关系，未同时订立书面劳动合同的，应当自用工之日起一个月内订立书面劳动合同。',
    keywords: ['书面劳动合同', '订立合同', '用工之日', '一个月'],
    applicableScenarios: ['no_written_contract', 'contract_signing'],
  },
  {
    category: 'contract',
    source: '《劳动合同法》第14条',
    title: '无固定期限劳动合同',
    originalText: '劳动者在该用人单位连续工作满十年，或者连续订立二次固定期限劳动合同且符合法定条件的，劳动者有权要求订立无固定期限劳动合同。',
    keywords: ['无固定期限', '十年', '二次固定期限', '连续工作'],
    applicableScenarios: ['no_fixed_term_contract', 'contract_renewal'],
  },
  {
    category: 'contract',
    source: '《劳动合同法》第19条',
    title: '试用期期限',
    originalText: '劳动合同期限三个月以上不满一年的，试用期不得超过一个月；一年以上不满三年的，不得超过二个月；三年以上的，不得超过六个月。',
    keywords: ['试用期', '一个月', '二个月', '六个月'],
    applicableScenarios: ['probation_over_limit', 'probation'],
  },
  {
    category: 'contract',
    source: '《劳动合同法》第20条',
    title: '试用期工资下限',
    originalText: '劳动者在试用期的工资不得低于本单位相同岗位最低档工资或者劳动合同约定工资的百分之八十，并不得低于用人单位所在地的最低工资标准。',
    keywords: ['试用期工资', '80%', '最低工资'],
    applicableScenarios: ['probation_salary_low'],
  },
  {
    category: 'contract',
    source: '《劳动合同法》第25条',
    title: '违约金限制',
    originalText: '除培训服务期和竞业限制情形外，用人单位不得与劳动者约定由劳动者承担违约金。',
    keywords: ['违约金', '赔偿金', '提前离职'],
    applicableScenarios: ['illegal_penalty'],
  },
  {
    category: 'wage',
    source: '《劳动法》第50条',
    title: '工资支付形式',
    originalText: '工资应当以货币形式按月支付给劳动者本人。不得克扣或者无故拖欠劳动者的工资。',
    keywords: ['工资支付', '按月支付', '克扣工资', '拖欠工资'],
    applicableScenarios: ['unpaid_wages', 'wage_payment'],
  },
  {
    category: 'wage',
    source: '《工资支付暂行规定》第7条',
    title: '工资支付日期',
    originalText: '工资必须在用人单位与劳动者约定的日期支付。如遇节假日或休息日，则应提前在最近的工作日支付。工资至少每月支付一次。',
    keywords: ['支付日期', '每月支付', '节假日', '休息日'],
    applicableScenarios: ['delayed_payment', 'wage_payment'],
  },
  {
    category: 'overtime',
    source: '《劳动法》第44条',
    title: '加班工资标准',
    originalText: '延长工作时间、休息日工作且不能安排补休、法定休假日工作的，应分别依法支付不低于工资的150%、200%、300%的工资报酬。',
    keywords: ['加班费', '加班工资', '1.5倍', '2倍', '3倍'],
    applicableScenarios: ['unpaid_overtime', 'overtime_wage'],
  },
  {
    category: 'overtime',
    source: '《劳动法》第41条',
    title: '加班时长限制',
    originalText: '用人单位延长工作时间一般每日不得超过一小时；特殊原因下每日不得超过三小时，但是每月不得超过三十六小时。',
    keywords: ['加班时长', '三十六小时', '每日三小时'],
    applicableScenarios: ['excessive_overtime'],
  },
  {
    category: 'termination',
    source: '《劳动合同法》第47条',
    title: '经济补偿金计算',
    originalText: '经济补偿按劳动者在本单位工作的年限，每满一年支付一个月工资的标准向劳动者支付。六个月以上不满一年的，按一年计算；不满六个月的，支付半个月工资。',
    keywords: ['经济补偿金', 'N', '一个月工资', '半个月工资'],
    applicableScenarios: ['severance_calculation'],
  },
  {
    category: 'termination',
    source: '《劳动合同法》第87条',
    title: '违法解除赔偿标准',
    originalText: '用人单位违法解除或者终止劳动合同的，应当依照经济补偿标准的二倍向劳动者支付赔偿金。',
    keywords: ['违法解除', '赔偿金', '2N', '二倍'],
    applicableScenarios: ['illegal_termination'],
  },
  {
    category: 'social_security',
    source: '《社会保险法》第58条',
    title: '社保缴纳义务',
    originalText: '用人单位应当自用工之日起三十日内为其职工向社会保险经办机构申请办理社会保险登记。',
    keywords: ['社保', '社会保险', '三十日内', '缴纳社保'],
    applicableScenarios: ['no_social_security'],
  },
];

const CONFIG_ITEMS = [
  {
    key: 'contract_sample',
    value: { text: CONTRACT_SAMPLE, content: CONTRACT_SAMPLE },
    description: '合同自查示例合同',
  },
  {
    key: 'app_info',
    value: {
      name: '薪工记',
      version: '1.0.0',
      description: '工友工资工时记录与合同工资自查工具',
    },
    description: '应用基本信息',
  },
  {
    key: 'contact',
    value: {
      hotline: '12333',
      hotlineName: '劳动保障热线',
      workHours: '工作日 9:00-17:00',
    },
    description: '联系信息',
  },
  {
    key: 'holiday_dates_2026',
    value: {
      dates: [
        '2026-01-01',
        '2026-02-08',
        '2026-02-09',
        '2026-02-10',
        '2026-02-11',
        '2026-02-12',
        '2026-02-13',
        '2026-02-14',
        '2026-04-04',
        '2026-04-05',
        '2026-04-06',
        '2026-05-01',
        '2026-05-02',
        '2026-05-03',
        '2026-06-19',
        '2026-06-20',
        '2026-06-21',
        '2026-09-25',
        '2026-09-26',
        '2026-09-27',
        '2026-10-01',
        '2026-10-02',
        '2026-10-03',
        '2026-10-04',
        '2026-10-05',
        '2026-10-06',
        '2026-10-07'
      ],
    },
    description: '节假日日期配置',
  },
  {
    key: 'agreement_user',
    value: {
      version: '1.0',
      title: '用户服务协议',
      content: '欢迎使用工友守护-薪工记。本应用用于工时记录、工资核对、合同条款自查和常见规则信息整理。应用内容仅供记录核对参考，不替代专业机构意见，也不代办任何处理事项。',
    },
    description: '用户服务协议',
  },
  {
    key: 'agreement_privacy',
    value: {
      version: '1.0',
      title: '隐私政策',
      content: '我们会在提供服务所必需的范围内处理登录信息、工时工资记录和用户主动填写的信息，并采取合理措施保护数据安全。',
    },
    description: '隐私政策',
  },
  {
    key: 'deduction_categories',
    value: ['五险一金', '个人所得税', '伙食费', '住宿费', '工服费', '罚款', '其他扣款'],
    description: '扣款类别',
  },
  {
    key: 'expense_categories',
    value: ['生活费', '房租', '交通费', '医疗费', '通讯费', '其他开销'],
    description: '花销类别',
  },
];

function ok(data = null, message = 'success') {
  return { code: 0, message, data };
}

function fail(code, message, data = null) {
  return { code, message, data };
}

exports.main = async (event = {}, context) => {
  const action = event.action || 'initAll';

  try {
    switch (action) {
      case 'init':
      case 'initAll':
      case 'seedAll':
        return await initAll();
      case 'status':
        return await getStatus();
      case 'seedLegal':
        return await seedLegalArticles();
      case 'seedConfig':
        return await seedConfigItems();
      default:
        return fail(40001, '未知操作');
    }
  } catch (err) {
    console.error('[seedData error]', action, err);
    return fail(50001, err.message || '服务器内部错误');
  }
};

async function initAll() {
  await ensureCollections(db, COLLECTIONS);
  const legal = await seedLegalArticles();
  const config = await seedConfigItems();
  const status = await getStatus();

  return ok({
    collections: COLLECTIONS,
    legal: legal.data,
    config: config.data,
    status: status.data,
  }, '线上初始化完成');
}

async function getStatus() {
  const counts = {};
  await ensureCollections(db, COLLECTIONS);

  for (const name of COLLECTIONS) {
    const res = await db.collection(name).count();
    counts[name] = res.total;
  }

  return ok(counts);
}

async function seedLegalArticles() {
  await ensureCollections(db, ['legal_articles']);
  let inserted = 0;
  let updated = 0;

  for (const article of LEGAL_ARTICLES) {
    const existing = await db.collection('legal_articles')
      .where({ source: article.source, title: article.title })
      .limit(1)
      .get();

    const data = {
      ...article,
      updatedAt: new Date(),
    };

    if (existing.data.length > 0) {
      await db.collection('legal_articles').doc(existing.data[0]._id).update({ data });
      updated++;
    } else {
      await db.collection('legal_articles').add({
        data: {
          ...data,
          createdAt: new Date(),
        },
      });
      inserted++;
    }
  }

  return ok({ total: LEGAL_ARTICLES.length, inserted, updated }, '规则信息初始化完成');
}

async function seedConfigItems() {
  await ensureCollections(db, ['config_items']);
  let inserted = 0;
  let updated = 0;

  for (const item of CONFIG_ITEMS) {
    const existing = await db.collection('config_items').where({ key: item.key }).limit(1).get();
    const data = {
      value: item.value,
      description: item.description,
      updatedAt: new Date(),
    };

    if (existing.data.length > 0) {
      await db.collection('config_items').doc(existing.data[0]._id).update({ data });
      updated++;
    } else {
      await db.collection('config_items').add({
        data: {
          key: item.key,
          ...data,
          createdAt: new Date(),
        },
      });
      inserted++;
    }
  }

  return ok({ total: CONFIG_ITEMS.length, inserted, updated }, '配置项初始化完成');
}
