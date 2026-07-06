require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const config = require('./config');
const securityMiddleware = require('./middleware/security');
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiters } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

const app = express();

app.use(morgan(config.isDev() ? 'dev' : 'combined'));
app.use(securityMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = app;
