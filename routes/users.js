const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const { 
  authenticate, 
  authorize, 
  authorizeOwnerOrAdmin 
} = require('../middleware/auth');

// @route   GET /api/users/profile/:id
// @desc    Get user profile by ID
// @access  Private (Owner or Admin)
router.get('/profile/:id', authenticate, authorizeOwnerOrAdmin, UserController.getUserProfile);

// @route   PUT /api/users/profile/:id
// @desc    Update user profile
// @access  Private (Owner or Admin)
router.put('/profile/:id', authenticate, authorizeOwnerOrAdmin, UserController.updateUserProfile);

// @route   GET /api/users/all
// @desc    Get all users with pagination and filtering
// @access  Private (Admin/HR)
router.get('/all', authenticate, authorize(['admin', 'hr', 'super-admin']), UserController.getAllUsers);

// @route   POST /api/users/:id/admin-action
// @desc    Perform admin actions on user
// @access  Private (Admin only)
router.post('/:id/admin-action', authenticate, authorize(['admin', 'super-admin']), UserController.performAdminAction);

// @route   GET /api/users/departments
// @desc    Get list of all departments
// @access  Private (Admin/HR)
router.get('/departments', authenticate, authorize(['admin', 'hr', 'super-admin']), UserController.getDepartments);

// @route   GET /api/users/stats
// @desc    Get user statistics dashboard
// @access  Private (Admin/HR)
router.get('/stats', authenticate, authorize(['admin', 'hr', 'super-admin']), UserController.getUserStats);

// @route   GET /api/users/pending-approval
// @desc    Get users pending approval
// @access  Private (Admin/HR)
router.get('/pending-approval', authenticate, authorize('admin', 'hr'), async (req, res) => {
  try {
    const pendingUsers = await User.find({ isApproved: false })
      .select('-password -faceDescriptors')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { users: pendingUsers }
    });
  } catch (error) {
    console.error('Get pending approval users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending approval users'
    });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user account
// @access  Private (Admin only)
router.delete('/:id', authenticate, authorize(['admin', 'super-admin']), UserController.deleteUser);

module.exports = router; 