require('dotenv').config();
const { Pool } = require('pg');

const config = {
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

if (process.env.DATABASE_URL) {
  config.connectionString = process.env.DATABASE_URL;
}

const sslMode = String(process.env.PGSSLMODE || '').toLowerCase();
if (['require', 'verify-ca', 'verify-full'].includes(sslMode)) {
  config.ssl = {
    rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false',
  };
}

const pool = new Pool(config);

pool.on('error', (err) => {
  console.error('Unexpected PG pool error', err);
});

module.exports = pool;
