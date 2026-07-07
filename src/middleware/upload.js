const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Cloudinary is opt-in: configure it only when credentials are present, otherwise
// fall back to local disk storage so local dev keeps working with no extra setup.
const hasCloudinary = !!(
  process.env.CLOUDINARY_URL ||
  (process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET)
);

if (hasCloudinary) {
  // When CLOUDINARY_URL is set the SDK reads it automatically; otherwise pass the
  // individual credentials. `secure: true` forces https delivery URLs.
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ secure: true });
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
}

const CLOUD_FOLDER = process.env.CLOUDINARY_FOLDER || 'nail';

const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.mp4', '.webm'];

function safeBase(originalname) {
  const ext = path.extname(originalname).toLowerCase();
  return (
    path
      .basename(originalname, ext)
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase()
      .slice(0, 40) || 'file'
  );
}

// ---- Cloudinary multer storage engine ----
// Implements multer's storage interface so every existing `upload.single/fields`
// route keeps working unchanged. After the middleware runs, req.file.path holds
// the Cloudinary secure URL and req.file.filename holds the public_id.
class CloudinaryStorage {
  _handleFile(req, file, cb) {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUD_FOLDER,
        resource_type: 'auto', // auto-detects image vs video (mp4/webm)
        public_id: `${Date.now()}-${safeBase(file.originalname)}`,
        overwrite: false,
        unique_filename: false,
        use_filename: false,
      },
      (error, result) => {
        if (error) return cb(error);
        cb(null, {
          path: result.secure_url,
          filename: result.public_id,
          size: result.bytes,
          cloudinaryResult: result,
        });
      }
    );
    file.stream.on('error', cb);
    file.stream.pipe(stream);
  }

  _removeFile(req, file, cb) {
    // Called by multer to roll back an upload when a later file in the same
    // request fails validation.
    if (!file.cloudinaryResult) return cb(null);
    cloudinary.uploader
      .destroy(file.cloudinaryResult.public_id, {
        resource_type: file.cloudinaryResult.resource_type || 'image',
        invalidate: true,
      })
      .then(() => cb(null))
      .catch(cb);
  }
}

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${safeBase(file.originalname)}${ext}`);
  },
});

const storage = hasCloudinary ? new CloudinaryStorage() : diskStorage;

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB (videos)
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Unsupported file type: ' + ext));
  },
});

// Helper: return the public URL for an uploaded file.
// Cloudinary storage returns an absolute https URL in file.path; disk storage
// serves from /uploads/.
function fileUrl(file) {
  if (!file) return null;
  if (file.path && /^https?:\/\//i.test(file.path)) return file.path;
  return '/uploads/' + file.filename;
}

function normalizeMediaUrl(value) {
  const input = String(value || '').trim().replace(/\\/g, '/');
  if (!input) return null;
  if (/^https?:\/\//i.test(input)) return input;
  if (/^www\./i.test(input)) return 'https://' + input;
  return '/' + input.replace(/^\/+/, '');
}

// Parse one of *our* Cloudinary delivery URLs back into the public_id +
// resource_type needed to delete it. Returns null for non-Cloudinary URLs.
function cloudinaryTarget(url) {
  const value = String(url || '');
  const match = value.match(
    /res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)$/i
  );
  if (!match) return null;
  const resourceType = match[1].toLowerCase();
  const publicId = match[2]
    .split(/[?#]/)[0]
    .replace(/\.[a-z0-9]+$/i, ''); // strip file extension
  if (!publicId) return null;
  return { resourceType, publicId };
}

function uploadedFilePath(url) {
  const value = String(url || '').split(/[?#]/)[0];
  if (!value.startsWith('/uploads/')) return null;
  const filename = path.posix.basename(value);
  if (!filename || filename !== value.slice('/uploads/'.length)) return null;
  const resolved = path.resolve(UPLOAD_DIR, filename);
  return path.dirname(resolved) === path.resolve(UPLOAD_DIR) ? resolved : null;
}

// True when the URL points at media we own and can delete (a Cloudinary asset in
// our account or a local /uploads file). External URLs return false.
function isRemovableUpload(url) {
  return !!(cloudinaryTarget(url) || uploadedFilePath(url));
}

async function removeUploadedFile(url) {
  const target = cloudinaryTarget(url);
  if (target) {
    try {
      const result = await cloudinary.uploader.destroy(target.publicId, {
        resource_type: target.resourceType,
        invalidate: true,
      });
      return result.result === 'ok';
    } catch (error) {
      return false;
    }
  }

  const diskTarget = uploadedFilePath(url);
  if (!diskTarget) return false;
  try {
    await fs.promises.unlink(diskTarget);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

module.exports = {
  upload,
  hasCloudinary,
  fileUrl,
  normalizeMediaUrl,
  uploadedFilePath,
  isRemovableUpload,
  removeUploadedFile,
};
