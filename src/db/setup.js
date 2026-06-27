require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./pool');

async function setup() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('✓ Schema applied');

  // Default admin
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error('ADMIN_PASSWORD is required in .env');
  const hash = bcrypt.hashSync(password, 10);
  await pool.query(
    `INSERT INTO admins (username, password_hash) VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [username, hash]
  );
  console.log(`✓ Admin ready -> username: ${username}`);

  // Default settings
  const defaults = {
    shop_name: 'Majestic Nailbox',
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
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, value]
    );
  }
  console.log('✓ Default settings ready');

  await pool.end();
  console.log('Done.');
}

setup().catch((err) => {
  console.error(err);
  process.exit(1);
});
