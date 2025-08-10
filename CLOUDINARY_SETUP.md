# Cloudinary Integration Setup

## Overview
The attendance system now uses Cloudinary for image storage instead of local file storage. This provides better scalability, automatic image optimization, and cloud-based storage.

## Required Environment Variables

Add these variables to your `.env` file:

```env
# Cloudinary Configuration (REQUIRED)
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
```

## Getting Cloudinary Credentials

1. **Create a Cloudinary Account**
   - Go to [cloudinary.com](https://cloudinary.com)
   - Sign up for a free account
   - The free tier includes:
     - 25 GB storage
     - 25 GB bandwidth
     - 25,000 transformations per month

2. **Get Your Credentials**
   - After signup, go to your Dashboard
   - Copy the following from the "Account Details" section:
     - Cloud Name
     - API Key 
     - API Secret

3. **Add to Environment File**
   ```env
   CLOUDINARY_CLOUD_NAME=your-actual-cloud-name
   CLOUDINARY_API_KEY=123456789012345
   CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz123456
   ```

## Features

### Image Storage Structure
- **Face Images**: `attendance-system/faces/`
- **Attendance Images**: `attendance-system/attendance/`

### Automatic Optimizations
- **Face Images**: Resized to max 800x800px, optimized quality
- **Attendance Images**: Resized to max 1200x900px, optimized quality
- **Format**: Auto-format selection (WebP when supported)
- **Quality**: Auto-quality optimization

### API Endpoints

#### Face Enrollment
- `POST /api/auth/enroll-face` - Upload face image with multipart form
- `POST /api/auth/upload-face-base64` - Upload face image as base64

#### Attendance with Images
- `POST /api/attendance/mark` - Mark attendance with face image

### Database Changes
Both User and Attendance models now support:
- `cloudinaryUrl`: The public URL of the image
- `cloudinaryPublicId`: Used for image deletion
- `path`: Legacy local path (deprecated but kept for backward compatibility)

## Migration from Local Storage

If you have existing local images, you can migrate them using the provided migration script:

```bash
npm run migrate-to-cloudinary
```

## Testing Cloudinary Connection

You can test your Cloudinary setup using the test endpoint:

```bash
curl -X POST http://localhost:5000/api/auth/test-cloudinary \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Error Handling

If Cloudinary is not configured properly, the system will:
1. Log detailed error messages
2. Return user-friendly error responses
3. Fall back gracefully where possible

## Security Features

- **Signed Uploads**: For direct frontend uploads
- **Transformation Security**: Prevent unauthorized transformations
- **Access Control**: Images are publicly accessible but with secure URLs
- **Automatic Cleanup**: Failed uploads are automatically cleaned up

## Performance Benefits

1. **CDN Delivery**: Images served from global CDN
2. **Automatic Optimization**: WebP, AVIF support when available
3. **Responsive Images**: On-demand resizing
4. **Caching**: Browser and CDN caching

## Troubleshooting

### Common Issues

1. **Invalid Credentials**
   ```
   Error: Invalid API Key or API Secret
   ```
   - Double-check your credentials in .env file
   - Ensure no extra spaces or quotes

2. **Network Issues**
   ```
   Error: Upload failed - Network timeout
   ```
   - Check internet connection
   - Verify Cloudinary service status

3. **File Size Limits**
   ```
   Error: File too large
   ```
   - Face images: 5MB limit
   - Attendance images: 10MB limit

4. **Invalid File Format**
   ```
   Error: Only JPEG, JPG, and PNG images are allowed
   ```
   - Only image files are supported
   - Check file extension and MIME type

### Getting Help

1. Check Cloudinary dashboard for upload logs
2. Enable debug mode: `NODE_ENV=development`
3. Check server logs for detailed error messages
4. Verify environment variables are loaded correctly

## Cost Optimization

1. **Use Transformations Wisely**: Each unique transformation counts toward your limit
2. **Monitor Usage**: Check dashboard regularly
3. **Cleanup Unused Images**: Delete old face enrollments when users re-enroll
4. **Use Appropriate Quality Settings**: Balance quality vs. bandwidth

## Next Steps

After setting up Cloudinary:
1. Update your `.env` file with credentials
2. Restart your server
3. Test face enrollment
4. Test attendance marking
5. Monitor the Cloudinary dashboard for usage
