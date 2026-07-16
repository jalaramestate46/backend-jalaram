const express = require('express');
const router = express.Router();
const { getUserFavorites } = require('../controllers/favoriteController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getUserFavorites);

module.exports = router;
