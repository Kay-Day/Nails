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

const app = express();

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
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }, // 1 week
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  runzie nail store running -> http://localhost:${PORT}`);
  console.log(`  admin panel              -> http://localhost:${PORT}/admin\n`);
});
