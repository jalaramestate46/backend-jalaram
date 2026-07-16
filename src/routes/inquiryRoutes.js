const express = require('express');
const router = express.Router();
const {
  createInquiry,
  getAllInquiries,
  deleteInquiry
} = require('../controllers/inquiryController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');

router.post('/', createInquiry);
router.get('/', protect, restrictTo('admin'), getAllInquiries);
router.delete('/:id', protect, restrictTo('admin'), deleteInquiry);

module.exports = router;
