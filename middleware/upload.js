import multer from "multer";
import fs from "fs";
import path from "path";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath;
        
        if (file.mimetype.startsWith("image")) {
            uploadPath = "uploads/images/";
        } else if (file.mimetype.startsWith("video")) {
            uploadPath = "uploads/videos/";
        } else if (file.mimetype.startsWith("audio")) {
            uploadPath = "uploads/audio/";
        } else {
            uploadPath = "uploads/files/";
        }
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Generate unique filename with timestamp and random string
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({ 
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow various file types
        const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|mov|avi|webm|mp3|wav|ogg|m4a|aac|pdf|doc|docx|txt/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed types: images, videos, audio, documents'));
        }
    }
});

export default upload;
