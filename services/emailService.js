const nodemailer = require('nodemailer');
const AWS = require('aws-sdk');

class EmailService {
  constructor() {
    this.emailProvider = process.env.EMAIL_PROVIDER || 'nodemailer'; // 'nodemailer' or 'ses'
    this.initializeService();
  }

  initializeService() {
    if (this.emailProvider === 'ses') {
      this.initializeAWSSES();
    } else {
      this.initializeNodemailer();
    }
  }

  // Initialize AWS SES
  initializeAWSSES() {
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_SES_REGION || 'us-east-1'
    });
    
    this.sesClient = new AWS.SES({ apiVersion: '2010-12-01' });
    console.log('✅ AWS SES Email Service initialized');
  }

  // Initialize Nodemailer
  initializeNodemailer() {
    try {
      const emailConfig = this.getNodemailerConfig();
      console.log('📧 Email Config:', {
        service: emailConfig.service || emailConfig.host,
        user: emailConfig.auth?.user ? '***@' + emailConfig.auth.user.split('@')[1] : 'Not set',
        hasPassword: !!emailConfig.auth?.pass
      });
      
      this.transporter = nodemailer.createTransport(emailConfig);
      console.log('✅ Nodemailer Email Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Nodemailer:', error.message);
      throw error;
    }
  }

  // Get nodemailer configuration based on provider
  getNodemailerConfig() {
    const provider = process.env.EMAIL_SERVICE || 'gmail';
    
    // Validate required environment variables
    if (!process.env.EMAIL_USER) {
      throw new Error('EMAIL_USER environment variable is required');
    }
    if (!process.env.EMAIL_PASSWORD) {
      throw new Error('EMAIL_PASSWORD environment variable is required');
    }
    
    const configs = {
      gmail: {
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      },
      outlook: {
        service: 'hotmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      },
      yahoo: {
        service: 'yahoo',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      },
      custom: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      }
    };

    return configs[provider] || configs.gmail;
  }

  // Send email using the configured provider
  async sendEmail(options) {
    try {
      if (this.emailProvider === 'ses') {
        return await this.sendEmailWithSES(options);
      } else {
        return await this.sendEmailWithNodemailer(options);
      }
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      throw error;
    }
  }

  // Send email using AWS SES
  async sendEmailWithSES(options) {
    const params = {
      Source: options.from || process.env.EMAIL_FROM || process.env.EMAIL_USER,
      Destination: {
        ToAddresses: Array.isArray(options.to) ? options.to : [options.to]
      },
      Message: {
        Subject: {
          Data: options.subject,
          Charset: 'UTF-8'
        },
        Body: {}
      }
    };

    // Add HTML content if provided
    if (options.html) {
      params.Message.Body.Html = {
        Data: options.html,
        Charset: 'UTF-8'
      };
    }

    // Add text content if provided
    if (options.text) {
      params.Message.Body.Text = {
        Data: options.text,
        Charset: 'UTF-8'
      };
    }

    // Add CC if provided
    if (options.cc) {
      params.Destination.CcAddresses = Array.isArray(options.cc) ? options.cc : [options.cc];
    }

    // Add BCC if provided
    if (options.bcc) {
      params.Destination.BccAddresses = Array.isArray(options.bcc) ? options.bcc : [options.bcc];
    }

    const result = await this.sesClient.sendEmail(params).promise();
    console.log('✅ Email sent successfully via AWS SES:', result.MessageId);
    return result;
  }

  // Send email using Nodemailer
  async sendEmailWithNodemailer(options) {
    try {
      if (!this.transporter) {
        throw new Error('Nodemailer transporter not initialized');
      }

      const mailOptions = {
        from: options.from || process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments
      };

      console.log('📧 Sending email via Nodemailer to:', options.to);
      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully via Nodemailer:', result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Nodemailer send error:', error.message);
      throw error;
    }
  }

  // Test email connection
  async testConnection() {
    try {
      if (this.emailProvider === 'ses') {
        // Test SES connection by verifying email address
        await this.sesClient.getIdentityVerificationAttributes({
          Identities: [process.env.EMAIL_FROM || process.env.EMAIL_USER]
        }).promise();
        console.log('✅ AWS SES connection successful');
        return true;
      } else {
        // Test Nodemailer connection
        await this.transporter.verify();
        console.log('✅ Nodemailer connection successful');
        return true;
      }
    } catch (error) {
      console.error('❌ Email service connection failed:', error);
      return false;
    }
  }

  // Get organization welcome email template
  getOrganizationWelcomeTemplate(data) {
    return {
      subject: `🎉 Welcome to ${data.organizationName} - Your Organization is Ready!`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 15px; text-align: center; margin-bottom: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
            <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 700;">🎉 Organization Created Successfully!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Welcome to your digital attendance platform</p>
          </div>
          
          <!-- Main Content -->
          <div style="background: white; padding: 40px; border-radius: 15px; box-shadow: 0 5px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
            <h2 style="color: #2d3748; margin-bottom: 20px; font-size: 24px;">Hello ${data.managerName}! 👋</h2>
            
            <p style="color: #4a5568; font-size: 16px; line-height: 1.7; margin-bottom: 25px;">
              Congratulations! Your organization <strong style="color: #2d3748;">"${data.organizationName}"</strong> has been successfully created and is ready to revolutionize your attendance management.
            </p>

            <!-- Organization Details -->
            <div style="background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); padding: 25px; border-radius: 12px; border-left: 5px solid #4299e1; margin: 25px 0;">
              <h3 style="color: #2d3748; margin: 0 0 15px 0; font-size: 18px; display: flex; align-items: center;">
                <span style="font-size: 24px; margin-right: 10px;">📋</span> Your Organization Details
              </h3>
              <div style="display: grid; gap: 8px;">
                <p style="margin: 0; color: #4a5568;">
                  <strong>Organization:</strong> <span style="color: #2d3748;">${data.organizationName}</span>
                </p>
                <p style="margin: 0; color: #4a5568;">
                  <strong>Manager:</strong> <span style="color: #2d3748;">${data.managerName}</span>
                </p>
                <p style="margin: 0; color: #4a5568;">
                  <strong>Email:</strong> <span style="color: #2d3748;">${data.email || 'Not provided'}</span>
                </p>
              </div>
            </div>

            <!-- Invite Code -->
            <div style="background: linear-gradient(135deg, #e6fffa 0%, #b2f5ea 100%); padding: 25px; border-radius: 12px; border-left: 5px solid #38b2ac; margin: 25px 0; text-align: center;">
              <h3 style="color: #2c7a7b; margin: 0 0 15px 0; font-size: 18px;">
                🔑 Employee Invite Code
              </h3>
              <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin: 15px 0;">
                <code style="font-size: 28px; font-weight: bold; color: #2d3748; letter-spacing: 3px; font-family: 'Courier New', monospace;">${data.inviteCode}</code>
              </div>
              <p style="margin: 10px 0 0 0; color: #2c7a7b; font-size: 14px; font-weight: 500;">
                📤 <strong>Share this code with your employees</strong> so they can register and join your organization.
              </p>
            </div>

            <!-- Next Steps -->
            <div style="margin: 30px 0;">
              <h3 style="color: #2d3748; margin-bottom: 20px; font-size: 20px;">
                🚀 What's Next?
              </h3>
              <div style="display: grid; gap: 12px;">
                <div style="display: flex; align-items: center; padding: 12px; background: #f7fafc; border-radius: 8px;">
                  <span style="font-size: 20px; margin-right: 12px;">✅</span>
                  <span style="color: #4a5568; font-size: 15px;">Login to your admin dashboard using your credentials</span>
                </div>
                <div style="display: flex; align-items: center; padding: 12px; background: #f7fafc; border-radius: 8px;">
                  <span style="font-size: 20px; margin-right: 12px;">✅</span>
                  <span style="color: #4a5568; font-size: 15px;">Share the invite code with your employees</span>
                </div>
                <div style="display: flex; align-items: center; padding: 12px; background: #f7fafc; border-radius: 8px;">
                  <span style="font-size: 20px; margin-right: 12px;">✅</span>
                  <span style="color: #4a5568; font-size: 15px;">Approve employee registrations from your dashboard</span>
                </div>
                <div style="display: flex; align-items: center; padding: 12px; background: #f7fafc; border-radius: 8px;">
                  <span style="font-size: 20px; margin-right: 12px;">✅</span>
                  <span style="color: #4a5568; font-size: 15px;">Set up attendance tracking and face recognition</span>
                </div>
              </div>
            </div>

            <!-- Login Button -->
            <div style="text-align: center; margin: 35px 0;">
              <a href="${data.loginUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 16px 35px; 
                        text-decoration: none; 
                        border-radius: 10px; 
                        font-weight: bold; 
                        font-size: 16px;
                        display: inline-block;
                        box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);">
                🔓 Login to Dashboard
              </a>
            </div>

            <!-- Support Section -->
            <div style="border-top: 2px solid #e2e8f0; padding-top: 25px; margin-top: 35px;">
              <div style="background: #fef5e7; padding: 20px; border-radius: 10px; border-left: 4px solid #f6ad55;">
                <p style="color: #744210; font-size: 14px; margin: 0; font-weight: 500;">
                  <strong>💡 Need Help?</strong> Contact our support team if you have any questions about setting up your organization or managing attendance tracking.
                </p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div style="text-align: center; margin-top: 25px;">
            <p style="color: #a0aec0; font-size: 12px; margin: 0;">
              This email was sent to ${data.email || 'your email'} regarding your organization registration.
            </p>
            <p style="color: #a0aec0; font-size: 11px; margin: 5px 0 0 0;">
              © ${new Date().getFullYear()} Attendance Management System. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `
Welcome to ${data.organizationName}!

Hello ${data.managerName},

Congratulations! Your organization "${data.organizationName}" has been successfully created.

Organization Details:
- Organization: ${data.organizationName}
- Manager: ${data.managerName}
- Email: ${data.email || 'Not provided'}

Employee Invite Code: ${data.inviteCode}

Share this code with your employees so they can register and join your organization.

What's Next:
- Login to your admin dashboard: ${data.loginUrl}
- Share the invite code with your employees
- Approve employee registrations
- Set up attendance tracking and face recognition

Need help? Contact our support team.
      `
    };
  }

  // Send organization welcome email
  async sendOrganizationWelcomeEmail(email, data) {
    try {
      const template = this.getOrganizationWelcomeTemplate(data);
      
      await this.sendEmail({
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text
      });
      
      console.log(`✅ Organization welcome email sent successfully to: ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending organization welcome email:', error);
      // Don't throw error - email failure shouldn't stop the registration process
      return false;
    }
  }

  // Send employee welcome email
  async sendEmployeeWelcomeEmail(email, data) {
    try {
      const template = {
        subject: `Welcome to ${data.organizationName} - Registration Received!`,
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
            <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); padding: 25px; border-radius: 12px; text-align: center; margin-bottom: 25px;">
              <h1 style="color: white; margin: 0; font-size: 26px;">🎊 Welcome to ${data.organizationName}!</h1>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 5px 15px rgba(0,0,0,0.08);">
              <h2 style="color: #2d3748; margin-bottom: 20px;">Hi ${data.employeeName}! 👋</h2>
              
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Thank you for registering with <strong>${data.organizationName}</strong>. Your registration has been received and is currently pending approval from your manager.
              </p>
              
              <div style="background: #fff5f5; border-left: 4px solid #feb2b2; padding: 20px; margin: 20px 0; border-radius: 6px;">
                <p style="color: #c53030; margin: 0; font-weight: 500;">
                  ⏳ <strong>Status:</strong> Pending Manager Approval
                </p>
              </div>
              
              <p style="color: #4a5568; font-size: 15px; line-height: 1.6;">
                You'll receive another email once your account is approved and you can log in to start using the attendance system.
              </p>
              
              <div style="text-align: center; margin: 25px 0;">
                <p style="color: #718096; font-size: 14px; margin: 0;">
                  Thank you for your patience! 🙏
                </p>
              </div>
            </div>
          </div>
        `,
        text: `Welcome to ${data.organizationName}! Hi ${data.employeeName}, your registration is pending approval from your manager. You'll receive another email once approved.`
      };

      await this.sendEmail({
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text
      });
      
      console.log(`✅ Employee welcome email sent successfully to: ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending employee welcome email:', error);
      return false;
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(email, data) {
    try {
      await this.sendEmail({
        to: email,
        subject: 'Password Reset Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333;">Password Reset Request</h1>
            <p>Hi ${data.userName},</p>
            <p>You requested a password reset. Click the link below to reset your password:</p>
            <a href="${data.resetUrl}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
        `,
        text: `Password reset requested. Visit: ${data.resetUrl}`
      });
      
      console.log(`✅ Password reset email sent successfully to: ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending password reset email:', error);
      return false;
    }
  }
}

// Export singleton instance
module.exports = new EmailService(); 