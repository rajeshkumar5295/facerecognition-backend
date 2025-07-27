# AWS SES Email Service Setup Guide

## Overview

This guide will help you set up AWS SES (Simple Email Service) for production-grade email sending in your attendance management system.

## 📋 Prerequisites

1. AWS Account
2. AWS CLI installed (optional but recommended)
3. Verified email domain or addresses in AWS SES

## 🚀 AWS SES Setup Steps

### Step 1: AWS Account Setup

1. **Create AWS Account**: Sign up at [aws.amazon.com](https://aws.amazon.com)
2. **Access AWS SES**: Navigate to AWS Console > Services > SES (Simple Email Service)

### Step 2: Verify Email Addresses/Domains

#### Option A: Verify Individual Email Addresses
```bash
1. Go to SES Console > Verified identities
2. Click "Create identity"
3. Select "Email address"
4. Enter your email (e.g., noreply@yourcompany.com)
5. Click "Create identity"
6. Check your email and click verification link
```

#### Option B: Verify Entire Domain (Recommended for Production)
```bash
1. Go to SES Console > Verified identities
2. Click "Create identity"
3. Select "Domain"
4. Enter your domain (e.g., yourcompany.com)
5. Enable DKIM signing (recommended)
6. Add DNS records provided by AWS to your domain
7. Wait for verification (can take up to 72 hours)
```

### Step 3: Request Production Access

**Important**: By default, AWS SES is in "Sandbox Mode" with limitations:
- Can only send to verified email addresses
- Limited to 200 emails per day
- Maximum send rate of 1 email per second

To remove these limits:

1. Go to SES Console > Account dashboard
2. Click "Request production access"
3. Fill out the request form with:
   - Mail type: "Transactional" 
   - Use case description: "Sending welcome emails and notifications for attendance management system"
   - Expected sending volume
4. Wait for AWS approval (usually 24-48 hours)

### Step 4: Create IAM User for Programmatic Access

1. **Go to IAM Console**: AWS Console > Services > IAM
2. **Create User**:
   ```bash
   - Click "Users" > "Add user"
   - Username: "ses-smtp-user" 
   - Access type: "Programmatic access"
   - Click "Next: Permissions"
   ```

3. **Attach Policy**:
   ```bash
   - Click "Attach existing policies directly"
   - Search for "AmazonSESFullAccess" or create custom policy:
   ```

4. **Custom Policy (More Secure)**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "ses:SendEmail",
           "ses:SendRawEmail",
           "ses:GetIdentityVerificationAttributes"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

5. **Download Credentials**: Save the Access Key ID and Secret Access Key

### Step 5: Configure Environment Variables

Update your `.env` file in `rajesh/backend/`:

```env
# Email Configuration
EMAIL_PROVIDER=ses
EMAIL_FROM=noreply@yourcompany.com

# AWS SES Configuration
AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_SES_REGION=us-east-1

# Alternative: Use AWS profile (if AWS CLI configured)
# AWS_PROFILE=default

# Fallback to Nodemailer for development
# EMAIL_PROVIDER=nodemailer
# EMAIL_SERVICE=gmail
# EMAIL_USER=your-email@gmail.com
# EMAIL_PASSWORD=your-app-password
```

## 🔧 Configuration Options

### Email Provider Switching

The system supports easy switching between email providers:

```env
# Use AWS SES (Production)
EMAIL_PROVIDER=ses

# Use Nodemailer (Development)
EMAIL_PROVIDER=nodemailer
EMAIL_SERVICE=gmail  # or outlook, yahoo, custom
```

### AWS SES Regions

Choose the region closest to your users:

```env
# US East (N. Virginia) - Default
AWS_SES_REGION=us-east-1

# US West (Oregon)
AWS_SES_REGION=us-west-2

# Europe (Ireland)
AWS_SES_REGION=eu-west-1

# Asia Pacific (Singapore)
AWS_SES_REGION=ap-southeast-1
```

## 📧 Email Templates Available

### 1. Organization Welcome Email
- **Trigger**: When new organization is created
- **Recipient**: Organization manager/admin
- **Content**: Welcome message, invite code, next steps

### 2. Employee Welcome Email
- **Trigger**: When employee registers
- **Recipient**: New employee
- **Content**: Registration confirmation, pending approval status

### 3. Password Reset Email
- **Trigger**: When user requests password reset
- **Recipient**: User requesting reset
- **Content**: Reset link with expiration

## 🧪 Testing Email Setup

### Test Email Service Connection

Add this route to test your email configuration:

```javascript
// In routes/auth.js
router.post('/test-email', async (req, res) => {
  try {
    const emailService = require('../services/emailService');
    
    // Test connection
    const connectionTest = await emailService.testConnection();
    if (!connectionTest) {
      return res.status(500).json({ success: false, message: 'Email service connection failed' });
    }
    
    // Send test email
    await emailService.sendEmail({
      to: req.body.email || 'test@example.com',
      subject: 'Test Email from Attendance System',
      html: '<h1>Email service is working!</h1><p>This is a test email.</p>',
      text: 'Email service is working! This is a test email.'
    });
    
    res.json({ success: true, message: 'Test email sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

### Test from Frontend

```bash
curl -X POST http://localhost:5000/api/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"your-test-email@example.com"}'
```

## 🔍 Monitoring and Analytics

### AWS SES Console Monitoring

1. **Sending Statistics**: Track emails sent, bounces, complaints
2. **Reputation Metrics**: Monitor sender reputation
3. **Configuration Sets**: Set up advanced tracking

### Enable CloudWatch Metrics

```javascript
// Optional: Add CloudWatch logging
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();

// Log email metrics
await cloudwatch.putMetricData({
  Namespace: 'AttendanceSystem/Email',
  MetricData: [{
    MetricName: 'EmailsSent',
    Value: 1,
    Unit: 'Count'
  }]
}).promise();
```

## 🚨 Troubleshooting

### Common Issues

1. **"Email address not verified"**
   - Verify sender email in SES Console
   - Check if you're still in sandbox mode

2. **"Access Denied" Error**
   - Check IAM permissions
   - Verify AWS credentials in environment variables

3. **"Sending quota exceeded"**
   - Request production access
   - Monitor sending limits in SES Console

4. **High bounce rate**
   - Verify recipient email addresses
   - Clean your email list
   - Check email content for spam triggers

### Debug Mode

Enable debug logging:

```env
# Add to .env
NODE_ENV=development
DEBUG_EMAIL=true
```

```javascript
// In emailService.js
if (process.env.DEBUG_EMAIL === 'true') {
  console.log('📧 Email Debug:', {
    provider: this.emailProvider,
    to: options.to,
    subject: options.subject
  });
}
```

## 💰 Cost Optimization

### AWS SES Pricing (as of 2024)

- **First 62,000 emails per month**: FREE (when sent from EC2)
- **Additional emails**: $0.10 per 1,000 emails
- **Attachments**: $0.12 per GB

### Cost-Saving Tips

1. **Use templates** instead of generating HTML each time
2. **Batch emails** when possible
3. **Monitor bounce rates** to avoid reputation damage
4. **Use SES in same region** as your application

## 🔐 Security Best Practices

1. **Use IAM roles** instead of access keys when possible
2. **Rotate access keys** regularly
3. **Limit IAM permissions** to minimum required
4. **Use VPC endpoints** for enhanced security
5. **Enable CloudTrail** for audit logging

## 📊 Production Checklist

- [ ] Domain/email addresses verified in SES
- [ ] Production access approved
- [ ] IAM user created with minimal permissions
- [ ] Environment variables configured
- [ ] Email templates tested
- [ ] Monitoring set up
- [ ] Bounce/complaint handling implemented
- [ ] Backup email provider configured (optional)

## 🔄 Switching Between Providers

The email service supports seamless switching:

```bash
# Switch to AWS SES
EMAIL_PROVIDER=ses

# Switch back to Nodemailer
EMAIL_PROVIDER=nodemailer
```

No code changes required - just update environment variables and restart the server!

---

## Support

For issues with this setup:
1. Check AWS SES documentation
2. Review CloudWatch logs
3. Test with AWS CLI: `aws ses send-email --help`
4. Contact AWS Support if needed 