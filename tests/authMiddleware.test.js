const jwt = require('jsonwebtoken');
const config = require('../src/config');
const { authenticate, requireAdmin } = require('../src/middleware/auth');

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('auth middleware', () => {
  afterEach(() => {
    delete process.env.ADMIN_USER_IDS;
    delete process.env.ADMIN_OPENIDS;
  });

  test('rejects refresh tokens on protected routes', async () => {
    const token = jwt.sign(
      { userId: 123, openid: 'openid-123', type: 'refresh' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('accepts access tokens on protected routes', async () => {
    const token = jwt.sign(
      { userId: 123, openid: 'openid-123', type: 'access' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(req.userId).toBe(123);
    expect(req.openid).toBe('openid-123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('requires configured admin user id when admin list exists', () => {
    process.env.ADMIN_USER_IDS = '123';
    const req = { userId: 456, openid: 'openid-456' };
    const res = createRes();
    const next = jest.fn();

    requireAdmin(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('allows configured admin user id', () => {
    process.env.ADMIN_USER_IDS = '123';
    const req = { userId: 123, openid: 'openid-123' };
    const res = createRes();
    const next = jest.fn();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
