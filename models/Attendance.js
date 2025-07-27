const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  
  // Date and Time Information
  date: {
    type: Date,
    required: true,
    default: () => {
      const today = new Date();
      return new Date(today.getFullYear(), today.getMonth(), today.getDate());
    }
  },
  checkInTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  checkOutTime: {
    type: Date
  },
  
  // Attendance Type
  type: {
    type: String,
    enum: ['check-in', 'check-out', 'break-start', 'break-end'],
    required: true
  },
  
  // Recognition Method
  recognitionMethod: {
    type: String,
    enum: ['face-recognition', 'manual', 'aadhaar-assisted'],
    default: 'face-recognition'
  },
  
  // Face Recognition Data
  faceConfidence: {
    type: Number,
    min: 0,
    max: 1
  },
  faceImage: {
    filename: String,
    path: String
  },
  
  // Location Information
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  
  // Status and Validation
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'auto-approved'],
    default: 'auto-approved'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedDate: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  
  // Attendance Metrics
  workingHours: {
    type: Number, // in minutes
    default: 0
  },
  breakTime: {
    type: Number, // in minutes
    default: 0
  },
  overtime: {
    type: Number, // in minutes
    default: 0
  },
  
  // Offline Mode Support
  isOfflineEntry: {
    type: Boolean,
    default: false
  },
  syncedAt: {
    type: Date
  },
  deviceId: {
    type: String
  },
  
  // Notes and Comments
  notes: {
    type: String,
    maxlength: 500
  },
  adminNotes: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
AttendanceSchema.index({ user: 1, date: 1 });
AttendanceSchema.index({ user: 1, type: 1, createdAt: -1 });
AttendanceSchema.index({ date: 1, status: 1 });
AttendanceSchema.index({ isOfflineEntry: 1, syncedAt: 1 });
AttendanceSchema.index({ organization: 1, date: 1 });
AttendanceSchema.index({ organization: 1, user: 1, date: 1 });

// Virtual for formatted date
AttendanceSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString();
});

// Virtual for formatted check-in time
AttendanceSchema.virtual('formattedCheckInTime').get(function() {
  return this.checkInTime.toLocaleTimeString();
});

// Virtual for formatted check-out time
AttendanceSchema.virtual('formattedCheckOutTime').get(function() {
  return this.checkOutTime ? this.checkOutTime.toLocaleTimeString() : null;
});

// Virtual for total working hours (formatted)
AttendanceSchema.virtual('formattedWorkingHours').get(function() {
  const hours = Math.floor(this.workingHours / 60);
  const minutes = this.workingHours % 60;
  return `${hours}h ${minutes}m`;
});

// Static method to get today's attendance for a user
AttendanceSchema.statics.getTodayAttendance = function(userId) {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  
  return this.find({
    user: userId,
    checkInTime: { $gte: startOfDay, $lt: endOfDay }
  }).sort({ checkInTime: -1 });
};

// Static method to get attendance summary for a date range
AttendanceSchema.statics.getAttendanceSummary = function(userId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate, $lte: endDate },
        status: { $in: ['approved', 'auto-approved'] }
      }
    },
    {
      $group: {
        _id: '$date',
        totalWorkingHours: { $sum: '$workingHours' },
        totalBreakTime: { $sum: '$breakTime' },
        totalOvertime: { $sum: '$overtime' },
        checkInTime: { $first: '$checkInTime' },
        checkOutTime: { $last: '$checkOutTime' },
        attendanceCount: { $sum: 1 }
      }
    },
    {
      $sort: { '_id': 1 }
    }
  ]);
};

// Static method to calculate working hours between check-in and check-out
AttendanceSchema.statics.calculateWorkingHours = function(checkIn, checkOut, breakTime = 0) {
  if (!checkOut) return 0;
  
  const diffInMs = checkOut - checkIn;
  const totalMinutes = Math.floor(diffInMs / (1000 * 60));
  return Math.max(0, totalMinutes - breakTime);
};

// Method to mark check-out and calculate working hours
AttendanceSchema.methods.markCheckOut = function(checkOutTime = new Date()) {
  this.checkOutTime = checkOutTime;
  this.type = 'check-out';
  
  // Calculate working hours (assuming 1 hour break if more than 6 hours)
  const totalMinutes = AttendanceSchema.statics.calculateWorkingHours(
    this.checkInTime, 
    checkOutTime, 
    this.breakTime
  );
  
  this.workingHours = totalMinutes;
  
  // Calculate overtime (assuming 8 hours standard work day)
  const standardWorkDay = 8 * 60; // 8 hours in minutes
  if (totalMinutes > standardWorkDay) {
    this.overtime = totalMinutes - standardWorkDay;
  }
  
  return this.save();
};

// Method to sync offline entry
AttendanceSchema.methods.syncOfflineEntry = function() {
  this.isOfflineEntry = false;
  this.syncedAt = new Date();
  return this.save();
};

// Pre-save middleware to set date from checkInTime
AttendanceSchema.pre('save', function(next) {
  if (this.isNew && this.checkInTime) {
    const checkInDate = new Date(this.checkInTime);
    this.date = new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate());
  }
  next();
});

module.exports = mongoose.model('Attendance', AttendanceSchema); 