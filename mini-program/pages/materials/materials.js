// 材料整理页

// 常见资料整理步骤
const { applyPageFontScale } = require('../../utils/fontScale');

const TIMELINE = [
  {
    step: 1,
    title: '保存基础材料',
    desc: '先整理劳动关系、工资、考勤相关材料。',
    detail: '可保存劳动合同、工资条或银行流水、考勤记录、工作证件、工作群记录、加班通知和沟通记录。重要材料可拍照备份，原件单独保管。'
  },
  {
    step: 2,
    title: '核对关键事实',
    desc: '把时间、金额、岗位、出勤和沟通节点记录清楚。',
    detail: '可按时间顺序整理：入职时间、工资约定、实际发薪记录、扣款记录、加班记录、离职或调岗沟通记录。'
  },
  {
    step: 3,
    title: '了解公开规则',
    desc: '可通过 12333 等官方渠道了解劳动保障公开信息。',
    detail: '12333 是人力资源和社会保障服务热线，可了解工资支付、社保、工时等公开政策信息和当地办事渠道。'
  },
  {
    step: 4,
    title: '核实人工渠道',
    desc: '需要进一步核实时，可联系 12333、人社服务窗口或工会等公开渠道。',
    detail: '本工具仅帮助整理信息，不替代专业机构意见，也不代办任何处理事项。'
  }
];

const MATERIALS = [
  {
    title: '身份证明',
    intro: '身份证或其他有效身份证件复印件。'
  },
  {
    title: '劳动关系证明',
    intro: '劳动合同、工牌、入职通知、工作群记录、考勤记录等。'
  },
  {
    title: '工资与发放记录',
    intro: '工资条、银行流水、转账记录、扣款记录、加班安排和相关沟通记录。'
  },
  {
    title: '单位信息',
    intro: '公司名称、统一社会信用代码、办公地址和负责人联系方式。'
  }
];

const DOC_TEMPLATES = [
  {
    id: 'labor_supervision_complaint',
    icon: '诉',
    name: '劳动保障监察投诉书',
    desc: '适用于拖欠工资、未缴社保等材料整理',
    price: '¥9.9',
    content: '劳动保障监察投诉书\n\n投诉人（劳动者）\n姓名：________　　性别：________　　年龄：________\n身份证号：______________________________\n职业：________　　工作单位：__________________\n住所（通讯地址）：__________________________\n联系电话：______________________________\n\n被投诉单位（用人单位）\n名称：_________________________________\n地址：_________________________________\n法定代表人/负责人：________　　联系电话：________\n\n投诉事实\n（写明何时入职、从事何岗位、是否签订劳动合同，单位在哪些方面侵犯了您的合法权益，如拖欠工资、未缴社保等）\n\n________________________________________________________________\n________________________________________________________________\n________________________________________________________________\n\n此致\n________区（县）劳动保障监察大队\n\n投诉人（签名）：________\n日期：____年____月____日\n\n————————————————————\n提示：本模板仅供材料整理参考，不构成法律意见，不代写、不代办提交。'
  },
  {
    id: 'labor_arbitration_application',
    icon: '申',
    name: '劳动人事争议仲裁申请书',
    desc: '适用于欠薪、解除劳动合同、赔偿金等材料整理',
    price: '¥19.9',
    content: '劳动人事争议仲裁申请书\n\n申请人\n姓名：________　　性别：________　　民族：________\n出生年月：____年____月____日\n身份证号码：______________________________\n住址：_________________________________\n联系电话：______________________________\n\n被申请人（用人单位）\n名称：_________________________________\n注册地址：_________________________________\n实际经营地址：_________________________________\n法定代表人/负责人：________　　联系电话：________\n\n一、请求事项（请逐项列明）\n1. 要求被申请人支付______________________，共计________元；\n2. 要求被申请人支付______________________，共计________元；\n3. 要求被申请人______________________________。\n　　合计金额：________元\n\n二、请求事项所依据的事实、理由\n\n（一）基本事实：\n1. 入职时间：____年____月____日\n2. 劳动合同签订情况：□已签订　□未签订\n　　合同期限：____年____月____日 至 ____年____月____日\n3. 工作岗位：________\n4. 月均应发工资：________元\n5. 离职情况：□已离职　离职时间：____年____月____日\n　　□未离职　　□不明确\n6. 离职原因：_________________________________\n\n（二）事实与理由：\n（写明具体情况，并逐项列明金额、时间、材料来源和计算方式）\n\n________________________________________________________________\n________________________________________________________________\n________________________________________________________________\n\n此致\n________区（县）劳动人事争议仲裁委员会\n\n附件：1. 申请人身份证复印件\n　　2. 劳动合同（如有）\n　　3. 工资条或银行流水\n　　4. 考勤记录\n　　5. 其他证明材料\n\n申请人（签名）：________\n日期：____年____月____日\n\n————————————————————\n提示：本模板仅供材料整理参考，不构成法律意见，不代写、不代办提交。'
  }
];

function makeDocHtml(template) {
  const escaped = String(template.content || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>body{font-family:SimSun,serif;font-size:14pt;line-height:1.8;}p{margin:8pt 0;white-space:pre-wrap;}</style></head><body><p>' + escaped.replace(/\n/g, '</p><p>') + '</p></body></html>';
}

Page({
  data: {
    timeline: TIMELINE,
    materials: MATERIALS,
    docTemplates: DOC_TEMPLATES,
    fontScaleClass: ''
  },

  onLoad() {
    this._applyFontScale();
  },

  onShow() {
    // 从设置页返回时刷新字号偏好
    this._applyFontScale();
  },

  // 应用字号缩放
  _applyFontScale() {
    const app = getApp();
    applyPageFontScale(this, app);
  },

  // 拨打 12333
  call12333() {
    wx.makePhoneCall({ phoneNumber: '12333', fail: () => {} });
  },

  findTemplate(id) {
    return DOC_TEMPLATES.find(item => item.id === id);
  },

  copyTemplate(e) {
    const template = this.findTemplate(e.currentTarget.dataset.id);
    if (!template) return;
    wx.showModal({
      title: '复制前请确认',
      content: '模板仅供材料整理参考，不构成法律意见，不代写、不代办提交。是否继续复制？',
      confirmText: '继续复制',
      success: res => {
        if (!res.confirm) return;
        wx.setClipboardData({
          data: template.content,
          success: () => wx.showToast({ title: '已复制模板', icon: 'success' }),
          fail: () => wx.showToast({ title: '复制失败', icon: 'none' })
        });
      }
    });
  },

  downloadTemplate(e) {
    const template = this.findTemplate(e.currentTarget.dataset.id);
    if (!template) return;
    wx.showModal({
      title: '模板下载',
      content: template.name + '（' + template.price + '）\n当前版本已恢复模板文件生成。正式收费需接入微信支付后启用付款校验。',
      confirmText: '生成文件',
      success: res => {
        if (!res.confirm) return;
        this.writeTemplateFile(template);
      }
    });
  },

  writeTemplateFile(template) {
    const fileName = template.name + '.doc';
    const filePath = wx.env.USER_DATA_PATH + '/' + fileName;
    const content = '\ufeff' + makeDocHtml(template);
    wx.getFileSystemManager().writeFile({
      filePath,
      data: content,
      encoding: 'utf8',
      success: () => {
        wx.openDocument({
          filePath,
          fileType: 'doc',
          showMenu: true,
          fail: () => wx.showToast({ title: '已生成，可复制使用', icon: 'none' })
        });
      },
      fail: () => wx.showToast({ title: '生成失败，请先复制模板', icon: 'none' })
    });
  }
});
