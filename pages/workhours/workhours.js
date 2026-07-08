// 记工时页：按月记录每日工时与工资
// 功能：日历视图 / 法定差额 / 周末加班费 / 白班夜班时薪 / 周末和超时提醒
const { apiRequest, toast } = require('../../utils/api');

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

// 2026年法定节假日（简化版，应从后端动态获取）
const HOLIDAYS_2026 = [
  '2026-01-01', '2026-02-08', '2026-02-09', '2026-02-10', '2026-02-11',
  '2026-02-12', '2026-02-13', '2026-02-14', '2026-04-04', '2026-04-05',
  '2026-04-06', '2026-05-01', '2026-05-02', '2026-05-03', '2026-06-19',
  '2026-06-20', '2026-06-21', '2026-09-25', '2026-09-26', '2026-09-27',
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05',
  '2026-10-06', '2026-10-07'
];

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
      overtimePay: '0.00'
    },
    // 法定差额（工时）
    diff: {
      standard: STANDARD_MONTHLY_HOURS,
      actual: 0,
      diff: 0,
      diffLabel: '0',
      isOvertime: false
    },
    // 三层工资模型
    wageModel: {
      actualWage: '0.00',       // 第一层：工厂实发工资
      statutoryWage: '0.00',    // 第二层：法定应得工资
      wageDiff: '0.00',         // 第三层：差额工资
      diffLabel: '+0.00',
      isPositive: false,
      hourlyRate: '0.00'
    },
    // 弹窗状态
    showModal: false,
    submitting: false,
    loading: false,
    // 班次选项
    shiftOptions: SHIFT_OPTIONS,
    // 表单数据
    form: {
      date: '',
      hours: '',
      shift: '白班',
      rate: '',
      nightRate: ''
    },
    // 默认白班/夜班时薪（从设置读取）
    defaultDayRate: '',
    defaultNightRate: '',
    // 提醒开关
    reminders: {
      weekend: true,    // 周末记工时提醒
      overtime: true    // 超 8 小时提醒
    }
  },

  onLoad() {
    const now = new Date();
    this._setMonth(now.getFullYear(), now.getMonth() + 1);
    this._applyFontScale();
    this._loadRateSettings();
  },

  onShow() {
    if (this.data.currentMonth) {
      this._loadRecords();
    }
    this._applyFontScale();
    this._loadRateSettings();
  },

  // 加载白班/夜班时薪设置
  _loadRateSettings() {
    const dayRate = wx.getStorageSync('yunke_day_rate') || '';
    const nightRate = wx.getStorageSync('yunke_night_rate') || '';
    const weekendReminder = wx.getStorageSync('yunke_reminder_weekend');
    const overtimeReminder = wx.getStorageSync('yunke_reminder_overtime');
    this.setData({
      defaultDayRate: dayRate,
      defaultNightRate: nightRate,
      'reminders.weekend': weekendReminder !== false,
      'reminders.overtime': overtimeReminder !== false
    });
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
      const isHoliday = HOLIDAYS_2026.indexOf(dateStr) !== -1;
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
    if (this.data.loading) return;
    this.setData({ loading: true });
    apiRequest('/workhours/month/' + this.data.currentMonth)
      .then(data => {
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

  // 计算统计数据 + 三层工资模型
  _computeStats(records) {
    let days = records.length;
    let totalHours = 0;
    let actualWage = 0;  // 第一层：工厂实发工资

    //用于计算法定应得工资
    let weekdayNormalHours = 0;  // 工作日正常工时（每天最多8小时）
    let weekdayOvertimeHours = 0;  // 工作日加班工时
    let weekendHours = 0;  // 周末工时
    let holidayHours = 0;  // 节假日工时

    // 获取时薪（优先用白班时薪，若没有则用第一条记录的时薪）
    const dayRate = Number(this.data.defaultDayRate) || 0;
    const nightRate = Number(this.data.defaultNightRate) || 0;
    let effectiveRate = dayRate || nightRate;

    records.forEach(r => {
      const h = Number(r.hours) || 0;
      const rate = Number(r.rate) || 0;
      totalHours += h;
      actualWage += Number(r.wage) || 0;

      //如果没有全局时薪，用第一条记录的时薪
      if (!effectiveRate && rate) {
        effectiveRate = rate;
      }

      // 判断日期类型
      const date = new Date(r.date);
      const weekday = date.getDay();
      const isWeekend = weekday === 0 || weekday === 6;
      const isHoliday = HOLIDAYS_2026.indexOf(r.date) !== -1;

      if (isHoliday) {
        holidayHours += h;
      } else if (isWeekend) {
        weekendHours += h;
      } else {
        // 工作日：区分正常工时和加班工时
        if (h > 8) {
          weekdayNormalHours += 8;
          weekdayOvertimeHours += (h - 8);
        } else {
          weekdayNormalHours += h;
        }
      }
    });

    //第二层：法定标准应得工资
    // 基本工资 = 时薪 × min(174, 工作日正常工时)
    const statutoryBaseHours = Math.min(STANDARD_MONTHLY_HOURS, weekdayNormalHours);
    const statutoryBaseWage = effectiveRate * statutoryBaseHours;

    //法定加班费（包含基础1倍 + 额外倍率）
    const weekdayOvertimePay = weekdayOvertimeHours * effectiveRate * 1.5;  // 工作日加班 150%
    const weekendOvertimePay = weekendHours * effectiveRate * 2.0;  // 周末加班 200%
    const holidayOvertimePay = holidayHours * effectiveRate * 3.0;  // 节假日加班 300%

    const statutoryWage = statutoryBaseWage + weekdayOvertimePay + weekendOvertimePay + holidayOvertimePay;

    // 第三层：法定差额工资
    const wageDiff = statutoryWage - actualWage;

    // 格式化显示
    const hoursStr = totalHours % 1 === 0 ? String(totalHours) : totalHours.toFixed(1);
    this.setData({
      stats: {
        days: days,
        hours: hoursStr,
        wage: actualWage.toFixed(2),
        overtimeHours: (weekdayOvertimeHours + weekendHours + holidayHours) % 1 === 0
          ? String(weekdayOvertimeHours + weekendHours + holidayHours)
          : (weekdayOvertimeHours + weekendHours + holidayHours).toFixed(1),
        overtimePay: (weekdayOvertimePay + weekendOvertimePay + holidayOvertimePay).toFixed(2)
      },
      // 三层工资模型
      wageModel: {
        actualWage: actualWage.toFixed(2),          // 第一层：工厂实发工资
        statutoryWage: statutoryWage.toFixed(2),    // 第二层：法定应得工资
        wageDiff: wageDiff.toFixed(2),              // 第三层：差额工资
        diffLabel: wageDiff >= 0 ? '+' + wageDiff.toFixed(2) : wageDiff.toFixed(2),
        isPositive: wageDiff >= 0,                  // 差额为正表示工厂少发
        hourlyRate: effectiveRate.toFixed(2)
      },
      // 保留原工时差额数据（用于日历等）
      diff: {
        standard: STANDARD_MONTHLY_HOURS,
        actual: totalHours,
        diff: Math.abs(totalHours - STANDARD_MONTHLY_HOURS),
        diffLabel: (totalHours >= STANDARD_MONTHLY_HOURS ? '+' : '-')
          + Math.abs(totalHours - STANDARD_MONTHLY_HOURS).toFixed(1) + 'h',
        isOvertime: totalHours > STANDARD_MONTHLY_HOURS
      }
    });
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
    const hasRecord = e.currentTarget.dataset.hasRecord;
    if (hasRecord) return; // 已有记录，不操作
    // 打开添加弹窗并预填日期
    const rate = this.data.defaultDayRate || '';
    // 重置提醒标记
    this._hasWeekendReminder = false;
    this._hasOvertimeReminder = false;
    this.setData({
      showModal: true,
      form: {
        date: date,
        hours: '',
        shift: '白班',
        rate: rate,
        nightRate: this.data.defaultNightRate || ''
      }
    });
    // 检查所选日期是否是周末
    this._checkWeekendReminder(date);
  },

  openAddModal() {
    const today = new Date();
    const dateStr =
      today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
    // 重置提醒标记
    this._hasWeekendReminder = false;
    this._hasOvertimeReminder = false;
    this.setData({
      showModal: true,
      form: {
        date: dateStr,
        hours: '',
        shift: '白班',
        rate: this.data.defaultDayRate || '',
        nightRate: this.data.defaultNightRate || ''
      }
    });
    // 检查今天是否是周末
    this._checkWeekendReminder(dateStr);
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
        content: '所选日期是周末，按加班费 200% 计算。',
        showCancel: false,
        confirmText: '我知道了'
      });
    }
  },

  // 检查超时提醒（独立触发，不与周末提醒冲突）
  _checkOvertimeReminder(hoursStr) {
    if (!this.data.reminders.overtime) return;
    const h = Number(hoursStr);
    if (isNaN(h)) return;
    if (h > 8) {
      if (this._hasOvertimeReminder) return; // 防止重复弹出
      this._hasOvertimeReminder = true;
      wx.showModal({
        title: '工时超时提醒',
        content: '今日工时超过 8 小时，超出部分按加班费计算（工作日 150%、周末 200%、法定节假日 300%）。',
        showCancel: false,
        confirmText: '我知道了'
      });
    } else {
      // 工时降回 8 以下，重置标记，允许下次再提醒
      this._hasOvertimeReminder = false;
    }
  },

  closeAddModal() {
    if (this.data.submitting) return;
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
    this.setData({ 'form.rate': e.detail.value });
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
    if (!hours || isNaN(h) || h < 1 || h > 24) {
      toast('工时请输入 1-24 之间的数字');
      return;
    }

    const r = Number(rate);
    if (!rate || isNaN(r) || r < 1 || r > 500) {
      toast('时薪请输入 1-500 之间的数字');
      return;
    }

    // 计算工资金额（含加班费）
    const wage = this._calculateWage(date, h, r);

    this.setData({ submitting: true });
    apiRequest('/workhours', {
      method: 'POST',
      data: {
        date: date,
        hours: h,
        shift: shift,
        rate: r,
        wage: wage
      }
    })
      .then(() => {
        this.setData({ submitting: false, showModal: false });
        toast('保存成功', 'success');
        this._loadRecords();
      })
      .catch(err => {
        this.setData({ submitting: false });
        toast(err.message || '保存失败');
      });
  },

  // 计算工资（含加班费）
  _calculateWage(dateStr, hours, rate) {
    const date = new Date(dateStr);
    const weekday = date.getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const isHoliday = HOLIDAYS_2026.indexOf(dateStr) !== -1;

    let wage = 0;
    if (hours <= 8) {
      wage = hours * rate;
    } else {
      // 前 8 小时正常工资
      wage = 8 * rate;
      const overtime = hours - 8;
      let multiplier = OVERTIME_RATE.weekday;
      if (isHoliday) multiplier = OVERTIME_RATE.holiday;
      else if (isWeekend) multiplier = OVERTIME_RATE.weekend;
      wage += overtime * rate * multiplier;
    }
    return Number(wage.toFixed(2));
  }
});
