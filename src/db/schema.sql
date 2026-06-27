-- Session store for connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Admin users
CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(80) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Site settings (contact info, social links, shop name...) as key/value
CREATE TABLE IF NOT EXISTS settings (
  key   VARCHAR(120) PRIMARY KEY,
  value TEXT
);

-- Collections (Shop by shape / length / edits)
CREATE TABLE IF NOT EXISTS collections (
  id          SERIAL PRIMARY KEY,
  slug        VARCHAR(160) UNIQUE NOT NULL,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  image       TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id                SERIAL PRIMARY KEY,
  slug              VARCHAR(200) UNIQUE NOT NULL,
  sku               VARCHAR(120),
  title             VARCHAR(250) NOT NULL,
  description       TEXT,
  price             NUMERIC(10,2),
  compare_at_price  NUMERIC(10,2),
  shape             VARCHAR(80),
  length            VARCHAR(80),
  size_options      TEXT DEFAULT 'XS,S,M,L',
  image             TEXT,
  video             TEXT,
  video_poster      TEXT,
  collection_id     INT REFERENCES collections(id) ON DELETE SET NULL,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  is_featured       BOOLEAN NOT NULL DEFAULT false,
  sort_order        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_collection ON products(collection_id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(120);
ALTER TABLE products ADD COLUMN IF NOT EXISTS size_options TEXT DEFAULT 'XS,S,M,L';
ALTER TABLE products ADD COLUMN IF NOT EXISTS video TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS video_poster TEXT;

-- Products can appear in more than one collection.
CREATE TABLE IF NOT EXISTS product_collections (
  product_id    INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  collection_id INT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  sort_order    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, collection_id)
);
CREATE INDEX IF NOT EXISTS idx_product_collections_collection
  ON product_collections(collection_id, sort_order, product_id);

-- Exact Shopify variants used by the product size selector.
CREATE TABLE IF NOT EXISTS product_variants (
  id               SERIAL PRIMARY KEY,
  product_id       INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title            VARCHAR(120) NOT NULL,
  sku              VARCHAR(160),
  price            NUMERIC(10,2),
  compare_at_price NUMERIC(10,2),
  is_available     BOOLEAN NOT NULL DEFAULT true,
  sort_order       INT NOT NULL DEFAULT 0,
  UNIQUE(product_id, title)
);
CREATE INDEX IF NOT EXISTS idx_product_variants_product
  ON product_variants(product_id, sort_order, id);

-- Extra product gallery images
CREATE TABLE IF NOT EXISTS product_images (
  id         SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

-- Homepage banners / slideshow
CREATE TABLE IF NOT EXISTS banners (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(250),
  subtitle    TEXT,
  image       TEXT,
  video       TEXT,
  link        TEXT,
  button_text VARCHAR(120),
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Blog posts
CREATE TABLE IF NOT EXISTS posts (
  id           SERIAL PRIMARY KEY,
  slug         VARCHAR(220) UNIQUE NOT NULL,
  title        VARCHAR(250) NOT NULL,
  excerpt      TEXT,
  content      TEXT,
  cover_image  TEXT,
  author       VARCHAR(120) DEFAULT 'Majestic Nailbox',
  is_published BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CMS sections used by homepage and all editorial/content pages.
CREATE TABLE IF NOT EXISTS site_sections (
  id          SERIAL PRIMARY KEY,
  page_slug   VARCHAR(120) NOT NULL,
  section_key VARCHAR(160) NOT NULL,
  section_type VARCHAR(80) NOT NULL DEFAULT 'content',
  eyebrow     VARCHAR(200),
  title       VARCHAR(300),
  subtitle    TEXT,
  body_html   TEXT,
  image       TEXT,
  button_text VARCHAR(160),
  button_link TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(page_slug, section_key)
);
CREATE INDEX IF NOT EXISTS idx_site_sections_page
  ON site_sections(page_slug, is_active, sort_order, id);

-- Repeated content inside a section: benefits, reviews, FAQ entries, steps, etc.
CREATE TABLE IF NOT EXISTS section_items (
  id          SERIAL PRIMARY KEY,
  section_id  INT NOT NULL REFERENCES site_sections(id) ON DELETE CASCADE,
  label       VARCHAR(160),
  title       VARCHAR(300),
  subtitle    TEXT,
  body_html   TEXT,
  image       TEXT,
  link        TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_section_items_section
  ON section_items(section_id, is_active, sort_order, id);

-- Curated products for homepage sections such as Best Sellers and As Seen On You.
CREATE TABLE IF NOT EXISTS section_products (
  section_id INT NOT NULL REFERENCES site_sections(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (section_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_section_products_section
  ON section_products(section_id, sort_order, product_id);

-- Header/footer navigation managed from the admin panel.
CREATE TABLE IF NOT EXISTS navigation_items (
  id          SERIAL PRIMARY KEY,
  location    VARCHAR(40) NOT NULL DEFAULT 'header',
  parent_id   INT REFERENCES navigation_items(id) ON DELETE CASCADE,
  label       VARCHAR(160) NOT NULL,
  url         TEXT NOT NULL DEFAULT '#',
  badge       VARCHAR(80),
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_navigation_items_location
  ON navigation_items(location, parent_id, is_active, sort_order, id);

-- Messages sent through the public contact form.
CREATE TABLE IF NOT EXISTS contact_messages (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(180) NOT NULL,
  email      VARCHAR(240) NOT NULL,
  phone      VARCHAR(80),
  message    TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
