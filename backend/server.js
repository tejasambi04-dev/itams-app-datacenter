// ============================================================
// ITAMS - IT Asset Management System
// Main Express API Server
// ============================================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security Middleware ───────────────────────────────────────

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: {
    error: 'Too many requests, please try again later.'
  }
});

app.use('/api/', limiter);

// ── Body Parsers ──────────────────────────────────────────────

app.use(
  express.json({
    limit: '10mb'
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb'
  })
);

// ── Health Check ──────────────────────────────────────────────
// Used later by Kubernetes liveness probe.

app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok'
  });
});

// ── Readiness Check ───────────────────────────────────────────
// Checks whether the backend can communicate with MySQL.

app.get('/ready', async (req, res) => {
  try {
    await db.query('SELECT 1');

    res.status(200).json({
      status: 'ready',
      database: 'ok'
    });
  } catch (error) {
    console.error(
      '[READY] Database connection check failed:',
      error.message
    );

    res.status(503).json({
      status: 'not-ready'
    });
  }
});

// ── API Routes ────────────────────────────────────────────────

app.use(
  '/api/assets',
  require('./routes/assets')
);

app.use(
  '/api/servers',
  require('./routes/servers')
);

app.use(
  '/api/audits',
  require('./routes/audits')
);

app.use(
  '/api/reports',
  require('./routes/reports')
);

app.use(
  '/api/schedules',
  require('./routes/schedules')
);

app.use(
  '/api/notifications',
  require('./routes/notifications')
);

app.use(
  '/api/technicians',
  require('./routes/technicians')
);

app.use(
  '/api/presets',
  require('./routes/presets')
);

// ── Error Handler ─────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('[ERROR]', err);

  const statusCode = err.status || 500;

  res.status(statusCode).json({
    error:
      statusCode >= 500
        ? 'Internal server error'
        : err.message || 'Request failed'
  });
});

// ── Start Server ──────────────────────────────────────────────

async function startServer() {
  try {
    // Make sure the database is available before
    // starting the API server.
    await db.testDatabaseConnection();

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(
        `\n╔══════════════════════════════════════════╗`
      );
      console.log(
        `║  ITAMS API Server running on port ${PORT}  ║`
      );
      console.log(
        `║  http://localhost:${PORT}                 ║`
      );
      console.log(
        `╚══════════════════════════════════════════╝\n`
      );
    });

    // ── Graceful Shutdown ───────────────────────────────────

    const shutdown = async (signal) => {
      console.log(
        `[SERVER] Received ${signal}. Shutting down gracefully...`
      );

      server.close(async () => {
        await db.closeDatabaseConnection();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // ── Background Scheduler ─────────────────────────────────
    // We are keeping the current scheduler for now.
    // Later we will move scheduled work to a Kubernetes CronJob.

    if (process.env.ENABLE_SCHEDULER === 'true') {
      require('./jobs/scheduler');

      console.log('[SCHEDULER] Scheduler enabled');
    }

  } catch (error) {
    console.error(
      '[SERVER] Failed to start application:',
      error.message
    );

    process.exit(1);
  }
}

startServer();

module.exports = app;