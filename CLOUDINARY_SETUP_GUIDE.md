# Cloudinary Integration Setup Guide

## Overview
Your Aeko backend has been successfully configured to use Cloudinary for file storage instead of local storage. This provides better scalability, automatic image optimization, and CDN delivery.

## Prerequisites
1. Create a Cloudinary account at [cloudinary.com](https://cloudinary.com)
2. Get your Cloudinary credentials from the dashboard

## Configuration Steps

### 1. Environment Variables
Copy `.env.example` to `.env` and update the Cloudinary configuration:

```bash
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_actual_cloud_name
CLOUDINARY_API_KEY=your_actual_api_key
CLOUDINARY_API_SECRET=your_actual_api_secret
```

### 2. Features Implemented

#### File Upload Types
- **Images**: JPG, JPEG, PNG, GIF, WEBP
- **Videos**: MP4, MOV, AVI, WEBM
- **Audio**: MP3, WAV, OGG, M4A, AAC
- **Documents**: PDF, DOC, DOCX, TXT

#### Automatic Organization
Files are automatically organized in Cloudinary folders:
- `aeko/images/` - Image files
- `aeko/videos/` - Video files
- `aeko/audio/` - Audio files
- `aeko/documents/` - Document files

#### Automatic Optimizations
- **Images**: Auto quality and format optimization
- **Videos**: Automatic compression
- **CDN**: Global content delivery network

### 3. Updated Routes
The following routes now use Cloudinary:

#### User Routes
- `PUT /api/users/profile-picture` - Profile picture upload

#### Post Routes
- `POST /api/posts/create` - Single media post creation
- `POST /api/posts/create_mixed` - Multiple media post creation

#### Enhanced Chat Routes
- `POST /api/enhanced-chat/upload-voice` - Voice message upload
- `POST /api/enhanced-chat/upload-file` - File upload

#### Enhanced Livestream Routes
- `POST /api/livestream/:streamId/thumbnail` - Stream thumbnail upload

### 4. API Response Changes
With Cloudinary integration, file URLs are now full Cloudinary URLs instead of local paths:

**Before (Local Storage):**
```json
{
  "profilePicture": "/uploads/images/profile-1234567890.jpg"
}
```

**After (Cloudinary):**
```json
{
  "profilePicture": "https://res.cloudinary.com/your-cloud/image/upload/v1234567890/aeko/images/profile-1234567890.jpg"
}
```

### 5. Available Upload Configurations

#### General Upload (Auto-detects file type)
```javascript
import { generalUpload } from '../middleware/upload.js';
router.post('/upload', generalUpload.single('file'), handler);
```

#### Specific Upload Types
```javascript
import { 
  uploadImage, 
  uploadVideo, 
  uploadAudio, 
  uploadDocument 
} from '../middleware/upload.js';

// Image only
router.post('/image', uploadImage.single('image'), handler);

// Video only
router.post('/video', uploadVideo.single('video'), handler);
```

### 6. Utility Functions
The Cloudinary service provides additional utility functions:

```javascript
import { 
  uploadToCloudinary, 
  deleteFromCloudinary, 
  getCloudinaryUrl 
} from '../services/cloudinaryService.js';

// Direct upload
const result = await uploadToCloudinary(filePath, {
  folder: 'custom-folder',
  transformation: [{ width: 500, height: 500, crop: 'fill' }]
});

// Delete file
await deleteFromCloudinary(publicId, 'image');

// Generate URL with transformations
const url = getCloudinaryUrl(publicId, {
  width: 300,
  height: 300,
  crop: 'fill'
});
```

## Testing the Integration

### 1. Start the Server
```bash
npm start
# or
npm run dev
```

### 2. Test File Upload
Use any of the upload endpoints with a multipart/form-data request:

```bash
curl -X POST \
  http://localhost:5000/api/users/profile-picture \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: multipart/form-data' \
  -F 'image=@/path/to/your/image.jpg'
```

### 3. Verify Upload
Check the response for a Cloudinary URL starting with `https://res.cloudinary.com/`

## Benefits of Cloudinary Integration

1. **Scalability**: No local storage limitations
2. **Performance**: Global CDN delivery
3. **Optimization**: Automatic image/video optimization
4. **Transformations**: On-the-fly image resizing and effects
5. **Backup**: Cloud-based file storage
6. **Analytics**: Upload and delivery analytics

## Troubleshooting

### Common Issues

1. **Invalid Credentials**
   - Verify your Cloudinary credentials in `.env`
   - Check that environment variables are loaded

2. **File Upload Fails**
   - Check file size (100MB limit)
   - Verify file type is supported
   - Ensure proper authentication

3. **URLs Not Working**
   - Verify Cloudinary account is active
   - Check upload was successful
   - Ensure proper public_id format

### Debug Mode
Enable debug logging by adding to your environment:
```bash
CLOUDINARY_DEBUG=true
```

## Migration from Local Storage

If you have existing files in local storage, you can migrate them to Cloudinary:

1. Create a migration script
2. Upload existing files to Cloudinary
3. Update database URLs to Cloudinary URLs
4. Remove local files after verification

## Security Considerations

1. **API Keys**: Never expose API keys in client-side code
2. **Upload Restrictions**: File type and size limits are enforced
3. **Authentication**: All upload endpoints require proper authentication
4. **Folder Structure**: Files are organized in secure folders

Your Aeko backend is now ready to handle file uploads with Cloudinary!
