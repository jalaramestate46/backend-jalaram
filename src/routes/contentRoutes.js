const express = require('express');
const router = express.Router();
const {
  getContentSection,
  updateContentSection
} = require('../controllers/contentController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');

router.get('/:section', getContentSection);
router.put('/:section', protect, restrictTo('admin'), updateContentSection);

module.exports = router;
