// 工资管理页
const { apiRequest, toast } = require('../../utils/api');

// 金额校验范围
const AMOUNT_MIN = 1;
const AMOUNT_MAX = 200000;

// 扣款分类（5 项）
const DEDUCTION_CATEGORIES = [
  { value: 'meal', label: '餐费', icon: '🍜' },
  { value: 'housing', label: '住宿', icon: '🏠' },
  { value: 'social_security', label: '社保个人部分', icon: '🛡️' },
  { value: 'fine', label: '罚款', icon: '⚠️' },
  { value: 'other', label: '其他', icon: '📝' }
];

// 花销分类（带 emoji 图标）
const EXPENSE_CATEGORIES = [
  { value: 'dining', label: '餐饮', icon: '🍜' },
  { value: 'transport', label: '交通', icon: '🚗' },
  { value: 'rent', label: '房租', icon: '🏠' },
  { value: 'shopping', label: '购物', icon: '🛒' },
  { value: 'entertainment', label: '娱乐', icon: '🎮' },
  { value: 'medical', label: '医疗', icon: '💊' },
  { value: 'study', label: '学习', icon: '📚' },
  { value: 'gift', label: '人情', icon: '🎁' },
  { value: 'phone', label: '话费', icon: '📱' },
  { value: 'internet', label: '网费', icon: '🌐' },
  { value: 'electricity', label: '电费', icon: '⚡' },
  { value: 'water', label: '水费', icon: '💧' },
  { value: 'other', label: '其他', icon: '📝' }
];

// 月份格式化为 YYYY-MM
function formatMonth(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return y + '-' + m;
}

// 月份展示文本：YYYY年M月
function formatMonthLabel(monthStr) {
  const parts = String(monthStr).split('-');
  return parts[0] + '年' + parseInt(parts[1], 10) + '月';
}

// 当天日期 YYYY-MM-DD
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

Page({
  data: {
    currentMonth: '',
    monthLabel: '',
    fontScaleClass: '',
    loading: false,
    settlement: null,        // 实发工资
    deductions: [],           // 扣款列表
    expenses: [],             // 花销列表
    advances: [],             // 预支列表
    totalDeduction: 0,
    totalExpense: 0,
    totalAdvance: 0,
    netSalary: 0,
    remaining: 0,
    expenseStats: [],         // 花销分类统计
    deductionStats: [],       // 扣款分类统计
    // 弹窗显隐
    deductionModal: false,
    expenseModal: false,
    advanceModal: false,
    // 表单数据
    deductionForm: { category: 'meal', amount: '', note: '', date: '' },
    expenseForm: { category: 'dining', amount: '', note: '', date: '' },
    advanceForm: { amount: '', purpose: '' },
    // 分享相关
    shareModal: false,
    shareImage: '',
    // 静态分类数据
    deductionCategories: DEDUCTION_CATEGORIES,
    expenseCategories: EXPENSE_CATEGORIES,
    submitting: false
  },

  onLoad() {
    const now = new Date();
    const month = formatMonth(now);
    this.setData({
      currentMonth: month,
      monthLabel: formatMonthLabel(month),
      'deductionForm.date': todayStr(),
      'expenseForm.date': todayStr()
    });
    this._applyFontScale();
    this.loadData();
  },

  onShow() {
    // 从设置页返回时刷新字号偏好
    this._applyFontScale();
    if (this.data.currentMonth) {
      this.loadData();
    }
  },

  // 应用字号缩放（中年劳动者字号偏大）
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

  onPullDownRefresh() {
    this.loadData();
    wx.stopPullDownRefresh();
  },

  // 加载月度数据
  loadData() {
    const month = this.data.currentMonth;
    if (!month) return;
    this.setData({ loading: true });

    Promise.all([
      apiRequest('/salary/bill/' + month).catch(() => null),
      apiRequest('/salary/deductions/' + month).catch(() => []),
      apiRequest('/salary/expenses/' + month).catch(() => []),
      apiRequest('/salary/advances/' + month).catch(() => [])
    ]).then(res => {
      const [settlement, deductions, expenses, advances] = res;
      const dedList = Array.isArray(deductions) ? deductions : [];
      const expList = Array.isArray(expenses) ? expenses : [];
      const advList = Array.isArray(advances) ? advances : [];

      const totalDeduction = this.sumAmount(dedList);
      const totalExpense = this.sumAmount(expList);
      const totalAdvance = this.sumAmount(advList);
      const netSalary = this.extractNetSalary(settlement);
      const remaining = netSalary - totalDeduction - totalExpense - totalAdvance;

      // 扣款超出警告状态
      const deductionWarning = netSalary > 0 && totalDeduction > netSalary;

      this.setData({
        loading: false,
        settlement,
        deductions: dedList,
        expenses: expList,
        advances: advList,
        totalDeduction,
        totalExpense,
        totalAdvance,
        netSalary,
        remaining,
        deductionWarning,
        expenseStats: this.buildStats(expList, EXPENSE_CATEGORIES),
        deductionStats: this.buildStats(dedList, DEDUCTION_CATEGORIES)
      });
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  // 从结算对象提取实发工资（兼容多种字段名）
  extractNetSalary(settlement) {
    if (!settlement) return 0;
    if (typeof settlement === 'number') return settlement;
    if (typeof settlement === 'object') {
      const v = settlement.netSalary || settlement.net_salary || settlement.amount || settlement.total || 0;
      return Number(v) || 0;
    }
    return 0;
  },

  // 求和（兼容多种字段名）
  sumAmount(list) {
    return (list || []).reduce((acc, item) => {
      const v = Number(item.amount != null ? item.amount : item.money);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
  },

  // 构建分类统计（金额 + 百分比，用于代替饼图）
  buildStats(list, categories) {
    const total = this.sumAmount(list);
    const map = {};
    (list || []).forEach(item => {
      const cat = item.category || item.type || 'other';
      const v = Number(item.amount != null ? item.amount : item.money);
      map[cat] = (map[cat] || 0) + (isNaN(v) ? 0 : v);
    });
    return categories
      .map(c => {
        const amount = map[c.value] || 0;
        const percent = total > 0 ? Math.round((amount / total) * 100) : 0;
        return { value: c.value, label: c.label, icon: c.icon, amount, percent };
      })
      .filter(c => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  },

  // 月份切换
  prevMonth() {
    const [y, m] = this.data.currentMonth.split('-').map(n => parseInt(n, 10));
    const d = new Date(y, m - 2, 1);
    const month = formatMonth(d);
    this.setData({ currentMonth: month, monthLabel: formatMonthLabel(month) });
    this.loadData();
  },

  nextMonth() {
    const [y, m] = this.data.currentMonth.split('-').map(n => parseInt(n, 10));
    const d = new Date(y, m, 1);
    // 不能超过当前月份
    const now = new Date();
    if (d.getFullYear() > now.getFullYear() ||
        (d.getFullYear() === now.getFullYear() && d.getMonth() > now.getMonth())) {
      toast('不能选择未来月份');
      return;
    }
    const month = formatMonth(d);
    this.setData({ currentMonth: month, monthLabel: formatMonthLabel(month) });
    this.loadData();
  },

  // 打开/关闭弹窗
  openDeductionModal() {
    if (!this._checkLogin()) return;
    this.setData({
      deductionModal: true,
      deductionForm: { category: 'meal', amount: '', note: '', date: todayStr() }
    });
  },
  openExpenseModal() {
    if (!this._checkLogin()) return;
    this.setData({
      expenseModal: true,
      expenseForm: { category: 'dining', amount: '', note: '', date: todayStr() }
    });
  },
  openAdvanceModal() {
    if (!this._checkLogin()) return;
    this.setData({
      advanceModal: true,
      advanceForm: { amount: '', purpose: '' }
    });
  },
  closeModal() {
    this.setData({ deductionModal: false, expenseModal: false, advanceModal: false, submitting: false });
  },

  // 登录校验
  _checkLogin() {
    const app = getApp();
    if (app && app.requireLogin) {
      return app.requireLogin('/pages/salary/salary');
    }
    return true;
  },

  // 表单字段修改（input 与 picker 共用）
  onDeductionField(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['deductionForm.' + field]: e.detail.value });
  },
  onExpenseField(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['expenseForm.' + field]: e.detail.value });
  },
  onAdvanceField(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['advanceForm.' + field]: e.detail.value });
  },

  // 选择分类
  pickDeductionCategory(e) {
    this.setData({ 'deductionForm.category': e.currentTarget.dataset.value });
  },
  pickExpenseCategory(e) {
    this.setData({ 'expenseForm.category': e.currentTarget.dataset.value });
  },

  // 校验金额
  validateAmount(amount) {
    const v = Number(amount);
    if (!amount || isNaN(v)) {
      toast('请输入正确金额');
      return null;
    }
    if (v < AMOUNT_MIN) {
      toast('金额至少 ' + AMOUNT_MIN + ' 元');
      return null;
    }
    if (v > AMOUNT_MAX) {
      toast('金额不能超过 ' + AMOUNT_MAX + ' 元');
      return null;
    }
    return v;
  },

  // 提交扣款
  submitDeduction() {
    const form = this.data.deductionForm;
    const amount = this.validateAmount(form.amount);
    if (amount === null) return;
    if (!form.date) {
      toast('请选择日期');
      return;
    }
    // 扣款超过实发工资时警告
    if (this.data.netSalary > 0 && amount > this.data.netSalary) {
      wx.showModal({
        title: '金额提示',
        content: '扣款金额超过本月实发工资，是否继续提交？',
        confirmText: '继续提交',
        cancelText: '再改改',
        success: res => {
          if (res.confirm) this._doSubmitDeduction(form, amount);
        }
      });
      return;
    }
    this._doSubmitDeduction(form, amount);
  },
  _doSubmitDeduction(form, amount) {
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    apiRequest('/salary/deductions', {
      method: 'POST',
      data: {
        category: form.category,
        amount: amount,
        note: form.note || '',
        date: form.date,
        month: this.data.currentMonth
      }
    }).then(() => {
      toast('已添加扣款', 'success');
      this.setData({ deductionModal: false, submitting: false });
      this.loadData();
    }).catch(err => {
      this.setData({ submitting: false });
      toast(err.message || '添加失败');
    });
  },

  // 提交花销
  submitExpense() {
    const form = this.data.expenseForm;
    const amount = this.validateAmount(form.amount);
    if (amount === null) return;
    if (!form.date) {
      toast('请选择日期');
      return;
    }
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    apiRequest('/salary/expenses', {
      method: 'POST',
      data: {
        category: form.category,
        amount: amount,
        note: form.note || '',
        date: form.date,
        month: this.data.currentMonth
      }
    }).then(() => {
      toast('已添加花销', 'success');
      this.setData({ expenseModal: false, submitting: false });
      this.loadData();
    }).catch(err => {
      this.setData({ submitting: false });
      toast(err.message || '添加失败');
    });
  },

  // 提交预支
  submitAdvance() {
    const form = this.data.advanceForm;
    const amount = this.validateAmount(form.amount);
    if (amount === null) return;
    if (!form.purpose) {
      toast('请填写用途');
      return;
    }
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    apiRequest('/salary/advances', {
      method: 'POST',
      data: {
        amount: amount,
        purpose: form.purpose,
        month: this.data.currentMonth
      }
    }).then(() => {
      toast('已添加预支', 'success');
      this.setData({ advanceModal: false, submitting: false });
      this.loadData();
    }).catch(err => {
      this.setData({ submitting: false });
      toast(err.message || '添加失败');
    });
  },

  // 月度账单：归档并跳转
  goBills() {
    if (!this._checkLogin()) return;
    wx.showModal({
      title: '归档月度账单',
      content: '是否归档 ' + this.data.monthLabel + ' 的账单？',
      confirmText: '确认归档',
      success: res => {
        if (!res.confirm) return;
        apiRequest('/salary/bill', {
          method: 'POST',
          data: {
            month: this.data.currentMonth,
            grossSalary: this.data.netSalary,
            actualSalary: this.data.netSalary,
            totalDeductions: this.data.totalDeduction,
            totalExpenses: this.data.totalExpense,
            totalAdvances: this.data.totalAdvance,
            remaining: this.data.remaining,
            isSettled: true
          }
        }).then(() => {
          toast('账单已归档', 'success');
          // 跳转账单归档页（若页面未注册则提示）
          wx.navigateTo({
            url: '/pages/salary/bills?month=' + this.data.currentMonth,
            fail: () => toast('账单归档页开发中')
          });
        }).catch(err => toast(err.message || '归档失败'));
      }
    });
  },

  // 分享账单：生成图片并显示预览
  shareBill() {
    const { monthLabel, netSalary, totalDeduction, totalExpense, totalAdvance, remaining } = this.data;
    
    if (netSalary === 0 && totalDeduction === 0 && totalExpense === 0 && totalAdvance === 0) {
      toast('本月暂无数据，无法分享');
      return;
    }

    wx.showLoading({ title: '生成图片中...' });

    const ctx = wx.createCanvasContext('billCanvas');
    const width = 600;
    const height = 800;
    const padding = 40;

    ctx.setFillStyle('#FFFFFF');
    ctx.fillRect(0, 0, width, height);

    ctx.setFillStyle('#2864AC');
    ctx.setFontSize(36);
    ctx.setFontWeight('bold');
    ctx.setTextAlign('center');
    ctx.fillText('工友守护·薪工记', width / 2, 60);

    ctx.setFillStyle('#9CA3AF');
    ctx.setFontSize(24);
    ctx.setFontWeight('normal');
    ctx.fillText('月度工资账单', width / 2, 95);

    ctx.setFillStyle('#2864AC');
    ctx.setFontSize(32);
    ctx.setFontWeight('bold');
    ctx.fillText(monthLabel, width / 2, 140);

    ctx.setStrokeStyle('#E5E7EB');
    ctx.setLineWidth(1);
    ctx.beginPath();
    ctx.moveTo(padding, 160);
    ctx.lineTo(width - padding, 160);
    ctx.stroke();

    let y = 200;

    ctx.setFillStyle('#1F2937');
    ctx.setFontSize(28);
    ctx.setTextAlign('left');
    ctx.fillText('实发工资', padding, y);
    ctx.setTextAlign('right');
    ctx.setFillStyle('#2864AC');
    ctx.setFontSize(36);
    ctx.setFontWeight('bold');
    ctx.fillText('¥' + netSalary.toFixed(2), width - padding, y);
    y += 50;

    ctx.setFillStyle('#1F2937');
    ctx.setFontSize(28);
    ctx.setFontWeight('normal');
    ctx.setTextAlign('left');
    ctx.fillText('扣款合计', padding, y);
    ctx.setTextAlign('right');
    ctx.setFillStyle('#DC2626');
    ctx.fillText('¥' + totalDeduction.toFixed(2), width - padding, y);
    y += 50;

    ctx.setFillStyle('#1F2937');
    ctx.setTextAlign('left');
    ctx.fillText('花销合计', padding, y);
    ctx.setTextAlign('right');
    ctx.setFillStyle('#F59E0B');
    ctx.fillText('¥' + totalExpense.toFixed(2), width - padding, y);
    y += 50;

    ctx.setFillStyle('#1F2937');
    ctx.setTextAlign('left');
    ctx.fillText('预支合计', padding, y);
    ctx.setTextAlign('right');
    ctx.setFillStyle('#6B7280');
    ctx.fillText('¥' + totalAdvance.toFixed(2), width - padding, y);
    y += 50;

    ctx.setStrokeStyle('#E5E7EB');
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
    y += 30;

    ctx.setFillStyle('#1F2937');
    ctx.setFontSize(28);
    ctx.setTextAlign('left');
    ctx.fillText('剩余存款', padding, y);
    ctx.setTextAlign('right');
    ctx.setFontSize(40);
    ctx.setFontWeight('bold');
    ctx.setFillStyle(remaining >= 0 ? '#10B981' : '#DC2626');
    ctx.fillText('¥' + remaining.toFixed(2), width - padding, y);
    y += 60;

    ctx.setStrokeStyle('#E5E7EB');
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
    y += 30;

    ctx.setFillStyle('#9CA3AF');
    ctx.setFontSize(22);
    ctx.setTextAlign('center');
    ctx.fillText('工友守护·薪工记 · ' + new Date().toLocaleDateString('zh-CN'), width / 2, y);

    ctx.draw(false, () => {
      wx.canvasToTempFilePath({
        canvasId: 'billCanvas',
        success: (res) => {
          wx.hideLoading();
          this.setData({ shareImage: res.tempFilePath, shareModal: true });
        },
        fail: () => {
          wx.hideLoading();
          toast('图片生成失败');
        }
      });
    });
  },

  // 关闭分享弹窗
  closeShareModal() {
    this.setData({ shareModal: false, shareImage: '' });
  }
});
