// pages/legal/legal.js
const { apiRequest, toast } = require('../../utils/api');

const app = getApp();

const HOT_QUESTIONS = [
  '试用期多久才合法？',
  '公司拖欠工资怎么办？',
  '加班费怎么算？',
  '被辞退能拿多少补偿？',
  '未签劳动合同有赔偿吗？',
  '公司不给交社保怎么办？',
  '辞职需要提前多久说？',
  '工伤怎么认定？'
];

const CATEGORY_ICONS = {
  'contract': '📄',
  'wage': '💰',
  'overtime': '⏰',
  'social': '🏥',
  'termination': '📤',
  'dispute': '⚖️',
  'other': '📋'
};

Page({
  data: {
    fontScaleClass: '',
    question: '',
    searching: false,
    hasSearched: false,
    results: [],
    totalResults: 0,
    categories: [],
    hotQuestions: HOT_QUESTIONS,
    categoryIcons: CATEGORY_ICONS,
    showDetail: false,
    currentArticle: null
  },

  onLoad() {
    this._applyFontScale();
    this._loadCategories();
  },

  onShow() {
    this._applyFontScale();
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

  _loadCategories() {
    apiRequest('/legal/categories')
      .then(cats => {
        this.setData({ categories: cats || [] });
      })
      .catch(() => {
        // Fallback categories
        this.setData({
          categories: [
            { key: 'contract', label: '劳动合同' },
            { key: 'wage', label: '工资报酬' },
            { key: 'overtime', label: '加班工时' },
            { key: 'social', label: '社会保险' },
            { key: 'termination', label: '解除补偿' },
            { key: 'dispute', label: '争议处理' }
          ]
        });
      });
  },

  onQuestionInput(e) {
    this.setData({ question: e.detail.value });
  },

  clearQuestion() {
    this.setData({ question: '', hasSearched: false, results: [] });
  },

  onHotQuestionTap(e) {
    const q = e.currentTarget.dataset.q;
    this.setData({ question: q }, () => {
      this.onSearch();
    });
  },

  onCategoryTap(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({ searching: true, hasSearched: true });
    
    apiRequest('/legal/articles?category=' + cat)
      .then(data => {
        const results = Array.isArray(data) ? data : [];
        this.setData({
          searching: false,
          results: results,
          totalResults: results.length
        });
      })
      .catch(err => {
        this.setData({ searching: false, results: [], totalResults: 0 });
        toast(err.message || '加载失败');
      });
  },

  onSearch() {
    const question = this.data.question.trim();
    if (!question) {
      toast('请输入要查询的问题');
      return;
    }

    this.setData({ searching: true, hasSearched: true });

    apiRequest('/legal/ask', {
      method: 'POST',
      data: { question: question, limit: 10 }
    })
      .then(data => {
        const results = data && data.relatedArticles ? data.relatedArticles : [];
        this.setData({
          searching: false,
          results: results,
          totalResults: data && data.totalResults != null ? data.totalResults : results.length
        });
      })
      .catch(err => {
        this.setData({ searching: false, results: [], totalResults: 0 });
        toast(err.message || '搜索失败');
      });
  },

  onArticleTap(e) {
    const article = e.currentTarget.dataset.article;
    if (!article) return;
    this.setData({ showDetail: true, currentArticle: article });
  },

  closeDetail() {
    this.setData({ showDetail: false, currentArticle: null });
  },

  onViewOriginal(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) {
      toast('暂无原文链接');
      return;
    }
    wx.setClipboardData({
      data: url,
      success: () => {
        toast('链接已复制');
      }
    });
  }
});
