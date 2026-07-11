// 记工时页：按月记录每日工时与工资
// 功能：日历视图 / 工资参考差额 / 白班夜班时薪 / 周末和超时提醒
const { apiRequest, toast } = require('../../utils/api');
const { isLegalHoliday } = require('../../utils/holiday');

const app = getApp();

// 班次选项：白班 / 夜班（不同时薪）
const SHIFT_OPTIONS = [
  { value: '白班', label: '白班', icon: '☀️' },
  { value: '夜班', label: '夜班', icon: '🌙' }
];

// 法定标准工时（月）
const STANDARD_MONTHLY_HOURS = 174; // 21.75天 × 8小时

// 加班倍率
const OVERTIME_RATE = {
  weekday: 1.5,   // 工作日加班 150%
  weekend: 2.0,    // 周末加班 200%
  holiday: 3.0     // 法定节假日 300%
};

const OVERTIME_REMINDER_SHOWN_KEY = 'workhours_overtime_reminder_shown';

Page({
  data: {
    // 字体缩放样式类
    fontScaleClass: '',
    // 当前月份 YYYY-MM
    currentMonth: '',
    // 当前月份显示文本 YYYY年M月
    currentMonthLabel: '',
    // 当月记录列表（按日期排序）
    records: [],
    // 日历单元格数据
    calendarDays: [],
    // 视图模式：list / calendar
    viewMode: 'calendar',
    // 统计数据
    stats: {
      days: 0,
      hours: '0',
      wage: '0.00',
      overtimeHours: '0',
      overtimePremium: '0.00'
    },
    // 工资参考模型
    wageModel: {
      actualWage: '0.00',
      statutoryWage: '0.00',
      wageDiff: '0.00',
      diffLabel: '0.00',
      isPositive: false,
      hourlyRate: '0.00',
      formula: '参考差额 = 参考应得 - 普通工资',
      overtimeNote: '记录工时后会按工作日、周末和节假日倍率估算。'
    },
    // 弹窗状态
    showModal: false,
    modalMode: 'add',
    editingDate: '',
    submitting: false,
    deleting: false,
    loading: false,
    // 班次选项
    shiftOptions: SHIFT_OPTIONS,
    // 表单数据
    form: {
      date: '',
      hours: '',
      shift: '白班',
      rate: ''
    },
    // 默认白班/夜班时薪（从设置读取）
    defaultDayRate: '',
    defaultNightRate: '',
    // 提醒开关
    reminders: {
      weekend: true,    // 周末记工时提醒
      overtime: true    // 超 8 小时提醒
    },
    _storageCache: {}
  },

  onLoad() {
    const now = new Date();
    this._setMonth(now.getFullYear(), now.getMonth() + 1);
    this._applyFontScale();
    this._loadRateSettings();
    // Request sequence counter: only the latest _loadRecords response is applied.
    this._loadSeq = 0;
  },

  onShow() {
    if (this.data.currentMonth) {
      this._loadRecords();
    }
    this._applyFontScale();
    this._loadRateSettings(true);
  },

  _getStorage(key, defaultValue = '') {
    if (this.data._storageCache[key] !== undefined) {
      return this.data._storageCache[key];
    }
    let value = wx.getStorageSync(key);
    if (value === '' || value === undefined || value === null) {
      value = wx.getStorageSync('yunke_' + key);
    }
    if (value === '' || value === undefined || value === null) {
      value = defaultValue;
    }
    this.setData({ [`_storageCache.${key}`]: value });
    return value;
  },

  // 加载白班/夜班时薪设置（统一使用 hourly_rate / night_rate 键名）
  _loadRateSettings(forceRefresh = false) {
    if (forceRefresh) {
      this.setData({ _storageCache: {} });
    }
    const dayRate = this._getStorage('hourly_rate');
    const nightRate = this._getStorage('night_rate');
    const weekendReminder = this._getStorage('reminder_weekend', true);
    const overtimeReminder = this._getStorage('reminder_overtime', true);
    const defaultShift = this._getStorage('default_shift', '白班');
    this.setData({
      defaultDayRate: dayRate,
      defaultNightRate: nightRate,
      'form.shift': this._normalizeShift(defaultShift),
      'reminders.weekend': weekendReminder !== false,
      'reminders.overtime': overtimeReminder !== false
    });
  },

  _normalizeShift(value) {
    if (value === 'night' || value === '夜班') return '夜班';
    return '白班';
  },

  _applyFontScale() {
    const scale = app.globalData.fontScale;
    let cls = '';
    if (scale === 'large') {
      cls = 'font-scale-large';
    } else if (scale === 'extra-large') {
      cls = 'font-scale-extra-large';
    }
    if (this.data.fontScaleClass !== cls) {
      this.setData({ fontScaleClass: cls });
    }
  },

  // 设置当前月份（month 为 1-indexed）
  _setMonth(year, month1) {
    let y = year + Math.floor((month1 - 1) / 12);
    let m = ((month1 - 1) % 12 + 12) % 12 + 1;
    const mm = String(m).padStart(2, '0');
    this.setData({
      currentMonth: y + '-' + mm,
      currentMonthLabel: y + '年' + m + '月'
    });
    this._buildCalendar(y, m, []);
  },

  // 构建日历数据
  _buildCalendar(year, month1, records) {
    const firstDay = new Date(year, month1 - 1, 1);
    const lastDay = new Date(year, month1, 0);
    const startWeekday = firstDay.getDay(); // 0=周日
    const totalDays = lastDay.getDate();

    // 构建记录索引 { 'YYYY-MM-DD': record }
    const recordMap = {};
    records.forEach(r => {
      if (r.date) recordMap[r.date] = r;
    });

    const today = new Date();
    const todayStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');

    const days = [];
    // 前置空白格
    for (let i = 0; i < startWeekday; i++) {
      days.push({ empty: true });
    }
    // 当月每一天
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = year + '-' + String(month1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const date = new Date(year, month1 - 1, d);
      const weekday = date.getDay();
      const isWeekend = weekday === 0 || weekday === 6;
      const isHoliday = isLegalHoliday(dateStr);
      const record = recordMap[dateStr];
      days.push({
        empty: false,
        day: d,
        date: dateStr,
        isWeekend: isWeekend,
        isHoliday: isHoliday,
        isToday: dateStr === todayStr,
        hasRecord: !!record,
        hours: record ? (Number(record.hours) || 0) : 0,
        wage: record ? (Number(record.wage) || 0).toFixed(0) : '',
        shift: record ? (record.shift || '白班') : '',
        isOvertime: record && Number(record.hours) > 8
      });
    }
    this.setData({ calendarDays: days });
  },

  // 加载当月记录
  _loadRecords() {
    // Use a sequence number so stale responses (from a previous month) are discarded.
    const seq = ++this._loadSeq;
    this.setData({ loading: true });
    apiRequest('/workhours/month/' + this.data.currentMonth)
      .then(data => {
        // Discard if a newer request has been initiated.
        if (seq !== this._loadSeq) return;
        // Backend returns { records, summary }; fallback to array for safety
        let records = Array.isArray(data) ? data : (data && data.records) || [];
        records = records.map(r => this._formatRecord(r));
        this._computeStats(records);
        this._buildCalendar(
          parseInt(this.data.currentMonth.split('-')[0], 10),
          parseInt(this.data.currentMonth.split('-')[1], 10),
          records
        );
        this.setData({ records: records, loading: false });
      })
      .catch(err => {
        if (seq !== this._loadSeq) return;
        this.setData({ loading: false });
        this._computeStats([]);
        this._buildCalendar(
          parseInt(this.data.currentMonth.split('-')[0], 10),
          parseInt(this.data.currentMonth.split('-')[1], 10),
          []
        );
        this.setData({ records: [] });
        toast(err.message || '加载失败');
      });
  },

  _formatRecord(r) {
    const h = Number(r.hours) || 0;
    const rate = Number(r.rate) || 0;
    const w = r.wage != null ? Number(r.wage) : h * rate;
    return Object.assign({}, r, {
      rate,
      wage: w.toFixed(2),
      displayDate: this._formatDate(r.date),
      shiftLabel: r.shift || '白班'
    });
  },

  _formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = String(dateStr).split('-');
    if (parts.length < 3) return dateStr;
    return parseInt(parts[1], 10) + '月' + parseInt(parts[2], 10) + '日';
  },

  // 计算统计数据和工资对比
  _computeStats(records) {
    let days = records.length;
    let totalHours = 0;
    let ordinaryWage = 0;
    let statutoryWage = 0;
    let overtimeHours = 0;

    // 获取时薪（优先用白班时薪，若没有则用第一条记录的时薪）
    const dayRate = Number(this.data.defaultDayRate) || 0;
    const nightRate = Number(this.data.defaultNightRate) || 0;
    let effectiveRate = dayRate || nightRate;

    records.forEach(r => {
      const h = Number(r.hours) || 0;
      const rate = this._getRecordRate(r, dayRate, nightRate, effectiveRate);
      totalHours += h;
      ordinaryWage += h * rate;
      if (!effectiveRate && rate) effectiveRate = rate;

      // 判断日期类型
      const date = new Date(r.date);
      const weekday = date.getDay();
      const isWeekend = weekday === 0 || weekday === 6;
      const isHoliday = isLegalHoliday(r.date);

      if (isHoliday) {
        statutoryWage += h * rate * OVERTIME_RATE.holiday;
        overtimeHours += h;
      } else if (isWeekend) {
        statutoryWage += h * rate * OVERTIME_RATE.weekend;
        overtimeHours += h;
      } else {
        // 工作日：区分正常工时和加班工时
        const regularHours = Math.min(h, 8);
        const extraHours = Math.max(0, h - 8);
        statutoryWage += regularHours * rate + extraHours * rate * OVERTIME_RATE.weekday;
        overtimeHours += extraHours;
      }
    });

    // 参考差额
    const wageDiff = statutoryWage - ordinaryWage;
    const displayGap = Math.max(0, wageDiff);
    const overtimeLabel = overtimeHours % 1 === 0 ? String(overtimeHours) : overtimeHours.toFixed(1);

    // 格式化显示
    const hoursStr = totalHours % 1 === 0 ? String(totalHours) : totalHours.toFixed(1);
    this.setData({
      stats: {
        days: days,
        hours: hoursStr,
        wage: ordinaryWage.toFixed(2),
        overtimeHours: overtimeHours % 1 === 0 ? String(overtimeHours) : overtimeHours.toFixed(1),
        overtimePremium: Math.max(0, wageDiff).toFixed(2)
      },
      // 工资参考模型
      wageModel: {
        actualWage: ordinaryWage.toFixed(2),
        statutoryWage: statutoryWage.toFixed(2),
        wageDiff: wageDiff.toFixed(2),
        diffLabel: wageDiff > 0 ? '+' + wageDiff.toFixed(2) : wageDiff.toFixed(2),
        isPositive: wageDiff > 0,
        hourlyRate: effectiveRate.toFixed(2),
        formula: '参考差额 = ¥' + statutoryWage.toFixed(2) + ' - ¥' + ordinaryWage.toFixed(2) + ' = ¥' + displayGap.toFixed(2),
        overtimeNote: overtimeHours > 0
          ? '已识别 ' + overtimeLabel + ' 小时加班；工作日超 8 小时按 1.5 倍，周末按 2 倍，节假日按 3 倍估算。'
          : '本月暂未识别加班时长，参考应得与普通工资通常一致。'
      }
    });
  },

  _getRecordRate(record, dayRate, nightRate, fallbackRate) {
    const explicitRate = Number(record.rate);
    if (explicitRate > 0) return explicitRate;
    const shift = record.shift || record.shiftLabel || '白班';
    if (shift === '夜班' && nightRate > 0) return nightRate;
    if (shift === '白班' && dayRate > 0) return dayRate;
    return fallbackRate || dayRate || nightRate || 0;
  },

  // 切换视图模式
  switchView(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ viewMode: mode });
  },

  prevMonth() {
    const parts = this.data.currentMonth.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    this._setMonth(y, m - 1);
    this._loadRecords();
  },

  nextMonth() {
    const parts = this.data.currentMonth.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    this._setMonth(y, m + 1);
    this._loadRecords();
  },

  // 点击日历某天 - 快速添加
  onDayTap(e) {
    const date = e.currentTarget.dataset.date;
    const hasRecord = e.currentTarget.dataset.hasRecord === true || e.currentTarget.dataset.hasRecord === 'true';
    if (hasRecord) {
      const record = this.data.records.find(item => item.date === date);
      if (record) {
        this._openEditModal(record);
      }
      return;
    }
    this._openAddModal(date);
  },

  _openAddModal(date) {
    const defaultShift = this._normalizeShift(this._getStorage('default_shift', '白班'));
    const rate = defaultShift === '夜班'
      ? (this.data.defaultNightRate || this.data.defaultDayRate || '')
      : (this.data.defaultDayRate || '');
    // 重置提醒标记
    this._hasWeekendReminder = false;
    this._hasOvertimeReminder = false;
    this.setData({
      showModal: true,
      modalMode: 'add',
      editingDate: '',
      form: {
        date: date,
        hours: '',
        shift: defaultShift,
        rate: rate
      }
    });
    // 检查所选日期是否是周末
    this._checkWeekendReminder(date);
  },

  _openEditModal(record) {
    if (!record) return;
    this._hasWeekendReminder = false;
    this._hasOvertimeReminder = false;
    this.setData({
      showModal: true,
      modalMode: 'edit',
      editingDate: record.date,
      form: {
        date: record.date,
        hours: String(record.hours || ''),
        shift: record.shiftLabel || record.shift || '白班',
        rate: record.rate ? String(record.rate) : (this.data.defaultDayRate || '')
      }
    });
  },

  openAddModal() {
    const today = new Date();
    const dateStr =
      today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
    this._openAddModal(dateStr);
  },

  onRecordTap(e) {
    const date = e.currentTarget.dataset.date;
    const record = this.data.records.find(item => item.date === date);
    this._openEditModal(record);
  },

  // 检查周末提醒（独立触发，不与超时提醒冲突）
  _checkWeekendReminder(dateStr) {
    if (!this.data.reminders.weekend || !dateStr) return;
    if (this._hasWeekendReminder) return; // 防止重复弹出
    const date = new Date(dateStr);
    const weekday = date.getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    if (isWeekend) {
      this._hasWeekendReminder = true;
      wx.showModal({
        title: '周末加班提醒',
        content: '所选日期是周末，会按 200% 参考倍率估算。',
        showCancel: false,
        confirmText: '我知道了'
      });
    }
  },

  _hasShownOvertimeReminder() {
    try {
      return wx.getStorageSync(OVERTIME_REMINDER_SHOWN_KEY) === true;
    } catch (err) {
      return false;
    }
  },

  _markOvertimeReminderShown() {
    try {
      wx.setStorageSync(OVERTIME_REMINDER_SHOWN_KEY, true);
    } catch (err) {
      // 本地存储失败时仍允许本次提醒，不影响记工时主流程。
    }
  },

  // 检查超时提醒（独立触发，不与周末提醒冲突）
  _checkOvertimeReminder(hoursStr) {
    if (!this.data.reminders.overtime) return;
    const h = Number(hoursStr);
    if (isNaN(h)) return;
    if (h <= 8 || this._hasOvertimeReminder || this._hasShownOvertimeReminder()) return;

    this._hasOvertimeReminder = true;
    this._markOvertimeReminderShown();
    wx.showModal({
      title: '工时超时提醒',
      content: '今日工时超过 8 小时，超出部分会按工作日、周末或法定节假日的参考倍率估算。',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  closeAddModal() {
    if (this.data.submitting || this.data.deleting) return;
    this.setData({ showModal: false });
  },

  noop() {},

  onDateChange(e) {
    const newDate = e.detail.value;
    this.setData({ 'form.date': newDate });
    // 日期变更时重新检查周末提醒
    this._hasWeekendReminder = false;
    this._checkWeekendReminder(newDate);
  },

  onHoursInput(e) {
    const val = e.detail.value;
    this.setData({ 'form.hours': val });
    // 检查超时提醒（与周末提醒独立）
    this._checkOvertimeReminder(val);
  },

  onRateInput(e) {
    const val = e.detail.value;
    this.setData({ 'form.rate': val });
    // Save rate to storage based on shift type
    if (this.data.form.shift === '白班') {
      wx.setStorageSync('hourly_rate', val);
    } else if (this.data.form.shift === '夜班') {
      wx.setStorageSync('night_rate', val);
    }
    this.setData({
      defaultDayRate: wx.getStorageSync('hourly_rate') || '',
      defaultNightRate: wx.getStorageSync('night_rate') || ''
    });
  },

  // 班次切换 - 自动填充对应时薪
  onShiftSelect(e) {
    const shift = e.currentTarget.dataset.shift;
    let rate = this.data.form.rate;
    if (shift === '白班' && this.data.defaultDayRate) {
      rate = this.data.defaultDayRate;
    } else if (shift === '夜班' && this.data.defaultNightRate) {
      rate = this.data.defaultNightRate;
    }
    this.setData({
      'form.shift': shift,
      'form.rate': rate
    });
  },

  submitRecord() {
    const form = this.data.form;
    const date = form.date;
    const hours = form.hours;
    const shift = form.shift;
    const rate = form.rate;

    if (!date) {
      toast('请选择日期');
      return;
    }

    const h = Number(hours);
    if (!hours || isNaN(h) || h < 0.5 || h > 24) {
      toast('工时请输入 0.5-24 之间的数字（支持半小时）');
      return;
    }
    // Round to nearest 0.5
    const roundedH = Math.round(h * 2) / 2;

    const r = Number(rate);
    if (!rate || isNaN(r) || r < 1 || r > 500) {
      toast('时薪请输入 1-500 之间的数字');
      return;
    }

    // 记录普通时薪工资；参考应得和差额在月度统计中按规则单独计算。
    const wage = this._calculateWage(date, roundedH, r);

    this.setData({ submitting: true });
    apiRequest('/workhours', {
      method: 'POST',
      data: {
        date: date,
        hours: roundedH,
        shift: shift,
        rate: r,
        wage: wage
      }
    })
      .then(() => {
        this.setData({ submitting: false, showModal: false, modalMode: 'add', editingDate: '' });
        toast('保存成功', 'success');
        this._loadRecords();
      })
      .catch(err => {
        this.setData({ submitting: false });
        toast(err.message || '保存失败');
      });
  },

  deleteRecord() {
    const recordDate = this.data.editingDate || this.data.form.date;
    if (!recordDate || this.data.modalMode !== 'edit') return;

    wx.showModal({
      title: '删除这条记录？',
      content: '删除后，本月工时和工资统计会同步更新。',
      confirmText: '删除',
      confirmColor: '#D93025',
      success: res => {
        if (!res.confirm) return;
        this.setData({ deleting: true });
        apiRequest('/workhours', {
          method: 'DELETE',
          data: { recordDate }
        })
          .then(() => {
            this.setData({ deleting: false, showModal: false, modalMode: 'add', editingDate: '' });
            toast('已删除', 'success');
            this._loadRecords();
          })
          .catch(err => {
            this.setData({ deleting: false });
            toast(err.message || '删除失败');
          });
      }
    });
  },

  // 计算普通时薪工资
  _calculateWage(dateStr, hours, rate) {
    return Number((hours * rate).toFixed(2));
  }
});
