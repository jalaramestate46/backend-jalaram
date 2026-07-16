const express = require('express');
const router = express.Router();
const {
  getAllProperties,
  searchProperties,
  getPropertyById,
  createProperty,
  editProperty,
  deleteProperty,
  toggleFavoriteProperty
} = require('../controllers/propertyController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

// Public routes
router.post('/', getAllProperties); // POST /properties from frontend
router.get('/search', searchProperties);
router.get('/:id', getPropertyById);

// Protected routes
router.post('/create', protect, upload.array('images', 10), createProperty);
router.patch('/:id', protect, upload.array('images', 10), editProperty);
router.delete('/:id', protect, deleteProperty);
router.post('/:id/favorite', protect, toggleFavoriteProperty);

module.exports = router;
