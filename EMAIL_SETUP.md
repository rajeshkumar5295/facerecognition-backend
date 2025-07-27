# Email Setup Guide

## Setting up Email Notifications

To enable email notifications when organizations are created, you need to configure email settings in your `.env` file.

### 1. Create Environment File

Create a `.env` file in the `rajesh/backend` directory with the following content:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/attendance_system

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your_refresh_token_secret_here
REFRESH_TOKEN_EXPIRES_IN=30d

# Server Configuration
PORT=5000
NODE_ENV=development

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Email Configuration (Gmail example)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

### 2. Gmail Setup (Recommended)

If using Gmail:

1. **Enable 2-Factor Authentication**:
   - Go to your Google Account settings
   - Enable 2-factor authentication

2. **Generate App Password**:
   - Go to Google Account > Security > 2-Step Verification > App passwords
   - Select "Mail" and generate a password
   - Use this generated password as `EMAIL_PASSWORD` in your `.env` file

3. **Update Environment Variables**:
   ```env
   EMAIL_USER=your-actual-email@gmail.com
   EMAIL_PASSWORD=your-16-character-app-password
   ```

### 3. Other Email Providers

For other email providers, you can modify the transporter configuration in `controllers/AuthController.js`:

```javascript
const transporter = nodemailer.createTransporter({
  host: 'your-smtp-host.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});
```

### 4. Testing Email Setup

After configuration:

1. Restart your backend server
2. Try creating a new organization
3. Check the console logs for email sending status
4. Check the recipient's email inbox

### 5. Email Features

When an organization is created successfully:

- ✅ Welcome email sent to the manager
- ✅ Organization details included
- ✅ **Organization Invite Code** prominently displayed
- ✅ Next steps instructions
- ✅ Direct login link
- ✅ Professional HTML formatting

### 6. Troubleshooting

**Common Issues:**

1. **Authentication Error**: Check if App Password is correct for Gmail
2. **Connection Timeout**: Verify SMTP settings and firewall
3. **Email not received**: Check spam folder, verify email address

**Console Logs:**
- Success: "Organization created email sent successfully to: email@example.com"
- Error: "Error sending organization email: [error details]"

**Note**: Email sending is non-blocking - organization creation will succeed even if email fails. 