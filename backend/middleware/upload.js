// ============================================================
// Multer Upload Configuration - Secure file upload middleware
// Only accepts .html files (Belarc audit reports)
// Stored outside web root with hash-based filenames
// ============================================================

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'audits');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Generate a random temp name — will be renamed after hash computed
    const tempName = crypto.randomBytes(16).toString('hex') + '.tmp';
    cb(null, tempName);
  }
});

// File filter: ONLY accept .html files
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['text/html', 'application/xhtml+xml'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (ext === '.html' && allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only .html audit files are accepted'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024
  }
});

// Helper: compute SHA-256 hash of uploaded file and rename it
const finalizeUpload = (tempPath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(tempPath);
    stream.on('data', d => hash.update(d));
    stream.on('end', () => {
      const digest = hash.digest('hex');
      const finalName = digest + '.html';
      const finalPath = path.join(UPLOAD_DIR, finalName);

      // If same hash already exists, delete temp and return existing
      if (fs.existsSync(finalPath)) {
        fs.unlinkSync(tempPath);
        resolve({ storedFilename: finalName, fileHash: digest, filePath: finalPath });
      } else {
        fs.renameSync(tempPath, finalPath);
        resolve({ storedFilename: finalName, fileHash: digest, filePath: finalPath });
      }
    });
    stream.on('error', reject);
  });
};

module.exports = { upload, finalizeUpload, UPLOAD_DIR };
