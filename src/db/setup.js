require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./pool');

async function setup() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('✓ Schema applied');

  // Create the first admin only. Re-running setup during deploy must not reset
  // a password that was changed through the admin panel.
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  const existingAdmin = await pool.query(
    'SELECT id FROM admins WHERE username = $1 LIMIT 1',
    [username]
  );
  if (existingAdmin.rowCount === 0) {
    if (!password) throw new Error('ADMIN_PASSWORD is required to create the first admin');
    const hash = bcrypt.hashSync(password, 10);
    await pool.query(
      `INSERT INTO admins (username, password_hash) VALUES ($1, $2)
       ON CONFLICT (username) DO NOTHING`,
      [username, hash]
    );
    console.log(`✓ Admin created -> username: ${username}`);
  } else {
    console.log(`✓ Existing admin preserved -> username: ${username}`);
  }

  // Default settings
  const defaults = {
    shop_name: 'Majestic Nail Care',
    logo_url: '/images/Logo/Logo.jpeg',
    tagline: 'Handcrafted press-on nails in Ontario.',
    contact_phone: '4379983533',
    contact_email: '',
    contact_address: 'Ontario Canada',
    contact_hours: 'Mon - Fri, 9:00 - 18:00',
    instagram: 'https://www.instagram.com/majestic_nailbox?igsh=em9ia3JyMTVjMjVh&utm_source=qr',
    tiktok: 'https://www.tiktok.com/@majestic_press_on_nails?_r=1&_t=ZS-97Rx00o1YWq',
    facebook: '',
    announcement: 'Handcrafted press-on nails in Ontario, Canada',
    // Homepage email-signup popup (per-email discount code).
    signup_popup_enabled: 'true',
    signup_discount_percent: '10',
    signup_popup_title: 'Get 10% off your first set',
    signup_popup_subtitle: 'Enter your email and we’ll send your personal discount code instantly.',
  };
  for (const [key, value] of Object.entries(defaults)) {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO NOTHING`,
      [key, value]
    );
  }
  console.log('✓ Default settings ready (existing values preserved)');

  // One-time-safe brand migration for databases created under an older name.
  for (const oldName of ['Majestic Nailbox', 'PASTELLE NAILS']) {
    await pool.query(
      `UPDATE settings
       SET value = REPLACE(value, $1, 'Majestic Nail Care')
       WHERE value LIKE '%' || $1 || '%'`,
      [oldName]
    );
    await pool.query(
      `UPDATE site_sections
       SET eyebrow = REPLACE(eyebrow, $1, 'Majestic Nail Care'),
           title = REPLACE(title, $1, 'Majestic Nail Care'),
           subtitle = REPLACE(subtitle, $1, 'Majestic Nail Care'),
           body_html = REPLACE(body_html, $1, 'Majestic Nail Care')
       WHERE CONCAT_WS(' ', eyebrow, title, subtitle, body_html) LIKE '%' || $1 || '%'`,
      [oldName]
    );
    await pool.query(
      `UPDATE posts
       SET title = REPLACE(title, $1, 'Majestic Nail Care'),
           excerpt = REPLACE(excerpt, $1, 'Majestic Nail Care'),
           content = REPLACE(content, $1, 'Majestic Nail Care'),
           author = REPLACE(author, $1, 'Majestic Nail Care')
       WHERE CONCAT_WS(' ', title, excerpt, content, author) LIKE '%' || $1 || '%'`,
      [oldName]
    );
  }
  console.log('✓ Majestic Nail Care branding ready');

  await pool.end();
  console.log('Done.');
}

setup().catch((err) => {
  console.error(err);
  process.exit(1);
});
