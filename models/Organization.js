const mongoose = require('mongoose');

const OrganizationSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  type: {
    type: String,
    enum: ['school', 'office', 'hotel', 'hospital', 'factory', 'retail', 'other'],
    required: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Contact Information
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  
  // Settings
  settings: {
    workingHours: {
      start: {
        type: String,
        default: '09:00'
      },
      end: {
        type: String,
        default: '17:00'
      }
    },
    workingDays: [{
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    }],
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    },
    lateThreshold: {
      type: Number, // minutes
      default: 15
    },
    requireFaceRecognition: {
      type: Boolean,
      default: true
    },
    allowOfflineMode: {
      type: Boolean,
      default: true
    }
  },
  
  // Subscription and Billing
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium', 'enterprise'],
      default: 'free'
    },
    maxUsers: {
      type: Number,
      default: 10
    },
    expiresAt: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  
  // Organization Invite System
  inviteCode: {
    type: String,
    unique: true,
    sparse: true
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Statistics
  stats: {
    totalUsers: {
      type: Number,
      default: 0
    },
    activeUsers: {
      type: Number,
      default: 0
    },
    totalAttendanceRecords: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes
OrganizationSchema.index({ name: 1 });
OrganizationSchema.index({ type: 1 });
OrganizationSchema.index({ 'subscription.plan': 1 });
OrganizationSchema.index({ isActive: 1 });

// Virtuals
OrganizationSchema.virtual('fullAddress').get(function() {
  const addr = this.address;
  if (!addr) return '';
  return [addr.street, addr.city, addr.state, addr.country, addr.zipCode]
    .filter(Boolean)
    .join(', ');
});

// Methods
OrganizationSchema.methods.updateStats = async function() {
  const User = mongoose.model('User');
  const Attendance = mongoose.model('Attendance');
  
  this.stats.totalUsers = await User.countDocuments({ organization: this._id });
  this.stats.activeUsers = await User.countDocuments({ 
    organization: this._id, 
    isActive: true 
  });
  this.stats.totalAttendanceRecords = await Attendance.countDocuments({ 
    organization: this._id 
  });
  
  return this.save();
};

OrganizationSchema.methods.generateInviteCode = function() {
  // Generate a 8-character alphanumeric code
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  this.inviteCode = result;
  return result;
};

OrganizationSchema.methods.canAddUser = function() {
  return this.stats.totalUsers < this.subscription.maxUsers;
};

OrganizationSchema.methods.isSubscriptionActive = function() {
  if (!this.subscription.isActive) return false;
  if (this.subscription.expiresAt && new Date() > this.subscription.expiresAt) {
    return false;
  }
  return true;
};

// Static methods
OrganizationSchema.statics.getByType = function(type) {
  return this.find({ type, isActive: true }).sort({ name: 1 });
};

OrganizationSchema.statics.getStats = async function() {
  const totalOrgs = await this.countDocuments({ isActive: true });
  const orgsByType = await this.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  
  return {
    totalOrganizations: totalOrgs,
    organizationsByType: orgsByType
  };
};

module.exports = mongoose.model('Organization', OrganizationSchema); 