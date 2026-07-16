const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { supabaseAdmin, isAdminConfigured } = require('../config/supabaseClient');

const isVercel = !!(process.env.VERCEL || process.env.NOW_REGION || __dirname.includes('/var/task') || __dirname.includes('var/task') || __dirname.includes('vercel'));
const uploadDir = isVercel ? '/tmp' : path.join(__dirname, '../../public/uploads');

// Ensure upload directory exists safely
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (error) {
  console.warn("Warning: Could not create upload directory on startup:", error.message);
}

// Set up storage engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// File filter (images and PDFs/brochures)
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only ${allowedExtensions.join(', ')} are allowed.`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Upload a single file to Supabase Storage — returns public URL or throws
const uploadFileToSupabase = async (file) => {
  const fileBuffer = fs.readFileSync(file.path);
  const filePath = file.filename;

  const { error } = await supabaseAdmin.storage
    .from('upload')
    .upload(filePath, fileBuffer, {
      contentType: file.mimetype,
      upsert: true
    });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}. Make sure the 'upload' bucket exists and is public in your Supabase dashboard.`);
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('upload')
    .getPublicUrl(filePath);

  file.supabaseUrl = publicUrl;

  // Clean up temp file
  try { fs.unlinkSync(file.path); } catch (_) {}

  return publicUrl;
};

// Middleware: upload all files to Supabase Storage
// On Vercel: MANDATORY — aborts with 503 if upload fails (prevents saving broken URLs)
// On local dev: skips Supabase and uses local /uploads folder
const uploadToSupabaseMiddleware = async (req, res, next) => {
  // Skip Supabase upload on local dev (no VERCEL env set and isAdminConfigured)
  if (!isAdminConfigured) {
    return next();
  }

  // Collect all files from req.file or req.files
  const allFiles = [];
  if (req.file) {
    allFiles.push(req.file);
  }
  if (req.files) {
    if (Array.isArray(req.files)) {
      allFiles.push(...req.files);
    } else if (typeof req.files === 'object') {
      for (const key of Object.keys(req.files)) {
        allFiles.push(...req.files[key]);
      }
    }
  }

  // If no files were uploaded, skip
  if (allFiles.length === 0) {
    return next();
  }

  try {
    for (const file of allFiles) {
      await uploadFileToSupabase(file);
    }
    next();
  } catch (err) {
    console.error("Supabase Storage Upload Error:", err.message);

    // On Vercel: return clear error to admin — do NOT save broken URLs
    if (isVercel) {
      const accept = req.headers['accept'] || '';
      if (accept.includes('text/html')) {
        // EJS admin panel — redirect back with error message
        return res.status(503).send(`
          <html><body style="font-family:sans-serif;padding:2rem;background:#fef2f2;color:#991b1b">
            <h2>⚠️ Image Upload Failed</h2>
            <p><strong>Error:</strong> ${err.message}</p>
            <p>To fix this permanently:</p>
            <ol>
              <li>Go to your <strong>Supabase Dashboard</strong></li>
              <li>Click <strong>Storage</strong> in the left sidebar</li>
              <li>Click <strong>"New bucket"</strong></li>
              <li>Name it exactly: <code>uploads</code></li>
              <li>Turn ON <strong>"Public bucket"</strong></li>
              <li>Click <strong>Save</strong></li>
              <li>Then retry your upload</li>
            </ol>
            <a href="javascript:history.back()" style="color:#1d4ed8">← Go Back</a>
          </body></html>
        `);
      }
      // API calls — return JSON error
      return res.status(503).json({
        success: false,
        message: err.message
      });
    }

    // On local dev: just warn and continue (use local path)
    console.warn("Continuing with local file path (non-Vercel environment)");
    next();
  }
};

module.exports = { 
  upload,
  uploadToSupabase: uploadToSupabaseMiddleware
};
