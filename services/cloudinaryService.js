const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

class CloudinaryService {
  constructor() {
    this.initializeStorages();
  }

  // Initialize different storage configurations
  initializeStorages() {
    // Face images storage
    this.faceStorage = new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: 'attendance-system/faces',
        allowed_formats: ['jpg', 'png', 'jpeg'],
        transformation: [
          { width: 800, height: 800, crop: 'limit' },
          { quality: 'auto:good' }
        ],
        public_id: (req, file) => {
          const timestamp = Date.now();
          const randomId = Math.round(Math.random() * 1E9);
          return `face-${timestamp}-${randomId}`;
        }
      },
    });

    // Attendance images storage
    this.attendanceStorage = new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: 'attendance-system/attendance',
        allowed_formats: ['jpg', 'png', 'jpeg'],
        transformation: [
          { width: 1200, height: 900, crop: 'limit' },
          { quality: 'auto:good' }
        ],
        public_id: (req, file) => {
          const timestamp = Date.now();
          const randomId = Math.round(Math.random() * 1E9);
          return `attendance-${timestamp}-${randomId}`;
        }
      },
    });
  }

  // Create multer upload middleware for face images
  getFaceUpload() {
    return multer({
      storage: this.faceStorage,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png/;
        const extname = allowedTypes.test(file.originalname.toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
          return cb(null, true);
        } else {
          cb(new Error('Only JPEG, JPG, and PNG images are allowed for faces'));
        }
      }
    });
  }

  // Create multer upload middleware for attendance images
  getAttendanceUpload() {
    return multer({
      storage: this.attendanceStorage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png/;
        const extname = allowedTypes.test(file.originalname.toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
          return cb(null, true);
        } else {
          cb(new Error('Only JPEG, JPG, and PNG images are allowed for attendance'));
        }
      }
    });
  }

  // Upload a buffer directly to Cloudinary
  async uploadBuffer(buffer, options = {}) {
    try {
      const defaultOptions = {
        resource_type: 'image',
        folder: options.folder || 'attendance-system',
        quality: 'auto:good',
        ...options
      };

      return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          defaultOptions,
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        ).end(buffer);
      });
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw error;
    }
  }

  // Upload base64 image to Cloudinary
  async uploadBase64(base64Data, options = {}) {
    try {
      const defaultOptions = {
        resource_type: 'image',
        folder: options.folder || 'attendance-system',
        quality: 'auto:good',
        ...options
      };

      const result = await cloudinary.uploader.upload(base64Data, defaultOptions);
      return result;
    } catch (error) {
      console.error('Cloudinary base64 upload error:', error);
      throw error;
    }
  }

  // Delete image from Cloudinary
  async deleteImage(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result;
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      throw error;
    }
  }

  // Get optimized URL for an image
  getOptimizedUrl(publicId, options = {}) {
    try {
      return cloudinary.url(publicId, {
        quality: 'auto:good',
        fetch_format: 'auto',
        ...options
      });
    } catch (error) {
      console.error('Cloudinary URL generation error:', error);
      return null;
    }
  }

  // Test Cloudinary connection
  async testConnection() {
    try {
      const result = await cloudinary.api.ping();
      console.log('✅ Cloudinary connection successful');
      return true;
    } catch (error) {
      console.error('❌ Cloudinary connection failed:', error);
      return false;
    }
  }

  // Get account usage information
  async getUsage() {
    try {
      const usage = await cloudinary.api.usage();
      return {
        plan: usage.plan,
        credits_used: usage.credits.used,
        credits_limit: usage.credits.limit,
        bandwidth_used: usage.bandwidth.used,
        bandwidth_limit: usage.bandwidth.limit,
        storage_used: usage.storage.used,
        storage_limit: usage.storage.limit
      };
    } catch (error) {
      console.error('Error getting Cloudinary usage:', error);
      return null;
    }
  }

  // Create signed upload URL for frontend direct uploads
  getSignedUploadUrl(options = {}) {
    try {
      const timestamp = Math.round(new Date().getTime() / 1000);
      const params = {
        timestamp: timestamp,
        folder: options.folder || 'attendance-system',
        ...options
      };

      const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);
      
      return {
        url: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
        signature: signature,
        timestamp: timestamp,
        api_key: process.env.CLOUDINARY_API_KEY,
        ...params
      };
    } catch (error) {
      console.error('Error creating signed upload URL:', error);
      return null;
    }
  }
}

// Export singleton instance
module.exports = new CloudinaryService();
