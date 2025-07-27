# Face Recognition Attendance System - Backend API

A robust Node.js backend API for a face recognition-based attendance management system. This system provides secure authentication, face recognition capabilities, attendance tracking, and comprehensive user management with email notifications.

## 🚀 Features

### Core Functionality
- **Face Recognition Authentication** - Secure biometric attendance tracking
- **User Management** - Complete CRUD operations for users and organizations
- **Attendance Tracking** - Check-in/check-out with multiple recognition methods
- **Aadhaar Integration** - Optional Aadhaar number verification
- **Email Notifications** - Automated email alerts and confirmations
- **Multi-Organization Support** - Manage multiple organizations
- **Real-time Analytics** - Attendance reports and statistics

### Security Features
- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - Bcrypt encryption for passwords
- **Rate Limiting** - API request throttling
- **CORS Protection** - Cross-origin resource sharing security
- **Helmet Security** - HTTP headers security middleware
- **Input Validation** - Joi schema validation

### Technical Features
- **RESTful API** - Clean and consistent API design
- **MongoDB Integration** - NoSQL database with Mongoose ODM
- **File Upload** - Image handling for face recognition
- **Email Services** - Support for Nodemailer and AWS SES
- **Error Handling** - Comprehensive error management
- **Logging** - Detailed application logging

## 📋 Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (v14 or higher)
- **MongoDB** (v4.4 or higher)
- **npm** or **yarn** package manager

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd facereco-backend/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Copy the environment template
   cp .env.example .env
   
   # Edit the .env file with your configuration
   # See ENVIRONMENT_SETUP.md for detailed configuration
   ```

4. **Database Setup**
   ```bash
   # Start MongoDB (if not running as a service)
   mongod
   
   # The application will automatically create the database and collections
   ```

5. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/attendance_system

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your_refresh_token_secret
REFRESH_TOKEN_EXPIRES_IN=30d

# Server Configuration
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Email Configuration
EMAIL_PROVIDER=nodemailer  # or 'ses'
EMAIL_FROM=noreply@yourcompany.com
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# AWS SES (if using SES)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_SES_REGION=us-east-1
```

For detailed configuration options, see [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md).

## 📁 Project Structure

```
backend/
├── controllers/          # Request handlers
│   ├── AuthController.js
│   ├── UserController.js
│   ├── AttendanceController.js
│   └── OrganizationController.js
├── middleware/           # Custom middleware
│   └── auth.js
├── models/              # Database models
│   ├── User.js
│   ├── Attendance.js
│   └── Organization.js
├── routes/              # API routes
│   ├── auth.js
│   ├── users.js
│   ├── attendance.js
│   ├── organizations.js
│   └── aadhaar.js
├── services/            # Business logic
│   └── emailService.js
├── uploads/             # File uploads
│   ├── faces/           # Face images
│   └── attendance/      # Attendance images
├── server.js            # Main application file
├── package.json
└── README.md
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset

### Users
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `POST /api/users/:id/face-enrollment` - Enroll face for user
- `GET /api/users/:id/attendance` - Get user attendance history

### Attendance
- `POST /api/attendance/check-in` - Check in with face recognition
- `POST /api/attendance/check-out` - Check out with face recognition
- `GET /api/attendance` - Get attendance records
- `GET /api/attendance/reports` - Get attendance reports
- `PUT /api/attendance/:id/approve` - Approve attendance record
- `PUT /api/attendance/:id/reject` - Reject attendance record

### Organizations
- `GET /api/organizations` - Get all organizations
- `POST /api/organizations` - Create organization
- `PUT /api/organizations/:id` - Update organization
- `DELETE /api/organizations/:id` - Delete organization

### Aadhaar
- `POST /api/aadhaar/verify` - Verify Aadhaar number
- `GET /api/aadhaar/status/:userId` - Get Aadhaar verification status

### Health Check
- `GET /api/health` - API health status

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 📊 Database Models

### User Model
- Basic information (name, email, employee ID, department, designation)
- Authentication (password, JWT tokens)
- Face recognition data (descriptors, images)
- Aadhaar information (optional)
- Account status and permissions

### Attendance Model
- User and organization references
- Date and time information
- Recognition method (face, manual, Aadhaar)
- Face confidence scores and images
- Location and device information
- Status and approval workflow

### Organization Model
- Organization details
- Admin users
- Settings and configurations

## 📧 Email Services

The system supports multiple email providers:

### Nodemailer (Development)
- Gmail, Outlook, Yahoo, or custom SMTP
- Easy setup for development and testing

### AWS SES (Production)
- Scalable email service for production
- High deliverability and monitoring

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### Environment-Specific Configurations
- **Development**: Nodemailer with Gmail
- **Staging**: AWS SES with staging credentials
- **Production**: AWS SES with production credentials

## 🔧 Development

### Running Tests
```bash
# Add test scripts to package.json
npm test
```

### Code Quality
```bash
# Linting
npm run lint

# Formatting
npm run format
```

### Database Migrations
The application uses Mongoose schemas that automatically handle database structure. For data migrations, create scripts in a `migrations/` directory.

## 📝 API Documentation

### Request/Response Examples

#### User Registration
```json
POST /api/auth/register
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@company.com",
  "employeeId": "EMP001",
  "department": "Engineering",
  "designation": "Software Engineer",
  "phoneNumber": "+1234567890",
  "password": "securePassword123",
  "organizationId": "org123"
}
```

#### Face Recognition Check-in
```json
POST /api/attendance/check-in
{
  "faceImage": "base64_encoded_image",
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "address": "Bangalore, India"
  }
}
```

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check connection string in `.env`
   - Verify network connectivity

2. **Email Not Sending**
   - Check email provider configuration
   - Verify credentials
   - Test email service connection

3. **JWT Token Issues**
   - Ensure JWT_SECRET is set
   - Check token expiration settings
   - Verify token format in requests

4. **File Upload Errors**
   - Check upload directory permissions
   - Verify file size limits
   - Ensure proper file format

### Debug Mode
Enable debug logging by setting:
```env
DEBUG_EMAIL=true
LOG_LEVEL=debug
NODE_ENV=development
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) for configuration help
- Review the [EMAIL_SETUP.md](./EMAIL_SETUP.md) for email configuration
- Check the [AWS_SES_SETUP.md](./AWS_SES_SETUP.md) for AWS SES setup

## 🔄 Version History

- **v1.0.0** - Initial release with core functionality
- Face recognition attendance system
- User and organization management
- Email notifications
- Aadhaar integration

---

**Note**: This is a backend API. You'll need a frontend application to interact with these endpoints. The API is designed to work with face recognition libraries like face-api.js on the client side. 