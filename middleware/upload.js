import { 
    generalUpload, 
    imageUpload, 
    videoUpload, 
    audioUpload, 
    documentUpload 
} from "../services/cloudinaryService.js";

// Export different upload configurations for specific use cases
export const upload = generalUpload; // General upload that auto-detects file type
export { generalUpload }; // Export with the same name for consistency
export const uploadImage = imageUpload;
export const uploadVideo = videoUpload;
export const uploadAudio = audioUpload;
export const uploadDocument = documentUpload;

// Default export for backward compatibility
export default generalUpload;
