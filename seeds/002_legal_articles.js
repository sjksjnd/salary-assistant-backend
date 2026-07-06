const { queryInsert } = require('../src/config/database');

const legalArticles = [
  {
    category: 'contract',
    source: '《劳动合同法》第19条',
    title: '试用期上限',
    original_text: '劳动合同期限三个月以上不满一年的，试用期不得超过一个月；劳动合同期限一年以上不满三年的，试用期不得超过二个月；三年以上固定期限和无固定期限的劳动合同，试用期不得超过六个月。',
    keywords: JSON.stringify(['试用期', '六个月', '三年', '二年', '一个月']),
    applicable_scenarios: JSON.stringify(['probation_over_limit', 'probation'])
  },
  {
    category: 'contract',
    source: '《劳动合同法》第20条',
    title: '试用期工资下限',
    original_text: '劳动者在试用期的工资不得低于本单位相同岗位最低档工资或者劳动合同约定工资的百分之八十，并不得低于用人单位所在地的最低工资标准。',
    keywords: JSON.stringify(['试用期工资', '80%', '最低工资']),
    applicable_scenarios: JSON.stringify(['probation_salary_low'])
  },
  {
    category: 'social',
    source: '《社会保险法》第58条',
    title: '社保登记时限',
    original_text: '用人单位应当自用工之日起三十日内为其职工向社会保险经办机构申请办理社会保险登记。未办理社会保险登记的，由社会保险经办机构核定其应当缴纳的社会保险费。',
    keywords: JSON.stringify(['社保', '社会保险', '三十日', '登记']),
    applicable_scenarios: JSON.stringify(['no_social_security', 'social_security'])
  },
  {
    category: 'wage',
    source: '《劳动法》第50条',
    title: '工资支付原则',
    original_text: '工资应当以货币形式按月支付给劳动者本人。不得克扣或者无故拖欠劳动者的工资。',
    keywords: JSON.stringify(['工资', '按月支付', '克扣', '拖欠']),
    applicable_scenarios: JSON.stringify(['wage_arrears', 'wage_deduction'])
  },
  {
    category: 'overtime',
    source: '《劳动法》第44条',
    title: '加班费标准',
    original_text: '有下列情形之一的，用人单位应当按照下列标准支付高于劳动者正常工作时间工资的工资报酬：（一）安排劳动者延长工作时间的，支付不低于工资的百分之一百五十的工资报酬；（二）休息日安排劳动者工作又不能安排补休的，支付不低于工资的百分之二百的工资报酬；（三）法定休假日安排劳动者工作的，支付不低于工资的百分之三百的工资报酬。',
    keywords: JSON.stringify(['加班', '加班费', '150%', '200%', '300%']),
    applicable_scenarios: JSON.stringify(['overtime_no_pay', 'overtime'])
  },
  {
    category: 'contract',
    source: '《劳动合同法》第25条',
    title: '违约金限制',
    original_text: '除本法第二十二条和第二十三条规定的情形外，用人单位不得与劳动者约定由劳动者承担违约金。',
    keywords: JSON.stringify(['违约金', '赔偿金']),
    applicable_scenarios: JSON.stringify(['illegal_penalty'])
  },
  {
    category: 'contract',
    source: '《劳动合同法》第35条',
    title: '变更劳动合同',
    original_text: '用人单位与劳动者协商一致，可以变更劳动合同约定的内容。变更劳动合同，应当采用书面形式。',
    keywords: JSON.stringify(['调岗', '调薪', '变更', '协商一致']),
    applicable_scenarios: JSON.stringify(['unilateral_transfer'])
  },
  {
    category: 'contract',
    source: '《劳动合同法》第23条',
    title: '竞业限制补偿',
    original_text: '用人单位与劳动者可以在劳动合同中约定保守用人单位的商业秘密和与知识产权相关的保密事项。对负有保密义务的劳动者，用人单位可以在劳动合同或者保密协议中与劳动者约定竞业限制条款，并约定在解除或者终止劳动合同后，在竞业限制期限内按月给予劳动者经济补偿。',
    keywords: JSON.stringify(['竞业限制', '经济补偿', '保密']),
    applicable_scenarios: JSON.stringify(['non_compete_no_compensation'])
  },
  {
    category: 'contract',
    source: '《劳动合同法》第24条',
    title: '竞业限制期限',
    original_text: '竞业限制的人员限于用人单位的高级管理人员、高级技术人员和其他负有保密义务的人员。竞业限制的范围、地域、期限由用人单位与劳动者约定，竞业限制的约定不得违反法律、法规的规定。在解除或者终止劳动合同后，前款规定的人员到与本单位生产或者经营同类产品、从事同类业务的有竞争关系的其他用人单位，或者自己开业生产或者经营同类产品、从事同类业务的竞业限制期限，不得超过二年。',
    keywords: JSON.stringify(['竞业限制', '二年', '期限']),
    applicable_scenarios: JSON.stringify(['non_compete_over_limit'])
  },
  {
    category: 'termination',
    source: '《劳动合同法》第47条',
    title: '经济补偿计算',
    original_text: '经济补偿按劳动者在本单位工作的年限，每满一年支付一个月工资的标准向劳动者支付。六个月以上不满一年的，按一年计算；不满六个月的，向劳动者支付半个月工资的经济补偿。劳动者月工资高于用人单位所在直辖市、设区的市级人民政府公布的本地区上年度职工月平均工资三倍的，向其支付经济补偿的标准按职工月平均工资三倍的数额支付，向其支付经济补偿的年限最高不超过十二年。',
    keywords: JSON.stringify(['经济补偿', 'N', '三倍', '十二年', '月工资']),
    applicable_scenarios: JSON.stringify(['severance_pay', 'unlawful_termination'])
  },
  {
    category: 'termination',
    source: '《劳动合同法》第38条',
    title: '劳动者单方解除权',
    original_text: '用人单位有下列情形之一的，劳动者可以解除劳动合同：（一）未按照劳动合同约定提供劳动保护或者劳动条件的；（二）未及时足额支付劳动报酬的；（三）未依法为劳动者缴纳社会保险费的；（四）用人单位的规章制度违反法律、法规的规定，损害劳动者权益的；（五）因本法第二十六条第一款规定的情形致使劳动合同无效的；（六）法律、行政法规规定劳动者可以解除劳动合同的其他情形。',
    keywords: JSON.stringify(['解除劳动合同', '拖欠工资', '未缴社保', '劳动条件']),
    applicable_scenarios: JSON.stringify(['unpaid_wage_resignation', 'no_social_resignation'])
  },
  {
    category: 'contract',
    source: '《劳动合同法》第82条',
    title: '未签书面劳动合同二倍工资',
    original_text: '用人单位自用工之日起超过一个月不满一年未与劳动者订立书面劳动合同的，应当向劳动者每月支付二倍的工资。用人单位违反本法规定不与劳动者订立无固定期限劳动合同的，自应当订立无固定期限劳动合同之日起向劳动者每月支付二倍的工资。',
    keywords: JSON.stringify(['书面劳动合同', '二倍工资', '未签劳动合同']),
    applicable_scenarios: JSON.stringify(['no_written_contract'])
  },
  {
    category: 'overtime',
    source: '《劳动合同法》第31条',
    title: '加班协商',
    original_text: '用人单位应当严格执行劳动定额标准，不得强迫或者变相强迫劳动者加班。用人单位安排加班的，应当按照国家有关规定向劳动者支付加班费。',
    keywords: JSON.stringify(['加班', '强迫加班', '加班费']),
    applicable_scenarios: JSON.stringify(['forced_overtime'])
  }
];

async function seed() {
  for (const item of legalArticles) {
    await queryInsert(
      `INSERT INTO legal_articles (category, source, title, original_text, keywords, applicable_scenarios)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       original_text = VALUES(original_text),
       keywords = VALUES(keywords),
       applicable_scenarios = VALUES(applicable_scenarios)`,
      [item.category, item.source, item.title, item.original_text, item.keywords, item.applicable_scenarios]
    );
  }
  console.log(`✓ Seeded ${legalArticles.length} legal articles`);
}

module.exports = { seed };
