const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadRoot = path.join(__dirname, '..', '..', 'uploads', 'profiles');
if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const safe = `${req.user._id || req.user.id}-${Date.now()}${ext}`;
    cb(null, safe);
  },
});

const fileFilter = (_req, file, cb) => {
  const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
  if (ok) cb(null, true);
  else cb(new Error('Only image files are allowed'));
};

const uploadProfilePhoto = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

module.exports = { uploadProfilePhoto, uploadRoot };
