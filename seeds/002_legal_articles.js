const { queryInsert } = require('../src/config/database');

const legalArticles = [
  // ===== 劳动合同类 =====
  {
    category: 'contract',
    source: '《劳动合同法》第10条',
    title: '订立书面劳动合同',
    original_text: '建立劳动关系，应当订立书面劳动合同。已建立劳动关系，未同时订立书面劳动合同的，应当自用工之日起一个月内订立书面劳动合同。用人单位与劳动者在用工前订立劳动合同的，劳动关系自用工之日起建立。',
    keywords: JSON.stringify(['书面劳动合同', '订立合同', '用工之日', '一个月']),
    applicable_scenarios: JSON.stringify(['no_written_contract', 'contract_signing'])
  },
  {
    category: 'contract',
    source: '《劳动合同法》第14条',
    title: '无固定期限劳动合同',
    original_text: '用人单位与劳动者协商一致，可以订立无固定期限劳动合同。有下列情形之一，劳动者提出或者同意续订、订立劳动合同的，除劳动者提出订立固定期限劳动合同外，应当订立无固定期限劳动合同：（一）劳动者在该用人单位连续工作满十年的；（二）用人单位初次实行劳动合同制度或者国有企业改制重新订立劳动合同时，劳动者在该用人单位连续工作满十年且距法定退休年龄不足十年的；（三）连续订立二次固定期限劳动合同，且劳动者没有本法第三十九条和第四十条第一项、第二项规定的情形，续订劳动合同的。',
    keywords: JSON.stringify(['无固定期限', '十年', '二次固定期限', '连续工作']),
    applicable_scenarios: JSON.stringify(['no_fixed_term_contract', 'contract_renewal'])
  },
  {
    category: 'contract',
    source: '《劳动合同法》第19条',
    title: '试用期上限',
    original_text: '劳动合同期限三个月以上不满一年的，试用期不得超过一个月；劳动合同期限一年以上不满三年的，试用期不得超过二个月；三年以上固定期限和无固定期限的劳动合同，试用期不得超过六个月。同一用人单位与同一劳动者只能约定一次试用期。以完成一定工作任务为期限的劳动合同或者劳动合同期限不满三个月的，不得约定试用期。试用期包含在劳动合同期限内。劳动合同仅约定试用期的，试用期不成立，该期限为劳动合同期限。',
    keywords: JSON.stringify(['试用期', '六个月', '三年', '二个月', '一个月', '一次试用期']),
    applicable_scenarios: JSON.stringify(['probation_over_limit', 'probation'])
  },
  {
    category: 'contract',
    source: '《劳动合同法》第20条',
    title: '试用期工资下限',
    original_text: '劳动者在试用期的工资不得低于本单位相同岗位最低档工资或者劳动合同约定工资的百分之八十，并不得低于用人单位所在地的最低工资标准。',
    keywords: JSON.stringify(['试用期工资', '80%', '最低工资', '百分之八十']),
    applicable_scenarios: JSON.stringify(['probation_salary_low'])
  },
  {
    category: 'contract',
    source: '《劳动合同法》第25条',
    title: '违约金限制',
    original_text: '除本法第二十二条和第二十三条规定的情形外，用人单位不得与劳动者约定由劳动者承担违约金。',
    keywords: JSON.stringify(['违约金', '赔偿金', '约定违约金']),
    applicable_scenarios: JSON.stringify(['illegal_penalty'])
  },
  {
    category: 'contract',
    source: '《劳动合同法》第26条',
    title: '劳动合同无效',
    original_text: '下列劳动合同无效或者部分无效：（一）以欺诈、胁迫的手段或者乘人之危，使对方在违背真实意思的情况下订立或者变更劳动合同的；（二）用人单位免除自己的法定责任、排除劳动者权利的；（三）违反法律、行政法规强制性规定的。对劳动合同的无效或者部分无效有争议的，由劳动争议仲裁机构或者人民法院确认。',
    keywords: JSON.stringify(['无效合同', '欺诈', '胁迫', '免除责任', '排除权利']),
    applicable_scenarios: JSON.stringify(['invalid_contract'])
  },
  {
    category: 'contract',
    source: '《劳动合同法》第35条',
    title: '变更劳动合同',
    original_text: '用人单位与劳动者协商一致，可以变更劳动合同约定的内容。变更劳动合同，应当采用书面形式。变更后的劳动合同文本由用人单位和劳动者各执一份。',
    keywords: JSON.stringify(['调岗', '调薪', '变更合同', '协商一致', '书面形式']),
    applicable_scenarios: JSON.stringify(['unilateral_transfer', 'position_change'])
  },
  {
    category: 'contract',
    source: '《劳动合同法》第39条',
    title: '用人单位单方解除（过失性辞退）',
    original_text: '劳动者有下列情形之一的，用人单位可以解除劳动合同：（一）在试用期间被证明不符合录用条件的；（二）严重违反用人单位的规章制度的；（三）严重失职，营私舞弊，给用人单位造成重大损害的；（四）劳动者同时与其他用人单位建立劳动关系，对完成本单位的工作任务造成严重影响，或者经用人单位提出，拒不改正的；（五）因本法第二十六条第一款第一项规定的情形致使劳动合同无效的；（六）被依法追究刑事责任的。',
    keywords: JSON.stringify(['解除劳动合同', '辞退', '开除', '严重违反', '试用期不符合']),
    applicable_scenarios: JSON.stringify(['employer_dismissal', 'fault_dismissal'])
  },
  {
    category: 'contract',
    source: '《劳动合同法》第40条',
    title: '用人单位单方解除（无过失性辞退）',
    original_text: '有下列情形之一的，用人单位提前三十日以书面形式通知劳动者本人或者额外支付劳动者一个月工资后，可以解除劳动合同：（一）劳动者患病或者非因工负伤，在规定的医疗期满后不能从事原工作，也不能从事由用人单位另行安排的工作的；（二）劳动者不能胜任工作，经过培训或者调整工作岗位，仍不能胜任工作的；（三）劳动合同订立时所依据的客观情况发生重大变化，致使劳动合同无法履行，经用人单位与劳动者协商，未能就变更劳动合同内容达成协议的。',
    keywords: JSON.stringify(['解除劳动合同', '辞退', '代通知金', '不能胜任', '医疗期满', 'N+1']),
    applicable_scenarios: JSON.stringify(['no_fault_dismissal', 'employer_dismissal'])
  },
  {
    category: 'contract',
    source: '《劳动合同法》第41条',
    title: '经济性裁员',
    original_text: '有下列情形之一，需要裁减人员二十人以上或者裁减不足二十人但占企业职工总数百分之十以上的，用人单位提前三十日向工会或者全体职工说明情况，听取工会或者职工的意见后，裁减人员方案经向劳动行政部门报告，可以裁减人员：（一）依照企业破产法规定进行重整的；（二）生产经营发生严重困难的；（三）企业转产、重大技术革新或者经营方式调整，经变更劳动合同后，仍需裁减人员的；（四）其他因劳动合同订立时所依据的客观经济情况发生重大变化，致使劳动合同无法履行的。',
    keywords: JSON.stringify(['裁员', '经济性裁员', '二十人', '百分之十', '生产经营困难']),
    applicable_scenarios: JSON.stringify(['economic_layoff'])
  },
  {
    category: 'contract',
    source: '《劳动合同法》第42条',
    title: '用人单位不得解除劳动合同的情形',
    original_text: '劳动者有下列情形之一的，用人单位不得依照本法第四十条、第四十一条的规定解除劳动合同：（一）从事接触职业病危害作业的劳动者未进行离岗前职业健康检查，或者疑似职业病病人在诊断或者医学观察期间的；（二）在本单位患职业病或者因工负伤并被确认丧失或者部分丧失劳动能力的；（三）患病或者非因工负伤，在规定的医疗期内的；（四）女职工在孕期、产期、哺乳期的；（五）在本单位连续工作满十五年，且距法定退休年龄不足五年的；（六）法律、行政法规规定的其他情形。',
    keywords: JSON.stringify(['不得解除', '孕期', '产期', '哺乳期', '医疗期', '职业病', '工伤', '十五年']),
    applicable_scenarios: JSON.stringify(['no_dismissal_protection', 'pregnancy_protection'])
  },
  {
    category: 'contract',
    source: '《劳动合同法》第82条',
    title: '未签书面劳动合同二倍工资',
    original_text: '用人单位自用工之日起超过一个月不满一年未与劳动者订立书面劳动合同的，应当向劳动者每月支付二倍的工资。用人单位违反本法规定不与劳动者订立无固定期限劳动合同的，自应当订立无固定期限劳动合同之日起向劳动者每月支付二倍的工资。',
    keywords: JSON.stringify(['二倍工资', '双倍工资', '未签劳动合同', '书面劳动合同', '一个月']),
    applicable_scenarios: JSON.stringify(['no_written_contract', 'double_wage'])
  },
  {
    category: 'contract',
    source: '《劳动合同法》第87条',
    title: '违法解除赔偿金',
    original_text: '用人单位违反本法规定解除或者终止劳动合同的，应当依照本法第四十七条规定的经济补偿标准的二倍向劳动者支付赔偿金。',
    keywords: JSON.stringify(['违法解除', '赔偿金', '2N', '二倍', '非法辞退']),
    applicable_scenarios: JSON.stringify(['unlawful_termination', 'illegal_dismissal'])
  },
  {
    category: 'contract',
    source: '《劳动合同法》第23条',
    title: '竞业限制补偿',
    original_text: '用人单位与劳动者可以在劳动合同中约定保守用人单位的商业秘密和与知识产权相关的保密事项。对负有保密义务的劳动者，用人单位可以在劳动合同或者保密协议中与劳动者约定竞业限制条款，并约定在解除或者终止劳动合同后，在竞业限制期限内按月给予劳动者经济补偿。劳动者违反竞业限制约定的，应当按照约定向用人单位支付违约金。',
    keywords: JSON.stringify(['竞业限制', '经济补偿', '保密', '商业秘密', '违约金']),
    applicable_scenarios: JSON.stringify(['non_compete_no_compensation'])
  },
  {
    category: 'contract',
    source: '《劳动合同法》第24条',
    title: '竞业限制期限',
    original_text: '竞业限制的人员限于用人单位的高级管理人员、高级技术人员和其他负有保密义务的人员。竞业限制的范围、地域、期限由用人单位与劳动者约定，竞业限制的约定不得违反法律、法规的规定。在解除或者终止劳动合同后，前款规定的人员到与本单位生产或者经营同类产品、从事同类业务的有竞争关系的其他用人单位，或者自己开业生产或者经营同类产品、从事同类业务的竞业限制期限，不得超过二年。',
    keywords: JSON.stringify(['竞业限制', '二年', '期限', '高级管理人员', '保密义务']),
    applicable_scenarios: JSON.stringify(['non_compete_over_limit'])
  },

  // ===== 工资类 =====
  {
    category: 'wage',
    source: '《劳动法》第50条',
    title: '工资支付原则',
    original_text: '工资应当以货币形式按月支付给劳动者本人。不得克扣或者无故拖欠劳动者的工资。',
    keywords: JSON.stringify(['工资', '按月支付', '克扣', '拖欠', '货币形式']),
    applicable_scenarios: JSON.stringify(['wage_arrears', 'wage_deduction'])
  },
  {
    category: 'wage',
    source: '《劳动法》第48条',
    title: '最低工资保障',
    original_text: '国家实行最低工资保障制度。最低工资的具体标准由省、自治区、直辖市人民政府规定，报国务院备案。用人单位支付劳动者的工资不得低于当地最低工资标准。',
    keywords: JSON.stringify(['最低工资', '最低工资标准', '低于最低工资']),
    applicable_scenarios: JSON.stringify(['minimum_wage', 'below_minimum_wage'])
  },
  {
    category: 'wage',
    source: '《工资支付暂行规定》第7条',
    title: '工资支付日期',
    original_text: '工资必须在用人单位与劳动者约定的日期支付。如遇节假日或休息日，则应提前在最近的工作日支付。工资至少每月支付一次，实行周、日、小时工资制的可按周、日、小时支付工资。',
    keywords: JSON.stringify(['工资支付日期', '发薪日', '节假日提前', '每月支付']),
    applicable_scenarios: JSON.stringify(['wage_payment_date', 'late_payment'])
  },
  {
    category: 'wage',
    source: '《工资支付暂行规定》第9条',
    title: '离职工资结清',
    original_text: '劳动关系双方依法解除或终止劳动合同时，用人单位应在解除或终止劳动合同时一次付清劳动者工资。',
    keywords: JSON.stringify(['离职工资', '结清工资', '解除合同', '一次付清']),
    applicable_scenarios: JSON.stringify(['resignation_wage', 'termination_wage'])
  },
  {
    category: 'wage',
    source: '《工资支付暂行规定》第15条',
    title: '可以代扣工资的情形',
    original_text: '用人单位不得克扣劳动者工资。有下列情况之一的，用人单位可以代扣劳动者工资：（一）用人单位代扣代缴的个人所得税；（二）用人单位代扣代缴的应由劳动者个人负担的各项社会保险费用；（三）法院判决、裁定中要求代扣的抚养费、赡养费；（四）法律、法规规定可以从劳动者工资中扣除的其他费用。',
    keywords: JSON.stringify(['代扣工资', '克扣工资', '社保', '个税', '抚养费']),
    applicable_scenarios: JSON.stringify(['wage_deduction', 'illegal_deduction'])
  },
  {
    category: 'wage',
    source: '《工资支付暂行规定》第16条',
    title: '经济损失赔偿',
    original_text: '因劳动者本人原因给用人单位造成经济损失的，用人单位可按照劳动合同的约定要求其赔偿经济损失。经济损失的赔偿，可从劳动者本人的工资中扣除。但每月扣除的部分不得超过劳动者当月工资的20%。若扣除后的剩余工资部分低于当地月最低工资标准，则按最低工资标准支付。',
    keywords: JSON.stringify(['经济损失', '赔偿', '扣工资', '20%', '最低工资']),
    applicable_scenarios: JSON.stringify(['economic_loss_compensation', 'wage_deduction'])
  },
  {
    category: 'wage',
    source: '《劳动合同法》第30条',
    title: '劳动报酬支付令',
    original_text: '用人单位应当按照劳动合同约定和国家规定，向劳动者及时足额支付劳动报酬。用人单位拖欠或者未足额支付劳动报酬的，劳动者可以依法向当地人民法院申请支付令，人民法院应当依法发出支付令。',
    keywords: JSON.stringify(['拖欠工资', '支付令', '足额支付', '劳动报酬']),
    applicable_scenarios: JSON.stringify(['wage_arrears', 'payment_order'])
  },

  // ===== 加班工时类 =====
  {
    category: 'overtime',
    source: '《劳动法》第36条',
    title: '标准工时制度',
    original_text: '国家实行劳动者每日工作时间不超过八小时、平均每周工作时间不超过四十四小时的工时制度。',
    keywords: JSON.stringify(['八小时', '每周四十四小时', '标准工时', '工作时间']),
    applicable_scenarios: JSON.stringify(['standard_hours', 'overtime'])
  },
  {
    category: 'overtime',
    source: '《劳动法》第38条',
    title: '休息日',
    original_text: '用人单位应当保证劳动者每周至少休息一日。',
    keywords: JSON.stringify(['休息日', '每周休息', '至少一日']),
    applicable_scenarios: JSON.stringify(['rest_day', 'no_rest'])
  },
  {
    category: 'overtime',
    source: '《劳动法》第41条',
    title: '延长工作时间限制',
    original_text: '用人单位由于生产经营需要，经与工会和劳动者协商后可以延长工作时间，一般每日不得超过一小时；因特殊原因需要延长工作时间的，在保障劳动者身体健康的条件下延长工作时间每日不得超过三小时，但是每月不得超过三十六小时。',
    keywords: JSON.stringify(['加班时间', '延长工作时间', '一小时', '三小时', '三十六小时', '每月']),
    applicable_scenarios: JSON.stringify(['excessive_overtime', 'forced_overtime'])
  },
  {
    category: 'overtime',
    source: '《劳动法》第44条',
    title: '加班费标准',
    original_text: '有下列情形之一的，用人单位应当按照下列标准支付高于劳动者正常工作时间工资的工资报酬：（一）安排劳动者延长工作时间的，支付不低于工资的百分之一百五十的工资报酬；（二）休息日安排劳动者工作又不能安排补休的，支付不低于工资的百分之二百的工资报酬；（三）法定休假日安排劳动者工作的，支付不低于工资的百分之三百的工资报酬。',
    keywords: JSON.stringify(['加班费', '加班工资', '150%', '200%', '300%', '休息日', '法定节假日']),
    applicable_scenarios: JSON.stringify(['overtime_no_pay', 'overtime'])
  },
  {
    category: 'overtime',
    source: '《劳动合同法》第31条',
    title: '加班协商',
    original_text: '用人单位应当严格执行劳动定额标准，不得强迫或者变相强迫劳动者加班。用人单位安排加班的，应当按照国家有关规定向劳动者支付加班费。',
    keywords: JSON.stringify(['强迫加班', '变相加班', '加班费', '劳动定额']),
    applicable_scenarios: JSON.stringify(['forced_overtime'])
  },

  // ===== 社会保险类 =====
  {
    category: 'social',
    source: '《社会保险法》第58条',
    title: '社保登记时限',
    original_text: '用人单位应当自用工之日起三十日内为其职工向社会保险经办机构申请办理社会保险登记。未办理社会保险登记的，由社会保险经办机构核定其应当缴纳的社会保险费。',
    keywords: JSON.stringify(['社保', '社会保险', '三十日', '登记', '五险']),
    applicable_scenarios: JSON.stringify(['no_social_security', 'social_security'])
  },
  {
    category: 'social',
    source: '《社会保险法》第60条',
    title: '社保费用缴纳',
    original_text: '用人单位应当自行申报、按时足额缴纳社会保险费，非因不可抗力等法定事由不得缓缴、减免。职工应当缴纳的社会保险费由用人单位代扣代缴，用人单位应当按月将缴纳社会保险费的明细情况告知本人。',
    keywords: JSON.stringify(['社保缴纳', '代扣代缴', '足额缴纳', '社保明细']),
    applicable_scenarios: JSON.stringify(['social_security_payment'])
  },
  {
    category: 'social',
    source: '《社会保险法》第63条',
    title: '未缴社保强制征缴',
    original_text: '用人单位未按时足额缴纳社会保险费的，由社会保险费征收机构责令其限期缴纳或者补足。用人单位逾期仍未缴纳或者补足社会保险费的，社会保险费征收机构可以向银行和其他金融机构查询其存款账户；并可以申请县级以上有关行政部门作出划拨社会保险费的决定，书面通知其开户银行或者其他金融机构划拨社会保险费。',
    keywords: JSON.stringify(['未缴社保', '补缴社保', '强制征缴', '社会保险费']),
    applicable_scenarios: JSON.stringify(['no_social_security', 'social_security_backpay'])
  },
  {
    category: 'social',
    source: '《工伤保险条例》第14条',
    title: '应当认定工伤的情形',
    original_text: '职工有下列情形之一的，应当认定为工伤：（一）在工作时间和工作场所内，因工作原因受到事故伤害的；（二）工作时间前后在工作场所内，从事与工作有关的预备性或者收尾性工作受到事故伤害的；（三）在工作时间和工作场所内，因履行工作职责受到暴力等意外伤害的；（四）患职业病的；（五）因工外出期间，由于工作原因受到伤害或者发生事故下落不明的；（六）在上下班途中，受到非本人主要责任的交通事故或者城市轨道交通、客运轮渡、火车事故伤害的；（七）法律、行政法规规定应当认定为工伤的其他情形。',
    keywords: JSON.stringify(['工伤', '工作时间', '工作场所', '交通事故', '职业病', '上下班途中']),
    applicable_scenarios: JSON.stringify(['work_injury', 'industrial_injury'])
  },
  {
    category: 'social',
    source: '《工伤保险条例》第15条',
    title: '视同工伤的情形',
    original_text: '职工有下列情形之一的，视同工伤：（一）在工作时间和工作岗位，突发疾病死亡或者在48小时之内经抢救无效死亡的；（二）在抢险救灾等维护国家利益、公共利益活动中受到伤害的；（三）职工原在军队服役，因战、因公负伤致残，已取得革命伤残军人证，到用人单位后旧伤复发的。',
    keywords: JSON.stringify(['视同工伤', '突发疾病', '48小时', '抢险救灾', '旧伤复发']),
    applicable_scenarios: JSON.stringify(['deemed_work_injury', 'work_injury'])
  },

  // ===== 劳动合同解除与经济补偿类 =====
  {
    category: 'termination',
    source: '《劳动合同法》第36条',
    title: '协商解除劳动合同',
    original_text: '用人单位与劳动者协商一致，可以解除劳动合同。',
    keywords: JSON.stringify(['协商解除', '双方同意', '解除劳动合同']),
    applicable_scenarios: JSON.stringify(['negotiated_termination'])
  },
  {
    category: 'termination',
    source: '《劳动合同法》第37条',
    title: '劳动者提前通知解除',
    original_text: '劳动者提前三十日以书面形式通知用人单位，可以解除劳动合同。劳动者在试用期内提前三日通知用人单位，可以解除劳动合同。',
    keywords: JSON.stringify(['辞职', '离职', '三十日', '提前通知', '书面形式', '试用期三日']),
    applicable_scenarios: JSON.stringify(['employee_resignation'])
  },
  {
    category: 'termination',
    source: '《劳动合同法》第38条',
    title: '劳动者单方解除权',
    original_text: '用人单位有下列情形之一的，劳动者可以解除劳动合同：（一）未按照劳动合同约定提供劳动保护或者劳动条件的；（二）未及时足额支付劳动报酬的；（三）未依法为劳动者缴纳社会保险费的；（四）用人单位的规章制度违反法律、法规的规定，损害劳动者权益的；（五）因本法第二十六条第一款规定的情形致使劳动合同无效的；（六）法律、行政法规规定劳动者可以解除劳动合同的其他情形。用人单位以暴力、威胁或者非法限制人身自由的手段强迫劳动者劳动的，或者用人单位违章指挥、强令冒险作业危及劳动者人身安全的，劳动者可以立即解除劳动合同，不需事先告知用人单位。',
    keywords: JSON.stringify(['被迫离职', '解除劳动合同', '拖欠工资', '未缴社保', '劳动条件', '强迫劳动']),
    applicable_scenarios: JSON.stringify(['unpaid_wage_resignation', 'no_social_resignation', 'forced_resignation'])
  },
  {
    category: 'termination',
    source: '《劳动合同法》第46条',
    title: '应当支付经济补偿的情形',
    original_text: '有下列情形之一的，用人单位应当向劳动者支付经济补偿：（一）劳动者依照本法第三十八条规定解除劳动合同的；（二）用人单位依照本法第三十六条规定向劳动者提出解除劳动合同并与劳动者协商一致解除劳动合同的；（三）用人单位依照本法第四十条规定解除劳动合同的；（四）用人单位依照本法第四十一条第一款规定解除劳动合同的；（五）除用人单位维持或者提高劳动合同约定条件续订劳动合同，劳动者不同意续订的情形外，依照本法第四十四条第一项规定终止固定期限劳动合同的；（六）依照本法第四十四条第四项、第五项规定终止劳动合同的；（七）法律、行政法规规定的其他情形。',
    keywords: JSON.stringify(['经济补偿', '补偿金', 'N', '解除补偿', '终止补偿']),
    applicable_scenarios: JSON.stringify(['severance_pay', 'economic_compensation'])
  },
  {
    category: 'termination',
    source: '《劳动合同法》第47条',
    title: '经济补偿计算',
    original_text: '经济补偿按劳动者在本单位工作的年限，每满一年支付一个月工资的标准向劳动者支付。六个月以上不满一年的，按一年计算；不满六个月的，向劳动者支付半个月工资的经济补偿。劳动者月工资高于用人单位所在直辖市、设区的市级人民政府公布的本地区上年度职工月平均工资三倍的，向其支付经济补偿的标准按职工月平均工资三倍的数额支付，向其支付经济补偿的年限最高不超过十二年。本条所称月工资是指劳动者在劳动合同解除或者终止前十二个月的平均工资。',
    keywords: JSON.stringify(['经济补偿', 'N', '三倍工资', '十二年', '月平均工资', '六个月']),
    applicable_scenarios: JSON.stringify(['severance_pay', 'unlawful_termination', 'economic_compensation_calculation'])
  },
  {
    category: 'termination',
    source: '《劳动合同法》第44条',
    title: '劳动合同终止',
    original_text: '有下列情形之一的，劳动合同终止：（一）劳动合同期满的；（二）劳动者开始依法享受基本养老保险待遇的；（三）劳动者死亡，或者被人民法院宣告死亡或者宣告失踪的；（四）用人单位被依法宣告破产的；（五）用人单位被吊销营业执照、责令关闭、撤销或者用人单位决定提前解散的；（六）法律、行政法规规定的其他情形。',
    keywords: JSON.stringify(['合同终止', '合同期满', '退休', '破产', '吊销执照']),
    applicable_scenarios: JSON.stringify(['contract_termination', 'contract_expiration'])
  },
  {
    category: 'termination',
    source: '《劳动合同法》第50条',
    title: '离职证明与档案转移',
    original_text: '用人单位应当在解除或者终止劳动合同时出具解除或者终止劳动合同的证明，并在十五日内为劳动者办理档案和社会保险关系转移手续。劳动者应当按照双方约定，办理工作交接。用人单位依照本法有关规定应当向劳动者支付经济补偿的，在办结工作交接时支付。用人单位对已经解除或者终止的劳动合同的文本，至少保存二年备查。',
    keywords: JSON.stringify(['离职证明', '解除证明', '档案转移', '社保转移', '工作交接', '十五日', '二年']),
    applicable_scenarios: JSON.stringify(['resignation_certificate', 'termination_procedure'])
  },

  // ===== 劳动争议类 =====
  {
    category: 'dispute',
    source: '《劳动争议调解仲裁法》第2条',
    title: '劳动争议范围',
    original_text: '中华人民共和国境内的用人单位与劳动者发生的下列劳动争议，适用本法：（一）因确认劳动关系发生的争议；（二）因订立、履行、变更、解除和终止劳动合同发生的争议；（三）因除名、辞退和辞职、离职发生的争议；（四）因工作时间、休息休假、社会保险、福利、培训以及劳动保护发生的争议；（五）因劳动报酬、工伤医疗费、经济补偿或者赔偿金等发生的争议；（六）法律、法规规定的其他劳动争议。',
    keywords: JSON.stringify(['劳动争议', '仲裁范围', '劳动关系', '工资', '社保', '经济补偿']),
    applicable_scenarios: JSON.stringify(['labor_dispute', 'arbitration_scope'])
  },
  {
    category: 'dispute',
    source: '《劳动争议调解仲裁法》第5条',
    title: '劳动争议处理程序',
    original_text: '发生劳动争议，当事人不愿协商、协商不成或者达成和解协议后不履行的，可以向调解组织申请调解；不愿调解、调解不成或者达成调解协议后不履行的，可以向劳动争议仲裁委员会申请仲裁；对仲裁裁决不服的，除本法另有规定的外，可以向人民法院提起诉讼。',
    keywords: JSON.stringify(['劳动仲裁', '调解', '诉讼', '仲裁前置', '处理程序']),
    applicable_scenarios: JSON.stringify(['labor_arbitration', 'dispute_resolution'])
  },
  {
    category: 'dispute',
    source: '《劳动争议调解仲裁法》第27条',
    title: '仲裁时效',
    original_text: '劳动争议申请仲裁的时效期间为一年。仲裁时效期间从当事人知道或者应当知道其权利被侵害之日起计算。前款规定的仲裁时效，因当事人一方向对方当事人主张权利，或者向有关部门请求权利救济，或者对方当事人同意履行义务而中断。从中断时起，仲裁时效期间重新计算。因不可抗力或者有其他正当理由，当事人不能在本条第一款规定的仲裁时效期间申请仲裁的，仲裁时效中止。从中止时效的原因消除之日起，仲裁时效期间继续计算。劳动关系存续期间因拖欠劳动报酬发生争议的，劳动者申请仲裁不受本条第一款规定的仲裁时效期间的限制；但是，劳动关系终止的，应当自劳动关系终止之日起一年内提出。',
    keywords: JSON.stringify(['仲裁时效', '一年', '时效中断', '时效中止', '拖欠工资', '劳动关系终止']),
    applicable_scenarios: JSON.stringify(['arbitration_timelimit', 'statute_of_limitations'])
  },
  {
    category: 'dispute',
    source: '《劳动争议调解仲裁法》第6条',
    title: '举证责任',
    original_text: '发生劳动争议，当事人对自己提出的主张，有责任提供证据。与争议事项有关的证据属于用人单位掌握管理的，用人单位应当提供；用人单位不提供的，应当承担不利后果。',
    keywords: JSON.stringify(['举证责任', '证据', '用人单位掌握', '不利后果']),
    applicable_scenarios: JSON.stringify(['burden_of_proof', 'evidence'])
  },
  {
    category: 'dispute',
    source: '《劳动争议调解仲裁法》第47条',
    title: '一裁终局',
    original_text: '下列劳动争议，除本法另有规定的外，仲裁裁决为终局裁决，裁决书自作出之日起发生法律效力：（一）追索劳动报酬、工伤医疗费、经济补偿或者赔偿金，不超过当地月最低工资标准十二个月金额的争议；（二）因执行国家的劳动标准在工作时间、休息休假、社会保险等方面发生的争议。',
    keywords: JSON.stringify(['一裁终局', '终局裁决', '小额争议', '劳动标准']),
    applicable_scenarios: JSON.stringify(['final_award', 'arbitration_final'])
  },

  // ===== 其他类 =====
  {
    category: 'other',
    source: '《劳动法》第3条',
    title: '劳动者基本权利',
    original_text: '劳动者享有平等就业和选择职业的权利、取得劳动报酬的权利、休息休假的权利、获得劳动安全卫生保护的权利、接受职业技能培训的权利、享受社会保险和福利的权利、提请劳动争议处理的权利以及法律规定的其他劳动权利。',
    keywords: JSON.stringify(['劳动者权利', '就业权', '劳动报酬', '休息休假', '社保福利']),
    applicable_scenarios: JSON.stringify(['laborer_rights'])
  },
  {
    category: 'other',
    source: '《就业促进法》第3条',
    title: '平等就业',
    original_text: '劳动者依法享有平等就业的权利。劳动者就业，不因民族、种族、性别、宗教信仰等不同而受歧视。',
    keywords: JSON.stringify(['就业歧视', '平等就业', '性别歧视', '民族歧视']),
    applicable_scenarios: JSON.stringify(['employment_discrimination'])
  },
  {
    category: 'other',
    source: '《妇女权益保障法》第23条',
    title: '女职工特别保护',
    original_text: '各单位在录用职工时，除不适合妇女的工种或者岗位外，不得以性别为由拒绝录用妇女或者提高对妇女的录用标准。各单位在录用女职工时，应当依法与其签订劳动（聘用）合同或者服务协议，劳动（聘用）合同或者服务协议中不得规定限制女职工结婚、生育的内容。',
    keywords: JSON.stringify(['女职工', '性别歧视', '结婚限制', '生育限制', '妇女权益']),
    applicable_scenarios: JSON.stringify(['female_worker_protection', 'pregnancy_discrimination'])
  },
  {
    category: 'other',
    source: '《劳动法》第77条',
    title: '劳动争议解决途径',
    original_text: '用人单位与劳动者发生劳动争议，当事人可以依法申请调解、仲裁、提起诉讼，也可以协商解决。调解原则适用于仲裁和诉讼程序。',
    keywords: JSON.stringify(['劳动争议', '调解', '仲裁', '诉讼', '协商']),
    applicable_scenarios: JSON.stringify(['dispute_resolution', 'labor_arbitration'])
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
