// 首页：今日工作台
const { apiRequest, isLoggedIn, toast } = require('../../utils/api');

const app = getApp();

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
      hint: '登录后可查看本月工时摘要'
    },
    primaryAction: {
      key: 'workhours',
      title: '先记一笔工时',
      subtitle: '每天记清楚，月底核对工资更踏实',
      path: '/pages/workhours/workhours',
      isTab: true
    },
    tools: [
      {
        key: 'contract',
        title: '合同条款自查',
        subtitle: '核对试用期、工资、工时等常见条款',
        tag: '合同',
        path: '/pages/contract/contract',
        isTab: false
      },
      {
        key: 'compensation',
        title: '金额参考测算',
        subtitle: '根据已填写信息生成参考金额',
        tag: '测算',
        path: '/pages/compensation/compensation',
        isTab: false
      },
      {
        key: 'dispute',
        title: '材料整理',
        subtitle: '整理工资、工时、合同相关材料',
        tag: '材料',
        path: '/pages/dispute/dispute',
        isTab: false
      }
    ],
    quickLinks: [
      {
        key: 'salary',
        title: '工资核对',
        subtitle: '到账、扣款、花销',
        path: '/pages/salary/salary',
        isTab: true
      },
      {
        key: 'records',
        title: '我的记录',
        subtitle: '历史自查和测算',
        path: '/pages/records/records',
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

  _loadDashboard() {
    if (!isLoggedIn()) {
      this.setData({
        dashboard: {
          loaded: true,
          signedIn: false,
          todayLogged: false,
          monthDays: 0,
          monthHours: '0',
          hint: '登录后可查看本月工时摘要'
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
            hint: todayLogged ? '今天已记录，月底核对会更清楚' : '今天还没记工时，先补一笔'
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
            hint: '工时摘要暂时加载失败，不影响继续记录'
          }
        });
      });
  },

  onTapEntry(e) {
    const { path, tab } = e.currentTarget.dataset;
    if (!path) return;
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
