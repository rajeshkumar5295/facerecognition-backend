const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  // Basic Information
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  employeeId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  department: {
    type: String,
    required: true,
    trim: true
  },
  designation: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  
  // Authentication
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  
  // Face Recognition Data
  faceDescriptors: [{
    type: [Number], // Face-api.js descriptors array
    required: true
  }],
  faceImages: [{
    filename: String,
    path: String, // Local file path (deprecated)
    cloudinaryUrl: String, // Cloudinary URL
    cloudinaryPublicId: String, // Cloudinary public ID for deletion
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  faceEnrolled: {
    type: Boolean,
    default: false
  },
  faceEnrollmentAttempts: {
    type: Number,
    default: 0,
    max: 3
  },
  
  // Aadhaar Information (Optional)
  aadhaarNumber: {
    type: String,
    trim: true,
    sparse: true // Allows null values while maintaining uniqueness for non-null values
  },
  aadhaarVerified: {
    type: Boolean,
    default: false
  },
  aadhaarVerificationDate: {
    type: Date
  },
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedDate: {
    type: Date
  },
  
  // Organization Reference
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false, // Making it optional for backward compatibility
    validate: {
      validator: function(value) {
        // Only require organization for non-super-admin users created after org system
        if (this.role === 'super-admin') return true;
        // Allow existing users without organization
        if (!value && this.isNew && this.role !== 'super-admin') {
          return false;
        }
        return true;
      },
      message: 'Organization is required for this user role'
    }
  },
  
  // Password Reset
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  },
  
  // Metadata
  role: {
    type: String,
    enum: ['employee', 'admin', 'hr', 'super-admin'],
    default: 'employee'
  },
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ employeeId: 1 });
UserSchema.index({ organization: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ organization: 1, role: 1 });
UserSchema.index({ aadhaarNumber: 1 }, { sparse: true });

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account locked status
UserSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to increment login attempts
UserSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
UserSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Method to add face descriptor
UserSchema.methods.addFaceDescriptor = function(descriptor) {
  this.faceDescriptors.push(descriptor);
  if (this.faceDescriptors.length >= 3) {
    this.faceEnrolled = true;
  }
  return this.save();
};

// Method to clear face data
UserSchema.methods.clearFaceData = function() {
  this.faceDescriptors = [];
  this.faceImages = [];
  this.faceEnrolled = false;
  this.faceEnrollmentAttempts = 0;
  return this.save();
};

// Method to generate password reset token
UserSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

// Static method to find by credentials
UserSchema.statics.findByCredentials = async function(email, password) {
  const user = await this.findOne({ email });
  
  if (!user) {
    throw new Error('Invalid credentials');
  }
  
  if (user.isLocked) {
    throw new Error('Account temporarily locked due to too many failed login attempts');
  }
  
  const isMatch = await user.comparePassword(password);
  
  if (!isMatch) {
    await user.incLoginAttempts();
    throw new Error('Invalid credentials');
  }
  
  // Reset login attempts on successful login
  if (user.loginAttempts > 0) {
    await user.resetLoginAttempts();
  }
  
  // Update last login
  user.lastLogin = new Date();
  await user.save();
  
  return user;
};

module.exports = mongoose.model('User', UserSchema); 