const { apiRequest, toast } = require('../../utils/api');

const app = getApp();

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'contract', label: '合同自查' },
  { key: 'compensation', label: '金额测算' }
];

const LEVEL_LABEL = {
  critical: '重点',
  high: '较高',
  medium: '一般',
  low: '提示'
};

function fontScaleClass(scale) {
  if (scale === 'large') return 'font-scale-large';
  if (scale === 'extra-large') return 'font-scale-extra-large';
  if (scale === 'small') return 'font-scale-small';
  return '';
}

function parseDetail(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = n => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

function cleanDisplayText(value, fallback = '') {
  const text = String(value || '').replace(/\r/g, '').split('\n')
    .map(line => line.trim())
    .filter(line => line)
    .filter(line => !/^(system|assistant|developer|user)\s*[:：]/i.test(line))
    .filter(line => !/(提示词|输出\s*JSON|JSON\s*格式|你是.*助手|作为.*模型|不要解释|严格按照)/i.test(line))
    .join('\n');
  return text || fallback;
}

function shortText(value, max = 96) {
  const text = cleanDisplayText(value, '');
  return text.length > max ? text.slice(0, max) + '...' : text;
}

function getIssueCount(detail, resultText) {
  const issues = detail && Array.isArray(detail.issues) ? detail.issues : [];
  if (issues.length) return issues.length;
  const summary = detail && detail.summary ? detail.summary : {};
  const total = summary.totalIssues !== undefined ? summary.totalIssues : summary.total;
  if (total !== undefined) return Number(total) || 0;
  const matched = String(resultText || '').match(/(\d+)\s*[个处]/);
  return matched ? Number(matched[1]) || 0 : 0;
}

function normalizeIssues(detail) {
  const issues = detail && Array.isArray(detail.issues) ? detail.issues : [];
  return issues.map(item => {
    const level = item.severity || item.level || 'medium';
    return {
      level,
      levelLabel: LEVEL_LABEL[level] || '提示',
      title: cleanDisplayText(item.issue || item.type || '待核对事项'),
      type: cleanDisplayText(item.type || '条款'),
      suggestion: cleanDisplayText(item.suggestion || item.law || '请结合合同原文、工资记录和考勤记录核对。'),
      law: cleanDisplayText(item.law || item.lawText || '')
    };
  });
}

function normalizeArticles(detail) {
  const result = detail && (detail.result || detail);
  const articles = detail && Array.isArray(detail.legalArticles)
    ? detail.legalArticles
    : (result && Array.isArray(result.legalArticles) ? result.legalArticles : []);
  return articles.slice(0, 6).map(item => ({
    title: cleanDisplayText(item.title || item.source || '相关规则'),
    source: cleanDisplayText(item.source || item.effectiveLevel || ''),
    url: item.pkulawUrl || item.url || '',
    sourceLabel: item.pkulawUrl || item.url ? '已匹配原文链接' : '公开规则信息'
  }));
}

function normalizeCompensationItems(detail) {
  const result = detail && (detail.result || detail);
  const items = result && Array.isArray(result.items)
    ? result.items
    : (result && Array.isArray(result.details) ? result.details : []);
  return items.map(item => ({
    name: cleanDisplayText(item.name || item.item || '测算项目'),
    amount: Number(item.amount || 0).toFixed(2),
    description: cleanDisplayText(item.description || item.formula || item.basis || '')
  }));
}

function normalizeRecord(record) {
  const resultText = cleanDisplayText(record.result_text || record.resultText || '');
  const resultDetail = record.result_detail || record.resultDetail;
  const createdAt = record.created_at || record.createdAt;
  const detail = parseDetail(resultDetail);
  const isContract = record.type === 'contract';
  const isCompensation = record.type === 'compensation';
  const typeLabel = isContract ? '合同自查' : isCompensation ? '金额测算' : '记录';
  const typeClass = isContract ? 'contract' : isCompensation ? 'compensation' : 'default';
  const issueItems = isContract ? normalizeIssues(detail) : [];
  const legalArticles = normalizeArticles(detail);
  const compensationItems = isCompensation ? normalizeCompensationItems(detail) : [];
  const issueCount = isContract ? getIssueCount(detail, resultText) : 0;
  const originalPreview = shortText(record.description || '', 180);
  const sourceStatus = legalArticles.length > 0
    ? (legalArticles.some(item => item.url) ? '已匹配公开规则原文链接' : '已匹配公开规则信息')
    : '使用本地常见规则自查';

  let summary = resultText;
  if (isContract) {
    summary = issueCount > 0 ? issueCount + ' 个待核对事项' : '未发现明显待核对事项';
  }
  if (isCompensation && detail) {
    const result = detail.result || detail;
    const totalAmount = result.totalAmount !== undefined ? result.totalAmount : result.total;
    if (totalAmount !== undefined) summary = '参考金额 ¥' + Number(totalAmount || 0).toFixed(2);
  }
  if (!summary) summary = '查看本次记录';

  return Object.assign({}, record, {
    typeLabel,
    typeClass,
    summary,
    detail,
    issueCount,
    issueItems,
    legalArticles,
    compensationItems,
    sourceStatus,
    hasDetail: !!detail,
    result_text: resultText,
    result_detail: resultDetail,
    description: shortText(record.description || typeLabel, isContract ? 120 : 96),
    originalPreview,
    created_at: createdAt,
    createdAtText: formatDate(createdAt)
  });
}

Page({
  data: {
    filters: FILTERS,
    activeType: 'all',
    records: [],
    selectedRecord: null,
    detailModal: false,
    detailOriginalExpanded: false,
    detailLoading: false,
    loading: false,
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: false,
    fontScaleClass: ''
  },

  onLoad(options) {
    const initialType = ['contract', 'compensation'].indexOf(options && options.type) >= 0 ? options.type : 'all';
    this.setData({
      activeType: initialType,
      fontScaleClass: fontScaleClass((app.globalData && app.globalData.fontScale) || 'medium')
    });
    this.loadRecords(true);
  },

  onShow() {
    this.setData({
      fontScaleClass: fontScaleClass((app.globalData && app.globalData.fontScale) || 'medium')
    });
  },

  onPullDownRefresh() {
    this.loadRecords(true).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadRecords(false);
    }
  },

  changeFilter(e) {
    const type = e.currentTarget.dataset.type || 'all';
    if (type === this.data.activeType) return;
    this.setData({ activeType: type, records: [], page: 1, hasMore: false });
    this.loadRecords(true);
  },

  loadRecords(reset) {
    if (!app.requireLogin('/pages/records/records')) {
      return Promise.resolve();
    }
    const page = reset ? 1 : this.data.page + 1;
    const params = ['page=' + page, 'pageSize=' + this.data.pageSize];
    if (this.data.activeType !== 'all') {
      params.push('type=' + encodeURIComponent(this.data.activeType));
    }

    this.setData({ loading: true });
    return apiRequest('/records?' + params.join('&'))
      .then(data => {
        const items = data && Array.isArray(data.items) ? data.items : [];
        const nextRecords = items.map(normalizeRecord);
        this.setData({
          records: reset ? nextRecords : this.data.records.concat(nextRecords),
          page: data && data.page ? data.page : page,
          total: data && data.total ? data.total : nextRecords.length,
          hasMore: !!(data && data.hasMore),
          loading: false
        });
      })
      .catch(err => {
        this.setData({ loading: false });
        toast(err.message || '记录加载失败');
      });
  },

  showDetail(e) {
    const id = String(e.currentTarget.dataset.id || '');
    const localRecord = this.data.records.find(item => String(item.id) === id);
    if (!localRecord) return;

    this.setData({
      selectedRecord: localRecord,
      detailModal: true,
      detailOriginalExpanded: false,
      detailLoading: true
    });
    apiRequest('/records/' + id)
      .then(data => {
        const selectedRecord = normalizeRecord(Object.assign({}, localRecord, data || {}));
        this.setData({ selectedRecord, detailLoading: false });
      })
      .catch(() => {
        this.setData({ detailLoading: false });
        toast('详情加载失败，请稍后重试');
      });
  },

  closeDetail() {
    this.setData({ detailModal: false, selectedRecord: null, detailLoading: false, detailOriginalExpanded: false });
  },

  toggleOriginalText() {
    this.setData({ detailOriginalExpanded: !this.data.detailOriginalExpanded });
  },

  goRelatedPage() {
    const record = this.data.selectedRecord;
    if (!record) return;
    this.closeDetail();
    if (record.type === 'compensation') {
      wx.navigateTo({ url: '/pages/compensation/compensation' });
      return;
    }
    if (record.type === 'contract') {
      wx.navigateTo({ url: '/pages/contract/contract' });
      return;
    }
    toast('暂不支持打开该记录类型');
  },

  copyArticleLink(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) {
      toast('暂无原文链接');
      return;
    }
    wx.setClipboardData({
      data: url,
      success: () => toast('原文链接已复制', 'success'),
      fail: () => toast('复制失败，请稍后重试')
    });
  },

  deleteRecord() {
    const record = this.data.selectedRecord;
    if (!record) return;
    wx.showModal({
      title: '删除记录',
      content: '确定删除这条记录吗？删除后无法恢复。',
      confirmText: '删除',
      confirmColor: '#E53935',
      success: res => {
        if (!res.confirm) return;
        apiRequest('/records/' + record.id, { method: 'DELETE' })
          .then(() => {
            toast('已删除', 'success');
            this.setData({
              detailModal: false,
              selectedRecord: null,
              records: this.data.records.filter(item => item.id !== record.id),
              total: Math.max(0, this.data.total - 1)
            });
          })
          .catch(err => toast(err.message || '删除失败'));
      }
    });
  }
});
