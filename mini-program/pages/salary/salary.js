// 工资核对页：月底核对实际到账、工时参考工资和日常扣款花销
const { apiRequest, toast } = require('../../utils/api');
const { isLegalHoliday, syncHolidayDatesForMonth } = require('../../utils/holiday');

const AMOUNT_MIN = 1;
const AMOUNT_MAX = 200000;

const DEDUCTION_CATEGORIES = [
  { value: 'meal', label: '餐费', icon: '🍚' },
  { value: 'housing', label: '住宿', icon: '🏠' },
  { value: 'social_security', label: '社保个人部分', icon: '🛡️' },
  { value: 'fine', label: '罚款', icon: '⚠️' },
  { value: 'other', label: '其他', icon: '📄' }
];

const EXPENSE_CATEGORIES = [
  { value: 'dining', label: '餐饮', icon: '🍚' },
  { value: 'transport', label: '交通', icon: '🚌' },
  { value: 'rent', label: '房租', icon: '🏠' },
  { value: 'shopping', label: '购物', icon: '🛒' },
  { value: 'medical', label: '医疗', icon: '💊' },
  { value: 'phone', label: '话费', icon: '📱' },
  { value: 'other', label: '其他', icon: '📄' }
];

const OVERTIME_RATE = {
  weekday: 1.5,
  weekend: 2,
  holiday: 3
};

function formatMonth(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return y + '-' + m;
}

function formatMonthLabel(monthStr) {
  const parts = String(monthStr).split('-');
  return parts[0] + '年' + parseInt(parts[1], 10) + '月';
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

Page({
  data: {
    currentMonth: '',
    monthLabel: '',
    fontScaleClass: '',
    loading: false,
    loadWarning: '',
    settlement: null,
    deductions: [],
    expenses: [],
    advances: [],
    actualSalary: 0,
    referenceSalary: 0,
    ordinarySalary: 0,
    salaryGap: 0,
    totalDeduction: 0,
    totalExpense: 0,
    totalAdvance: 0,
    remaining: 0,
    workSummary: {
      days: 0,
      hours: '0',
      overtimeHours: '0'
    },
    salaryStatus: {
      label: '待录入到账工资',
      tone: 'neutral'
    },
    salaryInsight: {
      tone: 'neutral',
      title: '先记工时，再核对到账工资',
      desc: '本页会把记工时生成的参考应得、实际到账、扣款和花销放在一起核对。'
    },
    display: {
      actualSalary: '0.00',
      referenceSalary: '0.00',
      salaryGap: '0.00',
      totalDeduction: '0.00',
      totalExpense: '0.00',
      totalAdvance: '0.00',
      remaining: '0.00'
    },
    expenseStats: [],
    deductionStats: [],
    detailGroups: [],
    actualSalaryModal: false,
    deductionModal: false,
    expenseModal: false,
    advanceModal: false,
    billModal: false,
    billSummary: null,
    billSections: [],
    actualSalaryForm: { amount: '' },
    deductionForm: { id: '', category: 'meal', amount: '', note: '', date: '' },
    expenseForm: { id: '', category: 'dining', amount: '', note: '', date: '' },
    advanceForm: { id: '', amount: '', purpose: '', date: '' },
    shareModal: false,
    shareImage: '',
    deductionCategories: DEDUCTION_CATEGORIES,
    expenseCategories: EXPENSE_CATEGORIES,
    submitting: false
  },

  onLoad() {
    const month = formatMonth(new Date());
    this.setData({
      currentMonth: month,
      monthLabel: formatMonthLabel(month),
      'deductionForm.id': '',
      'deductionForm.date': todayStr(),
      'expenseForm.id': '',
      'expenseForm.date': todayStr(),
      'advanceForm.id': '',
      'advanceForm.date': todayStr()
    });
    this._applyFontScale();
    this._loadSeq = 0;
    this.loadData();
  },

  onShow() {
    this._applyFontScale();
    if (this.data.currentMonth) this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  _applyFontScale() {
    const app = getApp();
    const scale = (app && app.globalData && app.globalData.fontScale) || 'medium';
    let cls = '';
    if (scale === 'large') cls = 'font-scale-large';
    else if (scale === 'extra-large') cls = 'font-scale-extra-large';
    if (this.data.fontScaleClass !== cls) this.setData({ fontScaleClass: cls });
  },

  _checkLogin() {
    const app = getApp();
    if (app && app.requireLogin) return app.requireLogin('/pages/salary/salary');
    return true;
  },

  loadData() {
    const month = this.data.currentMonth;
    if (!month) return Promise.resolve();
    const seq = ++this._loadSeq;
    this.setData({ loading: true });

    const safeRequest = (promise, fallback, label, warnOnFail = true) => promise
      .then(data => ({ data, label, failed: false }))
      .catch(() => ({ data: fallback, label, failed: warnOnFail }));

    return syncHolidayDatesForMonth(month).then(() => Promise.all([
      safeRequest(apiRequest('/salary/bill/' + month), null, '到账工资', false),
      safeRequest(apiRequest('/salary/deductions/' + month), [], '扣款'),
      safeRequest(apiRequest('/salary/expenses/' + month), [], '花销'),
      safeRequest(apiRequest('/salary/advances/' + month), [], '预支'),
      safeRequest(apiRequest('/workhours/month/' + month), { records: [] }, '工时')
    ]))
      .then(res => {
        if (seq !== this._loadSeq) return;
        const failedLabels = res.filter(item => item.failed).map(item => item.label);
        const [settlement, deductions, expenses, advances, workData] = res.map(item => item.data);
        const dedList = this.decorateMoneyRecords(Array.isArray(deductions) ? deductions : [], DEDUCTION_CATEGORIES, '扣款');
        const expList = this.decorateMoneyRecords(Array.isArray(expenses) ? expenses : [], EXPENSE_CATEGORIES, '花销');
        const advList = this.decorateMoneyRecords(Array.isArray(advances) ? advances : [], [], '预支');
        const workRecords = Array.isArray(workData) ? workData : (workData && workData.records) || [];
        const workSummary = this.computeWorkSummary(workRecords);
        const totalDeduction = this.sumAmount(dedList);
        const totalExpense = this.sumAmount(expList);
        const totalAdvance = this.sumAmount(advList);
        const actualSalary = this.extractActualSalary(settlement);
        const salaryGap = actualSalary > 0 ? Math.max(0, workSummary.referenceSalary - actualSalary) : 0;
        const remaining = actualSalary > 0 ? actualSalary - totalExpense - totalAdvance : 0;

        this.setData({
          loading: false,
          loadWarning: failedLabels.length ? '部分数据暂时未加载：' + failedLabels.join('、') : '',
          settlement,
          deductions: dedList,
          expenses: expList,
          advances: advList,
          actualSalary,
          referenceSalary: Number(workSummary.referenceSalary.toFixed(2)),
          ordinarySalary: Number(workSummary.ordinarySalary.toFixed(2)),
          salaryGap: Number(salaryGap.toFixed(2)),
          totalDeduction,
          totalExpense,
          totalAdvance,
          remaining: Number(remaining.toFixed(2)),
          workSummary: {
            days: workSummary.days,
            hours: workSummary.hoursLabel,
            overtimeHours: workSummary.overtimeHoursLabel
          },
          salaryStatus: this.getSalaryStatus(actualSalary, salaryGap),
          salaryInsight: this.getSalaryInsight({
            actualSalary,
            salaryGap,
            totalExpense,
            totalAdvance,
            totalDeduction,
            remaining,
            workSummary
          }),
          display: this.buildDisplay({
            actualSalary,
            referenceSalary: workSummary.referenceSalary,
            salaryGap,
            totalDeduction,
            totalExpense,
            totalAdvance,
            remaining
          }),
          expenseStats: this.buildStats(expList, EXPENSE_CATEGORIES),
          deductionStats: this.buildStats(dedList, DEDUCTION_CATEGORIES),
          detailGroups: this.buildDetailGroups(dedList, expList, advList),
          'actualSalaryForm.amount': actualSalary > 0 ? money(actualSalary) : ''
        });
      })
      .catch(() => {
        if (seq !== this._loadSeq) return;
        this.setData({ loading: false, loadWarning: '数据加载失败，请稍后重试' });
      });
  },

  computeWorkSummary(records) {
    let days = 0;
    let totalHours = 0;
    let ordinarySalary = 0;
    let referenceSalary = 0;
    let overtimeHours = 0;

    (records || []).forEach(record => {
      const h = Number(record.hours) || 0;
      if (h <= 0) return;
      const rate = this.getRecordRate(record);
      days += 1;
      totalHours += h;
      ordinarySalary += h * rate;

      const date = new Date(record.date || record.recordDate);
      const weekday = date.getDay();
      const dateStr = record.date || record.recordDate || '';
      const isWeekend = weekday === 0 || weekday === 6;
      const isHoliday = isLegalHoliday(dateStr);

      if (isHoliday) {
        referenceSalary += h * rate * OVERTIME_RATE.holiday;
        overtimeHours += h;
      } else if (isWeekend) {
        referenceSalary += h * rate * OVERTIME_RATE.weekend;
        overtimeHours += h;
      } else {
        const regularHours = Math.min(h, 8);
        const extraHours = Math.max(0, h - 8);
        referenceSalary += regularHours * rate + extraHours * rate * OVERTIME_RATE.weekday;
        overtimeHours += extraHours;
      }
    });

    return {
      days,
      totalHours,
      ordinarySalary,
      referenceSalary,
      overtimeHours,
      hoursLabel: totalHours % 1 === 0 ? String(totalHours) : totalHours.toFixed(1),
      overtimeHoursLabel: overtimeHours % 1 === 0 ? String(overtimeHours) : overtimeHours.toFixed(1)
    };
  },

  getRecordRate(record) {
    const explicitRate = Number(record.rate);
    if (explicitRate > 0) return explicitRate;
    const hours = Number(record.hours) || 0;
    const wage = Number(record.wage != null ? record.wage : record.payAmount);
    if (hours > 0 && wage > 0) return wage / hours;
    return 0;
  },

  extractActualSalary(settlement) {
    if (!settlement) return 0;
    if (typeof settlement === 'number') return Number(settlement) || 0;
    const value = settlement.actualSalary || settlement.netSalary || settlement.net_salary || settlement.amount || 0;
    return Number(value) || 0;
  },

  getSalaryStatus(actualSalary, salaryGap) {
    if (!actualSalary) return { label: '待录入到账工资', tone: 'neutral' };
    if (salaryGap > 0) return { label: '建议核对工资条', tone: 'warning' };
    return { label: '到账已覆盖参考金额', tone: 'success' };
  },

  getSalaryInsight(values) {
    const workSummary = values.workSummary || {};
    if (!workSummary.days) {
      return {
        tone: 'neutral',
        title: '本月还没有记工时',
        desc: '先在记工时里记录每天工时和时薪，月底这里会自动生成参考应得。'
      };
    }
    if (!values.actualSalary) {
      return {
        tone: 'neutral',
        title: '等待录入实际到账',
        desc: '已根据工时估算参考应得，发工资后录入到账金额即可看到差额。'
      };
    }
    if (values.salaryGap > 0) {
      return {
        tone: 'warning',
        title: '到账低于参考应得',
        desc: '建议先核对工资条、考勤记录、加班记录和扣款明细，确认差额来源。'
      };
    }
    if (values.remaining < 0) {
      return {
        tone: 'warning',
        title: '到账后结余为负',
        desc: '本月花销和预支已超过到账金额，建议检查是否重复记录。'
      };
    }
    if (values.totalDeduction > 0) {
      return {
        tone: 'success',
        title: '工资核对基本正常',
        desc: '已录入扣款记录，建议月底和工资条逐项核对金额与类别。'
      };
    }
    return {
      tone: 'success',
      title: '工资核对基本正常',
      desc: '实际到账已覆盖当前参考应得，可继续补充扣款、花销和预支记录。'
    };
  },

  buildDisplay(values) {
    return {
      actualSalary: money(values.actualSalary),
      referenceSalary: money(values.referenceSalary),
      salaryGap: money(values.salaryGap),
      totalDeduction: money(values.totalDeduction),
      totalExpense: money(values.totalExpense),
      totalAdvance: money(values.totalAdvance),
      remaining: money(values.remaining)
    };
  },

  sumAmount(list) {
    return (list || []).reduce((acc, item) => {
      const v = Number(item.amount != null ? item.amount : item.money);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
  },

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
        return { value: c.value, label: c.label, icon: c.icon, amount: Number(amount.toFixed(2)), amountText: money(amount), percent };
      })
      .filter(c => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  },

  getCategoryLabel(value, categories, fallback) {
    const found = (categories || []).find(item => item.value === value);
    return found ? found.label : fallback;
  },

  formatRecordDate(value) {
    if (!value) return '未填日期';
    const parts = String(value).split('-');
    if (parts.length === 3) {
      return parseInt(parts[1], 10) + '月' + parseInt(parts[2], 10) + '日';
    }
    return String(value);
  },

  decorateMoneyRecords(list, categories, fallbackLabel) {
    return (list || []).map(item => {
      const category = item.category || item.type || '';
      const amount = Number(item.amount != null ? item.amount : item.money) || 0;
      const note = item.note || item.purpose || '';
      return Object.assign({}, item, {
        categoryLabel: this.getCategoryLabel(category, categories, fallbackLabel),
        amountText: money(amount),
        dateText: this.formatRecordDate(item.date || item.recordDate),
        noteText: note || '无备注'
      });
    });
  },

  buildDetailGroups(deductions, expenses, advances) {
    return [
      { key: 'deduction', title: '扣款明细', empty: '暂无扣款', records: deductions || [] },
      { key: 'expense', title: '花销明细', empty: '暂无花销', records: expenses || [] },
      { key: 'advance', title: '预支明细', empty: '暂无预支', records: advances || [] }
    ].filter(group => group.records.length > 0);
  },

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

  openActualSalaryModal() {
    if (!this._checkLogin()) return;
    this.setData({
      actualSalaryModal: true,
      actualSalaryForm: { amount: this.data.actualSalary > 0 ? money(this.data.actualSalary) : '' }
    });
  },

  openDeductionModal() {
    if (!this._checkLogin()) return;
    this.setData({
      deductionModal: true,
      deductionForm: { id: '', category: 'meal', amount: '', note: '', date: todayStr() }
    });
  },

  openExpenseModal() {
    if (!this._checkLogin()) return;
    this.setData({
      expenseModal: true,
      expenseForm: { id: '', category: 'dining', amount: '', note: '', date: todayStr() }
    });
  },

  openAdvanceModal() {
    if (!this._checkLogin()) return;
    this.setData({
      advanceModal: true,
      advanceForm: { id: '', amount: '', purpose: '', date: todayStr() }
    });
  },

  closeModal() {
    if (this.data.submitting) return;
    this.setData({
      actualSalaryModal: false,
      deductionModal: false,
      expenseModal: false,
      advanceModal: false,
      submitting: false
    });
  },

  deleteSalaryRecord(e) {
    const id = e.currentTarget.dataset.id;
    const kind = e.currentTarget.dataset.kind;
    const config = {
      deduction: { path: '/salary/deductions', label: '扣款' },
      expense: { path: '/salary/expenses', label: '花销' },
      advance: { path: '/salary/advances', label: '预支' }
    }[kind];
    if (!id || !config || this.data.submitting) return;

    wx.showModal({
      title: '删除这条' + config.label + '？',
      content: '删除后，本月账单金额会同步更新。',
      confirmText: '删除',
      confirmColor: '#D93025',
      success: res => {
        if (!res.confirm) return;
        this.setData({ submitting: true });
        apiRequest(config.path, {
          method: 'DELETE',
          data: { id }
        })
          .then(() => {
            toast('已删除', 'success');
            this.setData({ submitting: false });
            this.loadData();
          })
          .catch(err => {
            this.setData({ submitting: false });
            toast(err.message || '删除失败');
          });
      }
    });
  },

  editSalaryRecord(e) {
    const id = e.currentTarget.dataset.id;
    const kind = e.currentTarget.dataset.kind;
    if (!id || !kind) return;
    const sourceMap = {
      deduction: this.data.deductions,
      expense: this.data.expenses,
      advance: this.data.advances
    };
    const record = (sourceMap[kind] || []).find(item => String(item.id) === String(id));
    if (!record) {
      toast('记录不存在');
      return;
    }
    if (kind === 'deduction') {
      this.setData({
        deductionModal: true,
        deductionForm: {
          id: record.id,
          category: record.category || 'other',
          amount: String(record.amount || ''),
          note: record.note || '',
          date: record.date || record.recordDate || todayStr()
        }
      });
      return;
    }
    if (kind === 'expense') {
      this.setData({
        expenseModal: true,
        expenseForm: {
          id: record.id,
          category: record.category || 'other',
          amount: String(record.amount || ''),
          note: record.note || '',
          date: record.date || record.recordDate || todayStr()
        }
      });
      return;
    }
    if (kind === 'advance') {
      this.setData({
        advanceModal: true,
        advanceForm: {
          id: record.id,
          amount: String(record.amount || ''),
          purpose: record.purpose || record.note || '',
          date: record.date || record.recordDate || todayStr()
        }
      });
    }
  },

  onActualSalaryField(e) {
    this.setData({ 'actualSalaryForm.amount': e.detail.value });
  },

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

  pickDeductionCategory(e) {
    this.setData({ 'deductionForm.category': e.currentTarget.dataset.value });
  },

  pickExpenseCategory(e) {
    this.setData({ 'expenseForm.category': e.currentTarget.dataset.value });
  },

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

  submitActualSalary() {
    const amount = this.validateAmount(this.data.actualSalaryForm.amount);
    if (amount === null || this.data.submitting) return;
    const remaining = amount - this.data.totalExpense - this.data.totalAdvance;
    this.setData({ submitting: true });
    apiRequest('/salary/bill', {
      method: 'POST',
      data: {
        month: this.data.currentMonth,
        grossSalary: this.data.referenceSalary,
        actualSalary: amount,
        totalDeductions: this.data.totalDeduction,
        totalExpenses: this.data.totalExpense,
        totalAdvances: this.data.totalAdvance,
        remaining,
        isSettled: true
      }
    })
      .then(() => {
        toast('到账工资已保存', 'success');
        this.setData({ actualSalaryModal: false, submitting: false });
        this.loadData();
      })
      .catch(err => {
        this.setData({ submitting: false });
        toast(err.message || '保存失败');
      });
  },

  submitDeduction() {
    const form = this.data.deductionForm;
    const amount = this.validateAmount(form.amount);
    if (amount === null) return;
    if (!form.date) {
      toast('请选择日期');
      return;
    }
    this._doSubmitDeduction(form, amount);
  },

  _doSubmitDeduction(form, amount) {
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    apiRequest('/salary/deductions', {
      method: form.id ? 'PUT' : 'POST',
      data: {
        id: form.id || undefined,
        category: form.category,
        amount,
        note: form.note || '',
        date: form.date,
        month: this.data.currentMonth
      }
    })
      .then(() => {
        toast(form.id ? '扣款已更新' : '已添加扣款', 'success');
        this.setData({ deductionModal: false, submitting: false });
        this.loadData();
      })
      .catch(err => {
        this.setData({ submitting: false });
        toast(err.message || '添加失败');
      });
  },

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
      method: form.id ? 'PUT' : 'POST',
      data: {
        id: form.id || undefined,
        category: form.category,
        amount,
        note: form.note || '',
        date: form.date,
        month: this.data.currentMonth
      }
    })
      .then(() => {
        toast(form.id ? '花销已更新' : '已添加花销', 'success');
        this.setData({ expenseModal: false, submitting: false });
        this.loadData();
      })
      .catch(err => {
        this.setData({ submitting: false });
        toast(err.message || '添加失败');
      });
  },

  submitAdvance() {
    const form = this.data.advanceForm;
    const amount = this.validateAmount(form.amount);
    if (amount === null) return;
    if (!form.purpose) {
      toast('请填写用途');
      return;
    }
    if (!form.date) {
      toast('请选择日期');
      return;
    }
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    apiRequest('/salary/advances', {
      method: form.id ? 'PUT' : 'POST',
      data: {
        id: form.id || undefined,
        amount,
        purpose: form.purpose,
        month: this.data.currentMonth,
        date: form.date
      }
    })
      .then(() => {
        toast(form.id ? '预支已更新' : '已添加预支', 'success');
        this.setData({ advanceModal: false, submitting: false });
        this.loadData();
      })
      .catch(err => {
        this.setData({ submitting: false });
        toast(err.message || '添加失败');
      });
  },

  buildBillSummary() {
    const { actualSalary, referenceSalary, salaryGap, totalDeduction, totalExpense, totalAdvance, remaining } = this.data;
    const base = Math.max(actualSalary, referenceSalary, totalDeduction, totalExpense, totalAdvance, 1);
    const toPercent = amount => amount ? Math.max(4, Math.min(100, Math.round((amount / base) * 100))) : 0;
    const sections = [
      { key: 'reference', label: '参考应得', amount: referenceSalary, amountText: money(referenceSalary), percent: toPercent(referenceSalary), tone: 'income' },
      { key: 'actual', label: '实际到账', amount: actualSalary, amountText: money(actualSalary), percent: toPercent(actualSalary), tone: 'actual' },
      { key: 'gap', label: '参考差额', amount: salaryGap, amountText: money(salaryGap), percent: toPercent(salaryGap), tone: 'deduction' },
      { key: 'deduction', label: '已记扣款', amount: totalDeduction, amountText: money(totalDeduction), percent: toPercent(totalDeduction), tone: 'deduction' },
      { key: 'expense', label: '花销', amount: totalExpense, amountText: money(totalExpense), percent: toPercent(totalExpense), tone: 'expense' },
      { key: 'advance', label: '预支', amount: totalAdvance, amountText: money(totalAdvance), percent: toPercent(totalAdvance), tone: 'advance' },
      { key: 'remaining', label: '到账后结余', amount: Math.abs(remaining), amountText: money(remaining), percent: toPercent(Math.abs(remaining)), tone: remaining >= 0 ? 'actual' : 'deduction' }
    ];

    return {
      summary: {
        referenceSalary,
        referenceSalaryText: money(referenceSalary),
        actualSalary,
        actualSalaryText: money(actualSalary),
        salaryGap,
        salaryGapText: money(salaryGap),
        totalDeduction,
        totalDeductionText: money(totalDeduction),
        outTotal: totalExpense + totalAdvance,
        outTotalText: money(totalExpense + totalAdvance),
        remaining,
        remainingText: money(remaining),
        insight: this.data.salaryInsight
      },
      sections
    };
  },

  goBills() {
    if (!this._checkLogin()) return;
    const hasData = this.data.actualSalary || this.data.referenceSalary || this.data.totalExpense || this.data.totalAdvance || this.data.totalDeduction;
    if (!hasData) {
      toast('本月暂无账单数据');
      return;
    }
    const bill = this.buildBillSummary();
    this.setData({
      billModal: true,
      billSummary: bill.summary,
      billSections: bill.sections
    });
  },

  closeBillModal() {
    this.setData({ billModal: false });
  },

  shareBill() {
    const { monthLabel, referenceSalary, actualSalary, salaryGap, totalDeduction, totalExpense, totalAdvance, remaining } = this.data;
    if (!referenceSalary && !actualSalary && !totalDeduction && !totalExpense && !totalAdvance) {
      toast('本月暂无数据，无法分享');
      return;
    }

    this.setData({ billModal: false });
    wx.showLoading({ title: '生成图片中...' });

    const ctx = wx.createCanvasContext('billCanvas');
    const width = 600;
    const height = 800;
    const padding = 40;
    ctx.setFillStyle('#FFFFFF');
    ctx.fillRect(0, 0, width, height);

    ctx.setFillStyle('#2864AC');
    ctx.font = 'bold 36px sans-serif';
    ctx.setTextAlign('center');
    ctx.fillText('工友守护·薪工记', width / 2, 60);

    ctx.setFillStyle('#6B7280');
    ctx.font = '24px sans-serif';
    ctx.fillText(monthLabel + '工资核对', width / 2, 100);

    let y = 160;
    const rows = [
      ['参考应得', referenceSalary, '#2864AC'],
      ['实际到账', actualSalary, '#15935B'],
      ['参考差额', salaryGap, '#D97706'],
      ['已记扣款', totalDeduction, '#D93025'],
      ['花销', totalExpense, '#F59E0B'],
      ['预支', totalAdvance, '#6B7280'],
      ['到账后结余', remaining, remaining >= 0 ? '#15935B' : '#DC2626']
    ];

    rows.forEach(row => {
      ctx.setFillStyle('#1F2937');
      ctx.font = '28px sans-serif';
      ctx.setTextAlign('left');
      ctx.fillText(row[0], padding, y);
      ctx.setTextAlign('right');
      ctx.setFillStyle(row[2]);
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText('¥' + money(row[1]), width - padding, y);
      y += 58;
    });

    ctx.setStrokeStyle('#E5E7EB');
    ctx.beginPath();
    ctx.moveTo(padding, y + 8);
    ctx.lineTo(width - padding, y + 8);
    ctx.stroke();
    y += 54;

    ctx.setFillStyle('#9CA3AF');
    ctx.font = '22px sans-serif';
    ctx.setTextAlign('center');
    ctx.fillText('金额仅供记录核对参考', width / 2, y);

    ctx.draw(false, () => {
      wx.canvasToTempFilePath({
        canvasId: 'billCanvas',
        success: res => {
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

  closeShareModal() {
    this.setData({ shareModal: false, shareImage: '' });
  }
});
