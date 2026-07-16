const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  getAllUsers,
  updateUserProfile,
  patchUser,
  deleteUser
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');
const { upload, uploadToSupabase } = require('../middleware/uploadMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.post('/refreshToken', refreshAccessToken);

// Protected routes
router.get('/', protect, restrictTo('admin'), getAllUsers);
router.put('/:idOrUsername', protect, updateUserProfile);
router.patch('/:id', protect, upload.single('avatar'), uploadToSupabase, patchUser);
router.delete('/:id', protect, restrictTo('admin'), deleteUser);

module.exports = router;
