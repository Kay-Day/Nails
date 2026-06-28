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
    shop_name: 'PASTELLE NAILS',
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
  };
  for (const [key, value] of Object.entries(defaults)) {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO NOTHING`,
      [key, value]
    );
  }
  console.log('✓ Default settings ready (existing values preserved)');

  // One-time-safe brand migration for databases created before the rename.
  await pool.query(
    `UPDATE settings
     SET value = REPLACE(value, 'Majestic Nailbox', 'PASTELLE NAILS')
     WHERE value LIKE '%Majestic Nailbox%'`
  );
  await pool.query(
    `UPDATE site_sections
     SET eyebrow = REPLACE(eyebrow, 'Majestic Nailbox', 'PASTELLE NAILS'),
         title = REPLACE(title, 'Majestic Nailbox', 'PASTELLE NAILS'),
         subtitle = REPLACE(subtitle, 'Majestic Nailbox', 'PASTELLE NAILS'),
         body_html = REPLACE(body_html, 'Majestic Nailbox', 'PASTELLE NAILS')
     WHERE CONCAT_WS(' ', eyebrow, title, subtitle, body_html) LIKE '%Majestic Nailbox%'`
  );
  await pool.query(
    `UPDATE posts
     SET title = REPLACE(title, 'Majestic Nailbox', 'PASTELLE NAILS'),
         excerpt = REPLACE(excerpt, 'Majestic Nailbox', 'PASTELLE NAILS'),
         content = REPLACE(content, 'Majestic Nailbox', 'PASTELLE NAILS'),
         author = REPLACE(author, 'Majestic Nailbox', 'PASTELLE NAILS')
     WHERE CONCAT_WS(' ', title, excerpt, content, author) LIKE '%Majestic Nailbox%'`
  );
  console.log('✓ PASTELLE NAILS branding ready');

  await pool.end();
  console.log('Done.');
}

setup().catch((err) => {
  console.error(err);
  process.exit(1);
});
