require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./db/pool');
const { loadNavigation } = require('./content');

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required in .env');
}

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must contain at least 32 characters in production');
}

const app = express();
app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1);

// Kept before sessions and page middleware so infrastructure can still
// distinguish an application failure from a database failure.
app.get('/healthz', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    res.status(503).json({ status: 'unavailable' });
  }
});

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Serve files only. Directory redirects/index files would otherwise shadow the
// DB-driven /collections/:slug routes with the old scraped HTML directories.
app.use(express.static(path.join(__dirname, '..', 'public'), {
  index: false,
  redirect: false,
}));

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sessions (stored in Postgres)
app.use(
  session({
    store: new pgSession({ pool, tableName: 'session' }),
    name: 'nail.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure:
        process.env.SESSION_COOKIE_SECURE !== undefined
          ? process.env.SESSION_COOKIE_SECURE === 'true'
          : isProduction,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

// Load site settings into res.locals on every request
app.use(async (req, res, next) => {
  try {
    const [{ rows }, navigation] = await Promise.all([
      pool.query('SELECT key, value FROM settings'),
      loadNavigation(),
    ]);
    const settings = {};
    rows.forEach((r) => (settings[r.key] = r.value));
    res.locals.settings = settings;
    res.locals.currentPath = req.path;
    res.locals.admin = req.session.admin || null;
    res.locals.navigation = navigation;
    next();
  } catch (err) {
    next(err);
  }
});

// Routes
app.use('/', require('./routes/store'));
app.use('/admin', require('./routes/admin'));

// 404 — rendered inside the runzie theme chrome
const { renderPage } = require('./layout');
const render = require('./render');
app.use((req, res) => {
  res.status(404).type('html').send(renderPage(render.notFound(), { title: 'Page not found · Majestic Nailbox', url: req.originalUrl, settings: res.locals.settings, navigation: res.locals.navigation }));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).type('html').send(renderPage(render.notFound(), { title: 'Error · Majestic Nailbox', url: req.originalUrl, settings: res.locals.settings, navigation: res.locals.navigation }));
});

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const server = app.listen(PORT, HOST, () => {
  console.log(`\n  runzie nail store running -> http://${HOST}:${PORT}`);
  console.log(`  admin panel              -> http://${HOST}:${PORT}/admin\n`);
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);

  server.close(async (error) => {
    try {
      await pool.end();
    } finally {
      process.exit(error ? 1 : 0);
    }
  });

  setTimeout(() => {
    server.closeAllConnections();
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
