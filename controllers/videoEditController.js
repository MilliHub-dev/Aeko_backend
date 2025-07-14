import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

export const editVideo = (req, res) => {
  const { effect } = req.body;
  const filePath = req.file.path;
  const outputPath = path.join('uploads', 'edited_' + req.file.filename + '.mp4');

  let command = ffmpeg(filePath).output(outputPath);

  // Example effects
  if (effect === 'grayscale') command = command.videoFilter('hue=s=0');
  if (effect === 'negate') command = command.videoFilter('negate');
  if (effect === 'blur') command = command.videoFilter('boxblur=10:1');

  command
    .on('end', () => res.json({ success: true, url: '/' + outputPath }))
    .on('error', err => res.status(500).json({ success: false, error: err.message }))
    .run();
};