# Environment Configuration Guide

## Complete .env File Example

Create a `.env` file in `rajesh/backend/` directory with the following configuration:

```env
# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================
MONGODB_URI=mongodb://localhost:27017/attendance_system

# =============================================================================
# JWT CONFIGURATION
# =============================================================================
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random_min_32_chars
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your_refresh_token_secret_here_different_from_jwt_secret
REFRESH_TOKEN_EXPIRES_IN=30d

# =============================================================================
# SERVER CONFIGURATION
# =============================================================================
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# =============================================================================
# EMAIL CONFIGURATION
# =============================================================================

# Choose your email provider: 'nodemailer' or 'ses'
EMAIL_PROVIDER=nodemailer

# From address for emails
EMAIL_FROM=noreply@yourcompany.com

# =============================================================================
# NODEMAILER CONFIGURATION (for development/small scale)
# =============================================================================

# Email service: 'gmail', 'outlook', 'yahoo', or 'custom'
EMAIL_SERVICE=gmail

# For Gmail, Outlook, Yahoo
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# For custom SMTP servers
# EMAIL_HOST=smtp.yourprovider.com
# EMAIL_PORT=587
# EMAIL_SECURE=false

# =============================================================================
# AWS SES CONFIGURATION (for production)
# =============================================================================

# AWS Credentials (when EMAIL_PROVIDER=ses)
# AWS_ACCESS_KEY_ID=your_aws_access_key_id
# AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
# AWS_SES_REGION=us-east-1

# Alternative: Use AWS Profile (if AWS CLI is configured)
# AWS_PROFILE=default

# =============================================================================
# FILE UPLOAD CONFIGURATION
# =============================================================================
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads

# =============================================================================
# FACE RECOGNITION API (if using external service)
# =============================================================================
# FACE_API_URL=your-face-api-url
# FACE_API_KEY=your-face-api-key

# =============================================================================
# DEBUG AND LOGGING
# =============================================================================
DEBUG_EMAIL=false
LOG_LEVEL=info

# =============================================================================
# SECURITY SETTINGS
# =============================================================================
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# =============================================================================
# CORS SETTINGS
# =============================================================================
CORS_ORIGIN=http://localhost:3000
```

## Configuration for Different Environments

### Development Environment

```env
NODE_ENV=development
EMAIL_PROVIDER=nodemailer
EMAIL_SERVICE=gmail
EMAIL_USER=your-dev-email@gmail.com
EMAIL_PASSWORD=your-app-password
DEBUG_EMAIL=true
LOG_LEVEL=debug
```

### Production Environment

```env
NODE_ENV=production
EMAIL_PROVIDER=ses
EMAIL_FROM=noreply@yourcompany.com
AWS_ACCESS_KEY_ID=your_production_aws_key
AWS_SECRET_ACCESS_KEY=your_production_aws_secret
AWS_SES_REGION=us-east-1
DEBUG_EMAIL=false
LOG_LEVEL=error
```

### Staging Environment

```env
NODE_ENV=staging
EMAIL_PROVIDER=ses
EMAIL_FROM=staging@yourcompany.com
AWS_ACCESS_KEY_ID=your_staging_aws_key
AWS_SECRET_ACCESS_KEY=your_staging_aws_secret
AWS_SES_REGION=us-east-1
DEBUG_EMAIL=true
LOG_LEVEL=info
```

## Email Provider Configurations

### 1. Gmail Setup

```env
EMAIL_PROVIDER=nodemailer
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
```

**Steps to get Gmail App Password:**
1. Enable 2-Factor Authentication
2. Go to Google Account > Security > 2-Step Verification > App passwords
3. Generate password for "Mail"
4. Use the generated 16-character password

### 2. Outlook/Hotmail Setup

```env
EMAIL_PROVIDER=nodemailer
EMAIL_SERVICE=outlook
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
```

### 3. Yahoo Setup

```env
EMAIL_PROVIDER=nodemailer
EMAIL_SERVICE=yahoo
EMAIL_USER=your-email@yahoo.com
EMAIL_PASSWORD=your-app-password
```

### 4. Custom SMTP Setup

```env
EMAIL_PROVIDER=nodemailer
EMAIL_SERVICE=custom
EMAIL_HOST=smtp.yourprovider.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@yourprovider.com
EMAIL_PASSWORD=your-password
```

### 5. AWS SES Setup

```env
EMAIL_PROVIDER=ses
EMAIL_FROM=noreply@yourcompany.com
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_SES_REGION=us-east-1
```

## Security Best Practices

### 1. Environment File Security

```bash
# Add .env to .gitignore
echo ".env" >> .gitignore

# Set proper file permissions
chmod 600 .env
```

### 2. Generate Strong Secrets

```javascript
// Generate JWT secrets
const crypto = require('crypto');
console.log('JWT_SECRET:', crypto.randomBytes(64).toString('hex'));
console.log('REFRESH_TOKEN_SECRET:', crypto.randomBytes(64).toString('hex'));
```

### 3. Validate Environment Variables

Add to your `server.js`:

```javascript
// Validate required environment variables
const requiredEnvVars = [
  'JWT_SECRET',
  'MONGODB_URI',
  'EMAIL_PROVIDER'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars);
  process.exit(1);
}

// Validate email configuration
if (process.env.EMAIL_PROVIDER === 'ses') {
  const sesVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SES_REGION'];
  const missingSesVars = sesVars.filter(varName => !process.env[varName]);
  
  if (missingSesVars.length > 0) {
    console.error('❌ Missing AWS SES environment variables:', missingSesVars);
    process.exit(1);
  }
}

if (process.env.EMAIL_PROVIDER === 'nodemailer') {
  const nodemailerVars = ['EMAIL_USER', 'EMAIL_PASSWORD'];
  const missingNodemailerVars = nodemailerVars.filter(varName => !process.env[varName]);
  
  if (missingNodemailerVars.length > 0) {
    console.error('❌ Missing Nodemailer environment variables:', missingNodemailerVars);
    process.exit(1);
  }
}
```

## Environment Variable Descriptions

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `development` | No |
| `PORT` | Server port | `5000` | No |
| `MONGODB_URI` | MongoDB connection string | - | Yes |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `JWT_EXPIRES_IN` | JWT expiration time | `7d` | No |
| `EMAIL_PROVIDER` | Email service provider | `nodemailer` | No |
| `EMAIL_FROM` | From email address | `EMAIL_USER` | No |
| `EMAIL_USER` | SMTP username | - | If using Nodemailer |
| `EMAIL_PASSWORD` | SMTP password/app password | - | If using Nodemailer |
| `AWS_ACCESS_KEY_ID` | AWS access key | - | If using SES |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | - | If using SES |
| `AWS_SES_REGION` | AWS SES region | `us-east-1` | If using SES |

## Testing Configuration

### Test Database Connection

```javascript
// Add to server.js
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});
```

### Test Email Configuration

```javascript
// Add test route
app.get('/test/email', async (req, res) => {
  try {
    const emailService = require('./services/emailService');
    
    const testResult = await emailService.testConnection();
    
    res.json({
      success: true,
      emailProvider: process.env.EMAIL_PROVIDER,
      connectionTest: testResult
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

## Deployment Considerations

### Docker Environment

```dockerfile
# Dockerfile
ENV NODE_ENV=production
ENV EMAIL_PROVIDER=ses
```

### PM2 Ecosystem

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'attendance-api',
    script: 'server.js',
    env: {
      NODE_ENV: 'development',
      EMAIL_PROVIDER: 'nodemailer'
    },
    env_production: {
      NODE_ENV: 'production',
      EMAIL_PROVIDER: 'ses'
    }
  }]
};
```

### Kubernetes ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: attendance-config
data:
  NODE_ENV: "production"
  EMAIL_PROVIDER: "ses"
  AWS_SES_REGION: "us-east-1"
```

## Troubleshooting

### Common Issues

1. **Email not sending**
   - Check EMAIL_PROVIDER value
   - Verify credentials
   - Test email service connection

2. **JWT errors**
   - Ensure JWT_SECRET is set and long enough
   - Check token expiration settings

3. **Database connection issues**
   - Verify MONGODB_URI format
   - Check network connectivity
   - Ensure MongoDB is running

### Debug Mode

```env
DEBUG_EMAIL=true
LOG_LEVEL=debug
NODE_ENV=development
```

This will enable detailed logging for troubleshooting.

---

## Quick Start Checklist

- [ ] Copy `.env.example` to `.env`
- [ ] Set `MONGODB_URI`
- [ ] Generate and set `JWT_SECRET`
- [ ] Configure email provider
- [ ] Set `FRONTEND_URL`
- [ ] Test configuration
- [ ] Add `.env` to `.gitignore` 