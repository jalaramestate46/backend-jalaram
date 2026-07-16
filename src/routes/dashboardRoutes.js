const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { upload } = require('../middleware/uploadMiddleware');
const {
  getLogin,
  postLogin,
  getLogout,
  getDashboard,
  getProperties,
  createProperty,
  editProperty,
  deleteProperty,
  getProjects,
  createProject,
  editProject,
  deleteProject,
  getInquiries,
  deleteInquiry,
  getReviews,
  approveReview,
  rejectReview,
  deleteReview,
  getUsers,
  toggleUserRole,
  deleteUser,
  getContent,
  postContent
} = require('../controllers/dashboardController');

const JWT_SECRET = process.env.JWT_SECRET || 'jalaram_estate_jwt_access_secret_key_2026_change_me';

// Custom dashboard authentication gate middleware
const protectDashboard = (req, res, next) => {
  const token = req.cookies?.accessToken;
  if (!token) {
    return res.redirect('/admin/login');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      res.clearCookie('accessToken');
      return res.redirect('/admin/login');
    }
    req.user = decoded;
    next();
  } catch (error) {
    res.clearCookie('accessToken');
    return res.redirect('/admin/login');
  }
};

// Public Access admin login/auth routes
router.get('/login', getLogin);
router.post('/login', postLogin);
router.get('/logout', getLogout);

// Protected dashboard routes
router.get('/dashboard', protectDashboard, getDashboard);
router.get('/', protectDashboard, (req, res) => res.redirect('/admin/dashboard'));

// Properties management EJS pages
router.get('/properties', protectDashboard, getProperties);
router.post('/properties/create', protectDashboard, upload.array('images', 10), createProperty);
router.post('/properties/:id/edit', protectDashboard, upload.array('images', 10), editProperty);
router.get('/properties/:id/delete', protectDashboard, deleteProperty);

// Projects management EJS pages
router.get('/projects', protectDashboard, getProjects);
router.post('/projects/create', protectDashboard, upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'brochure', maxCount: 1 }
]), createProject);
router.post('/projects/:id/edit', protectDashboard, upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'brochure', maxCount: 1 }
]), editProject);
router.get('/projects/:id/delete', protectDashboard, deleteProject);

// Inquiries / Leads log
router.get('/inquiries', protectDashboard, getInquiries);
router.get('/inquiries/:id/delete', protectDashboard, deleteInquiry);

// Reviews / Testimony moderation
router.get('/reviews', protectDashboard, getReviews);
router.get('/reviews/:id/approve', protectDashboard, approveReview);
router.get('/reviews/:id/reject', protectDashboard, rejectReview);
router.get('/reviews/:id/delete', protectDashboard, deleteReview);

// Users list management
router.get('/users', protectDashboard, getUsers);
router.get('/users/:id/toggle-role', protectDashboard, toggleUserRole);
router.get('/users/:id/delete', protectDashboard, deleteUser);

// Custom site content copywriting & SEO customizer
router.get('/content', protectDashboard, getContent);
router.post('/content/:section', protectDashboard, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'heroImage', maxCount: 1 },
  { name: 'insetImage', maxCount: 1 },
  { name: 'videoPreviewImage', maxCount: 1 }
]), postContent);

module.exports = router;
