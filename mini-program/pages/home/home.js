// 首页：功能菜单
const { apiRequest, isLoggedIn, toast } = require('../../utils/api');
const { applyPageFontScale } = require('../../utils/fontScale');

const app = getApp();

const LOGIN_REQUIRED_PATHS = [
  '/pages/workhours/workhours',
  '/pages/salary/salary',
  '/pages/records/records'
];

function currentMonth() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function formatHours(hours) {
  const value = Number(hours) || 0;
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

Page({
  data: {
    fontScaleClass: '',
    dashboard: {
      loaded: false,
      signedIn: false,
      todayLogged: false,
      monthDays: 0,
      monthHours: '0',
      status: '登录后查看本月记录',
      actionText: '去记录'
    },
    primaryCards: [
      {
        key: 'workhours',
        icon: '时',
        title: '记工时',
        desc: '每天记录工时',
        path: '/pages/workhours/workhours',
        isTab: true,
        tone: 'blue'
      },
      {
        key: 'salary',
        icon: '账',
        title: '月度账单',
        desc: '工资花销一页看',
        path: '/pages/salary/salary',
        isTab: true,
        tone: 'green'
      },
      {
        key: 'contract',
        icon: '合',
        title: '合同体检',
        desc: '核对常见条款',
        path: '/pages/contract/contract',
        isTab: false,
        tone: 'amber'
      },
      {
        key: 'records',
        icon: '记',
        title: '检测记录',
        desc: '查看历史结果',
        path: '/pages/records/records',
        isTab: false,
        tone: 'slate'
      }
    ],
    secondaryTools: [
      {
        key: 'compensation',
        title: '金额参考测算',
        desc: '根据已填写信息生成参考金额',
        path: '/pages/compensation/compensation',
        isTab: false
      },
      {
        key: 'materials',
        title: '材料整理',
        desc: '整理工资、工时、合同相关材料',
        path: '/pages/materials/materials',
        isTab: false
      }
    ]
  },

  onLoad() {
    this._applyFontScale();
    this._loadDashboard();
  },

  onShow() {
    this._applyFontScale();
    this._loadDashboard();
  },

  _applyFontScale() {
    applyPageFontScale(this, app);
  },

  _loadDashboard() {
    if (!isLoggedIn()) {
      this.setData({
        dashboard: {
          loaded: true,
          signedIn: false,
          todayLogged: false,
          monthDays: 0,
          monthHours: '0',
          status: '登录后查看本月记录',
          actionText: '去登录'
        }
      });
      return;
    }

    const month = currentMonth();
    const today = todayStr();
    apiRequest('/workhours/month/' + month)
      .then(data => {
        const records = Array.isArray(data) ? data : (data && data.records) || [];
        const totalHours = records.reduce((sum, item) => sum + (Number(item.hours) || 0), 0);
        const todayLogged = records.some(item => item.date === today || item.recordDate === today);
        this.setData({
          dashboard: {
            loaded: true,
            signedIn: true,
            todayLogged,
            monthDays: records.length,
            monthHours: formatHours(totalHours),
            status: todayLogged ? '今日已记录' : '今日还未记录工时',
            actionText: todayLogged ? '继续查看' : '去记录'
          }
        });
      })
      .catch(() => {
        this.setData({
          dashboard: {
            loaded: true,
            signedIn: true,
            todayLogged: false,
            monthDays: 0,
            monthHours: '0',
            status: '本月摘要暂时未加载',
            actionText: '去记录'
          }
        });
      });
  },

  onTapEntry(e) {
    const { path, tab } = e.currentTarget.dataset;
    if (!path) return;
    if (LOGIN_REQUIRED_PATHS.indexOf(path) >= 0 && !isLoggedIn()) {
      wx.navigateTo({
        url: '/pages/login/login?redirect=' + encodeURIComponent(path)
      });
      return;
    }
    if (tab) {
      wx.switchTab({
        url: path,
        fail() {
          toast('页面跳转失败');
        }
      });
      return;
    }

    wx.navigateTo({
      url: path,
      fail() {
        toast('页面暂未开放');
      }
    });
  }
});
