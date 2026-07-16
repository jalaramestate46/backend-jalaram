const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { supabase, isConfigured } = require('../config/supabaseClient');

const isVercel = !!(process.env.VERCEL || process.env.NOW_REGION || __dirname.includes('/var/task') || __dirname.includes('var/task') || __dirname.includes('vercel'));
const uploadDir = isVercel ? '/tmp' : path.join(__dirname, '../../public/uploads');

// Ensure upload directory exists safely (prevent crashes in read-only environments like Vercel)
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
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Middleware to upload files to Supabase Storage automatically if configured
const uploadToSupabaseMiddleware = async (req, res, next) => {
  if (!isConfigured) {
    return next();
  }

  const uploadFile = async (file) => {
    try {
      const fileBuffer = fs.readFileSync(file.path);
      const filePath = `${file.filename}`;

      // Upload file directly to 'uploads' bucket
      const { data, error } = await supabase.storage
        .from('uploads')
        .upload(filePath, fileBuffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (error) {
        console.error("Supabase Storage Upload Error:", error.message);
        return;
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      file.supabaseUrl = publicUrl;
      
      // Clean up the local temp file to keep Vercel temp memory low
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        // ignore local delete issues
      }
    } catch (err) {
      console.error("Failed to upload to Supabase Storage:", err.message);
    }
  };

  try {
    if (req.file) {
      await uploadFile(req.file);
    }
    if (req.files) {
      if (Array.isArray(req.files)) {
        for (const file of req.files) {
          await uploadFile(file);
        }
      } else if (typeof req.files === 'object') {
        for (const key of Object.keys(req.files)) {
          for (const file of req.files[key]) {
            await uploadFile(file);
          }
        }
      }
    }
  } catch (err) {
    console.error("Error in uploadToSupabaseMiddleware:", err.message);
  }

  next();
};

module.exports = { 
  upload,
  uploadToSupabase: uploadToSupabaseMiddleware
};
