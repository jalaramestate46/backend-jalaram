const express = require('express');
const router = express.Router();
const {
  getAllProjects,
  getProjectByIdOrSlug,
  createProject,
  editProject,
  deleteProject
} = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

// Public routes
router.get('/', getAllProjects);
router.get('/:idOrSlug', getProjectByIdOrSlug);

// Protected routes (Admin only)
router.post('/', protect, restrictTo('admin'), upload.array('images', 10), createProject);
router.put('/:id', protect, restrictTo('admin'), upload.array('images', 10), editProject);
router.delete('/:id', protect, restrictTo('admin'), deleteProject);

module.exports = router;
