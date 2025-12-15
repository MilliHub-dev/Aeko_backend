import path from 'path';

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
    
    const filePath = req.file.path;
    let image = sharp(filePath);

    // Example filters
    if (filter === 'greyscale') image = image.greyscale();
    if (filter === 'blur') image = image.blur(5);
    if (filter === 'rotate') image = image.rotate(90);

    const outputPath = path.join('uploads', 'edited_' + req.file.filename + path.extname(req.file.originalname));
    await image.toFile(outputPath);

    res.json({ 
      success: true, 
      url: '/' + outputPath 
    });
  } catch (error) {
    console.error('Error editing photo:', error);
    
    // Handle sharp-specific errors
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
