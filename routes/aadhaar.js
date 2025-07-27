const express = require('express');
const axios = require('axios');
const Joi = require('joi');
const User = require('../models/User');
const { authenticate, sensitiveOperationLimit } = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const aadhaarVerificationSchema = Joi.object({
  aadhaarNumber: Joi.string().trim().length(12).pattern(/^\d+$/).required(),
  otp: Joi.string().trim().length(6).pattern(/^\d+$/).optional()
});

const aadhaarOtpSchema = Joi.object({
  aadhaarNumber: Joi.string().trim().length(12).pattern(/^\d+$/).required()
});

// Mock Aadhaar verification service (replace with actual API in production)
class AadhaarService {
  static async sendOTP(aadhaarNumber) {
    // In production, integrate with actual Aadhaar API
    // This is a mock implementation
    try {
      if (process.env.NODE_ENV === 'production' && process.env.AADHAAR_API_URL) {
        const response = await axios.post(`${process.env.AADHAAR_API_URL}/send-otp`, {
          aadhaar_number: aadhaarNumber,
          client_id: process.env.AADHAAR_CLIENT_ID,
          client_secret: process.env.AADHAAR_CLIENT_SECRET
        });
        
        return {
          success: true,
          requestId: response.data.request_id,
          message: 'OTP sent successfully'
        };
      } else {
        // Mock response for development
        return {
          success: true,
          requestId: `mock_request_${Date.now()}`,
          message: 'OTP sent successfully (Mock)'
        };
      }
    } catch (error) {
      console.error('Aadhaar OTP send error:', error);
      throw new Error('Failed to send OTP');
    }
  }

  static async verifyOTP(aadhaarNumber, otp, requestId) {
    // In production, integrate with actual Aadhaar API
    try {
      if (process.env.NODE_ENV === 'production' && process.env.AADHAAR_API_URL) {
        const response = await axios.post(`${process.env.AADHAAR_API_URL}/verify-otp`, {
          aadhaar_number: aadhaarNumber,
          otp: otp,
          request_id: requestId,
          client_id: process.env.AADHAAR_CLIENT_ID,
          client_secret: process.env.AADHAAR_CLIENT_SECRET
        });
        
        return {
          success: response.data.success,
          verified: response.data.verified,
          userInfo: response.data.user_info || null,
          message: response.data.message
        };
      } else {
        // Mock verification for development
        // Accept any OTP for testing, but validate format
        const isValidOtp = /^\d{6}$/.test(otp);
        
        if (!isValidOtp) {
          return {
            success: false,
            verified: false,
            message: 'Invalid OTP format'
          };
        }

        // Mock successful verification
        return {
          success: true,
          verified: true,
          userInfo: {
            name: 'Mock User',
            dob: '1990-01-01',
            gender: 'M',
            address: 'Mock Address'
          },
          message: 'Aadhaar verified successfully (Mock)'
        };
      }
    } catch (error) {
      console.error('Aadhaar OTP verify error:', error);
      throw new Error('Failed to verify OTP');
    }
  }

  static async getAadhaarInfo(aadhaarNumber) {
    // Basic Aadhaar number validation and info
    try {
      if (process.env.NODE_ENV === 'production' && process.env.AADHAAR_API_URL) {
        const response = await axios.post(`${process.env.AADHAAR_API_URL}/get-info`, {
          aadhaar_number: aadhaarNumber,
          client_id: process.env.AADHAAR_CLIENT_ID,
          client_secret: process.env.AADHAAR_CLIENT_SECRET
        });
        
        return response.data;
      } else {
        // Mock response for development
        return {
          success: true,
          exists: true,
          message: 'Aadhaar number exists (Mock)'
        };
      }
    } catch (error) {
      console.error('Aadhaar info fetch error:', error);
      throw new Error('Failed to fetch Aadhaar information');
    }
  }
}

// Temporary storage for OTP requests (use Redis in production)
const otpStore = new Map();

// @route   POST /api/aadhaar/send-otp
// @desc    Send OTP to Aadhaar registered mobile number
// @access  Private
router.post('/send-otp', 
  authenticate,
  sensitiveOperationLimit(3, 15 * 60 * 1000), // 3 attempts per 15 minutes
  async (req, res) => {
    try {
      // Validate request body
      const { error, value } = aadhaarOtpSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }

      const { aadhaarNumber } = value;
      const user = req.user;

      // Check if Aadhaar number is already verified by another user
      if (user.aadhaarNumber !== aadhaarNumber) {
        const existingUser = await User.findOne({ 
          aadhaarNumber: aadhaarNumber,
          aadhaarVerified: true 
        });
        
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'This Aadhaar number is already verified by another user'
          });
        }
      }

      // Check rate limiting per Aadhaar number
      const lastOtpTime = otpStore.get(aadhaarNumber)?.timestamp;
      if (lastOtpTime && Date.now() - lastOtpTime < 2 * 60 * 1000) { // 2 minutes
        return res.status(429).json({
          success: false,
          message: 'Please wait before requesting another OTP'
        });
      }

      // Send OTP
      const otpResult = await AadhaarService.sendOTP(aadhaarNumber);
      
      if (!otpResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Failed to send OTP'
        });
      }

      // Store OTP request info
      otpStore.set(aadhaarNumber, {
        requestId: otpResult.requestId,
        userId: user._id,
        timestamp: Date.now(),
        attempts: 0
      });

      res.json({
        success: true,
        message: 'OTP sent successfully to your Aadhaar registered mobile number',
        data: {
          requestId: otpResult.requestId,
          expiresIn: 10 * 60 // 10 minutes
        }
      });
    } catch (error) {
      console.error('Send OTP error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send OTP'
      });
    }
  }
);

// @route   POST /api/aadhaar/verify-otp
// @desc    Verify OTP and complete Aadhaar verification
// @access  Private
router.post('/verify-otp',
  authenticate,
  sensitiveOperationLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  async (req, res) => {
    try {
      // Validate request body
      const { error, value } = aadhaarVerificationSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }

      const { aadhaarNumber, otp } = value;
      const user = req.user;

      // Check OTP request exists
      const otpData = otpStore.get(aadhaarNumber);
      if (!otpData || otpData.userId.toString() !== user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP request. Please request a new OTP.'
        });
      }

      // Check OTP expiry (10 minutes)
      if (Date.now() - otpData.timestamp > 10 * 60 * 1000) {
        otpStore.delete(aadhaarNumber);
        return res.status(400).json({
          success: false,
          message: 'OTP has expired. Please request a new OTP.'
        });
      }

      // Check OTP attempts
      if (otpData.attempts >= 3) {
        otpStore.delete(aadhaarNumber);
        return res.status(400).json({
          success: false,
          message: 'Maximum OTP verification attempts exceeded'
        });
      }

      // Verify OTP
      const verificationResult = await AadhaarService.verifyOTP(
        aadhaarNumber, 
        otp, 
        otpData.requestId
      );

      // Increment attempts
      otpData.attempts += 1;
      otpStore.set(aadhaarNumber, otpData);

      if (!verificationResult.success || !verificationResult.verified) {
        return res.status(400).json({
          success: false,
          message: verificationResult.message || 'OTP verification failed',
          attemptsRemaining: 3 - otpData.attempts
        });
      }

      // Update user with Aadhaar verification
      user.aadhaarNumber = aadhaarNumber;
      user.aadhaarVerified = true;
      user.aadhaarVerificationDate = new Date();
      await user.save();

      // Clean up OTP data
      otpStore.delete(aadhaarNumber);

      res.json({
        success: true,
        message: 'Aadhaar verification completed successfully',
        data: {
          aadhaarVerified: true,
          verificationDate: user.aadhaarVerificationDate,
          userInfo: verificationResult.userInfo
        }
      });
    } catch (error) {
      console.error('Verify OTP error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify OTP'
      });
    }
  }
);

// @route   GET /api/aadhaar/status
// @desc    Get Aadhaar verification status
// @access  Private
router.get('/status', authenticate, async (req, res) => {
  try {
    const user = req.user;

    res.json({
      success: true,
      data: {
        aadhaarNumber: user.aadhaarNumber,
        aadhaarVerified: user.aadhaarVerified,
        verificationDate: user.aadhaarVerificationDate,
        hasAadhaar: !!user.aadhaarNumber
      }
    });
  } catch (error) {
    console.error('Get Aadhaar status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Aadhaar status'
    });
  }
});

// @route   DELETE /api/aadhaar/unlink
// @desc    Unlink Aadhaar from account (Admin only or user with proper verification)
// @access  Private
router.delete('/unlink', authenticate, async (req, res) => {
  try {
    const user = req.user;

    if (!user.aadhaarNumber) {
      return res.status(400).json({
        success: false,
        message: 'No Aadhaar number linked to this account'
      });
    }

    // For security, only allow admin or require additional verification
    if (user.role !== 'admin') {
      // In production, you might want additional verification steps here
      return res.status(403).json({
        success: false,
        message: 'Aadhaar unlinking requires admin privileges'
      });
    }

    // Unlink Aadhaar
    user.aadhaarNumber = undefined;
    user.aadhaarVerified = false;
    user.aadhaarVerificationDate = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Aadhaar unlinked successfully'
    });
  } catch (error) {
    console.error('Unlink Aadhaar error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unlink Aadhaar'
    });
  }
});

// @route   POST /api/aadhaar/validate
// @desc    Validate Aadhaar number format and existence
// @access  Private
router.post('/validate', authenticate, async (req, res) => {
  try {
    const { error, value } = aadhaarOtpSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Aadhaar number format'
      });
    }

    const { aadhaarNumber } = value;

    // Check if already used by another user
    const existingUser = await User.findOne({ 
      aadhaarNumber: aadhaarNumber,
      _id: { $ne: req.user._id }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'This Aadhaar number is already registered'
      });
    }

    // Validate with Aadhaar service (optional)
    try {
      const aadhaarInfo = await AadhaarService.getAadhaarInfo(aadhaarNumber);
      
      res.json({
        success: true,
        message: 'Aadhaar number is valid',
        data: {
          valid: true,
          exists: aadhaarInfo.exists,
          canProceed: true
        }
      });
    } catch (serviceError) {
      // If service is unavailable, still allow format validation
      res.json({
        success: true,
        message: 'Aadhaar number format is valid',
        data: {
          valid: true,
          exists: null, // Cannot verify existence
          canProceed: true
        }
      });
    }
  } catch (error) {
    console.error('Validate Aadhaar error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate Aadhaar number'
    });
  }
});

module.exports = router; 