import path from 'path';
import fs from 'fs';
import cloudinary from '../services/cloudinaryService.js';

export const editPhoto = async (req, res) => {
  try {
    const sharpModule = await import('sharp').catch(() => null);
    if (!sharpModule || !sharpModule.default) {
      return res.status(503).json({
        success: false,
        message: 'Image processing unavailable'
      });
    }
    const sharp = sharpModule.default;
    const { filter } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }
    
    const inputSource = req.file.buffer || req.file.path;
    let image = sharp(inputSource);

    if (filter === 'greyscale') image = image.greyscale();
    if (filter === 'blur') image = image.blur(5);
    if (filter === 'rotate') image = image.rotate(90);

    const editedBuffer = await image.toBuffer();

    const hasCloudinary =
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET;

    if (process.env.NODE_ENV === 'production' && hasCloudinary) {
      const b64 = Buffer.from(editedBuffer).toString('base64');
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;
      const uploadResult = await cloudinary.uploader.upload(dataURI, {
        folder: 'aeko/edited',
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }]
      });
      if (!uploadResult || !uploadResult.secure_url) {
        return res.status(500).json({
          success: false,
          message: 'Upload failed'
        });
      }
      return res.json({
        success: true,
        url: uploadResult.secure_url
      });
    }

    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const uniqueName = `edited_${Date.now()}_${Math.round(Math.random() * 1e9)}${path.extname(req.file.originalname)}`;
    const outputPath = path.join(uploadsDir, uniqueName);
    fs.writeFileSync(outputPath, editedBuffer);

    res.json({ 
      success: true, 
      url: '/' + path.join('uploads', uniqueName).replace(/\\/g, '/')
    });
  } catch (error) {
    console.error('Error editing photo:', error);
    
    if (error.message && error.message.includes('Input file')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid image file format' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to edit photo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
