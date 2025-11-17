import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

export const editVideo = (req, res) => {
  try {
    const { effect } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }
    
    const filePath = req.file.path;
    const outputPath = path.join('uploads', 'edited_' + req.file.filename + '.mp4');

    let command = ffmpeg(filePath).output(outputPath);

    // Example effects
    if (effect === 'grayscale') command = command.videoFilter('hue=s=0');
    if (effect === 'negate') command = command.videoFilter('negate');
    if (effect === 'blur') command = command.videoFilter('boxblur=10:1');

    command
      .on('end', () => res.json({ 
        success: true, 
        url: '/' + outputPath 
      }))
      .on('error', (err) => {
        console.error('Error editing video:', err);
        
        // Handle ffmpeg-specific errors
        if (err.message && err.message.includes('ffmpeg')) {
          return res.status(503).json({ 
            success: false, 
            message: 'Video processing service temporarily unavailable' 
          });
        }
        
        res.status(500).json({ 
          success: false, 
          message: 'Failed to edit video',
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      })
      .run();
  } catch (error) {
    console.error('Error in video edit controller:', error);
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process video',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};