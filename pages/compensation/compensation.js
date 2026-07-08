const { apiRequest, toast } = require('../../utils/api');

// 默认问题列表（接口失败时使用）
const DEFAULT_QUESTIONS = [
  {
    id: 'Q1',
    text: '你是否已经离职？',
    type: 'radio',
    options: [
      { value: 'yes', label: '是' },
      { value: 'no', label: '否' }
    ]
  },
  {
    id: 'Q2',
    text: '你在这家公司工作了几年？',
    type: 'digit',
    unit: '年',
    min: 0,
    max: 40,
    placeholder: '请输入工作年数',
    errorMsg: '请输入0~40之间的年数'
  },
  {
    id: 'Q3',
    text: '你每个月工资多少？',
    type: 'digit',
    unit: '元',
    min: 0,
    max: 100000,
    placeholder: '请输入税前月工资',
    errorMsg: '请输入0~100000之间的金额'
  },
  {
    id: 'Q4',
    text: '是否签订了劳动合同？',
    type: 'radio',
    options: [
      { value: 'yes', label: '是' },
      { value: 'no', label: '否' },
      { value: 'unknown', label: '不清楚' }
    ]
  },
  {
    id: 'Q5',
    text: '离职原因是什么？',
    type: 'radio',
    options: [
      { value: 'company_terminate', label: '公司单方面辞退' },
      { value: 'self_resign', label: '自己主动辞职' },
      { value: 'contract_expire', label: '合同到期未续签' },
      { value: 'forced_termination', label: '被迫离职（公司违法）' }
    ]
  }
];

// 建议保全的证据清单
const EVIDENCE_LIST = [
  '劳动合同',
  '工资流水',
  '考勤记录',
  '工作证',
  '社保缴纳记录',
  '解除劳动关系证明'
];

// 处理流程
const PROCESS_STEPS = [
  '保全证据',
  '与用人单位协商沟通',
  '拨打12333咨询',
  '申请仲裁',
  '向法院起诉'
];

Page({
  data: {
    currentIndex: 0,
    questions: [],
    answers: {},
    loading: true,
    submitting: false,
    error: '',
    showResult: false,
    result: null,
    evidenceList: EVIDENCE_LIST,
    processSteps: PROCESS_STEPS,
    savingRecord: false,
    // 派生数据
    currentQuestion: null,
    canNext: false,
    progressPercent: 0,
    isLastQuestion: false
  },

  onLoad() {
    this.loadQuestions();
  },

  // 加载问题列表
  loadQuestions() {
    this.setData({ loading: true });
    apiRequest('/compensation/questions')
      .then(data => {
        // 兼容多种返回格式
        const questions = (data && data.questions) || (Array.isArray(data) ? data : null) || DEFAULT_QUESTIONS;
        this.setData({ questions, loading: false });
        this._refreshComputed();
      })
      .catch(() => {
        // 接口失败时使用默认问题
        this.setData({ questions: DEFAULT_QUESTIONS, loading: false });
        this._refreshComputed();
        toast('问题加载失败，已使用默认问题');
      });
  },

  // 单选答案变化
  onRadioChange(e) {
    const questionId = e.currentTarget.dataset.qid;
    const value = e.detail.value;
    this.setData({
      ['answers.' + questionId]: value
    });
    this._refreshComputed();
  },

  // 数字输入
  onDigitInput(e) {
    const questionId = e.currentTarget.dataset.qid;
    const value = e.detail.value;
    const question = this.data.questions.find(q => q.id === questionId);
    let error = '';
    if (value !== '') {
      const num = Number(value);
      if (isNaN(num)) {
        error = '请输入有效数字';
      } else if (question && (num < question.min || num > question.max)) {
        error = question.errorMsg || ('请输入' + question.min + '~' + question.max + '之间的数值');
      }
    }
    this.setData({
      ['answers.' + questionId]: value,
      error: error
    });
    this._refreshComputed();
  },

  // 上一题
  prev() {
    if (this.data.currentIndex > 0) {
      this.setData({ currentIndex: this.data.currentIndex - 1, error: '' });
      this._refreshComputed();
    }
  },

  // 下一题或提交
  next() {
    if (!this.data.canNext) return;
    if (this.data.currentIndex < this.data.questions.length - 1) {
      this.setData({ currentIndex: this.data.currentIndex + 1, error: '' });
      this._refreshComputed();
    } else {
      this.submit();
    }
  },

  // 提交计算
  submit() {
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    apiRequest('/compensation/calculate', {
      method: 'POST',
      data: { answers: this.data.answers }
    })
      .then(result => {
        this.setData({ submitting: false, showResult: true, result });
      })
      .catch(err => {
        this.setData({ submitting: false });
        toast(err.message || '计算失败，请稍后重试');
      });
  },

  // 保存检测记录（后端 /compensation/calculate 已自动保存记录，此处仅提示）
  saveRecord() {
    if (!this.data.result) {
      toast('请先完成补偿估算');
      return;
    }
    toast('记录已保存', 'success');
  },

  // 重新估算
  restart() {
    this.setData({
      currentIndex: 0,
      answers: {},
      showResult: false,
      result: null,
      error: ''
    });
    this._refreshComputed();
  },

  // 更新派生数据
  _refreshComputed() {
    const questions = this.data.questions;
    const idx = this.data.currentIndex;
    const currentQuestion = questions[idx] || null;
    const isLastQuestion = questions.length > 0 && idx === questions.length - 1;
    const progressPercent = questions.length ? Math.round(((idx + 1) / questions.length) * 100) : 0;
    const canNext = this._isAnswered(currentQuestion);
    this.setData({ currentQuestion, isLastQuestion, progressPercent, canNext });
  },

  // 判断当前问题是否已作答
  _isAnswered(question) {
    if (!question) return false;
    const answer = this.data.answers[question.id];
    if (answer === undefined || answer === null || answer === '') return false;
    if (question.type === 'digit') {
      const num = Number(answer);
      if (isNaN(num)) return false;
      if (num < question.min || num > question.max) return false;
    }
    return true;
  }
});
