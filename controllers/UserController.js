const Joi = require('joi');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const fs = require('fs').promises;

// Validation schemas
const updateProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).optional(),
  lastName: Joi.string().trim().min(2).max(50).optional(),
  phoneNumber: Joi.string().trim().min(10).max(15).optional(),
  department: Joi.string().trim().min(2).max(100).optional(),
  designation: Joi.string().trim().min(2).max(100).optional()
});

const adminActionSchema = Joi.object({
  action: Joi.string().valid('approve', 'reject', 'activate', 'deactivate', 'reset-face').required(),
  reason: Joi.string().max(500).optional()
});

class UserController {
  // @desc    Get user profile by ID
  // @route   GET /api/users/profile/:id
  // @access  Private (Owner or Admin)
  async getUserProfile(req, res) {
    try {
      const user = await User.findById(req.params.id).select('-password');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check permissions - user can view own profile or admin can view any in org
      if (req.user._id.toString() !== user._id.toString() && 
          req.user.role !== 'admin' && req.user.role !== 'super-admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Additional org check for admins
      if (req.user.role === 'admin' && 
          !req.user.organization.equals(user.organization)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      res.json({
        success: true,
        data: { user }
      });
    } catch (error) {
      console.error('Get user profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user profile'
      });
    }
  }

  // @desc    Update user profile
  // @route   PUT /api/users/profile/:id
  // @access  Private (Owner or Admin)
  async updateUserProfile(req, res) {
    try {
      // Validate request body
      const { error, value } = updateProfileSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }

      const user = await User.findById(req.params.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check permissions
      if (req.user._id.toString() !== user._id.toString() && 
          req.user.role !== 'admin' && req.user.role !== 'super-admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Update user fields
      Object.keys(value).forEach(key => {
        if (value[key]) {
          user[key] = value[key];
        }
      });

      await user.save();

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user }
      });
    } catch (error) {
      console.error('Update user profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user profile'
      });
    }
  }

  // @desc    Get all users with pagination and filtering
  // @route   GET /api/users/all
  // @access  Private (Admin/HR)
  async getAllUsers(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        department,
        role,
        isApproved,
        isActive,
        faceEnrolled,
        search
      } = req.query;

      // Build query - Admin can only see users in their organization
      let query = {};
      
      if (req.user.role === 'admin') {
        query.organization = req.user.organization;
      }
      
      if (department) {
        query.department = department;
      }
      
      if (role) {
        query.role = role;
      }
      
      if (isApproved !== undefined) {
        query.isApproved = isApproved === 'true';
      }
      
      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }
      
      if (faceEnrolled !== undefined) {
        query.faceEnrolled = faceEnrolled === 'true';
      }

      // Add search functionality
      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { employeeId: { $regex: search, $options: 'i' } }
        ];
      }

      // Execute query with pagination
      const users = await User.find(query)
        .select('-password -faceDescriptors')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await User.countDocuments(query);

      // Get attendance stats for each user
      const usersWithStats = await Promise.all(
        users.map(async (user) => {
          const todayAttendance = await Attendance.getTodayAttendance(user._id);
          const hasCheckedIn = todayAttendance.some(att => att.type === 'check-in');
          const hasCheckedOut = todayAttendance.some(att => att.type === 'check-out');
          
          return {
            ...user.toObject(),
            todayStatus: {
              hasCheckedIn,
              hasCheckedOut,
              attendanceCount: todayAttendance.length
            }
          };
        })
      );

      res.json({
        success: true,
        data: {
          users: usersWithStats,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total,
            limit: parseInt(limit)
          }
        }
      });
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch users'
      });
    }
  }

  // @desc    Perform admin actions on user
  // @route   POST /api/users/:id/admin-action
  // @access  Private (Admin only)
  async performAdminAction(req, res) {
    try {
      // Validate request body
      const { error, value } = adminActionSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }

      const { action, reason } = value;
      const user = await User.findById(req.params.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if admin can manage this user (same organization)
      if (req.user.role === 'admin' && 
          !req.user.organization.equals(user.organization)) {
        return res.status(403).json({
          success: false,
          message: 'You can only manage users in your organization'
        });
      }

      // Prevent self-modification for certain actions
      if (req.user._id.toString() === user._id.toString() && 
          ['deactivate', 'reject'].includes(action)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot perform this action on your own account'
        });
      }

      // Perform action
      switch (action) {
        case 'approve':
          user.isApproved = true;
          user.approvedBy = req.user._id;
          user.approvedDate = new Date();
          break;
          
        case 'reject':
          user.isApproved = false;
          user.isActive = false;
          break;
          
        case 'activate':
          user.isActive = true;
          break;
          
        case 'deactivate':
          user.isActive = false;
          break;
          
        case 'reset-face':
          await user.clearFaceData();
          break;
      }

      await user.save();

      res.json({
        success: true,
        message: `User ${action}d successfully`,
        data: { user }
      });
    } catch (error) {
      console.error('Admin action error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform admin action'
      });
    }
  }

  // @desc    Get list of all departments
  // @route   GET /api/users/departments
  // @access  Private (Admin/HR)
  async getDepartments(req, res) {
    try {
      let query = {};
      
      // Admin can only see departments in their organization
      if (req.user.role === 'admin') {
        query.organization = req.user.organization;
      }

      const departments = await User.distinct('department', query);
      
      res.json({
        success: true,
        data: { departments }
      });
    } catch (error) {
      console.error('Get departments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch departments'
      });
    }
  }

  // @desc    Get user statistics dashboard
  // @route   GET /api/users/stats
  // @access  Private (Admin/HR)
  async getUserStats(req, res) {
    try {
      let query = {};
      
      // Admin can only see stats for their organization
      if (req.user.role === 'admin') {
        query.organization = req.user.organization;
      }

      const totalUsers = await User.countDocuments(query);
      const approvedUsers = await User.countDocuments({ ...query, isApproved: true });
      const pendingApproval = await User.countDocuments({ ...query, isApproved: false });
      const activeUsers = await User.countDocuments({ ...query, isActive: true });
      const faceEnrolledUsers = await User.countDocuments({ ...query, faceEnrolled: true });
      const aadhaarVerifiedUsers = await User.countDocuments({ ...query, aadhaarVerified: true });

      // Get department-wise stats
      const departmentStats = await User.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$department',
            count: { $sum: 1 },
            approved: {
              $sum: { $cond: [{ $eq: ['$isApproved', true] }, 1, 0] }
            },
            faceEnrolled: {
              $sum: { $cond: [{ $eq: ['$faceEnrolled', true] }, 1, 0] }
            }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // Get today's attendance stats
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      let attendanceQuery = {
        checkInTime: { $gte: startOfDay, $lt: endOfDay }
      };

      // Add organization filter for admin
      if (req.user.role === 'admin') {
        attendanceQuery.organization = req.user.organization;
      }

      const todayAttendance = await Attendance.aggregate([
        { $match: attendanceQuery },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 }
          }
        }
      ]);

      const attendanceStats = todayAttendance.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          userStats: {
            total: totalUsers,
            approved: approvedUsers,
            pending: pendingApproval,
            active: activeUsers,
            faceEnrolled: faceEnrolledUsers,
            aadhaarVerified: aadhaarVerifiedUsers
          },
          departmentStats,
          todayAttendance: attendanceStats
        }
      });
    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user statistics'
      });
    }
  }

  // @desc    Delete user account (Admin only)
  // @route   DELETE /api/users/:id
  // @access  Private (Admin only)
  async deleteUser(req, res) {
    try {
      const user = await User.findById(req.params.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check permissions
      if (req.user.role === 'admin' && 
          !req.user.organization.equals(user.organization)) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete users in your organization'
        });
      }

      // Prevent self-deletion
      if (req.user._id.toString() === user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete your own account'
        });
      }

      // Clean up related data
      await Attendance.deleteMany({ user: user._id });
      
      // Clean up face images
      for (const faceImage of user.faceImages) {
        try {
          await fs.unlink(faceImage.path);
        } catch (error) {
          console.error('Error deleting face image:', error);
        }
      }

      await User.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: 'User account deleted successfully'
      });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete user account'
      });
    }
  }
}

module.exports = new UserController(); 