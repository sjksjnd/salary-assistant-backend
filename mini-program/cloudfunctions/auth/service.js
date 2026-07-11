function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function buildNewUserData(openid, nickname, avatarUrl) {
  const now = new Date();
  return {
    openid,
    nickname: nickname || '用户',
    avatarUrl: avatarUrl || '',
    phone: '',
    points: 0,
    level: 1,
    exp: 0,
    inviteCode: generateInviteCode(),
    status: 'active',
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function buildDefaultUserSettings(userId) {
  const now = new Date();
  return {
    userId,
    hourlyRate: 25,
    nightRate: 20,
    standardHours: 8,
    factoryName: '',
    factoryCity: '',
    reminderEnabled: false,
    reminderTime: '21:00',
    fontScale: 'medium',
    createdAt: now,
    updatedAt: now,
  };
}

function buildUpdateProfileData(nickname, avatarUrl) {
  const data = { updatedAt: new Date() };
  if (nickname) data.nickname = nickname;
  if (avatarUrl) data.avatarUrl = avatarUrl;
  return data;
}

function formatUserLogin(user) {
  return {
    id: user._id,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    phone: user.phone || '',
    points: user.points || 0,
    level: user.level || 1,
  };
}

function formatUserProfile(user) {
  return {
    id: user._id,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    phone: user.phone || '',
    points: user.points || 0,
    level: user.level || 1,
    exp: user.exp || 0,
    status: user.status,
    createdAt: user.createdAt,
  };
}

module.exports = {
  generateInviteCode,
  buildNewUserData,
  buildDefaultUserSettings,
  buildUpdateProfileData,
  formatUserLogin,
  formatUserProfile,
};
