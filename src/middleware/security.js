const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

// CORS origin whitelist. WeChat Mini Programs have no Origin header and are always allowed.
// For browser-based fallback requests, only the configured origin(s) are permitted.
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
  : [];

const securityMiddleware = [
  helmet({
    // API server returns JSON, not HTML. CSP is mostly irrelevant here;
    // keep HSTS, X-Frame-Options, X-Content-Type-Options for hardening.
    contentSecurityPolicy: false,
  }),
  cors({
    // When corsOrigin is empty, refuse cross-origin browser requests.
    // WeChat Mini Program requests (no Origin) are not affected by CORS.
    origin: corsOrigin.length === 0 ? false : (origin, cb) => {
      if (!origin || corsOrigin.indexOf(origin) !== -1) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
  compression(),
];

module.exports = securityMiddleware;
