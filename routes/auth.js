const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const { authenticate, sensitiveOperationLimit } = require('../middleware/auth');

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', AuthController.register);

// @route   POST /api/auth/register-with-org
// @desc    Register a new user with organization
// @access  Public
router.post('/register-with-org', AuthController.registerWithOrganization);

// @route   POST /api/auth/register-organization
// @desc    Register a new organization with manager
// @access  Public
router.post('/register-organization', AuthController.registerOrganization);

// @route   POST /api/auth/test-email
// @desc    Test email configuration
// @access  Public (for debugging only)
router.post('/test-email', async (req, res) => {
  try {
    const emailService = require('../services/emailService');
    const testEmail = req.body.email || 'test@example.com';
    
    console.log('🧪 Testing email service...');
    console.log('📧 Email Provider:', process.env.EMAIL_PROVIDER || 'nodemailer');
    console.log('📧 Test email address:', testEmail);
    
    // Test connection
    const connectionTest = await emailService.testConnection();
    console.log('📧 Connection test result:', connectionTest);
    
    if (!connectionTest) {
      return res.status(500).json({
        success: false,
        message: 'Email service connection failed',
        config: {
          provider: process.env.EMAIL_PROVIDER || 'nodemailer',
          service: process.env.EMAIL_SERVICE,
          hasUser: !!process.env.EMAIL_USER,
          hasPassword: !!process.env.EMAIL_PASSWORD
        }
      });
    }
    
    // Send test email
    await emailService.sendEmail({
      to: testEmail,
      subject: 'Test Email from Attendance System',
      html: '<h1>🎉 Email service is working!</h1><p>This is a test email to verify your email configuration.</p>',
      text: 'Email service is working! This is a test email to verify your email configuration.'
    });
    
    res.json({
      success: true,
      message: 'Test email sent successfully',
      config: {
        provider: process.env.EMAIL_PROVIDER || 'nodemailer',
        service: process.env.EMAIL_SERVICE,
        testEmail: testEmail
      }
    });
    
  } catch (error) {
    console.error('❌ Email test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Email test failed: ' + error.message,
      config: {
        provider: process.env.EMAIL_PROVIDER || 'nodemailer',
        service: process.env.EMAIL_SERVICE,
        hasUser: !!process.env.EMAIL_USER,
        hasPassword: !!process.env.EMAIL_PASSWORD
      }
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', AuthController.login);

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', authenticate, AuthController.getProfile);

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticate, AuthController.updateProfile);

// @route   POST /api/auth/verify-token
// @desc    Verify if token is valid
// @access  Private
router.post('/verify-token', authenticate, AuthController.verifyToken);

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', authenticate, AuthController.logout);

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', AuthController.forgotPassword);

// @route   PATCH /api/auth/reset-password/:token
// @desc    Reset password with token
// @access  Public
router.patch('/reset-password/:token', AuthController.resetPassword);

// @route   PATCH /api/auth/change-password
// @desc    Change password (authenticated user)
// @access  Private
router.patch('/change-password', authenticate, AuthController.changePassword);

// @route   POST /api/auth/enroll-face
// @desc    Upload face image for enrollment
// @access  Private
router.post('/enroll-face', authenticate, AuthController.upload.single('faceImage'), AuthController.enrollFace);

// @route   POST /api/auth/upload-face-base64
// @desc    Upload face image as base64 for enrollment
// @access  Private
router.post('/upload-face-base64', authenticate, AuthController.uploadFaceBase64);

// @route   POST /api/auth/test-cloudinary
// @desc    Test Cloudinary connection and configuration
// @access  Private
router.post('/test-cloudinary', authenticate, async (req, res) => {
  try {
    const cloudinaryService = require('../services/cloudinaryService');
    
    // Test connection
    const connectionTest = await cloudinaryService.testConnection();
    
    if (!connectionTest) {
      return res.status(500).json({
        success: false,
        message: 'Cloudinary connection failed',
        details: 'Please check your environment variables'
      });
    }

    // Get usage information
    const usage = await cloudinaryService.getUsage();
    
    res.json({
      success: true,
      message: 'Cloudinary connection successful',
      data: {
        connected: true,
        usage: usage || 'Usage info not available'
      }
    });
  } catch (error) {
    console.error('Cloudinary test error:', error);
    res.status(500).json({
      success: false,
      message: 'Cloudinary test failed',
      error: error.message
    });
  }
});

module.exports = router; 