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

Page({
  data: {
    timeline: TIMELINE,
    materials: MATERIALS,
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
  }
});
