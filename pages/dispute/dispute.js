// 争议解决页
const { apiRequest, toast } = require('../../utils/api');

// 维权处理流程（5 步）
const TIMELINE = [
  {
    step: 1,
    title: '保全证据',
    icon: '📦',
    desc: '及时收集并保存与劳动关系、工资相关的所有证据材料。',
    detail: '证据清单：\n1. 劳动合同\n2. 工资条 / 银行流水\n3. 考勤记录\n4. 工作证 / 工牌\n5. 同事证言\n6. 微信 / 短信沟通记录\n7. 加班通知\n8. 用人单位发放工资的转账记录等\n\n建议将证据拍照或截图备份，妥善保存原件。'
  },
  {
    step: 2,
    title: '与用人单位协商沟通',
    icon: '🤝',
    desc: '优先与用人单位人事或负责人沟通，明确诉求并争取达成书面协议。',
    detail: '沟通话术建议：\n1. 表明身份与诉求：您好，我是 XX 项目的 XX，关于 X 月工资存在差额 XX 元，希望核对清楚。\n2. 引用证据：根据我的考勤记录和工资条，应发金额为 XX 元，实发 XX 元，差额 XX 元。\n3. 提出方案：希望公司能在 X 日内补发差额，并可签订书面协议。\n4. 留痕：建议通过微信 / 邮件沟通，保留文字记录。'
  },
  {
    step: 3,
    title: '拨打 12333 咨询',
    icon: '📞',
    desc: '咨询劳动保障政策、投诉举报渠道及维权流程。',
    detail: '可咨询内容：工资支付规定、最低工资标准、加班费计算、劳动仲裁申请流程、监察投诉方式等。\n全国人力资源和社会保障热线，提供政策咨询与投诉举报指引。'
  },
  {
    step: 4,
    title: '申请仲裁',
    icon: '⚖️',
    desc: '向用人单位所在地或劳动合同履行地的劳动人事争议仲裁委员会申请仲裁。',
    detail: '仲裁时效：自当事人知道或应当知道其权利被侵害之日起 1 年内。\n\n申请材料：\n1. 劳动仲裁申请书（一式两份）\n2. 身份证明复印件\n3. 劳动关系证明（劳动合同、工作证等）\n4. 工资拖欠证据（工资条、银行流水、考勤记录等）\n5. 用人单位工商登记信息\n\n注：仲裁不收费，申请人可申请法律援助。'
  },
  {
    step: 5,
    title: '向法院起诉',
    icon: '🏛️',
    desc: '对仲裁裁决不服的，可在收到裁决书之日起 15 日内向人民法院提起诉讼。',
    detail: '起诉条件：\n1. 已经过劳动仲裁前置程序\n2. 在法定期限内（收到裁决书 15 日内）\n3. 有明确的被告、具体的诉讼请求和事实理由\n\n注意事项：\n• 追索劳动报酬的案件可申请先予执行\n• 经济困难可申请司法援助\n• 涉及金额较大建议委托律师'
  }
];

// 文书模板（脱敏文本，敏感字段用 XX 替换）
const TEMPLATES = [
  {
    id: 'complaint',
    title: '劳动保障监察投诉书',
    intro: '用于向劳动保障监察机构投诉用人单位拖欠工资、未签劳动合同等违法行为。',
    price: '¥1.9',
    content: '劳动保障监察投诉书\n\n投诉人：XX，性别：X，民族：X，出生日期：XXXX 年 XX 月 XX 日\n身份证号：XXXXXXXXXXXXXXXXXX\n住址：XX 省 XX 市 XX 区 XX 路 XX 号\n联系电话：XXXXXXXXXXX\n\n被投诉单位：XX 有限公司\n统一社会信用代码：XXXXXXXXXXXXXXXXXX\n单位地址：XX 省 XX 市 XX 区 XX 路 XX 号\n法定代表人：XX    联系电话：XXXXXXXXXXX\n\n投诉请求：\n1. 请求责令被投诉单位支付拖欠投诉人 XXXX 年 XX 月至 XX 月工资共计人民币 XXXX 元；\n2. 请求责令被投诉单位依法支付未签订书面劳动合同的二倍工资差额；\n3. 请求责令被投诉单位依法为投诉人补缴社会保险。\n\n事实与理由：\n投诉人于 XXXX 年 XX 月 XX 日入职被投诉单位，担任 XX 岗位，月工资标准为人民币 XXXX 元。工作期间，投诉人遵守单位规章制度，按时完成工作任务。然而自 XXXX 年 XX 月起，被投诉单位开始拖欠投诉人工资，截至 XXXX 年 XX 月 XX 日，累计拖欠工资人民币 XXXX 元。投诉人多次催要未果。\n\n综上所述，被投诉单位的行为已违反《劳动法》《劳动合同法》相关规定，严重侵害投诉人合法权益。特此投诉，请依法查处。\n\n此致\nXX 市 XX 区劳动保障监察大队\n\n投诉人（签名）：XX\nXXXX 年 XX 月 XX 日'
  },
  {
    id: 'arbitration',
    title: '劳动仲裁申请书',
    intro: '用于向劳动人事争议仲裁委员会申请仲裁，解决工资、经济补偿等劳动争议。',
    price: '¥1.9',
    content: '劳动仲裁申请书\n\n申请人：XX，性别：X，出生日期：XXXX 年 XX 月 XX 日\n身份证号：XXXXXXXXXXXXXXXXXX\n住址：XX 省 XX 市 XX 区 XX 路 XX 号\n联系电话：XXXXXXXXXXX\n\n被申请人：XX 有限公司\n统一社会信用代码：XXXXXXXXXXXXXXXXXX\n住所：XX 省 XX 市 XX 区 XX 路 XX 号\n法定代表人：XX    职务：XX\n联系电话：XXXXXXXXXXX\n\n仲裁请求：\n1. 裁决被申请人支付申请人 XXXX 年 XX 月至 XX 月拖欠工资人民币 XXXX 元；\n2. 裁决被申请人支付申请人未签订书面劳动合同的二倍工资差额人民币 XXXX 元；\n3. 裁决被申请人支付申请人经济补偿金人民币 XXXX 元；\n4. 裁决被申请人为申请人补缴 XXXX 年 XX 月至 XX 月的社会保险。\n\n事实与理由：\n申请人于 XXXX 年 XX 月 XX 日入职被申请人处，担任 XX 岗位，月工资人民币 XXXX 元。工作期间，申请人服从管理、认真履职。被申请人自 XXXX 年 XX 月起拖欠申请人工资，且未与申请人签订书面劳动合同，未依法缴纳社会保险。XXXX 年 XX 月 XX 日，申请人被迫离职。\n\n被申请人的行为已严重违反《劳动法》《劳动合同法》之规定，侵害申请人合法权益。为维护申请人合法权益，特依法申请仲裁，请依法裁决。\n\n此致\nXX 市 XX 区劳动人事争议仲裁委员会\n\n申请人（签名）：XX\nXXXX 年 XX 月 XX 日\n\n附：1. 申请人身份证复印件 1 份\n    2. 劳动关系证明 1 份\n    3. 工资拖欠证据 1 份'
  }
];

Page({
  data: {
    timeline: TIMELINE,
    templates: TEMPLATES,
    articles: [],
    loadingArticles: false,
    fontScaleClass: '',
    templateModal: false,
    currentTemplate: null
  },

  onLoad() {
    this._applyFontScale();
    this.loadArticles();
  },

  onShow() {
    // 从设置页返回时刷新字号偏好
    this._applyFontScale();
  },

  // 应用字号缩放
  _applyFontScale() {
    const app = getApp();
    const scale = (app && app.globalData && app.globalData.fontScale) || 'medium';
    let cls = '';
    if (scale === 'large') cls = 'font-scale-large';
    else if (scale === 'extra-large') cls = 'font-scale-extra-large';
    if (this.data.fontScaleClass !== cls) {
      this.setData({ fontScaleClass: cls });
    }
  },

  // 加载法律条文（工资类 + 解除劳动合同类）
  loadArticles() {
    this.setData({ loadingArticles: true });
    Promise.all([
      apiRequest('/legal/articles?category=wage').catch(() => []),
      apiRequest('/legal/articles?category=termination').catch(() => [])
    ]).then(res => {
      const wage = Array.isArray(res[0]) ? res[0] : [];
      const termination = Array.isArray(res[1]) ? res[1] : [];
      this.setData({ articles: wage.concat(termination), loadingArticles: false });
    }).catch(() => {
      this.setData({ loadingArticles: false });
    });
  },

  // 查看模板详情
  viewTemplate(e) {
    const id = e.currentTarget.dataset.id;
    const t = this.data.templates.find(x => x.id === id);
    if (!t) return;
    this.setData({ templateModal: true, currentTemplate: t });
  },

  closeTemplate() {
    this.setData({ templateModal: false });
  },

  // 购买模板（暂不实现支付）
  buyTemplate() {
    toast('敬请期待');
  },

  // 拨打 12333
  call12333() {
    wx.makePhoneCall({ phoneNumber: '12333', fail: () => {} });
  }
});
