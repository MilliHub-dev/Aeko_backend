import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create Cloudinary storage for different file types
const createCloudinaryStorage = (resourceType = 'auto', folder = 'aeko') => {
    return new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            resource_type: resourceType,
            folder: folder,
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'webm', 'mp3', 'wav', 'ogg', 'm4a', 'aac', 'pdf', 'doc', 'docx'],
            transformation: [
                {
                    quality: 'auto',
                    fetch_format: 'auto'
                }
            ],
            public_id: (req, file) => {
                // Generate unique filename with timestamp
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const name = file.originalname.split('.')[0];
                return `${name}-${uniqueSuffix}`;
            }
        },
    });
};

// Storage configurations for different media types
const imageStorage = createCloudinaryStorage('image', 'aeko/images');
const videoStorage = createCloudinaryStorage('video', 'aeko/videos');
const audioStorage = createCloudinaryStorage('video', 'aeko/audio'); // Cloudinary treats audio as video resource type
const documentStorage = createCloudinaryStorage('raw', 'aeko/documents');

// File filter function
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|mov|avi|webm|mp3|wav|ogg|m4a|aac|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(file.originalname.split('.').pop().toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Invalid file type. Allowed types: images, videos, audio, documents'));
    }
};

// Create multer upload instances
const createUpload = (storage) => {
    return multer({
        storage,
        limits: {
            fileSize: 100 * 1024 * 1024, // 100MB limit
        },
        fileFilter
    });
};

// Export different upload configurations
export const imageUpload = createUpload(imageStorage);
export const videoUpload = createUpload(videoStorage);
export const audioUpload = createUpload(audioStorage);
export const documentUpload = createUpload(documentStorage);

// General upload that auto-detects file type
const generalStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: (req, file) => {
        let folder = 'aeko/files';
        let resourceType = 'auto';

        if (file.mimetype.startsWith('image')) {
            folder = 'aeko/images';
            resourceType = 'image';
        } else if (file.mimetype.startsWith('video')) {
            folder = 'aeko/videos';
            resourceType = 'video';
        } else if (file.mimetype.startsWith('audio')) {
            folder = 'aeko/audio';
            resourceType = 'video'; // Cloudinary treats audio as video
        } else {
            folder = 'aeko/documents';
            resourceType = 'raw';
        }

        return {
            resource_type: resourceType,
            folder: folder,
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'webm', 'mp3', 'wav', 'ogg', 'm4a', 'aac', 'pdf', 'doc', 'docx'],
            transformation: resourceType === 'image' ? [
                {
                    quality: 'auto',
                    fetch_format: 'auto'
                }
            ] : undefined,
            public_id: (() => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const name = file.originalname.split('.')[0];
                return `${name}-${uniqueSuffix}`;
            })()
        };
    },
});

export const generalUpload = createUpload(generalStorage);

// Utility functions for direct Cloudinary operations
export const uploadToCloudinary = async (filePath, options = {}) => {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: options.folder || 'aeko',
            resource_type: options.resourceType || 'auto',
            transformation: options.transformation || [
                {
                    quality: 'auto',
                    fetch_format: 'auto'
                }
            ],
            ...options
        });
        return result;
    } catch (error) {
        throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
};

export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
    try {
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType
        });
        return result;
    } catch (error) {
        throw new Error(`Cloudinary deletion failed: ${error.message}`);
    }
};

export const getCloudinaryUrl = (publicId, transformations = {}) => {
    return cloudinary.url(publicId, {
        ...transformations,
        secure: true
    });
};

export default cloudinary;
