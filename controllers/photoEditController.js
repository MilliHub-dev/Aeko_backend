import sharp from 'sharp';
import path from 'path';

export const editPhoto = async (req, res) => {
  try {
    const { filter } = req.body;
    const filePath = req.file.path;
    let image = sharp(filePath);

    // Example filters
    if (filter === 'greyscale') image = image.greyscale();
    if (filter === 'blur') image = image.blur(5);
    if (filter === 'rotate') image = image.rotate(90);

    const outputPath = path.join('uploads', 'edited_' + req.file.filename + path.extname(req.file.originalname));
    await image.toFile(outputPath);

    res.json({ success: true, url: '/' + outputPath });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};