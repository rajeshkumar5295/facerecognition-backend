const Joi = require('joi');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const cloudinaryService = require('../services/cloudinaryService');

// Validation schemas
const markAttendanceSchema = Joi.object({
  type: Joi.string().valid('check-in', 'check-out').required(),
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
    address: Joi.string().max(500).optional()
  }).optional(),
  note: Joi.string().max(500).optional(),
  isOffline: Joi.boolean().default(false),
  offlineTimestamp: Joi.date().optional()
});

// Get Cloudinary upload middleware for attendance images
const upload = cloudinaryService.getAttendanceUpload();

class AttendanceController {
  // @desc    Mark attendance (check-in/check-out)
  // @route   POST /api/attendance/mark
  // @access  Private
  async markAttendance(req, res) {
    try {
      // Validate request body
      const { error, value } = markAttendanceSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }

      const { type, location, note, isOffline, offlineTimestamp } = value;
      const user = req.user;

      // Check if user is approved and active
      if (!user.isApproved) {
        return res.status(403).json({
          success: false,
          message: 'Account not approved yet. Please contact your admin.'
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is inactive. Please contact your admin.'
        });
      }

      // Get today's attendance records
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const existingAttendance = await Attendance.find({
        user: user._id,
        checkInTime: { $gte: startOfDay, $lt: endOfDay }
      }).sort({ checkInTime: -1 });

      // Business logic for check-in/check-out validation
      if (type === 'check-in') {
        const lastCheckIn = existingAttendance.find(att => att.type === 'check-in');
        const lastCheckOut = existingAttendance.find(att => att.type === 'check-out');

        if (lastCheckIn && (!lastCheckOut || lastCheckOut.checkInTime < lastCheckIn.checkInTime)) {
          return res.status(400).json({
            success: false,
            message: 'You are already checked in. Please check out first.'
          });
        }
      } else if (type === 'check-out') {
        const lastCheckIn = existingAttendance.find(att => att.type === 'check-in');
        const lastCheckOut = existingAttendance.find(att => att.type === 'check-out');

        if (!lastCheckIn || (lastCheckOut && lastCheckOut.checkInTime > lastCheckIn.checkInTime)) {
          return res.status(400).json({
            success: false,
            message: 'You need to check in first before checking out.'
          });
        }
      }

      // Create attendance record
      const attendance = new Attendance({
        user: user._id,
        organization: user.organization,
        type,
        checkInTime: isOffline && offlineTimestamp ? new Date(offlineTimestamp) : new Date(),
        location,
        note,
        isOffline,
        faceImage: req.file ? {
          filename: req.file.filename,
          path: req.file.path, // Local path (deprecated)
          cloudinaryUrl: req.file.path, // Cloudinary URL
          cloudinaryPublicId: req.file.filename // Public ID for deletion
        } : undefined
      });

      // Set checkout time for check-out records
      if (type === 'check-out') {
        attendance.checkOutTime = attendance.checkInTime;
      }

      await attendance.save();

      // Update user's last activity
      user.lastLogin = new Date();
      await user.save();

      res.status(201).json({
        success: true,
        message: `${type === 'check-in' ? 'Checked in' : 'Checked out'} successfully!`,
        data: { attendance }
      });

    } catch (error) {
      console.error('Mark attendance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark attendance'
      });
    }
  }

  // @desc    Get user's attendance history
  // @route   GET /api/attendance/my-history
  // @access  Private
  async getMyAttendance(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        month,
        year = new Date().getFullYear(),
        type
      } = req.query;

      // Build date range
      let dateFilter = {};
      if (month && year) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);
        dateFilter = { checkInTime: { $gte: startDate, $lte: endDate } };
      } else if (year) {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59);
        dateFilter = { checkInTime: { $gte: startDate, $lte: endDate } };
      }

      // Build query
      const query = {
        user: req.user._id,
        ...dateFilter
      };

      if (type) {
        query.type = type;
      }

      // Get attendance records
      const attendance = await Attendance.find(query)
        .sort({ checkInTime: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Attendance.countDocuments(query);

      // Calculate stats
      const stats = await Attendance.getAttendanceStats(req.user._id, year, month);

      res.json({
        success: true,
        data: {
          attendance,
          stats,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total,
            limit: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Get my attendance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch attendance history'
      });
    }
  }

  // @desc    Get all attendance records (Admin/HR)
  // @route   GET /api/attendance/all
  // @access  Private (Admin/HR)
  async getAllAttendance(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        userId,
        department,
        type,
        startDate,
        endDate,
        search
      } = req.query;

      // Build base query - Admin can only see their organization's data
      let baseQuery = {};
      if (req.user.role === 'admin') {
        baseQuery.organization = req.user.organization;
      }

      // Date range filter
      if (startDate || endDate) {
        baseQuery.checkInTime = {};
        if (startDate) baseQuery.checkInTime.$gte = new Date(startDate);
        if (endDate) baseQuery.checkInTime.$lte = new Date(endDate + 'T23:59:59.999Z');
      }

      // Type filter
      if (type) {
        baseQuery.type = type;
      }

      // User-specific filter
      if (userId) {
        baseQuery.user = userId;
      }

      // Department filter - need to join with User model
      let attendanceQuery = Attendance.find(baseQuery)
        .populate({
          path: 'user',
          select: 'firstName lastName email employeeId department designation phoneNumber',
          match: department ? { department } : {}
        })
        .sort({ checkInTime: -1 });

      // Apply search filter on populated user data
      if (search) {
        attendanceQuery = attendanceQuery.populate({
          path: 'user',
          match: {
            $or: [
              { firstName: { $regex: search, $options: 'i' } },
              { lastName: { $regex: search, $options: 'i' } },
              { email: { $regex: search, $options: 'i' } },
              { employeeId: { $regex: search, $options: 'i' } }
            ]
          }
        });
      }

      // Execute query with pagination
      const attendance = await attendanceQuery
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();

      // Filter out null users (from populate match)
      const validAttendance = attendance.filter(att => att.user);

      // Get total count for pagination
      const totalQuery = await Attendance.aggregate([
        { $match: baseQuery },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        { $unwind: '$userInfo' },
        ...(department ? [{ $match: { 'userInfo.department': department } }] : []),
        ...(search ? [{
          $match: {
            $or: [
              { 'userInfo.firstName': { $regex: search, $options: 'i' } },
              { 'userInfo.lastName': { $regex: search, $options: 'i' } },
              { 'userInfo.email': { $regex: search, $options: 'i' } },
              { 'userInfo.employeeId': { $regex: search, $options: 'i' } }
            ]
          }
        }] : []),
        { $count: 'total' }
      ]);

      const total = totalQuery.length > 0 ? totalQuery[0].total : 0;

      res.json({
        success: true,
        data: {
          attendance: validAttendance,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total,
            limit: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Get all attendance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch attendance records'
      });
    }
  }

  // @desc    Get attendance statistics
  // @route   GET /api/attendance/stats
  // @access  Private (Admin/HR)
  async getAttendanceStats(req, res) {
    try {
      const {
        userId,
        month,
        year = new Date().getFullYear(),
        department
      } = req.query;

      let matchQuery = {};
      
      // Organization filter for admin
      if (req.user.role === 'admin') {
        matchQuery.organization = req.user.organization;
      }

      // User-specific stats
      if (userId) {
        matchQuery.user = new mongoose.Types.ObjectId(userId);
      }

      // Date range filter
      if (month && year) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);
        matchQuery.checkInTime = { $gte: startDate, $lte: endDate };
      } else if (year) {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59);
        matchQuery.checkInTime = { $gte: startDate, $lte: endDate };
      }

      // Department filter requires joining with User
      let pipeline = [
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        { $unwind: '$userInfo' },
        { $match: { ...matchQuery, ...(department && { 'userInfo.department': department }) } }
      ];

      // Get basic stats
      const basicStats = await Attendance.aggregate([
        ...pipeline,
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            checkIns: {
              $sum: { $cond: [{ $eq: ['$type', 'check-in'] }, 1, 0] }
            },
            checkOuts: {
              $sum: { $cond: [{ $eq: ['$type', 'check-out'] }, 1, 0] }
            },
            offlineRecords: {
              $sum: { $cond: ['$isOffline', 1, 0] }
            }
          }
        }
      ]);

      // Get daily attendance for the period
      const dailyStats = await Attendance.aggregate([
        ...pipeline,
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$checkInTime' } },
              type: '$type'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.date',
            checkIns: {
              $sum: { $cond: [{ $eq: ['$_id.type', 'check-in'] }, '$count', 0] }
            },
            checkOuts: {
              $sum: { $cond: [{ $eq: ['$_id.type', 'check-out'] }, '$count', 0] }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Get department-wise stats if not filtering by specific department
      let departmentStats = [];
      if (!department) {
        departmentStats = await Attendance.aggregate([
          ...pipeline,
          {
            $group: {
              _id: '$userInfo.department',
              totalRecords: { $sum: 1 },
              checkIns: {
                $sum: { $cond: [{ $eq: ['$type', 'check-in'] }, 1, 0] }
              },
              uniqueUsers: { $addToSet: '$user' }
            }
          },
          {
            $addFields: {
              uniqueUsersCount: { $size: '$uniqueUsers' }
            }
          },
          {
            $project: {
              uniqueUsers: 0
            }
          },
          { $sort: { totalRecords: -1 } }
        ]);
      }

      const stats = basicStats[0] || {
        totalRecords: 0,
        checkIns: 0,
        checkOuts: 0,
        offlineRecords: 0
      };

      res.json({
        success: true,
        data: {
          overview: stats,
          dailyStats,
          departmentStats
        }
      });

    } catch (error) {
      console.error('Get attendance stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch attendance statistics'
      });
    }
  }

  // @desc    Update attendance record (Admin only)
  // @route   PUT /api/attendance/:id
  // @access  Private (Admin only)
  async updateAttendance(req, res) {
    try {
      const { note, isApproved } = req.body;
      
      const attendance = await Attendance.findById(req.params.id).populate('user');
      
      if (!attendance) {
        return res.status(404).json({
          success: false,
          message: 'Attendance record not found'
        });
      }

      // Check if admin can modify this record (same organization)
      if (req.user.role === 'admin' && 
          !req.user.organization.equals(attendance.organization)) {
        return res.status(403).json({
          success: false,
          message: 'You can only modify attendance records in your organization'
        });
      }

      // Update fields
      if (note !== undefined) attendance.note = note;
      if (isApproved !== undefined) attendance.isApproved = isApproved;
      
      attendance.modifiedBy = req.user._id;
      attendance.modifiedAt = new Date();

      await attendance.save();

      res.json({
        success: true,
        message: 'Attendance record updated successfully',
        data: { attendance }
      });

    } catch (error) {
      console.error('Update attendance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update attendance record'
      });
    }
  }

  // @desc    Delete attendance record (Admin only)
  // @route   DELETE /api/attendance/:id
  // @access  Private (Admin only)
  async deleteAttendance(req, res) {
    try {
      const attendance = await Attendance.findById(req.params.id);
      
      if (!attendance) {
        return res.status(404).json({
          success: false,
          message: 'Attendance record not found'
        });
      }

      // Check if admin can delete this record (same organization)
      if (req.user.role === 'admin' && 
          !req.user.organization.equals(attendance.organization)) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete attendance records in your organization'
        });
      }

      await Attendance.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: 'Attendance record deleted successfully'
      });

    } catch (error) {
      console.error('Delete attendance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete attendance record'
      });
    }
  }

  // @desc    Get today's attendance summary
  // @route   GET /api/attendance/today-summary
  // @access  Private (Admin/HR)
  async getTodaySummary(req, res) {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      let matchQuery = {
        checkInTime: { $gte: startOfDay, $lt: endOfDay }
      };

      // Organization filter for admin
      if (req.user.role === 'admin') {
        matchQuery.organization = req.user.organization;
      }

      const todayAttendance = await Attendance.aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        { $unwind: '$userInfo' },
        {
          $group: {
            _id: '$user',
            user: { $first: '$userInfo' },
            checkIns: {
              $sum: { $cond: [{ $eq: ['$type', 'check-in'] }, 1, 0] }
            },
            checkOuts: {
              $sum: { $cond: [{ $eq: ['$type', 'check-out'] }, 1, 0] }
            },
            firstCheckIn: {
              $min: { $cond: [{ $eq: ['$type', 'check-in'] }, '$checkInTime', null] }
            },
            lastCheckOut: {
              $max: { $cond: [{ $eq: ['$type', 'check-out'] }, '$checkOutTime', null] }
            }
          }
        },
        {
          $addFields: {
            status: {
              $cond: [
                { $gt: ['$checkIns', 0] },
                { $cond: [{ $gt: ['$checkOuts', 0] }, 'checked-out', 'checked-in'] },
                'absent'
              ]
            },
            totalHours: {
              $cond: [
                { $and: ['$firstCheckIn', '$lastCheckOut'] },
                { $divide: [{ $subtract: ['$lastCheckOut', '$firstCheckIn'] }, 3600000] },
                0
              ]
            }
          }
        },
        { $sort: { 'user.firstName': 1 } }
      ]);

      // Get total user count for organization
      let userQuery = { isActive: true, isApproved: true };
      if (req.user.role === 'admin') {
        userQuery.organization = req.user.organization;
      }
      
      const totalUsers = await User.countDocuments(userQuery);
      const presentUsers = todayAttendance.filter(att => att.status !== 'absent').length;
      const absentUsers = totalUsers - presentUsers;

      res.json({
        success: true,
        data: {
          summary: {
            totalUsers,
            presentUsers,
            absentUsers,
            attendanceRate: totalUsers > 0 ? ((presentUsers / totalUsers) * 100).toFixed(1) : 0
          },
          attendanceList: todayAttendance
        }
      });

    } catch (error) {
      console.error('Get today summary error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch today\'s attendance summary'
      });
    }
  }

  // @desc    Get attendance records by date
  // @route   GET /api/attendance/by-date
  // @access  Private (Admin/HR)
  async getAttendanceByDate(req, res) {
    try {
      const { date, search } = req.query;
      const user = req.user;

      if (!date) {
        return res.status(400).json({
          success: false,
          message: 'Date parameter is required'
        });
      }

      // Build query
      let query = {};

      // Date filtering
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);

      query.createdAt = {
        $gte: startDate,
        $lt: endDate
      };

      // Organization filtering for admins
      if (user.role === 'admin' && user.organization) {
        // First get users from the same organization
        const orgUsers = await User.find({ organization: user.organization }).select('_id');
        const userIds = orgUsers.map(u => u._id);
        query.user = { $in: userIds };
      }

      // Build aggregation pipeline
      let pipeline = [
        { $match: query },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $project: {
            _id: 1,
            type: 1,
            checkInTime: 1,
            checkOutTime: 1,
            status: 1,
            isOffline: 1,
            location: 1,
            confidence: 1,
            createdAt: 1,
            updatedAt: 1,
            user: {
              _id: '$user._id',
              firstName: '$user.firstName',
              lastName: '$user.lastName',
              fullName: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
              employeeId: '$user.employeeId',
              department: '$user.department'
            }
          }
        }
      ];

      // Search filtering
      if (search) {
        pipeline.splice(-1, 0, {
          $match: {
            $or: [
              { 'user.firstName': { $regex: search, $options: 'i' } },
              { 'user.lastName': { $regex: search, $options: 'i' } },
              { 'user.employeeId': { $regex: search, $options: 'i' } },
              { 'user.department': { $regex: search, $options: 'i' } }
            ]
          }
        });
      }

      // Sort by creation time
      pipeline.push({ $sort: { createdAt: -1 } });

      const attendance = await Attendance.aggregate(pipeline);

      res.json({
        success: true,
        data: { attendance }
      });
    } catch (error) {
      console.error('Get attendance by date error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch attendance records'
      });
    }
  }
}

module.exports = {
  AttendanceController: new AttendanceController(),
  upload
}; 