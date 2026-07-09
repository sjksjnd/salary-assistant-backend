require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const config = require('./config');
const securityMiddleware = require('./middleware/security');
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiters } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');
const pool = require('./config/database');
const redis = require('./config/redis');

const app = express();

// Trust only local/private reverse proxies by default. This lets req.ip use
// X-Forwarded-For behind CloudBase/Nginx while ignoring spoofed headers from
// direct public clients. Set TRUST_PROXY=1 if your platform requires hop count.
const trustProxy = process.env.TRUST_PROXY || 'loopback, linklocal, uniquelocal';
if (trustProxy !== '0' && trustProxy !== 'false') {
  app.set('trust proxy', /^\d+$/.test(trustProxy) ? parseInt(trustProxy, 10) : trustProxy);
}

app.use(morgan(config.isDev() ? 'dev' : 'combined'));
app.use(securityMiddleware);
// Global body size limit is small; OCR endpoint overrides this with its own larger limit.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(rateLimiters.global);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/config', require('./routes/config'));
app.use('/api/workhours', require('./routes/workhours'));
app.use('/api/salary', require('./routes/salary'));
app.use('/api/contract', require('./routes/contract'));
app.use('/api/compensation', require('./routes/compensation'));
app.use('/api/legal', require('./routes/legal'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use((req, res) => {
  res.status(404).json({ code: 40401, message: '接口不存在', data: null });
});

app.use(errorHandler);

const HOST = process.env.HOST || (config.isDev() ? 'localhost' : '0.0.0.0');
const server = app.listen(config.port, HOST, () => {
  logger.info(`Server running on http://${HOST}:${config.port}`);
  logger.info(`Environment: ${config.env}`);
});

// Graceful shutdown: close HTTP server, then release DB pool and Redis connection.
function shutdown(signal) {
  logger.info(`${signal} received, shutting down...`);
  server.close(async () => {
    logger.info('HTTP server closed');
    try {
      await pool.end();
      logger.info('DB pool closed');
    } catch (e) {
      logger.error('Error closing DB pool:', e);
    }
    try {
      redis.quit();
    } catch (e) {}
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown stalls.
  setTimeout(() => {
    logger.warn('Forcing exit after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled promise rejections so the process does not silently degrade.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

// Catch uncaught exceptions; log and exit to let the process manager restart us.
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = app;
