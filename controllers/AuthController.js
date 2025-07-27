const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

const User = require('../models/User');
const Organization = require('../models/Organization');

// Validation schemas
const registerSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).required(),
  lastName: Joi.string().trim().min(2).max(50).required(),
  email: Joi.string().email().required(),
  employeeId: Joi.string().trim().min(3).max(20).required(),
  department: Joi.string().trim().min(2).max(100).required(),
  designation: Joi.string().trim().min(2).max(100).required(),
  phoneNumber: Joi.string().trim().min(10).max(15).required(),
  password: Joi.string().min(6).max(128).required(),
  aadhaarNumber: Joi.string().trim().length(12).pattern(/^\d+$/).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Multer configuration for face image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/faces/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `face-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only JPEG, JPG, and PNG images are allowed'));
    }
  }
});

// Utility function to generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// Utility function to format user response
const formatUserResponse = (user) => {
  return {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.fullName,
    email: user.email,
    employeeId: user.employeeId,
    department: user.department,
    designation: user.designation,
    phoneNumber: user.phoneNumber,
    role: user.role,
    organization: user.organization,
    isActive: user.isActive,
    isApproved: user.isApproved,
    faceEnrolled: user.faceEnrolled,
    faceEnrollmentAttempts: user.faceEnrollmentAttempts,
    aadhaarNumber: user.aadhaarNumber,
    aadhaarVerified: user.aadhaarVerified,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt
  };
};

class AuthController {
  // @desc    Register a new user
  // @route   POST /api/auth/register
  // @access  Public
  async register(req, res) {
    try {
      // Validate request body
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }

      const {
        firstName,
        lastName,
        email,
        employeeId,
        department,
        designation,
        phoneNumber,
        password,
        aadhaarNumber
      } = value;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { employeeId }]
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email or employee ID already exists'
        });
      }

      // Check Aadhaar number uniqueness if provided
      if (aadhaarNumber) {
        const existingAadhaar = await User.findOne({ aadhaarNumber });
        if (existingAadhaar) {
          return res.status(400).json({
            success: false,
            message: 'This Aadhaar number is already registered'
          });
        }
      }

      // Create new user
      const user = new User({
        firstName,
        lastName,
        email,
        employeeId,
        department,
        designation,
        phoneNumber,
        password,
        aadhaarNumber
      });

      await user.save();

      // Generate token
      const token = generateToken(user._id);

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Awaiting admin approval.',
        data: {
          user: formatUserResponse(user),
          token
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed'
      });
    }
  }

  // @desc    Register a new user with organization
  // @route   POST /api/auth/register-with-org
  // @access  Public
  async registerWithOrganization(req, res) {
    try {
      const {
        firstName,
        lastName,
        email,
        employeeId,
        department,
        designation,
        phoneNumber,
        password,
        role = 'employee',
        organization,
        aadhaarNumber
      } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { employeeId }]
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email or employee ID already exists'
        });
      }

      // Check if organization exists
      const org = await Organization.findById(organization);
      if (!org) {
        return res.status(400).json({
          success: false,
          message: 'Organization not found'
        });
      }

      // Check Aadhaar number uniqueness if provided
      if (aadhaarNumber) {
        const existingAadhaar = await User.findOne({ aadhaarNumber });
        if (existingAadhaar) {
          return res.status(400).json({
            success: false,
            message: 'This Aadhaar number is already registered'
          });
        }
      }

      // Create new user with organization
      const user = new User({
        firstName,
        lastName,
        email,
        employeeId,
        department,
        designation,
        phoneNumber,
        password,
        role,
        organization,
        aadhaarNumber,
        // Auto-approve admins, others need approval
        isApproved: role === 'admin'
      });

      await user.save();

      // Generate token
      const token = generateToken(user._id);

      res.status(201).json({
        success: true,
        message: role === 'admin' 
          ? 'Admin account created successfully!' 
          : 'Employee registered successfully. Awaiting manager approval.',
        data: {
          user: formatUserResponse(user),
          token
        }
      });
    } catch (error) {
      console.error('Organization registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed'
      });
    }
  }

  // @desc    Register a new organization with manager
  // @route   POST /api/auth/register-organization
  // @access  Public
  async registerOrganization(req, res) {
    try {
      const {
        // Organization data
        organizationData,
        // Manager data
        managerData
      } = req.body;

      // Validate required fields
      if (!organizationData || !managerData) {
        return res.status(400).json({
          success: false,
          message: 'Organization and manager data are required'
        });
      }

      // Check if organization name already exists
      const existingOrg = await Organization.findOne({ 
        name: organizationData.name,
        isActive: true 
      });
      
      if (existingOrg) {
        return res.status(400).json({
          success: false,
          message: 'Organization with this name already exists'
        });
      }

      // Check if manager email already exists
      const existingUser = await User.findOne({
        $or: [{ email: managerData.email }, { employeeId: managerData.employeeId }]
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email or employee ID already exists'
        });
      }

      // Validate passwords match
      if (managerData.password !== managerData.confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Passwords do not match'
        });
      }

      // Create organization first
      const organization = new Organization({
        name: organizationData.name,
        type: organizationData.type,
        description: organizationData.description,
        address: organizationData.address,
        phone: organizationData.phone,
        email: organizationData.email,
        website: organizationData.website,
        settings: organizationData.settings || {
          workingHours: { start: '09:00', end: '17:00' },
          workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          timezone: 'Asia/Kolkata',
          lateThreshold: 15,
          requireFaceRecognition: true,
          allowOfflineMode: true
        },
        subscription: organizationData.subscription || {
          plan: 'free',
          maxUsers: 50
        }
      });

      // Generate unique invite code
      organization.generateInviteCode();
      await organization.save();

      // Create manager user
      const manager = new User({
        firstName: managerData.firstName,
        lastName: managerData.lastName,
        email: managerData.email,
        employeeId: managerData.employeeId,
        phoneNumber: managerData.phoneNumber,
        password: managerData.password,
        role: 'admin',
        department: 'Management',
        designation: 'Manager/Admin',
        organization: organization._id,
        isApproved: true, // Auto-approve organization creator
        isActive: true
      });

      await manager.save();

      // Update organization with created by field
      organization.createdBy = manager._id;
      await organization.save();

      // Send email with invite code using email service
      console.log('📧 Attempting to send welcome email to:', manager.email);
      
      try {
        const emailService = require('../services/emailService');
        
        // Test email service connection first
        const connectionTest = await emailService.testConnection();
        console.log('📧 Email service connection test:', connectionTest);
        
        await emailService.sendOrganizationWelcomeEmail(manager.email, {
          organizationName: organization.name,
          managerName: `${manager.firstName} ${manager.lastName}`,
          email: manager.email,
          inviteCode: organization.inviteCode,
          loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`
        });
        
        console.log('✅ Welcome email sent successfully');
      } catch (emailError) {
        console.error('❌ Email sending failed:', emailError.message);
        // Don't throw error - email failure shouldn't stop organization creation
      }

      // Generate token for immediate login
      const token = generateToken(manager._id);

      res.status(201).json({
        success: true,
        message: 'Organization and manager account created successfully! Check your email for the invite code.',
        data: {
          token,
          user: {
            id: manager._id,
            firstName: manager.firstName,
            lastName: manager.lastName,
            email: manager.email,
            role: manager.role,
            organization: {
              id: organization._id,
              name: organization.name,
              inviteCode: organization.inviteCode
            }
          }
        }
      });

    } catch (error) {
      console.error('Organization registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create organization'
      });
    }
  }



  // @desc    Login user
  // @route   POST /api/auth/login
  // @access  Public
  async login(req, res) {
    try {
      // Validate request body
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }

      const { email, password } = value;

      // Find user and validate credentials
      const user = await User.findByCredentials(email, password);

      // Generate token
      const token = generateToken(user._id);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: formatUserResponse(user),
          token
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(401).json({
        success: false,
        message: error.message || 'Login failed'
      });
    }
  }

  // @desc    Get current user profile
  // @route   GET /api/auth/me
  // @access  Private
  async getProfile(req, res) {
    try {
      const user = req.user;

      res.json({
        success: true,
        data: { user: formatUserResponse(user) }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch profile'
      });
    }
  }

  // @desc    Update user profile
  // @route   PUT /api/auth/profile
  // @access  Private
  async updateProfile(req, res) {
    try {
      const user = req.user;
      const { firstName, lastName, phoneNumber, department, designation } = req.body;

      // Update user fields
      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (phoneNumber) user.phoneNumber = phoneNumber;
      if (department) user.department = department;
      if (designation) user.designation = designation;

      await user.save();

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user: formatUserResponse(user) }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile'
      });
    }
  }

  // @desc    Verify if token is valid
  // @route   POST /api/auth/verify-token
  // @access  Private
  async verifyToken(req, res) {
    try {
      res.json({
        success: true,
        message: 'Token is valid',
        data: {
          user: formatUserResponse(req.user)
        }
      });
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Token verification failed'
      });
    }
  }

  // @desc    Logout user
  // @route   POST /api/auth/logout
  // @access  Private
  async logout(req, res) {
    try {
      // Since we're using JWT, we can't invalidate the token server-side
      // This is handled client-side by removing the token
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
  }
}

module.exports = new AuthController(); 