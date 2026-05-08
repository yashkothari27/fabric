'use strict';

require('dotenv').config();

const express        = require('express');
const session        = require('express-session');
const cookieParser   = require('cookie-parser');
const swaggerUi      = require('swagger-ui-express');
const swaggerSpec    = require('./swagger');
const { pool }       = require('./gatewayPool');
const { authRouter, adminRouter } = require('./routes/auth');
const ctiRoutes      = require('./routes/cti');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json());
app.use(cookieParser());

app.use(
  session({
    secret:            process.env.SESSION_SECRET || 'change-me-in-production',
    resave:            false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      maxAge:   8 * 60 * 60 * 1000, // 8 hours
    },
  })
);

// ── Swagger UI ────────────────────────────────────────────────────────────────

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'CTI Management API',
  swaggerOptions: { persistAuthorization: true },
}));

// Raw OpenAPI JSON (useful for importing into Postman / Insomnia)
app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));

// ── Routes ────────────────────────────────────────────────────────────────────

app.use('/api/auth',  authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/cti',   ctiRoutes);

// Health probe — exposes pool size for ops visibility
app.get('/health', (_req, res) => {
  res.json({ ok: true, gatewayPoolSize: pool.size });
});

// 404 catch-all
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

function shutdown(signal) {
  console.log(`${signal} received — closing gateway pool`);
  pool.closeAll();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ── Start ─────────────────────────────────────────────────────────────────────

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
    console.log(`Swagger UI:        http://localhost:${PORT}/api-docs`);
    console.log(`OpenAPI JSON:      http://localhost:${PORT}/api-docs.json`);
  });
}

module.exports = app; // for tests
