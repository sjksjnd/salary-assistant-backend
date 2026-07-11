function parseResultDetail(resultDetail) {
  if (!resultDetail) return null;
  if (typeof resultDetail === 'object') return resultDetail;
  try {
    return JSON.parse(resultDetail);
  } catch (e) {
    return null;
  }
}

function formatRecordList(record) {
  return {
    id: record._id,
    type: record.type,
    description: record.description,
    resultText: record.resultText,
    resultDetail: record.resultDetail,
    createdAt: record.createdAt,
  };
}

function formatRecordDetail(record) {
  return {
    id: record._id,
    type: record.type,
    description: record.description,
    resultText: record.resultText,
    resultDetail: parseResultDetail(record.resultDetail),
    createdAt: record.createdAt,
  };
}

function normalizeRecordsInput(input = {}) {
  const allowTypes = ['contract', 'compensation'];
  const type = allowTypes.indexOf(input.type) >= 0 ? input.type : '';
  const page = Math.max(1, Number(input.page) || 1);
  const pageSize = Math.min(Math.max(Number(input.pageSize) || 20, 1), 50);
  const skip = (page - 1) * pageSize;
  return { type, page, pageSize, skip, limit: pageSize };
}

module.exports = {
  parseResultDetail,
  formatRecordList,
  formatRecordDetail,
  normalizeRecordsInput,
};
