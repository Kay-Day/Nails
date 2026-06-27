const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase()
      .slice(0, 40);
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.mp4', '.webm'];

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB (videos)
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Unsupported file type: ' + ext));
  },
});

// Helper: return public URL for an uploaded file, or fall back to a text field
function fileUrl(file) {
  return file ? '/uploads/' + file.filename : null;
}

function normalizeMediaUrl(value) {
  const input = String(value || '').trim().replace(/\\/g, '/');
  if (!input) return null;
  if (/^https?:\/\//i.test(input)) return input;
  if (/^www\./i.test(input)) return 'https://' + input;
  return '/' + input.replace(/^\/+/, '');
}

function uploadedFilePath(url) {
  const value = String(url || '').split(/[?#]/)[0];
  if (!value.startsWith('/uploads/')) return null;
  const filename = path.posix.basename(value);
  if (!filename || filename !== value.slice('/uploads/'.length)) return null;
  const resolved = path.resolve(UPLOAD_DIR, filename);
  return path.dirname(resolved) === path.resolve(UPLOAD_DIR) ? resolved : null;
}

async function removeUploadedFile(url) {
  const target = uploadedFilePath(url);
  if (!target) return false;
  try {
    await fs.promises.unlink(target);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

module.exports = {
  upload,
  fileUrl,
  normalizeMediaUrl,
  uploadedFilePath,
  removeUploadedFile,
};
