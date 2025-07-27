const Joi = require('joi');
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Attendance = require('../models/Attendance');

// Validation schemas
const createOrganizationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  type: Joi.string().valid('school', 'office', 'hotel', 'hospital', 'factory', 'retail', 'other').required(),
  description: Joi.string().trim().max(500).optional(),
  address: Joi.object({
    street: Joi.string().optional(),
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    country: Joi.string().optional(),
    zipCode: Joi.string().optional()
  }).optional(),
  phone: Joi.string().trim().optional(),
  email: Joi.string().email().optional(),
  website: Joi.string().uri().optional(),
  settings: Joi.object({
    workingHours: Joi.object({
      start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('09:00'),
      end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('17:00')
    }).optional(),
    workingDays: Joi.array().items(
      Joi.string().valid('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
    ).optional(),
    timezone: Joi.string().default('Asia/Kolkata'),
    lateThreshold: Joi.number().min(0).max(120).default(15),
    requireFaceRecognition: Joi.boolean().default(true),
    allowOfflineMode: Joi.boolean().default(true)
  }).optional(),
  subscription: Joi.object({
    plan: Joi.string().valid('free', 'basic', 'premium', 'enterprise').default('free'),
    maxUsers: Joi.number().min(1).max(10000).default(10)
  }).optional()
});

const updateOrganizationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  type: Joi.string().valid('school', 'office', 'hotel', 'hospital', 'factory', 'retail', 'other').optional(),
  description: Joi.string().trim().max(500).optional(),
  address: Joi.object({
    street: Joi.string().optional(),
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    country: Joi.string().optional(),
    zipCode: Joi.string().optional()
  }).optional(),
  phone: Joi.string().trim().optional(),
  email: Joi.string().email().optional(),
  website: Joi.string().uri().optional(),
  settings: Joi.object().optional(),
  subscription: Joi.object().optional(),
  isActive: Joi.boolean().optional()
});

class OrganizationController {
  // @desc    Get all organizations (Super Admin only)
  // @route   GET /api/organizations
  // @access  Private (Super Admin)
  async getAllOrganizations(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        type,
        isActive,
        plan,
        search
      } = req.query;

      // Build query
      const query = {};
      
      if (type) query.type = type;
      if (isActive !== undefined) query.isActive = isActive === 'true';
      if (plan) query['subscription.plan'] = plan;
      
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      // Execute query with pagination
      const organizations = await Organization.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .populate('createdBy', 'firstName lastName email');

      const total = await Organization.countDocuments(query);

      res.json({
        success: true,
        data: {
          organizations,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total,
            limit: parseInt(limit)
          }
        }
      });
    } catch (error) {
      console.error('Get organizations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch organizations'
      });
    }
  }

  // @desc    Create new organization (Super Admin only)
  // @route   POST /api/organizations
  // @access  Private (Super Admin)
  async createOrganization(req, res) {
    try {
      // Validate request body
      const { error, value } = createOrganizationSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }

      // Check if organization name already exists
      const existingOrg = await Organization.findOne({ 
        name: value.name,
        isActive: true 
      });
      
      if (existingOrg) {
        return res.status(400).json({
          success: false,
          message: 'Organization with this name already exists'
        });
      }

      // Create organization
      const organization = new Organization({
        ...value,
        createdBy: req.user._id
      });

      // Generate unique invite code
      organization.generateInviteCode();
      await organization.save();

      res.status(201).json({
        success: true,
        message: 'Organization created successfully',
        data: { organization }
      });
    } catch (error) {
      console.error('Create organization error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create organization'
      });
    }
  }

  // @desc    Get organization by ID
  // @route   GET /api/organizations/:id
  // @access  Private (Super Admin or Admin of organization)
  async getOrganizationById(req, res) {
    try {
      const organization = await Organization.findById(req.params.id)
        .populate('createdBy', 'firstName lastName email');

      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found'
        });
      }

      // Check permissions
      if (req.user.role !== 'super-admin' && 
          !req.user.organization?.equals(organization._id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Update stats
      await organization.updateStats();

      res.json({
        success: true,
        data: { organization }
      });
    } catch (error) {
      console.error('Get organization error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch organization'
      });
    }
  }

  // @desc    Update organization (Super Admin only)
  // @route   PUT /api/organizations/:id
  // @access  Private (Super Admin)
  async updateOrganization(req, res) {
    try {
      // Validate request body
      const { error, value } = updateOrganizationSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }

      const organization = await Organization.findById(req.params.id);
      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found'
        });
      }

      // Update organization
      Object.assign(organization, value);
      await organization.save();

      res.json({
        success: true,
        message: 'Organization updated successfully',
        data: { organization }
      });
    } catch (error) {
      console.error('Update organization error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update organization'
      });
    }
  }

  // @desc    Delete organization (Super Admin only)
  // @route   DELETE /api/organizations/:id
  // @access  Private (Super Admin)
  async deleteOrganization(req, res) {
    try {
      const organization = await Organization.findById(req.params.id);
      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found'
        });
      }

      // Check if organization has users
      const userCount = await User.countDocuments({ organization: req.params.id });
      if (userCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete organization with ${userCount} users. Please transfer or delete users first.`
        });
      }

      await Organization.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: 'Organization deleted successfully'
      });
    } catch (error) {
      console.error('Delete organization error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete organization'
      });
    }
  }

  // @desc    Get organization users with comprehensive details
  // @route   GET /api/organizations/:id/users
  // @access  Private (Admin or Super Admin)
  async getOrganizationUsers(req, res) {
    try {
      const { 
        page = 1, 
        limit = 50,
        department,
        role,
        isActive,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Check permissions
      const organization = await Organization.findById(req.params.id);
      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found'
        });
      }

      if (req.user.role !== 'super-admin' && 
          (req.user.role !== 'admin' || !req.user.organization?.equals(organization._id))) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Build query
      const query = { organization: req.params.id };
      
      if (department) query.department = department;
      if (role && role !== 'all') query.role = role;
      if (isActive !== undefined) query.isActive = isActive === 'true';
      
      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { employeeId: { $regex: search, $options: 'i' } },
          { phoneNumber: { $regex: search, $options: 'i' } }
        ];
      }

      // Sort options
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Get users
      const users = await User.find(query)
        .select('-password -faceDescriptors')
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await User.countDocuments(query);

      // Get today's date range
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      // Get attendance data for today for all users
      const todayAttendance = await Attendance.find({
        organization: req.params.id,
        user: { $in: users.map(u => u._id) },
        checkInTime: { $gte: startOfDay, $lt: endOfDay }
      }).populate('user', '_id');

      // Create attendance map
      const attendanceMap = new Map();
      todayAttendance.forEach(att => {
        const userId = att.user._id.toString();
        if (!attendanceMap.has(userId)) {
          attendanceMap.set(userId, {
            checkIn: null,
            checkOut: null,
            totalHours: 0,
            status: 'absent'
          });
        }
        
        const userAtt = attendanceMap.get(userId);
        
        if (att.type === 'check-in') {
          userAtt.checkIn = att.checkInTime;
          userAtt.status = 'present';
        } else if (att.type === 'check-out') {
          userAtt.checkOut = att.checkOutTime;
          if (userAtt.checkIn) {
            userAtt.totalHours = (att.checkOutTime - userAtt.checkIn) / (1000 * 60 * 60);
          }
        }
      });

      // Combine user data with attendance
      const usersWithAttendance = users.map(user => {
        const attendance = attendanceMap.get(user._id.toString()) || {
          checkIn: null,
          checkOut: null,
          totalHours: 0,
          status: 'absent'
        };

        return {
          ...user.toObject(),
          fullName: `${user.firstName} ${user.lastName}`,
          todayAttendance: {
            checkInTime: attendance.checkIn,
            checkOutTime: attendance.checkOut,
            totalHours: Number(attendance.totalHours.toFixed(2)),
            status: attendance.status,
            checkInFormatted: attendance.checkIn ? 
              attendance.checkIn.toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit' 
              }) : '-',
            checkOutFormatted: attendance.checkOut ? 
              attendance.checkOut.toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit' 
              }) : '-'
          }
        };
      });

      res.json({
        success: true,
        data: {
          users: usersWithAttendance,
          organization: {
            _id: organization._id,
            name: organization.name,
            type: organization.type
          },
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total,
            limit: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Get organization users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch organization users'
      });
    }
  }

  // @desc    Get organization statistics
  // @route   GET /api/organizations/:id/stats
  // @access  Private (Admin or Super Admin)
  async getOrganizationStats(req, res) {
    try {
      const organization = await Organization.findById(req.params.id);
      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found'
        });
      }

      // Check permissions
      if (req.user.role !== 'super-admin' && 
          (req.user.role !== 'admin' || !req.user.organization?.equals(organization._id))) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Get comprehensive stats
      const totalUsers = await User.countDocuments({ organization: req.params.id });
      const activeUsers = await User.countDocuments({ organization: req.params.id, isActive: true });
      const approvedUsers = await User.countDocuments({ organization: req.params.id, isApproved: true });
      const pendingUsers = await User.countDocuments({ organization: req.params.id, isApproved: false });

      // Today's stats
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const todayCheckIns = await Attendance.countDocuments({
        organization: req.params.id,
        type: 'check-in',
        checkInTime: { $gte: startOfDay, $lt: endOfDay }
      });

      const todayCheckOuts = await Attendance.countDocuments({
        organization: req.params.id,
        type: 'check-out',
        checkInTime: { $gte: startOfDay, $lt: endOfDay }
      });

      // Department-wise stats
      const departmentStats = await User.aggregate([
        { $match: { organization: new mongoose.Types.ObjectId(req.params.id) } },
        {
          $group: {
            _id: '$department',
            count: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } }
          }
        },
        { $sort: { count: -1 } }
      ]);

      res.json({
        success: true,
        data: {
          organization: {
            name: organization.name,
            type: organization.type
          },
          userStats: {
            total: totalUsers,
            active: activeUsers,
            approved: approvedUsers,
            pending: pendingUsers
          },
          todayStats: {
            checkIns: todayCheckIns,
            checkOuts: todayCheckOuts,
            present: todayCheckIns,
            absent: Math.max(0, activeUsers - todayCheckIns)
          },
          departmentStats
        }
      });

    } catch (error) {
      console.error('Get organization stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch organization statistics'
      });
    }
  }

  // @desc    Get organization by invite code (for employee registration)
  // @route   GET /api/organizations/by-invite/:inviteCode
  // @access  Public
  async getOrganizationByInviteCode(req, res) {
    try {
      const organization = await Organization.findOne({ 
        inviteCode: req.params.inviteCode,
        isActive: true 
      }).select('_id name type description inviteCode');

      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Invalid invite code or organization not found'
        });
      }

      res.json({
        success: true,
        data: { organization }
      });
    } catch (error) {
      console.error('Get organization by invite code error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify invite code'
      });
    }
  }

  // @desc    Get global organization statistics (Super Admin only)
  // @route   GET /api/organizations/global-stats
  // @access  Private (Super Admin)
  async getGlobalStats(req, res) {
    try {
      const orgStats = await Organization.getStats();
      const totalUsers = await User.countDocuments();
      const totalAttendance = await Attendance.countDocuments();

      // Today's global stats
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const todayGlobalAttendance = await Attendance.countDocuments({
        type: 'check-in',
        checkInTime: { $gte: startOfDay, $lt: endOfDay }
      });

      res.json({
        success: true,
        data: {
          ...orgStats,
          totalUsers,
          totalAttendance,
          todayAttendance: todayGlobalAttendance
        }
      });
    } catch (error) {
      console.error('Get global stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch global statistics'
      });
    }
  }
}

module.exports = new OrganizationController(); 