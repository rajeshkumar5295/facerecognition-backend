const express = require('express');
const router = express.Router();
const { AttendanceController, upload } = require('../controllers/AttendanceController');
const { 
  authenticate, 
  authorize, 
  requireApproval, 
  requireFaceEnrollment,
  sensitiveOperationLimit 
} = require('../middleware/auth');

// @route   POST /api/attendance/mark
// @desc    Mark attendance (check-in/check-out)
// @access  Private
router.post('/mark', authenticate, requireApproval, upload.single('photo'), AttendanceController.markAttendance);

// @route   GET /api/attendance/my-history
// @desc    Get user's attendance history
// @access  Private
router.get('/my-history', authenticate, AttendanceController.getMyAttendance);

// @route   GET /api/attendance/all
// @desc    Get all attendance records (Admin/HR)
// @access  Private (Admin/HR)
router.get('/all', authenticate, authorize(['admin', 'hr', 'super-admin']), AttendanceController.getAllAttendance);

// @route   GET /api/attendance/stats
// @desc    Get attendance statistics
// @access  Private (Admin/HR)
router.get('/stats', authenticate, authorize(['admin', 'hr', 'super-admin']), AttendanceController.getAttendanceStats);

// @route   PUT /api/attendance/:id
// @desc    Update attendance record (Admin only)
// @access  Private (Admin only)
router.put('/:id', authenticate, authorize(['admin', 'super-admin']), AttendanceController.updateAttendance);

// @route   DELETE /api/attendance/:id
// @desc    Delete attendance record (Admin only)
// @access  Private (Admin only)
router.delete('/:id', authenticate, authorize(['admin', 'super-admin']), AttendanceController.deleteAttendance);

// @route   GET /api/attendance/today-summary
// @desc    Get today's attendance summary
// @access  Private (Admin/HR)
router.get('/today-summary', authenticate, authorize(['admin', 'hr', 'super-admin']), AttendanceController.getTodaySummary);

// @route   GET /api/attendance/by-date
// @desc    Get attendance records by date
// @access  Private (Admin/HR)
router.get('/by-date', authenticate, authorize(['admin', 'hr', 'super-admin']), AttendanceController.getAttendanceByDate);

module.exports = router; 