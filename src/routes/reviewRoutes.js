const express = require('express');
const router = express.Router();
const {
  getReviews,
  addReview,
  updateReviewStatus,
  deleteReview
} = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');

router.get('/', getReviews);
router.post('/', addReview);
router.patch('/:id', protect, restrictTo('admin'), updateReviewStatus);
router.delete('/:id', protect, restrictTo('admin'), deleteReview);

module.exports = router;
